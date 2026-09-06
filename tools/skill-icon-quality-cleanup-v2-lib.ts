import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';
import sharp from 'sharp';

import {
	SkillIconCleanupRevisionCompletionAuditSchema,
	SkillIconCleanupRevisionV2PacketSchema as ContractCleanupRevisionV2PacketSchema,
	SkillIconCleanupRevisionV2ResultSchema,
	SkillIconGeometryV2Schema,
	type SkillIconCleanupRevisionCompletionAudit,
	type SkillIconCleanupRevisionV2Result
} from '../packages/contracts/src/index.js';

import {
	CLEANUP_REVISION_PROMPT_INVARIANT,
	CleanupRevisionPacketSchema,
	QUALITY_CLEANUP_ROOT,
	clearCleanupExterior,
	cleanupSlug,
	composeCleanupIcon,
	extractLegacyInterior,
	inspectCleanupComposite,
	loadCleanupRevisionPackets,
	type CleanupRevisionPacket
} from './skill-icon-quality-cleanup-lib.js';
import {
	SKILL_ICON_NORMALIZER_SHARP_VERSION,
	SKILL_ICON_NORMALIZER_VIPS_VERSION,
	prepareSkillIconProviderSourceV3,
	type PreparedSkillIconProviderSourceV3
} from './normalize-skill-icon-provider-source.js';
import {
	CleanupRevisionResultSchema,
	readSafeRepositoryFile
} from './persist-skill-icon-cleanup-output.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const REPOSITORY_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[a-zA-Z0-9._/-]+$/u;

export const CLEANUP_REVISION_V2_PACKET_ROOT =
	`${QUALITY_CLEANUP_ROOT}/prompts/revisions-v2` as const;

export const IDENTITY_ADOPTION_TARGET_IDS = [
	'magical:elemental:still-depths',
	'magical:elemental:warmth',
	'martial:polearm:red-harvest'
] as const;

export const GENERATION_V2_TARGET_IDS = [
	'craft:forging:living-metal',
	'craft:forging:ore-sense',
	'craft:gathering:taming',
	'martial:polearm:rend-armour'
] as const;

const IDENTITY_ADOPTION_TARGETS = new Set<string>(IDENTITY_ADOPTION_TARGET_IDS);
const GENERATION_V2_TARGETS = new Set<string>(GENERATION_V2_TARGET_IDS);

const BindingSchema = z
	.object({ path: z.string().regex(REPOSITORY_PATH), contentHash: z.string().regex(SHA256) })
	.strict();

const RevisionV2OutputSchema = z
	.object({
		providerSourcePath: z.string().regex(REPOSITORY_PATH),
		revisedInteriorPath: z.string().regex(REPOSITORY_PATH),
		compositePath: z.string().regex(REPOSITORY_PATH),
		resultPath: z.string().regex(REPOSITORY_PATH)
	})
	.strict();

const RevisionPacketSchemaVersion = z
	.string()
	.regex(/^skill-icon-quality-cleanup-revision-packet-v(?:[2-9]|[1-9][0-9]+)$/u);

export function cleanupRevisionOutputPaths(targetId: string, revision: number) {
	if (!Number.isInteger(revision) || revision < 2) {
		throw new Error('Cleanup revision output paths require an integer revision >= 2');
	}
	const slug = cleanupSlug(targetId);
	return {
		providerSourcePath: `${QUALITY_CLEANUP_ROOT}/provider-sources/${slug}-v${revision}.png`,
		revisedInteriorPath: `${QUALITY_CLEANUP_ROOT}/revisions/${slug}-v${revision}.png`,
		compositePath: `${QUALITY_CLEANUP_ROOT}/composites/${slug}-v${revision}.png`,
		resultPath: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v${revision}.json`
	};
}

export function cleanupRevisionPredecessorPaths(targetId: string, revision: number) {
	if (!Number.isInteger(revision) || revision < 2) {
		throw new Error('Cleanup revision predecessor paths require an integer revision >= 2');
	}
	const slug = cleanupSlug(targetId);
	if (revision === 2) {
		return {
			packet: `${QUALITY_CLEANUP_ROOT}/prompts/revisions/${slug}-v1.json`,
			result: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v1.json`
		};
	}
	return {
		packet: `${QUALITY_CLEANUP_ROOT}/prompts/revisions-v${revision - 1}/${slug}-v${revision - 1}.json`,
		result: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v${revision - 1}.json`
	};
}

export const CleanupRevisionV2PacketSchema = z
	.object({
		schemaVersion: RevisionPacketSchemaVersion,
		revision: z.number().int().min(2),
		targetId: z.string().min(1),
		name: z.string().min(1),
		domain: z.string().min(1),
		family: z.string().min(1),
		rank: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']),
		motifFamily: z.string().min(1),
		finding: z
			.object({
				targetId: z.string().min(1),
				kind: z.literal('stray-ui-glyph'),
				detail: z.string().min(1),
				requiredAction: z.literal('revise-art')
			})
			.strict(),
		predecessor: z
			.object({
				packet: BindingSchema,
				result: BindingSchema,
				providerSource: BindingSchema,
				transactionContentHash: z.string().regex(SHA256),
				revisedInterior: BindingSchema,
				composite: BindingSchema
			})
			.strict(),
		sourceMode: z.enum(['deterministic-inset', 'identity-adoption', 'generation-v2']),
		transform: z.union([
			z
				.object({
					kind: z.literal('inset-87-of-128-v1'),
					decoderInput: z.literal('remove-bounded-cabx-and-assign-srgb'),
					resize: z
						.object({
							width: z.literal(696),
							height: z.literal(696),
							kernel: z.literal('lanczos3'),
							fastShrinkOnLoad: z.literal(false)
						})
						.strict(),
					placement: z.object({ left: z.literal(164), top: z.literal(192) }).strict(),
					canvas: z.object({ width: z.literal(1024), height: z.literal(1024) }).strict(),
					mask: z.literal('geometry-v2-protected-central-aperture')
				})
				.strict(),
			z
				.object({
					kind: z.string().regex(/^identity-adoption-v[1-9][0-9]*$/u),
					revisedInterior: BindingSchema,
					composite: BindingSchema,
					mask: z.string().regex(/^v[1-9][0-9]*-approved-composition-retained-byte-for-byte$/u)
				})
				.strict()
		]),
		exactPrompt: z.string().min(1),
		exactPromptHash: z.string().regex(SHA256),
		references: z
			.array(
				z
					.object({
						path: z.string().regex(REPOSITORY_PATH),
						purpose: z.string().min(1),
						contentHash: z.string().regex(SHA256)
					})
					.strict()
			)
			.length(5),
		compositionAuthority: z
			.object({ geometry: BindingSchema, backing: BindingSchema, frame: BindingSchema })
			.strict(),
		providerEnvelope: z
			.object({
				profile: z.literal('skill-icon-provider-envelope-v3'),
				mediaType: z.literal('image/png'),
				width: z.literal(1254),
				height: z.literal(1254),
				alphaMode: z.literal('rgb')
			})
			.strict(),
		attempts: z
			.object({ initial: z.literal(1), correctiveEdits: z.literal(1), maximum: z.literal(2) })
			.strict(),
		output: RevisionV2OutputSchema
	})
	.strict()
	.superRefine((packet, context) => {
		const expected = cleanupRevisionOutputPaths(packet.targetId, packet.revision);
		const predecessorPaths = cleanupRevisionPredecessorPaths(packet.targetId, packet.revision);
		if (packet.schemaVersion !== `skill-icon-quality-cleanup-revision-packet-v${packet.revision}`) {
			context.addIssue({
				code: 'custom',
				path: ['schemaVersion'],
				message: 'Revision packet schema version must bind its numeric revision'
			});
		}
		if (JSON.stringify(packet.output) !== JSON.stringify(expected)) {
			context.addIssue({
				code: 'custom',
				path: ['output'],
				message: 'Revision output paths must bind target and revision'
			});
		}
		if (
			(packet.sourceMode === 'identity-adoption') !==
			packet.transform.kind.startsWith('identity-adoption-v')
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform'],
				message: 'Revision source mode must use its exact transform authority'
			});
		}
		if (
			packet.sourceMode === 'identity-adoption' &&
			packet.transform.kind !== `identity-adoption-v${packet.revision - 1}`
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform'],
				message: 'Identity adoption needs the immediate predecessor transform'
			});
		}
		if (
			packet.sourceMode === 'identity-adoption' &&
			packet.transform.mask !==
				`v${packet.revision - 1}-approved-composition-retained-byte-for-byte`
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform', 'mask'],
				message: 'Identity adoption needs the immediate predecessor composition authority'
			});
		}
		if (
			packet.sourceMode === 'identity-adoption' &&
			(!('revisedInterior' in packet.transform) ||
				!('composite' in packet.transform) ||
				packet.transform.revisedInterior.path !== packet.predecessor.revisedInterior.path ||
				packet.transform.revisedInterior.contentHash !==
					packet.predecessor.revisedInterior.contentHash ||
				packet.transform.composite.path !== packet.predecessor.composite.path ||
				packet.transform.composite.contentHash !== packet.predecessor.composite.contentHash)
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform'],
				message:
					'Identity adoption must retain the immediate predecessor interior and composite bindings'
			});
		}
		if (
			packet.sourceMode !== 'identity-adoption' &&
			packet.transform.kind !== 'inset-87-of-128-v1'
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform'],
				message: 'V2 provider source needs inset transform'
			});
		}
		if (
			packet.predecessor.packet.path !== predecessorPaths.packet ||
			packet.predecessor.result.path !== predecessorPaths.result
		) {
			context.addIssue({
				code: 'custom',
				path: ['predecessor'],
				message: 'Revision predecessor must bind its immediate packet and result'
			});
		}
	});

export type CleanupRevisionV2Packet = z.infer<typeof CleanupRevisionV2PacketSchema>;

export interface CleanupRevisionV2PacketArtifact {
	readonly path: string;
	readonly packet: CleanupRevisionV2Packet;
}

export interface CleanupRevisionCandidateReceipt {
	readonly targetId: string;
	readonly revision: number;
	readonly status: 'candidate' | 'revise' | 'failed';
	readonly compositePath: string | null;
}

export interface CleanupRevisionCandidateSelection {
	readonly selected: readonly CleanupRevisionCandidateReceipt[];
	readonly unresolved: readonly {
		readonly targetId: string;
		readonly revision: number;
		readonly status: 'revise' | 'failed' | 'missing';
	}[];
}

export function cleanupRevisionSha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

const sha256 = cleanupRevisionSha256;

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function inside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function regularBytes(root: string, repositoryPath: string): Promise<Buffer> {
	if (!REPOSITORY_PATH.test(repositoryPath)) {
		throw new Error(`Unsafe cleanup v2 repository path: ${repositoryPath}`);
	}
	const absolutePath = path.resolve(root, repositoryPath);
	if (!inside(path.resolve(root), absolutePath)) {
		throw new Error(`Cleanup v2 authority escaped repository root: ${repositoryPath}`);
	}
	return (await readSafeRepositoryFile(root, repositoryPath, 'Cleanup v2 authority')).bytes;
}

function v2Prompt(
	packet: CleanupRevisionPacket,
	sourceMode: CleanupRevisionV2Packet['sourceMode']
): string {
	if (sourceMode !== 'generation-v2') return packet.exactPrompt;
	const strongerInvariant =
		'Preserve the dominant subject, action, palette, lighting, and motif-family ancestry. Remove only the detached explanatory UI glyph named in this packet. Add no replacement badge, arrow, gauge, heart, cross, chevron, corner symbol, text, frame, crest, or rarity letter. Keep the complete subject, every visible limb, held tool, companion, and required equipment inside a generous central safe area with clear margin from the protected aperture; do not crop any identity-bearing form.';
	if (!packet.exactPrompt.includes(CLEANUP_REVISION_PROMPT_INVARIANT)) {
		throw new Error(`V1 prompt invariant drift: ${packet.targetId}`);
	}
	return packet.exactPrompt.replace(CLEANUP_REVISION_PROMPT_INVARIANT, strongerInvariant);
}

function sourceModeFor(targetId: string): CleanupRevisionV2Packet['sourceMode'] {
	if (IDENTITY_ADOPTION_TARGETS.has(targetId)) return 'identity-adoption';
	if (GENERATION_V2_TARGETS.has(targetId)) return 'generation-v2';
	return 'deterministic-inset';
}

function assertRecoveryCoverage(targetIds: readonly string[]): void {
	const all = new Set(targetIds);
	const categorized = new Set([
		...IDENTITY_ADOPTION_TARGET_IDS,
		...GENERATION_V2_TARGET_IDS,
		...targetIds.filter(
			(targetId) => !IDENTITY_ADOPTION_TARGETS.has(targetId) && !GENERATION_V2_TARGETS.has(targetId)
		)
	]);
	if (
		targetIds.length !== 28 ||
		all.size !== 28 ||
		categorized.size !== 28 ||
		IDENTITY_ADOPTION_TARGET_IDS.some((targetId) => !all.has(targetId)) ||
		GENERATION_V2_TARGET_IDS.some((targetId) => !all.has(targetId))
	) {
		throw new Error('Cleanup v2 recovery inventory does not have exact 28-target coverage');
	}
	if (
		targetIds.filter((targetId) => sourceModeFor(targetId) === 'deterministic-inset').length !== 21
	) {
		throw new Error('Cleanup v2 recovery inventory must contain exactly 21 inset recoveries');
	}
}

export async function buildCleanupRevisionV2Packets(
	root = process.cwd()
): Promise<readonly CleanupRevisionV2PacketArtifact[]> {
	const repositoryRoot = path.resolve(root);
	const v1Packets = [...(await loadCleanupRevisionPackets(repositoryRoot))].sort((left, right) =>
		left.path.localeCompare(right.path)
	);
	assertRecoveryCoverage(v1Packets.map(({ packet }) => packet.targetId));
	const packets = await Promise.all(
		v1Packets.map(async ({ path: v1PacketPath, packet }) => {
			const [v1PacketBytes, v1ResultBytes] = await Promise.all([
				regularBytes(repositoryRoot, v1PacketPath),
				regularBytes(repositoryRoot, packet.output.resultPath)
			]);
			const result = CleanupRevisionResultSchema.parse(
				JSON.parse(v1ResultBytes.toString('utf8')) as unknown
			);
			if (
				result.targetId !== packet.targetId ||
				result.revisionPacket.path !== v1PacketPath ||
				result.revisionPacket.contentHash !== sha256(v1PacketBytes) ||
				result.providerSource.path !== packet.output.providerSourcePath ||
				result.revisedInterior.path !== packet.output.revisedInteriorPath ||
				result.composite.path !== packet.output.compositePath
			) {
				throw new Error(`Cleanup v1 predecessor binding drift: ${packet.targetId}`);
			}
			const [providerBytes, interiorBytes, compositeBytes] = await Promise.all([
				regularBytes(repositoryRoot, result.providerSource.path),
				regularBytes(repositoryRoot, result.revisedInterior.path),
				regularBytes(repositoryRoot, result.composite.path)
			]);
			if (
				sha256(providerBytes) !== result.providerSource.contentHash ||
				sha256(interiorBytes) !== result.revisedInterior.contentHash ||
				sha256(compositeBytes) !== result.composite.contentHash
			) {
				throw new Error(`Cleanup v1 predecessor artifact hash drift: ${packet.targetId}`);
			}
			const sourceMode = sourceModeFor(packet.targetId);
			const slug = cleanupSlug(packet.targetId);
			const output = {
				providerSourcePath: `${QUALITY_CLEANUP_ROOT}/provider-sources/${slug}-v2.png`,
				revisedInteriorPath: `${QUALITY_CLEANUP_ROOT}/revisions/${slug}-v2.png`,
				compositePath: `${QUALITY_CLEANUP_ROOT}/composites/${slug}-v2.png`,
				resultPath: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v2.json`
			};
			const transform =
				sourceMode === 'identity-adoption'
					? {
							kind: 'identity-adoption-v1' as const,
							revisedInterior: {
								path: result.revisedInterior.path,
								contentHash: result.revisedInterior.contentHash
							},
							composite: { path: result.composite.path, contentHash: result.composite.contentHash },
							mask: 'v1-approved-composition-retained-byte-for-byte' as const
						}
					: {
							kind: 'inset-87-of-128-v1' as const,
							decoderInput: 'remove-bounded-cabx-and-assign-srgb' as const,
							resize: {
								width: 696 as const,
								height: 696 as const,
								kernel: 'lanczos3' as const,
								fastShrinkOnLoad: false as const
							},
							placement: { left: 164 as const, top: 192 as const },
							canvas: { width: 1024 as const, height: 1024 as const },
							mask: 'geometry-v2-protected-central-aperture' as const
						};
			const exactPrompt = v2Prompt(packet, sourceMode);
			const v2Packet = CleanupRevisionV2PacketSchema.parse({
				schemaVersion: 'skill-icon-quality-cleanup-revision-packet-v2',
				revision: 2,
				targetId: packet.targetId,
				name: packet.name,
				domain: packet.domain,
				family: packet.family,
				rank: packet.rank,
				motifFamily: packet.motifFamily,
				finding: packet.finding,
				predecessor: {
					packet: { path: v1PacketPath, contentHash: sha256(v1PacketBytes) },
					result: { path: packet.output.resultPath, contentHash: sha256(v1ResultBytes) },
					providerSource: {
						path: result.providerSource.path,
						contentHash: result.providerSource.contentHash
					},
					transactionContentHash: result.transactionContentHash,
					revisedInterior: {
						path: result.revisedInterior.path,
						contentHash: result.revisedInterior.contentHash
					},
					composite: { path: result.composite.path, contentHash: result.composite.contentHash }
				},
				sourceMode,
				transform,
				exactPrompt,
				exactPromptHash: sha256(Buffer.from(exactPrompt)),
				references: packet.references,
				compositionAuthority: packet.compositionAuthority,
				providerEnvelope: packet.providerEnvelope,
				attempts: packet.attempts,
				output
			});
			ContractCleanupRevisionV2PacketSchema.parse(v2Packet);
			return {
				path: `${CLEANUP_REVISION_V2_PACKET_ROOT}/${slug}-v2.json`,
				packet: v2Packet
			};
		})
	);
	return packets.sort((left, right) => left.path.localeCompare(right.path));
}

export function cleanupRevisionPacketPath(targetId: string, revision: number): string {
	if (!Number.isInteger(revision) || revision < 2) {
		throw new Error('Cleanup revision packet paths require an integer revision >= 2');
	}
	return `${QUALITY_CLEANUP_ROOT}/prompts/revisions-v${revision}/${cleanupSlug(targetId)}-v${revision}.json`;
}

export function cleanupRevisionCompletionAuditPath(targetId: string, revision: number): string {
	if (!Number.isInteger(revision) || revision < 2) {
		throw new Error('Cleanup revision completion audits require an integer revision >= 2');
	}
	return `${QUALITY_CLEANUP_ROOT}/results/completion-audits/${cleanupSlug(targetId)}-v${revision}.json`;
}

export async function buildCleanupRevisionV3Packets(
	root = process.cwd()
): Promise<readonly CleanupRevisionV2PacketArtifact[]> {
	const repositoryRoot = path.resolve(root);
	const v2Packets = await buildCleanupRevisionV2Packets(repositoryRoot);
	const v3Packets: CleanupRevisionV2PacketArtifact[] = [];
	for (const v2Artifact of v2Packets) {
		const { packet: v2Packet, path: v2PacketPath } = v2Artifact;
		if (v2Packet.sourceMode === 'generation-v2') continue;
		const [v2PacketBytes, v2ResultBytes] = await Promise.all([
			regularBytes(repositoryRoot, v2PacketPath),
			regularBytes(repositoryRoot, v2Packet.output.resultPath)
		]);
		if (!v2PacketBytes.equals(cleanupRevisionV2JsonBytes(v2Packet))) {
			throw new Error(`Cleanup v2 packet drift before v3 chaining: ${v2Packet.targetId}`);
		}
		const v2Result = SkillIconCleanupRevisionV2ResultSchema.parse(
			JSON.parse(v2ResultBytes.toString('utf8')) as unknown
		);
		if (
			v2Result.revision !== 2 ||
			v2Result.status !== 'candidate' ||
			v2Result.targetId !== v2Packet.targetId ||
			v2Result.revisionPacket.path !== v2PacketPath ||
			v2Result.revisionPacket.contentHash !== sha256(v2PacketBytes) ||
			v2Result.sourceMode !== v2Packet.sourceMode ||
			!sameJson(v2Result.compositionAuthority, v2Packet.compositionAuthority)
		) {
			throw new Error(
				`Cleanup v2 predecessor result is not a candidate authority: ${v2Packet.targetId}`
			);
		}
		const [providerBytes, interiorBytes, compositeBytes] = await Promise.all([
			regularBytes(repositoryRoot, v2Result.providerSource.path),
			regularBytes(repositoryRoot, v2Result.revisedInterior.path),
			regularBytes(repositoryRoot, v2Result.composite.path)
		]);
		if (
			sha256(providerBytes) !== v2Result.providerSource.contentHash ||
			sha256(interiorBytes) !== v2Result.revisedInterior.contentHash ||
			sha256(compositeBytes) !== v2Result.composite.contentHash
		) {
			throw new Error(
				`Cleanup v2 predecessor output hash drift before v3 chaining: ${v2Packet.targetId}`
			);
		}
		const transform =
			v2Packet.sourceMode === 'identity-adoption'
				? {
						kind: 'identity-adoption-v2' as const,
						revisedInterior: {
							path: v2Result.revisedInterior.path,
							contentHash: v2Result.revisedInterior.contentHash
						},
						composite: {
							path: v2Result.composite.path,
							contentHash: v2Result.composite.contentHash
						},
						mask: 'v2-approved-composition-retained-byte-for-byte' as const
					}
				: v2Packet.transform;
		const v3Packet = CleanupRevisionV2PacketSchema.parse({
			schemaVersion: 'skill-icon-quality-cleanup-revision-packet-v3',
			revision: 3,
			targetId: v2Packet.targetId,
			name: v2Packet.name,
			domain: v2Packet.domain,
			family: v2Packet.family,
			rank: v2Packet.rank,
			motifFamily: v2Packet.motifFamily,
			finding: v2Packet.finding,
			predecessor: {
				packet: { path: v2PacketPath, contentHash: sha256(v2PacketBytes) },
				result: { path: v2Packet.output.resultPath, contentHash: sha256(v2ResultBytes) },
				providerSource: {
					path: v2Result.providerSource.path,
					contentHash: v2Result.providerSource.contentHash
				},
				transactionContentHash: v2Result.transactionContentHash,
				revisedInterior: {
					path: v2Result.revisedInterior.path,
					contentHash: v2Result.revisedInterior.contentHash
				},
				composite: {
					path: v2Result.composite.path,
					contentHash: v2Result.composite.contentHash
				}
			},
			sourceMode: v2Packet.sourceMode,
			transform,
			exactPrompt: v2Packet.exactPrompt,
			exactPromptHash: v2Packet.exactPromptHash,
			references: v2Packet.references,
			compositionAuthority: v2Packet.compositionAuthority,
			providerEnvelope: v2Packet.providerEnvelope,
			attempts: v2Packet.attempts,
			output: cleanupRevisionOutputPaths(v2Packet.targetId, 3)
		});
		ContractCleanupRevisionV2PacketSchema.parse(v3Packet);
		v3Packets.push({
			path: cleanupRevisionPacketPath(v3Packet.targetId, v3Packet.revision),
			packet: v3Packet
		});
	}
	if (v3Packets.length !== 24) {
		throw new Error('Cleanup v3 recovery must contain exactly 24 deterministic candidates');
	}
	return v3Packets.sort((left, right) => left.path.localeCompare(right.path));
}

export interface CleanupRevisionV2Derivation {
	readonly sourceBytes: Buffer;
	readonly preparedProvider: PreparedSkillIconProviderSourceV3 | null;
	readonly normalizedCanvas: Buffer | null;
	readonly revisedInterior: Buffer;
	readonly composite: Buffer;
	readonly display384: Buffer;
	readonly normalizationTransactionCount: 0 | 1;
	readonly automatedInspection: Awaited<ReturnType<typeof inspectCleanupComposite>>;
	readonly phases: readonly CleanupRevisionV2DerivationPhase[];
}

export interface CleanupRevisionV2DerivationPhase {
	readonly name: 'source-read' | 'normalization' | 'composition' | 'inspection';
	readonly startedAt: string;
	readonly finishedAt: string;
	readonly durationMs: number;
}

export interface CleanupRevisionV2AuthorityBytes {
	readonly [repositoryPath: string]: Buffer | undefined;
}

function assertHash(bytes: Buffer, contentHash: string, label: string): void {
	if (sha256(bytes) !== contentHash) throw new Error(`Cleanup v2 ${label} hash drift`);
}

async function authoritativeBytes(
	root: string,
	binding: { readonly path: string; readonly contentHash: string },
	label: string,
	providedBytes?: CleanupRevisionV2AuthorityBytes
): Promise<Buffer> {
	const bytes = providedBytes?.[binding.path] ?? (await regularBytes(root, binding.path));
	assertHash(bytes, binding.contentHash, label);
	return bytes;
}

function assertV2PacketPredecessor(
	packet: CleanupRevisionV2Packet,
	v1Packet: CleanupRevisionPacket,
	v1Result: ReturnType<typeof CleanupRevisionResultSchema.parse>
): void {
	assertIdentityAdoptionPredecessorBindings(packet, v1Result);
	if (
		v1Packet.targetId !== packet.targetId ||
		v1Result.targetId !== packet.targetId ||
		v1Result.transactionContentHash !== packet.predecessor.transactionContentHash ||
		v1Result.providerSource.path !== packet.predecessor.providerSource.path ||
		v1Result.providerSource.contentHash !== packet.predecessor.providerSource.contentHash ||
		v1Result.revisedInterior.path !== packet.predecessor.revisedInterior.path ||
		v1Result.revisedInterior.contentHash !== packet.predecessor.revisedInterior.contentHash ||
		v1Result.composite.path !== packet.predecessor.composite.path ||
		v1Result.composite.contentHash !== packet.predecessor.composite.contentHash ||
		JSON.stringify(v1Result.compositionAuthority) !== JSON.stringify(packet.compositionAuthority)
	) {
		throw new Error(`Cleanup v2 predecessor identity drift: ${packet.targetId}`);
	}
}

/**
 * An identity-adoption lane is a byte-for-byte retention of the preceding
 * receipt's approved interior and composite. Its transform cannot nominate a
 * same-rank artifact from another target (or any other revision).
 */
export function assertIdentityAdoptionPredecessorBindings(
	packet: CleanupRevisionV2Packet,
	predecessor: {
		readonly revisedInterior: { readonly path: string; readonly contentHash: string };
		readonly composite: { readonly path: string; readonly contentHash: string };
	}
): void {
	if (packet.sourceMode !== 'identity-adoption') return;
	if (!('revisedInterior' in packet.transform) || !('composite' in packet.transform)) {
		throw new Error(`Cleanup identity-adoption transform drift: ${packet.targetId}`);
	}
	if (
		packet.transform.revisedInterior.path !== predecessor.revisedInterior.path ||
		packet.transform.revisedInterior.contentHash !== predecessor.revisedInterior.contentHash ||
		packet.transform.composite.path !== predecessor.composite.path ||
		packet.transform.composite.contentHash !== predecessor.composite.contentHash
	) {
		throw new Error(
			`Cleanup identity-adoption predecessor binding drift: ${packet.targetId} v${packet.revision}`
		);
	}
}

function assertImmediateRevisionPredecessor(input: {
	readonly packet: CleanupRevisionV2Packet;
	readonly predecessorPacketBytes: Buffer;
	readonly predecessorResultBytes: Buffer;
}): void {
	const { packet, predecessorPacketBytes, predecessorResultBytes } = input;
	if (packet.revision === 2) {
		const v1Packet = CleanupRevisionPacketSchema.parse(
			JSON.parse(predecessorPacketBytes.toString('utf8')) as unknown
		);
		const v1Result = CleanupRevisionResultSchema.parse(
			JSON.parse(predecessorResultBytes.toString('utf8')) as unknown
		);
		assertV2PacketPredecessor(packet, v1Packet, v1Result);
		return;
	}
	const predecessorPacket = CleanupRevisionV2PacketSchema.parse(
		JSON.parse(predecessorPacketBytes.toString('utf8')) as unknown
	);
	ContractCleanupRevisionV2PacketSchema.parse(predecessorPacket);
	const predecessorResult = SkillIconCleanupRevisionV2ResultSchema.parse(
		JSON.parse(predecessorResultBytes.toString('utf8')) as unknown
	);
	assertIdentityAdoptionPredecessorBindings(packet, predecessorResult);
	if (
		sha256(predecessorPacketBytes) !== packet.predecessor.packet.contentHash ||
		predecessorPacket.revision !== packet.revision - 1 ||
		predecessorResult.revision !== packet.revision - 1 ||
		predecessorPacket.targetId !== packet.targetId ||
		predecessorResult.targetId !== packet.targetId ||
		predecessorResult.revisionPacket.path !== packet.predecessor.packet.path ||
		predecessorResult.revisionPacket.contentHash !== packet.predecessor.packet.contentHash ||
		predecessorResult.resultPath !== packet.predecessor.result.path ||
		sha256(predecessorResultBytes) !== packet.predecessor.result.contentHash ||
		predecessorResult.transactionContentHash !== packet.predecessor.transactionContentHash ||
		predecessorResult.providerSource.path !== packet.predecessor.providerSource.path ||
		predecessorResult.providerSource.contentHash !==
			packet.predecessor.providerSource.contentHash ||
		predecessorResult.revisedInterior.path !== packet.predecessor.revisedInterior.path ||
		predecessorResult.revisedInterior.contentHash !==
			packet.predecessor.revisedInterior.contentHash ||
		predecessorResult.composite.path !== packet.predecessor.composite.path ||
		predecessorResult.composite.contentHash !== packet.predecessor.composite.contentHash ||
		!sameJson(predecessorResult.compositionAuthority, packet.compositionAuthority)
	) {
		throw new Error(
			`Cleanup revision predecessor identity drift: ${packet.targetId} v${packet.revision}`
		);
	}
}

export async function deriveCleanupRevisionV2(input: {
	readonly root?: string;
	readonly packet: CleanupRevisionV2Packet;
	/** A persistence transaction can supply held, authenticated source snapshots. */
	readonly authorityBytes?: CleanupRevisionV2AuthorityBytes;
	/**
	 * Generation-v2 is the only lane whose provider is not inherited from the
	 * predecessor. The caller supplies the held native provider bytes; this
	 * function still authenticates the entire predecessor chain before deriving.
	 */
	readonly generationSourceBytes?: Buffer;
}): Promise<CleanupRevisionV2Derivation> {
	const root = path.resolve(input.root ?? process.cwd());
	const packet = CleanupRevisionV2PacketSchema.parse(input.packet);
	ContractCleanupRevisionV2PacketSchema.parse(packet);
	const phases: CleanupRevisionV2DerivationPhase[] = [];
	async function phase<T>(
		name: CleanupRevisionV2DerivationPhase['name'],
		operation: () => Promise<T>
	): Promise<T> {
		const startedAt = new Date().toISOString();
		const started = process.hrtime.bigint();
		try {
			return await operation();
		} finally {
			const finishedAt = new Date().toISOString();
			phases.push({
				name,
				startedAt,
				finishedAt,
				durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n)
			});
		}
	}
	if (packet.exactPromptHash !== sha256(Buffer.from(packet.exactPrompt))) {
		throw new Error(`Cleanup revision prompt hash drift: ${packet.targetId}`);
	}
	if (
		sharp.versions.sharp !== SKILL_ICON_NORMALIZER_SHARP_VERSION ||
		sharp.versions.vips !== SKILL_ICON_NORMALIZER_VIPS_VERSION
	) {
		throw new Error('Cleanup revision recovery requires the pinned Sharp/libvips toolchain');
	}
	const readSources = () =>
		Promise.all([
			authoritativeBytes(
				root,
				packet.predecessor.packet,
				'immediate predecessor packet',
				input.authorityBytes
			),
			authoritativeBytes(
				root,
				packet.predecessor.result,
				'immediate predecessor result',
				input.authorityBytes
			),
			authoritativeBytes(
				root,
				packet.predecessor.providerSource,
				'immediate predecessor provider source',
				input.authorityBytes
			),
			authoritativeBytes(
				root,
				packet.compositionAuthority.geometry,
				'geometry authority',
				input.authorityBytes
			),
			authoritativeBytes(
				root,
				packet.compositionAuthority.backing,
				'backing authority',
				input.authorityBytes
			),
			authoritativeBytes(
				root,
				packet.compositionAuthority.frame,
				'frame authority',
				input.authorityBytes
			)
		]);
	const [
		predecessorPacketBytes,
		predecessorResultBytes,
		predecessorProviderBytes,
		geometryBytes,
		backing,
		frame
	] = input.authorityBytes ? await readSources() : await phase('source-read', readSources);
	assertImmediateRevisionPredecessor({
		packet,
		predecessorPacketBytes,
		predecessorResultBytes
	});
	const geometry = SkillIconGeometryV2Schema.parse(
		JSON.parse(geometryBytes.toString('utf8')) as unknown
	);
	const providerBytes =
		packet.sourceMode === 'generation-v2' ? input.generationSourceBytes : predecessorProviderBytes;
	if (!providerBytes) {
		throw new Error(
			`Cleanup generation-v2 derivation requires held native provider bytes: ${packet.targetId}`
		);
	}

	if (packet.sourceMode === 'identity-adoption') {
		if (!('revisedInterior' in packet.transform) || !('composite' in packet.transform)) {
			throw new Error(`Cleanup identity-adoption transform drift: ${packet.targetId}`);
		}
		const identityTransform = packet.transform;
		const [adoptedInterior, adoptedComposite] = await phase('normalization', () =>
			Promise.all([
				authoritativeBytes(
					root,
					identityTransform.revisedInterior,
					'adopted v1 interior',
					input.authorityBytes
				),
				authoritativeBytes(
					root,
					identityTransform.composite,
					'adopted v1 composite',
					input.authorityBytes
				)
			])
		);
		const { revisedInterior, composite } = await phase('composition', async () => ({
			revisedInterior: Buffer.from(adoptedInterior),
			composite: Buffer.from(adoptedComposite)
		}));
		const { automatedInspection, display384 } = await phase('inspection', async () => {
			const automatedInspection = await inspectCleanupComposite({
				composite,
				backing,
				interior: revisedInterior,
				frame,
				geometry,
				boundLayerHashes: {
					backing: packet.compositionAuthority.backing.contentHash,
					interior: identityTransform.revisedInterior.contentHash,
					frame: packet.compositionAuthority.frame.contentHash
				}
			});
			return {
				automatedInspection,
				display384: await sharp(composite)
					.resize(384, 384, { fit: 'fill' })
					.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
					.toBuffer()
			};
		});
		if (
			!automatedInspection.layerHashesMatch ||
			!automatedInspection.exactComposite ||
			!automatedInspection.protectedBandMatches ||
			!automatedInspection.exteriorTransparent
		) {
			throw new Error(`Cleanup revision adopted composition inspection failed: ${packet.targetId}`);
		}
		return {
			sourceBytes: providerBytes,
			preparedProvider: null,
			normalizedCanvas: null,
			revisedInterior,
			composite,
			display384,
			normalizationTransactionCount: 0,
			automatedInspection,
			phases
		};
	}
	const insetTransform = packet.transform;
	if (!('resize' in insetTransform) || insetTransform.kind !== 'inset-87-of-128-v1') {
		throw new Error(`Cleanup revision inset lane lacks an inset transform: ${packet.targetId}`);
	}

	const { preparedProvider, normalizedCanvas, interior } = await phase(
		'normalization',
		async () => {
			const preparedProvider = prepareSkillIconProviderSourceV3(providerBytes);
			if (
				packet.sourceMode !== 'generation-v2' &&
				preparedProvider.source.contentHash !== packet.predecessor.providerSource.contentHash
			) {
				throw new Error(`Cleanup revision prepared provider source hash drift: ${packet.targetId}`);
			}
			const resized = await sharp(preparedProvider.decoderInput, {
				failOn: 'error',
				limitInputPixels: 1254 * 1254,
				sequentialRead: true
			})
				.toColourspace('srgb')
				.removeAlpha()
				.resize(insetTransform.resize.width, insetTransform.resize.height, {
					fit: 'fill',
					kernel: sharp.kernel.lanczos3,
					fastShrinkOnLoad: insetTransform.resize.fastShrinkOnLoad
				})
				.ensureAlpha()
				.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
				.toBuffer();
			const normalizedCanvas = await sharp({
				create: {
					width: insetTransform.canvas.width,
					height: insetTransform.canvas.height,
					channels: 4,
					background: { r: 0, g: 0, b: 0, alpha: 0 }
				}
			})
				.composite([
					{
						input: resized,
						left: insetTransform.placement.left,
						top: insetTransform.placement.top
					}
				])
				.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
				.toBuffer();
			return {
				preparedProvider,
				normalizedCanvas,
				interior: await extractLegacyInterior(normalizedCanvas, geometry)
			};
		}
	);
	const composite = await phase('composition', async () =>
		clearCleanupExterior(
			await composeCleanupIcon({ backing, interior: interior.bytes, frame }),
			geometry
		)
	);
	const { automatedInspection, display384 } = await phase('inspection', async () => {
		const automatedInspection = await inspectCleanupComposite({
			composite,
			backing,
			interior: interior.bytes,
			frame,
			geometry,
			boundLayerHashes: {
				backing: packet.compositionAuthority.backing.contentHash,
				interior: sha256(interior.bytes),
				frame: packet.compositionAuthority.frame.contentHash
			}
		});
		return {
			automatedInspection,
			display384: await sharp(composite)
				.resize(384, 384, { fit: 'fill' })
				.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
				.toBuffer()
		};
	});
	if (
		!automatedInspection.layerHashesMatch ||
		!automatedInspection.exactComposite ||
		!automatedInspection.protectedBandMatches ||
		!automatedInspection.exteriorTransparent
	) {
		throw new Error(`Cleanup revision inset composition inspection failed: ${packet.targetId}`);
	}
	return {
		sourceBytes: providerBytes,
		preparedProvider,
		normalizedCanvas,
		revisedInterior: interior.bytes,
		composite,
		display384,
		normalizationTransactionCount: 1,
		automatedInspection,
		phases
	};
}

export interface CleanupRevisionV2Receipt extends CleanupRevisionCandidateReceipt {
	readonly resultPath: string;
	readonly result: SkillIconCleanupRevisionV2Result;
	readonly completionAuditPath: string;
	readonly completionAudit: SkillIconCleanupRevisionCompletionAudit;
}

export interface CleanupRevisionV2Finalization {
	/** Every published v2+ packet, ordered by canonical path. */
	readonly packets: readonly CleanupRevisionV2PacketArtifact[];
	/** Immutable v2 inventory; this remains the required 28-target baseline. */
	readonly baselinePackets: readonly CleanupRevisionV2PacketArtifact[];
	readonly receipts: readonly CleanupRevisionV2Receipt[];
	readonly selection: CleanupRevisionCandidateSelection;
	readonly ready: boolean;
	readonly candidateCount: number;
	readonly pendingGenerationTargetIds: readonly string[];
}

function sameJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

async function readArtifactAndAssert(
	root: string,
	evidence: {
		readonly path: string;
		readonly contentHash: string;
		readonly width: number;
		readonly height: number;
		readonly bytes: number;
	},
	label: string
): Promise<Buffer> {
	const bytes = await regularBytes(root, evidence.path);
	if (sha256(bytes) !== evidence.contentHash) {
		throw new Error(`Cleanup revision ${label} hash drift: ${evidence.path}`);
	}
	const metadata = await sharp(bytes).metadata();
	if (
		metadata.width !== evidence.width ||
		metadata.height !== evidence.height ||
		bytes.byteLength !== evidence.bytes
	) {
		throw new Error(`Cleanup revision ${label} envelope drift: ${evidence.path}`);
	}
	return bytes;
}

function isMissing(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function readPublishedRevisionPackets(input: {
	readonly root: string;
	readonly baselinePackets: readonly CleanupRevisionV2PacketArtifact[];
}): Promise<readonly CleanupRevisionV2PacketArtifact[]> {
	const expectedV2 = new Map(input.baselinePackets.map((artifact) => [artifact.path, artifact]));
	const expectedV3 = new Map(
		(await buildCleanupRevisionV3Packets(input.root)).map((artifact) => [artifact.path, artifact])
	);
	const packetRoot = `${QUALITY_CLEANUP_ROOT}/prompts`;
	const directories = await readdir(path.join(input.root, packetRoot), { withFileTypes: true });
	const published: CleanupRevisionV2PacketArtifact[] = [];
	for (const directory of directories) {
		if (directory.isSymbolicLink()) {
			throw new Error(
				`Cleanup revision packet directory cannot be a symbolic link: ${directory.name}`
			);
		}
		const match = /^revisions-v((?:[2-9]|[1-9][0-9]+))$/u.exec(directory.name);
		if (!match) continue;
		if (!directory.isDirectory()) {
			throw new Error(`Cleanup revision packet root entry must be a directory: ${directory.name}`);
		}
		const revision = Number(match[1]);
		const files = await readdir(path.join(input.root, packetRoot, directory.name), {
			withFileTypes: true
		});
		for (const file of files) {
			if (file.isSymbolicLink() || !file.isFile()) {
				throw new Error(
					`Cleanup revision packet must be a regular file: ${directory.name}/${file.name}`
				);
			}
			if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-v(?:[2-9]|[1-9][0-9]+)\.json$/u.test(file.name)) {
				throw new Error(
					`Cleanup revision packet filename is not canonical: ${directory.name}/${file.name}`
				);
			}
			const repositoryPath = `${packetRoot}/${directory.name}/${file.name}`;
			const bytes = await regularBytes(input.root, repositoryPath);
			const packet = CleanupRevisionV2PacketSchema.parse(
				JSON.parse(bytes.toString('utf8')) as unknown
			);
			ContractCleanupRevisionV2PacketSchema.parse(packet);
			if (
				packet.revision !== revision ||
				repositoryPath !== cleanupRevisionPacketPath(packet.targetId, packet.revision)
			) {
				throw new Error(`Cleanup revision packet path/revision drift: ${repositoryPath}`);
			}
			const expected = expectedV2.get(repositoryPath) ?? expectedV3.get(repositoryPath);
			if (packet.revision === 2 || packet.revision === 3) {
				if (!expected || !bytes.equals(cleanupRevisionV2JsonBytes(expected.packet))) {
					throw new Error(`Cleanup revision packet immutable authority drift: ${repositoryPath}`);
				}
			}
			published.push({ path: repositoryPath, packet });
		}
	}
	for (const [repositoryPath] of expectedV2) {
		if (!published.some((artifact) => artifact.path === repositoryPath)) {
			throw new Error(`Cleanup v2 packet inventory is incomplete: ${repositoryPath}`);
		}
	}
	const keys = published.map(
		(artifact) => `${artifact.packet.targetId}@${artifact.packet.revision}`
	);
	if (new Set(keys).size !== keys.length) {
		throw new Error('Cleanup revision packet inventory contains duplicate target/revision pairs');
	}
	return published.sort((left, right) => left.path.localeCompare(right.path));
}

async function assertRevisionPacketAuthorities(
	root: string,
	packet: CleanupRevisionV2Packet
): Promise<void> {
	for (const reference of packet.references) {
		assertHash(
			await regularBytes(root, reference.path),
			reference.contentHash,
			`ordered reference ${reference.path}`
		);
	}
	for (const [name, binding] of Object.entries(packet.compositionAuthority)) {
		assertHash(await regularBytes(root, binding.path), binding.contentHash, `${name} authority`);
	}
}

function assertReceiptBindings(input: {
	readonly packet: CleanupRevisionV2Packet;
	readonly packetPath: string;
	readonly packetBytes: Buffer;
	readonly result: SkillIconCleanupRevisionV2Result;
	readonly resultBytes: Buffer;
}): void {
	const { packet, packetPath, packetBytes, result } = input;
	assertIdentityAdoptionPredecessorBindings(packet, result.predecessor);
	const identityResultRetainsPredecessor =
		result.sourceMode !== 'identity-adoption' ||
		('revisedInterior' in result.transform &&
			'composite' in result.transform &&
			result.transform.revisedInterior.path === result.predecessor.revisedInterior.path &&
			result.transform.revisedInterior.contentHash ===
				result.predecessor.revisedInterior.contentHash &&
			result.transform.composite.path === result.predecessor.composite.path &&
			result.transform.composite.contentHash === result.predecessor.composite.contentHash);
	if (
		result.revision !== packet.revision ||
		result.targetId !== packet.targetId ||
		result.name !== packet.name ||
		result.rank !== packet.rank ||
		result.motifFamily !== packet.motifFamily ||
		!sameJson(result.finding, packet.finding) ||
		result.revisionPacket.path !== packetPath ||
		result.revisionPacket.contentHash !== sha256(packetBytes) ||
		!sameJson(result.predecessor, packet.predecessor) ||
		result.sourceMode !== packet.sourceMode ||
		!sameJson(result.transform, packet.transform) ||
		!sameJson(result.compositionAuthority, packet.compositionAuthority) ||
		result.providerSource.path !== packet.output.providerSourcePath ||
		result.revisedInterior.path !== packet.output.revisedInteriorPath ||
		result.composite.path !== packet.output.compositePath ||
		result.resultPath !== packet.output.resultPath ||
		!sameJson(result.writtenOutputPaths, Object.values(packet.output)) ||
		result.completionContract.sharedFilesRemainUntouched !== true ||
		result.completionContract.selfPromotionForbidden !== true ||
		!identityResultRetainsPredecessor
	) {
		throw new Error(
			`Cleanup revision receipt binding drift: ${packet.targetId} v${packet.revision}`
		);
	}
}

function assertExecutionProvenance(
	packet: CleanupRevisionV2Packet,
	result: SkillIconCleanupRevisionV2Result
): void {
	if (
		result.execution.invocation.tool !== 'tools/persist-skill-icon-cleanup-v2-output.ts' ||
		result.execution.invocation.command !== 'persist:skill-icon-cleanup-v2-output' ||
		result.execution.invocation.nodeVersion !== process.version ||
		result.execution.invocation.sharpVersion !== SKILL_ICON_NORMALIZER_SHARP_VERSION ||
		result.execution.invocation.vipsVersion !== SKILL_ICON_NORMALIZER_VIPS_VERSION
	) {
		throw new Error(
			`Cleanup revision invocation provenance drift: ${packet.targetId} v${packet.revision}`
		);
	}
	if (
		packet.revision >= 3 &&
		result.execution.phases.some((phase) => phase.name === 'publication')
	) {
		throw new Error(
			`Cleanup v3+ receipt cannot claim publication timing; use its completion audit: ${packet.targetId}`
		);
	}
	if (packet.sourceMode === 'generation-v2') {
		const generation = result.execution.generation;
		if (
			generation.attemptCount < 1 ||
			generation.attemptCount > packet.attempts.maximum ||
			generation.callIdentifiers.length !== generation.attemptCount ||
			generation.callContentHashes?.length !== generation.attemptCount ||
			generation.callContentHashes?.at(-1) !== result.providerSource.contentHash ||
			new Set(generation.callIdentifiers).size !== generation.callIdentifiers.length
		) {
			throw new Error(`Cleanup generation-v2 provenance drift: ${packet.targetId}`);
		}
		return;
	}
	if (
		result.execution.generation.attemptCount !== 0 ||
		result.execution.generation.callIdentifiers.length !== 0 ||
		(result.execution.generation.callContentHashes?.length ?? 0) !== 0
	) {
		throw new Error(`Cleanup deterministic revision claims generation calls: ${packet.targetId}`);
	}
	const expectedNormalizationCount = packet.sourceMode === 'identity-adoption' ? 0 : 1;
	if (result.execution.normalizationTransactionCount !== expectedNormalizationCount) {
		throw new Error(`Cleanup revision normalization accounting drift: ${packet.targetId}`);
	}
}

function assertCompletionAudit(input: {
	readonly audit: SkillIconCleanupRevisionCompletionAudit;
	readonly packet: CleanupRevisionV2Packet;
	readonly packetPath: string;
	readonly packetBytes: Buffer;
	readonly result: SkillIconCleanupRevisionV2Result;
	readonly resultBytes: Buffer;
}): void {
	const { audit, packet, packetPath, packetBytes, result, resultBytes } = input;
	const artifacts = audit.corePublication.artifacts;
	if (
		audit.targetId !== packet.targetId ||
		audit.revision !== packet.revision ||
		audit.revisionPacket.path !== packetPath ||
		audit.revisionPacket.contentHash !== sha256(packetBytes) ||
		audit.result.path !== result.resultPath ||
		audit.result.contentHash !== sha256(resultBytes) ||
		audit.status !== result.status ||
		artifacts.providerSource.path !== result.providerSource.path ||
		artifacts.providerSource.contentHash !== result.providerSource.contentHash ||
		artifacts.revisedInterior.path !== result.revisedInterior.path ||
		artifacts.revisedInterior.contentHash !== result.revisedInterior.contentHash ||
		artifacts.composite.path !== result.composite.path ||
		artifacts.composite.contentHash !== result.composite.contentHash ||
		artifacts.result.path !== result.resultPath ||
		artifacts.result.contentHash !== sha256(resultBytes) ||
		Date.parse(audit.corePublication.startedAt) < Date.parse(result.execution.finishedAt)
	) {
		throw new Error(
			`Cleanup completion audit binding/timing drift: ${packet.targetId} v${packet.revision}`
		);
	}
}

export interface AuthenticatedCleanupRevision {
	readonly packet: CleanupRevisionV2PacketArtifact;
	readonly result: SkillIconCleanupRevisionV2Result;
	readonly resultBytes: Buffer;
	readonly completionAuditPath: string | null;
	readonly completionAudit: SkillIconCleanupRevisionCompletionAudit | null;
}

async function authenticatePublishedRevision(input: {
	readonly root: string;
	readonly artifact: CleanupRevisionV2PacketArtifact;
	readonly allPacketsByPath: ReadonlyMap<string, CleanupRevisionV2PacketArtifact>;
	readonly cache: Map<string, Promise<AuthenticatedCleanupRevision | null>>;
}): Promise<AuthenticatedCleanupRevision | null> {
	const existing = input.cache.get(input.artifact.path);
	if (existing) return existing;
	const task = (async (): Promise<AuthenticatedCleanupRevision | null> => {
		const packetBytes = await regularBytes(input.root, input.artifact.path);
		const parsedPacket = CleanupRevisionV2PacketSchema.parse(
			JSON.parse(packetBytes.toString('utf8')) as unknown
		);
		if (!sameJson(parsedPacket, input.artifact.packet)) {
			throw new Error(
				`Cleanup revision packet changed during authentication: ${input.artifact.path}`
			);
		}
		let resultBytes: Buffer;
		try {
			resultBytes = await regularBytes(input.root, parsedPacket.output.resultPath);
		} catch (error) {
			if (isMissing(error)) return null;
			throw error;
		}
		const result = SkillIconCleanupRevisionV2ResultSchema.parse(
			JSON.parse(resultBytes.toString('utf8')) as unknown
		);
		assertReceiptBindings({
			packet: parsedPacket,
			packetPath: input.artifact.path,
			packetBytes,
			result,
			resultBytes
		});
		await assertRevisionPacketAuthorities(input.root, parsedPacket);
		if (parsedPacket.revision > 2) {
			const predecessor = input.allPacketsByPath.get(parsedPacket.predecessor.packet.path);
			if (!predecessor) {
				throw new Error(
					`Cleanup revision predecessor packet was not published: ${parsedPacket.targetId}`
				);
			}
			const authenticatedPredecessor = await authenticatePublishedRevision({
				...input,
				artifact: predecessor
			});
			if (!authenticatedPredecessor) {
				throw new Error(
					`Cleanup revision predecessor receipt is missing: ${parsedPacket.targetId}`
				);
			}
		}
		const [providerSource, revisedInterior, composite] = await Promise.all([
			readArtifactAndAssert(input.root, result.providerSource, 'provider source'),
			readArtifactAndAssert(input.root, result.revisedInterior, 'revised interior'),
			readArtifactAndAssert(input.root, result.composite, 'composite')
		]);
		const preparedProvider = prepareSkillIconProviderSourceV3(providerSource);
		if (preparedProvider.source.contentHash !== result.providerSource.contentHash) {
			throw new Error(`Cleanup revision provider envelope drift: ${parsedPacket.targetId}`);
		}
		const derived = await deriveCleanupRevisionV2({
			root: input.root,
			packet: parsedPacket,
			...(parsedPacket.sourceMode === 'generation-v2'
				? { generationSourceBytes: providerSource }
				: {})
		});
		if (
			!derived.sourceBytes.equals(providerSource) ||
			!derived.revisedInterior.equals(revisedInterior) ||
			!derived.composite.equals(composite) ||
			sha256(derived.display384) !== result.display384.contentHash ||
			derived.display384.byteLength !== result.display384.bytes
		) {
			throw new Error(
				`Cleanup revision derived artifact authentication failed: ${parsedPacket.targetId}`
			);
		}
		assertExecutionProvenance(parsedPacket, result);
		const transactionContentHash = computeCleanupRevisionTransactionContentHash({
			packetContentHash: sha256(packetBytes),
			predecessor: parsedPacket.predecessor,
			sourceMode: parsedPacket.sourceMode,
			transform: parsedPacket.transform,
			providerSourceContentHash: result.providerSource.contentHash,
			revisedInteriorContentHash: result.revisedInterior.contentHash,
			compositionAuthority: parsedPacket.compositionAuthority,
			compositeContentHash: result.composite.contentHash,
			display384ContentHash: result.display384.contentHash,
			inspection: result.inspection,
			execution: result.execution,
			output: parsedPacket.output
		});
		if (transactionContentHash !== result.transactionContentHash) {
			throw new Error(
				`Cleanup revision transaction hash drift: ${parsedPacket.targetId} v${parsedPacket.revision}`
			);
		}
		const completionAuditPath = cleanupRevisionCompletionAuditPath(
			parsedPacket.targetId,
			parsedPacket.revision
		);
		let completionAudit: SkillIconCleanupRevisionCompletionAudit | null = null;
		try {
			const auditBytes = await regularBytes(input.root, completionAuditPath);
			completionAudit = SkillIconCleanupRevisionCompletionAuditSchema.parse(
				JSON.parse(auditBytes.toString('utf8')) as unknown
			);
			assertCompletionAudit({
				audit: completionAudit,
				packet: parsedPacket,
				packetPath: input.artifact.path,
				packetBytes,
				result,
				resultBytes
			});
		} catch (error) {
			if (!isMissing(error)) throw error;
		}
		return {
			packet: { path: input.artifact.path, packet: parsedPacket },
			result,
			resultBytes,
			completionAuditPath: completionAudit ? completionAuditPath : null,
			completionAudit
		};
	})();
	input.cache.set(input.artifact.path, task);
	return task;
}

/**
 * Independently re-authenticate one terminal receipt. This is intentionally
 * useful to review tooling as well as finalization: it re-derives all raster
 * outputs and requires the post-core-publication audit by default.
 */
export async function authenticateCleanupRevisionReceipt(input: {
	readonly root?: string;
	readonly packetPath: string;
	readonly requireCompletionAudit?: boolean;
}): Promise<AuthenticatedCleanupRevision> {
	const root = path.resolve(input.root ?? process.cwd());
	const artifactsByPath = new Map<string, CleanupRevisionV2PacketArtifact>();
	let currentPath = input.packetPath;
	for (;;) {
		const bytes = await regularBytes(root, currentPath);
		const packet = CleanupRevisionV2PacketSchema.parse(
			JSON.parse(bytes.toString('utf8')) as unknown
		);
		ContractCleanupRevisionV2PacketSchema.parse(packet);
		if (currentPath !== cleanupRevisionPacketPath(packet.targetId, packet.revision)) {
			throw new Error(`Cleanup revision packet path/revision drift: ${currentPath}`);
		}
		artifactsByPath.set(currentPath, { path: currentPath, packet });
		if (packet.revision === 2) break;
		currentPath = packet.predecessor.packet.path;
	}
	const artifact = artifactsByPath.get(input.packetPath);
	if (!artifact) throw new Error(`Cleanup revision packet was not readable: ${input.packetPath}`);
	const authenticated = await authenticatePublishedRevision({
		root,
		artifact,
		allPacketsByPath: artifactsByPath,
		cache: new Map()
	});
	if (!authenticated) throw new Error(`Cleanup revision receipt is missing: ${input.packetPath}`);
	if (input.requireCompletionAudit !== false && !authenticated.completionAudit) {
		throw new Error(`Cleanup revision completion audit is required: ${input.packetPath}`);
	}
	return authenticated;
}

async function mapWithBoundedConcurrency<Input, Output>(input: {
	readonly values: readonly Input[];
	readonly maximum: number;
	readonly map: (value: Input) => Promise<Output>;
}): Promise<readonly Output[]> {
	const outputs: Output[] = new Array(input.values.length);
	let nextIndex = 0;
	const workers = Array.from({ length: Math.min(input.maximum, input.values.length) }, async () => {
		for (;;) {
			const index = nextIndex;
			nextIndex += 1;
			if (index >= input.values.length) return;
			outputs[index] = await input.map(input.values[index]!);
		}
	});
	await Promise.all(workers);
	return outputs;
}

export async function finalizeCleanupRevisionV2(input: {
	readonly root?: string;
}): Promise<CleanupRevisionV2Finalization> {
	const root = path.resolve(input.root ?? process.cwd());
	const baselinePackets = await buildCleanupRevisionV2Packets(root);
	const packets = await readPublishedRevisionPackets({ root, baselinePackets });
	const allPacketsByPath = new Map(packets.map((artifact) => [artifact.path, artifact]));
	const cache = new Map<string, Promise<AuthenticatedCleanupRevision | null>>();
	const authenticatedPackets = await mapWithBoundedConcurrency({
		values: packets,
		maximum: 4,
		map: async (artifact) =>
			authenticatePublishedRevision({
				root,
				artifact,
				allPacketsByPath,
				cache
			})
	});
	const receipts: CleanupRevisionV2Receipt[] = [];
	for (const authenticated of authenticatedPackets) {
		// V2 evidence remains immutable but has no after-publication audit, so it
		// can authenticate as a predecessor only. It is never eligible selection
		// evidence after this protocol repair.
		if (!authenticated?.completionAudit || !authenticated.completionAuditPath) continue;
		receipts.push({
			targetId: authenticated.result.targetId,
			revision: authenticated.result.revision,
			status: authenticated.result.status,
			compositePath: authenticated.result.composite.path,
			resultPath: authenticated.result.resultPath,
			result: authenticated.result,
			completionAuditPath: authenticated.completionAuditPath,
			completionAudit: authenticated.completionAudit
		});
	}
	const selection = selectHighestCleanupRevisionCandidates({
		requiredTargetIds: baselinePackets.map(({ packet }) => packet.targetId),
		declaredRevisions: packets.map(({ packet }) => ({
			targetId: packet.targetId,
			revision: packet.revision
		})),
		receipts
	});
	return {
		packets,
		baselinePackets,
		receipts,
		selection,
		ready:
			selection.unresolved.length === 0 && selection.selected.length === baselinePackets.length,
		candidateCount: selection.selected.length,
		pendingGenerationTargetIds: baselinePackets
			.filter(({ packet }) => packet.sourceMode === 'generation-v2')
			.filter(({ packet }) =>
				selection.unresolved.some((unresolved) => unresolved.targetId === packet.targetId)
			)
			.map(({ packet }) => packet.targetId)
	};
}

export function selectHighestCleanupRevisionCandidates(input: {
	readonly requiredTargetIds: readonly string[];
	/**
	 * Every append-only packet which has been published for a target.  A later
	 * packet without a terminal receipt is deliberately unresolved: selecting an
	 * older candidate would silently bypass the later review decision.
	 */
	readonly declaredRevisions?: readonly { readonly targetId: string; readonly revision: number }[];
	readonly receipts: readonly CleanupRevisionCandidateReceipt[];
}): CleanupRevisionCandidateSelection {
	const selected: CleanupRevisionCandidateReceipt[] = [];
	const unresolved: CleanupRevisionCandidateSelection['unresolved'][number][] = [];
	for (const targetId of input.requiredTargetIds) {
		const declaredHighest = Math.max(
			0,
			...(input.declaredRevisions ?? [])
				.filter((declaration) => declaration.targetId === targetId)
				.map((declaration) => declaration.revision)
		);
		const candidates = input.receipts
			.filter((receipt) => receipt.targetId === targetId)
			.sort((left, right) => right.revision - left.revision);
		const highest = candidates[0];
		if (!highest || highest.revision < declaredHighest) {
			unresolved.push({ targetId, revision: declaredHighest || 0, status: 'missing' });
			continue;
		}
		if (highest.status !== 'candidate' || highest.compositePath === null) {
			unresolved.push({
				targetId,
				revision: highest.revision,
				status: highest.status === 'revise' ? 'revise' : 'failed'
			});
			continue;
		}
		selected.push(highest);
	}
	return { selected, unresolved };
}

export function cleanupRevisionV2JsonBytes(value: unknown): Buffer {
	return jsonBytes(value);
}

/**
 * The receipt digest intentionally covers every reproducible binding and the
 * observed review verdict.  Finalizers call this independently instead of
 * trusting the digest claimed by a receipt.
 */
export function computeCleanupRevisionTransactionContentHash(input: {
	readonly packetContentHash: string;
	readonly predecessor: CleanupRevisionV2Packet['predecessor'];
	readonly sourceMode: CleanupRevisionV2Packet['sourceMode'];
	readonly transform: CleanupRevisionV2Packet['transform'];
	readonly providerSourceContentHash: string;
	readonly revisedInteriorContentHash: string;
	readonly compositionAuthority: CleanupRevisionV2Packet['compositionAuthority'];
	readonly compositeContentHash: string;
	readonly display384ContentHash: string;
	readonly inspection: unknown;
	readonly execution: unknown;
	readonly output: CleanupRevisionV2Packet['output'];
}): string {
	return sha256(
		jsonBytes({
			packet: input.packetContentHash,
			predecessor: input.predecessor,
			sourceMode: input.sourceMode,
			transform: input.transform,
			providerSource: input.providerSourceContentHash,
			revisedInterior: input.revisedInteriorContentHash,
			compositionAuthority: input.compositionAuthority,
			composite: input.compositeContentHash,
			display384: input.display384ContentHash,
			inspection: input.inspection,
			execution: input.execution,
			output: input.output
		})
	);
}

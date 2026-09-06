import { createHash } from 'node:crypto';
import path from 'node:path';

import { z } from 'zod';
import sharp from 'sharp';

import {
	SkillIconCleanupRevisionV2PacketSchema as ContractCleanupRevisionV2PacketSchema,
	SkillIconCleanupRevisionV2ResultSchema,
	SkillIconGeometryV2Schema,
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

export const CleanupRevisionV2PacketSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-quality-cleanup-revision-packet-v2'),
		revision: z.literal(2),
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
		transform: z.discriminatedUnion('kind', [
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
					kind: z.literal('identity-adoption-v1'),
					revisedInterior: BindingSchema,
					composite: BindingSchema,
					mask: z.literal('v1-approved-composition-retained-byte-for-byte')
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
		const slug = packet.targetId.replaceAll(':', '-');
		const expected = {
			providerSourcePath: `${QUALITY_CLEANUP_ROOT}/provider-sources/${slug}-v2.png`,
			revisedInteriorPath: `${QUALITY_CLEANUP_ROOT}/revisions/${slug}-v2.png`,
			compositePath: `${QUALITY_CLEANUP_ROOT}/composites/${slug}-v2.png`,
			resultPath: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v2.json`
		};
		if (JSON.stringify(packet.output) !== JSON.stringify(expected)) {
			context.addIssue({
				code: 'custom',
				path: ['output'],
				message: 'V2 output paths must bind target'
			});
		}
		if (
			packet.sourceMode === 'identity-adoption' &&
			packet.transform.kind !== 'identity-adoption-v1'
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform'],
				message: 'Identity adoption needs identity transform'
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

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

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

export async function deriveCleanupRevisionV2(input: {
	readonly root?: string;
	readonly packet: CleanupRevisionV2Packet;
	/** A persistence transaction can supply held, authenticated source snapshots. */
	readonly authorityBytes?: CleanupRevisionV2AuthorityBytes;
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
		throw new Error(`Cleanup v2 prompt hash drift: ${packet.targetId}`);
	}
	if (
		sharp.versions.sharp !== SKILL_ICON_NORMALIZER_SHARP_VERSION ||
		sharp.versions.vips !== SKILL_ICON_NORMALIZER_VIPS_VERSION
	) {
		throw new Error('Cleanup v2 recovery requires the pinned Sharp/libvips toolchain');
	}
	const readSources = () =>
		Promise.all([
			authoritativeBytes(root, packet.predecessor.packet, 'v1 packet', input.authorityBytes),
			authoritativeBytes(root, packet.predecessor.result, 'v1 result', input.authorityBytes),
			authoritativeBytes(
				root,
				packet.predecessor.providerSource,
				'v1 provider source',
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
	const [v1PacketBytes, v1ResultBytes, providerBytes, geometryBytes, backing, frame] =
		input.authorityBytes ? await readSources() : await phase('source-read', readSources);
	const v1Packet = CleanupRevisionPacketSchema.parse(
		JSON.parse(v1PacketBytes.toString('utf8')) as unknown
	);
	const v1Result = CleanupRevisionResultSchema.parse(
		JSON.parse(v1ResultBytes.toString('utf8')) as unknown
	);
	assertV2PacketPredecessor(packet, v1Packet, v1Result);
	const geometry = SkillIconGeometryV2Schema.parse(
		JSON.parse(geometryBytes.toString('utf8')) as unknown
	);

	if (packet.transform.kind === 'identity-adoption-v1') {
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
			throw new Error(`Cleanup v2 adopted composition inspection failed: ${packet.targetId}`);
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
	if (packet.sourceMode === 'generation-v2') {
		throw new Error(
			`Cleanup v2 generation lane requires a separately authenticated provider output: ${packet.targetId}`
		);
	}
	const insetTransform = packet.transform;
	if (insetTransform.kind !== 'inset-87-of-128-v1') {
		throw new Error(`Cleanup v2 deterministic lane lacks an inset transform: ${packet.targetId}`);
	}

	const { preparedProvider, normalizedCanvas, interior } = await phase(
		'normalization',
		async () => {
			const preparedProvider = prepareSkillIconProviderSourceV3(providerBytes);
			if (preparedProvider.source.contentHash !== packet.predecessor.providerSource.contentHash) {
				throw new Error(`Cleanup v2 prepared provider source hash drift: ${packet.targetId}`);
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
		throw new Error(`Cleanup v2 inset composition inspection failed: ${packet.targetId}`);
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
}

export interface CleanupRevisionV2Finalization {
	readonly packets: readonly CleanupRevisionV2PacketArtifact[];
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
	},
	label: string
): Promise<void> {
	const bytes = await regularBytes(root, evidence.path);
	if (sha256(bytes) !== evidence.contentHash) {
		throw new Error(`Cleanup v2 ${label} hash drift: ${evidence.path}`);
	}
	const metadata = await sharp(bytes).metadata();
	if (metadata.width !== evidence.width || metadata.height !== evidence.height) {
		throw new Error(`Cleanup v2 ${label} envelope drift: ${evidence.path}`);
	}
}

export async function finalizeCleanupRevisionV2(input: {
	readonly root?: string;
}): Promise<CleanupRevisionV2Finalization> {
	const root = path.resolve(input.root ?? process.cwd());
	const packets = await buildCleanupRevisionV2Packets(root);
	const receipts: CleanupRevisionV2Receipt[] = [];
	for (const artifact of packets) {
		const expectedPacketBytes = cleanupRevisionV2JsonBytes(artifact.packet);
		const packetBytes = await regularBytes(root, artifact.path);
		if (!packetBytes.equals(expectedPacketBytes)) {
			throw new Error(`Cleanup v2 packet drift: ${artifact.path}`);
		}
		let resultBytes: Buffer;
		try {
			resultBytes = await regularBytes(root, artifact.packet.output.resultPath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
			throw error;
		}
		const result = SkillIconCleanupRevisionV2ResultSchema.parse(
			JSON.parse(resultBytes.toString('utf8')) as unknown
		);
		if (
			result.targetId !== artifact.packet.targetId ||
			result.revisionPacket.path !== artifact.path ||
			result.revisionPacket.contentHash !== sha256(packetBytes) ||
			!sameJson(result.predecessor, artifact.packet.predecessor) ||
			result.sourceMode !== artifact.packet.sourceMode ||
			!sameJson(result.transform, artifact.packet.transform) ||
			!sameJson(result.compositionAuthority, artifact.packet.compositionAuthority) ||
			result.providerSource.path !== artifact.packet.output.providerSourcePath ||
			result.revisedInterior.path !== artifact.packet.output.revisedInteriorPath ||
			result.composite.path !== artifact.packet.output.compositePath ||
			result.resultPath !== artifact.packet.output.resultPath ||
			!sameJson(result.writtenOutputPaths, Object.values(artifact.packet.output)) ||
			result.completionContract.sharedFilesRemainUntouched !== true ||
			result.completionContract.selfPromotionForbidden !== true
		) {
			throw new Error(`Cleanup v2 receipt binding drift: ${artifact.packet.targetId}`);
		}
		await Promise.all([
			readArtifactAndAssert(root, result.providerSource, 'provider source'),
			readArtifactAndAssert(root, result.revisedInterior, 'revised interior'),
			readArtifactAndAssert(root, result.composite, 'composite')
		]);
		if (artifact.packet.sourceMode === 'identity-adoption') {
			if (artifact.packet.transform.kind !== 'identity-adoption-v1') {
				throw new Error(`Cleanup v2 identity transform drift: ${artifact.packet.targetId}`);
			}
			const [v1Interior, v1Composite, v2Interior, v2Composite] = await Promise.all([
				regularBytes(root, artifact.packet.transform.revisedInterior.path),
				regularBytes(root, artifact.packet.transform.composite.path),
				regularBytes(root, result.revisedInterior.path),
				regularBytes(root, result.composite.path)
			]);
			if (!v1Interior.equals(v2Interior) || !v1Composite.equals(v2Composite)) {
				throw new Error(
					`Cleanup v2 identity adoption changed approved bytes: ${artifact.packet.targetId}`
				);
			}
		}
		receipts.push({
			targetId: result.targetId,
			revision: result.revision,
			status: result.status,
			compositePath: result.composite.path,
			resultPath: result.resultPath,
			result
		});
	}
	const selection = selectHighestCleanupRevisionCandidates({
		requiredTargetIds: packets.map(({ packet }) => packet.targetId),
		receipts
	});
	return {
		packets,
		receipts,
		selection,
		ready: selection.unresolved.length === 0 && selection.selected.length === packets.length,
		candidateCount: selection.selected.length,
		pendingGenerationTargetIds: packets
			.filter(({ packet }) => packet.sourceMode === 'generation-v2')
			.filter(({ packet }) =>
				selection.unresolved.some((unresolved) => unresolved.targetId === packet.targetId)
			)
			.map(({ packet }) => packet.targetId)
	};
}

export function selectHighestCleanupRevisionCandidates(input: {
	readonly requiredTargetIds: readonly string[];
	readonly receipts: readonly CleanupRevisionCandidateReceipt[];
}): CleanupRevisionCandidateSelection {
	const selected: CleanupRevisionCandidateReceipt[] = [];
	const unresolved: CleanupRevisionCandidateSelection['unresolved'][number][] = [];
	for (const targetId of input.requiredTargetIds) {
		const candidates = input.receipts
			.filter((receipt) => receipt.targetId === targetId)
			.sort((left, right) => right.revision - left.revision);
		const highest = candidates[0];
		if (!highest) {
			unresolved.push({ targetId, revision: 0, status: 'missing' });
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

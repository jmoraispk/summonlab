import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
	link,
	lstat,
	mkdtemp,
	mkdir,
	open,
	readFile,
	realpath,
	rm,
	unlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { z } from 'zod';

import {
	SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
	SkillIconCatalogSchema,
	SkillIconExecutionV2Schema,
	SkillIconCleanupAuthoritySchema,
	SkillIconCleanupFindingSchema,
	SkillIconCleanupManifestSchema,
	SkillIconCleanupResultSchema,
	SkillIconGeometryV2Schema,
	type SkillIconCatalog,
	type SkillIconCleanupFinding,
	type SkillIconCleanupManifest,
	type SkillIconGeometryV2
} from '../packages/contracts/src/index.js';
import type { MassProductionManifest } from './skill-icon-mass-production-lib.js';
import {
	SKILL_ICON_NORMALIZER_SHARP_VERSION,
	SKILL_ICON_NORMALIZER_VIPS_VERSION,
	SKILL_ICON_PROVIDER_SIZE
} from './normalize-skill-icon-provider-source.js';
import type { SkillIconMotifMap, SkillIconVisualSpecs } from './skill-icon-production-lib.js';

export const QUALITY_CLEANUP_ROOT =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1' as const;

const MASS_PRODUCTION_ROOT = 'assets/wiki/skills/icon-production-v1/mass-production-v1' as const;
const FINDINGS_SOURCE_PATH = `${QUALITY_CLEANUP_ROOT}/findings.source.json` as const;
const MANIFEST_PATH = `${QUALITY_CLEANUP_ROOT}/manifest.json` as const;
const FINDINGS_PATH = `${QUALITY_CLEANUP_ROOT}/findings.json` as const;

export const CLEANUP_REVISION_PROMPT_INVARIANT =
	'Preserve the dominant subject, action, palette, lighting, and motif-family ancestry. Remove only the detached explanatory UI glyph named in this packet. Add no replacement badge, arrow, gauge, heart, cross, chevron, corner symbol, text, frame, crest, or rarity letter. Keep the complete subject inside the protected central aperture.' as const;

const REPOSITORY_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[a-zA-Z0-9._/-]+$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const RevisionBindingSchema = z
	.object({
		path: z.string().regex(REPOSITORY_PATH),
		contentHash: z.string().regex(SHA256)
	})
	.strict();

export const CleanupRevisionPacketSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-quality-cleanup-revision-packet-v1'),
		revision: z.literal(1),
		targetId: z.string().min(1),
		name: z.string().min(1),
		domain: z.string().min(1),
		family: z.string().min(1),
		rank: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']),
		motifFamily: z.string().min(1),
		finding: SkillIconCleanupFindingSchema,
		visualSpec: z
			.object({
				dominantSubject: z.string().min(1),
				supportingCue: z.string().min(1).nullable(),
				semanticPalette: z.array(z.string().min(1)).min(1),
				composition: z.string().min(1),
				exclusions: z.array(z.string().min(1)).min(1)
			})
			.strict(),
		cleanupManifest: RevisionBindingSchema,
		sourceCandidate: RevisionBindingSchema,
		currentCandidate: RevisionBindingSchema,
		currentResult: RevisionBindingSchema,
		compositionAuthority: z
			.object({
				geometry: RevisionBindingSchema,
				backing: RevisionBindingSchema,
				frame: RevisionBindingSchema
			})
			.strict(),
		providerEnvelope: z
			.object({
				profile: z.literal('skill-icon-provider-envelope-v3'),
				mediaType: z.literal('image/png'),
				width: z.literal(SKILL_ICON_PROVIDER_SIZE),
				height: z.literal(SKILL_ICON_PROVIDER_SIZE),
				alphaMode: z.literal('rgb')
			})
			.strict(),
		normalizationAuthority: z
			.object({
				profile: z.literal('skill-icon-cleanup-artwork-resize-mask-v1'),
				decoderInput: z.literal('remove-bounded-cabx-and-assign-srgb'),
				resize: z
					.object({
						width: z.number().int().positive(),
						height: z.number().int().positive(),
						fit: z.literal('fill'),
						kernel: z.literal('lanczos3'),
						fastShrinkOnLoad: z.literal(false)
					})
					.strict(),
				mask: z.literal('geometry-v2-protected-central-aperture'),
				encoder: z
					.object({
						format: z.literal('png'),
						compressionLevel: z.literal(9),
						adaptiveFiltering: z.literal(false),
						palette: z.literal(false),
						progressive: z.literal(false)
					})
					.strict(),
				sharpVersion: z.literal(SKILL_ICON_NORMALIZER_SHARP_VERSION),
				vipsVersion: z.literal(SKILL_ICON_NORMALIZER_VIPS_VERSION)
			})
			.strict(),
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
		exactPrompt: z.string().min(1),
		exactPromptHash: z.string().regex(SHA256),
		attempts: z
			.object({ initial: z.literal(1), correctiveEdits: z.literal(1), maximum: z.literal(2) })
			.strict(),
		output: z
			.object({
				providerSourcePath: z.string().regex(REPOSITORY_PATH),
				revisedInteriorPath: z.string().regex(REPOSITORY_PATH),
				compositePath: z.string().regex(REPOSITORY_PATH),
				resultPath: z.string().regex(REPOSITORY_PATH)
			})
			.strict()
	})
	.strict();

export type CleanupRevisionPacket = z.infer<typeof CleanupRevisionPacketSchema>;

export interface CleanupRevisionPacketArtifact {
	readonly path: string;
	readonly packet: CleanupRevisionPacket;
}

const AUTHORITY_PATHS = {
	massProductionManifest: `${MASS_PRODUCTION_ROOT}/manifest.json`,
	catalog: 'assets/wiki/skills/icon-production-v1/catalog.json',
	motifMap: 'assets/wiki/skills/icon-production-v1/motif-map.json',
	visualSpecifications: 'assets/wiki/skills/icon-production-v1/visual-specs.json',
	selectedFrameSheet: `${MASS_PRODUCTION_ROOT}/references/approved-seven-frame-sheet.png`,
	optionCMaterial: 'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png',
	geometry: 'assets/wiki/skills/icon-production-v1/geometry-v2.json',
	providerSpaceGuide: 'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png'
} as const;

type CleanupAuthority = SkillIconCleanupManifest['authority'];

export interface CleanupManifestInput {
	readonly authority: CleanupAuthority;
	readonly catalog: SkillIconCatalog;
	readonly massProductionManifest: MassProductionManifest;
	readonly motifMap: SkillIconMotifMap;
	readonly visualSpecifications: SkillIconVisualSpecs;
	readonly geometry: SkillIconGeometryV2;
	readonly findings: readonly SkillIconCleanupFinding[];
	readonly sourceHashesByTargetId: ReadonlyMap<string, string>;
}

export interface CleanupExportReport {
	readonly mode: 'write' | 'check';
	readonly counts: Readonly<{ total: number; Martial: number; Magical: number; Craft: number }>;
	readonly revisionPackets: number;
	readonly written: readonly string[];
	readonly drifted: readonly string[];
}

export interface PixelBounds {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export interface InteriorResult {
	readonly bytes: Buffer;
	readonly removedPixels: number;
	readonly removedPixelBounds: PixelBounds | null;
}

export interface LegacyInteriorOptions {
	readonly frame: Buffer;
	readonly artworkScale?: number;
}

export type CleanupCompositionProfile = 'legacy-v1' | 'frame-opening-v2' | 'frame-opening-v3';

export interface CleanupInspectionInput {
	readonly composite: Buffer;
	readonly backing: Buffer;
	readonly interior: Buffer;
	readonly frame: Buffer;
	readonly geometry: SkillIconGeometryV2;
	readonly compositionProfile?: CleanupCompositionProfile;
	readonly boundLayerHashes?: Readonly<{
		backing: string;
		interior: string;
		frame: string;
	}>;
}

export interface CleanupInspection {
	readonly layerHashesMatch: boolean;
	readonly exactComposite: boolean;
	readonly protectedBandMatches: boolean;
	readonly exteriorTransparent: boolean;
	readonly backingOnlyComponents: readonly {
		readonly pixels: number;
		readonly bounds: PixelBounds;
	}[];
	readonly nearWhiteComponents: readonly {
		readonly pixels: number;
		readonly bounds: PixelBounds;
	}[];
	readonly warnings: readonly string[];
}

export interface CleanupFinalizeReport {
	readonly mode: 'write' | 'check';
	readonly ready: boolean;
	readonly total: number;
	readonly finalized: number;
	readonly pendingLayerJobIds: readonly string[];
	readonly written: readonly string[];
	readonly drifted: readonly string[];
	readonly warnings: readonly string[];
}

export function cleanupSlug(targetId: string): string {
	return targetId.replaceAll(':', '-');
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function isInside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function regularBytes(root: string, repositoryPath: string): Promise<Buffer> {
	const rootRealPath = await realpath(root);
	const absolutePath = path.resolve(root, repositoryPath);
	if (!isInside(rootRealPath, absolutePath)) {
		throw new Error(`Authority path resolves outside the repository root: ${repositoryPath}`);
	}
	const metadata = await lstat(absolutePath);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Refusing symbolic-link or non-regular authority file: ${repositoryPath}`);
	}
	const resolvedPath = await realpath(absolutePath);
	if (!isInside(rootRealPath, resolvedPath)) {
		throw new Error(`Authority path resolves outside the repository root: ${repositoryPath}`);
	}
	return readFile(absolutePath);
}

async function loadAuthority(root: string): Promise<{
	readonly authority: CleanupAuthority;
	readonly bytes: Readonly<Record<keyof typeof AUTHORITY_PATHS, Buffer>>;
}> {
	const entries = await Promise.all(
		Object.entries(AUTHORITY_PATHS).map(async ([key, repositoryPath]) => [
			key,
			await regularBytes(root, repositoryPath)
		])
	);
	const bytes = Object.fromEntries(entries) as Readonly<
		Record<keyof typeof AUTHORITY_PATHS, Buffer>
	>;
	const authority = SkillIconCleanupAuthoritySchema.parse(
		Object.fromEntries(
			Object.entries(AUTHORITY_PATHS).map(([key, repositoryPath]) => [
				key,
				{ path: repositoryPath, contentHash: sha256(bytes[key as keyof typeof AUTHORITY_PATHS]) }
			])
		)
	);
	return { authority, bytes };
}

function parseFindings(bytes: Buffer): readonly SkillIconCleanupFinding[] {
	const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		(parsed as { schemaVersion?: unknown }).schemaVersion !==
			'skill-icon-quality-cleanup-findings-source-v1' ||
		!Array.isArray((parsed as { findings?: unknown }).findings)
	) {
		throw new Error('Invalid cleanup findings source');
	}
	return (parsed as { findings: unknown[] }).findings.map((finding) =>
		SkillIconCleanupFindingSchema.parse(finding)
	);
}

function assertExactTargetCoverage(
	expected: readonly string[],
	actual: readonly string[],
	label: string
): void {
	if (
		expected.length !== actual.length ||
		new Set(actual).size !== actual.length ||
		expected.some((targetId) => !actual.includes(targetId))
	) {
		throw new Error(`${label} does not have exact canonical target coverage`);
	}
}

export async function loadCleanupManifestInput(
	root = process.cwd()
): Promise<CleanupManifestInput> {
	const repositoryRoot = path.resolve(root);
	const [{ authority, bytes }, findingsBytes] = await Promise.all([
		loadAuthority(repositoryRoot),
		regularBytes(repositoryRoot, FINDINGS_SOURCE_PATH)
	]);
	const catalog = SkillIconCatalogSchema.parse(
		JSON.parse(bytes.catalog.toString('utf8')) as unknown
	);
	const massProductionManifest = JSON.parse(
		bytes.massProductionManifest.toString('utf8')
	) as MassProductionManifest;
	const motifMap = JSON.parse(bytes.motifMap.toString('utf8')) as SkillIconMotifMap;
	const visualSpecifications = JSON.parse(
		bytes.visualSpecifications.toString('utf8')
	) as SkillIconVisualSpecs;
	const geometry = SkillIconGeometryV2Schema.parse(
		JSON.parse(bytes.geometry.toString('utf8')) as unknown
	);
	const findings = parseFindings(findingsBytes);
	const sourceHashesByTargetId = new Map<string, string>();

	for (const skill of massProductionManifest.skills) {
		const sourcePath = `${MASS_PRODUCTION_ROOT}/icons/${cleanupSlug(skill.targetId)}.png`;
		if (skill.finalImagePath !== sourcePath) {
			throw new Error(`Mass-production source path is not canonical: ${skill.targetId}`);
		}
		if (!skill.finalImageHash) throw new Error(`Missing frozen source hash: ${skill.targetId}`);
		const contentHash = sha256(await regularBytes(repositoryRoot, sourcePath));
		if (contentHash !== skill.finalImageHash) {
			throw new Error(`Frozen mass-production source hash drift: ${skill.targetId}`);
		}
		sourceHashesByTargetId.set(skill.targetId, contentHash);
	}

	return {
		authority,
		catalog,
		massProductionManifest,
		motifMap,
		visualSpecifications,
		geometry,
		findings,
		sourceHashesByTargetId
	};
}

function dispositionFor(
	findings: readonly SkillIconCleanupFinding[]
): SkillIconCleanupManifest['records'][number]['disposition'] {
	if (findings.some((finding) => finding.requiredAction === 'recompose')) return 'recompose';
	if (findings.some((finding) => finding.requiredAction === 'revise-art')) return 'revise-art';
	if (findings.some((finding) => finding.requiredAction === 'owner-review')) return 'owner-review';
	return 'accepted-unchanged';
}

export function buildSkillIconCleanupManifest(
	input: CleanupManifestInput
): SkillIconCleanupManifest {
	const catalog = SkillIconCatalogSchema.parse(input.catalog);
	const geometry = SkillIconGeometryV2Schema.parse(input.geometry);
	void geometry;
	const authority = SkillIconCleanupAuthoritySchema.parse(input.authority);
	const catalogTargetIds = catalog.records.map((record) => record.targetId);
	const massTargetIds = input.massProductionManifest.skills.map((record) => record.targetId);
	assertExactTargetCoverage(catalogTargetIds, massTargetIds, 'Mass-production manifest');
	assertExactTargetCoverage(
		catalogTargetIds,
		input.motifMap.records.map((record) => record.targetId),
		'Motif map'
	);
	assertExactTargetCoverage(
		catalogTargetIds,
		input.visualSpecifications.records.map((record) => record.targetId),
		'Visual specifications'
	);
	if (
		input.massProductionManifest.expected.skills !== 456 ||
		input.massProductionManifest.expected.domains.Martial !== 258 ||
		input.massProductionManifest.expected.domains.Magical !== 124 ||
		input.massProductionManifest.expected.domains.Craft !== 74
	) {
		throw new Error('Mass-production manifest does not declare the frozen 456-skill inventory');
	}
	const catalogByTargetId = new Map(catalog.records.map((record) => [record.targetId, record]));
	const massByTargetId = new Map(
		input.massProductionManifest.skills.map((record) => [record.targetId, record])
	);
	const findingsByTargetId = new Map<string, SkillIconCleanupFinding[]>();
	for (const finding of input.findings) {
		const parsedFinding = SkillIconCleanupFindingSchema.parse(finding);
		if (!catalogByTargetId.has(parsedFinding.targetId)) {
			throw new Error(`Cleanup finding references an unknown target: ${parsedFinding.targetId}`);
		}
		const attached = findingsByTargetId.get(parsedFinding.targetId) ?? [];
		attached.push(parsedFinding);
		findingsByTargetId.set(parsedFinding.targetId, attached);
	}

	const records = catalog.records.map((catalogRecord) => {
		const massRecord = massByTargetId.get(catalogRecord.targetId);
		if (!massRecord || massRecord.rarity !== catalogRecord.rarity) {
			throw new Error(`Mass-production rank drift: ${catalogRecord.targetId}`);
		}
		const sourcePath = `${MASS_PRODUCTION_ROOT}/icons/${cleanupSlug(catalogRecord.targetId)}.png`;
		if (massRecord.finalImagePath !== sourcePath || !massRecord.finalImageHash) {
			throw new Error(`Mass-production source is not frozen: ${catalogRecord.targetId}`);
		}
		const sourceHash = input.sourceHashesByTargetId.get(catalogRecord.targetId);
		if (!sourceHash || sourceHash !== massRecord.finalImageHash) {
			throw new Error(
				`Cleanup source hash does not match mass production: ${catalogRecord.targetId}`
			);
		}
		const findings = findingsByTargetId.get(catalogRecord.targetId) ?? [];
		const slug = cleanupSlug(catalogRecord.targetId);
		return {
			targetId: catalogRecord.targetId,
			sourceCandidate: { path: sourcePath, contentHash: sourceHash },
			rank: catalogRecord.rarity,
			disposition: dispositionFor(findings),
			findings,
			cleanupCompositePath: `${QUALITY_CLEANUP_ROOT}/composites/${slug}.png`,
			resultPath: `${QUALITY_CLEANUP_ROOT}/results/${slug}.json`
		};
	});
	const counts = records.reduce(
		(counts, record) => {
			const domain = record.targetId.split(':', 1)[0];
			if (domain === 'martial') counts.Martial += 1;
			else if (domain === 'magical') counts.Magical += 1;
			else if (domain === 'craft') counts.Craft += 1;
			return counts;
		},
		{ total: records.length, Martial: 0, Magical: 0, Craft: 0 }
	);
	if (
		counts.total !== 456 ||
		counts.Martial !== 258 ||
		counts.Magical !== 124 ||
		counts.Craft !== 74
	) {
		throw new Error('Cleanup manifest actual domain counts do not match the frozen inventory');
	}
	return SkillIconCleanupManifestSchema.parse({
		schemaVersion: 'skill-icon-quality-cleanup-manifest-v1',
		authority,
		records
	});
}

const REVISION_REFERENCE_PURPOSES = {
	paintedEmblem: 'Painted Emblem style authority only; never copy its pixels or rank frame.',
	geometryGuide:
		'Protected central-aperture geometry only; never render guide colors or construction marks.',
	originalProvider:
		'Original provider source for target identity, subject, palette, lighting, and action continuity only.',
	currentComposite:
		'Current deterministic cleanup candidate for target-specific composition continuity only; never reproduce its backing, frame, crest, or rank letter.'
} as const;

function revisionPrompt(input: {
	readonly name: string;
	readonly domain: string;
	readonly family: string;
	readonly rank: string;
	readonly finding: SkillIconCleanupFinding;
	readonly visualSpec: {
		readonly dominantSubject: string;
		readonly supportingCue: string | null;
		readonly semanticPalette: readonly string[];
		readonly composition: string;
		readonly exclusions: readonly string[];
	};
}): string {
	return `Use case: stylized-concept
Asset type: isolated full-resolution Summonlab skill-icon artwork revision
Primary request: Revise only the painted artwork for ${input.name} in the ${input.domain} / ${input.family} taxonomy.
Dominant subject: ${input.visualSpec.dominantSubject}
Supporting cue: ${input.visualSpec.supportingCue ?? 'none'}
Palette: ${input.visualSpec.semanticPalette.join(', ')}
Composition: ${input.visualSpec.composition}
Existing exclusions: ${input.visualSpec.exclusions.join('; ')}
Unwanted detached explanatory UI glyph: ${input.finding.detail}
${CLEANUP_REVISION_PROMPT_INVARIANT}
Output exactly one ${SKILL_ICON_PROVIDER_SIZE}×${SKILL_ICON_PROVIDER_SIZE} RGB PNG provider source containing only the revised painted artwork. Do not crop, resize, mask, or preprocess the provider source; the authenticated cleanup pipeline retains its exact bytes, applies the packet-authorized deterministic resize and protected-aperture mask, and supplies the canonical backing and ${input.rank}-rank frame.`;
}

function assertPacketPathCoverage(
	manifest: SkillIconCleanupManifest,
	packets: readonly CleanupRevisionPacketArtifact[]
): void {
	if (packets.length !== 28) {
		throw new Error(`Expected exactly 28 cleanup revision packets; received ${packets.length}`);
	}
	const packetPaths = packets.map((artifact) => artifact.path);
	if (new Set(packetPaths).size !== packetPaths.length) {
		throw new Error('Cleanup revision packet path collision');
	}
	const outputOwners = new Map<string, string>();
	const reservedPaths = new Set<string>([
		MANIFEST_PATH,
		FINDINGS_PATH,
		FINDINGS_SOURCE_PATH,
		...manifest.records.flatMap((record) => [
			record.sourceCandidate.path,
			record.cleanupCompositePath,
			record.resultPath,
			cleanupInteriorPath(record.targetId)
		])
	]);
	for (const { path: packetPath, packet } of packets) {
		if (reservedPaths.has(packetPath)) {
			throw new Error(`Cleanup revision packet collides with immutable input: ${packetPath}`);
		}
		for (const outputPath of Object.values(packet.output)) {
			const owner = outputOwners.get(outputPath);
			if (owner) {
				throw new Error(
					`Cleanup revision output collision: ${outputPath} (${owner}, ${packet.targetId})`
				);
			}
			if (reservedPaths.has(outputPath) || packetPaths.includes(outputPath)) {
				throw new Error(`Cleanup revision output collides with immutable input: ${outputPath}`);
			}
			outputOwners.set(outputPath, packet.targetId);
		}
	}
}

async function buildCleanupRevisionPackets(
	root: string,
	input: CleanupManifestInput,
	manifest: SkillIconCleanupManifest,
	manifestBytes: Buffer
): Promise<readonly CleanupRevisionPacketArtifact[]> {
	const revisionFindings = input.findings.filter(
		(finding) => finding.kind === 'stray-ui-glyph' && finding.requiredAction === 'revise-art'
	);
	if (
		revisionFindings.length !== 28 ||
		new Set(revisionFindings.map((finding) => finding.targetId)).size !== 28
	) {
		throw new Error('Cleanup findings do not contain exactly 28 unique stray-glyph revisions');
	}
	const catalogByTargetId = new Map(
		input.catalog.records.map((record) => [record.targetId, record])
	);
	const motifByTargetId = new Map(
		input.motifMap.records.map((record) => [record.targetId, record])
	);
	const visualByTargetId = new Map(
		input.visualSpecifications.records.map((record) => [record.targetId, record])
	);
	const massByTargetId = new Map(
		input.massProductionManifest.skills.map((record) => [record.targetId, record])
	);
	const familyById = new Map(
		input.massProductionManifest.families.map((record) => [record.familyId, record])
	);
	const cleanupByTargetId = new Map(manifest.records.map((record) => [record.targetId, record]));
	const manifestBinding = { path: MANIFEST_PATH, contentHash: sha256(manifestBytes) };

	const packets = await Promise.all(
		revisionFindings.map(async (finding): Promise<CleanupRevisionPacketArtifact> => {
			const targetId = finding.targetId;
			const catalogRecord = catalogByTargetId.get(targetId);
			const motifRecord = motifByTargetId.get(targetId);
			const visualRecord = visualByTargetId.get(targetId);
			const massRecord = massByTargetId.get(targetId);
			const cleanupRecord = cleanupByTargetId.get(targetId);
			if (!catalogRecord || !motifRecord || !visualRecord || !massRecord || !cleanupRecord) {
				throw new Error(`Cleanup revision target is missing canonical evidence: ${targetId}`);
			}
			if (
				catalogRecord.status !== 'authored' ||
				visualRecord.status !== 'authored' ||
				!catalogRecord.visualSpec ||
				!visualRecord.visualSpec ||
				JSON.stringify(catalogRecord.visualSpec) !== JSON.stringify(visualRecord.visualSpec) ||
				motifRecord.motifFamily !== catalogRecord.motifFamily ||
				massRecord.motifFamily !== catalogRecord.motifFamily ||
				massRecord.name !== catalogRecord.name ||
				massRecord.domain !== catalogRecord.domain ||
				massRecord.family !== catalogRecord.family ||
				massRecord.rarity !== catalogRecord.rarity
			) {
				throw new Error(`Cleanup revision semantic authority drift: ${targetId}`);
			}
			const familyRecord = familyById.get(catalogRecord.motifFamily);
			if (
				!familyRecord ||
				familyRecord.status !== 'candidate' ||
				!familyRecord.memberTargetIds.includes(targetId) ||
				!familyRecord.referenceSheetHash
			) {
				throw new Error(`Cleanup revision family authority is incomplete: ${targetId}`);
			}
			const [familySheetBytes, massResultBytes, currentResultBytes, currentCandidateBytes] =
				await Promise.all([
					regularBytes(root, familyRecord.referenceSheetPath),
					regularBytes(root, massRecord.resultPath),
					regularBytes(root, cleanupRecord.resultPath),
					regularBytes(root, cleanupRecord.cleanupCompositePath)
				]);
			if (sha256(familySheetBytes) !== familyRecord.referenceSheetHash) {
				throw new Error(`Cleanup revision family-sheet hash drift: ${targetId}`);
			}
			if (!massRecord.resultHash || sha256(massResultBytes) !== massRecord.resultHash) {
				throw new Error(`Cleanup revision mass-result hash drift: ${targetId}`);
			}
			const massResult = JSON.parse(massResultBytes.toString('utf8')) as {
				readonly identity?: unknown;
				readonly providerSource?: {
					readonly path?: unknown;
					readonly contentHash?: unknown;
				};
			};
			const expectedOriginalProviderPath = `${MASS_PRODUCTION_ROOT}/provider-sources/${cleanupSlug(targetId)}-v1.png`;
			if (
				massResult.identity !== targetId ||
				massResult.providerSource?.path !== expectedOriginalProviderPath ||
				massResult.providerSource.contentHash !== massRecord.providerSourceHash ||
				typeof massResult.providerSource.contentHash !== 'string'
			) {
				throw new Error(`Cleanup revision original-provider binding drift: ${targetId}`);
			}
			const originalProviderBytes = await regularBytes(root, expectedOriginalProviderPath);
			if (sha256(originalProviderBytes) !== massResult.providerSource.contentHash) {
				throw new Error(`Cleanup revision original-provider hash drift: ${targetId}`);
			}
			const currentResult = SkillIconCleanupResultSchema.parse(
				JSON.parse(currentResultBytes.toString('utf8')) as unknown
			);
			const currentCandidateHash = sha256(currentCandidateBytes);
			if (
				currentResult.targetId !== targetId ||
				JSON.stringify(currentResult.sourceCandidate) !==
					JSON.stringify(cleanupRecord.sourceCandidate) ||
				currentResult.cleanupCompositePath !== cleanupRecord.cleanupCompositePath ||
				currentResult.resultPath !== cleanupRecord.resultPath ||
				currentResult.rank !== cleanupRecord.rank ||
				currentResult.disposition !== cleanupRecord.disposition ||
				currentResult.cleanupCompositeContentHash !== currentCandidateHash ||
				JSON.stringify(currentResult.compositionAuthority.geometry) !==
					JSON.stringify(manifest.authority.geometry)
			) {
				throw new Error(`Cleanup revision current-candidate binding drift: ${targetId}`);
			}
			await Promise.all(
				Object.values(currentResult.compositionAuthority).map(async (binding) => {
					if (sha256(await regularBytes(root, binding.path)) !== binding.contentHash) {
						throw new Error(`Cleanup revision composition-authority hash drift: ${targetId}`);
					}
				})
			);

			const visualSpec = {
				dominantSubject: catalogRecord.visualSpec.dominantSubject,
				supportingCue: catalogRecord.visualSpec.supportingCue ?? null,
				semanticPalette: [...catalogRecord.visualSpec.semanticPalette],
				composition: catalogRecord.visualSpec.composition,
				exclusions: [...catalogRecord.visualSpec.exclusions]
			};
			const exactPrompt = revisionPrompt({
				name: catalogRecord.name,
				domain: catalogRecord.domain,
				family: catalogRecord.family,
				rank: catalogRecord.rarity,
				finding,
				visualSpec
			});
			const slug = cleanupSlug(targetId);
			const packet = CleanupRevisionPacketSchema.parse({
				schemaVersion: 'skill-icon-quality-cleanup-revision-packet-v1',
				revision: 1,
				targetId,
				name: catalogRecord.name,
				domain: catalogRecord.domain,
				family: catalogRecord.family,
				rank: catalogRecord.rarity,
				motifFamily: catalogRecord.motifFamily,
				finding,
				visualSpec,
				cleanupManifest: manifestBinding,
				sourceCandidate: cleanupRecord.sourceCandidate,
				currentCandidate: {
					path: cleanupRecord.cleanupCompositePath,
					contentHash: currentCandidateHash
				},
				currentResult: {
					path: cleanupRecord.resultPath,
					contentHash: sha256(currentResultBytes)
				},
				compositionAuthority: currentResult.compositionAuthority,
				providerEnvelope: {
					profile: 'skill-icon-provider-envelope-v3',
					mediaType: 'image/png',
					width: SKILL_ICON_PROVIDER_SIZE,
					height: SKILL_ICON_PROVIDER_SIZE,
					alphaMode: 'rgb'
				},
				normalizationAuthority: {
					profile: 'skill-icon-cleanup-artwork-resize-mask-v1',
					decoderInput: 'remove-bounded-cabx-and-assign-srgb',
					resize: {
						width: input.geometry.canvas.width,
						height: input.geometry.canvas.height,
						fit: 'fill',
						kernel: 'lanczos3',
						fastShrinkOnLoad: false
					},
					mask: 'geometry-v2-protected-central-aperture',
					encoder: {
						format: 'png',
						compressionLevel: 9,
						adaptiveFiltering: false,
						palette: false,
						progressive: false
					},
					sharpVersion: SKILL_ICON_NORMALIZER_SHARP_VERSION,
					vipsVersion: SKILL_ICON_NORMALIZER_VIPS_VERSION
				},
				references: [
					{
						...manifest.authority.optionCMaterial,
						purpose: REVISION_REFERENCE_PURPOSES.paintedEmblem
					},
					{
						...manifest.authority.providerSpaceGuide,
						purpose: REVISION_REFERENCE_PURPOSES.geometryGuide
					},
					{
						path: familyRecord.referenceSheetPath,
						purpose: `Exact ${catalogRecord.motifFamily} motif-family ancestry only; never crop or copy a complete icon.`,
						contentHash: familyRecord.referenceSheetHash
					},
					{
						path: expectedOriginalProviderPath,
						purpose: REVISION_REFERENCE_PURPOSES.originalProvider,
						contentHash: massResult.providerSource.contentHash
					},
					{
						path: cleanupRecord.cleanupCompositePath,
						purpose: REVISION_REFERENCE_PURPOSES.currentComposite,
						contentHash: currentCandidateHash
					}
				],
				exactPrompt,
				exactPromptHash: sha256(Buffer.from(exactPrompt)),
				attempts: { initial: 1, correctiveEdits: 1, maximum: 2 },
				output: {
					providerSourcePath: `${QUALITY_CLEANUP_ROOT}/provider-sources/${slug}-v1.png`,
					revisedInteriorPath: `${QUALITY_CLEANUP_ROOT}/revisions/${slug}-v1.png`,
					compositePath: `${QUALITY_CLEANUP_ROOT}/composites/${slug}-v1.png`,
					resultPath: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v1.json`
				}
			});
			return {
				path: `${QUALITY_CLEANUP_ROOT}/prompts/revisions/${slug}-v1.json`,
				packet
			};
		})
	);
	assertPacketPathCoverage(manifest, packets);
	return packets;
}

export async function loadCleanupRevisionPackets(
	root = process.cwd()
): Promise<readonly CleanupRevisionPacketArtifact[]> {
	const repositoryRoot = path.resolve(root);
	const input = await loadCleanupManifestInput(repositoryRoot);
	const manifest = buildSkillIconCleanupManifest(input);
	const expectedManifestBytes = jsonBytes(manifest);
	const actualManifestBytes = await regularBytes(repositoryRoot, MANIFEST_PATH);
	if (!actualManifestBytes.equals(expectedManifestBytes)) {
		throw new Error('Cleanup manifest does not match the canonical immutable snapshot');
	}
	return buildCleanupRevisionPackets(repositoryRoot, input, manifest, expectedManifestBytes);
}

interface HeldCleanupOutputParent {
	readonly path: string;
	readonly handle: Awaited<ReturnType<typeof open>>;
	readonly realPath: string;
	readonly device: number;
	readonly inode: number;
}

function heldCleanupOutputChild(parent: HeldCleanupOutputParent, name: string): string {
	if (name !== path.basename(name) || name === '.' || name === '..') {
		throw new Error(`Unsafe cleanup artifact child name: ${name}`);
	}
	return `/proc/self/fd/${parent.handle.fd}/${name}`;
}

async function ensureSafeCleanupOutputParent(
	root: string,
	destination: string,
	createMissing: boolean
): Promise<boolean> {
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
		throw new Error('Cleanup artifact workspace root must be a real directory');
	}
	const realRoot = await realpath(root);
	if (!isInside(root, destination) || destination === root) {
		throw new Error('Cleanup artifact destination escaped the workspace root');
	}
	let cursor = root;
	for (const segment of path
		.relative(root, path.dirname(destination))
		.split(path.sep)
		.filter(Boolean)) {
		cursor = path.join(cursor, segment);
		let metadata = await lstat(cursor).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (!metadata) {
			if (!createMissing) return false;
			await mkdir(cursor).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== 'EEXIST') throw error;
			});
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
			throw new Error(`Cleanup artifact parent must be a real directory: ${cursor}`);
		}
		if (!isInside(realRoot, await realpath(cursor))) {
			throw new Error(`Cleanup artifact parent escaped the workspace root: ${cursor}`);
		}
	}
	return true;
}

async function bindCleanupOutputParent(
	root: string,
	destination: string,
	createMissing: boolean
): Promise<HeldCleanupOutputParent | null> {
	if (!(await ensureSafeCleanupOutputParent(root, destination, createMissing))) return null;
	const parentPath = path.dirname(destination);
	const [expectedRealPath, expectedMetadata] = await Promise.all([
		realpath(parentPath),
		lstat(parentPath)
	]);
	const handle = await open(
		parentPath,
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
	);
	try {
		const opened = await handle.stat();
		const heldRealPath = await realpath(`/proc/self/fd/${handle.fd}`);
		if (
			!opened.isDirectory() ||
			expectedMetadata.isSymbolicLink() ||
			opened.dev !== expectedMetadata.dev ||
			opened.ino !== expectedMetadata.ino ||
			heldRealPath !== expectedRealPath ||
			!isInside(await realpath(root), heldRealPath)
		) {
			throw new Error(`Cleanup artifact parent identity changed: ${parentPath}`);
		}
		return {
			path: parentPath,
			handle,
			realPath: heldRealPath,
			device: opened.dev,
			inode: opened.ino
		};
	} catch (error) {
		await handle.close();
		throw error;
	}
}

async function openCleanupOutputParent(
	root: string,
	destination: string
): Promise<HeldCleanupOutputParent> {
	const parent = await bindCleanupOutputParent(root, destination, true);
	if (!parent) throw new Error(`Cleanup artifact parent is missing: ${path.dirname(destination)}`);
	return parent;
}

async function assertCleanupOutputParentNamed(parent: HeldCleanupOutputParent): Promise<void> {
	const [realPathNow, metadata] = await Promise.all([realpath(parent.path), lstat(parent.path)]);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isDirectory() ||
		realPathNow !== parent.realPath ||
		metadata.dev !== parent.device ||
		metadata.ino !== parent.inode
	) {
		throw new Error(`Cleanup artifact parent identity changed: ${parent.path}`);
	}
}

async function currentBytes(root: string, repositoryPath: string): Promise<Buffer | null> {
	const absolutePath = path.resolve(root, repositoryPath);
	if (!isInside(root, absolutePath) || absolutePath === root) {
		throw new Error(`Cleanup artifact path escaped the workspace root: ${repositoryPath}`);
	}
	const parent = await bindCleanupOutputParent(root, absolutePath, false);
	if (!parent) return null;
	const heldPath = heldCleanupOutputChild(parent, path.basename(absolutePath));
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		try {
			handle = await open(
				heldPath,
				constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW
			);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				await assertCleanupOutputParentNamed(parent);
				return null;
			}
			if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
				throw new Error(
					`Refusing symbolic-link or non-regular cleanup artifact: ${repositoryPath}`,
					{ cause: error }
				);
			}
			throw error;
		}
		const opened = await handle.stat();
		if (!opened.isFile()) {
			throw new Error(`Refusing symbolic-link or non-regular cleanup artifact: ${repositoryPath}`);
		}
		const bytes = await handle.readFile();
		const named = await lstat(heldPath);
		if (
			named.isSymbolicLink() ||
			!named.isFile() ||
			named.dev !== opened.dev ||
			named.ino !== opened.ino
		) {
			throw new Error(`Cleanup artifact identity changed during preflight: ${repositoryPath}`);
		}
		await assertCleanupOutputParentNamed(parent);
		return bytes;
	} finally {
		await handle?.close().catch(() => undefined);
		await parent.handle.close().catch(() => undefined);
	}
}

async function writeMissingAtomic(
	root: string,
	repositoryPath: string,
	bytes: Buffer,
	beforePublish?: (repositoryPath: string) => void | Promise<void>
): Promise<boolean> {
	const destination = path.resolve(root, repositoryPath);
	if (!isInside(root, destination)) {
		throw new Error(
			`Cleanup artifact path resolves outside the repository root: ${repositoryPath}`
		);
	}
	const current = await currentBytes(root, repositoryPath);
	if (current?.equals(bytes)) return false;
	if (current) throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`);
	const parent = await openCleanupOutputParent(root, destination);
	const destinationName = path.basename(destination);
	const finalPath = heldCleanupOutputChild(parent, destinationName);
	const stageName = `.${destinationName}.stage-${process.pid}-${randomUUID()}`;
	const stage = heldCleanupOutputChild(parent, stageName);
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	let published = false;
	try {
		handle = await open(
			stage,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o644
		);
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await parent.handle.sync();
		await beforePublish?.(repositoryPath);
		await assertCleanupOutputParentNamed(parent);
		try {
			await link(stage, finalPath);
			published = true;
			await parent.handle.sync();
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			const concurrent = await readFile(finalPath).catch(() => null);
			if (!concurrent?.equals(bytes)) {
				throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`, {
					cause: error
				});
			}
		}
		await assertCleanupOutputParentNamed(parent);
		const installed = await readFile(finalPath).catch(() => null);
		if (!installed?.equals(bytes)) {
			throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`);
		}
		await unlink(stage);
		await parent.handle.sync();
		return published;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		if (published) {
			const [stageMetadata, finalMetadata] = await Promise.all([
				lstat(stage).catch(() => null),
				lstat(finalPath).catch(() => null)
			]);
			if (
				stageMetadata?.isFile() &&
				finalMetadata?.isFile() &&
				!stageMetadata.isSymbolicLink() &&
				!finalMetadata.isSymbolicLink() &&
				stageMetadata.dev === finalMetadata.dev &&
				stageMetadata.ino === finalMetadata.ino
			) {
				await unlink(finalPath).catch(() => undefined);
				await parent.handle.sync().catch(() => undefined);
			}
		}
		await unlink(stage).catch(() => undefined);
		throw error;
	} finally {
		await parent.handle.close().catch(() => undefined);
	}
}

export async function exportSkillIconQualityCleanup(options: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
	/** @internal Test-only synchronization immediately before create-only publication. */
	readonly testHooks?: {
		readonly beforePublish?: (repositoryPath: string) => void | Promise<void>;
	};
}): Promise<CleanupExportReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const input = await loadCleanupManifestInput(root);
	const manifest = buildSkillIconCleanupManifest(input);
	const manifestBytes = jsonBytes(manifest);
	const revisionPackets = await buildCleanupRevisionPackets(root, input, manifest, manifestBytes);
	const outputs = [
		{ path: MANIFEST_PATH, bytes: manifestBytes },
		{
			path: FINDINGS_PATH,
			bytes: jsonBytes({
				schemaVersion: 'skill-icon-quality-cleanup-findings-source-v1',
				findings: input.findings
			})
		},
		...revisionPackets.map(({ path: packetPath, packet }) => ({
			path: packetPath,
			bytes: jsonBytes(packet)
		}))
	];
	const drifted: string[] = [];
	const written: string[] = [];
	const outputState = await Promise.all(
		outputs.map(async (output) => ({ ...output, current: await currentBytes(root, output.path) }))
	);
	for (const output of outputState) {
		if (!output.current?.equals(output.bytes)) drifted.push(output.path);
	}
	if (options.mode === 'write') {
		const existingDrift = outputState.find(
			(output) => output.current !== null && !output.current.equals(output.bytes)
		);
		if (existingDrift) {
			throw new Error(`Refusing to replace drifted cleanup artifact: ${existingDrift.path}`);
		}
		for (const output of outputState.filter((output) => output.current === null)) {
			if (
				await writeMissingAtomic(root, output.path, output.bytes, options.testHooks?.beforePublish)
			) {
				written.push(output.path);
			}
		}
		drifted.length = 0;
	}
	const counts = manifest.records.reduce(
		(counts, record) => {
			const domain = record.targetId.split(':', 1)[0];
			if (domain === 'martial') counts.Martial += 1;
			else if (domain === 'magical') counts.Magical += 1;
			else if (domain === 'craft') counts.Craft += 1;
			return counts;
		},
		{ total: manifest.records.length, Martial: 0, Magical: 0, Craft: 0 }
	);
	return { mode: options.mode, counts, revisionPackets: revisionPackets.length, written, drifted };
}

type Point = readonly [number, number];

const DETERMINISTIC_PNG_OPTIONS = {
	compressionLevel: 9,
	adaptiveFiltering: false,
	palette: false
} as const;

const CLEANUP_BACKING_REFERENCES = [
	{
		path: AUTHORITY_PATHS.optionCMaterial,
		purpose: 'Canonical Option C material and tonal authority.',
		contentHash: '66af9144bc4cb5d8bb1420c5a07cfe9652c7ccbccf17519da938b21298b929ce'
	},
	{
		path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
		purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
		contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH
	}
] as const;

const CLEANUP_FRAME_REFERENCES = [
	{
		path: AUTHORITY_PATHS.optionCMaterial,
		purpose: 'Canonical Option C rarity-frame material and ornament authority.',
		contentHash: '66af9144bc4cb5d8bb1420c5a07cfe9652c7ccbccf17519da938b21298b929ce'
	},
	{
		path: AUTHORITY_PATHS.selectedFrameSheet,
		purpose:
			'Approved seven-frame sheet for proportional and material-ladder guidance only; never crop or trace it.',
		contentHash: '4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266'
	},
	{
		path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
		purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
		contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH
	}
] as const;

const CLEANUP_LAYER_JOBS = [
	{
		kind: 'ordinary-v2',
		jobId: 'charcoal-forged-stone-v6',
		logicalIdentity: 'charcoal-forged-stone',
		revision: 6,
		role: 'backing',
		rarity: null,
		profile: 'skill-icon-geometry-role-mask-v1',
		producer: 'summonlab-skill-icon-production-v5',
		references: CLEANUP_BACKING_REFERENCES
	},
	{
		kind: 'ordinary-v2',
		jobId: 'rarity-frame-f-v9',
		logicalIdentity: 'rarity-frame-f',
		revision: 9,
		role: 'rarity-frame',
		rarity: 'F',
		profile: 'skill-icon-black-matte-geometry-role-mask-v1',
		producer: 'summonlab-skill-icon-production-v7',
		references: CLEANUP_FRAME_REFERENCES
	},
	...(['E', 'D', 'C', 'B', 'A', 'S'] as const).map((rarity) => ({
		kind: 'ordinary-v2' as const,
		jobId: `rarity-frame-${rarity.toLowerCase()}-v9`,
		logicalIdentity: `rarity-frame-${rarity.toLowerCase()}`,
		revision: 9,
		role: 'rarity-frame' as const,
		rarity,
		profile: 'skill-icon-black-matte-geometry-role-mask-v1' as const,
		producer: 'summonlab-skill-icon-production-v7' as const,
		references: CLEANUP_FRAME_REFERENCES
	}))
] as const;

function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const [currentX, currentY] = polygon[index]!;
		const [previousX, previousY] = polygon[previous]!;
		if (
			currentY !== previousY &&
			currentY > y !== previousY > y &&
			x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX
		) {
			inside = !inside;
		}
	}
	return inside;
}

function scaledPolygon(points: readonly Point[], width: number, height: number): readonly Point[] {
	return points.map(([x, y]) => [x * width, y * height] as const);
}

function cleanupPolygons(
	geometry: SkillIconGeometryV2,
	width: number,
	height: number
): {
	readonly outer: readonly Point[];
	readonly inner: readonly Point[];
	readonly medallion: readonly Point[];
} {
	const outer = scaledPolygon(geometry.outerEnvelopePoints, width, height);
	const center = {
		x: (geometry.center.x * width) / geometry.canvas.width,
		y: (geometry.center.y * height) / geometry.canvas.height
	};
	const inner = geometry.outerEnvelopePoints.map(
		([x, y]) =>
			[
				center.x + (x * width - center.x) * geometry.innerApertureScale,
				center.y + (y * height - center.y) * geometry.innerApertureScale
			] as const
	);
	return {
		outer,
		inner,
		medallion: scaledPolygon(geometry.rarityMedallionExclusion, width, height)
	};
}

async function rgbaBytes(bytes: Buffer): Promise<{
	readonly data: Buffer;
	readonly width: number;
	readonly height: number;
}> {
	const decoded = await sharp(bytes, { failOn: 'error' })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data: decoded.data, width: decoded.info.width, height: decoded.info.height };
}

function assertCanvas(
	label: string,
	actual: { readonly width: number; readonly height: number },
	expected: { readonly width: number; readonly height: number }
): void {
	if (actual.width !== expected.width || actual.height !== expected.height) {
		throw new Error(
			`${label} dimensions must be ${expected.width}x${expected.height}; received ${actual.width}x${actual.height}`
		);
	}
}

async function encodeRgba(data: Buffer, width: number, height: number): Promise<Buffer> {
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png(DETERMINISTIC_PNG_OPTIONS)
		.toBuffer();
}

function centerConnectedFrameOpening(frame: Buffer, width: number, height: number): Uint8Array {
	const opening = new Uint8Array(width * height);
	const startX = Math.floor(width / 2);
	const startY = Math.floor(height / 2);
	const start = startY * width + startX;
	if ((frame[start * 4 + 3] ?? 255) !== 0) {
		throw new Error('Accepted rarity frame does not have a transparent center aperture');
	}
	const queue = [start];
	opening[start] = 1;
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const current = queue[cursor]!;
		const x = current % width;
		for (const next of [
			x > 0 ? current - 1 : -1,
			x + 1 < width ? current + 1 : -1,
			current >= width ? current - width : -1,
			current + width < opening.length ? current + width : -1
		]) {
			if (next < 0 || opening[next] !== 0 || (frame[next * 4 + 3] ?? 255) !== 0) continue;
			opening[next] = 1;
			queue.push(next);
		}
	}
	return opening;
}

async function scaledLegacyArtwork(
	source: Buffer,
	geometry: SkillIconGeometryV2,
	artworkScale: number
): Promise<Buffer> {
	if (!Number.isFinite(artworkScale) || artworkScale < 1 || artworkScale > 1.5) {
		throw new Error('Legacy artwork scale must be between 1 and 1.5');
	}
	if (artworkScale === 1) return source;
	const width = Math.ceil(geometry.canvas.width * artworkScale);
	const height = Math.ceil(geometry.canvas.height * artworkScale);
	return sharp(source, { failOn: 'error' })
		.resize(width, height, {
			fit: 'fill',
			kernel: 'lanczos3',
			fastShrinkOnLoad: false
		})
		.extract({
			left: Math.floor((width - geometry.canvas.width) / 2),
			top: Math.floor((height - geometry.canvas.height) / 2),
			width: geometry.canvas.width,
			height: geometry.canvas.height
		})
		.png(DETERMINISTIC_PNG_OPTIONS)
		.toBuffer();
}

export async function extractLegacyInterior(
	source: Buffer,
	geometryInput: SkillIconGeometryV2,
	options?: LegacyInteriorOptions
): Promise<InteriorResult> {
	const geometry = SkillIconGeometryV2Schema.parse(geometryInput);
	const decoded = await rgbaBytes(
		await scaledLegacyArtwork(source, geometry, options?.artworkScale ?? 1)
	);
	assertCanvas('Legacy source', decoded, geometry.canvas);
	const { inner, medallion } = cleanupPolygons(geometry, decoded.width, decoded.height);
	const frame = options === undefined ? null : await rgbaBytes(options.frame);
	if (frame !== null) assertCanvas('Accepted rarity frame', frame, geometry.canvas);
	const frameOpening =
		frame === null ? null : centerConnectedFrameOpening(frame.data, frame.width, frame.height);
	const output = Buffer.from(decoded.data);
	let removedPixels = 0;
	let left = decoded.width;
	let top = decoded.height;
	let right = -1;
	let bottom = -1;
	for (let y = 0; y < decoded.height; y += 1) {
		for (let x = 0; x < decoded.width; x += 1) {
			const offset = (y * decoded.width + x) * 4;
			const allowed =
				frameOpening?.[y * decoded.width + x] === 1 ||
				(frameOpening === null &&
					pointInPolygon(x + 0.5, y + 0.5, inner) &&
					!pointInPolygon(x + 0.5, y + 0.5, medallion));
			if (!allowed) {
				if ((output[offset + 3] ?? 0) > 0) {
					removedPixels += 1;
					left = Math.min(left, x);
					top = Math.min(top, y);
					right = Math.max(right, x);
					bottom = Math.max(bottom, y);
				}
				output.fill(0, offset, offset + 4);
			} else if ((output[offset + 3] ?? 0) === 0) {
				output.fill(0, offset, offset + 4);
			}
		}
	}
	return {
		bytes: await encodeRgba(output, decoded.width, decoded.height),
		removedPixels,
		removedPixelBounds:
			removedPixels === 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 }
	};
}

export async function composeCleanupIcon(input: {
	readonly backing: Buffer;
	readonly interior: Buffer;
	readonly frame: Buffer;
	readonly compositionProfile?: CleanupCompositionProfile;
}): Promise<Buffer> {
	const [backing, interior, frame] = await Promise.all([
		rgbaBytes(input.backing),
		rgbaBytes(input.interior),
		rgbaBytes(input.frame)
	]);
	assertCanvas('Interior', interior, backing);
	assertCanvas('Frame', frame, backing);
	const pipeline = sharp(backing.data, {
		raw: { width: backing.width, height: backing.height, channels: 4 }
	}).composite([
		{
			input: interior.data,
			raw: { width: backing.width, height: backing.height, channels: 4 },
			blend: 'over'
		},
		{
			input: frame.data,
			raw: { width: backing.width, height: backing.height, channels: 4 },
			blend: 'over'
		}
	]);
	if (
		input.compositionProfile !== 'frame-opening-v2' &&
		input.compositionProfile !== 'frame-opening-v3'
	) {
		return pipeline.png(DETERMINISTIC_PNG_OPTIONS).toBuffer();
	}
	const composite = await pipeline.raw().toBuffer();
	const frameSeamSupport =
		input.compositionProfile === 'frame-opening-v3'
			? enclosedFrameSeamSupport(frame.data, backing.width, backing.height)
			: null;
	for (let index = 0; index < backing.width * backing.height; index += 1) {
		const offset = index * 4;
		if (
			(interior.data[offset + 3] ?? 0) === 0 &&
			(frame.data[offset + 3] ?? 0) === 0 &&
			frameSeamSupport?.[index] !== 1
		) {
			composite.fill(0, offset, offset + 4);
		}
	}
	return encodeRgba(composite, backing.width, backing.height);
}

export async function clearCleanupExterior(
	bytes: Buffer,
	geometry: SkillIconGeometryV2
): Promise<Buffer> {
	const decoded = await rgbaBytes(bytes);
	assertCanvas('Cleanup composite', decoded, geometry.canvas);
	const { outer, medallion } = cleanupPolygons(geometry, decoded.width, decoded.height);
	const output = Buffer.from(decoded.data);
	for (let y = 0; y < decoded.height; y += 1) {
		for (let x = 0; x < decoded.width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			if (pointInPolygon(pixelX, pixelY, outer) || pointInPolygon(pixelX, pixelY, medallion)) {
				continue;
			}
			const offset = (y * decoded.width + x) * 4;
			output.fill(0, offset, offset + 4);
		}
	}
	return encodeRgba(output, decoded.width, decoded.height);
}

function nearWhiteComponents(
	data: Buffer,
	width: number,
	height: number
): CleanupInspection['nearWhiteComponents'] {
	const white = new Uint8Array(width * height);
	for (let index = 0; index < width * height; index += 1) {
		const offset = index * 4;
		if (
			(data[offset + 3] ?? 0) === 255 &&
			(data[offset] ?? 0) >= 245 &&
			(data[offset + 1] ?? 0) >= 245 &&
			(data[offset + 2] ?? 0) >= 245
		) {
			white[index] = 1;
		}
	}
	const components: { pixels: number; bounds: PixelBounds }[] = [];
	for (let start = 0; start < white.length; start += 1) {
		if (white[start] !== 1) continue;
		const queue = [start];
		white[start] = 2;
		let pixels = 0;
		let left = width;
		let top = height;
		let right = -1;
		let bottom = -1;
		for (let cursor = 0; cursor < queue.length; cursor += 1) {
			const current = queue[cursor]!;
			const x = current % width;
			const y = Math.floor(current / width);
			pixels += 1;
			left = Math.min(left, x);
			top = Math.min(top, y);
			right = Math.max(right, x);
			bottom = Math.max(bottom, y);
			for (const [nextX, nextY] of [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1]
			] as const) {
				if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
				const next = nextY * width + nextX;
				if (white[next] !== 1) continue;
				white[next] = 2;
				queue.push(next);
			}
		}
		components.push({
			pixels,
			bounds: { left, top, width: right - left + 1, height: bottom - top + 1 }
		});
	}
	return components;
}

function backingOnlyComponents(
	actual: Buffer,
	backing: Buffer,
	interior: Buffer,
	frame: Buffer,
	width: number,
	height: number,
	allowedBacking?: Uint8Array
): CleanupInspection['backingOnlyComponents'] {
	const exposed = new Uint8Array(width * height);
	for (let index = 0; index < width * height; index += 1) {
		const offset = index * 4;
		if (
			allowedBacking?.[index] !== 1 &&
			(actual[offset + 3] ?? 0) > 0 &&
			(backing[offset + 3] ?? 0) > 0 &&
			(interior[offset + 3] ?? 0) === 0 &&
			(frame[offset + 3] ?? 0) === 0
		) {
			exposed[index] = 1;
		}
	}
	const components: { pixels: number; bounds: PixelBounds }[] = [];
	for (let start = 0; start < exposed.length; start += 1) {
		if (exposed[start] !== 1) continue;
		const queue = [start];
		exposed[start] = 2;
		let pixels = 0;
		let left = width;
		let top = height;
		let right = -1;
		let bottom = -1;
		for (let cursor = 0; cursor < queue.length; cursor += 1) {
			const current = queue[cursor]!;
			const x = current % width;
			const y = Math.floor(current / width);
			pixels += 1;
			left = Math.min(left, x);
			top = Math.min(top, y);
			right = Math.max(right, x);
			bottom = Math.max(bottom, y);
			for (const next of [
				x > 0 ? current - 1 : -1,
				x + 1 < width ? current + 1 : -1,
				current >= width ? current - width : -1,
				current + width < exposed.length ? current + width : -1
			]) {
				if (next >= 0 && exposed[next] === 1) {
					exposed[next] = 2;
					queue.push(next);
				}
			}
		}
		components.push({
			pixels,
			bounds: { left, top, width: right - left + 1, height: bottom - top + 1 }
		});
	}
	return components.sort((left, right) => right.pixels - left.pixels);
}

function borderConnectedFrameExterior(frame: Buffer, width: number, height: number): Uint8Array {
	const exterior = new Uint8Array(width * height);
	const queue: number[] = [];
	const enqueue = (index: number): void => {
		if (exterior[index] !== 0 || (frame[index * 4 + 3] ?? 255) !== 0) return;
		exterior[index] = 1;
		queue.push(index);
	};
	for (let x = 0; x < width; x += 1) {
		enqueue(x);
		enqueue((height - 1) * width + x);
	}
	for (let y = 1; y < height - 1; y += 1) {
		enqueue(y * width);
		enqueue(y * width + width - 1);
	}
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const current = queue[cursor]!;
		const x = current % width;
		for (const next of [
			x > 0 ? current - 1 : -1,
			x + 1 < width ? current + 1 : -1,
			current >= width ? current - width : -1,
			current + width < exterior.length ? current + width : -1
		]) {
			if (next >= 0) enqueue(next);
		}
	}
	return exterior;
}

function enclosedFrameSeamSupport(frame: Buffer, width: number, height: number): Uint8Array {
	const exterior = borderConnectedFrameExterior(frame, width, height);
	const centerOpening = centerConnectedFrameOpening(frame, width, height);
	const dilated = new Uint8Array(width * height);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = y * width + x;
			if ((frame[index * 4 + 3] ?? 0) === 0) continue;
			for (
				let adjacentY = Math.max(0, y - 1);
				adjacentY <= Math.min(height - 1, y + 1);
				adjacentY += 1
			) {
				for (
					let adjacentX = Math.max(0, x - 1);
					adjacentX <= Math.min(width - 1, x + 1);
					adjacentX += 1
				) {
					dilated[adjacentY * width + adjacentX] = 1;
				}
			}
		}
	}
	const support = new Uint8Array(width * height);
	for (let y = 1; y < height - 1; y += 1) {
		for (let x = 1; x < width - 1; x += 1) {
			const index = y * width + x;
			if ((frame[index * 4 + 3] ?? 0) > 0 || exterior[index] === 1 || centerOpening[index] === 1) {
				continue;
			}
			let enclosed = true;
			for (let adjacentY = y - 1; adjacentY <= y + 1 && enclosed; adjacentY += 1) {
				for (let adjacentX = x - 1; adjacentX <= x + 1; adjacentX += 1) {
					if (dilated[adjacentY * width + adjacentX] !== 1) {
						enclosed = false;
						break;
					}
				}
			}
			if (enclosed) support[index] = 1;
		}
	}
	return support;
}

export async function inspectCleanupComposite(
	input: CleanupInspectionInput
): Promise<CleanupInspection> {
	const geometry = SkillIconGeometryV2Schema.parse(input.geometry);
	const expected = await clearCleanupExterior(await composeCleanupIcon(input), geometry);
	const emptyInterior = await encodeRgba(
		Buffer.alloc(geometry.canvas.width * geometry.canvas.height * 4),
		geometry.canvas.width,
		geometry.canvas.height
	);
	const protectedComposite = await clearCleanupExterior(
		await composeCleanupIcon({
			backing: input.backing,
			interior: emptyInterior,
			frame: input.frame,
			...(input.compositionProfile === undefined
				? {}
				: { compositionProfile: input.compositionProfile })
		}),
		geometry
	);
	const [actualRgba, protectedRgba, backingRgba, interiorRgba, frameRgba] = await Promise.all([
		rgbaBytes(input.composite),
		rgbaBytes(protectedComposite),
		rgbaBytes(input.backing),
		rgbaBytes(input.interior),
		rgbaBytes(input.frame)
	]);
	assertCanvas('Cleanup composite', actualRgba, geometry.canvas);
	assertCanvas('Protected composite', protectedRgba, geometry.canvas);
	const { outer, inner, medallion } = cleanupPolygons(
		geometry,
		geometry.canvas.width,
		geometry.canvas.height
	);
	const frameOpeningComposition =
		input.compositionProfile === 'frame-opening-v2' ||
		input.compositionProfile === 'frame-opening-v3';
	const acceptedFrameOpening = frameOpeningComposition
		? centerConnectedFrameOpening(frameRgba.data, geometry.canvas.width, geometry.canvas.height)
		: null;
	const allowedBacking =
		input.compositionProfile === 'frame-opening-v3'
			? enclosedFrameSeamSupport(frameRgba.data, geometry.canvas.width, geometry.canvas.height)
			: undefined;
	let protectedBandMatches = true;
	let exteriorTransparent = true;
	for (let y = 0; y < geometry.canvas.height && protectedBandMatches; y += 1) {
		for (let x = 0; x < geometry.canvas.width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			const protectedPixel =
				acceptedFrameOpening === null
					? (pointInPolygon(pixelX, pixelY, outer) && !pointInPolygon(pixelX, pixelY, inner)) ||
						pointInPolygon(pixelX, pixelY, medallion)
					: pointInPolygon(pixelX, pixelY, outer) &&
						acceptedFrameOpening[y * geometry.canvas.width + x] !== 1;
			if (!protectedPixel) continue;
			const offset = (y * geometry.canvas.width + x) * 4;
			if (
				!actualRgba.data
					.subarray(offset, offset + 4)
					.equals(protectedRgba.data.subarray(offset, offset + 4))
			) {
				protectedBandMatches = false;
				break;
			}
		}
	}
	for (let y = 0; y < geometry.canvas.height && exteriorTransparent; y += 1) {
		for (let x = 0; x < geometry.canvas.width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			if (pointInPolygon(pixelX, pixelY, outer) || pointInPolygon(pixelX, pixelY, medallion)) {
				continue;
			}
			if ((actualRgba.data[(y * geometry.canvas.width + x) * 4 + 3] ?? 0) !== 0) {
				exteriorTransparent = false;
				break;
			}
		}
	}
	const components = nearWhiteComponents(
		actualRgba.data,
		geometry.canvas.width,
		geometry.canvas.height
	);
	const exposedBacking = backingOnlyComponents(
		actualRgba.data,
		backingRgba.data,
		interiorRgba.data,
		frameRgba.data,
		geometry.canvas.width,
		geometry.canvas.height,
		allowedBacking
	);
	return {
		layerHashesMatch:
			input.boundLayerHashes === undefined ||
			(input.boundLayerHashes.backing === sha256(input.backing) &&
				input.boundLayerHashes.interior === sha256(input.interior) &&
				input.boundLayerHashes.frame === sha256(input.frame)),
		exactComposite: input.composite.equals(expected),
		protectedBandMatches,
		exteriorTransparent,
		backingOnlyComponents: exposedBacking,
		nearWhiteComponents: components,
		warnings: components.map(
			(component) =>
				`Opaque near-white component: ${component.pixels} pixels at ${component.bounds.left},${component.bounds.top} ${component.bounds.width}x${component.bounds.height}`
		)
	};
}

function cleanupLayerPaths(jobId: string): {
	readonly target: string;
	readonly assignment: string;
	readonly candidate: string;
	readonly result: string;
} {
	return {
		target: `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
		assignment: `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
		candidate: `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`,
		result: `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`
	};
}

async function assertBoundHash(
	root: string,
	binding: {
		readonly path: string;
		readonly contentHash: string;
	}
): Promise<void> {
	if (sha256(await regularBytes(root, binding.path)) !== binding.contentHash) {
		throw new Error(`Cleanup shared-layer authority hash drift: ${binding.path}`);
	}
}

async function existingCleanupLayer(
	root: string,
	job: (typeof CLEANUP_LAYER_JOBS)[number]
): Promise<null | {
	readonly path: string;
	readonly bytes: Buffer;
	readonly contentHash: string;
}> {
	const paths = cleanupLayerPaths(job.jobId);
	const [targetBytes, assignmentBytes, candidate, resultBytes] = await Promise.all([
		currentBytes(root, paths.target),
		currentBytes(root, paths.assignment),
		currentBytes(root, paths.candidate),
		currentBytes(root, paths.result)
	]);
	if (!candidate && !resultBytes) return null;
	if (!targetBytes || !assignmentBytes || !candidate || !resultBytes) {
		throw new Error(`Cleanup shared-layer execution evidence is incomplete: ${job.jobId}`);
	}

	const execution = SkillIconExecutionV2Schema.parse({
		schemaVersion: 'skill-icon-execution-v2',
		target: JSON.parse(targetBytes.toString('utf8')) as unknown,
		assignment: JSON.parse(assignmentBytes.toString('utf8')) as unknown,
		result: JSON.parse(resultBytes.toString('utf8')) as unknown
	});
	const expectedResultReferences = job.references.map(({ path, contentHash }) => ({
		path,
		contentHash
	}));
	if (
		JSON.stringify(execution.target.references) !== JSON.stringify(job.references) ||
		JSON.stringify(execution.result.referenceInputs) !== JSON.stringify(expectedResultReferences)
	) {
		throw new Error(
			`Cleanup shared-layer execution does not match canonical ordered references: ${job.jobId}`
		);
	}
	await Promise.all([
		...execution.target.references.map((reference) => assertBoundHash(root, reference)),
		assertBoundHash(root, execution.target.normalization.geometry)
	]);
	const profileProducerMatches =
		execution.target.normalization.profile === job.profile &&
		execution.assignment.normalization.profile === job.profile &&
		execution.assignment.skillVersion === job.producer;

	const { target, result } = execution;
	const contentHash = sha256(candidate);
	if (
		target.jobId !== job.jobId ||
		target.logicalIdentity !== job.logicalIdentity ||
		target.revision !== job.revision ||
		target.role !== job.role ||
		target.rarity !== job.rarity ||
		!profileProducerMatches ||
		result.status !== 'candidate' ||
		result.output?.path !== paths.candidate ||
		result.output.contentHash !== contentHash ||
		result.output.bytes !== candidate.byteLength ||
		result.normalization.outputContentHash !== contentHash
	) {
		throw new Error(`Cleanup shared-layer execution does not bind candidate bytes: ${job.jobId}`);
	}
	return { path: paths.candidate, bytes: candidate, contentHash };
}

function cleanupInteriorPath(targetId: string): string {
	return `${QUALITY_CLEANUP_ROOT}/interiors/${cleanupSlug(targetId)}.png`;
}

async function assertCleanupAuthorities(root: string, authority: CleanupAuthority): Promise<void> {
	for (const [key, binding] of Object.entries(authority)) {
		const bytes = await regularBytes(root, binding.path);
		if (sha256(bytes) !== binding.contentHash) {
			throw new Error(`Cleanup authority hash drift: ${key}`);
		}
	}
}

function assertFinalizePathCoverage(manifest: SkillIconCleanupManifest): readonly string[] {
	const owners = new Map<string, string>();
	for (const record of manifest.records) {
		for (const [kind, repositoryPath] of [
			['interior', cleanupInteriorPath(record.targetId)],
			['composite', record.cleanupCompositePath],
			['result', record.resultPath]
		] as const) {
			const prior = owners.get(repositoryPath);
			if (prior) {
				throw new Error(
					`Cleanup finalize output collision: ${repositoryPath} (${prior}, ${record.targetId}:${kind})`
				);
			}
			owners.set(repositoryPath, `${record.targetId}:${kind}`);
		}
	}
	for (const record of manifest.records) {
		if (owners.has(record.sourceCandidate.path)) {
			throw new Error(`Cleanup finalize output collides with frozen source: ${record.targetId}`);
		}
	}
	return Array.from(owners.keys());
}

async function assertSafeFinalizeDestinations(
	root: string,
	repositoryPaths: readonly string[]
): Promise<void> {
	const rootRealPath = await realpath(root);
	const parentPaths = new Set<string>();
	for (const repositoryPath of repositoryPaths) {
		const absolutePath = path.resolve(root, repositoryPath);
		if (!isInside(rootRealPath, absolutePath)) {
			throw new Error(
				`Cleanup artifact path resolves outside the repository root: ${repositoryPath}`
			);
		}
		parentPaths.add(path.dirname(absolutePath));
		const leaf = await lstat(absolutePath).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (leaf && (!leaf.isFile() || leaf.isSymbolicLink())) {
			throw new Error(`Refusing symbolic-link or non-regular cleanup artifact: ${repositoryPath}`);
		}
	}
	for (const parentPath of parentPaths) {
		let current = parentPath;
		while (current !== rootRealPath) {
			if (!isInside(rootRealPath, current)) {
				throw new Error('Cleanup artifact parent resolves outside the repository root');
			}
			const metadata = await lstat(current).catch((error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return null;
				throw error;
			});
			if (metadata?.isSymbolicLink()) {
				throw new Error(`Cleanup artifact parent contains symbolic link: ${current}`);
			}
			if (metadata && !metadata.isDirectory()) {
				throw new Error(`Cleanup artifact parent is not a directory: ${current}`);
			}
			if (metadata && !isInside(rootRealPath, await realpath(current))) {
				throw new Error(`Cleanup artifact parent resolves outside the repository root: ${current}`);
			}
			const next = path.dirname(current);
			if (next === current) {
				throw new Error('Cleanup artifact parent traversal escaped the repository root');
			}
			current = next;
		}
	}
}

export async function finalizeSkillIconQualityCleanup(options: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
}): Promise<CleanupFinalizeReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const manifestBytes = await regularBytes(root, MANIFEST_PATH);
	const manifest = SkillIconCleanupManifestSchema.parse(
		JSON.parse(manifestBytes.toString('utf8')) as unknown
	);
	const layers = await Promise.all(
		CLEANUP_LAYER_JOBS.map(async (job) => ({ job, layer: await existingCleanupLayer(root, job) }))
	);
	const pendingLayerJobIds = layers
		.filter((entry) => entry.layer === null)
		.map((entry) => entry.job.jobId);
	if (pendingLayerJobIds.length > 0) {
		return {
			mode: options.mode,
			ready: false,
			total: manifest.records.length,
			finalized: 0,
			pendingLayerJobIds,
			written: [],
			drifted: [],
			warnings: []
		};
	}
	await assertCleanupAuthorities(root, manifest.authority);
	const geometryBytes = await regularBytes(root, manifest.authority.geometry.path);
	const geometry = SkillIconGeometryV2Schema.parse(
		JSON.parse(geometryBytes.toString('utf8')) as unknown
	);
	const backing = layers.find(({ job }) => job.role === 'backing')!.layer!;
	const frames = new Map(
		layers
			.filter(({ job }) => job.role === 'rarity-frame')
			.map(({ job, layer }) => [job.rarity, layer!] as const)
	);
	const finalizePaths = assertFinalizePathCoverage(manifest);
	await assertSafeFinalizeDestinations(root, finalizePaths);
	for (const record of manifest.records) {
		const source = await regularBytes(root, record.sourceCandidate.path);
		if (sha256(source) !== record.sourceCandidate.contentHash) {
			throw new Error(`Frozen cleanup source hash drift: ${record.targetId}`);
		}
	}
	const written: string[] = [];
	const drifted: string[] = [];
	const warnings: string[] = [];
	let finalized = 0;
	const stageRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-finalize-'));
	const staged: { readonly repositoryPath: string; readonly absolutePath: string }[] = [];
	const visualCache = new Map<
		string,
		{
			readonly interior: InteriorResult;
			readonly composite: Buffer;
			readonly inspection: CleanupInspection;
		}
	>();
	const visualUseCounts = new Map<string, number>();
	for (const record of manifest.records) {
		const key = `${record.sourceCandidate.contentHash}:${record.rank}`;
		visualUseCounts.set(key, (visualUseCounts.get(key) ?? 0) + 1);
	}
	try {
		for (const record of manifest.records) {
			const frame = frames.get(record.rank);
			if (!frame) throw new Error(`Missing cleanup frame for rank ${record.rank}`);
			const cacheKey = `${record.sourceCandidate.contentHash}:${record.rank}`;
			let visual = visualCache.get(cacheKey);
			if (!visual) {
				const source = await regularBytes(root, record.sourceCandidate.path);
				if (sha256(source) !== record.sourceCandidate.contentHash) {
					throw new Error(`Frozen cleanup source hash drift: ${record.targetId}`);
				}
				const interior = await extractLegacyInterior(source, geometry);
				const composite = await clearCleanupExterior(
					await composeCleanupIcon({
						backing: backing.bytes,
						interior: interior.bytes,
						frame: frame.bytes
					}),
					geometry
				);
				const inspection = await inspectCleanupComposite({
					composite,
					backing: backing.bytes,
					interior: interior.bytes,
					frame: frame.bytes,
					geometry,
					boundLayerHashes: {
						backing: backing.contentHash,
						interior: sha256(interior.bytes),
						frame: frame.contentHash
					}
				});
				visual = { interior, composite, inspection };
				if ((visualUseCounts.get(cacheKey) ?? 0) > 1) visualCache.set(cacheKey, visual);
			}
			if (
				!visual.inspection.layerHashesMatch ||
				!visual.inspection.exactComposite ||
				!visual.inspection.protectedBandMatches ||
				!visual.inspection.exteriorTransparent
			) {
				throw new Error(`Cleanup composite inspection failed: ${record.targetId}`);
			}
			warnings.push(
				...visual.inspection.warnings.map((warning) => `${record.targetId}: ${warning}`)
			);
			const interiorPath = cleanupInteriorPath(record.targetId);
			const interiorHash = sha256(visual.interior.bytes);
			const binding = {
				source: record.sourceCandidate.contentHash,
				geometry: manifest.authority.geometry.contentHash,
				backing: backing.contentHash,
				interior: interiorHash,
				frame: frame.contentHash,
				removedPixels: visual.interior.removedPixels,
				removedPixelBounds: visual.interior.removedPixelBounds
			};
			const result = SkillIconCleanupResultSchema.parse({
				schemaVersion: 'skill-icon-quality-cleanup-result-v1',
				...record,
				cleanupInterior: {
					path: interiorPath,
					contentHash: interiorHash,
					removedPixels: visual.interior.removedPixels,
					removedPixelBounds: visual.interior.removedPixelBounds
				},
				compositionAuthority: {
					geometry: manifest.authority.geometry,
					backing: { path: backing.path, contentHash: backing.contentHash },
					frame: { path: frame.path, contentHash: frame.contentHash }
				},
				cleanupCompositeContentHash: sha256(visual.composite),
				resultContentHash: sha256(jsonBytes(binding))
			});
			for (const output of [
				{ path: interiorPath, bytes: visual.interior.bytes },
				{ path: record.cleanupCompositePath, bytes: visual.composite },
				{ path: record.resultPath, bytes: jsonBytes(result) }
			]) {
				const current = await currentBytes(root, output.path);
				if (current?.equals(output.bytes)) continue;
				if (current) {
					drifted.push(output.path);
					continue;
				}
				if (options.mode === 'check') {
					drifted.push(output.path);
					continue;
				}
				const absolutePath = path.join(stageRoot, `${staged.length}.artifact`);
				await writeFile(absolutePath, output.bytes);
				staged.push({ repositoryPath: output.path, absolutePath });
			}
			finalized += 1;
		}
		if (options.mode === 'write' && drifted.length > 0) {
			throw new Error(`Refusing to replace drifted cleanup artifact: ${drifted[0]}`);
		}
		if (options.mode === 'write') {
			for (const output of staged) {
				if (
					await writeMissingAtomic(root, output.repositoryPath, await readFile(output.absolutePath))
				) {
					written.push(output.repositoryPath);
				}
			}
		}
		return {
			mode: options.mode,
			ready: true,
			total: manifest.records.length,
			finalized,
			pendingLayerJobIds: [],
			written,
			drifted,
			warnings
		};
	} finally {
		await rm(stageRoot, { recursive: true, force: true });
	}
}

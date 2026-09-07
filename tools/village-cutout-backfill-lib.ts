import { createHash } from 'node:crypto';

import type { SummonableHeroCatalog } from '../packages/contracts/src/index.js';
import { SummonableHeroCatalogSchema } from '../packages/contracts/src/index.js';
import sharp from 'sharp';
import { z } from 'zod';

export const VILLAGE_CUTOUT_BACKFILL_BATCH_ID =
	'village-cutout-backfill-20260906-current-company-001' as const;
export const VILLAGE_CUTOUT_BACKFILL_ROOT =
	`assets/heroes/experiments/${VILLAGE_CUTOUT_BACKFILL_BATCH_ID}` as const;
export const VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH =
	`${VILLAGE_CUTOUT_BACKFILL_ROOT}/manifest.json` as const;
export const VILLAGE_CUTOUT_BACKFILL_APPROVAL_PATH =
	`${VILLAGE_CUTOUT_BACKFILL_ROOT}/approval-v1.json` as const;
export const VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH =
	`${VILLAGE_CUTOUT_BACKFILL_ROOT}/review/current-company-cutouts-v1.png` as const;
export const VILLAGE_CUTOUT_BACKFILL_MANIFEST_SHA256 =
	'd1241e189493db9f11900d0a854c769b303659cd3549f038db80321630493a37' as const;
export const VILLAGE_CUTOUT_BACKFILL_APPROVAL_ID =
	'village-cutout-backfill-20260906-current-company-001-owner-approval-v1' as const;
export const VILLAGE_CUTOUT_BACKFILL_HERO_IDS = [
	'yaso-dreno',
	'oren-sorin',
	'joror-pelleth'
] as const;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const RepositoryPathSchema = z
	.string()
	.min(1)
	.refine((value) => !value.startsWith('/') && !value.split('/').includes('..'), {
		message: 'repository path must be relative and contained'
	});

const ImageEvidenceSchema = z
	.object({
		path: RepositoryPathSchema,
		sha256: Sha256Schema,
		width: z.literal(1024),
		height: z.literal(1536)
	})
	.strict();

const BackfillHeroSchema = z
	.object({
		heroId: z.enum(VILLAGE_CUTOUT_BACKFILL_HERO_IDS),
		displayName: z.string().min(1),
		summon: z
			.object({
				assetKey: z.string().min(1),
				path: RepositoryPathSchema,
				sha256: Sha256Schema,
				manifestSha256: Sha256Schema
			})
			.strict(),
		providerSource: ImageEvidenceSchema,
		candidate: ImageEvidenceSchema
	})
	.strict();

export const VillageCutoutBackfillManifestSchema = z
	.object({
		schemaVersion: z.literal('village-cutout-backfill-v1'),
		batchId: z.literal(VILLAGE_CUTOUT_BACKFILL_BATCH_ID),
		lifecycle: z.literal('candidate'),
		sourceCatalogPath: z.literal('assets/heroes/approved/summonable-roster-v1/catalog.json'),
		isolation: z
			.object({
				tool: z.literal('rembg'),
				version: z.literal('2.0.83'),
				commandEnvelope: z
					.object({
						package: z.literal('rembg[cpu,cli]==2.0.83'),
						supersedesFailedPackage: z.literal('rembg[cpu]==2.0.83'),
						correctionReason: z.literal('rembg CLI requires its declared cli extra')
					})
					.strict(),
				model: z
					.object({
						name: z.literal('u2net_human_seg'),
						cacheRelativePath: z.literal('models/u2net_human_seg/u2net_human_seg.onnx'),
						sha256: Sha256Schema
					})
					.strict(),
				alphaMatting: z
					.object({
						foregroundThreshold: z.literal(240),
						backgroundThreshold: z.literal(10),
						erodeSize: z.literal(15)
					})
					.strict()
			})
			.strict(),
		heroes: z.tuple([BackfillHeroSchema, BackfillHeroSchema, BackfillHeroSchema]),
		review: z
			.object({
				path: z.literal(VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH),
				width: z.literal(1536),
				height: z.literal(3456)
			})
			.strict()
	})
	.strict()
	.superRefine((manifest, context) => {
		if (
			manifest.heroes.some((hero, index) => hero.heroId !== VILLAGE_CUTOUT_BACKFILL_HERO_IDS[index])
		) {
			context.addIssue({ code: 'custom', message: 'heroes must retain current-company order' });
		}
		for (const hero of manifest.heroes) {
			if (hero.providerSource.sha256 !== hero.candidate.sha256) {
				context.addIssue({
					code: 'custom',
					message: `${hero.heroId} provider and candidate hashes must be identical`
				});
			}
		}
	});

export type VillageCutoutBackfillManifest = z.infer<typeof VillageCutoutBackfillManifestSchema>;

const AcceptedCandidateSchema = z
	.object({
		heroId: z.enum(VILLAGE_CUTOUT_BACKFILL_HERO_IDS),
		file: RepositoryPathSchema,
		bytes: z.number().int().positive(),
		contentHash: Sha256Schema
	})
	.strict();

export const VillageCutoutBackfillApprovalSchema = z
	.object({
		schemaVersion: z.literal('village-cutout-backfill-approval-v1'),
		approvalId: z.literal(VILLAGE_CUTOUT_BACKFILL_APPROVAL_ID),
		batchId: z.literal(VILLAGE_CUTOUT_BACKFILL_BATCH_ID),
		manifestSha256: Sha256Schema,
		reviewer: z.literal('owner'),
		reviewDate: z.literal('2026-09-06'),
		verdict: z.enum(['approved', 'revise']),
		acceptedHeroIds: z.tuple([
			z.enum(VILLAGE_CUTOUT_BACKFILL_HERO_IDS),
			z.enum(VILLAGE_CUTOUT_BACKFILL_HERO_IDS),
			z.enum(VILLAGE_CUTOUT_BACKFILL_HERO_IDS)
		]),
		approvalText: z.literal('approve'),
		acceptedCandidates: z.tuple([
			AcceptedCandidateSchema,
			AcceptedCandidateSchema,
			AcceptedCandidateSchema
		])
	})
	.strict()
	.superRefine((approval, context) => {
		if (
			approval.acceptedHeroIds.some(
				(heroId, index) => heroId !== VILLAGE_CUTOUT_BACKFILL_HERO_IDS[index]
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'approval must use the exact accepted hero set'
			});
		}
		if (
			approval.acceptedCandidates.some(
				(candidate, index) => candidate.heroId !== VILLAGE_CUTOUT_BACKFILL_HERO_IDS[index]
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'approval candidates must retain current-company order'
			});
		}
	});

export type VillageCutoutBackfillApproval = z.infer<typeof VillageCutoutBackfillApprovalSchema>;

interface CandidateHashes {
	readonly 'yaso-dreno': string;
	readonly 'oren-sorin': string;
	readonly 'joror-pelleth': string;
}

interface ManifestBuildEvidence {
	readonly candidateHashes: CandidateHashes;
	readonly modelSha256: string;
}

interface ApprovedAuthority {
	readonly displayName: string;
	readonly assetKey: string;
	readonly catalogPath: string;
	readonly path: string;
	readonly sha256: string;
	readonly manifestSha256: string;
}

const APPROVED_AUTHORITY: Record<
	(typeof VILLAGE_CUTOUT_BACKFILL_HERO_IDS)[number],
	ApprovedAuthority
> = {
	'yaso-dreno': {
		displayName: 'Yaso Dreno',
		assetKey: 'yaso-dreno-summon-v1',
		catalogPath: 'assets/heroes/approved/summonable-roster-v1/sources/yaso-dreno/summon.png',
		path: 'assets/heroes/experiments/one-star-overnight-200-001/waves/wave-07/candidates/yaso-dreno/summon-v1.png',
		sha256: '2c757553d089e409e79cdf403b4c170de5e47b84d2f48a25cba57fa8838537e0',
		manifestSha256: '6cec5db614ec93fab229d7b24bd4d83bb9255c9ea52bcfadd7ca84bcfcfe1db4'
	},
	'oren-sorin': {
		displayName: 'Oren Sorin',
		assetKey: 'oren-sorin-summon-v1',
		catalogPath: 'assets/heroes/approved/summonable-roster-v1/sources/oren-sorin/summon.png',
		path: 'assets/heroes/experiments/one-star-overnight-200-001/waves/wave-05/candidates/oren-sorin/summon-v2.png',
		sha256: '00b1cee63c25ce4590afea39e5539c4b1aeb4e63a2dc61ace2bdc830c10a9b4b',
		manifestSha256: '1532dbdc8342ee47453c748bdebfabe684ce3208d30231ba46d189425fb1e249'
	},
	'joror-pelleth': {
		displayName: 'Joror Pelleth',
		assetKey: 'joror-pelleth-summon-v1',
		catalogPath: 'assets/heroes/approved/summonable-roster-v1/sources/joror-pelleth/summon.png',
		path: 'assets/heroes/experiments/one-star-overnight-200-001/waves/wave-09/candidates/joror-pelleth/summon-v1.png',
		sha256: '130360a4f48dff40971d9039a6a813fa549549f03627cdb87422cd400864819f',
		manifestSha256: '97667fed1d0ec5be0ca326ef9e364a2bd301ff44f1921656c401295f007ca04b'
	}
};

export function villageCutoutSha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function stableVillageCutoutJson(value: unknown): string {
	const canonical = (input: unknown): string => {
		if (input === null || typeof input !== 'object') return JSON.stringify(input);
		if (Array.isArray(input)) return `[${input.map((item) => canonical(item)).join(',')}]`;
		const record = input as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort((left, right) => left.localeCompare(right))
			.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
			.join(',')}}`;
	};
	return `${JSON.stringify(JSON.parse(canonical(value)), null, '\t')}\n`;
}

export async function validateVillageCutoutCandidate(bytes: Buffer): Promise<{
	readonly width: 1024;
	readonly height: 1536;
	readonly status: 'valid';
	readonly visibleFraction: number;
}> {
	const image = sharp(bytes);
	const metadata = await image.metadata();
	if (metadata.format !== 'png') throw new Error('Village cutout must be a PNG');
	if (metadata.width !== 1024 || metadata.height !== 1536) {
		throw new Error('Village cutout must be 1024x1536');
	}
	if (metadata.hasAlpha !== true) throw new Error('Village cutout must have true alpha');
	const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const alphaChannel = info.channels - 1;
	let coveredPixels = 0;
	let edgeHasVisiblePixel = false;
	for (let y = 0; y < info.height; y += 1) {
		for (let x = 0; x < info.width; x += 1) {
			const alpha = data[(y * info.width + x) * info.channels + alphaChannel]!;
			if (alpha <= 8) continue;
			coveredPixels += 1;
			if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
				edgeHasVisiblePixel = true;
			}
		}
	}
	if (coveredPixels === info.width * info.height) {
		throw new Error('Village cutout must have true alpha');
	}
	if (coveredPixels === 0) throw new Error('Village cutout cannot be fully transparent');
	if (edgeHasVisiblePixel) throw new Error('Village cutout cannot touch the canvas edge');
	const visibleFraction = coveredPixels / (info.width * info.height);
	if (visibleFraction < 0.02 || visibleFraction > 0.6) {
		throw new Error('Village cutout alpha coverage must be within 0.02..0.60');
	}
	return { width: 1024, height: 1536, status: 'valid', visibleFraction };
}

function assertAuthority(
	catalog: SummonableHeroCatalog,
	heroId: (typeof VILLAGE_CUTOUT_BACKFILL_HERO_IDS)[number]
): ApprovedAuthority {
	const expected = APPROVED_AUTHORITY[heroId];
	const entry = catalog.entries.find((candidate) => candidate.heroId === heroId);
	if (!entry) throw new Error(`Approved catalog is missing ${heroId}`);
	const summon = entry.visuals.summon;
	const observed = {
		displayName: entry.displayName,
		assetKey: summon.assetKey,
		path: summon.file,
		sha256: summon.contentHash,
		manifestSha256: entry.draft.manifestHash
	};
	const currentAuthority = {
		displayName: expected.displayName,
		assetKey: expected.assetKey,
		path: expected.catalogPath,
		sha256: expected.sha256,
		manifestSha256: expected.manifestSha256
	};
	if (JSON.stringify(observed) !== JSON.stringify(currentAuthority)) {
		throw new Error(`Approved summon authority drifted for ${heroId}`);
	}
	if (
		summon.status !== 'approved' ||
		summon.role !== 'summon' ||
		summon.width !== 1024 ||
		summon.height !== 1536
	) {
		throw new Error(`Approved summon contract drifted for ${heroId}`);
	}
	return expected;
}

export function buildVillageCutoutBackfillManifest(
	catalog: SummonableHeroCatalog,
	heroIds: readonly (typeof VILLAGE_CUTOUT_BACKFILL_HERO_IDS)[number][],
	evidence: ManifestBuildEvidence
): VillageCutoutBackfillManifest {
	if (JSON.stringify(heroIds) !== JSON.stringify(VILLAGE_CUTOUT_BACKFILL_HERO_IDS)) {
		throw new Error('Current-company cutout batch must use the exact ordered hero set');
	}
	const manifest = {
		schemaVersion: 'village-cutout-backfill-v1' as const,
		batchId: VILLAGE_CUTOUT_BACKFILL_BATCH_ID,
		lifecycle: 'candidate' as const,
		sourceCatalogPath: 'assets/heroes/approved/summonable-roster-v1/catalog.json' as const,
		isolation: {
			tool: 'rembg' as const,
			version: '2.0.83' as const,
			commandEnvelope: {
				package: 'rembg[cpu,cli]==2.0.83' as const,
				supersedesFailedPackage: 'rembg[cpu]==2.0.83' as const,
				correctionReason: 'rembg CLI requires its declared cli extra' as const
			},
			model: {
				name: 'u2net_human_seg' as const,
				cacheRelativePath: 'models/u2net_human_seg/u2net_human_seg.onnx' as const,
				sha256: evidence.modelSha256
			},
			alphaMatting: {
				foregroundThreshold: 240 as const,
				backgroundThreshold: 10 as const,
				erodeSize: 15 as const
			}
		},
		heroes: heroIds.map((heroId) => {
			const authority = assertAuthority(catalog, heroId);
			const candidateSha256 = evidence.candidateHashes[heroId];
			const base = `${VILLAGE_CUTOUT_BACKFILL_ROOT}/heroes/${heroId}`;
			return {
				heroId,
				displayName: authority.displayName,
				summon: {
					assetKey: authority.assetKey,
					path: authority.path,
					sha256: authority.sha256,
					manifestSha256: authority.manifestSha256
				},
				providerSource: {
					path: `${base}/provider-source-v1.png`,
					sha256: candidateSha256,
					width: 1024 as const,
					height: 1536 as const
				},
				candidate: {
					path: `${base}/candidate-v1.png`,
					sha256: candidateSha256,
					width: 1024 as const,
					height: 1536 as const
				}
			};
		}) as [
			z.infer<typeof BackfillHeroSchema>,
			z.infer<typeof BackfillHeroSchema>,
			z.infer<typeof BackfillHeroSchema>
		],
		review: {
			path: VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH,
			width: 1536 as const,
			height: 3456 as const
		}
	};
	return VillageCutoutBackfillManifestSchema.parse(manifest);
}

export function promoteVillageCutouts(
	catalogInput: SummonableHeroCatalog,
	manifestInput: VillageCutoutBackfillManifest,
	approvalInput: unknown
): SummonableHeroCatalog {
	if (approvalInput === undefined || approvalInput === null) {
		throw new Error('Village cutout promotion requires approval');
	}
	const approvalResult = VillageCutoutBackfillApprovalSchema.safeParse(approvalInput);
	if (!approvalResult.success) {
		throw new Error(`Village cutout approval is invalid: ${approvalResult.error.message}`);
	}
	const approval = approvalResult.data;
	if (approval.verdict !== 'approved') {
		throw new Error('Village cutout approval verdict must be approved');
	}

	const manifest = VillageCutoutBackfillManifestSchema.parse(manifestInput);
	const observedManifestSha256 = villageCutoutSha256(
		Buffer.from(stableVillageCutoutJson(manifest), 'utf8')
	);
	if (
		approval.manifestSha256 !== VILLAGE_CUTOUT_BACKFILL_MANIFEST_SHA256 ||
		observedManifestSha256 !== approval.manifestSha256
	) {
		throw new Error('Village cutout manifest hash does not match the approved immutable manifest');
	}

	const catalog = SummonableHeroCatalogSchema.parse(catalogInput);
	const approvedHeroIds = new Set<string>(approval.acceptedHeroIds);
	const unapprovedExisting = catalog.entries.find(
		(entry) => entry.visuals.villageCutout && !approvedHeroIds.has(entry.heroId)
	);
	if (unapprovedExisting) {
		throw new Error(`Unapproved Village cutout already exists for ${unapprovedExisting.heroId}`);
	}

	const bindings = new Map(
		manifest.heroes.map((hero, index) => {
			const authority = assertAuthority(catalog, hero.heroId);
			if (
				hero.displayName !== authority.displayName ||
				hero.summon.assetKey !== authority.assetKey ||
				hero.summon.path !== authority.path ||
				hero.summon.sha256 !== authority.sha256 ||
				hero.summon.manifestSha256 !== authority.manifestSha256
			) {
				throw new Error(`Approved summon authority drifted for ${hero.heroId}`);
			}
			const candidate = approval.acceptedCandidates[index];
			if (
				candidate.heroId !== hero.heroId ||
				candidate.file !== hero.candidate.path ||
				candidate.contentHash !== hero.candidate.sha256 ||
				hero.providerSource.sha256 !== candidate.contentHash
			) {
				throw new Error(`Approved candidate hash or path drifted for ${hero.heroId}`);
			}
			return [
				hero.heroId,
				{
					sourceSummonAssetKey: authority.assetKey,
					sourceSummonContentHash: authority.sha256,
					asset: {
						assetKey: `${hero.heroId}-village-cutout-v1`,
						role: 'village-cutout' as const,
						status: 'approved' as const,
						file: candidate.file,
						width: 1024,
						height: 1536,
						bytes: candidate.bytes,
						contentHash: candidate.contentHash,
						sourceExperimentId: manifest.batchId,
						approvalId: approval.approvalId
					}
				}
			] as const;
		})
	);

	return SummonableHeroCatalogSchema.parse({
		...catalog,
		entries: catalog.entries.map((entry) => {
			const villageCutout = bindings.get(entry.heroId);
			return villageCutout ? { ...entry, visuals: { ...entry.visuals, villageCutout } } : entry;
		})
	});
}

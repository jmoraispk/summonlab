import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
	PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION,
	generateCharacterDraft,
	hashManifest,
	recipeFromSeed
} from '../packages/characters/src/index.js';
import {
	CharacterDraftSchema,
	SummonableHeroCatalogSchema,
	type CharacterManifest,
	type SummonableHeroCatalog
} from '../packages/contracts/src/index.js';
import sharp from 'sharp';

import {
	VILLAGE_CUTOUT_BACKFILL_APPROVAL_PATH,
	VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH,
	VillageCutoutBackfillManifestSchema,
	promoteVillageCutouts
} from './village-cutout-backfill-lib.js';

const APPROVAL_ID = 'summonable-heroes-owner-approval-2026-09-05';
const OWNER_INSTRUCTION = 'These 200 are the heroes that can be summoned. proceed';

const sourcePaths = {
	rosterPlan: 'assets/heroes/experiments/one-star-overnight-200-001/roster-plan.json',
	sourceRoster: 'assets/heroes/experiments/five-head-chibi-regeneration-001/source-roster.json',
	regenerationReport:
		'assets/heroes/experiments/five-head-chibi-regeneration-001/completion-report.json',
	correctionApproval: 'assets/heroes/experiments/five-head-chibi-revisions-001/approval-v1.json'
} as const;

interface RosterPlanEntry {
	readonly heroId: string;
	readonly displayName: string;
	readonly physicalManifest: {
		readonly adultAge: number;
		readonly bodyConstruction: string;
		readonly face: {
			readonly durableDetail: string;
			readonly eyesAndBrow: string;
			readonly noseAndMouth: string;
			readonly shape: string;
		};
		readonly genderPresentation: 'woman' | 'man';
		readonly hair: {
			readonly deliberateAccent: string | null;
			readonly dominantColor: string;
			readonly primarySilhouette: string;
		};
		readonly heightBand: string;
		readonly heightCm: number;
		readonly personalDetails: {
			readonly visibleAnchors: readonly string[];
		};
		readonly skinValueBand: string;
		readonly wardrobe: {
			readonly constructionFamily: string;
			readonly detailVariation: string;
			readonly paletteFamily: string;
		};
	};
	readonly characterKernel: {
		readonly personalObject: string;
	};
}

interface SourceRosterRecord {
	readonly designOrdinal: number;
	readonly displayName: string;
	readonly heroId: string;
	readonly sourceWaveId: string;
	readonly summonPath: string;
	readonly summonSha256: string;
}

interface CorrectionApprovalEntry {
	readonly heroId: string;
	readonly candidatePath: string;
	readonly candidateSha256: string;
	readonly sourceSummonPath: string;
}

interface RegenerationResult {
	readonly candidatePath: string;
	readonly candidateSha256: string;
}

const skinByBand: Record<string, readonly [string, string]> = {
	'band-1-lightest': ['porcelain', '#f0cfb8'],
	'band-2-light': ['warm ivory', '#e7bf9e'],
	'band-3-light-medium': ['golden tan', '#c58f66'],
	'band-4-medium': ['warm olive', '#a97755'],
	'band-5-medium-deep': ['copper brown', '#925e43'],
	'band-6-deepest': ['deep umber', '#633b2d']
};

const hairHex: Record<string, string> = {
	black: '#17151b',
	'dark-brown': '#3a2825',
	'brown-chestnut': '#643d32',
	'red-copper-auburn': '#8a3f31',
	'blonde-gold': '#c79b52',
	'gray-white-silver': '#aaa7a2',
	'blue-teal': '#287782',
	'violet-plum-pink': '#7a3f68',
	'multicolor-split-streak': '#58475f'
};

const paletteHex: Record<string, readonly [string, string]> = {
	'marigold-green': ['#b88a2f', '#667447'],
	'ochre-cream': ['#b5813f', '#e3d2aa'],
	'teal-brown': ['#2f7474', '#76523d'],
	'rust-charcoal': ['#9a4f32', '#343235'],
	'oxblood-navy': ['#702e37', '#263653'],
	'indigo-sand': ['#454f79', '#c2a77f'],
	'lilac-smoke': ['#8a7198', '#77737a'],
	'plum-gray': ['#68445f', '#77767b'],
	'moss-ivory': ['#65734a', '#ddd3b9'],
	'terracotta-black': ['#a75f45', '#252327']
};

const physiqueMap: Record<
	string,
	{
		readonly bodyFrame: CharacterManifest['bodyFrame'];
		readonly bodyBuild: CharacterManifest['bodyBuild'];
		readonly muscleTone: number;
		readonly bodyFat: number;
		readonly bmi: number;
	}
> = {
	'healthy-slight-lanky': {
		bodyFrame: 'slight',
		bodyBuild: 'lean',
		muscleTone: 3,
		bodyFat: 3,
		bmi: 19
	},
	'ordinary-average': {
		bodyFrame: 'balanced',
		bodyBuild: 'solid',
		muscleTone: 4,
		bodyFat: 5,
		bmi: 23
	},
	'athletic-conditioned': {
		bodyFrame: 'balanced',
		bodyBuild: 'athletic',
		muscleTone: 6,
		bodyFat: 4,
		bmi: 23
	},
	'clearly-muscular': {
		bodyFrame: 'broad',
		bodyBuild: 'athletic',
		muscleTone: 8,
		bodyFat: 3,
		bmi: 25
	},
	'extreme-bodybuilder': {
		bodyFrame: 'broad',
		bodyBuild: 'powerful',
		muscleTone: 10,
		bodyFat: 2,
		bmi: 30
	},
	'soft-round': { bodyFrame: 'balanced', bodyBuild: 'soft', muscleTone: 3, bodyFat: 7, bmi: 27 },
	'plus-size-heavy': { bodyFrame: 'broad', bodyBuild: 'soft', muscleTone: 4, bodyFat: 9, bmi: 33 },
	'sturdy-stocky': { bodyFrame: 'broad', bodyBuild: 'sturdy', muscleTone: 6, bodyFat: 6, bmi: 29 }
};

const attireByFamily: Record<string, NonNullable<CharacterManifest['attire']>> = {
	'mantle-short-cape': {
		footwear: 'ankle-boots',
		legwear: 'divided-skirt-trousers',
		torso: 'hooded-surcoat',
		arms: 'full-linen-sleeves',
		headwear: 'none',
		material: 'wool',
		condition: 'maintained',
		layering: 'layered'
	},
	'draped-robe': {
		footwear: 'soft-leather-shoes',
		legwear: 'loose-linen-trousers',
		torso: 'scholar-robe',
		arms: 'bell-cuffs',
		headwear: 'none',
		material: 'linen',
		condition: 'fine',
		layering: 'light'
	},
	'short-jacket-trousers': {
		footwear: 'ankle-boots',
		legwear: 'wool-trousers',
		torso: 'fitted-doublet',
		arms: 'fitted-cuffs',
		headwear: 'none',
		material: 'wool',
		condition: 'maintained',
		layering: 'standard'
	},
	'tailored-longcoat': {
		footwear: 'riding-boots',
		legwear: 'fitted-hose',
		torso: 'fitted-doublet',
		arms: 'fitted-cuffs',
		headwear: 'none',
		material: 'mixed',
		condition: 'fine',
		layering: 'layered'
	},
	'tunic-tabard': {
		footwear: 'hobnailed-boots',
		legwear: 'wool-trousers',
		torso: 'belted-wool-tunic',
		arms: 'full-linen-sleeves',
		headwear: 'none',
		material: 'wool',
		condition: 'maintained',
		layering: 'standard'
	},
	'apron-workwear-layers': {
		footwear: 'hobnailed-boots',
		legwear: 'work-breeches',
		torso: 'apron-over-tunic',
		arms: 'rolled-sleeves',
		headwear: 'none',
		material: 'mixed',
		condition: 'mended',
		layering: 'standard'
	},
	'fitted-vest-system': {
		footwear: 'ankle-boots',
		legwear: 'split-hose-and-breeches',
		torso: 'leather-jerkin',
		arms: 'full-linen-sleeves',
		headwear: 'none',
		material: 'leather',
		condition: 'maintained',
		layering: 'standard'
	},
	'layered-wrap': {
		footwear: 'wrapped-sandals',
		legwear: 'wrap-skirt-over-leggings',
		torso: 'linen-tunic',
		arms: 'wrapped-forearms',
		headwear: 'none',
		material: 'linen',
		condition: 'maintained',
		layering: 'layered'
	},
	'asymmetric-patchwork': {
		footwear: 'ankle-boots',
		legwear: 'divided-skirt-trousers',
		torso: 'belted-wool-tunic',
		arms: 'split-sleeves',
		headwear: 'none',
		material: 'mixed',
		condition: 'mended',
		layering: 'layered'
	},
	'quilted-outerwear': {
		footwear: 'hobnailed-boots',
		legwear: 'quilted-chausses',
		torso: 'quilted-gambeson',
		arms: 'quilted-sleeves',
		headwear: 'none',
		material: 'mixed',
		condition: 'maintained',
		layering: 'layered'
	}
};

function sha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function readJson<T>(workspaceRoot: string, path: string): Promise<T> {
	return JSON.parse(await readFile(resolve(workspaceRoot, path), 'utf8')) as T;
}

async function sourceEvidence(workspaceRoot: string, file: string) {
	return { file, contentHash: sha256(await readFile(resolve(workspaceRoot, file))) };
}

async function approvedAsset(
	workspaceRoot: string,
	input: {
		readonly assetKey: string;
		readonly role: 'summon' | 'combat-chibi';
		readonly file: string;
		readonly expectedHash: string;
		readonly sourceExperimentId: string;
	}
) {
	const absolute = resolve(workspaceRoot, input.file);
	const bytes = await readFile(absolute);
	const contentHash = sha256(bytes);
	if (contentHash !== input.expectedHash) {
		throw new Error(`Approved source hash mismatch: ${input.file}`);
	}
	const [metadata, fileStat] = await Promise.all([sharp(bytes).metadata(), stat(absolute)]);
	if (!metadata.width || !metadata.height)
		throw new Error(`Missing image dimensions: ${input.file}`);
	return {
		assetKey: input.assetKey,
		role: input.role,
		status: 'approved' as const,
		file: input.file,
		width: metadata.width,
		height: metadata.height,
		bytes: fileStat.size,
		contentHash,
		sourceExperimentId: input.sourceExperimentId,
		approvalId: APPROVAL_ID
	};
}

function bounded(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function inferredHairTexture(silhouette: string): string {
	if (/braid|twist|loc/u.test(silhouette)) return 'braided or locked';
	if (/curl|coil|halo/u.test(silhouette)) return 'curly or coiled';
	if (/shaved|crop/u.test(silhouette)) return 'close textured';
	return 'straight or wavy';
}

function inferredHairSilhouette(
	silhouette: string
): NonNullable<CharacterManifest['phenotype']['hairSilhouette']> {
	if (/shaved|crop/u.test(silhouette)) return 'close';
	if (/bun|topknot/u.test(silhouette)) return 'raised';
	if (/braid|twist|loc/u.test(silhouette)) return 'wrapped';
	if (/long/u.test(silhouette)) return 'long';
	if (/medium|bob|pageboy/u.test(silhouette)) return 'shoulder';
	return 'crown';
}

function heightBand(value: string): NonNullable<CharacterManifest['physiology']>['heightBand'] {
	if (value === 'very-short' || value === 'short') return 'short';
	if (value === 'very-tall') return 'exceptional';
	return value === 'tall' ? 'tall' : 'medium';
}

async function approvedDraft(entry: RosterPlanEntry) {
	const canonicalRecipe = {
		...recipeFromSeed(`approved:${entry.heroId}`, PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION),
		generationVersion: 'human-v6'
	};
	const base = await generateCharacterDraft(
		recipeFromSeed(`approved:${entry.heroId}`, PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION)
	);
	const physical = entry.physicalManifest;
	const physique = physiqueMap[physical.bodyConstruction];
	const skin = skinByBand[physical.skinValueBand];
	const palette = paletteHex[physical.wardrobe.paletteFamily];
	const attire = attireByFamily[physical.wardrobe.constructionFamily];
	if (!physique || !skin || !palette || !attire) {
		throw new Error(`Unsupported approved visual metadata: ${entry.heroId}`);
	}
	const heightM = physical.heightCm / 100;
	const basePhysiology = base.manifest.physiology;
	if (!basePhysiology) throw new Error(`Missing generated physiology: ${entry.heroId}`);
	const visibleTraits = [
		physical.hair.deliberateAccent,
		physical.face.durableDetail,
		physical.wardrobe.detailVariation,
		...physical.personalDetails.visibleAnchors,
		entry.characterKernel.personalObject
	]
		.filter((value): value is string => Boolean(value && value !== 'none'))
		.map((value) => value.slice(0, 80))
		.slice(0, 12);
	const manifest = {
		...base.manifest,
		displayName: entry.displayName,
		appearanceSeed: entry.heroId,
		generationVersion: 'human-v6',
		rarityStars: 1,
		adultAge: physical.adultAge,
		apparentAgeBand:
			physical.adultAge <= 24
				? ('young-adult' as const)
				: physical.adultAge <= 34
					? ('adult' as const)
					: ('mature-adult' as const),
		genderPresentation:
			physical.genderPresentation === 'woman' ? ('feminine' as const) : ('masculine' as const),
		pronouns: physical.genderPresentation === 'woman' ? ('she/her' as const) : ('he/him' as const),
		bodyFrame: physique.bodyFrame,
		bodyBuild: physique.bodyBuild,
		heightCm: physical.heightCm,
		physiology: {
			...basePhysiology,
			massKg: bounded(Math.round(physique.bmi * heightM * heightM), 40, 160),
			muscleTone: physique.muscleTone,
			bodyFat: physique.bodyFat,
			heightBand: heightBand(physical.heightBand)
		},
		phenotype: {
			...base.manifest.phenotype,
			skinTone: skin[0],
			faceShape: physical.face.shape.slice(0, 40),
			noseProfile: physical.face.noseAndMouth.split(',')[0]!.trim().slice(0, 40),
			hairTexture: inferredHairTexture(physical.hair.primarySilhouette),
			hairColor: physical.hair.dominantColor,
			hairStyle: physical.hair.primarySilhouette,
			hairSilhouette: inferredHairSilhouette(physical.hair.primarySilhouette),
			grooming: 'neat' as const,
			facialHair:
				physical.genderPresentation === 'woman'
					? ('none' as const)
					: base.manifest.phenotype.facialHair
		},
		visualTraits: visibleTraits,
		attire,
		palette: {
			skin: skin[1],
			hair: hairHex[physical.hair.dominantColor] ?? base.manifest.palette.hair,
			cloth: palette[0],
			accent: palette[1]
		},
		artKey: `${entry.heroId}-summon-v1`,
		assetProvenance: 'approved-generated-roster' as const
	} satisfies CharacterManifest;
	const manifestHash = await hashManifest(manifest);
	return CharacterDraftSchema.parse({
		recipe: canonicalRecipe,
		manifest,
		mind: base.mind,
		manifestHash
	});
}

export async function buildSummonableHeroCatalog(
	workspaceRoot: string
): Promise<SummonableHeroCatalog> {
	const supplementalDirectory =
		'assets/heroes/experiments/one-star-overnight-200-001/supplemental-reserves';
	const [
		rosterPlan,
		sourceRoster,
		approval,
		supplementalFiles,
		cutoutManifestInput,
		cutoutApproval
	] = await Promise.all([
		readJson<{ active: RosterPlanEntry[]; reserves: RosterPlanEntry[] }>(
			workspaceRoot,
			sourcePaths.rosterPlan
		),
		readJson<{ records: SourceRosterRecord[] }>(workspaceRoot, sourcePaths.sourceRoster),
		readJson<{ entries: CorrectionApprovalEntry[] }>(workspaceRoot, sourcePaths.correctionApproval),
		readdir(resolve(workspaceRoot, supplementalDirectory)),
		readJson<unknown>(workspaceRoot, VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH),
		readJson<unknown>(workspaceRoot, VILLAGE_CUTOUT_BACKFILL_APPROVAL_PATH)
	]);
	const planById = new Map(
		[...rosterPlan.active, ...rosterPlan.reserves].map((entry) => [entry.heroId, entry])
	);
	const selectedHeroIds = new Set(sourceRoster.records.map((entry) => entry.heroId));
	const selectedSupplementals = await Promise.all(
		supplementalFiles
			.filter((file) => file.endsWith('.json'))
			.map(async (file) => ({
				file: `${supplementalDirectory}/${file}`,
				packet: (
					await readJson<{ reservePacket: RosterPlanEntry }>(
						workspaceRoot,
						`${supplementalDirectory}/${file}`
					)
				).reservePacket
			}))
	);
	for (const supplemental of selectedSupplementals) {
		if (selectedHeroIds.has(supplemental.packet.heroId)) {
			planById.set(supplemental.packet.heroId, supplemental.packet);
		}
	}
	const regenerationResults = new Map<string, RegenerationResult>();
	const regenerationWaveRoot = 'assets/heroes/experiments/five-head-chibi-regeneration-001/waves';
	for (const waveId of await readdir(resolve(workspaceRoot, regenerationWaveRoot))) {
		const resultsDirectory = `${regenerationWaveRoot}/${waveId}/results`;
		for (const file of await readdir(resolve(workspaceRoot, resultsDirectory)).catch(() => [])) {
			if (!file.endsWith('.json')) continue;
			const heroId = file.slice(0, -'.json'.length);
			regenerationResults.set(
				heroId,
				await readJson<RegenerationResult>(workspaceRoot, `${resultsDirectory}/${file}`)
			);
		}
	}
	if (regenerationResults.size !== 200) {
		throw new Error('Five-head regeneration result inventory must contain exactly 200 heroes');
	}
	const correctionsById = new Map(approval.entries.map((entry) => [entry.heroId, entry]));
	if (sourceRoster.records.length !== 200 || correctionsById.size !== 19) {
		throw new Error('Approved source inventories do not match the 200 + 19 roster contract');
	}

	const entries = await Promise.all(
		sourceRoster.records
			.slice()
			.sort((left, right) => left.designOrdinal - right.designOrdinal)
			.map(async (source) => {
				const plan = planById.get(source.heroId);
				if (!plan || plan.displayName !== source.displayName) {
					throw new Error(`Missing approved physical manifest: ${source.heroId}`);
				}
				const correction = correctionsById.get(source.heroId);
				const regenerationResult = correction ? null : regenerationResults.get(source.heroId);
				if (!correction && !regenerationResult) {
					throw new Error(`Missing five-head regeneration result: ${source.heroId}`);
				}
				const summonFile = correction?.sourceSummonPath ?? source.summonPath;
				const summonExpectedHash = correction
					? sha256(await readFile(resolve(workspaceRoot, summonFile)))
					: source.summonSha256;
				const chibiFile = correction?.candidatePath ?? regenerationResult!.candidatePath;
				const chibiExpectedHash =
					correction?.candidateSha256 ?? regenerationResult!.candidateSha256;
				const [draft, summon, combatChibi] = await Promise.all([
					approvedDraft(plan),
					approvedAsset(workspaceRoot, {
						assetKey: `${source.heroId}-summon-v1`,
						role: 'summon',
						file: summonFile,
						expectedHash: summonExpectedHash,
						sourceExperimentId: correction?.sourceSummonPath.includes(
							'five-head-chibi-revisions-001'
						)
							? 'five-head-chibi-revisions-001'
							: 'one-star-overnight-200-001'
					}),
					approvedAsset(workspaceRoot, {
						assetKey: `${source.heroId}-combat-chibi-v1`,
						role: 'combat-chibi',
						file: chibiFile,
						expectedHash: chibiExpectedHash,
						sourceExperimentId: correction
							? 'five-head-chibi-revisions-001'
							: 'five-head-chibi-regeneration-001'
					})
				]);
				return {
					heroId: source.heroId,
					displayName: source.displayName,
					designOrdinal: source.designOrdinal,
					draft,
					visuals: { summon, combatChibi }
				};
			})
	);

	const canonicalCatalog = SummonableHeroCatalogSchema.parse({
		schemaVersion: 'summonable-hero-catalog-v2',
		catalogVersion: 'summonable-heroes-v1',
		status: 'approved',
		approvedOn: '2026-09-05',
		ownerInstruction: OWNER_INSTRUCTION,
		sourceEvidence: await Promise.all(
			Object.values(sourcePaths).map((path) => sourceEvidence(workspaceRoot, path))
		),
		entries
	});
	return promoteVillageCutouts(
		canonicalCatalog,
		VillageCutoutBackfillManifestSchema.parse(cutoutManifestInput),
		cutoutApproval
	);
}

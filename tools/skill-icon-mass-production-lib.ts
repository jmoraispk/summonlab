import { createHash } from 'node:crypto';

import type { SkillIconCatalog, SkillIconVisualSpec } from '../packages/contracts/src/index.js';
import type { SkillIconMotifMap } from './skill-icon-production-lib.js';

export const MASS_PRODUCTION_ROOT =
	'assets/wiki/skills/icon-production-v1/mass-production-v1' as const;
export const MASS_PRODUCTION_MANIFEST_PATH = `${MASS_PRODUCTION_ROOT}/manifest.json` as const;
export const MASS_PRODUCTION_FRAME_AUTHORITY_PATH =
	`${MASS_PRODUCTION_ROOT}/references/approved-seven-frame-sheet.png` as const;
export const MASS_PRODUCTION_FRAME_AUTHORITY_HASH =
	'4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266' as const;
export const MASS_PRODUCTION_GEOMETRY_PATH =
	'assets/wiki/skills/icon-production-v1/geometry-v2.json' as const;
export const MASS_PRODUCTION_GEOMETRY_GUIDE_PATH =
	'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png' as const;
export const MASS_PRODUCTION_PAINTED_EMBLEM_PATH =
	'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png' as const;

export interface MassProductionPromptPacket {
	readonly schemaVersion: 'skill-icon-mass-prompt-v1';
	readonly kind: 'family-reference-sheet' | 'individual-skill';
	readonly identity: string;
	readonly exactPrompt: string;
	readonly outputPath: string;
}

export interface MassProductionFamilyRecord {
	readonly familyId: string;
	readonly slug: string;
	readonly domain: string;
	readonly family: string;
	readonly memberTargetIds: readonly string[];
	readonly promptPath: string;
	readonly referenceSheetPath: string;
	readonly cellMapPath: string;
	readonly resultPath: string;
	readonly status: 'pending' | 'candidate';
	readonly referenceSheetHash?: string;
	readonly resultHash?: string;
}

export interface MassProductionSkillRecord {
	readonly targetId: string;
	readonly slug: string;
	readonly name: string;
	readonly domain: string;
	readonly family: string;
	readonly motifFamily: string;
	readonly rarity: string;
	readonly primaryVisualParent: string | null;
	readonly promptPath: string;
	readonly finalImagePath: string;
	readonly resultPath: string;
	readonly status: 'pending' | 'candidate';
	readonly finalImageHash?: string;
	readonly providerSourceHash?: string;
	readonly resultHash?: string;
}

export interface MassProductionManifest {
	readonly schemaVersion: 'skill-icon-mass-production-manifest-v1';
	readonly runId: 'full-catalog-v1';
	readonly completionState: 'incomplete' | 'complete';
	readonly completedAt?: string;
	readonly authorities: {
		readonly catalog: { readonly path: string; readonly contentHash: string };
		readonly motifMap: { readonly path: string; readonly contentHash: string };
		readonly visualSpecs: { readonly path: string; readonly contentHash: string };
		readonly frameSheet: { readonly path: string; readonly contentHash: string };
		readonly geometry: { readonly path: string; readonly contentHash: string };
		readonly geometryGuide: { readonly path: string; readonly contentHash: string };
		readonly paintedEmblem: { readonly path: string; readonly contentHash: string };
	};
	readonly expected: {
		readonly families: number;
		readonly skills: number;
		readonly domains: Readonly<Record<string, number>>;
	};
	readonly families: readonly MassProductionFamilyRecord[];
	readonly skills: readonly MassProductionSkillRecord[];
	readonly evidence?: {
		readonly providerCalls: {
			readonly families: number;
			readonly skills: number;
			readonly total: number;
		};
		readonly contactSheets: {
			readonly families: readonly {
				readonly familyId: string;
				readonly path: string;
				readonly contentHash: string;
			}[];
			readonly catalog: readonly {
				readonly page: number;
				readonly path: string;
				readonly contentHash: string;
			}[];
		};
		readonly validation: readonly { readonly command: string; readonly completedAt: string }[];
	};
}

type CatalogRecord = SkillIconCatalog['records'][number];

export function sha256(bytes: Buffer | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function familySlug(familyId: string): string {
	return familyId.replaceAll('.', '-');
}

export function skillSlug(targetId: string): string {
	return targetId.replaceAll(':', '-');
}

function elementFor(record: CatalogRecord): string | null {
	return record.labels.find((label) => label.namespace === 'Element')?.value ?? null;
}

function equipmentFor(record: CatalogRecord): string | null {
	return record.labels.find((label) => label.namespace === 'Equipment')?.value ?? null;
}

function concreteAnchor(record: CatalogRecord): string {
	const equipment = equipmentFor(record);
	const element = elementFor(record);
	if (record.domain === 'Martial') {
		if (record.family === 'Body')
			return `a clearly readable human body performing ${record.name}, with the decisive posture and contact point visible`;
		if (equipment)
			return `a clearly visible ${equipment.toLowerCase()} actively performing ${record.name}, with the acting tool never replaced by a free-floating effect`;
		return `a clearly visible ${record.family.toLowerCase()} weapon or defensive tool actively performing ${record.name}`;
	}
	if (record.domain === 'Magical') {
		if (element)
			return `a concrete ${element.toLowerCase()} magical operation that visibly causes ${record.name}, expressed through recognizable elemental matter`;
		return `a concrete magical focus, sigil, target, or transformation visibly performing ${record.name}`;
	}
	return `a concrete craft tool, material, ingredient, creature, document, or finished result visibly embodying ${record.name}`;
}

function paletteFor(record: CatalogRecord): readonly string[] {
	const element = elementFor(record)?.toLowerCase();
	if (element === 'fire') return ['ember orange', 'charcoal black', 'hot gold'];
	if (element === 'water') return ['deep blue', 'clear cyan', 'cold silver'];
	if (element === 'wind') return ['pale cyan', 'storm grey', 'white'];
	if (element === 'earth') return ['mineral green', 'stone grey', 'warm umber'];
	if (record.domain === 'Martial')
		return ['tempered steel', 'charcoal black', 'restrained warm sparks'];
	if (record.domain === 'Magical') return ['arcane gold', 'deep indigo', 'pale spectral light'];
	return ['worked bronze', 'charcoal black', 'natural material color'];
}

export function inferredVisualSpec(record: CatalogRecord): SkillIconVisualSpec {
	return {
		dominantSubject: concreteAnchor(record),
		supportingCue: `one restrained secondary cue communicating this effect: ${record.effect}`.slice(
			0,
			200
		),
		semanticPalette: [...paletteFor(record)],
		composition:
			'Centered painted emblem with one dominant silhouette, strong negative space, and a readable action direction. Keep all important detail clear of the frame rim and top rank crest.',
		exclusions: [
			'no skill name, mastery, level, caption, logo, watermark, or UI panel',
			'no extra frame letter or rarity symbol beyond the required integrated crest',
			'no narrative scenery or unrelated props',
			'no effect-only abstraction replacing the concrete acting subject from F through A'
		]
	};
}

function familyPrompt(
	familyId: string,
	domain: string,
	family: string,
	members: readonly CatalogRecord[]
): string {
	const rows = members
		.map(
			(record, index) =>
				`${index + 1}. row ${Math.floor(index / 4) + 1}, column ${(index % 4) + 1}: ${record.name}; rank ${record.rarity}; ${concreteAnchor(record)}; effect: ${record.effect}`
		)
		.join('\n');
	return `Use case: stylized-concept
Asset type: Summonlab motif-family skill-icon reference sheet
Primary request: Create one coherent reference sheet for the ${familyId} motif family in the ${domain} / ${family} skill taxonomy. Show exactly ${members.length} complete framed skill tiles in the numbered order below.
Subjects:
${rows}
Style/medium: high-end dark-fantasy game UI painted emblems; concrete readable objects and actions; sculpted metal rarity frames matching the supplied frame authority
Composition/framing: four equal columns and ${Math.ceil(members.length / 4)} rows; regular point-up hexagons; identical tile scale; no overlap; generous gutters; every frame fully visible
Lighting/mood: restrained dramatic studio lighting with crisp silhouettes and controlled glow
Constraints: each tile uses its listed F-S frame with the correct integrated uppercase rank letter; consistent charcoal interior; preserve clear shared family ancestry while making every member distinct; no skill names, captions, mastery, levels, type badges, logos, watermark, UI panel, scenery, or checkerboard; do not crop any tile`;
}

function individualPrompt(record: CatalogRecord, visualSpec: SkillIconVisualSpec): string {
	return `Use case: stylized-concept
Asset type: final full-resolution Summonlab framed skill icon
Primary request: Create exactly one complete framed skill tile for ${record.name}. The concept is ${record.effect}
Taxonomy: ${record.domain} domain; ${record.family} family; ${record.mapEntryId} motif family
Subject: ${visualSpec.dominantSubject}
Supporting cue: ${visualSpec.supportingCue ?? 'none'}
Style/medium: high-end dark-fantasy painted emblem matching the supplied family reference sheet; lightly dimensional materials; crisp at 384-pixel UI display
Composition/framing: one centered geometrically regular point-up hexagon, fully visible, on a square canvas; one dominant silhouette with strong negative space; important details clear of the rim and top crest
Color palette: ${visualSpec.semanticPalette.join(', ')}
Frame: exact ${record.rarity}-rank treatment from the supplied approved authority, including one integrated top crest containing only the uppercase letter ${record.rarity}; standard charcoal interior
Constraints: ${visualSpec.exclusions.join('; ')}; transparent background outside the complete frame; no text except the single ${record.rarity} in the rank crest; no skill name, mastery, level, UI, scenery, logo, or watermark`;
}

function assertUnique(values: readonly string[], label: string): void {
	if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}

export function buildMassProductionManifest(options: {
	readonly catalog: SkillIconCatalog;
	readonly motifMap: SkillIconMotifMap;
	readonly hashes: {
		readonly catalog: string;
		readonly motifMap: string;
		readonly visualSpecs: string;
		readonly geometry: string;
		readonly geometryGuide: string;
		readonly paintedEmblem: string;
	};
}): {
	readonly manifest: MassProductionManifest;
	readonly familyPrompts: readonly MassProductionPromptPacket[];
	readonly skillPrompts: readonly MassProductionPromptPacket[];
} {
	const recordsById = new Map(options.catalog.records.map((record) => [record.targetId, record]));
	const familyPrompts: MassProductionPromptPacket[] = [];
	const skillPrompts: MassProductionPromptPacket[] = [];
	const families = options.motifMap.entries.map((entry) => {
		const slug = familySlug(entry.mapEntryId);
		const members = entry.memberTargetIds.map((targetId) => {
			const record = recordsById.get(targetId);
			if (!record) throw new Error(`Motif family ${entry.mapEntryId} references ${targetId}`);
			return record;
		});
		const promptPath = `${MASS_PRODUCTION_ROOT}/prompts/families/${slug}.json`;
		const referenceSheetPath = `${MASS_PRODUCTION_ROOT}/reference-sheets/${slug}.png`;
		familyPrompts.push({
			schemaVersion: 'skill-icon-mass-prompt-v1',
			kind: 'family-reference-sheet',
			identity: entry.mapEntryId,
			exactPrompt: familyPrompt(entry.mapEntryId, entry.domain, entry.family, members),
			outputPath: referenceSheetPath
		});
		return {
			familyId: entry.mapEntryId,
			slug,
			domain: entry.domain,
			family: entry.family,
			memberTargetIds: [...entry.memberTargetIds],
			promptPath,
			referenceSheetPath,
			cellMapPath: `${MASS_PRODUCTION_ROOT}/reference-sheet-maps/${slug}.json`,
			resultPath: `${MASS_PRODUCTION_ROOT}/results/families/${slug}.json`,
			status: 'pending' as const
		};
	});

	const entryById = new Map(options.motifMap.entries.map((entry) => [entry.mapEntryId, entry]));
	const skills = options.catalog.records.map((record) => {
		const motifFamily = record.mapEntryId;
		if (!entryById.has(motifFamily)) throw new Error(`Skill ${record.targetId} lacks motif family`);
		const slug = skillSlug(record.targetId);
		const promptPath = `${MASS_PRODUCTION_ROOT}/prompts/skills/${slug}.json`;
		const finalImagePath = `${MASS_PRODUCTION_ROOT}/icons/${slug}.png`;
		const visualSpec = record.visualSpec ?? inferredVisualSpec(record);
		skillPrompts.push({
			schemaVersion: 'skill-icon-mass-prompt-v1',
			kind: 'individual-skill',
			identity: record.targetId,
			exactPrompt: individualPrompt(record, visualSpec),
			outputPath: finalImagePath
		});
		return {
			targetId: record.targetId,
			slug,
			name: record.name,
			domain: record.domain,
			family: record.family,
			motifFamily,
			rarity: record.rarity,
			primaryVisualParent: record.primaryVisualParent,
			promptPath,
			finalImagePath,
			resultPath: `${MASS_PRODUCTION_ROOT}/results/skills/${slug}.json`,
			status: 'pending' as const
		};
	});

	assertUnique(
		families.map((record) => record.familyId),
		'family IDs'
	);
	assertUnique(
		families.map((record) => record.slug),
		'family slugs'
	);
	assertUnique(
		skills.map((record) => record.targetId),
		'skill IDs'
	);
	assertUnique(
		skills.map((record) => record.slug),
		'skill slugs'
	);
	const mappedMembers = families.flatMap((family) => family.memberTargetIds);
	assertUnique(mappedMembers, 'motif-map members');
	if (mappedMembers.length !== skills.length || mappedMembers.some((id) => !recordsById.has(id))) {
		throw new Error('Motif-map coverage does not equal the catalog');
	}

	const domains = Object.fromEntries(
		['Martial', 'Magical', 'Craft'].map((domain) => [
			domain,
			skills.filter((record) => record.domain === domain).length
		])
	);
	return {
		manifest: {
			schemaVersion: 'skill-icon-mass-production-manifest-v1',
			runId: 'full-catalog-v1',
			completionState: 'incomplete',
			authorities: {
				catalog: {
					path: 'assets/wiki/skills/icon-production-v1/catalog.json',
					contentHash: options.hashes.catalog
				},
				motifMap: {
					path: 'assets/wiki/skills/icon-production-v1/motif-map.json',
					contentHash: options.hashes.motifMap
				},
				visualSpecs: {
					path: 'assets/wiki/skills/icon-production-v1/visual-specs.json',
					contentHash: options.hashes.visualSpecs
				},
				frameSheet: {
					path: MASS_PRODUCTION_FRAME_AUTHORITY_PATH,
					contentHash: MASS_PRODUCTION_FRAME_AUTHORITY_HASH
				},
				geometry: {
					path: MASS_PRODUCTION_GEOMETRY_PATH,
					contentHash: options.hashes.geometry
				},
				geometryGuide: {
					path: MASS_PRODUCTION_GEOMETRY_GUIDE_PATH,
					contentHash: options.hashes.geometryGuide
				},
				paintedEmblem: {
					path: MASS_PRODUCTION_PAINTED_EMBLEM_PATH,
					contentHash: options.hashes.paintedEmblem
				}
			},
			expected: { families: families.length, skills: skills.length, domains },
			families,
			skills
		},
		familyPrompts,
		skillPrompts
	};
}

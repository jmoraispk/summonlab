import { describe, expect, it } from 'vitest';

import { SummonableHeroCatalogSchema } from './summonable-hero.js';

const hash = 'a'.repeat(64);

function ordinalHash(ordinal: number): string {
	return ordinal.toString(16).padStart(64, '0');
}

function ordinalUuid(ordinal: number): string {
	return `00000000-0000-4000-8000-${ordinal.toString().padStart(12, '0')}`;
}

function entry(overrides: Record<string, unknown> = {}) {
	return {
		heroId: 'aear-soro',
		displayName: 'Aear Soro',
		designOrdinal: 1,
		draft: {
			recipe: {
				seed: 'approved:aear-soro',
				generationVersion: 'human-v6',
				cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
			},
			manifest: {
				characterId: '00000000-0000-4000-8000-000000000001',
				displayName: 'Aear Soro',
				appearanceSeed: 'aear-soro',
				generationVersion: 'human-v6',
				rarityStars: 1,
				adultAge: 37,
				genderPresentation: 'feminine',
				pronouns: 'she/her',
				bodyFrame: 'balanced',
				bodyBuild: 'athletic',
				heightCm: 175,
				phenotype: {
					skinTone: 'deep umber',
					faceShape: 'square compact',
					noseProfile: 'aquiline',
					hairTexture: 'coiled',
					hairColor: 'red-copper-auburn',
					hairStyle: 'asymmetric-extreme',
					eyeColor: 'dark brown'
				},
				voice: { register: 'mid', texture: 'warm', cadence: 'measured' },
				posture: 'grounded',
				handedness: 'right',
				visualTraits: ['segmented wrapped crest'],
				palette: { skin: '#633b2d', hair: '#7c3f32', cloth: '#b88a2f', accent: '#667447' },
				rig: {
					headScale: 1,
					shoulderWidth: 1,
					hipWidth: 1,
					legRatio: 1,
					anchors: { head: [50, 17], leftHand: [27, 56], rightHand: [73, 56], back: [50, 36] }
				},
				artKey: 'aear-soro-summon-v1',
				assetProvenance: 'approved-generated-roster'
			},
			mind: {
				personality: {
					openness: 50,
					conscientiousness: 50,
					extraversion: 50,
					agreeableness: 50,
					emotionalVolatility: 50
				},
				primaryValue: 'duty',
				primaryDrive: 'protect',
				socialStyle: 'direct',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: { might: 5, finesse: 5, insight: 5, resolve: 5 }
			},
			manifestHash: hash
		},
		visuals: {
			summon: {
				assetKey: 'aear-soro-summon-v1',
				role: 'summon',
				status: 'approved',
				file: 'assets/heroes/approved/summonable-roster-v1/sources/aear-soro/summon.png',
				width: 1024,
				height: 1536,
				bytes: 1,
				contentHash: hash,
				sourceExperimentId: 'one-star-overnight-200-001',
				approvalId: 'owner-approved-200-heroes'
			},
			combatChibi: {
				assetKey: 'aear-soro-combat-chibi-v1',
				role: 'combat-chibi',
				status: 'approved',
				file: 'assets/heroes/approved/summonable-roster-v1/sources/aear-soro/combat-chibi.png',
				width: 1024,
				height: 1536,
				bytes: 1,
				contentHash: hash,
				sourceExperimentId: 'five-head-chibi-regeneration-001',
				approvalId: 'owner-approved-200-heroes'
			}
		},
		...overrides
	};
}

function catalog(entries: unknown[]) {
	return {
		schemaVersion: 'summonable-hero-catalog-v1',
		catalogVersion: 'summonable-heroes-v1',
		status: 'approved',
		approvedOn: '2026-09-05',
		ownerInstruction: 'These 200 are the heroes that can be summoned. proceed',
		sourceEvidence: [],
		entries
	};
}

function validEntries() {
	return Array.from({ length: 200 }, (_, index) => {
		const ordinal = index + 1;
		const heroId = `hero-${ordinal.toString().padStart(3, '0')}`;
		const manifestHash = ordinalHash(ordinal);
		return entry({
			heroId,
			displayName: `Hero ${ordinal}`,
			designOrdinal: ordinal,
			draft: {
				...entry().draft,
				recipe: {
					...entry().draft.recipe,
					seed: `approved:${heroId}`
				},
				manifest: {
					...entry().draft.manifest,
					characterId: ordinalUuid(ordinal),
					displayName: `Hero ${ordinal}`,
					appearanceSeed: heroId,
					artKey: `${heroId}-summon-v1`
				},
				manifestHash
			},
			visuals: {
				summon: {
					...entry().visuals.summon,
					assetKey: `${heroId}-summon-v1`,
					contentHash: ordinalHash(ordinal + 300)
				},
				combatChibi: {
					...entry().visuals.combatChibi,
					assetKey: `${heroId}-combat-chibi-v1`,
					contentHash: ordinalHash(ordinal + 600)
				}
			}
		});
	});
}

describe('summonable hero catalog contract', () => {
	it('accepts an approved hero with a summon and combat-chibi binding', () => {
		expect(SummonableHeroCatalogSchema.parse(catalog(validEntries())).entries).toHaveLength(200);
	});

	it('rejects duplicate hero identities and visual asset keys', () => {
		const entries = validEntries();
		const second = entries[1]!;
		entries[1] = { ...second, heroId: entries[0]!.heroId };
		expect(() => SummonableHeroCatalogSchema.parse(catalog(entries))).toThrow(
			/Duplicate heroId|Duplicate characterId|Duplicate manifestHash|Duplicate assetKey/u
		);
	});
});

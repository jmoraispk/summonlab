import {
	AttributeGrowthClaimSchema,
	HeroProgressionV2Schema,
	type CharacterCapabilityProfileV1
} from '@summonlab/contracts';
import { PROGRESSION_RULES_V1, PROGRESSION_RULES_V1_BINDING } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { deterministicUuid } from '../../hash.js';
import { applyAttributeGrowthClaim } from './attributes.js';
import { attributePowerMilli, intrinsicAttributes } from './math.js';

const HERO_ID = deterministicUuid('attribute-growth-hero');
const EVENT_ID = deterministicUuid('attribute-growth-event');
const NOW = '2000-01-01T00:00:00.000Z';
const profile: CharacterCapabilityProfileV1 = {
	profileVersion: 'character-capability-v1',
	attributes: { strength: 20, agility: 30, vitality: 20, magic: 40 },
	learning: {
		cognitiveLearningScore: 50,
		domainAptitudes: { martial: 50, magical: 50, crafting: 50, survival: 50, social: 50 }
	}
};

function hero(unallocatedAttributePoints = 3) {
	return {
		heroId: HERO_ID,
		lifeState: 'active' as const,
		health: 60,
		maxHealth: 100,
		mana: 60,
		maxMana: 100,
		capabilityProfile: profile,
		progression: HeroProgressionV2Schema.parse({
			progressionVersion: 'hero-progression-v2',
			stars: 5,
			level: 1,
			experience: 0,
			unallocatedAttributePoints,
			permanentGrowth: { strength: 0, agility: 0, vitality: 0, magic: 0 },
			evidenceCounts: { combat: {}, crafting: {} },
			skills: { swordFighting: { rank: 0, experience: 0 } }
		})
	};
}

function claim(
	attribute: 'strength' | 'agility' | 'vitality' | 'magic',
	sourceKind = 'allocation'
) {
	return AttributeGrowthClaimSchema.parse({
		claimId: deterministicUuid(`attribute-growth:${attribute}:${sourceKind}`),
		heroId: HERO_ID,
		sourceEventId: EVENT_ID,
		attribute,
		amount: 3,
		sourceKind
	});
}

describe('typed intrinsic attribute growth', () => {
	it.each(['strength', 'agility', 'vitality', 'magic'] as const)(
		'applies multi-point %s allocations',
		(attribute) => {
			const outcome = applyAttributeGrowthClaim({
				hero: hero(),
				claim: claim(attribute),
				rules: PROGRESSION_RULES_V1,
				rulesBinding: PROGRESSION_RULES_V1_BINDING,
				occurredAt: NOW
			});
			expect(outcome.hero.progression.permanentGrowth[attribute]).toBe(3);
			expect(outcome.hero.progression.unallocatedAttributePoints).toBe(0);
			expect(outcome.receipt).toMatchObject({
				intrinsicBefore: profile.attributes[attribute],
				intrinsicAfter: profile.attributes[attribute] + 3,
				pointsSpent: 3,
				unallocatedBefore: 3,
				unallocatedAfter: 0
			});
		}
	);

	it('raises maximum Health without filling current Health', () => {
		const outcome = applyAttributeGrowthClaim({
			hero: hero(),
			claim: claim('vitality'),
			rules: PROGRESSION_RULES_V1,
			rulesBinding: PROGRESSION_RULES_V1_BINDING,
			occurredAt: NOW
		});
		expect(outcome.hero).toMatchObject({ health: 60, maxHealth: 115 });
	});

	it.each(['training', 'achievement', 'consumable', 'cultivation'] as const)(
		'accepts direct %s growth without spending allocation points',
		(sourceKind) => {
			const outcome = applyAttributeGrowthClaim({
				hero: hero(0),
				claim: claim('strength', sourceKind),
				rules: PROGRESSION_RULES_V1,
				rulesBinding: PROGRESSION_RULES_V1_BINDING,
				occurredAt: NOW
			});
			expect(outcome.hero.progression).toMatchObject({
				unallocatedAttributePoints: 0,
				permanentGrowth: { strength: 3 }
			});
			expect(outcome.receipt.pointsSpent).toBe(0);
		}
	);

	it('rejects insufficient allocation points and terminal heroes', () => {
		const input = {
			hero: hero(2),
			claim: claim('agility'),
			rules: PROGRESSION_RULES_V1,
			rulesBinding: PROGRESSION_RULES_V1_BINDING,
			occurredAt: NOW
		};
		expect(() => applyAttributeGrowthClaim(input)).toThrow('unallocated');
		expect(() =>
			applyAttributeGrowthClaim({ ...input, hero: { ...hero(3), lifeState: 'dead' as const } })
		).toThrow('active');
	});

	it('applies the current awakening rate to all point vintages', () => {
		const permanentGrowth = { strength: 15, agility: 0, vitality: 0, magic: 0 };
		const total = intrinsicAttributes(profile, permanentGrowth).strength;
		expect(attributePowerMilli(total, 900, PROGRESSION_RULES_V1)).toBe(35 * 5_000);
	});
});

import {
	ExperienceClaimSchema,
	ExperienceReceiptSchema,
	EngineGameStateV27Schema,
	HeroProgressionV2Schema,
	HeroExperienceAppliedPayloadSchema,
	HeroAttributeGrowthAppliedPayloadSchema,
	ProgressionRulesBindingSchema,
	type ExperienceClaim,
	type ExperienceReceipt,
	type HeroProgressionV2,
	type ProgressionRulesBinding,
	type EngineGameStateV27,
	type AuthoritativeEvent
} from '@summonlab/contracts';
import {
	PROGRESSION_RULES_V1,
	PROGRESSION_RULES_V1_BINDING,
	type ProgressionRulesV1
} from '@summonlab/content';

import type { EngineEventReducer } from '../../core/types.js';
import { ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { intrinsicAttributes, maximumHealth } from './math.js';
import { applyAttributeGrowthClaim } from './attributes.js';

export function experienceThresholdForLevel(level: number, rules: ProgressionRulesV1): number {
	if (!Number.isInteger(level) || level < 1 || level > rules.levelCap) {
		throw new RangeError('level');
	}
	return (level - 1) * rules.experiencePerLevel;
}

export function levelForExperience(experience: number, rules: ProgressionRulesV1): number {
	if (!Number.isSafeInteger(experience) || experience < 0) throw new RangeError('experience');
	return Math.min(rules.levelCap, 1 + Math.floor(experience / rules.experiencePerLevel));
}

export type ApplyExperienceClaimInput = Readonly<{
	progression: HeroProgressionV2;
	claim: ExperienceClaim;
	rules: ProgressionRulesV1;
	rulesBinding: ProgressionRulesBinding;
	occurredAt: string;
}>;

export type ExperienceClaimOutcome = Readonly<{
	progression: HeroProgressionV2;
	receipt: ExperienceReceipt;
}>;

export function applyExperienceClaim(input: ApplyExperienceClaimInput): ExperienceClaimOutcome {
	const progression = HeroProgressionV2Schema.parse(input.progression);
	const claim = ExperienceClaimSchema.parse(input.claim);
	const rulesBinding = ProgressionRulesBindingSchema.parse(input.rulesBinding);
	if (rulesBinding.rulesVersion !== input.rules.rulesVersion) {
		throw new Error('Experience claim rules binding does not match supplied rules');
	}
	const expectedLevelBefore = levelForExperience(progression.experience, input.rules);
	if (progression.level !== expectedLevelBefore) {
		throw new Error('Hero level diverged from cumulative experience');
	}

	const experienceAfter = progression.experience + claim.amount;
	if (!Number.isSafeInteger(experienceAfter)) throw new RangeError('experience');
	const levelAfter = levelForExperience(experienceAfter, input.rules);
	const levelsCrossed = Array.from(
		{ length: levelAfter - progression.level },
		(_, index) => progression.level + index + 1
	);
	const pointsGranted = levelsCrossed.length * progression.stars;
	const nextProgression = HeroProgressionV2Schema.parse({
		...progression,
		level: levelAfter,
		experience: experienceAfter,
		unallocatedAttributePoints: progression.unallocatedAttributePoints + pointsGranted
	});
	const receipt = ExperienceReceiptSchema.parse({
		receiptVersion: 'experience-receipt-v1',
		receiptId: deterministicUuid(`${claim.claimId}:experience-receipt-v1`),
		claim,
		rules: rulesBinding,
		experienceBefore: progression.experience,
		experienceAfter,
		levelBefore: progression.level,
		levelAfter,
		levelsCrossed,
		pointsGranted,
		occurredAt: input.occurredAt
	});
	return Object.freeze({ progression: nextProgression, receipt });
}

export function reconcileHealthAfterProgression(
	input: Readonly<{
		health: number;
		oldMaximum: number;
		newMaximum: number;
	}>
): number {
	for (const [key, value] of Object.entries(input)) {
		if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(key);
	}
	if (input.health > input.oldMaximum) throw new RangeError('health');
	return Math.min(input.health, input.newMaximum);
}

function reduceExperienceApplied(
	state: EngineGameStateV27,
	event: AuthoritativeEvent
): EngineGameStateV27 {
	const payload = HeroExperienceAppliedPayloadSchema.parse(event.payload);
	const hero = state.heroes[payload.heroId];
	if (
		!hero ||
		payload.claim.heroId !== hero.heroId ||
		hashCanonical(payload.progressionBefore) !== hashCanonical(hero.progression) ||
		payload.maximumHealthBefore !== hero.maxHealth
	) {
		throw new ReplayIntegrityError('Experience event precondition diverged', event.sequence);
	}
	const outcome = applyExperienceClaim({
		progression: hero.progression,
		claim: payload.claim,
		rules: PROGRESSION_RULES_V1,
		rulesBinding: PROGRESSION_RULES_V1_BINDING,
		occurredAt: event.gameTime
	});
	const intrinsic = intrinsicAttributes(hero.capabilityProfile, hero.progression.permanentGrowth);
	const maximumHealthAfter = maximumHealth(
		intrinsic.vitality,
		outcome.progression.level,
		PROGRESSION_RULES_V1
	);
	const healthAfter = reconcileHealthAfterProgression({
		health: hero.health,
		oldMaximum: hero.maxHealth,
		newMaximum: maximumHealthAfter
	});
	if (
		hashCanonical(payload.receipt) !== hashCanonical(outcome.receipt) ||
		hashCanonical(payload.progressionAfter) !== hashCanonical(outcome.progression) ||
		payload.maximumHealthAfter !== maximumHealthAfter ||
		payload.healthAfter !== healthAfter ||
		payload.nextVersion !== state.version + 1
	) {
		throw new ReplayIntegrityError('Experience event outcome diverged', event.sequence);
	}
	return EngineGameStateV27Schema.parse({
		...state,
		version: payload.nextVersion,
		eventCursor: event.sequence,
		entropyCursor: event.seedCursor,
		heroes: {
			...state.heroes,
			[hero.heroId]: {
				...hero,
				progression: outcome.progression,
				maxHealth: maximumHealthAfter,
				health: healthAfter
			}
		}
	});
}

export const progressionEventReducer: EngineEventReducer = {
	ownerId: 'progression',
	eventTypes: ['hero.attribute.growth.applied', 'hero.experience.applied'],
	reduce(state, event) {
		if (state.schemaVersion !== 27) {
			throw new ReplayIntegrityError('Progression event requires engine-v27', event.sequence);
		}
		if (event.eventType === 'hero.attribute.growth.applied') {
			const payload = HeroAttributeGrowthAppliedPayloadSchema.parse(event.payload);
			const hero = state.heroes[payload.heroId];
			if (
				!hero ||
				event.actorId !== hero.heroId ||
				payload.claim.sourceEventId !== event.eventId ||
				hashCanonical(payload.progressionBefore) !== hashCanonical(hero.progression)
			) {
				throw new ReplayIntegrityError(
					'Attribute growth event precondition diverged',
					event.sequence
				);
			}
			const outcome = applyAttributeGrowthClaim({
				hero,
				claim: payload.claim,
				rules: PROGRESSION_RULES_V1,
				rulesBinding: PROGRESSION_RULES_V1_BINDING,
				occurredAt: event.gameTime
			});
			if (
				hashCanonical(payload.receipt) !== hashCanonical(outcome.receipt) ||
				hashCanonical(payload.progressionAfter) !== hashCanonical(outcome.hero.progression) ||
				payload.healthAfter !== outcome.hero.health ||
				payload.maximumHealthAfter !== outcome.hero.maxHealth ||
				payload.manaAfter !== outcome.hero.mana ||
				payload.maximumManaAfter !== outcome.hero.maxMana ||
				payload.nextVersion !== state.version + 1
			) {
				throw new ReplayIntegrityError('Attribute growth event outcome diverged', event.sequence);
			}
			return EngineGameStateV27Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				heroes: { ...state.heroes, [hero.heroId]: { ...hero, ...outcome.hero } }
			});
		}
		return reduceExperienceApplied(state, event);
	}
};

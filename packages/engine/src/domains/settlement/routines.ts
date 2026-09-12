import {
	DailyPlanSchema,
	EngineGameStateV5Schema,
	EngineGameStateV6Schema,
	EngineGameStateV7Schema,
	EngineGameStateV8Schema,
	EngineGameStateV9Schema,
	EngineGameStateV10Schema,
	EngineGameStateV11Schema,
	EngineGameStateV12Schema,
	EngineGameStateV13Schema,
	EngineGameStateV14Schema,
	EngineGameStateV15Schema,
	EngineGameStateV16Schema,
	EngineGameStateV17Schema,
	EngineGameStateV18Schema,
	EngineGameStateV19Schema,
	EngineGameStateV20Schema,
	EngineGameStateV21Schema,
	EngineGameStateV22Schema,
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	EngineGameStateV25Schema,
	EngineGameStateV27Schema,
	ExperienceReceiptSchema,
	HabitStateSchema,
	HeroProgressionSchema,
	HeroProgressionV25Schema,
	HeroProgressionV2Schema,
	InjurySchema,
	NeedStateSchema,
	RoutineResolutionSchema,
	type ActivityKind,
	type EngineGameState,
	type EntropyDraw,
	type RewardDelta,
	type RoutineKind
} from '@summonlab/contracts';
import { PROGRESSION_RULES_V1, PROGRESSION_RULES_V1_BINDING } from '@summonlab/content';
import { z } from 'zod';

import { RewardDeltasSchema } from '../../core/event-metadata.js';
import type { EngineGameStateModern, EngineRoutineState } from '../../core/types.js';
import { ENGINE_EPOCH, hasFirstEmberState } from '../../core/versions.js';
import { createEntropyCursor, drawInteger } from '../../entropy.js';
import { IllegalActionError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';
import { applyExperienceClaim } from '../progression/experience.js';
import {
	intrinsicAttributes as progressionIntrinsicAttributes,
	maximumHealth as progressionMaximumHealth
} from '../progression/math.js';

export const ItemUpdateSchema = z
	.object({
		itemId: z.string().uuid(),
		durabilityAfter: z.number().int().nonnegative()
	})
	.strict();

export const ActivityOutcomeSchema = z
	.object({
		scheduledEventId: z.string().uuid(),
		heroId: z.string().uuid(),
		activity: z.enum(['train', 'eat', 'rest', 'repair']),
		healthAfter: z.number().int().min(0).max(100),
		lifeStateAfter: z.enum(['active', 'dead', 'synthesized']),
		needsAfter: NeedStateSchema,
		injuriesAfter: z.array(InjurySchema),
		progressionAfter: HeroProgressionSchema,
		itemUpdate: ItemUpdateSchema.nullable(),
		rewardDeltas: RewardDeltasSchema
	})
	.strict();

const CapabilityHealthSchema = z.number().int().nonnegative().max(10_000);

export const ActivityOutcomeV25Schema = ActivityOutcomeSchema.extend({
	healthAfter: CapabilityHealthSchema,
	progressionAfter: HeroProgressionV25Schema
}).strict();

export const ActivityOutcomeV27Schema = ActivityOutcomeSchema.extend({
	healthAfter: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	maxHealthAfter: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	progressionAfter: HeroProgressionV2Schema,
	experienceReceipt: ExperienceReceiptSchema.nullable()
}).strict();

export const RoutineOutcomeSchema = z
	.object({
		scheduledEventId: z.string().uuid(),
		heroId: z.string().uuid(),
		planId: z.string().uuid(),
		planEntryId: z.string().uuid(),
		kind: z.enum([
			'checks-exits',
			'stretches-at-dawn',
			'shares-breakfast',
			'catalogues-tools',
			'walks-the-walls',
			'practises-knots',
			'assigned-duty',
			'self-directed',
			'meal',
			'sleep'
		]),
		needsAfter: NeedStateSchema,
		healthAfter: z.number().int().min(0).max(100),
		habitAfter: HabitStateSchema,
		rewardDeltas: RewardDeltasSchema
	})
	.strict();

export const RoutineOutcomeV25Schema = RoutineOutcomeSchema.extend({
	healthAfter: CapabilityHealthSchema
}).strict();

export const RoutineOutcomeV27Schema = RoutineOutcomeSchema.extend({
	healthAfter: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
}).strict();

export function clamp(value: number, minimum = 0, maximum = 100): number {
	return Math.min(maximum, Math.max(minimum, value));
}
export function firstEmberModifier(
	state: EngineGameStateModern,
	key:
		| 'hunger-recovery'
		| 'fatigue-recovery'
		| 'health-recovery'
		| 'hero-experience'
		| 'sword-experience'
		| 'training-injury-threshold'
): number {
	if (!hasFirstEmberState(state) || state.settlement.firstEmber.status !== 'committed') return 0;
	return (
		state.settlement.firstEmber.modifiers.find((modifier) => modifier.key === key)?.amount ?? 0
	);
}
export function currentRoutineFor(state: EngineGameState, heroId: string) {
	return state.schemaVersion === 5 ||
		state.schemaVersion === 6 ||
		state.schemaVersion === 7 ||
		state.schemaVersion === 8 ||
		state.schemaVersion === 9 ||
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21 ||
		state.schemaVersion === 22 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24 ||
		state.schemaVersion === 25 ||
		state.schemaVersion === 27
		? (state.heroes[heroId]?.currentRoutine ?? null)
		: null;
}
export function gameDayIndex(gameTime: string): number {
	return Math.floor((Date.parse(gameTime) - Date.parse(ENGINE_EPOCH)) / (24 * 60 * 60 * 1_000));
}

export function routineLabel(kind: RoutineKind): string {
	return {
		'checks-exits': 'survey the exits',
		'stretches-at-dawn': 'complete a stretching ritual',
		'shares-breakfast': 'prepare a shared breakfast',
		'catalogues-tools': 'catalogue useful tools',
		'walks-the-walls': 'walk the settlement walls',
		'practises-knots': 'practise knots and bindings',
		'assigned-duty': 'work the assigned facility duty',
		'self-directed': 'pursue self-directed practice',
		meal: 'eat a proper meal',
		sleep: 'sleep and recover'
	}[kind];
}

export function routineDuration(kind: RoutineKind): number {
	if (kind === 'assigned-duty') return 60;
	if (kind === 'self-directed') return 45;
	if (kind === 'sleep') return 120;
	if (kind === 'meal') return 20;
	return 25;
}

export function createDailyPlan(state: EngineRoutineState, heroId: string, commandId: string) {
	const hero = state.heroes[heroId];
	if (!hero) throw new IllegalActionError('hero.plan.day');
	const dayIndex = gameDayIndex(state.simulatedAt);
	const assignmentKind = hero.assignment ? ('assigned-duty' as const) : ('self-directed' as const);
	return DailyPlanSchema.parse({
		planId: deterministicUuid(`${commandId}:daily-plan:${dayIndex}`),
		dayIndex,
		createdAt: state.simulatedAt,
		entries: [
			{
				planEntryId: deterministicUuid(`${commandId}:plan-entry:habit`),
				period: 'dawn',
				kind: hero.habit.habit,
				buildingId: null,
				status: 'pending',
				startedAt: null,
				completedAt: null
			},
			{
				planEntryId: deterministicUuid(`${commandId}:plan-entry:duty`),
				period: 'day',
				kind: assignmentKind,
				buildingId: hero.assignment?.buildingId ?? null,
				status: 'pending',
				startedAt: null,
				completedAt: null
			},
			{
				planEntryId: deterministicUuid(`${commandId}:plan-entry:meal`),
				period: 'evening',
				kind: 'meal',
				buildingId: 'kitchen',
				status: 'pending',
				startedAt: null,
				completedAt: null
			},
			{
				planEntryId: deterministicUuid(`${commandId}:plan-entry:sleep`),
				period: 'night',
				kind: 'sleep',
				buildingId: 'dormitory',
				status: 'pending',
				startedAt: null,
				completedAt: null
			}
		]
	});
}

export function resolveDailyRoutine(
	stateInput: EngineRoutineState,
	heroId: string
): z.infer<typeof RoutineResolutionSchema> | null {
	const state =
		stateInput.schemaVersion === 27
			? EngineGameStateV27Schema.parse(stateInput)
			: stateInput.schemaVersion === 25
				? EngineGameStateV25Schema.parse(stateInput)
				: stateInput.schemaVersion === 24
					? EngineGameStateV24Schema.parse(stateInput)
					: stateInput.schemaVersion === 23
						? EngineGameStateV23Schema.parse(stateInput)
						: stateInput.schemaVersion === 22
							? EngineGameStateV22Schema.parse(stateInput)
							: stateInput.schemaVersion === 21
								? EngineGameStateV21Schema.parse(stateInput)
								: stateInput.schemaVersion === 20
									? EngineGameStateV20Schema.parse(stateInput)
									: stateInput.schemaVersion === 19
										? EngineGameStateV19Schema.parse(stateInput)
										: stateInput.schemaVersion === 18
											? EngineGameStateV18Schema.parse(stateInput)
											: stateInput.schemaVersion === 17
												? EngineGameStateV17Schema.parse(stateInput)
												: stateInput.schemaVersion === 16
													? EngineGameStateV16Schema.parse(stateInput)
													: stateInput.schemaVersion === 15
														? EngineGameStateV15Schema.parse(stateInput)
														: stateInput.schemaVersion === 14
															? EngineGameStateV14Schema.parse(stateInput)
															: stateInput.schemaVersion === 13
																? EngineGameStateV13Schema.parse(stateInput)
																: stateInput.schemaVersion === 12
																	? EngineGameStateV12Schema.parse(stateInput)
																	: stateInput.schemaVersion === 11
																		? EngineGameStateV11Schema.parse(stateInput)
																		: stateInput.schemaVersion === 10
																			? EngineGameStateV10Schema.parse(stateInput)
																			: stateInput.schemaVersion === 9
																				? EngineGameStateV9Schema.parse(stateInput)
																				: stateInput.schemaVersion === 8
																					? EngineGameStateV8Schema.parse(stateInput)
																					: stateInput.schemaVersion === 7
																						? EngineGameStateV7Schema.parse(stateInput)
																						: stateInput.schemaVersion === 6
																							? EngineGameStateV6Schema.parse(stateInput)
																							: EngineGameStateV5Schema.parse(stateInput);
	const hero = state.heroes[heroId];
	if (!hero?.dailyPlan || hero.currentRoutine) return null;
	const pending = hero.dailyPlan.entries.filter((entry) => entry.status === 'pending');
	if (pending.length === 0) return null;
	const candidateScores = pending
		.map((entry) => {
			const reasons: string[] = [];
			let score = 0;
			let eligible = true;
			if (entry.kind === hero.habit.habit) {
				score = hero.habit.strength + Math.round(hero.mind.personality.conscientiousness / 4);
				score -= Math.round(hero.needs.hunger / 3 + hero.needs.fatigue / 3);
				reasons.push(`habit strength ${hero.habit.strength}`);
				reasons.push(`conscientiousness ${hero.mind.personality.conscientiousness}`);
			}
			if (entry.kind === 'assigned-duty') {
				eligible = Boolean(hero.assignment && hero.assignment.buildingId === entry.buildingId);
				score =
					35 +
					Math.round(hero.mind.personality.conscientiousness / 2) +
					(hero.mind.primaryValue === 'duty' || hero.mind.primaryValue === 'mastery' ? 18 : 0);
				reasons.push(
					hero.assignment ? `assigned to ${hero.assignment.buildingId}` : 'assignment lost'
				);
			}
			if (entry.kind === 'self-directed') {
				score =
					30 +
					Math.round(hero.mind.personality.openness / 3) +
					(hero.mind.primaryDrive === 'understand' || hero.mind.primaryDrive === 'create' ? 15 : 0);
				reasons.push(`openness ${hero.mind.personality.openness}`);
			}
			if (entry.kind === 'meal') {
				eligible = state.settlement.resources.food > 0;
				score = Math.round(hero.needs.hunger * 1.4) + (eligible ? 18 : -100);
				if (hero.habit.habit === 'shares-breakfast') score += 16;
				reasons.push(`hunger ${hero.needs.hunger}`);
				reasons.push(eligible ? 'food available' : 'food unavailable');
			}
			if (entry.kind === 'sleep') {
				score =
					Math.round(hero.needs.fatigue * 1.4) +
					(hero.maxHealth - hero.health) * 2 +
					hero.injuries.length * 15;
				reasons.push(`fatigue ${hero.needs.fatigue}`);
				reasons.push(`health ${hero.health}/${hero.maxHealth}`);
			}
			return {
				planEntryId: entry.planEntryId,
				kind: entry.kind,
				score: eligible ? score : Math.min(score, -100),
				eligible,
				reasons
			};
		})
		.sort((left, right) =>
			right.score === left.score
				? left.planEntryId.localeCompare(right.planEntryId)
				: right.score - left.score
		);
	const eligible = candidateScores.filter((candidate) => candidate.eligible);
	const selected = eligible[0];
	if (!selected) return null;
	const margin = selected.score - (eligible[1]?.score ?? Math.max(-200, selected.score - 100));
	const decisionRecommended = eligible.length > 1 && margin <= 5;
	return RoutineResolutionSchema.parse({
		selectedPlanEntryId: selected.planEntryId,
		selectedKind: selected.kind,
		candidateScores,
		margin,
		decisionRecommended,
		fallbackUsed: decisionRecommended,
		summary: decisionRecommended
			? `${routineLabel(selected.kind)} won a close score by ${margin}; deterministic fallback used.`
			: `${routineLabel(selected.kind)} led the next eligible routine by ${margin}.`
	});
}
export function resourceChange(
	state: EngineGameStateModern,
	resource: 'food' | 'iron-ore',
	reason: string
) {
	const before = state.settlement.resources[resource];
	return { resource, before, after: before - 1, delta: -1, reason };
}

export function activityDuration(activity: ActivityKind): number {
	return { train: 30, eat: 15, rest: 60, repair: 20 }[activity];
}

export function levelFor(experience: number, stars: number): number {
	return Math.min(stars * 10, 1 + Math.floor(experience / 10));
}

export function attributePointsForLevelTransition(
	unspentAttributePoints: number,
	levelBefore: number,
	levelAfter: number
): number {
	if (
		![unspentAttributePoints, levelBefore, levelAfter].every(Number.isInteger) ||
		unspentAttributePoints < 0 ||
		levelBefore < 1 ||
		levelAfter < levelBefore
	) {
		throw new Error('Attribute point grants require a nondecreasing integer level transition');
	}
	return unspentAttributePoints + (levelAfter - levelBefore);
}

export function buildActivityOutcome(
	state: EngineGameStateModern,
	heroId: string,
	eventId: string,
	entropyCursor: { seed: string; cursor: number }
): {
	outcome:
		| z.infer<typeof ActivityOutcomeSchema>
		| z.infer<typeof ActivityOutcomeV25Schema>
		| z.infer<typeof ActivityOutcomeV27Schema>;
	entropy: typeof entropyCursor;
	draws: EntropyDraw[];
} {
	const hero = state.heroes[heroId];
	const activity = hero?.currentActivity;
	if (!hero || !activity) throw new Error('Cannot resolve a missing activity');
	let healthAfter = hero.health;
	let lifeStateAfter = hero.lifeState;
	let needsAfter = { ...hero.needs };
	let injuriesAfter = [...hero.injuries];
	let progressionAfter = structuredClone(hero.progression);
	let itemUpdate: z.infer<typeof ItemUpdateSchema> | null = null;
	let nextEntropy = entropyCursor;
	const draws: EntropyDraw[] = [];
	const deltas: RewardDelta[] = [];
	let experienceReceipt: z.infer<typeof ExperienceReceiptSchema> | null = null;
	let maxHealthAfter = hero.maxHealth;

	if (activity.kind === 'train') {
		const experienceBonus = firstEmberModifier(state, 'hero-experience');
		const skillBonus = firstEmberModifier(state, 'sword-experience');
		const experienceBefore = hero.progression.experience;
		const levelBefore = hero.progression.level;
		const skillBefore = hero.progression.skills.swordFighting.experience;
		const skillAfter = skillBefore + 6 + skillBonus;
		const experienceAfter = experienceBefore + 8 + experienceBonus;
		if (state.schemaVersion === 27) {
			const progressionHero = state.heroes[heroId]!;
			const claimOutcome = applyExperienceClaim({
				progression: progressionHero.progression,
				claim: {
					claimId: deterministicUuid(`${eventId}:${heroId}:training-experience-claim`),
					heroId,
					sourceEventId: eventId,
					evidenceKey: `training:${activity.scheduledEventId}`,
					amount: 8 + experienceBonus,
					sourceKind: 'training'
				},
				rules: PROGRESSION_RULES_V1,
				rulesBinding: PROGRESSION_RULES_V1_BINDING,
				occurredAt: activity.completesAt
			});
			experienceReceipt = claimOutcome.receipt;
			progressionAfter = {
				...claimOutcome.progression,
				skills: {
					swordFighting: {
						experience: skillAfter,
						rank: Math.min(20, Math.floor(skillAfter / 5))
					}
				}
			};
			const intrinsic = progressionIntrinsicAttributes(
				progressionHero.capabilityProfile,
				progressionHero.progression.permanentGrowth
			);
			maxHealthAfter = progressionMaximumHealth(
				intrinsic.vitality,
				claimOutcome.progression.level,
				PROGRESSION_RULES_V1
			);
		} else {
			const levelAfter = levelFor(experienceAfter, hero.progression.stars);
			const capabilityProgression =
				state.schemaVersion === 25 ? state.heroes[heroId]!.progression : null;
			progressionAfter = {
				...hero.progression,
				experience: experienceAfter,
				level: levelAfter,
				...(capabilityProgression
					? {
							unspentAttributePoints: attributePointsForLevelTransition(
								capabilityProgression.unspentAttributePoints,
								levelBefore,
								levelAfter
							),
							attributeGrowthReceipts: capabilityProgression.attributeGrowthReceipts
						}
					: {}),
				skills: {
					swordFighting: {
						experience: skillAfter,
						rank: Math.min(20, Math.floor(skillAfter / 5))
					}
				}
			};
		}
		needsAfter = {
			hunger: clamp(hero.needs.hunger + 10),
			fatigue: clamp(hero.needs.fatigue + 15)
		};
		deltas.push(
			{
				ownerId: heroId,
				kind: 'experience',
				key: 'hero',
				before: experienceBefore,
				after: experienceAfter,
				delta: 8 + experienceBonus
			},
			{
				ownerId: heroId,
				kind: 'skill',
				key: 'sword-fighting',
				before: skillBefore,
				after: skillAfter,
				delta: 6 + skillBonus
			},
			{
				ownerId: heroId,
				kind: 'need',
				key: 'hunger',
				before: hero.needs.hunger,
				after: needsAfter.hunger,
				delta: needsAfter.hunger - hero.needs.hunger
			},
			{
				ownerId: heroId,
				kind: 'need',
				key: 'fatigue',
				before: hero.needs.fatigue,
				after: needsAfter.fatigue,
				delta: needsAfter.fatigue - hero.needs.fatigue
			}
		);
		if (progressionAfter.level !== levelBefore) {
			deltas.push({
				ownerId: heroId,
				kind: 'level',
				key: 'hero',
				before: levelBefore,
				after: progressionAfter.level,
				delta: progressionAfter.level - levelBefore
			});
		}
		const itemId = hero.equipment.mainHand;
		const item = itemId ? state.items[itemId] : null;
		if (item) {
			const durabilityAfter = Math.max(0, item.durability - 1);
			itemUpdate = { itemId: item.itemId, durabilityAfter };
			deltas.push({
				ownerId: heroId,
				kind: 'durability',
				key: 'templateId' in item ? item.templateId : item.definitionId,
				before: item.durability,
				after: durabilityAfter,
				delta: durabilityAfter - item.durability
			});
		}
		const injuryDraw = drawInteger(
			createEntropyCursor(nextEntropy.seed, nextEntropy.cursor),
			`activity.train.injury.${heroId.replaceAll('-', '')}`,
			0,
			99
		);
		nextEntropy = injuryDraw.next;
		draws.push(injuryDraw.draw);
		const injuryThreshold = 15 + firstEmberModifier(state, 'training-injury-threshold');
		if (injuryDraw.draw.value < injuryThreshold) {
			healthAfter = Math.max(0, hero.health - 10);
			lifeStateAfter = healthAfter === 0 ? 'dead' : 'active';
			if (healthAfter > 0) {
				injuriesAfter.push({
					injuryId: deterministicUuid(`${eventId}:${heroId}:training-strain`),
					kind: 'strain',
					severity: 10,
					inflictedAt: activity.completesAt
				});
			}
			deltas.push({
				ownerId: heroId,
				kind: 'health',
				key: 'body',
				before: hero.health,
				after: healthAfter,
				delta: healthAfter - hero.health
			});
		}
	}

	if (activity.kind === 'eat') {
		const recovery = 45 + firstEmberModifier(state, 'hunger-recovery');
		needsAfter = { ...hero.needs, hunger: Math.max(0, hero.needs.hunger - recovery) };
		deltas.push({
			ownerId: heroId,
			kind: 'need',
			key: 'hunger',
			before: hero.needs.hunger,
			after: needsAfter.hunger,
			delta: needsAfter.hunger - hero.needs.hunger
		});
	}

	if (activity.kind === 'rest') {
		const fatigueRecovery = 50 + firstEmberModifier(state, 'fatigue-recovery');
		const healthRecovery = 10 + firstEmberModifier(state, 'health-recovery');
		needsAfter = { ...hero.needs, fatigue: Math.max(0, hero.needs.fatigue - fatigueRecovery) };
		healthAfter = Math.min(hero.maxHealth, hero.health + healthRecovery);
		injuriesAfter = hero.injuries.slice(1);
		deltas.push({
			ownerId: heroId,
			kind: 'need',
			key: 'fatigue',
			before: hero.needs.fatigue,
			after: needsAfter.fatigue,
			delta: needsAfter.fatigue - hero.needs.fatigue
		});
		if (healthAfter !== hero.health) {
			deltas.push({
				ownerId: heroId,
				kind: 'health',
				key: 'body',
				before: hero.health,
				after: healthAfter,
				delta: healthAfter - hero.health
			});
		}
	}

	if (activity.kind === 'repair') {
		const itemId = hero.equipment.mainHand;
		const item = itemId ? state.items[itemId] : null;
		if (!item) throw new Error('Repair activity lost its equipment target');
		const durabilityAfter = Math.min(item.maxDurability, item.durability + 3);
		itemUpdate = { itemId: item.itemId, durabilityAfter };
		deltas.push({
			ownerId: heroId,
			kind: 'durability',
			key: 'templateId' in item ? item.templateId : item.definitionId,
			before: item.durability,
			after: durabilityAfter,
			delta: durabilityAfter - item.durability
		});
	}

	return {
		outcome: (state.schemaVersion === 27
			? ActivityOutcomeV27Schema
			: state.schemaVersion === 25
				? ActivityOutcomeV25Schema
				: ActivityOutcomeSchema
		).parse({
			scheduledEventId: activity.scheduledEventId,
			heroId,
			activity: activity.kind,
			healthAfter,
			lifeStateAfter,
			needsAfter,
			injuriesAfter,
			progressionAfter,
			...(state.schemaVersion === 27 ? { maxHealthAfter, experienceReceipt } : {}),
			itemUpdate,
			rewardDeltas: deltas
		}),
		entropy: nextEntropy,
		draws
	};
}

export function buildRoutineOutcome(state: EngineRoutineState, heroId: string) {
	const hero = state.heroes[heroId];
	const routine = hero?.currentRoutine;
	if (!hero || !routine) throw new Error('Cannot resolve a missing routine');
	let needsAfter = { ...hero.needs };
	let healthAfter = hero.health;
	let habitAfter = { ...hero.habit };
	const rewardDeltas: RewardDelta[] = [];
	const changeNeed = (key: 'hunger' | 'fatigue', after: number) => {
		after = clamp(after);
		rewardDeltas.push({
			ownerId: heroId,
			kind: 'need',
			key,
			before: hero.needs[key],
			after,
			delta: after - hero.needs[key]
		});
		needsAfter = { ...needsAfter, [key]: after };
	};

	if (routine.kind === hero.habit.habit) {
		changeNeed('hunger', hero.needs.hunger + 3);
		changeNeed('fatigue', hero.needs.fatigue + 3);
		const strength = clamp(hero.habit.strength + 1);
		const satisfaction = clamp(hero.habit.satisfaction + 8);
		rewardDeltas.push(
			{
				ownerId: heroId,
				kind: 'habit',
				key: 'strength',
				before: hero.habit.strength,
				after: strength,
				delta: strength - hero.habit.strength
			},
			{
				ownerId: heroId,
				kind: 'habit',
				key: 'satisfaction',
				before: hero.habit.satisfaction,
				after: satisfaction,
				delta: satisfaction - hero.habit.satisfaction
			}
		);
		habitAfter = {
			...hero.habit,
			strength,
			satisfaction,
			repetitions: hero.habit.repetitions + 1,
			lastTriggeredAt: routine.completesAt
		};
	}
	if (routine.kind === 'assigned-duty') {
		changeNeed('hunger', hero.needs.hunger + 8);
		changeNeed('fatigue', hero.needs.fatigue + 10);
	}
	if (routine.kind === 'self-directed') {
		changeNeed('hunger', hero.needs.hunger + 5);
		changeNeed('fatigue', hero.needs.fatigue + 7);
	}
	if (routine.kind === 'meal') {
		changeNeed('hunger', hero.needs.hunger - 45 - firstEmberModifier(state, 'hunger-recovery'));
	}
	if (routine.kind === 'sleep') {
		changeNeed('fatigue', hero.needs.fatigue - 55 - firstEmberModifier(state, 'fatigue-recovery'));
		healthAfter = Math.min(
			hero.maxHealth,
			hero.health + 8 + firstEmberModifier(state, 'health-recovery')
		);
		if (healthAfter !== hero.health) {
			rewardDeltas.push({
				ownerId: heroId,
				kind: 'health',
				key: 'body',
				before: hero.health,
				after: healthAfter,
				delta: healthAfter - hero.health
			});
		}
	}

	return (
		state.schemaVersion === 27
			? RoutineOutcomeV27Schema
			: state.schemaVersion === 25
				? RoutineOutcomeV25Schema
				: RoutineOutcomeSchema
	).parse({
		scheduledEventId: routine.scheduledEventId,
		heroId,
		planId: routine.planId,
		planEntryId: routine.planEntryId,
		kind: routine.kind,
		needsAfter,
		healthAfter,
		habitAfter,
		rewardDeltas
	});
}

export function skipUnfinishedPlan(hero: EngineRoutineState['heroes'][string], resolvedAt: string) {
	if (!hero.dailyPlan) return null;
	return DailyPlanSchema.parse({
		...hero.dailyPlan,
		entries: hero.dailyPlan.entries.map((entry) =>
			entry.status === 'pending' || entry.status === 'active'
				? { ...entry, status: 'skipped', completedAt: resolvedAt }
				: entry
		)
	});
}

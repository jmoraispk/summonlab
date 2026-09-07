import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	BASIC_SWORD_STRIKE,
	COMBAT_CONTENT_BINDING,
	COMBAT_EQUIPMENT_PROFILES_BY_ID,
	COMBAT_RULES_V1
} from '../packages/content/src/index.js';
import type { CombatAttributes, DamageChannel } from '../packages/contracts/src/index.js';
import {
	armourReduction,
	attributeScaledMagnitude,
	healthRegeneration,
	maximumHealth,
	namedResistanceReduction
} from '../packages/engine/src/domains/combat/capability.js';
import { resistanceGrantReceiptsFromAuthoredSources } from '../packages/engine/src/domains/combat/resistance-grants.js';
import { hashCanonical } from '../packages/engine/src/hash.js';

export const BALANCE_LEVELS = [10, 40, 70, 99] as const;
export const BALANCE_SPREADS = ['low', 'mid', 'high'] as const;
export const BALANCE_TRIALS_PER_MATCHUP = 10_000 as const;

const SEED_SET = [
	'0x243f6a88',
	'0x85a308d3',
	'0x13198a2e',
	'0x03707344',
	'0xa4093822',
	'0x299f31d0',
	'0x082efa98',
	'0xec4e6c89',
	'0x452821e6',
	'0x38d01377'
] as const;

const TRIALS_PER_SEED = BALANCE_TRIALS_PER_MATCHUP / SEED_SET.length;
const BASIS_POINTS = 10_000;
const HEAVY_ARMOUR_DEFINITION_ID = 'equipment-iron-heavy-armour-torso' as const;

type BalanceLevel = (typeof BALANCE_LEVELS)[number];
type BalanceSpread = (typeof BALANCE_SPREADS)[number];
type MasteryBand = 'novice' | 'trained' | 'mastered';
type ArmourState = 'unarmoured' | 'armoured';

const BALANCE_SIMULATION_PROFILE_V1 = Object.freeze({
	profileVersion: 'combat-balance-simulation-profile-v1',
	calibrationStatus: 'benchmark-promotion-candidate',
	randomnessVersion: 'sha256-seeded-xorshift32-v1',
	agilityAccuracyBasisPointsPerPoint: 10,
	agilityAccuracyCapBasisPoints: 900,
	damageVarianceBasisPoints: [9_000, 11_000] as const,
	armourPointSeries: [0, 25, 50, 100, 150, 250] as const,
	armouredBenchmarkPoints: 100,
	maxCompletionActions: 200,
	attributeValues: {
		10: { low: 10, mid: 20, high: 30 },
		40: { low: 15, mid: 35, high: 55 },
		70: { low: 20, mid: 50, high: 80 },
		99: { low: 25, mid: 65, high: 95 }
	},
	baseMagnitudeByLevel: { 10: 12, 40: 18, 70: 24, 99: 30 },
	benchmarkDomain: {
		armour: {
			minimumPoints: 0,
			maximumPoints: 250,
			armouredFixturePoints: 100,
			runtimeMagnitudeStatus: 'not-yet-shipped'
		}
	},
	affinityAssociations: {
		fire: 'might',
		earth: 'vitality',
		wind: 'agility',
		water: 'spirit'
	},
	sourceRecords: {
		accuracySkillId: BASIC_SWORD_STRIKE.skillId,
		armouredEquipmentDefinitionId: HEAVY_ARMOUR_DEFINITION_ID
	}
} as const);

const MASTERY_VALUES = {
	novice: 0,
	trained: 50,
	mastered: 100
} as const satisfies Readonly<Record<MasteryBand, number>>;

const ACCURACY_GATES = {
	novice: { minimumBasisPoints: 6_500, maximumBasisPoints: 7_000 },
	trained: { minimumBasisPoints: 7_700, maximumBasisPoints: 8_300 },
	mastered: { minimumBasisPoints: 9_000, maximumBasisPoints: 9_500 }
} as const;

type PercentileBand = Readonly<{ p10: number; p50: number; p90: number }>;

type SeededSummary = Readonly<{
	mean: number;
	p10: number;
	p50: number;
	p90: number;
}>;

type AccuracyMatchup = Readonly<{
	matchupId: string;
	level: BalanceLevel;
	attributeSpread: BalanceSpread;
	masteryBand: MasteryBand;
	trials: typeof BALANCE_TRIALS_PER_MATCHUP;
	authoredAccuracyBasisPoints: number;
	observedHitRateBasisPoints: number;
	seedCohortHitRateBasisPoints: PercentileBand;
}>;

type AgilityMatchup = Readonly<{
	matchupId: string;
	level: BalanceLevel;
	attributeSpread: BalanceSpread;
	direction: 'faster' | 'slower';
	peerAgility: number;
	attackerAgility: number;
	trials: typeof BALANCE_TRIALS_PER_MATCHUP;
	effectiveChanceShiftBasisPoints: number;
	observedChanceShiftBasisPoints: number;
	adjustedHitRateBasisPoints: number;
	seedCohortHitRateBasisPoints: PercentileBand;
}>;

type RegenerationMatchup = Readonly<{
	matchupId: string;
	level: BalanceLevel;
	attributeSpread: BalanceSpread;
	armourState: ArmourState;
	trials: typeof BALANCE_TRIALS_PER_MATCHUP;
	combatHealthRegenerationDuringDelay: number;
	combatHealthRegenerationPerTick: number;
	sustainedPeerDamage: SeededSummary;
}>;

type AffinityVariant = Readonly<{
	affinity: 'fire' | 'water';
	trials: typeof BALANCE_TRIALS_PER_MATCHUP;
	completionActions: PercentileBand;
}>;

type AffinityMatchup = Readonly<{
	matchupId: string;
	level: BalanceLevel;
	attributeSpread: BalanceSpread;
	archetype: 'fire-caster' | 'water-martial';
	matchedAffinity: AffinityVariant;
	offAffinity: AffinityVariant;
	medianCompletionTimeRatioBasisPoints: number;
}>;

type ArmourMatchup = Readonly<{
	matchupId: string;
	level: BalanceLevel;
	attributeSpread: BalanceSpread;
	trials: typeof BALANCE_TRIALS_PER_MATCHUP;
	reductionCurve: readonly Readonly<{
		armour: number;
		reductionBasisPoints: number;
	}>[];
	damageAfterArmour: SeededSummary;
}>;

export type CombatBalanceEvidence = Readonly<{
	schemaVersion: 'combat-balance-evidence-v1';
	status: 'passed' | 'failed';
	bindings: Readonly<{
		rules: Readonly<{ rulesVersion: 'combat-rules-v1'; rulesHash: string }>;
		combatContent: Readonly<{
			bindingVersion: 'combat-content-binding-v1';
			contentHash: string;
			components: typeof COMBAT_CONTENT_BINDING.components;
		}>;
	}>;
	simulation: Readonly<{
		profile: typeof BALANCE_SIMULATION_PROFILE_V1;
		profileHash: string;
		trialsPerMatchup: typeof BALANCE_TRIALS_PER_MATCHUP;
		percentileMethod: 'nearest-rank';
		seedSet: typeof SEED_SET;
	}>;
	fixtures: Readonly<{
		levels: typeof BALANCE_LEVELS;
		attributeSpreads: typeof BALANCE_SPREADS;
		masteryBands: readonly MasteryBand[];
		armourStates: readonly ArmourState[];
		offAffinityArchetypes: readonly ('fire-caster' | 'water-martial')[];
	}>;
	gates: Readonly<{
		accuracy: Readonly<{
			status: 'passed' | 'failed';
			targetsBasisPoints: typeof ACCURACY_GATES;
		}>;
		relativeAgility: Readonly<{
			status: 'passed' | 'failed';
			maximumAllowedChanceShiftBasisPoints: 1_000;
			maximumAbsoluteChanceShiftBasisPoints: number;
		}>;
		passiveCombatRegeneration: Readonly<{
			status: 'passed' | 'failed';
			maximumRegenerationToDamageRatioBasisPoints: number;
		}>;
		offAffinityCompletion: Readonly<{
			status: 'passed' | 'failed';
			maximumAllowedMedianRatioBasisPoints: 11_500;
			maximumObservedMedianRatioBasisPoints: number;
		}>;
		armour: Readonly<{
			status: 'passed' | 'failed';
			maximumAllowedExclusiveReductionBasisPoints: 7_500;
			maximumObservedReductionBasisPoints: number;
			monotonic: boolean;
		}>;
	}>;
	matchups: Readonly<{
		accuracy: readonly AccuracyMatchup[];
		agility: readonly AgilityMatchup[];
		regeneration: readonly RegenerationMatchup[];
		affinity: readonly AffinityMatchup[];
		armour: readonly ArmourMatchup[];
	}>;
}>;

function divideHalfUp(numerator: bigint, denominator: bigint): number {
	return Number((numerator + denominator / 2n) / denominator);
}

function scaleByBasisPoints(value: number, basisPoints: number): number {
	return divideHalfUp(BigInt(value) * BigInt(basisPoints), BigInt(BASIS_POINTS));
}

function ratioBasisPoints(numerator: number, denominator: number): number {
	if (denominator <= 0) throw new Error('Balance ratio denominator must be positive');
	return divideHalfUp(BigInt(numerator) * BigInt(BASIS_POINTS), BigInt(denominator));
}

function nearestRank(values: readonly number[], fraction: number): number {
	if (values.length === 0) throw new Error('Cannot summarize an empty trial set');
	const ordered = [...values].sort((left, right) => left - right);
	return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)]!;
}

function percentileBand(values: readonly number[]): PercentileBand {
	return {
		p10: nearestRank(values, 0.1),
		p50: nearestRank(values, 0.5),
		p90: nearestRank(values, 0.9)
	};
}

function seededSummary(values: readonly number[]): SeededSummary {
	const total = values.reduce((sum, value) => sum + value, 0);
	return {
		mean: Math.round((total / values.length) * 1_000) / 1_000,
		...percentileBand(values)
	};
}

function randomStream(matchupId: string, seed: string): () => number {
	let state = Number.parseInt(
		hashCanonical({
			randomnessVersion: BALANCE_SIMULATION_PROFILE_V1.randomnessVersion,
			matchupId,
			seed
		}).slice(0, 8),
		16
	);
	if (state === 0) state = 0x6d2b79f5;
	return () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return state >>> 0;
	};
}

function rollBasisPoints(random: () => number, chanceBasisPoints: number): boolean {
	const threshold = Math.min(BASIS_POINTS, Math.max(0, chanceBasisPoints));
	return random() % BASIS_POINTS < threshold;
}

function randomBasisPoints(random: () => number, minimum: number, maximum: number): number {
	return minimum + (random() % (maximum - minimum + 1));
}

function attributeValue(level: BalanceLevel, spread: BalanceSpread): number {
	return BALANCE_SIMULATION_PROFILE_V1.attributeValues[level][spread];
}

function peerAttributes(level: BalanceLevel, spread: BalanceSpread): CombatAttributes {
	const value = attributeValue(level, spread);
	return { might: value, vitality: value, agility: value, spirit: value };
}

function masteryAccuracy(masteryBand: MasteryBand): number {
	const mastery = MASTERY_VALUES[masteryBand];
	const step = [...BASIC_SWORD_STRIKE.masteryProgression]
		.reverse()
		.find((candidate) => candidate.minimumMastery <= mastery);
	if (!step) throw new Error(`Basic sword strike has no accuracy step for mastery ${mastery}`);
	return step.accuracyBasisPoints;
}

function agilityChanceShift(attackerAgility: number, defenderAgility: number): number {
	const raw =
		(attackerAgility - defenderAgility) *
		BALANCE_SIMULATION_PROFILE_V1.agilityAccuracyBasisPointsPerPoint;
	const cap = BALANCE_SIMULATION_PROFILE_V1.agilityAccuracyCapBasisPoints;
	return Math.min(cap, Math.max(-cap, raw));
}

function simulateHitRate(
	matchupId: string,
	chanceBasisPoints: number
): {
	observedBasisPoints: number;
	seedBand: PercentileBand;
} {
	let hits = 0;
	const cohortRates: number[] = [];
	for (const seed of SEED_SET) {
		const random = randomStream(matchupId, seed);
		let cohortHits = 0;
		for (let trial = 0; trial < TRIALS_PER_SEED; trial += 1) {
			if (rollBasisPoints(random, chanceBasisPoints)) cohortHits += 1;
		}
		hits += cohortHits;
		cohortRates.push(ratioBasisPoints(cohortHits, TRIALS_PER_SEED));
	}
	return {
		observedBasisPoints: ratioBasisPoints(hits, BALANCE_TRIALS_PER_MATCHUP),
		seedBand: percentileBand(cohortRates)
	};
}

function buildAccuracyMatchups(): AccuracyMatchup[] {
	return BALANCE_LEVELS.flatMap((level) =>
		BALANCE_SPREADS.flatMap((attributeSpread) =>
			(['novice', 'trained', 'mastered'] as const).map((masteryBand) => {
				const matchupId = `accuracy-l${level}-${attributeSpread}-${masteryBand}`;
				const authoredAccuracyBasisPoints = masteryAccuracy(masteryBand);
				const result = simulateHitRate(matchupId, authoredAccuracyBasisPoints);
				return {
					matchupId,
					level,
					attributeSpread,
					masteryBand,
					trials: BALANCE_TRIALS_PER_MATCHUP,
					authoredAccuracyBasisPoints,
					observedHitRateBasisPoints: result.observedBasisPoints,
					seedCohortHitRateBasisPoints: result.seedBand
				};
			})
		)
	);
}

function buildAgilityMatchups(): AgilityMatchup[] {
	const baselineChance = masteryAccuracy('trained');
	return BALANCE_LEVELS.flatMap((level) =>
		BALANCE_SPREADS.flatMap((attributeSpread) => {
			const peerAgility = attributeValue(level, attributeSpread);
			return (['faster', 'slower'] as const).map((direction) => {
				const attackerAgility = direction === 'faster' ? 100 : 1;
				const matchupId = `agility-l${level}-${attributeSpread}-${direction}`;
				const effectiveChanceShiftBasisPoints = agilityChanceShift(attackerAgility, peerAgility);
				const baseline = simulateHitRate(`${matchupId}-paired`, baselineChance);
				const adjusted = simulateHitRate(
					`${matchupId}-paired`,
					baselineChance + effectiveChanceShiftBasisPoints
				);
				return {
					matchupId,
					level,
					attributeSpread,
					direction,
					peerAgility,
					attackerAgility,
					trials: BALANCE_TRIALS_PER_MATCHUP,
					effectiveChanceShiftBasisPoints,
					observedChanceShiftBasisPoints:
						adjusted.observedBasisPoints - baseline.observedBasisPoints,
					adjustedHitRateBasisPoints: adjusted.observedBasisPoints,
					seedCohortHitRateBasisPoints: adjusted.seedBand
				};
			});
		})
	);
}

const heavyArmourProfile = COMBAT_EQUIPMENT_PROFILES_BY_ID[HEAVY_ARMOUR_DEFINITION_ID];
if (!heavyArmourProfile) throw new Error('Balance fixture requires iron heavy armour torso');
const heavyArmourResistanceReceipts = resistanceGrantReceiptsFromAuthoredSources(
	{
		equipment: [{ sourceInstanceId: 'combat-balance-heavy-armour', profile: heavyArmourProfile }],
		passiveSkills: [],
		physiology: []
	},
	COMBAT_RULES_V1
);

function affinityAdjustedMagnitude(
	baseMagnitude: number,
	channel: DamageChannel,
	attributes: CombatAttributes,
	matchedAffinity: boolean
): number {
	const scaled = attributeScaledMagnitude(baseMagnitude, channel, attributes, COMBAT_RULES_V1);
	if (!matchedAffinity) return scaled;
	const attributeContribution = scaled - baseMagnitude;
	return (
		baseMagnitude +
		scaleByBasisPoints(
			attributeContribution,
			BASIS_POINTS + COMBAT_RULES_V1.affinity.contributionNudgeCapBasisPoints
		)
	);
}

function damageAfterMitigation(
	damage: number,
	armourBasisPoints: number,
	resistanceBasisPoints: number
): number {
	const afterArmour = scaleByBasisPoints(damage, BASIS_POINTS - armourBasisPoints);
	return Math.max(1, scaleByBasisPoints(afterArmour, BASIS_POINTS - resistanceBasisPoints));
}

function simulatePeerDamage(input: {
	matchupId: string;
	attributes: CombatAttributes;
	level: BalanceLevel;
	armourPoints: number;
	includeHeavyArmourResistance: boolean;
}): SeededSummary {
	const values: number[] = [];
	const accuracy = masteryAccuracy('trained');
	const baseMagnitude = BALANCE_SIMULATION_PROFILE_V1.baseMagnitudeByLevel[input.level];
	const scaledMagnitude = affinityAdjustedMagnitude(
		baseMagnitude,
		'physical',
		input.attributes,
		false
	);
	const armourBasisPoints = armourReduction(input.armourPoints, 0, COMBAT_RULES_V1);
	const resistanceBasisPoints = input.includeHeavyArmourResistance
		? namedResistanceReduction(
				BASIC_SWORD_STRIKE.damageTags,
				heavyArmourResistanceReceipts,
				COMBAT_RULES_V1
			)
		: 0;
	for (const seed of SEED_SET) {
		const random = randomStream(input.matchupId, seed);
		for (let trial = 0; trial < TRIALS_PER_SEED; trial += 1) {
			if (!rollBasisPoints(random, accuracy)) {
				values.push(0);
				continue;
			}
			const [minimumVariance, maximumVariance] =
				BALANCE_SIMULATION_PROFILE_V1.damageVarianceBasisPoints;
			const varied = scaleByBasisPoints(
				scaledMagnitude,
				randomBasisPoints(random, minimumVariance, maximumVariance)
			);
			values.push(damageAfterMitigation(varied, armourBasisPoints, resistanceBasisPoints));
		}
	}
	return seededSummary(values);
}

function buildRegenerationMatchups(): RegenerationMatchup[] {
	return BALANCE_LEVELS.flatMap((level) =>
		BALANCE_SPREADS.flatMap((attributeSpread) =>
			(['unarmoured', 'armoured'] as const).map((armourState) => {
				const attributes = peerAttributes(level, attributeSpread);
				const matchupId = `regeneration-l${level}-${attributeSpread}-${armourState}`;
				return {
					matchupId,
					level,
					attributeSpread,
					armourState,
					trials: BALANCE_TRIALS_PER_MATCHUP,
					combatHealthRegenerationDuringDelay: healthRegeneration(
						attributes.vitality,
						{
							mode: 'combat',
							downed: false,
							ticksSinceDamage: COMBAT_RULES_V1.health.combatRegenerationDelayTicks - 1,
							injuryRepair: false
						},
						COMBAT_RULES_V1
					),
					combatHealthRegenerationPerTick: healthRegeneration(
						attributes.vitality,
						{
							mode: 'combat',
							downed: false,
							ticksSinceDamage: COMBAT_RULES_V1.health.combatRegenerationDelayTicks,
							injuryRepair: false
						},
						COMBAT_RULES_V1
					),
					sustainedPeerDamage: simulatePeerDamage({
						matchupId,
						attributes,
						level,
						armourPoints:
							armourState === 'armoured'
								? BALANCE_SIMULATION_PROFILE_V1.armouredBenchmarkPoints
								: 0,
						includeHeavyArmourResistance: armourState === 'armoured'
					})
				};
			})
		)
	);
}

function simulateCompletionActions(input: {
	matchupId: string;
	attributes: CombatAttributes;
	level: BalanceLevel;
	channel: DamageChannel;
	matchedAffinity: boolean;
}): PercentileBand {
	const values: number[] = [];
	const hitChance = masteryAccuracy('trained');
	const targetHealth = maximumHealth(input.attributes.vitality, COMBAT_RULES_V1);
	const baseMagnitude = BALANCE_SIMULATION_PROFILE_V1.baseMagnitudeByLevel[input.level];
	const damage = affinityAdjustedMagnitude(
		baseMagnitude,
		input.channel,
		input.attributes,
		input.matchedAffinity
	);
	for (const seed of SEED_SET) {
		const random = randomStream(input.matchupId, seed);
		for (let trial = 0; trial < TRIALS_PER_SEED; trial += 1) {
			let dealt = 0;
			let actions = 0;
			while (dealt < targetHealth && actions < BALANCE_SIMULATION_PROFILE_V1.maxCompletionActions) {
				actions += 1;
				if (!rollBasisPoints(random, hitChance)) continue;
				const [minimumVariance, maximumVariance] =
					BALANCE_SIMULATION_PROFILE_V1.damageVarianceBasisPoints;
				dealt += Math.max(
					1,
					scaleByBasisPoints(damage, randomBasisPoints(random, minimumVariance, maximumVariance))
				);
			}
			values.push(actions);
		}
	}
	return percentileBand(values);
}

function buildAffinityMatchups(): AffinityMatchup[] {
	return BALANCE_LEVELS.flatMap((level) =>
		BALANCE_SPREADS.flatMap((attributeSpread) => {
			const attributes = peerAttributes(level, attributeSpread);
			return (['fire-caster', 'water-martial'] as const).map((archetype) => {
				const channel = archetype === 'fire-caster' ? 'magical' : 'physical';
				const matchedAffinity = archetype === 'fire-caster' ? 'water' : 'fire';
				const offAffinity = archetype === 'fire-caster' ? 'fire' : 'water';
				const matchupId = `affinity-l${level}-${attributeSpread}-${archetype}`;
				const matchedCompletion = simulateCompletionActions({
					matchupId: `${matchupId}-matched`,
					attributes,
					level,
					channel,
					matchedAffinity: true
				});
				const offCompletion = simulateCompletionActions({
					matchupId: `${matchupId}-off`,
					attributes,
					level,
					channel,
					matchedAffinity: false
				});
				return {
					matchupId,
					level,
					attributeSpread,
					archetype,
					matchedAffinity: {
						affinity: matchedAffinity,
						trials: BALANCE_TRIALS_PER_MATCHUP,
						completionActions: matchedCompletion
					},
					offAffinity: {
						affinity: offAffinity,
						trials: BALANCE_TRIALS_PER_MATCHUP,
						completionActions: offCompletion
					},
					medianCompletionTimeRatioBasisPoints: ratioBasisPoints(
						offCompletion.p50,
						matchedCompletion.p50
					)
				};
			});
		})
	);
}

function buildArmourMatchups(): ArmourMatchup[] {
	const reductionCurve = BALANCE_SIMULATION_PROFILE_V1.armourPointSeries.map((armour) => ({
		armour,
		reductionBasisPoints: armourReduction(armour, 0, COMBAT_RULES_V1)
	}));
	return BALANCE_LEVELS.flatMap((level) =>
		BALANCE_SPREADS.map((attributeSpread) => {
			const matchupId = `armour-l${level}-${attributeSpread}`;
			return {
				matchupId,
				level,
				attributeSpread,
				trials: BALANCE_TRIALS_PER_MATCHUP,
				reductionCurve,
				damageAfterArmour: simulatePeerDamage({
					matchupId,
					attributes: peerAttributes(level, attributeSpread),
					level,
					armourPoints:
						BALANCE_SIMULATION_PROFILE_V1.armourPointSeries[
							BALANCE_SIMULATION_PROFILE_V1.armourPointSeries.length - 1
						]!,
					includeHeavyArmourResistance: false
				})
			};
		})
	);
}

function status(condition: boolean): 'passed' | 'failed' {
	return condition ? 'passed' : 'failed';
}

export function createCombatBalanceEvidence(): CombatBalanceEvidence {
	const accuracy = buildAccuracyMatchups();
	const agility = buildAgilityMatchups();
	const regeneration = buildRegenerationMatchups();
	const affinity = buildAffinityMatchups();
	const armour = buildArmourMatchups();
	const accuracyPassed = accuracy.every((matchup) => {
		const gate = ACCURACY_GATES[matchup.masteryBand];
		return (
			matchup.observedHitRateBasisPoints >= gate.minimumBasisPoints &&
			matchup.observedHitRateBasisPoints <= gate.maximumBasisPoints
		);
	});
	const maximumAbsoluteChanceShiftBasisPoints = Math.max(
		Math.abs(agilityChanceShift(1, 100)),
		Math.abs(agilityChanceShift(100, 1)),
		...agility.map((matchup) => Math.abs(matchup.observedChanceShiftBasisPoints))
	);
	const regenerationPassed = regeneration.every(
		(matchup) => matchup.combatHealthRegenerationPerTick < matchup.sustainedPeerDamage.mean
	);
	const maximumRegenerationToDamageRatioBasisPoints = Math.max(
		...regeneration.map((matchup) =>
			ratioBasisPoints(
				matchup.combatHealthRegenerationPerTick * 1_000,
				Math.max(1, Math.round(matchup.sustainedPeerDamage.mean * 1_000))
			)
		)
	);
	const maximumObservedMedianRatioBasisPoints = Math.max(
		...affinity.map((matchup) => matchup.medianCompletionTimeRatioBasisPoints)
	);
	const reductionValues = armour[0]!.reductionCurve.map((point) => point.reductionBasisPoints);
	const armourMonotonic = reductionValues.every(
		(value, index) => index === 0 || value >= reductionValues[index - 1]!
	);
	const maximumObservedReductionBasisPoints = Math.max(...reductionValues);
	const gates = {
		accuracy: {
			status: status(accuracyPassed),
			targetsBasisPoints: ACCURACY_GATES
		},
		relativeAgility: {
			status: status(maximumAbsoluteChanceShiftBasisPoints <= 1_000),
			maximumAllowedChanceShiftBasisPoints: 1_000 as const,
			maximumAbsoluteChanceShiftBasisPoints
		},
		passiveCombatRegeneration: {
			status: status(regenerationPassed),
			maximumRegenerationToDamageRatioBasisPoints
		},
		offAffinityCompletion: {
			status: status(maximumObservedMedianRatioBasisPoints <= 11_500),
			maximumAllowedMedianRatioBasisPoints: 11_500 as const,
			maximumObservedMedianRatioBasisPoints
		},
		armour: {
			status: status(armourMonotonic && maximumObservedReductionBasisPoints < 7_500),
			maximumAllowedExclusiveReductionBasisPoints: 7_500 as const,
			maximumObservedReductionBasisPoints,
			monotonic: armourMonotonic
		}
	};
	const allPassed = Object.values(gates).every((gate) => gate.status === 'passed');
	return {
		schemaVersion: 'combat-balance-evidence-v1',
		status: allPassed ? 'passed' : 'failed',
		bindings: {
			rules: {
				rulesVersion: COMBAT_RULES_V1.rulesVersion,
				rulesHash: hashCanonical(COMBAT_RULES_V1)
			},
			combatContent: {
				bindingVersion: COMBAT_CONTENT_BINDING.bindingVersion,
				contentHash: COMBAT_CONTENT_BINDING.contentHash,
				components: COMBAT_CONTENT_BINDING.components
			}
		},
		simulation: {
			profile: BALANCE_SIMULATION_PROFILE_V1,
			profileHash: hashCanonical(BALANCE_SIMULATION_PROFILE_V1),
			trialsPerMatchup: BALANCE_TRIALS_PER_MATCHUP,
			percentileMethod: 'nearest-rank',
			seedSet: SEED_SET
		},
		fixtures: {
			levels: BALANCE_LEVELS,
			attributeSpreads: BALANCE_SPREADS,
			masteryBands: ['novice', 'trained', 'mastered'],
			armourStates: ['unarmoured', 'armoured'],
			offAffinityArchetypes: ['fire-caster', 'water-martial']
		},
		gates,
		matchups: { accuracy, agility, regeneration, affinity, armour }
	};
}

export function serializeCombatBalanceEvidence(evidence: CombatBalanceEvidence): string {
	return `${JSON.stringify(evidence, null, '\t')}\n`;
}

const evidencePath = resolve(
	fileURLToPath(new URL('..', import.meta.url)),
	'docs/evidence/combat-balance-v1.json'
);

async function runCli(): Promise<void> {
	const write = process.argv.includes('--write');
	const check = process.argv.includes('--check');
	if (write === check) {
		throw new Error('Use exactly one combat balance mode: --write or --check');
	}
	const evidence = createCombatBalanceEvidence();
	if (evidence.status !== 'passed') {
		throw new Error('Combat balance promotion gates failed; refusing to publish evidence');
	}
	const expected = serializeCombatBalanceEvidence(evidence);
	if (write) {
		await writeFile(evidencePath, expected, 'utf8');
	} else {
		const current = await readFile(evidencePath, 'utf8').catch(() => '');
		if (current !== expected) {
			throw new Error('Combat balance evidence is stale; run pnpm export:combat-balance');
		}
	}
	process.stdout.write(
		`combat-balance-v1 ${evidence.status}: ${BALANCE_TRIALS_PER_MATCHUP} trials per matchup; ${evidence.bindings.rules.rulesHash}\n`
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await runCli();
}

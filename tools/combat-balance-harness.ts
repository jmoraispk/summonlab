import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	BASIC_SWORD_STRIKE,
	COMBAT_CONTENT_BINDING,
	COMBAT_EQUIPMENT_PROFILES_BY_ID,
	COMBAT_RULES_V1,
	loadCombatContentBinding
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

const BASIS_POINTS = 10_000;
const HEAVY_ARMOUR_DEFINITION_ID = 'equipment-iron-heavy-armour-torso' as const;

type BalanceLevel = (typeof BALANCE_LEVELS)[number];
type BalanceSpread = (typeof BALANCE_SPREADS)[number];
type MasteryBand = 'novice' | 'trained' | 'mastered';
type ArmourState = 'unarmoured' | 'armoured';

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

const BALANCE_SIMULATION_PROFILE_V1 = deepFreeze({
	profileVersion: 'combat-balance-simulation-profile-v1',
	calibrationStatus: 'benchmark-promotion-candidate',
	arithmetic: {
		basisPointScale: BASIS_POINTS,
		integerDivisionRounding: 'half-up',
		summaryMeanDecimalPlaces: 3
	},
	randomness: {
		version: 'sha256-seeded-xorshift32-v1',
		seedMaterial: 'canonical-object-of-randomness-version-matchup-id-and-seed',
		seedDigestHexStart: 0,
		seedDigestHexLength: 8,
		seedDigestRadix: 16,
		seedCohortAllocation: 'equal',
		outputUnsignedRightShiftBits: 0,
		xorshift32: {
			firstLeftShift: 13,
			rightShift: 17,
			secondLeftShift: 5,
			zeroStateFallback: 0x6d2b79f5
		},
		rollModulo: BASIS_POINTS
	},
	benchmarkLevels: BALANCE_LEVELS,
	attributeSpreads: BALANCE_SPREADS,
	trialsPerMatchup: BALANCE_TRIALS_PER_MATCHUP,
	percentileMethod: 'nearest-rank',
	percentileFractions: { p10: 0.1, p50: 0.5, p90: 0.9 },
	seedSet: SEED_SET,
	masteryFixtures: { novice: 0, trained: 50, mastered: 100 },
	masteryResolution: 'greatest-minimum-mastery-at-or-below-fixture',
	fixtureMatrix: {
		accuracyMasteryBands: ['novice', 'trained', 'mastered'],
		armourStates: ['unarmoured', 'armoured']
	},
	attributeFixture: 'all-four-attributes-equal-to-level-spread-value',
	accuracyFixture: {
		attackerAgilitySource: 'peer',
		defenderAgilitySource: 'peer'
	},
	hitContest: {
		formula:
			'clamp(authored-accuracy + attacker-level-accuracy - defender-level-evasion - defender-agility-evasion + relative-agility)',
		levelSource: 'peer-for-attacker-and-defender',
		minimumHitChanceBasisPoints: 500,
		maximumHitChanceBasisPoints: 9_950,
		attackerLevelAccuracyBasisPointsPerLevel: 2,
		defenderLevelEvasionBasisPointsPerLevel: 1,
		defenderAgilityEvasionBasisPointsPerPoint: 1,
		relativeAgilityBasisPointsPerPoint: 10,
		relativeAgilityCapBasisPoints: 900
	},
	relativeAgilityFixture: {
		masteryBand: 'trained',
		directions: ['faster', 'slower'],
		baselineAttackerAgilitySource: 'peer',
		defenderAgilitySource: 'peer',
		endpointAttackerAgility: { faster: 100, slower: 1 },
		randomStreamCoupling: 'paired-baseline-and-adjusted'
	},
	armourPointSeries: [0, 25, 50, 100, 150, 250] as const,
	peerDamageFixture: {
		damageModel: 'attribute-scaled-level-base-magnitude',
		masteryBand: 'trained',
		channel: 'physical',
		damageTags: BASIC_SWORD_STRIKE.damageTags,
		matchedAffinity: false,
		attackerAgilitySource: 'peer',
		defenderAgilitySource: 'peer',
		missDamage: 0,
		damageVarianceBasisPoints: { minimum: 9_000, maximum: 11_000, endpoints: 'inclusive' },
		minimumSuccessfulDamage: 1,
		mitigationOrder: ['armour', 'named-resistance'],
		penetrationPoints: 0,
		resistancePolicy: 'apply-authored-armour-receipts-when-enabled'
	},
	completionFixture: {
		damageModel: 'attribute-scaled-level-base-magnitude-with-affinity-candidate',
		masteryBand: 'trained',
		attackerAgilitySource: 'peer',
		defenderAgilitySource: 'peer',
		targetHealthSource: 'maximum-health-from-peer-vitality',
		damageVarianceBasisPoints: { minimum: 9_000, maximum: 11_000, endpoints: 'inclusive' },
		minimumSuccessfulDamage: 1,
		maximumActions: 200,
		missConsumesAction: true,
		defencePolicy: 'no-armour-or-named-resistance',
		affinityVariantRandomStreamCoupling: 'independent',
		affinityVariantRandomStreamSuffixes: { matched: 'matched', offAffinity: 'off' }
	},
	promotionGates: {
		accuracyStatistic: 'aggregate-hit-rate',
		accuracyBasisPoints: {
			novice: { minimumBasisPoints: 6_500, maximumBasisPoints: 7_000 },
			trained: { minimumBasisPoints: 7_700, maximumBasisPoints: 8_300 },
			mastered: { minimumBasisPoints: 9_000, maximumBasisPoints: 9_500 }
		},
		maximumRelativeAgilityShiftBasisPoints: 1_000,
		relativeAgilityEvaluation: 'maximum-of-formula-endpoints-and-observed-paired-shifts',
		offAffinityMedianRatioBasisPoints: { minimum: 8_500, maximum: 11_500 },
		offAffinityStatistic: 'p50-completion-actions-off-divided-by-matched',
		regenerationComparison: {
			completionPolicy: 'all-trials-complete-with-zero-timeouts',
			totalBand: 'p90-regeneration-strictly-below-p10-damage',
			normalizedThroughput: 'mean-regeneration-strictly-below-mean-damage',
			zeroDamageRatioDenominatorScaledUnits: 1
		},
		armourReduction: {
			monotonicRequired: true,
			maximumExclusiveBasisPoints: 7_500,
			authoritativeCeilingRequired: true
		}
	},
	sustainedTimeline: {
		damageSource: 'peer-damage-fixture',
		tickDurationMilliseconds: 100,
		tickIndexOrigin: 0,
		tickIndexIncrement: 1,
		horizonTicks: 120,
		firstAttackTick: 0,
		attackCadenceTicks: 10,
		initialTicksSinceDamage: 0,
		regenerationContext: { mode: 'combat', downed: false, injuryRepair: false },
		resolutionOrder: ['attack', 'regeneration', 'advance-damage-clock'],
		damageClockResetPolicy: { trigger: 'positive-damage', value: 0 },
		damageClockAdvancePerTick: 1,
		recoveryAccounting: 'uncapped-throughput',
		throughputNormalizationTicks: 1_000
	},
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
			maximumPoints: 10_000,
			pointIncrement: 1,
			penetrationPoints: 0,
			armouredFixturePoints: 100,
			damageFixturePoints: 250,
			damageFixtureIncludesNamedResistance: false,
			equipmentMagnitudeStatus: 'not-yet-shipped',
			reductionCeilingStatus: 'authoritative-combat-rule'
		}
	},
	affinityAssociations: {
		fire: 'might',
		earth: 'vitality',
		wind: 'agility',
		water: 'spirit'
	},
	affinityApplication: {
		matchingRule: 'associated-attribute-matches-channel-attribute',
		channelAttributes: { physical: 'might', magical: 'spirit' },
		matchedAdjustmentScope: 'attribute-contribution-only',
		nudgeSource: 'combat-rules-affinity-contribution-cap',
		offAffinityAdjustment: 'none'
	},
	affinityArchetypes: {
		fireCaster: {
			archetype: 'fire-caster',
			channel: 'magical',
			matchedAffinity: 'water',
			offAffinity: 'fire'
		},
		waterMartial: {
			archetype: 'water-martial',
			channel: 'physical',
			matchedAffinity: 'fire',
			offAffinity: 'water'
		}
	},
	armourFixtures: {
		unarmoured: { armourPoints: 0, includeHeavyArmourResistance: false },
		armoured: { armourPoints: 100, includeHeavyArmourResistance: true }
	},
	sourceRecords: {
		accuracySkillId: BASIC_SWORD_STRIKE.skillId,
		peerDamageTagSkillId: BASIC_SWORD_STRIKE.skillId,
		armouredEquipmentDefinitionId: HEAVY_ARMOUR_DEFINITION_ID
	}
} as const);

const ACCURACY_GATES = BALANCE_SIMULATION_PROFILE_V1.promotionGates.accuracyBasisPoints;

export type PercentileBand = Readonly<{ p10: number; p50: number; p90: number }>;

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
	attackerAccuracyBasisPoints: number;
	defenderEvasionBasisPoints: number;
	relativeAgilityBasisPoints: number;
	contestChanceBasisPoints: number;
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
	completedTrials: number;
	timedOutTrials: number;
	damageTotal: SeededSummary;
	regenerationTotal: SeededSummary;
	damagePerThousandTicks: SeededSummary;
	regenerationPerThousandTicks: SeededSummary;
}>;

export type CompletionSimulation = Readonly<{
	completedTrials: number;
	timedOutTrials: number;
	completionActions: PercentileBand | null;
}>;

type AffinityVariant = CompletionSimulation &
	Readonly<{
		affinity: 'fire' | 'water';
		trials: typeof BALANCE_TRIALS_PER_MATCHUP;
	}>;

type AffinityMatchup = Readonly<{
	matchupId: string;
	level: BalanceLevel;
	attributeSpread: BalanceSpread;
	archetype: 'fire-caster' | 'water-martial';
	matchedAffinity: AffinityVariant;
	offAffinity: AffinityVariant;
	medianCompletionTimeRatioBasisPoints: number | null;
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
			minimumAllowedMedianRatioBasisPoints: 8_500;
			maximumAllowedMedianRatioBasisPoints: 11_500;
			minimumObservedMedianRatioBasisPoints: number | null;
			maximumObservedMedianRatioBasisPoints: number;
		}>;
		armour: Readonly<{
			status: 'passed' | 'failed';
			maximumAllowedExclusiveReductionBasisPoints: 7_500;
			maximumObservedReductionBasisPoints: number;
			monotonic: boolean;
			exhaustiveDomain: Readonly<{
				minimumArmourPoints: number;
				maximumArmourPoints: number;
				testedPointCount: number;
				curveHash: string;
			}>;
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
	if (BALANCE_SIMULATION_PROFILE_V1.arithmetic.integerDivisionRounding !== 'half-up') {
		throw new Error('Unsupported balance integer-division rounding policy');
	}
	return Number((numerator + denominator / 2n) / denominator);
}

function scaleByBasisPoints(value: number, basisPoints: number): number {
	return divideHalfUp(
		BigInt(value) * BigInt(basisPoints),
		BigInt(BALANCE_SIMULATION_PROFILE_V1.arithmetic.basisPointScale)
	);
}

function ratioBasisPoints(numerator: number, denominator: number): number {
	if (denominator <= 0) throw new Error('Balance ratio denominator must be positive');
	return divideHalfUp(
		BigInt(numerator) * BigInt(BALANCE_SIMULATION_PROFILE_V1.arithmetic.basisPointScale),
		BigInt(denominator)
	);
}

function nearestRank(values: readonly number[], fraction: number): number {
	if (values.length === 0) throw new Error('Cannot summarize an empty trial set');
	const ordered = [...values].sort((left, right) => left - right);
	return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)]!;
}

function percentileBand(values: readonly number[]): PercentileBand {
	if (BALANCE_SIMULATION_PROFILE_V1.percentileMethod !== 'nearest-rank') {
		throw new Error('Unsupported balance percentile method');
	}
	const fractions = BALANCE_SIMULATION_PROFILE_V1.percentileFractions;
	return {
		p10: nearestRank(values, fractions.p10),
		p50: nearestRank(values, fractions.p50),
		p90: nearestRank(values, fractions.p90)
	};
}

function seededSummary(values: readonly number[]): SeededSummary {
	const total = values.reduce((sum, value) => sum + value, 0);
	const precision = 10 ** BALANCE_SIMULATION_PROFILE_V1.arithmetic.summaryMeanDecimalPlaces;
	return {
		mean: Math.round((total / values.length) * precision) / precision,
		...percentileBand(values)
	};
}

function trialsPerSeed(): number {
	if (BALANCE_SIMULATION_PROFILE_V1.randomness.seedCohortAllocation !== 'equal') {
		throw new Error('Unsupported balance seed-cohort allocation policy');
	}
	const trials =
		BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup / BALANCE_SIMULATION_PROFILE_V1.seedSet.length;
	if (!Number.isInteger(trials)) {
		throw new Error('Balance trials must divide equally across the declared seed set');
	}
	return trials;
}

function randomStream(matchupId: string, seed: string): () => number {
	if (
		BALANCE_SIMULATION_PROFILE_V1.randomness.seedMaterial !==
		'canonical-object-of-randomness-version-matchup-id-and-seed'
	) {
		throw new Error('Unsupported balance seed-material policy');
	}
	const randomness = BALANCE_SIMULATION_PROFILE_V1.randomness;
	const digest = hashCanonical({
		randomnessVersion: randomness.version,
		matchupId,
		seed
	});
	let state = Number.parseInt(
		digest.slice(
			randomness.seedDigestHexStart,
			randomness.seedDigestHexStart + randomness.seedDigestHexLength
		),
		randomness.seedDigestRadix
	);
	const shifts = randomness.xorshift32;
	if (state === 0) state = shifts.zeroStateFallback;
	return () => {
		state ^= state << shifts.firstLeftShift;
		state ^= state >>> shifts.rightShift;
		state ^= state << shifts.secondLeftShift;
		return state >>> randomness.outputUnsignedRightShiftBits;
	};
}

function rollBasisPoints(random: () => number, chanceBasisPoints: number): boolean {
	const threshold = Math.min(
		BALANCE_SIMULATION_PROFILE_V1.arithmetic.basisPointScale,
		Math.max(0, chanceBasisPoints)
	);
	return random() % BALANCE_SIMULATION_PROFILE_V1.randomness.rollModulo < threshold;
}

function randomBasisPoints(random: () => number, minimum: number, maximum: number): number {
	return minimum + (random() % (maximum - minimum + 1));
}

function attributeValue(level: BalanceLevel, spread: BalanceSpread): number {
	return BALANCE_SIMULATION_PROFILE_V1.attributeValues[level][spread];
}

function peerAttributes(level: BalanceLevel, spread: BalanceSpread): CombatAttributes {
	if (
		BALANCE_SIMULATION_PROFILE_V1.attributeFixture !==
		'all-four-attributes-equal-to-level-spread-value'
	) {
		throw new Error('Unsupported peer attribute fixture');
	}
	const value = attributeValue(level, spread);
	return { might: value, vitality: value, agility: value, spirit: value };
}

function masteryAccuracy(masteryBand: MasteryBand): number {
	if (
		BALANCE_SIMULATION_PROFILE_V1.masteryResolution !==
		'greatest-minimum-mastery-at-or-below-fixture'
	) {
		throw new Error('Unsupported balance mastery-resolution policy');
	}
	if (BALANCE_SIMULATION_PROFILE_V1.sourceRecords.accuracySkillId !== BASIC_SWORD_STRIKE.skillId) {
		throw new Error('Balance accuracy skill no longer matches its declared source record');
	}
	const mastery = BALANCE_SIMULATION_PROFILE_V1.masteryFixtures[masteryBand];
	const step = [...BASIC_SWORD_STRIKE.masteryProgression]
		.sort((left, right) => right.minimumMastery - left.minimumMastery)
		.find((candidate) => candidate.minimumMastery <= mastery);
	if (!step) throw new Error(`Basic sword strike has no accuracy step for mastery ${mastery}`);
	return step.accuracyBasisPoints;
}

function agilityChanceShift(attackerAgility: number, defenderAgility: number): number {
	const hitContest = BALANCE_SIMULATION_PROFILE_V1.hitContest;
	const raw = (attackerAgility - defenderAgility) * hitContest.relativeAgilityBasisPointsPerPoint;
	const cap = hitContest.relativeAgilityCapBasisPoints;
	return Math.min(cap, Math.max(-cap, raw));
}

function peerHitContest(
	level: BalanceLevel,
	attackerAgility: number,
	defenderAgility: number,
	masteryBand: MasteryBand
): Readonly<{
	authoredAccuracyBasisPoints: number;
	attackerAccuracyBasisPoints: number;
	defenderEvasionBasisPoints: number;
	relativeAgilityBasisPoints: number;
	chanceBasisPoints: number;
}> {
	const hitContest = BALANCE_SIMULATION_PROFILE_V1.hitContest;
	if (
		hitContest.formula !==
			'clamp(authored-accuracy + attacker-level-accuracy - defender-level-evasion - defender-agility-evasion + relative-agility)' ||
		hitContest.levelSource !== 'peer-for-attacker-and-defender'
	) {
		throw new Error('Unsupported peer hit-contest formula');
	}
	const authoredAccuracyBasisPoints = masteryAccuracy(masteryBand);
	const attackerAccuracyBasisPoints = level * hitContest.attackerLevelAccuracyBasisPointsPerLevel;
	const defenderEvasionBasisPoints =
		level * hitContest.defenderLevelEvasionBasisPointsPerLevel +
		defenderAgility * hitContest.defenderAgilityEvasionBasisPointsPerPoint;
	const relativeAgilityBasisPoints = agilityChanceShift(attackerAgility, defenderAgility);
	return {
		authoredAccuracyBasisPoints,
		attackerAccuracyBasisPoints,
		defenderEvasionBasisPoints,
		relativeAgilityBasisPoints,
		chanceBasisPoints: Math.min(
			hitContest.maximumHitChanceBasisPoints,
			Math.max(
				hitContest.minimumHitChanceBasisPoints,
				authoredAccuracyBasisPoints +
					attackerAccuracyBasisPoints -
					defenderEvasionBasisPoints +
					relativeAgilityBasisPoints
			)
		)
	};
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
	const cohortTrials = trialsPerSeed();
	for (const seed of BALANCE_SIMULATION_PROFILE_V1.seedSet) {
		const random = randomStream(matchupId, seed);
		let cohortHits = 0;
		for (let trial = 0; trial < cohortTrials; trial += 1) {
			if (rollBasisPoints(random, chanceBasisPoints)) cohortHits += 1;
		}
		hits += cohortHits;
		cohortRates.push(ratioBasisPoints(cohortHits, cohortTrials));
	}
	return {
		observedBasisPoints: ratioBasisPoints(hits, BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup),
		seedBand: percentileBand(cohortRates)
	};
}

function buildAccuracyMatchups(): AccuracyMatchup[] {
	return BALANCE_SIMULATION_PROFILE_V1.benchmarkLevels.flatMap((level) =>
		BALANCE_SIMULATION_PROFILE_V1.attributeSpreads.flatMap((attributeSpread) =>
			BALANCE_SIMULATION_PROFILE_V1.fixtureMatrix.accuracyMasteryBands.map((masteryBand) => {
				if (
					BALANCE_SIMULATION_PROFILE_V1.accuracyFixture.attackerAgilitySource !== 'peer' ||
					BALANCE_SIMULATION_PROFILE_V1.accuracyFixture.defenderAgilitySource !== 'peer'
				) {
					throw new Error('Unsupported accuracy peer source');
				}
				const matchupId = `accuracy-l${level}-${attributeSpread}-${masteryBand}`;
				const agility = attributeValue(level, attributeSpread);
				const contest = peerHitContest(level, agility, agility, masteryBand);
				const result = simulateHitRate(matchupId, contest.chanceBasisPoints);
				return {
					matchupId,
					level,
					attributeSpread,
					masteryBand,
					trials: BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup,
					authoredAccuracyBasisPoints: contest.authoredAccuracyBasisPoints,
					attackerAccuracyBasisPoints: contest.attackerAccuracyBasisPoints,
					defenderEvasionBasisPoints: contest.defenderEvasionBasisPoints,
					relativeAgilityBasisPoints: contest.relativeAgilityBasisPoints,
					contestChanceBasisPoints: contest.chanceBasisPoints,
					observedHitRateBasisPoints: result.observedBasisPoints,
					seedCohortHitRateBasisPoints: result.seedBand
				};
			})
		)
	);
}

function buildAgilityMatchups(): AgilityMatchup[] {
	const fixture = BALANCE_SIMULATION_PROFILE_V1.relativeAgilityFixture;
	return BALANCE_SIMULATION_PROFILE_V1.benchmarkLevels.flatMap((level) =>
		BALANCE_SIMULATION_PROFILE_V1.attributeSpreads.flatMap((attributeSpread) => {
			const peerAgility = attributeValue(level, attributeSpread);
			return fixture.directions.map((direction) => {
				if (
					fixture.baselineAttackerAgilitySource !== 'peer' ||
					fixture.defenderAgilitySource !== 'peer'
				) {
					throw new Error('Unsupported relative-Agility peer source');
				}
				const attackerAgility = fixture.endpointAttackerAgility[direction];
				const matchupId = `agility-l${level}-${attributeSpread}-${direction}`;
				const baselineContest = peerHitContest(
					level,
					peerAgility,
					peerAgility,
					fixture.masteryBand
				);
				const adjustedContest = peerHitContest(
					level,
					attackerAgility,
					peerAgility,
					fixture.masteryBand
				);
				const effectiveChanceShiftBasisPoints =
					adjustedContest.chanceBasisPoints - baselineContest.chanceBasisPoints;
				if (fixture.randomStreamCoupling !== 'paired-baseline-and-adjusted') {
					throw new Error('Unsupported relative-Agility random-stream coupling');
				}
				const pairedStreamId = `${matchupId}-paired`;
				const baseline = simulateHitRate(pairedStreamId, baselineContest.chanceBasisPoints);
				const adjusted = simulateHitRate(pairedStreamId, adjustedContest.chanceBasisPoints);
				return {
					matchupId,
					level,
					attributeSpread,
					direction,
					peerAgility,
					attackerAgility,
					trials: BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup,
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
	const affinityApplication = BALANCE_SIMULATION_PROFILE_V1.affinityApplication;
	if (!matchedAffinity) {
		if (affinityApplication.offAffinityAdjustment !== 'none') {
			throw new Error('Unsupported off-affinity adjustment policy');
		}
		return scaled;
	}
	if (
		affinityApplication.matchedAdjustmentScope !== 'attribute-contribution-only' ||
		affinityApplication.nudgeSource !== 'combat-rules-affinity-contribution-cap'
	) {
		throw new Error('Unsupported matched-affinity adjustment policy');
	}
	const attributeContribution = scaled - baseMagnitude;
	return (
		baseMagnitude +
		scaleByBasisPoints(
			attributeContribution,
			BALANCE_SIMULATION_PROFILE_V1.arithmetic.basisPointScale +
				COMBAT_RULES_V1.affinity.contributionNudgeCapBasisPoints
		)
	);
}

function damageAfterMitigation(
	damage: number,
	armourBasisPoints: number,
	resistanceBasisPoints: number
): number {
	let mitigated = damage;
	for (const mitigation of BALANCE_SIMULATION_PROFILE_V1.peerDamageFixture.mitigationOrder) {
		mitigated = scaleByBasisPoints(
			mitigated,
			BALANCE_SIMULATION_PROFILE_V1.arithmetic.basisPointScale -
				(mitigation === 'armour' ? armourBasisPoints : resistanceBasisPoints)
		);
	}
	return Math.max(
		BALANCE_SIMULATION_PROFILE_V1.peerDamageFixture.minimumSuccessfulDamage,
		mitigated
	);
}

function simulatePeerDamage(input: {
	matchupId: string;
	attributes: CombatAttributes;
	level: BalanceLevel;
	armourPoints: number;
	includeHeavyArmourResistance: boolean;
}): SeededSummary {
	const values: number[] = [];
	const profile = createPeerDamageProfile(input);
	const cohortTrials = trialsPerSeed();
	for (const seed of BALANCE_SIMULATION_PROFILE_V1.seedSet) {
		const random = randomStream(input.matchupId, seed);
		for (let trial = 0; trial < cohortTrials; trial += 1) {
			values.push(peerDamageForAttack(random, profile));
		}
	}
	return seededSummary(values);
}

type PeerDamageProfile = Readonly<{
	accuracyBasisPoints: number;
	scaledMagnitude: number;
	armourBasisPoints: number;
	resistanceBasisPoints: number;
}>;

function createPeerDamageProfile(input: {
	attributes: CombatAttributes;
	level: BalanceLevel;
	armourPoints: number;
	includeHeavyArmourResistance: boolean;
}): PeerDamageProfile {
	const fixture = BALANCE_SIMULATION_PROFILE_V1.peerDamageFixture;
	if (
		fixture.damageModel !== 'attribute-scaled-level-base-magnitude' ||
		fixture.attackerAgilitySource !== 'peer' ||
		fixture.defenderAgilitySource !== 'peer' ||
		fixture.resistancePolicy !== 'apply-authored-armour-receipts-when-enabled'
	) {
		throw new Error('Unsupported peer-damage fixture policy');
	}
	if (
		BALANCE_SIMULATION_PROFILE_V1.sourceRecords.peerDamageTagSkillId !== BASIC_SWORD_STRIKE.skillId
	) {
		throw new Error('Balance peer-damage tags no longer match their declared source record');
	}
	const accuracy = peerHitContest(
		input.level,
		input.attributes.agility,
		input.attributes.agility,
		fixture.masteryBand
	).chanceBasisPoints;
	const baseMagnitude = BALANCE_SIMULATION_PROFILE_V1.baseMagnitudeByLevel[input.level];
	const scaledMagnitude = affinityAdjustedMagnitude(
		baseMagnitude,
		fixture.channel,
		input.attributes,
		fixture.matchedAffinity
	);
	const armourBasisPoints = armourReduction(
		input.armourPoints,
		fixture.penetrationPoints,
		COMBAT_RULES_V1
	);
	const resistanceBasisPoints = input.includeHeavyArmourResistance
		? namedResistanceReduction(fixture.damageTags, heavyArmourResistanceReceipts, COMBAT_RULES_V1)
		: 0;
	return {
		accuracyBasisPoints: accuracy,
		scaledMagnitude,
		armourBasisPoints,
		resistanceBasisPoints
	};
}

function peerDamageForAttack(random: () => number, profile: PeerDamageProfile): number {
	const fixture = BALANCE_SIMULATION_PROFILE_V1.peerDamageFixture;
	if (!rollBasisPoints(random, profile.accuracyBasisPoints)) return fixture.missDamage;
	if (fixture.damageVarianceBasisPoints.endpoints !== 'inclusive') {
		throw new Error('Unsupported peer-damage variance endpoint policy');
	}
	const varied = scaleByBasisPoints(
		profile.scaledMagnitude,
		randomBasisPoints(
			random,
			fixture.damageVarianceBasisPoints.minimum,
			fixture.damageVarianceBasisPoints.maximum
		)
	);
	return damageAfterMitigation(varied, profile.armourBasisPoints, profile.resistanceBasisPoints);
}

function simulateSustainedTimeline(input: {
	matchupId: string;
	attributes: CombatAttributes;
	level: BalanceLevel;
	armourPoints: number;
	includeHeavyArmourResistance: boolean;
}): Pick<
	RegenerationMatchup,
	| 'completedTrials'
	| 'timedOutTrials'
	| 'damageTotal'
	| 'regenerationTotal'
	| 'damagePerThousandTicks'
	| 'regenerationPerThousandTicks'
> {
	const timeline = BALANCE_SIMULATION_PROFILE_V1.sustainedTimeline;
	if (
		timeline.damageSource !== 'peer-damage-fixture' ||
		timeline.recoveryAccounting !== 'uncapped-throughput'
	) {
		throw new Error('Unsupported sustained-regeneration accounting policy');
	}
	const damageProfile = createPeerDamageProfile(input);
	const regenerationByTicksSinceDamage = Array.from(
		{
			length:
				timeline.initialTicksSinceDamage +
				timeline.horizonTicks * timeline.damageClockAdvancePerTick +
				1
		},
		(_unused, ticksSinceDamage) =>
			healthRegeneration(
				input.attributes.vitality,
				{
					...timeline.regenerationContext,
					ticksSinceDamage
				},
				COMBAT_RULES_V1
			)
	);
	const damageTotals: number[] = [];
	const regenerationTotals: number[] = [];
	const cohortTrials = trialsPerSeed();
	for (const seed of BALANCE_SIMULATION_PROFILE_V1.seedSet) {
		const random = randomStream(input.matchupId, seed);
		for (let trial = 0; trial < cohortTrials; trial += 1) {
			let damageTotal = 0;
			let regenerationTotal = 0;
			let ticksSinceDamage = timeline.initialTicksSinceDamage;
			const horizonMilliseconds = timeline.horizonTicks * timeline.tickDurationMilliseconds;
			for (
				let elapsedMilliseconds = timeline.tickIndexOrigin * timeline.tickDurationMilliseconds;
				elapsedMilliseconds < horizonMilliseconds;
				elapsedMilliseconds += timeline.tickIndexIncrement * timeline.tickDurationMilliseconds
			) {
				const tick = elapsedMilliseconds / timeline.tickDurationMilliseconds;
				for (const phase of timeline.resolutionOrder) {
					if (phase === 'attack') {
						if (
							tick >= timeline.firstAttackTick &&
							(tick - timeline.firstAttackTick) % timeline.attackCadenceTicks === 0
						) {
							const damage = peerDamageForAttack(random, damageProfile);
							damageTotal += damage;
							const resetTrigger: string = timeline.damageClockResetPolicy.trigger;
							if (
								resetTrigger === 'attack-attempt' ||
								(resetTrigger === 'positive-damage' && damage > 0)
							) {
								ticksSinceDamage = timeline.damageClockResetPolicy.value;
							}
						}
					} else if (phase === 'regeneration') {
						regenerationTotal += regenerationByTicksSinceDamage[ticksSinceDamage]!;
					} else if (phase === 'advance-damage-clock') {
						ticksSinceDamage += timeline.damageClockAdvancePerTick;
					} else {
						throw new Error(`Unsupported sustained-timeline phase: ${String(phase)}`);
					}
				}
			}
			damageTotals.push(damageTotal);
			regenerationTotals.push(regenerationTotal);
		}
	}
	const perThousandTicks = (values: readonly number[]) =>
		values.map((value) =>
			divideHalfUp(
				BigInt(value) *
					BigInt(timeline.throughputNormalizationTicks) *
					BigInt(timeline.tickDurationMilliseconds),
				BigInt(timeline.horizonTicks) * BigInt(timeline.tickDurationMilliseconds)
			)
		);
	return {
		completedTrials: damageTotals.length,
		timedOutTrials: 0,
		damageTotal: seededSummary(damageTotals),
		regenerationTotal: seededSummary(regenerationTotals),
		damagePerThousandTicks: seededSummary(perThousandTicks(damageTotals)),
		regenerationPerThousandTicks: seededSummary(perThousandTicks(regenerationTotals))
	};
}

function buildRegenerationMatchups(): RegenerationMatchup[] {
	return BALANCE_SIMULATION_PROFILE_V1.benchmarkLevels.flatMap((level) =>
		BALANCE_SIMULATION_PROFILE_V1.attributeSpreads.flatMap((attributeSpread) =>
			BALANCE_SIMULATION_PROFILE_V1.fixtureMatrix.armourStates.map((armourState) => {
				const attributes = peerAttributes(level, attributeSpread);
				const matchupId = `regeneration-l${level}-${attributeSpread}-${armourState}`;
				const armourFixture = BALANCE_SIMULATION_PROFILE_V1.armourFixtures[armourState];
				const timeline = simulateSustainedTimeline({
					matchupId,
					attributes,
					level,
					armourPoints: armourFixture.armourPoints,
					includeHeavyArmourResistance: armourFixture.includeHeavyArmourResistance
				});
				return {
					matchupId,
					level,
					attributeSpread,
					armourState,
					trials: BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup,
					...timeline
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
}): CompletionSimulation {
	const fixture = BALANCE_SIMULATION_PROFILE_V1.completionFixture;
	if (
		fixture.damageModel !== 'attribute-scaled-level-base-magnitude-with-affinity-candidate' ||
		fixture.attackerAgilitySource !== 'peer' ||
		fixture.defenderAgilitySource !== 'peer' ||
		fixture.targetHealthSource !== 'maximum-health-from-peer-vitality' ||
		fixture.defencePolicy !== 'no-armour-or-named-resistance' ||
		!fixture.missConsumesAction
	) {
		throw new Error('Unsupported affinity-completion fixture policy');
	}
	const values: number[] = [];
	let timedOutTrials = 0;
	const hitChance = peerHitContest(
		input.level,
		input.attributes.agility,
		input.attributes.agility,
		fixture.masteryBand
	).chanceBasisPoints;
	const targetHealth = maximumHealth(input.attributes.vitality, COMBAT_RULES_V1);
	const baseMagnitude = BALANCE_SIMULATION_PROFILE_V1.baseMagnitudeByLevel[input.level];
	const damage = affinityAdjustedMagnitude(
		baseMagnitude,
		input.channel,
		input.attributes,
		input.matchedAffinity
	);
	if (fixture.damageVarianceBasisPoints.endpoints !== 'inclusive') {
		throw new Error('Unsupported affinity-completion variance endpoint policy');
	}
	const cohortTrials = trialsPerSeed();
	for (const seed of BALANCE_SIMULATION_PROFILE_V1.seedSet) {
		const random = randomStream(input.matchupId, seed);
		for (let trial = 0; trial < cohortTrials; trial += 1) {
			let dealt = 0;
			let actions = 0;
			while (dealt < targetHealth && actions < fixture.maximumActions) {
				actions += 1;
				if (!rollBasisPoints(random, hitChance)) continue;
				dealt += Math.max(
					fixture.minimumSuccessfulDamage,
					scaleByBasisPoints(
						damage,
						randomBasisPoints(
							random,
							fixture.damageVarianceBasisPoints.minimum,
							fixture.damageVarianceBasisPoints.maximum
						)
					)
				);
			}
			if (dealt < targetHealth) timedOutTrials += 1;
			else values.push(actions);
		}
	}
	return {
		completedTrials: values.length,
		timedOutTrials,
		completionActions: timedOutTrials === 0 ? percentileBand(values) : null
	};
}

export function evaluateAffinityCompletionPair(
	matched: CompletionSimulation,
	offAffinity: CompletionSimulation
): Readonly<{ status: 'passed' | 'failed'; medianRatioBasisPoints: number | null }> {
	if (
		BALANCE_SIMULATION_PROFILE_V1.promotionGates.offAffinityStatistic !==
		'p50-completion-actions-off-divided-by-matched'
	) {
		throw new Error('Unsupported off-affinity completion statistic');
	}
	if (
		matched.timedOutTrials > 0 ||
		offAffinity.timedOutTrials > 0 ||
		matched.completedTrials !== BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup ||
		offAffinity.completedTrials !== BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup ||
		matched.completionActions === null ||
		offAffinity.completionActions === null
	) {
		return { status: 'failed', medianRatioBasisPoints: null };
	}
	const medianRatioBasisPoints = ratioBasisPoints(
		offAffinity.completionActions.p50,
		matched.completionActions.p50
	);
	const gate = BALANCE_SIMULATION_PROFILE_V1.promotionGates.offAffinityMedianRatioBasisPoints;
	return {
		status: status(
			medianRatioBasisPoints >= gate.minimum && medianRatioBasisPoints <= gate.maximum
		),
		medianRatioBasisPoints
	};
}

function buildAffinityMatchups(): AffinityMatchup[] {
	const archetypes = Object.values(BALANCE_SIMULATION_PROFILE_V1.affinityArchetypes);
	const completionFixture = BALANCE_SIMULATION_PROFILE_V1.completionFixture;
	if (completionFixture.affinityVariantRandomStreamCoupling !== 'independent') {
		throw new Error('Unsupported affinity-variant random-stream coupling');
	}
	if (
		BALANCE_SIMULATION_PROFILE_V1.affinityApplication.matchingRule !==
		'associated-attribute-matches-channel-attribute'
	) {
		throw new Error('Unsupported affinity matching rule');
	}
	return BALANCE_SIMULATION_PROFILE_V1.benchmarkLevels.flatMap((level) =>
		BALANCE_SIMULATION_PROFILE_V1.attributeSpreads.flatMap((attributeSpread) => {
			const attributes = peerAttributes(level, attributeSpread);
			return archetypes.map(({ archetype, channel, matchedAffinity, offAffinity }) => {
				const matchupId = `affinity-l${level}-${attributeSpread}-${archetype}`;
				const channelAttribute =
					BALANCE_SIMULATION_PROFILE_V1.affinityApplication.channelAttributes[channel];
				const matchedAppliesNudge =
					BALANCE_SIMULATION_PROFILE_V1.affinityAssociations[matchedAffinity] === channelAttribute;
				const offAppliesNudge =
					BALANCE_SIMULATION_PROFILE_V1.affinityAssociations[offAffinity] === channelAttribute;
				if (!matchedAppliesNudge || offAppliesNudge) {
					throw new Error(`Affinity archetype ${archetype} does not define matched/off controls`);
				}
				const matchedCompletion = simulateCompletionActions({
					matchupId: `${matchupId}-${completionFixture.affinityVariantRandomStreamSuffixes.matched}`,
					attributes,
					level,
					channel,
					matchedAffinity: matchedAppliesNudge
				});
				const offCompletion = simulateCompletionActions({
					matchupId: `${matchupId}-${completionFixture.affinityVariantRandomStreamSuffixes.offAffinity}`,
					attributes,
					level,
					channel,
					matchedAffinity: offAppliesNudge
				});
				const evaluation = evaluateAffinityCompletionPair(matchedCompletion, offCompletion);
				return {
					matchupId,
					level,
					attributeSpread,
					archetype,
					matchedAffinity: {
						affinity: matchedAffinity,
						trials: BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup,
						...matchedCompletion
					},
					offAffinity: {
						affinity: offAffinity,
						trials: BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup,
						...offCompletion
					},
					medianCompletionTimeRatioBasisPoints: evaluation.medianRatioBasisPoints
				};
			});
		})
	);
}

function buildArmourMatchups(): ArmourMatchup[] {
	const reductionCurve = BALANCE_SIMULATION_PROFILE_V1.armourPointSeries.map((armour) => ({
		armour,
		reductionBasisPoints: armourReduction(
			armour,
			BALANCE_SIMULATION_PROFILE_V1.benchmarkDomain.armour.penetrationPoints,
			COMBAT_RULES_V1
		)
	}));
	return BALANCE_SIMULATION_PROFILE_V1.benchmarkLevels.flatMap((level) =>
		BALANCE_SIMULATION_PROFILE_V1.attributeSpreads.map((attributeSpread) => {
			const matchupId = `armour-l${level}-${attributeSpread}`;
			return {
				matchupId,
				level,
				attributeSpread,
				trials: BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup,
				reductionCurve,
				damageAfterArmour: simulatePeerDamage({
					matchupId,
					attributes: peerAttributes(level, attributeSpread),
					level,
					armourPoints: BALANCE_SIMULATION_PROFILE_V1.benchmarkDomain.armour.damageFixturePoints,
					includeHeavyArmourResistance:
						BALANCE_SIMULATION_PROFILE_V1.benchmarkDomain.armour
							.damageFixtureIncludesNamedResistance
				})
			};
		})
	);
}

function status(condition: boolean): 'passed' | 'failed' {
	return condition ? 'passed' : 'failed';
}

function auditArmourDomain(): Readonly<{
	minimumArmourPoints: number;
	maximumArmourPoints: number;
	testedPointCount: number;
	curveHash: string;
	monotonic: boolean;
	maximumReductionBasisPoints: number;
}> {
	const { minimumPoints, maximumPoints } = BALANCE_SIMULATION_PROFILE_V1.benchmarkDomain.armour;
	const reductions: number[] = [];
	const pointIncrement = BALANCE_SIMULATION_PROFILE_V1.benchmarkDomain.armour.pointIncrement;
	for (let armour = minimumPoints; armour <= maximumPoints; armour += pointIncrement) {
		reductions.push(
			armourReduction(
				armour,
				BALANCE_SIMULATION_PROFILE_V1.benchmarkDomain.armour.penetrationPoints,
				COMBAT_RULES_V1
			)
		);
	}
	return {
		minimumArmourPoints: minimumPoints,
		maximumArmourPoints: maximumPoints,
		testedPointCount: reductions.length,
		curveHash: hashCanonical(reductions),
		monotonic: reductions.every(
			(reduction, index) => index === 0 || reduction >= reductions[index - 1]!
		),
		maximumReductionBasisPoints: Math.max(...reductions)
	};
}

export async function createCombatBalanceEvidence(): Promise<CombatBalanceEvidence> {
	const verifiedCombatContent = await loadCombatContentBinding();
	const accuracy = buildAccuracyMatchups();
	const agility = buildAgilityMatchups();
	const regeneration = buildRegenerationMatchups();
	const affinity = buildAffinityMatchups();
	const armour = buildArmourMatchups();
	if (BALANCE_SIMULATION_PROFILE_V1.promotionGates.accuracyStatistic !== 'aggregate-hit-rate') {
		throw new Error('Unsupported accuracy promotion statistic');
	}
	const accuracyPassed = accuracy.every((matchup) => {
		const gate = ACCURACY_GATES[matchup.masteryBand];
		return (
			matchup.observedHitRateBasisPoints >= gate.minimumBasisPoints &&
			matchup.observedHitRateBasisPoints <= gate.maximumBasisPoints
		);
	});
	if (
		BALANCE_SIMULATION_PROFILE_V1.promotionGates.relativeAgilityEvaluation !==
		'maximum-of-formula-endpoints-and-observed-paired-shifts'
	) {
		throw new Error('Unsupported relative-Agility promotion evaluation');
	}
	const maximumAbsoluteChanceShiftBasisPoints = Math.max(
		Math.abs(
			agilityChanceShift(
				BALANCE_SIMULATION_PROFILE_V1.relativeAgilityFixture.endpointAttackerAgility.slower,
				BALANCE_SIMULATION_PROFILE_V1.relativeAgilityFixture.endpointAttackerAgility.faster
			)
		),
		Math.abs(
			agilityChanceShift(
				BALANCE_SIMULATION_PROFILE_V1.relativeAgilityFixture.endpointAttackerAgility.faster,
				BALANCE_SIMULATION_PROFILE_V1.relativeAgilityFixture.endpointAttackerAgility.slower
			)
		),
		...agility.map((matchup) => Math.abs(matchup.observedChanceShiftBasisPoints))
	);
	const regenerationComparison =
		BALANCE_SIMULATION_PROFILE_V1.promotionGates.regenerationComparison;
	if (
		regenerationComparison.completionPolicy !== 'all-trials-complete-with-zero-timeouts' ||
		regenerationComparison.totalBand !== 'p90-regeneration-strictly-below-p10-damage' ||
		regenerationComparison.normalizedThroughput !== 'mean-regeneration-strictly-below-mean-damage'
	) {
		throw new Error('Unsupported regeneration promotion comparison');
	}
	const regenerationPassed = regeneration.every(
		(matchup) =>
			matchup.completedTrials === BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup &&
			matchup.timedOutTrials === 0 &&
			matchup.regenerationTotal.p90 < matchup.damageTotal.p10 &&
			matchup.regenerationPerThousandTicks.mean < matchup.damagePerThousandTicks.mean
	);
	const maximumRegenerationToDamageRatioBasisPoints = Math.max(
		...regeneration.map((matchup) =>
			ratioBasisPoints(
				Math.round(
					matchup.regenerationPerThousandTicks.mean *
						10 ** BALANCE_SIMULATION_PROFILE_V1.arithmetic.summaryMeanDecimalPlaces
				),
				Math.max(
					regenerationComparison.zeroDamageRatioDenominatorScaledUnits,
					Math.round(
						matchup.damagePerThousandTicks.mean *
							10 ** BALANCE_SIMULATION_PROFILE_V1.arithmetic.summaryMeanDecimalPlaces
					)
				)
			)
		)
	);
	const completedAffinityRatios = affinity.flatMap((matchup) =>
		matchup.medianCompletionTimeRatioBasisPoints === null
			? []
			: [matchup.medianCompletionTimeRatioBasisPoints]
	);
	const affinityPassed =
		completedAffinityRatios.length === affinity.length &&
		affinity.every(
			(matchup) =>
				evaluateAffinityCompletionPair(matchup.matchedAffinity, matchup.offAffinity).status ===
				'passed'
		);
	const minimumObservedMedianRatioBasisPoints =
		completedAffinityRatios.length === 0 ? null : Math.min(...completedAffinityRatios);
	const maximumObservedMedianRatioBasisPoints =
		completedAffinityRatios.length === 0 ? 0 : Math.max(...completedAffinityRatios);
	const armourAudit = auditArmourDomain();
	const armourGate = BALANCE_SIMULATION_PROFILE_V1.promotionGates.armourReduction;
	const armourMonotonic = armourAudit.monotonic;
	const maximumObservedReductionBasisPoints = armourAudit.maximumReductionBasisPoints;
	const gates = {
		accuracy: {
			status: status(accuracyPassed),
			targetsBasisPoints: ACCURACY_GATES
		},
		relativeAgility: {
			status: status(
				maximumAbsoluteChanceShiftBasisPoints <=
					BALANCE_SIMULATION_PROFILE_V1.promotionGates.maximumRelativeAgilityShiftBasisPoints
			),
			maximumAllowedChanceShiftBasisPoints:
				BALANCE_SIMULATION_PROFILE_V1.promotionGates.maximumRelativeAgilityShiftBasisPoints,
			maximumAbsoluteChanceShiftBasisPoints
		},
		passiveCombatRegeneration: {
			status: status(regenerationPassed),
			maximumRegenerationToDamageRatioBasisPoints
		},
		offAffinityCompletion: {
			status: status(affinityPassed),
			minimumAllowedMedianRatioBasisPoints:
				BALANCE_SIMULATION_PROFILE_V1.promotionGates.offAffinityMedianRatioBasisPoints.minimum,
			maximumAllowedMedianRatioBasisPoints:
				BALANCE_SIMULATION_PROFILE_V1.promotionGates.offAffinityMedianRatioBasisPoints.maximum,
			minimumObservedMedianRatioBasisPoints,
			maximumObservedMedianRatioBasisPoints
		},
		armour: {
			status: status(
				(!armourGate.monotonicRequired || armourMonotonic) &&
					maximumObservedReductionBasisPoints <=
						COMBAT_RULES_V1.armour.maximumGeneralReductionBasisPoints &&
					maximumObservedReductionBasisPoints < armourGate.maximumExclusiveBasisPoints &&
					armourGate.authoritativeCeilingRequired
			),
			maximumAllowedExclusiveReductionBasisPoints: armourGate.maximumExclusiveBasisPoints,
			maximumObservedReductionBasisPoints,
			monotonic: armourMonotonic,
			exhaustiveDomain: {
				minimumArmourPoints: armourAudit.minimumArmourPoints,
				maximumArmourPoints: armourAudit.maximumArmourPoints,
				testedPointCount: armourAudit.testedPointCount,
				curveHash: armourAudit.curveHash
			}
		}
	};
	const allPassed = Object.values(gates).every((gate) => gate.status === 'passed');
	return deepFreeze({
		schemaVersion: 'combat-balance-evidence-v1',
		status: allPassed ? 'passed' : 'failed',
		bindings: {
			rules: {
				rulesVersion: COMBAT_RULES_V1.rulesVersion,
				rulesHash: hashCanonical(COMBAT_RULES_V1)
			},
			combatContent: {
				bindingVersion: verifiedCombatContent.bindingVersion,
				contentHash: verifiedCombatContent.contentHash,
				components: verifiedCombatContent.components
			}
		},
		simulation: {
			profile: BALANCE_SIMULATION_PROFILE_V1,
			profileHash: hashCanonical(BALANCE_SIMULATION_PROFILE_V1),
			trialsPerMatchup: BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup,
			percentileMethod: BALANCE_SIMULATION_PROFILE_V1.percentileMethod,
			seedSet: BALANCE_SIMULATION_PROFILE_V1.seedSet
		},
		fixtures: {
			levels: BALANCE_SIMULATION_PROFILE_V1.benchmarkLevels,
			attributeSpreads: BALANCE_SIMULATION_PROFILE_V1.attributeSpreads,
			masteryBands: BALANCE_SIMULATION_PROFILE_V1.fixtureMatrix.accuracyMasteryBands,
			armourStates: BALANCE_SIMULATION_PROFILE_V1.fixtureMatrix.armourStates,
			offAffinityArchetypes: Object.values(BALANCE_SIMULATION_PROFILE_V1.affinityArchetypes).map(
				(archetype) => archetype.archetype
			)
		},
		gates,
		matchups: { accuracy, agility, regeneration, affinity, armour }
	});
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
	const evidence = await createCombatBalanceEvidence();
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
		`combat-balance-v1 ${evidence.status}: ${BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup} trials per matchup; ${evidence.bindings.rules.rulesHash}\n`
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await runCli();
}

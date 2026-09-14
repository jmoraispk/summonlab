import { readFile, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

import {
	BASIC_SWORD_STRIKE,
	AGENT_READINESS_RULES_V2,
	COMBAT_CONTENT_BINDING,
	COMBAT_EQUIPMENT_PROFILES_BY_ID,
	COMBAT_RULES_V1,
	loadAgentReadinessContentBindingV2,
	loadCombatContentBinding
} from '../packages/content/src/index.js';
import {
	generateSummonableCharacterDraft,
	recipeFromSeed
} from '../packages/characters/src/index.js';
import { ReadinessCombatStateV1Schema } from '../packages/contracts/src/index.js';
import type {
	ActorDecisionView,
	CombatActionIntent,
	CombatAdvance,
	CombatChoiceBatchV1,
	CombatLegalAction,
	EngineGameStateV26,
	ReadinessCombatStateV1
} from '../packages/contracts/src/index.js';
import {
	AGENT_READINESS_REPLAY_VECTOR_V26,
	replayAgentReadinessVectorV26
} from '../packages/engine/src/compatibility/replay-vectors.js';
import {
	applyCombatChoiceBatch,
	advanceUntilDecision,
	combatChoiceBatchHash,
	createBootstrapEngine,
	deterministicUuid
} from '../packages/engine/src/index.js';
import {
	armourReduction,
	attributeScaledMagnitude,
	healthRegeneration,
	maximumHealth,
	namedResistanceReduction
} from '../packages/engine/src/domains/combat/capability.js';
import { createMissionReadinessState } from '../packages/engine/src/domains/mission/readiness-runtime.js';
import { resistanceGrantReceiptsFromAuthoredSources } from '../packages/engine/src/domains/combat/resistance-grants.js';
import { hashCanonical } from '../packages/engine/src/hash.js';
import { buildDeterministicCombatFallbackIntent } from '../packages/policies/src/index.js';

export const BALANCE_LEVELS = [10, 40, 70, 99] as const;
export const BALANCE_SPREADS = ['low', 'mid', 'high'] as const;
export const BALANCE_TRIALS_PER_MATCHUP = 10_000 as const;
export const READINESS_TRIALS_PER_BENCHMARK = 10_000 as const;
export const READINESS_ENCOUNTERS_PER_ARCHETYPE = 100 as const;

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
type BalanceRandomCoordinate =
	| Readonly<{
			streamKind: 'accuracy';
			values: Readonly<{
				level: BalanceLevel;
				attributeSpread: BalanceSpread;
				masteryBand: MasteryBand;
			}>;
	  }>
	| Readonly<{
			streamKind: 'relativeAgility';
			values: Readonly<{
				level: BalanceLevel;
				attributeSpread: BalanceSpread;
				direction: 'faster' | 'slower';
			}>;
	  }>
	| Readonly<{
			streamKind: 'regeneration';
			values: Readonly<{
				level: BalanceLevel;
				attributeSpread: BalanceSpread;
				armourState: ArmourState;
			}>;
	  }>
	| Readonly<{
			streamKind: 'affinity';
			values: Readonly<{
				level: BalanceLevel;
				attributeSpread: BalanceSpread;
				archetype: 'fire-caster' | 'water-martial';
				variant: 'matched' | 'off-affinity';
			}>;
	  }>
	| Readonly<{
			streamKind: 'armour';
			values: Readonly<{ level: BalanceLevel; attributeSpread: BalanceSpread }>;
	  }>;

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
		streamNamespace: 'combat-balance-candidate-v1',
		seedMaterial:
			'canonical-object-of-namespace-randomness-version-stream-kind-coordinate-and-seed',
		coordinateDerivation: {
			encoding: 'declared-ordered-field-tuples',
			fieldsByStreamKind: {
				accuracy: ['level', 'attributeSpread', 'masteryBand'],
				relativeAgility: ['level', 'attributeSpread', 'direction'],
				regeneration: ['level', 'attributeSpread', 'armourState'],
				affinity: ['level', 'attributeSpread', 'archetype', 'variant'],
				armour: ['level', 'attributeSpread']
			}
		},
		pairedStreamDerivation: {
			relativeAgility: {
				pairedComparisons: ['baseline', 'adjusted'],
				coordinatePolicy: 'omit-comparison-role',
				replayPolicy: 'restart-identical-stream'
			}
		},
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
		affinityVariantCoordinates: { matched: 'matched', offAffinity: 'off-affinity' }
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
		fire: 'strength',
		earth: 'vitality',
		wind: 'agility',
		water: 'magic'
	},
	affinityApplication: {
		matchingRule: 'associated-attribute-matches-channel-attribute',
		channelAttributes: { physical: 'strength', magical: 'magic' },
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

function orderedRandomCoordinate(
	coordinate: BalanceRandomCoordinate
): readonly (readonly [string, string | number])[] {
	const derivation = BALANCE_SIMULATION_PROFILE_V1.randomness.coordinateDerivation;
	if (derivation.encoding !== 'declared-ordered-field-tuples') {
		throw new Error('Unsupported balance random-coordinate encoding');
	}
	const declaredFields = derivation.fieldsByStreamKind[coordinate.streamKind];
	const values = coordinate.values as Readonly<Record<string, string | number>>;
	const actualFields = Object.keys(values).sort();
	const expectedFields = [...declaredFields].sort();
	if (
		actualFields.length !== expectedFields.length ||
		actualFields.some((field, index) => field !== expectedFields[index])
	) {
		throw new Error(`Invalid ${coordinate.streamKind} random-coordinate fields`);
	}
	return declaredFields.map((field) => [field, values[field]!] as const);
}

function randomStream(coordinate: BalanceRandomCoordinate, seed: string): () => number {
	if (
		BALANCE_SIMULATION_PROFILE_V1.randomness.seedMaterial !==
		'canonical-object-of-namespace-randomness-version-stream-kind-coordinate-and-seed'
	) {
		throw new Error('Unsupported balance seed-material policy');
	}
	const randomness = BALANCE_SIMULATION_PROFILE_V1.randomness;
	const digest = hashCanonical({
		streamNamespace: randomness.streamNamespace,
		randomnessVersion: randomness.version,
		streamKind: coordinate.streamKind,
		coordinate: orderedRandomCoordinate(coordinate),
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
	return { strength: value, agility: value, vitality: value, magic: value };
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
	randomCoordinate: BalanceRandomCoordinate,
	chanceBasisPoints: number
): {
	observedBasisPoints: number;
	seedBand: PercentileBand;
} {
	let hits = 0;
	const cohortRates: number[] = [];
	const cohortTrials = trialsPerSeed();
	for (const seed of BALANCE_SIMULATION_PROFILE_V1.seedSet) {
		const random = randomStream(randomCoordinate, seed);
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
				const result = simulateHitRate(
					{
						streamKind: 'accuracy',
						values: { level, attributeSpread, masteryBand }
					},
					contest.chanceBasisPoints
				);
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
				const pairing =
					BALANCE_SIMULATION_PROFILE_V1.randomness.pairedStreamDerivation.relativeAgility;
				if (
					fixture.randomStreamCoupling !== 'paired-baseline-and-adjusted' ||
					pairing.coordinatePolicy !== 'omit-comparison-role' ||
					pairing.replayPolicy !== 'restart-identical-stream' ||
					pairing.pairedComparisons[0] !== 'baseline' ||
					pairing.pairedComparisons[1] !== 'adjusted'
				) {
					throw new Error('Unsupported relative-Agility random-stream coupling');
				}
				const pairedCoordinate = {
					streamKind: 'relativeAgility',
					values: { level, attributeSpread, direction }
				} as const satisfies BalanceRandomCoordinate;
				const baseline = simulateHitRate(pairedCoordinate, baselineContest.chanceBasisPoints);
				const adjusted = simulateHitRate(pairedCoordinate, adjustedContest.chanceBasisPoints);
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
	randomCoordinate: BalanceRandomCoordinate;
	attributes: CombatAttributes;
	level: BalanceLevel;
	armourPoints: number;
	includeHeavyArmourResistance: boolean;
}): SeededSummary {
	const values: number[] = [];
	const profile = createPeerDamageProfile(input);
	const cohortTrials = trialsPerSeed();
	for (const seed of BALANCE_SIMULATION_PROFILE_V1.seedSet) {
		const random = randomStream(input.randomCoordinate, seed);
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
	randomCoordinate: BalanceRandomCoordinate;
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
		const random = randomStream(input.randomCoordinate, seed);
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
					randomCoordinate: {
						streamKind: 'regeneration',
						values: { level, attributeSpread, armourState }
					},
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
	randomCoordinate: BalanceRandomCoordinate;
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
		const random = randomStream(input.randomCoordinate, seed);
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
					randomCoordinate: {
						streamKind: 'affinity',
						values: {
							level,
							attributeSpread,
							archetype,
							variant: completionFixture.affinityVariantCoordinates.matched
						}
					},
					attributes,
					level,
					channel,
					matchedAffinity: matchedAppliesNudge
				});
				const offCompletion = simulateCompletionActions({
					randomCoordinate: {
						streamKind: 'affinity',
						values: {
							level,
							attributeSpread,
							archetype,
							variant: completionFixture.affinityVariantCoordinates.offAffinity
						}
					},
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
					randomCoordinate: {
						streamKind: 'armour',
						values: { level, attributeSpread }
					},
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

type ReadinessEvidenceOptions = Readonly<{
	trialsPerBenchmark?: number;
	encountersPerArchetype?: number;
	workerCount?: number;
}>;

const READINESS_ARCHETYPES = BALANCE_LEVELS.map((level) => ({
	archetypeId: `peer-level-${level}`,
	level
}));

const READINESS_SIMULATION_PROFILE_V1 = deepFreeze({
	profileVersion: 'agent-readiness-qualification-profile-v1',
	percentileMethod: 'nearest-rank',
	seedDerivation: {
		namespace: 'agent-readiness-benchmark-v1',
		encoding: 'namespace:zero-padded-trial-ordinal',
		ordinalWidth: 5
	},
	benchmarkWindowFixture: {
		previousDecisionTick: 50,
		pulseDecisionTick: 100,
		damagedAtTick: 50
	},
	missionId: 'tower-floor-01',
	actorPolicy: {
		hero: 'first-legal-attack-against-first-active-authored-target',
		master: 'first-legal-guard',
		monster: 'first-legal-attack-against-first-active-authored-target'
	},
	levelFixture: {
		attributes: 'all-four-at-level-except-minimum-equipped-starter-load',
		minimumStarterSwordStrength: COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-bronze-sword']!.load
	},
	encounterFixture: {
		scope: 'smallest-authored-complete-encounter',
		party: 'authored-master-and-one-levelled-hero',
		opponent: 'lowest-health-policy-authored-tower-floor-01-enemy',
		pruning: 'remove-other-authored-enemies-before-the-first-readiness-window'
	},
	providerFailurePolicy: 'first-frozen-legal-action-without-provider-lifecycle',
	productionPrimitives: [
		'createMissionReadinessState',
		'advanceUntilDecision',
		'combatChoiceBatchHash',
		'applyCombatChoiceBatch'
	],
	encounterBudgets: {
		maximumTicks: COMBAT_RULES_V1.readiness.safety.maximumTicksAdvanced,
		maximumEvents: COMBAT_RULES_V1.readiness.safety.maximumEventsEmitted
	}
});

function readinessNearestRank(values: readonly number[], percentile: number): number {
	if (values.length === 0) throw new Error('A readiness percentile requires at least one value');
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)]!;
}

function readinessDistribution(values: readonly number[]) {
	return {
		p50: readinessNearestRank(values, 0.5),
		p95: readinessNearestRank(values, 0.95)
	};
}

function basisPointRate(count: number, trials: number): number {
	return Math.round((count * BASIS_POINTS) / trials);
}

function selectionTarget(
	view: ActorDecisionView,
	action: CombatLegalAction,
	preferActiveEnemy: boolean
): CombatActionIntent['target'] {
	const contract = action.targetContract;
	if (contract.kind === 'self') return { kind: 'self' };
	if (contract.kind === 'tile') return { kind: 'tile', position: contract.allowedPositions[0]! };
	if (contract.kind === 'entity-relative-position') {
		return {
			kind: 'entity-relative-position',
			combatantId: contract.allowedCombatantIds[0]!,
			relation: contract.allowedRelations[0]!
		};
	}
	const activeTarget = preferActiveEnemy
		? contract.allowedCombatantIds.find((combatantId) => {
				const candidate = view.visibleCombatants.find(
					(combatant) => combatant.combatantId === combatantId
				);
				return candidate?.active === true && candidate.downed === false;
			})
		: undefined;
	return { kind: 'entity', combatantId: activeTarget ?? contract.allowedCombatantIds[0]! };
}

function readinessBatch(
	state: ReadinessCombatStateV1,
	key: string,
	policy: 'encounter' | 'guard',
	decisionWindow?: Extract<CombatAdvance, { kind: 'decision-window' }>
): CombatChoiceBatchV1 {
	const advanced = decisionWindow ?? advanceUntilDecision(state, COMBAT_RULES_V1);
	if (advanced.kind !== 'decision-window') throw new Error('Readiness benchmark expected a window');
	const choices = advanced.views.map((view): CombatActionIntent => {
		const preferredKind =
			policy === 'encounter' && view.self.combatantKind !== 'master' ? 'attack' : 'guard';
		const action =
			view.legalActions.find((candidate) => candidate.actionKind === preferredKind) ??
			view.legalActions[0]!;
		return {
			windowId: advanced.snapshot.windowId,
			attemptId: advanced.snapshot.attemptId,
			tick: advanced.snapshot.tick,
			actorId: view.actorId,
			snapshotHash: advanced.snapshot.snapshotHash,
			actorViewHash: view.actorViewHash,
			legalActionSetHash: view.legalActionSetHash,
			actionId: action.actionId,
			actionInstanceId: action.actionInstanceId,
			actionKind: action.actionKind,
			skillId: action.skillId,
			target: selectionTarget(view, action, preferredKind === 'attack'),
			fallbackId: action.fallbackOptions[0]?.fallbackId ?? null
		};
	});
	const unsigned = {
		batchVersion: 'combat-choice-batch-v1' as const,
		batchId: deterministicUuid(`${advanced.snapshot.windowId}:${key}:batch`),
		windowId: advanced.snapshot.windowId,
		attemptId: advanced.snapshot.attemptId,
		tick: advanced.snapshot.tick,
		snapshotHash: advanced.snapshot.snapshotHash,
		choices
	};
	return { ...unsigned, batchHash: combatChoiceBatchHash(unsigned) };
}

async function readinessEngineAtLevel(level: BalanceLevel): Promise<
	Readonly<{
		state: EngineGameStateV26;
		heroId: string;
	}>
> {
	const draft = await generateSummonableCharacterDraft(
		recipeFromSeed(`agent-readiness-evidence-level-${level}`),
		{ capabilityEntropy: hashCanonical({ purpose: 'agent-readiness-evidence', level }) }
	);
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid(`agent-readiness-evidence-level-${level}:run`),
		seed: `agent-readiness-evidence-level-${level}:engine`,
		draft,
		combatMode: 'agent-readiness-v1',
		developmentEngineVersion: 26
	}).snapshot.state;
	if (bootstrap.schemaVersion !== 26) throw new Error('Readiness evidence requires engine-v26');
	const heroId = draft.manifest.characterId;
	const hero = bootstrap.heroes[heroId]!;
	const maxHealth = maximumHealth(level, COMBAT_RULES_V1);
	const attributes = {
		strength: Math.max(
			level,
			READINESS_SIMULATION_PROFILE_V1.levelFixture.minimumStarterSwordStrength
		),
		agility: level,
		vitality: level,
		magic: level
	};
	return {
		heroId,
		state: {
			...bootstrap,
			heroes: {
				...bootstrap.heroes,
				[heroId]: {
					...hero,
					health: maxHealth,
					maxHealth,
					capabilityProfile: { ...hero.capabilityProfile, attributes },
					progression: { ...hero.progression, level }
				}
			}
		}
	};
}

function missionState(
	fixture: Readonly<{ state: EngineGameStateV26; heroId: string }>,
	attemptKey: string
): ReadinessCombatStateV1 {
	const authored = createMissionReadinessState(
		fixture.state,
		deterministicUuid(`${attemptKey}:attempt`),
		[fixture.heroId],
		READINESS_SIMULATION_PROFILE_V1.missionId
	);
	const selectedEnemy = Object.values(authored.combatants)
		.filter((combatant) => combatant.teamId === 'enemy')
		.sort(
			(left, right) =>
				left.resources.health.maximum - right.resources.health.maximum ||
				left.combatantId.localeCompare(right.combatantId)
		)[0]!;
	const retainedIds = new Set([
		fixture.state.master.masterId,
		fixture.heroId,
		selectedEnemy.combatantId
	]);
	return {
		...authored,
		combatants: Object.fromEntries(
			Object.entries(authored.combatants).filter(([combatantId]) => retainedIds.has(combatantId))
		),
		actorContexts: Object.fromEntries(
			Object.entries(authored.actorContexts)
				.filter(([combatantId]) => retainedIds.has(combatantId))
				.map(([combatantId, context]) => [
					combatantId,
					{
						...context,
						visibleCombatantIds: context.visibleCombatantIds.filter((visibleId) =>
							retainedIds.has(visibleId)
						),
						legalActionTemplates: context.legalActionTemplates.map((action) =>
							action.targetContract.kind === 'entity'
								? {
										...action,
										targetContract: {
											...action.targetContract,
											allowedCombatantIds: action.targetContract.allowedCombatantIds.filter(
												(targetId) => retainedIds.has(targetId)
											)
										}
									}
								: action
						)
					}
				])
		)
	};
}

function runEncounter(initial: ReadinessCombatStateV1, key: string) {
	let state = initial;
	let damageApplied = 0;
	let partyDamageReceived = 0;
	let passiveHealthRecovered = 0;
	let recoveryObserved = false;
	for (let windowOrdinal = 0; ; windowOrdinal += 1) {
		const advanced = advanceUntilDecision(state, COMBAT_RULES_V1);
		const advancedCombatants =
			advanced.kind === 'decision-window'
				? advanced.snapshot.combatants
				: advanced.result.finalCombatants;
		const recoveredThisAdvance = Object.entries(advancedCombatants).reduce(
			(total, [combatantId, combatant]) =>
				total +
				Math.max(
					0,
					combatant.resources.health.current -
						(state.combatants[combatantId]?.resources.health.current ??
							combatant.resources.health.current)
				),
			0
		);
		passiveHealthRecovered += recoveredThisAdvance;
		recoveryObserved ||= recoveredThisAdvance > 0;
		if (advanced.kind === 'combat-result') {
			const noProgressStop = advanced.result.safetyStop?.reason === 'no-progress-cycles';
			const safetyStop = advanced.result.safetyStop !== null;
			const completed = !safetyStop;
			return {
				completed,
				ticks: advanced.result.endedAtTick,
				events: advanced.result.claimEvidence.resolvedEvents.length,
				windows: windowOrdinal,
				safetyStop,
				noProgressStop,
				damageApplied,
				partyDamageReceived,
				passiveHealthRecovered,
				recoveryObserved,
				regenerationStalemate: recoveryObserved && (!completed || safetyStop || noProgressStop)
			};
		}
		const resolution = applyCombatChoiceBatch(
			state,
			readinessBatch(state, `${key}:${windowOrdinal}`, 'encounter', advanced),
			COMBAT_RULES_V1
		);
		const windowDamage = resolution.events.reduce(
			(total, event) =>
				total +
				event.effects.reduce(
					(effectTotal, effect) =>
						effect.kind === 'resource' && effect.resource === 'health' && effect.delta < 0
							? effectTotal - effect.delta
							: effectTotal,
					0
				),
			0
		);
		damageApplied += windowDamage;
		partyDamageReceived += resolution.events.reduce(
			(total, event) =>
				total +
				event.effects.reduce((effectTotal, effect) => {
					if (effect.kind !== 'resource' || effect.resource !== 'health' || effect.delta >= 0) {
						return effectTotal;
					}
					return state.combatants[effect.combatantId]?.teamId === 'party'
						? effectTotal - effect.delta
						: effectTotal;
				}, 0),
			0
		);
		state = resolution.state;
	}
}

type ReadinessRegenerationEncounterSummary = Readonly<{
	trials: number;
	completed: number;
	safetyStops: number;
	noProgressStops: number;
	damageApplied: number;
	passiveHealthRecovered: number;
	recoveryObservedEncounters: number;
	regenerationStalemates: number;
}>;

export function evaluateReadinessRegenerationGate(
	encounters: readonly ReadinessRegenerationEncounterSummary[]
) {
	const summary = encounters.reduce(
		(total, encounter) => ({
			trials: total.trials + encounter.trials,
			completed: total.completed + encounter.completed,
			count: total.count + encounter.regenerationStalemates,
			safetyStops: total.safetyStops + encounter.safetyStops,
			noProgressStops: total.noProgressStops + encounter.noProgressStops,
			aggregateDamageApplied: total.aggregateDamageApplied + encounter.damageApplied,
			aggregatePassiveHealthRecovered:
				total.aggregatePassiveHealthRecovered + encounter.passiveHealthRecovered,
			recoveryObservedEncounters:
				total.recoveryObservedEncounters + encounter.recoveryObservedEncounters
		}),
		{
			trials: 0,
			completed: 0,
			count: 0,
			safetyStops: 0,
			noProgressStops: 0,
			aggregateDamageApplied: 0,
			aggregatePassiveHealthRecovered: 0,
			recoveryObservedEncounters: 0
		}
	);
	return {
		status: status(
			summary.completed === summary.trials &&
				summary.count === 0 &&
				summary.safetyStops === 0 &&
				summary.noProgressStops === 0 &&
				summary.recoveryObservedEncounters > 0 &&
				summary.aggregateDamageApplied > summary.aggregatePassiveHealthRecovered
		),
		count: summary.count,
		safetyStops: summary.safetyStops,
		noProgressStops: summary.noProgressStops,
		aggregateDamageApplied: summary.aggregateDamageApplied,
		aggregatePassiveHealthRecovered: summary.aggregatePassiveHealthRecovered,
		recoveryObservedEncounters: summary.recoveryObservedEncounters
	};
}

function declaredReadinessSeed(ordinal: number): string {
	return `${READINESS_SIMULATION_PROFILE_V1.seedDerivation.namespace}:${ordinal
		.toString()
		.padStart(READINESS_SIMULATION_PROFILE_V1.seedDerivation.ordinalWidth, '0')}`;
}

function readinessBenchmarkState(seed: string): ReadinessCombatStateV1 {
	const initial = structuredClone(AGENT_READINESS_REPLAY_VECTOR_V26.initialState);
	const referenceChoices = AGENT_READINESS_REPLAY_VECTOR_V26.recordedBatches[0].choices;
	const movers = referenceChoices.filter((choice) => choice.actionKind === 'move');
	const reserve = referenceChoices.find((choice) => choice.actionId === 'replay-reserve-guard');
	if (movers.length !== 2 || !reserve) throw new Error('Readiness benchmark fixture drifted');
	const retainedIds = new Set([...movers.map((choice) => choice.actorId), reserve.actorId]);
	initial.seed = hashCanonical({ seed, purpose: 'agent-readiness-benchmark-state' });
	initial.tick = 99;
	initial.safety = { ticksAdvanced: 99, eventsEmitted: 0, noProgressCycles: 0 };
	initial.combatants = Object.fromEntries(
		Object.entries(initial.combatants)
			.filter(([combatantId]) => retainedIds.has(combatantId))
			.map(([combatantId, combatant]) => [
				combatantId,
				combatant.teamId === 'party'
					? {
							...combatant,
							resources: {
								...combatant.resources,
								health: {
									...combatant.resources.health,
									current: combatant.resources.health.maximum - 1
								}
							},
							lastDamagedAtTick: 50,
							readiness: { value: 9_900, exactNumerator: 9_900, recoveryUntilTick: 0 }
						}
					: {
							...combatant,
							readiness: { value: 0, exactNumerator: 0, recoveryUntilTick: 1_000 }
						}
			])
	);
	initial.actorContexts = Object.fromEntries(
		Object.entries(initial.actorContexts)
			.filter(([combatantId]) => retainedIds.has(combatantId))
			.map(([combatantId, context]) => [
				combatantId,
				{
					...context,
					visibleCombatantIds: context.visibleCombatantIds.filter((visibleId) =>
						retainedIds.has(visibleId)
					),
					legalActionTemplates: context.legalActionTemplates
						.map((action) => {
							if (action.targetContract.kind === 'entity') {
								return {
									...action,
									targetContract: {
										...action.targetContract,
										allowedCombatantIds: action.targetContract.allowedCombatantIds.filter(
											(targetId) => retainedIds.has(targetId)
										)
									}
								};
							}
							return action;
						})
						.filter(
							(action) =>
								action.targetContract.kind !== 'entity' ||
								action.targetContract.allowedCombatantIds.length > 0
						)
				}
			])
	);
	initial.outcomeEvidence.partyHeroes = Object.fromEntries(
		Object.entries(initial.outcomeEvidence.partyHeroes)
			.filter(([combatantId]) => retainedIds.has(combatantId))
			.map(([combatantId, evidence]) => [
				combatantId,
				{
					...evidence,
					startingHealth: initial.combatants[combatantId]!.resources.health.current,
					currentHealth: initial.combatants[combatantId]!.resources.health.current
				}
			])
	);
	return ReadinessCombatStateV1Schema.parse(initial);
}

function readinessProductionFallbackBatch(
	window: Extract<CombatAdvance, { kind: 'decision-window' }>,
	seed: string
): CombatChoiceBatchV1 {
	const choices = window.views.map((view) =>
		buildDeterministicCombatFallbackIntent(view, {
			attemptId: window.snapshot.attemptId,
			tick: window.snapshot.tick,
			snapshotHash: window.snapshot.snapshotHash
		})
	);
	const unsigned = {
		batchVersion: 'combat-choice-batch-v1' as const,
		batchId: deterministicUuid(`${seed}:production-deterministic-fallback-batch`),
		windowId: window.snapshot.windowId,
		attemptId: window.snapshot.attemptId,
		tick: window.snapshot.tick,
		snapshotHash: window.snapshot.snapshotHash,
		choices
	};
	return { ...unsigned, batchHash: combatChoiceBatchHash(unsigned) };
}

async function runReadinessBenchmarkTrial(seed: string) {
	const initial = readinessBenchmarkState(seed);
	const window = advanceUntilDecision(initial, COMBAT_RULES_V1);
	if (window.kind !== 'decision-window') {
		throw new Error(
			`Benchmark trial lacked its pulse window: ${window.result.outcome}/${window.result.safetyStop?.reason ?? 'ordinary'}`
		);
	}
	const batch = readinessProductionFallbackBatch(window, seed);
	const legalFallbackEvaluations = batch.choices.length;
	const first = applyCombatChoiceBatch(initial, batch, COMBAT_RULES_V1);
	const repeated = applyCombatChoiceBatch(initial, batch, COMBAT_RULES_V1);
	return {
		intervalTicks:
			window.snapshot.tick -
			READINESS_SIMULATION_PROFILE_V1.benchmarkWindowFixture.previousDecisionTick,
		sameWindow: window.views.length > 1,
		collision: first.events.some(
			(event) => event.finalOutcome === 'superseded' && event.conflictingEventId !== null
		),
		noProgress: first.state.safety.noProgressCycles > initial.safety.noProgressCycles,
		regenerationDurationTicks:
			window.snapshot.tick - READINESS_SIMULATION_PROFILE_V1.benchmarkWindowFixture.damagedAtTick,
		fallbackIntentBuilds: batch.choices.length,
		fallbackSelectionsApplied: batch.choices.length * 2,
		legalFallbackEvaluations,
		fallbackTrialResolvedLegally: legalFallbackEvaluations === window.views.length,
		deterministic:
			hashCanonical(first.state) === hashCanonical(repeated.state) &&
			hashCanonical(first.events) === hashCanonical(repeated.events)
	};
}

type ReadinessBenchmarkJob = Readonly<{ index: number; seed: string }>;
type ReadinessEncounterJob = Readonly<{
	index: number;
	archetypeIndex: number;
	archetypeId: string;
	level: BalanceLevel;
	attempt: number;
}>;
type ReadinessWorkerRequest =
	| Readonly<{
			workerVersion: 'agent-readiness-evidence-worker-v1';
			kind: 'benchmark';
			jobs: readonly ReadinessBenchmarkJob[];
	  }>
	| Readonly<{
			workerVersion: 'agent-readiness-evidence-worker-v1';
			kind: 'encounter';
			jobs: readonly ReadinessEncounterJob[];
	  }>;

async function executeReadinessWorkerRequest(request: ReadinessWorkerRequest) {
	if (request.kind === 'benchmark') {
		return Promise.all(
			request.jobs.map(async (job) => ({
				index: job.index,
				value: await runReadinessBenchmarkTrial(job.seed)
			}))
		);
	}
	const fixtures = new Map<BalanceLevel, Awaited<ReturnType<typeof readinessEngineAtLevel>>>();
	for (const level of [...new Set(request.jobs.map((job) => job.level))]) {
		fixtures.set(level, await readinessEngineAtLevel(level));
	}
	return request.jobs.map((job) => ({
		index: job.index,
		value: runEncounter(
			missionState(
				fixtures.get(job.level)!,
				`readiness-encounter:${job.archetypeId}:${job.attempt}`
			),
			`${job.archetypeId}:${job.attempt}`
		)
	}));
}

function partitionStable<T>(values: readonly T[], count: number): T[][] {
	const partitions = Array.from({ length: count }, () => [] as T[]);
	values.forEach((value, index) => partitions[index % count]!.push(value));
	return partitions.filter((partition) => partition.length > 0);
}

async function executeReadinessJobs(
	requestKind: ReadinessWorkerRequest['kind'],
	jobs: readonly (ReadinessBenchmarkJob | ReadinessEncounterJob)[],
	workerCount: number
): Promise<
	readonly Readonly<{
		index: number;
		value: Awaited<ReturnType<typeof runReadinessBenchmarkTrial>> | ReturnType<typeof runEncounter>;
	}>[]
> {
	if (workerCount === 1) {
		return executeReadinessWorkerRequest({
			workerVersion: 'agent-readiness-evidence-worker-v1',
			kind: requestKind,
			jobs
		} as ReadinessWorkerRequest);
	}
	const partitions = partitionStable(jobs, Math.min(workerCount, jobs.length));
	const responses = await Promise.all(
		partitions.map(
			(partition) =>
				new Promise<Awaited<ReturnType<typeof executeReadinessWorkerRequest>>>(
					(fulfill, reject) => {
						const worker = new Worker(new URL(import.meta.url), {
							execArgv: ['--import', 'tsx'],
							workerData: {
								workerVersion: 'agent-readiness-evidence-worker-v1',
								kind: requestKind,
								jobs: partition
							} satisfies ReadinessWorkerRequest
						});
						worker.once('message', fulfill);
						worker.once('error', reject);
						worker.once('exit', (code) => {
							if (code !== 0) reject(new Error(`Readiness evidence worker exited with ${code}`));
						});
					}
				)
		)
	);
	return responses.flat().sort((left, right) => left.index - right.index);
}

async function buildAgentReadinessEvidence(options: ReadinessEvidenceOptions = {}) {
	const diagnosticStart = performance.now();
	const diagnostic = (stage: string) => {
		if (process.env.SUMMONLAB_READINESS_DIAGNOSTIC === '1') {
			process.stderr.write(`${stage}: ${Math.round(performance.now() - diagnosticStart)}ms\n`);
		}
	};
	const trials = options.trialsPerBenchmark ?? READINESS_TRIALS_PER_BENCHMARK;
	const encounterTrials = options.encountersPerArchetype ?? READINESS_ENCOUNTERS_PER_ARCHETYPE;
	const workerCount = options.workerCount ?? Math.max(1, Math.min(8, availableParallelism()));
	if (
		!Number.isInteger(trials) ||
		trials < 1 ||
		!Number.isInteger(encounterTrials) ||
		encounterTrials < 1 ||
		!Number.isInteger(workerCount) ||
		workerCount < 1 ||
		workerCount > 8
	) {
		throw new Error('Readiness evidence counts require positive trials and one to eight workers');
	}
	const verifiedCombatContent = await loadAgentReadinessContentBindingV2();
	const replayOne = replayAgentReadinessVectorV26();
	const replayTwo = replayAgentReadinessVectorV26();
	diagnostic('replays');
	const replayDeterministic = hashCanonical(replayOne) === hashCanonical(replayTwo);
	const cancellationEvents = replayOne.events.filter((event) => event.finalOutcome === 'canceled');
	const unclassifiedCancellations = cancellationEvents.filter(
		(event) => event.conflictingEventId === null
	).length;

	const benchmarkSeeds = Array.from({ length: trials }, (_, trial) => declaredReadinessSeed(trial));
	const benchmarkResults = (await executeReadinessJobs(
		'benchmark',
		benchmarkSeeds.map((seed, index) => ({ index, seed })),
		workerCount
	)) as readonly Readonly<{
		index: number;
		value: Awaited<ReturnType<typeof runReadinessBenchmarkTrial>>;
	}>[];
	const trialSamples = benchmarkResults.map((result) => result.value);
	diagnostic('benchmark-trials');
	const cadenceValues = trialSamples.map((sample) => sample.intervalTicks);
	const regenerationDurations = trialSamples.map((sample) => sample.regenerationDurationTicks);
	const sameWindowTrials = trialSamples.filter((sample) => sample.sameWindow).length;
	const collisionTrials = trialSamples.filter((sample) => sample.collision).length;
	const noProgressTrials = trialSamples.filter((sample) => sample.noProgress).length;
	const fallbackIntentBuilds = trialSamples.reduce(
		(total, sample) => total + sample.fallbackIntentBuilds,
		0
	);
	const fallbackSelectionsApplied = trialSamples.reduce(
		(total, sample) => total + sample.fallbackSelectionsApplied,
		0
	);
	const legalFallbacks = trialSamples.reduce(
		(total, sample) => total + sample.legalFallbackEvaluations,
		0
	);
	const fallbackTrialsResolvedLegally = trialSamples.filter(
		(sample) => sample.fallbackTrialResolvedLegally
	).length;
	const determinismMismatches = trialSamples.filter((sample) => !sample.deterministic).length;

	const encounterResults = (await executeReadinessJobs(
		'encounter',
		READINESS_ARCHETYPES.flatMap((archetype, archetypeIndex) =>
			Array.from({ length: encounterTrials }, (_, attempt) => ({
				index: archetypeIndex * encounterTrials + attempt,
				archetypeIndex,
				archetypeId: archetype.archetypeId,
				level: archetype.level,
				attempt
			}))
		),
		workerCount
	)) as readonly Readonly<{ index: number; value: ReturnType<typeof runEncounter> }>[];
	const encounters = READINESS_ARCHETYPES.map((archetype, archetypeIndex) => {
		const outcomes = encounterResults
			.filter((result) => Math.floor(result.index / encounterTrials) === archetypeIndex)
			.map((result) => result.value);
		return {
			...archetype,
			trials: encounterTrials,
			completed: outcomes.filter((outcome) => outcome.completed).length,
			ticks: readinessDistribution(outcomes.map((outcome) => outcome.ticks)),
			events: readinessDistribution(outcomes.map((outcome) => outcome.events)),
			safetyStops: outcomes.filter((outcome) => outcome.safetyStop).length,
			noProgressStops: outcomes.filter((outcome) => outcome.noProgressStop).length,
			damageApplied: outcomes.reduce((total, outcome) => total + outcome.damageApplied, 0),
			partyDamageReceived: outcomes.reduce(
				(total, outcome) => total + outcome.partyDamageReceived,
				0
			),
			passiveHealthRecovered: outcomes.reduce(
				(total, outcome) => total + outcome.passiveHealthRecovered,
				0
			),
			recoveryObservedEncounters: outcomes.filter((outcome) => outcome.recoveryObserved).length,
			regenerationStalemates: outcomes.filter((outcome) => outcome.regenerationStalemate).length
		};
	});
	diagnostic('encounters');
	const safetyStops = encounters.reduce((total, encounter) => total + encounter.safetyStops, 0);
	const encounterBudgetsPassed = encounters.every(
		(encounter) =>
			encounter.completed === encounter.trials &&
			encounter.ticks.p95 < READINESS_SIMULATION_PROFILE_V1.encounterBudgets.maximumTicks &&
			encounter.events.p95 < READINESS_SIMULATION_PROFILE_V1.encounterBudgets.maximumEvents
	);
	const providerRate = basisPointRate(fallbackTrialsResolvedLegally, trials);
	const passiveRegenerationGate = evaluateReadinessRegenerationGate(encounters);
	const gates = {
		deterministicReplay: {
			status: status(replayDeterministic && determinismMismatches === 0),
			count: determinismMismatches
		},
		unclassifiedCancellations: {
			status: status(unclassifiedCancellations === 0),
			count: unclassifiedCancellations
		},
		passiveRegenerationStalemates: passiveRegenerationGate,
		safetyStops: { status: status(safetyStops === 0), count: safetyStops },
		encounterBudgets: {
			status: status(encounterBudgetsPassed),
			...READINESS_SIMULATION_PROFILE_V1.encounterBudgets
		},
		providerFallback: {
			status: status(providerRate === BASIS_POINTS),
			resolutionRateBasisPoints: providerRate
		}
	};
	const allPassed = Object.values(gates).every((gate) => gate.status === 'passed');
	return deepFreeze({
		schemaVersion: 'agent-readiness-evidence-v1',
		status: allPassed ? 'passed' : 'failed',
		bindings: {
			rules: {
				rulesVersion: COMBAT_RULES_V1.rulesVersion,
				rulesHash: hashCanonical(COMBAT_RULES_V1)
			},
			readinessRules: {
				rulesVersion: AGENT_READINESS_RULES_V2.rulesVersion,
				rulesHash: hashCanonical(AGENT_READINESS_RULES_V2)
			},
			combatContent: {
				bindingVersion: verifiedCombatContent.bindingVersion,
				contentHash: verifiedCombatContent.contentHash,
				components: verifiedCombatContent.components
			}
		},
		simulation: {
			profile: READINESS_SIMULATION_PROFILE_V1,
			profileHash: hashCanonical(READINESS_SIMULATION_PROFILE_V1),
			trialsPerBenchmark: trials,
			encountersPerArchetype: encounterTrials,
			percentileMethod: READINESS_SIMULATION_PROFILE_V1.percentileMethod,
			seedSet: benchmarkSeeds,
			seedSetHash: hashCanonical(benchmarkSeeds),
			evaluations: {
				benchmarkTrials: trials,
				distinctBenchmarkSeeds: new Set(benchmarkSeeds).size,
				benchmarkAdvanceCalls: trials,
				benchmarkResolverCalls: trials * 2,
				productionFallbackIntentBuilds: fallbackIntentBuilds,
				productionFallbackSelectionsApplied: fallbackSelectionsApplied,
				completeEncounters: encounterResults.length,
				encounterAdvanceCalls: encounterResults.reduce(
					(total, result) => total + result.value.windows + 1,
					0
				),
				encounterResolverCalls: encounterResults.reduce(
					(total, result) => total + result.value.windows,
					0
				)
			}
		},
		fixtures: { archetypes: READINESS_ARCHETYPES },
		replay: {
			vectorId: AGENT_READINESS_REPLAY_VECTOR_V26.id,
			providerCalls: AGENT_READINESS_REPLAY_VECTOR_V26.providerCalls,
			nondeterministicReplays: replayDeterministic ? 0 : 1,
			windowHashes: replayOne.windowHashes,
			batchHashes: replayOne.batchHashes,
			resolvedEventHashes: replayOne.resolvedEventHashes,
			stateHashes: replayOne.stateHashes,
			resultHash: hashCanonical(replayOne.result)
		},
		benchmarks: {
			actionCadence: { trials, intervalTicks: readinessDistribution(cadenceValues) },
			sameWindow: {
				trials,
				sameWindowTrials,
				frequencyBasisPoints: basisPointRate(sameWindowTrials, trials)
			},
			collisions: {
				trials,
				collisionTrials,
				rateBasisPoints: basisPointRate(collisionTrials, trials)
			},
			noProgress: {
				trials,
				noProgressTrials,
				rateBasisPoints: basisPointRate(noProgressTrials, trials)
			},
			passiveRegeneration: {
				trials,
				firstEligiblePulseDelayTicks: readinessDistribution(regenerationDurations)
			},
			providerFallback: {
				trials,
				modeledProviderFailures: fallbackIntentBuilds,
				fallbackTrialsResolvedLegally,
				legalFallbackSelections: legalFallbacks,
				fallbackIntentBuilds,
				fallbackSelectionsApplied,
				resolutionRateBasisPoints: providerRate
			},
			determinism: { trials, mismatches: determinismMismatches }
		},
		encounters,
		gates
	});
}

let defaultAgentReadinessEvidence:
	Promise<Awaited<ReturnType<typeof buildAgentReadinessEvidence>>> | undefined;

export function createAgentReadinessEvidence(options: ReadinessEvidenceOptions = {}) {
	const defaultsRequested =
		options.trialsPerBenchmark === undefined &&
		options.encountersPerArchetype === undefined &&
		options.workerCount === undefined;
	if (!defaultsRequested) return buildAgentReadinessEvidence(options);
	defaultAgentReadinessEvidence ??= buildAgentReadinessEvidence(options);
	return defaultAgentReadinessEvidence;
}

export function serializeAgentReadinessEvidence(
	evidence: Awaited<ReturnType<typeof createAgentReadinessEvidence>>
): string {
	return `${JSON.stringify(evidence, null, '\t')}\n`;
}

export function serializeCombatBalanceEvidence(evidence: CombatBalanceEvidence): string {
	return `${JSON.stringify(evidence, null, '\t')}\n`;
}

const balanceEvidencePath = resolve(
	fileURLToPath(new URL('..', import.meta.url)),
	'docs/evidence/combat-balance-v1.json'
);
const readinessEvidencePath = resolve(
	fileURLToPath(new URL('..', import.meta.url)),
	'docs/evidence/agent-readiness-v1.json'
);

async function runCli(): Promise<void> {
	const write = process.argv.includes('--write');
	const check = process.argv.includes('--check');
	if (write === check) {
		throw new Error('Use exactly one combat balance mode: --write or --check');
	}
	const [balanceEvidence, readinessEvidence] = await Promise.all([
		createCombatBalanceEvidence(),
		createAgentReadinessEvidence()
	]);
	if (balanceEvidence.status !== 'passed' || readinessEvidence.status !== 'passed') {
		throw new Error('Combat balance promotion gates failed; refusing to publish evidence');
	}
	const expectedBalance = serializeCombatBalanceEvidence(balanceEvidence);
	const expectedReadiness = serializeAgentReadinessEvidence(readinessEvidence);
	if (write) {
		await Promise.all([
			writeFile(balanceEvidencePath, expectedBalance, 'utf8'),
			writeFile(readinessEvidencePath, expectedReadiness, 'utf8')
		]);
	} else {
		const [currentBalance, currentReadiness] = await Promise.all([
			readFile(balanceEvidencePath, 'utf8').catch(() => ''),
			readFile(readinessEvidencePath, 'utf8').catch(() => '')
		]);
		if (currentBalance !== expectedBalance || currentReadiness !== expectedReadiness) {
			throw new Error(
				'Combat balance evidence is stale; run pnpm exec tsx tools/combat-balance-harness.ts --write'
			);
		}
	}
	process.stdout.write(
		`combat-balance-v1 ${balanceEvidence.status}: ${BALANCE_SIMULATION_PROFILE_V1.trialsPerMatchup} trials per matchup; ${balanceEvidence.bindings.rules.rulesHash}\n` +
			`agent-readiness-v1 ${readinessEvidence.status}: ${readinessEvidence.simulation.trialsPerBenchmark} distinct trials; ${readinessEvidence.simulation.evaluations.completeEncounters} encounters\n`
	);
}

const readinessWorkerRequest = workerData as ReadinessWorkerRequest | undefined;
if (
	!isMainThread &&
	readinessWorkerRequest?.workerVersion === 'agent-readiness-evidence-worker-v1'
) {
	parentPort!.postMessage(await executeReadinessWorkerRequest(readinessWorkerRequest));
} else if (
	isMainThread &&
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	await runCli();
}

import { beforeAll, describe, expect, it } from 'vitest';

import {
	BASIC_SWORD_STRIKE,
	COMBAT_CONTENT_BINDING,
	COMBAT_EQUIPMENT_PROFILES_BY_ID,
	COMBAT_RULES_V1
} from '../packages/content/src/index.js';
import { hashCanonical } from '../packages/engine/src/hash.js';
import { armourReduction } from '../packages/engine/src/domains/combat/capability.js';
import {
	BALANCE_LEVELS,
	BALANCE_SPREADS,
	BALANCE_TRIALS_PER_MATCHUP,
	createCombatBalanceEvidence,
	evaluateAffinityCompletionPair,
	serializeCombatBalanceEvidence
} from './combat-balance-harness.js';

describe('four-attribute combat balance evidence', () => {
	let evidence: Awaited<ReturnType<typeof createCombatBalanceEvidence>>;

	beforeAll(async () => {
		const pendingEvidence = createCombatBalanceEvidence();
		expect(pendingEvidence).toBeInstanceOf(Promise);
		evidence = await pendingEvidence;
	});

	it('covers every benchmark level, attribute spread, mastery band, armour state, and off-affinity archetype', () => {
		expect(evidence.fixtures.levels).toStrictEqual([10, 40, 70, 99]);
		expect(evidence.fixtures.attributeSpreads).toStrictEqual(['low', 'mid', 'high']);
		expect(evidence.fixtures.masteryBands).toStrictEqual(['novice', 'trained', 'mastered']);
		expect(evidence.fixtures.armourStates).toStrictEqual(['unarmoured', 'armoured']);
		expect(evidence.fixtures.offAffinityArchetypes).toStrictEqual(['fire-caster', 'water-martial']);
		expect(evidence.matchups.accuracy).toHaveLength(
			BALANCE_LEVELS.length * BALANCE_SPREADS.length * 3
		);
		expect(evidence.matchups.regeneration).toHaveLength(
			BALANCE_LEVELS.length * BALANCE_SPREADS.length * 2
		);
		expect(evidence.matchups.affinity).toHaveLength(
			BALANCE_LEVELS.length * BALANCE_SPREADS.length * 2
		);
		expect(evidence.matchups.armour).toHaveLength(BALANCE_LEVELS.length * BALANCE_SPREADS.length);
		expect(
			[
				...evidence.matchups.accuracy,
				...evidence.matchups.agility,
				...evidence.matchups.regeneration,
				...evidence.matchups.armour
			].every((matchup) => matchup.trials === BALANCE_TRIALS_PER_MATCHUP)
		).toBe(true);
		expect(
			evidence.matchups.affinity.every(
				(matchup) =>
					matchup.matchedAffinity.trials === BALANCE_TRIALS_PER_MATCHUP &&
					matchup.offAffinity.trials === BALANCE_TRIALS_PER_MATCHUP
			)
		).toBe(true);
	});

	it('enforces the mastery-led accuracy and bounded relative-Agility promotion gates', () => {
		const bands = {
			novice: [6_500, 7_000],
			trained: [7_700, 8_300],
			mastered: [9_000, 9_500]
		} as const;
		expect(evidence.simulation.profile.masteryFixtures).toStrictEqual({
			novice: 0,
			trained: 50,
			mastered: 100
		});
		expect(evidence.simulation.profile.hitContest).toStrictEqual({
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
		});

		for (const matchup of evidence.matchups.accuracy) {
			const [minimum, maximum] = bands[matchup.masteryBand];
			expect(matchup.observedHitRateBasisPoints).toBeGreaterThanOrEqual(minimum);
			expect(matchup.observedHitRateBasisPoints).toBeLessThanOrEqual(maximum);
			expect(matchup.seedCohortHitRateBasisPoints).toMatchObject({
				p10: expect.any(Number),
				p50: expect.any(Number),
				p90: expect.any(Number)
			});
		}
		expect(
			new Set(evidence.matchups.accuracy.map((matchup) => matchup.contestChanceBasisPoints)).size
		).toBeGreaterThan(3);
		expect(
			new Set(evidence.matchups.accuracy.map((matchup) => matchup.defenderEvasionBasisPoints)).size
		).toBeGreaterThan(BALANCE_LEVELS.length);
		expect(evidence.gates.accuracy.status).toBe('passed');
		expect(
			evidence.gates.relativeAgility.maximumAbsoluteChanceShiftBasisPoints
		).toBeLessThanOrEqual(1_000);
		expect(
			Math.max(
				...evidence.matchups.agility.map((matchup) =>
					Math.abs(matchup.observedChanceShiftBasisPoints)
				)
			)
		).toBeLessThanOrEqual(1_000);
		expect(evidence.gates.relativeAgility.status).toBe('passed');
	});

	it('rejects immortal passive recovery, affinity lock-in, and armour-only over-mitigation', () => {
		expect(evidence.simulation.profile.sustainedTimeline).toStrictEqual({
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
		});
		expect(
			evidence.matchups.regeneration.every(
				(matchup) =>
					matchup.timedOutTrials === 0 &&
					matchup.completedTrials === BALANCE_TRIALS_PER_MATCHUP &&
					matchup.regenerationTotal.p90 < matchup.damageTotal.p10 &&
					matchup.regenerationPerThousandTicks.mean < matchup.damagePerThousandTicks.mean
			)
		).toBe(true);
		expect(evidence.gates.passiveCombatRegeneration.status).toBe('passed');
		expect(
			evidence.matchups.affinity.every(
				(matchup) =>
					matchup.medianCompletionTimeRatioBasisPoints !== null &&
					matchup.medianCompletionTimeRatioBasisPoints >= 8_500 &&
					matchup.medianCompletionTimeRatioBasisPoints <= 11_500 &&
					matchup.matchedAffinity.timedOutTrials === 0 &&
					matchup.offAffinity.timedOutTrials === 0
			)
		).toBe(true);
		expect(evidence.gates.offAffinityCompletion.minimumAllowedMedianRatioBasisPoints).toBe(8_500);
		expect(evidence.gates.offAffinityCompletion.status).toBe('passed');
		expect(
			evaluateAffinityCompletionPair(
				{ completedTrials: 9_999, timedOutTrials: 1, completionActions: null },
				{
					completedTrials: 10_000,
					timedOutTrials: 0,
					completionActions: { p10: 10, p50: 10, p90: 10 }
				}
			)
		).toStrictEqual({ status: 'failed', medianRatioBasisPoints: null });
		expect(
			evaluateAffinityCompletionPair(
				{
					completedTrials: 10_000,
					timedOutTrials: 0,
					completionActions: { p10: 10, p50: 10, p90: 10 }
				},
				{
					completedTrials: 10_000,
					timedOutTrials: 0,
					completionActions: { p10: 20, p50: 20, p90: 20 }
				}
			)
		).toStrictEqual({ status: 'failed', medianRatioBasisPoints: 20_000 });
		for (const matchup of evidence.matchups.armour) {
			expect(matchup.reductionCurve.map((point) => point.reductionBasisPoints)).toStrictEqual([
				0, 2_000, 3_333, 5_000, 6_000, 7_143
			]);
			expect(
				Math.max(...matchup.reductionCurve.map((point) => point.reductionBasisPoints))
			).toBeLessThan(7_500);
			expect(matchup.damageAfterArmour).toMatchObject({
				p10: expect.any(Number),
				p50: expect.any(Number),
				p90: expect.any(Number)
			});
		}
		const exhaustiveArmourDomain = Array.from({ length: 10_001 }, (_unused, armour) =>
			armourReduction(armour, 0, COMBAT_RULES_V1)
		);
		expect(evidence.gates.armour.exhaustiveDomain).toStrictEqual({
			minimumArmourPoints: 0,
			maximumArmourPoints: 10_000,
			testedPointCount: 10_001,
			curveHash: hashCanonical(exhaustiveArmourDomain)
		});
		expect(evidence.gates.armour.maximumObservedReductionBasisPoints).toBe(7_499);
		expect(evidence.gates.armour.status).toBe('passed');
	});

	it('binds exact shipped rules and Task 7 content while remaining byte-deterministic', async () => {
		const first = evidence;
		const second = await createCombatBalanceEvidence();

		expect(first.bindings.rules).toStrictEqual({
			rulesVersion: 'combat-rules-v1',
			rulesHash: hashCanonical(COMBAT_RULES_V1)
		});
		expect(first.bindings.combatContent).toStrictEqual({
			bindingVersion: COMBAT_CONTENT_BINDING.bindingVersion,
			contentHash: COMBAT_CONTENT_BINDING.contentHash,
			components: COMBAT_CONTENT_BINDING.components
		});
		expect(first.simulation.seedSet).toHaveLength(10);
		expect(first.simulation.profile.calibrationStatus).toBe('benchmark-promotion-candidate');
		expect(first.simulation.profile.benchmarkDomain.armour).toStrictEqual({
			minimumPoints: 0,
			maximumPoints: 10_000,
			pointIncrement: 1,
			penetrationPoints: 0,
			armouredFixturePoints: 100,
			damageFixturePoints: 250,
			damageFixtureIncludesNamedResistance: false,
			equipmentMagnitudeStatus: 'not-yet-shipped',
			reductionCeilingStatus: 'authoritative-combat-rule'
		});
		expect(first.simulation.profile.sourceRecords).toStrictEqual({
			accuracySkillId: BASIC_SWORD_STRIKE.skillId,
			peerDamageTagSkillId: BASIC_SWORD_STRIKE.skillId,
			armouredEquipmentDefinitionId:
				COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-iron-heavy-armour-torso']?.definitionId
		});
		expect(first.simulation.profileHash).toMatch(/^[a-f0-9]{64}$/u);
		expect(first.status).toBe('passed');
		expect(first.simulation.profile).toMatchObject({
			benchmarkLevels: [10, 40, 70, 99],
			attributeSpreads: ['low', 'mid', 'high'],
			trialsPerMatchup: 10_000,
			percentileMethod: 'nearest-rank',
			seedSet: expect.arrayContaining(['0x243f6a88', '0x38d01377']),
			promotionGates: {
				accuracyBasisPoints: {
					novice: { minimumBasisPoints: 6_500, maximumBasisPoints: 7_000 },
					trained: { minimumBasisPoints: 7_700, maximumBasisPoints: 8_300 },
					mastered: { minimumBasisPoints: 9_000, maximumBasisPoints: 9_500 }
				},
				maximumRelativeAgilityShiftBasisPoints: 1_000,
				offAffinityMedianRatioBasisPoints: { minimum: 8_500, maximum: 11_500 }
			}
		});
		expect(first.simulation.profile.randomness).toStrictEqual({
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
			rollModulo: 10_000
		});
		expect(first.simulation.profile.relativeAgilityFixture).toStrictEqual({
			masteryBand: 'trained',
			directions: ['faster', 'slower'],
			baselineAttackerAgilitySource: 'peer',
			defenderAgilitySource: 'peer',
			endpointAttackerAgility: { faster: 100, slower: 1 },
			randomStreamCoupling: 'paired-baseline-and-adjusted'
		});
		expect(first.simulation.profile.peerDamageFixture).toStrictEqual({
			damageModel: 'attribute-scaled-level-base-magnitude',
			masteryBand: 'trained',
			channel: 'physical',
			damageTags: ['physical', 'cut'],
			matchedAffinity: false,
			attackerAgilitySource: 'peer',
			defenderAgilitySource: 'peer',
			missDamage: 0,
			damageVarianceBasisPoints: {
				minimum: 9_000,
				maximum: 11_000,
				endpoints: 'inclusive'
			},
			minimumSuccessfulDamage: 1,
			mitigationOrder: ['armour', 'named-resistance'],
			penetrationPoints: 0,
			resistancePolicy: 'apply-authored-armour-receipts-when-enabled'
		});
		expect(first.simulation.profile.sustainedTimeline).toStrictEqual({
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
		});
		expect(first.simulation.profile.completionFixture).toStrictEqual({
			damageModel: 'attribute-scaled-level-base-magnitude-with-affinity-candidate',
			masteryBand: 'trained',
			attackerAgilitySource: 'peer',
			defenderAgilitySource: 'peer',
			targetHealthSource: 'maximum-health-from-peer-vitality',
			damageVarianceBasisPoints: {
				minimum: 9_000,
				maximum: 11_000,
				endpoints: 'inclusive'
			},
			minimumSuccessfulDamage: 1,
			maximumActions: 200,
			missConsumesAction: true,
			defencePolicy: 'no-armour-or-named-resistance',
			affinityVariantRandomStreamCoupling: 'independent',
			affinityVariantCoordinates: { matched: 'matched', offAffinity: 'off-affinity' }
		});
		expect(first.simulation.profile.affinityApplication).toStrictEqual({
			matchingRule: 'associated-attribute-matches-channel-attribute',
			channelAttributes: { physical: 'might', magical: 'spirit' },
			matchedAdjustmentScope: 'attribute-contribution-only',
			nudgeSource: 'combat-rules-affinity-contribution-cap',
			offAffinityAdjustment: 'none'
		});
		expect(first.simulation.profile.arithmetic).toStrictEqual({
			basisPointScale: 10_000,
			integerDivisionRounding: 'half-up',
			summaryMeanDecimalPlaces: 3
		});
		expect(first.simulation.profile.fixtureMatrix).toStrictEqual({
			accuracyMasteryBands: ['novice', 'trained', 'mastered'],
			armourStates: ['unarmoured', 'armoured']
		});
		expect(first.simulation.profile.promotionGates.regenerationComparison).toStrictEqual({
			completionPolicy: 'all-trials-complete-with-zero-timeouts',
			totalBand: 'p90-regeneration-strictly-below-p10-damage',
			normalizedThroughput: 'mean-regeneration-strictly-below-mean-damage',
			zeroDamageRatioDenominatorScaledUnits: 1
		});
		expect(Object.isFrozen(first)).toBe(true);
		expect(Object.isFrozen(first.simulation.profile)).toBe(true);
		expect(Object.isFrozen(first.simulation.profile.hitContest)).toBe(true);
		expect(Object.isFrozen(first.simulation.profile.seedSet)).toBe(true);
		expect(Object.isFrozen(first.simulation.profile.relativeAgilityFixture)).toBe(true);
		expect(Object.isFrozen(first.simulation.profile.peerDamageFixture)).toBe(true);
		expect(Object.isFrozen(first.simulation.profile.peerDamageFixture.damageTags)).toBe(true);
		expect(Object.isFrozen(first.simulation.profile.sustainedTimeline.regenerationContext)).toBe(
			true
		);
		expect(Object.isFrozen(first.simulation.profile.sustainedTimeline.resolutionOrder)).toBe(true);
		expect(Object.isFrozen(first.simulation.profile.completionFixture)).toBe(true);
		expect(Object.isFrozen(first.matchups.accuracy)).toBe(true);
		expect(Object.isFrozen(first.matchups.accuracy[0])).toBe(true);
		const profileHashBeforeMutation = hashCanonical(first.simulation.profile);
		expect(
			Reflect.set(first.simulation.profile.hitContest, 'relativeAgilityCapBasisPoints', 0)
		).toBe(false);
		expect(hashCanonical(first.simulation.profile)).toBe(profileHashBeforeMutation);
		expect(first.simulation.profileHash).toBe(profileHashBeforeMutation);
		expect(
			hashCanonical({
				...first.simulation.profile,
				sustainedTimeline: {
					...first.simulation.profile.sustainedTimeline,
					attackCadenceTicks: 11
				}
			})
		).not.toBe(first.simulation.profileHash);

		const semanticMutations = [
			{
				...first.simulation.profile,
				arithmetic: { ...first.simulation.profile.arithmetic, summaryMeanDecimalPlaces: 2 }
			},
			{
				...first.simulation.profile,
				randomness: {
					...first.simulation.profile.randomness,
					streamNamespace: 'combat-balance-candidate-v2'
				}
			},
			{
				...first.simulation.profile,
				randomness: {
					...first.simulation.profile.randomness,
					coordinateDerivation: {
						...first.simulation.profile.randomness.coordinateDerivation,
						fieldsByStreamKind: {
							...first.simulation.profile.randomness.coordinateDerivation.fieldsByStreamKind,
							accuracy: ['masteryBand', 'level', 'attributeSpread']
						}
					}
				}
			},
			{
				...first.simulation.profile,
				masteryResolution: 'first-authored-step-at-or-below-fixture'
			},
			{
				...first.simulation.profile,
				fixtureMatrix: {
					...first.simulation.profile.fixtureMatrix,
					accuracyMasteryBands: ['novice', 'mastered']
				}
			},
			{
				...first.simulation.profile,
				attributeFixture: 'vitality-only'
			},
			{
				...first.simulation.profile,
				accuracyFixture: {
					...first.simulation.profile.accuracyFixture,
					defenderAgilitySource: 'endpoint'
				}
			},
			{
				...first.simulation.profile,
				hitContest: { ...first.simulation.profile.hitContest, formula: 'authored-accuracy-only' }
			},
			{
				...first.simulation.profile,
				relativeAgilityFixture: {
					...first.simulation.profile.relativeAgilityFixture,
					masteryBand: 'novice'
				}
			},
			{
				...first.simulation.profile,
				peerDamageFixture: {
					...first.simulation.profile.peerDamageFixture,
					channel: 'magical'
				}
			},
			{
				...first.simulation.profile,
				peerDamageFixture: {
					...first.simulation.profile.peerDamageFixture,
					damageTags: ['physical', 'pierce']
				}
			},
			{
				...first.simulation.profile,
				peerDamageFixture: {
					...first.simulation.profile.peerDamageFixture,
					matchedAffinity: true
				}
			},
			{
				...first.simulation.profile,
				sustainedTimeline: {
					...first.simulation.profile.sustainedTimeline,
					tickDurationMilliseconds: 50
				}
			},
			{
				...first.simulation.profile,
				sustainedTimeline: {
					...first.simulation.profile.sustainedTimeline,
					regenerationContext: {
						...first.simulation.profile.sustainedTimeline.regenerationContext,
						mode: 'safe-rest'
					}
				}
			},
			{
				...first.simulation.profile,
				sustainedTimeline: {
					...first.simulation.profile.sustainedTimeline,
					resolutionOrder: ['regeneration', 'attack', 'advance-damage-clock']
				}
			},
			{
				...first.simulation.profile,
				sustainedTimeline: {
					...first.simulation.profile.sustainedTimeline,
					damageClockResetPolicy: {
						...first.simulation.profile.sustainedTimeline.damageClockResetPolicy,
						trigger: 'attack-attempt'
					}
				}
			},
			{
				...first.simulation.profile,
				completionFixture: {
					...first.simulation.profile.completionFixture,
					maximumActions: 201
				}
			},
			{
				...first.simulation.profile,
				benchmarkDomain: {
					...first.simulation.profile.benchmarkDomain,
					armour: {
						...first.simulation.profile.benchmarkDomain.armour,
						damageFixturePoints: 150
					}
				}
			},
			{
				...first.simulation.profile,
				affinityApplication: {
					...first.simulation.profile.affinityApplication,
					matchedAdjustmentScope: 'whole-magnitude'
				}
			}
		];
		for (const mutation of semanticMutations) {
			expect(hashCanonical(mutation)).not.toBe(first.simulation.profileHash);
		}
		expect(serializeCombatBalanceEvidence(second)).toBe(serializeCombatBalanceEvidence(first));
	});
});

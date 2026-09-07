import { describe, expect, it } from 'vitest';

import {
	BASIC_SWORD_STRIKE,
	COMBAT_CONTENT_BINDING,
	COMBAT_EQUIPMENT_PROFILES_BY_ID,
	COMBAT_RULES_V1
} from '../packages/content/src/index.js';
import { hashCanonical } from '../packages/engine/src/hash.js';
import {
	BALANCE_LEVELS,
	BALANCE_SPREADS,
	BALANCE_TRIALS_PER_MATCHUP,
	createCombatBalanceEvidence,
	serializeCombatBalanceEvidence
} from './combat-balance-harness.js';

describe('four-attribute combat balance evidence', () => {
	it('covers every benchmark level, attribute spread, mastery band, armour state, and off-affinity archetype', () => {
		const evidence = createCombatBalanceEvidence();

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
		const evidence = createCombatBalanceEvidence();
		const bands = {
			novice: [6_500, 7_000],
			trained: [7_700, 8_300],
			mastered: [9_000, 9_500]
		} as const;

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
		const evidence = createCombatBalanceEvidence();

		expect(
			evidence.matchups.regeneration.every(
				(matchup) => matchup.combatHealthRegenerationPerTick < matchup.sustainedPeerDamage.mean
			)
		).toBe(true);
		expect(evidence.gates.passiveCombatRegeneration.status).toBe('passed');
		expect(
			evidence.matchups.affinity.every(
				(matchup) => matchup.medianCompletionTimeRatioBasisPoints <= 11_500
			)
		).toBe(true);
		expect(evidence.gates.offAffinityCompletion.status).toBe('passed');
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
		expect(evidence.gates.armour.status).toBe('passed');
	});

	it('binds exact shipped rules and Task 7 content while remaining byte-deterministic', () => {
		const first = createCombatBalanceEvidence();
		const second = createCombatBalanceEvidence();

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
			maximumPoints: 250,
			armouredFixturePoints: 100,
			runtimeMagnitudeStatus: 'not-yet-shipped'
		});
		expect(first.simulation.profile.sourceRecords).toStrictEqual({
			accuracySkillId: BASIC_SWORD_STRIKE.skillId,
			armouredEquipmentDefinitionId:
				COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-iron-heavy-armour-torso']?.definitionId
		});
		expect(first.simulation.profileHash).toMatch(/^[a-f0-9]{64}$/u);
		expect(first.status).toBe('passed');
		expect(serializeCombatBalanceEvidence(second)).toBe(serializeCombatBalanceEvidence(first));
	});
});

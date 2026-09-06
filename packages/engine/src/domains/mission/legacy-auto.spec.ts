import { generateSummonableCharacterDraft } from '@summonlab/characters';
import {
	CombatModeBindingSchema,
	EngineGameStateV25Schema,
	MissionHarmRecordSchema,
	MissionHarmRecordV3Schema,
	MissionLifecycleRequestSchema,
	type EngineGameStateV25
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import {
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	legalActions,
	reduceEvent
} from '../../index.js';
import { createCombatModeBinding } from './combat-mode.js';
import {
	LEGACY_AUTO_POLICY_ID,
	legacyAutomaticChoices,
	legacyCapabilityProjection
} from './legacy-auto.js';

const BOUND_AT = '2000-01-01T00:00:00.000Z';

function manualSource() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function commandBase(state: EngineGameStateV25, key: string) {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandId,
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: manualSource()
	};
}

async function capabilityState(): Promise<EngineGameStateV25> {
	const draft = await generateSummonableCharacterDraft({
		seed: 'legacy-auto-capability-seed',
		generationVersion: 'human-v6',
		cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
	});
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid('legacy-auto-run'),
		seed: 'legacy-auto-engine-seed',
		draft
	});
	if (bootstrap.snapshot.state.schemaVersion !== 25) throw new Error('Expected v25 state');
	return bootstrap.snapshot.state;
}

describe('legacy automatic combat', () => {
	it('projects each canonical attribute onto only its agreed legacy aptitude with half-up clamps', () => {
		expect(
			legacyCapabilityProjection({ might: 1, vitality: 5, agility: 6, spirit: 95 })
		).toStrictEqual({ might: 1, finesse: 1, insight: 10, resolve: 1 });
		expect(
			legacyCapabilityProjection({ might: 94, vitality: 100, agility: 55, spirit: 45 })
		).toStrictEqual({ might: 9, finesse: 6, insight: 5, resolve: 10 });
	});

	it('binds the enabled mode to the aggregate combat mechanics hash at preparation time', () => {
		const binding = createCombatModeBinding('legacy-auto-v1', BOUND_AT);

		expect(CombatModeBindingSchema.parse(binding)).toStrictEqual({
			modeId: 'legacy-auto-v1',
			rulesVersion: 'legacy-auto-rules-v1',
			contentHash: COMBAT_CONTENT_BINDING.contentHash,
			boundAt: BOUND_AT
		});
	});

	it('keeps the player request mode-neutral and rejects supplied choices or policies', () => {
		expect(
			MissionLifecycleRequestSchema.parse({ action: 'advance-automatic-combat' })
		).toStrictEqual({ action: 'advance-automatic-combat' });
		for (const supplied of [
			{ combatMode: 'legacy-auto-v1' },
			{ masterActionId: 'mission.hold' },
			{ choices: [] },
			{ targetId: deterministicUuid('forbidden-target') },
			{ policy: 'random' }
		]) {
			expect(
				MissionLifecycleRequestSchema.safeParse({
					action: 'advance-automatic-combat',
					...supplied
				}).success
			).toBe(false);
		}
		// Historical development fixtures retain their old request shape.
		expect(
			MissionLifecycleRequestSchema.safeParse({
				action: 'resolve-turn',
				masterActionId: 'mission.hold'
			}).success
		).toBe(true);
	});

	it('selects every party choice from legal actions with stable seeded policy evidence', async () => {
		const initial = await capabilityState();
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...commandBase(initial, 'prepare'),
			commandType: 'mission.prepare',
			heroIds: [heroId],
			combatModeBinding: createCombatModeBinding('legacy-auto-v1', initial.simulatedAt)
		});
		if (prepared.state.schemaVersion !== 25) throw new Error('Expected v25 state');
		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, 'deploy'),
			commandType: 'mission.deploy'
		});
		if (deployed.state.schemaVersion !== 25) throw new Error('Expected v25 state');

		const first = legacyAutomaticChoices(deployed.state);
		const second = legacyAutomaticChoices(deployed.state);
		expect(second).toStrictEqual(first);
		expect(first.map((choice) => choice.actorId)).toStrictEqual(
			deployed.state.mission.attempt?.party.memberIds
		);
		expect(first.every((choice) => choice.source === 'random')).toBe(true);
		expect(first.every((choice) => choice.policyId === LEGACY_AUTO_POLICY_ID)).toBe(true);
		expect(
			first.every(
				(choice) =>
					choice.packetHash !== null &&
					choice.legalActionHash !== null &&
					choice.policyResultHash !== null
			)
		).toBe(true);
	});

	it('advances one frozen legacy round without exposing actor or target selection', async () => {
		const initial = await capabilityState();
		const heroId = Object.keys(initial.heroes)[0]!;
		const profile = initial.heroes[heroId]!.capabilityProfile;
		const prepared = applyCommand(initial, {
			...commandBase(initial, 'prepare'),
			commandType: 'mission.prepare',
			heroIds: [heroId],
			combatModeBinding: createCombatModeBinding('legacy-auto-v1', initial.simulatedAt)
		});
		if (prepared.state.schemaVersion !== 25) throw new Error('Expected v25 state');
		expect(prepared.state.mission.attempt?.combatModeBinding).toStrictEqual(
			createCombatModeBinding('legacy-auto-v1', initial.simulatedAt)
		);
		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, 'deploy'),
			commandType: 'mission.deploy'
		});
		if (deployed.state.schemaVersion !== 25) throw new Error('Expected v25 state');
		expect(
			legalActions(deployed.state, deployed.state.master.masterId).map((action) => action.actionId)
		).toStrictEqual(['mission.advance.automatic']);

		const advanced = applyCommand(deployed.state, {
			...commandBase(deployed.state, 'advance'),
			commandType: 'mission.advance.automatic'
		});
		if (advanced.state.schemaVersion !== 25) throw new Error('Expected v25 state');
		expect(advanced.state.mission.attempt?.turnState.roundNumber).toBe(1);
		expect(advanced.state.mission.attempt?.combatModeBinding).toStrictEqual(
			prepared.state.mission.attempt?.combatModeBinding
		);
		expect(advanced.state.heroes[heroId]?.capabilityProfile).toStrictEqual(profile);
		expect(advanced.state.heroes[heroId]?.mind).not.toHaveProperty('aptitudes');
		expect(advanced.events[0]?.payload.choices).toStrictEqual(
			legacyAutomaticChoices(deployed.state)
		);

		const changedBindingEvent = structuredClone(advanced.events[0]!);
		const mission = changedBindingEvent.payload.mission as {
			attempt: { combatModeBinding: { modeId: string } } | null;
		};
		mission.attempt!.combatModeBinding.modeId = 'agent-readiness-v1';
		expect(() => reduceEvent(deployed.state, changedBindingEvent)).toThrow(
			/Legacy automatic mission round payload diverged/u
		);
	});

	it('widens only v25 hero harm evidence beyond legacy Health 100', () => {
		const harm = {
			consequenceId: deterministicUuid('v25-harm'),
			sourceEventId: deterministicUuid('v25-harm-event'),
			sourceAttemptId: deterministicUuid('v25-harm-attempt'),
			sourceKind: 'monster' as const,
			sourceId: 'monster-duty-1',
			targetHeroId: deterministicUuid('v25-harm-hero'),
			nodeId: 'threshold',
			roundNumber: 1,
			guardAfterImpact: 0 as const,
			healthBefore: 348,
			healthAfter: 323,
			damage: 25,
			injury: {
				injuryId: deterministicUuid('v25-harm-injury'),
				kind: 'strain' as const,
				severity: 25,
				inflictedAt: BOUND_AT
			},
			itemWear: null,
			fatal: false,
			witnesses: [],
			summary: 'The capability hero survived a bounded hit above legacy Health.'
		};

		expect(MissionHarmRecordV3Schema.safeParse(harm).success).toBe(true);
		expect(MissionHarmRecordSchema.safeParse(harm).success).toBe(false);
	});

	it('retains the frozen resolver 48-round failure boundary', async () => {
		const initial = await capabilityState();
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...commandBase(initial, 'round-limit-prepare'),
			commandType: 'mission.prepare',
			heroIds: [heroId],
			combatModeBinding: createCombatModeBinding('legacy-auto-v1', initial.simulatedAt)
		});
		if (prepared.state.schemaVersion !== 25) throw new Error('Expected v25 state');
		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, 'round-limit-deploy'),
			commandType: 'mission.deploy'
		});
		if (deployed.state.schemaVersion !== 25) throw new Error('Expected v25 state');
		const first = applyCommand(deployed.state, {
			...commandBase(deployed.state, 'round-limit-first'),
			commandType: 'mission.advance.automatic'
		});
		if (first.state.schemaVersion !== 25 || !first.state.mission.attempt) {
			throw new Error('Expected active v25 attempt');
		}
		const firstRound = first.state.mission.attempt.turnState.rounds[0]!;
		const nearLimit = EngineGameStateV25Schema.parse({
			...first.state,
			mission: {
				...first.state.mission,
				attempt: {
					...first.state.mission.attempt,
					status: 'resolving',
					completedObjectiveIds: [],
					extractionOpenedAt: null,
					endedAt: null,
					outcome: null,
					turnState: {
						...first.state.mission.attempt.turnState,
						roundNumber: 47,
						objective: {
							...first.state.mission.attempt.turnState.objective,
							status: 'available',
							carrierId: null,
							recoveredOnRound: null,
							deliveredOnRound: null
						},
						rounds: Array.from({ length: 47 }, (_, index) => ({
							...firstRound,
							roundNumber: index + 1
						}))
					}
				}
			}
		});

		const exhausted = applyCommand(nearLimit, {
			...commandBase(nearLimit, 'round-limit-final'),
			commandType: 'mission.advance.automatic'
		});
		if (exhausted.state.schemaVersion !== 25) throw new Error('Expected v25 state');
		expect(exhausted.state.mission.attempt).toMatchObject({
			status: 'failure',
			outcome: 'failure',
			turnState: { roundNumber: 48 }
		});
	});
});

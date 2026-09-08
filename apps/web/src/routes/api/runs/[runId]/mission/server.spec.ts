import { generateSummonableCharacterDraft } from '@summonlab/characters';
import type { ActorDecisionView, CombatModeId, EngineSnapshot } from '@summonlab/contracts';
import { IdempotencyConflictError } from '@summonlab/database';
import {
	applyCommand,
	createBootstrapEngine,
	createCombatModeBinding,
	deterministicUuid,
	hashCanonical,
	hashGameState,
	legalActions
} from '@summonlab/engine';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	combatMode: 'agent-readiness-v1' as CombatModeId,
	snapshot: null as EngineSnapshot | null,
	commit: vi.fn(),
	createWindow: vi.fn(),
	commitsById: new Map<string, { commandHash: string; receipt: unknown }>()
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		databaseUrl: 'postgres://unused',
		combatMode: mocks.combatMode,
		policyMode: 'scripted',
		decisionJobMaxProviderAttempts: 2
	})
}));

vi.mock('@summonlab/database', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@summonlab/database')>();
	return {
		...actual,
		commitEngineCommand: mocks.commit,
		createCombatDecisionWindow: mocks.createWindow,
		getEngineSnapshot: vi.fn(async () => mocks.snapshot),
		getProofRun: vi.fn(async () => ({ manifest: { characterId: 'unused' } }))
	};
});

import { POST } from './+server.js';

let initial: EngineSnapshot;
let heroId: string;

function commandBase(snapshot: EngineSnapshot, key: string) {
	const commandId = deterministicUuid(key);
	return {
		commandId,
		runId: snapshot.state.runId,
		actorId: snapshot.state.master.masterId,
		expectedVersion: snapshot.state.version,
		correlationId: commandId,
		source: {
			source: 'manual' as const,
			timing: 'step' as const,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		}
	};
}

function deployed(modeId: CombatModeId): EngineSnapshot {
	if (initial.state.schemaVersion !== 26) throw new Error('Expected v26 fixture');
	const prepared = applyCommand(initial.state, {
		...commandBase(initial, `${modeId}-prepare`),
		commandType: 'mission.prepare',
		heroIds: [heroId],
		combatModeBinding: createCombatModeBinding(modeId, initial.state.simulatedAt)
	}).state;
	const preparedSnapshot = { state: prepared, stateHash: hashGameState(prepared) };
	const state = applyCommand(prepared, {
		...commandBase(preparedSnapshot, `${modeId}-deploy`),
		commandType: 'mission.deploy'
	}).state;
	return { state, stateHash: hashGameState(state) };
}

function call(body: unknown): Promise<Response> {
	return POST({
		params: { runId: initial.state.runId },
		request: new Request(`http://summonlab.test/api/runs/${initial.state.runId}/mission`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never) as Promise<Response>;
}

describe('operator-bound mission combat', () => {
	beforeAll(async () => {
		const draft = await generateSummonableCharacterDraft(
			{
				seed: 'web-readiness-mission-route',
				generationVersion: 'human-v6',
				cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
			},
			{ capabilityEntropy: 'a'.repeat(64) }
		);
		heroId = draft.manifest.characterId;
		initial = createBootstrapEngine({
			runId: deterministicUuid('web-readiness-mission-route-run'),
			seed: 'web-readiness-mission-route-engine',
			draft,
			combatMode: 'agent-readiness-v1'
		}).snapshot;
	});

	beforeEach(() => {
		mocks.combatMode = 'agent-readiness-v1';
		mocks.snapshot = initial;
		mocks.commitsById.clear();
		mocks.commit.mockReset().mockImplementation(async (_databaseUrl, command) => {
			const existing = mocks.commitsById.get(command.commandId);
			const commandHash = hashCanonical(command);
			if (existing) {
				if (existing.commandHash !== commandHash) {
					throw new IdempotencyConflictError(command.commandId);
				}
				return existing.receipt;
			}
			const applied = applyCommand(mocks.snapshot!.state, command);
			mocks.snapshot = { state: applied.state, stateHash: hashGameState(applied.state) };
			const receipt = { snapshot: mocks.snapshot, events: applied.events, legalActions: [] };
			mocks.commitsById.set(command.commandId, { commandHash, receipt });
			return receipt;
		});
		mocks.createWindow.mockReset().mockImplementation(async (_databaseUrl, input) => ({
			windowId: input.snapshot.windowId,
			runId: input.runId,
			attemptId: input.snapshot.attemptId,
			tick: input.snapshot.tick,
			status: 'collecting',
			createdAt: '2000-01-01T00:00:00.000Z',
			updatedAt: '2000-01-01T00:00:00.000Z',
			jobs: input.actors.map(({ view }: { view: ActorDecisionView }) => ({
				status: 'created',
				heroId: view.actorId
			}))
		}));
	});

	it('uses the attempt binding after the operator default changes and persists one safe window', async () => {
		mocks.snapshot = deployed('agent-readiness-v1');
		mocks.combatMode = 'legacy-auto-v1';

		const response = await call({ action: 'advance-automatic-combat' });
		const body = await response.json();

		expect(response.status, JSON.stringify(body)).toBe(200);
		expect(mocks.commit).not.toHaveBeenCalled();
		expect(mocks.createWindow).toHaveBeenCalledOnce();
		expect(mocks.createWindow.mock.calls[0]?.[1]).toMatchObject({
			runId: initial.state.runId,
			expectedRunVersion: mocks.snapshot.state.version,
			actors: expect.arrayContaining([
				expect.objectContaining({ requestedPolicy: 'scripted', maxProviderAttempts: 2 })
			])
		});
		expect(body).toMatchObject({ status: 'collecting', readyActors: 0 });
		expect(body).not.toHaveProperty('snapshot');
		expect(body).not.toHaveProperty('jobs');
		expect(JSON.stringify(body)).not.toContain('actorViewHash');
		expect(JSON.stringify(body)).not.toContain('legalActions');
	});

	it('keeps an active attempt immutable while a later attempt binds the new operator default', async () => {
		mocks.combatMode = 'agent-readiness-v1';
		let response = await call({ action: 'prepare', heroIds: [heroId] });
		expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
		const afterPrepare = mocks.snapshot;
		if (!afterPrepare || afterPrepare.state.schemaVersion !== 26)
			throw new Error('Expected v26 fixture');
		expect(afterPrepare.state.mission.attempt?.combatModeBinding.modeId).toBe('agent-readiness-v1');

		mocks.combatMode = 'legacy-auto-v1';
		response = await call({ action: 'revise-party', heroIds: [heroId] });
		expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
		const afterRevision = mocks.snapshot;
		if (!afterRevision || afterRevision.state.schemaVersion !== 26)
			throw new Error('Expected v26 fixture');
		expect(afterRevision.state.mission.attempt?.combatModeBinding.modeId).toBe(
			'agent-readiness-v1'
		);

		response = await call({ action: 'cancel' });
		expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
		response = await call({ action: 'prepare', heroIds: [heroId] });
		expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
		const nextAttempt = mocks.snapshot;
		if (!nextAttempt || nextAttempt.state.schemaVersion !== 26)
			throw new Error('Expected v26 fixture');
		expect(nextAttempt.state.mission.attempt).toMatchObject({
			ordinal: 2,
			combatModeBinding: { modeId: 'legacy-auto-v1' },
			combatState: { modeId: 'legacy-auto-v1' }
		});
	});

	it('keeps the legacy path synchronous under its stored attempt mode', async () => {
		mocks.snapshot = deployed('legacy-auto-v1');
		mocks.combatMode = 'agent-readiness-v1';
		if (mocks.snapshot.state.schemaVersion !== 26) throw new Error('Expected v26 fixture');
		expect(mocks.snapshot.state.mission.attempt).toMatchObject({
			status: 'deployed',
			combatModeBinding: { modeId: 'legacy-auto-v1' },
			combatState: { modeId: 'legacy-auto-v1' }
		});
		expect(
			legalActions(mocks.snapshot.state, mocks.snapshot.state.master.masterId).map(
				(action) => action.actionId
			)
		).toContain('mission.advance.automatic');
		applyCommand(mocks.snapshot.state, {
			...commandBase(mocks.snapshot, 'legacy-probe'),
			commandType: 'mission.advance.automatic'
		});

		const response = await call({ action: 'advance-automatic-combat' });

		expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
		expect(mocks.commit).toHaveBeenCalledOnce();
		expect(mocks.commit.mock.calls[0]?.[1]).toMatchObject({
			commandType: 'mission.advance.automatic'
		});
		expect(mocks.createWindow).not.toHaveBeenCalled();
	});

	it('persists a pre-window terminal result through the system command before responding', async () => {
		const active = deployed('agent-readiness-v1');
		if (active.state.schemaVersion !== 26) throw new Error('Expected v26 fixture');
		const input = structuredClone(active.state);
		const combat = input.mission.attempt!.combatState;
		if (combat.modeId !== 'agent-readiness-v1') throw new Error('Expected readiness combat');
		for (const enemy of Object.values(combat.readinessState.combatants).filter(
			(combatant) => combatant.teamId === 'enemy'
		)) {
			enemy.resources.health.current = 0;
			enemy.downed = true;
			enemy.active = false;
		}
		mocks.snapshot = { state: input, stateHash: hashGameState(input) };

		const response = await call({ action: 'advance-automatic-combat' });
		const body = await response.json();

		expect(response.status, JSON.stringify(body)).toBe(200);
		expect(mocks.commit).toHaveBeenCalledOnce();
		expect(mocks.commit.mock.calls[0]?.[1]).toMatchObject({
			commandType: 'mission.commit.readiness-terminal',
			source: { source: 'system', timing: null }
		});
		expect(mocks.snapshot.state.schemaVersion).toBe(26);
		if (mocks.snapshot.state.schemaVersion !== 26) throw new Error('Expected v26 fixture');
		expect(mocks.snapshot.state.mission.attempt).toMatchObject({
			status: 'extraction',
			outcome: null
		});
		expect(body).toMatchObject({
			status: 'terminal',
			outcome: 'victory',
			missionStatus: 'extraction'
		});
		expect(mocks.createWindow).not.toHaveBeenCalled();

		const retry = await call({ action: 'advance-automatic-combat' });
		expect(retry.status, JSON.stringify(await retry.clone().json())).toBe(200);
		expect(await retry.json()).toStrictEqual(body);
		expect(mocks.commit).toHaveBeenCalledOnce();
	});

	it('rejects client mode, provider, action, and target overrides before dispatch', async () => {
		for (const override of [
			{ combatMode: 'legacy-auto-v1' },
			{ provider: 'random' },
			{ actionId: 'combat-skill-basic-sword-strike' },
			{ targetId: heroId }
		]) {
			const response = await call({ action: 'advance-automatic-combat', ...override });
			expect(response.status).toBe(400);
		}
		expect(mocks.commit).not.toHaveBeenCalled();
		expect(mocks.createWindow).not.toHaveBeenCalled();
	});
});

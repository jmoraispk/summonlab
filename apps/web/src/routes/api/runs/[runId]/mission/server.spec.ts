import { generateSummonableCharacterDraft } from '@summonlab/characters';
import type { ActorDecisionView, CombatModeId, EngineSnapshot } from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	createCombatModeBinding,
	deterministicUuid,
	hashGameState
} from '@summonlab/engine';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	combatMode: 'agent-readiness-v1' as CombatModeId,
	snapshot: null as EngineSnapshot | null,
	commit: vi.fn(),
	createWindow: vi.fn()
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
			combatMode: 'agent-readiness-v1',
			developmentEngineVersion: 26
		}).snapshot;
	});

	beforeEach(() => {
		mocks.combatMode = 'agent-readiness-v1';
		mocks.snapshot = initial;
		mocks.commit.mockReset().mockImplementation(async (_databaseUrl, command) => {
			const applied = applyCommand(mocks.snapshot!.state, command);
			mocks.snapshot = { state: applied.state, stateHash: hashGameState(applied.state) };
			return { snapshot: mocks.snapshot, events: applied.events, legalActions: [] };
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

	it('binds the operator default when the attempt is prepared', async () => {
		const response = await call({ action: 'prepare', heroIds: [heroId] });

		expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
		expect(mocks.snapshot?.state).toMatchObject({
			mission: { attempt: { combatModeBinding: { modeId: 'agent-readiness-v1' } } }
		});
	});

	it('uses the stored readiness binding even after the operator default changes', async () => {
		mocks.snapshot = deployed('agent-readiness-v1');
		mocks.combatMode = 'legacy-auto-v1';

		const response = await call({ action: 'advance-automatic-combat' });
		const body = await response.json();

		expect(response.status, JSON.stringify(body)).toBe(200);
		expect(mocks.commit).not.toHaveBeenCalled();
		expect(mocks.createWindow).toHaveBeenCalledOnce();
		expect(mocks.createWindow.mock.calls[0]?.[1]).toMatchObject({
			runId: initial.state.runId,
			actors: expect.arrayContaining([
				expect.objectContaining({ requestedPolicy: 'scripted', maxProviderAttempts: 2 })
			])
		});
		expect(body).toMatchObject({ status: 'collecting', readyActors: 0 });
		expect(body).not.toHaveProperty('jobs');
		expect(JSON.stringify(body)).not.toContain('legalActions');
	});

	it('keeps a stored legacy attempt synchronous when the operator default changes', async () => {
		mocks.snapshot = deployed('legacy-auto-v1');
		mocks.combatMode = 'agent-readiness-v1';

		const response = await call({ action: 'advance-automatic-combat' });

		expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
		expect(mocks.commit).toHaveBeenCalledOnce();
		expect(mocks.commit.mock.calls[0]?.[1]).toMatchObject({
			commandType: 'mission.advance.automatic'
		});
		expect(mocks.createWindow).not.toHaveBeenCalled();
	});

	it('rejects client attempts to override the operator-owned mode', async () => {
		const response = await call({
			action: 'advance-automatic-combat',
			combatMode: 'legacy-auto-v1'
		});

		expect(response.status).toBe(400);
		expect(mocks.commit).not.toHaveBeenCalled();
		expect(mocks.createWindow).not.toHaveBeenCalled();
	});
});

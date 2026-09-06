import { generateSummonableCharacterDraft } from '@summonlab/characters';
import { EngineGameStateV25Schema, type EngineSnapshot } from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	createCombatModeBinding,
	deterministicUuid
} from '@summonlab/engine';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	combatMode: 'legacy-auto-v1' as 'legacy-auto-v1' | 'agent-readiness-v1',
	commit: vi.fn(),
	getSnapshot: vi.fn(),
	getProof: vi.fn()
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		databaseUrl: 'postgres://unused',
		combatMode: mocks.combatMode
	})
}));

vi.mock('@summonlab/database', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@summonlab/database')>();
	return {
		...actual,
		commitEngineCommand: mocks.commit,
		getEngineSnapshot: mocks.getSnapshot,
		getProofRun: mocks.getProof
	};
});

import { POST } from './+server.js';

let snapshot: EngineSnapshot;

function deployedLegacySnapshot(): EngineSnapshot {
	if (snapshot.state.schemaVersion !== 25) throw new Error('Expected v25 snapshot');
	const heroId = Object.keys(snapshot.state.heroes)[0]!;
	const source = {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
	const prepareId = deterministicUuid(`${snapshot.state.runId}:web-prepare`);
	const prepared = applyCommand(snapshot.state, {
		commandId: prepareId,
		runId: snapshot.state.runId,
		actorId: snapshot.state.master.masterId,
		expectedVersion: snapshot.state.version,
		correlationId: prepareId,
		source,
		commandType: 'mission.prepare',
		heroIds: [heroId],
		combatModeBinding: createCombatModeBinding('legacy-auto-v1', snapshot.state.simulatedAt)
	});
	if (prepared.state.schemaVersion !== 25) throw new Error('Expected prepared v25 state');
	const deployId = deterministicUuid(`${snapshot.state.runId}:web-deploy`);
	const deployed = applyCommand(prepared.state, {
		commandId: deployId,
		runId: prepared.state.runId,
		actorId: prepared.state.master.masterId,
		expectedVersion: prepared.state.version,
		correlationId: deployId,
		source,
		commandType: 'mission.deploy'
	});
	return { state: deployed.state, stateHash: deployed.stateHash };
}

async function callMission(body: unknown): Promise<Response> {
	return (await POST({
		params: { runId: snapshot.state.runId },
		request: new Request(`http://summonlab.test/api/runs/${snapshot.state.runId}/mission`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never)) as Response;
}

describe('V25 legacy automatic mission API', () => {
	beforeAll(async () => {
		const draft = await generateSummonableCharacterDraft({
			seed: 'web-legacy-auto-seed',
			generationVersion: 'human-v6',
			cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
		});
		snapshot = createBootstrapEngine({
			runId: deterministicUuid('web-legacy-auto-run'),
			seed: 'web-legacy-auto-engine',
			draft
		}).snapshot;
	});

	beforeEach(() => {
		mocks.combatMode = 'legacy-auto-v1';
		mocks.commit.mockReset();
		mocks.getSnapshot.mockReset().mockResolvedValue(snapshot);
		mocks.getProof.mockReset().mockResolvedValue({ manifest: {} });
		mocks.commit.mockResolvedValue({ snapshot, events: [], legalActions: [] });
	});

	it('binds the operator mode while the player supplies only party preparation', async () => {
		const heroId = Object.keys(snapshot.state.heroes)[0]!;
		const response = await callMission({ action: 'prepare', heroIds: [heroId] });

		expect(response.status).toBe(200);
		expect(mocks.commit).toHaveBeenCalledWith(
			'postgres://unused',
			expect.objectContaining({
				commandType: 'mission.prepare',
				heroIds: [heroId],
				combatModeBinding: expect.objectContaining({
					modeId: 'legacy-auto-v1',
					boundAt: snapshot.state.simulatedAt
				})
			})
		);
	});

	it('turns Continue battle into one internal automatic command with no player choices', async () => {
		// Advancing an existing attempt never rebinds from the current operator default.
		const deployed = deployedLegacySnapshot();
		mocks.getSnapshot.mockResolvedValue(deployed);
		mocks.commit.mockResolvedValue({ snapshot: deployed, events: [], legalActions: [] });
		mocks.combatMode = 'agent-readiness-v1';
		const response = await callMission({ action: 'advance-automatic-combat' });

		expect(response.status).toBe(200);
		const command = mocks.commit.mock.calls[0]?.[1];
		expect(command).toMatchObject({
			commandType: 'mission.advance.automatic',
			source: { source: 'manual', timing: 'step' }
		});
		expect(command).not.toHaveProperty('combatMode');
		expect(command).not.toHaveProperty('masterActionId');
		expect(command).not.toHaveProperty('choices');
		expect(command).not.toHaveProperty('targetId');
		expect(command).not.toHaveProperty('policy');
	});

	it('refuses the explicit not-yet-live mode from the stored attempt binding', async () => {
		const deployed = deployedLegacySnapshot();
		if (deployed.state.schemaVersion !== 25 || !deployed.state.mission.attempt) {
			throw new Error('Expected deployed v25 attempt');
		}
		const agentState = EngineGameStateV25Schema.parse({
			...deployed.state,
			mission: {
				...deployed.state.mission,
				attempt: {
					...deployed.state.mission.attempt,
					combatModeBinding: {
						...deployed.state.mission.attempt.combatModeBinding,
						modeId: 'agent-readiness-v1',
						rulesVersion: 'agent-readiness-rules-v1'
					}
				}
			}
		});
		mocks.getSnapshot.mockResolvedValue({ ...deployed, state: agentState });

		const response = await callMission({ action: 'advance-automatic-combat' });

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			message: 'Combat mode agent-readiness-v1 is not yet live'
		});
		expect(mocks.commit).not.toHaveBeenCalled();
	});

	it('rejects manual turn selection and injected policy fields for V25', async () => {
		const manual = await callMission({ action: 'resolve-turn', masterActionId: 'mission.hold' });
		expect(manual.status).toBe(409);
		expect(mocks.commit).not.toHaveBeenCalled();

		const injected = await callMission({
			action: 'advance-automatic-combat',
			policy: 'random'
		});
		expect(injected.status).toBe(400);
		expect(mocks.commit).not.toHaveBeenCalled();
	});
});

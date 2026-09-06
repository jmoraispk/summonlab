import { generateSummonableCharacterDraft } from '@summonlab/characters';
import type { EngineSnapshot } from '@summonlab/contracts';
import { createBootstrapEngine, deterministicUuid } from '@summonlab/engine';
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

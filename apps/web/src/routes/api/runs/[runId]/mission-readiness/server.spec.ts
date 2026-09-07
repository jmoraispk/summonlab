import { generateSummonableCharacterDraft } from '@summonlab/characters';
import { EngineGameStateV25Schema, type EngineSnapshot } from '@summonlab/contracts';
import { applyCommand, createBootstrapEngine, deterministicUuid } from '@summonlab/engine';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	commit: vi.fn(),
	getSnapshot: vi.fn(),
	getProof: vi.fn()
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({ databaseUrl: 'postgres://unused' })
}));

vi.mock('@summonlab/database', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@summonlab/database')>();
	return {
		...actual,
		commitEngineCommands: mocks.commit,
		getEngineSnapshot: mocks.getSnapshot,
		getProofRun: mocks.getProof
	};
});

import { POST } from './+server.js';

let snapshot: EngineSnapshot;
let heroId: string;

function callReturn(body: unknown = {}): Promise<Response> {
	return POST({
		params: { runId: snapshot.state.runId },
		request: new Request(
			`http://summonlab.test/api/runs/${snapshot.state.runId}/mission-readiness`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			}
		)
	} as never) as Promise<Response>;
}

describe('V25 mission-readiness return request', () => {
	beforeAll(async () => {
		const draft = await generateSummonableCharacterDraft(
			{
				seed: 'web-mission-readiness-return',
				generationVersion: 'human-v6',
				cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
			},
			{ capabilityEntropy: '9'.repeat(64) }
		);
		heroId = draft.manifest.characterId;
		const initial = createBootstrapEngine({
			runId: deterministicUuid('web-mission-readiness-return-run'),
			seed: 'web-mission-readiness-return-engine',
			draft
		}).snapshot;
		if (initial.state.schemaVersion !== 25) throw new Error('Expected v25 snapshot');
		const away = EngineGameStateV25Schema.parse({
			...initial.state,
			heroes: {
				...initial.state.heroes,
				[heroId]: {
					...initial.state.heroes[heroId]!,
					location: 'training-ground',
					locationNodeId: 'training-ring',
					firstArrivalCompleted: true
				}
			}
		});
		snapshot = { state: away, stateHash: initial.stateHash };
	});

	beforeEach(() => {
		mocks.commit.mockReset().mockImplementation(async (_databaseUrl, commands) => {
			let current = snapshot.state;
			const events = [];
			for (const command of commands) {
				const applied = applyCommand(current, command);
				current = applied.state;
				events.push(...applied.events);
			}
			return {
				snapshot: { state: current, stateHash: '0'.repeat(64) },
				events,
				legalActions: []
			};
		});
		mocks.getSnapshot.mockReset().mockResolvedValue(snapshot);
		mocks.getProof.mockReset().mockResolvedValue({ manifest: { characterId: heroId } });
	});

	it('atomically follows the existing travel route and scheduled arrival without teleporting', async () => {
		const response = await callReturn();

		expect(response.status).toBe(200);
		const commands = mocks.commit.mock.calls[0]?.[1];
		expect(commands).toHaveLength(2);
		expect(commands[0]).toMatchObject({
			commandType: 'hero.start.travel',
			actorId: heroId,
			targetNodeId: 'gate-dais',
			requestContext: 'mission-readiness',
			source: { source: 'system', timing: null }
		});
		expect(commands[1]).toMatchObject({
			commandType: 'simulation.advance',
			actorId: snapshot.state.master.masterId,
			correlationId: commands[0].correlationId
		});
		const receipt = await response.json();
		expect(Object.keys(receipt).toSorted()).toStrictEqual(
			['eventCursor', 'eventType', 'publicStateHash', 'runId', 'version'].toSorted()
		);
		expect(receipt).not.toHaveProperty('state');
		expect(receipt).not.toHaveProperty('events');
	});

	it('refuses busy heroes and non-empty request bodies before committing', async () => {
		if (snapshot.state.schemaVersion !== 25) throw new Error('Expected v25 snapshot');
		const busy = EngineGameStateV25Schema.parse({
			...snapshot.state,
			heroes: {
				...snapshot.state.heroes,
				[heroId]: {
					...snapshot.state.heroes[heroId]!,
					currentActivity: {
						activityId: deterministicUuid('web-readiness-busy-activity'),
						scheduledEventId: deterministicUuid('web-readiness-busy-schedule'),
						kind: 'rest',
						startedAt: snapshot.state.simulatedAt,
						completesAt: '2000-01-01T01:00:00.000Z'
					}
				}
			}
		});
		mocks.getSnapshot.mockResolvedValue({ ...snapshot, state: busy });

		const busyResponse = await callReturn();
		expect(busyResponse.status).toBe(409);
		expect(await busyResponse.json()).toStrictEqual({
			message: 'Finishing another activity.'
		});
		expect(mocks.commit).not.toHaveBeenCalled();

		const injected = await callReturn({ targetNodeId: 'gate-dais' });
		expect(injected.status).toBe(400);
		expect(mocks.commit).not.toHaveBeenCalled();
	});
});

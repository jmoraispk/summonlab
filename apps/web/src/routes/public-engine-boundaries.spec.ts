import { generateSummonableCharacterDraft } from '@summonlab/characters';
import {
	EngineReplayReportSchema,
	EngineGameStateV1Schema,
	ProofRunSnapshotV2Schema,
	type AuthoritativeEvent,
	type EngineCommit,
	type EngineReplayReport,
	type ProofRunSnapshotV2
} from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	createCombatModeBinding,
	deterministicUuid,
	legalActions,
	projectJournal,
	projectPlayerJournal,
	replayEventsStrict
} from '@summonlab/engine';
import { ENGINE_REPLAY_VECTOR_CASES } from '../../../../packages/engine/src/compatibility/replay-vectors.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	report: null as EngineReplayReport | null,
	proof: null as ProofRunSnapshotV2 | null,
	events: [] as AuthoritativeEvent[],
	commit: null as EngineCommit | null,
	devRoutesEnabled: true,
	closed: false
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		databaseUrl: 'postgres://unused',
		devRoutesEnabled: mocks.devRoutesEnabled,
		combatMode: 'legacy-auto-v1'
	})
}));

vi.mock('@summonlab/database', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@summonlab/database')>();
	return {
		...actual,
		catchUpRun: vi.fn(),
		getEngineReplay: vi.fn(async () => mocks.report),
		getEngineSnapshot: vi.fn(async () => mocks.report?.snapshot ?? null),
		commitEngineCommand: vi.fn(async () => mocks.commit),
		getProofRun: vi.fn(async () => mocks.proof),
		markProofArrival: vi.fn(async () => mocks.proof),
		resolveProofDecision: vi.fn(async () => mocks.proof),
		getSimulationClock: vi.fn(async () => mocks.report?.clock ?? null),
		getEngineEventHead: vi.fn(async () =>
			mocks.report
				? {
						runId: mocks.report.runId,
						version: mocks.report.snapshot.state.version,
						eventCursor: mocks.report.snapshot.state.eventCursor,
						stateHash: mocks.report.snapshot.stateHash,
						gameTime: mocks.report.snapshot.state.simulatedAt
					}
				: null
		),
		getEngineEventPage: vi.fn(async (_databaseUrl: string, runId: string, after: number) => ({
			runId,
			requestedAfter: after,
			nextCursor: mocks.events.at(-1)?.sequence ?? after,
			latestCursor: mocks.events.at(-1)?.sequence ?? after,
			hasMore: false,
			gap: null,
			events: mocks.events.filter((event) => event.sequence > after)
		})),
		subscribeToEngineEventCursor: vi.fn(async () => ({
			close: async () => {
				mocks.closed = true;
			}
		}))
	};
});

import { GET as getReplayApi } from './api/dev/replays/[runId]/+server.js';
import { GET as getDecisionContext } from './api/runs/[runId]/decision-context/+server.js';
import { GET as getDecisionPreview } from './api/runs/[runId]/decision-preview/+server.js';
import { GET as getEvents } from './api/runs/[runId]/events/+server.js';
import { POST as postMission } from './api/runs/[runId]/mission/+server.js';
import { GET as getProof } from './api/runs/[runId]/+server.js';
import { POST as decideProof } from './api/runs/[runId]/decide/+server.js';
import { POST as arriveProof } from './api/runs/[runId]/arrive/+server.js';
import { projectEngineStateForPublic } from '../lib/server/public-engine-presentation.js';
import { load as loadMission } from './mission/[runId]/+page.server.js';
import { load as loadPlay } from './play/[runId]/+page.server.js';
import { load as loadReplay } from './replay/[runId]/+page.server.js';
import { load as loadSummon } from './summon/[runId]/+page.server.js';

function expectExactKeys(value: unknown, keys: readonly string[]): void {
	expect(value).not.toBeNull();
	expect(typeof value).toBe('object');
	expect(Object.keys(value as Record<string, unknown>).sort()).toEqual([...keys].sort());
}

function source() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

beforeAll(async () => {
	const runId = deterministicUuid('public-engine-boundary-run');
	const draft = await generateSummonableCharacterDraft({
		seed: 'private-character-seed',
		generationVersion: 'human-v6',
		cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
	});
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'private-engine-master-seed',
		draft
	});
	if (bootstrap.snapshot.state.schemaVersion !== 25) throw new Error('Expected v25 state');
	const heroId = draft.manifest.characterId;
	const prepareId = deterministicUuid('public-engine-boundary-prepare');
	const prepared = applyCommand(bootstrap.snapshot.state, {
		commandId: prepareId,
		runId,
		actorId: bootstrap.snapshot.state.master.masterId,
		expectedVersion: bootstrap.snapshot.state.version,
		correlationId: prepareId,
		source: source(),
		commandType: 'mission.prepare',
		heroIds: [heroId],
		combatModeBinding: createCombatModeBinding(
			'legacy-auto-v1',
			bootstrap.snapshot.state.simulatedAt
		)
	});
	if (prepared.state.schemaVersion !== 25) throw new Error('Expected prepared v25 state');
	const deployId = deterministicUuid('public-engine-boundary-deploy');
	const deployed = applyCommand(prepared.state, {
		commandId: deployId,
		runId,
		actorId: prepared.state.master.masterId,
		expectedVersion: prepared.state.version,
		correlationId: deployId,
		source: source(),
		commandType: 'mission.deploy'
	});
	if (deployed.state.schemaVersion !== 25) throw new Error('Expected deployed v25 state');
	const advanceId = deterministicUuid('public-engine-boundary-round');
	const advanced = applyCommand(deployed.state, {
		commandId: advanceId,
		runId,
		actorId: deployed.state.master.masterId,
		expectedVersion: deployed.state.version,
		correlationId: advanceId,
		source: source(),
		commandType: 'mission.advance.automatic'
	});
	if (advanced.state.schemaVersion !== 25) throw new Error('Expected advanced v25 state');
	mocks.events = [bootstrap.event, ...prepared.events, ...deployed.events, ...advanced.events];
	const replay = replayEventsStrict(mocks.events);
	if (replay.snapshot.state.schemaVersion !== 25) throw new Error('Expected replayed v25 state');
	const actorIds = [
		replay.snapshot.state.master.masterId,
		...Object.keys(replay.snapshot.state.heroes)
	];
	const stateHash = replay.snapshot.stateHash;
	mocks.report = EngineReplayReportSchema.parse({
		runId,
		verified: true,
		eventCount: mocks.events.length,
		checks: replay.checks,
		journalEntries: projectJournal(mocks.events),
		playerJournal: projectPlayerJournal(mocks.events),
		scheduledEvents: [],
		clock: {
			runId,
			speed: 1,
			anchorGameTime: advanced.state.simulatedAt,
			anchorRealTime: advanced.state.simulatedAt,
			currentGameTime: advanced.state.simulatedAt,
			projectedGameTime: advanced.state.simulatedAt,
			lastCatchUpAt: null,
			nextDueGameTime: null,
			nextDueRealTime: null,
			backlogGameMinutes: 0,
			leaseStatus: 'idle'
		},
		snapshot: replay.snapshot,
		persistedStateHash: stateHash,
		hashMatchesPersistedSnapshot: true,
		legalActions: legalActions(replay.snapshot.state, replay.snapshot.state.master.masterId),
		legalActionsByActor: Object.fromEntries(
			actorIds.map((actorId) => [actorId, legalActions(replay.snapshot.state, actorId)])
		)
	});
	mocks.commit = {
		snapshot: replay.snapshot,
		events: [...advanced.events],
		scheduled: [],
		resolvedScheduledEventIds: [],
		canceledScheduledEventIds: [],
		legalActions: [...legalActions(replay.snapshot.state, replay.snapshot.state.master.masterId)],
		idempotentReplay: false
	};
	mocks.proof = ProofRunSnapshotV2Schema.parse({
		runId,
		characterSchemaVersion: 'character-v2',
		storyEnvelopeId: 'first-ember-v1',
		controlMode: 'wait',
		directive: '',
		recipe: draft.recipe,
		manifest: draft.manifest,
		mind: draft.mind,
		capabilityProfile: draft.capabilityProfile,
		manifestHash: draft.manifestHash,
		firstObservation: 'A sealed gate cools behind the summoned hero.',
		firstLine: null,
		destination: 'kitchen',
		storyBranch: 'first-ember-kitchen',
		arrived: true,
		events: [],
		createdAt: advanced.state.simulatedAt
	});
	if (mocks.report.snapshot.state.schemaVersion !== 25) throw new Error('Expected public v25 fixture');
	const internalState = mocks.report.snapshot.state as unknown as Record<string, unknown>;
	internalState.futurePrivateSentinel = 'never-serialize-state-sentinel';
	(mocks.report.snapshot.state.master as unknown as Record<string, unknown>).futurePrivateSentinel =
		'never-serialize-master-sentinel';
	const internalHero = Object.values(mocks.report.snapshot.state.heroes)[0] as unknown as Record<
		string,
		unknown
	>;
	internalHero.futurePrivateSentinel = 'never-serialize-hero-sentinel';
	const internalMission = mocks.report.snapshot.state.mission as unknown as Record<string, unknown>;
	internalMission.futurePrivateSentinel = 'never-serialize-mission-sentinel';
	const internalRound = mocks.report.snapshot.state.mission.attempt!.turnState.rounds[0] as unknown as Record<
		string,
		unknown
	>;
	internalRound.futurePrivateSentinel = 'never-serialize-round-sentinel';
	(internalRound.actions as Record<string, unknown>[])[0]!.futurePrivateSentinel =
		'never-serialize-action-sentinel';
	(mocks.events.at(-1)!.payload as Record<string, unknown>).futurePrivateSentinel =
		'never-serialize-event-sentinel';
	(mocks.report.playerJournal as unknown as Record<string, unknown>).futurePrivateSentinel =
		'never-serialize-journal-sentinel';
	(mocks.report.playerJournal.entries[0] as unknown as Record<string, unknown>).futurePrivateSentinel =
		'never-serialize-journal-entry-sentinel';
	(mocks.proof as unknown as Record<string, unknown>).futurePrivateSentinel =
		'never-serialize-proof-sentinel';
	// Prove the fixture contains secrets and unknown future fields before projection.
	expect(JSON.stringify(mocks.events)).toContain('private-engine-master-seed');
	expect(JSON.stringify(mocks.report)).toContain('never-serialize-state-sentinel');
});

function expectPublicBoundary(value: unknown): void {
	const serialized = JSON.stringify(value);
	expect(serialized).not.toContain('private-engine-master-seed');
	expect(serialized).not.toContain('private-character-seed');
	expect(serialized).not.toContain('cognitiveLearningScore');
	expect(serialized).not.toContain('domainAptitudes');
	expect(serialized).not.toContain('never-serialize-');
}

async function readEngineEvent(
	response: Response,
	wantedSequence: number
): Promise<Record<string, unknown>> {
	if (!response.body) throw new Error('Expected event stream body');
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) throw new Error('Stream ended before an engine event');
			buffer += decoder.decode(chunk.value, { stream: true });
			for (const frame of buffer.split('\n\n')) {
				if (!frame.includes('event: engine-event')) continue;
				const data = frame
					.split('\n')
					.find((line) => line.startsWith('data: '))
					?.slice(6);
				if (data) {
					const parsed = JSON.parse(data) as Record<string, unknown>;
					if (parsed.sequence === wantedSequence) {
						expect(buffer).not.toContain('private-engine-master-seed');
						expect(buffer).not.toContain('private-character-seed');
						expect(buffer).not.toContain('cognitiveLearningScore');
						expect(buffer).not.toContain('never-serialize-');
						return parsed;
					}
				}
			}
		}
	} finally {
		await reader.cancel();
	}
}

describe('player-facing engine boundaries', () => {
	it('projects representative frozen v1-v24 states through the public compatibility shape', () => {
		const legacyRunId = deterministicUuid('public-projection-v1-run');
		const legacyHeroId = deterministicUuid('public-projection-v1-hero');
		const v1 = EngineGameStateV1Schema.parse({
			schemaVersion: 1,
			runId: legacyRunId,
			seed: 'historical-private-seed',
			contentVersion: 'engine-v1',
			status: 'active',
			version: 0,
			eventCursor: 1,
			entropyCursor: 0,
			simulatedAt: '2000-01-01T00:00:00.000Z',
			master: {
				masterId: deterministicUuid(`${legacyRunId}:master`),
				lifeState: 'alive',
				location: 'summoning-gate',
				health: 100,
				maxHealth: 100,
				gateInspectionCount: 0,
				lastGateResonance: null
			},
			heroes: {
				[legacyHeroId]: {
					heroId: legacyHeroId,
					lifeState: 'active',
					location: 'summoning-gate',
					destination: null,
					health: 100,
					maxHealth: 100,
					manifestHash: 'a'.repeat(64)
				}
			},
			story: { envelopeId: 'first-ember-v1', branch: null }
		});
		const historical = [v1, ...ENGINE_REPLAY_VECTOR_CASES.map((entry) => entry.finalState)];
		for (const state of historical) {
			const projected = projectEngineStateForPublic(state);
			expect(projected.schemaVersion).toBe(state.schemaVersion);
			expect(projected.runId).toBe(state.runId);
			expect(JSON.stringify(projected)).not.toContain(state.seed);
		}
		expect(new Set(historical.map((state) => state.schemaVersion))).toEqual(
			new Set([1, 5, 8, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24])
		);
	});

	it('constructs nested state from positive allowlists and drops unknown sentinels', () => {
		const projected = projectEngineStateForPublic(mocks.report!.snapshot.state);
		expectExactKeys(projected, [
			'schemaVersion',
			'runId',
			'contentVersion',
			'status',
			'version',
			'eventCursor',
			'simulatedAt',
			'master',
			'heroes',
			'items',
			'settlement',
			'mission',
			'masterControl'
		]);
		expectExactKeys(projected.master, [
			'masterId', 'lifeState', 'location', 'health', 'maxHealth', 'injuries'
		]);
		const hero = Object.values(projected.heroes)[0]!;
		expectExactKeys(hero, [
			'heroId',
			'lifeState',
			'location',
			'destination',
			'health',
			'maxHealth',
			'mana',
			'maxMana',
			'manifestHash',
			'progression',
			'equipment',
			'capabilityProfile'
		]);
		expectExactKeys(hero.capabilityProfile, ['profileVersion', 'attributes']);
		const round = projected.mission.attempt!.turnState.rounds[0]!;
		expectExactKeys(round.actions[0], [
			'actorId',
			'actorKind',
			'actionId',
			'publicIntent',
			'outcome',
			'fromNodeId',
			'toNodeId',
			'targetId',
			'discoveryIds',
			'objectiveTransition',
			'effectIds',
			'summary'
		]);
		expectPublicBoundary(projected);
	});

	it('projects the mission SSR payload without private authoritative state', async () => {
		const result = await loadMission({ params: { runId: mocks.report!.runId } } as never);
		if (!result) throw new Error('Expected mission page data');
		expectPublicBoundary(result);
		expect(result).toMatchObject({
			report: {
				snapshot: {
					state: {
						schemaVersion: 25,
						mission: { attempt: { combatModeBinding: { modeId: 'legacy-auto-v1' } } }
					}
				}
			}
		});
		expectExactKeys(result.report.snapshot.state, [
			'schemaVersion', 'runId', 'contentVersion', 'status', 'version', 'eventCursor',
			'simulatedAt', 'master', 'heroes', 'items', 'settlement', 'mission', 'masterControl'
		]);
	});

	it('projects replay SSR and refresh responses to the same public contract', async () => {
		const page = await loadReplay({ params: { runId: mocks.report!.runId } } as never);
		expectPublicBoundary(page);
		const response = (await getReplayApi({
			params: { runId: mocks.report!.runId }
		} as never)) as Response;
		expect(response.status).toBe(200);
		expectPublicBoundary(await response.json());
	});

	it('uses the strict public proof shape on GET, resolved decide, arrive, summon, and play', async () => {
		mocks.devRoutesEnabled = false;
		try {
			const runId = mocks.report!.runId;
			const [getResponse, decideResponse, arriveResponse, summonPage, playPage] = await Promise.all([
				getProof({ params: { runId } } as never) as Promise<Response>,
				decideProof({
					params: { runId },
					request: new Request(`http://summonlab.test/api/runs/${runId}/decide`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ directive: '', trigger: 'step' })
					})
				} as never) as Promise<Response>,
				arriveProof({
					params: { runId },
					request: new Request(`http://summonlab.test/api/runs/${runId}/arrive`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: '{}'
					})
				} as never) as Promise<Response>,
				loadSummon({ params: { runId } } as never),
				loadPlay({ params: { runId } } as never)
			]);
			const payloads = [
				await getResponse.json(),
				await decideResponse.json(),
				await arriveResponse.json(),
				(summonPage as { snapshot: unknown }).snapshot,
				(playPage as { snapshot: unknown }).snapshot
			];
			for (const payload of payloads) {
				expectExactKeys(payload, [
					'runId', 'characterSchemaVersion', 'storyEnvelopeId', 'controlMode', 'manifest',
					'manifestHash', 'firstObservation', 'firstLine', 'destination', 'storyBranch',
					'arrived', 'events', 'createdAt', 'capabilityProfile'
				]);
				expectPublicBoundary(payload);
				expect(payload).not.toHaveProperty('recipe');
				expect(payload).not.toHaveProperty('mind');
			}
			expectPublicBoundary(summonPage);
			expectPublicBoundary(playPage);
			expect((summonPage as { decisionPreview: unknown }).decisionPreview).toBeNull();
		} finally {
			mocks.devRoutesEnabled = true;
		}
	});

	it('projects every SSE event from after=0 without payload secrets', async () => {
		mocks.closed = false;
		const controller = new AbortController();
		const response = (await getEvents({
			params: { runId: mocks.report!.runId },
			request: new Request(`http://summonlab.test/api/runs/${mocks.report!.runId}/events?after=0`, {
				signal: controller.signal
			}),
			url: new URL(`http://summonlab.test/api/runs/${mocks.report!.runId}/events?after=0`)
		} as never)) as Response;
		const finalEvent = mocks.events.at(-1)!;
		const event = await readEngineEvent(response, finalEvent.sequence);
		expectPublicBoundary(event);
		expectExactKeys(event, [
			'eventId', 'runId', 'sequence', 'schemaVersion', 'gameTime', 'eventType', 'actorId',
			'source', 'beforeStateHash', 'afterStateHash', 'contentVersion', 'summary',
			'initiativeOrder', 'actions', 'rewardDeltas', 'combatModeBinding'
		]);
		const eventActions = event.actions as Record<string, unknown>[];
		expectExactKeys(eventActions[0], [
			'actorId', 'actorKind', 'actionId', 'publicIntent', 'outcome'
		]);
		expectExactKeys(event.source, ['source', 'timing']);
		expect(event).toMatchObject({
			runId: mocks.report!.runId,
			sequence: finalEvent.sequence,
			eventType: finalEvent.eventType,
			combatModeBinding: { modeId: 'legacy-auto-v1' },
			actions: expect.arrayContaining([
				expect.objectContaining({ publicIntent: expect.any(String), outcome: 'applied' })
			])
		});
		expect(event).not.toHaveProperty('payload');
		controller.abort();
	});

	it('publishes initiative order without numeric values that recover tie breaks', async () => {
		const page = await loadMission({ params: { runId: mocks.report!.runId } } as never);
		if (!page) throw new Error('Expected mission page data');
		const round = page.report.snapshot.state.mission.attempt!.turnState.rounds[0]!;
		expect(round.initiativeOrder.length).toBeGreaterThan(1);
		expect(round.actions[0]).not.toHaveProperty('initiative');
		expect(round.actions[0]).not.toHaveProperty('initiativeBase');
		expect(round.actions[0]).not.toHaveProperty('initiativeTieBreak');
		expect(round.monsterActions[0]).not.toHaveProperty('initiative');
		expect(JSON.stringify(page)).not.toContain('initiativeBase');
	});

	it('returns only the minimal public receipt from a mission mutation', async () => {
		const response = (await postMission({
			params: { runId: mocks.report!.runId },
			request: new Request('http://summonlab.test/mission', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'advance-automatic-combat' })
			})
		} as never)) as Response;
		expect(response.status).toBe(200);
		const body = await response.json();
		expectExactKeys(body, ['runId', 'version', 'eventCursor', 'stateHash', 'eventType']);
		expectPublicBoundary(body);
	});

	it('development-gates raw decision packet inspectors', async () => {
		mocks.devRoutesEnabled = false;
		try {
			const args = {
				params: { runId: mocks.report!.runId },
				url: new URL(`http://summonlab.test/api/runs/${mocks.report!.runId}/decision-context`)
			} as never;
			const [context, preview] = await Promise.all([
				getDecisionContext(args) as Promise<Response>,
				getDecisionPreview(args) as Promise<Response>
			]);
			expect(context.status).toBe(404);
			expect(preview.status).toBe(404);
		} finally {
			mocks.devRoutesEnabled = true;
		}
	});

	it('retains public round intent, outcome, mode binding, and hash evidence', async () => {
		const response = (await getReplayApi({
			params: { runId: mocks.report!.runId }
		} as never)) as Response;
		const body = (await response.json()) as Record<string, unknown>;
		expectPublicBoundary(body);
		expect(JSON.stringify(body)).toContain('legacy-auto-v1');
		expect(JSON.stringify(body)).toContain('publicIntent');
		expect(JSON.stringify(body)).toContain('afterStateHash');
		expect(JSON.stringify(body)).toContain(mocks.report!.snapshot.stateHash);
	});
});

import { generateSummonableCharacterDraft } from '@summonlab/characters';
import {
	EngineReplayReportSchema,
	ProofRunSnapshotV2Schema,
	type AuthoritativeEvent,
	type EngineReplayReport,
	type ProofRunSnapshotV2
} from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	createCombatModeBinding,
	deterministicUuid,
	hashCanonical,
	legalActions,
	projectJournal,
	projectPlayerJournal,
	replayEventsStrict
} from '@summonlab/engine';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	report: null as EngineReplayReport | null,
	proof: null as ProofRunSnapshotV2 | null,
	events: [] as AuthoritativeEvent[],
	closed: false
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		databaseUrl: 'postgres://unused',
		devRoutesEnabled: true,
		combatMode: 'legacy-auto-v1'
	})
}));

vi.mock('@summonlab/database', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@summonlab/database')>();
	return {
		...actual,
		catchUpRun: vi.fn(),
		getEngineReplay: vi.fn(async () => mocks.report),
		getProofRun: vi.fn(async () => mocks.proof),
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
import { GET as getEvents } from './api/runs/[runId]/events/+server.js';
import { projectPublicEngineValue } from '../lib/server/public-engine-presentation.js';
import { load as loadMission } from './mission/[runId]/+page.server.js';
import { load as loadReplay } from './replay/[runId]/+page.server.js';

const PRIVATE_KEYS = new Set([
	'seed',
	'entropyCursor',
	'entropyDraws',
	'learning',
	'cognitiveLearningScore',
	'domainAptitudes',
	'legalActions',
	'legalActionsByActor',
	'legalActionHash',
	'packetHash',
	'policyResultHash',
	'providerRequest',
	'providerResponse',
	'privateReasoning',
	'reasoning',
	'reasoningTokens',
	'decisionJobId',
	'initiativeTieBreak',
	'candidateScores',
	'decisionRecommended',
	'fallbackUsed',
	'orderScore',
	'preferenceWeight'
]);
const PRIVATE_SOCIAL_KEYS = new Set(['observations', 'beliefs', 'relationships', 'authority']);

function privatePaths(value: unknown, path = '$'): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((entry, index) => privatePaths(entry, `${path}[${index}]`));
	}
	if (value === null || typeof value !== 'object') return [];
	const record = value as Record<string, unknown>;
	const paths: string[] = [];
	if (record.delivery === 'private' || record.visibility === 'private') paths.push(path);
	for (const [key, entry] of Object.entries(record)) {
		const childPath = `${path}.${key}`;
		if (
			PRIVATE_KEYS.has(key) ||
			(path.endsWith('.society') && PRIVATE_SOCIAL_KEYS.has(key)) ||
			/(?:^|_)(?:private|provider|reasoning)(?:$|_)/iu.test(key)
		) {
			paths.push(childPath);
		}
		paths.push(...privatePaths(entry, childPath));
	}
	return paths;
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
		destination: null,
		storyBranch: null,
		arrived: false,
		events: [],
		createdAt: advanced.state.simulatedAt
	});
	// Prove the fixture contains the exact secrets the public projections must remove.
	expect(privatePaths(mocks.report)).not.toEqual([]);
	expect(JSON.stringify(mocks.events)).toContain('private-engine-master-seed');
});

function expectPublicBoundary(value: unknown): void {
	expect(privatePaths(value)).toEqual([]);
	const serialized = JSON.stringify(value);
	expect(serialized).not.toContain('private-engine-master-seed');
	expect(serialized).not.toContain('private-character-seed');
	expect(serialized).not.toContain('cognitiveLearningScore');
	expect(serialized).not.toContain('domainAptitudes');
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
					if (parsed.sequence === wantedSequence) return parsed;
				}
			}
		}
	} finally {
		await reader.cancel();
	}
}

describe('player-facing engine boundaries', () => {
	it('redacts invertible learning factors and private provider records', () => {
		const projected = projectPublicEngineValue({
			publicSummary: 'Practice improved.',
			cognitiveFactorBasisPoints: 10_700,
			domainAptitudeFactorBasisPoints: 11_200,
			providerPacket: { actionId: 'private.action', publicIntent: 'not actually public here' },
			privateRecord: { delivery: 'private', exactText: 'holder-only knowledge' }
		});

		expect(projected).toEqual({ publicSummary: 'Practice improved.' });
	});

	it('projects the mission SSR payload without private authoritative state', async () => {
		const result = await loadMission({ params: { runId: mocks.report!.runId } } as never);
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

	it('retains public round intent, outcome, mode binding, and hash evidence', async () => {
		const response = (await getReplayApi({
			params: { runId: mocks.report!.runId }
		} as never)) as Response;
		const body = (await response.json()) as Record<string, unknown>;
		expectPublicBoundary(body);
		expect(JSON.stringify(body)).toContain('legacy-auto-v1');
		expect(JSON.stringify(body)).toContain('publicIntent');
		expect(JSON.stringify(body)).toContain('afterStateHash');
		expect(JSON.stringify(body)).toContain(hashCanonical(mocks.report!.snapshot.state));
	});
});

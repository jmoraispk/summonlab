import type { EngineCommand, EngineGameState } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from '../errors.js';
import { deterministicUuid, hashCanonical, sha256Hex } from '../hash.js';
import { applyCommand } from './apply-command.js';
import { createBootstrapEngine } from './bootstrap.js';
import {
	canceledScheduledEventIdsFromEvent,
	resolvedScheduledEventIdsFromEvent,
	scheduledEventsFromEvent
} from './event-outputs.js';
import { reduceEvent } from './reduction.js';
import { replayEvents, replayEventsStrict } from './replay.js';

function freezeDeep<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) freezeDeep(child);
	}
	return value;
}

const manualSource = {
	source: 'manual' as const,
	timing: 'step' as const,
	fallbackPolicy: null,
	directiveIds: [] as string[],
	decisionJobId: null
};

function commandEnvelope(state: EngineGameState, actorId: string, key: string) {
	const commandId = deterministicUuid(key);
	return {
		commandId,
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: manualSource
	};
}

function bootstrapFixture() {
	const runId = deterministicUuid('task12-run');
	const heroId = deterministicUuid('task12-hero');
	return {
		runId,
		heroId,
		bootstrap: createBootstrapEngine({
			runId,
			seed: 'task12-seed',
			heroId,
			manifestHash: 'a'.repeat(64),
			simulatedAt: '0042-03-01T08:15:00.000Z'
		})
	};
}

describe('orchestration facade owners', () => {
	it('preserves the frozen bootstrap state, event, and complete result hashes', () => {
		const { bootstrap } = bootstrapFixture();

		expect(bootstrap.snapshot.stateHash).toBe(
			'c10ef25cafac9dabbba8b6584a93a01da78b680d0a956b2ec145162cb83972e0'
		);
		expect(hashCanonical(bootstrap.event)).toBe(
			'3dd5a80ce14442a7898194d8360563cdee9a2125c4f2363306720dfeab5812d5'
		);
		expect(hashCanonical(bootstrap)).toBe(
			'2790f0ab4dadc7f780ab35d7d27c25709ed99afbe96299d8b48bc68ec1c01203'
		);
		expect(bootstrap.event).toMatchObject({
			sequence: 1,
			eventType: 'run.initialized',
			beforeStateHash: '74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b',
			afterStateHash: bootstrap.snapshot.stateHash,
			seedCursor: 0,
			payload: { initialState: bootstrap.snapshot.state }
		});
	});

	it('preserves every field of a successful apply transaction', () => {
		const { bootstrap, heroId, runId } = bootstrapFixture();
		const commandId = deterministicUuid('task12-choose');
		const result = applyCommand(bootstrap.snapshot.state, {
			commandId,
			runId,
			actorId: heroId,
			expectedVersion: 0,
			correlationId: commandId,
			source: {
				source: 'scripted',
				timing: 'continuous',
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Steel before trust.',
			storyBranch: 'steel-before-trust'
		});

		expect(hashCanonical(result)).toBe(
			'd1fa4dfcb6afc90f9efe49b3e0d96f848071d84ef29d66fb190656c006a28b45'
		);
		expect(result).toMatchObject({
			stateHash: '0eb00e545445c722bd90180e4374a335e0b2cc536e5c2d22eea70a445884d1f2',
			scheduled: [],
			resolvedScheduledEventIds: [],
			canceledScheduledEventIds: [],
			decisionRequests: [],
			legalActions: [
				{
					actionId: 'hero.travel',
					actorId: heroId,
					kind: 'move',
					label: 'Walk to the training ground',
					targetIds: [],
					resourceCosts: {},
					tags: ['settlement', 'arrival']
				}
			]
		});
		expect(result.events).toHaveLength(1);
		expect(result.events[0]).toMatchObject({
			sequence: 2,
			eventType: 'hero.destination.selected',
			beforeStateHash: bootstrap.snapshot.stateHash,
			afterStateHash: result.stateHash
		});
	});

	it('attaches and reduces a frozen directive influence before hashing the event', () => {
		const runId = deterministicUuid('task12-directive-run');
		const heroId = deterministicUuid('task12-directive-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'task12-directive-seed',
			heroId,
			manifestHash: 'b'.repeat(64)
		});
		const issued = applyCommand(bootstrap.snapshot.state, {
			...commandEnvelope(
				bootstrap.snapshot.state,
				bootstrap.snapshot.state.master.masterId,
				'task12-issue'
			),
			commandType: 'master.issue.directive',
			text: 'Choose the training ground and prepare.',
			scope: 'decision',
			recipientIds: [heroId],
			priorities: ['training'],
			tone: 'firm',
			delivery: 'private'
		});
		if (issued.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const directive = Object.values(issued.state.society.directives)[0]!;
		const followId = deterministicUuid('task12-follow');
		const chosen = applyCommand(issued.state, {
			...commandEnvelope(issued.state, heroId, 'task12-follow'),
			source: {
				source: 'scripted',
				timing: 'continuous',
				fallbackPolicy: null,
				directiveIds: [directive.directiveId],
				decisionJobId: deterministicUuid('task12-decision')
			},
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'I will prepare.',
			storyBranch: 'steel-before-trust'
		});
		if (chosen.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');

		expect(chosen.events[0]).toMatchObject({
			eventId: '5e4be832-066e-4275-a2d8-97deacb3134f',
			commandId: followId,
			afterStateHash: chosen.stateHash,
			payload: {
				directiveInfluences: [
					{
						influenceId: '33f1a8e2-46db-4b0e-a10b-7682adc97cb3',
						directiveId: 'b6003a71-f603-48d2-bfef-f62930b1ed6d',
						heroId,
						sourceEventId: '5e4be832-066e-4275-a2d8-97deacb3134f',
						decisionJobId: '9f7c0a17-3d01-4955-955d-af2bf7866e15',
						actionId: 'hero.choose.training-ground',
						outcome: 'advanced',
						evaluatedAt: '2000-01-01T00:00:00.000Z'
					}
				]
			}
		});
		expect(issued.state.society.directives[directive.directiveId]?.status).toBe('active');
		expect(chosen.state.society.directives[directive.directiveId]).toMatchObject({
			status: 'consumed',
			terminalEventId: chosen.events[0]!.eventId
		});
	});

	it('decodes scheduled, resolved, and canceled outputs without recreating domain policy', () => {
		const runId = deterministicUuid('task12-output-run');
		const heroId = deterministicUuid('task12-output-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'task12-output-seed',
			heroId,
			manifestHash: 'c'.repeat(64)
		});
		const chosen = applyCommand(bootstrap.snapshot.state, {
			...commandEnvelope(bootstrap.snapshot.state, heroId, 'task12-output-choose'),
			commandType: 'hero.choose.destination',
			destination: 'kitchen',
			firstLine: 'Names first.',
			storyBranch: 'names-before-orders'
		});
		const traveling = applyCommand(chosen.state, {
			...commandEnvelope(chosen.state, heroId, 'task12-output-travel'),
			commandType: 'hero.start.travel',
			targetNodeId: 'kitchen-table'
		});
		const scheduledEventId = '661b827f-ce8a-4372-a8ad-12c0c394c8d4';
		expect(scheduledEventsFromEvent(traveling.events[0]!)).toEqual([
			{
				scheduledEventId,
				runId,
				actorId: heroId,
				dueGameTime: '2000-01-01T00:02:04.000Z',
				eventKind: 'hero.travel.arrive',
				payload: {
					heroId,
					travelId: 'e1e652f6-5dae-4a7d-8cad-9e266cb54d34',
					fromNodeId: 'gate-dais',
					toNodeId: 'kitchen-table',
					settlementContentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9'
				}
			}
		]);

		const advanced = applyCommand(traveling.state, {
			...commandEnvelope(traveling.state, traveling.state.master.masterId, 'task12-output-advance'),
			source: { ...manualSource, source: 'system', timing: null },
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		expect(resolvedScheduledEventIdsFromEvent(advanced.events[0]!)).toEqual([scheduledEventId]);

		const died = applyCommand(traveling.state, {
			...commandEnvelope(traveling.state, traveling.state.master.masterId, 'task12-output-die'),
			source: { ...manualSource, source: 'system', timing: null },
			commandType: 'simulation.apply.damage',
			targetId: heroId,
			amount: 100,
			damageKind: 'hazard'
		});
		expect(canceledScheduledEventIdsFromEvent(died.events[0]!)).toEqual([scheduledEventId]);
	});

	it('preserves authorization error identity, payload, and wrong-run precedence', () => {
		const { bootstrap, heroId } = bootstrapFixture();
		const stale = {
			...commandEnvelope(bootstrap.snapshot.state, heroId, 'task12-stale'),
			expectedVersion: 1,
			commandType: 'hero.arrive' as const
		};
		expect(() => applyCommand(bootstrap.snapshot.state, stale)).toThrow(StaleStateVersionError);

		const illegal = { ...stale, expectedVersion: 0 };
		expect(() => applyCommand(bootstrap.snapshot.state, illegal)).toThrow(IllegalActionError);

		const wrongRunAndStale = {
			...stale,
			runId: deterministicUuid('task12-wrong-run')
		};
		let error: unknown;
		try {
			applyCommand(bootstrap.snapshot.state, wrongRunAndStale);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(IllegalActionError);
		expect(error).not.toBeInstanceOf(StaleStateVersionError);
		expect(error).toMatchObject({
			message: 'Action is not legal in the current state: hero.arrive',
			code: 'ILLEGAL_ACTION',
			legalActionIds: []
		});
	});

	it('rejects directive reducer provenance tampering before accepting the next state', () => {
		const runId = deterministicUuid('task12-tamper-run');
		const heroId = deterministicUuid('task12-tamper-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'task12-tamper-seed',
			heroId,
			manifestHash: 'd'.repeat(64)
		});
		const issued = applyCommand(bootstrap.snapshot.state, {
			...commandEnvelope(
				bootstrap.snapshot.state,
				bootstrap.snapshot.state.master.masterId,
				'task12-tamper-issue'
			),
			commandType: 'master.issue.directive',
			text: 'Choose the training ground.',
			scope: 'decision',
			recipientIds: [heroId],
			priorities: ['training'],
			tone: 'firm',
			delivery: 'private'
		});
		if (issued.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const directive = Object.values(issued.state.society.directives)[0]!;
		const chosen = applyCommand(issued.state, {
			...commandEnvelope(issued.state, heroId, 'task12-tamper-follow'),
			source: {
				source: 'scripted',
				timing: 'continuous',
				fallbackPolicy: null,
				directiveIds: [directive.directiveId],
				decisionJobId: null
			},
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Training first.',
			storyBranch: 'steel-before-trust'
		});
		const influence = (
			chosen.events[0]!.payload.directiveInfluences as Record<string, unknown>[]
		)[0]!;
		const tampered = {
			...chosen.events[0]!,
			payload: {
				...chosen.events[0]!.payload,
				directiveInfluences: [
					{ ...influence, sourceEventId: deterministicUuid('task12-wrong-source-event') }
				]
			}
		};

		expect(() => reduceEvent(issued.state, tampered)).toThrowError(
			new ReplayIntegrityError('Directive influence provenance diverged', 3)
		);
	});

	it('reports replay hash tampering and strict replay stops at the first failed sequence', () => {
		const { bootstrap, heroId } = bootstrapFixture();
		const chosen = applyCommand(bootstrap.snapshot.state, {
			...commandEnvelope(bootstrap.snapshot.state, heroId, 'task12-replay-choose'),
			commandType: 'hero.choose.destination',
			destination: 'kitchen',
			firstLine: 'Names first.',
			storyBranch: 'names-before-orders'
		});
		const tamperedBootstrap = {
			...bootstrap.event,
			afterStateHash: sha256Hex('task12-tampered-bootstrap')
		};
		const tamperedChoice = {
			...chosen.events[0]!,
			afterStateHash: sha256Hex('task12-tampered-choice')
		};
		const replay = replayEvents([tamperedBootstrap, tamperedChoice]);

		expect(replay.verified).toBe(false);
		expect(replay.checks.map(({ sequence, verified }) => ({ sequence, verified }))).toEqual([
			{ sequence: 1, verified: false },
			{ sequence: 2, verified: false }
		]);
		expect(() => replayEventsStrict([tamperedBootstrap, tamperedChoice])).toThrowError(
			new ReplayIntegrityError('Replay state hash mismatch', 1)
		);
	});

	it('does not mutate deeply frozen bootstrap, command, state, or replay event inputs', () => {
		const input = freezeDeep({
			runId: deterministicUuid('task12-frozen-run'),
			seed: 'task12-frozen-seed',
			heroId: deterministicUuid('task12-frozen-hero'),
			manifestHash: 'e'.repeat(64),
			additionalHeroes: []
		});
		const bootstrap = createBootstrapEngine(input);
		const state = freezeDeep(structuredClone(bootstrap.snapshot.state));
		const command = freezeDeep({
			...commandEnvelope(state, input.heroId, 'task12-frozen-choose'),
			commandType: 'hero.choose.destination' as const,
			destination: 'training-ground' as const,
			firstLine: 'Steel before trust.',
			storyBranch: 'steel-before-trust'
		}) as EngineCommand;
		const beforeState = structuredClone(state);
		const beforeCommand = structuredClone(command);
		const result = applyCommand(state, command);
		const events = freezeDeep([
			structuredClone(bootstrap.event),
			structuredClone(result.events[0]!)
		]);
		const beforeEvents = structuredClone(events);

		expect(replayEventsStrict(events).snapshot.state).toEqual(result.state);
		expect(state).toEqual(beforeState);
		expect(command).toEqual(beforeCommand);
		expect(events).toEqual(beforeEvents);
	});
});

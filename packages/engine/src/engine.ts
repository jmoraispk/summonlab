import {
	AuthoritativeEventSchema,
	EngineCommandSchema,
	EngineGameStateSchema,
	EngineSnapshotSchema,
	EntropyDrawSchema,
	LegalActionSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EngineSnapshot,
	type EntropyDraw,
	type LegalAction,
	type ScheduledEvent
} from '@summonlab/contracts';
import { z } from 'zod';

import { createEntropyCursor, drawInteger } from './entropy.js';
import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from './errors.js';
import { deterministicUuid, EMPTY_STATE_HASH, hashCanonical } from './hash.js';

export const ENGINE_CONTENT_VERSION = 'engine-v1';
export const ENGINE_EPOCH = '2000-01-01T00:00:00.000Z';
export const ENGINE_INVARIANTS = Object.freeze([
	'pure-transition',
	'engine-owned-legality',
	'seeded-entropy',
	'append-only-events',
	'no-network',
	'no-database',
	'no-wall-clock',
	'no-model-sdk'
] as const);

export interface BootstrapEngineInput {
	readonly runId: string;
	readonly seed: string;
	readonly heroId: string;
	readonly manifestHash: string;
	readonly simulatedAt?: string;
}

export interface BootstrapEngineResult {
	readonly snapshot: EngineSnapshot;
	readonly event: AuthoritativeEvent;
}

export interface EngineApplyResult {
	readonly state: EngineGameState;
	readonly stateHash: string;
	readonly events: readonly AuthoritativeEvent[];
	readonly scheduled: readonly ScheduledEvent[];
	readonly decisionRequests: readonly never[];
	readonly legalActions: readonly LegalAction[];
}

const InitializedPayloadSchema = z
	.object({ initialState: EngineGameStateSchema, entropyDraws: z.array(EntropyDrawSchema) })
	.strict();
const ChoosePayloadSchema = z
	.object({
		heroId: z.string().uuid(),
		destination: z.enum(['kitchen', 'training-ground']),
		firstLine: z.string(),
		storyBranch: z.string(),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema)
	})
	.strict();
const ArrivePayloadSchema = z
	.object({
		heroId: z.string().uuid(),
		destination: z.enum(['kitchen', 'training-ground']),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema)
	})
	.strict();
const InspectPayloadSchema = z
	.object({
		masterId: z.string().uuid(),
		resonance: z.number().int().min(0).max(99),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema).length(1)
	})
	.strict();

function systemSource() {
	return {
		source: 'system' as const,
		timing: null,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

export function hashGameState(state: EngineGameState): string {
	return hashCanonical(EngineGameStateSchema.parse(state));
}

export function createBootstrapEngine(input: BootstrapEngineInput): BootstrapEngineResult {
	const masterId = deterministicUuid(`${input.runId}:master`);
	const commandId = deterministicUuid(`${input.runId}:bootstrap`);
	const state = EngineGameStateSchema.parse({
		schemaVersion: 1,
		runId: input.runId,
		seed: input.seed,
		contentVersion: ENGINE_CONTENT_VERSION,
		status: 'active',
		version: 0,
		eventCursor: 1,
		entropyCursor: 0,
		simulatedAt: input.simulatedAt ?? ENGINE_EPOCH,
		master: {
			masterId,
			lifeState: 'alive',
			location: 'summoning-gate',
			health: 100,
			maxHealth: 100,
			gateInspectionCount: 0,
			lastGateResonance: null
		},
		heroes: {
			[input.heroId]: {
				heroId: input.heroId,
				lifeState: 'active',
				location: 'summoning-gate',
				destination: null,
				health: 100,
				maxHealth: 100,
				manifestHash: input.manifestHash
			}
		},
		story: { envelopeId: 'first-ember-v1', branch: null }
	});
	const stateHash = hashGameState(state);
	const event = AuthoritativeEventSchema.parse({
		eventId: deterministicUuid(`${commandId}:1:run.initialized`),
		runId: input.runId,
		sequence: 1,
		schemaVersion: 1,
		gameTime: state.simulatedAt,
		eventType: 'run.initialized',
		actorId: null,
		commandId,
		causationId: null,
		correlationId: commandId,
		source: systemSource(),
		seedCursor: 0,
		beforeStateHash: EMPTY_STATE_HASH,
		afterStateHash: stateHash,
		contentVersion: state.contentVersion,
		payload: { initialState: state, entropyDraws: [] }
	});
	return { snapshot: EngineSnapshotSchema.parse({ state, stateHash }), event };
}

export function legalActions(stateInput: EngineGameState, actorId: string): readonly LegalAction[] {
	const state = EngineGameStateSchema.parse(stateInput);
	if (state.status !== 'active') return [];
	if (actorId === state.master.masterId && state.master.lifeState === 'alive') {
		return [
			LegalActionSchema.parse({
				actionId: 'master.inspect.gate',
				actorId,
				kind: 'interact',
				label: 'Inspect the gate resonance',
				description: 'Draw one named deterministic resonance value without advancing time.',
				targetIds: [],
				resourceCosts: {},
				tags: ['deterministic', 'development-proof']
			})
		];
	}
	const hero = state.heroes[actorId];
	if (!hero || hero.lifeState !== 'active') return [];
	if (hero.destination === null) {
		return [
			LegalActionSchema.parse({
				actionId: 'hero.choose.kitchen',
				actorId,
				kind: 'move',
				label: 'Choose the kitchen',
				description: 'Open the names-before-orders branch and plan a route to the kitchen.',
				targetIds: [],
				resourceCosts: {},
				tags: ['story-branch', 'settlement']
			}),
			LegalActionSchema.parse({
				actionId: 'hero.choose.training-ground',
				actorId,
				kind: 'move',
				label: 'Choose the training ground',
				description: 'Open the steel-before-trust branch and plan a route to training.',
				targetIds: [],
				resourceCosts: {},
				tags: ['story-branch', 'settlement']
			})
		];
	}
	if (hero.location === 'summoning-gate') {
		return [
			LegalActionSchema.parse({
				actionId: 'hero.arrive.destination',
				actorId,
				kind: 'move',
				label: `Walk to the ${hero.destination === 'kitchen' ? 'kitchen' : 'training ground'}`,
				description: 'Complete the already selected route through Hearth 01.',
				targetIds: [],
				resourceCosts: {},
				tags: ['settlement', 'arrival']
			})
		];
	}
	return [];
}

function assertCommandIsLegal(state: EngineGameState, command: EngineCommand): void {
	if (command.runId !== state.runId) throw new IllegalActionError(command.commandType, []);
	if (command.expectedVersion !== state.version) {
		throw new StaleStateVersionError(command.expectedVersion, state.version);
	}
	const actionIds = legalActions(state, command.actorId).map((action) => action.actionId);
	const requiredAction =
		command.commandType === 'hero.choose.destination'
			? `hero.choose.${command.destination}`
			: command.commandType === 'hero.arrive'
				? 'hero.arrive.destination'
				: 'master.inspect.gate';
	if (!actionIds.includes(requiredAction)) throw new IllegalActionError(requiredAction, actionIds);
	if (command.commandType === 'hero.choose.destination') {
		const requiredBranch =
			command.destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust';
		if (command.storyBranch !== requiredBranch)
			throw new IllegalActionError(requiredAction, actionIds);
	}
}

function buildEvent(
	state: EngineGameState,
	command: EngineCommand
): Omit<AuthoritativeEvent, 'afterStateHash'> & { afterStateHash: string } {
	const sequence = state.eventCursor + 1;
	const base = {
		eventId: '',
		runId: state.runId,
		sequence,
		schemaVersion: 1,
		gameTime: state.simulatedAt,
		actorId: command.actorId,
		commandId: command.commandId,
		causationId: null,
		correlationId: command.correlationId,
		source: command.source,
		beforeStateHash: hashGameState(state),
		afterStateHash: EMPTY_STATE_HASH,
		contentVersion: state.contentVersion
	};
	if (command.commandType === 'hero.choose.destination') {
		const eventType = 'hero.destination.selected';
		return {
			...base,
			eventId: deterministicUuid(`${command.commandId}:${sequence}:${eventType}`),
			eventType,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: command.destination,
				firstLine: command.firstLine,
				storyBranch: command.storyBranch,
				nextVersion: state.version + 1,
				entropyDraws: []
			}
		};
	}
	if (command.commandType === 'hero.arrive') {
		const hero = state.heroes[command.actorId];
		if (!hero?.destination) throw new IllegalActionError('hero.arrive.destination');
		const eventType = 'hero.arrived';
		return {
			...base,
			eventId: deterministicUuid(`${command.commandId}:${sequence}:${eventType}`),
			eventType,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: hero.destination,
				nextVersion: state.version + 1,
				entropyDraws: []
			}
		};
	}
	const entropy = drawInteger(
		createEntropyCursor(state.seed, state.entropyCursor),
		'gate.resonance',
		0,
		99
	);
	const eventType = 'master.gate.inspected';
	return {
		...base,
		eventId: deterministicUuid(`${command.commandId}:${sequence}:${eventType}`),
		eventType,
		seedCursor: entropy.next.cursor,
		payload: {
			masterId: command.actorId,
			resonance: entropy.draw.value,
			nextVersion: state.version + 1,
			entropyDraws: [entropy.draw]
		}
	};
}

export function reduceEvent(
	stateInput: EngineGameState,
	eventInput: AuthoritativeEvent
): EngineGameState {
	const state = EngineGameStateSchema.parse(stateInput);
	const event = AuthoritativeEventSchema.parse(eventInput);
	if (event.runId !== state.runId)
		throw new ReplayIntegrityError('Event run does not match state', event.sequence);
	if (event.sequence !== state.eventCursor + 1) {
		throw new ReplayIntegrityError('Event sequence is not contiguous', event.sequence);
	}
	if (event.eventType === 'hero.destination.selected') {
		const payload = ChoosePayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero)
			throw new ReplayIntegrityError(
				'Destination event references an unknown hero',
				event.sequence
			);
		return EngineGameStateSchema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: { ...state.heroes, [payload.heroId]: { ...hero, destination: payload.destination } },
			story: { ...state.story, branch: payload.storyBranch }
		});
	}
	if (event.eventType === 'hero.arrived') {
		const payload = ArrivePayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero)
			throw new ReplayIntegrityError('Arrival event references an unknown hero', event.sequence);
		return EngineGameStateSchema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: { ...state.heroes, [payload.heroId]: { ...hero, location: payload.destination } }
		});
	}
	if (event.eventType === 'master.gate.inspected') {
		const payload = InspectPayloadSchema.parse(event.payload);
		return EngineGameStateSchema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			master: {
				...state.master,
				gateInspectionCount: state.master.gateInspectionCount + 1,
				lastGateResonance: payload.resonance
			}
		});
	}
	throw new ReplayIntegrityError(`Unsupported event type: ${event.eventType}`, event.sequence);
}

export function applyCommand(
	stateInput: EngineGameState,
	commandInput: EngineCommand
): EngineApplyResult {
	const state = EngineGameStateSchema.parse(stateInput);
	const command = EngineCommandSchema.parse(commandInput);
	assertCommandIsLegal(state, command);
	const eventDraft = buildEvent(state, command);
	const nextState = reduceEvent(state, eventDraft);
	const stateHash = hashGameState(nextState);
	const event = AuthoritativeEventSchema.parse({ ...eventDraft, afterStateHash: stateHash });
	return {
		state: nextState,
		stateHash,
		events: [event],
		scheduled: [],
		decisionRequests: [],
		legalActions: legalActions(nextState, command.actorId)
	};
}

export interface ReplayCheck {
	readonly sequence: number;
	readonly eventType: string;
	readonly beforeStateHash: string;
	readonly afterStateHash: string;
	readonly computedStateHash: string;
	readonly verified: boolean;
	readonly entropyDraws: readonly EntropyDraw[];
}

export interface ReplayResult {
	readonly snapshot: EngineSnapshot;
	readonly checks: readonly ReplayCheck[];
	readonly verified: boolean;
}

function entropyDrawsFromEvent(event: AuthoritativeEvent): readonly EntropyDraw[] {
	const payload = event.payload as Record<string, unknown>;
	return z.array(EntropyDrawSchema).parse(payload.entropyDraws ?? []);
}

export function replayEvents(eventInputs: readonly AuthoritativeEvent[]): ReplayResult {
	if (eventInputs.length === 0) throw new ReplayIntegrityError('Replay has no bootstrap event', 0);
	const events = eventInputs.map((event) => AuthoritativeEventSchema.parse(event));
	const first = events[0];
	if (!first || first.sequence !== 1 || first.eventType !== 'run.initialized') {
		throw new ReplayIntegrityError(
			'Replay must begin with run.initialized at sequence 1',
			first?.sequence ?? 0
		);
	}
	const initialized = InitializedPayloadSchema.parse(first.payload);
	let state = initialized.initialState;
	let computedHash = hashGameState(state);
	const checks: ReplayCheck[] = [
		{
			sequence: first.sequence,
			eventType: first.eventType,
			beforeStateHash: first.beforeStateHash,
			afterStateHash: first.afterStateHash,
			computedStateHash: computedHash,
			verified: first.beforeStateHash === EMPTY_STATE_HASH && first.afterStateHash === computedHash,
			entropyDraws: initialized.entropyDraws
		}
	];
	for (const event of events.slice(1)) {
		const beforeHash = hashGameState(state);
		state = reduceEvent(state, event);
		computedHash = hashGameState(state);
		checks.push({
			sequence: event.sequence,
			eventType: event.eventType,
			beforeStateHash: event.beforeStateHash,
			afterStateHash: event.afterStateHash,
			computedStateHash: computedHash,
			verified: event.beforeStateHash === beforeHash && event.afterStateHash === computedHash,
			entropyDraws: entropyDrawsFromEvent(event)
		});
	}
	return {
		snapshot: EngineSnapshotSchema.parse({ state, stateHash: computedHash }),
		checks,
		verified: checks.every((check) => check.verified)
	};
}

export function replayEventsStrict(eventInputs: readonly AuthoritativeEvent[]): ReplayResult {
	const replay = replayEvents(eventInputs);
	const failed = replay.checks.find((check) => !check.verified);
	if (failed) throw new ReplayIntegrityError('Replay state hash mismatch', failed.sequence);
	return replay;
}

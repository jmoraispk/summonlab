import {
	EngineGameStateV5Schema,
	EngineGameStateV6Schema,
	EngineGameStateV7Schema,
	EngineGameStateV8Schema,
	EngineGameStateV9Schema,
	EngineGameStateV10Schema,
	EngineGameStateV11Schema,
	EngineGameStateV12Schema,
	EngineGameStateV13Schema,
	EngineGameStateV24Schema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameStateV5,
	type EngineGameStateV6,
	type EngineGameStateV7,
	type EngineGameStateV8,
	type EngineGameStateV9,
	type EngineGameStateV10,
	type EngineGameStateV11,
	type EngineGameStateV12,
	type EngineGameStateV13,
	type EngineGameStateV24
} from '@summonlab/contracts';

import { systemSource } from './core/event-metadata.js';
import { deterministicUuid } from './hash.js';
import { applyCommand } from './orchestration/apply-command.js';
import { legalActions } from './orchestration/legal-actions.js';
import { compareGameTime } from './time.js';

function habitSource() {
	return {
		source: 'habit' as const,
		timing: 'continuous' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

type CatchUpState =
	| EngineGameStateV5
	| EngineGameStateV6
	| EngineGameStateV7
	| EngineGameStateV8
	| EngineGameStateV9
	| EngineGameStateV10
	| EngineGameStateV11
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV24;

function parseCatchUpState(state: CatchUpState): CatchUpState {
	if (state.schemaVersion === 5) return EngineGameStateV5Schema.parse(state);
	if (state.schemaVersion === 6) return EngineGameStateV6Schema.parse(state);
	if (state.schemaVersion === 7) return EngineGameStateV7Schema.parse(state);
	if (state.schemaVersion === 8) return EngineGameStateV8Schema.parse(state);
	if (state.schemaVersion === 9) return EngineGameStateV9Schema.parse(state);
	if (state.schemaVersion === 10) return EngineGameStateV10Schema.parse(state);
	if (state.schemaVersion === 11) return EngineGameStateV11Schema.parse(state);
	if (state.schemaVersion === 12) return EngineGameStateV12Schema.parse(state);
	if (state.schemaVersion === 13) return EngineGameStateV13Schema.parse(state);
	return EngineGameStateV24Schema.parse(state);
}

function commandBase(state: CatchUpState, key: string, actorId: string) {
	const commandId = deterministicUuid(`catch-up:${state.runId}:${state.version}:${key}`);
	return {
		commandId,
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: commandId
	};
}

function earliestScheduledTime(state: CatchUpState): string | null {
	const forgingCompletionTimes =
		state.schemaVersion === 24
			? Object.values(state.heroes).map((hero) => hero.currentForging?.completesAt)
			: [];
	return (
		[
			...Object.values(state.heroes).flatMap((hero) => [
				hero.currentActivity?.completesAt,
				hero.currentTravel?.arrivesAt,
				hero.currentRoutine?.completesAt
			]),
			...forgingCompletionTimes,
			...(state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13
				? Object.values(state.society.directives).map((directive) =>
						directive.status === 'active' ? directive.expiresAt : null
					)
				: [])
		]
			.filter((value): value is string => Boolean(value))
			.sort((left, right) => compareGameTime(left, right))[0] ?? null
	);
}

export function nextCatchUpCommand(
	stateInput: CatchUpState,
	targetGameTime: string
): EngineCommand | null {
	const state = parseCatchUpState(stateInput);
	if (state.status !== 'active') return null;
	if (compareGameTime(state.simulatedAt, targetGameTime) > 0) return null;
	if (state.schemaVersion === 24 && compareGameTime(state.simulatedAt, targetGameTime) === 0) {
		return null;
	}
	for (const hero of Object.values(state.heroes).sort((left, right) =>
		left.heroId.localeCompare(right.heroId)
	)) {
		const actionIds = new Set(legalActions(state, hero.heroId).map((action) => action.actionId));
		if (actionIds.has('hero.plan.day')) {
			return {
				...commandBase(state, 'plan-day', hero.heroId),
				source: habitSource(),
				commandType: 'hero.plan.day'
			};
		}
		if (actionIds.has('hero.follow.plan')) {
			return {
				...commandBase(state, 'follow-plan', hero.heroId),
				source: habitSource(),
				commandType: 'hero.start.routine'
			};
		}
	}
	if (compareGameTime(state.simulatedAt, targetGameTime) >= 0) return null;
	const earliest = earliestScheduledTime(state);
	if (earliest && compareGameTime(earliest, targetGameTime) <= 0) {
		return {
			...commandBase(state, `advance:${earliest}`, state.master.masterId),
			source: systemSource(),
			commandType: 'simulation.advance',
			targetGameTime: earliest
		};
	}
	return {
		...commandBase(state, `sync:${targetGameTime}`, state.master.masterId),
		source: systemSource(),
		commandType: 'simulation.sync.clock',
		targetGameTime
	};
}

export interface CatchUpPolicyResult {
	readonly state: CatchUpState;
	readonly commands: readonly EngineCommand[];
	readonly events: readonly AuthoritativeEvent[];
	readonly resolvedScheduledEventIds: readonly string[];
	readonly truncated: boolean;
}

export function applyCatchUpPolicy(
	stateInput: CatchUpState,
	targetGameTime: string,
	maxCommands = 256
): CatchUpPolicyResult {
	if (!Number.isSafeInteger(maxCommands) || maxCommands < 1) {
		throw new Error('Catch-up command limit must be a positive safe integer');
	}
	let state = parseCatchUpState(stateInput);
	const commands: EngineCommand[] = [];
	const events: AuthoritativeEvent[] = [];
	const resolvedScheduledEventIds: string[] = [];
	while (commands.length < maxCommands) {
		const command = nextCatchUpCommand(state, targetGameTime);
		if (!command) break;
		const result = applyCommand(state, command);
		if (
			result.state.schemaVersion !== 5 &&
			result.state.schemaVersion !== 6 &&
			result.state.schemaVersion !== 7 &&
			result.state.schemaVersion !== 8 &&
			result.state.schemaVersion !== 9 &&
			result.state.schemaVersion !== 10 &&
			result.state.schemaVersion !== 11 &&
			result.state.schemaVersion !== 12 &&
			result.state.schemaVersion !== 13 &&
			result.state.schemaVersion !== 24
		) {
			throw new Error(`Catch-up changed engine schema to v${result.state.schemaVersion}`);
		}
		state = parseCatchUpState(result.state);
		commands.push(command);
		events.push(...result.events);
		resolvedScheduledEventIds.push(...result.resolvedScheduledEventIds);
	}
	return {
		state,
		commands,
		events,
		resolvedScheduledEventIds,
		truncated: nextCatchUpCommand(state, targetGameTime) !== null
	};
}

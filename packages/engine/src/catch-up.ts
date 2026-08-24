import {
	EngineGameStateV5Schema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameStateV5
} from '@summonlab/contracts';

import { applyCommand, legalActions } from './engine.js';
import { deterministicUuid } from './hash.js';
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

function systemSource() {
	return {
		source: 'system' as const,
		timing: null,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function commandBase(state: EngineGameStateV5, key: string, actorId: string) {
	const commandId = deterministicUuid(`catch-up:${state.runId}:${state.version}:${key}`);
	return {
		commandId,
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: commandId
	};
}

function earliestScheduledTime(state: EngineGameStateV5): string | null {
	return (
		Object.values(state.heroes)
			.flatMap((hero) => [
				hero.currentActivity?.completesAt,
				hero.currentTravel?.arrivesAt,
				hero.currentRoutine?.completesAt
			])
			.filter((value): value is string => Boolean(value))
			.sort((left, right) => compareGameTime(left, right))[0] ?? null
	);
}

export function nextCatchUpCommand(
	stateInput: EngineGameStateV5,
	targetGameTime: string
): EngineCommand | null {
	const state = EngineGameStateV5Schema.parse(stateInput);
	if (state.status !== 'active') return null;
	if (compareGameTime(state.simulatedAt, targetGameTime) > 0) return null;
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
	readonly state: EngineGameStateV5;
	readonly commands: readonly EngineCommand[];
	readonly events: readonly AuthoritativeEvent[];
	readonly resolvedScheduledEventIds: readonly string[];
	readonly truncated: boolean;
}

export function applyCatchUpPolicy(
	stateInput: EngineGameStateV5,
	targetGameTime: string,
	maxCommands = 256
): CatchUpPolicyResult {
	if (!Number.isSafeInteger(maxCommands) || maxCommands < 1) {
		throw new Error('Catch-up command limit must be a positive safe integer');
	}
	let state = EngineGameStateV5Schema.parse(stateInput);
	const commands: EngineCommand[] = [];
	const events: AuthoritativeEvent[] = [];
	const resolvedScheduledEventIds: string[] = [];
	while (commands.length < maxCommands) {
		const command = nextCatchUpCommand(state, targetGameTime);
		if (!command) break;
		const result = applyCommand(state, command);
		state = EngineGameStateV5Schema.parse(result.state);
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

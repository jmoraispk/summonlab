import {
	AuthoritativeEventSchema,
	DirectiveInfluenceRecordSchema,
	EngineCommandSchema,
	type AuthoritativeEvent,
	type DirectiveRecord,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV1,
	type LegalAction
} from '@summonlab/contracts';

import { hashParsedGameState, parseGameState } from '../core/state.js';
import type { EngineApplyResult, EngineGameStateModern } from '../core/types.js';
import {
	settlementCommandHandler,
	type SettlementCommand
} from '../domains/settlement/commands.js';
import { storyCommandHandler } from '../domains/story/commands.js';
import { synthesisCommandHandler } from '../domains/synthesis/commands.js';
import { deterministicUuid } from '../hash.js';
import { assertCommandIsLegal, requiredAction } from './command-authorization.js';
import { createCommandRegistry } from './command-registry.js';
import {
	canceledScheduledEventIdsFromEvent,
	resolvedScheduledEventIdsFromEvent,
	scheduledEventsFromEvent
} from './event-outputs.js';
import { firstBandMissionCommandHandler } from './first-band-mission-reducer.js';
import { legalActionsForParsedState } from './legal-actions.js';
import { reduceParsedEvent } from './reduction.js';

const commandRegistry = createCommandRegistry([
	settlementCommandHandler,
	firstBandMissionCommandHandler,
	storyCommandHandler,
	synthesisCommandHandler
]);

function buildLegacyEvent(state: EngineGameStateV1, command: EngineCommand): AuthoritativeEvent {
	return settlementCommandHandler.buildEvent(state, command as SettlementCommand);
}

function buildV2Event(state: EngineGameStateModern, command: EngineCommand): AuthoritativeEvent {
	return commandRegistry.handlerFor(command.commandType).buildEvent(state, command);
}

const DIRECTIVE_STOP_WORDS = new Set([
	'and',
	'are',
	'before',
	'choose',
	'for',
	'from',
	'that',
	'the',
	'then',
	'this',
	'with',
	'you',
	'your'
]);

function directiveTerms(directive: DirectiveRecord): string[] {
	return [...directive.text.toLowerCase().split(/[^a-z0-9]+/u), ...directive.priorities]
		.map((term) => term.toLowerCase().trim())
		.filter((term) => term.length >= 3 && !DIRECTIVE_STOP_WORDS.has(term));
}

function actionMatchesDirective(action: LegalAction, directive: DirectiveRecord): boolean {
	const searchable = [action.actionId, action.label, action.description, ...action.tags]
		.join(' ')
		.toLowerCase();
	return directiveTerms(directive).some((term) => searchable.includes(term));
}

function attachDirectiveInfluences(
	state: EngineGameState,
	command: EngineCommand,
	event: AuthoritativeEvent
): AuthoritativeEvent {
	if (
		(state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20) ||
		!state.heroes[command.actorId] ||
		command.source.directiveIds.length === 0
	) {
		return event;
	}
	const legal = legalActionsForParsedState(state, command.actorId);
	const actionId = requiredAction(command);
	const selected = legal.find((action) => action.actionId === actionId);
	if (!selected) return event;
	const influences = command.source.directiveIds
		.map((directiveId) => state.society.directives[directiveId])
		.filter((directive): directive is DirectiveRecord =>
			Boolean(
				directive &&
				directive.status === 'active' &&
				directive.recipientIds.includes(command.actorId)
			)
		)
		.map((directive) => {
			const selectedMatches = actionMatchesDirective(selected, directive);
			const alternativeMatches = legal.some(
				(action) => action.actionId !== actionId && actionMatchesDirective(action, directive)
			);
			const outcome = selectedMatches
				? ('advanced' as const)
				: alternativeMatches
					? ('conflicted' as const)
					: ('unavailable' as const);
			return DirectiveInfluenceRecordSchema.parse({
				influenceId: deterministicUuid(`${event.eventId}:${directive.directiveId}:influence`),
				directiveId: directive.directiveId,
				heroId: command.actorId,
				sourceEventId: event.eventId,
				decisionJobId: command.source.decisionJobId,
				actionId,
				outcome,
				rationale:
					outcome === 'advanced'
						? 'The chosen legal action matched the direction text or its structured priorities.'
						: outcome === 'conflicted'
							? 'Another legal action matched the direction more closely than the chosen action.'
							: 'No legal action matched the direction; the direction could not expand the legal set.',
				evaluatedAt: state.simulatedAt
			});
		});
	if (influences.length === 0) return event;
	return AuthoritativeEventSchema.parse({
		...event,
		payload: { ...event.payload, directiveInfluences: influences }
	});
}

export function applyCommand(
	stateInput: EngineGameState,
	commandInput: EngineCommand
): EngineApplyResult {
	const state = parseGameState(stateInput);
	const command = EngineCommandSchema.parse(commandInput);
	assertCommandIsLegal(state, command);
	const builtEvent =
		state.schemaVersion === 1 ? buildLegacyEvent(state, command) : buildV2Event(state, command);
	const eventDraft = attachDirectiveInfluences(state, command, builtEvent);
	const nextState = reduceParsedEvent(state, eventDraft);
	const stateHash = hashParsedGameState(nextState);
	const event = AuthoritativeEventSchema.parse({ ...eventDraft, afterStateHash: stateHash });
	return {
		state: nextState,
		stateHash,
		events: [event],
		scheduled: scheduledEventsFromEvent(event),
		resolvedScheduledEventIds: resolvedScheduledEventIdsFromEvent(event),
		canceledScheduledEventIds: canceledScheduledEventIdsFromEvent(event),
		decisionRequests: [],
		legalActions: legalActionsForParsedState(nextState, command.actorId)
	};
}

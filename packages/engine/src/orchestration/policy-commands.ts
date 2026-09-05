import {
	EngineCommandSchema,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	type EngineCommand,
	type EngineGameState,
	type HeroDecisionPacket,
	type HeroPolicyResult
} from '@summonlab/contracts';

import { hashParsedGameState, parseGameState } from '../core/state.js';
import { IllegalActionError } from '../errors.js';
import { deterministicUuid, hashCanonical } from '../hash.js';
import { decisionLegalActions } from './legal-actions.js';

function boundedDecisionText(result: HeroPolicyResult): string {
	const text = result.decision.spokenText ?? result.decision.publicIntent;
	return text.length <= 500 ? text : text.slice(0, 500).trimEnd();
}

export function commandFromHeroPolicyResult(input: {
	readonly state: EngineGameState;
	readonly packet: HeroDecisionPacket;
	readonly result: HeroPolicyResult;
	readonly decisionJobId: string;
}): EngineCommand {
	const state = parseGameState(input.state);
	const packet = HeroDecisionPacketSchema.parse(input.packet);
	const result = HeroPolicyResultSchema.parse(input.result);
	const unsignedPacket = { ...packet } as Partial<HeroDecisionPacket>;
	delete unsignedPacket.packetHash;
	const unsignedResult = { ...result } as Partial<HeroPolicyResult>;
	delete unsignedResult.resultHash;
	if (
		hashCanonical(unsignedPacket) !== packet.packetHash ||
		hashCanonical(unsignedResult) !== result.resultHash ||
		packet.runId !== state.runId ||
		packet.heroId !== packet.identity.profile.characterId ||
		packet.world.stateVersion !== state.version ||
		packet.world.eventCursor !== state.eventCursor ||
		packet.world.stateHash !== hashParsedGameState(state) ||
		result.packetId !== packet.packetId ||
		result.packetHash !== packet.packetHash ||
		result.legalActionHash !== packet.legalActionHash ||
		result.world.stateVersion !== packet.world.stateVersion ||
		result.world.eventCursor !== packet.world.eventCursor ||
		result.world.stateHash !== packet.world.stateHash
	) {
		throw new Error('Decision result is not bound to the current engine state');
	}
	const currentActions = [...decisionLegalActions(state, packet.heroId)].sort((left, right) =>
		left.actionId.localeCompare(right.actionId)
	);
	if (hashCanonical(currentActions) !== packet.legalActionHash) {
		throw new Error('Decision legal actions are stale');
	}
	const selectedAction = currentActions.find(
		(candidate) => candidate.actionId === result.decision.actionId
	);
	if (
		!selectedAction ||
		result.decision.targetIds.some((targetId) => !selectedAction.targetIds.includes(targetId))
	) {
		throw new IllegalActionError(
			result.decision.actionId,
			currentActions.map((action) => action.actionId)
		);
	}
	const commandId = deterministicUuid(
		`${input.decisionJobId}:apply:${packet.packetHash}:${result.resultHash}`
	);
	const base = {
		commandId,
		runId: state.runId,
		actorId: packet.heroId,
		expectedVersion: state.version,
		correlationId: deterministicUuid(`${input.decisionJobId}:correlation`),
		source: {
			source: result.trace.kind,
			timing: null,
			fallbackPolicy: null,
			directiveIds: packet.activeDirectives.map((directive) => directive.directiveId),
			decisionJobId: input.decisionJobId
		}
	};
	const actionId = result.decision.actionId;
	if (actionId === 'hero.choose.kitchen' || actionId === 'hero.choose.training-ground') {
		const destination = actionId === 'hero.choose.kitchen' ? 'kitchen' : 'training-ground';
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.choose.destination',
			destination,
			firstLine: boundedDecisionText(result),
			storyBranch: destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust'
		});
	}
	if (actionId === 'hero.arrive.destination') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.arrive' });
	}
	if (actionId.startsWith('hero.travel.')) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.start.travel',
			targetNodeId: actionId.slice('hero.travel.'.length)
		});
	}
	if (actionId === 'hero.plan.day') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.plan.day' });
	}
	if (actionId === 'hero.follow.plan') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.start.routine' });
	}
	if (
		actionId === 'hero.activity.train' ||
		actionId === 'hero.activity.eat' ||
		actionId === 'hero.activity.rest' ||
		actionId === 'hero.activity.repair'
	) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.start.activity',
			activity: actionId.slice('hero.activity.'.length)
		});
	}
	if (actionId.startsWith('hero.equip.')) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.equip.item',
			itemId: actionId.slice('hero.equip.'.length)
		});
	}
	throw new IllegalActionError(
		actionId,
		currentActions.map((action) => action.actionId)
	);
}

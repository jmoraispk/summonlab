import type { EngineCommand, EngineGameState } from '@summonlab/contracts';

import { IllegalActionError, StaleStateVersionError } from '../errors.js';
import {
	SETTLEMENT_COMMAND_TYPES,
	assertSettlementCommandLegalWithActionIds,
	requiredSettlementAction,
	settlementCommandHandler,
	type SettlementCommand
} from '../domains/settlement/commands.js';
import { MISSION_COMMAND_TYPES, type MissionCommand } from '../domains/mission/commands.js';
import { storyCommandHandler } from '../domains/story/commands.js';
import { synthesisCommandHandler } from '../domains/synthesis/commands.js';
import { firstBandMissionCommandHandler } from './first-band-mission-reducer.js';
import { createCommandRegistry } from './command-registry.js';
import { legalActions, legalActionsForParsedState } from './legal-actions.js';

const commandRegistry = createCommandRegistry([
	settlementCommandHandler,
	firstBandMissionCommandHandler,
	storyCommandHandler,
	synthesisCommandHandler
]);

export function requiredAction(command: EngineCommand): string {
	if (SETTLEMENT_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		return requiredSettlementAction(command as SettlementCommand);
	}
	if (command.commandType === 'master.configure.timing') return 'master.control.configure';
	if (command.commandType === 'master.configure.fallback') return 'master.fallback.configure';
	if (command.commandType === 'master.apply.safety-stop') return 'master.safety-stop.apply';
	if (command.commandType === 'master.open.decision') return 'master.decision.open';
	if (command.commandType === 'mission.prepare') return 'mission.prepare';
	if (command.commandType === 'mission.revise.party') return 'mission.revise.party';
	if (command.commandType === 'mission.cancel') return 'mission.cancel';
	if (command.commandType === 'mission.deploy') return 'mission.deploy';
	if (command.commandType === 'mission.resolve.turn') return 'mission.resolve.turn';
	if (command.commandType === 'mission.advance.automatic') return 'mission.advance.automatic';
	if (command.commandType === 'mission.apply.combat-choice-batch')
		return 'mission.apply.combat-choice-batch';
	if (command.commandType === 'mission.commit.readiness-terminal')
		return 'mission.commit.readiness-terminal';
	if (command.commandType === 'mission.open.extraction') return 'mission.open.extraction';
	if (command.commandType === 'mission.extract') return 'mission.extract';
	if (command.commandType === 'mission.retreat') return 'mission.retreat';
	if (command.commandType === 'story.apply.patch') return 'story.patch.apply';
	if (command.commandType === 'story.reveal.first.archive') return 'story.first.archive.reveal';
	if (command.commandType === 'settlement.synthesize.hero') return 'settlement.synthesis.commit';
	if (command.commandType === 'hero.share.synthesis.rumor')
		return `synthesis.rumor.share.${command.receiptId.slice(-8)}.${command.targetHeroId.slice(-8)}`;
	throw new Error('Unreachable engine command discriminator');
}

export function assertCommandIsLegal(state: EngineGameState, command: EngineCommand): void {
	if (command.runId !== state.runId) throw new IllegalActionError(command.commandType, []);
	if (command.expectedVersion !== state.version) {
		throw new StaleStateVersionError(command.expectedVersion, state.version);
	}
	const owner = commandRegistry.handlerFor(command.commandType);
	if (
		command.commandType === 'settlement.synthesize.hero' ||
		command.commandType === 'hero.share.synthesis.rumor'
	) {
		owner.assertLegal(state, command);
		return;
	}
	if (command.commandType === 'story.reveal.first.archive') {
		owner.assertLegal(state, command);
		if (
			!legalActionsForParsedState(state, command.actorId).some(
				(candidate) => candidate.actionId === requiredAction(command)
			)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (
		command.commandType === 'mission.apply.combat-choice-batch' ||
		command.commandType === 'mission.commit.readiness-terminal'
	) {
		owner.assertLegal(state, command);
		return;
	}
	if (MISSION_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		owner.assertLegal(state, command as MissionCommand);
		if (
			command.commandType === 'master.configure.timing' ||
			command.commandType === 'master.open.decision' ||
			command.commandType === 'master.configure.fallback' ||
			command.commandType === 'master.apply.safety-stop'
		) {
			if (
				!legalActions(state, command.actorId).some(
					(candidate) => candidate.actionId === requiredAction(command)
				)
			) {
				throw new IllegalActionError(command.commandType, []);
			}
			return;
		}
		if (
			command.commandType === 'mission.open.extraction' ||
			command.commandType === 'mission.resolve.turn'
		) {
			return;
		}
		const actionIds = legalActions(state, command.actorId).map((candidate) => candidate.actionId);
		const required = requiredAction(command);
		if (!actionIds.includes(required)) throw new IllegalActionError(required, actionIds);
		return;
	}
	if (SETTLEMENT_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		assertSettlementCommandLegalWithActionIds(
			state,
			command as SettlementCommand,
			legalActions(state, command.actorId).map((candidate) => candidate.actionId)
		);
		return;
	}
	if (command.commandType === 'story.apply.patch') {
		owner.assertLegal(state, command);
	}
	const actionIds = legalActions(state, command.actorId).map((candidate) => candidate.actionId);
	const required = requiredAction(command);
	if (!actionIds.includes(required)) throw new IllegalActionError(required, actionIds);
}

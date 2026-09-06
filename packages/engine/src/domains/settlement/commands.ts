import {
	AttributeGrowthReceiptSchema,
	AuthoritativeEventSchema,
	CurrentRoutineSchema,
	FirstEmberStateSchema,
	HeroBuildingAssignmentSchema,
	InjurySchema,
	ScheduledEventSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EntropyDraw,
	type RewardDelta
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { z } from 'zod';

import { settlementForState, verifiedEquipmentDefinition } from '../../core/content-bindings.js';
import { intrinsicAttributes } from '../../core/capability.js';
import { emptyMetadata, eventBase } from '../../core/event-metadata.js';
import type { EngineCommandHandler, EngineGameStateModern } from '../../core/types.js';
import {
	hasFacilityState,
	hasFirstEmberState,
	hasNavigationState,
	hasRoutineState
} from '../../core/versions.js';
import { createEntropyCursor, drawInteger } from '../../entropy.js';
import { IllegalActionError, StaleStateVersionError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';
import { addGameMinutes, addGameSeconds, compareGameTime, gameMinutesBetween } from '../../time.js';
import { settlementLegalActions } from './actions.js';
import {
	currentTravelFor,
	destinationNodeId,
	routeHasCapacity,
	settlementRouteFor,
	zoneForNode
} from './navigation.js';
import {
	ActivityOutcomeSchema,
	ActivityOutcomeV25Schema,
	activityDuration,
	buildActivityOutcome,
	buildRoutineOutcome,
	createDailyPlan,
	currentRoutineFor,
	resolveDailyRoutine,
	resourceChange,
	routineDuration,
	routineLabel
} from './routines.js';
import {
	FIRST_EMBER_MODIFIERS,
	buildCommunicativeSociety,
	buildConversationSociety,
	buildDirectiveChange,
	buildFirstEmberReaction,
	buildFirstEmberSociety,
	heroCanHearCommunication,
	revokeDirective
} from './society.js';
import { equipEquipmentItem, equipmentItemDisplayName } from './equipment.js';
import {
	buildForgingOutcome,
	buildStandardForgingStart,
	canStartStandardForging,
	currentForgingFor
} from './forging.js';

export const SETTLEMENT_COMMAND_TYPES = [
	'hero.choose.destination',
	'hero.arrive',
	'hero.start.travel',
	'settlement.assign.hero',
	'settlement.unassign.hero',
	'settlement.allocate.power',
	'story.recover.first.ember',
	'settlement.commit.first.ember',
	'master.communicate',
	'master.converse',
	'master.issue.directive',
	'master.replace.directive',
	'master.revoke.directive',
	'hero.plan.day',
	'hero.start.routine',
	'master.inspect.gate',
	'hero.start.activity',
	'hero.start.forging',
	'hero.equip.item',
	'simulation.advance',
	'simulation.sync.clock',
	'simulation.apply.damage',
	'hero.allocate.attribute'
] as const;

export type SettlementCommand = Extract<
	EngineCommand,
	{ commandType: (typeof SETTLEMENT_COMMAND_TYPES)[number] }
>;

export function requiredSettlementAction(command: SettlementCommand): string {
	if (command.commandType === 'hero.choose.destination')
		return `hero.choose.${command.destination}`;
	if (command.commandType === 'hero.arrive') return 'hero.arrive.destination';
	if (command.commandType === 'hero.start.travel') return 'hero.travel';
	if (command.commandType === 'settlement.assign.hero')
		return `settlement.assign.${command.heroId}.${command.buildingId}`;
	if (command.commandType === 'settlement.unassign.hero')
		return `settlement.unassign.${command.heroId}`;
	if (command.commandType === 'settlement.allocate.power')
		return `settlement.power.${command.buildingId}`;
	if (command.commandType === 'story.recover.first.ember') return 'story.recover.first-ember';
	if (command.commandType === 'settlement.commit.first.ember')
		return `settlement.first-ember.${command.buildingId}`;
	if (command.commandType === 'master.communicate')
		return `social.communicate.${command.targetHeroId}`;
	if (command.commandType === 'master.converse') return `social.converse.${command.targetHeroId}`;
	if (command.commandType === 'master.issue.directive') return 'social.directive.issue';
	if (command.commandType === 'master.replace.directive')
		return `social.directive.replace.${command.directiveId}`;
	if (command.commandType === 'master.revoke.directive')
		return `social.directive.revoke.${command.directiveId}`;
	if (command.commandType === 'hero.plan.day') return 'hero.plan.day';
	if (command.commandType === 'hero.start.routine') return 'hero.follow.plan';
	if (command.commandType === 'master.inspect.gate') return 'master.inspect.gate';
	if (command.commandType === 'hero.start.activity') return `hero.activity.${command.activity}`;
	if (command.commandType === 'hero.start.forging') return `hero.forge.${command.definitionId}`;
	if (command.commandType === 'hero.equip.item') return `hero.equip.${command.itemId}`;
	if (command.commandType === 'hero.allocate.attribute')
		return `hero.allocate.attribute.${command.attribute}`;
	if (command.commandType === 'simulation.advance') return 'simulation.advance';
	if (command.commandType === 'simulation.sync.clock') return 'simulation.sync.clock';
	return command.targetId === command.actorId
		? 'simulation.damage.master'
		: `simulation.damage.hero.${command.targetId}`;
}

export function earliestSettlementScheduledTime(state: EngineGameStateModern): string | null {
	return (
		[
			...Object.values(state.heroes).flatMap((hero) => [
				hero.currentActivity?.completesAt,
				currentTravelFor(state, hero.heroId)?.arrivesAt,
				currentRoutineFor(state, hero.heroId)?.completesAt,
				currentForgingFor(state, hero.heroId)?.completesAt
			]),
			...(state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 14
				? Object.values(state.society.directives).map((directive) =>
						directive.status === 'active' ? directive.expiresAt : null
					)
				: [])
		]
			.filter((value): value is string => Boolean(value))
			.sort((left, right) => compareGameTime(left, right))[0] ?? null
	);
}

function assertSettlementCommandLegal(
	state: EngineGameState,
	command: SettlementCommand,
	legalActionIds?: readonly string[]
): void {
	if (command.runId !== state.runId) throw new IllegalActionError(command.commandType, []);
	if (command.expectedVersion !== state.version) {
		throw new StaleStateVersionError(command.expectedVersion, state.version);
	}
	if (command.commandType === 'story.recover.first.ember') {
		if (
			!hasFirstEmberState(state) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'system' ||
			command.source.timing !== null ||
			state.settlement.firstEmber.status !== 'unrecovered'
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (command.commandType === 'simulation.sync.clock') {
		const earliest = state.schemaVersion === 1 ? null : earliestSettlementScheduledTime(state);
		const minutes = gameMinutesBetween(state.simulatedAt, command.targetGameTime);
		if (
			!hasRoutineState(state) ||
			state.status !== 'active' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'system' ||
			command.source.timing !== null ||
			minutes <= 0 ||
			minutes > 7 * 24 * 60 ||
			(earliest !== null && compareGameTime(command.targetGameTime, earliest) >= 0)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (command.commandType === 'master.communicate') {
		const compatible =
			(command.kind === 'ask' && command.topic === 'hero-memory') ||
			(command.kind !== 'ask' && command.topic !== 'hero-memory');
		if (
			(state.schemaVersion !== 8 &&
				state.schemaVersion !== 9 &&
				state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step' ||
			!compatible
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		const target = state.heroes[command.targetHeroId];
		if (
			!target ||
			target.location !== state.master.location ||
			!heroCanHearCommunication(target) ||
			Object.keys(state.society.communicativeActs).length >= 2_048
		) {
			throw new IllegalActionError(command.commandType, []);
		}
	}
	if (command.commandType === 'master.converse') {
		if (
			(state.schemaVersion !== 9 &&
				state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step'
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		const target = state.heroes[command.targetHeroId];
		if (
			!target ||
			target.location !== state.master.location ||
			!heroCanHearCommunication(target) ||
			Object.keys(state.society.conversationTurns).length >= 2_048 ||
			Object.keys(state.society.communicativeActs).length >= 2_048
		) {
			throw new IllegalActionError(command.commandType, []);
		}
	}
	if (
		command.commandType === 'master.issue.directive' ||
		command.commandType === 'master.replace.directive' ||
		command.commandType === 'master.revoke.directive'
	) {
		if (
			(state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step'
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		if (command.commandType !== 'master.revoke.directive') {
			const recipients = new Set(command.recipientIds);
			if (
				recipients.size !== command.recipientIds.length ||
				command.recipientIds.some((heroId) => {
					const hero = state.heroes[heroId];
					return (
						!hero || hero.location !== state.master.location || !heroCanHearCommunication(hero)
					);
				}) ||
				Object.keys(state.society.directives).length >= 2_048 ||
				Object.keys(state.society.communicativeActs).length >= 2_048
			) {
				throw new IllegalActionError(command.commandType, []);
			}
		}
		if (command.commandType !== 'master.issue.directive') {
			const previous = state.society.directives[command.directiveId];
			if (!previous || previous.status !== 'active') {
				throw new IllegalActionError(command.commandType, []);
			}
		}
	}
	const actionIds =
		legalActionIds ??
		settlementLegalActions(state, command.actorId).map((candidate) => candidate.actionId);
	const required = requiredSettlementAction(command);
	if (!actionIds.includes(required)) throw new IllegalActionError(required, actionIds);
	if (command.commandType === 'hero.choose.destination') {
		const branch = command.destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust';
		if (command.storyBranch !== branch) throw new IllegalActionError(required, actionIds);
	}
	if (command.commandType === 'simulation.advance') {
		if (state.schemaVersion === 1) throw new IllegalActionError(required, actionIds);
		const earliest = earliestSettlementScheduledTime(state);
		if (!earliest || compareGameTime(command.targetGameTime, earliest) < 0) {
			throw new IllegalActionError(required, actionIds);
		}
		const minutes = gameMinutesBetween(state.simulatedAt, command.targetGameTime);
		if (minutes <= 0 || minutes > 7 * 24 * 60) throw new IllegalActionError(required, actionIds);
	}
	if (command.commandType === 'hero.start.forging') {
		if (
			state.schemaVersion !== 24 ||
			!canStartStandardForging(
				state,
				command.actorId,
				command.definitionId,
				command.materialId,
				command.craftsmanship
			)
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'hero.start.travel') {
		if (!hasNavigationState(state)) throw new IllegalActionError(required, actionIds);
		const hero = state.heroes[command.actorId];
		if (!hero || hero.locationNodeId === command.targetNodeId)
			throw new IllegalActionError(required, actionIds);
		const definition = settlementForState(state);
		const route = settlementRouteFor(state, definition, command.actorId, command.targetNodeId);
		if (!route || route.totalTravelGameSeconds <= 0)
			throw new IllegalActionError(required, actionIds);
		if (!routeHasCapacity(state, definition, hero.heroId, command.targetNodeId, route)) {
			throw new IllegalActionError(required, actionIds);
		}
		if (
			!hero.firstArrivalCompleted &&
			(!hero.destination ||
				command.targetNodeId !== destinationNodeId(settlementForState(state), hero.destination))
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'settlement.assign.hero') {
		if (!hasFacilityState(state)) throw new IllegalActionError(required, actionIds);
		const hero = state.heroes[command.heroId];
		const building = state.settlement.buildings[command.buildingId];
		if (
			!hero ||
			hero.lifeState !== 'active' ||
			!building ||
			building.assignmentRole !== command.role ||
			building.assignedHeroIds.length >= building.assignmentCapacity
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'settlement.unassign.hero') {
		if (!hasFacilityState(state) || !state.heroes[command.heroId]?.assignment) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'settlement.allocate.power') {
		if (
			!hasFacilityState(state) ||
			command.buildingId === 'summoning-gate' ||
			!state.settlement.buildings[command.buildingId]
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'settlement.commit.first.ember') {
		if (
			!hasFirstEmberState(state) ||
			state.settlement.firstEmber.status !== 'available' ||
			!['kitchen', 'dormitory', 'training-ground'].includes(command.buildingId)
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'hero.plan.day') {
		if (!hasRoutineState(state)) throw new IllegalActionError(required, actionIds);
		const hero = state.heroes[command.actorId];
		if (
			!hero ||
			hero.currentRoutine ||
			hero.currentActivity ||
			hero.currentTravel ||
			currentForgingFor(state, command.actorId)
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'hero.start.routine') {
		if (!hasRoutineState(state) || !resolveDailyRoutine(state, command.actorId)) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'hero.equip.item') {
		if (state.schemaVersion === 24 || state.schemaVersion === 25) {
			try {
				equipEquipmentItem(state, {
					heroId: command.actorId,
					itemId: command.itemId,
					...(command.targetSlot ? { targetSlot: command.targetSlot } : {})
				});
			} catch {
				throw new IllegalActionError(required, actionIds);
			}
		} else if (command.targetSlot !== undefined) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'hero.allocate.attribute') {
		if (
			state.schemaVersion !== 25 ||
			state.heroes[command.actorId]?.lifeState !== 'active' ||
			state.heroes[command.actorId]!.progression.unspentAttributePoints < 1 ||
			intrinsicAttributes(
				state.heroes[command.actorId]!.capabilityProfile,
				state.heroes[command.actorId]!.progression.attributeGrowthReceipts,
				COMBAT_RULES_V1
			)[command.attribute] >= COMBAT_RULES_V1.attributes.intrinsicMaximum
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
}

export function assertSettlementCommandLegalWithActionIds(
	state: EngineGameState,
	command: SettlementCommand,
	legalActionIds: readonly string[]
): void {
	assertSettlementCommandLegal(state, command, legalActionIds);
}

function buildLegacySettlementEvent(
	state: Extract<EngineGameState, { schemaVersion: 1 }>,
	command: SettlementCommand
): AuthoritativeEvent {
	if (command.commandType === 'hero.choose.destination') {
		const base = eventBase(state, command, 'hero.destination.selected');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: command.destination,
				firstLine: command.firstLine,
				storyBranch: command.storyBranch,
				nextVersion: state.version + 1,
				entropyDraws: []
			}
		});
	}
	if (command.commandType === 'hero.arrive') {
		const hero = state.heroes[command.actorId];
		if (!hero?.destination) throw new IllegalActionError('hero.arrive.destination');
		const base = eventBase(state, command, 'hero.arrived');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: hero.destination,
				nextVersion: state.version + 1,
				entropyDraws: []
			}
		});
	}
	if (command.commandType !== 'master.inspect.gate') {
		throw new IllegalActionError(command.commandType);
	}
	const entropy = drawInteger(
		createEntropyCursor(state.seed, state.entropyCursor),
		'gate.resonance',
		0,
		99
	);
	const base = eventBase(state, command, 'master.gate.inspected');
	return AuthoritativeEventSchema.parse({
		...base,
		seedCursor: entropy.next.cursor,
		payload: {
			masterId: command.actorId,
			resonance: entropy.draw.value,
			nextVersion: state.version + 1,
			entropyDraws: [entropy.draw]
		}
	});
}

function buildModernSettlementEvent(
	state: EngineGameStateModern,
	command: SettlementCommand
): AuthoritativeEvent {
	if (command.commandType === 'story.recover.first.ember') {
		if (!hasFirstEmberState(state)) throw new IllegalActionError(command.commandType);
		const firstEmber = FirstEmberStateSchema.parse({
			...state.settlement.firstEmber,
			status: 'available',
			recoveredFrom: 'tower-floor-01',
			recoveredAt: state.simulatedAt
		});
		const base = eventBase(state, command, 'story.first.ember.recovered');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				firstEmber,
				nextVersion: state.version + 1,
				...emptyMetadata(
					'The party returned the First Ember from Floor 01. One permanent facility commitment is now available.'
				)
			}
		});
	}
	if (command.commandType === 'settlement.commit.first.ember') {
		if (!hasFirstEmberState(state)) throw new IllegalActionError(command.commandType);
		const target = state.settlement.buildings[command.buildingId];
		if (!target || state.settlement.firstEmber.status !== 'available') {
			throw new IllegalActionError(command.commandType);
		}
		const reactions = Object.values(state.heroes)
			.filter((hero) => hero.lifeState === 'active')
			.sort((left, right) => left.heroId.localeCompare(right.heroId))
			.map((hero) => buildFirstEmberReaction(hero, command.buildingId, command.rationale));
		const firstEmber = FirstEmberStateSchema.parse({
			...state.settlement.firstEmber,
			status: 'committed',
			committedAt: state.simulatedAt,
			buildingId: command.buildingId,
			rationale: command.rationale,
			modifiers: FIRST_EMBER_MODIFIERS[command.buildingId],
			reactions
		});
		const powerStateChanges = Object.values(state.settlement.buildings)
			.map((building) => ({
				buildingId: building.buildingId,
				before: building.powerState,
				after:
					building.buildingId === command.buildingId
						? ('powered' as const)
						: building.baselinePowerState
			}))
			.filter((change) => change.before !== change.after)
			.sort((left, right) => left.buildingId.localeCompare(right.buildingId));
		const activeSystemIdsAfter = Object.values(state.settlement.buildings)
			.filter(
				(building) =>
					building.buildingId === command.buildingId || building.baselinePowerState !== 'unpowered'
			)
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		const responseCounts = Object.fromEntries(
			['support', 'accept', 'question', 'oppose'].map((stance) => [
				stance,
				reactions.filter((reaction) => reaction.stance === stance).length
			])
		);
		const base = eventBase(state, command, 'settlement.first.ember.committed');
		const society =
			state.schemaVersion === 7 ||
			state.schemaVersion === 8 ||
			state.schemaVersion === 9 ||
			state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13
				? buildFirstEmberSociety(
						state,
						base.eventId,
						command.buildingId,
						command.rationale,
						reactions
					)
				: undefined;
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				firstEmber,
				...(society ? { society } : {}),
				previousPoweredBuildingId: state.settlement.poweredBuildingId,
				powerStateChanges,
				activeSystemIdsAfter,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The Master permanently bound the First Ember to ${command.buildingId}: ${responseCounts.support ?? 0} supported, ${responseCounts.accept ?? 0} accepted, ${responseCounts.question ?? 0} questioned, and ${responseCounts.oppose ?? 0} opposed.`
				)
			}
		});
	}
	if (
		command.commandType === 'master.issue.directive' ||
		command.commandType === 'master.replace.directive'
	) {
		if (
			state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20
		)
			throw new IllegalActionError(command.commandType);
		const eventType =
			command.commandType === 'master.issue.directive'
				? 'social.directive.issued'
				: 'social.directive.replaced';
		const base = eventBase(state, command, eventType);
		const change = buildDirectiveChange(state, base.eventId, command);
		const canceledScheduledEventIds = change.previousDirective?.expiryScheduledEventId
			? [change.previousDirective.expiryScheduledEventId]
			: [];
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				...change,
				nextVersion: state.version + 1,
				...emptyMetadata(
					command.commandType === 'master.issue.directive'
						? `The Master delivered a ${command.scope} direction to ${command.recipientIds.length} hero${command.recipientIds.length === 1 ? '' : 'es'}.`
						: `The Master replaced one direction with a witnessed ${command.scope} direction.`
				),
				canceledScheduledEventIds
			}
		});
	}
	if (command.commandType === 'master.revoke.directive') {
		if (
			state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20
		)
			throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'social.directive.revoked');
		const previousDirective = state.society.directives[command.directiveId]!;
		const change = revokeDirective(state, base.eventId, command.directiveId);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				directive: change.directive,
				previousDirective,
				communicativeAct: null,
				society: change.society,
				scheduledEvent: null,
				nextVersion: state.version + 1,
				...emptyMetadata('The Master revoked an active direction; its witnessed history remains.'),
				canceledScheduledEventIds: previousDirective.expiryScheduledEventId
					? [previousDirective.expiryScheduledEventId]
					: []
			}
		});
	}
	if (command.commandType === 'master.communicate') {
		if (
			state.schemaVersion !== 8 &&
			state.schemaVersion !== 9 &&
			state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 14 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20
		) {
			throw new IllegalActionError(command.commandType);
		}
		const base = eventBase(state, command, 'social.communicative.act.recorded');
		const { society, communicativeAct } = buildCommunicativeSociety(state, base.eventId, command);
		const bystanders = communicativeAct.witnesses.filter(
			(witness) => witness.role === 'bystander'
		).length;
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				communicativeAct,
				society,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The Master used ${command.kind} about ${command.topic}; one intended hero and ${bystanders} bystander${bystanders === 1 ? '' : 's'} witnessed it.`
				)
			}
		});
	}
	if (command.commandType === 'master.converse') {
		if (
			state.schemaVersion !== 9 &&
			state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 14 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20
		)
			throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'social.conversation.turn.recorded');
		const { society, conversationTurn } = buildConversationSociety(state, base.eventId, command);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				conversationTurn,
				society,
				nextVersion: state.version + 1,
				...emptyMetadata(
					conversationTurn.response.orderOutcome
						? `The hero ${conversationTurn.response.orderOutcome} the ${conversationTurn.orderIntent} order.`
						: `The hero answered the Master's ${conversationTurn.kind}.`
				)
			}
		});
	}
	if (command.commandType === 'simulation.sync.clock') {
		if (!hasRoutineState(state)) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'simulation.clock.synced');
		return AuthoritativeEventSchema.parse({
			...base,
			gameTime: command.targetGameTime,
			seedCursor: state.entropyCursor,
			payload: {
				targetGameTime: command.targetGameTime,
				nextVersion: state.version + 1,
				...emptyMetadata('The event-driven settlement clock advanced without due work.')
			}
		});
	}
	if (command.commandType === 'hero.plan.day') {
		if (!hasRoutineState(state)) throw new IllegalActionError(command.commandType);
		const dailyPlan = createDailyPlan(state, command.actorId, command.commandId);
		const base = eventBase(state, command, 'hero.daily.plan.created');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				dailyPlan,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero formed day ${dailyPlan.dayIndex}: habit, duty, meal, and sleep remain intentions until resolved.`
				)
			}
		});
	}
	if (command.commandType === 'hero.start.routine') {
		if (!hasRoutineState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.actorId];
		const resolution = resolveDailyRoutine(state, command.actorId);
		if (!hero?.dailyPlan || !resolution) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.routine.started');
		const routineId = deterministicUuid(`${command.commandId}:routine`);
		const scheduledEventId = deterministicUuid(`${command.commandId}:routine-completion`);
		const completesAt = addGameMinutes(state.simulatedAt, routineDuration(resolution.selectedKind));
		const currentRoutine = CurrentRoutineSchema.parse({
			routineId,
			scheduledEventId,
			planId: hero.dailyPlan.planId,
			planEntryId: resolution.selectedPlanEntryId,
			kind: resolution.selectedKind,
			resolution,
			startedAt: state.simulatedAt,
			completesAt
		});
		const scheduledEvent = ScheduledEventSchema.parse({
			scheduledEventId,
			runId: state.runId,
			actorId: command.actorId,
			dueGameTime: completesAt,
			eventKind: 'hero.routine.complete',
			payload: {
				heroId: command.actorId,
				routineId,
				planId: hero.dailyPlan.planId,
				planEntryId: resolution.selectedPlanEntryId,
				kind: resolution.selectedKind
			}
		});
		const resourceChanges =
			resolution.selectedKind === 'meal'
				? [resourceChange(state, 'food', 'daily plan meal reservation')]
				: [];
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				currentRoutine,
				resourceChanges,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The habit resolver selected ${routineLabel(resolution.selectedKind)}. ${resolution.summary}`
				),
				scheduledEvent
			}
		});
	}
	if (command.commandType === 'settlement.assign.hero') {
		if (!hasFacilityState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.heroId];
		const building = state.settlement.buildings[command.buildingId];
		if (!hero || !building) throw new IllegalActionError(command.commandType);
		const assignment = HeroBuildingAssignmentSchema.parse({
			buildingId: building.buildingId,
			nodeId: building.assignmentNodeId,
			role: building.assignmentRole,
			assignedAt: state.simulatedAt
		});
		const base = eventBase(state, command, 'hero.assignment.changed');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: hero.heroId,
				previousAssignment: hero.assignment,
				assignment,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero was assigned to ${building.buildingId} as ${building.assignmentRole}.`
				)
			}
		});
	}
	if (command.commandType === 'settlement.unassign.hero') {
		if (!hasFacilityState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.heroId];
		if (!hero?.assignment) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.assignment.changed');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: hero.heroId,
				previousAssignment: hero.assignment,
				assignment: null,
				nextVersion: state.version + 1,
				...emptyMetadata(`The hero was released from ${hero.assignment.buildingId}.`)
			}
		});
	}
	if (command.commandType === 'settlement.allocate.power') {
		if (!hasFacilityState(state)) throw new IllegalActionError(command.commandType);
		const target = state.settlement.buildings[command.buildingId];
		if (!target) throw new IllegalActionError(command.commandType);
		const powerStateChanges = Object.values(state.settlement.buildings)
			.map((building) => ({
				buildingId: building.buildingId,
				before: building.powerState,
				after:
					building.buildingId === command.buildingId
						? ('powered' as const)
						: building.baselinePowerState
			}))
			.filter((change) => change.before !== change.after)
			.sort((left, right) => left.buildingId.localeCompare(right.buildingId));
		const activeSystemIdsAfter = Object.values(state.settlement.buildings)
			.filter(
				(building) =>
					building.buildingId === command.buildingId || building.baselinePowerState !== 'unpowered'
			)
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		const base = eventBase(state, command, 'settlement.power.allocated');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				buildingId: command.buildingId,
				previousPoweredBuildingId: state.settlement.poweredBuildingId,
				powerStateChanges,
				activeSystemIdsAfter,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The development power slot now feeds ${command.buildingId}; route access was recomputed.`
				)
			}
		});
	}
	if (command.commandType === 'hero.start.travel') {
		if (!hasNavigationState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.actorId];
		if (!hero) throw new IllegalActionError(command.commandType);
		const definition = settlementForState(state);
		const route = settlementRouteFor(state, definition, command.actorId, command.targetNodeId);
		const destinationZone = zoneForNode(definition, command.targetNodeId);
		if (!route || route.totalTravelGameSeconds <= 0 || !destinationZone) {
			throw new IllegalActionError(command.commandType);
		}
		const base = eventBase(state, command, 'hero.travel.started');
		const travelId = deterministicUuid(`${command.commandId}:travel`);
		const scheduledEventId = deterministicUuid(`${command.commandId}:arrival`);
		const dueGameTime = addGameSeconds(state.simulatedAt, route.totalTravelGameSeconds);
		const scheduledEvent = ScheduledEventSchema.parse({
			scheduledEventId,
			runId: state.runId,
			actorId: command.actorId,
			dueGameTime,
			eventKind: 'hero.travel.arrive',
			payload: {
				heroId: command.actorId,
				travelId,
				fromNodeId: route.fromNodeId,
				toNodeId: route.toNodeId,
				settlementContentHash: definition.contentHash
			}
		});
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				travelId,
				fromNodeId: route.fromNodeId,
				toNodeId: route.toNodeId,
				destinationZone,
				route,
				settlementContentVersion: definition.contentVersion,
				settlementContentHash: definition.contentHash,
				scheduledEvent,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero began a ${route.totalTravelGameSeconds}-second route from ${route.fromNodeId} to ${route.toNodeId}; arrival is due at ${dueGameTime}.`
				)
			}
		});
	}
	if (command.commandType === 'hero.choose.destination') {
		const base = eventBase(state, command, 'hero.destination.selected');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: command.destination,
				firstLine: command.firstLine,
				storyBranch: command.storyBranch,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero chose the ${command.destination === 'kitchen' ? 'kitchen' : 'training ground'}.`
				)
			}
		});
	}
	if (command.commandType === 'hero.arrive') {
		if (hasNavigationState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.actorId];
		if (!hero?.destination) throw new IllegalActionError('hero.arrive.destination');
		const base = eventBase(state, command, 'hero.arrived');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: hero.destination,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero reached the ${hero.destination === 'kitchen' ? 'kitchen' : 'training ground'}.`
				)
			}
		});
	}
	if (command.commandType === 'master.inspect.gate') {
		const entropy = drawInteger(
			createEntropyCursor(state.seed, state.entropyCursor),
			'gate.resonance',
			0,
			99
		);
		const base = eventBase(state, command, 'master.gate.inspected');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: entropy.next.cursor,
			payload: {
				masterId: command.actorId,
				resonance: entropy.draw.value,
				nextVersion: state.version + 1,
				...emptyMetadata(`The gate answered with resonance ${entropy.draw.value}.`),
				entropyDraws: [entropy.draw]
			}
		});
	}
	if (command.commandType === 'hero.start.activity') {
		const base = eventBase(state, command, 'hero.activity.started');
		const activityId = deterministicUuid(`${command.commandId}:activity`);
		const scheduledEventId = deterministicUuid(`${command.commandId}:completion`);
		const dueGameTime = addGameMinutes(state.simulatedAt, activityDuration(command.activity));
		const scheduledEvent = ScheduledEventSchema.parse({
			scheduledEventId,
			runId: state.runId,
			actorId: command.actorId,
			dueGameTime,
			eventKind: 'hero.activity.complete',
			payload: { heroId: command.actorId, activityId, activity: command.activity }
		});
		const resourceChanges =
			command.activity === 'eat'
				? [resourceChange(state, 'food', 'meal reserved')]
				: command.activity === 'repair'
					? [resourceChange(state, 'iron-ore', 'repair material reserved')]
					: [];
		const rewardDeltas = resourceChanges.map((change): RewardDelta => ({
			ownerId: state.master.masterId,
			kind: 'resource',
			key: change.resource,
			before: change.before,
			after: change.after,
			delta: change.delta
		}));
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				activity: command.activity,
				activityId,
				scheduledEvent,
				resourceChanges,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero began ${command.activity}; completion is due at ${dueGameTime}.`,
					rewardDeltas
				)
			}
		});
	}
	if (command.commandType === 'hero.start.forging') {
		if (state.schemaVersion !== 24) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.forging.started');
		const start = buildStandardForgingStart({
			state,
			commandId: command.commandId,
			forgeEventId: base.eventId,
			heroId: command.actorId,
			definitionId: command.definitionId,
			materialId: command.materialId,
			craftsmanship: command.craftsmanship
		});
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				currentForging: start.currentForging,
				scheduledEvent: start.scheduledEvent,
				materialLotChange: start.materialLotChange,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero reserved one ${command.materialId} lot and began Standard Forging.`,
					[
						{
							ownerId: state.master.masterId,
							kind: 'resource',
							key: command.materialId,
							before: start.materialLotChange.before,
							after: start.materialLotChange.after,
							delta: -1
						}
					]
				)
			}
		});
	}
	if (command.commandType === 'hero.equip.item') {
		const hero = state.heroes[command.actorId];
		if (!hero) throw new IllegalActionError(command.commandType);
		const nextItem = state.items[command.itemId];
		const base = eventBase(state, command, 'hero.item.equipped');
		const targetSlot =
			(state.schemaVersion === 24 || state.schemaVersion === 25) &&
			nextItem &&
			'definitionId' in nextItem
				? (command.targetSlot ?? verifiedEquipmentDefinition(nextItem.definitionId).slot)
				: undefined;
		const previousItemId =
			(state.schemaVersion === 24 || state.schemaVersion === 25) && targetSlot
				? state.heroes[command.actorId]!.equipment[
						targetSlot === 'main-hand'
							? 'mainHand'
							: targetSlot === 'off-hand'
								? 'offHand'
								: targetSlot
					]
				: hero.equipment.mainHand;
		const before = previousItemId ? 1 : 0;
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				itemId: command.itemId,
				previousItemId,
				...(targetSlot ? { targetSlot } : {}),
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero equipped ${nextItem ? equipmentItemDisplayName(nextItem) : 'an item'}.`,
					[
						{
							ownerId: command.actorId,
							kind: 'item',
							key: 'main-hand',
							before,
							after: 1,
							delta: 1 - before
						}
					]
				)
			}
		});
	}
	if (command.commandType === 'hero.allocate.attribute') {
		if (state.schemaVersion !== 25) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.actorId];
		if (!hero) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.attribute.allocated');
		const beforeIntrinsicValue = intrinsicAttributes(
			hero.capabilityProfile,
			hero.progression.attributeGrowthReceipts,
			COMBAT_RULES_V1
		)[command.attribute];
		const attributeGrowthReceipt = AttributeGrowthReceiptSchema.parse({
			receiptId: deterministicUuid(`${base.eventId}:attribute-growth`),
			heroId: hero.heroId,
			attribute: command.attribute,
			beforeIntrinsicValue,
			afterIntrinsicValue: beforeIntrinsicValue + 1,
			spentPoints: 1,
			sourceLevel: hero.progression.level,
			rulesVersion: COMBAT_RULES_V1.rulesVersion,
			commandId: command.commandId,
			gameTime: state.simulatedAt
		});
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: hero.heroId,
				attributeGrowthReceipt,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero permanently increased intrinsic ${command.attribute} by one point.`
				)
			}
		});
	}
	if (command.commandType === 'simulation.advance') {
		const base = eventBase(state, command, 'simulation.advanced');
		const dueHeroes = Object.values(state.heroes)
			.filter(
				(hero) =>
					hero.currentActivity &&
					compareGameTime(hero.currentActivity.completesAt, command.targetGameTime) <= 0
			)
			.sort((left, right) => {
				const time = compareGameTime(
					left.currentActivity!.completesAt,
					right.currentActivity!.completesAt
				);
				return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
			});
		let entropy = createEntropyCursor(state.seed, state.entropyCursor);
		const outcomes: (
			z.infer<typeof ActivityOutcomeSchema> | z.infer<typeof ActivityOutcomeV25Schema>
		)[] = [];
		const draws: EntropyDraw[] = [];
		for (const hero of dueHeroes) {
			const result = buildActivityOutcome(state, hero.heroId, base.eventId, entropy);
			outcomes.push(result.outcome);
			entropy = result.entropy;
			draws.push(...result.draws);
		}
		if (hasRoutineState(state)) {
			const expiredDirectives =
				state.schemaVersion === 10 ||
				state.schemaVersion === 11 ||
				state.schemaVersion === 12 ||
				state.schemaVersion === 13
					? Object.values(state.society.directives)
							.filter(
								(directive) =>
									directive.status === 'active' &&
									directive.expiresAt !== null &&
									compareGameTime(directive.expiresAt, command.targetGameTime) <= 0
							)
							.sort((left, right) =>
								left.expiresAt === right.expiresAt
									? left.directiveId.localeCompare(right.directiveId)
									: compareGameTime(left.expiresAt!, right.expiresAt!)
							)
					: [];
			const dueTravels = Object.values(state.heroes)
				.filter(
					(hero) =>
						hero.currentTravel &&
						compareGameTime(hero.currentTravel.arrivesAt, command.targetGameTime) <= 0
				)
				.sort((left, right) => {
					const time = compareGameTime(
						left.currentTravel!.arrivesAt,
						right.currentTravel!.arrivesAt
					);
					return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
				});
			const travelOutcomes = dueTravels.map((hero) => ({
				scheduledEventId: hero.currentTravel!.scheduledEventId,
				heroId: hero.heroId,
				travelId: hero.currentTravel!.travelId,
				fromNodeId: hero.currentTravel!.fromNodeId,
				toNodeId: hero.currentTravel!.toNodeId,
				locationAfter: hero.currentTravel!.destinationZone
			}));
			const dueRoutines = Object.values(state.heroes)
				.filter(
					(hero) =>
						hero.currentRoutine &&
						compareGameTime(hero.currentRoutine.completesAt, command.targetGameTime) <= 0
				)
				.sort((left, right) => {
					const time = compareGameTime(
						left.currentRoutine!.completesAt,
						right.currentRoutine!.completesAt
					);
					return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
				});
			const routineOutcomes = dueRoutines.map((hero) => buildRoutineOutcome(state, hero.heroId));
			const dueForgings =
				state.schemaVersion === 24
					? Object.values(state.heroes)
							.filter(
								(hero) =>
									hero.currentForging &&
									compareGameTime(hero.currentForging.completesAt, command.targetGameTime) <= 0
							)
							.sort((left, right) => {
								const time = compareGameTime(
									left.currentForging!.completesAt,
									right.currentForging!.completesAt
								);
								return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
							})
					: [];
			const forgingOutcomes =
				state.schemaVersion === 24
					? dueForgings.map((hero) => buildForgingOutcome(state, hero.heroId))
					: [];
			const dueByScheduleId = new Map<string, string>();
			for (const hero of dueHeroes)
				dueByScheduleId.set(
					hero.currentActivity!.scheduledEventId,
					hero.currentActivity!.completesAt
				);
			for (const hero of dueTravels)
				dueByScheduleId.set(hero.currentTravel!.scheduledEventId, hero.currentTravel!.arrivesAt);
			for (const hero of dueRoutines)
				dueByScheduleId.set(
					hero.currentRoutine!.scheduledEventId,
					hero.currentRoutine!.completesAt
				);
			for (const hero of dueForgings)
				dueByScheduleId.set(
					hero.currentForging!.scheduledEventId,
					hero.currentForging!.completesAt
				);
			for (const directive of expiredDirectives)
				dueByScheduleId.set(directive.expiryScheduledEventId!, directive.expiresAt!);
			const resolvedScheduledEventIds = [
				...outcomes.map((outcome) => outcome.scheduledEventId),
				...travelOutcomes.map((outcome) => outcome.scheduledEventId),
				...routineOutcomes.map((outcome) => outcome.scheduledEventId),
				...forgingOutcomes.map((outcome) => outcome.scheduledEventId),
				...expiredDirectives.map((directive) => directive.expiryScheduledEventId!)
			].sort((left, right) => {
				const time = compareGameTime(dueByScheduleId.get(left)!, dueByScheduleId.get(right)!);
				return time === 0 ? left.localeCompare(right) : time;
			});
			const rewardDeltas = [
				...outcomes.flatMap((outcome) => outcome.rewardDeltas),
				...routineOutcomes.flatMap((outcome) => outcome.rewardDeltas),
				...forgingOutcomes.map((outcome): RewardDelta => ({
					ownerId: outcome.heroId,
					kind: 'item',
					key: outcome.definitionId,
					before: 0,
					after: 1,
					delta: 1
				}))
			];
			const resolutionParts = [
				outcomes.length === 0
					? null
					: outcomes.length === 1
						? `one ${outcomes[0]!.activity} activity`
						: `${outcomes.length} activities`,
				travelOutcomes.length === 0
					? null
					: travelOutcomes.length === 1
						? 'one scheduled arrival'
						: `${travelOutcomes.length} scheduled arrivals`,
				routineOutcomes.length === 0
					? null
					: routineOutcomes.length === 1
						? 'one daily routine'
						: `${routineOutcomes.length} daily routines`,
				forgingOutcomes.length === 0
					? null
					: forgingOutcomes.length === 1
						? 'one Standard Forging job'
						: `${forgingOutcomes.length} Standard Forging jobs`,
				expiredDirectives.length === 0
					? null
					: expiredDirectives.length === 1
						? 'one direction expiry'
						: `${expiredDirectives.length} direction expiries`
			].filter((part): part is string => Boolean(part));
			return AuthoritativeEventSchema.parse({
				...base,
				gameTime: command.targetGameTime,
				seedCursor: entropy.cursor,
				payload: {
					targetGameTime: command.targetGameTime,
					activityOutcomes: outcomes,
					travelOutcomes,
					routineOutcomes,
					...(state.schemaVersion === 24 ? { forgingOutcomes } : {}),
					expiredDirectiveIds: expiredDirectives.map((directive) => directive.directiveId),
					nextVersion: state.version + 1,
					...emptyMetadata(
						`${resolutionParts.join(' and ').replace(/^./u, (letter) => letter.toUpperCase())} resolved.`,
						rewardDeltas
					),
					resolvedScheduledEventIds,
					entropyDraws: draws
				}
			});
		}
		if (state.schemaVersion === 3 || state.schemaVersion === 4) {
			const dueTravels = Object.values(state.heroes)
				.filter(
					(hero) =>
						hero.currentTravel &&
						compareGameTime(hero.currentTravel.arrivesAt, command.targetGameTime) <= 0
				)
				.sort((left, right) => {
					const time = compareGameTime(
						left.currentTravel!.arrivesAt,
						right.currentTravel!.arrivesAt
					);
					return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
				});
			const travelOutcomes = dueTravels.map((hero) => ({
				scheduledEventId: hero.currentTravel!.scheduledEventId,
				heroId: hero.heroId,
				travelId: hero.currentTravel!.travelId,
				fromNodeId: hero.currentTravel!.fromNodeId,
				toNodeId: hero.currentTravel!.toNodeId,
				locationAfter: hero.currentTravel!.destinationZone
			}));
			const dueByScheduleId = new Map<string, string>();
			for (const hero of dueHeroes)
				dueByScheduleId.set(
					hero.currentActivity!.scheduledEventId,
					hero.currentActivity!.completesAt
				);
			for (const hero of dueTravels)
				dueByScheduleId.set(hero.currentTravel!.scheduledEventId, hero.currentTravel!.arrivesAt);
			const resolvedScheduledEventIds = [
				...outcomes.map((outcome) => outcome.scheduledEventId),
				...travelOutcomes.map((outcome) => outcome.scheduledEventId)
			].sort((left, right) => {
				const time = compareGameTime(dueByScheduleId.get(left)!, dueByScheduleId.get(right)!);
				return time === 0 ? left.localeCompare(right) : time;
			});
			const rewardDeltas = outcomes.flatMap((outcome) => outcome.rewardDeltas);
			const resolutionParts = [
				outcomes.length === 0
					? null
					: outcomes.length === 1
						? `one ${outcomes[0]!.activity} activity`
						: `${outcomes.length} activities`,
				travelOutcomes.length === 0
					? null
					: travelOutcomes.length === 1
						? 'one scheduled arrival'
						: `${travelOutcomes.length} scheduled arrivals`
			].filter((part): part is string => Boolean(part));
			return AuthoritativeEventSchema.parse({
				...base,
				gameTime: command.targetGameTime,
				seedCursor: entropy.cursor,
				payload: {
					targetGameTime: command.targetGameTime,
					activityOutcomes: outcomes,
					travelOutcomes,
					nextVersion: state.version + 1,
					...emptyMetadata(
						`${resolutionParts.join(' and ').replace(/^./u, (letter) => letter.toUpperCase())} resolved.`,
						rewardDeltas
					),
					resolvedScheduledEventIds,
					entropyDraws: draws
				}
			});
		}
		const resolvedScheduledEventIds = outcomes.map((outcome) => outcome.scheduledEventId);
		const rewardDeltas = outcomes.flatMap((outcome) => outcome.rewardDeltas);
		return AuthoritativeEventSchema.parse({
			...base,
			gameTime: command.targetGameTime,
			seedCursor: entropy.cursor,
			payload: {
				targetGameTime: command.targetGameTime,
				outcomes,
				nextVersion: state.version + 1,
				...emptyMetadata(
					outcomes.length === 1
						? `One ${outcomes[0]?.activity} activity completed.`
						: `${outcomes.length} scheduled activities completed.`,
					rewardDeltas
				),
				resolvedScheduledEventIds,
				entropyDraws: draws
			}
		});
	}
	if (command.commandType !== 'simulation.apply.damage') {
		throw new Error('Unreachable settlement command discriminator');
	}
	const targetKind = command.targetId === state.master.masterId ? 'master' : 'hero';
	const target = targetKind === 'master' ? state.master : state.heroes[command.targetId];
	if (!target) throw new IllegalActionError(command.commandType);
	const healthAfter = Math.max(0, target.health - command.amount);
	const fatal = healthAfter === 0;
	const eventType = fatal ? `${targetKind}.died` : `${targetKind}.damaged`;
	const base = eventBase(state, command, eventType);
	const injury = fatal
		? null
		: InjurySchema.parse({
				injuryId: deterministicUuid(`${base.eventId}:${command.targetId}:injury`),
				kind: command.amount >= 50 ? 'critical' : command.amount >= 20 ? 'strain' : 'bruise',
				severity: command.amount,
				inflictedAt: state.simulatedAt
			});
	const targetHero = state.heroes[command.targetId];
	const targetHeroSchedules = targetHero
		? [
				targetHero.currentActivity?.scheduledEventId,
				currentTravelFor(state, command.targetId)?.scheduledEventId,
				currentRoutineFor(state, command.targetId)?.scheduledEventId,
				currentForgingFor(state, command.targetId)?.scheduledEventId
			].filter((id): id is string => Boolean(id))
		: [];
	const canceledScheduledEventIds = fatal
		? targetKind === 'master'
			? Object.values(state.heroes)
					.flatMap((hero) => [
						hero.currentActivity?.scheduledEventId,
						currentTravelFor(state, hero.heroId)?.scheduledEventId,
						currentRoutineFor(state, hero.heroId)?.scheduledEventId,
						currentForgingFor(state, hero.heroId)?.scheduledEventId
					])
					.filter((id): id is string => Boolean(id))
			: targetHeroSchedules
		: [];
	return AuthoritativeEventSchema.parse({
		...base,
		seedCursor: state.entropyCursor,
		payload: {
			targetId: command.targetId,
			targetKind,
			damageKind: command.damageKind,
			amount: command.amount,
			healthBefore: target.health,
			healthAfter,
			injury,
			nextVersion: state.version + 1,
			...emptyMetadata(
				fatal
					? targetKind === 'master'
						? 'The Master died. The run ended atomically.'
						: 'A summoned hero died permanently.'
					: `${targetKind === 'master' ? 'The Master' : 'A hero'} suffered ${command.amount} ${command.damageKind} damage.`,
				[
					{
						ownerId: command.targetId,
						kind: 'health',
						key: 'body',
						before: target.health,
						after: healthAfter,
						delta: healthAfter - target.health
					}
				]
			),
			canceledScheduledEventIds
		}
	});
}

function buildSettlementEvent(
	state: EngineGameState,
	command: SettlementCommand
): AuthoritativeEvent {
	return state.schemaVersion === 1
		? buildLegacySettlementEvent(state, command)
		: buildModernSettlementEvent(state, command);
}

export const settlementCommandHandler: EngineCommandHandler<SettlementCommand> = {
	ownerId: 'settlement',
	commandTypes: SETTLEMENT_COMMAND_TYPES,
	assertLegal: assertSettlementCommandLegal,
	buildEvent: buildSettlementEvent
};

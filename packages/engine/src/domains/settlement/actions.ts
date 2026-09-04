import {
	LegalActionSchema,
	type EngineGameState,
	type EngineGameStateV3,
	type EngineGameStateV4,
	type EngineGameStateV5,
	type EngineGameStateV6,
	type EngineGameStateV7,
	type EngineGameStateV8,
	type EngineGameStateV9,
	type EngineGameStateV10,
	type EngineGameStateV11,
	type EngineGameStateV12,
	type EngineGameStateV13,
	type EngineGameStateV14,
	type EngineGameStateV15,
	type EngineGameStateV16,
	type EngineGameStateV17,
	type EngineGameStateV18,
	type EngineGameStateV19,
	type EngineGameStateV20,
	type EngineGameStateV21,
	type EngineGameStateV22,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type LegalAction
} from '@summonlab/contracts';

import { settlementForState } from '../../core/content-bindings.js';
import { parseGameState } from '../../core/state.js';
import type { EngineGameStateModern } from '../../core/types.js';
import {
	hasFirstEmberState,
	hasNavigationState,
	hasRoutineState,
	isModernState
} from '../../core/versions.js';
import {
	currentTravelFor,
	routeHasCapacity,
	settlementRouteFor,
	zoneForNode
} from './navigation.js';
import { currentRoutineFor, gameDayIndex, resolveDailyRoutine } from './routines.js';
import { heroCanHearCommunication } from './society.js';
import { equipmentItemDisplayName } from './equipment.js';
import {
	availableStandardForgeDefinitions,
	currentForgingFor,
	heroHasForgePermission
} from './forging.js';

export function action(input: Parameters<typeof LegalActionSchema.parse>[0]): LegalAction {
	return LegalActionSchema.parse(input);
}

export function settlementTravelActions(
	state:
		| EngineGameStateV3
		| EngineGameStateV4
		| EngineGameStateV5
		| EngineGameStateV6
		| EngineGameStateV7
		| EngineGameStateV8
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV22
		| EngineGameStateV23
		| EngineGameStateV24,
	actorId: string,
	targetNodeIds?: readonly string[]
): LegalAction[] {
	const hero = state.heroes[actorId];
	if (!hero) return [];
	const definition = settlementForState(state);
	const allowedTargets = targetNodeIds ? new Set(targetNodeIds) : null;
	return definition.nodes
		.filter(
			(node) =>
				node.nodeId !== hero.locationNodeId &&
				zoneForNode(definition, node.nodeId) !== null &&
				(!allowedTargets || allowedTargets.has(node.nodeId))
		)
		.map((node) => ({
			node,
			route: settlementRouteFor(state, definition, actorId, node.nodeId)
		}))
		.filter(
			(candidate) =>
				candidate.route !== null &&
				candidate.route.totalTravelGameSeconds > 0 &&
				routeHasCapacity(state, definition, actorId, candidate.node.nodeId, candidate.route)
		)
		.sort((left, right) => left.node.nodeId.localeCompare(right.node.nodeId))
		.map(({ node, route }) =>
			action({
				actionId: `hero.travel.${node.nodeId}`,
				actorId,
				kind: 'move',
				label: `Travel to ${node.label}`,
				description: `Schedule the verified ${route!.totalTravelGameSeconds}-second route to ${node.label}.`,
				targetIds: [],
				resourceCosts: {},
				tags: ['settlement', 'scheduled-event', 'content-bound', node.nodeId]
			})
		);
}

function routeActions(state: EngineGameState, actorId: string): LegalAction[] {
	const hero = state.heroes[actorId];
	if (!hero || hero.lifeState !== 'active') return [];
	if (currentTravelFor(state, actorId)) return [];
	if (hero.destination === null) {
		if (hasNavigationState(state) && state.heroes[actorId]?.firstArrivalCompleted) return [];
		return [
			action({
				actionId: 'hero.choose.kitchen',
				actorId,
				kind: 'move',
				label: 'Choose the kitchen',
				description: 'Open the names-before-orders branch and plan a route to the kitchen.',
				targetIds: [],
				resourceCosts: {},
				tags: ['story-branch', 'settlement']
			}),
			action({
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
	const awaitingFirstArrival = hasNavigationState(state)
		? !state.heroes[actorId]!.firstArrivalCompleted
		: false;
	if ((!hasNavigationState(state) && hero.location === 'summoning-gate') || awaitingFirstArrival) {
		return [
			action({
				actionId: hasNavigationState(state) ? 'hero.travel' : 'hero.arrive.destination',
				actorId,
				kind: 'move',
				label: `Walk to the ${hero.destination === 'kitchen' ? 'kitchen' : 'training ground'}`,
				description: hasNavigationState(state)
					? 'Schedule the verified route; arrival commits only when game time reaches its due time.'
					: 'Complete the already selected route through Hearth 01.',
				targetIds: [],
				resourceCosts: {},
				tags: ['settlement', 'arrival']
			})
		];
	}
	return [];
}

function masterSettlementActions(
	state: EngineGameStateModern,
	actorId: string,
	actions: LegalAction[]
): LegalAction[] {
	if (
		Object.values(state.heroes).some(
			(hero) =>
				hero.currentActivity ||
				currentTravelFor(state, hero.heroId) ||
				currentRoutineFor(state, hero.heroId) ||
				currentForgingFor(state, hero.heroId)
		) ||
		((state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23) &&
			Object.values(state.society.directives).some(
				(directive) => directive.status === 'active' && directive.expiresAt !== null
			))
	) {
		actions.push(
			action({
				actionId: 'simulation.advance',
				actorId,
				kind: 'wait',
				label: 'Advance to the next scheduled outcome',
				description:
					'Advance the injected game clock and resolve every due activity or arrival in order.',
				targetIds: [],
				resourceCosts: {},
				tags: ['fake-clock', 'scheduled-event']
			})
		);
	}
	if (
		state.schemaVersion === 4 ||
		state.schemaVersion === 5 ||
		state.schemaVersion === 6 ||
		state.schemaVersion === 7 ||
		state.schemaVersion === 8 ||
		state.schemaVersion === 9 ||
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20
	) {
		for (const hero of Object.values(state.heroes)) {
			if (hero.lifeState !== 'active') continue;
			if (hero.assignment) {
				actions.push(
					action({
						actionId: `settlement.unassign.${hero.heroId}`,
						actorId,
						kind: 'work',
						label: `Release ${hero.heroId.slice(0, 8)} from duty`,
						description: 'Remove the hero from the authoritative facility roster.',
						targetIds: [hero.heroId],
						resourceCosts: {},
						tags: ['settlement', 'assignment', 'capacity']
					})
				);
			}
			for (const building of Object.values(state.settlement.buildings)) {
				if (
					hero.assignment?.buildingId === building.buildingId ||
					building.assignedHeroIds.length >= building.assignmentCapacity
				)
					continue;
				actions.push(
					action({
						actionId: `settlement.assign.${hero.heroId}.${building.buildingId}`,
						actorId,
						kind: 'work',
						label: `Assign hero as ${building.assignmentRole}`,
						description: `Move the hero into ${building.buildingId}'s ${building.assignedHeroIds.length}/${building.assignmentCapacity} roster.`,
						targetIds: [hero.heroId],
						resourceCosts: {},
						tags: ['settlement', 'assignment', 'capacity', building.buildingId]
					})
				);
			}
		}
		if (state.schemaVersion === 4 || state.schemaVersion === 5)
			for (const building of Object.values(state.settlement.buildings)) {
				if (
					building.buildingId === 'summoning-gate' ||
					state.settlement.poweredBuildingId === building.buildingId
				)
					continue;
				actions.push(
					action({
						actionId: `settlement.power.${building.buildingId}`,
						actorId,
						kind: 'interact',
						label: `Route development power to ${building.buildingId}`,
						description:
							'Reallocate the one reversible development power slot and refresh route access.',
						targetIds: [],
						resourceCosts: {},
						tags: ['settlement', 'power', 'development-proof', building.buildingId]
					})
				);
			}
	}
	if (
		state.schemaVersion === 8 ||
		state.schemaVersion === 9 ||
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20
	) {
		for (const hero of Object.values(state.heroes)) {
			if (hero.location !== state.master.location || !heroCanHearCommunication(hero)) {
				continue;
			}
			actions.push(
				action({
					actionId: `social.communicate.${hero.heroId}`,
					actorId,
					kind: 'interact',
					label: `Speak with ${hero.heroId.slice(0, 8)}`,
					description:
						'Record exact words, compute actual witnesses, and transfer only an engine-approved claim.',
					targetIds: [hero.heroId],
					resourceCosts: {},
					tags: ['social', 'communication', 'witness-bounded']
				})
			);
			if (
				state.schemaVersion === 9 ||
				state.schemaVersion === 10 ||
				state.schemaVersion === 11 ||
				state.schemaVersion === 12 ||
				state.schemaVersion === 13 ||
				state.schemaVersion === 16 ||
				state.schemaVersion === 17 ||
				state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20
			) {
				actions.push(
					action({
						actionId: `social.converse.${hero.heroId}`,
						actorId,
						kind: 'interact',
						label: `Have a conversation with ${hero.heroId.slice(0, 8)}`,
						description:
							'Say, ask, or give a bounded order; the hero replies from their own mind and circumstances.',
						targetIds: [hero.heroId],
						resourceCosts: {},
						tags: ['social', 'conversation', 'agency', 'witness-bounded']
					})
				);
			}
		}
	}
	if (
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20
	) {
		if (
			Object.values(state.heroes).some(
				(hero) => hero.location === state.master.location && heroCanHearCommunication(hero)
			)
		) {
			actions.push(
				action({
					actionId: 'social.directive.issue',
					actorId,
					kind: 'interact',
					label: 'Give a scoped direction',
					description:
						'Record exact words, recipients, witnessed delivery, priorities, and a bounded lifetime.',
					targetIds: [],
					resourceCosts: {},
					tags: ['social', 'directive', 'best-effort', 'witness-bounded']
				})
			);
		}
		for (const directive of Object.values(state.society.directives).filter(
			(candidate) => candidate.status === 'active'
		)) {
			actions.push(
				action({
					actionId: `social.directive.replace.${directive.directiveId}`,
					actorId,
					kind: 'interact',
					label: 'Replace active direction',
					description: 'End this direction and deliver a witnessed replacement atomically.',
					targetIds: directive.recipientIds,
					resourceCosts: {},
					tags: ['social', 'directive', 'replace']
				}),
				action({
					actionId: `social.directive.revoke.${directive.directiveId}`,
					actorId,
					kind: 'interact',
					label: 'Revoke active direction',
					description: 'End this direction without deleting its witnessed history.',
					targetIds: directive.recipientIds,
					resourceCosts: {},
					tags: ['social', 'directive', 'revoke']
				})
			);
		}
	}
	if (hasFirstEmberState(state) && state.settlement.firstEmber.status === 'available') {
		for (const buildingId of ['kitchen', 'dormitory', 'training-ground'] as const) {
			actions.push(
				action({
					actionId: `settlement.first-ember.${buildingId}`,
					actorId,
					kind: 'interact',
					label: `Bind the First Ember to ${buildingId}`,
					description:
						'Make the irreversible facility commitment and record each hero’s immediate response.',
					targetIds: [],
					resourceCosts: {},
					tags: ['settlement', 'first-ember', 'irreversible', buildingId]
				})
			);
		}
	}
	for (const hero of Object.values(state.heroes)) {
		if (hero.lifeState !== 'active') continue;
		actions.push(
			action({
				actionId: `simulation.damage.hero.${hero.heroId}`,
				actorId,
				kind: 'attack',
				label: 'Apply a controlled hero hazard',
				description: 'Development proof for injury, terminal state, and schedule cancellation.',
				targetIds: [hero.heroId],
				resourceCosts: {},
				tags: ['development-proof', 'permadeath']
			})
		);
	}
	actions.push(
		action({
			actionId: 'simulation.damage.master',
			actorId,
			kind: 'attack',
			label: 'Apply a controlled Master hazard',
			description: 'Development proof that Master death atomically ends the run.',
			targetIds: [actorId],
			resourceCosts: {},
			tags: ['development-proof', 'game-over']
		})
	);
	return actions;
}

function heroSettlementActions(state: EngineGameStateModern, actorId: string): LegalAction[] {
	const route = routeActions(state, actorId);
	if (route.length > 0) return route;
	const hero = state.heroes[actorId];
	if (
		!hero ||
		hero.lifeState !== 'active' ||
		hero.currentActivity ||
		currentTravelFor(state, actorId) ||
		currentRoutineFor(state, actorId) ||
		currentForgingFor(state, actorId)
	)
		return [];
	const actions: LegalAction[] = [];
	if (state.schemaVersion === 24 && heroHasForgePermission(state, actorId)) {
		for (const definition of availableStandardForgeDefinitions(state, actorId)) {
			actions.push(
				action({
					actionId: `hero.forge.${definition.definitionId}`,
					actorId,
					kind: 'work',
					label: `Forge ${definition.displayName}`,
					description: `Consume one ${definition.materialId} lot and complete one Standard item after 60 game minutes.`,
					targetIds: [],
					resourceCosts: { [definition.materialId]: 1 },
					tags: [
						'forging',
						'equipment',
						'standard',
						definition.materialId,
						definition.equipmentClass
					]
				})
			);
		}
	}
	if (hasRoutineState(state)) {
		const heroV5 = state.heroes[actorId];
		if (!heroV5) return [];
		const currentDay = gameDayIndex(state.simulatedAt);
		const priorPlanComplete =
			heroV5.dailyPlan?.entries.every(
				(entry) => entry.status === 'completed' || entry.status === 'skipped'
			) ?? false;
		if (!heroV5.dailyPlan || (heroV5.dailyPlan.dayIndex < currentDay && priorPlanComplete)) {
			actions.push(
				action({
					actionId: 'hero.plan.day',
					actorId,
					kind: 'wait',
					label: 'Make a daily plan',
					description:
						'Build four deterministic intentions from this hero’s mind, habit, assignment, and needs.',
					targetIds: [],
					resourceCosts: {},
					tags: ['daily-plan', 'habit', 'zero-model-cost']
				})
			);
		}
		if (resolveDailyRoutine(state, actorId)) {
			actions.push(
				action({
					actionId: 'hero.follow.plan',
					actorId,
					kind: 'work',
					label: 'Follow the next routine',
					description:
						'Rank every pending intention and schedule the highest eligible routine with inspectable scores.',
					targetIds: [],
					resourceCosts: {},
					tags: ['daily-plan', 'habit-resolver', 'scheduled-event', 'zero-model-cost']
				})
			);
		}
	}
	const equipped = hero.equipment.mainHand ? state.items[hero.equipment.mainHand] : null;
	if (hero.location === 'training-ground' && equipped && equipped.durability > 0) {
		actions.push(
			action({
				actionId: 'hero.activity.train',
				actorId,
				kind: 'train',
				label: 'Train for 30 minutes',
				description: 'Gain experience and sword skill at a deterministic injury risk.',
				targetIds: [],
				resourceCosts: {},
				tags: ['activity', 'progression', 'injury-risk']
			})
		);
	}
	if (hero.location === 'kitchen' && state.settlement.resources.food > 0) {
		actions.push(
			action({
				actionId: 'hero.activity.eat',
				actorId,
				kind: 'rest',
				label: 'Eat a meal',
				description: 'Reserve one food and reduce hunger after 15 game minutes.',
				targetIds: [],
				resourceCosts: { food: 1 },
				tags: ['activity', 'need']
			})
		);
	}
	if (hero.needs.fatigue > 0 || hero.health < hero.maxHealth || hero.injuries.length > 0) {
		actions.push(
			action({
				actionId: 'hero.activity.rest',
				actorId,
				kind: 'rest',
				label: 'Rest for one hour',
				description: 'Reduce fatigue, heal, and recover one active injury.',
				targetIds: [],
				resourceCosts: {},
				tags: ['activity', 'recovery']
			})
		);
	}
	if (
		hero.location === 'training-ground' &&
		equipped &&
		equipped.durability < equipped.maxDurability &&
		state.settlement.resources['iron-ore'] > 0
	) {
		actions.push(
			action({
				actionId: 'hero.activity.repair',
				actorId,
				kind: 'work',
				label: `Repair ${equipmentItemDisplayName(equipped)}`,
				description: 'Reserve one iron ore and restore durability after 20 game minutes.',
				targetIds: [equipped.itemId],
				resourceCosts: { 'iron-ore': 1 },
				tags: ['activity', 'equipment']
			})
		);
	}
	for (const item of Object.values(state.items)) {
		if (
			item.ownerId === hero.heroId &&
			item.itemId !== hero.equipment.mainHand &&
			item.durability > 0
		) {
			actions.push(
				action({
					actionId: `hero.equip.${item.itemId}`,
					actorId,
					kind: 'interact',
					label: `Equip ${equipmentItemDisplayName(item)}`,
					description: 'Change the authoritative main-hand equipment slot.',
					targetIds: [item.itemId],
					resourceCosts: {},
					tags: ['inventory', 'equipment']
				})
			);
		}
	}
	if (hasNavigationState(state)) {
		actions.push(
			action({
				actionId: 'hero.travel',
				actorId,
				kind: 'move',
				label: 'Travel through Hearth 01',
				description: 'Choose a reachable authored node and schedule its authoritative arrival.',
				targetIds: [],
				resourceCosts: {},
				tags: ['settlement', 'scheduled-event', 'content-bound']
			})
		);
	}
	return actions;
}

export function settlementLegalActions(
	stateInput: EngineGameState,
	actorId: string
): LegalAction[] {
	const state = parseGameState(stateInput);
	if (state.status !== 'active') return [];
	if (actorId === state.master.masterId) {
		if (state.master.lifeState !== 'alive') return [];
		if (!isModernState(state)) {
			return [
				action({
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
		return masterSettlementActions(state, actorId, [
			action({
				actionId: 'master.inspect.gate',
				actorId,
				kind: 'interact',
				label: 'Inspect the gate resonance',
				description: 'Draw one named deterministic resonance value without advancing time.',
				targetIds: [],
				resourceCosts: {},
				tags: ['deterministic', 'development-proof']
			})
		]);
	}
	return isModernState(state)
		? heroSettlementActions(state, actorId)
		: routeActions(state, actorId);
}

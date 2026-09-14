import { type EngineGameState, type LegalAction } from '@summonlab/contracts';

import { settlementForState } from '../core/content-bindings.js';
import { parseGameState } from '../core/state.js';
import type { EngineGameStateModern } from '../core/types.js';
import { hasNavigationState, isModernState } from '../core/versions.js';
import {
	action,
	settlementLegalActions,
	settlementTravelActions
} from '../domains/settlement/actions.js';
import { destinationNodeId } from '../domains/settlement/navigation.js';
import { heroCanHearCommunication } from '../domains/settlement/society.js';
import { missionLegalActions, supportsMissionActions } from '../domains/mission/actions.js';
import { missionPartyIsReserved } from '../domains/mission/lifecycle.js';
import { selectMasterFallback } from '../domains/mission/master-control.js';

function masterActionsV2(state: EngineGameStateModern): LegalAction[] {
	const actorId = state.master.masterId;
	const controlActions: LegalAction[] =
		state.schemaVersion === 19 || state.schemaVersion === 20
			? [
					action({
						actionId: 'master.control.configure',
						actorId,
						kind: 'interact',
						label: 'Change Master decision timing',
						description:
							'Persist Wait, Countdown, Step, or Continuous independently from action selection.',
						targetIds: [],
						resourceCosts: {},
						tags: ['master', 'control', 'timing', 'replay']
					}),
					...(state.schemaVersion === 20
						? [
								action({
									actionId: 'master.fallback.configure',
									actorId,
									kind: 'interact',
									label: 'Configure unattended selection',
									description:
										'Persist directed or seeded-random fallback intent and safety stops.',
									targetIds: [],
									resourceCosts: {},
									tags: ['master', 'control', 'fallback', 'safety', 'replay']
								}),
								...(state.masterControl.activeDecision !== null &&
								state.masterControl.activeDecision.timing !== 'wait' &&
								selectMasterFallback(state).safetyStopReason
									? [
											action({
												actionId: 'master.safety-stop.apply',
												actorId,
												kind: 'wait',
												label: 'Apply fallback safety stop',
												description:
													'Force Wait at this legal boundary and retain the blocked selection evidence.',
												targetIds: [],
												resourceCosts: {},
												tags: ['master', 'control', 'fallback', 'safety-stop', 'replay']
											})
										]
									: [])
							]
						: []),
					...(state.masterControl.activeDecision === null &&
					state.mission.attempt !== null &&
					['deployed', 'resolving'].includes(state.mission.attempt.status)
						? [
								action({
									actionId: 'master.decision.open',
									actorId,
									kind: 'interact',
									label: 'Open the next Master decision',
									description:
										'Bind one authoritative decision window to the current mission state.',
									targetIds: [],
									resourceCosts: {},
									tags: ['master', 'control', 'decision-window', 'replay']
								})
							]
						: [])
				]
			: [];
	const missionActions = missionLegalActions(state, actorId);
	if (
		supportsMissionActions(state) &&
		state.mission.attempt &&
		['preparing', 'deployed', 'resolving', 'extraction'].includes(state.mission.attempt.status)
	) {
		return [...controlActions, ...missionActions];
	}
	const [inspectGate, ...settlementTail] = settlementLegalActions(state, actorId);
	const actions: LegalAction[] = [...controlActions, ...(inspectGate ? [inspectGate] : [])];
	if (state.schemaVersion === 22 || state.schemaVersion === 23 || state.schemaVersion === 27) {
		const eligible = Object.values(state.heroes).filter(
			(hero) =>
				hero.lifeState === 'active' &&
				hero.location === 'summoning-gate' &&
				!hero.currentActivity &&
				!hero.currentTravel &&
				!hero.currentRoutine &&
				!hero.assignment
		);
		if (eligible.length >= 2 && !state.mission.attempt) {
			actions.push(
				action({
					actionId: 'settlement.synthesis.commit',
					actorId,
					kind: 'interact',
					label: 'Confirm a synthesis pair',
					description:
						'Permanently consume one ready summon, grant bounded essence to another, and record witness-bounded fallout.',
					targetIds: eligible.map((hero) => hero.heroId),
					resourceCosts: {},
					tags: ['settlement', 'synthesis', 'irreversible', 'social', 'replay']
				})
			);
		}
	}
	if (state.schemaVersion === 23 && state.firstBandArchive.status === 'recovered') {
		actions.push(
			action({
				actionId: 'story.first.archive.reveal',
				actorId,
				kind: 'interact',
				label: 'Open the recovered archive fragment',
				description:
					'Choose one surviving reader; their personality shapes the delivery while the authored fact remains fixed.',
				targetIds: state.firstBandArchive.recovery?.survivingHeroIds ?? [],
				resourceCosts: {},
				tags: ['story', 'archive', 'knowledge', 'replay']
			})
		);
	}
	if (state.schemaVersion === 21 && state.bandStory.appliedPatches.length === 0) {
		actions.push(
			action({
				actionId: 'story.patch.apply',
				actorId,
				kind: 'interact',
				label: 'Commit an engine-validated story patch',
				description:
					'Activate one catalogued optional beat at the open Floor 04 checkpoint without changing fixed story authority.',
				targetIds: [],
				resourceCosts: {},
				tags: ['story', 'patch', 'catalog-bound', 'replay']
			})
		);
	}
	actions.push(...missionActions);
	actions.push(...settlementTail);
	return actions;
}

function heroActionsV2(state: EngineGameStateModern, actorId: string): LegalAction[] {
	if (state.schemaVersion === 22 || state.schemaVersion === 27) {
		const speaker = state.heroes[actorId];
		if (speaker?.lifeState === 'active' && heroCanHearCommunication(speaker)) {
			const rumorActions = Object.values(state.synthesis.receipts).flatMap((receipt) => {
				const directlyKnows = receipt.socialConsequences.some(
					(consequence) => consequence.heroId === actorId && consequence.knowledge !== 'absence'
				);
				const learnedRumor = Object.values(state.synthesis.rumors).some(
					(rumor) => rumor.receiptId === receipt.receiptId && rumor.listenerHeroId === actorId
				);
				if (!directlyKnows && !learnedRumor) return [];
				return Object.values(state.heroes)
					.filter((target) => {
						if (
							target.heroId === actorId ||
							target.lifeState !== 'active' ||
							target.location !== speaker.location ||
							target.locationNodeId !== speaker.locationNodeId ||
							!heroCanHearCommunication(target)
						)
							return false;
						return !Object.values(state.society.observations).some(
							(observation) =>
								'synthesisReceiptId' in observation &&
								observation.synthesisReceiptId === receipt.receiptId &&
								observation.observerHeroId === target.heroId &&
								observation.kind !== 'synthesis-absence'
						);
					})
					.sort((left, right) => left.heroId.localeCompare(right.heroId))
					.map((target) =>
						action({
							actionId: `synthesis.rumor.share.${receipt.receiptId.slice(-8)}.${target.heroId.slice(-8)}`,
							actorId,
							kind: 'interact',
							label: `Tell ${target.heroId.slice(0, 8)} what happened`,
							description:
								'Share a sourced synthesis claim; confidence falls as the explicit rumor chain grows.',
							targetIds: [target.heroId],
							resourceCosts: {},
							tags: ['social', 'synthesis', 'rumor', 'provenance']
						})
					);
			});
			if (rumorActions.length > 0) return rumorActions;
		}
	}
	const missionActions = missionLegalActions(state, actorId);
	if (
		missionActions.length > 0 ||
		(supportsMissionActions(state) && missionPartyIsReserved(state, actorId))
	) {
		return [...missionActions];
	}
	return settlementLegalActions(state, actorId);
}

export function legalActionsForParsedState(
	state: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	if (state.status !== 'active') return [];
	if (actorId === state.master.masterId && state.master.lifeState === 'alive') {
		if (isModernState(state)) return masterActionsV2(state);
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
	return isModernState(state)
		? heroActionsV2(state, actorId)
		: settlementLegalActions(state, actorId);
}

export function legalActions(stateInput: EngineGameState, actorId: string): readonly LegalAction[] {
	return legalActionsForParsedState(parseGameState(stateInput), actorId);
}

export function decisionLegalActions(
	stateInput: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	const state = parseGameState(stateInput);
	const actions = legalActionsForParsedState(state, actorId);
	if (
		!actions.some((candidate) => candidate.actionId === 'hero.travel') ||
		!hasNavigationState(state)
	) {
		return actions;
	}
	const hero = state.heroes[actorId];
	const targets =
		hero && !hero.firstArrivalCompleted && hero.destination
			? [destinationNodeId(settlementForState(state), hero.destination)]
			: undefined;
	const expandedTravel = settlementTravelActions(state, actorId, targets);
	return actions.flatMap((candidate) =>
		candidate.actionId === 'hero.travel' ? expandedTravel : [candidate]
	);
}

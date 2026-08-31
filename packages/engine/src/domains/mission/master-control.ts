import {
	EngineGameStateV20Schema,
	EngineGameStateV21Schema,
	MasterControlStateSchema,
	MasterControlStateV2Schema,
	MasterDecisionResolutionSchema,
	MasterDecisionResolutionV2Schema,
	MasterFallbackConfigurationSchema,
	MasterFallbackSelectionSchema,
	MissionTurnChoiceSchema,
	type ActionSource,
	type EngineCommand,
	type EngineGameStateV20,
	type EngineGameStateV21,
	type LegalAction,
	type MasterControlState,
	type MasterControlStateV2,
	type MasterDecisionResolution,
	type MasterDecisionResolutionV2,
	type MasterFallbackConfiguration,
	type MasterFallbackSelection,
	type MissionTurnChoice
} from '@summonlab/contracts';

import { IllegalActionError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { addGameSeconds } from '../../time.js';
import { missionContentForState } from '../../core/content-bindings.js';
import { missionTurnLegalActions } from './actions.js';
import { allPartyAtNode } from './lifecycle.js';

export function masterDecisionWindow(
	control: MasterControlState,
	commandId: string,
	openedAt: string
): MasterControlState {
	if (control.activeDecision) throw new IllegalActionError('master.decision.open');
	const ordinal = control.decisionOrdinal + 1;
	return MasterControlStateSchema.parse({
		...control,
		decisionOrdinal: ordinal,
		activeDecision: {
			decisionId: deterministicUuid(`${commandId}:master-decision:${ordinal}`),
			ordinal,
			timing: control.timing,
			openedAt,
			expiresAt:
				control.timing === 'countdown' ? addGameSeconds(openedAt, control.countdownSeconds) : null
		}
	});
}

export function pausedMasterDecision(
	control: MasterControlState,
	resolvedAt: string,
	source: ActionSource
): MasterDecisionResolution | null {
	const active = control.activeDecision;
	if (!active) return null;
	return MasterDecisionResolutionSchema.parse({
		...active,
		resolvedAt,
		outcome: 'paused',
		expiryOutcome: 'paused',
		resolvedActionId: null,
		source: { ...source, timing: active.timing }
	});
}

export function configureMasterTiming(
	control: MasterControlState,
	commandId: string,
	timing: MasterControlState['timing'],
	countdownSeconds: number,
	observedAt: string,
	source: ActionSource
): { readonly control: MasterControlState; readonly paused: MasterDecisionResolution | null } {
	const paused = pausedMasterDecision(control, observedAt, source);
	const configured = MasterControlStateSchema.parse({
		...control,
		timing,
		countdownSeconds,
		revision: control.revision + 1,
		activeDecision: null,
		lastResolution: paused ?? control.lastResolution
	});
	return {
		paused,
		control: paused ? masterDecisionWindow(configured, commandId, observedAt) : configured
	};
}

export function resolveMasterDecision(
	control: MasterControlState,
	commandId: string,
	decisionId: string,
	resolvedAt: string,
	actionId: string,
	source: ActionSource,
	missionContinues: boolean
): { readonly control: MasterControlState; readonly resolution: MasterDecisionResolution } {
	const active = control.activeDecision;
	if (!active || active.decisionId !== decisionId || source.timing !== active.timing) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const resolvedMillis = Date.parse(resolvedAt);
	const openedMillis = Date.parse(active.openedAt);
	const expiresMillis = active.expiresAt ? Date.parse(active.expiresAt) : null;
	if (resolvedMillis < openedMillis) throw new IllegalActionError('mission.resolve.turn');
	const manual = source.source === 'manual';
	const fallback =
		active.timing !== 'wait' &&
		(source.source === 'countdown' || source.source === 'step' || source.source === 'continuous') &&
		source.source === active.timing;
	if (!manual && !fallback) throw new IllegalActionError('mission.resolve.turn');
	if (manual && active.timing !== 'wait' && active.timing !== 'countdown') {
		throw new IllegalActionError('mission.resolve.turn');
	}
	if (active.timing === 'countdown') {
		if (expiresMillis === null) throw new IllegalActionError('mission.resolve.turn');
		if (
			(manual && resolvedMillis >= expiresMillis) ||
			(fallback && resolvedMillis < expiresMillis)
		) {
			throw new IllegalActionError('mission.resolve.turn');
		}
	}
	const outcome = manual ? 'manual' : 'fallback';
	const expiryOutcome =
		active.timing === 'countdown'
			? manual
				? 'manual-before-expiry'
				: 'expired-to-fallback'
			: fallback
				? 'immediate-fallback'
				: 'not-applicable';
	const resolution = MasterDecisionResolutionSchema.parse({
		...active,
		resolvedAt,
		outcome,
		expiryOutcome,
		resolvedActionId: actionId,
		source
	});
	let next = MasterControlStateSchema.parse({
		...control,
		timing: active.timing === 'step' ? 'wait' : control.timing,
		revision: control.revision + (active.timing === 'step' ? 1 : 0),
		activeDecision: null,
		lastResolution: resolution
	});
	if (missionContinues) next = masterDecisionWindow(next, commandId, resolvedAt);
	return { control: next, resolution };
}

export function endMasterDecision(
	control: MasterControlState,
	source: ActionSource
): { readonly control: MasterControlState; readonly resolution: MasterDecisionResolution | null } {
	const active = control.activeDecision;
	if (!active) return { control, resolution: null };
	const resolution = MasterDecisionResolutionSchema.parse({
		...active,
		resolvedAt: active.openedAt,
		outcome: 'mission-ended',
		expiryOutcome: 'mission-ended',
		resolvedActionId: null,
		source: { ...source, source: 'system', timing: null, fallbackPolicy: null }
	});
	return {
		resolution,
		control: MasterControlStateSchema.parse({
			...control,
			activeDecision: null,
			lastResolution: resolution
		})
	};
}

export function masterDecisionWindowV2(
	control: MasterControlStateV2,
	commandId: string,
	openedAt: string
): MasterControlStateV2 {
	if (control.activeDecision) throw new IllegalActionError('master.decision.open');
	const ordinal = control.decisionOrdinal + 1;
	return MasterControlStateV2Schema.parse({
		...control,
		decisionOrdinal: ordinal,
		activeDecision: {
			decisionId: deterministicUuid(`${commandId}:master-decision:${ordinal}`),
			ordinal,
			timing: control.timing,
			openedAt,
			expiresAt:
				control.timing === 'countdown' ? addGameSeconds(openedAt, control.countdownSeconds) : null,
			fallback: control.fallback
		}
	});
}

export function pausedMasterDecisionV2(
	control: MasterControlStateV2,
	resolvedAt: string,
	source: ActionSource
): MasterDecisionResolutionV2 | null {
	const active = control.activeDecision;
	if (!active) return null;
	return MasterDecisionResolutionV2Schema.parse({
		...active,
		resolvedAt,
		outcome: 'paused',
		expiryOutcome: 'paused',
		resolvedActionId: null,
		source: { ...source, timing: active.timing },
		fallbackSelection: null
	});
}

export function configureMasterTimingV2(
	control: MasterControlStateV2,
	commandId: string,
	timing: MasterControlStateV2['timing'],
	countdownSeconds: number,
	observedAt: string,
	source: ActionSource
): { readonly control: MasterControlStateV2; readonly paused: MasterDecisionResolutionV2 | null } {
	const paused = pausedMasterDecisionV2(control, observedAt, source);
	const configured = MasterControlStateV2Schema.parse({
		...control,
		timing,
		countdownSeconds,
		revision: control.revision + 1,
		activeDecision: null,
		lastResolution: paused ?? control.lastResolution,
		consecutiveFallbacks: timing === 'wait' ? 0 : control.consecutiveFallbacks
	});
	return {
		paused,
		control: paused ? masterDecisionWindowV2(configured, commandId, observedAt) : configured
	};
}

type MasterFallbackConfigurationInput = Pick<
	Extract<EngineCommand, { commandType: 'master.configure.fallback' }>,
	| 'commandId'
	| 'observedAt'
	| 'source'
	| 'policy'
	| 'directionText'
	| 'priorities'
	| 'protectedHeroId'
	| 'safetyStops'
>;

export function configureMasterFallback(
	control: MasterControlStateV2,
	command: MasterFallbackConfigurationInput
): { readonly control: MasterControlStateV2; readonly paused: MasterDecisionResolutionV2 | null } {
	const paused = pausedMasterDecisionV2(control, command.observedAt, command.source);
	const fallback = MasterFallbackConfigurationSchema.parse({
		configurationVersion: 'master-fallback-v1',
		policy: command.policy,
		directionId: deterministicUuid(`${command.commandId}:master-fallback-direction`),
		directionText: command.directionText,
		priorities: command.priorities,
		protectedHeroId: command.protectedHeroId,
		safetyStops: command.safetyStops,
		configuredAt: command.observedAt
	});
	const configured = MasterControlStateV2Schema.parse({
		...control,
		fallback,
		revision: control.revision + 1,
		activeDecision: null,
		lastResolution: paused ?? control.lastResolution,
		consecutiveFallbacks: 0
	});
	return {
		paused,
		control: paused
			? masterDecisionWindowV2(configured, command.commandId, command.observedAt)
			: configured
	};
}

type MasterFallbackEngineState = EngineGameStateV20 | EngineGameStateV21;

export function parseMasterFallbackState(
	state: MasterFallbackEngineState
): MasterFallbackEngineState {
	return state.schemaVersion === 21
		? EngineGameStateV21Schema.parse(state)
		: EngineGameStateV20Schema.parse(state);
}

export function masterFallbackPacket(
	state: MasterFallbackEngineState,
	legal: readonly LegalAction[]
) {
	const active = state.masterControl.activeDecision!;
	const attempt = state.mission.attempt!;
	return {
		runId: state.runId,
		stateVersion: state.version,
		missionId: state.mission.binding.missionId,
		attemptId: attempt.attemptId,
		roundNumber: attempt.turnState.roundNumber,
		decision: active,
		master: {
			health: state.master.health,
			maxHealth: state.master.maxHealth,
			location: state.master.location
		},
		legalActionIds: legal.map((candidate) => candidate.actionId),
		threatIntentHashes: attempt.turnState.currentThreatIntents.map((intent) =>
			hashCanonical(intent)
		)
	};
}

export function directionRecognized(direction: MasterFallbackConfiguration): boolean {
	return (
		direction.priorities.length > 0 ||
		/\b(hold|defend|guard|attack|fight|inspect|search|secret|recover|ember|objective|move|advance|protect|conserve)\b/iu.test(
			direction.directionText
		)
	);
}

export function scoreDirectedAction(
	action: LegalAction,
	direction: MasterFallbackConfiguration
): number {
	let score = 0;
	const id = action.actionId;
	const tags = new Set(action.tags);
	for (const [index, priority] of direction.priorities.entries()) {
		const weight = 100 - index * 10;
		if (priority === 'protect-self') {
			if (action.kind === 'defend' || id === 'mission.hold') score += weight;
			else if (action.kind === 'move') score += Math.round(weight * 0.3);
			else if (action.kind === 'attack') score += Math.round(weight * 0.15);
		}
		if (priority === 'protect-party') {
			if (action.kind === 'defend' || tags.has('protect')) score += Math.round(weight * 0.8);
			else if (action.kind === 'attack') score += Math.round(weight * 0.7);
			else if (action.kind === 'move') score += Math.round(weight * 0.25);
		}
		if (priority === 'focus-objective') {
			if (id.startsWith('mission.recover.')) score += Math.round(weight * 1.2);
			else if (action.kind === 'interact') score += Math.round(weight * 0.75);
			else if (action.kind === 'move') score += Math.round(weight * 0.4);
			else if (action.kind === 'attack') score += Math.round(weight * 0.25);
		}
		if (priority === 'seek-secrets') {
			if (id.startsWith('mission.inspect.')) score += Math.round(weight * 1.2);
			else if (tags.has('discovery') || tags.has('secret')) score += weight;
			else if (action.kind === 'interact') score += Math.round(weight * 0.6);
			else if (action.kind === 'move') score += Math.round(weight * 0.3);
		}
		if (priority === 'conserve-resources') {
			if (Object.keys(action.resourceCosts).length === 0) score += Math.round(weight * 0.55);
			if (action.kind === 'defend') score += Math.round(weight * 0.25);
			if (action.kind === 'attack') score -= Math.round(weight * 0.1);
		}
	}
	const text = direction.directionText.toLowerCase();
	if (/\b(hold|defend|guard)\b/u.test(text) && action.kind === 'defend') score += 60;
	if (/\b(attack|fight)\b/u.test(text) && action.kind === 'attack') score += 60;
	if (/\b(inspect|search|secret)\b/u.test(text) && id.startsWith('mission.inspect.')) score += 60;
	if (/\b(recover|ember|objective)\b/u.test(text) && id.startsWith('mission.recover.')) score += 60;
	if (/\b(move|advance)\b/u.test(text) && action.kind === 'move') score += 40;
	if (/\bprotect\b/u.test(text) && (action.kind === 'defend' || tags.has('protect'))) score += 40;
	if (direction.protectedHeroId && (action.kind === 'defend' || tags.has('protect'))) score += 35;
	return score;
}

export function isIrreversibleMasterAction(action: LegalAction): boolean {
	return (
		action.tags.some(
			(tag) => tag.startsWith('irreversible') || ['permanent', 'consume-hero'].includes(tag)
		) ||
		action.actionId.startsWith('mission.synthesize.') ||
		action.actionId.startsWith('mission.evolve.')
	);
}

export function selectMasterFallback(
	stateInput: MasterFallbackEngineState
): MasterFallbackSelection {
	const state = parseMasterFallbackState(stateInput);
	const active = state.masterControl.activeDecision;
	if (!active || active.timing === 'wait') throw new IllegalActionError('mission.resolve.turn');
	const legal = [...missionTurnLegalActions(state, state.master.masterId)].sort((left, right) =>
		left.actionId.localeCompare(right.actionId)
	);
	if (legal.length === 0) throw new IllegalActionError('mission.resolve.turn');
	const packetHash = hashCanonical(masterFallbackPacket(state, legal));
	const legalActionHash = hashCanonical(legal);
	const tieBreakHash = hashCanonical({
		seed: state.seed,
		decisionId: active.decisionId,
		policy: active.fallback.policy,
		legalActionHash
	});
	const classified = active.fallback.policy === 'random' || directionRecognized(active.fallback);
	let selected: LegalAction;
	let selectedScore: number;
	if (active.fallback.policy === 'random') {
		const index = Number.parseInt(tieBreakHash.slice(0, 8), 16) % legal.length;
		selected = legal[index]!;
		selectedScore = 0;
	} else {
		const ranked = legal
			.map((candidate) => ({
				candidate,
				score: scoreDirectedAction(candidate, active.fallback),
				tie: hashCanonical({
					seed: state.seed,
					decisionId: active.decisionId,
					actionId: candidate.actionId
				})
			}))
			.sort((left, right) => right.score - left.score || left.tie.localeCompare(right.tie));
		selected = ranked[0]!.candidate;
		selectedScore = ranked[0]!.score;
	}
	const stops = active.fallback.safetyStops;
	const retreatAvailable =
		state.mission.attempt !== null &&
		['deployed', 'resolving', 'extraction'].includes(state.mission.attempt.status) &&
		allPartyAtNode(state, missionContentForState(state).retreat.nodeIds);
	const safetyStopReason =
		stops.maximumConsecutiveFallbacks !== null &&
		state.masterControl.consecutiveFallbacks >= stops.maximumConsecutiveFallbacks
			? 'fallback-limit'
			: stops.masterHealthThreshold !== null &&
				  state.master.health <= stops.masterHealthThreshold &&
				  retreatAvailable
				? 'master-health'
				: stops.whenUnclassified && !classified
					? 'unclassified-state'
					: stops.beforeIrreversibleAction && isIrreversibleMasterAction(selected)
						? 'irreversible-action'
						: null;
	const policyId =
		active.fallback.policy === 'directed' ? 'master-directed-v1' : 'master-random-v1';
	const explanation = safetyStopReason
		? `Safety changed ${active.timing} to Wait before ${selected.label.toLowerCase()} (${safetyStopReason}).`
		: active.fallback.policy === 'random'
			? `Seeded random selected ${selected.label.toLowerCase()} from ${legal.length} legal actions.`
			: classified
				? `Directed scoring selected ${selected.label.toLowerCase()} at ${selectedScore} points.`
				: `No direction term matched; the disabled classification stop allowed the seeded tie-breaker.`;
	const resultCore = {
		selectionVersion: 'master-fallback-selection-v1' as const,
		policyId,
		policy: active.fallback.policy,
		decisionId: active.decisionId,
		directionId: active.fallback.directionId,
		classification: classified ? ('classified' as const) : ('unclassified' as const),
		selectedActionId: selected.actionId,
		selectedScore,
		consideredActionIds: legal.map((candidate) => candidate.actionId),
		packetHash,
		legalActionHash,
		tieBreakHash,
		safetyStopReason,
		explanation
	};
	return MasterFallbackSelectionSchema.parse({
		...resultCore,
		policyResultHash: hashCanonical(resultCore)
	});
}

export function masterFallbackActionSource(stateInput: MasterFallbackEngineState): ActionSource {
	const state = parseMasterFallbackState(stateInput);
	const active = state.masterControl.activeDecision;
	if (!active || active.timing === 'wait') throw new IllegalActionError('mission.resolve.turn');
	return {
		source: active.timing,
		timing: active.timing,
		fallbackPolicy: active.fallback.policy,
		directiveIds: active.fallback.policy === 'directed' ? [active.fallback.directionId] : [],
		decisionJobId: null
	};
}

export function masterFallbackSafetySource(stateInput: MasterFallbackEngineState): ActionSource {
	return { ...masterFallbackActionSource(stateInput), source: 'system' };
}

export function masterFallbackMissionChoice(
	stateInput: MasterFallbackEngineState
): MissionTurnChoice {
	const state = parseMasterFallbackState(stateInput);
	const selection = selectMasterFallback(state);
	if (selection.safetyStopReason) throw new IllegalActionError('master.apply.safety-stop');
	return MissionTurnChoiceSchema.parse({
		actorId: state.master.masterId,
		actionId: selection.selectedActionId,
		source: selection.policy === 'random' ? 'random' : 'scripted',
		policyId: selection.policyId,
		packetHash: selection.packetHash,
		legalActionHash: selection.legalActionHash,
		policyResultHash: selection.policyResultHash,
		publicIntent: selection.explanation
	});
}

export function resolveMasterDecisionV2(
	state: MasterFallbackEngineState,
	commandId: string,
	decisionId: string,
	resolvedAt: string,
	actionId: string,
	source: ActionSource,
	missionContinues: boolean
): { readonly control: MasterControlStateV2; readonly resolution: MasterDecisionResolutionV2 } {
	const control = state.masterControl;
	const active = control.activeDecision;
	if (!active || active.decisionId !== decisionId || source.timing !== active.timing) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const resolvedMillis = Date.parse(resolvedAt);
	const openedMillis = Date.parse(active.openedAt);
	const expiresMillis = active.expiresAt ? Date.parse(active.expiresAt) : null;
	if (resolvedMillis < openedMillis) throw new IllegalActionError('mission.resolve.turn');
	const manual = source.source === 'manual';
	const fallback =
		active.timing !== 'wait' &&
		(source.source === 'countdown' || source.source === 'step' || source.source === 'continuous') &&
		source.source === active.timing;
	if (!manual && !fallback) throw new IllegalActionError('mission.resolve.turn');
	if (manual && active.timing !== 'wait' && active.timing !== 'countdown') {
		throw new IllegalActionError('mission.resolve.turn');
	}
	if (active.timing === 'countdown') {
		if (
			expiresMillis === null ||
			(manual && resolvedMillis >= expiresMillis) ||
			(fallback && resolvedMillis < expiresMillis)
		) {
			throw new IllegalActionError('mission.resolve.turn');
		}
	}
	const selection = fallback ? selectMasterFallback(state) : null;
	if (selection?.safetyStopReason || (selection && selection.selectedActionId !== actionId)) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const outcome = manual ? 'manual' : 'fallback';
	const expiryOutcome =
		active.timing === 'countdown'
			? manual
				? 'manual-before-expiry'
				: 'expired-to-fallback'
			: fallback
				? 'immediate-fallback'
				: 'not-applicable';
	const resolution = MasterDecisionResolutionV2Schema.parse({
		...active,
		resolvedAt,
		outcome,
		expiryOutcome,
		resolvedActionId: actionId,
		source,
		fallbackSelection: selection
	});
	let next = MasterControlStateV2Schema.parse({
		...control,
		timing: active.timing === 'step' ? 'wait' : control.timing,
		revision: control.revision + (active.timing === 'step' ? 1 : 0),
		activeDecision: null,
		lastResolution: resolution,
		consecutiveFallbacks: fallback ? control.consecutiveFallbacks + 1 : 0
	});
	if (missionContinues) next = masterDecisionWindowV2(next, commandId, resolvedAt);
	return { control: next, resolution };
}

export function assertFallbackReady(control: MasterControlStateV2, observedAt: string): void {
	const active = control.activeDecision;
	if (!active || active.timing === 'wait' || Date.parse(observedAt) < Date.parse(active.openedAt)) {
		throw new IllegalActionError('master.apply.safety-stop');
	}
	if (
		active.timing === 'countdown' &&
		(active.expiresAt === null || Date.parse(observedAt) < Date.parse(active.expiresAt))
	) {
		throw new IllegalActionError('master.apply.safety-stop');
	}
}

export function applyMasterSafetyStop(
	state: MasterFallbackEngineState,
	commandId: string,
	decisionId: string,
	observedAt: string,
	source: ActionSource
): { readonly control: MasterControlStateV2; readonly resolution: MasterDecisionResolutionV2 } {
	assertFallbackReady(state.masterControl, observedAt);
	const active = state.masterControl.activeDecision!;
	if (
		active.decisionId !== decisionId ||
		hashCanonical(source) !== hashCanonical(masterFallbackSafetySource(state))
	) {
		throw new IllegalActionError('master.apply.safety-stop');
	}
	const selection = selectMasterFallback(state);
	if (!selection.safetyStopReason) throw new IllegalActionError('master.apply.safety-stop');
	const resolution = MasterDecisionResolutionV2Schema.parse({
		...active,
		resolvedAt: observedAt,
		outcome: 'safety-stopped',
		expiryOutcome: 'safety-stopped',
		resolvedActionId: null,
		source,
		fallbackSelection: selection
	});
	const waiting = MasterControlStateV2Schema.parse({
		...state.masterControl,
		timing: 'wait',
		revision: state.masterControl.revision + 1,
		activeDecision: null,
		lastResolution: resolution,
		consecutiveFallbacks: 0
	});
	return {
		resolution,
		control: masterDecisionWindowV2(waiting, commandId, observedAt)
	};
}

export function endMasterDecisionV2(
	control: MasterControlStateV2,
	source: ActionSource
): {
	readonly control: MasterControlStateV2;
	readonly resolution: MasterDecisionResolutionV2 | null;
} {
	const active = control.activeDecision;
	if (!active) return { control, resolution: null };
	const resolution = MasterDecisionResolutionV2Schema.parse({
		...active,
		resolvedAt: active.openedAt,
		outcome: 'mission-ended',
		expiryOutcome: 'mission-ended',
		resolvedActionId: null,
		source: { ...source, source: 'system', timing: null, fallbackPolicy: null },
		fallbackSelection: null
	});
	return {
		resolution,
		control: MasterControlStateV2Schema.parse({
			...control,
			activeDecision: null,
			lastResolution: resolution,
			consecutiveFallbacks: 0
		})
	};
}

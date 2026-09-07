import {
	CombatChoiceBatchV1Schema,
	CombatResolvedEventSchema,
	CombatRulesV1Schema,
	ReadinessCombatStateV1Schema,
	type CombatActionIntent,
	type CombatChoiceBatchV1,
	type CombatFallbackOptionSchema,
	type CombatLegalAction,
	type CombatResolvedEvent,
	type CombatRulesV1,
	type CombatTargetSelectionSchema,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import type { z } from 'zod';

import { deterministicUuid, hashCanonical } from '../../hash.js';
import { resolveEntityRelativePosition } from './geometry.js';
import { purposeKeyedInteger } from './randomness.js';
import { advanceUntilReadyCohort } from './readiness.js';
import {
	resolveBoundCombatAction,
	resolveCombatAction,
	type BoundCombatActionAuthority
} from './resolver.js';
import { advanceUntilDecision } from './window.js';

type Target = z.infer<typeof CombatTargetSelectionSchema>;
type Fallback = z.infer<typeof CombatFallbackOptionSchema>;
type ResolvedEffect = CombatResolvedEvent['effects'][number];

export type CombatChoiceBatchResolution = Readonly<{
	state: ReadinessCombatStateV1;
	events: readonly CombatResolvedEvent[];
}>;

type PreflightChoice = Readonly<{
	intent: CombatActionIntent;
	authority: BoundCombatActionAuthority;
	exactReadiness: number;
	tie: number;
}>;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

function immutableRules(rulesInput: CombatRulesV1): CombatRulesV1 {
	const rules = CombatRulesV1Schema.parse(rulesInput);
	if (hashCanonical(rules) !== hashCanonical(COMBAT_RULES_V1)) {
		throw new Error('Combat arbitration requires the immutable combat rules');
	}
	return COMBAT_RULES_V1;
}

function unsignedBatch(batch: CombatChoiceBatchV1): Omit<CombatChoiceBatchV1, 'batchHash'> {
	const unsigned: Partial<CombatChoiceBatchV1> = { ...batch };
	delete unsigned.batchHash;
	return unsigned as Omit<CombatChoiceBatchV1, 'batchHash'>;
}

export function combatChoiceBatchHash(batch: Omit<CombatChoiceBatchV1, 'batchHash'>): string {
	return hashCanonical({
		...batch,
		choices: [...batch.choices].sort((left, right) => left.actorId.localeCompare(right.actorId))
	});
}

function selectedTargetIsLegal(intent: CombatActionIntent, action: CombatLegalAction): boolean {
	const selected = intent.target;
	const contract = action.targetContract;
	if (contract.kind !== selected.kind) return false;
	if (contract.kind === 'self') return true;
	if (contract.kind === 'entity' && selected.kind === 'entity') {
		return contract.allowedCombatantIds.includes(selected.combatantId);
	}
	if (contract.kind === 'tile' && selected.kind === 'tile') {
		return contract.allowedPositions.some(
			(position) => position.x === selected.position.x && position.y === selected.position.y
		);
	}
	return (
		contract.kind === 'entity-relative-position' &&
		selected.kind === 'entity-relative-position' &&
		contract.allowedCombatantIds.includes(selected.combatantId) &&
		contract.allowedRelations.includes(selected.relation)
	);
}

function preflight(
	state: ReadinessCombatStateV1,
	batchInput: CombatChoiceBatchV1,
	rules: CombatRulesV1
): Readonly<{ stateAtWindow: ReadinessCombatStateV1; choices: readonly PreflightChoice[] }> {
	const batch = CombatChoiceBatchV1Schema.parse(batchInput);
	if (combatChoiceBatchHash(unsignedBatch(batch)) !== batch.batchHash) {
		throw new Error('Combat choice batch hash does not match its canonical payload');
	}
	const readinessAdvance = advanceUntilReadyCohort(state, rules);
	if (readinessAdvance.kind !== 'decision-window') {
		throw new Error('Combat choice batch requires an active decision window');
	}
	const stateAtWindow = readinessAdvance.state;
	const advance = advanceUntilDecision(stateAtWindow, rules);
	if (advance.kind !== 'decision-window') {
		throw new Error('Combat choice batch requires an active decision window');
	}
	if (
		batch.windowId !== advance.snapshot.windowId ||
		batch.attemptId !== advance.snapshot.attemptId ||
		batch.tick !== advance.snapshot.tick ||
		batch.snapshotHash !== advance.snapshot.snapshotHash
	) {
		throw new Error('Combat choice batch does not bind to the canonical frozen window');
	}
	const readyActorIds = [...advance.snapshot.readyActorIds].sort();
	const choiceActorIds = batch.choices.map((choice) => choice.actorId).sort();
	if (
		readyActorIds.length !== choiceActorIds.length ||
		readyActorIds.some((actorId, index) => actorId !== choiceActorIds[index])
	) {
		throw new Error('Combat choice batch must contain exactly one choice for every ready actor');
	}

	const choices = batch.choices.map((intent) => {
		const view = advance.views.find((candidate) => candidate.actorId === intent.actorId);
		const legalAction = view?.legalActions.find((action) => action.actionId === intent.actionId);
		const template = stateAtWindow.actorContexts[intent.actorId]?.legalActionTemplates.find(
			(action) => action.actionId === intent.actionId
		);
		if (!view || !legalAction || !template || !selectedTargetIsLegal(intent, legalAction)) {
			throw new Error('Combat batch member is not a supplied frozen-window legal action');
		}
		if (
			intent.fallbackId !== null &&
			!legalAction.fallbackOptions.some((fallback) => fallback.fallbackId === intent.fallbackId)
		) {
			throw new Error('Combat fallback identity is not bound to the selected legal action');
		}
		// Reuse the public boundary once for every member before any progressive state exists.
		// This validates all hashes, action identity, private profile, catalog and affordability.
		resolveCombatAction({ state: stateAtWindow, intent, rules });
		const actor = stateAtWindow.combatants[intent.actorId]!;
		return {
			intent,
			authority: { view, legalAction, template },
			exactReadiness: actor.readiness.exactNumerator,
			tie: purposeKeyedInteger({
				seed: stateAtWindow.seed,
				attemptId: stateAtWindow.attemptId,
				tick: stateAtWindow.tick,
				actorId: intent.actorId,
				actionInstanceId: intent.actionInstanceId,
				purpose: 'readiness-tie',
				localSequence: 0,
				minimum: 0,
				maximum: Number.MAX_SAFE_INTEGER
			}).value
		};
	});
	return { stateAtWindow, choices };
}

function positionKey(position: Readonly<{ x: number; y: number }>): string {
	return `${position.x}:${position.y}`;
}

type ProgressiveValidation =
	| Readonly<{
			valid: true;
			reason: null;
			resolvedPosition: Readonly<{ x: number; y: number }> | null;
			cause: null;
	  }>
	| Readonly<{
			valid: false;
			reason: 'invalid-target' | 'occupied-destination';
			resolvedPosition: Readonly<{ x: number; y: number }> | null;
			cause:
				| Readonly<{ kind: 'actor' | 'target'; combatantId: string }>
				| Readonly<{ kind: 'destination'; position: Readonly<{ x: number; y: number }> }>
				| Readonly<{ kind: 'none' }>;
	  }>;

function fixedTileValidation(
	state: ReadinessCombatStateV1,
	actorId: string,
	position: Readonly<{ x: number; y: number }>
): ProgressiveValidation {
	if (
		position.x < 0 ||
		position.y < 0 ||
		position.x >= state.terrain.width ||
		position.y >= state.terrain.height ||
		state.terrain.blockedTiles.some((blocked) => positionKey(blocked) === positionKey(position))
	) {
		return {
			valid: false,
			reason: 'invalid-target',
			resolvedPosition: position,
			cause: { kind: 'none' }
		};
	}
	const occupied = Object.values(state.combatants).some(
		(combatant) =>
			combatant.combatantId !== actorId && positionKey(combatant.position) === positionKey(position)
	);
	return occupied
		? {
				valid: false,
				reason: 'occupied-destination',
				resolvedPosition: position,
				cause: { kind: 'destination', position }
			}
		: { valid: true, reason: null, resolvedPosition: position, cause: null };
}

function targetIsProgressivelyValid(
	state: ReadinessCombatStateV1,
	intent: CombatActionIntent,
	target: Target
): ProgressiveValidation {
	const actor = state.combatants[intent.actorId];
	if (!actor || !actor.active || actor.downed) {
		return {
			valid: false,
			reason: 'invalid-target',
			resolvedPosition: null,
			cause: { kind: 'actor', combatantId: intent.actorId }
		};
	}
	if (intent.actionKind === 'move') {
		if (target.kind === 'tile') {
			return fixedTileValidation(state, intent.actorId, target.position);
		}
		if (target.kind === 'entity-relative-position') {
			const resolution = resolveEntityRelativePosition(
				state,
				intent.actorId,
				target.combatantId,
				target.relation
			);
			if (resolution.ok) {
				return { valid: true, reason: null, resolvedPosition: resolution.position, cause: null };
			}
			return {
				valid: false,
				reason: resolution.reason === 'occupied' ? 'occupied-destination' : 'invalid-target',
				resolvedPosition: resolution.position,
				cause:
					resolution.reason === 'occupied' && resolution.position
						? { kind: 'destination', position: resolution.position }
						: resolution.reason === 'inactive-target' || resolution.reason === 'impossible-geometry'
							? { kind: 'target', combatantId: target.combatantId }
							: { kind: 'none' }
			};
		}
		return target.kind === 'self'
			? { valid: true, reason: null, resolvedPosition: actor.position, cause: null }
			: {
					valid: false,
					reason: 'invalid-target',
					resolvedPosition: null,
					cause: { kind: 'none' }
				};
	}
	if (target.kind === 'entity' || target.kind === 'entity-relative-position') {
		const entity = state.combatants[target.combatantId];
		return entity?.active && !entity.downed
			? { valid: true, reason: null, resolvedPosition: null, cause: null }
			: {
					valid: false,
					reason: 'invalid-target',
					resolvedPosition: null,
					cause: { kind: 'target', combatantId: target.combatantId }
				};
	}
	if (target.kind === 'self') {
		return intent.actionKind === 'attack' || intent.actionKind === 'skill'
			? {
					valid: false,
					reason: 'invalid-target',
					resolvedPosition: null,
					cause: { kind: 'none' }
				}
			: { valid: true, reason: null, resolvedPosition: null, cause: null };
	}
	return { valid: true, reason: null, resolvedPosition: null, cause: null };
}

function readinessCostEffect(
	state: ReadinessCombatStateV1,
	actorId: string,
	action: CombatLegalAction,
	rules: CombatRulesV1
): ResolvedEffect {
	const actor = state.combatants[actorId]!;
	const before = { ...actor.readiness };
	const recoveryUntilTick = state.tick + action.recoveryTicks;
	if (!Number.isSafeInteger(recoveryUntilTick)) {
		throw new Error('Combat action recovery exceeded the safe integer domain');
	}
	actor.readiness.exactNumerator = Math.max(
		0,
		actor.readiness.exactNumerator - rules.readiness.threshold
	);
	actor.readiness.value = Math.min(rules.readiness.threshold, actor.readiness.exactNumerator);
	actor.readiness.recoveryUntilTick = recoveryUntilTick;
	const after = { ...actor.readiness };
	return {
		kind: 'readiness',
		combatantId: actorId,
		before,
		after,
		exactNumeratorDelta: after.exactNumerator - before.exactNumerator
	};
}

function applyChosenAction(
	state: ReadinessCombatStateV1,
	choice: PreflightChoice,
	target: Target,
	rules: CombatRulesV1,
	resolvedPosition: Readonly<{ x: number; y: number }> | null
): { state: ReadinessCombatStateV1; effects: ResolvedEffect[] } {
	const resolvedIntent = { ...choice.intent, target };
	const resolution = resolveBoundCombatAction({
		state,
		intent: resolvedIntent,
		rules,
		authority: choice.authority
	});
	const candidate = ReadinessCombatStateV1Schema.parse(resolution.state);
	const effects = [...resolution.effects];
	if (choice.intent.actionKind === 'move') {
		const destination = resolvedPosition;
		if (destination === null) throw new Error('Progressive combat movement became invalid');
		const actor = candidate.combatants[choice.intent.actorId]!;
		const before = { ...actor.position };
		actor.position = { ...destination };
		if (positionKey(before) !== positionKey(destination)) {
			effects.push({
				kind: 'position',
				combatantId: choice.intent.actorId,
				before,
				after: { ...destination }
			});
		}
	}
	effects.push(
		readinessCostEffect(candidate, choice.intent.actorId, choice.authority.legalAction, rules)
	);
	return { state: ReadinessCombatStateV1Schema.parse(candidate), effects };
}

function applyCancellationCosts(
	state: ReadinessCombatStateV1,
	choice: PreflightChoice,
	rules: CombatRulesV1
): ResolvedEffect[] {
	const effects: ResolvedEffect[] = [];
	const actor = state.combatants[choice.intent.actorId]!;
	const action = choice.authority.legalAction;
	if (action.conflictPolicy.cancellationRefund.mana === 'none' && action.manaCost > 0) {
		const before = actor.resources.mana.current;
		const after = before - action.manaCost;
		if (after < 0) throw new Error('Canceled combat action cannot pay its authored Mana cost');
		actor.resources.mana.current = after;
		effects.push({
			kind: 'resource',
			combatantId: actor.combatantId,
			resource: 'mana',
			before,
			after,
			delta: after - before
		});
	}
	if (action.conflictPolicy.cancellationRefund.readiness === 'none') {
		effects.push(readinessCostEffect(state, choice.intent.actorId, action, rules));
	}
	return effects;
}

function conflictingEvent(
	events: readonly CombatResolvedEvent[],
	cause: Extract<ProgressiveValidation, { valid: false }>['cause']
): CombatResolvedEvent | undefined {
	if (cause.kind === 'destination') {
		return [...events]
			.reverse()
			.find((event) =>
				event.effects.some(
					(effect) =>
						effect.kind === 'position' && positionKey(effect.after) === positionKey(cause.position)
				)
			);
	}
	if (cause.kind === 'none') return undefined;
	return [...events]
		.reverse()
		.find((event) => event.effects.some((effect) => effect.combatantId === cause.combatantId));
}

function resolvedEvent(input: {
	choice: PreflightChoice;
	batch: CombatChoiceBatchV1;
	ordinal: number;
	conflictingEventId: string | null;
	fallbackApplied: Fallback | null;
	finalOutcome: CombatResolvedEvent['finalOutcome'];
	refundApplied: CombatResolvedEvent['refundApplied'];
	effects: readonly ResolvedEffect[];
}): CombatResolvedEvent {
	const intent = input.choice.intent;
	return CombatResolvedEventSchema.parse({
		eventVersion: 'combat-resolved-event-v1',
		eventId: deterministicUuid(
			`${input.batch.batchHash}:combat-arbitration:${input.ordinal}:${intent.actorId}:${intent.actionInstanceId}`
		),
		attemptId: intent.attemptId,
		windowId: intent.windowId,
		tick: intent.tick,
		actorId: intent.actorId,
		actionId: intent.actionId,
		snapshotHash: intent.snapshotHash,
		actorViewHash: intent.actorViewHash,
		legalActionSetHash: intent.legalActionSetHash,
		originalIntent: intent,
		conflictingEventId: input.conflictingEventId,
		fallbackApplied: input.fallbackApplied,
		refundApplied: input.refundApplied,
		finalOutcome: input.finalOutcome,
		effects: input.effects
	});
}

export function applyCombatChoiceBatch(
	stateInput: ReadinessCombatStateV1,
	batchInput: CombatChoiceBatchV1,
	rulesInput: CombatRulesV1
): CombatChoiceBatchResolution {
	const rules = immutableRules(rulesInput);
	const state = ReadinessCombatStateV1Schema.parse(stateInput);
	const batch = CombatChoiceBatchV1Schema.parse(batchInput);
	const preflightResult = preflight(state, batch, rules);
	const choices = [...preflightResult.choices].sort(
		(left, right) =>
			right.exactReadiness - left.exactReadiness ||
			right.authority.legalAction.reactionPriority - left.authority.legalAction.reactionPriority ||
			left.tie - right.tie ||
			left.intent.actorId.localeCompare(right.intent.actorId)
	);
	const nextEventsEmitted = preflightResult.stateAtWindow.safety.eventsEmitted + choices.length;
	if (
		!Number.isSafeInteger(nextEventsEmitted) ||
		nextEventsEmitted > rules.readiness.safety.maximumEventsEmitted
	) {
		throw new Error('Combat choice batch exceeds the emitted-event safety budget');
	}

	let progressive = ReadinessCombatStateV1Schema.parse(preflightResult.stateAtWindow);
	const events: CombatResolvedEvent[] = [];
	for (const [ordinal, choice] of choices.entries()) {
		const primary = targetIsProgressivelyValid(progressive, choice.intent, choice.intent.target);
		if (primary.valid) {
			const applied = applyChosenAction(
				progressive,
				choice,
				choice.intent.target,
				rules,
				primary.resolvedPosition
			);
			progressive = applied.state;
			events.push(
				resolvedEvent({
					choice,
					batch,
					ordinal,
					conflictingEventId: null,
					fallbackApplied: null,
					finalOutcome: 'applied',
					refundApplied: null,
					effects: applied.effects
				})
			);
			continue;
		}

		const reason = primary.reason!;
		const conflict = conflictingEvent(events, primary.cause);
		const policy =
			reason === 'occupied-destination'
				? choice.authority.legalAction.conflictPolicy.occupiedDestination
				: choice.authority.legalAction.conflictPolicy.invalidTarget;
		const selectedFallback = choice.authority.legalAction.fallbackOptions.find(
			(fallback) => fallback.fallbackId === choice.intent.fallbackId
		);
		const fallbackValidity = selectedFallback
			? targetIsProgressivelyValid(progressive, choice.intent, selectedFallback.target)
			: null;
		if (policy === 'selected-fallback' && selectedFallback && fallbackValidity?.valid) {
			const applied = applyChosenAction(
				progressive,
				choice,
				selectedFallback.target,
				rules,
				fallbackValidity.resolvedPosition
			);
			progressive = applied.state;
			events.push(
				resolvedEvent({
					choice,
					batch,
					ordinal,
					conflictingEventId: conflict?.eventId ?? null,
					fallbackApplied: selectedFallback,
					finalOutcome: 'superseded',
					refundApplied: null,
					effects: applied.effects
				})
			);
			continue;
		}

		const effects = applyCancellationCosts(progressive, choice, rules);
		const cancellationConflict =
			policy === 'selected-fallback' &&
			selectedFallback &&
			fallbackValidity &&
			!fallbackValidity.valid
				? (conflictingEvent(events, fallbackValidity.cause) ?? conflict)
				: conflict;
		events.push(
			resolvedEvent({
				choice,
				batch,
				ordinal,
				conflictingEventId: cancellationConflict?.eventId ?? null,
				fallbackApplied: null,
				finalOutcome: 'canceled',
				refundApplied: choice.authority.legalAction.conflictPolicy.cancellationRefund,
				effects
			})
		);
	}
	progressive.safety.eventsEmitted = nextEventsEmitted;
	return deepFreeze({
		state: ReadinessCombatStateV1Schema.parse(progressive),
		events: events.map((event) => CombatResolvedEventSchema.parse(event))
	});
}

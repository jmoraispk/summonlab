import {
	ActorDecisionViewSchema,
	CombatAdvanceSchema,
	CombatRulesV1Schema,
	CombatWindowSnapshotSchema,
	ReadinessCombatStateV1Schema,
	type ActorDecisionView,
	type CombatAdvance,
	type CombatLegalAction,
	type CombatRulesV1,
	type CombatWindowSnapshot,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING } from '@summonlab/content';

import { deterministicUuid, hashCanonical } from '../../hash.js';
import { authorCombatLegalActions, canonicalCombatLegalActions } from './legal-actions.js';
import { advanceUntilReadyCohort } from './readiness.js';

type CombatTerrain = CombatWindowSnapshot['terrain'];

export type ActorCombatContext = Readonly<{
	visibleCombatantIds: readonly string[];
	visibleTelegraphIds: readonly string[];
	observableReadinessActorIds: readonly string[];
	rememberedContext: readonly string[];
	doctrine: readonly string[];
	relationships: readonly Readonly<{ entityId: string; publicSummary: string }>[];
	masterDirections: readonly string[];
	legalActions: readonly CombatLegalAction[];
	visibleTerrain?: CombatTerrain;
}>;

export type BuildCombatWindowSnapshotInput = Readonly<{
	state: ReadinessCombatStateV1;
	rules: CombatRulesV1;
	readyActorIds: readonly string[];
	contentHash: string;
}>;

export type AssembleCombatDecisionWindowInput = BuildCombatWindowSnapshotInput &
	Readonly<{ actorContexts: Readonly<Record<string, ActorCombatContext>> }>;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

function sortedUnique(values: readonly string[], label: string): string[] {
	const sorted = [...values].sort((left, right) => left.localeCompare(right));
	if (new Set(sorted).size !== sorted.length) throw new Error(`${label} must be unique`);
	return sorted;
}

function readinessActors(state: ReadinessCombatStateV1, rules: CombatRulesV1): string[] {
	return Object.values(state.combatants)
		.filter(
			(combatant) =>
				combatant.active &&
				!combatant.downed &&
				combatant.readiness.exactNumerator >= rules.readiness.threshold &&
				combatant.readiness.recoveryUntilTick <= state.tick
		)
		.map((combatant) => combatant.combatantId)
		.sort((left, right) => left.localeCompare(right));
}

function sortRecord<T>(record: Readonly<Record<string, T>>): Record<string, T> {
	return Object.fromEntries(
		Object.entries(record).sort(([left], [right]) => left.localeCompare(right))
	);
}

function canonicalTerrain(terrain: CombatTerrain): CombatTerrain {
	return {
		...terrain,
		blockedTiles: [...terrain.blockedTiles].sort(
			(left, right) => left.y - right.y || left.x - right.x
		),
		features: [...terrain.features].sort((left, right) =>
			left.featureId.localeCompare(right.featureId)
		)
	};
}

function canonicalCombatants(
	combatants: ReadinessCombatStateV1['combatants']
): ReadinessCombatStateV1['combatants'] {
	return Object.fromEntries(
		Object.entries(combatants)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([combatantId, combatant]) => [
				combatantId,
				{
					...combatant,
					resistances: sortRecord(combatant.resistances),
					conditions: [...combatant.conditions].sort((left, right) =>
						left.conditionId.localeCompare(right.conditionId)
					),
					cooldowns: sortRecord(combatant.cooldowns)
				}
			])
	);
}

function unsignedSnapshot(
	snapshot: CombatWindowSnapshot
): Omit<CombatWindowSnapshot, 'snapshotHash'> {
	const unsigned: Partial<CombatWindowSnapshot> = { ...snapshot };
	delete unsigned.snapshotHash;
	return unsigned as Omit<CombatWindowSnapshot, 'snapshotHash'>;
}

function unsignedView(view: ActorDecisionView): Omit<ActorDecisionView, 'actorViewHash'> {
	const unsigned: Partial<ActorDecisionView> = { ...view };
	delete unsigned.actorViewHash;
	return unsigned as Omit<ActorDecisionView, 'actorViewHash'>;
}

export function buildCombatWindowSnapshot(
	input: BuildCombatWindowSnapshotInput
): CombatWindowSnapshot {
	const state = ReadinessCombatStateV1Schema.parse(input.state);
	const rules = CombatRulesV1Schema.parse(input.rules);
	const readyActorIds = sortedUnique(input.readyActorIds, 'Combat ready actor set');
	if (JSON.stringify(readyActorIds) !== JSON.stringify(readinessActors(state, rules))) {
		throw new Error('Combat ready actor set must exactly match canonical readiness');
	}
	const canonicalState = {
		...state,
		combatants: canonicalCombatants(state.combatants),
		terrain: canonicalTerrain(state.terrain),
		visibleTelegraphs: [...state.visibleTelegraphs].sort((left, right) =>
			left.telegraphId.localeCompare(right.telegraphId)
		),
		scheduledEffects: [...state.scheduledEffects].sort((left, right) =>
			left.scheduledEffectId.localeCompare(right.scheduledEffectId)
		)
	};
	const stateHash = hashCanonical(canonicalState);
	const windowId = deterministicUuid(
		`combat-window-v1:${state.attemptId}:${state.tick}:${rules.rulesVersion}:${input.contentHash}:${stateHash}`
	);
	const withoutHash = {
		snapshotVersion: 'combat-window-v1' as const,
		windowId,
		attemptId: state.attemptId,
		tick: state.tick,
		readyActorIds,
		combatants: canonicalState.combatants,
		terrain: canonicalState.terrain,
		visibleTelegraphs: canonicalState.visibleTelegraphs,
		rulesVersion: rules.rulesVersion,
		contentHash: input.contentHash,
		stateHash
	};
	const snapshot = CombatWindowSnapshotSchema.parse({
		...withoutHash,
		snapshotHash: hashCanonical(withoutHash)
	});
	if (hashCanonical(unsignedSnapshot(snapshot)) !== snapshot.snapshotHash) {
		throw new Error('Combat snapshot hash failed verification');
	}
	return deepFreeze(snapshot);
}

function publicCondition(
	condition: ReadinessCombatStateV1['combatants'][string]['conditions'][number],
	tick: number
) {
	const words = condition.conditionId.replaceAll('-', ' ');
	return {
		conditionId: condition.conditionId,
		stacks: condition.stacks,
		remainingTicks:
			condition.expiresAtTick === null ? null : Math.max(0, condition.expiresAtTick - tick),
		publicLabel: `${words.charAt(0).toUpperCase()}${words.slice(1)}`
	};
}

function entityIdsInAction(action: CombatLegalAction): string[] {
	const entityIds: string[] = [];
	if (
		action.targetContract.kind === 'entity' ||
		action.targetContract.kind === 'entity-relative-position'
	) {
		entityIds.push(...action.targetContract.allowedCombatantIds);
	}
	for (const fallback of action.fallbackOptions) {
		if (fallback.target.kind === 'entity' || fallback.target.kind === 'entity-relative-position') {
			entityIds.push(fallback.target.combatantId);
		}
	}
	return entityIds;
}

function validateProviderActionVisibility(
	actorId: string,
	visibleCombatantIds: ReadonlySet<string>,
	actions: readonly CombatLegalAction[]
): void {
	for (const action of actions) {
		for (const entityId of entityIdsInAction(action)) {
			if (entityId !== actorId && !visibleCombatantIds.has(entityId)) {
				throw new Error(`Combat legal action ${action.actionId} refers to a hidden combatant`);
			}
		}
	}
}

function visibleTerrainProjection(
	canonical: CombatTerrain,
	visibleInput: CombatTerrain | undefined
): CombatTerrain {
	if (!visibleInput) return canonicalTerrain(canonical);
	const visible = canonicalTerrain(visibleInput);
	if (visible.width !== canonical.width || visible.height !== canonical.height) {
		throw new Error('Visible combat terrain must preserve canonical arena dimensions');
	}
	const canonicalBlocked = new Set(
		canonical.blockedTiles.map((position) => `${position.x}:${position.y}`)
	);
	if (
		visible.blockedTiles.some((position) => !canonicalBlocked.has(`${position.x}:${position.y}`))
	) {
		throw new Error('Visible combat terrain cannot invent blocked tiles');
	}
	const canonicalFeatures = new Map(
		canonical.features.map((feature) => [feature.featureId, hashCanonical(feature)])
	);
	if (
		visible.features.some(
			(feature) => canonicalFeatures.get(feature.featureId) !== hashCanonical(feature)
		)
	) {
		throw new Error('Visible combat terrain cannot invent or alter features');
	}
	return visible;
}

function actorView(
	snapshot: CombatWindowSnapshot,
	contextInput: ActorCombatContext,
	rules: CombatRulesV1,
	actorId: string
): ActorDecisionView {
	const self = snapshot.combatants[actorId];
	if (!self) throw new Error(`Combat actor ${actorId} is absent from the canonical snapshot`);
	const visibleCombatantIds = sortedUnique(
		contextInput.visibleCombatantIds.filter((combatantId) => combatantId !== actorId),
		`Visible combatants for ${actorId}`
	);
	const visibleSet = new Set(visibleCombatantIds);
	const observableReadiness = new Set(contextInput.observableReadinessActorIds);
	for (const combatantId of visibleCombatantIds) {
		if (!snapshot.combatants[combatantId]) {
			throw new Error(`Visible combatant ${combatantId} is absent from the canonical snapshot`);
		}
	}
	const legalActions = canonicalCombatLegalActions(contextInput.legalActions);
	validateProviderActionVisibility(actorId, visibleSet, legalActions);
	const legalActionSetHash = hashCanonical(legalActions);
	const visibleTelegraphIds = new Set(
		sortedUnique(contextInput.visibleTelegraphIds, `Visible telegraphs for ${actorId}`)
	);
	const visibleTelegraphs = snapshot.visibleTelegraphs.filter((telegraph) => {
		if (!visibleTelegraphIds.has(telegraph.telegraphId)) return false;
		if (telegraph.sourceCombatantId !== actorId && !visibleSet.has(telegraph.sourceCombatantId)) {
			throw new Error(`Visible telegraph ${telegraph.telegraphId} has a hidden source`);
		}
		if (
			(telegraph.target.kind === 'entity' ||
				telegraph.target.kind === 'entity-relative-position') &&
			telegraph.target.combatantId !== actorId &&
			!visibleSet.has(telegraph.target.combatantId)
		) {
			throw new Error(`Visible telegraph ${telegraph.telegraphId} has a hidden target`);
		}
		return true;
	});
	if (visibleTelegraphs.length !== visibleTelegraphIds.size) {
		throw new Error(`Visible telegraph selection for ${actorId} contains an unknown id`);
	}
	const relationships = [...contextInput.relationships].sort((left, right) =>
		left.entityId.localeCompare(right.entityId)
	);
	for (const relationship of relationships) {
		if (relationship.entityId !== actorId && !visibleSet.has(relationship.entityId)) {
			throw new Error(`Combat relationship for ${actorId} refers to a hidden entity`);
		}
	}
	const withoutHash = {
		viewVersion: 'actor-decision-view-v1' as const,
		windowId: snapshot.windowId,
		actorId,
		snapshotHash: snapshot.snapshotHash,
		legalActionSetHash,
		self: {
			combatantId: self.combatantId,
			combatantKind: self.combatantKind,
			teamId: self.teamId,
			position: self.position,
			resources: self.resources,
			conditions: self.conditions.map((condition) => publicCondition(condition, snapshot.tick)),
			readiness: {
				ready:
					self.readiness.exactNumerator >= rules.readiness.threshold &&
					self.readiness.recoveryUntilTick <= snapshot.tick,
				recoveryTicksRemaining: Math.max(0, self.readiness.recoveryUntilTick - snapshot.tick)
			},
			downed: self.downed,
			active: self.active
		},
		visibleCombatants: visibleCombatantIds.map((combatantId) => {
			const combatant = snapshot.combatants[combatantId]!;
			const readinessStatus = observableReadiness.has(combatantId)
				? combatant.readiness.recoveryUntilTick > snapshot.tick
					? ('recovering' as const)
					: combatant.readiness.exactNumerator >= rules.readiness.threshold
						? ('ready' as const)
						: ('unknown' as const)
				: ('unknown' as const);
			return {
				combatantId: combatant.combatantId,
				combatantKind: combatant.combatantKind,
				teamId: combatant.teamId,
				position: combatant.position,
				resources: combatant.resources,
				conditions: combatant.conditions.map((condition) =>
					publicCondition(condition, snapshot.tick)
				),
				readinessStatus,
				downed: combatant.downed,
				active: combatant.active
			};
		}),
		visibleTerrain: visibleTerrainProjection(snapshot.terrain, contextInput.visibleTerrain),
		visibleTelegraphs,
		rememberedContext: [...contextInput.rememberedContext].sort((left, right) =>
			left.localeCompare(right)
		),
		doctrine: [...contextInput.doctrine].sort((left, right) => left.localeCompare(right)),
		relationships,
		masterDirections: [...contextInput.masterDirections].sort((left, right) =>
			left.localeCompare(right)
		),
		legalActions
	};
	const view = ActorDecisionViewSchema.parse({
		...withoutHash,
		actorViewHash: hashCanonical(withoutHash)
	});
	if (hashCanonical(unsignedView(view)) !== view.actorViewHash) {
		throw new Error(`Combat actor view hash failed verification for ${actorId}`);
	}
	return deepFreeze(view);
}

export function assembleCombatDecisionWindow(
	input: AssembleCombatDecisionWindowInput
): Extract<CombatAdvance, { kind: 'decision-window' }> {
	const rules = CombatRulesV1Schema.parse(input.rules);
	const snapshot = buildCombatWindowSnapshot(input);
	const contextActorIds = Object.keys(input.actorContexts).sort((left, right) =>
		left.localeCompare(right)
	);
	if (JSON.stringify(contextActorIds) !== JSON.stringify(snapshot.readyActorIds)) {
		throw new Error('Combat actor contexts must exactly match the ready actor set');
	}
	const views = snapshot.readyActorIds.map((actorId) =>
		actorView(snapshot, input.actorContexts[actorId]!, rules, actorId)
	);
	const advance = CombatAdvanceSchema.parse({ kind: 'decision-window', snapshot, views });
	if (advance.kind !== 'decision-window') throw new Error('Expected a combat decision window');
	return deepFreeze(advance);
}

function defaultActorContexts(
	state: ReadinessCombatStateV1,
	readyActorIds: readonly string[],
	windowId: string
): Readonly<Record<string, ActorCombatContext>> {
	return Object.fromEntries(
		readyActorIds.map((actorId) => {
			const visibleCombatantIds = Object.keys(state.combatants)
				.filter((combatantId) => combatantId !== actorId)
				.sort((left, right) => left.localeCompare(right));
			const legalActions = authorCombatLegalActions({
				actorId,
				windowId,
				actions: [
					{
						actionId: 'guard',
						actionKind: 'guard',
						skillId: null,
						publicLabel: 'Guard',
						targetContract: { kind: 'self' },
						reactionPriority: 0,
						recoveryTicks: 1,
						manaCost: 0,
						fallbackOptions: [
							{ fallbackId: 'brace', publicLabel: 'Brace', target: { kind: 'self' } }
						]
					}
				]
			});
			return [
				actorId,
				{
					visibleCombatantIds,
					visibleTelegraphIds: state.visibleTelegraphs.map((telegraph) => telegraph.telegraphId),
					observableReadinessActorIds: [],
					rememberedContext: [],
					doctrine: [],
					relationships: [],
					masterDirections: [],
					legalActions
				}
			] as const;
		})
	);
}

export function advanceUntilDecision(
	stateInput: ReadinessCombatStateV1,
	rulesInput: CombatRulesV1
): CombatAdvance {
	const rules = CombatRulesV1Schema.parse(rulesInput);
	const advanced = advanceUntilReadyCohort(stateInput, rules);
	if (advanced.kind === 'combat-result') {
		return deepFreeze(
			CombatAdvanceSchema.parse({ kind: 'combat-result', result: advanced.result })
		);
	}
	const snapshot = buildCombatWindowSnapshot({
		state: advanced.state,
		rules,
		readyActorIds: advanced.readyActorIds,
		contentHash: COMBAT_CONTENT_BINDING.contentHash
	});
	return assembleCombatDecisionWindow({
		state: advanced.state,
		rules,
		readyActorIds: advanced.readyActorIds,
		contentHash: COMBAT_CONTENT_BINDING.contentHash,
		actorContexts: defaultActorContexts(advanced.state, advanced.readyActorIds, snapshot.windowId)
	});
}

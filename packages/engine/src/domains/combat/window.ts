import {
	ActorDecisionViewSchema,
	CombatAdvanceSchema,
	CombatResultSchema,
	CombatRulesV1Schema,
	CombatWindowSnapshotSchema,
	ReadinessCombatStateV1Schema,
	type ActorDecisionView,
	type CombatActorContextState,
	type CombatAdvance,
	type CombatLegalAction,
	type CombatLegalActionTemplate,
	type CombatRulesV1,
	type CombatWindowSnapshot,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING } from '@summonlab/content';

import { deterministicUuid, hashCanonical } from '../../hash.js';
import { resolveEntityRelativePosition } from './geometry.js';
import { authorCombatLegalActions, canonicalCombatLegalActionTemplates } from './legal-actions.js';
import { advanceUntilReadyCohort } from './readiness.js';

type CombatTerrain = CombatWindowSnapshot['terrain'];

export type ActorCombatContext = Readonly<CombatActorContextState>;

export type BuildCombatWindowSnapshotInput = Readonly<{
	state: ReadinessCombatStateV1;
	rules: CombatRulesV1;
	readyActorIds: readonly string[];
	contentHash: string;
}>;

export type AssembleCombatDecisionWindowInput = BuildCombatWindowSnapshotInput;

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

function canonicalActorContexts(
	actorContexts: ReadinessCombatStateV1['actorContexts']
): ReadinessCombatStateV1['actorContexts'] {
	return Object.fromEntries(
		Object.entries(actorContexts)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([actorId, context]) => [
				actorId,
				{
					...context,
					visibleCombatantIds: [...context.visibleCombatantIds].sort(),
					visibleTelegraphIds: [...context.visibleTelegraphIds].sort(),
					observableReadinessActorIds: [...context.observableReadinessActorIds].sort(),
					targetablePositions: [...context.targetablePositions].sort(
						(left, right) => left.y - right.y || left.x - right.x
					),
					visibleTerrainFeatureIds: [...context.visibleTerrainFeatureIds].sort(),
					rememberedContext: [...context.rememberedContext].sort(),
					doctrine: [...context.doctrine].sort(),
					relationships: [...context.relationships].sort((left, right) =>
						left.entityId.localeCompare(right.entityId)
					),
					masterDirections: [...context.masterDirections].sort(),
					legalActionTemplates: [
						...canonicalCombatLegalActionTemplates(context.legalActionTemplates)
					]
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
		actorContexts: canonicalActorContexts(state.actorContexts),
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

function currentLegalActionTemplates(
	state: ReadinessCombatStateV1,
	actorId: string,
	context: ActorCombatContext
): readonly CombatLegalActionTemplate[] {
	const actor = state.combatants[actorId];
	if (!actor) return [];
	const targetablePositions = new Set(
		context.targetablePositions.map((position) => `${position.x}:${position.y}`)
	);
	const blockedPositions = new Set(
		state.terrain.blockedTiles.map((position) => `${position.x}:${position.y}`)
	);
	const occupiedPositions = new Set(
		Object.values(state.combatants).map(
			(combatant) => `${combatant.position.x}:${combatant.position.y}`
		)
	);
	const positionIsCurrent = (
		position: Readonly<{ x: number; y: number }>,
		actionKind: CombatLegalAction['actionKind']
	): boolean => {
		const key = `${position.x}:${position.y}`;
		return (
			position.x >= 0 &&
			position.y >= 0 &&
			position.x < state.terrain.width &&
			position.y < state.terrain.height &&
			targetablePositions.has(key) &&
			!blockedPositions.has(key) &&
			(actionKind !== 'move' || !occupiedPositions.has(key))
		);
	};
	type RelativeRelation = 'adjacent' | 'behind' | 'flank-left' | 'flank-right';
	const relativePositionIsCurrent = (combatantId: string, relation: RelativeRelation): boolean => {
		const resolution = resolveEntityRelativePosition(state, actorId, combatantId, relation);
		return resolution.ok && positionIsCurrent(resolution.position, 'move');
	};
	const entityIsCurrent = (combatantId: string): boolean => {
		const combatant = state.combatants[combatantId];
		return Boolean(combatant?.active && !combatant.downed);
	};
	const targetIsCurrent = (
		target: CombatLegalAction['fallbackOptions'][number]['target'],
		actionKind: CombatLegalAction['actionKind']
	): boolean =>
		target.kind === 'self' ||
		(target.kind === 'entity' && entityIsCurrent(target.combatantId)) ||
		(target.kind === 'tile' && positionIsCurrent(target.position, actionKind)) ||
		(target.kind === 'entity-relative-position' &&
			relativePositionIsCurrent(target.combatantId, target.relation));

	const current: CombatLegalActionTemplate[] = [];
	for (const action of context.legalActionTemplates) {
		const contract = action.targetContract;
		let targetContract: CombatLegalActionTemplate['targetContract'] | null = null;
		if (contract.kind === 'self') {
			targetContract = contract;
		} else if (contract.kind === 'entity') {
			const allowedCombatantIds = contract.allowedCombatantIds.filter(entityIsCurrent);
			if (allowedCombatantIds.length > 0) targetContract = { ...contract, allowedCombatantIds };
		} else if (contract.kind === 'tile') {
			const allowedPositions = contract.allowedPositions.filter((position) =>
				positionIsCurrent(position, action.actionKind)
			);
			if (allowedPositions.length > 0) targetContract = { ...contract, allowedPositions };
		} else {
			const candidates = contract.allowedCombatantIds
				.filter(entityIsCurrent)
				.map((combatantId) => ({
					combatantId,
					relations: contract.allowedRelations.filter((relation) =>
						relativePositionIsCurrent(combatantId, relation)
					)
				}))
				.filter((candidate) => candidate.relations.length > 0);
			if (candidates.length > 0) {
				const commonRelations = contract.allowedRelations.filter((relation) =>
					candidates.every((candidate) => candidate.relations.includes(relation))
				);
				const selected =
					commonRelations.length > 0
						? {
								ids: candidates.map((candidate) => candidate.combatantId),
								relations: commonRelations
							}
						: { ids: [candidates[0]!.combatantId], relations: candidates[0]!.relations };
				targetContract = {
					...contract,
					allowedCombatantIds: selected.ids,
					allowedRelations: selected.relations
				};
			}
		}
		const fallbackOptions = action.fallbackOptions.filter((fallback) =>
			targetIsCurrent(fallback.target, action.actionKind)
		);
		if (targetContract && fallbackOptions.length > 0) {
			current.push({ ...action, targetContract, fallbackOptions });
		}
	}
	return current;
}

function visibleTerrainProjection(
	canonical: CombatTerrain,
	context: ActorCombatContext
): CombatTerrain {
	const targetablePositions = new Set(
		context.targetablePositions.map((position) => `${position.x}:${position.y}`)
	);
	const visibleFeatures = new Set(context.visibleTerrainFeatureIds);
	return canonicalTerrain({
		width: canonical.width,
		height: canonical.height,
		blockedTiles: canonical.blockedTiles.filter((position) =>
			targetablePositions.has(`${position.x}:${position.y}`)
		),
		features: canonical.features.filter((feature) => visibleFeatures.has(feature.featureId))
	});
}

function actorView(
	snapshot: CombatWindowSnapshot,
	contextInput: ActorCombatContext,
	rules: CombatRulesV1,
	actorId: string,
	legalActionTemplates: readonly CombatLegalActionTemplate[]
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
	const legalActions = authorCombatLegalActions({
		actorId,
		windowId: snapshot.windowId,
		availableMana: self.resources.mana.current,
		actions: legalActionTemplates
	});
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
		visibleTerrain: visibleTerrainProjection(snapshot.terrain, contextInput),
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
	const state = ReadinessCombatStateV1Schema.parse(input.state);
	const snapshot = buildCombatWindowSnapshot(input);
	if (snapshot.readyActorIds.some((actorId) => !state.actorContexts[actorId])) {
		throw new Error('Combat actor contexts must include every ready actor');
	}
	const views = snapshot.readyActorIds.map((actorId) => {
		const templates = currentLegalActionTemplates(state, actorId, state.actorContexts[actorId]!);
		if (!templates.some((action) => action.manaCost === 0)) {
			throw new Error('Combat actor context has no current authored zero-Mana action');
		}
		return actorView(snapshot, state.actorContexts[actorId]!, rules, actorId, templates);
	});
	const advance = CombatAdvanceSchema.parse({ kind: 'decision-window', snapshot, views });
	if (advance.kind !== 'decision-window') throw new Error('Expected a combat decision window');
	return deepFreeze(advance);
}

function invalidDecisionContextResult(state: ReadinessCombatStateV1): CombatAdvance {
	const safetyStop = {
		safetyStopVersion: 'combat-safety-stop-v1' as const,
		reason: 'invalid-state' as const,
		disposition: 'diagnostic' as const,
		...state.safety
	};
	const withoutHash = {
		resultVersion: 'combat-result-v1' as const,
		resultId: deterministicUuid(
			`${state.attemptId}:missing-decision-context:${state.tick}:${hashCanonical(state.actorContexts)}`
		),
		attemptId: state.attemptId,
		modeId: 'agent-readiness-v1' as const,
		rulesVersion: 'combat-rules-v1' as const,
		outcome: 'safety-stop' as const,
		endedAtTick: state.tick,
		finalCombatants: state.combatants,
		claims: [],
		decisiveEventIds: [],
		safetyStop
	};
	const result = CombatResultSchema.parse({
		...withoutHash,
		traceHash: hashCanonical(withoutHash)
	});
	return deepFreeze(CombatAdvanceSchema.parse({ kind: 'combat-result', result }));
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
	if (
		advanced.readyActorIds.some((actorId) => {
			const context = advanced.state.actorContexts[actorId];
			return (
				!context ||
				!currentLegalActionTemplates(advanced.state, actorId, context).some(
					(action) => action.manaCost === 0
				)
			);
		})
	) {
		return invalidDecisionContextResult(advanced.state);
	}
	return assembleCombatDecisionWindow({
		state: advanced.state,
		rules,
		readyActorIds: advanced.readyActorIds,
		contentHash: COMBAT_CONTENT_BINDING.contentHash
	});
}

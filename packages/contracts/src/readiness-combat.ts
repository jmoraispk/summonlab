import { z } from 'zod';

import { CombatAttributesSchema } from './capability.js';
import {
	CombatRulesVersionSchema,
	ResistanceTagSchema,
	type CombatRulesV1
} from './combat-rules.js';
import { CombatSkillIdSchema } from './combat-skill.js';
import { EntityIdSchema, StateHashSchema } from './shared.js';

export const ReadinessCombatStateVersionSchema = z.literal('readiness-combat-state-v1');
export const CombatWindowVersionSchema = z.literal('combat-window-v1');
export const CombatChoiceBatchVersionSchema = z.literal('combat-choice-batch-v1');
export const CombatResultVersionSchema = z.literal('combat-result-v1');

const TickSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const BoundedTextSchema = z.string().trim().min(1).max(300);
const TeamIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u);

export const CombatPositionSchema = z
	.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })
	.strict();

export const CombatResourceValueSchema = z
	.object({ current: z.number().int().nonnegative(), maximum: z.number().int().positive() })
	.strict()
	.refine((resource) => resource.current <= resource.maximum, {
		message: 'Combat resource cannot exceed its maximum'
	});

export const CombatResourcesSchema = z
	.object({ health: CombatResourceValueSchema, mana: CombatResourceValueSchema })
	.strict();

export const CombatReadinessSchema = z
	.object({
		value: z.number().int().nonnegative(),
		exactNumerator: z.number().int().nonnegative(),
		recoveryUntilTick: TickSchema
	})
	.strict()
	.refine((readiness) => readiness.value <= readiness.exactNumerator, {
		message: 'Capped readiness cannot exceed its exact authoritative numerator'
	});

export const CombatConditionSchema = z
	.object({
		conditionId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		stacks: z.number().int().positive().max(1_000),
		appliedAtTick: TickSchema,
		expiresAtTick: TickSchema.nullable(),
		sourceCombatantId: EntityIdSchema.nullable()
	})
	.strict()
	.refine(
		(condition) =>
			condition.expiresAtTick === null || condition.expiresAtTick > condition.appliedAtTick,
		{ message: 'Combat condition expiry must follow its application tick' }
	);

export const CombatantStateSchema = z
	.object({
		combatantId: EntityIdSchema,
		combatantKind: z.enum(['master', 'hero', 'monster']),
		teamId: TeamIdSchema,
		position: CombatPositionSchema,
		resources: CombatResourcesSchema,
		lastDamagedAtTick: TickSchema.nullable(),
		attributes: CombatAttributesSchema,
		armour: z.number().int().nonnegative().max(1_000_000),
		resistances: z.partialRecord(ResistanceTagSchema, z.number().int().min(-10_000).max(10_000)),
		readiness: CombatReadinessSchema,
		conditions: z.array(CombatConditionSchema).max(128),
		cooldowns: z.record(CombatSkillIdSchema, TickSchema),
		downed: z.boolean(),
		active: z.boolean()
	})
	.strict()
	.superRefine((combatant, context) => {
		if (
			new Set(combatant.conditions.map((condition) => condition.conditionId)).size !==
			combatant.conditions.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['conditions'],
				message: 'Combat conditions must be unique'
			});
		}
		if (combatant.downed && combatant.resources.health.current !== 0) {
			context.addIssue({
				code: 'custom',
				path: ['resources', 'health'],
				message: 'A downed combatant must have zero Health'
			});
		}
		if (combatant.downed && combatant.active) {
			context.addIssue({
				code: 'custom',
				path: ['active'],
				message: 'A downed combatant cannot be active'
			});
		}
	});

export const CombatTerrainSchema = z
	.object({
		width: z.number().int().positive().max(1_000),
		height: z.number().int().positive().max(1_000),
		blockedTiles: z.array(CombatPositionSchema).max(10_000),
		features: z
			.array(
				z
					.object({
						featureId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
						kind: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
						position: CombatPositionSchema
					})
					.strict()
			)
			.max(1_000)
	})
	.strict()
	.superRefine((terrain, context) => {
		const positions = [
			...terrain.blockedTiles,
			...terrain.features.map((feature) => feature.position)
		];
		for (const [index, position] of positions.entries()) {
			if (position.x >= terrain.width || position.y >= terrain.height) {
				context.addIssue({
					code: 'custom',
					path: ['positions', index],
					message: 'Terrain position is outside the arena'
				});
			}
		}
		if (
			new Set(terrain.features.map((feature) => feature.featureId)).size !== terrain.features.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['features'],
				message: 'Terrain features must be unique'
			});
		}
	});

export const CombatTargetSelectionSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('self') }).strict(),
	z.object({ kind: z.literal('entity'), combatantId: EntityIdSchema }).strict(),
	z.object({ kind: z.literal('tile'), position: CombatPositionSchema }).strict(),
	z
		.object({
			kind: z.literal('entity-relative-position'),
			combatantId: EntityIdSchema,
			relation: z.enum(['adjacent', 'behind', 'flank-left', 'flank-right'])
		})
		.strict()
]);

export const CombatTargetContractSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('self') }).strict(),
	z
		.object({
			kind: z.literal('entity'),
			allowedCombatantIds: z.array(EntityIdSchema).min(1).max(128)
		})
		.strict(),
	z
		.object({
			kind: z.literal('tile'),
			allowedPositions: z.array(CombatPositionSchema).min(1).max(1_000)
		})
		.strict(),
	z
		.object({
			kind: z.literal('entity-relative-position'),
			allowedCombatantIds: z.array(EntityIdSchema).min(1).max(128),
			allowedRelations: z
				.array(z.enum(['adjacent', 'behind', 'flank-left', 'flank-right']))
				.min(1)
				.max(4)
		})
		.strict()
]);

export const CombatFallbackOptionSchema = z
	.object({
		fallbackId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		publicLabel: z.string().trim().min(1).max(120),
		target: CombatTargetSelectionSchema
	})
	.strict();

export const CombatLegalActionSchema = z
	.object({
		actionId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		actionInstanceId: EntityIdSchema,
		actionKind: z.enum(['attack', 'skill', 'move', 'guard', 'rescue', 'retreat']),
		skillId: CombatSkillIdSchema.nullable(),
		publicLabel: z.string().trim().min(1).max(120),
		targetContract: CombatTargetContractSchema,
		reactionPriority: z.number().int().min(-100).max(100),
		recoveryTicks: z.number().int().positive().max(100_000),
		manaCost: z.number().int().nonnegative().max(1_000_000),
		fallbackOptions: z.array(CombatFallbackOptionSchema).max(16)
	})
	.strict()
	.superRefine((action, context) => {
		if (
			new Set(action.fallbackOptions.map((fallback) => fallback.fallbackId)).size !==
			action.fallbackOptions.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['fallbackOptions'],
				message: 'Fallback options must be unique'
			});
		}
	});

export const CombatLegalActionTemplateSchema = z
	.object({
		actionId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		actionKind: z.enum(['attack', 'skill', 'move', 'guard', 'rescue', 'retreat']),
		skillId: CombatSkillIdSchema.nullable(),
		publicLabel: z.string().trim().min(1).max(120),
		targetContract: CombatTargetContractSchema,
		reactionPriority: z.number().int().min(-100).max(100),
		recoveryTicks: z.number().int().positive().max(100_000),
		manaCost: z.number().int().nonnegative().max(1_000_000),
		fallbackOptions: z.array(CombatFallbackOptionSchema).min(1).max(16)
	})
	.strict()
	.superRefine((action, context) => {
		if (
			new Set(action.fallbackOptions.map((fallback) => fallback.fallbackId)).size !==
			action.fallbackOptions.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['fallbackOptions'],
				message: 'Fallback options must be unique'
			});
		}
	});

export const CombatTelegraphSchema = z
	.object({
		telegraphId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		sourceCombatantId: EntityIdSchema,
		target: CombatTargetSelectionSchema,
		resolvesAtTick: TickSchema,
		publicLabel: z.string().trim().min(1).max(120)
	})
	.strict();

export const CombatWindowSnapshotSchema = z
	.object({
		snapshotVersion: CombatWindowVersionSchema,
		windowId: EntityIdSchema,
		attemptId: EntityIdSchema,
		tick: TickSchema,
		readyActorIds: z.array(EntityIdSchema).min(1).max(128),
		combatants: z.record(EntityIdSchema, CombatantStateSchema),
		terrain: CombatTerrainSchema,
		visibleTelegraphs: z.array(CombatTelegraphSchema).max(1_000),
		rulesVersion: CombatRulesVersionSchema,
		contentHash: StateHashSchema,
		stateHash: StateHashSchema,
		snapshotHash: StateHashSchema
	})
	.strict()
	.superRefine((snapshot, context) => {
		for (const actorId of snapshot.readyActorIds) {
			const actor = snapshot.combatants[actorId];
			if (!actor || !actor.active || actor.downed) {
				context.addIssue({
					code: 'custom',
					path: ['readyActorIds'],
					message: 'Every ready actor must be active in the snapshot'
				});
			}
		}
		if (new Set(snapshot.readyActorIds).size !== snapshot.readyActorIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['readyActorIds'],
				message: 'Ready actors must be unique'
			});
		}
		if (
			new Set(snapshot.visibleTelegraphs.map((telegraph) => telegraph.telegraphId)).size !==
			snapshot.visibleTelegraphs.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['visibleTelegraphs'],
				message: 'Visible combat telegraphs must be unique'
			});
		}
		validateCombatantMap(snapshot.combatants, snapshot.terrain, context, snapshot.tick);
	});

export const CombatActorContextStateSchema = z
	.object({
		actorId: EntityIdSchema,
		visibleCombatantIds: z.array(EntityIdSchema).max(128),
		visibleTelegraphIds: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u)).max(1_000),
		observableReadinessActorIds: z.array(EntityIdSchema).max(128),
		visiblePositions: z.array(CombatPositionSchema).min(1).max(10_000),
		visibleTerrainFeatureIds: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u)).max(1_000),
		rememberedContext: z.array(BoundedTextSchema).max(32),
		doctrine: z.array(BoundedTextSchema).max(32),
		relationships: z
			.array(z.object({ entityId: EntityIdSchema, publicSummary: BoundedTextSchema }).strict())
			.max(128),
		masterDirections: z.array(BoundedTextSchema).max(32),
		legalActionTemplates: z.array(CombatLegalActionTemplateSchema).min(1).max(128)
	})
	.strict()
	.superRefine((actorContext, context) => {
		for (const [path, values] of [
			['visibleCombatantIds', actorContext.visibleCombatantIds],
			['visibleTelegraphIds', actorContext.visibleTelegraphIds],
			['observableReadinessActorIds', actorContext.observableReadinessActorIds],
			['visibleTerrainFeatureIds', actorContext.visibleTerrainFeatureIds]
		] as const) {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', path: [path], message: `${path} must be unique` });
			}
		}
		const positionKeys = actorContext.visiblePositions.map(
			(position) => `${position.x}:${position.y}`
		);
		if (new Set(positionKeys).size !== positionKeys.length) {
			context.addIssue({
				code: 'custom',
				path: ['visiblePositions'],
				message: 'Visible positions must be unique'
			});
		}
		if (
			new Set(actorContext.relationships.map((relationship) => relationship.entityId)).size !==
			actorContext.relationships.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['relationships'],
				message: 'Actor relationships must be unique by entity'
			});
		}
		if (
			new Set(actorContext.legalActionTemplates.map((action) => action.actionId)).size !==
			actorContext.legalActionTemplates.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['legalActionTemplates'],
				message: 'Legal action template IDs must be unique'
			});
		}
	});

export const ObservableCombatConditionSchema = z
	.object({
		conditionId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		stacks: z.number().int().positive().max(1_000),
		remainingTicks: TickSchema.nullable(),
		publicLabel: z.string().trim().min(1).max(120)
	})
	.strict();

export const ActorSelfDecisionStateSchema = z
	.object({
		combatantId: EntityIdSchema,
		combatantKind: z.enum(['master', 'hero', 'monster']),
		teamId: TeamIdSchema,
		position: CombatPositionSchema,
		resources: CombatResourcesSchema,
		conditions: z.array(ObservableCombatConditionSchema).max(128),
		readiness: z
			.object({
				ready: z.boolean(),
				recoveryTicksRemaining: TickSchema
			})
			.strict(),
		downed: z.boolean(),
		active: z.boolean()
	})
	.strict();

export const VisibleCombatantDecisionStateSchema = z
	.object({
		combatantId: EntityIdSchema,
		combatantKind: z.enum(['master', 'hero', 'monster']),
		teamId: TeamIdSchema,
		position: CombatPositionSchema,
		resources: CombatResourcesSchema,
		conditions: z.array(ObservableCombatConditionSchema).max(128),
		readinessStatus: z.enum(['ready', 'recovering', 'unknown']),
		downed: z.boolean(),
		active: z.boolean()
	})
	.strict();

export const ActorDecisionViewSchema = z
	.object({
		viewVersion: z.literal('actor-decision-view-v1'),
		windowId: EntityIdSchema,
		actorId: EntityIdSchema,
		snapshotHash: StateHashSchema,
		actorViewHash: StateHashSchema,
		legalActionSetHash: StateHashSchema,
		self: ActorSelfDecisionStateSchema,
		visibleCombatants: z.array(VisibleCombatantDecisionStateSchema).max(128),
		visibleTerrain: CombatTerrainSchema,
		visibleTelegraphs: z.array(CombatTelegraphSchema).max(1_000),
		rememberedContext: z.array(BoundedTextSchema).max(32),
		doctrine: z.array(BoundedTextSchema).max(32),
		relationships: z
			.array(z.object({ entityId: EntityIdSchema, publicSummary: BoundedTextSchema }).strict())
			.max(128),
		masterDirections: z.array(BoundedTextSchema).max(32),
		legalActions: z.array(CombatLegalActionSchema).min(1).max(128)
	})
	.strict()
	.superRefine((view, context) => {
		if (view.self.combatantId !== view.actorId) {
			context.addIssue({
				code: 'custom',
				path: ['self'],
				message: 'Actor view self must match its actor'
			});
		}
		if (
			new Set(view.legalActions.map((action) => action.actionId)).size !== view.legalActions.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['legalActions'],
				message: 'Legal action IDs must be unique'
			});
		}
	});

export const CombatActionIntentSchema = z
	.object({
		windowId: EntityIdSchema,
		attemptId: EntityIdSchema,
		tick: TickSchema,
		actorId: EntityIdSchema,
		snapshotHash: StateHashSchema,
		actorViewHash: StateHashSchema,
		legalActionSetHash: StateHashSchema,
		actionId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		target: CombatTargetSelectionSchema,
		fallbackId: z
			.string()
			.regex(/^[a-z][a-z0-9-]{0,79}$/u)
			.nullable(),
		publicIntent: BoundedTextSchema.optional()
	})
	.strict();

export const CombatChoiceBatchV1Schema = z
	.object({
		batchVersion: CombatChoiceBatchVersionSchema,
		batchId: EntityIdSchema,
		windowId: EntityIdSchema,
		attemptId: EntityIdSchema,
		tick: TickSchema,
		snapshotHash: StateHashSchema,
		choices: z.array(CombatActionIntentSchema).min(1).max(128),
		batchHash: StateHashSchema
	})
	.strict()
	.superRefine((batch, context) => {
		if (new Set(batch.choices.map((choice) => choice.actorId)).size !== batch.choices.length) {
			context.addIssue({
				code: 'custom',
				path: ['choices'],
				message: 'A batch may contain one choice per actor'
			});
		}
		for (const choice of batch.choices) {
			if (
				choice.attemptId !== batch.attemptId ||
				choice.windowId !== batch.windowId ||
				choice.tick !== batch.tick ||
				choice.snapshotHash !== batch.snapshotHash
			) {
				context.addIssue({
					code: 'custom',
					path: ['choices'],
					message: 'Every choice must bind to the batch window'
				});
			}
		}
	});

export const CombatResolvedEffectSchema = z.discriminatedUnion('kind', [
	z
		.object({
			kind: z.literal('resource'),
			combatantId: EntityIdSchema,
			resource: z.enum(['health', 'mana']),
			before: z.number().int().nonnegative(),
			after: z.number().int().nonnegative(),
			delta: z.number().int()
		})
		.strict()
		.refine((effect) => effect.after - effect.before === effect.delta, {
			message: 'Resource delta is inconsistent'
		}),
	z
		.object({
			kind: z.literal('position'),
			combatantId: EntityIdSchema,
			before: CombatPositionSchema,
			after: CombatPositionSchema
		})
		.strict(),
	z
		.object({
			kind: z.literal('condition'),
			combatantId: EntityIdSchema,
			operation: z.enum(['applied', 'removed']),
			condition: CombatConditionSchema
		})
		.strict(),
	z.object({ kind: z.literal('downed'), combatantId: EntityIdSchema }).strict()
]);

export const CombatResolvedEventSchema = z
	.object({
		eventVersion: z.literal('combat-resolved-event-v1'),
		eventId: EntityIdSchema,
		attemptId: EntityIdSchema,
		windowId: EntityIdSchema,
		tick: TickSchema,
		actorId: EntityIdSchema,
		actionId: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u),
		snapshotHash: StateHashSchema,
		actorViewHash: StateHashSchema,
		legalActionSetHash: StateHashSchema,
		originalIntent: CombatActionIntentSchema,
		conflictingEventId: EntityIdSchema.nullable(),
		fallbackApplied: CombatFallbackOptionSchema.nullable(),
		finalOutcome: z.enum(['applied', 'superseded', 'canceled']),
		effects: z.array(CombatResolvedEffectSchema).max(256)
	})
	.strict()
	.superRefine((event, context) => {
		const intent = event.originalIntent;
		if (
			intent.attemptId !== event.attemptId ||
			intent.windowId !== event.windowId ||
			intent.tick !== event.tick ||
			intent.actorId !== event.actorId ||
			intent.actionId !== event.actionId ||
			intent.snapshotHash !== event.snapshotHash ||
			intent.actorViewHash !== event.actorViewHash ||
			intent.legalActionSetHash !== event.legalActionSetHash
		) {
			context.addIssue({
				code: 'custom',
				path: ['originalIntent'],
				message: 'Resolved event must bind to its original intent'
			});
		}
	});

export const CombatSafetyCountersSchema = z
	.object({
		ticksAdvanced: z.number().int().nonnegative(),
		eventsEmitted: z.number().int().nonnegative(),
		noProgressCycles: z.number().int().nonnegative()
	})
	.strict();

export const CombatSafetyStopSchema = CombatSafetyCountersSchema.extend({
	safetyStopVersion: z.literal('combat-safety-stop-v1'),
	reason: z.enum([
		'total-ticks',
		'emitted-events',
		'no-progress-cycles',
		'provider-budget',
		'invalid-state',
		'arithmetic-overflow',
		'invalid-scheduled-effect'
	]),
	disposition: z.enum(['stalemate', 'forced-retreat', 'diagnostic'])
}).strict();

const CombatClaimBaseSchema = z
	.object({
		claimVersion: z.literal('combat-claim-v1'),
		claimId: EntityIdSchema,
		idempotencyKey: z.string().trim().min(1).max(240)
	})
	.strict();

export const CombatClaimSchema = z.discriminatedUnion('claimType', [
	CombatClaimBaseSchema.extend({
		claimType: z.literal('final-resource'),
		combatantId: EntityIdSchema,
		resource: z.enum(['health', 'mana']),
		value: z.number().int().nonnegative()
	}).strict(),
	CombatClaimBaseSchema.extend({
		claimType: z.literal('harm'),
		heroId: EntityIdSchema,
		damageTaken: z.number().int().nonnegative(),
		downed: z.boolean()
	}).strict(),
	CombatClaimBaseSchema.extend({
		claimType: z.literal('recovery'),
		heroId: EntityIdSchema,
		minimumSafeHealth: z.number().int().positive()
	}).strict(),
	CombatClaimBaseSchema.extend({
		claimType: z.literal('skill-practice'),
		heroId: EntityIdSchema,
		skillId: CombatSkillIdSchema,
		practiceEvidence: z.number().int().nonnegative()
	}).strict(),
	CombatClaimBaseSchema.extend({
		claimType: z.literal('loot'),
		ownerId: EntityIdSchema,
		lootId: z.string().trim().min(1).max(120),
		quantity: z.number().int().positive()
	}).strict(),
	CombatClaimBaseSchema.extend({
		claimType: z.literal('objective'),
		objectiveId: z.string().trim().min(1).max(120),
		completed: z.boolean()
	}).strict(),
	CombatClaimBaseSchema.extend({
		claimType: z.literal('attempt-outcome'),
		outcome: z.enum(['victory', 'extraction', 'retreat', 'party-downed', 'deadline', 'safety-stop'])
	}).strict()
]);

export const CombatResultSchema = z
	.object({
		resultVersion: CombatResultVersionSchema,
		resultId: EntityIdSchema,
		attemptId: EntityIdSchema,
		modeId: z.enum(['legacy-auto-v1', 'agent-readiness-v1']),
		rulesVersion: CombatRulesVersionSchema,
		outcome: z.enum([
			'victory',
			'extraction',
			'retreat',
			'party-downed',
			'deadline',
			'safety-stop'
		]),
		endedAtTick: TickSchema,
		finalCombatants: z.record(EntityIdSchema, CombatantStateSchema),
		claims: z.array(CombatClaimSchema).max(10_000),
		decisiveEventIds: z.array(EntityIdSchema).max(1_000),
		safetyStop: CombatSafetyStopSchema.nullable(),
		traceHash: StateHashSchema
	})
	.strict()
	.superRefine((result, context) => {
		if ((result.outcome === 'safety-stop') !== (result.safetyStop !== null)) {
			context.addIssue({
				code: 'custom',
				path: ['safetyStop'],
				message: 'Safety-stop details must match the result outcome'
			});
		}
		if (new Set(result.claims.map((claim) => claim.idempotencyKey)).size !== result.claims.length) {
			context.addIssue({
				code: 'custom',
				path: ['claims'],
				message: 'Combat claim idempotency keys must be unique'
			});
		}
		validateCombatantDamageClocks(result.finalCombatants, result.endedAtTick, context);
	});

export const ScheduledCombatEffectSchema = z
	.object({
		scheduledEffectId: EntityIdSchema,
		resolvesAtTick: TickSchema,
		sourceCombatantId: EntityIdSchema,
		effects: z.array(CombatResolvedEffectSchema).min(1).max(256)
	})
	.strict();

function structurallyEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((value, index) => structurallyEqual(value, right[index]))
		);
	}
	if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
		return false;
	}
	const leftRecord = left as Record<string, unknown>;
	const rightRecord = right as Record<string, unknown>;
	const leftKeys = Object.keys(leftRecord).sort();
	const rightKeys = Object.keys(rightRecord).sort();
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every(
			(key, index) =>
				key === rightKeys[index] && structurallyEqual(leftRecord[key], rightRecord[key])
		)
	);
}

function positionKey(position: z.infer<typeof CombatPositionSchema>): string {
	return `${position.x}:${position.y}`;
}

function validateActorContexts(
	state: {
		combatants: Record<string, z.infer<typeof CombatantStateSchema>>;
		actorContexts: Record<string, z.infer<typeof CombatActorContextStateSchema>>;
		terrain: z.infer<typeof CombatTerrainSchema>;
		visibleTelegraphs: z.infer<typeof CombatTelegraphSchema>[];
	},
	context: z.RefinementCtx
): void {
	const telegraphs = new Map(
		state.visibleTelegraphs.map((telegraph) => [telegraph.telegraphId, telegraph])
	);
	const features = new Map(state.terrain.features.map((feature) => [feature.featureId, feature]));
	const blockedPositions = new Set(state.terrain.blockedTiles.map(positionKey));
	const occupiedPositions = new Map(
		Object.values(state.combatants).map((combatant) => [
			positionKey(combatant.position),
			combatant.combatantId
		])
	);
	for (const [actorId, actorContext] of Object.entries(state.actorContexts)) {
		const issue = (path: PropertyKey[], message: string): void => {
			context.addIssue({ code: 'custom', path: ['actorContexts', actorId, ...path], message });
		};
		const actor = state.combatants[actorId];
		if (!actor || actorContext.actorId !== actorId) {
			issue(['actorId'], 'Actor context key and actor must match canonical combat state');
			continue;
		}
		const visibleIds = new Set(actorContext.visibleCombatantIds);
		const visiblePositions = new Set(actorContext.visiblePositions.map(positionKey));
		if (!visiblePositions.has(positionKey(actor.position))) {
			issue(['visiblePositions'], 'Actor context must include its own visible position');
		}
		for (const [index, position] of actorContext.visiblePositions.entries()) {
			if (position.x >= state.terrain.width || position.y >= state.terrain.height) {
				issue(['visiblePositions', index], 'Visible position is outside the canonical arena');
			}
		}
		for (const [index, combatantId] of actorContext.visibleCombatantIds.entries()) {
			const combatant = state.combatants[combatantId];
			if (!combatant || combatantId === actorId) {
				issue(['visibleCombatantIds', index], 'Visible combatant must be another canonical actor');
			} else if (!visiblePositions.has(positionKey(combatant.position))) {
				issue(['visibleCombatantIds', index], 'Visible combatant position must be visible');
			}
		}
		for (const [index, combatantId] of actorContext.observableReadinessActorIds.entries()) {
			if (!visibleIds.has(combatantId)) {
				issue(
					['observableReadinessActorIds', index],
					'Observable readiness must belong to a visible combatant'
				);
			}
		}
		for (const [index, featureId] of actorContext.visibleTerrainFeatureIds.entries()) {
			const feature = features.get(featureId);
			if (!feature || !visiblePositions.has(positionKey(feature.position))) {
				issue(
					['visibleTerrainFeatureIds', index],
					'Visible terrain feature must exist at a visible position'
				);
			}
		}
		for (const [index, telegraphId] of actorContext.visibleTelegraphIds.entries()) {
			const telegraph = telegraphs.get(telegraphId);
			if (!telegraph) {
				issue(['visibleTelegraphIds', index], 'Visible telegraph must exist in canonical state');
				continue;
			}
			if (telegraph.sourceCombatantId !== actorId && !visibleIds.has(telegraph.sourceCombatantId)) {
				issue(['visibleTelegraphIds', index], 'Visible telegraph source must be visible');
			}
			if (
				(telegraph.target.kind === 'entity' ||
					telegraph.target.kind === 'entity-relative-position') &&
				telegraph.target.combatantId !== actorId &&
				!visibleIds.has(telegraph.target.combatantId)
			) {
				issue(['visibleTelegraphIds', index], 'Visible telegraph target must be visible');
			}
			if (
				telegraph.target.kind === 'tile' &&
				!visiblePositions.has(positionKey(telegraph.target.position))
			) {
				issue(['visibleTelegraphIds', index], 'Visible telegraph tile must be visible');
			}
		}
		for (const [index, relationship] of actorContext.relationships.entries()) {
			if (relationship.entityId !== actorId && !visibleIds.has(relationship.entityId)) {
				issue(['relationships', index], 'Actor relationship must concern a visible entity');
			}
		}

		const positionIsLegal = (
			position: z.infer<typeof CombatPositionSchema>,
			actionKind: z.infer<typeof CombatLegalActionTemplateSchema>['actionKind']
		): boolean => {
			const key = positionKey(position);
			if (
				position.x >= state.terrain.width ||
				position.y >= state.terrain.height ||
				!visiblePositions.has(key) ||
				blockedPositions.has(key)
			) {
				return false;
			}
			return actionKind !== 'move' || !occupiedPositions.has(key);
		};
		const entityIsLegal = (combatantId: string): boolean =>
			combatantId === actorId ||
			(visibleIds.has(combatantId) && Boolean(state.combatants[combatantId]));
		type RelativeRelation = 'adjacent' | 'behind' | 'flank-left' | 'flank-right';
		const relativePositionExists = (combatantId: string, relation: RelativeRelation): boolean => {
			const target = state.combatants[combatantId];
			if (!target) return false;
			const deltaX = target.position.x - actor.position.x;
			const deltaY = target.position.y - actor.position.y;
			const forward =
				Math.abs(deltaX) >= Math.abs(deltaY)
					? { x: Math.sign(deltaX) || 1, y: 0 }
					: { x: 0, y: Math.sign(deltaY) || 1 };
			const offsets =
				relation === 'adjacent'
					? [
							{ x: -1, y: 0 },
							{ x: 1, y: 0 },
							{ x: 0, y: -1 },
							{ x: 0, y: 1 }
						]
					: relation === 'behind'
						? [forward]
						: relation === 'flank-left'
							? [{ x: -forward.y, y: forward.x }]
							: [{ x: forward.y, y: -forward.x }];
			return offsets
				.map((offset) => ({
					x: target.position.x + offset.x,
					y: target.position.y + offset.y
				}))
				.some(
					(position) => position.x >= 0 && position.y >= 0 && positionIsLegal(position, 'move')
				);
		};
		for (const [actionIndex, action] of actorContext.legalActionTemplates.entries()) {
			const actionPath = ['legalActionTemplates', actionIndex] as const;
			if (action.targetContract.kind === 'entity') {
				if (
					new Set(action.targetContract.allowedCombatantIds).size !==
						action.targetContract.allowedCombatantIds.length ||
					action.targetContract.allowedCombatantIds.some((id) => !entityIsLegal(id))
				) {
					issue([...actionPath, 'targetContract'], 'Entity targets must be unique and visible');
				}
			} else if (action.targetContract.kind === 'tile') {
				const keys = action.targetContract.allowedPositions.map(positionKey);
				if (
					new Set(keys).size !== keys.length ||
					action.targetContract.allowedPositions.some(
						(position) => !positionIsLegal(position, action.actionKind)
					)
				) {
					issue(
						[...actionPath, 'targetContract'],
						'Tile targets must be unique, visible, and legal'
					);
				}
			} else if (action.targetContract.kind === 'entity-relative-position') {
				const allowedRelations = action.targetContract.allowedRelations;
				if (
					new Set(action.targetContract.allowedCombatantIds).size !==
						action.targetContract.allowedCombatantIds.length ||
					new Set(action.targetContract.allowedRelations).size !==
						action.targetContract.allowedRelations.length ||
					action.targetContract.allowedCombatantIds.some(
						(id) =>
							!entityIsLegal(id) ||
							allowedRelations.some((relation) => !relativePositionExists(id, relation))
					)
				) {
					issue(
						[...actionPath, 'targetContract'],
						'Relative targets require unique visible entities and a visible legal destination'
					);
				}
			}
			for (const [fallbackIndex, fallback] of action.fallbackOptions.entries()) {
				const target = fallback.target;
				const valid =
					target.kind === 'self' ||
					(target.kind === 'entity' && entityIsLegal(target.combatantId)) ||
					(target.kind === 'tile' && positionIsLegal(target.position, action.actionKind)) ||
					(target.kind === 'entity-relative-position' &&
						entityIsLegal(target.combatantId) &&
						relativePositionExists(target.combatantId, target.relation));
				if (!valid) {
					issue(
						[...actionPath, 'fallbackOptions', fallbackIndex, 'target'],
						'Fallback target must be visible and legal'
					);
				}
			}
		}
	}
}

export const ReadinessCombatStateV1Schema = z
	.object({
		stateVersion: ReadinessCombatStateVersionSchema,
		seed: StateHashSchema,
		attemptId: EntityIdSchema,
		tick: TickSchema,
		combatants: z.record(EntityIdSchema, CombatantStateSchema),
		actorContexts: z.record(EntityIdSchema, CombatActorContextStateSchema),
		terrain: CombatTerrainSchema,
		visibleTelegraphs: z.array(CombatTelegraphSchema).max(1_000),
		scheduledEffects: z.array(ScheduledCombatEffectSchema).max(10_000),
		safety: CombatSafetyCountersSchema,
		status: z.enum(['active', 'complete']),
		result: CombatResultSchema.nullable()
	})
	.strict()
	.superRefine((state, context) => {
		validateCombatantMap(state.combatants, state.terrain, context, state.tick);
		validateActorContexts(state, context);
		if (
			new Set(state.visibleTelegraphs.map((telegraph) => telegraph.telegraphId)).size !==
			state.visibleTelegraphs.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['visibleTelegraphs'],
				message: 'Visible combat telegraphs must be unique'
			});
		}
		if (
			new Set(state.scheduledEffects.map((effect) => effect.scheduledEffectId)).size !==
			state.scheduledEffects.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['scheduledEffects'],
				message: 'Scheduled combat effects must be unique'
			});
		}
		if ((state.status === 'complete') !== (state.result !== null)) {
			context.addIssue({
				code: 'custom',
				path: ['result'],
				message: 'Only a complete combat state has a result'
			});
		}
		if (state.result !== null && state.result.attemptId !== state.attemptId) {
			context.addIssue({
				code: 'custom',
				path: ['result'],
				message: 'Combat result must belong to the state attempt'
			});
		}
		if (state.result !== null && state.result.modeId !== 'agent-readiness-v1') {
			context.addIssue({
				code: 'custom',
				path: ['result', 'modeId'],
				message: 'Readiness combat state requires an agent-readiness result'
			});
		}
		if (state.result !== null && state.result.endedAtTick !== state.tick) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'endedAtTick'],
				message: 'Combat result end tick must match the completed readiness state tick'
			});
		}
		if (
			state.result !== null &&
			!structurallyEqual(state.combatants, state.result.finalCombatants)
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'finalCombatants'],
				message: 'Completed-state combatants must match the combat result final combatants'
			});
		}
	});

function validateCombatantMap(
	combatants: Record<string, z.infer<typeof CombatantStateSchema>>,
	terrain: z.infer<typeof CombatTerrainSchema>,
	context: z.RefinementCtx,
	currentTick: number
): void {
	for (const [combatantId, combatant] of Object.entries(combatants)) {
		if (combatant.combatantId !== combatantId) {
			context.addIssue({
				code: 'custom',
				path: ['combatants', combatantId],
				message: 'Combatant map key must match its id'
			});
		}
		if (combatant.position.x >= terrain.width || combatant.position.y >= terrain.height) {
			context.addIssue({
				code: 'custom',
				path: ['combatants', combatantId, 'position'],
				message: 'Combatant position is outside the arena'
			});
		}
	}
	validateCombatantDamageClocks(combatants, currentTick, context);
}

function validateCombatantDamageClocks(
	combatants: Record<string, z.infer<typeof CombatantStateSchema>>,
	currentTick: number,
	context: z.RefinementCtx
): void {
	for (const [combatantId, combatant] of Object.entries(combatants)) {
		if (combatant.lastDamagedAtTick !== null && combatant.lastDamagedAtTick > currentTick) {
			context.addIssue({
				code: 'custom',
				path: ['combatants', combatantId, 'lastDamagedAtTick'],
				message: 'Last-damaged tick cannot be in the future'
			});
		}
	}
}

export const CombatAdvanceSchema = z
	.discriminatedUnion('kind', [
		z
			.object({
				kind: z.literal('decision-window'),
				snapshot: CombatWindowSnapshotSchema,
				views: z.array(ActorDecisionViewSchema).min(1).max(128)
			})
			.strict(),
		z.object({ kind: z.literal('combat-result'), result: CombatResultSchema }).strict()
	])
	.superRefine((advance, context) => {
		if (advance.kind !== 'decision-window') return;
		const readyActorIds = new Set(advance.snapshot.readyActorIds);
		const viewActorIds = new Set(advance.views.map((view) => view.actorId));
		if (
			viewActorIds.size !== advance.views.length ||
			viewActorIds.size !== readyActorIds.size ||
			[...readyActorIds].some((actorId) => !viewActorIds.has(actorId))
		) {
			context.addIssue({
				code: 'custom',
				path: ['views'],
				message: 'Decision windows require one distinct view for every ready actor'
			});
		}
		for (const view of advance.views) {
			if (
				view.windowId !== advance.snapshot.windowId ||
				view.snapshotHash !== advance.snapshot.snapshotHash ||
				!readyActorIds.has(view.actorId)
			) {
				context.addIssue({
					code: 'custom',
					path: ['views'],
					message: 'Every actor view must bind to the decision snapshot'
				});
			}
		}
	});

export type ActorDecisionView = z.infer<typeof ActorDecisionViewSchema>;
export type ActorSelfDecisionState = z.infer<typeof ActorSelfDecisionStateSchema>;
export type CombatActorContextState = z.infer<typeof CombatActorContextStateSchema>;
export type CombatActionIntent = z.infer<typeof CombatActionIntentSchema>;
export type CombatAdvance = z.infer<typeof CombatAdvanceSchema>;
export type CombatChoiceBatchV1 = z.infer<typeof CombatChoiceBatchV1Schema>;
export type CombatClaim = z.infer<typeof CombatClaimSchema>;
export type CombatLegalAction = z.infer<typeof CombatLegalActionSchema>;
export type CombatLegalActionTemplate = z.infer<typeof CombatLegalActionTemplateSchema>;
export type CombatResolvedEvent = z.infer<typeof CombatResolvedEventSchema>;
export type CombatResult = z.infer<typeof CombatResultSchema>;
export type CombatSafetyStop = z.infer<typeof CombatSafetyStopSchema>;
export type CombatWindowSnapshot = z.infer<typeof CombatWindowSnapshotSchema>;
export type ReadinessCombatStateV1 = z.infer<typeof ReadinessCombatStateV1Schema>;
export type VisibleCombatantDecisionState = z.infer<typeof VisibleCombatantDecisionStateSchema>;

export type AdvanceUntilDecision = (
	state: ReadinessCombatStateV1,
	rules: CombatRulesV1
) => CombatAdvance;

export type ApplyChoiceBatch = (
	state: ReadinessCombatStateV1,
	batch: CombatChoiceBatchV1,
	rules: CombatRulesV1
) => { state: ReadinessCombatStateV1; events: CombatResolvedEvent[] };

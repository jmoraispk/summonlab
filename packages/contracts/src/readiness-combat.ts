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
	.strict();

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
		validateCombatantMap(snapshot.combatants, snapshot.terrain, context, snapshot.tick);
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
	reason: z.enum(['total-ticks', 'emitted-events', 'no-progress-cycles', 'provider-budget']),
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

export const ReadinessCombatStateV1Schema = z
	.object({
		stateVersion: ReadinessCombatStateVersionSchema,
		seed: StateHashSchema,
		attemptId: EntityIdSchema,
		tick: TickSchema,
		combatants: z.record(EntityIdSchema, CombatantStateSchema),
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
export type CombatActionIntent = z.infer<typeof CombatActionIntentSchema>;
export type CombatAdvance = z.infer<typeof CombatAdvanceSchema>;
export type CombatChoiceBatchV1 = z.infer<typeof CombatChoiceBatchV1Schema>;
export type CombatClaim = z.infer<typeof CombatClaimSchema>;
export type CombatLegalAction = z.infer<typeof CombatLegalActionSchema>;
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

import { z } from 'zod';

import {
	ActionSourceSchema,
	DecisionTimingSchema,
	FallbackPolicySchema
} from '../event.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from '../shared.js';

export const MasterDecisionExpiryOutcomeSchema = z.enum([
	'not-applicable',
	'manual-before-expiry',
	'expired-to-fallback',
	'immediate-fallback',
	'paused',
	'mission-ended'
]);

export const MasterDecisionWindowSchema = z
	.object({
		decisionId: EntityIdSchema,
		ordinal: z.number().int().positive(),
		timing: DecisionTimingSchema,
		openedAt: IsoDateTimeSchema,
		expiresAt: IsoDateTimeSchema.nullable()
	})
	.strict()
	.superRefine((window, context) => {
		if ((window.timing === 'countdown') !== (window.expiresAt !== null)) {
			context.addIssue({ code: 'custom', message: 'Only Countdown decisions have a deadline' });
		}
		if (window.expiresAt && Date.parse(window.expiresAt) <= Date.parse(window.openedAt)) {
			context.addIssue({ code: 'custom', message: 'Decision deadline must follow its opening' });
		}
	});

export const MasterDecisionResolutionSchema = z
	.object({
		decisionId: EntityIdSchema,
		ordinal: z.number().int().positive(),
		timing: DecisionTimingSchema,
		openedAt: IsoDateTimeSchema,
		expiresAt: IsoDateTimeSchema.nullable(),
		resolvedAt: IsoDateTimeSchema,
		outcome: z.enum(['manual', 'fallback', 'paused', 'mission-ended']),
		expiryOutcome: MasterDecisionExpiryOutcomeSchema,
		resolvedActionId: z
			.string()
			.regex(/^[a-z][a-z0-9._-]{1,79}$/u)
			.nullable(),
		source: ActionSourceSchema
	})
	.strict()
	.superRefine((resolution, context) => {
		if (Date.parse(resolution.resolvedAt) < Date.parse(resolution.openedAt)) {
			context.addIssue({ code: 'custom', message: 'Decision cannot resolve before it opens' });
		}
		if (
			['manual', 'fallback'].includes(resolution.outcome) !==
			(resolution.resolvedActionId !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Only resolved decisions bind an action' });
		}
		if (resolution.source.timing !== resolution.timing && resolution.outcome !== 'mission-ended') {
			context.addIssue({ code: 'custom', message: 'Decision source timing must match its window' });
		}
		const expectedExpiry =
			resolution.outcome === 'paused'
				? 'paused'
				: resolution.outcome === 'mission-ended'
					? 'mission-ended'
					: resolution.outcome === 'manual' && resolution.timing === 'countdown'
						? 'manual-before-expiry'
						: resolution.outcome === 'fallback' && resolution.timing === 'countdown'
							? 'expired-to-fallback'
							: resolution.outcome === 'fallback'
								? 'immediate-fallback'
								: 'not-applicable';
		if (resolution.expiryOutcome !== expectedExpiry) {
			context.addIssue({ code: 'custom', message: 'Decision expiry outcome is inconsistent' });
		}
	});

export const MasterControlStateSchema = z
	.object({
		timing: DecisionTimingSchema,
		countdownSeconds: z.number().int().min(1).max(60),
		revision: z.number().int().nonnegative(),
		decisionOrdinal: z.number().int().nonnegative(),
		activeDecision: MasterDecisionWindowSchema.nullable(),
		lastResolution: MasterDecisionResolutionSchema.nullable()
	})
	.strict()
	.superRefine((control, context) => {
		if (
			control.activeDecision &&
			(control.activeDecision.timing !== control.timing ||
				control.activeDecision.ordinal !== control.decisionOrdinal)
		) {
			context.addIssue({ code: 'custom', message: 'Active decision must match control timing' });
		}
		if (control.lastResolution && control.lastResolution.ordinal > control.decisionOrdinal) {
			context.addIssue({
				code: 'custom',
				message: 'Decision resolution exceeds the control cursor'
			});
		}
	});

export const MasterFallbackPrioritySchema = z.enum([
	'protect-self',
	'protect-party',
	'focus-objective',
	'seek-secrets',
	'conserve-resources'
]);

export const MasterFallbackSafetyStopsSchema = z
	.object({
		beforeIrreversibleAction: z.boolean(),
		masterHealthThreshold: z.number().int().min(1).max(100).nullable(),
		whenUnclassified: z.boolean(),
		maximumConsecutiveFallbacks: z.number().int().min(1).max(48).nullable()
	})
	.strict();

export const MasterFallbackConfigurationSchema = z
	.object({
		configurationVersion: z.literal('master-fallback-v1'),
		policy: FallbackPolicySchema,
		directionId: EntityIdSchema,
		directionText: z.string().min(1).max(600),
		priorities: z.array(MasterFallbackPrioritySchema).max(5),
		protectedHeroId: EntityIdSchema.nullable(),
		safetyStops: MasterFallbackSafetyStopsSchema,
		configuredAt: IsoDateTimeSchema
	})
	.strict()
	.superRefine((configuration, context) => {
		if (new Set(configuration.priorities).size !== configuration.priorities.length) {
			context.addIssue({ code: 'custom', message: 'Fallback priorities must be unique' });
		}
	});

export const MasterSafetyStopReasonSchema = z.enum([
	'irreversible-action',
	'master-health',
	'unclassified-state',
	'fallback-limit'
]);

export const MasterFallbackSelectionSchema = z
	.object({
		selectionVersion: z.literal('master-fallback-selection-v1'),
		policyId: z.enum(['master-directed-v1', 'master-random-v1']),
		policy: FallbackPolicySchema,
		decisionId: EntityIdSchema,
		directionId: EntityIdSchema,
		classification: z.enum(['classified', 'unclassified']),
		selectedActionId: z
			.string()
			.regex(/^[a-z][a-z0-9._-]{1,79}$/u)
			.nullable(),
		selectedScore: z.number().int().nullable(),
		consideredActionIds: z
			.array(z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u))
			.min(1)
			.max(64),
		packetHash: StateHashSchema,
		legalActionHash: StateHashSchema,
		tieBreakHash: StateHashSchema,
		policyResultHash: StateHashSchema,
		safetyStopReason: MasterSafetyStopReasonSchema.nullable(),
		explanation: z.string().min(1).max(300)
	})
	.strict()
	.superRefine((selection, context) => {
		if (selection.policy === 'directed' && selection.policyId !== 'master-directed-v1') {
			context.addIssue({ code: 'custom', message: 'Directed selection requires its policy id' });
		}
		if (selection.policy === 'random' && selection.policyId !== 'master-random-v1') {
			context.addIssue({ code: 'custom', message: 'Random selection requires its policy id' });
		}
		if (
			(selection.selectedActionId === null) !== (selection.selectedScore === null) ||
			(selection.safetyStopReason === null && selection.selectedActionId === null) ||
			(selection.safetyStopReason === 'unclassified-state' &&
				selection.classification !== 'unclassified')
		) {
			context.addIssue({ code: 'custom', message: 'Fallback selection outcome is inconsistent' });
		}
	});

export const MasterDecisionWindowV2Schema = MasterDecisionWindowSchema.safeExtend({
	fallback: MasterFallbackConfigurationSchema
}).strict();

export const MasterDecisionResolutionV2Schema = z
	.object({
		decisionId: EntityIdSchema,
		ordinal: z.number().int().positive(),
		timing: DecisionTimingSchema,
		openedAt: IsoDateTimeSchema,
		expiresAt: IsoDateTimeSchema.nullable(),
		fallback: MasterFallbackConfigurationSchema,
		resolvedAt: IsoDateTimeSchema,
		outcome: z.enum(['manual', 'fallback', 'paused', 'mission-ended', 'safety-stopped']),
		expiryOutcome: z.enum([
			'not-applicable',
			'manual-before-expiry',
			'expired-to-fallback',
			'immediate-fallback',
			'paused',
			'mission-ended',
			'safety-stopped'
		]),
		resolvedActionId: z
			.string()
			.regex(/^[a-z][a-z0-9._-]{1,79}$/u)
			.nullable(),
		source: ActionSourceSchema,
		fallbackSelection: MasterFallbackSelectionSchema.nullable()
	})
	.strict()
	.superRefine((resolution, context) => {
		if (Date.parse(resolution.resolvedAt) < Date.parse(resolution.openedAt)) {
			context.addIssue({ code: 'custom', message: 'Decision cannot resolve before it opens' });
		}
		if (
			['manual', 'fallback'].includes(resolution.outcome) !==
			(resolution.resolvedActionId !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Only resolved decisions bind an action' });
		}
		if (resolution.source.timing !== resolution.timing && resolution.outcome !== 'mission-ended') {
			context.addIssue({ code: 'custom', message: 'Decision source timing must match its window' });
		}
		const expectedExpiry =
			resolution.outcome === 'paused'
				? 'paused'
				: resolution.outcome === 'mission-ended'
					? 'mission-ended'
					: resolution.outcome === 'safety-stopped'
						? 'safety-stopped'
						: resolution.outcome === 'manual' && resolution.timing === 'countdown'
							? 'manual-before-expiry'
							: resolution.outcome === 'fallback' && resolution.timing === 'countdown'
								? 'expired-to-fallback'
								: resolution.outcome === 'fallback'
									? 'immediate-fallback'
									: 'not-applicable';
		if (resolution.expiryOutcome !== expectedExpiry) {
			context.addIssue({ code: 'custom', message: 'Decision expiry outcome is inconsistent' });
		}
		const needsSelection =
			resolution.outcome === 'fallback' || resolution.outcome === 'safety-stopped';
		if (needsSelection !== (resolution.fallbackSelection !== null)) {
			context.addIssue({ code: 'custom', message: 'Fallback evidence is missing or unexpected' });
		}
		if (
			resolution.fallbackSelection &&
			(resolution.fallbackSelection.decisionId !== resolution.decisionId ||
				resolution.fallbackSelection.directionId !== resolution.fallback.directionId ||
				resolution.fallbackSelection.policy !== resolution.fallback.policy ||
				resolution.source.fallbackPolicy !== resolution.fallback.policy)
		) {
			context.addIssue({ code: 'custom', message: 'Fallback evidence diverged from its snapshot' });
		}
	});

export const MasterControlStateV2Schema = z
	.object({
		timing: DecisionTimingSchema,
		countdownSeconds: z.number().int().min(1).max(60),
		revision: z.number().int().nonnegative(),
		decisionOrdinal: z.number().int().nonnegative(),
		activeDecision: MasterDecisionWindowV2Schema.nullable(),
		lastResolution: MasterDecisionResolutionV2Schema.nullable(),
		fallback: MasterFallbackConfigurationSchema,
		consecutiveFallbacks: z.number().int().nonnegative().max(48)
	})
	.strict()
	.superRefine((control, context) => {
		if (
			control.activeDecision &&
			(control.activeDecision.timing !== control.timing ||
				control.activeDecision.ordinal !== control.decisionOrdinal ||
				control.activeDecision.fallback.directionId !== control.fallback.directionId ||
				control.activeDecision.fallback.configuredAt !== control.fallback.configuredAt)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Active decision must match control configuration'
			});
		}
		if (control.lastResolution && control.lastResolution.ordinal > control.decisionOrdinal) {
			context.addIssue({
				code: 'custom',
				message: 'Decision resolution exceeds the control cursor'
			});
		}
	});

export type MasterControlState = z.infer<typeof MasterControlStateSchema>;
export type MasterControlStateV2 = z.infer<typeof MasterControlStateV2Schema>;
export type MasterDecisionResolution = z.infer<typeof MasterDecisionResolutionSchema>;
export type MasterDecisionResolutionV2 = z.infer<typeof MasterDecisionResolutionV2Schema>;
export type MasterDecisionWindow = z.infer<typeof MasterDecisionWindowSchema>;
export type MasterFallbackConfiguration = z.infer<typeof MasterFallbackConfigurationSchema>;
export type MasterFallbackSelection = z.infer<typeof MasterFallbackSelectionSchema>;
export type MasterFallbackPriority = z.infer<typeof MasterFallbackPrioritySchema>;
export type MasterFallbackSafetyStops = z.infer<typeof MasterFallbackSafetyStopsSchema>;

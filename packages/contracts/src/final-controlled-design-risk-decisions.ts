import { z } from 'zod';

import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

export const FinalControlledDesignRisks = [
	{
		riskId: 'death-knight-normal-legacy-design',
		coordinate: 'death-knight-normal-v4',
		sourceTargetId: 'affinity-workflow-v1-death-knight-normal',
		severity: 'blocking'
	},
	{
		riskId: 'death-knight-wood-overlay-design',
		coordinate: 'death-knight-wood-v4',
		sourceTargetId: 'affinity-workflow-v1-death-knight-wood',
		severity: 'blocking'
	},
	{
		riskId: 'death-knight-fire-overlay-design',
		coordinate: 'death-knight-fire-v4',
		sourceTargetId: 'affinity-workflow-v1-death-knight-fire',
		severity: 'blocking'
	},
	{
		riskId: 'death-knight-water-overlay-design',
		coordinate: 'death-knight-water-v4',
		sourceTargetId: 'affinity-workflow-v1-death-knight-water',
		severity: 'blocking'
	},
	{
		riskId: 'death-knight-wind-overlay-design',
		coordinate: 'death-knight-wind-v4',
		sourceTargetId: 'affinity-workflow-v1-death-knight-wind',
		severity: 'blocking'
	},
	{
		riskId: 'cave-bear-normal-paw-readability',
		coordinate: 'cave-bear-normal-v3',
		sourceTargetId: 'affinity-workflow-v1-cave-bear-normal',
		severity: 'blocking'
	},
	{
		riskId: 'cave-bear-wood-repeated-paw-readability',
		coordinate: 'cave-bear-wood-v3',
		sourceTargetId: 'affinity-workflow-v1-cave-bear-wood-v2',
		severity: 'blocking'
	},
	{
		riskId: 'cave-bear-wind-unresolved-paw-occlusion',
		coordinate: 'cave-bear-wind-v3',
		sourceTargetId: 'affinity-workflow-v1-cave-bear-wind-v2',
		severity: 'blocking'
	},
	{
		riskId: 'death-knight-metal-framing-and-scale',
		coordinate: 'death-knight-metal-v4',
		sourceTargetId: 'affinity-workflow-v1-death-knight-metal-v3',
		severity: 'risk'
	},
	{
		riskId: 'elemental-normal-material-ambiguity',
		coordinate: 'elemental-normal-v4',
		sourceTargetId: 'affinity-workflow-v1-elemental-normal-v2',
		severity: 'risk'
	},
	{
		riskId: 'elemental-water-solid-shell-ambiguity',
		coordinate: 'elemental-water-v4',
		sourceTargetId: 'affinity-workflow-v1-elemental-water-v2',
		severity: 'risk'
	},
	{
		riskId: 'elemental-wind-solid-shell-ambiguity',
		coordinate: 'elemental-wind-v4',
		sourceTargetId: 'affinity-workflow-v1-elemental-wind-v2',
		severity: 'risk'
	},
	{
		riskId: 'grey-wolf-normal-legacy-design',
		coordinate: 'grey-wolf-normal-v3',
		sourceTargetId: 'affinity-workflow-v1-grey-wolf-normal',
		severity: 'risk'
	},
	{
		riskId: 'elemental-wood-historical-v3-framing',
		coordinate: 'elemental-wood-v4',
		sourceTargetId: 'affinity-workflow-v1-elemental-wood-v2',
		severity: 'risk'
	},
	{
		riskId: 'grey-wolf-wood-historical-v3-framing',
		coordinate: 'grey-wolf-wood-v3',
		sourceTargetId: 'affinity-workflow-v1-grey-wolf-wood',
		severity: 'risk'
	},
	{
		riskId: 'grey-wolf-water-historical-v3-framing',
		coordinate: 'grey-wolf-water-v3',
		sourceTargetId: 'affinity-workflow-v1-grey-wolf-water',
		severity: 'risk'
	}
] as const;

export const FinalControlledDesignRiskIds = FinalControlledDesignRisks.map(
	(risk) => risk.riskId
) as [
	(typeof FinalControlledDesignRisks)[number]['riskId'],
	...(typeof FinalControlledDesignRisks)[number]['riskId'][]
];
export const FinalControlledDesignRiskCoordinates = FinalControlledDesignRisks.map(
	(risk) => risk.coordinate
) as [
	(typeof FinalControlledDesignRisks)[number]['coordinate'],
	...(typeof FinalControlledDesignRisks)[number]['coordinate'][]
];
export const FinalControlledDesignRiskSourceTargetIds = FinalControlledDesignRisks.map(
	(risk) => risk.sourceTargetId
) as [
	(typeof FinalControlledDesignRisks)[number]['sourceTargetId'],
	...(typeof FinalControlledDesignRisks)[number]['sourceTargetId'][]
];

export const FinalControlledDesignRiskHumanDecisionSchema = z
	.object({
		riskId: z.enum(FinalControlledDesignRiskIds),
		coordinate: z.enum(FinalControlledDesignRiskCoordinates),
		sourceTargetId: z.enum(FinalControlledDesignRiskSourceTargetIds),
		severity: z.enum(['blocking', 'risk']),
		decision: z.enum(['replace-derived-target', 'replace-reference', 'retain']),
		humanRationale: z.string().trim().min(1).max(2_000)
	})
	.strict()
	.superRefine((decision, context) => {
		const expected = FinalControlledDesignRisks.find((risk) => risk.riskId === decision.riskId);
		if (
			!expected ||
			decision.coordinate !== expected.coordinate ||
			decision.sourceTargetId !== expected.sourceTargetId ||
			decision.severity !== expected.severity
		) {
			context.addIssue({
				code: 'custom',
				message: 'Risk identity must match the exact plan-owned risk binding'
			});
		}
		if (decision.severity === 'blocking' && decision.decision === 'retain') {
			context.addIssue({
				code: 'custom',
				path: ['decision'],
				message: 'A blocking design risk cannot be retained'
			});
		}
	});

function exactOrderedRiskDecisions(
	decisions: readonly z.infer<typeof FinalControlledDesignRiskHumanDecisionSchema>[],
	context: z.RefinementCtx
): void {
	for (const [index, expected] of FinalControlledDesignRisks.entries()) {
		const actual = decisions[index];
		if (
			!actual ||
			actual.riskId !== expected.riskId ||
			actual.coordinate !== expected.coordinate ||
			actual.sourceTargetId !== expected.sourceTargetId ||
			actual.severity !== expected.severity
		) {
			context.addIssue({
				code: 'custom',
				path: ['decisions', index],
				message: 'Design-risk decisions must match the complete plan-owned order'
			});
		}
	}
}

export const FinalControlledDesignRiskDecisionScopeSchema = z
	.object({
		experimentId: z.literal('affinity-workflow-v1'),
		scopeId: z.literal('final-controlled-activation-v1')
	})
	.strict();

export const FinalControlledDesignRiskEvidenceBindingsSchema = z
	.object({
		planCanonicalSha256: StateHashSchema,
		catalogCanonicalSha256: StateHashSchema,
		executionSnapshotCanonicalSha256: StateHashSchema,
		blindReviewCollectionCanonicalSha256: StateHashSchema,
		sourceAuditCanonicalSha256: StateHashSchema
	})
	.strict();

const FinalControlledDesignRiskDecisionBaseSchema =
	FinalControlledDesignRiskDecisionScopeSchema.extend({
		decisionId: EntityIdSchema,
		mode: z.literal('human-interactive'),
		actor: z.string().trim().min(1).max(80),
		evidenceBindings: FinalControlledDesignRiskEvidenceBindingsSchema,
		supersedesDecisionId: EntityIdSchema.nullable(),
		decisions: z.array(FinalControlledDesignRiskHumanDecisionSchema).length(16),
		attestation: z
			.object({
				producerDidNotResolveRisks: z.literal(true),
				reviewedEligibleBlindEvidence: z.literal(true),
				reviewedCompleteSourceAudit: z.literal(true),
				deliberatelyResolvedAllRisks: z.literal(true),
				understandsActivationRequiresIndependentVerification: z.literal(true)
			})
			.strict()
	})
		.strict()
		.superRefine((value, context) => {
			exactOrderedRiskDecisions(value.decisions, context);
			if (value.supersedesDecisionId === value.decisionId) {
				context.addIssue({
					code: 'custom',
					path: ['supersedesDecisionId'],
					message: 'A decision cannot supersede itself'
				});
			}
		});

export const FinalControlledDesignRiskDecisionCreateRequestSchema =
	FinalControlledDesignRiskDecisionBaseSchema;

export const FinalControlledDesignRiskDecisionRecordSchema =
	FinalControlledDesignRiskDecisionBaseSchema.safeExtend({
		decidedAt: IsoDateTimeSchema
	});

export const FinalControlledDesignRiskDecisionListSchema = z
	.object({
		experimentId: z.literal('affinity-workflow-v1'),
		scopeId: z.literal('final-controlled-activation-v1'),
		records: z.array(FinalControlledDesignRiskDecisionRecordSchema),
		latestByActor: z.array(FinalControlledDesignRiskDecisionRecordSchema)
	})
	.strict()
	.superRefine((value, context) => {
		const byId = new Map(value.records.map((record) => [record.decisionId, record]));
		if (byId.size !== value.records.length) {
			context.addIssue({
				code: 'custom',
				path: ['records'],
				message: 'Decision IDs must be unique'
			});
		}
		const superseded = new Set<string>();
		for (const [recordIndex, record] of value.records.entries()) {
			if (record.experimentId !== value.experimentId || record.scopeId !== value.scopeId) {
				context.addIssue({
					code: 'custom',
					path: ['records'],
					message: 'Decision belongs to another scope'
				});
			}
			if (record.supersedesDecisionId) {
				const previous = byId.get(record.supersedesDecisionId);
				const previousIndex = value.records.findIndex(
					(candidate) => candidate.decisionId === record.supersedesDecisionId
				);
				if (
					!previous ||
					previous.actor !== record.actor ||
					previousIndex >= recordIndex ||
					Date.parse(previous.decidedAt) > Date.parse(record.decidedAt)
				) {
					context.addIssue({
						code: 'custom',
						path: ['records'],
						message: 'Supersession must reference an earlier decision by the same actor'
					});
				}
				if (superseded.has(record.supersedesDecisionId)) {
					context.addIssue({
						code: 'custom',
						path: ['records'],
						message: 'A decision can be superseded only once'
					});
				}
				superseded.add(record.supersedesDecisionId);
			}
		}
		const expectedLatest = value.records.filter((record) => !superseded.has(record.decisionId));
		if (
			new Set(expectedLatest.map((record) => record.actor)).size !== expectedLatest.length ||
			value.latestByActor.length !== expectedLatest.length ||
			value.latestByActor.some(
				(record) =>
					!expectedLatest.some((expected) => JSON.stringify(expected) === JSON.stringify(record))
			)
		) {
			context.addIssue({
				code: 'custom',
				path: ['latestByActor'],
				message: 'Latest decisions must be exactly one unsuperseded record per actor'
			});
		}
	});

export type FinalControlledDesignRiskHumanDecision = z.infer<
	typeof FinalControlledDesignRiskHumanDecisionSchema
>;
export type FinalControlledDesignRiskDecisionScope = z.infer<
	typeof FinalControlledDesignRiskDecisionScopeSchema
>;
export type FinalControlledDesignRiskEvidenceBindings = z.infer<
	typeof FinalControlledDesignRiskEvidenceBindingsSchema
>;
export type FinalControlledDesignRiskDecisionCreateRequest = z.infer<
	typeof FinalControlledDesignRiskDecisionCreateRequestSchema
>;
export type FinalControlledDesignRiskDecisionRecord = z.infer<
	typeof FinalControlledDesignRiskDecisionRecordSchema
>;
export type FinalControlledDesignRiskDecisionList = z.infer<
	typeof FinalControlledDesignRiskDecisionListSchema
>;

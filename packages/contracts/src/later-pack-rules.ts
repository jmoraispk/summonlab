import { z } from 'zod';

import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

export const LaterPackRuleIds = [
	'affinity-changes-construction',
	'normal-remains-unaffiliated',
	'species-identity-survives-affinity',
	'grade-and-affinity-stay-separate',
	'packs-declare-coherent-style',
	'power-uses-material-hierarchy',
	'humans-vary-with-compatibility',
	'quality-without-objectification'
] as const;

export const LaterPackRuleDomains = [
	'affinity-construction',
	'normal-neutrality',
	'species-identity',
	'grade-separation',
	'pack-style',
	'power-signaling',
	'human-variation',
	'quality-ethics'
] as const;

export const LaterPackRuleHumanDecisionSchema = z
	.object({
		ruleId: z.enum(LaterPackRuleIds),
		domain: z.enum(LaterPackRuleDomains),
		textHash: StateHashSchema,
		decision: z.enum(['accepted', 'rejected']),
		humanRationale: z.string().trim().min(1).max(2_000)
	})
	.strict();

function exactOrderedRules(
	decisions: readonly z.infer<typeof LaterPackRuleHumanDecisionSchema>[],
	context: z.RefinementCtx
): void {
	for (const [index, decision] of decisions.entries()) {
		if (
			decision.ruleId !== LaterPackRuleIds[index] ||
			decision.domain !== LaterPackRuleDomains[index]
		) {
			context.addIssue({
				code: 'custom',
				path: ['decisions', index],
				message: 'Later-pack rule decisions must match the complete plan-owned order'
			});
		}
	}
}

export const LaterPackRulesHumanDecisionScopeSchema = z
	.object({
		experimentId: z.literal('affinity-workflow-v1'),
		roundId: z.literal('final-controlled-v1')
	})
	.strict();

const HumanDecisionBaseSchema = LaterPackRulesHumanDecisionScopeSchema.extend({
	decisionId: EntityIdSchema,
	mode: z.literal('human-interactive'),
	actor: z.string().trim().min(1).max(80),
	proposalCanonicalSha256: StateHashSchema,
	sourceReadinessCanonicalSha256: StateHashSchema,
	supersedesDecisionId: EntityIdSchema.nullable(),
	decisions: z.array(LaterPackRuleHumanDecisionSchema).length(8),
	attestation: z
		.object({
			producerDidNotApprove: z.literal(true),
			reviewedEligibleBlindEvidence: z.literal(true),
			acceptsRulesForLaterPacks: z.literal(true)
		})
		.strict()
})
	.strict()
	.superRefine((value, context) => {
		exactOrderedRules(value.decisions, context);
		if (value.supersedesDecisionId === value.decisionId) {
			context.addIssue({
				code: 'custom',
				path: ['supersedesDecisionId'],
				message: 'A decision cannot supersede itself'
			});
		}
	});

export const LaterPackRulesHumanDecisionCreateRequestSchema = HumanDecisionBaseSchema;

export const LaterPackRulesHumanDecisionRecordSchema = HumanDecisionBaseSchema.safeExtend({
	decidedAt: IsoDateTimeSchema
});

export const LaterPackRulesHumanDecisionListSchema = z
	.object({
		experimentId: z.literal('affinity-workflow-v1'),
		roundId: z.literal('final-controlled-v1'),
		records: z.array(LaterPackRulesHumanDecisionRecordSchema),
		latestByActor: z.array(LaterPackRulesHumanDecisionRecordSchema)
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
			if (record.experimentId !== value.experimentId || record.roundId !== value.roundId) {
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
				(record) => !expectedLatest.some((expected) => expected.decisionId === record.decisionId)
			)
		) {
			context.addIssue({
				code: 'custom',
				path: ['latestByActor'],
				message: 'Latest decisions must be exactly one unsuperseded record per actor'
			});
		}
	});

export type LaterPackRuleHumanDecision = z.infer<typeof LaterPackRuleHumanDecisionSchema>;
export type LaterPackRulesHumanDecisionCreateRequest = z.infer<
	typeof LaterPackRulesHumanDecisionCreateRequestSchema
>;
export type LaterPackRulesHumanDecisionRecord = z.infer<
	typeof LaterPackRulesHumanDecisionRecordSchema
>;
export type LaterPackRulesHumanDecisionList = z.infer<typeof LaterPackRulesHumanDecisionListSchema>;

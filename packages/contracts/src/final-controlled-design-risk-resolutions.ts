import { z } from 'zod';

import {
	FinalControlledDesignRiskDecisionRecordSchema,
	FinalControlledDesignRiskEvidenceBindingsSchema,
	FinalControlledDesignRiskHumanDecisionSchema,
	FinalControlledDesignRisks
} from './final-controlled-design-risk-decisions.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

export const FinalControlledEligibleOriginalCandidateTargetIds = [
	'affinity-workflow-v1-cave-bear-fire',
	'affinity-workflow-v1-cave-bear-metal',
	'affinity-workflow-v1-cave-bear-normal',
	'affinity-workflow-v1-cave-bear-water',
	'affinity-workflow-v1-death-knight-fire',
	'affinity-workflow-v1-death-knight-metal',
	'affinity-workflow-v1-death-knight-normal',
	'affinity-workflow-v1-death-knight-water',
	'affinity-workflow-v1-death-knight-wind',
	'affinity-workflow-v1-death-knight-wood',
	'affinity-workflow-v1-elemental-fire',
	'affinity-workflow-v1-elemental-metal',
	'affinity-workflow-v1-elemental-normal',
	'affinity-workflow-v1-elemental-water',
	'affinity-workflow-v1-elemental-wind',
	'affinity-workflow-v1-elemental-wood',
	'affinity-workflow-v1-gray-wolf-metal',
	'affinity-workflow-v1-gray-wolf-normal',
	'affinity-workflow-v1-gray-wolf-water',
	'affinity-workflow-v1-gray-wolf-wind',
	'affinity-workflow-v1-gray-wolf-wood'
] as const;

export const FinalControlledOriginalReviseResults = [
	{
		id: 'result-affinity-workflow-v1-cave-bear-wind',
		targetId: 'affinity-workflow-v1-cave-bear-wind'
	},
	{
		id: 'result-affinity-workflow-v1-cave-bear-wood',
		targetId: 'affinity-workflow-v1-cave-bear-wood'
	},
	{
		id: 'result-affinity-workflow-v1-gray-wolf-fire',
		targetId: 'affinity-workflow-v1-gray-wolf-fire'
	}
] as const;

export const FinalControlledDesignRiskStagedTargetPaths = [
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/death-knight/normal-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/death-knight/wood-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/death-knight/fire-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/death-knight/water-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/death-knight/wind-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/cave-bear/normal-v3.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/cave-bear/wood-v3.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/cave-bear/wind-v3.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/death-knight/metal-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/elemental/normal-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/elemental/water-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/elemental/wind-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/gray-wolf/normal-v3.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/elemental/wood-v4.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/gray-wolf/wood-v3.json',
	'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/gray-wolf/water-v3.json'
] as const;

const EligibleCandidateTargetIdSchema = z.enum(FinalControlledEligibleOriginalCandidateTargetIds);
const ReviseResultIdSchema = z.enum(
	FinalControlledOriginalReviseResults.map((result) => result.id) as [
		(typeof FinalControlledOriginalReviseResults)[number]['id'],
		...(typeof FinalControlledOriginalReviseResults)[number]['id'][]
	]
);
const ReviseTargetIdSchema = z.enum(
	FinalControlledOriginalReviseResults.map((result) => result.targetId) as [
		(typeof FinalControlledOriginalReviseResults)[number]['targetId'],
		...(typeof FinalControlledOriginalReviseResults)[number]['targetId'][]
	]
);
export const FinalControlledDesignRiskBlindReviewEvidenceSchema = z
	.object({
		id: EntityIdSchema,
		targetId: EligibleCandidateTargetIdSchema,
		candidateContentHash: StateHashSchema,
		contentHash: StateHashSchema
	})
	.strict();

export const FinalControlledDesignRiskReviseResultEvidenceSchema = z
	.object({
		id: ReviseResultIdSchema,
		targetId: ReviseTargetIdSchema,
		contentHash: StateHashSchema
	})
	.strict()
	.superRefine((value, context) => {
		const expected = FinalControlledOriginalReviseResults.find((result) => result.id === value.id);
		if (expected?.targetId !== value.targetId) {
			context.addIssue({
				code: 'custom',
				path: ['targetId'],
				message: 'Revise result ID and target must match the immutable original result'
			});
		}
	});

export const FinalControlledDesignRiskStagedTargetBindingSchema = z
	.object({
		path: z.enum(FinalControlledDesignRiskStagedTargetPaths),
		canonicalHash: StateHashSchema,
		promptHash: StateHashSchema,
		promptByteLength: z.number().int().positive().max(2_000_000)
	})
	.strict();

export const FinalControlledDesignRiskResolvedEntrySchema =
	FinalControlledDesignRiskHumanDecisionSchema.safeExtend({
		status: z.literal('resolved'),
		blindReviewEvidence: z.array(FinalControlledDesignRiskBlindReviewEvidenceSchema).max(1),
		reviseResultEvidence: z.array(FinalControlledDesignRiskReviseResultEvidenceSchema).max(1),
		stagedTarget: FinalControlledDesignRiskStagedTargetBindingSchema.nullable()
	}).superRefine((value, context) => {
		if (value.decision.startsWith('replace-') && !value.stagedTarget) {
			context.addIssue({
				code: 'custom',
				path: ['stagedTarget'],
				message: 'Every replacement direction requires an immutable staged-target binding'
			});
		}
		if (value.decision === 'retain' && value.stagedTarget) {
			context.addIssue({
				code: 'custom',
				path: ['stagedTarget'],
				message: 'A retained derived target cannot claim a staged replacement'
			});
		}
	});

function originalTargetIdForCoordinate(coordinate: string): string {
	return `affinity-workflow-v1-${coordinate.replace(/-v\d+$/u, '')}`;
}

function exactStringArray(
	actual: readonly string[],
	expected: readonly string[],
	context: z.RefinementCtx,
	path: PropertyKey[],
	message: string
): void {
	if (
		actual.length !== expected.length ||
		actual.some((value, index) => value !== expected[index])
	) {
		context.addIssue({ code: 'custom', path, message });
	}
}

function hasDuplicates(values: readonly string[]): boolean {
	return new Set(values).size !== values.length;
}

export const FinalControlledDesignRiskResolutionLedgerV2Schema = z
	.object({
		schemaVersion: z.literal('affinity-final-controlled-design-risk-resolutions-v2'),
		experimentId: z.literal('affinity-workflow-v1'),
		scopeId: z.literal('final-controlled-activation-v1'),
		status: z.literal('resolved'),
		resolutionId: EntityIdSchema,
		actor: z.string().trim().min(1).max(80),
		decidedAt: IsoDateTimeSchema,
		mode: z.literal('human-interactive-db-export'),
		humanDecisionRecord: z
			.object({
				record: FinalControlledDesignRiskDecisionRecordSchema,
				recordCanonicalSha256: StateHashSchema
			})
			.strict(),
		evidenceBindings: FinalControlledDesignRiskEvidenceBindingsSchema,
		eligibleOriginalControlledTargetIds: z.array(EligibleCandidateTargetIdSchema).length(21),
		reviseResults: z.array(FinalControlledDesignRiskReviseResultEvidenceSchema).length(3),
		resolutions: z.array(FinalControlledDesignRiskResolvedEntrySchema).length(16)
	})
	.strict()
	.superRefine((ledger, context) => {
		const humanDecisionRecord = ledger.humanDecisionRecord.record;
		if (ledger.resolutionId !== humanDecisionRecord.decisionId) {
			context.addIssue({
				code: 'custom',
				path: ['resolutionId'],
				message: 'Resolution ID must be the DB human decision ID'
			});
		}
		if (ledger.actor !== humanDecisionRecord.actor) {
			context.addIssue({
				code: 'custom',
				path: ['actor'],
				message: 'Resolution actor must match the embedded DB human decision'
			});
		}
		if (ledger.decidedAt !== humanDecisionRecord.decidedAt) {
			context.addIssue({
				code: 'custom',
				path: ['decidedAt'],
				message: 'Resolution timestamp must match the embedded DB human decision'
			});
		}
		for (const key of Object.keys(ledger.evidenceBindings) as Array<
			keyof typeof ledger.evidenceBindings
		>) {
			if (ledger.evidenceBindings[key] !== humanDecisionRecord.evidenceBindings[key]) {
				context.addIssue({
					code: 'custom',
					path: ['evidenceBindings', key],
					message: 'Resolution evidence bindings must match the embedded DB human decision'
				});
			}
		}

		exactStringArray(
			ledger.eligibleOriginalControlledTargetIds,
			FinalControlledEligibleOriginalCandidateTargetIds,
			context,
			['eligibleOriginalControlledTargetIds'],
			'Eligible candidate IDs must match the exact canonical 21-target order'
		);
		exactStringArray(
			ledger.reviseResults.map((result) => result.id),
			FinalControlledOriginalReviseResults.map((result) => result.id),
			context,
			['reviseResults'],
			'Revise results must match the exact canonical three-result order'
		);
		exactStringArray(
			ledger.reviseResults.map((result) => result.targetId),
			FinalControlledOriginalReviseResults.map((result) => result.targetId),
			context,
			['reviseResults'],
			'Revise result targets must match the exact canonical three-target order'
		);

		for (const [index, expectedRisk] of FinalControlledDesignRisks.entries()) {
			const resolution = ledger.resolutions[index];
			const humanDecision = humanDecisionRecord.decisions[index];
			if (
				!resolution ||
				resolution.riskId !== expectedRisk.riskId ||
				resolution.coordinate !== expectedRisk.coordinate ||
				resolution.sourceTargetId !== expectedRisk.sourceTargetId ||
				resolution.severity !== expectedRisk.severity
			) {
				context.addIssue({
					code: 'custom',
					path: ['resolutions', index],
					message: 'Resolved entries must match the complete plan-owned human-decision order'
				});
				continue;
			}
			if (
				!humanDecision ||
				resolution.riskId !== humanDecision.riskId ||
				resolution.coordinate !== humanDecision.coordinate ||
				resolution.sourceTargetId !== humanDecision.sourceTargetId ||
				resolution.severity !== humanDecision.severity ||
				resolution.decision !== humanDecision.decision ||
				resolution.humanRationale !== humanDecision.humanRationale
			) {
				context.addIssue({
					code: 'custom',
					path: ['resolutions', index],
					message:
						'Resolution identity, direction, and rationale must match the embedded DB human decision'
				});
			}

			const originalTargetId = originalTargetIdForCoordinate(expectedRisk.coordinate);
			const revise = ledger.reviseResults.find((result) => result.targetId === originalTargetId);
			if (revise) {
				if (
					resolution.blindReviewEvidence.length !== 0 ||
					resolution.reviseResultEvidence.length !== 1 ||
					resolution.reviseResultEvidence[0]?.id !== revise.id ||
					resolution.reviseResultEvidence[0]?.targetId !== revise.targetId ||
					resolution.reviseResultEvidence[0]?.contentHash !== revise.contentHash
				) {
					context.addIssue({
						code: 'custom',
						path: ['resolutions', index],
						message: 'A revise coordinate must cite its exact immutable revise result only'
					});
				}
			} else if (
				resolution.blindReviewEvidence.length !== 1 ||
				resolution.blindReviewEvidence[0]?.targetId !== originalTargetId ||
				resolution.reviseResultEvidence.length !== 0
			) {
				context.addIssue({
					code: 'custom',
					path: ['resolutions', index],
					message: 'A candidate coordinate must cite one blind review for its own target only'
				});
			}

			if (
				resolution.stagedTarget &&
				resolution.stagedTarget.path !== FinalControlledDesignRiskStagedTargetPaths[index]
			) {
				context.addIssue({
					code: 'custom',
					path: ['resolutions', index, 'stagedTarget', 'path'],
					message: 'Staged target path must belong to the same plan-owned risk coordinate'
				});
			}
		}

		for (const [label, values] of [
			['revise result IDs', ledger.reviseResults.map((result) => result.id)],
			['revise result target IDs', ledger.reviseResults.map((result) => result.targetId)],
			['revise result hashes', ledger.reviseResults.map((result) => result.contentHash)],
			[
				'blind review IDs',
				ledger.resolutions.flatMap((resolution) =>
					resolution.blindReviewEvidence.map((evidence) => evidence.id)
				)
			],
			[
				'blind review target IDs',
				ledger.resolutions.flatMap((resolution) =>
					resolution.blindReviewEvidence.map((evidence) => evidence.targetId)
				)
			],
			[
				'blind review candidate hashes',
				ledger.resolutions.flatMap((resolution) =>
					resolution.blindReviewEvidence.map((evidence) => evidence.candidateContentHash)
				)
			],
			[
				'blind review record hashes',
				ledger.resolutions.flatMap((resolution) =>
					resolution.blindReviewEvidence.map((evidence) => evidence.contentHash)
				)
			],
			[
				'staged target paths',
				ledger.resolutions.flatMap((resolution) =>
					resolution.stagedTarget ? [resolution.stagedTarget.path] : []
				)
			],
			[
				'staged target hashes',
				ledger.resolutions.flatMap((resolution) =>
					resolution.stagedTarget ? [resolution.stagedTarget.canonicalHash] : []
				)
			],
			[
				'staged target prompt hashes',
				ledger.resolutions.flatMap((resolution) =>
					resolution.stagedTarget ? [resolution.stagedTarget.promptHash] : []
				)
			]
		] as const) {
			if (hasDuplicates(values)) {
				context.addIssue({
					code: 'custom',
					message: `${label} must be unique`
				});
			}
		}
	});

export type FinalControlledDesignRiskBlindReviewEvidence = z.infer<
	typeof FinalControlledDesignRiskBlindReviewEvidenceSchema
>;
export type FinalControlledDesignRiskReviseResultEvidence = z.infer<
	typeof FinalControlledDesignRiskReviseResultEvidenceSchema
>;
export type FinalControlledDesignRiskStagedTargetBinding = z.infer<
	typeof FinalControlledDesignRiskStagedTargetBindingSchema
>;
export type FinalControlledDesignRiskResolvedEntry = z.infer<
	typeof FinalControlledDesignRiskResolvedEntrySchema
>;
export type FinalControlledDesignRiskResolutionLedgerV2 = z.infer<
	typeof FinalControlledDesignRiskResolutionLedgerV2Schema
>;

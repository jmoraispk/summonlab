import { z } from 'zod';

import {
	EQUIPMENT_ARMOUR_SLOTS,
	EQUIPMENT_CLASSES,
	EQUIPMENT_RANKS,
	EQUIPMENT_V3_ROOT
} from './equipment-rank-first-production-v3.js';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const NonEmptySchema = z.string().trim().min(1);
const RepositoryPathSchema = z
	.string()
	.regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9._/-]+$/u)
	.refine(
		(value) => value.startsWith(`${EQUIPMENT_V3_ROOT}/`),
		'Path must stay inside Equipment v3'
	);
const AnyEquipmentReferencePathSchema = z
	.string()
	.regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9._/-]+$/u)
	.refine((value) => value.startsWith('assets/equipment/'), 'Reference must stay inside Equipment');

export const EquipmentAcceptedReferenceV3Schema = z
	.object({
		path: AnyEquipmentReferencePathSchema,
		sha256: Sha256Schema,
		purpose: NonEmptySchema
	})
	.strict();

export const EquipmentCandidateTargetV3Schema = z
	.object({
		targetId: z.string().regex(/^material-equipment-v3-[a-z0-9-]+-v3$/u),
		productionOrder: z.number().int().min(1).max(161),
		rank: z.enum(EQUIPMENT_RANKS),
		materialId: z.string().regex(/^[a-z0-9-]+$/u),
		materialName: NonEmptySchema,
		materialFamily: z.enum(['metal', 'wood', 'hide-scale', 'cloth-fibre']),
		materialBriefPath: RepositoryPathSchema,
		classId: z.enum(EQUIPMENT_CLASSES),
		classDirectionId: z.string().regex(/^equipment-v3-[a-z-]+-rank-progression$/u),
		artifactId: z.string().regex(/^[a-z-]+$/u),
		artifactRole: z.enum(['item', 'set-source', 'armour-piece']),
		slot: z.enum(EQUIPMENT_ARMOUR_SLOTS).nullable(),
		setId: z.string().nullable(),
		dependsOnTargetId: z.string().nullable(),
		width: z.literal(1024),
		height: z.union([z.literal(1024), z.literal(1536)]),
		output: z
			.object({
				targetPath: RepositoryPathSchema,
				assignmentPath: RepositoryPathSchema,
				promptPath: RepositoryPathSchema,
				candidatePath: RepositoryPathSchema,
				provenanceResultPath: RepositoryPathSchema,
				reviewReceiptPath: RepositoryPathSchema
			})
			.strict()
	})
	.strict()
	.superRefine((target, context) => {
		const isPiece = target.artifactRole === 'armour-piece';
		const isSet = target.artifactRole === 'set-source';
		if (isPiece !== (target.slot !== null && target.dependsOnTargetId !== null)) {
			context.addIssue({
				code: 'custom',
				message: 'Only an Armour piece has a slot and dependency'
			});
		}
		if ((isPiece || isSet) !== (target.setId !== null)) {
			context.addIssue({ code: 'custom', message: 'Only Armour sources and pieces have a set ID' });
		}
		if (isSet !== (target.height === 1536)) {
			context.addIssue({ code: 'custom', message: 'Only full-set sources use 1024×1536' });
		}
	});

export const EquipmentCandidateAssignmentV3Schema = z
	.object({
		schemaVersion: z.literal('equipment-rank-first-assignment-v3'),
		assignmentId: z.string().regex(/^assignment-material-equipment-v3-[a-z0-9-]+-v3$/u),
		targetId: z.string().regex(/^material-equipment-v3-[a-z0-9-]+-v3$/u),
		immutable: z.literal(true),
		classDirection: EquipmentAcceptedReferenceV3Schema,
		materialBrief: z.object({ path: RepositoryPathSchema, canonicalSha256: Sha256Schema }).strict(),
		finishReference: EquipmentAcceptedReferenceV3Schema,
		consistencySource: EquipmentAcceptedReferenceV3Schema.nullable(),
		prompt: NonEmptySchema,
		promptSha256: Sha256Schema,
		permittedOutputs: z
			.object({
				candidatePath: RepositoryPathSchema,
				resultPath: RepositoryPathSchema
			})
			.strict(),
		forbiddenActions: z.array(NonEmptySchema).min(1)
	})
	.strict();

export const EquipmentProvenanceResultV3Schema = z
	.object({
		schemaVersion: z.literal('equipment-rank-first-provenance-result-v3'),
		resultId: z.string().regex(/^result-material-equipment-v3-[a-z0-9-]+-v3-attempt-[1-9][0-9]*$/u),
		targetId: z.string().regex(/^material-equipment-v3-[a-z0-9-]+-v3$/u),
		assignmentId: z.string().regex(/^assignment-material-equipment-v3-[a-z0-9-]+-v3$/u),
		attempt: z.number().int().min(1),
		status: z.enum(['succeeded', 'failed']),
		startedAt: z.string().datetime({ offset: true }),
		completedAt: z.string().datetime({ offset: true }),
		provider: NonEmptySchema,
		model: NonEmptySchema,
		promptSha256: Sha256Schema,
		references: z.array(EquipmentAcceptedReferenceV3Schema).min(2),
		output: z
			.object({
				path: RepositoryPathSchema,
				sha256: Sha256Schema,
				bytes: z.number().int().positive(),
				width: z.number().int().positive(),
				height: z.number().int().positive(),
				mediaType: z.literal('image/png')
			})
			.strict()
			.nullable(),
		error: z.object({ kind: NonEmptySchema, message: NonEmptySchema }).strict().nullable()
	})
	.strict()
	.superRefine((result, context) => {
		if ((result.status === 'succeeded') !== (result.output !== null && result.error === null)) {
			context.addIssue({
				code: 'custom',
				message: 'Succeeded results require output and no error'
			});
		}
		if ((result.status === 'failed') !== (result.output === null && result.error !== null)) {
			context.addIssue({ code: 'custom', message: 'Failed results require error and no output' });
		}
	});

export const EquipmentReviewDecisionV3Schema = z.enum(['accept', 'revise', 'defer']);

export const EquipmentCheckpointReceiptV3Schema = z
	.object({
		schemaVersion: z.literal('equipment-owner-checkpoint-receipt-v3'),
		checkpointId: z.enum([
			'equipment-v3-checkpoint-1-directions',
			'equipment-v3-checkpoint-2-roots',
			'equipment-v3-checkpoint-3-armour-pieces'
		]),
		createdAt: z.string().datetime({ offset: true }),
		decidedBy: NonEmptySchema,
		manifestCanonicalSha256: Sha256Schema,
		galleryPath: RepositoryPathSchema,
		decisions: z
			.array(
				z
					.object({
						subjectId: NonEmptySchema,
						imagePath: AnyEquipmentReferencePathSchema,
						imageSha256: Sha256Schema,
						decision: EquipmentReviewDecisionV3Schema,
						notes: z.string()
					})
					.strict()
			)
			.min(1),
		summary: z
			.object({
				accept: z.number().int().min(0),
				revise: z.number().int().min(0),
				defer: z.number().int().min(0)
			})
			.strict()
	})
	.strict()
	.superRefine((receipt, context) => {
		const expected = receipt.decisions.reduce(
			(counts, entry) => {
				counts[entry.decision] += 1;
				return counts;
			},
			{ accept: 0, revise: 0, defer: 0 }
		);
		if (JSON.stringify(expected) !== JSON.stringify(receipt.summary)) {
			context.addIssue({ code: 'custom', message: 'Checkpoint summary does not match decisions' });
		}
	});

export const EquipmentArmourSetUnlockReceiptV3Schema = z
	.object({
		schemaVersion: z.literal('equipment-armour-set-unlock-receipt-v3'),
		setId: NonEmptySchema,
		sourceTargetId: z.string().regex(/^material-equipment-v3-[a-z0-9-]+-full-set-v3$/u),
		sourceCandidatePath: RepositoryPathSchema,
		sourceCandidateSha256: Sha256Schema,
		classAuditDecision: z.literal('accept'),
		materialAuditDecision: z.literal('accept'),
		emptySetCheck: z.literal('pass'),
		fourComponentCheck: z.literal('pass'),
		acceptedAt: z.string().datetime({ offset: true }),
		acceptedBy: NonEmptySchema,
		unlocksTargetIds: z.array(z.string()).length(4)
	})
	.strict();

export const EquipmentDirectionTargetV3Schema = z
	.object({
		schemaVersion: z.literal('equipment-class-direction-target-v3'),
		directionId: z.string().regex(/^equipment-v3-[a-z-]+-rank-progression$/u),
		classId: z.enum(EQUIPMENT_CLASSES),
		width: z.literal(1536),
		height: z.literal(1024),
		mediaType: z.literal('image/png'),
		orderedRanks: z.tuple(
			EQUIPMENT_RANKS.map((rank) => z.literal(rank)) as [
				z.ZodLiteral<'F'>,
				z.ZodLiteral<'E'>,
				z.ZodLiteral<'D'>,
				z.ZodLiteral<'C'>,
				z.ZodLiteral<'B'>,
				z.ZodLiteral<'A'>,
				z.ZodLiteral<'S'>
			]
		),
		candidatePath: RepositoryPathSchema,
		resultPath: RepositoryPathSchema
	})
	.strict();

export const EquipmentDirectionAssignmentV3Schema = z
	.object({
		schemaVersion: z.literal('equipment-class-direction-assignment-v3'),
		assignmentId: z
			.string()
			.regex(/^assignment-equipment-v3-[a-z-]+-rank-progression(?:-attempt-[1-9][0-9]*)?$/u),
		directionId: z.string().regex(/^equipment-v3-[a-z-]+-rank-progression$/u),
		immutable: z.literal(true),
		prompt: NonEmptySchema,
		promptSha256: Sha256Schema,
		references: z.array(EquipmentAcceptedReferenceV3Schema).min(2),
		permittedOutputs: z
			.object({ candidatePath: RepositoryPathSchema, resultPath: RepositoryPathSchema })
			.strict(),
		selfPromotionForbidden: z.literal(true)
	})
	.strict();

export const EquipmentDirectionResultV3Schema = z
	.object({
		schemaVersion: z.literal('equipment-class-direction-result-v3'),
		resultId: z
			.string()
			.regex(/^result-equipment-v3-[a-z-]+-rank-progression-attempt-[1-9][0-9]*$/u),
		directionId: z.string().regex(/^equipment-v3-[a-z-]+-rank-progression$/u),
		assignmentId: z
			.string()
			.regex(/^assignment-equipment-v3-[a-z-]+-rank-progression(?:-attempt-[1-9][0-9]*)?$/u),
		attempt: z.number().int().min(1),
		status: z.enum(['succeeded', 'failed']),
		startedAt: z.string().datetime({ offset: true }),
		completedAt: z.string().datetime({ offset: true }),
		provider: NonEmptySchema,
		model: NonEmptySchema,
		promptSha256: Sha256Schema,
		references: z.array(EquipmentAcceptedReferenceV3Schema).min(2),
		output: z
			.object({
				path: RepositoryPathSchema,
				sha256: Sha256Schema,
				bytes: z.number().int().positive(),
				width: z.literal(1536),
				height: z.literal(1024),
				mediaType: z.literal('image/png')
			})
			.strict()
			.nullable(),
		error: z.object({ kind: NonEmptySchema, message: NonEmptySchema }).strict().nullable()
	})
	.strict();

export const EQUIPMENT_V3_SCHEMA_DEFINITIONS = [
	['target.schema.json', EquipmentCandidateTargetV3Schema],
	['assignment.schema.json', EquipmentCandidateAssignmentV3Schema],
	['provenance-result.schema.json', EquipmentProvenanceResultV3Schema],
	['checkpoint-receipt.schema.json', EquipmentCheckpointReceiptV3Schema],
	['armour-set-unlock-receipt.schema.json', EquipmentArmourSetUnlockReceiptV3Schema],
	['direction-target.schema.json', EquipmentDirectionTargetV3Schema],
	['direction-assignment.schema.json', EquipmentDirectionAssignmentV3Schema],
	['direction-result.schema.json', EquipmentDirectionResultV3Schema]
] as const;

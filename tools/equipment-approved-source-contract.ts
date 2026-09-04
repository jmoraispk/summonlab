import { z } from 'zod';

import {
	EQUIPMENT_ARMOUR_SLOTS,
	EQUIPMENT_CLASSES,
	EQUIPMENT_RANKS
} from './equipment-rank-first-production-v3.js';

export const EQUIPMENT_APPROVED_ROOT = 'assets/equipment/approved/material-equipment-v1' as const;
export const EQUIPMENT_APPROVED_MANIFEST_PATH = `${EQUIPMENT_APPROVED_ROOT}/manifest.json` as const;
export const EQUIPMENT_APPROVED_RECEIPT_PATH =
	`${EQUIPMENT_APPROVED_ROOT}/receipts/promotion-v1.json` as const;
export const EQUIPMENT_PROMOTION_TOOL_VERSION = 'equipment-approved-promotion-v1' as const;
export const EQUIPMENT_PROMOTION_APPROVAL_COMMIT =
	'46cd7e715e327e26ecd89829ad6826d8aaf7adf9' as const;
export const EQUIPMENT_PROMOTION_DESIGN_PATH =
	'docs/superpowers/specs/2026-09-03-equipment-promotion-runtime-integration-design.md' as const;
export const EQUIPMENT_PROMOTION_PLAN_PATH =
	'docs/superpowers/plans/2026-09-03-equipment-promotion-runtime-integration.md' as const;
export const EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256 =
	'9e81d050551d959f27f00f65ff9318752579847a483f8f6e23e578befd97a874' as const;
export const EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256 =
	'1b8d287a708ab68634b6aea4900d1976b2eeaadfdb784a0fd663f1cd93720fa3' as const;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const NonEmptySchema = z.string().trim().min(1);
const TargetIdSchema = z.string().regex(/^material-equipment-v3-[a-z0-9-]+-v3$/u);
const AssetKeySchema = z.string().regex(/^equipment-v1-[a-z0-9-]+$/u);

function repositoryPath(prefix: string, suffix: RegExp) {
	return z
		.string()
		.regex(/^(?!\/)(?!.*\\)(?!.*(?:^|\/)\.\.?(?:\/|$))[a-zA-Z0-9._/-]+$/u)
		.refine((value) => value.startsWith(prefix), `Path must stay inside ${prefix}`)
		.refine((value) => suffix.test(value), 'Path has an invalid file type or layout');
}

const CandidatePathSchema = repositoryPath(
	'assets/equipment/experiments/material-equipment-v3/',
	/\.png$/u
);
const CheckpointPathSchema = z.enum([
	'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-2-roots.json',
	'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-3-armour-pieces.json'
]);
const ApprovedItemPathSchema = repositoryPath(
	`${EQUIPMENT_APPROVED_ROOT}/items/`,
	/^assets\/equipment\/approved\/material-equipment-v1\/items\/[fedcbas]\/[a-z0-9-]+\/[a-z0-9-]+\.png$/u
);
const ApprovedReferencePathSchema = repositoryPath(
	`${EQUIPMENT_APPROVED_ROOT}/armour-set-references/`,
	/^assets\/equipment\/approved\/material-equipment-v1\/armour-set-references\/[fedcbas]\/[a-z0-9-]+\/(?:heavy-armour|light-armour|robes)\.png$/u
);
const JsonReferenceSchema = z
	.object({
		path: repositoryPath('assets/equipment/', /\.json$/u),
		canonicalSha256: Sha256Schema
	})
	.strict();
const AuthorizationSchema = z
	.object({
		design: z
			.object({
				path: z.literal(EQUIPMENT_PROMOTION_DESIGN_PATH),
				sha256: z.literal(EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256)
			})
			.strict(),
		implementationPlan: z
			.object({
				path: z.literal(EQUIPMENT_PROMOTION_PLAN_PATH),
				sha256: z.literal(EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256)
			})
			.strict(),
		approvalCommit: z.literal(EQUIPMENT_PROMOTION_APPROVAL_COMMIT)
	})
	.strict();
const CandidateReferenceSchema = z
	.object({
		path: CandidatePathSchema,
		sha256: Sha256Schema
	})
	.strict();
const CheckpointReferenceSchema = z
	.object({
		path: CheckpointPathSchema,
		canonicalSha256: Sha256Schema
	})
	.strict();

const ApprovedRecordCommon = {
	schemaVersion: z.literal('equipment-approved-source-record-v1'),
	assetKey: AssetKeySchema,
	targetId: TargetIdSchema,
	rank: z.enum(EQUIPMENT_RANKS),
	materialId: z.string().regex(/^[a-z0-9-]+$/u),
	equipmentClass: z.enum(EQUIPMENT_CLASSES),
	artifactId: z.string().regex(/^[a-z0-9-]+$/u),
	slot: z.enum(EQUIPMENT_ARMOUR_SLOTS).nullable(),
	candidate: CandidateReferenceSchema,
	checkpoint: CheckpointReferenceSchema
} as const;

const EquipmentApprovedItemSourceRecordV1Schema = z
	.object({
		...ApprovedRecordCommon,
		role: z.literal('item'),
		approvedPath: ApprovedItemPathSchema,
		approved: z
			.object({
				path: ApprovedItemPathSchema,
				width: z.literal(1024),
				height: z.literal(1024),
				bytes: z.number().int().positive(),
				sha256: Sha256Schema
			})
			.strict()
	})
	.strict();

const EquipmentApprovedArmourSetReferenceRecordV1Schema = z
	.object({
		...ApprovedRecordCommon,
		role: z.literal('armour-set-reference'),
		approvedPath: ApprovedReferencePathSchema,
		slot: z.null(),
		equipmentClass: z.enum(['heavy-armour', 'light-armour', 'robes']),
		approved: z
			.object({
				path: ApprovedReferencePathSchema,
				width: z.literal(1024),
				height: z.literal(1536),
				bytes: z.number().int().positive(),
				sha256: Sha256Schema
			})
			.strict()
	})
	.strict();

export const EquipmentApprovedSourceRecordV1Schema = z
	.discriminatedUnion('role', [
		EquipmentApprovedItemSourceRecordV1Schema,
		EquipmentApprovedArmourSetReferenceRecordV1Schema
	])
	.superRefine((record, context) => {
		if (record.approvedPath !== record.approved.path) {
			context.addIssue({ code: 'custom', message: 'Approved path fields must match' });
		}
		if (record.candidate.sha256 !== record.approved.sha256) {
			context.addIssue({
				code: 'custom',
				message: 'Approved SHA-256 must equal the selected candidate hash'
			});
		}
		const expectedCheckpoint =
			record.role === 'item' && record.slot !== null
				? 'checkpoint-3-armour-pieces.json'
				: 'checkpoint-2-roots.json';
		if (!record.checkpoint.path.endsWith(expectedCheckpoint)) {
			context.addIssue({ code: 'custom', message: 'Record uses the wrong owner checkpoint' });
		}
	});

export type EquipmentApprovedSourceRecordV1 = z.infer<typeof EquipmentApprovedSourceRecordV1Schema>;

export const EquipmentApprovedSummaryV1Schema = z
	.object({
		total: z.literal(161),
		items: z.literal(140),
		armourSetReferences: z.literal(21),
		totalBytes: z.number().int().positive()
	})
	.strict();

function validateRecordCollection(
	records: readonly EquipmentApprovedSourceRecordV1[],
	summary: z.infer<typeof EquipmentApprovedSummaryV1Schema>,
	context: z.RefinementCtx
): void {
	const itemCount = records.filter(({ role }) => role === 'item').length;
	const referenceCount = records.filter(({ role }) => role === 'armour-set-reference').length;
	const totalBytes = records.reduce((total, record) => total + record.approved.bytes, 0);
	if (
		records.length !== summary.total ||
		itemCount !== summary.items ||
		referenceCount !== summary.armourSetReferences ||
		totalBytes !== summary.totalBytes
	) {
		context.addIssue({ code: 'custom', message: 'Record collection does not match its summary' });
	}
	for (const [label, values] of [
		['asset key', records.map(({ assetKey }) => assetKey)],
		['target ID', records.map(({ targetId }) => targetId)],
		['approved path', records.map(({ approvedPath }) => approvedPath)]
	] as const) {
		if (new Set(values).size !== values.length) {
			context.addIssue({ code: 'custom', message: `Duplicate ${label}` });
		}
	}
}

export const EquipmentApprovedSourceManifestV1Schema = z
	.object({
		schemaVersion: z.literal('equipment-approved-source-manifest-v1'),
		catalogId: z.literal('material-equipment-v1'),
		createdAt: z.string().datetime({ offset: true }),
		createdBy: NonEmptySchema,
		sourceProposal: JsonReferenceSchema,
		sourceManifest: JsonReferenceSchema,
		summary: EquipmentApprovedSummaryV1Schema,
		records: z.array(EquipmentApprovedSourceRecordV1Schema).length(161)
	})
	.strict()
	.superRefine((manifest, context) =>
		validateRecordCollection(manifest.records, manifest.summary, context)
	);

export type EquipmentApprovedSourceManifestV1 = z.infer<
	typeof EquipmentApprovedSourceManifestV1Schema
>;

export const EquipmentApprovedPromotionPlanV1Schema = z
	.object({
		schemaVersion: z.literal('equipment-approved-promotion-plan-v1'),
		planId: z.literal('material-equipment-v1-approved-promotion-v1'),
		authorization: AuthorizationSchema,
		sourceProposal: JsonReferenceSchema,
		sourceManifest: JsonReferenceSchema,
		checkpoints: z
			.object({
				directions: JsonReferenceSchema,
				roots: JsonReferenceSchema,
				armourPieces: JsonReferenceSchema
			})
			.strict(),
		summary: EquipmentApprovedSummaryV1Schema,
		entries: z.array(EquipmentApprovedSourceRecordV1Schema).length(161)
	})
	.strict()
	.superRefine((plan, context) => validateRecordCollection(plan.entries, plan.summary, context));

export type EquipmentApprovedPromotionPlanV1 = z.infer<
	typeof EquipmentApprovedPromotionPlanV1Schema
>;

export const EquipmentApprovedPromotionReceiptV1Schema = z
	.object({
		schemaVersion: z.literal('equipment-approved-promotion-receipt-v1'),
		receiptId: z.literal('material-equipment-v1-approved-promotion-v1'),
		createdAt: z.string().datetime({ offset: true }),
		createdBy: NonEmptySchema,
		toolVersion: z.literal(EQUIPMENT_PROMOTION_TOOL_VERSION),
		authorization: AuthorizationSchema,
		repository: z
			.object({
				branch: NonEmptySchema,
				basisCommit: z.string().regex(/^[a-f0-9]{40}$/u)
			})
			.strict(),
		planCanonicalSha256: Sha256Schema,
		approvedManifest: z
			.object({
				path: z.literal(EQUIPMENT_APPROVED_MANIFEST_PATH),
				canonicalSha256: Sha256Schema
			})
			.strict(),
		sourceProposal: JsonReferenceSchema,
		checkpoints: z
			.object({
				directions: JsonReferenceSchema,
				roots: JsonReferenceSchema,
				armourPieces: JsonReferenceSchema
			})
			.strict(),
		summary: EquipmentApprovedSummaryV1Schema
	})
	.strict();

export type EquipmentApprovedPromotionReceiptV1 = z.infer<
	typeof EquipmentApprovedPromotionReceiptV1Schema
>;

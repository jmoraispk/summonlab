import { z } from 'zod';

import { SkillIconMasterPathSchema, SkillIconRoleSchema } from '../packages/contracts/src/index.js';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const TransactionTokenSchema = z.string().uuid();
const JobIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u);

export const SKILL_ICON_PROMOTION_RECEIPT_ROOT =
	'assets/wiki/skills/icon-production-v1/promotion-receipts' as const;

export const SkillIconPromotionReceiptSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-promotion-receipt-v1'),
		transactionId: TransactionTokenSchema,
		jobId: JobIdSchema,
		role: SkillIconRoleSchema,
		ownerReviewer: z.string().trim().min(1).max(160),
		review: z.object({ path: z.string().min(1), contentHash: Sha256Schema }).strict(),
		result: z.object({ path: z.string().min(1), contentHash: Sha256Schema }).strict(),
		candidate: z.object({ path: z.string().min(1), contentHash: Sha256Schema }).strict(),
		master: z.object({ path: SkillIconMasterPathSchema, contentHash: Sha256Schema }).strict()
	})
	.strict();

export type SkillIconPromotionReceipt = z.infer<typeof SkillIconPromotionReceiptSchema>;

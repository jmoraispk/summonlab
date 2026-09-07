import { z } from 'zod';

import { SkillIconRepositoryPathSchema } from './skill-icon-production.js';
import { StateHashSchema } from './shared.js';

const cleanupRoot = 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1';

const BindingSchema = z
	.object({ path: SkillIconRepositoryPathSchema, contentHash: StateHashSchema })
	.strict();

const AcceptanceRecordSchema = z
	.object({
		targetId: z.string().min(1),
		baseline: BindingSchema,
		candidate: BindingSchema,
		accepted: BindingSchema
	})
	.strict();

export const SkillIconInnerFrameAcceptanceSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-inner-frame-acceptance-v1'),
		decision: z
			.object({
				decision: z.literal('accepted'),
				reviewerRole: z.literal('owner'),
				acceptedOn: z.literal('2026-09-06')
			})
			.strict(),
		scope: z
			.object({
				catalogSkills: z.literal(456),
				acceptedOverrides: z.literal(23),
				unchanged: z.literal(433),
				borderlineUntouched: z.literal(5)
			})
			.strict(),
		authority: z
			.object({
				v10Audit: BindingSchema.extend({
					path: z.literal(`${cleanupRoot}/review/v10-inner-frame-audit/report.json`)
				}),
				v12Review: BindingSchema.extend({
					path: z.literal(`${cleanupRoot}/review/v12-inner-frame-regeneration-scale/report.json`)
				}),
				cleanupManifest: BindingSchema.extend({ path: z.literal(`${cleanupRoot}/manifest.json`) })
			})
			.strict(),
		records: z.array(AcceptanceRecordSchema).length(23)
	})
	.strict()
	.superRefine((acceptance, context) => {
		const targetIds = acceptance.records.map((record) => record.targetId);
		if (new Set(targetIds).size !== targetIds.length)
			context.addIssue({
				code: 'custom',
				path: ['records'],
				message: 'Duplicate acceptance target ID'
			});
		for (const record of acceptance.records) {
			if (record.candidate.contentHash !== record.accepted.contentHash)
				context.addIssue({
					code: 'custom',
					path: ['records'],
					message: 'Accepted composite hash must equal its V12 candidate hash'
				});
		}
	});

export type SkillIconInnerFrameAcceptance = z.infer<typeof SkillIconInnerFrameAcceptanceSchema>;

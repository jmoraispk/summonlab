import { z } from 'zod';

import { CharacterDraftSchema } from './character.js';
import { ContentVersionSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

const HeroSlugSchema = z.string().regex(/^[a-z][a-z0-9-]{2,79}$/u);

export const ApprovedHeroSourceAssetSchema = z
	.object({
		assetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		role: z.enum(['summon', 'combat-chibi']),
		status: z.literal('approved'),
		file: z
			.string()
			.regex(/^assets\/heroes\/[a-z0-9./-]+\.png$/u)
			.refine((value) => !value.includes('..'), { message: 'Hero source path cannot traverse' }),
		width: z.number().int().positive().max(8_192),
		height: z.number().int().positive().max(8_192),
		bytes: z.number().int().positive(),
		contentHash: StateHashSchema,
		sourceExperimentId: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		approvalId: z.string().regex(/^[a-z][a-z0-9-]{2,119}$/u)
	})
	.strict();

export const SummonableHeroEntrySchema = z
	.object({
		heroId: HeroSlugSchema,
		displayName: z.string().min(1).max(80),
		designOrdinal: z.number().int().min(1).max(200),
		draft: CharacterDraftSchema,
		visuals: z
			.object({
				summon: ApprovedHeroSourceAssetSchema,
				combatChibi: ApprovedHeroSourceAssetSchema
			})
			.strict()
	})
	.strict()
	.superRefine((entry, context) => {
		if (entry.displayName !== entry.draft.manifest.displayName) {
			context.addIssue({ code: 'custom', message: `Display name mismatch: ${entry.heroId}` });
		}
		if (entry.draft.recipe.seed !== `approved:${entry.heroId}`) {
			context.addIssue({ code: 'custom', message: `Canonical recipe mismatch: ${entry.heroId}` });
		}
		if (
			entry.draft.recipe.generationVersion !== 'human-v6' ||
			entry.draft.manifest.generationVersion !== 'human-v6'
		) {
			context.addIssue({ code: 'custom', message: `Generation version mismatch: ${entry.heroId}` });
		}
		if (entry.draft.manifest.rarityStars !== 1) {
			context.addIssue({
				code: 'custom',
				message: `Summonable roster hero is not native 1★: ${entry.heroId}`
			});
		}
		if (entry.draft.manifest.assetProvenance !== 'approved-generated-roster') {
			context.addIssue({
				code: 'custom',
				message: `Approval provenance mismatch: ${entry.heroId}`
			});
		}
		if (entry.visuals.summon.role !== 'summon') {
			context.addIssue({ code: 'custom', message: `Summon role mismatch: ${entry.heroId}` });
		}
		if (entry.visuals.combatChibi.role !== 'combat-chibi') {
			context.addIssue({ code: 'custom', message: `Combat chibi role mismatch: ${entry.heroId}` });
		}
		if (entry.draft.manifest.artKey !== entry.visuals.summon.assetKey) {
			context.addIssue({
				code: 'custom',
				message: `Manifest art binding mismatch: ${entry.heroId}`
			});
		}
	});

export const SummonableHeroCatalogSchema = z
	.object({
		schemaVersion: z.literal('summonable-hero-catalog-v1'),
		catalogVersion: ContentVersionSchema,
		status: z.literal('approved'),
		approvedOn: IsoDateTimeSchema.or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)),
		ownerInstruction: z.string().min(1).max(500),
		sourceEvidence: z.array(
			z
				.object({
					file: z.string().min(1).max(500),
					contentHash: StateHashSchema
				})
				.strict()
		),
		entries: z.array(SummonableHeroEntrySchema).length(200)
	})
	.strict()
	.superRefine((catalog, context) => {
		const uniqueness = [
			['heroId', catalog.entries.map((entry) => entry.heroId)],
			['displayName', catalog.entries.map((entry) => entry.displayName)],
			['designOrdinal', catalog.entries.map((entry) => String(entry.designOrdinal))],
			['characterId', catalog.entries.map((entry) => entry.draft.manifest.characterId)],
			['manifestHash', catalog.entries.map((entry) => entry.draft.manifestHash)],
			[
				'assetKey',
				catalog.entries.flatMap((entry) => [
					entry.visuals.summon.assetKey,
					entry.visuals.combatChibi.assetKey
				])
			]
		] as const;
		for (const [label, values] of uniqueness) {
			if (new Set(values).size !== values.length) {
				context.addIssue({
					code: 'custom',
					message: `Duplicate ${label} in summonable hero catalog`
				});
			}
		}
	});

export type ApprovedHeroSourceAsset = z.infer<typeof ApprovedHeroSourceAssetSchema>;
export type SummonableHeroEntry = z.infer<typeof SummonableHeroEntrySchema>;
export type SummonableHeroCatalog = z.infer<typeof SummonableHeroCatalogSchema>;

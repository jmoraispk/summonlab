import { z } from 'zod';

import { CharacterDraftSchema } from './character.js';
import { ContentVersionSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';
import { PixiAssetManifestSchema, RuntimeVisualBundleSchema } from './visual.js';

const HeroSlugSchema = z.string().regex(/^[a-z][a-z0-9-]{2,79}$/u);

export const ApprovedHeroSourceAssetSchema = z
	.object({
		assetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		role: z.enum(['summon', 'combat-chibi', 'village-cutout']),
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

export const VillageCutoutBindingSchema = z
	.object({
		sourceSummonAssetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		sourceSummonContentHash: StateHashSchema,
		asset: ApprovedHeroSourceAssetSchema
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
				combatChibi: ApprovedHeroSourceAssetSchema,
				villageCutout: VillageCutoutBindingSchema.optional()
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
		const cutout = entry.visuals.villageCutout;
		if (
			cutout &&
			(cutout.asset.role !== 'village-cutout' ||
				cutout.sourceSummonAssetKey !== entry.visuals.summon.assetKey ||
				cutout.sourceSummonContentHash !== entry.visuals.summon.contentHash)
		) {
			context.addIssue({
				code: 'custom',
				message: `Village cutout must bind the matching summon source: ${entry.heroId}`
			});
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
		schemaVersion: z.literal('summonable-hero-catalog-v2'),
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
					entry.visuals.combatChibi.assetKey,
					...(entry.visuals.villageCutout ? [entry.visuals.villageCutout.asset.assetKey] : [])
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

export const SummonableHeroRuntimeEntrySchema = z
	.object({
		heroId: HeroSlugSchema,
		characterId: z.uuid(),
		manifestHash: StateHashSchema,
		bundle: RuntimeVisualBundleSchema
	})
	.strict()
	.superRefine((entry, context) => {
		if (entry.bundle.name !== `hero-${entry.heroId}`) {
			context.addIssue({
				code: 'custom',
				message: `Runtime bundle identity mismatch: ${entry.heroId}`
			});
		}
		const usages = new Set(entry.bundle.assets.map((asset) => asset.usage));
		if (
			usages.size !== entry.bundle.assets.length ||
			!usages.has('summon') ||
			!usages.has('combat-chibi') ||
			usages.size < 2 ||
			usages.size > 3 ||
			[...usages].some(
				(usage) => usage !== 'summon' && usage !== 'combat-chibi' && usage !== 'village-cutout'
			)
		) {
			context.addIssue({
				code: 'custom',
				message: `Runtime visual pair incomplete: ${entry.heroId}`
			});
		}
		if (
			entry.bundle.assets.some(
				(asset) =>
					asset.manifestHashes.length !== 1 || asset.manifestHashes[0] !== entry.manifestHash
			)
		) {
			context.addIssue({
				code: 'custom',
				message: `Runtime manifest binding mismatch: ${entry.heroId}`
			});
		}
	});

export const SummonableHeroRuntimeManifestSchema = z
	.object({
		schemaVersion: z.literal('summonable-hero-runtime-manifest-v2'),
		catalogVersion: ContentVersionSchema,
		sourceCatalogContentHash: StateHashSchema,
		exporterVersion: z.literal('summonable-hero-runtime-exporter-v2'),
		loading: z.literal('lazy-per-hero'),
		totalBytes: z.number().int().positive(),
		entries: z.array(SummonableHeroRuntimeEntrySchema).length(200),
		pixiManifest: PixiAssetManifestSchema,
		manifestHash: StateHashSchema
	})
	.strict()
	.superRefine((manifest, context) => {
		const totalBytes = manifest.entries.reduce((total, entry) => total + entry.bundle.bytes, 0);
		if (totalBytes !== manifest.totalBytes) {
			context.addIssue({ code: 'custom', message: 'Summonable runtime byte total is stale' });
		}
		const bundleNames = new Set(manifest.entries.map((entry) => entry.bundle.name));
		if (bundleNames.size !== 200 || manifest.pixiManifest.bundles.length !== 200) {
			context.addIssue({ code: 'custom', message: 'Summonable runtime bundle inventory is stale' });
		}
		for (const entry of manifest.entries) {
			const pixiBundle = manifest.pixiManifest.bundles.find(
				(candidate) => candidate.name === entry.bundle.name
			);
			if (!pixiBundle || pixiBundle.assets.length !== entry.bundle.assets.length) {
				context.addIssue({
					code: 'custom',
					message: `Pixi bundle projection missing: ${entry.heroId}`
				});
			}
		}
	});

export type ApprovedHeroSourceAsset = z.infer<typeof ApprovedHeroSourceAssetSchema>;
export type VillageCutoutBinding = z.infer<typeof VillageCutoutBindingSchema>;
export type SummonableHeroEntry = z.infer<typeof SummonableHeroEntrySchema>;
export type SummonableHeroCatalog = z.infer<typeof SummonableHeroCatalogSchema>;
export type SummonableHeroRuntimeEntry = z.infer<typeof SummonableHeroRuntimeEntrySchema>;
export type SummonableHeroRuntimeManifest = z.infer<typeof SummonableHeroRuntimeManifestSchema>;

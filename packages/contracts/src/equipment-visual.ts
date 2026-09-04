import { z } from 'zod';

import { StateHashSchema } from './shared.js';

export const EQUIPMENT_RUNTIME_CARD_BUDGET_BYTES = 16_000 as const;
export const EQUIPMENT_RUNTIME_DETAIL_BUDGET_BYTES = 64_000 as const;

export const EquipmentRuntimeVisualUsageSchema = z.enum(['card', 'detail']);

export const EquipmentRuntimeEncoderSchema = z
	.object({
		format: z.literal('webp'),
		quality: z.union([z.literal(76), z.literal(80)]),
		effort: z.literal(6),
		preset: z.literal('drawing'),
		smartSubsample: z.literal(true),
		metadata: z.literal('stripped')
	})
	.strict();

export const EquipmentRuntimeVisualAssetSchema = z
	.object({
		alias: z.string().regex(/^equipment\.[a-z0-9-]+\.(?:card|detail)$/u),
		usage: EquipmentRuntimeVisualUsageSchema,
		sourceAssetKey: z.string().regex(/^equipment-v1-[a-z0-9-]+$/u),
		sourceRole: z.literal('item'),
		sourceApprovalStatus: z.literal('approved'),
		sourceApprovedPath: z
			.string()
			.regex(
				/^assets\/equipment\/approved\/material-equipment-v1\/items\/[fedcbas]\/[a-z0-9-]+\/[a-z0-9-]+\.png$/u
			),
		sourceContentHash: StateHashSchema,
		approvedSourceManifestHash: StateHashSchema,
		file: z
			.string()
			.regex(
				/^apps\/web\/static\/runtime\/equipment-v1\/equipment-v1-[a-z0-9-]+\/(?:card|detail)\.[a-f0-9]{12}\.webp$/u
			),
		publicPath: z
			.string()
			.regex(
				/^\/runtime\/equipment-v1\/equipment-v1-[a-z0-9-]+\/(?:card|detail)\.[a-f0-9]{12}\.webp$/u
			),
		width: z.number().int().positive().max(512),
		height: z.number().int().positive().max(512),
		bytes: z.number().int().positive(),
		contentHash: StateHashSchema,
		budgetBytes: z.union([
			z.literal(EQUIPMENT_RUNTIME_CARD_BUDGET_BYTES),
			z.literal(EQUIPMENT_RUNTIME_DETAIL_BUDGET_BYTES)
		]),
		budgetStatus: z.literal('within-budget'),
		encoder: EquipmentRuntimeEncoderSchema
	})
	.strict()
	.superRefine((asset, context) => {
		const profile =
			asset.usage === 'card'
				? { bound: 256, quality: 76, budgetBytes: EQUIPMENT_RUNTIME_CARD_BUDGET_BYTES }
				: { bound: 512, quality: 80, budgetBytes: EQUIPMENT_RUNTIME_DETAIL_BUDGET_BYTES };
		if (asset.width > profile.bound || asset.height > profile.bound) {
			context.addIssue({ code: 'custom', message: `${asset.usage} exceeds its pixel bounds` });
		}
		if (asset.encoder.quality !== profile.quality || asset.budgetBytes !== profile.budgetBytes) {
			context.addIssue({
				code: 'custom',
				message: `${asset.usage} encoder profile is inconsistent`
			});
		}
		if (asset.bytes > asset.budgetBytes) {
			context.addIssue({ code: 'custom', message: `${asset.usage} exceeds its byte budget` });
		}
		const expectedAlias = `equipment.${asset.sourceAssetKey}.${asset.usage}`;
		if (asset.alias !== expectedAlias) {
			context.addIssue({ code: 'custom', message: 'Equipment runtime alias is stale' });
		}
		const suffix = `${asset.usage}.${asset.contentHash.slice(0, 12)}.webp`;
		if (!asset.file.endsWith(suffix) || !asset.publicPath.endsWith(suffix)) {
			context.addIssue({ code: 'custom', message: 'Runtime filename must bind its content hash' });
		}
		if (!asset.file.endsWith(asset.publicPath.slice(1))) {
			context.addIssue({ code: 'custom', message: 'Runtime file and public path must agree' });
		}
	});

export const EquipmentRuntimeVisualBundleSchema = z
	.object({
		name: z.string().regex(/^equipment-v1-[a-z0-9-]+$/u),
		sourceAssetKey: z.string().regex(/^equipment-v1-[a-z0-9-]+$/u),
		loadPolicy: z.literal('lazy'),
		bytes: z.number().int().positive(),
		budgetBytes: z.literal(
			EQUIPMENT_RUNTIME_CARD_BUDGET_BYTES + EQUIPMENT_RUNTIME_DETAIL_BUDGET_BYTES
		),
		budgetStatus: z.literal('within-budget'),
		assets: z.array(EquipmentRuntimeVisualAssetSchema).length(2)
	})
	.strict()
	.superRefine((bundle, context) => {
		if (bundle.name !== bundle.sourceAssetKey) {
			context.addIssue({ code: 'custom', message: 'Equipment bundle name must match its source' });
		}
		if (bundle.assets.some(({ sourceAssetKey }) => sourceAssetKey !== bundle.sourceAssetKey)) {
			context.addIssue({ code: 'custom', message: 'Equipment bundle contains another source' });
		}
		if (new Set(bundle.assets.map(({ usage }) => usage)).size !== 2) {
			context.addIssue({
				code: 'custom',
				message: 'Equipment bundle needs card and detail assets'
			});
		}
		const bytes = bundle.assets.reduce((total, asset) => total + asset.bytes, 0);
		if (bytes !== bundle.bytes || bytes > bundle.budgetBytes) {
			context.addIssue({ code: 'custom', message: 'Equipment bundle byte evidence is stale' });
		}
	});

export const EquipmentRuntimeVisualManifestSchema = z
	.object({
		schemaVersion: z.literal('equipment-runtime-visual-manifest-v1'),
		catalogVersion: z.literal('equipment-v1'),
		exporterVersion: z.literal('equipment-runtime-visual-exporter-v1'),
		approvedSource: z
			.object({
				schemaVersion: z.literal('equipment-approved-source-manifest-v1'),
				catalogId: z.literal('material-equipment-v1'),
				manifestPath: z.literal('assets/equipment/approved/material-equipment-v1/manifest.json'),
				manifestContentHash: StateHashSchema,
				createdAt: z.string().datetime({ offset: true }),
				createdBy: z.string().trim().min(1).max(100)
			})
			.strict(),
		loading: z
			.object({
				catalogLoadPolicy: z.literal('lazy-per-definition'),
				includedInInitialPhonePayload: z.literal(false),
				initialPayloadBytes: z.literal(0)
			})
			.strict(),
		profiles: z
			.array(
				z
					.object({
						usage: EquipmentRuntimeVisualUsageSchema,
						boundPixels: z.union([z.literal(256), z.literal(512)]),
						quality: z.union([z.literal(76), z.literal(80)]),
						budgetBytes: z.union([
							z.literal(EQUIPMENT_RUNTIME_CARD_BUDGET_BYTES),
							z.literal(EQUIPMENT_RUNTIME_DETAIL_BUDGET_BYTES)
						])
					})
					.strict()
			)
			.length(2),
		toolchain: z
			.object({
				sharp: z.string().min(1).max(40),
				vips: z.string().min(1).max(80),
				webp: z.string().min(1).max(80)
			})
			.strict(),
		summary: z
			.object({
				bundleCount: z.literal(140),
				assetCount: z.literal(280),
				armourSetReferenceCount: z.literal(0),
				cardBytes: z.number().int().positive(),
				detailBytes: z.number().int().positive(),
				totalBytes: z.number().int().positive()
			})
			.strict(),
		bundles: z.array(EquipmentRuntimeVisualBundleSchema).length(140),
		manifestHash: StateHashSchema
	})
	.strict()
	.superRefine((manifest, context) => {
		const assets = manifest.bundles.flatMap(({ assets }) => assets);
		const sourceKeys = manifest.bundles.map(({ sourceAssetKey }) => sourceAssetKey);
		if (new Set(sourceKeys).size !== sourceKeys.length) {
			context.addIssue({ code: 'custom', message: 'Equipment runtime bundles must be unique' });
		}
		if (new Set(assets.map(({ alias }) => alias)).size !== assets.length) {
			context.addIssue({ code: 'custom', message: 'Equipment runtime aliases must be unique' });
		}
		if (
			assets.some(
				(asset) => asset.approvedSourceManifestHash !== manifest.approvedSource.manifestContentHash
			)
		) {
			context.addIssue({ code: 'custom', message: 'Source approval evidence is inconsistent' });
		}
		const cardBytes = assets
			.filter(({ usage }) => usage === 'card')
			.reduce((total, { bytes }) => total + bytes, 0);
		const detailBytes = assets
			.filter(({ usage }) => usage === 'detail')
			.reduce((total, { bytes }) => total + bytes, 0);
		if (
			assets.length !== manifest.summary.assetCount ||
			cardBytes !== manifest.summary.cardBytes ||
			detailBytes !== manifest.summary.detailBytes ||
			cardBytes + detailBytes !== manifest.summary.totalBytes
		) {
			context.addIssue({ code: 'custom', message: 'Runtime catalog byte summary is stale' });
		}
	});

export type EquipmentRuntimeVisualUsage = z.infer<typeof EquipmentRuntimeVisualUsageSchema>;
export type EquipmentRuntimeVisualAsset = z.infer<typeof EquipmentRuntimeVisualAssetSchema>;
export type EquipmentRuntimeVisualBundle = z.infer<typeof EquipmentRuntimeVisualBundleSchema>;
export type EquipmentRuntimeVisualManifest = z.infer<typeof EquipmentRuntimeVisualManifestSchema>;

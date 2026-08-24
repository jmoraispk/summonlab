import { z } from 'zod';

import { ContentVersionSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

const SceneSlugSchema = z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u);

export const NormalizedScenePointSchema = z
	.object({
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1)
	})
	.strict();

export const NormalizedSceneBoundsSchema = z
	.object({
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1),
		width: z.number().positive().max(1),
		height: z.number().positive().max(1)
	})
	.strict()
	.refine((bounds) => bounds.x + bounds.width <= 1 && bounds.y + bounds.height <= 1, {
		message: 'Scene bounds must remain inside the normalized canvas'
	});

export const SettlementSceneLayerKindSchema = z.enum([
	'bitmap-base',
	'code-atmosphere',
	'code-illumination',
	'code-route',
	'code-activity',
	'code-interface'
]);

export const SettlementSceneLayerSchema = z
	.object({
		layerId: SceneSlugSchema,
		kind: SettlementSceneLayerKindSchema,
		depth: z.number().int().min(0).max(20),
		motion: z.enum(['static', 'ambient', 'reactive']),
		reducedMotion: z.enum(['unchanged', 'frozen', 'hidden']),
		description: z.string().min(1).max(240)
	})
	.strict();

export const SettlementSceneDefinitionSchema = z
	.object({
		schemaVersion: z.literal('settlement-scene-v1'),
		sceneVersion: ContentVersionSchema,
		status: z.literal('approval-candidate'),
		settlementContentVersion: ContentVersionSchema,
		settlementContentHash: StateHashSchema,
		camera: z.literal('high-three-quarter'),
		createdAt: IsoDateTimeSchema,
		generation: z
			.object({
				mode: z.literal('built-in-imagegen'),
				prompt: z.string().min(1).max(20_000),
				references: z
					.array(
						z
							.object({
								file: z
									.string()
									.regex(/^(?:assets|docs)\/[a-z0-9./-]+\.png$/u)
									.refine((value) => !value.includes('..'), {
										message: 'Scene reference path cannot traverse directories'
									}),
								contentHash: StateHashSchema,
								role: z.enum(['visual-style', 'spatial-layout'])
							})
							.strict()
					)
					.length(2)
			})
			.strict(),
		source: z
			.object({
				file: z
					.string()
					.regex(/^assets\/settlements\/[a-z0-9./-]+\.png$/u)
					.refine((value) => !value.includes('..'), {
						message: 'Scene source path cannot traverse directories'
					}),
				width: z.number().int().positive().max(8_192),
				height: z.number().int().positive().max(8_192),
				bytes: z.number().int().positive(),
				contentHash: StateHashSchema
			})
			.strict(),
		runtime: z
			.object({
				file: z
					.string()
					.regex(/^apps\/web\/static\/runtime\/settlements\/[a-z0-9./-]+\.webp$/u)
					.refine((value) => !value.includes('..'), {
						message: 'Scene runtime path cannot traverse directories'
					}),
				publicPath: z.string().regex(/^\/runtime\/settlements\/[a-z0-9./-]+\.webp$/u),
				width: z.number().int().positive().max(4_096),
				height: z.number().int().positive().max(4_096),
				bytes: z.number().int().positive(),
				contentHash: StateHashSchema,
				budgetBytes: z.number().int().positive(),
				budgetStatus: z.literal('within-budget'),
				decodedRgbaBytes: z.number().int().positive(),
				decodedMemoryBudgetBytes: z.number().int().positive(),
				decodedMemoryStatus: z.literal('within-budget'),
				encoder: z
					.object({
						format: z.literal('webp'),
						quality: z.number().int().min(1).max(100),
						effort: z.number().int().min(0).max(6),
						preset: z.literal('picture'),
						smartSubsample: z.literal(true),
						metadata: z.literal('stripped')
					})
					.strict()
			})
			.strict(),
		layers: z.array(SettlementSceneLayerSchema).length(6),
		hotspots: z
			.array(
				z
					.object({
						buildingId: SceneSlugSchema,
						entranceNodeId: SceneSlugSchema,
						center: NormalizedScenePointSchema,
						bounds: NormalizedSceneBoundsSchema
					})
					.strict()
			)
			.length(5),
		nodeProjections: z
			.array(
				z
					.object({
						nodeId: SceneSlugSchema,
						point: NormalizedScenePointSchema
					})
					.strict()
			)
			.min(15)
			.max(100),
		sceneHash: StateHashSchema
	})
	.strict()
	.superRefine((scene, context) => {
		if (scene.runtime.bytes > scene.runtime.budgetBytes) {
			context.addIssue({ code: 'custom', message: 'Settlement scene runtime exceeds its budget' });
		}
		if (scene.runtime.decodedRgbaBytes !== scene.runtime.width * scene.runtime.height * 4) {
			context.addIssue({ code: 'custom', message: 'Settlement scene decoded size is stale' });
		}
		if (scene.runtime.decodedRgbaBytes > scene.runtime.decodedMemoryBudgetBytes) {
			context.addIssue({
				code: 'custom',
				message: 'Settlement scene decoded memory exceeds its budget'
			});
		}
		if (
			scene.source.width !== scene.runtime.width ||
			scene.source.height !== scene.runtime.height
		) {
			context.addIssue({ code: 'custom', message: 'Runtime scene dimensions drifted from source' });
		}
		const layerIds = new Set(scene.layers.map((layer) => layer.layerId));
		const layerKinds = new Set(scene.layers.map((layer) => layer.kind));
		const layerDepths = new Set(scene.layers.map((layer) => layer.depth));
		if (layerIds.size !== scene.layers.length || layerDepths.size !== scene.layers.length) {
			context.addIssue({ code: 'custom', message: 'Scene layer ids and depths must be unique' });
		}
		for (const kind of SettlementSceneLayerKindSchema.options) {
			if (!layerKinds.has(kind)) {
				context.addIssue({ code: 'custom', message: `Scene layer kind is missing: ${kind}` });
			}
		}
		if (new Set(scene.hotspots.map((hotspot) => hotspot.buildingId)).size !== 5) {
			context.addIssue({
				code: 'custom',
				message: 'Scene hotspots must reference unique buildings'
			});
		}
		for (const hotspot of scene.hotspots) {
			if (
				hotspot.center.x < hotspot.bounds.x ||
				hotspot.center.x > hotspot.bounds.x + hotspot.bounds.width ||
				hotspot.center.y < hotspot.bounds.y ||
				hotspot.center.y > hotspot.bounds.y + hotspot.bounds.height
			) {
				context.addIssue({
					code: 'custom',
					message: `Scene hotspot center escaped its bounds: ${hotspot.buildingId}`
				});
			}
		}
		if (
			new Set(scene.nodeProjections.map((projection) => projection.nodeId)).size !==
			scene.nodeProjections.length
		) {
			context.addIssue({ code: 'custom', message: 'Scene node projections must be unique' });
		}
	});

export type NormalizedScenePoint = z.infer<typeof NormalizedScenePointSchema>;
export type SettlementSceneDefinition = z.infer<typeof SettlementSceneDefinitionSchema>;
export type SettlementSceneLayer = z.infer<typeof SettlementSceneLayerSchema>;

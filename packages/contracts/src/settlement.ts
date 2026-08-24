import { z } from 'zod';

import { ContentVersionSchema, StateHashSchema } from './shared.js';

export const SettlementSlugSchema = z.string().regex(/^[a-z][a-z0-9-]{2,79}$/u);

export const SettlementBuildingKindSchema = z.enum([
	'summoning-gate',
	'kitchen',
	'dormitory',
	'training-ground',
	'workshop'
]);

export const SettlementNodeKindSchema = z.enum([
	'courtyard',
	'entrance',
	'gate',
	'room',
	'station',
	'social',
	'bed'
]);

export const SettlementInteractionSchema = z.enum([
	'summon',
	'inspect',
	'first-meeting',
	'assign',
	'cook',
	'eat',
	'shared-meal',
	'sleep',
	'rest',
	'privacy',
	'practice',
	'teach',
	'spar',
	'repair',
	'craft',
	'inspect-equipment'
]);

export const SettlementSimulationEffectSchema = z.enum([
	'roster',
	'clean-slate-onboarding',
	'hunger',
	'social-contact',
	'food-ledger',
	'fatigue',
	'recovery',
	'roommate-contact',
	'skill-progress',
	'injury-risk',
	'habit-reinforcement',
	'durability',
	'equipment-upgrades',
	'resource-ledger'
]);

export const SettlementPointSchema = z
	.object({
		x: z.number().int().min(0).max(4_096),
		y: z.number().int().min(0).max(4_096)
	})
	.strict();

export const SettlementAccessRuleSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('open'), systemId: z.null() }).strict(),
	z
		.object({
			kind: z.literal('requires-system'),
			systemId: SettlementSlugSchema
		})
		.strict()
]);

export const SettlementRouteNodeSchema = z
	.object({
		nodeId: SettlementSlugSchema,
		label: z.string().min(1).max(100),
		kind: SettlementNodeKindSchema,
		buildingId: SettlementSlugSchema.nullable(),
		capacity: z.number().int().min(1).max(30),
		mapPosition: SettlementPointSchema,
		interiorPosition: SettlementPointSchema.nullable(),
		interactionTags: z.array(SettlementInteractionSchema).max(8)
	})
	.strict();

export const SettlementRouteEdgeSchema = z
	.object({
		edgeId: SettlementSlugSchema,
		fromNodeId: SettlementSlugSchema,
		toNodeId: SettlementSlugSchema,
		bidirectional: z.boolean(),
		travelGameSeconds: z.number().int().min(1).max(3_600),
		capacity: z.number().int().min(1).max(30),
		access: SettlementAccessRuleSchema,
		visualPath: z.array(SettlementPointSchema).min(2).max(12)
	})
	.strict();

export const SettlementInteriorLayerSchema = z
	.object({
		layerId: SettlementSlugSchema,
		depth: z.enum(['back', 'mid', 'front']),
		description: z.string().min(1).max(180)
	})
	.strict();

export const SettlementBuildingSchema = z
	.object({
		buildingId: SettlementSlugSchema,
		kind: SettlementBuildingKindSchema,
		label: z.string().min(1).max(100),
		shortLabel: z.string().min(1).max(24),
		summary: z.string().min(1).max(300),
		entranceNodeId: SettlementSlugSchema,
		systemId: SettlementSlugSchema,
		interactions: z.array(SettlementInteractionSchema).min(3).max(8),
		simulationEffects: z.array(SettlementSimulationEffectSchema).min(2).max(8),
		interior: z
			.object({
				focusNodeId: SettlementSlugSchema,
				nodeIds: z.array(SettlementSlugSchema).min(3).max(12),
				camera: z
					.object({
						x: z.number().int().min(0).max(1_000),
						y: z.number().int().min(0).max(1_000),
						zoom: z.number().min(0.5).max(2)
					})
					.strict(),
				ambientColor: z.string().regex(/^#[a-f0-9]{6}$/iu),
				caption: z.string().min(1).max(180),
				layers: z.array(SettlementInteriorLayerSchema).length(3)
			})
			.strict()
	})
	.strict()
	.superRefine((building, context) => {
		if (new Set(building.interactions).size !== building.interactions.length) {
			context.addIssue({ code: 'custom', message: 'Building interactions must be unique' });
		}
		if (new Set(building.simulationEffects).size !== building.simulationEffects.length) {
			context.addIssue({ code: 'custom', message: 'Building effects must be unique' });
		}
		if (new Set(building.interior.nodeIds).size !== building.interior.nodeIds.length) {
			context.addIssue({ code: 'custom', message: 'Interior node ids must be unique' });
		}
		const layerDepths = new Set(building.interior.layers.map((layer) => layer.depth));
		if (layerDepths.size !== 3) {
			context.addIssue({
				code: 'custom',
				message: 'Every interior requires back, mid, and front layers'
			});
		}
	});

export const SettlementDefinitionSchema = z
	.object({
		schemaVersion: z.literal('settlement-definition-v1'),
		contentVersion: ContentVersionSchema,
		settlementId: SettlementSlugSchema,
		displayName: z.string().min(1).max(100),
		tagline: z.string().min(1).max(180),
		design: z
			.object({
				width: z.number().int().min(640).max(4_096),
				height: z.number().int().min(360).max(4_096),
				camera: z.literal('high-three-quarter'),
				wallBoundary: z.array(SettlementPointSchema).min(4).max(24)
			})
			.strict(),
		spawnNodeId: SettlementSlugSchema,
		buildings: z.array(SettlementBuildingSchema).length(5),
		nodes: z.array(SettlementRouteNodeSchema).min(15).max(100),
		edges: z.array(SettlementRouteEdgeSchema).min(14).max(200),
		contentHash: StateHashSchema
	})
	.strict()
	.superRefine((settlement, context) => {
		const buildingById = new Map(
			settlement.buildings.map((building) => [building.buildingId, building])
		);
		const nodeById = new Map(settlement.nodes.map((node) => [node.nodeId, node]));
		const buildingKinds = new Set(settlement.buildings.map((building) => building.kind));
		if (buildingById.size !== settlement.buildings.length) {
			context.addIssue({ code: 'custom', message: 'Settlement building ids must be unique' });
		}
		if (buildingKinds.size !== SettlementBuildingKindSchema.options.length) {
			context.addIssue({
				code: 'custom',
				message: 'Settlement requires exactly one of each building kind'
			});
		}
		if (nodeById.size !== settlement.nodes.length) {
			context.addIssue({ code: 'custom', message: 'Settlement node ids must be unique' });
		}
		if (!nodeById.has(settlement.spawnNodeId)) {
			context.addIssue({ code: 'custom', message: 'Settlement spawn node is unknown' });
		}

		const systemIds = new Set(settlement.buildings.map((building) => building.systemId));
		if (systemIds.size !== settlement.buildings.length) {
			context.addIssue({
				code: 'custom',
				message: 'Settlement building system ids must be unique'
			});
		}
		for (const building of settlement.buildings) {
			const entrance = nodeById.get(building.entranceNodeId);
			if (
				!entrance ||
				entrance.buildingId !== building.buildingId ||
				entrance.kind !== 'entrance'
			) {
				context.addIssue({
					code: 'custom',
					message: `Building entrance is invalid: ${building.buildingId}`
				});
			}
			if (!building.interior.nodeIds.includes(building.interior.focusNodeId)) {
				context.addIssue({
					code: 'custom',
					message: `Interior focus is not listed: ${building.buildingId}`
				});
			}
			for (const nodeId of building.interior.nodeIds) {
				if (nodeById.get(nodeId)?.buildingId !== building.buildingId) {
					context.addIssue({
						code: 'custom',
						message: `Interior node belongs to another building: ${nodeId}`
					});
				}
			}
		}

		for (const node of settlement.nodes) {
			if (node.buildingId !== null && !buildingById.has(node.buildingId)) {
				context.addIssue({
					code: 'custom',
					message: `Node references unknown building: ${node.nodeId}`
				});
			}
			if (
				node.mapPosition.x > settlement.design.width ||
				node.mapPosition.y > settlement.design.height
			) {
				context.addIssue({
					code: 'custom',
					message: `Node lies outside design bounds: ${node.nodeId}`
				});
			}
		}

		const edgeIds = new Set<string>();
		const adjacency = new Map<string, Set<string>>(
			settlement.nodes.map((node) => [node.nodeId, new Set<string>()])
		);
		for (const edge of settlement.edges) {
			if (edgeIds.has(edge.edgeId)) {
				context.addIssue({ code: 'custom', message: `Duplicate settlement edge: ${edge.edgeId}` });
			}
			edgeIds.add(edge.edgeId);
			const from = nodeById.get(edge.fromNodeId);
			const to = nodeById.get(edge.toNodeId);
			if (!from || !to || edge.fromNodeId === edge.toNodeId) {
				context.addIssue({
					code: 'custom',
					message: `Settlement edge endpoints are invalid: ${edge.edgeId}`
				});
				continue;
			}
			const firstPoint = edge.visualPath[0];
			const lastPoint = edge.visualPath.at(-1);
			if (
				firstPoint?.x !== from.mapPosition.x ||
				firstPoint.y !== from.mapPosition.y ||
				lastPoint?.x !== to.mapPosition.x ||
				lastPoint.y !== to.mapPosition.y
			) {
				context.addIssue({
					code: 'custom',
					message: `Visual path endpoints drifted: ${edge.edgeId}`
				});
			}
			if (edge.access.kind === 'requires-system' && !systemIds.has(edge.access.systemId)) {
				context.addIssue({
					code: 'custom',
					message: `Edge requires unknown system: ${edge.edgeId}`
				});
			}
			adjacency.get(edge.fromNodeId)?.add(edge.toNodeId);
			if (edge.bidirectional) adjacency.get(edge.toNodeId)?.add(edge.fromNodeId);
		}

		const visited = new Set<string>();
		const pending = [settlement.spawnNodeId];
		while (pending.length > 0) {
			const nodeId = pending.shift();
			if (!nodeId || visited.has(nodeId)) continue;
			visited.add(nodeId);
			for (const neighbor of adjacency.get(nodeId) ?? []) pending.push(neighbor);
		}
		if (visited.size !== settlement.nodes.length) {
			context.addIssue({
				code: 'custom',
				message: 'Settlement route graph is not structurally connected'
			});
		}
	});

export const SettlementRouteStepSchema = z
	.object({
		edgeId: SettlementSlugSchema,
		fromNodeId: SettlementSlugSchema,
		toNodeId: SettlementSlugSchema,
		travelGameSeconds: z.number().int().positive()
	})
	.strict();

export const SettlementRoutePlanSchema = z
	.object({
		fromNodeId: SettlementSlugSchema,
		toNodeId: SettlementSlugSchema,
		nodeIds: z.array(SettlementSlugSchema).min(1),
		steps: z.array(SettlementRouteStepSchema),
		totalTravelGameSeconds: z.number().int().nonnegative(),
		bottleneckCapacity: z.number().int().positive()
	})
	.strict()
	.superRefine((route, context) => {
		if (route.nodeIds[0] !== route.fromNodeId || route.nodeIds.at(-1) !== route.toNodeId) {
			context.addIssue({
				code: 'custom',
				message: 'Settlement route endpoints do not match its nodes'
			});
		}
		if (route.steps.length !== route.nodeIds.length - 1) {
			context.addIssue({ code: 'custom', message: 'Settlement route step count is inconsistent' });
		}
		const duration = route.steps.reduce((total, step) => total + step.travelGameSeconds, 0);
		if (duration !== route.totalTravelGameSeconds) {
			context.addIssue({ code: 'custom', message: 'Settlement route duration is inconsistent' });
		}
	});

export type SettlementAccessRule = z.infer<typeof SettlementAccessRuleSchema>;
export type SettlementBuilding = z.infer<typeof SettlementBuildingSchema>;
export type SettlementBuildingKind = z.infer<typeof SettlementBuildingKindSchema>;
export type SettlementDefinition = z.infer<typeof SettlementDefinitionSchema>;
export type SettlementInteraction = z.infer<typeof SettlementInteractionSchema>;
export type SettlementRouteEdge = z.infer<typeof SettlementRouteEdgeSchema>;
export type SettlementRouteNode = z.infer<typeof SettlementRouteNodeSchema>;
export type SettlementRoutePlan = z.infer<typeof SettlementRoutePlanSchema>;

import { z } from 'zod';

import { ContentVersionSchema, StateHashSchema } from './shared.js';

export const MissionSlugSchema = z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u);

export const MissionPointSchema = z
	.object({
		x: z.number().int().min(0).max(4_096),
		y: z.number().int().min(0).max(4_096)
	})
	.strict();

export const MissionNodeRoleSchema = z.enum([
	'deployment',
	'extraction',
	'objective',
	'encounter',
	'secret'
]);

export const MissionArenaNodeSchema = z
	.object({
		nodeId: MissionSlugSchema,
		label: z.string().min(1).max(100),
		summary: z.string().min(1).max(280),
		kind: z.enum(['threshold', 'chamber', 'passage', 'objective', 'vantage', 'hazard']),
		roles: z.array(MissionNodeRoleSchema).max(5),
		position: MissionPointSchema,
		elevation: z.enum(['low', 'level', 'high']),
		capacity: z.number().int().min(1).max(20),
		initialKnowledge: z.enum(['known', 'concealed']),
		observationIds: z.array(MissionSlugSchema).max(12),
		affordanceIds: z.array(MissionSlugSchema).max(12)
	})
	.strict()
	.superRefine((node, context) => {
		for (const [label, values] of [
			['roles', node.roles],
			['observation ids', node.observationIds],
			['affordance ids', node.affordanceIds]
		] as const) {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', message: `Mission node ${label} must be unique` });
			}
		}
	});

export const MissionArenaAccessRuleSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('open'), discoveryId: z.null() }).strict(),
	z
		.object({
			kind: z.literal('requires-discovery'),
			discoveryId: MissionSlugSchema
		})
		.strict()
]);

export const MissionExposureSchema = z.enum(['low', 'guarded', 'exposed']);

export const MissionArenaEdgeSchema = z
	.object({
		edgeId: MissionSlugSchema,
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		bidirectional: z.boolean(),
		traversalActions: z.number().int().min(1).max(12),
		exposure: MissionExposureSchema,
		access: MissionArenaAccessRuleSchema,
		visualPath: z.array(MissionPointSchema).min(2).max(12)
	})
	.strict();

export const MissionObservationSchema = z
	.object({
		observationId: MissionSlugSchema,
		nodeId: MissionSlugSchema,
		kind: z.enum(['sight', 'sound', 'heat', 'trace', 'lore']),
		summary: z.string().min(1).max(320),
		reveal: z.discriminatedUnion('kind', [
			z.object({ kind: z.literal('on-entry'), discoveryId: z.null() }).strict(),
			z
				.object({
					kind: z.literal('discovery'),
					discoveryId: MissionSlugSchema
				})
				.strict()
		])
	})
	.strict();

export const MissionDiscoverySchema = z
	.object({
		discoveryId: MissionSlugSchema,
		kind: z.enum(['route', 'fact', 'weakness', 'resource']),
		title: z.string().min(1).max(100),
		summary: z.string().min(1).max(320),
		revealNodeIds: z.array(MissionSlugSchema).max(12),
		revealEdgeIds: z.array(MissionSlugSchema).max(12),
		revealObservationIds: z.array(MissionSlugSchema).max(12),
		canonicalFact: z.string().min(1).max(320).nullable()
	})
	.strict()
	.superRefine((discovery, context) => {
		for (const values of [
			discovery.revealNodeIds,
			discovery.revealEdgeIds,
			discovery.revealObservationIds
		]) {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', message: 'Discovery reveal ids must be unique' });
			}
		}
		if (
			discovery.canonicalFact === null &&
			discovery.revealNodeIds.length === 0 &&
			discovery.revealEdgeIds.length === 0 &&
			discovery.revealObservationIds.length === 0
		) {
			context.addIssue({ code: 'custom', message: 'A discovery must reveal canonical content' });
		}
	});

export const MissionDiscoveryAffordanceSchema = z
	.object({
		affordanceId: MissionSlugSchema,
		nodeId: MissionSlugSchema,
		kind: z.enum(['inspect', 'search', 'listen', 'test', 'manipulate']),
		label: z.string().min(1).max(100),
		description: z.string().min(1).max(320),
		timeActions: z.number().int().min(1).max(6),
		requiresDiscoveryIds: z.array(MissionSlugSchema).max(8),
		requiredToolTags: z.array(MissionSlugSchema).max(8),
		blockedByDiscoveryIds: z.array(MissionSlugSchema).max(8),
		outcomeDiscoveryIds: z.array(MissionSlugSchema).min(1).max(8)
	})
	.strict()
	.superRefine((affordance, context) => {
		for (const values of [
			affordance.requiresDiscoveryIds,
			affordance.requiredToolTags,
			affordance.blockedByDiscoveryIds,
			affordance.outcomeDiscoveryIds
		]) {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', message: 'Affordance requirements must be unique' });
			}
		}
		if (
			affordance.requiresDiscoveryIds.some((id) => affordance.blockedByDiscoveryIds.includes(id))
		) {
			context.addIssue({
				code: 'custom',
				message: 'An affordance cannot require and be blocked by the same discovery'
			});
		}
	});

export const MissionArenaSchema = z
	.object({
		nodes: z.array(MissionArenaNodeSchema).min(3).max(80),
		edges: z.array(MissionArenaEdgeSchema).min(2).max(160),
		observations: z.array(MissionObservationSchema).min(1).max(160),
		discoveries: z.array(MissionDiscoverySchema).min(1).max(40),
		discoveryAffordances: z.array(MissionDiscoveryAffordanceSchema).min(1).max(80)
	})
	.strict();

export const MissionDeploymentSchema = z
	.object({
		entryNodeIds: z.array(MissionSlugSchema).min(1).max(4),
		extractionNodeIds: z.array(MissionSlugSchema).min(1).max(4),
		minimumPartyMembers: z.number().int().min(1).max(8),
		maximumPartyMembers: z.number().int().min(1).max(8),
		masterRequired: z.literal(true),
		masterCountsTowardLimit: z.literal(true),
		reserveAllowed: z.literal(false)
	})
	.strict()
	.superRefine((deployment, context) => {
		if (deployment.minimumPartyMembers > deployment.maximumPartyMembers) {
			context.addIssue({ code: 'custom', message: 'Mission party bounds are inverted' });
		}
		if (
			new Set(deployment.entryNodeIds).size !== deployment.entryNodeIds.length ||
			new Set(deployment.extractionNodeIds).size !== deployment.extractionNodeIds.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission boundary node ids must be unique' });
		}
	});

export const MissionObjectiveCompletionRuleSchema = z.discriminatedUnion('kind', [
	z
		.object({
			kind: z.literal('recover-ledger-item'),
			itemKey: MissionSlugSchema,
			amount: z.number().int().positive(),
			returnToNodeId: MissionSlugSchema
		})
		.strict(),
	z
		.object({
			kind: z.literal('reach-node'),
			nodeId: MissionSlugSchema,
			minimumSurvivors: z.number().int().positive()
		})
		.strict(),
	z
		.object({
			kind: z.literal('defeat-duty'),
			dutySlotId: MissionSlugSchema
		})
		.strict(),
	z
		.object({
			kind: z.literal('survive-turns'),
			turns: z.number().int().positive().max(1_000)
		})
		.strict(),
	z
		.object({
			kind: z.literal('control-node'),
			nodeId: MissionSlugSchema,
			turns: z.number().int().positive().max(100)
		})
		.strict()
]);

export const MissionObjectiveSchema = z
	.object({
		objectiveId: MissionSlugSchema,
		primary: z.boolean(),
		kind: z.enum(['recover', 'reach', 'defeat', 'survive', 'control', 'discover']),
		title: z.string().min(1).max(120),
		summary: z.string().min(1).max(320),
		targetNodeIds: z.array(MissionSlugSchema).min(1).max(8),
		completionRule: MissionObjectiveCompletionRuleSchema,
		failureRules: z
			.array(
				z.enum(['master-death', 'party-incapacitated', 'objective-destroyed', 'timer-expired'])
			)
			.min(1)
			.max(4)
	})
	.strict();

export const MissionMonsterDutySlotSchema = z
	.object({
		dutySlotId: MissionSlugSchema,
		policyId: MissionSlugSchema,
		spawnNodeId: MissionSlugSchema,
		count: z
			.object({ min: z.number().int().min(1).max(20), max: z.number().int().min(1).max(20) })
			.strict(),
		activation: z.discriminatedUnion('kind', [
			z.object({ kind: z.literal('on-deployment'), discoveryId: z.null() }).strict(),
			z.object({ kind: z.literal('on-discovery'), discoveryId: MissionSlugSchema }).strict()
		]),
		tags: z.array(MissionSlugSchema).max(8)
	})
	.strict()
	.superRefine((slot, context) => {
		if (slot.count.min > slot.count.max) {
			context.addIssue({ code: 'custom', message: 'Monster duty count bounds are inverted' });
		}
		if (new Set(slot.tags).size !== slot.tags.length) {
			context.addIssue({ code: 'custom', message: 'Monster duty tags must be unique' });
		}
	});

export const MissionMonsterBehaviorSchema = z.enum([
	'guard-duty-node',
	'protect-objective',
	'foundry-warden'
]);

export const MissionMonsterArmorSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('none'), reduction: z.literal(0) }).strict(),
	z
		.object({
			kind: z.literal('furnace-linked'),
			litReduction: z.number().int().min(1).max(20),
			coolingReduction: z.number().int().min(0).max(20),
			quenchedReduction: z.number().int().min(0).max(20)
		})
		.strict()
]);

export const MissionMonsterPolicyDefinitionSchema = z
	.object({
		policyId: MissionSlugSchema,
		label: z.string().min(1).max(100),
		entityLabel: z.string().min(1).max(80),
		archetype: z.enum(['goblin', 'construct']),
		behavior: MissionMonsterBehaviorSchema,
		maximumVitality: z.number().int().min(1).max(1_000),
		initiativeBase: z.number().int().min(0).max(1_000),
		strikePower: z.number().int().min(0).max(100),
		armor: MissionMonsterArmorSchema,
		intentSummary: z.string().min(1).max(240)
	})
	.strict();

export const MissionMonsterPolicyCatalogSchema = z
	.object({
		schemaVersion: z.literal('monster-policy-catalog-v1'),
		contentVersion: ContentVersionSchema,
		policies: z.array(MissionMonsterPolicyDefinitionSchema).min(1).max(100),
		contentHash: StateHashSchema
	})
	.strict()
	.superRefine((catalog, context) => {
		if (
			new Set(catalog.policies.map((policy) => policy.policyId)).size !== catalog.policies.length
		) {
			context.addIssue({ code: 'custom', message: 'Monster policy ids must be unique' });
		}
	});

export const MissionEnvironmentalEventSchema = z
	.object({
		eventId: MissionSlugSchema,
		policyId: MissionSlugSchema,
		trigger: z.discriminatedUnion('kind', [
			z
				.object({
					kind: z.literal('turn-interval'),
					firstTurn: z.number().int().positive(),
					everyTurns: z.number().int().positive()
				})
				.strict(),
			z
				.object({
					kind: z.literal('on-discovery'),
					discoveryId: MissionSlugSchema
				})
				.strict()
		]),
		maximumOccurrences: z.number().int().positive().max(100)
	})
	.strict();

export const MissionLegalToolSchema = z
	.object({
		toolId: MissionSlugSchema,
		actionKind: z.enum(['move', 'attack', 'defend', 'assist', 'inspect', 'interact', 'retreat']),
		label: z.string().min(1).max(100),
		availableAtRoles: z.array(MissionNodeRoleSchema).max(5),
		requiredEquipmentTags: z.array(MissionSlugSchema).max(8)
	})
	.strict();

export const MissionRewardGrantSchema = z
	.object({
		grantId: MissionSlugSchema,
		trigger: z.enum(['success', 'optional-objective', 'discovery', 'no-casualty']),
		kind: z.enum(['resource', 'experience', 'system-choice', 'story-token']),
		key: MissionSlugSchema,
		amount: z.number().int().positive(),
		budgetCost: z.number().int().nonnegative()
	})
	.strict();

export const MissionStoryBeatSchema = z
	.object({
		beatId: MissionSlugSchema,
		kind: z.enum([
			'opening',
			'pressure',
			'discovery',
			'choice',
			'confrontation',
			'recovery',
			'extraction'
		]),
		required: z.boolean(),
		title: z.string().min(1).max(120),
		summary: z.string().min(1).max(360),
		eligibleAfterBeatIds: z.array(MissionSlugSchema).max(8)
	})
	.strict();

export const MissionStoryEnvelopeSchema = z
	.object({
		storySpineId: MissionSlugSchema,
		bandTheme: z.string().min(1).max(200),
		openingQuestion: z.string().min(1).max(240),
		beats: z.array(MissionStoryBeatSchema).min(3).max(30),
		defaultBeatOrder: z.array(MissionSlugSchema).min(3).max(30),
		anchors: z
			.array(
				z
					.object({
						anchorId: MissionSlugSchema,
						order: z.number().int().positive(),
						beatId: MissionSlugSchema,
						immutableFact: z.string().min(1).max(360)
					})
					.strict()
			)
			.min(2)
			.max(20),
		proposalCatalog: z
			.array(
				z
					.object({
						proposalId: MissionSlugSchema,
						kind: z.enum(['optional-beat', 'complication', 'role-expression']),
						beatId: MissionSlugSchema,
						summary: z.string().min(1).max(320)
					})
					.strict()
			)
			.max(20),
		patchSlots: z
			.array(
				z
					.object({
						slotId: MissionSlugSchema,
						afterAnchorId: MissionSlugSchema,
						beforeAnchorId: MissionSlugSchema,
						allowedProposalIds: z.array(MissionSlugSchema).min(1).max(8),
						maximumSelections: z.number().int().min(1).max(3)
					})
					.strict()
			)
			.max(8),
		forbiddenChanges: z.tuple([
			z.literal('world-laws'),
			z.literal('primary-objective'),
			z.literal('arena-truth'),
			z.literal('reward-budget'),
			z.literal('required-anchors')
		])
	})
	.strict();

function structurallyReachable(
	startNodeId: string,
	edges: readonly z.infer<typeof MissionArenaEdgeSchema>[],
	includeEdge: (edge: z.infer<typeof MissionArenaEdgeSchema>) => boolean
): Set<string> {
	const adjacency = new Map<string, string[]>();
	for (const edge of edges.filter(includeEdge)) {
		const forward = adjacency.get(edge.fromNodeId) ?? [];
		forward.push(edge.toNodeId);
		adjacency.set(edge.fromNodeId, forward);
		if (edge.bidirectional) {
			const reverse = adjacency.get(edge.toNodeId) ?? [];
			reverse.push(edge.fromNodeId);
			adjacency.set(edge.toNodeId, reverse);
		}
	}
	const visited = new Set<string>();
	const pending = [startNodeId];
	while (pending.length > 0) {
		const nodeId = pending.shift();
		if (!nodeId || visited.has(nodeId)) continue;
		visited.add(nodeId);
		pending.push(...(adjacency.get(nodeId) ?? []));
	}
	return visited;
}

export const MissionPackageSchema = z
	.object({
		schemaVersion: z.literal('mission-package-v1'),
		contentVersion: ContentVersionSchema,
		missionId: MissionSlugSchema,
		kind: z.enum(['tower-floor', 'portal-world']),
		displayName: z.string().min(1).max(120),
		tagline: z.string().min(1).max(220),
		tower: z
			.object({
				floor: z.number().int().min(1).max(100),
				band: z.number().int().min(1).max(20),
				floorInBand: z.number().int().min(1).max(5)
			})
			.strict()
			.nullable(),
		design: z
			.object({
				width: z.number().int().min(640).max(4_096),
				height: z.number().int().min(360).max(4_096),
				camera: z.literal('tactical-three-quarter')
			})
			.strict(),
		deployment: MissionDeploymentSchema,
		objectives: z.array(MissionObjectiveSchema).min(1).max(12),
		arena: MissionArenaSchema,
		encounterSeedRules: z
			.object({
				schemaVersion: z.literal('mission-entropy-v1'),
				namespace: MissionSlugSchema,
				namedPurposes: z.array(MissionSlugSchema).min(1).max(30)
			})
			.strict(),
		monsterDuties: z.array(MissionMonsterDutySlotSchema).min(1).max(30),
		environmentalEvents: z.array(MissionEnvironmentalEventSchema).max(30),
		legalTools: z.array(MissionLegalToolSchema).min(3).max(30),
		retreat: z
			.object({
				policy: z.literal('authored-extraction-nodes'),
				nodeIds: z.array(MissionSlugSchema).min(1).max(4),
				preservesPrimaryObjective: z.boolean()
			})
			.strict(),
		rewards: z
			.object({
				budgetPoints: z.number().int().positive(),
				grants: z.array(MissionRewardGrantSchema).min(1).max(20)
			})
			.strict(),
		story: MissionStoryEnvelopeSchema,
		contentHash: StateHashSchema
	})
	.strict()
	.superRefine((mission, context) => {
		if (mission.kind === 'tower-floor') {
			if (
				mission.tower === null ||
				Math.ceil(mission.tower.floor / 5) !== mission.tower.band ||
				((mission.tower.floor - 1) % 5) + 1 !== mission.tower.floorInBand
			) {
				context.addIssue({
					code: 'custom',
					message: 'Tower floor band coordinates are inconsistent'
				});
			}
		} else if (mission.tower !== null) {
			context.addIssue({
				code: 'custom',
				message: 'Portal missions cannot declare tower coordinates'
			});
		}

		const uniqueBy = <T>(values: readonly T[], key: (value: T) => string, label: string) => {
			if (new Set(values.map(key)).size !== values.length) {
				context.addIssue({ code: 'custom', message: `${label} ids must be unique` });
			}
		};
		uniqueBy(mission.arena.nodes, (value) => value.nodeId, 'Arena node');
		uniqueBy(mission.arena.edges, (value) => value.edgeId, 'Arena edge');
		uniqueBy(mission.arena.observations, (value) => value.observationId, 'Observation');
		uniqueBy(mission.arena.discoveries, (value) => value.discoveryId, 'Discovery');
		uniqueBy(
			mission.arena.discoveryAffordances,
			(value) => value.affordanceId,
			'Discovery affordance'
		);
		uniqueBy(mission.objectives, (value) => value.objectiveId, 'Objective');
		uniqueBy(mission.monsterDuties, (value) => value.dutySlotId, 'Monster duty');
		uniqueBy(mission.environmentalEvents, (value) => value.eventId, 'Environmental event');
		uniqueBy(mission.legalTools, (value) => value.toolId, 'Legal tool');
		uniqueBy(mission.rewards.grants, (value) => value.grantId, 'Reward grant');

		const nodes = new Map(mission.arena.nodes.map((node) => [node.nodeId, node]));
		const edges = new Map(mission.arena.edges.map((edge) => [edge.edgeId, edge]));
		const observations = new Map(
			mission.arena.observations.map((observation) => [observation.observationId, observation])
		);
		const discoveries = new Map(
			mission.arena.discoveries.map((discovery) => [discovery.discoveryId, discovery])
		);
		const affordances = new Map(
			mission.arena.discoveryAffordances.map((affordance) => [affordance.affordanceId, affordance])
		);

		for (const node of mission.arena.nodes) {
			if (node.position.x > mission.design.width || node.position.y > mission.design.height) {
				context.addIssue({
					code: 'custom',
					message: `Arena node lies outside design: ${node.nodeId}`
				});
			}
			for (const observationId of node.observationIds) {
				if (observations.get(observationId)?.nodeId !== node.nodeId) {
					context.addIssue({
						code: 'custom',
						message: `Node observation reference is invalid: ${node.nodeId}`
					});
				}
			}
			for (const affordanceId of node.affordanceIds) {
				if (affordances.get(affordanceId)?.nodeId !== node.nodeId) {
					context.addIssue({
						code: 'custom',
						message: `Node affordance reference is invalid: ${node.nodeId}`
					});
				}
			}
		}

		for (const observation of mission.arena.observations) {
			if (!nodes.has(observation.nodeId)) {
				context.addIssue({
					code: 'custom',
					message: `Observation node is unknown: ${observation.observationId}`
				});
			}
			if (
				observation.reveal.kind === 'discovery' &&
				!discoveries.has(observation.reveal.discoveryId)
			) {
				context.addIssue({
					code: 'custom',
					message: `Observation discovery is unknown: ${observation.observationId}`
				});
			}
		}

		for (const edge of mission.arena.edges) {
			const from = nodes.get(edge.fromNodeId);
			const to = nodes.get(edge.toNodeId);
			if (!from || !to || edge.fromNodeId === edge.toNodeId) {
				context.addIssue({
					code: 'custom',
					message: `Arena edge endpoints are invalid: ${edge.edgeId}`
				});
				continue;
			}
			const first = edge.visualPath[0];
			const last = edge.visualPath.at(-1);
			if (
				first?.x !== from.position.x ||
				first.y !== from.position.y ||
				last?.x !== to.position.x ||
				last.y !== to.position.y
			) {
				context.addIssue({
					code: 'custom',
					message: `Arena path endpoints drifted: ${edge.edgeId}`
				});
			}
			if (edge.access.kind === 'requires-discovery') {
				const discovery = discoveries.get(edge.access.discoveryId);
				if (!discovery?.revealEdgeIds.includes(edge.edgeId)) {
					context.addIssue({
						code: 'custom',
						message: `Restricted edge is not revealed by its discovery: ${edge.edgeId}`
					});
				}
			}
			if (
				(from.initialKnowledge === 'concealed' || to.initialKnowledge === 'concealed') &&
				edge.access.kind !== 'requires-discovery'
			) {
				context.addIssue({
					code: 'custom',
					message: `Concealed topology leaks through edge: ${edge.edgeId}`
				});
			}
		}

		for (const discovery of mission.arena.discoveries) {
			for (const nodeId of discovery.revealNodeIds) {
				if (!nodes.has(nodeId))
					context.addIssue({ code: 'custom', message: `Discovery node is unknown: ${nodeId}` });
			}
			for (const edgeId of discovery.revealEdgeIds) {
				if (!edges.has(edgeId))
					context.addIssue({ code: 'custom', message: `Discovery edge is unknown: ${edgeId}` });
			}
			for (const observationId of discovery.revealObservationIds) {
				if (!observations.has(observationId)) {
					context.addIssue({
						code: 'custom',
						message: `Discovery observation is unknown: ${observationId}`
					});
				}
			}
			if (
				!mission.arena.discoveryAffordances.some((value) =>
					value.outcomeDiscoveryIds.includes(discovery.discoveryId)
				)
			) {
				context.addIssue({
					code: 'custom',
					message: `Discovery has no legal affordance: ${discovery.discoveryId}`
				});
			}
		}

		for (const node of mission.arena.nodes.filter(
			(value) => value.initialKnowledge === 'concealed'
		)) {
			if (!mission.arena.discoveries.some((value) => value.revealNodeIds.includes(node.nodeId))) {
				context.addIssue({
					code: 'custom',
					message: `Concealed node cannot be discovered: ${node.nodeId}`
				});
			}
		}

		for (const affordance of mission.arena.discoveryAffordances) {
			if (!nodes.has(affordance.nodeId)) {
				context.addIssue({
					code: 'custom',
					message: `Affordance node is unknown: ${affordance.affordanceId}`
				});
			}
			for (const discoveryId of [
				...affordance.requiresDiscoveryIds,
				...affordance.blockedByDiscoveryIds,
				...affordance.outcomeDiscoveryIds
			]) {
				if (!discoveries.has(discoveryId)) {
					context.addIssue({
						code: 'custom',
						message: `Affordance discovery is unknown: ${affordance.affordanceId}`
					});
				}
			}
		}

		for (const nodeId of mission.deployment.entryNodeIds) {
			const node = nodes.get(nodeId);
			if (!node?.roles.includes('deployment') || node.initialKnowledge !== 'known') {
				context.addIssue({
					code: 'custom',
					message: `Mission entry boundary is invalid: ${nodeId}`
				});
			}
		}
		for (const nodeId of mission.deployment.extractionNodeIds) {
			const node = nodes.get(nodeId);
			if (!node?.roles.includes('extraction') || node.initialKnowledge !== 'known') {
				context.addIssue({
					code: 'custom',
					message: `Mission extraction boundary is invalid: ${nodeId}`
				});
			}
		}
		if (
			mission.retreat.nodeIds.some(
				(nodeId) => !mission.deployment.extractionNodeIds.includes(nodeId)
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Retreat may only use authored extraction nodes'
			});
		}

		const primaryObjectives = mission.objectives.filter((objective) => objective.primary);
		if (primaryObjectives.length !== 1) {
			context.addIssue({
				code: 'custom',
				message: 'Mission requires exactly one primary objective'
			});
		}
		for (const objective of mission.objectives) {
			for (const nodeId of objective.targetNodeIds) {
				const node = nodes.get(nodeId);
				if (!node?.roles.includes('objective')) {
					context.addIssue({
						code: 'custom',
						message: `Objective target is invalid: ${objective.objectiveId}`
					});
				}
			}
			const rule = objective.completionRule;
			const referencedNodeId =
				rule.kind === 'recover-ledger-item'
					? rule.returnToNodeId
					: rule.kind === 'reach-node' || rule.kind === 'control-node'
						? rule.nodeId
						: null;
			if (referencedNodeId !== null && !nodes.has(referencedNodeId)) {
				context.addIssue({
					code: 'custom',
					message: `Objective rule node is unknown: ${objective.objectiveId}`
				});
			}
			if (
				rule.kind === 'defeat-duty' &&
				!mission.monsterDuties.some((duty) => duty.dutySlotId === rule.dutySlotId)
			) {
				context.addIssue({
					code: 'custom',
					message: `Objective duty is unknown: ${objective.objectiveId}`
				});
			}
		}

		for (const duty of mission.monsterDuties) {
			if (!nodes.get(duty.spawnNodeId)?.roles.includes('encounter')) {
				context.addIssue({
					code: 'custom',
					message: `Monster duty spawn is invalid: ${duty.dutySlotId}`
				});
			}
			if (
				duty.activation.kind === 'on-discovery' &&
				!discoveries.has(duty.activation.discoveryId)
			) {
				context.addIssue({
					code: 'custom',
					message: `Monster activation discovery is unknown: ${duty.dutySlotId}`
				});
			}
		}
		for (const event of mission.environmentalEvents) {
			if (event.trigger.kind === 'on-discovery' && !discoveries.has(event.trigger.discoveryId)) {
				context.addIssue({
					code: 'custom',
					message: `Environment discovery is unknown: ${event.eventId}`
				});
			}
		}

		const allReachable = structurallyReachable(
			mission.deployment.entryNodeIds[0]!,
			mission.arena.edges,
			() => true
		);
		if (allReachable.size !== mission.arena.nodes.length) {
			context.addIssue({
				code: 'custom',
				message: 'Authored arena graph is not structurally connected'
			});
		}
		const initialReachable = structurallyReachable(
			mission.deployment.entryNodeIds[0]!,
			mission.arena.edges,
			(edge) =>
				edge.access.kind === 'open' &&
				nodes.get(edge.fromNodeId)?.initialKnowledge === 'known' &&
				nodes.get(edge.toNodeId)?.initialKnowledge === 'known'
		);
		for (const nodeId of [
			...mission.deployment.extractionNodeIds,
			...primaryObjectives.flatMap((objective) => objective.targetNodeIds)
		]) {
			if (!initialReachable.has(nodeId)) {
				context.addIssue({
					code: 'custom',
					message: `Required node lacks an authored default route: ${nodeId}`
				});
			}
		}

		if (
			new Set(mission.encounterSeedRules.namedPurposes).size !==
			mission.encounterSeedRules.namedPurposes.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission entropy purposes must be unique' });
		}
		if (
			mission.rewards.grants.reduce((sum, grant) => sum + grant.budgetCost, 0) >
			mission.rewards.budgetPoints
		) {
			context.addIssue({ code: 'custom', message: 'Mission rewards exceed the authored budget' });
		}

		const beats = new Map(mission.story.beats.map((beat) => [beat.beatId, beat]));
		const anchors = new Map(mission.story.anchors.map((anchor) => [anchor.anchorId, anchor]));
		const proposals = new Map(
			mission.story.proposalCatalog.map((proposal) => [proposal.proposalId, proposal])
		);
		uniqueBy(mission.story.beats, (value) => value.beatId, 'Story beat');
		uniqueBy(mission.story.anchors, (value) => value.anchorId, 'Story anchor');
		uniqueBy(mission.story.proposalCatalog, (value) => value.proposalId, 'Story proposal');
		uniqueBy(mission.story.patchSlots, (value) => value.slotId, 'Story patch slot');
		if (new Set(mission.story.defaultBeatOrder).size !== mission.story.defaultBeatOrder.length) {
			context.addIssue({ code: 'custom', message: 'Default story beat order must be unique' });
		}
		for (const beat of mission.story.beats) {
			for (const priorId of beat.eligibleAfterBeatIds) {
				if (!beats.has(priorId) || priorId === beat.beatId) {
					context.addIssue({
						code: 'custom',
						message: `Story beat dependency is invalid: ${beat.beatId}`
					});
				}
			}
			if (beat.required && !mission.story.defaultBeatOrder.includes(beat.beatId)) {
				context.addIssue({
					code: 'custom',
					message: `Required beat is absent from default route: ${beat.beatId}`
				});
			}
		}
		for (const beatId of mission.story.defaultBeatOrder) {
			if (!beats.has(beatId))
				context.addIssue({ code: 'custom', message: `Default story beat is unknown: ${beatId}` });
		}
		const anchorOrders = mission.story.anchors.map((anchor) => anchor.order);
		if (new Set(anchorOrders).size !== anchorOrders.length) {
			context.addIssue({ code: 'custom', message: 'Story anchor order must be unique' });
		}
		for (const anchor of mission.story.anchors) {
			if (!beats.get(anchor.beatId)?.required) {
				context.addIssue({
					code: 'custom',
					message: `Story anchor must bind a required beat: ${anchor.anchorId}`
				});
			}
		}
		for (const proposal of mission.story.proposalCatalog) {
			if (beats.get(proposal.beatId)?.required !== false) {
				context.addIssue({
					code: 'custom',
					message: `Story proposal must bind an optional beat: ${proposal.proposalId}`
				});
			}
		}
		for (const slot of mission.story.patchSlots) {
			const after = anchors.get(slot.afterAnchorId);
			const before = anchors.get(slot.beforeAnchorId);
			if (!after || !before || after.order >= before.order) {
				context.addIssue({
					code: 'custom',
					message: `Story patch boundaries are invalid: ${slot.slotId}`
				});
			}
			if (slot.maximumSelections > slot.allowedProposalIds.length) {
				context.addIssue({
					code: 'custom',
					message: `Story patch selection bound is invalid: ${slot.slotId}`
				});
			}
			for (const proposalId of slot.allowedProposalIds) {
				if (!proposals.has(proposalId)) {
					context.addIssue({
						code: 'custom',
						message: `Story patch proposal is unknown: ${slot.slotId}`
					});
				}
			}
		}
	});

export const PortalMissionDepositSchema = z
	.object({
		depositId: MissionSlugSchema,
		nodeId: MissionSlugSchema,
		resource: z.literal('iron-ore'),
		initialAmount: z.number().int().positive().max(100),
		mineAmountPerAction: z.number().int().positive().max(20)
	})
	.strict()
	.refine((deposit) => deposit.mineAmountPerAction <= deposit.initialAmount, {
		message: 'Portal deposit action yield cannot exceed its initial amount'
	});

export const PortalMissionRulesSchema = z
	.object({
		portalId: MissionSlugSchema,
		durationRounds: z.number().int().min(3).max(48),
		warningAtRemainingRounds: z.number().int().positive().max(47),
		criticalAtRemainingRounds: z.number().int().positive().max(46),
		extractionQuota: z.number().int().positive().max(1_000),
		cargoCapacityPerActor: z.number().int().positive().max(100),
		deposits: z.array(PortalMissionDepositSchema).min(1).max(20),
		collapse: z
			.object({
				failureRule: z.literal('timer-expired'),
				cargoDisposition: z.literal('lost')
			})
			.strict()
	})
	.strict()
	.superRefine((rules, context) => {
		if (
			rules.warningAtRemainingRounds >= rules.durationRounds ||
			rules.criticalAtRemainingRounds >= rules.warningAtRemainingRounds
		) {
			context.addIssue({ code: 'custom', message: 'Portal pressure thresholds are inconsistent' });
		}
		if (
			new Set(rules.deposits.map((deposit) => deposit.depositId)).size !== rules.deposits.length
		) {
			context.addIssue({ code: 'custom', message: 'Portal deposit ids must be unique' });
		}
		if (
			rules.deposits.reduce((sum, deposit) => sum + deposit.initialAmount, 0) <
			rules.extractionQuota
		) {
			context.addIssue({
				code: 'custom',
				message: 'Portal deposits cannot satisfy the extraction quota'
			});
		}
		if (
			rules.deposits.some((deposit) => deposit.mineAmountPerAction > rules.cargoCapacityPerActor)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Portal deposit yield exceeds one actor cargo capacity'
			});
		}
	});

export const PortalMissionPackageSchema = z
	.object({
		schemaVersion: z.literal('portal-mission-package-v1'),
		contentVersion: ContentVersionSchema,
		missionId: MissionSlugSchema,
		mission: MissionPackageSchema,
		portal: PortalMissionRulesSchema,
		contentHash: StateHashSchema
	})
	.strict()
	.superRefine((portalPackage, context) => {
		const { mission, portal } = portalPackage;
		if (
			mission.kind !== 'portal-world' ||
			mission.tower !== null ||
			mission.missionId !== portalPackage.missionId ||
			mission.contentVersion !== portalPackage.contentVersion
		) {
			context.addIssue({ code: 'custom', message: 'Portal mission binding is inconsistent' });
		}
		const nodes = new Map(mission.arena.nodes.map((node) => [node.nodeId, node]));
		for (const deposit of portal.deposits) {
			if (!nodes.get(deposit.nodeId)?.roles.includes('objective')) {
				context.addIssue({
					code: 'custom',
					message: `Portal deposit node is not an objective: ${deposit.depositId}`
				});
			}
		}
		const primary = mission.objectives.find((objective) => objective.primary);
		if (
			primary?.completionRule.kind !== 'recover-ledger-item' ||
			primary.completionRule.itemKey !== 'iron-ore' ||
			primary.completionRule.amount !== portal.extractionQuota ||
			!mission.deployment.extractionNodeIds.includes(primary.completionRule.returnToNodeId) ||
			!primary.failureRules.includes('timer-expired')
		) {
			context.addIssue({ code: 'custom', message: 'Portal ore objective is inconsistent' });
		}
	});

export const MissionArenaKnowledgeSchema = z
	.object({
		discoveryIds: z.array(MissionSlugSchema).max(40),
		visitedNodeIds: z.array(MissionSlugSchema).max(80)
	})
	.strict()
	.superRefine((knowledge, context) => {
		if (new Set(knowledge.discoveryIds).size !== knowledge.discoveryIds.length) {
			context.addIssue({ code: 'custom', message: 'Mission knowledge discoveries must be unique' });
		}
		if (new Set(knowledge.visitedNodeIds).size !== knowledge.visitedNodeIds.length) {
			context.addIssue({ code: 'custom', message: 'Mission knowledge visits must be unique' });
		}
	});

export const MissionArenaProjectionSchema = z
	.object({
		discoveryIds: z.array(MissionSlugSchema).max(40),
		visitedNodeIds: z.array(MissionSlugSchema).max(80),
		nodeIds: z.array(MissionSlugSchema).min(1).max(80),
		edgeIds: z.array(MissionSlugSchema).max(160),
		observationIds: z.array(MissionSlugSchema).max(160)
	})
	.strict();

export const MissionRouteStepSchema = z
	.object({
		edgeId: MissionSlugSchema,
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		traversalActions: z.number().int().positive(),
		exposure: MissionExposureSchema
	})
	.strict();

export const MissionRoutePlanSchema = z
	.object({
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		discoveryIds: z.array(MissionSlugSchema).max(40),
		nodeIds: z.array(MissionSlugSchema).min(1),
		steps: z.array(MissionRouteStepSchema),
		totalTraversalActions: z.number().int().nonnegative(),
		maximumExposure: MissionExposureSchema
	})
	.strict()
	.superRefine((route, context) => {
		if (route.nodeIds[0] !== route.fromNodeId || route.nodeIds.at(-1) !== route.toNodeId) {
			context.addIssue({
				code: 'custom',
				message: 'Mission route endpoints do not match its nodes'
			});
		}
		if (route.steps.length !== route.nodeIds.length - 1) {
			context.addIssue({ code: 'custom', message: 'Mission route step count is inconsistent' });
		}
		if (
			route.steps.reduce((sum, step) => sum + step.traversalActions, 0) !==
			route.totalTraversalActions
		) {
			context.addIssue({ code: 'custom', message: 'Mission route duration is inconsistent' });
		}
	});

export type MissionArenaEdge = z.infer<typeof MissionArenaEdgeSchema>;
export type MissionArenaKnowledge = z.infer<typeof MissionArenaKnowledgeSchema>;
export type MissionArenaNode = z.infer<typeof MissionArenaNodeSchema>;
export type MissionArenaProjection = z.infer<typeof MissionArenaProjectionSchema>;
export type MissionDiscoveryAffordance = z.infer<typeof MissionDiscoveryAffordanceSchema>;
export type MissionMonsterPolicyCatalog = z.infer<typeof MissionMonsterPolicyCatalogSchema>;
export type MissionMonsterPolicyDefinition = z.infer<typeof MissionMonsterPolicyDefinitionSchema>;
export type MissionPackage = z.infer<typeof MissionPackageSchema>;
export type PortalMissionDeposit = z.infer<typeof PortalMissionDepositSchema>;
export type PortalMissionPackage = z.infer<typeof PortalMissionPackageSchema>;
export type PortalMissionRules = z.infer<typeof PortalMissionRulesSchema>;
export type MissionRoutePlan = z.infer<typeof MissionRoutePlanSchema>;

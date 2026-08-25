import { z } from 'zod';

import { CharacterMindSchema } from './character.js';
import {
	ContentVersionSchema,
	EntityIdSchema,
	IsoDateTimeSchema,
	StateHashSchema
} from './shared.js';

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

export const StoryForbiddenChangesSchema = z.tuple([
	z.literal('world-laws'),
	z.literal('primary-objective'),
	z.literal('arena-truth'),
	z.literal('reward-budget'),
	z.literal('required-anchors')
]);

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
		forbiddenChanges: StoryForbiddenChangesSchema
	})
	.strict();

export const StoryExpressionFrameSchema = z.enum([
	'operational',
	'analytical',
	'relational',
	'defiant',
	'cautious',
	'plain'
]);

export const TowerBandStoryBeatSchema = z
	.object({
		beatId: MissionSlugSchema,
		missionId: MissionSlugSchema,
		floor: z.number().int().min(1).max(100),
		floorInBand: z.number().int().min(1).max(5),
		kind: MissionStoryBeatSchema.shape.kind,
		required: z.boolean(),
		title: z.string().min(1).max(120),
		summary: z.string().min(1).max(360),
		eligibleAfterBeatIds: z.array(MissionSlugSchema).max(12),
		anchorId: MissionSlugSchema.nullable()
	})
	.strict();

export const TowerBandStoryAnchorSchema = z
	.object({
		anchorId: MissionSlugSchema,
		order: z.number().int().positive().max(100),
		missionId: MissionSlugSchema,
		floor: z.number().int().min(1).max(100),
		beatId: MissionSlugSchema,
		immutableFact: z.string().min(1).max(360)
	})
	.strict();

export const TowerBandStoryProposalSchema = z
	.object({
		proposalId: MissionSlugSchema,
		missionId: MissionSlugSchema,
		floor: z.number().int().min(1).max(100),
		kind: z.enum(['optional-beat', 'complication', 'role-expression']),
		beatId: MissionSlugSchema,
		summary: z.string().min(1).max(320)
	})
	.strict();

export const TowerBandStoryPatchSlotSchema = z
	.object({
		slotId: MissionSlugSchema,
		missionId: MissionSlugSchema,
		floor: z.number().int().min(1).max(100),
		afterAnchorId: MissionSlugSchema,
		beforeAnchorId: MissionSlugSchema,
		allowedProposalIds: z.array(MissionSlugSchema).min(1).max(8),
		maximumSelections: z.number().int().min(1).max(3)
	})
	.strict();

export const StoryExpressionHookSchema = z
	.object({
		hookId: MissionSlugSchema,
		anchorId: MissionSlugSchema,
		purpose: z.enum(['warning', 'interpretation', 'reflection', 'challenge', 'testimony']),
		allowedFrames: z.array(StoryExpressionFrameSchema).min(1).max(6),
		preferredValues: z.array(CharacterMindSchema.shape.primaryValue).max(6),
		preferredDrives: z.array(CharacterMindSchema.shape.primaryDrive).max(6)
	})
	.strict()
	.superRefine((hook, context) => {
		for (const values of [hook.allowedFrames, hook.preferredValues, hook.preferredDrives]) {
			if (new Set(values).size !== values.length) {
				context.addIssue({
					code: 'custom',
					message: 'Story expression hook values must be unique'
				});
			}
		}
	});

export const TowerBandStoryEnvelopeSchema = z
	.object({
		schemaVersion: z.literal('tower-band-story-envelope-v1'),
		contentVersion: ContentVersionSchema,
		envelopeId: MissionSlugSchema,
		towerBand: z
			.object({
				band: z.number().int().min(1).max(20),
				firstFloor: z.number().int().min(1).max(100),
				lastFloor: z.number().int().min(1).max(100)
			})
			.strict(),
		storySpineId: MissionSlugSchema,
		title: z.string().min(1).max(160),
		theme: z.string().min(1).max(320),
		emotionalQuestion: z.string().min(1).max(320),
		worldLaws: z
			.array(
				z
					.object({
						lawId: MissionSlugSchema,
						statement: z.string().min(1).max(360),
						enforcedBy: z.enum(['engine', 'content', 'knowledge', 'aftermath'])
					})
					.strict()
			)
			.min(3)
			.max(20),
		openingState: z
			.object({
				settlementId: MissionSlugSchema,
				establishedFacts: z.array(z.string().min(1).max(360)).min(1).max(12),
				unresolvedGoalIds: z.array(MissionSlugSchema).min(1).max(12)
			})
			.strict(),
		beats: z.array(TowerBandStoryBeatSchema).min(15).max(100),
		defaultBeatOrder: z.array(MissionSlugSchema).min(15).max(100),
		anchors: z.array(TowerBandStoryAnchorSchema).min(10).max(100),
		proposals: z.array(TowerBandStoryProposalSchema).max(50),
		patchSlots: z.array(TowerBandStoryPatchSlotSchema).max(20),
		expressionHooks: z.array(StoryExpressionHookSchema).min(1).max(30),
		finaleConstraints: z
			.array(
				z
					.object({
						constraintId: MissionSlugSchema,
						summary: z.string().min(1).max(360),
						requiredBeatIds: z.array(MissionSlugSchema).min(1).max(12),
						enforcedBy: z.enum(['objective', 'encounter', 'extraction', 'aftermath'])
					})
					.strict()
			)
			.min(2)
			.max(12),
		contentCatalog: z
			.object({
				missionBindings: z
					.array(
						z
							.object({
								missionId: MissionSlugSchema,
								floor: z.number().int().min(1).max(100),
								contentVersion: ContentVersionSchema,
								contentHash: StateHashSchema,
								primaryObjectiveId: MissionSlugSchema
							})
							.strict()
					)
					.length(5),
				discoveries: z
					.array(
						z
							.object({
								missionId: MissionSlugSchema,
								discoveryId: MissionSlugSchema
							})
							.strict()
					)
					.max(100),
				enemyPolicyIds: z.array(MissionSlugSchema).max(50),
				rewardGrants: z
					.array(
						z
							.object({
								missionId: MissionSlugSchema,
								grantId: MissionSlugSchema
							})
							.strict()
					)
					.max(100)
			})
			.strict(),
		rewardBudget: z
			.object({
				budgetPoints: z.number().int().positive(),
				declaredCost: z.number().int().nonnegative()
			})
			.strict(),
		forbiddenChanges: StoryForbiddenChangesSchema,
		contentHash: StateHashSchema
	})
	.strict()
	.superRefine((envelope, context) => {
		const unique = (values: readonly string[], label: string) => {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', message: `${label} must be unique` });
			}
		};
		unique(
			envelope.worldLaws.map((law) => law.lawId),
			'Story world law ids'
		);
		unique(envelope.openingState.establishedFacts, 'Story opening facts');
		unique(envelope.openingState.unresolvedGoalIds, 'Story opening goals');
		unique(
			envelope.beats.map((beat) => beat.beatId),
			'Band story beat ids'
		);
		unique(envelope.defaultBeatOrder, 'Band default beat order');
		unique(
			envelope.anchors.map((anchor) => anchor.anchorId),
			'Band story anchor ids'
		);
		unique(
			envelope.anchors.map((anchor) => String(anchor.order)),
			'Band story anchor order'
		);
		unique(
			envelope.proposals.map((proposal) => proposal.proposalId),
			'Band story proposal ids'
		);
		unique(
			envelope.patchSlots.map((slot) => slot.slotId),
			'Band story patch slot ids'
		);
		unique(
			envelope.expressionHooks.map((hook) => hook.hookId),
			'Story expression hook ids'
		);
		unique(
			envelope.finaleConstraints.map((constraint) => constraint.constraintId),
			'Story finale constraint ids'
		);
		unique(
			envelope.contentCatalog.missionBindings.map((binding) => binding.missionId),
			'Story mission bindings'
		);
		unique(
			envelope.contentCatalog.discoveries.map(
				(discovery) => `${discovery.missionId}:${discovery.discoveryId}`
			),
			'Story discovery bindings'
		);
		unique(envelope.contentCatalog.enemyPolicyIds, 'Story enemy policy ids');
		unique(
			envelope.contentCatalog.rewardGrants.map((grant) => `${grant.missionId}:${grant.grantId}`),
			'Story reward bindings'
		);

		const expectedFirstFloor = (envelope.towerBand.band - 1) * 5 + 1;
		if (
			envelope.towerBand.firstFloor !== expectedFirstFloor ||
			envelope.towerBand.lastFloor !== expectedFirstFloor + 4
		) {
			context.addIssue({ code: 'custom', message: 'Story band floor range is inconsistent' });
		}
		const boundFloors = envelope.contentCatalog.missionBindings
			.map((binding) => binding.floor)
			.sort((left, right) => left - right);
		if (
			boundFloors.join(',') !==
			[0, 1, 2, 3, 4].map((offset) => expectedFirstFloor + offset).join(',')
		) {
			context.addIssue({ code: 'custom', message: 'Story band must bind five consecutive floors' });
		}

		const bindings = new Map(
			envelope.contentCatalog.missionBindings.map((binding) => [binding.missionId, binding])
		);
		const beats = new Map(envelope.beats.map((beat) => [beat.beatId, beat]));
		const defaultIndexes = new Map(
			envelope.defaultBeatOrder.map((beatId, index) => [beatId, index])
		);
		for (const beat of envelope.beats) {
			const binding = bindings.get(beat.missionId);
			if (!binding || binding.floor !== beat.floor) {
				context.addIssue({
					code: 'custom',
					message: `Story beat binding is invalid: ${beat.beatId}`
				});
			}
			for (const dependencyId of beat.eligibleAfterBeatIds) {
				if (!beats.has(dependencyId) || dependencyId === beat.beatId) {
					context.addIssue({
						code: 'custom',
						message: `Band story dependency is invalid: ${beat.beatId}`
					});
				}
				const dependencyIndex = defaultIndexes.get(dependencyId);
				const beatIndex = defaultIndexes.get(beat.beatId);
				if (
					dependencyIndex !== undefined &&
					beatIndex !== undefined &&
					dependencyIndex >= beatIndex
				) {
					context.addIssue({
						code: 'custom',
						message: `Band default route violates dependency order: ${beat.beatId}`
					});
				}
			}
			if (beat.required && !defaultIndexes.has(beat.beatId)) {
				context.addIssue({
					code: 'custom',
					message: `Required band beat is absent from the default route: ${beat.beatId}`
				});
			}
		}
		for (const beatId of envelope.defaultBeatOrder) {
			const beat = beats.get(beatId);
			if (!beat) {
				context.addIssue({ code: 'custom', message: `Band default beat is unknown: ${beatId}` });
			} else if (!beat.required) {
				context.addIssue({
					code: 'custom',
					message: `Band default route cannot contain an optional beat: ${beatId}`
				});
			}
		}
		const visiting = new Set<string>();
		const visited = new Set<string>();
		const visitBeat = (beatId: string): boolean => {
			if (visiting.has(beatId)) return false;
			if (visited.has(beatId)) return true;
			visiting.add(beatId);
			for (const dependencyId of beats.get(beatId)?.eligibleAfterBeatIds ?? []) {
				if (!visitBeat(dependencyId)) return false;
			}
			visiting.delete(beatId);
			visited.add(beatId);
			return true;
		};
		if (envelope.beats.some((beat) => !visitBeat(beat.beatId))) {
			context.addIssue({ code: 'custom', message: 'Band story dependency graph contains a cycle' });
		}

		const anchors = new Map(envelope.anchors.map((anchor) => [anchor.anchorId, anchor]));
		const sortedAnchors = [...envelope.anchors].sort((left, right) => left.order - right.order);
		if (sortedAnchors.some((anchor, index) => anchor.order !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Band story anchor order must be contiguous' });
		}
		for (const anchor of envelope.anchors) {
			const beat = beats.get(anchor.beatId);
			if (
				!beat?.required ||
				beat.anchorId !== anchor.anchorId ||
				beat.missionId !== anchor.missionId ||
				beat.floor !== anchor.floor
			) {
				context.addIssue({
					code: 'custom',
					message: `Band story anchor binding is invalid: ${anchor.anchorId}`
				});
			}
		}
		const proposals = new Map(
			envelope.proposals.map((proposal) => [proposal.proposalId, proposal])
		);
		for (const proposal of envelope.proposals) {
			const beat = beats.get(proposal.beatId);
			if (
				beat?.required !== false ||
				beat.missionId !== proposal.missionId ||
				beat.floor !== proposal.floor
			) {
				context.addIssue({
					code: 'custom',
					message: `Band story proposal binding is invalid: ${proposal.proposalId}`
				});
			}
		}
		for (const slot of envelope.patchSlots) {
			const after = anchors.get(slot.afterAnchorId);
			const before = anchors.get(slot.beforeAnchorId);
			if (
				!after ||
				!before ||
				after.order >= before.order ||
				after.missionId !== slot.missionId ||
				before.missionId !== slot.missionId ||
				after.floor !== slot.floor ||
				before.floor !== slot.floor ||
				slot.maximumSelections > slot.allowedProposalIds.length
			) {
				context.addIssue({
					code: 'custom',
					message: `Band story patch boundary is invalid: ${slot.slotId}`
				});
			}
			for (const proposalId of slot.allowedProposalIds) {
				const proposal = proposals.get(proposalId);
				if (!proposal || proposal.missionId !== slot.missionId) {
					context.addIssue({
						code: 'custom',
						message: `Band story patch proposal is invalid: ${slot.slotId}`
					});
				}
			}
		}
		for (const hook of envelope.expressionHooks) {
			if (!anchors.has(hook.anchorId)) {
				context.addIssue({
					code: 'custom',
					message: `Story expression anchor is unknown: ${hook.hookId}`
				});
			}
		}
		for (const constraint of envelope.finaleConstraints) {
			if (
				constraint.requiredBeatIds.some(
					(beatId) =>
						!beats.get(beatId)?.required ||
						beats.get(beatId)?.floor !== envelope.towerBand.lastFloor
				)
			) {
				context.addIssue({
					code: 'custom',
					message: `Story finale constraint requires a non-finale beat: ${constraint.constraintId}`
				});
			}
		}
		for (const discovery of envelope.contentCatalog.discoveries) {
			if (!bindings.has(discovery.missionId)) {
				context.addIssue({
					code: 'custom',
					message: `Story discovery binding is unknown: ${discovery.missionId}`
				});
			}
		}
		for (const grant of envelope.contentCatalog.rewardGrants) {
			if (!bindings.has(grant.missionId)) {
				context.addIssue({
					code: 'custom',
					message: `Story reward binding is unknown: ${grant.missionId}`
				});
			}
		}
		if (envelope.rewardBudget.declaredCost > envelope.rewardBudget.budgetPoints) {
			context.addIssue({ code: 'custom', message: 'Band story rewards exceed their fixed budget' });
		}
	});

export const StoryBeatHistorySchema = z
	.object({
		historyVersion: z.literal('story-beat-history-v1'),
		unlockedFloor: z.number().int().min(1).max(100),
		completedBeatIds: z.array(MissionSlugSchema).max(100),
		activatedProposalIds: z.array(MissionSlugSchema).max(50)
	})
	.strict()
	.superRefine((history, context) => {
		if (new Set(history.completedBeatIds).size !== history.completedBeatIds.length) {
			context.addIssue({ code: 'custom', message: 'Completed story beats must be unique' });
		}
		if (new Set(history.activatedProposalIds).size !== history.activatedProposalIds.length) {
			context.addIssue({ code: 'custom', message: 'Activated story proposals must be unique' });
		}
	});

export const StoryPatchRoleBindingSchema = z
	.object({
		proposalId: MissionSlugSchema,
		heroId: EntityIdSchema
	})
	.strict();

export const StoryPatchCandidateSchema = z
	.object({
		patchVersion: z.literal('story-patch-v1'),
		patchId: EntityIdSchema,
		envelopeId: MissionSlugSchema,
		envelopeContentHash: StateHashSchema,
		baseHistoryHash: StateHashSchema,
		slotId: MissionSlugSchema,
		selectedProposalIds: z.array(MissionSlugSchema).min(1).max(3),
		roleBindings: z.array(StoryPatchRoleBindingSchema).max(3),
		publicIntent: z.string().min(1).max(600)
	})
	.strict()
	.superRefine((candidate, context) => {
		if (new Set(candidate.selectedProposalIds).size !== candidate.selectedProposalIds.length) {
			context.addIssue({ code: 'custom', message: 'Story patch selections must be unique' });
		}
		if (
			new Set(candidate.roleBindings.map((binding) => binding.proposalId)).size !==
			candidate.roleBindings.length
		) {
			context.addIssue({
				code: 'custom',
				message: 'Story patch role bindings must be unique by proposal'
			});
		}
		for (const binding of candidate.roleBindings) {
			if (!candidate.selectedProposalIds.includes(binding.proposalId)) {
				context.addIssue({
					code: 'custom',
					message: 'Story patch roles may bind only selected proposals'
				});
			}
		}
	});

export const StoryPatchCastMemberSchema = z
	.object({
		heroId: EntityIdSchema,
		lifeState: z.enum(['active', 'dead', 'synthesized']),
		availableProposalIds: z.array(MissionSlugSchema).max(50)
	})
	.strict()
	.superRefine((member, context) => {
		if (new Set(member.availableProposalIds).size !== member.availableProposalIds.length) {
			context.addIssue({ code: 'custom', message: 'Available story proposals must be unique' });
		}
	});

export const StoryPatchValidationCodeSchema = z.enum([
	'envelope-binding',
	'history-causality',
	'stale-history',
	'slot-known',
	'slot-open',
	'selection-bound',
	'proposal-catalog',
	'proposal-dormant',
	'role-binding',
	'living-cast',
	'knowledge-boundary',
	'world-laws',
	'primary-objective',
	'arena-truth',
	'reward-budget',
	'required-anchors',
	'finale-constraints'
]);

export const StoryPatchValidationCheckSchema = z
	.object({
		code: StoryPatchValidationCodeSchema,
		status: z.enum(['passed', 'rejected']),
		summary: z.string().min(1).max(360)
	})
	.strict();

export const StoryPatchValidationReportSchema = z
	.object({
		reportVersion: z.literal('story-patch-validation-v1'),
		candidateHash: StateHashSchema,
		accepted: z.boolean(),
		envelopeId: MissionSlugSchema,
		envelopeContentHash: StateHashSchema,
		slotId: MissionSlugSchema,
		baseHistoryHash: StateHashSchema,
		resultingHistoryHash: StateHashSchema.nullable(),
		selectedProposalIds: z.array(MissionSlugSchema).max(3),
		activatedBeatIds: z.array(MissionSlugSchema).max(3),
		roleBindings: z.array(StoryPatchRoleBindingSchema).max(3),
		checks: z.array(StoryPatchValidationCheckSchema).min(10).max(24),
		rejectionCodes: z.array(StoryPatchValidationCodeSchema).max(24),
		validationHash: StateHashSchema
	})
	.strict()
	.superRefine((report, context) => {
		const rejected = report.checks
			.filter((check) => check.status === 'rejected')
			.map((check) => check.code);
		if (
			report.accepted !== (rejected.length === 0) ||
			report.accepted !== (report.resultingHistoryHash !== null) ||
			new Set(report.checks.map((check) => check.code)).size !== report.checks.length ||
			new Set(report.rejectionCodes).size !== report.rejectionCodes.length ||
			rejected.join('|') !== report.rejectionCodes.join('|')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Story patch validation verdict is inconsistent'
			});
		}
	});

export const AppliedStoryPatchSchema = z
	.object({
		applicationVersion: z.literal('applied-story-patch-v1'),
		candidate: StoryPatchCandidateSchema,
		validation: StoryPatchValidationReportSchema,
		appliedEventId: EntityIdSchema,
		appliedAt: IsoDateTimeSchema,
		patchHash: StateHashSchema
	})
	.strict()
	.superRefine((patch, context) => {
		if (
			!patch.validation.accepted ||
			patch.validation.envelopeId !== patch.candidate.envelopeId ||
			patch.validation.envelopeContentHash !== patch.candidate.envelopeContentHash ||
			patch.validation.baseHistoryHash !== patch.candidate.baseHistoryHash
		) {
			context.addIssue({
				code: 'custom',
				message: 'Applied story patch validation is inconsistent'
			});
		}
	});

export const RuntimeBandStoryStateSchema = z
	.object({
		storyVersion: z.literal('runtime-band-story-v1'),
		envelopeId: MissionSlugSchema,
		envelopeContentVersion: ContentVersionSchema,
		envelopeContentHash: StateHashSchema,
		history: StoryBeatHistorySchema,
		appliedPatches: z.array(AppliedStoryPatchSchema).max(20)
	})
	.strict()
	.superRefine((story, context) => {
		if (
			new Set(story.appliedPatches.map((patch) => patch.candidate.patchId)).size !==
			story.appliedPatches.length
		) {
			context.addIssue({ code: 'custom', message: 'Applied story patch ids must be unique' });
		}
		const activated = new Set(story.history.activatedProposalIds);
		for (const patch of story.appliedPatches) {
			if (
				patch.candidate.envelopeId !== story.envelopeId ||
				patch.candidate.envelopeContentHash !== story.envelopeContentHash ||
				patch.candidate.selectedProposalIds.some((proposalId) => !activated.has(proposalId))
			) {
				context.addIssue({
					code: 'custom',
					message: 'Applied story patches must bind the current envelope and history'
				});
			}
		}
	});

export const StoryBeatEligibilityRecordSchema = z
	.object({
		beatId: MissionSlugSchema,
		missionId: MissionSlugSchema,
		floor: z.number().int().min(1).max(100),
		required: z.boolean(),
		status: z.enum([
			'completed',
			'eligible',
			'locked-floor',
			'locked-dependency',
			'optional-dormant'
		]),
		missingDependencyIds: z.array(MissionSlugSchema).max(12),
		activatedByProposalId: MissionSlugSchema.nullable()
	})
	.strict();

export const StoryBeatEligibilityReportSchema = z
	.object({
		reportVersion: z.literal('story-beat-eligibility-v1'),
		envelopeId: MissionSlugSchema,
		envelopeContentHash: StateHashSchema,
		history: StoryBeatHistorySchema,
		records: z.array(StoryBeatEligibilityRecordSchema).min(15).max(100),
		nextDefaultBeatId: MissionSlugSchema.nullable()
	})
	.strict();

export const StoryExpressionCastMemberSchema = z
	.object({
		characterId: z.string().uuid(),
		displayName: z.string().min(1).max(80),
		lifeState: z.enum(['active', 'dead']),
		mind: CharacterMindSchema,
		knownAnchorIds: z.array(MissionSlugSchema).max(100)
	})
	.strict()
	.superRefine((member, context) => {
		if (new Set(member.knownAnchorIds).size !== member.knownAnchorIds.length) {
			context.addIssue({ code: 'custom', message: 'Known story anchors must be unique' });
		}
	});

export const StoryExpressionResolutionSchema = z
	.object({
		resolutionVersion: z.literal('story-expression-resolution-v1'),
		hookId: MissionSlugSchema,
		anchorId: MissionSlugSchema,
		immutableFact: z.string().min(1).max(360),
		speakerId: z.string().uuid(),
		speakerName: z.string().min(1).max(80),
		frame: StoryExpressionFrameSchema,
		spokenLine: z.string().min(1).max(700),
		deliveryBrief: z.string().min(1).max(360),
		habitGesture: z.string().min(1).max(240),
		selectionScore: z.number().int(),
		selectionBasis: z.array(z.string().min(1).max(120)).min(1).max(12)
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
export type StoryBeatEligibilityReport = z.infer<typeof StoryBeatEligibilityReportSchema>;
export type StoryBeatHistory = z.infer<typeof StoryBeatHistorySchema>;
export type AppliedStoryPatch = z.infer<typeof AppliedStoryPatchSchema>;
export type RuntimeBandStoryState = z.infer<typeof RuntimeBandStoryStateSchema>;
export type StoryPatchCandidate = z.infer<typeof StoryPatchCandidateSchema>;
export type StoryPatchCastMember = z.infer<typeof StoryPatchCastMemberSchema>;
export type StoryPatchRoleBinding = z.infer<typeof StoryPatchRoleBindingSchema>;
export type StoryPatchValidationCode = z.infer<typeof StoryPatchValidationCodeSchema>;
export type StoryPatchValidationCheck = z.infer<typeof StoryPatchValidationCheckSchema>;
export type StoryPatchValidationReport = z.infer<typeof StoryPatchValidationReportSchema>;
export type StoryExpressionCastMember = z.infer<typeof StoryExpressionCastMemberSchema>;
export type StoryExpressionFrame = z.infer<typeof StoryExpressionFrameSchema>;
export type StoryExpressionResolution = z.infer<typeof StoryExpressionResolutionSchema>;
export type TowerBandStoryAnchor = z.infer<typeof TowerBandStoryAnchorSchema>;
export type TowerBandStoryBeat = z.infer<typeof TowerBandStoryBeatSchema>;
export type TowerBandStoryEnvelope = z.infer<typeof TowerBandStoryEnvelopeSchema>;
export type PortalMissionDeposit = z.infer<typeof PortalMissionDepositSchema>;
export type PortalMissionPackage = z.infer<typeof PortalMissionPackageSchema>;
export type PortalMissionRules = z.infer<typeof PortalMissionRulesSchema>;
export type MissionRoutePlan = z.infer<typeof MissionRoutePlanSchema>;

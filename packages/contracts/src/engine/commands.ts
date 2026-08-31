import { z } from 'zod';

import { ActivityKindSchema } from './base-state.js';
import { MasterFallbackPrioritySchema, MasterFallbackSafetyStopsSchema } from './master-control.js';
import { MissionTurnChoiceSchema } from './mission-state.js';
import {
	BuildingAssignmentRoleSchema,
	FirstEmberFacilitySchema,
	FirstEmberRationaleSchema,
	SettlementNodeIdSchema
} from './settlement-state.js';
import { StoryPatchCandidateSchema, SynthesisVisibilitySchema } from './story-synthesis-state.js';
import {
	ActionSourceSchema,
	DecisionTimingSchema,
	DirectiveScopeSchema,
	FallbackPolicySchema
} from '../event.js';
import { MissionSlugSchema } from '../mission.js';
import { SettlementSlugSchema } from '../settlement.js';
import {
	ConversationActKindSchema,
	ConversationOrderIntentSchema,
	CommunicationDeliverySchema,
	CommunicationToneSchema,
	CommunicationTopicSchema,
	OnboardingCommunicativeActKindSchema
} from '../social.js';
import { EntityIdSchema, IsoDateTimeSchema } from '../shared.js';

const EngineCommandBaseSchema = z
	.object({
		commandId: EntityIdSchema,
		runId: EntityIdSchema,
		actorId: EntityIdSchema,
		expectedVersion: z.number().int().nonnegative(),
		correlationId: EntityIdSchema,
		source: ActionSourceSchema
	})
	.strict();

export const ChooseDestinationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.choose.destination'),
	destination: z.enum(['kitchen', 'training-ground']),
	firstLine: z.string().min(1).max(500),
	storyBranch: z.string().min(1).max(100)
}).strict();

export const ArriveDestinationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.arrive')
}).strict();

export const StartTravelCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.travel'),
	targetNodeId: SettlementNodeIdSchema
}).strict();

export const AssignHeroBuildingCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.assign.hero'),
	heroId: EntityIdSchema,
	buildingId: SettlementSlugSchema,
	role: BuildingAssignmentRoleSchema
}).strict();

export const UnassignHeroBuildingCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.unassign.hero'),
	heroId: EntityIdSchema
}).strict();

export const AllocateBuildingPowerCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.allocate.power'),
	buildingId: SettlementSlugSchema
}).strict();

export const RecoverFirstEmberCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('story.recover.first.ember')
}).strict();

export const CommitFirstEmberCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.commit.first.ember'),
	buildingId: FirstEmberFacilitySchema,
	rationale: FirstEmberRationaleSchema
}).strict();

export const MasterCommunicateCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.communicate'),
	targetHeroId: EntityIdSchema,
	kind: OnboardingCommunicativeActKindSchema,
	topic: CommunicationTopicSchema,
	exactText: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Communication text must contain a visible character'
		}),
	tone: CommunicationToneSchema.nullable(),
	delivery: CommunicationDeliverySchema
}).strict();

export const CommunicationRequestSchema = z
	.object({
		targetHeroId: EntityIdSchema,
		kind: OnboardingCommunicativeActKindSchema,
		topic: CommunicationTopicSchema,
		exactText: z
			.string()
			.min(1)
			.max(600)
			.refine((text) => /\S/u.test(text), {
				message: 'Communication text must contain a visible character'
			}),
		tone: CommunicationToneSchema.nullable(),
		delivery: CommunicationDeliverySchema
	})
	.strict();

const ConversationRequestShape = {
	targetHeroId: EntityIdSchema,
	kind: ConversationActKindSchema,
	exactText: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Conversation text must contain a visible character'
		}),
	tone: CommunicationToneSchema,
	delivery: CommunicationDeliverySchema,
	orderIntent: ConversationOrderIntentSchema.nullable()
} as const;

function validateConversationRequest(
	request: { kind: 'say' | 'ask' | 'order'; orderIntent: string | null },
	context: z.RefinementCtx
): void {
	if ((request.kind === 'order') !== (request.orderIntent !== null)) {
		context.addIssue({ code: 'custom', message: 'Only an order has an order intent' });
	}
}

export const MasterConverseCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.converse'),
	...ConversationRequestShape
})
	.strict()
	.superRefine(validateConversationRequest);

export const ConversationRequestSchema = z
	.object(ConversationRequestShape)
	.strict()
	.superRefine(validateConversationRequest);

const DirectiveIssueShape = {
	text: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Directive text must contain a visible character'
		}),
	scope: DirectiveScopeSchema,
	recipientIds: z.array(EntityIdSchema).min(1).max(8),
	priorities: z.array(z.string().min(1).max(80)).max(12),
	tone: CommunicationToneSchema,
	delivery: CommunicationDeliverySchema
} as const;

export const MasterIssueDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.issue.directive'),
	...DirectiveIssueShape
}).strict();

export const MasterReplaceDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.replace.directive'),
	directiveId: EntityIdSchema,
	...DirectiveIssueShape
}).strict();

export const MasterRevokeDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.revoke.directive'),
	directiveId: EntityIdSchema
}).strict();

export const ConfigureMasterTimingCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.configure.timing'),
	timing: DecisionTimingSchema,
	countdownSeconds: z.number().int().min(1).max(60),
	observedAt: IsoDateTimeSchema
}).strict();

export const OpenMasterDecisionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.open.decision'),
	observedAt: IsoDateTimeSchema
}).strict();

export const ConfigureMasterFallbackCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.configure.fallback'),
	policy: FallbackPolicySchema,
	directionText: z.string().min(1).max(600),
	priorities: z.array(MasterFallbackPrioritySchema).max(5),
	protectedHeroId: EntityIdSchema.nullable(),
	safetyStops: MasterFallbackSafetyStopsSchema,
	observedAt: IsoDateTimeSchema
}).strict();

export const ApplyMasterSafetyStopCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.apply.safety-stop'),
	decisionId: EntityIdSchema,
	observedAt: IsoDateTimeSchema
}).strict();

export const DirectiveRequestSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('issue'), ...DirectiveIssueShape }).strict(),
	z
		.object({
			action: z.literal('replace'),
			directiveId: EntityIdSchema,
			...DirectiveIssueShape
		})
		.strict(),
	z.object({ action: z.literal('revoke'), directiveId: EntityIdSchema }).strict()
]);

export const FirstEmberRequestSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('recover') }).strict(),
	z
		.object({
			action: z.literal('commit'),
			buildingId: FirstEmberFacilitySchema,
			rationale: FirstEmberRationaleSchema
		})
		.strict()
]);

export const CreateDailyPlanCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.plan.day')
}).strict();

export const StartRoutineCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.routine')
}).strict();

export const InspectGateCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.inspect.gate')
}).strict();

export const StartActivityCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.activity'),
	activity: ActivityKindSchema
}).strict();

export const EquipItemCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.equip.item'),
	itemId: EntityIdSchema
}).strict();

export const AdvanceSimulationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.advance'),
	targetGameTime: IsoDateTimeSchema
}).strict();

export const SyncSimulationClockCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.sync.clock'),
	targetGameTime: IsoDateTimeSchema
}).strict();

export const ApplyDamageCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.apply.damage'),
	targetId: EntityIdSchema,
	amount: z.number().int().min(1).max(100),
	damageKind: z.enum(['hazard', 'training', 'combat'])
}).strict();

export const PrepareMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.prepare'),
	heroIds: z.array(EntityIdSchema).max(7),
	missionId: MissionSlugSchema.optional()
}).strict();

export const ReviseMissionPartyCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.revise.party'),
	heroIds: z.array(EntityIdSchema).max(7)
}).strict();

export const CancelMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.cancel')
}).strict();

export const DeployMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.deploy')
}).strict();

export const ResolveMissionTurnCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.resolve.turn'),
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	decisionId: EntityIdSchema.optional(),
	resolvedAt: IsoDateTimeSchema.optional()
}).strict();

export const OpenMissionExtractionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.open.extraction'),
	completedObjectiveIds: z.array(MissionSlugSchema).min(1).max(20)
}).strict();

export const ExtractMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.extract')
}).strict();

export const RetreatMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.retreat')
}).strict();

export const ApplyStoryPatchCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('story.apply.patch'),
	candidate: StoryPatchCandidateSchema
}).strict();

export const RevealFirstBandArchiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('story.reveal.first.archive'),
	readerHeroId: EntityIdSchema
}).strict();

export const SynthesizeHeroCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.synthesize.hero'),
	sourceHeroId: EntityIdSchema,
	recipientHeroId: EntityIdSchema,
	visibility: SynthesisVisibilitySchema,
	warningVersion: z.literal('synthesis-warning-v1'),
	confirmedIrreversible: z.literal(true),
	rationale: z.string().min(1).max(240)
}).strict();

export const ShareSynthesisRumorCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.share.synthesis.rumor'),
	receiptId: EntityIdSchema,
	targetHeroId: EntityIdSchema
}).strict();

export const SynthesisRequestSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('synthesize'),
			sourceHeroId: EntityIdSchema,
			recipientHeroId: EntityIdSchema,
			visibility: SynthesisVisibilitySchema,
			warningVersion: z.literal('synthesis-warning-v1'),
			confirmedIrreversible: z.literal(true),
			rationale: z.string().min(1).max(240)
		})
		.strict(),
	z
		.object({
			action: z.literal('share-rumor'),
			receiptId: EntityIdSchema,
			speakerHeroId: EntityIdSchema,
			targetHeroId: EntityIdSchema
		})
		.strict()
]);

export const FirstBandArchiveRequestSchema = z
	.object({
		action: z.literal('reveal'),
		readerHeroId: EntityIdSchema
	})
	.strict();

export const EngineCommandSchema = z.discriminatedUnion('commandType', [
	ChooseDestinationCommandSchema,
	ArriveDestinationCommandSchema,
	StartTravelCommandSchema,
	AssignHeroBuildingCommandSchema,
	UnassignHeroBuildingCommandSchema,
	AllocateBuildingPowerCommandSchema,
	RecoverFirstEmberCommandSchema,
	CommitFirstEmberCommandSchema,
	MasterCommunicateCommandSchema,
	MasterConverseCommandSchema,
	MasterIssueDirectiveCommandSchema,
	MasterReplaceDirectiveCommandSchema,
	MasterRevokeDirectiveCommandSchema,
	ConfigureMasterTimingCommandSchema,
	OpenMasterDecisionCommandSchema,
	ConfigureMasterFallbackCommandSchema,
	ApplyMasterSafetyStopCommandSchema,
	CreateDailyPlanCommandSchema,
	StartRoutineCommandSchema,
	InspectGateCommandSchema,
	StartActivityCommandSchema,
	EquipItemCommandSchema,
	AdvanceSimulationCommandSchema,
	SyncSimulationClockCommandSchema,
	ApplyDamageCommandSchema,
	PrepareMissionCommandSchema,
	ReviseMissionPartyCommandSchema,
	CancelMissionCommandSchema,
	DeployMissionCommandSchema,
	ResolveMissionTurnCommandSchema,
	OpenMissionExtractionCommandSchema,
	ExtractMissionCommandSchema,
	RetreatMissionCommandSchema,
	ApplyStoryPatchCommandSchema,
	RevealFirstBandArchiveCommandSchema,
	SynthesizeHeroCommandSchema,
	ShareSynthesisRumorCommandSchema
]);

export const MissionLifecycleRequestSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('prepare'),
			heroIds: z.array(EntityIdSchema).max(4),
			missionId: MissionSlugSchema.optional()
		})
		.strict(),
	z.object({ action: z.literal('revise-party'), heroIds: z.array(EntityIdSchema).max(4) }).strict(),
	z.object({ action: z.literal('cancel') }).strict(),
	z.object({ action: z.literal('deploy') }).strict(),
	z
		.object({
			action: z.literal('resolve-turn'),
			masterActionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u)
		})
		.strict(),
	z.object({ action: z.literal('resolve-fallback') }).strict(),
	z.object({ action: z.literal('extract') }).strict(),
	z.object({ action: z.literal('retreat') }).strict()
]);

export const CatchUpRequestSchema = z
	.object({
		wallTime: IsoDateTimeSchema.optional()
	})
	.strict();

export type EngineCommand = z.infer<typeof EngineCommandSchema>;
export type FirstEmberRequest = z.infer<typeof FirstEmberRequestSchema>;
export type MissionLifecycleRequest = z.infer<typeof MissionLifecycleRequestSchema>;
export type SynthesisRequest = z.infer<typeof SynthesisRequestSchema>;
export type CommunicationRequest = z.infer<typeof CommunicationRequestSchema>;
export type ConversationRequest = z.infer<typeof ConversationRequestSchema>;
export type DirectiveRequest = z.infer<typeof DirectiveRequestSchema>;

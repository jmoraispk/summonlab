import { z } from 'zod';

import { MissionSlugSchema, StoryExpressionResolutionSchema } from '../mission.js';
import { RelationshipDimensionsSchema } from '../social.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from '../shared.js';
import { HeroProgressionSchema } from './base-state.js';
import { ExperienceReceiptSchema, HeroProgressionV2Schema } from '../progression.js';
import { MissionContentBindingSchema } from './mission-state.js';

export {
	AppliedStoryPatchSchema,
	MissionStoryBeatSchema,
	MissionStoryEnvelopeSchema,
	RuntimeBandStoryStateSchema,
	StoryBeatEligibilityRecordSchema,
	StoryBeatEligibilityReportSchema,
	StoryBeatHistorySchema,
	StoryExpressionCastMemberSchema,
	StoryExpressionFrameSchema,
	StoryExpressionHookSchema,
	StoryExpressionResolutionSchema,
	StoryForbiddenChangesSchema,
	StoryPatchCandidateSchema,
	StoryPatchCastMemberSchema,
	StoryPatchRoleBindingSchema,
	StoryPatchValidationCheckSchema,
	StoryPatchValidationCodeSchema,
	StoryPatchValidationReportSchema,
	TowerBandStoryAnchorSchema,
	TowerBandStoryBeatSchema,
	TowerBandStoryEnvelopeSchema,
	TowerBandStoryPatchSlotSchema,
	TowerBandStoryProposalSchema
} from '../mission.js';
export type {
	AppliedStoryPatch,
	RuntimeBandStoryState,
	StoryBeatEligibilityReport,
	StoryBeatHistory,
	StoryExpressionCastMember,
	StoryExpressionFrame,
	StoryExpressionResolution,
	StoryPatchCandidate,
	StoryPatchCastMember,
	StoryPatchRoleBinding,
	StoryPatchValidationCheck,
	StoryPatchValidationCode,
	StoryPatchValidationReport,
	TowerBandStoryAnchor,
	TowerBandStoryBeat,
	TowerBandStoryEnvelope
} from '../mission.js';

export const SynthesisVisibilitySchema = z.enum(['private', 'open']);
export const SynthesisKnowledgeSchema = z.enum(['participant', 'witness', 'absence']);

export const SynthesisSocialConsequenceSchema = z
	.object({
		heroId: EntityIdSchema,
		knowledge: SynthesisKnowledgeSchema,
		observationId: EntityIdSchema,
		beliefId: EntityIdSchema,
		relationshipId: EntityIdSchema,
		confidence: z.number().int().min(0).max(100),
		relationshipDeltas: RelationshipDimensionsSchema
	})
	.strict();

export const SynthesisReceiptSchema = z
	.object({
		receiptVersion: z.literal('synthesis-receipt-v1'),
		receiptId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		masterId: EntityIdSchema,
		sourceHeroId: EntityIdSchema,
		recipientHeroId: EntityIdSchema,
		visibility: SynthesisVisibilitySchema,
		warningVersion: z.literal('synthesis-warning-v1'),
		confirmedIrreversible: z.literal(true),
		rationale: z.string().min(1).max(240),
		committedAt: IsoDateTimeSchema,
		essenceExperience: z.number().int().positive().max(10_000),
		sourceProgression: HeroProgressionSchema,
		recipientProgressionBefore: HeroProgressionSchema,
		recipientProgressionAfter: HeroProgressionSchema,
		socialConsequences: z.array(SynthesisSocialConsequenceSchema).max(31)
	})
	.strict()
	.superRefine((receipt, context) => {
		if (receipt.sourceHeroId === receipt.recipientHeroId) {
			context.addIssue({ code: 'custom', message: 'Synthesis source and recipient must differ' });
		}
		if (
			new Set(receipt.socialConsequences.map((consequence) => consequence.heroId)).size !==
			receipt.socialConsequences.length
		) {
			context.addIssue({ code: 'custom', message: 'Synthesis social consequences must be unique' });
		}
	});

export const SynthesisReceiptV2Schema = z
	.object({
		...SynthesisReceiptSchema.shape,
		receiptVersion: z.literal('synthesis-receipt-v2'),
		sourceProgression: HeroProgressionV2Schema,
		recipientProgressionBefore: HeroProgressionV2Schema,
		recipientProgressionAfter: HeroProgressionV2Schema,
		experienceReceipt: ExperienceReceiptSchema
	})
	.strict()
	.superRefine((receipt, context) => {
		if (receipt.sourceHeroId === receipt.recipientHeroId) {
			context.addIssue({ code: 'custom', message: 'Synthesis source and recipient must differ' });
		}
	});

export const SynthesisRumorRecordSchema = z
	.object({
		rumorVersion: z.literal('synthesis-rumor-v1'),
		rumorId: EntityIdSchema,
		receiptId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		originObservationId: EntityIdSchema,
		speakerHeroId: EntityIdSchema,
		listenerHeroId: EntityIdSchema,
		observationId: EntityIdSchema,
		beliefId: EntityIdSchema,
		relationshipId: EntityIdSchema,
		confidence: z.number().int().min(1).max(100),
		chainDepth: z.number().int().min(1).max(8),
		relationshipDeltas: RelationshipDimensionsSchema,
		sharedAt: IsoDateTimeSchema
	})
	.strict();

export const SynthesisStateSchema = z
	.object({
		contentVersion: z.literal('synthesis-v1'),
		receipts: z.record(EntityIdSchema, SynthesisReceiptSchema),
		rumors: z.record(EntityIdSchema, SynthesisRumorRecordSchema)
	})
	.strict()
	.superRefine((synthesis, context) => {
		for (const [receiptId, receipt] of Object.entries(synthesis.receipts)) {
			if (receipt.receiptId !== receiptId) {
				context.addIssue({
					code: 'custom',
					message: 'Synthesis receipt key does not match its id'
				});
			}
		}
		for (const [rumorId, rumor] of Object.entries(synthesis.rumors)) {
			if (rumor.rumorId !== rumorId || !synthesis.receipts[rumor.receiptId]) {
				context.addIssue({ code: 'custom', message: 'Synthesis rumor reference is inconsistent' });
			}
		}
		if (
			Object.keys(synthesis.receipts).length > 512 ||
			Object.keys(synthesis.rumors).length > 4_096
		) {
			context.addIssue({ code: 'custom', message: 'Synthesis history limit exceeded' });
		}
	});

export const SynthesisStateV2Schema = z
	.object({
		contentVersion: z.literal('synthesis-v2'),
		receipts: z.record(EntityIdSchema, z.union([SynthesisReceiptSchema, SynthesisReceiptV2Schema])),
		rumors: z.record(EntityIdSchema, SynthesisRumorRecordSchema)
	})
	.strict()
	.superRefine((synthesis, context) => {
		for (const [receiptId, receipt] of Object.entries(synthesis.receipts)) {
			if (receipt.receiptId !== receiptId) {
				context.addIssue({
					code: 'custom',
					message: 'Synthesis receipt key does not match its id'
				});
			}
		}
		for (const [rumorId, rumor] of Object.entries(synthesis.rumors)) {
			if (rumor.rumorId !== rumorId) {
				context.addIssue({ code: 'custom', message: 'Synthesis rumor key does not match its id' });
			}
		}
	});

export const FirstBandArchiveKnowledgeSchema = z
	.object({
		heroId: EntityIdSchema,
		role: z.enum(['reader', 'witness']),
		learnedAt: IsoDateTimeSchema,
		sourceEventId: EntityIdSchema
	})
	.strict();

export const FirstBandExtractionReceiptSchema = z
	.object({
		receiptVersion: z.literal('first-band-extraction-receipt-v1'),
		receiptId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		missionAttemptId: EntityIdSchema,
		missionBinding: MissionContentBindingSchema,
		recoveredAt: IsoDateTimeSchema,
		survivingHeroIds: z.array(EntityIdSchema).max(7),
		rewardGrantIds: z
			.tuple([z.literal('hearth-relight-core'), z.literal('first-hearth-archive-fragment')])
			.readonly(),
		completedStoryHistoryHash: StateHashSchema
	})
	.strict()
	.superRefine((receipt, context) => {
		if (
			receipt.missionBinding.missionId !== 'tower-floor-05' ||
			new Set(receipt.survivingHeroIds).size !== receipt.survivingHeroIds.length
		) {
			context.addIssue({
				code: 'custom',
				message: 'First-band extraction receipt is inconsistent'
			});
		}
	});

export const FirstBandArchiveRevealSchema = z
	.object({
		revealVersion: z.literal('first-band-archive-reveal-v1'),
		revealId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		readerHeroId: EntityIdSchema,
		revealedAt: IsoDateTimeSchema,
		canonicalMessage: z.literal('Hearth 01 was not the first.'),
		expression: StoryExpressionResolutionSchema,
		knowledge: z.array(FirstBandArchiveKnowledgeSchema).min(1).max(31)
	})
	.strict()
	.superRefine((reveal, context) => {
		const readers = reveal.knowledge.filter((record) => record.role === 'reader');
		if (
			readers.length !== 1 ||
			readers[0]?.heroId !== reveal.readerHeroId ||
			reveal.expression.speakerId !== reveal.readerHeroId ||
			new Set(reveal.knowledge.map((record) => record.heroId)).size !== reveal.knowledge.length
		) {
			context.addIssue({ code: 'custom', message: 'Archive reveal knowledge is inconsistent' });
		}
	});

export const FirstBandArchiveStateSchema = z
	.object({
		archiveVersion: z.literal('first-band-archive-v1'),
		status: z.enum(['sealed', 'recovered', 'revealed']),
		envelopeId: MissionSlugSchema,
		envelopeContentHash: StateHashSchema,
		canonicalMessageHash: StateHashSchema,
		recovery: FirstBandExtractionReceiptSchema.nullable(),
		reveal: FirstBandArchiveRevealSchema.nullable()
	})
	.strict()
	.superRefine((archive, context) => {
		if (
			(archive.status === 'sealed' && (archive.recovery !== null || archive.reveal !== null)) ||
			(archive.status === 'recovered' && (archive.recovery === null || archive.reveal !== null)) ||
			(archive.status === 'revealed' && (archive.recovery === null || archive.reveal === null))
		) {
			context.addIssue({ code: 'custom', message: 'First-band archive lifecycle is inconsistent' });
		}
	});

export type SynthesisReceipt = z.infer<typeof SynthesisReceiptSchema>;
export type SynthesisReceiptV2 = z.infer<typeof SynthesisReceiptV2Schema>;
export type SynthesisRumorRecord = z.infer<typeof SynthesisRumorRecordSchema>;
export type SynthesisState = z.infer<typeof SynthesisStateSchema>;
export type SynthesisStateV2 = z.infer<typeof SynthesisStateV2Schema>;
export type FirstBandArchiveState = z.infer<typeof FirstBandArchiveStateSchema>;
export type FirstBandExtractionReceipt = z.infer<typeof FirstBandExtractionReceiptSchema>;
export type FirstBandArchiveReveal = z.infer<typeof FirstBandArchiveRevealSchema>;
export type SynthesisVisibility = z.infer<typeof SynthesisVisibilitySchema>;

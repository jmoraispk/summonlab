import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import {
	TOWER_BAND_01_STORY_ENVELOPE,
	calculateTowerBandStoryContentHash,
	evaluateStoryBeatEligibility,
	loadTowerBand01StoryEnvelope,
	resolveStoryExpression
} from '@summonlab/content';
import { hashCanonical } from '@summonlab/engine';
import { z } from 'zod';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

const StoryFloorSummarySchema = z
	.object({
		floor: z.number().int().min(1).max(5),
		missionId: z.string().min(1),
		displayName: z.string().min(1),
		narrativeJob: z.string().min(1),
		mechanicalJob: z.string().min(1),
		requiredBeatCount: z.literal(5),
		optionalBeatCount: z.literal(2),
		patchSlotId: z.string().min(1),
		openingTitle: z.string().min(1),
		finaleTitle: z.string().min(1)
	})
	.strict();

const StoryEligibilitySnapshotSchema = z
	.object({
		snapshotId: z.string().min(1),
		label: z.string().min(1),
		unlockedFloor: z.number().int().min(1).max(5),
		completedBeatCount: z.number().int().nonnegative(),
		activatedProposalIds: z.array(z.string()),
		nextDefaultBeatId: z.string().nullable(),
		eligibleBeatIds: z.array(z.string()),
		eligibilityHash: HashSchema
	})
	.strict();

const StoryVoiceSchema = z
	.object({
		seed: z.string().min(1),
		characterId: z.string().uuid(),
		displayName: z.string().min(1),
		adultAge: z.number().int().min(18).max(42),
		pronouns: z.string().min(1),
		skinTone: z.string().min(1),
		hairColor: z.string().min(1),
		clothColor: z.string().regex(/^#[a-f0-9]{6}$/iu),
		accentColor: z.string().regex(/^#[a-f0-9]{6}$/iu),
		primaryValue: z.string().min(1),
		primaryDrive: z.string().min(1),
		socialStyle: z.string().min(1),
		dailyHabit: z.string().min(1),
		frame: z.string().min(1),
		spokenLine: z.string().min(1),
		deliveryBrief: z.string().min(1),
		habitGesture: z.string().min(1),
		selectionScore: z.number().int()
	})
	.strict();

export const StoryEnvelopeReportSchema = z
	.object({
		schemaVersion: z.literal('story-envelope-report-v1'),
		generatorVersion: z.literal('story-envelope-generator-v1'),
		envelopeId: z.string().min(1),
		contentVersion: z.literal('tower-band-01-story-v1'),
		contentHash: HashSchema,
		recomputedContentHash: HashSchema,
		strictRecomputeMatches: z.literal(true),
		title: z.string().min(1),
		theme: z.string().min(1),
		emotionalQuestion: z.string().min(1),
		worldLaws: z
			.array(
				z
					.object({
						lawId: z.string().min(1),
						statement: z.string().min(1),
						enforcedBy: z.string().min(1)
					})
					.strict()
			)
			.length(5),
		openingFacts: z.array(z.string()).length(3),
		floors: z.array(StoryFloorSummarySchema).length(5),
		requiredBeatCount: z.literal(25),
		optionalBeatCount: z.literal(10),
		anchorCount: z.literal(25),
		patchSlotCount: z.literal(5),
		expressionHookCount: z.literal(5),
		rewardBudgetPoints: z.literal(1010),
		rewardDeclaredCost: z.literal(1010),
		eligibilitySnapshots: z.array(StoryEligibilitySnapshotSchema).length(4),
		expressionProof: z
			.object({
				hookId: z.string().min(1),
				anchorId: z.string().min(1),
				immutableFact: z.string().min(1),
				voices: z.array(StoryVoiceSchema).length(2),
				factsPreserved: z.literal(true),
				voicesDiffer: z.literal(true),
				unknownKnowledgeProducesNoVoice: z.literal(true)
			})
			.strict(),
		finaleConstraints: z
			.array(
				z
					.object({
						constraintId: z.string().min(1),
						summary: z.string().min(1),
						enforcedBy: z.string().min(1)
					})
					.strict()
			)
			.length(3),
		evidenceHash: HashSchema
	})
	.strict();

export type StoryEnvelopeReport = z.infer<typeof StoryEnvelopeReportSchema>;

const floorJobs = [
	{
		narrativeJob: 'Establish the need and ask who may command.',
		mechanicalJob: 'Introduce knowledge boundaries and the First Ember.'
	},
	{
		narrativeJob: 'Complicate strength with mutual dependence.',
		mechanicalJob: 'Require formation and a second capability.'
	},
	{
		narrativeJob: 'Divide protection, survival, and trust.',
		mechanicalJob: 'Apply injury, scarcity, and retreat pressure.'
	},
	{
		narrativeJob: 'Reveal the cost of what the company noticed.',
		mechanicalJob: 'Test separation, preparation, and held information.'
	},
	{
		narrativeJob: 'Judge authority by preparation and consequence.',
		mechanicalJob: 'Pay off the Warden conflict and preserve aftermath.'
	}
] as const;

function eligibilitySnapshot(
	snapshotId: string,
	label: string,
	unlockedFloor: number,
	completedBeatIds: string[],
	activatedProposalIds: string[]
) {
	const report = evaluateStoryBeatEligibility(TOWER_BAND_01_STORY_ENVELOPE, {
		historyVersion: 'story-beat-history-v1',
		unlockedFloor,
		completedBeatIds,
		activatedProposalIds
	});
	return {
		snapshotId,
		label,
		unlockedFloor,
		completedBeatCount: completedBeatIds.length,
		activatedProposalIds,
		nextDefaultBeatId: report.nextDefaultBeatId,
		eligibleBeatIds: report.records
			.filter((record) => record.status === 'eligible')
			.map((record) => record.beatId),
		eligibilityHash: hashCanonical(report)
	};
}

export async function generateStoryEnvelopeReport(): Promise<StoryEnvelopeReport> {
	const envelope = await loadTowerBand01StoryEnvelope();
	const recomputedContentHash = await calculateTowerBandStoryContentHash(envelope);
	const floors = envelope.contentCatalog.missionBindings.map((binding, index) => {
		const floorBeats = envelope.beats.filter((beat) => beat.floor === binding.floor);
		return {
			floor: binding.floor,
			missionId: binding.missionId,
			displayName: [
				'The Unlit Muster',
				'The Broken Procession',
				'The Red Tithe',
				'The Severed Relay',
				'The Living Foundry'
			][index]!,
			...floorJobs[index]!,
			requiredBeatCount: floorBeats.filter((beat) => beat.required).length,
			optionalBeatCount: floorBeats.filter((beat) => !beat.required).length,
			patchSlotId: envelope.patchSlots.find((slot) => slot.floor === binding.floor)!.slotId,
			openingTitle: floorBeats.find((beat) => beat.kind === 'opening')!.title,
			finaleTitle: floorBeats.find((beat) => beat.kind === 'extraction')!.title
		};
	});
	const requiredThroughFloor = (floor: number) =>
		envelope.defaultBeatOrder.filter(
			(beatId) => envelope.beats.find((beat) => beat.beatId === beatId)!.floor <= floor
		);
	const floor04Pressure = envelope.beats.find(
		(beat) => beat.floor === 4 && beat.kind === 'pressure'
	)!;
	const throughFloor04Pressure = envelope.defaultBeatOrder.slice(
		0,
		envelope.defaultBeatOrder.indexOf(floor04Pressure.beatId) + 1
	);
	const floor04Proposal = envelope.patchSlots.find((slot) => slot.floor === 4)!
		.allowedProposalIds[0]!;
	const eligibilitySnapshots = [
		eligibilitySnapshot('threshold', 'Before Floor 01', 1, [], []),
		eligibilitySnapshot(
			'first-rule-learned',
			'After Floor 01 extraction',
			2,
			requiredThroughFloor(1),
			[]
		),
		eligibilitySnapshot('relay-patch-open', 'Floor 04 patch point', 4, throughFloor04Pressure, [
			floor04Proposal
		]),
		eligibilitySnapshot(
			'foundry-unlocked',
			'After Floor 04 extraction',
			5,
			requiredThroughFloor(4),
			[]
		)
	];

	const hook = envelope.expressionHooks[3]!;
	const anchor = envelope.anchors.find((candidate) => candidate.anchorId === hook.anchorId)!;
	const voiceSeeds = ['story-c', 'story-e'] as const;
	const drafts = await Promise.all(
		voiceSeeds.map((seed) => generateCharacterDraft(recipeFromSeed(seed)))
	);
	const voices = drafts.map((draft, index) => {
		const resolution = resolveStoryExpression(envelope, hook.hookId, [
			{
				characterId: draft.manifest.characterId,
				displayName: draft.manifest.displayName,
				lifeState: 'active',
				mind: draft.mind,
				knownAnchorIds: [anchor.anchorId]
			}
		])!;
		return {
			seed: voiceSeeds[index]!,
			characterId: draft.manifest.characterId,
			displayName: draft.manifest.displayName,
			adultAge: draft.manifest.adultAge,
			pronouns: draft.manifest.pronouns,
			skinTone: draft.manifest.phenotype.skinTone,
			hairColor: draft.manifest.phenotype.hairColor,
			clothColor: draft.manifest.palette.cloth,
			accentColor: draft.manifest.palette.accent,
			primaryValue: draft.mind.primaryValue,
			primaryDrive: draft.mind.primaryDrive,
			socialStyle: draft.mind.socialStyle,
			dailyHabit: draft.mind.dailyHabit,
			frame: resolution.frame,
			spokenLine: resolution.spokenLine,
			deliveryBrief: resolution.deliveryBrief,
			habitGesture: resolution.habitGesture,
			selectionScore: resolution.selectionScore
		};
	});
	const factsPreserved = voices.every((voice) => voice.spokenLine.endsWith(anchor.immutableFact));
	const voicesDiffer =
		new Set(voices.map((voice) => `${voice.frame}:${voice.spokenLine}`)).size === 2;
	const unknownKnowledgeProducesNoVoice =
		resolveStoryExpression(envelope, hook.hookId, [
			{
				characterId: drafts[0]!.manifest.characterId,
				displayName: drafts[0]!.manifest.displayName,
				lifeState: 'active',
				mind: drafts[0]!.mind,
				knownAnchorIds: []
			}
		]) === null;
	if (!factsPreserved || !voicesDiffer || !unknownKnowledgeProducesNoVoice) {
		throw new Error('Story expression proof violated a fixed-fact or knowledge boundary');
	}

	const payload = {
		schemaVersion: 'story-envelope-report-v1' as const,
		generatorVersion: 'story-envelope-generator-v1' as const,
		envelopeId: envelope.envelopeId,
		contentVersion: envelope.contentVersion,
		contentHash: envelope.contentHash,
		recomputedContentHash,
		strictRecomputeMatches: recomputedContentHash === envelope.contentHash,
		title: envelope.title,
		theme: envelope.theme,
		emotionalQuestion: envelope.emotionalQuestion,
		worldLaws: envelope.worldLaws,
		openingFacts: envelope.openingState.establishedFacts,
		floors,
		requiredBeatCount: envelope.beats.filter((beat) => beat.required).length,
		optionalBeatCount: envelope.beats.filter((beat) => !beat.required).length,
		anchorCount: envelope.anchors.length,
		patchSlotCount: envelope.patchSlots.length,
		expressionHookCount: envelope.expressionHooks.length,
		rewardBudgetPoints: envelope.rewardBudget.budgetPoints,
		rewardDeclaredCost: envelope.rewardBudget.declaredCost,
		eligibilitySnapshots,
		expressionProof: {
			hookId: hook.hookId,
			anchorId: anchor.anchorId,
			immutableFact: anchor.immutableFact,
			voices,
			factsPreserved,
			voicesDiffer,
			unknownKnowledgeProducesNoVoice
		},
		finaleConstraints: envelope.finaleConstraints.map((constraint) => ({
			constraintId: constraint.constraintId,
			summary: constraint.summary,
			enforcedBy: constraint.enforcedBy
		}))
	};
	return StoryEnvelopeReportSchema.parse({
		...payload,
		evidenceHash: hashCanonical(payload)
	});
}

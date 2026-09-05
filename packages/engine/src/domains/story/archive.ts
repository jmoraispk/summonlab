import {
	FirstBandArchiveRevealSchema,
	FirstBandArchiveStateSchema,
	FirstBandExtractionReceiptSchema,
	RuntimeBandStoryStateSchema,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type MissionRunStateV8
} from '@summonlab/contracts';
import { resolveStoryExpression } from '@summonlab/content';

import { verifiedStoryEnvelope } from '../../core/content-bindings.js';
import { IllegalActionError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';

export const FIRST_BAND_ARCHIVE_MESSAGE = 'Hearth 01 was not the first.' as const;

export function createFirstBandArchiveStoryCheckpoint() {
	const envelope = verifiedStoryEnvelope();
	const floorFourExtraction = envelope.beats.find(
		(beat) => beat.floor === 4 && beat.kind === 'extraction' && beat.required
	);
	if (!floorFourExtraction) throw new Error('Floor 04 extraction story checkpoint is unavailable');
	const extractionIndex = envelope.defaultBeatOrder.indexOf(floorFourExtraction.beatId);
	if (extractionIndex < 0) throw new Error('Floor 04 extraction left the default story route');
	return RuntimeBandStoryStateSchema.parse({
		storyVersion: 'runtime-band-story-v1',
		envelopeId: envelope.envelopeId,
		envelopeContentVersion: envelope.contentVersion,
		envelopeContentHash: envelope.contentHash,
		history: {
			historyVersion: 'story-beat-history-v1',
			unlockedFloor: 5,
			completedBeatIds: envelope.defaultBeatOrder.slice(0, extractionIndex + 1),
			activatedProposalIds: []
		},
		appliedPatches: []
	});
}

export function createSealedFirstBandArchive() {
	const envelope = verifiedStoryEnvelope();
	return FirstBandArchiveStateSchema.parse({
		archiveVersion: 'first-band-archive-v1',
		status: 'sealed',
		envelopeId: envelope.envelopeId,
		envelopeContentHash: envelope.contentHash,
		canonicalMessageHash: hashCanonical(FIRST_BAND_ARCHIVE_MESSAGE),
		recovery: null,
		reveal: null
	});
}

export function completeFirstBandStory(state: EngineGameStateV23 | EngineGameStateV24) {
	const envelope = verifiedStoryEnvelope();
	if (
		state.bandStory.envelopeId !== envelope.envelopeId ||
		state.bandStory.envelopeContentHash !== envelope.contentHash
	) {
		throw new IllegalActionError('mission.extract');
	}
	return RuntimeBandStoryStateSchema.parse({
		...state.bandStory,
		history: {
			...state.bandStory.history,
			unlockedFloor: 5,
			completedBeatIds: [...envelope.defaultBeatOrder]
		}
	});
}

export function recoverFirstBandArchive(
	state: EngineGameStateV23 | EngineGameStateV24,
	sourceEventId: string,
	mission: MissionRunStateV8,
	bandStory: EngineGameStateV23['bandStory']
) {
	const attempt = mission.attempt;
	if (
		state.firstBandArchive.status !== 'sealed' ||
		mission.binding.missionId !== 'tower-floor-05' ||
		attempt?.status !== 'success' ||
		attempt.outcome !== 'success'
	) {
		return state.firstBandArchive;
	}
	const survivingHeroIds = attempt.party.heroIds
		.filter((heroId) => state.heroes[heroId]?.lifeState === 'active')
		.sort((left, right) => left.localeCompare(right));
	const receipt = FirstBandExtractionReceiptSchema.parse({
		receiptVersion: 'first-band-extraction-receipt-v1',
		receiptId: deterministicUuid(`${sourceEventId}:first-band-extraction-receipt`),
		sourceEventId,
		missionAttemptId: attempt.attemptId,
		missionBinding: mission.binding,
		recoveredAt: state.simulatedAt,
		survivingHeroIds,
		rewardGrantIds: ['hearth-relight-core', 'first-hearth-archive-fragment'],
		completedStoryHistoryHash: hashCanonical(bandStory.history)
	});
	return FirstBandArchiveStateSchema.parse({
		...state.firstBandArchive,
		status: 'recovered',
		recovery: receipt
	});
}

export function revealFirstBandArchive(
	state: EngineGameStateV23,
	readerHeroId: string,
	sourceEventId: string
) {
	const reader = state.heroes[readerHeroId];
	const recovery = state.firstBandArchive.recovery;
	if (
		state.firstBandArchive.status !== 'recovered' ||
		!recovery ||
		!reader ||
		reader.lifeState !== 'active' ||
		!recovery.survivingHeroIds.includes(readerHeroId)
	) {
		throw new IllegalActionError('story.reveal.first.archive');
	}
	const expression = resolveStoryExpression(
		verifiedStoryEnvelope(),
		'floor-five-outcome-anchor-expression',
		[
			{
				characterId: readerHeroId,
				displayName: `Summon ${readerHeroId.slice(0, 6).toUpperCase()}`,
				lifeState: 'active',
				mind: reader.mind,
				knownAnchorIds: ['floor-five-outcome-anchor']
			}
		]
	);
	if (!expression) throw new IllegalActionError('story.reveal.first.archive');
	const witnessHeroIds = Object.values(state.heroes)
		.filter(
			(hero) =>
				hero.lifeState === 'active' &&
				hero.location === state.master.location &&
				hero.heroId !== readerHeroId
		)
		.map((hero) => hero.heroId)
		.sort((left, right) => left.localeCompare(right));
	const reveal = FirstBandArchiveRevealSchema.parse({
		revealVersion: 'first-band-archive-reveal-v1',
		revealId: deterministicUuid(`${sourceEventId}:first-band-archive-reveal`),
		sourceEventId,
		readerHeroId,
		revealedAt: state.simulatedAt,
		canonicalMessage: FIRST_BAND_ARCHIVE_MESSAGE,
		expression,
		knowledge: [readerHeroId, ...witnessHeroIds].map((heroId) => ({
			heroId,
			role: heroId === readerHeroId ? ('reader' as const) : ('witness' as const),
			learnedAt: state.simulatedAt,
			sourceEventId
		}))
	});
	return {
		reveal,
		archive: FirstBandArchiveStateSchema.parse({
			...state.firstBandArchive,
			status: 'revealed',
			reveal
		})
	};
}

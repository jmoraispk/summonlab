import type { EngineGameStateV23 } from '@summonlab/contracts';
import { TOWER_BAND_01_STORY_ENVELOPE, resolveStoryExpression } from '@summonlab/content';
import { legalActions } from '@summonlab/engine';

const callsigns = ['ASH', 'VOW', 'LARK', 'SABLE'] as const;

export function firstBandArchiveView(state: EngineGameStateV23, stateHash: string) {
	const recovery = state.firstBandArchive.recovery;
	const reveal = state.firstBandArchive.reveal;
	const sortedHeroes = Object.values(state.heroes).sort((left, right) =>
		left.heroId.localeCompare(right.heroId)
	);
	const survivors = (recovery?.survivingHeroIds ?? []).map((heroId) => {
		const hero = state.heroes[heroId]!;
		const index = sortedHeroes.findIndex((candidate) => candidate.heroId === heroId);
		const expression = resolveStoryExpression(
			TOWER_BAND_01_STORY_ENVELOPE,
			'floor-five-outcome-anchor-expression',
			[
				{
					characterId: heroId,
					displayName: callsigns[index] ?? `HERO ${index + 1}`,
					lifeState: 'active',
					mind: hero.mind,
					knownAnchorIds: ['floor-five-outcome-anchor']
				}
			]
		);
		const knowledge = reveal?.knowledge.find((record) => record.heroId === heroId) ?? null;
		return {
			heroId,
			displayName: callsigns[index] ?? `HERO ${index + 1}`,
			primaryValue: hero.mind.primaryValue,
			primaryDrive: hero.mind.primaryDrive,
			socialStyle: hero.mind.socialStyle,
			habit: hero.mind.dailyHabit,
			health: hero.health,
			frame: expression?.frame ?? 'plain',
			knowledge
		};
	});
	const floorFiveBeats = TOWER_BAND_01_STORY_ENVELOPE.beats
		.filter((beat) => beat.floor === 5 && beat.required)
		.map((beat) => {
			const masksArchiveTruth = beat.kind === 'recovery' && !reveal;
			return {
				beatId: beat.beatId,
				kind: beat.kind,
				title: masksArchiveTruth ? 'A sealed memory' : beat.title,
				summary: masksArchiveTruth
					? 'The broken construct releases power and an archive fragment no one has read.'
					: beat.summary,
				completed: state.bandStory.history.completedBeatIds.includes(beat.beatId)
			};
		});
	return {
		runId: state.runId,
		version: state.version,
		eventCursor: state.eventCursor,
		stateHash,
		contentVersion: state.contentVersion,
		status: state.firstBandArchive.status,
		story: {
			title: TOWER_BAND_01_STORY_ENVELOPE.title,
			theme: TOWER_BAND_01_STORY_ENVELOPE.theme,
			beats: floorFiveBeats,
			completedHistoryHash: recovery?.completedStoryHistoryHash ?? null
		},
		recovery: recovery
			? {
					receiptId: recovery.receiptId,
					sourceEventId: recovery.sourceEventId,
					attemptId: recovery.missionAttemptId,
					recoveredAt: recovery.recoveredAt,
					rewardGrantIds: recovery.rewardGrantIds
				}
			: null,
		canonicalMessageHash: state.firstBandArchive.canonicalMessageHash,
		reveal,
		survivors,
		canReveal: legalActions(state, state.master.masterId).some(
			(action) => action.actionId === 'story.first.archive.reveal'
		)
	};
}

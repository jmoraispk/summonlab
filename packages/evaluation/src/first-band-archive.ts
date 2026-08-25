import { EngineCommandSchema, EngineGameStateV23Schema } from '@summonlab/contracts';
import { applyCommand, hashCanonical, replayEventsStrict } from '@summonlab/engine';

import { createFirstBandArchiveTrial } from './foundry.js';

const EVIDENCE_SEED = 'archive-smoke';
const CANONICAL_MESSAGE = 'Hearth 01 was not the first.' as const;

function blocked(label: string, action: () => unknown) {
	try {
		action();
		return { label, blocked: false };
	} catch {
		return { label, blocked: true };
	}
}

export function generateFirstBandArchiveReport() {
	const trials = [0, 1, 2, 3].map((readerIndex) =>
		createFirstBandArchiveTrial(EVIDENCE_SEED, readerIndex)
	);
	const representative = trials[0]!;
	const archive = representative.state.firstBandArchive;
	const recovery = archive.recovery!;
	const reveal = archive.reveal!;
	const extractionIndex = representative.events.findIndex(
		(event) => event.eventId === recovery.sourceEventId && event.eventType === 'mission.extracted'
	);
	if (extractionIndex < 1) throw new Error('Archive recovery lost its extraction source');
	const beforeExtraction = replayEventsStrict(representative.events.slice(0, extractionIndex));
	if (beforeExtraction.snapshot.state.schemaVersion !== 23) {
		throw new Error('Archive evidence lost engine-v23');
	}
	const checks = [
		{
			code: 'extraction-gated-recovery',
			passed:
				beforeExtraction.snapshot.state.firstBandArchive.status === 'sealed' &&
				representative.events[extractionIndex]?.eventType === 'mission.extracted' &&
				recovery.missionBinding.missionId === 'tower-floor-05'
		},
		{
			code: 'authored-reward-grants',
			passed:
				recovery.rewardGrantIds.join('|') === 'hearth-relight-core|first-hearth-archive-fragment'
		},
		{
			code: 'first-band-story-complete',
			passed:
				representative.state.bandStory.history.unlockedFloor === 5 &&
				representative.state.bandStory.history.completedBeatIds.includes(
					'floor-five-confrontation'
				) &&
				representative.state.bandStory.history.completedBeatIds.at(-1) ===
					'floor-five-extraction' &&
				recovery.completedStoryHistoryHash === hashCanonical(representative.state.bandStory.history)
		},
		{
			code: 'fixed-archive-truth',
			passed:
				reveal.canonicalMessage === CANONICAL_MESSAGE &&
				archive.canonicalMessageHash === hashCanonical(CANONICAL_MESSAGE)
		},
		{
			code: 'personality-shaped-delivery',
			passed:
				trials.map((trial) => trial.state.firstBandArchive.reveal!.expression.frame).join('|') ===
				'operational|defiant|relational|cautious'
		},
		{
			code: 'holder-bound-knowledge',
			passed:
				reveal.knowledge.length === 4 &&
				reveal.knowledge.filter((record) => record.role === 'reader').length === 1 &&
				reveal.knowledge.every((record) => representative.heroIds.includes(record.heroId))
		},
		{
			code: 'story-director-cannot-rewrite-fact',
			passed:
				representative.state.bandStory.appliedPatches.length === 0 &&
				trials.every(
					(trial) => trial.state.firstBandArchive.reveal?.canonicalMessage === CANONICAL_MESSAGE
				)
		},
		{
			code: 'strict-replay',
			passed: trials.every((trial) => trial.replayVerified)
		}
	];
	const adversarial = [
		blocked('reveal before successful extraction', () => {
			const state = EngineGameStateV23Schema.parse(beforeExtraction.snapshot.state);
			return applyCommand(
				state,
				EngineCommandSchema.parse({
					commandId: '23000000-0000-4000-8000-000000000001',
					runId: state.runId,
					actorId: state.master.masterId,
					expectedVersion: state.version,
					correlationId: '23000000-0000-4000-8000-000000000002',
					source: {
						source: 'manual',
						timing: 'step',
						fallbackPolicy: null,
						directiveIds: [],
						decisionJobId: null
					},
					commandType: 'story.reveal.first.archive',
					readerHeroId: representative.readerHeroId
				})
			);
		}),
		blocked('tamper canonical archive message', () => {
			const events = structuredClone(representative.events);
			const finalPayload = events.at(-1)!.payload as Record<string, unknown>;
			const tamperedArchive = structuredClone(finalPayload.firstBandArchive) as {
				reveal: { canonicalMessage: string };
			};
			tamperedArchive.reveal.canonicalMessage = 'Hearth 01 was the first.';
			finalPayload.firstBandArchive = tamperedArchive;
			return replayEventsStrict(events);
		}),
		blocked('tamper extraction receipt source', () =>
			EngineGameStateV23Schema.parse({
				...representative.state,
				firstBandArchive: {
					...archive,
					recovery: {
						...recovery,
						missionBinding: { ...recovery.missionBinding, missionId: 'tower-floor-04' }
					}
				}
			})
		)
	];
	if (checks.some((check) => !check.passed) || adversarial.some((test) => !test.blocked)) {
		throw new Error(
			`First-band archive evidence failed: ${JSON.stringify({ checks, adversarial })}`
		);
	}
	return {
		reportVersion: 'first-band-archive-evidence-v1',
		contentVersion: representative.state.contentVersion,
		envelopeId: representative.state.bandStory.envelopeId,
		checks,
		adversarial,
		extraction: {
			eventId: recovery.sourceEventId,
			attemptId: recovery.missionAttemptId,
			rewardGrantIds: recovery.rewardGrantIds,
			survivingHeroIds: recovery.survivingHeroIds,
			recoveryStateHash: representative.recoveryStateHash
		},
		reveal: {
			eventId: reveal.sourceEventId,
			canonicalMessage: reveal.canonicalMessage,
			knowledge: reveal.knowledge,
			readerVariants: trials.map((trial) => ({
				readerHeroId: trial.readerHeroId,
				frame: trial.state.firstBandArchive.reveal!.expression.frame,
				spokenLine: trial.state.firstBandArchive.reveal!.expression.spokenLine,
				habitGesture: trial.state.firstBandArchive.reveal!.expression.habitGesture,
				stateHash: hashCanonical(trial.state)
			}))
		},
		replay: {
			eventCount: representative.events.length,
			eventTypes: representative.events.map((event) => event.eventType),
			stateHash: hashCanonical(representative.state),
			verified: true
		}
	};
}

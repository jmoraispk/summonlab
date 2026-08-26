import { describe, expect, it } from 'vitest';

import {
	MODERATED_PLAYTEST_RECRUITMENT_PLAN,
	ModeratedPlaytestSourceSchema,
	createEmptyModeratedPlaytestSource,
	createModeratedPlaytestReport,
	type ModeratedPlaytestSession
} from './moderated-playtest.js';
import {
	PlaytestReleaseReportSchema,
	assertPlaytestReleaseReady,
	createPlaytestReleaseReport
} from './playtest-release.js';

function completedSession(index: number): ModeratedPlaytestSession {
	const slot = MODERATED_PLAYTEST_RECRUITMENT_PLAN[index]!;
	return {
		participantCode: slot.participantCode,
		track: slot.track,
		viewport: slot.viewport,
		buildCommit: 'a'.repeat(40),
		startedAt: `2026-08-2${index + 1}T18:00:00.000Z`,
		durationMinutes: 60,
		analyticsChoice: 'declined',
		disposition: 'completed',
		taskResults: slot.requiredTaskIds.map((taskId) => ({
			taskId,
			outcome: 'completed-unassisted',
			moderatorPromptCount: 0
		})),
		attestation: {
			adultParticipationConfirmed: true,
			qualitativeNoteConsentConfirmed: true,
			noRecordingMade: true,
			participantIdentifiersRemoved: true,
			directQuotesParaphrased: true,
			rawNotesKeptOutsideRepository: true
		}
	};
}

describe('private playtest release gate', () => {
	it('holds the current empty cohort and names every unmet human prerequisite', () => {
		const release = createPlaytestReleaseReport(
			createModeratedPlaytestReport(createEmptyModeratedPlaytestSource())
		);

		expect(PlaytestReleaseReportSchema.parse(release)).toEqual(release);
		expect(release.status).toBe('held');
		expect(release.checks.map((check) => [check.checkId, check.status])).toEqual([
			['evidence-integrity', 'pass'],
			['human-sessions', 'hold'],
			['assigned-task-coverage', 'hold'],
			['release-findings', 'hold']
		]);
		expect(() => assertPlaytestReleaseReady(release)).toThrow(/0\/5/u);
	});

	it('opens packaging only for five fully covered sessions with no unverified P0 or P1', () => {
		const source = ModeratedPlaytestSourceSchema.parse({
			...createEmptyModeratedPlaytestSource(),
			updatedAt: '2026-08-25T20:00:00.000Z',
			sessions: MODERATED_PLAYTEST_RECRUITMENT_PLAN.map((_, index) => completedSession(index))
		});
		const release = createPlaytestReleaseReport(createModeratedPlaytestReport(source));

		expect(release.status).toBe('ready-to-package');
		expect(release.blockers).toEqual([]);
		expect(() => assertPlaytestReleaseReady(release)).not.toThrow();
	});

	it('rejects a valid-shaped release report whose hashed content was edited', () => {
		const release = createPlaytestReleaseReport(
			createModeratedPlaytestReport(createEmptyModeratedPlaytestSource())
		);
		const edited = PlaytestReleaseReportSchema.parse({
			...release,
			checks: release.checks.map((check) =>
				check.checkId === 'human-sessions' ? { ...check, detail: '5/5 claimed by hand.' } : check
			)
		});

		expect(() => assertPlaytestReleaseReady(edited)).toThrow(/report hash/u);
	});

	it('holds when the FIN-007 content no longer matches its evidence hash', () => {
		const moderated = createModeratedPlaytestReport(createEmptyModeratedPlaytestSource());
		const release = createPlaytestReleaseReport({
			...moderated,
			updatedAt: '2026-08-25T01:00:00.000Z'
		});

		expect(release.status).toBe('held');
		expect(release.checks[0]).toMatchObject({ checkId: 'evidence-integrity', status: 'hold' });
	});
});

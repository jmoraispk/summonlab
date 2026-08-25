import { describe, expect, it } from 'vitest';

import {
	MODERATED_PLAYTEST_RECRUITMENT_PLAN,
	MODERATED_PLAYTEST_REPORT_VERSION,
	ModeratedPlaytestReportSchema,
	ModeratedPlaytestSourceSchema,
	createEmptyModeratedPlaytestSource,
	createModeratedPlaytestReport,
	type ModeratedPlaytestFinding,
	type ModeratedPlaytestSession,
	type ModeratedPlaytestSource
} from './moderated-playtest.js';

const BUILD_COMMIT = 'a'.repeat(40);

function session(
	index: number,
	override?: Partial<ModeratedPlaytestSession>
): ModeratedPlaytestSession {
	const slot = MODERATED_PLAYTEST_RECRUITMENT_PLAN[index]!;
	return {
		participantCode: slot.participantCode,
		track: slot.track,
		viewport: slot.viewport,
		buildCommit: BUILD_COMMIT,
		startedAt: `2026-08-2${index + 1}T18:00:00.000Z`,
		durationMinutes: 60,
		analyticsChoice: index % 2 === 0 ? 'shared' : 'declined',
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
		},
		...override
	};
}

function source(
	sessions: ModeratedPlaytestSession[],
	findings: ModeratedPlaytestFinding[] = []
): ModeratedPlaytestSource {
	return ModeratedPlaytestSourceSchema.parse({
		...createEmptyModeratedPlaytestSource(),
		updatedAt: '2026-08-25T20:00:00.000Z',
		sessions,
		findings
	});
}

describe('moderated playtest evidence', () => {
	it('keeps the empty cohort explicitly ready rather than claiming human evidence', () => {
		const report = createModeratedPlaytestReport(createEmptyModeratedPlaytestSource());

		expect(ModeratedPlaytestReportSchema.parse(report)).toEqual(report);
		expect(report).toMatchObject({
			schemaVersion: MODERATED_PLAYTEST_REPORT_VERSION,
			moderationStatus: 'ready',
			releaseRecommendation: 'awaiting-sessions',
			qualityGate: {
				requiredSessionCount: 5,
				conductedSessionCount: 0,
				coveredTaskCount: 0,
				allAssignedTasksObserved: false
			}
		});
	});

	it('marks five fully observed tracks complete and release-candidate', () => {
		const report = createModeratedPlaytestReport(
			source(MODERATED_PLAYTEST_RECRUITMENT_PLAN.map((_, index) => session(index)))
		);

		expect(report.moderationStatus).toBe('complete');
		expect(report.releaseRecommendation).toBe('candidate');
		expect(report.qualityGate).toMatchObject({
			conductedSessionCount: 5,
			coveredTaskCount: 12,
			allAssignedTasksObserved: true,
			openReleaseBlockerCount: 0
		});
		expect(report.deviceMix).toEqual({ phone: 2, desktop: 3 });
	});

	it('holds release for triaged P0 or P1 friction', () => {
		const p01 = session(0);
		p01.taskResults[1] = {
			taskId: 'complete-summoning-intro',
			outcome: 'completed-prompted',
			moderatorPromptCount: 1
		};
		const finding: ModeratedPlaytestFinding = {
			findingId: 'FIN007-001',
			severity: 'P1',
			area: 'onboarding',
			summary:
				'The participant could not identify the reserve-bell action without a moderator prompt.',
			participantCodes: ['P01'],
			taskIds: ['complete-summoning-intro'],
			status: 'open',
			disposition: 'fix-before-release',
			resolutionCommit: null,
			redactionConfirmed: true
		};
		const report = createModeratedPlaytestReport(
			source(
				[p01, ...MODERATED_PLAYTEST_RECRUITMENT_PLAN.slice(1).map((_, i) => session(i + 1))],
				[finding]
			)
		);

		expect(report.moderationStatus).toBe('complete');
		expect(report.releaseRecommendation).toBe('hold');
		expect(report.qualityGate.openReleaseBlockerCount).toBe(1);
	});

	it('rejects prompted or failed tasks that have no de-identified finding', () => {
		const p01 = session(0);
		p01.taskResults[0] = {
			taskId: 'start-seeded-run',
			outcome: 'not-completed',
			moderatorPromptCount: 2
		};

		expect(() => source([p01])).toThrow(/requires a triaged finding/u);
	});

	it('rejects participant identity fields and direct contact details', () => {
		expect(() =>
			ModeratedPlaytestSourceSchema.parse({
				...createEmptyModeratedPlaytestSource(),
				sessions: [{ ...session(0), participantName: 'Not retained' }]
			})
		).toThrow();
		expect(() =>
			ModeratedPlaytestSourceSchema.parse({
				...createEmptyModeratedPlaytestSource(),
				findings: [
					{
						findingId: 'FIN007-001',
						severity: 'P2',
						area: 'onboarding',
						summary:
							'Contact tester@example.com because the participant missed the highlighted action.',
						participantCodes: ['P01'],
						taskIds: ['start-seeded-run'],
						status: 'open',
						disposition: 'backlog',
						resolutionCommit: null,
						redactionConfirmed: true
					}
				]
			})
		).toThrow();
	});
});

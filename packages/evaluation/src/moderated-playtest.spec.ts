import { describe, expect, it } from 'vitest';

import {
	OWNER_PLAYTEST_PLAN,
	OWNER_PLAYTEST_REPORT_VERSION,
	OwnerPlaytestReportSchema,
	OwnerPlaytestSourceSchema,
	createEmptyOwnerPlaytestSource,
	createOwnerPlaytestReport,
	type OwnerPlaytestFinding,
	type OwnerPlaytestSession,
	type OwnerPlaytestSource
} from './moderated-playtest.js';

const BUILD_COMMIT = 'a'.repeat(40);

function session(override?: Partial<OwnerPlaytestSession>): OwnerPlaytestSession {
	return {
		sessionCode: 'OWNER-01',
		track: 'owner-vertical-slice',
		buildCommit: BUILD_COMMIT,
		disposition: 'completed',
		taskResults: OWNER_PLAYTEST_PLAN.requiredTaskIds.map((taskId) => ({
			taskId,
			outcome: 'completed'
		})),
		feedbackReviewed: true,
		...override
	};
}

function source(
	sessions: OwnerPlaytestSession[],
	findings: OwnerPlaytestFinding[] = []
): OwnerPlaytestSource {
	return OwnerPlaytestSourceSchema.parse({
		...createEmptyOwnerPlaytestSource(),
		updatedAt: '2026-08-27T20:00:00.000Z',
		sessions,
		findings
	});
}

describe('owner playtest evidence', () => {
	it('keeps the empty owner slot ready without claiming human feedback', () => {
		const report = createOwnerPlaytestReport(createEmptyOwnerPlaytestSource());

		expect(OwnerPlaytestReportSchema.parse(report)).toEqual(report);
		expect(report).toMatchObject({
			schemaVersion: OWNER_PLAYTEST_REPORT_VERSION,
			playtestStatus: 'ready',
			releaseRecommendation: 'awaiting-owner-playtest',
			qualityGate: {
				requiredSessionCount: 1,
				conductedSessionCount: 0,
				requiredTaskCount: 8,
				coveredTaskCount: 0,
				allRequiredTasksObserved: false
			},
			statistics: {
				collection: 'automatic-after-consent',
				requiredForRelease: false
			}
		});
	});

	it('marks one reviewed owner journey complete and release-candidate', () => {
		const report = createOwnerPlaytestReport(source([session()]));

		expect(report.playtestStatus).toBe('complete');
		expect(report.releaseRecommendation).toBe('candidate');
		expect(report.qualityGate).toMatchObject({
			conductedSessionCount: 1,
			coveredTaskCount: 8,
			allRequiredTasksObserved: true,
			openReleaseBlockerCount: 0
		});
	});

	it('holds release for triaged P0 or P1 friction', () => {
		const ownerSession = session();
		ownerSession.taskResults[1] = {
			taskId: 'complete-summoning-intro',
			outcome: 'completed-with-friction'
		};
		const finding: OwnerPlaytestFinding = {
			findingId: 'FIN007-001',
			severity: 'P1',
			area: 'onboarding',
			summary: 'The reserve-bell action was not understandable without outside explanation.',
			taskIds: ['complete-summoning-intro'],
			status: 'open',
			disposition: 'fix-before-release',
			resolutionCommit: null,
			redactionConfirmed: true
		};
		const report = createOwnerPlaytestReport(source([ownerSession], [finding]));

		expect(report.playtestStatus).toBe('complete');
		expect(report.releaseRecommendation).toBe('hold');
		expect(report.qualityGate.openReleaseBlockerCount).toBe(1);
	});

	it('keeps a journey in progress when a required checkpoint was not reached', () => {
		const ownerSession = session();
		ownerSession.taskResults[7] = {
			taskId: 'review-objectives-and-settings',
			outcome: 'not-reached'
		};
		const report = createOwnerPlaytestReport(source([ownerSession]));

		expect(report.playtestStatus).toBe('in-progress');
		expect(report.releaseRecommendation).toBe('awaiting-owner-playtest');
		expect(report.qualityGate.coveredTaskCount).toBe(7);
	});

	it('rejects friction that has no summarized finding', () => {
		const ownerSession = session();
		ownerSession.taskResults[0] = {
			taskId: 'start-seeded-run',
			outcome: 'blocked'
		};

		expect(() => source([ownerSession])).toThrow(/requires a triaged finding/u);
	});

	it('rejects identity fields and direct contact details', () => {
		expect(() =>
			OwnerPlaytestSourceSchema.parse({
				...createEmptyOwnerPlaytestSource(),
				sessions: [{ ...session(), participantName: 'Not retained' }]
			})
		).toThrow();
		expect(() =>
			OwnerPlaytestSourceSchema.parse({
				...createEmptyOwnerPlaytestSource(),
				sessions: [session()],
				findings: [
					{
						findingId: 'FIN007-001',
						severity: 'P2',
						area: 'onboarding',
						summary: 'Contact tester@example.com about the unclear highlighted action.',
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

import { hashCanonical } from '@summonlab/engine';
import { z } from 'zod';

export const MODERATED_PLAYTEST_SOURCE_VERSION = 'moderated-playtest-source-v1' as const;
export const MODERATED_PLAYTEST_REPORT_VERSION = 'moderated-playtest-report-v1' as const;
export const MODERATED_PLAYTEST_PROTOCOL_VERSION = 'moderated-playtest-v1' as const;
export const MODERATED_PLAYTEST_REQUIRED_SESSIONS = 5 as const;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const CommitSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const ModeratedPlaytestParticipantCodeSchema = z.enum(['P01', 'P02', 'P03', 'P04', 'P05']);
export const ModeratedPlaytestTrackSchema = z.enum([
	'new-player-onboarding',
	'settlement-return',
	'iron-moon-autonomy',
	'tower-discovery',
	'consequence-replay'
]);
export const ModeratedPlaytestTaskIdSchema = z.enum([
	'start-seeded-run',
	'complete-summoning-intro',
	'read-three-hero-dossiers',
	'converse-and-direct',
	'understand-autonomy',
	'use-settlement-and-first-ember',
	'return-and-read-recap',
	'complete-iron-moon',
	'complete-tower-band',
	'recognize-hidden-route',
	'resolve-permanent-consequence',
	'inspect-replay-and-causality'
]);
export const ModeratedPlaytestTaskOutcomeSchema = z.enum([
	'completed-unassisted',
	'completed-prompted',
	'not-completed',
	'not-attempted'
]);
export const ModeratedPlaytestSeveritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export const ModeratedPlaytestFindingStatusSchema = z.enum(['open', 'fixed', 'verified']);

const ModeratedPlaytestTaskResultSchema = z
	.object({
		taskId: ModeratedPlaytestTaskIdSchema,
		outcome: ModeratedPlaytestTaskOutcomeSchema,
		moderatorPromptCount: z.number().int().nonnegative().max(20)
	})
	.strict();

const ModeratorAttestationSchema = z
	.object({
		adultParticipationConfirmed: z.literal(true),
		qualitativeNoteConsentConfirmed: z.literal(true),
		noRecordingMade: z.literal(true),
		participantIdentifiersRemoved: z.literal(true),
		directQuotesParaphrased: z.literal(true),
		rawNotesKeptOutsideRepository: z.literal(true)
	})
	.strict();

export const ModeratedPlaytestSessionSchema = z
	.object({
		participantCode: ModeratedPlaytestParticipantCodeSchema,
		track: ModeratedPlaytestTrackSchema,
		viewport: z.enum(['phone', 'desktop']),
		buildCommit: CommitSchema,
		startedAt: IsoDateTimeSchema,
		durationMinutes: z.number().int().min(10).max(180),
		analyticsChoice: z.enum(['shared', 'declined', 'undecided']),
		disposition: z.enum(['completed', 'stopped-by-participant', 'stopped-by-blocker']),
		taskResults: z.array(ModeratedPlaytestTaskResultSchema).min(1),
		attestation: ModeratorAttestationSchema
	})
	.strict()
	.superRefine((session, context) => {
		const taskIds = session.taskResults.map((result) => result.taskId);
		if (new Set(taskIds).size !== taskIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['taskResults'],
				message: 'A session may record each moderated task only once'
			});
		}
	});

const RedactedSummarySchema = z
	.string()
	.trim()
	.min(12)
	.max(280)
	.refine((value) => !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u.test(value), {
		message: 'Finding summaries may not contain email addresses'
	});

export const ModeratedPlaytestFindingSchema = z
	.object({
		findingId: z.string().regex(/^FIN007-[0-9]{3}$/u),
		severity: ModeratedPlaytestSeveritySchema,
		area: z.enum([
			'consent',
			'onboarding',
			'hero-readability',
			'autonomy',
			'settlement',
			'mission',
			'consequence',
			'replay',
			'accessibility',
			'performance'
		]),
		summary: RedactedSummarySchema,
		participantCodes: z.array(ModeratedPlaytestParticipantCodeSchema).min(1).max(5),
		taskIds: z.array(ModeratedPlaytestTaskIdSchema).min(1),
		status: ModeratedPlaytestFindingStatusSchema,
		disposition: z.enum(['fix-before-next-session', 'fix-before-release', 'backlog', 'accepted']),
		resolutionCommit: CommitSchema.nullable(),
		redactionConfirmed: z.literal(true)
	})
	.strict()
	.superRefine((finding, context) => {
		if (new Set(finding.participantCodes).size !== finding.participantCodes.length) {
			context.addIssue({
				code: 'custom',
				path: ['participantCodes'],
				message: 'Finding participant codes must be unique'
			});
		}
		if (new Set(finding.taskIds).size !== finding.taskIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['taskIds'],
				message: 'Finding task IDs must be unique'
			});
		}
		if (finding.status === 'open' && finding.resolutionCommit !== null) {
			context.addIssue({
				code: 'custom',
				path: ['resolutionCommit'],
				message: 'An open finding cannot claim a resolution commit'
			});
		}
		if (finding.status !== 'open' && finding.resolutionCommit === null) {
			context.addIssue({
				code: 'custom',
				path: ['resolutionCommit'],
				message: 'Fixed and verified findings require a resolution commit'
			});
		}
	});

export const ModeratedPlaytestSourceSchema = z
	.object({
		schemaVersion: z.literal(MODERATED_PLAYTEST_SOURCE_VERSION),
		protocolVersion: z.literal(MODERATED_PLAYTEST_PROTOCOL_VERSION),
		cohortId: z.literal('fin007-local-private-v1'),
		updatedAt: IsoDateTimeSchema,
		sessions: z.array(ModeratedPlaytestSessionSchema).max(MODERATED_PLAYTEST_REQUIRED_SESSIONS),
		findings: z.array(ModeratedPlaytestFindingSchema)
	})
	.strict()
	.superRefine((source, context) => {
		const participantCodes = source.sessions.map((session) => session.participantCode);
		if (new Set(participantCodes).size !== participantCodes.length) {
			context.addIssue({
				code: 'custom',
				path: ['sessions'],
				message: 'A participant code may appear in only one retained session'
			});
		}

		const findingIds = source.findings.map((finding) => finding.findingId);
		if (new Set(findingIds).size !== findingIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['findings'],
				message: 'Finding IDs must be unique'
			});
		}

		const sessionCodes = new Set(participantCodes);
		for (const [findingIndex, finding] of source.findings.entries()) {
			for (const participantCode of finding.participantCodes) {
				if (!sessionCodes.has(participantCode)) {
					context.addIssue({
						code: 'custom',
						path: ['findings', findingIndex, 'participantCodes'],
						message: `Finding references missing session ${participantCode}`
					});
				}
			}
		}

		for (const [sessionIndex, session] of source.sessions.entries()) {
			for (const result of session.taskResults) {
				if (result.outcome === 'completed-unassisted' || result.outcome === 'not-attempted')
					continue;
				const triaged = source.findings.some(
					(finding) =>
						finding.participantCodes.includes(session.participantCode) &&
						finding.taskIds.includes(result.taskId)
				);
				if (!triaged) {
					context.addIssue({
						code: 'custom',
						path: ['sessions', sessionIndex, 'taskResults'],
						message: `${result.taskId} friction requires a triaged finding`
					});
				}
			}
		}
	});

const RecruitmentSlotSchema = z
	.object({
		participantCode: ModeratedPlaytestParticipantCodeSchema,
		track: ModeratedPlaytestTrackSchema,
		viewport: z.enum(['phone', 'desktop']),
		requiredTaskIds: z.array(ModeratedPlaytestTaskIdSchema).min(1)
	})
	.strict();

export const MODERATED_PLAYTEST_RECRUITMENT_PLAN = RecruitmentSlotSchema.array()
	.length(MODERATED_PLAYTEST_REQUIRED_SESSIONS)
	.parse([
		{
			participantCode: 'P01',
			track: 'new-player-onboarding',
			viewport: 'phone',
			requiredTaskIds: [
				'start-seeded-run',
				'complete-summoning-intro',
				'read-three-hero-dossiers',
				'converse-and-direct',
				'understand-autonomy'
			]
		},
		{
			participantCode: 'P02',
			track: 'settlement-return',
			viewport: 'desktop',
			requiredTaskIds: [
				'start-seeded-run',
				'complete-summoning-intro',
				'read-three-hero-dossiers',
				'converse-and-direct',
				'understand-autonomy',
				'use-settlement-and-first-ember',
				'return-and-read-recap'
			]
		},
		{
			participantCode: 'P03',
			track: 'iron-moon-autonomy',
			viewport: 'phone',
			requiredTaskIds: [
				'start-seeded-run',
				'complete-summoning-intro',
				'read-three-hero-dossiers',
				'converse-and-direct',
				'understand-autonomy',
				'complete-iron-moon'
			]
		},
		{
			participantCode: 'P04',
			track: 'tower-discovery',
			viewport: 'desktop',
			requiredTaskIds: [
				'start-seeded-run',
				'complete-summoning-intro',
				'read-three-hero-dossiers',
				'converse-and-direct',
				'understand-autonomy',
				'complete-tower-band',
				'recognize-hidden-route'
			]
		},
		{
			participantCode: 'P05',
			track: 'consequence-replay',
			viewport: 'desktop',
			requiredTaskIds: [
				'start-seeded-run',
				'complete-summoning-intro',
				'read-three-hero-dossiers',
				'converse-and-direct',
				'understand-autonomy',
				'resolve-permanent-consequence',
				'inspect-replay-and-causality'
			]
		}
	]);

const TaskCoverageSchema = z
	.object({
		taskId: ModeratedPlaytestTaskIdSchema,
		assignedSessionCount: z.number().int().nonnegative(),
		attemptedSessionCount: z.number().int().nonnegative(),
		unassistedCompletionCount: z.number().int().nonnegative(),
		promptedCompletionCount: z.number().int().nonnegative(),
		notCompletedCount: z.number().int().nonnegative()
	})
	.strict();

const SessionSummarySchema = z
	.object({
		participantCode: ModeratedPlaytestParticipantCodeSchema,
		track: ModeratedPlaytestTrackSchema,
		viewport: z.enum(['phone', 'desktop']),
		buildCommit: CommitSchema,
		startedAt: IsoDateTimeSchema,
		durationMinutes: z.number().int().min(10).max(180),
		analyticsChoice: z.enum(['shared', 'declined', 'undecided']),
		disposition: z.enum(['completed', 'stopped-by-participant', 'stopped-by-blocker']),
		attemptedTaskCount: z.number().int().nonnegative(),
		unassistedTaskCount: z.number().int().nonnegative(),
		promptedTaskCount: z.number().int().nonnegative(),
		notCompletedTaskCount: z.number().int().nonnegative(),
		moderatorPromptCount: z.number().int().nonnegative()
	})
	.strict();

export const ModeratedPlaytestReportSchema = z
	.object({
		schemaVersion: z.literal(MODERATED_PLAYTEST_REPORT_VERSION),
		protocolVersion: z.literal(MODERATED_PLAYTEST_PROTOCOL_VERSION),
		cohortId: z.literal('fin007-local-private-v1'),
		updatedAt: IsoDateTimeSchema,
		privacy: z
			.object({
				adultOnly: z.literal(true),
				qualitativeConsentSeparateFromAnalytics: z.literal(true),
				storesParticipantIdentity: z.literal(false),
				storesDirectQuotes: z.literal(false),
				storesRecordings: z.literal(false),
				storesRawNotes: z.literal(false),
				participantMayWithdrawNotes: z.literal(true)
			})
			.strict(),
		recruitmentPlan: z.array(RecruitmentSlotSchema).length(MODERATED_PLAYTEST_REQUIRED_SESSIONS),
		moderationStatus: z.enum(['ready', 'in-progress', 'complete']),
		releaseRecommendation: z.enum(['awaiting-sessions', 'hold', 'candidate']),
		qualityGate: z
			.object({
				requiredSessionCount: z.literal(MODERATED_PLAYTEST_REQUIRED_SESSIONS),
				conductedSessionCount: z.number().int().min(0).max(MODERATED_PLAYTEST_REQUIRED_SESSIONS),
				requiredTaskCount: z.literal(12),
				coveredTaskCount: z.number().int().min(0).max(12),
				allAssignedTasksObserved: z.boolean(),
				allFrictionTriaged: z.literal(true),
				openReleaseBlockerCount: z.number().int().nonnegative()
			})
			.strict(),
		deviceMix: z
			.object({
				phone: z.number().int().nonnegative().max(MODERATED_PLAYTEST_REQUIRED_SESSIONS),
				desktop: z.number().int().nonnegative().max(MODERATED_PLAYTEST_REQUIRED_SESSIONS)
			})
			.strict(),
		sessions: z.array(SessionSummarySchema).max(MODERATED_PLAYTEST_REQUIRED_SESSIONS),
		taskCoverage: z.array(TaskCoverageSchema).length(12),
		findingCounts: z
			.object({
				P0: z.number().int().nonnegative(),
				P1: z.number().int().nonnegative(),
				P2: z.number().int().nonnegative(),
				P3: z.number().int().nonnegative()
			})
			.strict(),
		findings: z.array(ModeratedPlaytestFindingSchema),
		reportHash: HashSchema
	})
	.strict();

export type ModeratedPlaytestSource = z.infer<typeof ModeratedPlaytestSourceSchema>;
export type ModeratedPlaytestSession = z.infer<typeof ModeratedPlaytestSessionSchema>;
export type ModeratedPlaytestFinding = z.infer<typeof ModeratedPlaytestFindingSchema>;
export type ModeratedPlaytestReport = z.infer<typeof ModeratedPlaytestReportSchema>;

export function createEmptyModeratedPlaytestSource(): ModeratedPlaytestSource {
	return ModeratedPlaytestSourceSchema.parse({
		schemaVersion: MODERATED_PLAYTEST_SOURCE_VERSION,
		protocolVersion: MODERATED_PLAYTEST_PROTOCOL_VERSION,
		cohortId: 'fin007-local-private-v1',
		updatedAt: '2026-08-25T00:00:00.000Z',
		sessions: [],
		findings: []
	});
}

export function createModeratedPlaytestReport(
	input: ModeratedPlaytestSource
): ModeratedPlaytestReport {
	const source = ModeratedPlaytestSourceSchema.parse(input);
	const sessionByCode = new Map(
		source.sessions.map((session) => [session.participantCode, session])
	);

	for (const slot of MODERATED_PLAYTEST_RECRUITMENT_PLAN) {
		const session = sessionByCode.get(slot.participantCode);
		if (!session) continue;
		if (session.track !== slot.track || session.viewport !== slot.viewport) {
			throw new Error(`${slot.participantCode} must use its assigned track and viewport`);
		}
		const results = new Map(session.taskResults.map((result) => [result.taskId, result]));
		for (const taskId of slot.requiredTaskIds) {
			if (!results.has(taskId)) {
				throw new Error(`${slot.participantCode} is missing required task ${taskId}`);
			}
		}
	}

	const taskCoverage = ModeratedPlaytestTaskIdSchema.options.map((taskId) => {
		const assignedSessionCount = MODERATED_PLAYTEST_RECRUITMENT_PLAN.filter((slot) =>
			slot.requiredTaskIds.includes(taskId)
		).length;
		const results = source.sessions.flatMap((session) =>
			session.taskResults.filter((result) => result.taskId === taskId)
		);
		return {
			taskId,
			assignedSessionCount,
			attemptedSessionCount: results.filter((result) => result.outcome !== 'not-attempted').length,
			unassistedCompletionCount: results.filter(
				(result) => result.outcome === 'completed-unassisted'
			).length,
			promptedCompletionCount: results.filter((result) => result.outcome === 'completed-prompted')
				.length,
			notCompletedCount: results.filter((result) => result.outcome === 'not-completed').length
		};
	});

	const allAssignedTasksObserved = MODERATED_PLAYTEST_RECRUITMENT_PLAN.every((slot) => {
		const session = sessionByCode.get(slot.participantCode);
		if (!session) return false;
		return slot.requiredTaskIds.every((taskId) =>
			session.taskResults.some(
				(result) => result.taskId === taskId && result.outcome !== 'not-attempted'
			)
		);
	});
	const coveredTaskCount = taskCoverage.filter((task) => task.attemptedSessionCount > 0).length;
	const conductedSessionCount = source.sessions.length;
	const moderationStatus =
		conductedSessionCount === 0
			? 'ready'
			: conductedSessionCount === MODERATED_PLAYTEST_REQUIRED_SESSIONS &&
				  coveredTaskCount === ModeratedPlaytestTaskIdSchema.options.length &&
				  allAssignedTasksObserved
				? 'complete'
				: 'in-progress';
	const openReleaseBlockerCount = source.findings.filter(
		(finding) =>
			(finding.severity === 'P0' || finding.severity === 'P1') && finding.status !== 'verified'
	).length;
	const releaseRecommendation =
		moderationStatus !== 'complete'
			? 'awaiting-sessions'
			: openReleaseBlockerCount > 0
				? 'hold'
				: 'candidate';
	const findingCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
	for (const finding of source.findings) findingCounts[finding.severity] += 1;

	const unsigned = {
		schemaVersion: MODERATED_PLAYTEST_REPORT_VERSION,
		protocolVersion: MODERATED_PLAYTEST_PROTOCOL_VERSION,
		cohortId: source.cohortId,
		updatedAt: source.updatedAt,
		privacy: {
			adultOnly: true,
			qualitativeConsentSeparateFromAnalytics: true,
			storesParticipantIdentity: false,
			storesDirectQuotes: false,
			storesRecordings: false,
			storesRawNotes: false,
			participantMayWithdrawNotes: true
		},
		recruitmentPlan: MODERATED_PLAYTEST_RECRUITMENT_PLAN,
		moderationStatus,
		releaseRecommendation,
		qualityGate: {
			requiredSessionCount: MODERATED_PLAYTEST_REQUIRED_SESSIONS,
			conductedSessionCount,
			requiredTaskCount: 12,
			coveredTaskCount,
			allAssignedTasksObserved,
			allFrictionTriaged: true,
			openReleaseBlockerCount
		},
		deviceMix: {
			phone: source.sessions.filter((session) => session.viewport === 'phone').length,
			desktop: source.sessions.filter((session) => session.viewport === 'desktop').length
		},
		sessions: source.sessions.map((session) => ({
			participantCode: session.participantCode,
			track: session.track,
			viewport: session.viewport,
			buildCommit: session.buildCommit,
			startedAt: session.startedAt,
			durationMinutes: session.durationMinutes,
			analyticsChoice: session.analyticsChoice,
			disposition: session.disposition,
			attemptedTaskCount: session.taskResults.filter((result) => result.outcome !== 'not-attempted')
				.length,
			unassistedTaskCount: session.taskResults.filter(
				(result) => result.outcome === 'completed-unassisted'
			).length,
			promptedTaskCount: session.taskResults.filter(
				(result) => result.outcome === 'completed-prompted'
			).length,
			notCompletedTaskCount: session.taskResults.filter(
				(result) => result.outcome === 'not-completed'
			).length,
			moderatorPromptCount: session.taskResults.reduce(
				(sum, result) => sum + result.moderatorPromptCount,
				0
			)
		})),
		taskCoverage,
		findingCounts,
		findings: source.findings
	};
	return ModeratedPlaytestReportSchema.parse({ ...unsigned, reportHash: hashCanonical(unsigned) });
}

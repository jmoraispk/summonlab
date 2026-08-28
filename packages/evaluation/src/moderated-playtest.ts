import { hashCanonical } from '@summonlab/engine';
import { z } from 'zod';

export const OWNER_PLAYTEST_SOURCE_VERSION = 'owner-playtest-source-v1' as const;
export const OWNER_PLAYTEST_REPORT_VERSION = 'owner-playtest-report-v1' as const;
export const OWNER_PLAYTEST_PROTOCOL_VERSION = 'owner-playtest-v1' as const;
export const OWNER_PLAYTEST_ID = 'fin007-owner-local-v1' as const;
export const OWNER_PLAYTEST_REQUIRED_SESSIONS = 1 as const;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const CommitSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const OwnerPlaytestSessionCodeSchema = z.literal('OWNER-01');
export const OwnerPlaytestTrackSchema = z.literal('owner-vertical-slice');
export const OwnerPlaytestTaskIdSchema = z.enum([
	'start-seeded-run',
	'complete-summoning-intro',
	'read-three-hero-dossiers',
	'converse-and-direct',
	'understand-autonomy',
	'arrive-in-hearth',
	'recover-and-bind-first-ember',
	'review-objectives-and-settings'
]);
export const OWNER_PLAYTEST_REQUIRED_TASK_IDS = OwnerPlaytestTaskIdSchema.options;
export const OwnerPlaytestTaskOutcomeSchema = z.enum([
	'completed',
	'completed-with-friction',
	'blocked',
	'not-reached'
]);
export const OwnerPlaytestSeveritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export const OwnerPlaytestFindingStatusSchema = z.enum(['open', 'fixed', 'verified']);

const OwnerPlaytestTaskResultSchema = z
	.object({
		taskId: OwnerPlaytestTaskIdSchema,
		outcome: OwnerPlaytestTaskOutcomeSchema
	})
	.strict();

export const OwnerPlaytestSessionSchema = z
	.object({
		sessionCode: OwnerPlaytestSessionCodeSchema,
		track: OwnerPlaytestTrackSchema,
		buildCommit: CommitSchema,
		disposition: z.enum(['completed', 'stopped-by-player', 'stopped-by-blocker']),
		taskResults: z.array(OwnerPlaytestTaskResultSchema).min(1),
		feedbackReviewed: z.literal(true)
	})
	.strict()
	.superRefine((session, context) => {
		const taskIds = session.taskResults.map((result) => result.taskId);
		if (new Set(taskIds).size !== taskIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['taskResults'],
				message: 'The owner session may record each playtest task only once'
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

export const OwnerPlaytestFindingSchema = z
	.object({
		findingId: z.string().regex(/^FIN007-[0-9]{3}$/u),
		severity: OwnerPlaytestSeveritySchema,
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
		taskIds: z.array(OwnerPlaytestTaskIdSchema).min(1),
		status: OwnerPlaytestFindingStatusSchema,
		disposition: z.enum(['fix-before-retest', 'fix-before-release', 'backlog', 'accepted']),
		resolutionCommit: CommitSchema.nullable(),
		redactionConfirmed: z.literal(true)
	})
	.strict()
	.superRefine((finding, context) => {
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

export const OwnerPlaytestSourceSchema = z
	.object({
		schemaVersion: z.literal(OWNER_PLAYTEST_SOURCE_VERSION),
		protocolVersion: z.literal(OWNER_PLAYTEST_PROTOCOL_VERSION),
		playtestId: z.literal(OWNER_PLAYTEST_ID),
		updatedAt: IsoDateTimeSchema,
		sessions: z.array(OwnerPlaytestSessionSchema).max(OWNER_PLAYTEST_REQUIRED_SESSIONS),
		findings: z.array(OwnerPlaytestFindingSchema)
	})
	.strict()
	.superRefine((source, context) => {
		const findingIds = source.findings.map((finding) => finding.findingId);
		if (new Set(findingIds).size !== findingIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['findings'],
				message: 'Finding IDs must be unique'
			});
		}

		const session = source.sessions[0];
		if (!session && source.findings.length > 0) {
			context.addIssue({
				code: 'custom',
				path: ['findings'],
				message: 'Findings require an owner playtest session'
			});
			return;
		}
		if (!session) return;

		const resultTaskIds = new Set(session.taskResults.map((result) => result.taskId));
		for (const [findingIndex, finding] of source.findings.entries()) {
			for (const taskId of finding.taskIds) {
				if (!resultTaskIds.has(taskId)) {
					context.addIssue({
						code: 'custom',
						path: ['findings', findingIndex, 'taskIds'],
						message: `Finding references unrecorded task ${taskId}`
					});
				}
			}
		}

		for (const [resultIndex, result] of session.taskResults.entries()) {
			if (result.outcome !== 'completed-with-friction' && result.outcome !== 'blocked') continue;
			if (!source.findings.some((finding) => finding.taskIds.includes(result.taskId))) {
				context.addIssue({
					code: 'custom',
					path: ['sessions', 0, 'taskResults', resultIndex],
					message: `${result.taskId} friction requires a triaged finding`
				});
			}
		}
	});

const OwnerPlaytestPlanSchema = z
	.object({
		sessionCode: OwnerPlaytestSessionCodeSchema,
		track: OwnerPlaytestTrackSchema,
		viewport: z.literal('player-choice'),
		requiredTaskIds: z
			.array(OwnerPlaytestTaskIdSchema)
			.length(OWNER_PLAYTEST_REQUIRED_TASK_IDS.length)
	})
	.strict();

export const OWNER_PLAYTEST_PLAN = OwnerPlaytestPlanSchema.parse({
	sessionCode: 'OWNER-01',
	track: 'owner-vertical-slice',
	viewport: 'player-choice',
	requiredTaskIds: OWNER_PLAYTEST_REQUIRED_TASK_IDS
});

const TaskCoverageSchema = z
	.object({
		taskId: OwnerPlaytestTaskIdSchema,
		outcome: OwnerPlaytestTaskOutcomeSchema.nullable()
	})
	.strict();

const SessionSummarySchema = z
	.object({
		sessionCode: OwnerPlaytestSessionCodeSchema,
		track: OwnerPlaytestTrackSchema,
		buildCommit: CommitSchema,
		disposition: z.enum(['completed', 'stopped-by-player', 'stopped-by-blocker']),
		completedTaskCount: z.number().int().nonnegative(),
		frictionTaskCount: z.number().int().nonnegative(),
		blockedTaskCount: z.number().int().nonnegative(),
		notReachedTaskCount: z.number().int().nonnegative(),
		feedbackReviewed: z.literal(true)
	})
	.strict();

export const OwnerPlaytestReportSchema = z
	.object({
		schemaVersion: z.literal(OWNER_PLAYTEST_REPORT_VERSION),
		protocolVersion: z.literal(OWNER_PLAYTEST_PROTOCOL_VERSION),
		playtestId: z.literal(OWNER_PLAYTEST_ID),
		updatedAt: IsoDateTimeSchema,
		privacy: z
			.object({
				adultOnly: z.literal(true),
				backgroundAnalyticsRequireConsent: z.literal(true),
				backgroundAnalyticsAreOptional: z.literal(true),
				storesParticipantIdentity: z.literal(false),
				storesDirectQuotes: z.literal(false),
				storesRecordings: z.literal(false),
				storesRawFeedback: z.literal(false)
			})
			.strict(),
		playtestPlan: OwnerPlaytestPlanSchema,
		playtestStatus: z.enum(['ready', 'in-progress', 'complete']),
		releaseRecommendation: z.enum(['awaiting-owner-playtest', 'hold', 'candidate']),
		qualityGate: z
			.object({
				requiredSessionCount: z.literal(OWNER_PLAYTEST_REQUIRED_SESSIONS),
				conductedSessionCount: z.number().int().min(0).max(OWNER_PLAYTEST_REQUIRED_SESSIONS),
				requiredTaskCount: z.literal(OWNER_PLAYTEST_REQUIRED_TASK_IDS.length),
				coveredTaskCount: z.number().int().min(0).max(OWNER_PLAYTEST_REQUIRED_TASK_IDS.length),
				allRequiredTasksObserved: z.boolean(),
				allFrictionTriaged: z.literal(true),
				openReleaseBlockerCount: z.number().int().nonnegative()
			})
			.strict(),
		statistics: z
			.object({
				collection: z.literal('automatic-after-consent'),
				requiredForRelease: z.literal(false),
				aggregateReportPath: z.literal('/playtest-report')
			})
			.strict(),
		sessions: z.array(SessionSummarySchema).max(OWNER_PLAYTEST_REQUIRED_SESSIONS),
		taskCoverage: z.array(TaskCoverageSchema).length(OWNER_PLAYTEST_REQUIRED_TASK_IDS.length),
		findingCounts: z
			.object({
				P0: z.number().int().nonnegative(),
				P1: z.number().int().nonnegative(),
				P2: z.number().int().nonnegative(),
				P3: z.number().int().nonnegative()
			})
			.strict(),
		findings: z.array(OwnerPlaytestFindingSchema),
		reportHash: HashSchema
	})
	.strict();

export type OwnerPlaytestSource = z.infer<typeof OwnerPlaytestSourceSchema>;
export type OwnerPlaytestSession = z.infer<typeof OwnerPlaytestSessionSchema>;
export type OwnerPlaytestFinding = z.infer<typeof OwnerPlaytestFindingSchema>;
export type OwnerPlaytestReport = z.infer<typeof OwnerPlaytestReportSchema>;

export function createEmptyOwnerPlaytestSource(): OwnerPlaytestSource {
	return OwnerPlaytestSourceSchema.parse({
		schemaVersion: OWNER_PLAYTEST_SOURCE_VERSION,
		protocolVersion: OWNER_PLAYTEST_PROTOCOL_VERSION,
		playtestId: OWNER_PLAYTEST_ID,
		updatedAt: '2026-08-27T00:00:00.000Z',
		sessions: [],
		findings: []
	});
}

export function createOwnerPlaytestReport(input: OwnerPlaytestSource): OwnerPlaytestReport {
	const source = OwnerPlaytestSourceSchema.parse(input);
	const session = source.sessions[0];
	const results = new Map(session?.taskResults.map((result) => [result.taskId, result]) ?? []);

	if (session) {
		for (const taskId of OWNER_PLAYTEST_REQUIRED_TASK_IDS) {
			if (!results.has(taskId)) throw new Error(`OWNER-01 is missing required task ${taskId}`);
		}
	}

	const taskCoverage = OWNER_PLAYTEST_REQUIRED_TASK_IDS.map((taskId) => ({
		taskId,
		outcome: results.get(taskId)?.outcome ?? null
	}));
	const coveredTaskCount = taskCoverage.filter(
		(task) => task.outcome !== null && task.outcome !== 'not-reached'
	).length;
	const allRequiredTasksObserved = coveredTaskCount === OWNER_PLAYTEST_REQUIRED_TASK_IDS.length;
	const conductedSessionCount = source.sessions.length;
	const playtestStatus =
		conductedSessionCount === 0
			? 'ready'
			: allRequiredTasksObserved && session?.feedbackReviewed
				? 'complete'
				: 'in-progress';
	const openReleaseBlockerCount = source.findings.filter(
		(finding) =>
			(finding.severity === 'P0' || finding.severity === 'P1') && finding.status !== 'verified'
	).length;
	const releaseRecommendation =
		playtestStatus !== 'complete'
			? 'awaiting-owner-playtest'
			: openReleaseBlockerCount > 0
				? 'hold'
				: 'candidate';
	const findingCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
	for (const finding of source.findings) findingCounts[finding.severity] += 1;

	const unsigned = {
		schemaVersion: OWNER_PLAYTEST_REPORT_VERSION,
		protocolVersion: OWNER_PLAYTEST_PROTOCOL_VERSION,
		playtestId: source.playtestId,
		updatedAt: source.updatedAt,
		privacy: {
			adultOnly: true,
			backgroundAnalyticsRequireConsent: true,
			backgroundAnalyticsAreOptional: true,
			storesParticipantIdentity: false,
			storesDirectQuotes: false,
			storesRecordings: false,
			storesRawFeedback: false
		},
		playtestPlan: OWNER_PLAYTEST_PLAN,
		playtestStatus,
		releaseRecommendation,
		qualityGate: {
			requiredSessionCount: OWNER_PLAYTEST_REQUIRED_SESSIONS,
			conductedSessionCount,
			requiredTaskCount: OWNER_PLAYTEST_REQUIRED_TASK_IDS.length,
			coveredTaskCount,
			allRequiredTasksObserved,
			allFrictionTriaged: true,
			openReleaseBlockerCount
		},
		statistics: {
			collection: 'automatic-after-consent' as const,
			requiredForRelease: false as const,
			aggregateReportPath: '/playtest-report' as const
		},
		sessions: session
			? [
					{
						sessionCode: session.sessionCode,
						track: session.track,
						buildCommit: session.buildCommit,
						disposition: session.disposition,
						completedTaskCount: session.taskResults.filter(
							(result) => result.outcome === 'completed'
						).length,
						frictionTaskCount: session.taskResults.filter(
							(result) => result.outcome === 'completed-with-friction'
						).length,
						blockedTaskCount: session.taskResults.filter((result) => result.outcome === 'blocked')
							.length,
						notReachedTaskCount: session.taskResults.filter(
							(result) => result.outcome === 'not-reached'
						).length,
						feedbackReviewed: session.feedbackReviewed
					}
				]
			: [],
		taskCoverage,
		findingCounts,
		findings: source.findings
	};

	return OwnerPlaytestReportSchema.parse({ ...unsigned, reportHash: hashCanonical(unsigned) });
}

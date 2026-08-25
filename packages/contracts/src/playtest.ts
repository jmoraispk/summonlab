import { z } from 'zod';

import { CampaignControlModeSchema } from './campaign.js';
import { EntityIdSchema, IsoDateTimeSchema } from './shared.js';

export const PLAYTEST_CONSENT_NOTICE_VERSION = 'playtest-consent-v1' as const;
export const PLAYTEST_ANALYTICS_VERSION = 'playtest-analytics-v1' as const;
export const PLAYTEST_CONSENT_RETENTION_DAYS = 30 as const;

export const PlaytestConsentStatusSchema = z.enum(['granted', 'withdrawn', 'expired']);
export const PlaytestRouteSchema = z.enum(['title', 'onboarding', 'hearth', 'replay']);
export const PlaytestViewportSchema = z.enum(['phone', 'desktop']);
export const PlaytestEventTypeSchema = z.enum([
	'route_viewed',
	'campaign_started',
	'onboarding_step_completed',
	'hearth_entered',
	'pause_opened',
	'campaign_restarted',
	'reconnect_completed'
]);

export const PlaytestConsentGrantRequestSchema = z
	.object({
		noticeVersion: z.literal(PLAYTEST_CONSENT_NOTICE_VERSION),
		analyticsVersion: z.literal(PLAYTEST_ANALYTICS_VERSION),
		ageConfirmed: z.literal(true),
		voluntary: z.literal(true)
	})
	.strict();

export const PlaytestConsentRecordSchema = z
	.object({
		consentId: EntityIdSchema,
		noticeVersion: z.literal(PLAYTEST_CONSENT_NOTICE_VERSION),
		analyticsVersion: z.literal(PLAYTEST_ANALYTICS_VERSION),
		status: PlaytestConsentStatusSchema,
		acceptedAt: IsoDateTimeSchema,
		expiresAt: IsoDateTimeSchema,
		withdrawnAt: IsoDateTimeSchema.nullable()
	})
	.strict();

export const PlaytestConsentGrantResponseSchema = z
	.object({
		consent: PlaytestConsentRecordSchema,
		withdrawalToken: z.string().regex(/^[a-f0-9]{64}$/u)
	})
	.strict();

const eventBase = {
	eventId: EntityIdSchema,
	sessionId: EntityIdSchema,
	runId: EntityIdSchema.nullable(),
	viewport: PlaytestViewportSchema,
	occurredAt: IsoDateTimeSchema
};

export const PlaytestAnalyticsEventSchema = z.discriminatedUnion('eventType', [
	z
		.object({
			...eventBase,
			eventType: z.literal('route_viewed'),
			route: PlaytestRouteSchema
		})
		.strict(),
	z
		.object({
			...eventBase,
			eventType: z.literal('campaign_started'),
			route: z.literal('title'),
			runId: EntityIdSchema,
			controlMode: CampaignControlModeSchema
		})
		.strict(),
	z
		.object({
			...eventBase,
			eventType: z.literal('onboarding_step_completed'),
			route: z.literal('onboarding'),
			runId: EntityIdSchema,
			step: z.number().int().min(1).max(3)
		})
		.strict(),
	z
		.object({
			...eventBase,
			eventType: z.literal('hearth_entered'),
			route: z.literal('hearth'),
			runId: EntityIdSchema,
			destination: z.enum(['kitchen', 'training-ground'])
		})
		.strict(),
	z
		.object({
			...eventBase,
			eventType: z.literal('pause_opened'),
			route: z.enum(['onboarding', 'hearth']),
			runId: EntityIdSchema,
			completedObjectiveCount: z.number().int().min(0).max(7)
		})
		.strict(),
	z
		.object({
			...eventBase,
			eventType: z.literal('campaign_restarted'),
			route: z.enum(['onboarding', 'hearth']),
			runId: EntityIdSchema,
			seedMode: z.enum(['same', 'new'])
		})
		.strict(),
	z
		.object({
			...eventBase,
			eventType: z.literal('reconnect_completed'),
			route: z.literal('hearth'),
			runId: EntityIdSchema,
			durationMs: z.number().int().nonnegative().max(60_000),
			missedEventCount: z.number().int().nonnegative().max(10_000)
		})
		.strict()
]);

export const PlaytestEventReceiptSchema = z
	.object({
		accepted: z.boolean(),
		eventId: EntityIdSchema
	})
	.strict();

export const PlaytestConsentSummarySchema = z
	.object({
		consent: PlaytestConsentRecordSchema,
		retainedSessionCount: z.number().int().nonnegative(),
		retainedEventCount: z.number().int().nonnegative()
	})
	.strict();

export const PlaytestWithdrawalResultSchema = z
	.object({
		consent: PlaytestConsentRecordSchema,
		deletedSessionCount: z.number().int().nonnegative(),
		deletedEventCount: z.number().int().nonnegative()
	})
	.strict();

const eventCountShape = Object.fromEntries(
	PlaytestEventTypeSchema.options.map((eventType) => [eventType, z.number().int().nonnegative()])
) as Record<(typeof PlaytestEventTypeSchema.options)[number], z.ZodNumber>;

export const PlaytestAnalyticsReportSchema = z
	.object({
		schemaVersion: z.literal(PLAYTEST_ANALYTICS_VERSION),
		generatedAt: IsoDateTimeSchema,
		privacy: z
			.object({
				noticeVersion: z.literal(PLAYTEST_CONSENT_NOTICE_VERSION),
				retentionDays: z.literal(PLAYTEST_CONSENT_RETENTION_DAYS),
				storesRawText: z.literal(false),
				storesIpAddress: z.literal(false),
				storesUserAgent: z.literal(false),
				withdrawalDeletesEvents: z.literal(true),
				reportIsAggregateOnly: z.literal(true)
			})
			.strict(),
		consents: z
			.object({
				granted: z.number().int().nonnegative(),
				withdrawn: z.number().int().nonnegative(),
				expired: z.number().int().nonnegative()
			})
			.strict(),
		retainedSessionCount: z.number().int().nonnegative(),
		retainedEventCount: z.number().int().nonnegative(),
		eventCounts: z.object(eventCountShape).strict(),
		funnel: z
			.object({
				titleViewedSessions: z.number().int().nonnegative(),
				campaignStartedSessions: z.number().int().nonnegative(),
				onboardingCompletedSessions: z.number().int().nonnegative(),
				hearthEnteredSessions: z.number().int().nonnegative()
			})
			.strict()
	})
	.strict()
	.superRefine((report, context) => {
		const eventTotal = Object.values(report.eventCounts).reduce((sum, count) => sum + count, 0);
		if (eventTotal !== report.retainedEventCount) {
			context.addIssue({
				code: 'custom',
				path: ['retainedEventCount'],
				message: 'Retained event count must equal the typed event totals'
			});
		}
		const funnel = report.funnel;
		if (
			funnel.campaignStartedSessions > funnel.titleViewedSessions ||
			funnel.onboardingCompletedSessions > funnel.campaignStartedSessions ||
			funnel.hearthEnteredSessions > funnel.onboardingCompletedSessions
		) {
			context.addIssue({
				code: 'custom',
				path: ['funnel'],
				message: 'Playtest funnel stages must be monotonically non-increasing'
			});
		}
	});

export type PlaytestAnalyticsEvent = z.infer<typeof PlaytestAnalyticsEventSchema>;
export type PlaytestAnalyticsReport = z.infer<typeof PlaytestAnalyticsReportSchema>;
export type PlaytestConsentGrantRequest = z.infer<typeof PlaytestConsentGrantRequestSchema>;
export type PlaytestConsentGrantResponse = z.infer<typeof PlaytestConsentGrantResponseSchema>;
export type PlaytestConsentRecord = z.infer<typeof PlaytestConsentRecordSchema>;
export type PlaytestConsentSummary = z.infer<typeof PlaytestConsentSummarySchema>;
export type PlaytestEventType = z.infer<typeof PlaytestEventTypeSchema>;
export type PlaytestWithdrawalResult = z.infer<typeof PlaytestWithdrawalResultSchema>;

import { randomUUID } from 'node:crypto';

import type { PlaytestAnalyticsEvent } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	getPlaytestAnalyticsReport,
	getPlaytestConsentSummary,
	grantPlaytestConsent,
	recordPlaytestEvent,
	withdrawPlaytestConsent
} from './playtest.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

const grantRequest = {
	noticeVersion: 'playtest-consent-v1' as const,
	analyticsVersion: 'playtest-analytics-v1' as const,
	ageConfirmed: true as const,
	voluntary: true as const
};

describe('playtest consent analytics', () => {
	run(
		'requires a capability, stores only typed events, and deletes them on withdrawal',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const testDatabaseUrl = databaseUrl;
			const now = new Date('2026-08-25T20:00:00.000Z');
			const grant = await grantPlaytestConsent(testDatabaseUrl, grantRequest, now);
			expect(grant.consent).toMatchObject({ status: 'granted', acceptedAt: now.toISOString() });
			expect(grant.withdrawalToken).toMatch(/^[a-f0-9]{64}$/u);
			expect(
				await getPlaytestConsentSummary(testDatabaseUrl, grant.withdrawalToken, now)
			).toMatchObject({ retainedSessionCount: 0, retainedEventCount: 0 });

			const sessionId = randomUUID();
			const runId = randomUUID();
			const base = {
				sessionId,
				runId,
				viewport: 'phone' as const,
				occurredAt: now.toISOString()
			};
			const events: PlaytestAnalyticsEvent[] = [
				{
					...base,
					eventId: randomUUID(),
					eventType: 'route_viewed',
					route: 'title',
					runId: null
				},
				{
					...base,
					eventId: randomUUID(),
					eventType: 'campaign_started',
					route: 'title',
					controlMode: 'wait'
				},
				...([1, 2, 3] as const).map((step): PlaytestAnalyticsEvent => ({
					...base,
					eventId: randomUUID(),
					eventType: 'onboarding_step_completed',
					route: 'onboarding',
					step
				})),
				{
					...base,
					eventId: randomUUID(),
					eventType: 'hearth_entered',
					route: 'hearth',
					destination: 'training-ground'
				}
			];
			for (const event of events) {
				expect(
					await recordPlaytestEvent(testDatabaseUrl, grant.withdrawalToken, event, now)
				).toMatchObject({ accepted: true, eventId: event.eventId });
			}
			expect(
				await recordPlaytestEvent(testDatabaseUrl, grant.withdrawalToken, events[0]!, now)
			).toMatchObject({ accepted: false });

			const another = await grantPlaytestConsent(testDatabaseUrl, grantRequest, now);
			await expect(
				recordPlaytestEvent(
					testDatabaseUrl,
					another.withdrawalToken,
					{ ...events[0]!, eventId: randomUUID() },
					now
				)
			).rejects.toThrow('another consent');
			await withdrawPlaytestConsent(testDatabaseUrl, another.withdrawalToken, now);

			const summary = await getPlaytestConsentSummary(testDatabaseUrl, grant.withdrawalToken, now);
			expect(summary).toMatchObject({ retainedSessionCount: 1, retainedEventCount: events.length });
			const report = await getPlaytestAnalyticsReport(testDatabaseUrl, now);
			expect(report.funnel).toMatchObject({
				titleViewedSessions: 1,
				campaignStartedSessions: 1,
				onboardingCompletedSessions: 1,
				hearthEnteredSessions: 1
			});

			const withdrawn = await withdrawPlaytestConsent(testDatabaseUrl, grant.withdrawalToken, now);
			expect(withdrawn).toMatchObject({
				deletedSessionCount: 1,
				deletedEventCount: events.length,
				consent: { status: 'withdrawn' }
			});
			expect(
				await getPlaytestConsentSummary(testDatabaseUrl, grant.withdrawalToken, now)
			).toBeNull();
		}
	);

	run('expires consent and erases retained analytics after thirty days', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const acceptedAt = new Date('2026-06-01T00:00:00.000Z');
		const grant = await grantPlaytestConsent(databaseUrl, grantRequest, acceptedAt);
		const expiredAt = new Date('2026-07-02T00:00:00.000Z');
		const summary = await getPlaytestConsentSummary(databaseUrl, grant.withdrawalToken, expiredAt);
		expect(summary).toMatchObject({
			retainedSessionCount: 0,
			retainedEventCount: 0,
			consent: { status: 'expired', withdrawnAt: expiredAt.toISOString() }
		});
	});
});

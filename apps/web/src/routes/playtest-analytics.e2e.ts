import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
	PlaytestAnalyticsEventSchema,
	PlaytestConsentGrantResponseSchema,
	PlaytestConsentSummarySchema,
	PlaytestWithdrawalResultSchema,
	type PlaytestAnalyticsEvent
} from '@summonlab/contracts';

import { PLAYTEST_CONSENT_STORAGE_KEY } from '$lib/playtest-analytics';

async function prepareArrivedCampaign(request: APIRequestContext): Promise<string> {
	const creation = await request.post('/api/campaigns', {
		data: {
			seed: 'village-shell-19aa1947-bcad-4fab-b2f8-e0e34a9b7eb3',
			controlMode: 'wait'
		}
	});
	expect(creation.ok()).toBe(true);
	const { campaign } = (await creation.json()) as { campaign: { runId: string } };
	for (const [index, ordinal] of [1, 2, 3].entries()) {
		const response = await request.post(`/api/campaigns/${campaign.runId}/summons`, {
			data: { ordinal, expectedSummonedHeroCount: index }
		});
		expect(response.ok()).toBe(true);
	}
	const viewResponse = await request.get(`/api/campaigns/${campaign.runId}`);
	expect(viewResponse.ok()).toBe(true);
	const view = (await viewResponse.json()) as {
		heroes: ReadonlyArray<{ draft: { manifest: { characterId: string } } }>;
	};
	for (const hero of view.heroes) {
		const response = await request.post(`/api/runs/${campaign.runId}/conversations`, {
			data: {
				targetHeroId: hero.draft.manifest.characterId,
				kind: 'ask',
				exactText: 'What do you need before we enter the tower?',
				tone: 'reassuring',
				delivery: 'private',
				orderIntent: null
			}
		});
		expect(response.ok()).toBe(true);
	}
	const decision = await request.post(`/api/runs/${campaign.runId}/decide`, {
		data: { directive: 'Choose what you need before we enter the tower.', trigger: 'step' }
	});
	expect(decision.ok()).toBe(true);
	const completion = await request.post(`/api/campaigns/${campaign.runId}/onboarding`, {
		data: { step: 3 }
	});
	expect(completion.ok()).toBe(true);
	const arrival = await request.post(`/api/runs/${campaign.runId}/arrive`, { data: {} });
	expect(arrival.ok()).toBe(true);
	return campaign.runId;
}

async function openConsentSettings(page: Page) {
	await page.getByRole('button', { name: 'Pause menu' }).click();
	const pause = page.getByRole('dialog', { name: 'Paused campaign menu' });
	await pause.getByRole('button', { name: 'Settings', exact: true }).click();
	return pause.getByTestId('playtest-consent');
}

test('keeps analytics off until consent and deletes the typed journey on withdrawal', async ({
	page
}) => {
	test.setTimeout(90_000);
	const viewport = process.env.FIN006_VIEWPORT === 'phone' ? 'phone' : 'desktop';
	if (viewport === 'phone') await page.setViewportSize({ width: 390, height: 844 });
	const analyticsRequests: PlaytestAnalyticsEvent[] = [];
	page.on('request', (request) => {
		if (request.method() !== 'POST' || !request.url().endsWith('/api/playtest/events')) return;
		analyticsRequests.push(PlaytestAnalyticsEventSchema.parse(request.postDataJSON()));
	});
	const captureDirectory = process.env.CAPTURE_FIN006_DIR;
	const runId = await prepareArrivedCampaign(page.request);

	await page.goto('/');
	await expect(page.getByTestId('campaign-title')).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-playtest-consent', 'undecided');
	await page.waitForLoadState('networkidle');
	expect(analyticsRequests).toHaveLength(0);

	await page.goto('/village');
	const consentPanel = await openConsentSettings(page);
	await expect(consentPanel.getByText('Sharing off')).toBeVisible();
	await expect(consentPanel).toContainText('This is voluntary and does not change the game');
	if (captureDirectory) {
		await page.screenshot({
			path: `${captureDirectory}/phase-7-fin006-${viewport}-consent.png`,
			fullPage: true
		});
	}
	await consentPanel.getByRole('button', { name: 'Play without sharing' }).click();
	await expect(consentPanel).toContainText('The game remains fully playable');
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-playtest-consent', 'declined');
	await page.waitForLoadState('networkidle');
	expect(analyticsRequests).toHaveLength(0);

	await page.goto('/village');
	const declinedConsent = await openConsentSettings(page);
	await expect(declinedConsent.getByText('Sharing off')).toBeVisible();
	const grantResponse = page.waitForResponse(
		(response) =>
			response.request().method() === 'POST' && response.url().endsWith('/api/playtest/consent')
	);
	await declinedConsent.getByRole('button', { name: /share playtest data/i }).click();
	const grantedResponse = await grantResponse;
	expect(grantedResponse.status()).toBe(201);
	const grant = PlaytestConsentGrantResponseSchema.parse(await grantedResponse.json());
	await expect(declinedConsent.getByText('Sharing on')).toBeVisible();
	await expect(declinedConsent).toContainText('You can withdraw and delete it here at any time');
	const localConsent = {
		decision: 'granted',
		withdrawalToken: grant.withdrawalToken,
		expiresAt: grant.consent.expiresAt
	} as const;

	// The current analytics route layer recognizes the title; Village emits pause events.
	const firstRouteResponse = page.waitForResponse(
		(response) =>
			response.request().method() === 'POST' &&
			response.url().endsWith('/api/playtest/events') &&
			response.request().postDataJSON().eventType === 'route_viewed'
	);
	await page.goto('/');
	expect((await firstRouteResponse).status()).toBe(201);
	expect(analyticsRequests).toContainEqual(
		expect.objectContaining({ eventType: 'route_viewed', route: 'title', runId: null, viewport })
	);

	// A fresh document must load the saved choice and continue the same browser session.
	const grantedRequestCount = analyticsRequests.length;
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-playtest-consent', 'granted');
	await expect.poll(() => analyticsRequests.length).toBeGreaterThan(grantedRequestCount);
	const sessionId = analyticsRequests[0]!.sessionId;
	for (const event of analyticsRequests) expect(event.sessionId).toBe(sessionId);
	expect(
		await page.evaluate(
			(key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
			PLAYTEST_CONSENT_STORAGE_KEY
		)
	).toEqual(localConsent);

	await page.goto('/village');
	await page.getByRole('button', { name: 'Pause menu' }).click();
	await expect(page.getByRole('dialog', { name: 'Paused campaign menu' })).toBeVisible();
	await expect
		.poll(() => analyticsRequests)
		.toContainEqual(
			expect.objectContaining({ eventType: 'pause_opened', route: 'hearth', runId, sessionId })
		);

	const eventHeaders = { 'x-playtest-consent': localConsent.withdrawalToken };
	const baseEvent = {
		sessionId,
		runId,
		viewport,
		occurredAt: new Date().toISOString()
	};
	const rawTextResponse = await page.request.post('/api/playtest/events', {
		headers: eventHeaders,
		data: {
			...baseEvent,
			eventId: randomUUID(),
			eventType: 'route_viewed',
			route: 'title',
			rawQuestion: 'This property must never be accepted.'
		}
	});
	expect(rawTextResponse.status()).toBe(400);

	// Campaign/onboarding milestones remain supported ingestion fixtures. The current UI does
	// not emit these milestones, so they are submitted explicitly through the typed API.
	const journeyEvents = [
		{
			...baseEvent,
			eventId: randomUUID(),
			eventType: 'campaign_started',
			route: 'title',
			controlMode: 'wait'
		},
		...[1, 2, 3].map((step) => ({
			...baseEvent,
			eventId: randomUUID(),
			eventType: 'onboarding_step_completed',
			route: 'onboarding',
			step
		})),
		{
			...baseEvent,
			eventId: randomUUID(),
			eventType: 'hearth_entered',
			route: 'hearth',
			destination: 'kitchen'
		}
	].map((event) => PlaytestAnalyticsEventSchema.parse(event));
	for (const event of journeyEvents) {
		const response = await page.request.post('/api/playtest/events', {
			headers: eventHeaders,
			data: event
		});
		expect(response.status()).toBe(201);
		expect(await response.json()).toEqual({ accepted: true, eventId: event.eventId });
	}
	for (const event of [...analyticsRequests, ...journeyEvents]) {
		expect(JSON.stringify(event)).not.toMatch(
			/rawQuestion|village-shell-|What do you need|This property must never be accepted/u
		);
	}

	await page.goto('/playtest-report');
	await expect(page.getByTestId('playtest-report')).toContainText('Observe the journey');
	await expect(page.getByText('Campaign started', { exact: true }).first()).toBeVisible();
	await expect(page.getByTestId('playtest-report')).not.toContainText(sessionId);
	await expect(page.getByTestId('playtest-report')).not.toContainText(baseEvent.runId);
	await expect(page.getByTestId('playtest-report')).not.toContainText(
		'This property must never be accepted.'
	);
	if (captureDirectory) {
		await page.screenshot({
			path: `${captureDirectory}/phase-7-fin006-${viewport}-aggregate-report.png`,
			fullPage: true
		});
	}

	await page.goto('/village');
	const settingsConsent = await openConsentSettings(page);
	await expect(settingsConsent.getByText('Sharing on')).toBeVisible();
	await expect
		.poll(async () => {
			const response = await page.request.get('/api/playtest/consent', { headers: eventHeaders });
			expect(response.ok()).toBe(true);
			return PlaytestConsentSummarySchema.parse(await response.json()).retainedEventCount;
		})
		.toBe(analyticsRequests.length + journeyEvents.length);
	const summaryResponse = await page.request.get('/api/playtest/consent', {
		headers: eventHeaders
	});
	const summary = PlaytestConsentSummarySchema.parse(await summaryResponse.json());
	expect(summary.retainedSessionCount).toBe(1);

	const withdrawalResponse = page.waitForResponse(
		(response) =>
			response.request().method() === 'DELETE' && response.url().endsWith('/api/playtest/consent')
	);
	await settingsConsent.getByRole('button', { name: 'Withdraw and delete' }).click();
	const withdrawnResponse = await withdrawalResponse;
	expect(withdrawnResponse.ok()).toBe(true);
	const withdrawal = PlaytestWithdrawalResultSchema.parse(await withdrawnResponse.json());
	await expect(settingsConsent).toContainText(/\d+ stored events? deleted\. Sharing is off\./u);
	await expect(settingsConsent.getByText('Sharing off', { exact: true })).toBeVisible();
	expect(withdrawal.consent.status).toBe('withdrawn');
	expect(withdrawal.deletedSessionCount).toBe(summary.retainedSessionCount);
	expect(withdrawal.deletedEventCount).toBe(summary.retainedEventCount);
	const afterWithdrawalRequestCount = analyticsRequests.length;

	const revokedResponse = await page.request.get('/api/playtest/consent', {
		headers: eventHeaders
	});
	expect(revokedResponse.status()).toBe(404);
	const revokedEventResponse = await page.request.post('/api/playtest/events', {
		headers: eventHeaders,
		data: { ...journeyEvents[0]!, eventId: randomUUID() }
	});
	expect(revokedEventResponse.status()).toBe(403);
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-playtest-consent', 'declined');
	await page.waitForLoadState('networkidle');
	expect(analyticsRequests).toHaveLength(afterWithdrawalRequestCount);
});

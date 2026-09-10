import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

async function createCampaign(page: Page, seed: string) {
	const response = await page.request.post('/api/campaigns', {
		data: { seed, controlMode: 'wait' }
	});
	expect(response.status()).toBe(201);
	return (await response.json()) as {
		campaign: { runId: string };
		resumePath: string;
	};
}

async function enterHearth(page: Page, resumePath: string, runId: string) {
	await page.goto(resumePath);
	await page.getByTestId('answer-reserve-bell').click();
	await page.getByTestId('open-summoning-gate').click();
	for (let answerCount = 1; answerCount <= 3; answerCount += 1) {
		await page.getByTestId('ask-first-question').click();
		await expect(page.getByTestId('campaign-hero').filter({ hasText: 'answered' })).toHaveCount(
			answerCount
		);
	}
	await page.getByTestId('enter-hearth').click();
	await expect(page).toHaveURL('/village');
	expect(runId).toMatch(/^[a-f0-9-]+$/u);
}

test('keeps analytics off until consent and deletes the typed journey on withdrawal', async ({
	page
}) => {
	test.setTimeout(90_000);
	const viewport = process.env.FIN006_VIEWPORT === 'phone' ? 'phone' : 'desktop';
	if (viewport === 'phone') await page.setViewportSize({ width: 390, height: 844 });
	const analyticsRequests: Array<Record<string, unknown>> = [];
	page.on('request', (request) => {
		if (request.method() !== 'POST' || !request.url().endsWith('/api/playtest/events')) return;
		analyticsRequests.push(request.postDataJSON() as Record<string, unknown>);
	});
	const captureDirectory = process.env.CAPTURE_FIN006_DIR;

	const declinedCampaign = await createCampaign(page, `declined-${randomUUID()}`);
	await enterHearth(page, declinedCampaign.resumePath, declinedCampaign.campaign.runId);
	await page.getByRole('button', { name: 'Pause menu' }).click();
	const pause = page.getByRole('dialog', { name: 'Paused campaign menu' });
	await pause.getByRole('button', { name: 'Settings', exact: true }).click();
	const consentPanel = pause.getByTestId('playtest-consent');
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
	await expect.poll(() => analyticsRequests.length).toBe(0);

	await consentPanel.getByRole('button', { name: /share playtest data/i }).click();
	await expect(consentPanel.getByText('Sharing on')).toBeVisible();
	await expect(consentPanel).toContainText('You can withdraw and delete it here at any time');
	await expect
		.poll(() => analyticsRequests.some((event) => event.eventType === 'route_viewed'))
		.toBe(true);
	const localConsent = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('summonlab.playtest-consent.v1') ?? 'null')
	);
	expect(localConsent).toMatchObject({ decision: 'granted' });
	expect(localConsent.withdrawalToken).toMatch(/^[a-f0-9]{64}$/u);

	const rawTextResponse = await page.request.post('/api/playtest/events', {
		headers: { 'x-playtest-consent': localConsent.withdrawalToken },
		data: {
			eventId: randomUUID(),
			sessionId: randomUUID(),
			runId: null,
			eventType: 'route_viewed',
			route: 'title',
			viewport: 'desktop',
			occurredAt: new Date().toISOString(),
			rawQuestion: 'This property must never be accepted.'
		}
	});
	expect(rawTextResponse.status()).toBe(400);

	const consentedCampaign = await createCampaign(page, `consented-${randomUUID()}`);
	const runId = consentedCampaign.campaign.runId;
	await enterHearth(page, consentedCampaign.resumePath, runId);
	await page.getByRole('button', { name: 'Pause menu' }).click();
	await expect(page.getByRole('dialog', { name: 'Paused campaign menu' })).toBeVisible();

	await expect
		.poll(() => analyticsRequests.map((event) => event.eventType), { timeout: 10_000 })
		.toEqual(
			expect.arrayContaining([
				'route_viewed',
				'onboarding_step_completed',
				'hearth_entered',
				'pause_opened'
			])
		);
	for (const event of analyticsRequests) {
		expect(JSON.stringify(event)).not.toMatch(/rawQuestion|consented-|What do you need/u);
	}

	const summaryResponse = await page.request.get('/api/playtest/consent', {
		headers: { 'x-playtest-consent': localConsent.withdrawalToken }
	});
	expect(summaryResponse.ok()).toBe(true);
	const summary = await summaryResponse.json();
	expect(summary.retainedSessionCount).toBe(1);
	expect(summary.retainedEventCount).toBeGreaterThanOrEqual(7);

	await page.goto('/playtest-report');
	await expect(page.getByTestId('playtest-report')).toContainText('Observe the journey');
	await expect(page.getByText('Campaign started', { exact: true }).first()).toBeVisible();
	if (captureDirectory) {
		await page.screenshot({
			path: `${captureDirectory}/phase-7-fin006-${viewport}-aggregate-report.png`,
			fullPage: true
		});
	}

	await page.goto('/village');
	await page.getByRole('button', { name: 'Pause menu' }).click();
	const withdrawalPause = page.getByRole('dialog', { name: 'Paused campaign menu' });
	await withdrawalPause.getByRole('button', { name: 'Settings', exact: true }).click();
	const settingsConsent = withdrawalPause.getByTestId('playtest-consent');
	await expect(settingsConsent.getByText('Sharing on')).toBeVisible();
	await settingsConsent.getByRole('button', { name: 'Withdraw and delete' }).click();
	await expect(settingsConsent).toContainText(/\d+ stored events? deleted\. Sharing is off\./u);
	const afterWithdrawalRequestCount = analyticsRequests.length;

	const revokedResponse = await page.request.get('/api/playtest/consent', {
		headers: { 'x-playtest-consent': localConsent.withdrawalToken }
	});
	expect(revokedResponse.status()).toBe(404);
	await page.goto('/');
	await page.waitForTimeout(250);
	expect(analyticsRequests).toHaveLength(afterWithdrawalRequestCount);
});

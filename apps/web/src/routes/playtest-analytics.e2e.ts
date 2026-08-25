import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

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

	await page.goto('/');
	const consentPanel = page.getByTestId('playtest-consent').first();
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

	await page.getByLabel('New chronicle seed').fill(`declined-${randomUUID()}`);
	await page.getByTestId('begin-campaign').click();
	await expect(page).toHaveURL(/\/onboarding\/[a-f0-9-]+$/u);
	await page.getByTestId('answer-reserve-bell').click();
	await expect(page.getByTestId('onboarding-step')).toHaveText('PROLOGUE · 2/4');
	await expect.poll(() => analyticsRequests.length).toBe(0);

	await page.goto('/');
	const declinedPanel = page.getByTestId('playtest-consent').first();
	await declinedPanel.getByRole('button', { name: /share playtest data/i }).click();
	await expect(declinedPanel.getByText('Sharing on')).toBeVisible();
	await expect(declinedPanel).toContainText('You can withdraw and delete it here at any time');
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

	await page.getByLabel('New chronicle seed').fill(`consented-${randomUUID()}`);
	await page.getByTestId('begin-campaign').click();
	await expect(page).toHaveURL(/\/onboarding\/[a-f0-9-]+$/u);
	const runId = page.url().split('/').at(-1);
	if (!runId) throw new Error('Consented campaign did not include a run ID');
	await page.getByTestId('answer-reserve-bell').click();
	await page.getByTestId('open-summoning-gate').click();
	for (let answerCount = 1; answerCount <= 3; answerCount += 1) {
		await page.getByTestId('ask-first-question').click();
		await expect(page.getByTestId('campaign-hero').filter({ hasText: 'answered' })).toHaveCount(
			answerCount
		);
	}
	await page.getByTestId('enter-hearth').click();
	await expect(page).toHaveURL(new RegExp(`/play/${runId}$`, 'u'));
	await page.getByRole('button', { name: 'Pause menu' }).click();
	await expect(page.getByRole('dialog', { name: 'Paused campaign menu' })).toBeVisible();

	await expect
		.poll(() => analyticsRequests.map((event) => event.eventType), { timeout: 10_000 })
		.toEqual(
			expect.arrayContaining([
				'route_viewed',
				'campaign_started',
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

	await page.goto(`/play/${runId}`);
	await page.getByRole('button', { name: 'Pause menu' }).click();
	const pause = page.getByRole('dialog', { name: 'Paused campaign menu' });
	await pause.getByRole('button', { name: 'Settings', exact: true }).click();
	const settingsConsent = pause.getByTestId('playtest-consent');
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

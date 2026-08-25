import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

test('onboards a stable company and preserves the prior chronicle when restarted', async ({
	page
}) => {
	test.setTimeout(90_000);
	const seed = `campaign-e2e-${randomUUID()}`;
	const viewport = process.env.CAMPAIGN_VIEWPORT === 'phone' ? 'phone' : 'desktop';
	const captureDirectory = process.env.CAPTURE_FIN003_DIR;
	const capturePrefix = process.env.CAPTURE_FIN003_PREFIX ?? viewport;
	const captureStates = new Set(
		(process.env.CAPTURE_FIN003_STATES ?? 'title,gate,company,hearth,pause').split(',')
	);
	const capture = async (name: string) => {
		if (!captureDirectory || !captureStates.has(name)) return;
		await page.screenshot({
			path: `${captureDirectory}/${capturePrefix}-${name}.png`,
			fullPage: true
		});
	};
	if (viewport === 'phone') await page.setViewportSize({ width: 390, height: 844 });

	await page.goto('/');
	await expect(page.getByTestId('campaign-title')).toBeVisible();
	await expect(page.getByRole('heading', { name: /They were summoned/ })).toBeVisible();
	await expect(page.getByAltText('An agent hero crossing an arcane summoning gate')).toBeVisible();
	await capture('title');

	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const titleSettings = page.getByTestId('player-settings');
	await titleSettings.getByRole('button', { name: 'Large', exact: true }).click();
	await titleSettings.getByRole('button', { name: 'Reduced', exact: true }).click();
	await titleSettings.getByRole('button', { name: '5-second handoff', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('data-player-text', 'large');
	await expect(page.locator('html')).toHaveAttribute('data-player-motion', 'reduced');
	await page.getByRole('button', { name: /Close/ }).click();
	await page.reload();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	await expect(
		page.getByTestId('player-settings').getByRole('button', { name: 'Large', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await expect(
		page.getByTestId('player-settings').getByRole('button', { name: 'Reduced', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await expect(
		page
			.getByTestId('player-settings')
			.getByRole('button', { name: '5-second handoff', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: /Close/ }).click();

	await page.getByLabel('New chronicle seed').fill(seed);
	await page.getByTestId('begin-campaign').click();
	await expect(page).toHaveURL(/\/onboarding\/[a-f0-9-]+$/u);
	const firstRunId = page.url().split('/').at(-1);
	if (!firstRunId) throw new Error('Campaign onboarding URL did not include a run ID');

	await expect(page.getByTestId('onboarding-step')).toHaveText('PROLOGUE · 1/4');
	await expect(page.getByTestId('active-objective')).toContainText('Reach the summoning gate');
	await page.getByTestId('answer-reserve-bell').click();
	await expect(page.getByTestId('onboarding-step')).toHaveText('PROLOGUE · 2/4');
	await expect(page.getByRole('heading', { name: /The gate has three answers/i })).toBeVisible();
	await capture('gate');
	await page.getByTestId('open-summoning-gate').click();
	await expect(page.getByTestId('onboarding-step')).toHaveText('PROLOGUE · 3/4');

	const heroes = page.getByTestId('campaign-hero');
	await expect(heroes).toHaveCount(3);
	const firstCompanyNames = await heroes.locator('strong').allTextContents();
	expect(new Set(firstCompanyNames).size).toBe(3);
	await capture('company');
	for (let answerCount = 1; answerCount <= 3; answerCount += 1) {
		await page.getByTestId('ask-first-question').click();
		await expect(heroes.filter({ hasText: 'answered' })).toHaveCount(answerCount);
	}
	await expect(heroes.filter({ hasText: 'answered' })).toHaveCount(3);
	for (let heroIndex = 0; heroIndex < 3; heroIndex += 1) {
		await heroes.nth(heroIndex).click();
		await expect(page.getByTestId('first-reply')).toBeVisible();
	}
	await expect(page.getByTestId('enter-hearth')).toBeEnabled();

	await page.getByTestId('enter-hearth').click();
	await expect(page).toHaveURL(new RegExp(`/play/${firstRunId}$`, 'u'));
	await expect(
		page.getByText(/(?:Walking to|Arrived ·) (?:Kitchen|Training Ground)/)
	).toBeVisible();
	await expect(page.getByText(/Agent-altered route/)).toBeVisible();
	await expect(page.getByTestId('active-objective')).toContainText('Recover the First Ember');
	await capture('hearth');

	await page.getByRole('button', { name: 'Pause menu' }).click();
	const pauseMenu = page.getByRole('dialog', { name: 'Paused campaign menu' });
	await expect(pauseMenu).toBeVisible();
	await expect(pauseMenu).toContainText('the server-owned settlement clock continues');
	await expect(page.getByTestId('campaign-objectives').locator('article')).toHaveCount(7);
	await expect(page.getByTestId('campaign-objectives').locator('article.complete')).toHaveCount(4);
	await capture('pause');
	await pauseMenu.getByRole('button', { name: 'Settings', exact: true }).click();
	await expect(pauseMenu.getByRole('button', { name: 'Large', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(pauseMenu.getByRole('button', { name: 'Reduced', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(
		pauseMenu.getByRole('button', { name: '5-second handoff', exact: true })
	).toHaveAttribute('aria-pressed', 'true');

	await pauseMenu.getByRole('button', { name: 'Restart same seed', exact: true }).click();
	await pauseMenu.getByRole('button', { name: 'Confirm restart', exact: true }).click();
	await expect(page).toHaveURL(/\/onboarding\/[a-f0-9-]+$/u);
	const secondRunId = page.url().split('/').at(-1);
	if (!secondRunId) throw new Error('Restarted onboarding URL did not include a run ID');
	expect(secondRunId).not.toBe(firstRunId);

	await page.getByTestId('answer-reserve-bell').click();
	await page.getByTestId('open-summoning-gate').click();
	await expect(page.getByTestId('campaign-hero')).toHaveCount(3);
	await expect(page.getByTestId('campaign-hero').locator('strong')).toHaveText(firstCompanyNames);

	const superseded = await page.request.get(`/api/campaigns/${firstRunId}`);
	expect(superseded.ok()).toBe(true);
	expect((await superseded.json()).campaign.lifecycle).toBe('superseded');
	await page.goto(`/replay/${firstRunId}`);
	await expect(page.getByTestId('replay-status')).toContainText('Verified');
	await expect(page.getByTestId('replay-status')).toContainText('snapshot agrees');
});

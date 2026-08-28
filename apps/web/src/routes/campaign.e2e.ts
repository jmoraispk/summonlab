import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

test('default company arrives as three realistic inspectable heroes', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('New chronicle seed').fill('hearth-01');
	await page.getByTestId('begin-campaign').click();
	await page.getByTestId('answer-reserve-bell').click();
	await page.getByTestId('open-summoning-gate').click();

	const heroes = page.getByTestId('campaign-hero');
	await expect(heroes).toHaveCount(3);
	await expect(heroes.locator('img')).toHaveCount(3);
	await expect(page.getByTestId('summoned-hero-portrait')).toBeVisible();
	await expect(page.getByTestId('summoned-hero-portrait')).toHaveAttribute(
		'src',
		/^\/runtime\/visual-catalog-v1\/hero-jori-daro-anchor-v1\/summon\.[a-f0-9]{12}\.webp$/u
	);
	if (process.env.CAPTURE_FIN007_CORRECTION_DIR) {
		await page.screenshot({
			path: `${process.env.CAPTURE_FIN007_CORRECTION_DIR}/phase-7-fin007-owner-summoning-desktop.png`,
			fullPage: true
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.reload();
		await expect(page.getByTestId('summoned-hero-portrait')).toBeVisible();
		await page.screenshot({
			path: `${process.env.CAPTURE_FIN007_CORRECTION_DIR}/phase-7-fin007-owner-summoning-phone.png`,
			fullPage: true
		});
	}

	await heroes.nth(1).click({ button: 'right' });
	await expect(heroes.nth(1)).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('summoned-hero-portrait')).toHaveAttribute('alt', /Dara Zev/u);
});

test('onboards a stable company and preserves the prior chronicle when restarted', async ({
	page
}) => {
	test.setTimeout(90_000);
	const seed = `campaign-e2e-${randomUUID()}`;
	const viewport = process.env.CAMPAIGN_VIEWPORT === 'phone' ? 'phone' : 'desktop';
	const captureDirectory = process.env.CAPTURE_FIN004_DIR ?? process.env.CAPTURE_FIN003_DIR;
	const capturePrefix =
		process.env.CAPTURE_FIN004_PREFIX ?? process.env.CAPTURE_FIN003_PREFIX ?? viewport;
	const captureStates = new Set(
		(
			process.env.CAPTURE_FIN004_STATES ??
			process.env.CAPTURE_FIN003_STATES ??
			'title,settings,gate,company,hearth,pause'
		).split(',')
	);
	const capture = async (name: string) => {
		if (!captureDirectory || !captureStates.has(name)) return;
		await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
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

	const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
	await settingsButton.focus();
	await settingsButton.press('Enter');
	const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(settingsDialog).toBeFocused();
	const titleSettings = page.getByTestId('player-settings');
	await titleSettings.getByRole('radio', { name: 'Large', exact: true }).check();
	await titleSettings.getByRole('radio', { name: 'Reduced', exact: true }).check();
	await titleSettings.getByRole('radio', { name: 'Full mix', exact: true }).check();
	await titleSettings.getByRole('radio', { name: '5-second handoff', exact: true }).check();
	await expect(titleSettings.getByRole('checkbox', { name: 'Captions on' })).toBeChecked();
	await expect(page.locator('html')).toHaveAttribute('data-player-text', 'large');
	await expect(page.locator('html')).toHaveAttribute('data-player-motion', 'reduced');
	await expect(page.locator('html')).toHaveAttribute('data-player-sound', 'full');
	await expect(page.getByTestId('sensory-controls')).toHaveAttribute('data-audio-state', 'active');
	await capture('settings');
	await settingsDialog.press('Escape');
	await expect(settingsButton).toBeFocused();
	await page.reload();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	await expect(
		page.getByTestId('player-settings').getByRole('radio', { name: 'Large', exact: true })
	).toBeChecked();
	await expect(
		page.getByTestId('player-settings').getByRole('radio', { name: 'Reduced', exact: true })
	).toBeChecked();
	await expect(
		page
			.getByTestId('player-settings')
			.getByRole('radio', { name: '5-second handoff', exact: true })
	).toBeChecked();
	await expect(
		page.getByTestId('player-settings').getByRole('radio', { name: 'Full mix', exact: true })
	).toBeChecked();
	await page.getByRole('button', { name: /Close/ }).click();
	await page.getByRole('button', { name: 'Start sound' }).click();
	await expect(page.getByTestId('sensory-controls')).toHaveAttribute('data-audio-state', 'active');

	await page.getByLabel('New chronicle seed').fill(seed);
	await page.getByTestId('begin-campaign').click();
	await expect(page).toHaveURL(/\/onboarding\/[a-f0-9-]+$/u);
	await expect(page.locator('#main-content')).toBeFocused();
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
	const firstRunId = page.url().split('/').at(-1);
	if (!firstRunId) throw new Error('Campaign onboarding URL did not include a run ID');

	await expect(page.getByTestId('onboarding-step')).toHaveText('PROLOGUE · 1/4');
	await expect(page.getByTestId('active-objective')).toContainText('Reach the summoning gate');
	await page.getByTestId('answer-reserve-bell').click();
	await expect(page.getByRole('status')).toContainText('reserve bell');
	await expect(page.getByTestId('onboarding-step')).toHaveText('PROLOGUE · 2/4');
	await expect(page.getByRole('heading', { name: /Summon your first company/i })).toBeVisible();
	await capture('gate');
	await page.getByTestId('open-summoning-gate').click();
	await expect(page.getByTestId('onboarding-step')).toHaveText('PROLOGUE · 3/4');

	const heroes = page.getByTestId('campaign-hero');
	await expect(heroes).toHaveCount(3);
	const firstCompanyNames = await heroes.locator('strong').allTextContents();
	expect(new Set(firstCompanyNames).size).toBe(3);
	await capture('company');
	await expect(heroes.first()).toHaveAttribute('aria-selected', 'true');
	await heroes.first().press('ArrowRight');
	await expect(heroes.nth(1)).toHaveAttribute('aria-selected', 'true');
	await heroes.first().click();
	await expect(heroes.first()).toBeFocused();
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
	await expect(page.getByText(/Arrived · (?:Kitchen|Training Ground)/)).toBeVisible();
	await expect(page.getByText(/Agent-altered route/)).toBeVisible();
	await expect(page.getByTestId('active-objective')).toContainText('Recover the First Ember');
	await capture('hearth');

	await page.getByRole('button', { name: 'Pause menu' }).click();
	const pauseMenu = page.getByRole('dialog', { name: 'Paused campaign menu' });
	await expect(pauseMenu).toBeVisible();
	await expect(pauseMenu).toBeFocused();
	await expect(pauseMenu).toContainText('the server-owned settlement clock continues');
	await expect(page.getByTestId('campaign-objectives').locator('article')).toHaveCount(7);
	await expect(page.getByTestId('campaign-objectives').locator('article.complete')).toHaveCount(4);
	await capture('pause');
	await pauseMenu.getByRole('button', { name: 'Settings', exact: true }).click();
	await expect(pauseMenu.getByRole('radio', { name: 'Large', exact: true })).toBeChecked();
	await expect(pauseMenu.getByRole('radio', { name: 'Reduced', exact: true })).toBeChecked();
	await expect(
		pauseMenu.getByRole('radio', { name: '5-second handoff', exact: true })
	).toBeChecked();
	await expect(pauseMenu.getByRole('radio', { name: 'Full mix', exact: true })).toBeChecked();

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

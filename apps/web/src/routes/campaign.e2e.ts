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

test('default company arrives as three realistic inspectable heroes', async ({ page }) => {
	const { resumePath } = await createCampaign(page, 'hearth-01');
	await page.goto(resumePath);
	await page.getByTestId('answer-reserve-bell').click();
	await page.getByTestId('open-summoning-gate').click();

	const heroes = page.getByTestId('campaign-hero');
	await expect(heroes).toHaveCount(3);
	await expect(heroes.locator('img')).toHaveCount(3);
	await expect(page.getByTestId('summoned-hero-portrait')).toBeVisible();
	await expect(page.getByTestId('summoned-hero-portrait')).toHaveAttribute(
		'src',
		/^\/runtime\/(?:visual-catalog-v1|summonable-heroes-v1)\/[^/]+\/summon\.[a-f0-9]{12}\.webp$/u
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

	const secondHeroName = (await heroes.nth(1).locator('strong').textContent())?.trim();
	if (!secondHeroName) throw new Error('Second hero did not expose a display name');
	await heroes.nth(1).click({ button: 'right' });
	await expect(heroes.nth(1)).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('summoned-hero-portrait')).toHaveAttribute(
		'alt',
		`${secondHeroName}, newly summoned at the gate`
	);
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
	await expect(page.getByRole('heading', { name: 'Summonlab' })).toBeAttached();
	await expect(page.getByTestId('enter-village')).toBeVisible();
	await expect(page.locator('.key-art')).toBeVisible();
	await capture('title');

	const { campaign, resumePath } = await createCampaign(page, seed);
	await page.goto('/');
	await expect(page.getByTestId('enter-village')).toHaveAttribute('type', 'submit');
	await page.goto(resumePath);
	await expect(page).toHaveURL('/village');
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
	const firstRunId = campaign.runId;

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
	await expect(page).toHaveURL('/village');
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
	const settings = pauseMenu.getByTestId('player-settings');
	await settings.getByRole('radio', { name: 'Large', exact: true }).check();
	await settings.getByRole('radio', { name: 'Reduced', exact: true }).check();
	await settings.getByRole('radio', { name: 'Full mix', exact: true }).check();
	await settings.getByRole('radio', { name: '5-second handoff', exact: true }).check();
	await expect(settings.getByRole('checkbox', { name: 'Captions on' })).toBeChecked();
	await expect(page.locator('html')).toHaveAttribute('data-player-text', 'large');
	await expect(page.locator('html')).toHaveAttribute('data-player-motion', 'reduced');
	await expect(page.locator('html')).toHaveAttribute('data-player-sound', 'full');
	await capture('settings');

	await pauseMenu.getByRole('button', { name: 'Restart same seed', exact: true }).click();
	await pauseMenu.getByRole('button', { name: 'Confirm restart', exact: true }).click();
	await expect(page).toHaveURL('/village');
	const activeCampaignResponse = await page.request.get('/api/campaigns');
	expect(activeCampaignResponse.ok()).toBe(true);
	const activeCampaign = (await activeCampaignResponse.json()) as {
		campaign: { runId: string };
	};
	const secondRunId = activeCampaign.campaign.runId;
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

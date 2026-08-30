import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1000 } });

const towerUrl = process.env.LV_TOWER_BASE_URL
	? new URL('/living-village-lab/tower', process.env.LV_TOWER_BASE_URL).toString()
	: '/living-village-lab/tower';

async function deployDefaultExploration(page: import('@playwright/test').Page): Promise<void> {
	await page.getByRole('button', { name: /Explore Floor 3/ }).click();
	await expect(page.getByRole('button', { name: 'Replay encounter' })).toBeVisible();
}

async function waitForHydration(page: import('@playwright/test').Page): Promise<void> {
	await expect(page.locator('html')).toHaveAttribute('data-player-ready', 'true');
}

test('configures and deterministically resolves a bounded floor exploration', async ({ page }) => {
	const apiRequests: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
	});

	await page.goto(towerUrl);
	await waitForHydration(page);

	await expect(
		page.getByRole('heading', { name: 'Choose a floor and return point' })
	).toBeVisible();
	await expect(page.getByTestId('fixture-version')).toContainText('not accepted final combat');
	await expect(page.getByRole('button', { name: /Floor 10/ })).toBeDisabled();

	await page.getByRole('button', { name: /Floor 1,/ }).click();
	await expect(page.getByText('Repeat exploration')).toBeVisible();
	await expect(page.getByText('No first-clear item or unlock claim')).toHaveCount(0);

	await page.getByRole('button', { name: /Floor 3,/ }).click();
	await expect(page.locator('.reward').getByText('First clear', { exact: true })).toBeVisible();
	await expect(page.getByTestId('species-preview')).toContainText('Ember Wisp');
	await expect(page.getByTestId('species-preview')).toContainText('Goblin Skirmisher');
	await expect(page.getByTestId('species-preview').getByRole('img')).toHaveCount(2);
	await expect(page.getByTestId('species-preview')).toContainText('Ember cinder');
	await expect(page.getByTestId('species-preview')).toContainText('Mineral core');

	await page.getByLabel('50%').check();
	await expect(page.getByTestId('threshold-warning')).toContainText(
		'One fight can cross below 50% before the party returns'
	);
	await expect(page.getByText('In party · slot 1')).toBeVisible();

	const jori = page.locator('article').filter({ hasText: 'Jori Daro' }).first();
	await jori.getByRole('button', { name: 'Mark training' }).click();
	await page.getByRole('button', { name: /Explore Floor 3/ }).click();
	await expect(page.getByTestId('deploy-error')).toContainText('Jori Daro is training');
	await expect(page.getByTestId('deploy-error')).toBeFocused();

	await jori.getByRole('button', { name: 'Recall to idle' }).click();
	await jori.getByRole('button', { name: 'Remove Jori Daro' }).click();
	await page.getByRole('button', { name: /Explore Floor 3/ }).click();
	await expect(page.getByTestId('deploy-error')).toContainText('2/3 party slots are filled');
	await expect(page.getByTestId('deploy-error')).toBeFocused();
	await jori.getByRole('button', { name: 'Add Jori Daro' }).click();

	await page.getByRole('button', { name: /Explore Floor 3/ }).click();
	await expect(page.getByTestId('initiative-order')).toContainText('Initiative / action order');
	await expect(page.getByTestId('decisive-cause')).toContainText('party-action-cycle');
	await expect(page.getByTestId('combat-chronicle')).toContainText(/Health|Mana/);

	const playback = page.getByRole('button', { name: /Pause|Play/, exact: true });
	await playback.click();
	await page.getByRole('button', { name: '2x' }).click();
	await page.getByRole('button', { name: 'Replay encounter' }).click();
	await expect(page.getByRole('button', { name: '2x' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByText('Presentation fixture', { exact: true })).toBeVisible();

	const firstReceipt = await page.getByTestId('decisive-cause').textContent();
	await page.getByRole('button', { name: /View haul/ }).click();
	const report = page.getByTestId('hunt-report');
	await expect(report).toContainText('Monster kills');
	await expect(report).toContainText('Ember Wisp');
	await expect(report).toContainText('Goblin Skirmisher');
	await expect(report).toContainText('level XP');
	await expect(report).toContainText('practical uses');
	await expect(report).toContainText('Ember cinder');
	await expect(report).toContainText('Mineral core');
	await expect(report).toContainText('Remaining Health and Mana');
	await expect(page.getByTestId('return-reason')).toContainText('health-threshold');
	await expect(report).toContainText('Floor 3 training seal');

	const firstHaulHash = (await report.textContent())?.match(/Haul hash\s*([a-f0-9]{8})/u)?.[1];
	const firstMaterials = await report.locator('.materials').textContent();

	await page.reload();
	await waitForHydration(page);
	await deployDefaultExploration(page);
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await expect(page.getByTestId('decisive-cause')).toHaveText(firstReceipt!);
	await page.getByRole('button', { name: /View haul/ }).click();
	await expect(page.getByTestId('hunt-report')).toContainText(firstHaulHash!);
	await expect(page.getByTestId('hunt-report').locator('.materials')).toHaveText(firstMaterials!);

	await expect(page.getByRole('button', { name: 'Review safe Court training' })).toBeVisible();
	await page.getByRole('button', { name: 'Return to Village' }).click();
	await expect(page.getByTestId('return-handoff')).toContainText('Village return prepared');
	await expect(page.getByTestId('return-handoff')).toContainText('/living-village-lab');

	expect(apiRequests).toEqual([]);

	if (process.env.CAPTURE_LV_TOWER_DESKTOP) {
		await page.screenshot({ path: process.env.CAPTURE_LV_TOWER_DESKTOP });
	}
});

test('composes the 390x844 reduced-motion exploration and Village return', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(towerUrl);
	await waitForHydration(page);

	await expect(
		page.getByRole('heading', { name: 'Choose a floor and return point' })
	).toBeVisible();
	await expect(page.getByLabel('75%')).toBeVisible();
	await expect(page.getByLabel('50%')).toBeVisible();
	await expect(page.getByLabel('25%')).toBeVisible();
	await expect(page.getByLabel('Selected party slots')).toContainText('Dara Zev');
	await expect(page.getByLabel('Selected party slots')).toContainText('Mara Vey');
	await expect(page.getByLabel('Selected party slots')).toContainText('Jori Daro');
	await expect(page.locator('.party progress')).toHaveCount(6);
	await page.getByRole('button', { name: /Explore Floor 3/ }).click();
	await expect(page.getByRole('button', { name: 'Replay encounter' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /View haul/ })).toBeVisible();

	const transitionDuration = await page
		.getByRole('button', { name: 'Replay encounter' })
		.evaluate((element) => getComputedStyle(element).transitionDuration);
	expect(transitionDuration).toBe('0s');

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);

	await page.getByRole('button', { name: /View haul/ }).click();
	await expect(page.getByTestId('hunt-report').locator('.remaining progress')).toHaveCount(6);
	await page.getByRole('button', { name: 'Review safe Court training' }).click();
	await expect(page.getByTestId('return-handoff')).toContainText(
		'Eligible heroes already selected'
	);
	await expect(page.getByTestId('return-handoff')).toContainText('Dara Zev');
	await expect(page.getByTestId('return-handoff')).toContainText('Mara Vey');
	await expect(page.getByTestId('return-handoff')).toContainText('Jori Daro');

	await page.getByRole('button', { name: 'Return to Village' }).scrollIntoViewIfNeeded();
	if (process.env.CAPTURE_LV_TOWER_MOBILE) {
		await page.screenshot({ path: process.env.CAPTURE_LV_TOWER_MOBILE });
	}
});

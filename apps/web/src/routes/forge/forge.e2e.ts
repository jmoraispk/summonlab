import { expect, test } from '@playwright/test';

test('compares summon floors and inspects realistic review cohorts', async ({ page }) => {
	const captureDirectory = process.env.CAPTURE_FORGE_DIR;
	await page.goto('/forge');
	await expect(page.getByRole('heading', { name: /Choose a gate/ })).toBeVisible();
	await expect(page.getByText('1★+ minimum')).toBeVisible();
	await page.getByTestId('summon-three').click();
	await expect(page.getByTestId('summoned-hero')).toHaveCount(3);
	await expect(page.getByTestId('hero-dossier')).toContainText('Aptitude scan');
	await expect(page.getByAltText(/realistic summon portrait/)).toHaveCount(3);

	await page.getByTestId('summon-channel-special').click();
	await expect(page.getByText('3★+ minimum')).toBeVisible();
	await page.getByTestId('summon-three').click();
	await expect(page.getByTestId('summoned-hero')).toHaveCount(3);
	await expect(page.getByTestId('summoned-hero').first()).toContainText('✦✦✦');
	await expect(page.getByTestId('hero-dossier')).toContainText('Level cap 30');
	if (captureDirectory) {
		await page.waitForTimeout(1_000);
		await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
		await page.locator('.skip-link').evaluate((element) => element.setAttribute('hidden', ''));
		await page.screenshot({
			path: `${captureDirectory}/phase-7-forge-summons-desktop.png`,
			fullPage: true
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.screenshot({
			path: `${captureDirectory}/phase-7-forge-summons-phone.png`,
			fullPage: true
		});
	}
});

test('shows sixteen enemy candidates and one progression row per preview floor', async ({
	page
}) => {
	const captureDirectory = process.env.CAPTURE_FORGE_DIR;
	await page.goto('/forge/enemies');
	await expect(page.getByRole('heading', { name: /Recognize the threat/ })).toBeVisible();
	await expect(page.getByTestId('enemy-family')).toHaveCount(4);
	await expect(
		page.getByTestId('enemy-family').first().getByText('Goblin Skirmisher', { exact: true })
	).toBeVisible();
	await expect(
		page.getByTestId('enemy-family').last().getByText('Frost Giant', { exact: true })
	).toBeVisible();
	await expect(page.getByTestId('progression-floor')).toHaveCount(20);
	if (captureDirectory) {
		await page.screenshot({
			path: `${captureDirectory}/phase-7-forge-enemies-desktop.png`,
			fullPage: true
		});
	}
});

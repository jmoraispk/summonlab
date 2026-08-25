import { expect, test, type Page } from '@playwright/test';

async function launchIronMoon(page: Page) {
	await page.goto('/iron-moon');
	await expect(page.getByRole('heading', { name: /Iron Moon/ })).toBeVisible();
	await page.getByTestId('open-iron-moon').click();
	await expect(page).toHaveURL(/\/mission\/[0-9a-f-]+$/u);
}

test('gives the summoned hero an independent portal decision', async ({ page }) => {
	await launchIronMoon(page);
	await page.getByTestId('prepare-party').click();
	await page.getByTestId('deploy-party').click();
	await page
		.getByTestId('master-turn-actions')
		.getByRole('button', { name: 'Move to Windward Shelf' })
		.click();
	await page.getByTestId('resolve-turn').click();
	await expect(page.getByTestId('initiative-report')).toContainText('Initiative 1');
	await expect(page.locator('.initiative-actions article')).toHaveCount(2);
	await expect(page.locator('.initiative-actions')).toContainText('hero · scripted');
});

test('mines finite Iron Moon ore and credits it only after extraction', async ({ page }) => {
	await launchIronMoon(page);
	await expect(page.getByRole('heading', { name: /The Closing Scar/ })).toBeVisible();

	await page.getByTestId('hero-roster-card').click();
	await page.getByTestId('prepare-party').click();
	await page.getByTestId('deploy-party').click();
	await expect(page.getByTestId('portal-clock')).toContainText('8');
	await expect(page.getByTestId('ore-console')).toContainText('2 settlement iron');
	await expect(page.getByTestId('portal-board-status')).toContainText('0/4 ore secured');

	for (const [index, label] of [
		'Move to Windward Shelf',
		'Move to Crater Heart',
		'Mine 2 moon iron',
		'Mine 2 moon iron',
		'Move to Windward Shelf',
		'Move to Portal Scar'
	].entries()) {
		await page.getByTestId('master-turn-actions').getByRole('button', { name: label }).click();
		await page.getByTestId('resolve-turn').click();
		await expect(page.getByTestId('initiative-report')).toContainText(`Initiative ${index + 1}`);
		if (index === 3 && process.env.CAPTURE_PHASE6_IRON_MOON) {
			await page.setViewportSize({ width: 1440, height: 1200 });
			await page.screenshot({
				path: process.env.CAPTURE_PHASE6_IRON_MOON,
				fullPage: true
			});
		}
	}

	await expect(page.locator('.phase-heading h2')).toHaveText('extraction');
	await expect(page.getByTestId('portal-clock')).toContainText('2');
	await expect(page.getByTestId('ore-console')).toContainText('2 settlement iron');
	await expect(page.getByTestId('ore-console')).toContainText('4/4');
	await page.getByTestId('extract-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('success');
	await expect(page.getByTestId('ore-console')).toContainText('6 settlement iron');
	await expect(page.getByTestId('ore-console')).toContainText('extracted');
	await page.reload();
	await expect(page.locator('.phase-heading h2')).toHaveText('success');
	await expect(page.getByTestId('ore-console')).toContainText('6 settlement iron');
});

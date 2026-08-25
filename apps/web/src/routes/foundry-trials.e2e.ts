import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });

test('compares three replay-verified Foundry strategies without overflow', async ({ page }) => {
	await page.goto('/foundry-trials');

	await expect(page.getByRole('heading', { name: /Three ways/ })).toBeVisible();
	await expect(page.getByLabel('quality gate passed')).toContainText('24 / 24');
	await expect(page.locator('.strategy-grid button')).toHaveCount(3);
	await expect(page.getByText('Replay mismatches').locator('..')).toContainText('0');
	await expect(page.getByText('Deaths').locator('..')).toContainText('0');

	await page.getByTestId('strategy-full-quench').click();
	await expect(page.getByTestId('representative-run')).toContainText('Full Quench');
	await expect(page.getByText('quenched', { exact: true }).first()).toBeVisible();
	await expect(page.getByTestId('representative-run').locator('.timeline article')).toHaveCount(6);

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);

	if (process.env.CAPTURE_PHASE6_FOUNDRY_STRATEGIES) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE6_FOUNDRY_STRATEGIES, fullPage: true });
	}
});

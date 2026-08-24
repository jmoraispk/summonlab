import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('shows an honest offline agency gate and fixed corpus without overflow', async ({ page }) => {
	await page.goto('/debug/evaluations');

	await expect(page.getByRole('heading', { name: /Earn the right/ })).toBeVisible();
	await expect(page.getByTestId('model-gate')).toContainText('Evidence required');
	await expect(page.getByText('10/10 packets')).toBeVisible();
	await expect(page.getByText('gpt-5-nano, still unproven')).toBeVisible();
	await expect(page.getByText('unmeasured · 0 samples')).toBeVisible();
	await expect(page.getByText('Same trials, every time')).toBeVisible();
	await expect(page.locator('.case-list article')).toHaveCount(10);
	await expect(page.locator('.choice i.pass')).toHaveCount(10);

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);

	if (process.env.CAPTURE_PHASE5_EVALUATION) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE5_EVALUATION, fullPage: true });
	}
});

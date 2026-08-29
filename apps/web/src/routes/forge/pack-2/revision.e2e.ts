import { expect, test } from '@playwright/test';

test('reviews the exact Pack 2 correction proofs and their provenance', async ({ page }) => {
	await page.goto('/forge/pack-2/revision');
	await expect(page.getByRole('heading', { name: 'Review the actual correction.' })).toBeVisible();
	await expect(page.getByTestId('revision-proof')).toHaveCount(3);
	await expect(page.getByTestId('revision-proof').locator('img')).toHaveCount(3);
	await expect(page.getByText('built-in-imagegen')).toHaveCount(3);
	await expect(page.getByText('49.0 s')).toBeVisible();
	await expect(page.getByText('44.7 s')).toBeVisible();
	await expect(page.getByText('52.4 s')).toBeVisible();

	const selector = page.getByLabel('Exact proof');
	await expect(selector.locator('option')).toHaveCount(3);
	await selector.selectOption('human-v5-face-grammar-proof-v1');
	await expect(page.locator('.review form > code')).toHaveText(
		'6daaa7f1fdd356acf9d2c0ad1eee4f4dba440628ad42eeb2b7548f8bce9fceac'
	);
	await selector.selectOption('monster-grade-escalation-v1');
	await expect(page.locator('.review form > code')).toHaveText(
		'622a63ea55ab833f0451d29f0967f26f2335c912296ad45537e2a0889c8ecd2e'
	);
});

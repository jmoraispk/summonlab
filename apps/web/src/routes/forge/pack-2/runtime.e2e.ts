import { expect, test } from '@playwright/test';

test('draws only approved cached reveals while Pack 2 candidates stay gated', async ({ page }) => {
	await page.goto('/forge/pack-2/runtime');
	await expect(
		page.getByRole('heading', { name: 'Instant identity. No placeholder swap.' })
	).toBeVisible();
	await expect(page.getByTestId('approved-summon-proof').getByRole('img')).toBeVisible();
	await expect(page.getByText('0 of 18 eligible')).toBeVisible();
	await expect(page.getByTestId('pack-two-runtime-rig')).toBeVisible();
	await expect(page.getByText('Premium generation calls').locator('..')).toContainText('0');

	await page.getByRole('button', { name: 'Draw approved identity' }).click();
	await expect(page.getByTestId('runtime-proof-evidence')).toContainText(/\d+\.\d ms/u);
	const interactionText = await page
		.getByText('Last interaction')
		.locator('..')
		.locator('strong')
		.textContent();
	expect(Number.parseFloat(interactionText ?? 'Infinity')).toBeLessThan(100);
	await page.getByRole('button', { name: 'Draw staged manifest' }).click();
	await page.getByRole('button', { name: 'practice blade' }).click();
	await expect(page.getByTestId('pack-two-runtime-rig').locator('figure')).toHaveAttribute(
		'data-equipment',
		'practice-blade'
	);

	await page.getByRole('button', { name: 'Test cap' }).click();
	const capText = await page.locator('.level-control span').textContent();
	expect(capText).toMatch(/^Level (\d+) \/ \1$/u);
});

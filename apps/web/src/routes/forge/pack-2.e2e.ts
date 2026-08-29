import { expect, test } from '@playwright/test';

test('reviews the six-person Pack 2 pilot at all required scales', async ({ page }) => {
	await page.goto('/forge/pack-2');
	await expect(
		page.getByRole('heading', { name: 'Different bodies. One shared world.' })
	).toBeVisible();
	await expect(page.getByTestId('pack-two-candidate')).toHaveCount(6);
	await expect(page.getByText('Candidate only')).toBeVisible();
	await expect(page.getByTestId('pack-two-lineup')).toBeVisible();
	await expect(page.getByTestId('scale-survival-card')).toHaveCount(6);

	await page.getByRole('button', { name: 'androgynous' }).click();
	await expect(page.getByTestId('pack-two-candidate')).toHaveCount(2);
	await page.getByRole('button', { name: 'all' }).click();
	await page.getByRole('button', { name: /Kira Toren/ }).click();
	await expect(page.getByRole('heading', { name: 'Kira Toren' })).toBeVisible();
});

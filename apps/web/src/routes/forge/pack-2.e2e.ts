import { expect, test } from '@playwright/test';

test('reviews the 18-person Pack 2 cohort at all required scales', async ({ page }) => {
	await page.goto('/forge/pack-2');
	await expect(
		page.getByRole('heading', { name: 'Different bodies. One shared world.' })
	).toBeVisible();
	await expect(page.getByTestId('pack-two-candidate')).toHaveCount(18);
	await expect(page.getByText('Candidate only')).toBeVisible();
	await expect(page.getByTestId('pack-two-lineup')).toBeVisible();
	await expect(page.getByTestId('scale-survival-card')).toHaveCount(18);
	await expect(page.getByTestId('pack-two-progression')).toBeVisible();
	await expect(page.getByText('35.2 s')).toBeVisible();
	await expect(page.getByText('Not real-time artwork.')).toBeVisible();

	await page.getByRole('button', { name: 'androgynous' }).click();
	await expect(page.getByTestId('pack-two-candidate')).toHaveCount(6);
	await page.getByRole('button', { name: 'all' }).click();
	await page.getByRole('button', { name: /Fara Pell/ }).click();
	await expect(page.getByRole('heading', { name: 'Fara Pell' })).toBeVisible();
	await expect(page.getByText('Anchor only')).toBeVisible();
});

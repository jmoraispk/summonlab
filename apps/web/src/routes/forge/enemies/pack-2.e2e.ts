import { expect, test } from '@playwright/test';

test('reviews all Pack 2 monster families and battlefield duties', async ({ page }) => {
	await page.goto('/forge/enemies/pack-2');
	await expect(
		page.getByRole('heading', { name: 'Read the duty. Then survive it.' })
	).toBeVisible();
	await expect(page.getByTestId('pack-two-monster-family')).toHaveCount(6);
	await expect(page.getByTestId('pack-two-monster-duty')).toHaveCount(24);
	await expect(page.getByRole('heading', { name: 'Giant Tower Dragon' })).toBeVisible();
	await expect(page.getByText('Arena-scale apex boss')).toBeVisible();
	await expect(page.getByText('Candidate · human review required')).toHaveCount(6);
});

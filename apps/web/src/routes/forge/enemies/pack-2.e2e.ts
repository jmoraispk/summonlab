import { expect, test } from '@playwright/test';

test('reviews all Pack 2 monster families and battlefield duties', async ({ page }) => {
	await page.goto('/forge/enemies/pack-2');
	await expect(
		page.getByRole('heading', { name: 'Read the duty. Then survive it.' })
	).toBeVisible();
	await expect(page.getByTestId('pack-two-monster-family')).toHaveCount(6);
	await expect(page.getByTestId('pack-two-monster-duty')).toHaveCount(24);
	await expect(page.getByTestId('monster-grade')).toHaveCount(10);
	await expect(page.getByLabel('Inspect a species across all grades')).toHaveValue('death-knight');
	await page.getByLabel('Inspect a species across all grades').selectOption('tower-archmage');
	await expect(page.getByTestId('monster-grade').last()).toContainText('Tower-ending');
	await expect(page.getByTestId('monster-grade').last()).toContainText('117–151');
	await expect(page.getByRole('heading', { name: 'Giant Tower Dragon' })).toBeVisible();
	await expect(
		page.getByTestId('pack-two-monster-duty').filter({ hasText: 'Arena-scale apex boss' })
	).toBeVisible();
	await expect(page.getByText('Candidate · human review required')).toHaveCount(6);
	await expect(page.locator('#monster-anchor-title')).toHaveText('Stone Breaker');
	await expect(page.getByRole('heading', { name: 'Hash-bound monster review' })).toBeVisible();
	await expect(page.getByLabel('Exact monster asset').locator('option')).toHaveCount(7);
	await page.getByRole('button', { name: 'Review exact anchor' }).click();
	await expect(page.getByLabel('Exact monster asset')).toHaveValue('stone-breaker-anchor-v1');
});

import { expect, test } from '@playwright/test';

test('reviews the 18-person Pack 2 cohort at all required scales', async ({ page }) => {
	await page.goto('/forge/pack-2');
	await expect(
		page.getByRole('heading', { name: 'Different bodies. One shared world.' })
	).toBeVisible();
	await expect(page.getByTestId('pack-two-candidate')).toHaveCount(18);
	await page.getByLabel('Build filter').selectOption('powerful');
	expect(await page.getByTestId('pack-two-candidate').count()).toBeGreaterThan(0);
	expect(await page.getByTestId('pack-two-candidate').count()).toBeLessThan(18);
	await page.getByLabel('Build filter').selectOption('all');
	await page.getByLabel('Approval filter').selectOption('pending');
	await expect(page.getByTestId('pack-two-candidate')).toHaveCount(18);
	await page.getByLabel('Approval filter').selectOption('all');
	await expect(page.getByText('Candidate only')).toBeVisible();
	await expect(page.getByTestId('pack-two-lineup')).toBeVisible();
	await expect(page.getByTestId('pack-two-silhouettes').locator('figure')).toHaveCount(18);
	await expect(page.getByTestId('feminine-parity-card')).toHaveCount(6);
	await expect(page.getByTestId('scale-survival-card')).toHaveCount(18);
	await expect(page.getByTestId('pack-two-progression')).toBeVisible();
	await expect(page.getByText('35.2 s')).toBeVisible();
	await expect(page.getByText('Not real-time artwork.')).toBeVisible();

	await page.getByRole('button', { name: 'androgynous' }).click();
	await expect(page.getByTestId('pack-two-candidate')).toHaveCount(6);
	await page.getByRole('button', { name: 'all' }).click();
	await page.getByRole('button', { name: /Fara Pell/ }).click();
	await expect(
		page.getByLabel('Identity & continuity').getByRole('heading', { name: 'Fara Pell' })
	).toBeVisible();
	await expect(page.getByText('Anchor only')).toBeVisible();
	await page.getByText('Pixel provenance').click();
	await expect(page.getByText('fara-pell-anchor-v1').first()).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Hash-bound human review' })).toBeVisible();
	await page.getByRole('button', { name: /Remy Esen/ }).click();
	await expect(page.getByLabel('Exact asset').locator('option')).toHaveCount(2);
	await page.getByLabel('Exact asset').selectOption('remy-esen-continuity-v1');
	await expect(page.getByLabel('Hash-bound human review').locator('form code')).toContainText(
		'remy-esen-continuity-v1'
	);
});

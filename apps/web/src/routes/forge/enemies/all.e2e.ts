import { expect, test } from '@playwright/test';

test('browses every generated enemy family and canonical archetype', async ({ page }) => {
	await page.goto('/forge/enemies/all');
	await expect(page.getByRole('heading', { name: 'Every threat. One field guide.' })).toBeVisible();
	await expect(page.getByTestId('enemy-total')).toHaveText('40');
	await expect(page.getByTestId('family-total')).toHaveText('10');
	await expect(page.getByTestId('asset-total')).toHaveText('12');
	await expect(page.getByTestId('all-enemy-family')).toHaveCount(10);
	await expect(page.getByTestId('all-enemy-card')).toHaveCount(40);
	await expect(page.getByTestId('enemy-proof')).toHaveCount(2);
	await expect(page.getByRole('heading', { name: 'Goblin Skirmisher' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Gray Wolf' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Giant Tower Dragon' })).toBeVisible();
	if (process.env.CAPTURE_ALL_ENEMIES) {
		await page.screenshot({ path: process.env.CAPTURE_ALL_ENEMIES, fullPage: true });
	}

	await page.getByRole('button', { name: /Pack 1/ }).click();
	await expect(page.getByTestId('visible-enemy-count')).toHaveText('16');
	await expect(page.getByTestId('all-enemy-family')).toHaveCount(4);
	await page.getByLabel('Enemy family').selectOption('beasts');
	await expect(page.getByTestId('all-enemy-card')).toHaveCount(4);
	await expect(page.getByRole('heading', { name: 'Cave Bear' })).toBeVisible();

	await page.getByRole('button', { name: /Pack 2/ }).click();
	await expect(page.getByTestId('visible-enemy-count')).toHaveText('24');
	await page.getByPlaceholder('Name, family, or battlefield role').fill('dragon');
	await expect(page.getByTestId('all-enemy-card')).toHaveCount(4);
	await expect(page.getByRole('heading', { name: 'Giant Tower Dragon' })).toBeVisible();
});

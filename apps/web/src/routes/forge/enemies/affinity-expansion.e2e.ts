import { expect, test } from '@playwright/test';

test('indexes all 34 expansion species and their six affinity slots', async ({ page }) => {
	await page.goto('/forge/enemies/affinity-expansion');
	await expect(
		page.getByRole('heading', { name: 'Thirty-four species. Six readable forms each.' })
	).toBeVisible();
	await expect(page.getByTestId('expansion-species-count')).toHaveText('34');
	await expect(page.getByTestId('expansion-target-count')).toHaveText('204');
	await expect(page.getByTestId('affinity-expansion-row')).toHaveCount(34);
	await expect(page.getByTestId('affinity-expansion-cell')).toHaveCount(204);
	await expect(page.locator('#affinity-goblin-skirmisher')).toBeVisible();
	await expect(page.locator('#affinity-giant-broodmother')).toBeVisible();
	await page.getByLabel('Expansion family').selectOption('large-threats');
	await expect(page.getByTestId('affinity-expansion-row')).toHaveCount(4);
});

import { expect, test } from '@playwright/test';

test('leaves the base monster unlabeled and names only the five affinity variants', async ({
	page
}) => {
	await page.goto('/wiki/creatures/monsters/death-knight');

	const baseStudy = page.locator('.neutral');
	await expect(baseStudy).toBeVisible();
	await expect(baseStudy).not.toContainText(/unaffiliated|no affinity|normal/iu);
	await expect(baseStudy.getByRole('img')).toHaveAttribute('alt', 'Death Knight visual candidate');

	const affinityStudies = page.locator('.variant-grid figure');
	await expect(affinityStudies).toHaveCount(5);
	for (const affinity of ['Wood', 'Fire', 'Metal', 'Water', 'Wind']) {
		await expect(affinityStudies.filter({ hasText: affinity })).toHaveCount(1);
	}

	await page.goto('/wiki/creatures/monsters');
	const firstMonster = page.locator('.monster-card').first();
	await expect(firstMonster.locator('.affinity-pips i')).toHaveCount(5);
	await expect(firstMonster.locator('img')).not.toHaveAttribute(
		'alt',
		/unaffiliated|no affinity|normal/iu
	);
});

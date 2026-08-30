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

test('keeps database thumbnails at their landscape production ratio', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters');

	const imageBounds = await page.locator('.monster-card img').first().boundingBox();
	expect(imageBounds).not.toBeNull();
	expect(imageBounds!.width / imageBounds!.height).toBeCloseTo(1.5, 1);
});

test('keeps monster detail studies at their landscape production ratio', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters/death-knight');

	const imageBounds = await page.locator('.variant-grid img').first().boundingBox();
	expect(imageBounds).not.toBeNull();
	expect(imageBounds!.width / imageBounds!.height).toBeCloseTo(1.5, 1);
});

test('does not repeat the Markdown catalog beneath the visual database', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters');

	await expect(page.locator('.database')).toBeVisible();
	await expect(page.locator('.wiki-article')).toHaveCount(0);
	await expect(page.locator('.database-source')).toContainText('Canonical source');
	await expect(page.locator('.database-source')).toContainText('creatures/monsters/README.md');
});

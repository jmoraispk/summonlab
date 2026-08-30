import { expect, test } from '@playwright/test';

test('presents larger monster cards without affinity markers or repeated family counts', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters');

	const cards = page.locator('.monster-card');
	const first = await cards.nth(0).boundingBox();
	const third = await cards.nth(2).boundingBox();
	const fourth = await cards.nth(3).boundingBox();

	expect(first).not.toBeNull();
	expect(third).not.toBeNull();
	expect(fourth).not.toBeNull();
	expect(first!.width).toBeGreaterThan(250);
	expect(third!.y).toBeCloseTo(first!.y, 0);
	expect(fourth!.y).toBeGreaterThan(first!.y + first!.height);
	expect(await page.locator('.affinity-pips').count()).toBe(0);
	await expect(page.getByRole('heading', { name: 'Arachnids', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Beasts', exact: true })).toBeVisible();
	await expect(page.getByText(/known classes/iu)).toHaveCount(0);
});

test('places the base-form explanation below a full-width monster image', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters/death-knight');

	const imageBounds = await page.locator('.neutral img').boundingBox();
	const copyBounds = await page.locator('.neutral-copy').boundingBox();

	expect(imageBounds).not.toBeNull();
	expect(copyBounds).not.toBeNull();
	expect(imageBounds!.width).toBeGreaterThan(700);
	expect(copyBounds!.y).toBeGreaterThanOrEqual(imageBounds!.y + imageBounds!.height - 1);
	await expect(page.getByRole('heading', { name: 'Base Form', exact: true })).toBeVisible();
	await expect(page.locator('.matrix')).not.toContainText(/candidate status|runtime approval/iu);
	await expect(page.locator('.matrix code')).toHaveCount(0);
});

test('keeps production review metadata out of the public monster page', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters/death-knight');

	await expect(page.locator('main')).not.toContainText(
		/\bcandidate\b|hash-bound|runtime approval/iu
	);
	await expect(page.locator('main')).not.toContainText(/\b[a-f0-9]{16,}\b/iu);
});

test('uses an icon selector to inspect one large affinity variant at a time', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters/death-knight');

	await expect(page.getByRole('heading', { name: 'Affinity Variants', exact: true })).toBeVisible();
	const selectors = page.locator('.variant-selector').getByRole('button', {
		name: /affinity variant/iu
	});
	await expect(selectors).toHaveCount(5);
	await expect(page.locator('.variant-stage img')).toHaveAttribute('src', /wood\.webp$/u);

	await page.getByRole('button', { name: 'Fire affinity variant' }).click();
	await expect(page.locator('.variant-stage img')).toHaveAttribute('src', /fire\.webp$/u);
	await expect(page.getByRole('button', { name: 'Fire affinity variant' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.locator('.variant-selector [data-affinity-icon="wood-trunk"]')).toHaveCount(1);
	await expect(page.locator('.variant-selector [data-affinity-icon="metal-ingot"]')).toHaveCount(1);
	await expect(page.locator('.variant-stage figcaption')).not.toContainText(
		/wood|fire|metal|water|wind/iu
	);
});

test('cycles through affinity variants with carousel controls', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters/death-knight');

	await expect(page.locator('.variant-stage img')).toHaveAttribute('src', /wood\.webp$/u);
	await page.getByRole('button', { name: 'Next affinity variant' }).click();
	await expect(page.locator('.variant-stage img')).toHaveAttribute('src', /fire\.webp$/u);
	await page.getByRole('button', { name: 'Previous affinity variant' }).click();
	await expect(page.locator('.variant-stage img')).toHaveAttribute('src', /wood\.webp$/u);
});

test('does not repeat the Markdown catalog beneath the visual database', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters');

	await expect(page.locator('.database')).toBeVisible();
	await expect(page.locator('.wiki-article')).toHaveCount(0);
	await expect(page.locator('.database-source')).toContainText('Canonical source');
	await expect(page.locator('.database-source')).toContainText('creatures/monsters/README.md');
});

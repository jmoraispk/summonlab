import { expect, test } from '@playwright/test';

test('renders an image-first T1–T5 index for every family', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters');

	await expect(page.getByRole('heading', { name: 'Monster bestiary' })).toBeVisible();
	await expect(page.locator('.database .family')).toHaveCount(38);
	await expect(page.locator('#database-goblins img')).toHaveCount(5);
	await expect(page.locator('#database-goblins img').first()).toHaveAttribute(
		'alt',
		/Runt.*Normal/iu
	);
	await expect(page.locator('#database-goblins .monster-card').first()).toContainText('T1');
	await expect(page.locator('#database-goblins .monster-card').last()).toContainText('T5');
	await expect(page.getByRole('heading', { name: 'Current class reconciliation' })).toHaveCount(0);
});

test('renders the Goblin family progression and all 25 family variants', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters/families/goblins');

	await expect(
		page.locator('.monster-family').getByRole('heading', { name: 'Goblins' })
	).toBeVisible();
	await expect(page.locator('.family-atlas img')).toHaveCount(25);
	await expect(page.locator('.family-progression tbody tr')).toHaveCount(5);
	await expect(page.locator('.family-atlas img').first()).toHaveAttribute(
		'alt',
		/Runt.*Normal affinity/iu
	);
});

test('renders all five original-family images with truthful evidence labels', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters/goblin-runt');

	await expect(
		page.locator('.matrix').getByRole('heading', { name: 'Runt', exact: true })
	).toBeVisible();
	await expect(page.locator('.matrix img')).toHaveCount(5);
	await expect(page.locator('.matrix')).toContainText('approved review');
	await expect(
		page.locator('.matrix').getByRole('link', { name: 'Goblins family', exact: true })
	).toBeVisible();
	await expect(page.locator('.matrix img').first()).toHaveAttribute(
		'src',
		/runtime\/enemies\/monster-wiki-v1\/goblins\/goblin-runt\/normal\.[a-f0-9]{12}\.webp$/u
	);
});

test('renders all five fauna images from the existing runtime catalog', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters/wolf-grey-wolf');

	await expect(
		page.locator('.matrix').getByRole('heading', { name: 'Grey Wolf', exact: true })
	).toBeVisible();
	await expect(page.locator('.matrix img')).toHaveCount(5);
	await expect(page.locator('.matrix')).toContainText('runtime');
	await expect(page.locator('.matrix img').first()).toHaveAttribute(
		'src',
		/runtime\/enemies\/fauna-family-v1\/wolves\/wolf-grey-wolf\/normal\.[a-f0-9]{12}\.webp$/u
	);
});

test('wraps the tier cards without horizontal document overflow', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/wiki/creatures/monsters');

	const cards = page.locator('#database-goblins .monster-card');
	await expect(cards).toHaveCount(5);
	const first = await cards.nth(0).boundingBox();
	const second = await cards.nth(1).boundingBox();
	const third = await cards.nth(2).boundingBox();
	expect(first && second && third).toBeTruthy();
	expect(second!.x).toBeGreaterThan(first!.x);
	expect(third!.y).toBeGreaterThan(first!.y);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});

test('redirects the legacy Grey Wolf route to its canonical fauna form', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters/grey-wolf');
	await expect(page).toHaveURL(/\/wiki\/creatures\/monsters\/wolf-grey-wolf$/u);
	await expect(
		page.locator('.matrix').getByRole('heading', { name: 'Grey Wolf', exact: true })
	).toBeVisible();
});

import { expect, test } from '@playwright/test';

test('publishes the integrated 38-family monster database', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters');

	await expect(
		page.getByRole('heading', { name: 'Canonical monster family database' })
	).toBeVisible();
	await expect(page.locator('main')).toContainText('38 production families');
	await expect(page.locator('main')).toContainText('190 canonical T1–T5 forms');
	await expect(page.getByRole('heading', { name: '31 · Wolves' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Grey Wolf', exact: true }).first()).toBeVisible();
});

test('renders all five approved fauna images from the enemy runtime catalog', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters/wolf-grey-wolf');

	await expect(
		page.locator('.matrix').getByRole('heading', { name: 'Grey Wolf', exact: true })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Base Form', exact: true })).toBeVisible();
	await expect(page.locator('.matrix')).toContainText('approved · runtime');
	await expect(page.locator('.neutral img')).toHaveAttribute(
		'src',
		/runtime\/enemies\/fauna-family-v1\/wolves\/wolf-grey-wolf\/normal\.[a-f0-9]{12}\.webp$/u
	);
	const selectors = page.locator('.variant-selector').getByRole('button', {
		name: /approved image/iu
	});
	await expect(selectors).toHaveCount(4);

	await page.getByRole('button', { name: 'Water approved image' }).click();
	await expect(page.locator('.variant-stage img')).toHaveAttribute(
		'src',
		/water\.[a-f0-9]{12}\.webp$/u
	);
	await page.getByRole('button', { name: 'Fire approved image' }).click();
	await expect(page.locator('.variant-stage img')).toHaveAttribute(
		'src',
		/fire\.[a-f0-9]{12}\.webp$/u
	);
});

test('redirects the legacy Grey Wolf route to its canonical fauna form', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters/grey-wolf');
	await expect(page).toHaveURL(/\/wiki\/creatures\/monsters\/wolf-grey-wolf$/u);
	await expect(
		page.locator('.matrix').getByRole('heading', { name: 'Grey Wolf', exact: true })
	).toBeVisible();
});

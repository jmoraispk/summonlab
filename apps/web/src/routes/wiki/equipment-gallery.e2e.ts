import { expect, test } from '@playwright/test';

test('browses approved full sets, rank filters, individual pieces, and Greatsword artwork', async ({
	page
}) => {
	await page.goto('/wiki/mechanics/equipment', { waitUntil: 'networkidle' });
	const gallery = page.getByRole('region', { name: 'Equipment artwork' });
	await expect(gallery).toBeVisible();
	await expect(page.locator('main h1')).toHaveCount(1);
	await expect(gallery.locator('.equipment-card')).toHaveCount(21);
	await expect(
		gallery.getByRole('heading', { name: 'Bronze Heavy Armor · Complete Set', exact: true })
	).toBeVisible();
	await gallery.getByLabel('Rank', { exact: true }).selectOption('S');
	await expect(gallery.locator('.equipment-card')).toHaveCount(3);
	await gallery.getByLabel('Search equipment').fill('fateweave');
	await expect(gallery.locator('.equipment-card')).toHaveCount(1);
	await expect(
		gallery.getByRole('heading', { name: 'Fateweave Robes · Complete Set', exact: true })
	).toBeVisible();
	await gallery.getByRole('button', { name: 'Head', exact: true }).click();
	await expect(gallery.getByLabel('Search equipment')).toHaveValue('Fateweave Robes · Head');
	await expect(
		gallery.getByRole('heading', { name: 'Fateweave Robes · Head', exact: true })
	).toBeVisible();
	await gallery.getByRole('button', { name: 'Clear filters', exact: true }).click();
	await expect(gallery.locator('.equipment-card')).toHaveCount(24);
	await gallery.getByRole('button', { name: 'Next page', exact: true }).click();
	await expect(gallery.getByText('Page 2 of 7', { exact: true })).toBeVisible();
	await gallery.getByLabel('Search equipment').fill('greatsword');
	await expect(gallery.locator('.equipment-card')).toHaveCount(7);
	await expect(
		gallery.getByText('Approved artwork · gameplay integration pending', { exact: true })
	).toHaveCount(7);
	await expect(
		gallery.getByRole('link', { name: 'Original approved PNG' }).first()
	).toHaveAttribute('href', /assets\/equipment\/approved\/two-handed-greatsword-v1/);
	const images = gallery.locator('img');
	for (const image of await images.all()) {
		await image.scrollIntoViewIfNeeded();
		await expect(image).toHaveJSProperty('naturalWidth', 512);
	}
});

test('keeps equipment controls and cards inside a phone viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/wiki/mechanics/equipment', { waitUntil: 'networkidle' });
	const gallery = page.getByRole('region', { name: 'Equipment artwork' });
	await expect(gallery.locator('.equipment-card')).toHaveCount(21);
	await gallery.getByRole('button', { name: 'Individual items · 147', exact: true }).click();
	await expect(gallery.locator('.equipment-card')).toHaveCount(24);
	await expect
		.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
		.toBe(true);
});

test('reveals a selected set piece after browsing to the bottom on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/wiki/mechanics/equipment', { waitUntil: 'networkidle' });
	const gallery = page.getByRole('region', { name: 'Equipment artwork' });
	await gallery.getByRole('button', { name: 'Boots', exact: true }).last().click();
	await expect(
		gallery.getByRole('heading', { name: 'Fateweave Robes · Boots', exact: true })
	).toBeInViewport();
	await expect(gallery.locator('.result-count')).toBeFocused();
});

test('reveals the next equipment page from its first card on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/wiki/mechanics/equipment', { waitUntil: 'networkidle' });
	const gallery = page.getByRole('region', { name: 'Equipment artwork' });
	await gallery.getByRole('button', { name: 'Individual items · 147', exact: true }).click();
	await gallery.getByRole('button', { name: 'Next page', exact: true }).click();
	await expect(gallery.locator('.equipment-card').first()).toBeInViewport();
	await expect(gallery.locator('.result-count')).toBeFocused();
});

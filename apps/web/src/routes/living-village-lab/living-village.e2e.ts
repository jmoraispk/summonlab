import { expect, test } from '@playwright/test';

test('provides one comparison entry point for all Living Village screens', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	const response = await page.goto('/living-village-lab');

	expect(response?.ok()).toBe(true);
	await expect(page.getByRole('heading', { name: 'Living Village laboratory' })).toBeVisible();
	await expect(page.getByRole('link', { name: /Enter Village/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Open Summoning Portal/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Play Opening/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Test Tower Expedition/ })).toHaveAttribute(
		'href',
		'/living-village-lab/tower'
	);
	await expect(page.getByRole('link', { name: /Test Combat Motion/ })).toHaveAttribute(
		'href',
		'/living-village-lab/combat'
	);
});

test('keeps the comparison entry point usable at phone width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/living-village-lab');

	await expect(page.getByRole('heading', { name: 'Living Village laboratory' })).toBeVisible();
	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);
});

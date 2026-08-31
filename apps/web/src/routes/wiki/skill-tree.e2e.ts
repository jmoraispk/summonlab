import { expect, test } from '@playwright/test';

test('explores the skill taxonomy through universal and specialized branches', async ({ page }) => {
	await page.goto('/wiki/mechanics/skills');

	const tree = page.getByRole('region', { name: 'Interactive skill tree' });
	await expect(tree).toBeVisible();
	await expect(tree.getByRole('button', { name: /martial/i })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(tree.getByRole('heading', { name: 'Universal skills' })).toBeVisible();
	await expect(tree.getByText('Footing', { exact: true })).toBeVisible();
	await expect(tree.getByRole('heading', { name: 'Specialized families' })).toBeVisible();

	await tree.getByRole('button', { name: /magical/i }).click();
	await expect(tree.getByRole('img', { name: /magical domain/i })).toBeVisible();
	await expect(tree.getByText(/no supplied universal magical entries/i)).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Fire Evocation' })).toHaveAttribute(
		'href',
		'/wiki/mechanics/skills/magical-evocation#evocation-fire'
	);
	await expect(tree.getByRole('link', { name: 'Ward' })).toBeVisible();

	await tree.getByRole('button', { name: /craft/i }).click();
	await expect(tree.getByRole('img', { name: /craft domain/i })).toBeVisible();
	await expect(tree.getByText(/no supplied universal craft entries/i)).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Forging' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Lore' })).toBeVisible();
});

test('keeps the interactive skill tree within a narrow viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/wiki/mechanics/skills');

	await page.getByRole('region', { name: 'Interactive skill tree' }).scrollIntoViewIfNeeded();
	await expect(page.getByRole('button', { name: /martial/i })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

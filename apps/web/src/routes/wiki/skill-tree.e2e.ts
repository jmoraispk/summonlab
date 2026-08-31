import { expect, test } from '@playwright/test';

test('explores the skill taxonomy through family paths and optional labels', async ({ page }) => {
	await page.goto('/wiki/mechanics/skills');

	const tree = page.getByRole('region', { name: 'Interactive skill tree' });
	await expect(tree).toBeVisible();
	await expect(page.locator('main h1')).toHaveCount(1);
	await expect(page.locator('main h1')).toHaveText('Skills');
	await expect(tree.getByRole('button', { name: /martial/i })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(tree.getByRole('button', { name: /martial/i })).toContainText('5 families');
	await expect(tree.getByRole('heading', { name: 'Skill families' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Two Blades' })).toBeVisible();

	await expect(tree.getByRole('button', { name: /magical/i })).toContainText('5 families');
	await tree.getByRole('button', { name: /magical/i }).focus();
	await page.keyboard.press('Enter');
	await expect(tree.getByRole('button', { name: /magical/i })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(tree.getByRole('img', { name: /magical domain/i })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Fire' })).toHaveAttribute(
		'href',
		'/wiki/mechanics/skills/magical-elemental'
	);
	await expect(tree.getByRole('link', { name: 'Ward' })).toBeVisible();

	await expect(tree.getByRole('button', { name: /craft/i })).toContainText('6 families');
	await tree.getByRole('button', { name: /craft/i }).click();
	await expect(tree.getByRole('img', { name: /craft domain/i })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Forging' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Lore' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Source-integrity audit' })).toBeVisible();
});

test('honors reduced-motion preferences when switching domains', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/wiki/mechanics/skills');

	const tree = page.getByRole('region', { name: 'Interactive skill tree' });
	await tree.getByRole('button', { name: /magical/i }).click();
	await expect(tree.locator('.domain-stage')).toHaveCSS('animation-name', 'none');
});

test('keeps the interactive skill tree within a narrow viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/wiki/mechanics/skills');

	await page.getByRole('region', { name: 'Interactive skill tree' }).scrollIntoViewIfNeeded();
	await expect(page.getByRole('button', { name: /martial/i })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

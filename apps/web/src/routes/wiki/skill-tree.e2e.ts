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
	await expect(tree.getByRole('heading', { name: 'Blade' })).toBeVisible();
	await expect(tree.getByText('Family records', { exact: true })).toHaveCSS(
		'color',
		'rgb(170, 160, 142)'
	);
	await expect(tree.locator('.label-filter > span').first()).toHaveCSS(
		'color',
		'rgb(170, 160, 142)'
	);
	await expect(tree.getByRole('link', { name: 'Two Blades' })).toBeVisible();
	await expect(tree.getByText('Two Blades', { exact: true })).toHaveCount(1);
	await expect(tree.getByRole('link', { name: 'Pack Bond' })).toHaveAttribute(
		'href',
		'/wiki/mechanics/skills/martial-body'
	);
	await expect(tree.getByText(/universal skills/i)).toHaveCount(0);

	await tree.getByRole('button', { name: 'Sword', exact: true }).click();
	await expect(tree.getByRole('button', { name: 'Sword', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(tree.getByRole('link', { name: 'Two Blades' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Swordsmanship' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Blade Throw' })).toHaveCount(0);
	await expect(tree.getByRole('button', { name: /show all blade skills/i })).toBeVisible();
	await tree.getByRole('button', { name: /show all blade skills/i }).click();
	await expect(tree.getByRole('link', { name: 'Blade Throw' })).toBeVisible();

	await tree.getByRole('button', { name: 'Glaive', exact: true }).click();
	await expect(tree.getByRole('link', { name: 'Dragon Tail' })).toBeVisible();
	await tree.getByRole('button', { name: 'Sling', exact: true }).click();
	const rangedSkills = tree.getByRole('navigation', { name: 'Ranged representative skills' });
	await expect(rangedSkills.getByRole('link', { name: /^Sling/u })).toBeVisible();
	await expect(rangedSkills.getByRole('link', { name: 'Archery' })).toHaveCount(0);

	await expect(tree.getByRole('button', { name: /magical/i })).toContainText('5 families');
	await tree.getByRole('button', { name: /magical/i }).focus();
	await page.keyboard.press('Enter');
	await expect(tree.getByRole('button', { name: /magical/i })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(tree.getByRole('img', { name: /magical domain/i })).toBeVisible();
	await expect(tree.getByRole('heading', { name: 'Elemental' })).toBeVisible();
	await expect(tree.getByRole('button', { name: 'Fire' })).toBeVisible();
	await expect(tree.getByText('Neutral', { exact: true })).toHaveCount(0);
	await tree.getByRole('button', { name: 'Fire' }).click();
	await expect(tree.getByRole('link', { name: 'Ember' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Water Bullet' })).toHaveCount(0);
	await expect(tree.getByRole('link', { name: 'Warding' })).toBeVisible();
	await page.keyboard.press('Tab');
	await page.keyboard.press('Shift+Tab');
	await expect(tree.getByRole('button', { name: 'Fire' })).toBeFocused();
	await expect(tree.getByRole('button', { name: 'Fire' })).toHaveCSS('outline-style', 'solid');

	await expect(tree.getByRole('button', { name: /craft/i })).toContainText('5 families');
	await tree.getByRole('button', { name: /craft/i }).click();
	await expect(tree.getByRole('img', { name: /craft domain/i })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Forging' })).toBeVisible();
	await expect(tree.getByRole('heading', { name: 'Gathering' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Animal Handling' })).toHaveAttribute(
		'href',
		'/wiki/mechanics/skills/craft-and-life#gathering'
	);
	await expect(tree.getByRole('link', { name: 'Monarch of Beasts' })).toBeVisible();
	await expect(tree.getByRole('heading', { name: 'Knowledge' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Languages' })).toHaveAttribute(
		'href',
		'/wiki/mechanics/skills/craft-and-life#knowledge'
	);
	await expect(tree.getByRole('link', { name: 'Beast Speech' })).toHaveCount(0);
	await expect(tree.getByRole('link', { name: 'Beast', exact: true })).toHaveCount(0);
	await expect(tree.getByRole('link', { name: 'Lore', exact: true })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Source-integrity audit' })).toBeVisible();
	await expect(page.locator('article footer code')).toHaveText('mechanics/skills/README.md');
});

test('honors reduced-motion preferences when switching domains', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/wiki/mechanics/skills');

	const tree = page.getByRole('region', { name: 'Interactive skill tree' });
	await tree.getByRole('button', { name: /magical/i }).click();
	await expect(tree.locator('.domain-stage')).toHaveCSS('animation-name', 'none');

	const domainImage = tree.getByRole('img', { name: /magical domain/i });
	await domainImage.hover();
	await expect(domainImage).toHaveCSS('transform', 'none');

	const familyLink = tree.getByRole('link', { name: 'Elemental', exact: true });
	await familyLink.hover();
	await expect(familyLink.locator('span')).toHaveCSS('transform', 'none');
});

test('keeps the interactive skill tree within a narrow viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/wiki/mechanics/skills');

	await page.getByRole('region', { name: 'Interactive skill tree' }).scrollIntoViewIfNeeded();
	await expect(page.getByRole('button', { name: /martial/i })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

import { expect, test } from '@playwright/test';

test('opens one domain path at a time and preserves family label filters', async ({ page }) => {
	await page.goto('/wiki/mechanics/skills');

	const tree = page.getByRole('region', { name: 'Interactive skill tree' });
	const martial = tree.getByRole('button', { name: /Martial.*5 families/i });
	const magic = tree.getByRole('button', { name: /Magic.*5 families/i });
	const craft = tree.getByRole('button', { name: /Craft.*5 families/i });

	await expect(tree).toBeVisible();
	await expect(page.locator('main h1')).toHaveCount(1);
	await expect(page.locator('main h1')).toHaveText('Skills');
	await expect(tree.getByText('Skills', { exact: true })).toBeVisible();
	await expect(martial).toHaveAttribute('aria-expanded', 'false');
	await expect(magic).toHaveAttribute('aria-expanded', 'false');
	await expect(craft).toHaveAttribute('aria-expanded', 'false');
	await expect(tree.locator('.domain-branch')).toHaveCount(0);

	await martial.click();
	await expect(tree.locator('.domain-branch')).toHaveCount(1);
	await expect(tree.getByRole('heading', { name: 'Blade' })).toBeVisible();
	await expect(martial).toHaveAttribute('aria-expanded', 'true');

	await martial.click();
	await expect(tree.locator('.domain-branch')).toHaveCount(0);
	await expect(martial).toHaveAttribute('aria-expanded', 'false');

	await magic.focus();
	await page.keyboard.press('Enter');
	await expect(tree.getByRole('heading', { name: 'Elemental' })).toBeVisible();
	await expect(magic).toHaveAttribute('aria-expanded', 'true');

	await craft.click();
	await expect(magic).toHaveAttribute('aria-expanded', 'false');
	await expect(craft).toHaveAttribute('aria-expanded', 'true');
	await expect(tree.locator('.domain-branch')).toHaveCount(1);
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

	await magic.click();
	await tree.getByRole('button', { name: 'Wind', exact: true }).click();
	await expect(
		tree.getByText('The Wind skill ladder is not published yet.', { exact: true })
	).toBeVisible();
	await expect(
		tree.getByRole('navigation', { name: 'Elemental representative skills' })
	).toHaveCount(0);

	await martial.click();
	await tree.getByRole('button', { name: 'Sword', exact: true }).click();
	await expect(tree.getByRole('button', { name: 'Sword', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(tree.getByRole('link', { name: 'Two Blades' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Swordsmanship' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Blade Throw' })).toHaveCount(0);
	await martial.click();
	await martial.click();
	await expect(tree.getByRole('button', { name: 'Sword', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(tree.getByRole('button', { name: /show all blade skills/i })).toBeVisible();
	await tree.getByRole('button', { name: /show all blade skills/i }).click();
	await expect(tree.getByRole('link', { name: 'Blade Throw' })).toBeVisible();

	await tree.getByRole('button', { name: 'Glaive', exact: true }).click();
	await expect(tree.getByRole('link', { name: 'Dragon Tail' })).toBeVisible();
	await tree.getByRole('button', { name: 'Sling', exact: true }).click();
	const rangedSkills = tree.getByRole('navigation', { name: 'Ranged representative skills' });
	await expect(rangedSkills.getByRole('link', { name: /^Sling/u })).toBeVisible();
	await expect(rangedSkills.getByRole('link', { name: 'Archery' })).toHaveCount(0);

	await magic.click();
	await tree.getByRole('button', { name: 'Fire' }).click();
	await expect(tree.getByRole('link', { name: 'Ember' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Water Bullet' })).toHaveCount(0);
	await expect(tree.getByRole('link', { name: 'Warding' })).toBeVisible();
	await page.keyboard.press('Tab');
	await page.keyboard.press('Shift+Tab');
	await expect(tree.getByRole('button', { name: 'Fire' })).toBeFocused();
	await expect(tree.getByRole('button', { name: 'Fire' })).toHaveCSS('outline-style', 'solid');

	await expect(page.getByRole('heading', { name: 'Source-integrity audit' })).toBeVisible();
	await expect(page.locator('article footer code')).toHaveText('mechanics/skills/README.md');
});

test('honors reduced-motion preferences when switching domains', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/wiki/mechanics/skills');

	const tree = page.getByRole('region', { name: 'Interactive skill tree' });
	const magic = tree.getByRole('button', { name: /Magic.*5 families/i });
	await magic.click();
	await expect(tree.locator('.domain-branch')).toHaveCSS('animation-name', 'none');
	expect(await magic.evaluate((button) => getComputedStyle(button, '::after').transform)).toBe(
		'none'
	);

	const domainImage = tree.locator('.domain-node-image').nth(1);
	await domainImage.hover();
	await expect(domainImage).toHaveCSS('transform', 'none');

	const familyLink = tree.getByRole('link', { name: 'Elemental', exact: true });
	await familyLink.hover();
	await expect(familyLink.locator('span')).toHaveCSS('transform', 'none');
});

test('keeps all circular domain roots side by side within a narrow viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/wiki/mechanics/skills');

	const tree = page.getByRole('region', { name: 'Interactive skill tree' });
	await tree.scrollIntoViewIfNeeded();
	await expect(tree.getByRole('button', { name: /Martial.*5 families/i })).toBeVisible();
	await expect(tree.getByRole('button', { name: /Magic.*5 families/i })).toBeVisible();
	await expect(tree.getByRole('button', { name: /Craft.*5 families/i })).toBeVisible();

	const imageWrappers = tree.locator('.domain-node-image');
	await expect(imageWrappers).toHaveCount(3);
	for (let index = 0; index < 3; index += 1) {
		const box = await imageWrappers.nth(index).boundingBox();
		expect(box).not.toBeNull();
		expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThanOrEqual(1);
	}

	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

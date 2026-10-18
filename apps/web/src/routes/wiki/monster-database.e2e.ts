import { expect, test } from '@playwright/test';

test('leads the bestiary with the selected families', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters');
	await expect(page.locator('.database .family').first()).toHaveAttribute('id', 'database-giants');
	await expect(
		page.getByRole('navigation', { name: 'Monster families' }).getByRole('link').nth(2)
	).toHaveText('Trolls');
});

for (const width of [1440, 390]) {
	test(`zooms full-resolution monster artwork and restores keyboard focus at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		let originalsRequested = 0;
		await page.route(
			'https://media.githubusercontent.com/media/jmoraispk/summonlab/main/assets/enemies/**',
			async (route) => {
				originalsRequested++;
				await route.fulfill({
					path: '../../assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-brute/normal-v1.png',
					contentType: 'image/png'
				});
			}
		);
		await page.goto('/wiki/creatures/monsters', { waitUntil: 'networkidle' });
		expect(originalsRequested).toBe(0);
		const trigger = page
			.locator('#database-giants')
			.getByRole('button', { name: /Enlarge Brute, Normal affinity/iu });
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: 'Brute, Normal affinity' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('img')).toHaveJSProperty('naturalWidth', 1122);
		expect(originalsRequested).toBe(1);
		await expect(dialog.getByRole('img')).toHaveAttribute(
			'src',
			/media\.githubusercontent\.com.*giant-brute\/normal-v1\.png$/u
		);
		const before = await dialog.getByRole('img').boundingBox();
		await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
		await expect(dialog.getByRole('status')).toHaveText('150%');
		const after = await dialog.getByRole('img').boundingBox();
		expect(after!.width).toBeGreaterThan(before!.width);
		for (let step = 0; step < 5; step++) {
			await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
		}
		await expect(dialog.getByRole('status')).toHaveText('400%');
		expect(
			await dialog
				.getByRole('region')
				.evaluate((element) =>
					Math.abs(element.scrollLeft - (element.scrollWidth - element.clientWidth) / 2)
				)
		).toBeLessThanOrEqual(5);
		await dialog.getByRole('button', { name: 'Fit image' }).click();
		await expect(dialog.getByRole('status')).toHaveText('100%');
		expect(
			await dialog.evaluate((element) => element.getBoundingClientRect().right <= innerWidth)
		).toBe(true);
		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();
		await expect(trigger).toBeFocused();
		await trigger.press('Enter');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Close image' }).click();
		await expect(trigger).toBeFocused();
		await expect(
			page.locator('#database-giants .monster-card').first().getByRole('link')
		).toHaveAttribute('href', '/wiki/creatures/monsters/giant-brute');
	});
}

for (const width of [1440, 390]) {
	test(`browses the bestiary gallery while preserving zoom controls and opener focus at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.route('https://media.githubusercontent.com/**', (route) => route.abort());
		await page.goto('/wiki/creatures/monsters', { waitUntil: 'networkidle' });
		const triggers = page.getByRole('button', { name: /^Enlarge /u });
		const opener = triggers.first();
		const secondName = (await triggers.nth(1).getAttribute('aria-label'))!.replace('Enlarge ', '');
		const nextFamilyName = (await triggers.nth(5).getAttribute('aria-label'))!.replace(
			'Enlarge ',
			''
		);
		await expect(opener).not.toContainText('Zoom');
		await opener.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('button', { name: 'Previous image' })).toBeDisabled();
		await expect(dialog.getByText('1 / 190', { exact: true })).toBeVisible();
		const next = dialog.getByRole('button', { name: 'Next image' });
		const box = await next.boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
		await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
		await next.click();
		await expect(dialog).toHaveAttribute('aria-label', secondName);
		await expect(dialog.getByRole('img')).toHaveAttribute('alt', secondName);
		await expect(dialog.getByRole('status')).toHaveText('100%');
		await expect(dialog.getByText('2 / 190', { exact: true })).toBeVisible();
		await expect(dialog).toContainText('Original image unavailable');
		expect(
			await dialog.getByRole('region').evaluate((area) => area.scrollLeft + area.scrollTop)
		).toBe(0);
		await next.press('ArrowLeft');
		await expect(dialog.getByText('1 / 190', { exact: true })).toBeVisible();
		await next.press('ArrowRight');
		await expect(dialog.getByText('2 / 190', { exact: true })).toBeVisible();
		await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
		const viewport = dialog.getByRole('region');
		await viewport.focus();
		await viewport.press('ArrowRight');
		await expect(dialog.getByText('2 / 190', { exact: true })).toBeVisible();
		await expect.poll(() => viewport.evaluate((area) => area.scrollLeft)).toBeGreaterThan(0);
		for (let step = 0; step < 4; step++) await next.click();
		await expect(dialog).toHaveAttribute('aria-label', nextFamilyName);
		await expect(dialog.getByText('6 / 190', { exact: true })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(opener).toBeFocused();
		await triggers.last().click();
		await expect(dialog.getByText('190 / 190', { exact: true })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Next image' })).toBeDisabled();
		await dialog.getByRole('button', { name: 'Close image' }).click();
		await expect(triggers.last()).toBeFocused();
	});
}

for (const width of [1440, 390]) {
	test(`centers simplified image controls and dismisses only outside artwork at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.route('https://media.githubusercontent.com/**', (route) =>
			route.fulfill({
				path: '../../assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-brute/normal-v1.png',
				contentType: 'image/png'
			})
		);
		await page.goto('/wiki/creatures/monsters', { waitUntil: 'networkidle' });
		const opener = page.getByRole('button', { name: /^Enlarge /u }).first();
		await opener.click();
		const dialog = page.getByRole('dialog');
		const image = dialog.getByRole('img');
		await expect(image).toHaveJSProperty('naturalWidth', 1122);
		await expect(dialog.getByRole('link', { name: 'Open original image' })).toHaveCount(0);
		await expect(dialog).not.toContainText('Zoom in, then scroll to inspect details');
		const bounds = await dialog.boundingBox();
		const zoomOut = await dialog.getByRole('button', { name: 'Zoom out' }).boundingBox();
		const fit = await dialog.getByRole('button', { name: 'Fit image' }).boundingBox();
		expect(
			Math.abs((zoomOut!.x + fit!.x + fit!.width) / 2 - (bounds!.x + bounds!.width / 2))
		).toBeLessThanOrEqual(2);
		await image.click();
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
		await expect(dialog.getByRole('status')).toHaveText('150%');
		await dialog.getByRole('button', { name: 'Fit image' }).click();
		await dialog.getByRole('button', { name: 'Next image' }).click();
		await expect(dialog.getByText('2 / 190', { exact: true })).toBeVisible();
		const viewport = dialog.getByRole('region');
		const area = await viewport.boundingBox();
		const center = { x: area!.x + area!.width / 2, y: area!.y + area!.height / 2 };
		// Ending an artwork drag in the backdrop must not dismiss the image.
		await page.mouse.move(center.x, center.y);
		await page.mouse.down();
		await page.mouse.move(1, 1);
		await page.mouse.up();
		await expect(dialog).toBeVisible();
		await page.mouse.click(1, 1);
		await expect(dialog).not.toBeVisible();
		await expect(opener).toBeFocused();
		await opener.press('Enter');
		await expect(image).toHaveJSProperty('naturalWidth', 1122);
		// The square source leaves empty space in the wide desktop and tall phone viewport.
		const reopenedArea = await viewport.boundingBox();
		await page.mouse.click(reopenedArea!.x + 2, reopenedArea!.y + 2);
		await expect(dialog).not.toBeVisible();
		await expect(opener).toBeFocused();
	});
}

test('keeps family browsing in the selected affinity and form browsing in displayed affinity order', async ({
	page
}) => {
	await page.route('https://media.githubusercontent.com/**', (route) =>
		route.fulfill({
			path: '../../assets/enemies/experiments/family-affinity-v1/candidates/giants/giant-brute/normal-v1.png',
			contentType: 'image/png'
		})
	);
	await page.goto('/wiki/creatures/monsters/families/goblins', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Show Fire affinity' }).click();
	const familyTriggers = page.locator('.family-atlas').getByRole('button', { name: /^Enlarge /u });
	const secondName = (await familyTriggers.nth(1).getAttribute('aria-label'))!.replace(
		'Enlarge ',
		''
	);
	await familyTriggers.first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText('1 / 5', { exact: true })).toBeVisible();
	await dialog.getByRole('button', { name: 'Next image' }).click();
	await expect(dialog).toHaveAttribute('aria-label', secondName);
	await expect(dialog.getByRole('img')).toHaveAttribute('alt', /Fire affinity$/u);
	await expect(dialog.getByRole('img')).toHaveAttribute('src', /fire-v1\.png$/u);
	await dialog.getByRole('button', { name: 'Close image' }).click();
	await expect(familyTriggers.first()).toBeFocused();
	await page.goto('/wiki/creatures/monsters/goblin-runt', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Enlarge Runt, Fire affinity' }).click();
	await expect(dialog.getByText('2 / 5', { exact: true })).toBeVisible();
	await dialog.getByRole('button', { name: 'Next image' }).click();
	await expect(dialog).toHaveAttribute('aria-label', 'Runt, Earth affinity');
	await expect(dialog.getByRole('img')).toHaveAttribute('src', /earth-v1\.png$/u);
	await dialog.getByRole('button', { name: 'Previous image' }).click();
	await expect(dialog).toHaveAttribute('aria-label', 'Runt, Fire affinity');
});

test('enlarges the selected affinity in family and form views, with a preview fallback', async ({
	page
}) => {
	await page.route('https://media.githubusercontent.com/**', (route) => route.abort());
	await page.goto('/wiki/creatures/monsters/families/goblins', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Show Fire affinity' }).click();
	await page.getByRole('button', { name: 'Enlarge Runt, Fire affinity' }).click();
	const dialog = page.getByRole('dialog', { name: 'Runt, Fire affinity' });
	await expect(dialog.getByRole('img')).toHaveAttribute('src', /\/fire\.[a-f0-9]{12}\.webp$/u);
	await expect(dialog).toContainText('Original image unavailable');
	await dialog.getByRole('button', { name: 'Close image' }).click();
	await page.goto('/wiki/creatures/monsters/goblin-runt', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Enlarge Runt, Water affinity' }).click();
	await expect(page.getByRole('dialog', { name: 'Runt, Water affinity' })).toBeVisible();
});

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
	await expect(page.locator('#database-goblins .monster-card').first()).toContainText(
		'Mob Harrier'
	);
	await expect(page.locator('#database-goblins .monster-card').first()).toContainText('Mob Nerve');
	await expect(page.locator('#database-goblins .monster-card').last()).toContainText('T5');
	await expect(page.locator('#database-goblins')).toContainText('Scrap becomes treasure');
	await expect(page.getByRole('heading', { name: 'Current class reconciliation' })).toHaveCount(0);
});

test('applies one selected affinity to all five Goblin tiers', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/wiki/creatures/monsters/families/goblins');

	await expect(
		page.locator('.monster-family').getByRole('heading', { name: 'Goblins' })
	).toBeVisible();
	await expect(page.locator('.family-atlas img')).toHaveCount(5);
	await expect(page.locator('.affinity-controls button')).toHaveCount(5);
	await expect(page.locator('.family-progression tbody tr')).toHaveCount(5);
	for (const image of await page.locator('.family-atlas img').all()) {
		await expect(image).toHaveAttribute('alt', /Normal affinity/iu);
	}

	await page.getByRole('button', { name: 'Show Fire affinity' }).click();
	for (const image of await page.locator('.family-atlas img').all()) {
		await expect(image).toHaveAttribute('alt', /Fire affinity/iu);
	}
	await expect(page.locator('.family-atlas img').first()).toHaveAttribute(
		'src',
		/runtime\/enemies\/monster-wiki-v1\/goblins\/goblin-runt\/fire\.[a-f0-9]{12}\.webp$/u
	);
	await expect(page.getByRole('button', { name: 'Show Fire affinity' })).toHaveAttribute(
		'aria-pressed',
		'true'
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
	await page.goto('/wiki/creatures/monsters/wolf-gray-wolf');

	await expect(
		page.locator('.matrix').getByRole('heading', { name: 'Gray Wolf', exact: true })
	).toBeVisible();
	await expect(page.locator('.matrix img')).toHaveCount(5);
	await expect(page.locator('.matrix')).toContainText('runtime');
	await expect(page.locator('.matrix img').first()).toHaveAttribute(
		'src',
		/runtime\/enemies\/fauna-family-v1\/wolves\/wolf-gray-wolf\/normal\.[a-f0-9]{12}\.webp$/u
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

test('redirects the legacy Gray Wolf route to its canonical fauna form', async ({ page }) => {
	await page.goto('/wiki/creatures/monsters/gray-wolf');
	await expect(page).toHaveURL(/\/wiki\/creatures\/monsters\/wolf-gray-wolf$/u);
	await expect(
		page.locator('.matrix').getByRole('heading', { name: 'Gray Wolf', exact: true })
	).toBeVisible();
});

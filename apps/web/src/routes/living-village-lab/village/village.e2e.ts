import { expect, test } from '@playwright/test';

test('unifies Village hotspots, resident inspection, orders, and camera controls', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	const apiRequests: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
	});

	const response = await page.goto('/living-village-lab/village');
	expect(response?.ok()).toBe(true);
	await expect(page.getByRole('heading', { name: 'Hearth 01' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'All prototype screens' })).toHaveAttribute(
		'href',
		'/living-village-lab'
	);
	await expect(page.getByLabel('Village status').locator('article')).toHaveCount(5);

	const viewport = page.getByTestId('village-viewport');
	await expect(viewport).toBeVisible();
	expect((await viewport.boundingBox())!.y).toBeLessThan(160);
	await expect(viewport.locator('.hero-marker')).toHaveCount(6);
	await expect(viewport.locator('.hero-marker span')).toHaveCount(0);
	await expect(viewport.locator('.facility-panel')).toHaveCount(0);
	await expect(viewport.locator('.map-key')).toHaveCount(0);
	await expect(page.getByText('Drag to pan', { exact: false })).toHaveCount(0);
	const firstHeroMarker = viewport.locator('.hero-marker').first();
	const firstHeroBounds = await firstHeroMarker.boundingBox();
	expect(firstHeroBounds!.height).toBeGreaterThanOrEqual(100);
	await expect
		.poll(() => firstHeroMarker.evaluate((element) => getComputedStyle(element).backgroundColor))
		.toBe('rgba(0, 0, 0, 0)');
	await expect(viewport.locator('.hero-marker[data-availability="available"]')).toHaveCount(6);
	await expect
		.poll(() => firstHeroMarker.locator('img').evaluate((image) => getComputedStyle(image).filter))
		.not.toBe('none');
	await expect
		.poll(() =>
			firstHeroMarker.locator('img').evaluate((image: HTMLImageElement) => {
				const canvas = document.createElement('canvas');
				canvas.width = image.naturalWidth;
				canvas.height = image.naturalHeight;
				canvas.getContext('2d')!.drawImage(image, 0, 0);
				return canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data[3];
			})
		)
		.toBe(0);
	await expect(viewport.locator('.facility-hotspot')).toHaveCount(6);
	const gateHotspot = page.getByRole('link', { name: 'Enter Summoning Gate' });
	await expect(gateHotspot).toHaveAttribute('href', '/living-village-lab/summon');
	await expect(gateHotspot).toHaveAttribute('draggable', 'false');
	await expect
		.poll(() => gateHotspot.evaluate((element) => getComputedStyle(element).borderTopColor))
		.toBe('rgba(0, 0, 0, 0)');
	await gateHotspot.hover();
	await expect
		.poll(() => gateHotspot.evaluate((element) => getComputedStyle(element).borderTopColor))
		.not.toBe('rgba(0, 0, 0, 0)');
	await expect
		.poll(() =>
			viewport
				.locator('img.environment')
				.evaluate((image: HTMLImageElement) => `${image.naturalWidth}x${image.naturalHeight}`)
		)
		.toBe('1536x1024');
	await expect(viewport.locator('img.environment')).toHaveAttribute('draggable', 'false');

	const courtHotspot = page.getByRole('button', { name: 'Inspect Training Grounds' });
	const towerHotspot = page.getByRole('link', { name: 'Enter Tower Threshold' });
	await expect(towerHotspot).toHaveAttribute('href', '/living-village-lab/tower');
	const kitchenHotspot = page.getByRole('button', { name: 'Inspect Village Kitchen' });
	const forgeHotspot = page.getByRole('button', { name: 'Inspect Village Forge' });
	const dormitoryHotspot = page.getByRole('button', { name: 'Inspect Village Dormitory' });
	for (const hotspot of [
		gateHotspot,
		courtHotspot,
		towerHotspot,
		kitchenHotspot,
		forgeHotspot,
		dormitoryHotspot
	]) {
		const label = hotspot.locator('span');
		const labelBounds = await label.boundingBox();
		const dotBounds = await hotspot.locator('i').boundingBox();
		const textBounds = await hotspot.locator('strong').boundingBox();
		await expect
			.poll(() => hotspot.evaluate((element) => getComputedStyle(element).borderTopLeftRadius))
			.toBe('6%');
		expect(
			await label.evaluate((element) => parseFloat(getComputedStyle(element).borderTopLeftRadius))
		).toBeGreaterThan(5);
		expect(labelBounds!.width - dotBounds!.width - textBounds!.width).toBeLessThan(32);
		expect(
			Math.abs(dotBounds!.y + dotBounds!.height / 2 - (textBounds!.y + textBounds!.height / 2))
		).toBeLessThan(1);
	}
	for (const hotspot of [gateHotspot, towerHotspot]) {
		expect((await hotspot.locator('span').boundingBox())!.width).toBeLessThan(80);
	}
	for (const hotspot of [courtHotspot, towerHotspot, forgeHotspot]) {
		const hotspotBounds = await hotspot.boundingBox();
		const labelBounds = await hotspot.locator('span').boundingBox();
		expect(
			Math.abs(
				labelBounds!.x + labelBounds!.width / 2 - (hotspotBounds!.x + hotspotBounds!.width / 2)
			)
		).toBeLessThan(2);
		expect(Math.abs(labelBounds!.y + labelBounds!.height / 2 - hotspotBounds!.y)).toBeLessThan(2);
	}
	for (const hotspot of [gateHotspot, kitchenHotspot, dormitoryHotspot]) {
		const hotspotBounds = await hotspot.boundingBox();
		const labelBounds = await hotspot.locator('span').boundingBox();
		expect(
			Math.abs(
				labelBounds!.x + labelBounds!.width / 2 - (hotspotBounds!.x + hotspotBounds!.width / 2)
			)
		).toBeLessThan(2);
		expect(
			Math.abs(
				labelBounds!.y + labelBounds!.height / 2 - (hotspotBounds!.y + hotspotBounds!.height)
			)
		).toBeLessThan(2);
	}
	const gateBounds = await gateHotspot.boundingBox();
	const towerBounds = await towerHotspot.boundingBox();
	expect(gateBounds!.height).toBeGreaterThan(towerBounds!.height);
	expect(towerBounds!.height).toBeGreaterThan(180);
	const courtBounds = await courtHotspot.boundingBox();
	await page.mouse.move(
		courtBounds!.x + courtBounds!.width * 0.5,
		courtBounds!.y + courtBounds!.height * 0.5
	);
	await page.mouse.down();
	await page.mouse.move(
		courtBounds!.x + courtBounds!.width * 0.32,
		courtBounds!.y + courtBounds!.height * 0.5,
		{ steps: 4 }
	);
	await page.mouse.up();
	await expect.poll(() => viewport.getAttribute('data-offset-x')).not.toBe('0');
	await expect(courtHotspot).toHaveAttribute('aria-pressed', 'false');
	await page.getByRole('button', { name: 'Fit Village' }).click();
	await expect(viewport).toHaveAttribute('data-offset-x', '0');

	for (const facility of [
		'Training Grounds',
		'Village Kitchen',
		'Village Forge',
		'Village Dormitory'
	] as const) {
		const hotspot = page.getByRole('button', { name: `Inspect ${facility}` });
		await hotspot.click();
		await expect(hotspot).toHaveAttribute('aria-pressed', 'true');
	}

	await page.getByRole('button', { name: /Inspect Dara Zev/ }).click();
	const popover = page.getByTestId('hero-popover');
	await expect(popover).toContainText('Dara Zev');
	await expect(popover).toContainText('Level 8');
	await expect(popover).toContainText('146 / 160');
	await expect(popover).toContainText('Party I · Vanguard');
	await popover.getByRole('button', { name: 'Details' }).click();
	const heroDrawer = page.getByTestId('hero-drawer');
	await expect(heroDrawer).toContainText('Shield line');
	await expect(heroDrawer).toContainText('Ashwood shield');
	await expect(heroDrawer.locator('.attributes span')).toHaveText(['STR', 'AGI', 'VIT', 'MAG']);
	await expect(heroDrawer).not.toContainText('Guard');
	await expect(heroDrawer).not.toContainText('Focus');
	await page.getByRole('button', { name: 'Close hero details' }).click();

	await popover.getByRole('button', { name: 'Court training' }).click();
	await expect(popover).toHaveCount(0);
	await expect(courtHotspot).toHaveAttribute('aria-pressed', 'true');
	await expect(firstHeroMarker).toHaveAttribute('data-availability', 'busy');
	await expect
		.poll(() => firstHeroMarker.locator('img').evaluate((image) => getComputedStyle(image).filter))
		.toBe('none');

	await page
		.getByLabel('Find a resident')
		.getByRole('button', { name: /Mara Vey/ })
		.click();
	await expect(page.locator('#village-hero-mara-vey')).toBeFocused();
	await expect(popover).toContainText('Mara Vey');
	await popover.getByRole('button', { name: 'Tower hunt' }).click();
	await popover.getByRole('button', { name: 'Stoneback boar' }).click();
	await expect(popover).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Enter Tower Threshold' })).toHaveAttribute(
		'aria-current',
		'location'
	);

	await page
		.getByLabel('Find a resident')
		.getByRole('button', { name: /Jori Daro/ })
		.click();
	const joriMarker = page.locator('#village-hero-jori-daro');
	await expect(popover).toContainText('Jori Daro');
	await popover.getByRole('button', { name: 'Rest' }).click();
	await expect(popover).toHaveCount(0);
	await expect(dormitoryHotspot).toHaveAttribute('aria-pressed', 'true');
	await expect(joriMarker).toHaveAttribute('aria-label', /Resting in the Dormitory/);
	await expect(joriMarker).toHaveAttribute('data-availability', 'busy');
	await expect(joriMarker.locator('xpath=..')).toHaveAttribute('style', /--x:\s*34%;\s*--y:\s*76%/);

	await page.getByRole('button', { name: 'Zoom in' }).click();
	await expect(viewport).toHaveAttribute('data-zoom-percent', '190');
	for (let index = 0; index < 8; index += 1) {
		await page.getByRole('button', { name: 'Zoom in' }).click();
	}
	await expect(viewport).toHaveAttribute('data-zoom-percent', '300');
	const zoomedHeroBounds = await firstHeroMarker.boundingBox();
	expect(zoomedHeroBounds!.height).toBeGreaterThan(firstHeroBounds!.height * 1.5);
	expect(zoomedHeroBounds!.height).toBeLessThan(firstHeroBounds!.height * 2);

	const beforeDragX = await viewport.getAttribute('data-offset-x');
	const beforeDragY = await viewport.getAttribute('data-offset-y');
	const box = await viewport.boundingBox();
	expect(box).not.toBeNull();
	await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.45);
	await page.mouse.down();
	await page.mouse.move(box!.x + box!.width * 0.58, box!.y + box!.height * 0.56, { steps: 6 });
	await page.mouse.up();
	await expect.poll(() => viewport.getAttribute('data-offset-x')).not.toBe(beforeDragX);
	await expect.poll(() => viewport.getAttribute('data-offset-y')).not.toBe(beforeDragY);
	const afterFirstDragX = await viewport.getAttribute('data-offset-x');
	const afterFirstDragY = await viewport.getAttribute('data-offset-y');
	await page.mouse.move(box!.x + box!.width * 0.62, box!.y + box!.height * 0.58);
	await page.mouse.down();
	await page.mouse.move(box!.x + box!.width * 0.52, box!.y + box!.height * 0.49, { steps: 6 });
	await page.mouse.up();
	await expect.poll(() => viewport.getAttribute('data-offset-x')).not.toBe(afterFirstDragX);
	await expect.poll(() => viewport.getAttribute('data-offset-y')).not.toBe(afterFirstDragY);

	await page.getByRole('button', { name: 'Fit Village' }).click();
	await expect(viewport).toHaveAttribute('data-zoom-percent', '100');
	await expect(viewport).toHaveAttribute('data-offset-x', '0');
	await expect(page.getByRole('button', { name: 'Inspect Village Dormitory' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await viewport.focus();
	await page.keyboard.press('+');
	await expect(viewport).toHaveAttribute('data-zoom-percent', '120');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('0');
	await expect(viewport).toHaveAttribute('data-zoom-percent', '100');
	await page.keyboard.press('Home');
	await expect(gateHotspot).toHaveClass(/selected/);

	await viewport.hover();
	await page.mouse.wheel(0, -200);
	await expect
		.poll(async () => Number(await viewport.getAttribute('data-zoom-percent')))
		.toBeGreaterThan(100);

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect
		.poll(() =>
			viewport
				.locator('.hero-anchor')
				.first()
				.evaluate((element) => getComputedStyle(element).transitionDuration)
		)
		.toBe('0s');

	expect(apiRequests).toEqual([]);
	await page.getByRole('button', { name: /Inspect Jori Daro/ }).click();
	await expect(page.getByTestId('hero-popover')).toContainText('Jori Daro');
	if (process.env.CAPTURE_LV_DESKTOP) {
		await page.screenshot({
			path: process.env.CAPTURE_LV_DESKTOP,
			fullPage: true,
			style: '.skip-link { display: none !important; }'
		});
	}

	// A half-width CSS viewport exercises the reflow produced by 200% desktop browser zoom.
	await page.setViewportSize({ width: 720, height: 500 });
	await page.goto('/living-village-lab/village');
	await page
		.getByLabel('Find a resident')
		.getByRole('button', { name: /Kira Toren/ })
		.click();
	await expect(page.getByTestId('hero-popover')).toContainText('Kira Toren');
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
	).toBeLessThanOrEqual(0);

	await page.goto('/living-village-lab/village');
	await Promise.all([page.waitForURL('**/living-village-lab/summon'), gateHotspot.click()]);
	await expect(page).toHaveTitle(/Summoning Portal/);
});

test('keeps the unified Village deliberate and operable at 390 by 844', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/living-village-lab/village');

	await expect(page.getByLabel('Village status').locator('article')).toHaveCount(5);
	await expect(page.getByLabel('Find a resident').getByRole('button')).toHaveCount(6);
	const phoneViewport = page.getByTestId('village-viewport');
	await expect(phoneViewport.locator('.facility-hotspot')).toHaveCount(6);
	expect((await phoneViewport.boundingBox())!.y).toBeLessThan(240);

	await page
		.getByLabel('Find a resident')
		.getByRole('button', { name: /Remy Nahl/ })
		.click();
	await expect(page.getByTestId('hero-popover')).toContainText('Remy Nahl');
	await expect(
		page.getByTestId('hero-popover').getByRole('button', { name: 'Rest' })
	).toBeVisible();
	await page.getByTestId('hero-popover').getByRole('button', { name: 'Details' }).click();
	const heroDrawer = page.getByTestId('hero-drawer');
	await expect(heroDrawer).toContainText('Field notes');
	expect(
		(
			await heroDrawer
				.locator('.attributes')
				.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
		).split(' ')
	).toHaveLength(2);

	for (const label of ['Zoom out', 'Zoom in', 'Fit Village', 'Reset View']) {
		const control = page.getByRole('button', { name: label });
		const bounds = await control.boundingBox();
		expect(bounds?.height).toBeGreaterThanOrEqual(44);
	}

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);

	await page.getByRole('button', { name: 'Close hero details' }).click();
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await page.getByRole('button', { name: 'Fit Village' }).click();
	await page.getByRole('button', { name: 'Reset View' }).click();
	await expect(phoneViewport).toHaveAttribute('data-zoom-percent', '100');

	if (process.env.CAPTURE_LV_PHONE) {
		await page.screenshot({
			path: process.env.CAPTURE_LV_PHONE,
			fullPage: true,
			style: '.skip-link { display: none !important; }'
		});
	}
});

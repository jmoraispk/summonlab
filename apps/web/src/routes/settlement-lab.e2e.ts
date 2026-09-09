import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('inspects all five Hearth 01 interiors and deterministic access-aware routes', async ({
	page
}) => {
	await page.goto('/settlement-lab');

	await expect(page.getByRole('heading', { name: /A small refuge/ })).toBeVisible();
	await expect(page.getByText('83e2d404fa3e119b')).toBeVisible();
	const routeBudget = page.getByTestId('settlement-route-budget');
	await expect(routeBudget).toContainText(/\d+\.\d KB route JS/);
	const routeBudgetText = (await routeBudget.textContent()) ?? '';
	const routeKilobytes = Number(routeBudgetText.match(/(\d+\.\d) KB route JS/)?.[1]);
	expect(routeKilobytes).toBeLessThanOrEqual(700);
	await expect(page.getByText('4dea1551545f6820')).toBeVisible();
	await expect(page.getByText('447.4 KB WebP')).toBeVisible();
	const paintedScene = page.getByTestId('painted-settlement-scene');
	await expect(paintedScene).toBeVisible();
	await expect(paintedScene.locator('[data-layer-kind]')).toHaveCount(6);
	await expect(paintedScene.locator('.scene-hotspot')).toHaveCount(5);
	await expect(paintedScene.getByRole('button')).toHaveCount(4);
	await expect(
		paintedScene.getByRole('link', { name: 'Open Tower mode through Tower Portal' })
	).toBeVisible();
	await expect
		.poll(() =>
			paintedScene
				.locator('img.environment-base')
				.evaluate((image: HTMLImageElement) => `${image.naturalWidth}x${image.naturalHeight}`)
		)
		.toBe('1536x1024');

	await page.getByRole('button', { name: 'Inspect Forge in painted settlement' }).click();
	await expect(page.getByRole('heading', { name: 'Dormant Workshop' })).toBeVisible();
	await expect(page.locator('.building-button')).toHaveCount(5);
	for (const building of [
		{ button: 'Gate', heading: 'The Summoning Gate' },
		{ button: 'Kitchen', heading: 'Common Kitchen' },
		{ button: 'Dormitory', heading: 'North Dormitory' },
		{ button: 'Training', heading: 'Training Court' },
		{ button: 'Workshop', heading: 'Dormant Workshop' }
	]) {
		await page.locator('.building-button').filter({ hasText: building.button }).click();
		await expect(page.getByRole('heading', { name: building.heading })).toBeVisible();
	}

	await page.locator('.building-button').filter({ hasText: 'Kitchen' }).click();
	await expect(page.getByTestId('route-metrics')).toContainText('2m 4s');
	await expect(page.getByTestId('interior-stage')).toContainText('Common table');

	await page.locator('.building-button').filter({ hasText: 'Workshop' }).click();
	await expect(page.getByRole('heading', { name: 'Dormant Workshop' })).toBeVisible();
	await expect(page.getByTestId('route-metrics')).toContainText('2m 10s');
	await page
		.getByTestId('interior-stage')
		.getByRole('button', { name: /Dormant forge/ })
		.click();
	await expect(page.getByTestId('route-blocked')).toContainText('forge-system is dormant');

	await page.getByRole('button', { name: 'All systems' }).click();
	await expect(page.getByTestId('route-metrics')).toContainText('2m 20s');
	await expect(page.getByTestId('route-metrics')).toContainText('2 people');
	await expect(page.locator('.route-line.active')).toHaveCount(5);

	await page.locator('.building-button').filter({ hasText: 'Dormitory' }).click();
	await expect(page.getByRole('heading', { name: 'North Dormitory' })).toBeVisible();
	await expect(page.getByTestId('interior-stage')).toContainText('Curtained bunks');
	await expect(page.getByText('sleep · rest · privacy')).toBeVisible();

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);

	if (process.env.CAPTURE_PHASE4_SETTLEMENT) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_SETTLEMENT, fullPage: true });
	}
	if (process.env.CAPTURE_PHASE4_SETTLEMENT_SCENE) {
		await paintedScene.screenshot({ path: process.env.CAPTURE_PHASE4_SETTLEMENT_SCENE });
	}

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload();
	await expect
		.poll(() =>
			page.locator('.route-signal').evaluate((element) => getComputedStyle(element).animationName)
		)
		.toBe('none');
	await expect
		.poll(() =>
			page.locator('.traveler').evaluate((element) => getComputedStyle(element).transitionDuration)
		)
		.toBe('0s');
});

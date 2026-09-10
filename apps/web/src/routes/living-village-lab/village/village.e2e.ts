import { expect, test } from '@playwright/test';

test('shared City preserves the approved Village interactions and responsive dock', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	const apiRequests: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
	});

	const response = await page.goto('/living-village-lab/village');
	expect(response?.ok()).toBe(true);
	await expect(page.getByText('Prototype migration preview', { exact: true })).toHaveCount(0);
	const city = page.getByTestId('city-screen');
	await expect(city).toBeVisible();
	await expect(city.locator(':scope > header')).toHaveCount(0);

	const dock = city.getByRole('navigation', { name: 'City destinations' });
	await expect(dock.getByRole('link')).toHaveCount(5);
	for (const label of ['Village', 'Residents', 'Tower', 'Inventory', 'Missions']) {
		await expect(dock.getByRole('link', { name: label, exact: true })).toBeVisible();
	}
	await expect(dock.getByRole('link', { name: 'Village', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);

	const clock = city.getByTestId('city-clock');
	await expect(clock).toBeVisible();
	await expect(clock).toContainText('Day 3');
	await expect(clock).toContainText('20:15');
	const occupancy = city.getByLabel('People in each place');
	await expect(occupancy.locator('li')).toHaveCount(5);
	for (const label of ['Dorm', 'Kitchen', 'Gate', 'Training', 'Forge']) {
		await expect(occupancy.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(occupancy.locator('li b')).toHaveText(['1', '0', '1', '1', '0']);
	const occupancyLayout = await occupancy
		.locator('ul')
		.evaluate((element) =>
			getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean)
		);
	expect(occupancyLayout).toHaveLength(5);

	const viewport = city.getByTestId('city-village-viewport');
	await expect(viewport).toBeVisible();
	await expect(city.getByRole('toolbar', { name: 'Village toolbar' })).toHaveCount(0);
	await expect(city.getByLabel('Find a resident')).toHaveCount(0);
	await expect(viewport.getByRole('group', { name: 'Village camera controls' })).toBeVisible();
	const world = viewport.getByTestId('city-world');
	const assertWorldCoversViewport = async () => {
		const [viewportBox, worldBox] = await Promise.all([
			viewport.boundingBox(),
			world.boundingBox()
		]);
		expect(viewportBox).not.toBeNull();
		expect(worldBox).not.toBeNull();
		expect(worldBox!.x).toBeLessThanOrEqual(viewportBox!.x + 1);
		expect(worldBox!.y).toBeLessThanOrEqual(viewportBox!.y + 1);
		expect(worldBox!.x + worldBox!.width).toBeGreaterThanOrEqual(
			viewportBox!.x + viewportBox!.width - 1
		);
		expect(worldBox!.y + worldBox!.height).toBeGreaterThanOrEqual(
			viewportBox!.y + viewportBox!.height - 1
		);
	};
	await assertWorldCoversViewport();
	await expect(viewport.getByTestId('city-facility')).toHaveCount(5);
	await expect(viewport.getByTestId('city-facility-label')).toHaveCount(5);
	for (const label of ['Summoning Circle', 'Residence', 'Training Grounds', 'Forge', 'Portal']) {
		await expect(viewport.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(
		viewport.getByTestId('city-facility-label').filter({ hasText: 'Training Grounds' })
	).toHaveAttribute('style', /--label-x:\s*87%;\s*--label-y:\s*21%/);
	await expect(viewport.getByTestId('city-scene-resident')).toHaveCount(3);
	await expect(viewport.locator('.resident-marker img')).toHaveCount(3);

	await viewport.getByRole('button', { name: /Inspect Yaso Dreno/u }).click();
	const quickView = city.getByTestId('resident-quick-view');
	await expect(quickView).toContainText('Yaso Dreno');
	await expect(quickView).toContainText('Keeping watch');
	await quickView.getByRole('button', { name: 'Details' }).click();
	await expect(quickView).toHaveCount(0);
	const details = city.getByTestId('resident-details');
	await expect(details).toContainText('Yaso Dreno');
	await expect(details).toContainText('recognized');
	await details.getByRole('button', { name: 'Close resident details' }).click();

	await viewport.getByRole('button', { name: /Inspect Yaso Dreno/u }).click();
	await expect(quickView).toContainText('Yaso Dreno');
	await city.getByRole('button', { name: 'Zoom in' }).click();
	await expect(viewport).toHaveAttribute('data-zoom-percent', '125');
	await city.getByRole('button', { name: 'Fit Village' }).click();
	await expect(viewport).toHaveAttribute('data-zoom-percent', '100');
	await city.getByRole('button', { name: 'Reset View' }).click();
	await expect(quickView).toHaveCount(0);
	expect(apiRequests).toEqual([]);

	await page.setViewportSize({ width: 390, height: 844 });
	await expect(dock).toBeVisible();
	for (const link of await dock.getByRole('link').all()) {
		const box = await link.boundingBox();
		expect(box?.width).toBeGreaterThanOrEqual(44);
		expect(box?.height).toBeGreaterThanOrEqual(44);
	}
	await expect(viewport).toBeVisible();
	await expect(viewport.getByTestId('city-facility')).toHaveCount(5);
	await assertWorldCoversViewport();
});

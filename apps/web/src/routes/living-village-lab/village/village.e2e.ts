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
	await expect(page.getByText('Prototype migration preview', { exact: true })).toBeVisible();
	const city = page.getByTestId('city-screen');
	await expect(city).toBeVisible();

	const dock = city.getByRole('navigation', { name: 'City destinations' });
	await expect(dock.getByRole('link')).toHaveCount(5);
	for (const label of ['Village', 'Residents', 'Tower', 'Inventory', 'Missions']) {
		await expect(dock.getByRole('link', { name: label, exact: true })).toBeVisible();
	}
	await expect(dock.getByRole('link', { name: 'Village', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);

	await expect(city.getByText('Day 3', { exact: false })).toBeVisible();
	await expect(city.getByLabel('City occupancy and assignment capacity').locator('li')).toHaveCount(
		5
	);
	for (const label of ['Dorm', 'Kitchen', 'Gate', 'Training', 'Forge']) {
		await expect(
			city.getByLabel('City occupancy and assignment capacity').getByText(label, { exact: true })
		).toBeVisible();
	}

	const viewport = city.getByTestId('city-village-viewport');
	await expect(viewport).toBeVisible();
	await expect(viewport.getByTestId('city-facility')).toHaveCount(5);
	for (const label of ['Summoning Circle', 'Residence', 'Training Grounds', 'Forge', 'Portal']) {
		await expect(viewport.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(viewport.getByTestId('city-scene-resident')).toHaveCount(3);
	await expect(viewport.locator('.resident-marker img')).toHaveCount(3);

	await city
		.getByLabel('Find a resident')
		.getByRole('button', { name: /Yaso Dreno/u })
		.click();
	await expect(page.locator('#city-resident-00000000-0000-4000-8000-000000000001')).toBeFocused();
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
	await expect(viewport).toHaveAttribute('data-zoom-percent', '190');
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
});

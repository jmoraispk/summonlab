import { expect, test } from '@playwright/test';

const transportUrl = '/living-village-lab/asha-spine-transport';

test('loads the transport probe at three exploration scales', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto(transportUrl);
	await expect(page.getByTestId('spine-transport-status')).toHaveText('ready');
	await expect(page.getByTestId('asha-spine-source')).toBeVisible();
	await expect(page.getByTestId('asha-spine-72')).toBeVisible();
	await expect(page.getByTestId('asha-spine-84')).toBeVisible();
	await expect(page.getByTestId('asha-spine-96')).toBeVisible();
	await page.waitForTimeout(3_200);
	expect(errors).toEqual([]);
});

test('presents the candidate decomposition and exact 84 px calibration', async ({ page }) => {
	await page.goto(transportUrl);
	const review = page.getByTestId('asha-decomposition-review');
	await expect(review).toBeVisible();
	await expect(page.getByTestId('asha-selected-scale')).toHaveText('84 px');

	for (const testId of [
		'asha-decomposition-source',
		'asha-decomposition-body-core',
		'asha-decomposition-near-arm',
		'asha-decomposition-braid',
		'asha-decomposition-recomposed'
	]) {
		const dimensions = await page.getByTestId(testId).evaluate((image: HTMLImageElement) => ({
			width: image.naturalWidth,
			height: image.naturalHeight
		}));
		expect(dimensions).toEqual({ width: 768, height: 768 });
	}

	await expect(page.getByTestId('asha-84px-raster')).toHaveCSS('height', '84px');
	await page.getByRole('button', { name: 'Source' }).click();
	await expect(page.getByTestId('asha-84px-raster')).toHaveAttribute(
		'src',
		'/runtime/combat/realtime-study-v1/hero-saffron-braid-ready-v1.png'
	);
});

test('keeps reduced motion visible but pauses the probe', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(transportUrl);
	await expect(page.getByTestId('spine-transport-status')).toHaveText('ready');
	await expect(page.getByTestId('spine-transport-motion')).toHaveText('paused');
	await expect(page.getByTestId('spine-transport-canvas')).toBeVisible();
	await expect(page.getByTestId('asha-decomposition-review')).toBeVisible();
});

test('shows a labeled non-character state when a candidate raster is missing', async ({ page }) => {
	await page.route('**/review/asha-spine-decomposition/v2-r2/body-core.png', (route) =>
		route.abort('failed')
	);
	await page.goto(transportUrl);
	await expect(page.getByTestId('asha-decomposition-failure')).toBeVisible();
	await expect(page.getByTestId('asha-decomposition-failure')).toContainText(
		'Asha decomposition unavailable'
	);
	await expect(page.getByTestId('asha-decomposition-gate-status')).toContainText('failed');
	await expect(page.getByTestId('asha-decomposition-body-core')).toHaveCount(0);
});

test('does not render candidate art for a failed review descriptor', async ({ page }) => {
	await page.route('**/review/asha-spine-decomposition/v2-r2/review.json', (route) =>
		route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				schemaVersion: 'asha-spine-decomposition-review-v1',
				disposition: 'failed'
			})
		})
	);
	await page.goto(transportUrl);
	await expect(page.getByTestId('asha-decomposition-failure')).toContainText(
		'Asha decomposition unavailable'
	);
	await expect(page.getByTestId('asha-decomposition-gate-status')).toContainText('failed');
	await expect(page.getByTestId('asha-decomposition-source')).toHaveCount(0);
});

test('tears down cleanly when leaving the isolated route', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto(transportUrl);
	await expect(page.getByTestId('spine-transport-status')).toHaveText('ready');
	await page.getByRole('link', { name: 'All prototype screens' }).click();
	await expect(page).toHaveURL(/\/living-village-lab\/?$/u);
	expect(errors).toEqual([]);
});

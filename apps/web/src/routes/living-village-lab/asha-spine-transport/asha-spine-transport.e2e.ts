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

test('keeps reduced motion visible but pauses the probe', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(transportUrl);
	await expect(page.getByTestId('spine-transport-status')).toHaveText('ready');
	await expect(page.getByTestId('spine-transport-motion')).toHaveText('paused');
	await expect(page.getByTestId('spine-transport-canvas')).toBeVisible();
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

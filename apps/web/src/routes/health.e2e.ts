import { expect, test } from '@playwright/test';

test('renders the typed foundation health shell', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'The gate is listening.' })).toBeVisible();
	await expect(page.getByText('Policy mode')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Design reference' })).toBeVisible();

	if (process.env.CAPTURE_FOUNDATION) {
		await page.screenshot({ path: process.env.CAPTURE_FOUNDATION, fullPage: true });
	}
});

test('exposes structured health JSON with correlation id', async ({ request }) => {
	const response = await request.get('/health', {
		headers: { 'x-request-id': 'playwright-health-check' }
	});

	expect([200, 503]).toContain(response.status());
	expect(response.headers()['x-request-id']).toBe('playwright-health-check');
	await expect(response.json()).resolves.toMatchObject({
		service: 'web',
		policyMode: 'scripted',
		requestId: 'playwright-health-check'
	});
});

test('preserves the original interactive prototype', async ({ page }) => {
	await page.goto('/design-reference');

	await expect(page.getByRole('heading', { name: 'Tower command interface' })).toBeVisible();
	await expect(page.getByTitle('Original interactive Summonlab prototype')).toBeVisible();
});

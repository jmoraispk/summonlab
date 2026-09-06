import { expect, test } from '@playwright/test';

test('renders the focused player title without operational diagnostics', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByTestId('campaign-title')).toBeVisible();
	await expect(page.getByTestId('enter-village')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Wiki', exact: true })).toBeVisible();
	await expect(page.getByText(/Hearth (?:online|offline)/u)).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Design notes' })).toHaveCount(0);

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

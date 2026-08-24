import { expect, test } from '@playwright/test';

test('loads only approved content-addressed textures through the PixiJS bundle', async ({
	page
}) => {
	await page.goto('/visual-lab/runtime-bundles');

	await expect(page.getByRole('heading', { name: /Ship the person/ })).toBeVisible();
	await expect(page.getByText('47.8 KB')).toBeVisible();
	await expect(page.getByText('0.60% phone budget')).toBeVisible();
	await expect(page.getByText('97.3%')).toBeVisible();
	await expect(page.getByText('372.2 KB')).toBeVisible();
	await expect(page.getByTestId('pixi-runtime-state')).toContainText('loaded by bundle alias', {
		timeout: 15_000
	});
	await expect(page.locator('.canvas-frame canvas')).toBeVisible();
	await expect(page.getByAltText('Mara Vey summon runtime texture')).toBeVisible();
	await expect(page.getByAltText('Mara Vey dialogue runtime texture')).toBeVisible();
	await expect(page.getByAltText('Mara Vey roster runtime texture')).toBeVisible();
	await expect(page.getByTestId('deferred-runtime-assets')).toContainText('hearth-02-anchor-v1');
	await expect(page.getByTestId('deferred-runtime-assets')).toContainText(
		'awaiting-human-approval'
	);

	const textureResponse = await page.request.get(
		'/runtime/visual-catalog-v1/hero-ember-01-anchor-v1/summon.96b0fe61ac45.webp'
	);
	expect(textureResponse.status()).toBe(200);
	expect(textureResponse.headers()['content-type']).toContain('image/webp');

	if (process.env.CAPTURE_PHASE3_RUNTIME) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE3_RUNTIME, fullPage: true });
	}
});

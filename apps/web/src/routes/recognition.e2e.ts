import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('audits approved identity states and phone delivery without auto-approval', async ({
	page
}) => {
	await page.goto('/visual-lab/recognition');

	await expect(page.getByRole('heading', { name: /Recognize her/ })).toBeVisible();
	await expect(page.getByText('pending human review')).toBeVisible();
	await expect(page.getByTestId('phone-texture-ledger')).toContainText(
		'hero.ember-01-anchor-v1.roster'
	);
	await expect(page.getByText('47.8 KB over the wire')).toBeVisible();

	await page.getByRole('radio', { name: /Settlement night walk/ }).click();
	await expect(page.getByTestId('recognition-stage')).toContainText('48×86 CSS px');
	await expect
		.poll(async () => Math.round((await page.locator('.actual-scale').boundingBox())?.width ?? 0))
		.toBe(48);
	await expect
		.poll(async () => Math.round((await page.locator('.actual-scale').boundingBox())?.height ?? 0))
		.toBe(86);
	await expect(page.getByTestId('recognition-cues')).toContainText('not claimed at this distance');
	await expect(page.getByTestId('recognition-cues').getByText('human check required')).toHaveCount(
		4
	);

	await page.getByRole('radio', { name: /Mission exertion/ }).click();
	await expect
		.poll(async () => {
			const text = await page.getByTestId('interaction-latency').locator('strong').textContent();
			return Number.parseFloat(text ?? 'Infinity');
		})
		.toBeLessThan(150);
	await expect
		.poll(async () => {
			const text = await page.getByTestId('observed-fps').locator('strong').textContent();
			return Number.parseFloat(text ?? '0');
		})
		.toBeGreaterThanOrEqual(30);

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);

	if (process.env.CAPTURE_PHASE3_RECOGNITION) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE3_RECOGNITION, fullPage: true });
	}

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload();
	await page.getByRole('radio', { name: /Settlement night walk/ }).click();
	await expect(page.getByText('reduced motion active')).toBeVisible();
	await expect
		.poll(() =>
			page
				.locator('.actual-scale .figure')
				.evaluate((element) => getComputedStyle(element).animationName)
		)
		.toBe('none');
});

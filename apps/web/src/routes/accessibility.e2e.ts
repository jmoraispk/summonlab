import { expect, test } from '@playwright/test';

test('exposes a keyboard-first title and honors system motion preferences', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');

	await page.keyboard.press('Tab');
	const skipLink = page.getByRole('link', { name: 'Skip to main content' });
	await expect(skipLink).toBeFocused();
	await skipLink.press('Enter');
	await expect(page.locator('#main-content')).toBeFocused();
	await expect(page.locator('html')).toHaveAttribute('data-player-motion', 'system');
	const reducedDurationSeconds = await page
		.locator('.key-art')
		.evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration));
	expect(reducedDurationSeconds).toBeLessThan(0.001);

	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Wiki', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Enter Village' })).toBeFocused();
});

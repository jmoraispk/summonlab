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

	const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
	await settingsButton.focus();
	await settingsButton.press('Enter');
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeFocused();
	await dialog.getByRole('radio', { name: 'Full', exact: true }).check();
	await expect(page.locator('html')).toHaveAttribute('data-player-motion', 'full');
	const fullDurationSeconds = await page
		.locator('.key-art')
		.evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration));
	expect(fullDurationSeconds).toBeGreaterThan(1);
	await dialog.getByRole('radio', { name: 'System', exact: true }).check();
	await dialog.focus();
	await dialog.press('Shift+Tab');
	await expect(dialog.getByRole('radio', { name: '5-second handoff' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(dialog.getByRole('button', { name: /Close/ })).toBeFocused();
	await dialog.press('Escape');
	await expect(settingsButton).toBeFocused();
});

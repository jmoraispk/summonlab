import { expect, test } from '@playwright/test';

test('moderation dashboard stays honest before human sessions exist', async ({ page }) => {
	await page.goto('/playtest-moderation');
	const dashboard = page.getByTestId('playtest-moderation');

	await expect(dashboard).toContainText('Observe the player.');
	await expect(page.getByTestId('moderated-session-count')).toHaveText('0 / 5');
	await expect(page.getByTestId('moderated-slot')).toHaveCount(5);
	await expect(dashboard).toContainText('awaiting sessions');
	await expect(dashboard).toContainText('No human findings are recorded yet.');
	await expect(dashboard).toContainText('Do not record audio, video, identity');
	await expect(dashboard).not.toContainText('release: candidate');

	if (process.env.PLAYWRIGHT_EVIDENCE === '1') {
		await page.screenshot({
			path: 'test-results/fin007-moderation-readiness-desktop.png',
			fullPage: true
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.reload();
		await expect(page.getByTestId('moderated-session-count')).toHaveText('0 / 5');
		await page.screenshot({
			path: 'test-results/fin007-moderation-readiness-phone.png',
			fullPage: true
		});
	}
});

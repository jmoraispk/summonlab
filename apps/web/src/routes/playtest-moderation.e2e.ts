import { expect, test } from '@playwright/test';

test('owner playtest dashboard asks for one conversational playthrough', async ({ page }) => {
	await page.goto('/playtest-moderation');
	const dashboard = page.getByTestId('playtest-moderation');

	await expect(dashboard).toContainText('Play the game.');
	await expect(page.getByTestId('moderated-session-count')).toHaveText('0 / 1');
	await expect(page.getByTestId('moderated-slot')).toHaveCount(1);
	await expect(dashboard).toContainText('awaiting owner playtest');
	await expect(dashboard).toContainText('No owner feedback is recorded yet.');
	await expect(dashboard).toContainText('Nothing to copy or maintain.');
	await expect(dashboard).toContainText('collect quietly in the background');
	await expect(dashboard).not.toContainText('release: candidate');

	if (process.env.PLAYWRIGHT_EVIDENCE === '1') {
		await page.screenshot({
			path: 'test-results/fin007-moderation-readiness-desktop.png',
			fullPage: true
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.reload();
		await expect(page.getByTestId('moderated-session-count')).toHaveText('0 / 1');
		await page.screenshot({
			path: 'test-results/fin007-moderation-readiness-phone.png',
			fullPage: true
		});
	}
});

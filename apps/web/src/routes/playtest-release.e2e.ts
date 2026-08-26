import { expect, test } from '@playwright/test';

test('private release gate refuses to claim an archive before the human cohort', async ({
	page
}) => {
	await page.goto('/playtest-release');
	const dashboard = page.getByTestId('playtest-release');

	await expect(page.getByTestId('release-status')).toHaveText('held');
	await expect(page.getByTestId('release-check')).toHaveCount(4);
	await expect(dashboard).toContainText('0/5 de-identified moderated sessions recorded.');
	await expect(dashboard).toContainText('No package has been produced.');
	await expect(dashboard).toContainText('participant identities, recordings');
	await expect(dashboard).not.toContainText('packaged successfully');

	if (process.env.PLAYWRIGHT_EVIDENCE === '1') {
		await page.screenshot({
			path: 'test-results/fin008-release-gate-desktop.png',
			fullPage: true
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.reload();
		await expect(page.getByTestId('release-status')).toHaveText('held');
		await page.screenshot({ path: 'test-results/fin008-release-gate-phone.png', fullPage: true });
	}
});

import { expect, test } from '@playwright/test';

test('compares bounded story proposals without claiming canonical content', async ({ page }) => {
	await page.goto('/story-workshop');
	const workshop = page.getByTestId('story-workshop');

	await expect(workshop).toContainText('Propose widely.');
	await expect(workshop).toContainText('2 / 2');
	await expect(page.getByTestId('story-workshop-proposal')).toHaveCount(2);
	await expect(page.getByTestId('story-workshop-rubric').locator('article')).toHaveCount(6);
	await expect(page.getByTestId('selected-story-workshop-proposal')).toContainText(
		'The Names We Carry'
	);
	await page.getByTestId('workshop-floor-10').click();
	await expect(page.getByTestId('story-workshop-floor-detail')).toContainText(
		'Keeper of the Blank Line'
	);

	await page.getByTestId('story-workshop-proposal').nth(1).click();
	await expect(page.getByTestId('selected-story-workshop-proposal')).toContainText(
		'The Counted Silence'
	);
	await expect(workshop).toContainText('Prototype mechanic requires production proof');
	await expect(workshop).toContainText('0 ready for compilation');
	await expect(workshop).toContainText('Generated proposals are not accepted content');

	if (process.env.PLAYWRIGHT_EVIDENCE === '1') {
		await page.addStyleTag({ content: '.skip-link { display: none !important; }' });
		await page.screenshot({
			path: 'test-results/fin009-story-workshop-desktop.png',
			fullPage: true
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.reload();
		await expect(page.getByTestId('story-workshop-proposal')).toHaveCount(2);
		await page.addStyleTag({ content: '.skip-link { display: none !important; }' });
		await page.screenshot({ path: 'test-results/fin009-story-workshop-phone.png', fullPage: true });
	}
});

import { expect, test } from '@playwright/test';

test('reviews manifest-backed identity across views and settlement scale', async ({ page }) => {
	await page.goto('/visual-lab');

	await expect(page.getByRole('heading', { name: /One person/ })).toBeVisible();
	await expect(page.getByText('Mara Vey').first()).toBeVisible();
	await expect(page.getByTestId('continuity-score')).toHaveText('5 / 5 identity cues retained');
	await expect(page.getByTestId('settlement-score')).toHaveText('4 / 5 cues retained');
	await expect(page.getByText('not claimed at this scale')).toBeVisible();
	await expect(page.getByText('hearth-settlement-scale-v1', { exact: true }).first()).toBeVisible();

	await page.getByRole('radio', { name: /Remy Nahl/ }).click();
	await expect(page.getByRole('heading', { name: 'Remy Nahl' })).toBeVisible();
	await expect(page.getByText(/53 kg/)).toBeVisible();
	await expect(page.getByText('left-handed equipment use')).toBeVisible();
	await expect(page.getByAltText(/Remy Nahl across front/)).toBeVisible();
	await expect(page.getByTestId('runtime-rig-states')).toContainText('Night watch');
	await expect(page.getByTestId('runtime-rig-states')).toContainText('Injured');

	if (process.env.CAPTURE_PHASE3_VISUAL) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE3_VISUAL, fullPage: true });
	}

	await page.getByLabel('Reviewer').fill('test:playwright-ui');
	await page
		.getByLabel('Decision note')
		.fill('Identity remains specific across the continuity views.');
	await page.getByRole('button', { name: 'Accept', exact: true }).click();
	await page.getByRole('button', { name: 'Record hash-bound decision' }).click();
	await expect(page.getByTestId('review-result')).toContainText('Accepted');
	await expect(page.getByTestId('current-review')).toContainText(
		'Identity remains specific across the continuity views.'
	);
});

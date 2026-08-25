import { expect, test } from '@playwright/test';

test('shows the archived Floor 04 consequence and clean Floor 05 ledger', async ({ page }) => {
	await page.goto('/attempt-aftermath');

	await expect(page.getByTestId('attempt-aftermath-proof')).toBeVisible();
	await expect(page.getByRole('heading', { name: /Scars travel/i })).toBeVisible();
	await expect(page.getByTestId('archived-attempt')).toContainText('The Brass Relay');
	await expect(page.getByTestId('archived-attempt')).toContainText('100 → 75 HP');
	await expect(page.getByTestId('active-attempt')).toContainText('The Living Foundry');
	await expect(page.getByTestId('active-attempt')).toContainText('0 inherited records');
	await expect(page.getByText('replay verified', { exact: true })).toBeVisible();
});

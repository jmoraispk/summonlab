import { expect, test } from '@playwright/test';

test('presents the locked title gateway', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByTestId('campaign-title')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Enter Village' })).toHaveAttribute(
		'href',
		/^\/(?:living-village-lab\/opening|onboarding\/[a-f0-9-]+|play\/[a-f0-9-]+)$/u
	);
	await expect(page.getByRole('link', { name: 'Wiki', exact: true })).toHaveAttribute(
		'href',
		'/wiki'
	);
	await expect(page.getByLabel('New chronicle seed')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
	await expect(page.getByTestId('sensory-controls')).toHaveCount(0);
	await expect(page.getByText(/Hearth (?:online|offline)/u)).toHaveCount(0);
	await expect(page.getByRole('navigation', { name: 'Development tools' })).toHaveCount(0);
});

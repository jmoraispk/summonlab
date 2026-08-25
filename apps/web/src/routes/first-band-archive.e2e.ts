import { expect, test } from '@playwright/test';

test('extracts and reveals the first-band archive through the database-backed checkpoint', async ({
	page
}) => {
	const response = await page.request.post('/api/dev/first-band-archive-runs', {
		data: { seed: 'first-band-archive-e2e' },
		timeout: 60_000
	});
	expect(response.ok()).toBe(true);
	const body = (await response.json()) as { runId: string };
	await page.goto(`/first-band-archive/${body.runId}`);
	await expect(page.getByTestId('first-band-archive')).toBeVisible();
	await expect(page.getByTestId('archive-causal-proof')).toContainText('EXTRACTED');
	await expect(page.getByTestId('first-band-story-beat')).toHaveCount(5);
	await expect(page.getByTestId('first-band-story-beat').nth(3)).toContainText(/a sealed memory/i);
	await expect(page.getByTestId('first-band-archive')).not.toContainText(
		'Hearth 01 was not the first.'
	);
	await expect(page.getByTestId('archive-reader')).toHaveCount(4);
	await page.getByTestId('archive-reader').nth(1).click();
	await page.getByTestId('reveal-first-band-archive').click();
	await expect(page.getByTestId('first-band-archive-reveal')).toContainText(
		'Hearth 01 was not the first.'
	);
	await expect(page.getByTestId('archive-knowledge')).toHaveCount(4);
	await page.reload();
	await expect(page.getByTestId('first-band-archive-reveal')).toBeVisible();
});

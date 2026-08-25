import { expect, test } from '@playwright/test';

test('commits synthesis and a sourced rumor through the database-backed chamber', async ({
	page
}) => {
	const response = await page.request.post('/api/dev/synthesis-runs', {
		data: { seed: 'synthesis-e2e-private' }
	});
	expect(response.status()).toBe(201);
	const { runId } = (await response.json()) as { runId: string };

	await page.goto(`/synthesis/${runId}`);
	await expect(page.getByTestId('synthesis-chamber')).toBeVisible();
	await expect(page.getByTestId('synthesis-hero')).toHaveCount(4);
	await page.getByTestId('open-synthesis-confirmation').click();
	await expect(page.getByTestId('synthesis-confirmation')).toContainText(
		'This consumes a hero permanently.'
	);
	await page.getByTestId('confirm-synthesis').click();

	await expect(page.getByTestId('synthesis-receipt')).toContainText('One life ended');
	await expect(page.getByTestId('synthesis-hero').filter({ hasText: 'SYNTHESIZED' })).toHaveCount(
		1
	);
	await expect(
		page.getByTestId('synthesis-knowledge').filter({ hasText: 'participant' })
	).toHaveCount(1);
	await expect(page.getByTestId('synthesis-knowledge').filter({ hasText: 'absence' })).toHaveCount(
		2
	);

	await page.getByTestId('share-synthesis-rumor').click();
	await expect(page.getByTestId('synthesis-rumor-record')).toContainText(
		'85% confidence · chain 1'
	);
	await page.reload();
	await expect(page.getByTestId('synthesis-receipt')).toBeVisible();
	await expect(page.getByTestId('synthesis-rumor-record')).toContainText('chain 1');
	await expect(page.getByText('STRICT', { exact: true })).toBeVisible();
	if (process.env.CAPTURE_PHASE7_SYNTHESIS)
		await page.screenshot({ path: process.env.CAPTURE_PHASE7_SYNTHESIS, fullPage: true });
});

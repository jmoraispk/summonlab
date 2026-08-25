import { expect, test } from '@playwright/test';

test('binds fallback doctrine, records a safety stop, and resolves seeded random', async ({
	page
}) => {
	await page.goto('/master-fallback');
	await expect(page.getByRole('heading', { name: /Give intent. Keep agency./i })).toBeVisible();

	const response = await page.request.post('/api/dev/master-fallback-runs', {
		data: { seed: 'fallback-doctrine-e2e' }
	});
	expect(response.ok()).toBe(true);
	const { runId } = (await response.json()) as { runId: string };
	await page.goto(`/mission/${runId}`);
	await expect(page.getByRole('heading', { name: /The Chosen Intent/i })).toBeVisible();
	await expect(page.getByTestId('fallback-console')).toContainText('directed');

	await page.getByTestId('prepare-party').click();
	await page.getByTestId('deploy-party').click();
	await page.getByTestId('health-stop-threshold').fill('100');
	await page.getByTestId('save-fallback').click();
	await page.getByTestId('timing-continuous').click();
	await page.waitForTimeout(1_500);
	if (
		await page
			.getByRole('alert')
			.isVisible()
			.catch(() => false)
	) {
		throw new Error((await page.getByRole('alert').textContent()) ?? 'Autonomy failed.');
	}
	await expect(page.getByTestId('last-decision-resolution')).toContainText('safety-stopped', {
		timeout: 5_000
	});
	await expect(page.getByTestId('fallback-evidence')).toContainText('master-health');
	await expect(page.getByTestId('master-control-console')).toContainText('wait');
	if (process.env.CAPTURE_PHASE6_MASTER_FALLBACK) {
		await page.screenshot({
			path: process.env.CAPTURE_PHASE6_MASTER_FALLBACK,
			fullPage: true
		});
	}

	await page.getByTestId('fallback-policy-random').click();
	await page.getByTestId('health-stop-enabled').uncheck();
	await page.getByTestId('save-fallback').click();
	await page.getByTestId('timing-step').click();
	await expect(page.getByTestId('last-decision-resolution')).toContainText(
		'fallback · immediate-fallback · step',
		{ timeout: 5_000 }
	);
	await expect(page.getByTestId('fallback-evidence')).toContainText('master-random-v1');
	await expect(page.getByTestId('master-control-console')).toContainText('wait');

	await page.reload();
	await expect(page.getByTestId('fallback-console')).toContainText('random');
	await expect(page.getByText('master.safety.stopped').first()).toBeVisible();
});

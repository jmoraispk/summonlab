import { expect, test, type Page } from '@playwright/test';

async function chooseMasterAction(page: Page, label: string) {
	const versionBefore = await page.getByTestId('run-version').textContent();
	await page.getByTestId('master-turn-actions').getByRole('button', { name: label }).click();
	await page.getByTestId('resolve-turn').click();
	await expect.poll(() => page.getByTestId('run-version').textContent()).not.toBe(versionBefore);
}

test('switches authoritative Master timing, expires Countdown, and pauses autonomy', async ({
	page
}) => {
	await page.goto('/master-timing');
	await expect(page.getByRole('heading', { name: /Four ways to command/i })).toBeVisible();

	const response = await page.request.post('/api/dev/master-timing-runs', {
		data: { seed: 'four-command-sigils-e2e' }
	});
	expect(response.ok()).toBe(true);
	const { runId } = (await response.json()) as { runId: string };
	await page.goto(`/mission/${runId}`);
	await expect(page.getByRole('heading', { name: /The Living Tempo/i })).toBeVisible();
	await expect(page.getByTestId('master-control-console')).toContainText('wait');

	await page.getByTestId('prepare-party').click();
	await page.getByTestId('deploy-party').click();
	await expect(page.getByTestId('master-control-console')).toContainText('D-1');
	await chooseMasterAction(page, 'Hold position');
	await expect(page.getByTestId('last-decision-resolution')).toContainText(
		'manual · not-applicable · manual'
	);

	await page.getByTestId('timing-countdown').click();
	await expect(page.getByTestId('decision-countdown')).toBeVisible();
	await expect(page.getByTestId('decision-countdown')).toContainText(/5|4/u);
	if (process.env.CAPTURE_PHASE6_MASTER_TIMING) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE6_MASTER_TIMING, fullPage: true });
	}
	await expect(page.getByTestId('last-decision-resolution')).toContainText(
		'fallback · expired-to-fallback · countdown',
		{ timeout: 8_000 }
	);

	await page.getByTestId('timing-step').click();
	await expect(page.getByTestId('last-decision-resolution')).toContainText(
		'fallback · immediate-fallback · step'
	);
	await expect(page.getByTestId('master-control-console')).toContainText('wait');

	await page.getByTestId('timing-continuous').click();
	await expect(page.getByTestId('last-decision-resolution')).toContainText(
		'fallback · immediate-fallback · continuous'
	);
	await expect(page.getByTestId('timing-wait')).toBeEnabled();
	await page.getByTestId('timing-wait').click();
	await expect(page.getByTestId('master-control-console')).toContainText('wait');
	await expect(page.getByTestId('master-control-console')).toContainText(
		'Paused at a legal boundary'
	);

	await page.reload();
	await expect(page.getByTestId('master-control-console')).toContainText('wait');
	await expect(page.getByText('master.timing.changed').first()).toBeVisible();
});

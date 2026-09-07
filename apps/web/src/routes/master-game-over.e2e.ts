import { expect, test, type Page } from '@playwright/test';

async function chooseMasterAction(page: Page, label: string) {
	const versionBefore = await page.getByTestId('run-version').textContent();
	await page.getByTestId('master-turn-actions').getByRole('button', { name: label }).click();
	await page.getByTestId('resolve-turn').click();
	await expect.poll(() => page.getByTestId('run-version').textContent()).not.toBe(versionBefore);
}

test('lets the Master act, die, seal the run, and inspect the persisted replay', async ({
	page
}) => {
	await page.goto('/last-command');
	await expect(page.getByRole('heading', { name: /The Last Command/ })).toBeVisible();
	await expect(page.getByText('The Master gets no second life.')).toBeVisible();

	const response = await page.request.post('/api/dev/master-death-runs', {
		data: {
			direction: 'Hold and guard at the threshold. Protect yourself before following me.',
			seed: 'last-command-a4edfbca-2bcf-45ec-a0c9-c0dc909dbfe7'
		}
	});
	expect(response.ok()).toBe(true);
	const { runId } = (await response.json()) as { runId: string };
	await page.goto(`/mission/${runId}`);
	await expect(page.getByRole('heading', { name: /The Last Command/ })).toBeVisible();
	await expect(page.getByTestId('master-roster-card')).toContainText('Health 100 / 100 · alive');

	await page.getByTestId('prepare-party').click();
	await page.getByTestId('deploy-party').click();
	await chooseMasterAction(page, 'Move to Cut Stair');
	await expect(page.getByTestId('red-slag-warning')).toBeVisible();
	await chooseMasterAction(page, 'Move to Red Gallery');
	await chooseMasterAction(page, 'Move to Tithe Pit');
	await expect(page.getByTestId('red-slag-warning')).toBeVisible();
	await chooseMasterAction(page, 'Move to Red Gallery');

	for (let round = 0; round < 8; round += 1) {
		if ((await page.getByTestId('mission-game-over').count()) > 0) break;
		await chooseMasterAction(page, 'Hold position');
	}

	await expect(page.getByTestId('mission-game-over')).toContainText(
		'The Master is dead. The command ends here.'
	);
	await expect(page.getByTestId('master-roster-card')).toContainText('Health 0 / 100 · dead');
	await expect(page.getByTestId('master-turn-actions')).toHaveCount(0);
	await expect(page.getByTestId('aftermath-console')).toContainText('run ended atomically');

	if (process.env.CAPTURE_PHASE6_MASTER_GAME_OVER) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE6_MASTER_GAME_OVER, fullPage: true });
	}

	await page.reload();
	await expect(page.getByTestId('mission-game-over')).toBeVisible();
	await page.getByRole('link', { name: 'Open the sealed replay' }).click();
	await expect(page).toHaveURL(new RegExp(`/replay/${runId}$`, 'u'));
	await expect(page.getByTestId('replay-status')).toHaveText('Internal replay verified');
	await expect(page.getByText(/game_over · .* · mission tower-floor-03/u)).toBeVisible();
	await expect(page.getByText(/The Master died .* the run was atomically sealed\./u)).toBeVisible();
});

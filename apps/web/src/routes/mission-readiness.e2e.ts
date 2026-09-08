import { expect, test } from '@playwright/test';

const recipe = {
	seed: 'task10-dual-mode-recipe-v1',
	generationVersion: 'human-v1',
	cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
};

test.skip(
	process.env.COMBAT_MODE !== 'agent-readiness-v1',
	'Readiness combat is an explicit operator-configured browser gate.'
);

test('continues readiness combat, restores its pending window, and exposes no player mode controls', async ({
	page,
	request
}) => {
	const createdResponse = await request.post('/api/runs', {
		data: { recipe, controlMode: 'wait', directive: '' }
	});
	expect(createdResponse.status()).toBe(201);
	const { runId } = (await createdResponse.json()) as { runId: string };

	await page.goto(`/mission/${runId}`);
	await page.getByTestId('prepare-party').click();
	await page.getByTestId('deploy-party').click();
	await expect(page.getByTestId('continue-battle')).toBeVisible();
	await expect(page.getByTestId('master-turn-actions')).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: /combat mode|provider/iu })).toHaveCount(0);

	await page.getByTestId('continue-battle').click();
	await expect(page.getByTestId('combat-window-status')).toContainText('Heroes choosing');
	await expect(page.getByTestId('continue-battle')).toBeDisabled();

	await page.reload();
	await expect(page.getByTestId('combat-window-status')).toContainText(/\d+\/\d+ ready/u);
	await expect(page.getByTestId('continue-battle')).toBeDisabled();
	await expect(page.getByText(/agent-readiness|legacy-auto|combat-rules/u)).toHaveCount(0);

	if (process.env.TASK9_SCREENSHOT_PATH) {
		await page.screenshot({ path: process.env.TASK9_SCREENSHOT_PATH, fullPage: true });
	}
});

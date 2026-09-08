import { expect, test } from '@playwright/test';

const recipe = {
	seed: 'task10-dual-mode-recipe-v1',
	generationVersion: 'human-v1',
	cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
};

test.skip(
	process.env.COMBAT_MODE === 'agent-readiness-v1',
	'Legacy automatic combat is the default release browser gate.'
);

test('continues the default legacy automatic battle without readiness controls', async ({
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
	await expect(page.getByTestId('combat-window-status')).toHaveCount(0);

	await page.getByTestId('continue-battle').click();
	await expect(page.getByText(/Attempt 1 · Round 1\//u)).toBeVisible();
	await expect(page.getByTestId('combat-window-status')).toHaveCount(0);
	await expect(page.getByText(/agent-readiness|legacy-auto|combat-rules/u)).toHaveCount(0);
});

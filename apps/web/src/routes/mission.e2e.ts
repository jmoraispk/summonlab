import { expect, test } from '@playwright/test';

const recipe = {
	seed: 'ember-01',
	generationVersion: 'human-v1',
	cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
};

test('prepares, retreats, retries, and resolves one replayable Floor 01 party', async ({
	page,
	request
}) => {
	const createdResponse = await request.post('/api/runs', {
		data: { recipe, controlMode: 'wait', directive: '' }
	});
	expect(createdResponse.status()).toBe(201);
	const created = (await createdResponse.json()) as { runId: string };

	await page.goto(`/mission/${created.runId}`);
	await expect(page.getByRole('heading', { name: /The Unlit Muster/ })).toBeVisible();
	await expect(
		page.getByText('31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02')
	).toBeVisible();
	await expect(page.getByTestId('hero-roster-card')).toContainText('Mara Vey');
	await expect(page.locator('.phase-heading h2')).toHaveText('available');

	await page.getByTestId('prepare-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('preparing');
	await expect(page.getByText('mission.preparation.started')).toBeVisible();
	await page.getByTestId('deploy-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('deployed');
	await expect(page.getByTestId('mission-board')).toBeVisible();
	await expect(page.getByTestId('threat-intents')).toContainText('Declared threats');
	await expect(page.getByTestId('threat-intents').locator('article')).toHaveCount(3);
	await expect(page.getByTestId('monster-token')).toHaveCount(3);
	await page.getByTestId('retreat-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('retreat');
	await expect(page.getByText('mission.retreated')).toBeVisible();

	await page.getByTestId('prepare-party').click();
	await expect(page.locator('.scene-caption')).toContainText('Attempt 2');
	await page.getByTestId('deploy-party').click();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.getByTestId('mission-board')).toBeVisible();
	await expect(page.getByTestId('master-turn-actions')).toBeVisible();
	await expect(page.getByTestId('resolve-turn')).toBeVisible();
	await page.setViewportSize({ width: 1280, height: 720 });
	for (const [index, label] of [
		'Move to Oath Hall',
		'Move to Shattered Gallery',
		'Move to Chain Court',
		'Move to Ember Vault',
		'Lift the First Ember',
		'Move to Chain Court',
		'Move to Shattered Gallery',
		'Move to Oath Hall',
		'Move to Tower Threshold'
	].entries()) {
		await page.getByTestId('master-turn-actions').getByRole('button', { name: label }).click();
		await page.getByTestId('resolve-turn').click();
		await expect(page.getByTestId('initiative-report')).toBeVisible();
		if (index === 2) {
			await expect(page.getByTestId('threat-intents')).toContainText('lowers a hooked blade');
			await expect(
				page
					.getByTestId('master-turn-actions')
					.getByRole('button', { name: /Strike/ })
					.first()
			).toBeVisible();
		}
		if (index === 0 && process.env.CAPTURE_PHASE6_MISSION_TURNS) {
			await page.setViewportSize({ width: 1440, height: 1100 });
			await page.screenshot({
				path: process.env.CAPTURE_PHASE6_MISSION_TURNS,
				fullPage: true
			});
		}
		if (index === 2 && process.env.CAPTURE_PHASE6_MONSTER_DUTIES) {
			await page.setViewportSize({ width: 1440, height: 1200 });
			await page.screenshot({
				path: process.env.CAPTURE_PHASE6_MONSTER_DUTIES,
				fullPage: true
			});
		}
	}
	await expect(page.locator('.phase-heading h2')).toHaveText('extraction');
	await expect(page.getByText('First Ember returned to threshold')).toBeVisible();
	await expect(page.getByText('mission.round.resolved').first()).toBeVisible();

	await page.getByTestId('extract-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('success');
	await expect(page.getByText('mission.extracted')).toBeVisible();
	await page.reload();
	await expect(page.locator('.phase-heading h2')).toHaveText('success');
	await expect(page.getByText('16 transitions')).toBeVisible();
	await expect(page.getByText('Floor 01 is complete.')).toBeVisible();
});

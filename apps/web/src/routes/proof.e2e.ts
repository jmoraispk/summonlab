import { expect, test } from '@playwright/test';

const emberRecipe = {
	seed: 'ember-01',
	generationVersion: 'human-v1',
	cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
};

test('replays the same seeded-random identity and first choice', async ({ request }) => {
	const create = () =>
		request.post('/api/runs', {
			data: { recipe: emberRecipe, controlMode: 'random', directive: '' }
		});
	const [leftResponse, rightResponse] = await Promise.all([create(), create()]);
	expect(leftResponse.status()).toBe(201);
	expect(rightResponse.status()).toBe(201);
	const leftCreated = (await leftResponse.json()) as { runId: string; manifestHash: string };
	const rightCreated = (await rightResponse.json()) as { runId: string; manifestHash: string };
	const [left, right] = await Promise.all([
		request.get(`/api/runs/${leftCreated.runId}`).then((response) => response.json()),
		request.get(`/api/runs/${rightCreated.runId}`).then((response) => response.json())
	]);

	expect(leftCreated.manifestHash).toBe(rightCreated.manifestHash);
	expect(left.manifest).toEqual(right.manifest);
	expect(left.mind).toEqual(right.mind);
	expect(left.destination).toBe(right.destination);
	expect(left.storyBranch).toBe(right.storyBranch);
});

test('forges, summons, directs, and follows one persistent hero', async ({ page }) => {
	await page.goto('/forge');
	await expect(page.getByRole('heading', { name: /One seed/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Mara Vey' })).toBeVisible();
	await expect(page.getByText('original-generated-anchor')).toBeVisible();

	if (process.env.CAPTURE_PHASE1_FORGE) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE1_FORGE, fullPage: true });
	}

	await page.getByRole('radio', { name: /Wait for step/ }).click();
	await page
		.getByPlaceholder('Example: Learn who lives here before thinking about the tower.')
		.fill('Train, exercise, and prepare to fight in the tower.');
	await page.getByRole('button', { name: /Summon Mara Vey/ }).click();
	await expect(page).toHaveURL(/\/summon\/[a-f0-9-]+$/u);

	await page.getByRole('button', { name: /Break the seal/ }).click();
	await expect(page.getByRole('heading', { name: 'The hero is waiting to choose.' })).toBeVisible({
		timeout: 5_000
	});
	await page.getByRole('button', { name: /Let Mara decide now/ }).click();
	await expect(
		page.getByText(/Show me somewhere I can test what this body remembers/)
	).toBeVisible();
	await expect(page.getByText(/steel before trust → the training ground/i)).toBeVisible();

	if (process.env.CAPTURE_PHASE1_SUMMON) {
		await page.waitForTimeout(800);
		await page.screenshot({ path: process.env.CAPTURE_PHASE1_SUMMON, fullPage: true });
	}

	await page.getByRole('link', { name: /Follow to the training ground/ }).click();
	await expect(page).toHaveURL(/\/play\/[a-f0-9-]+$/u);
	await expect(page.getByText('Arrived · Training Ground')).toBeVisible({ timeout: 6_000 });
	if (process.env.CAPTURE_PHASE1_PLAY) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE1_PLAY, fullPage: true });
	}

	await page.getByRole('button', { name: /Journal/ }).click();
	await expect(page.getByText('5 events')).toBeVisible();
	await expect(page.getByText('hero.arrived')).toBeVisible();
	await page.getByRole('button', { name: /Close journal/ }).click();
	await page.getByRole('link', { name: 'Replay' }).click();
	await expect(page).toHaveURL(/\/replay\/[a-f0-9-]+$/u);
	await expect(page.getByTestId('replay-status')).toContainText('Verified');
	await expect(page.getByText('snapshot agrees')).toBeVisible();
	await expect(page.getByText('hero.destination.selected')).toBeVisible();
	await expect(page.getByText('hero.travel.started')).toBeVisible();
	await expect(page.getByText('simulation.advanced')).toBeVisible();
	await expect(page.getByTestId('travel-proof')).toContainText('training-ring');
	await page
		.getByTestId('building-training-ground')
		.getByRole('button', { name: 'assign', exact: true })
		.click();
	await expect(page.getByTestId('hero-assignment')).toContainText('training-ground');
	await page
		.getByTestId('building-workshop')
		.getByRole('button', { name: 'power', exact: true })
		.click();
	await expect(page.getByTestId('building-workshop')).toContainText('powered');
	await page.getByRole('button', { name: 'forge', exact: true }).click();
	await expect(page.getByTestId('travel-proof')).toContainText('training-ring → workshop-forge');
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('travel-proof').locator('strong')).toHaveText('workshop-forge');
	await page.getByRole('button', { name: 'training', exact: true }).click();
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('travel-proof').locator('strong')).toHaveText('training-ring');
	await expect(page.getByTestId('pending-schedule')).toHaveText('No pending work');

	if (process.env.CAPTURE_PHASE4_OPERATIONS) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_OPERATIONS, fullPage: true });
	}

	await page.getByRole('button', { name: /Draw gate resonance/ }).click();
	await expect(page.getByTestId('entropy-cursor')).toHaveText('1');
	await expect(page.getByText('master.gate.inspected')).toBeVisible();
	await page.getByRole('button', { name: /Prove stale guard/ }).click();
	await expect(page.getByTestId('command-result')).toHaveText('1 accepted · 1 rejected stale');
	await expect(page.getByTestId('entropy-cursor')).toHaveText('2');
	await expect(page.getByTestId('replay-status')).toContainText('Verified');

	if (process.env.CAPTURE_PHASE2_REPLAY) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE2_REPLAY, fullPage: true });
	}

	await page.getByRole('button', { name: 'kitchen', exact: true }).click();
	await expect(page.getByTestId('travel-proof')).toContainText('training-ring → kitchen-table');
	await expect(page.getByTestId('travel-proof')).toContainText(
		'training-ring remains current until'
	);
	await expect(page.getByTestId('pending-schedule')).toContainText('hero.travel.arrive');
	if (process.env.CAPTURE_PHASE4_TRAVEL) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_TRAVEL, fullPage: true });
	}
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('travel-proof')).toContainText('kitchen-table');
	await page.getByRole('button', { name: 'training', exact: true }).click();
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('travel-proof')).toContainText('training-ring');

	await page.getByRole('button', { name: 'train', exact: true }).click();
	await expect(page.getByTestId('pending-schedule')).toContainText('hero.activity.complete');
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('hero-xp')).toHaveText('1 / 8');
	await expect(page.getByTestId('item-durability')).toHaveText('5/6');
	await expect(page.getByText(/one train activity resolved/i)).toBeVisible();

	await page.getByRole('button', { name: 'repair', exact: true }).click();
	await expect(page.getByTestId('resource-iron-ore')).toHaveText('1');
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('item-durability')).toHaveText('6/6');
	await expect(page.getByTestId('replay-status')).toContainText('Verified');

	if (process.env.CAPTURE_PHASE2_SURVIVAL) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE2_SURVIVAL, fullPage: true });
	}

	await page.getByRole('button', { name: 'rest', exact: true }).click();
	await page.getByRole('button', { name: /Fatal hero proof/ }).click();
	await expect(page.getByText(/Summoned hero/).locator('..')).toContainText('dead');
	await expect(page.getByTestId('hero-assignment')).toHaveCount(0);
	await expect(page.getByTestId('building-training-ground')).toContainText('0/8');
	await expect(page.getByTestId('pending-schedule')).toHaveText('No pending work');
	await page.getByRole('button', { name: /End run proof/ }).click();
	await expect(page.getByTestId('game-over')).toContainText('This history is sealed');
	await expect(page.getByTestId('replay-status')).toContainText('Verified');

	if (process.env.CAPTURE_PHASE2_GAMEOVER) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE2_GAMEOVER, fullPage: true });
	}
});

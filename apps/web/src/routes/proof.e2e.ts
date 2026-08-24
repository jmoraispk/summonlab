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
});

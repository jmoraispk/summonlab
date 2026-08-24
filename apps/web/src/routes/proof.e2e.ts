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
	await expect(page.getByRole('heading', { name: 'Speak into a clean slate.' })).toBeVisible();
	await page
		.getByLabel('Exact words to the summoned hero')
		.fill(
			'I am the Master of Hearth 01. You were summoned here, but you are free to ask what this place demands.'
		);
	await page.getByRole('button', { name: 'Speak', exact: true }).click();
	await expect(page.getByText('1 witnessed')).toBeVisible();
	await expect(page.getByText('1 learned a claim')).toBeVisible();
	await expect(page.getByTestId('decision-context')).toContainText(
		'2 legal · 2 memories · 3 beliefs'
	);
	await page.getByTestId('decision-context').locator('summary').click();
	await expect(page.getByTestId('decision-context')).toContainText(
		'I am the Master of Hearth 01. You were summoned here'
	);
	await expect(page.getByTestId('decision-context')).toContainText('hero.choose.kitchen');
	const heroConversation = page.getByTestId('hero-conversation');
	await heroConversation.getByRole('button', { name: 'order', exact: true }).click();
	await heroConversation
		.getByLabel('Free text for the hero')
		.fill('Train at the practice ring before we enter the tower.');
	await heroConversation.getByRole('button', { name: 'Send and hear reply' }).click();
	await expect(page.getByTestId('hero-reply')).toContainText('negotiated');
	await expect(page.getByTestId('hero-reply')).toContainText('+12 preference');
	await expect(page.getByTestId('conversation-influence')).toContainText(
		'Train at the practice ring before we enter the tower.'
	);
	await expect(page.getByTestId('conversation-influence')).toContainText('conversation-weight-12');
	if (process.env.CAPTURE_PHASE5_CONVERSATION_ORDERS) {
		await page.setViewportSize({ width: 1440, height: 1200 });
		await heroConversation.scrollIntoViewIfNeeded();
		await heroConversation.screenshot({ path: process.env.CAPTURE_PHASE5_CONVERSATION_ORDERS });
	}
	await expect(page.getByTestId('policy-baselines')).toContainText('Personality script');
	await expect(page.getByTestId('policy-baselines')).toContainText('Seeded random');
	await expect(page.getByTestId('policy-baselines')).toContainText('0 model calls');
	await expect(page.getByTestId('policy-baselines').getByText('result')).toHaveCount(2);
	await expect(page.getByTestId('model-policy-bench')).toContainText('Live model bench');
	await expect(page.getByTestId('model-policy-bench')).toContainText('gpt-5-nano');
	await expect(page.getByTestId('model-policy-bench')).toContainText(
		'No provider request is sent in scripted mode.'
	);
	await expect(page.getByRole('button', { name: /Ask gpt-5-nano once/ })).toHaveCount(0);
	await expect(page.getByTestId('decision-job-bench')).toContainText('Durable decision job');
	await expect(page.getByTestId('decision-job-bench')).toContainText(
		'scripted fallback · stale state never applies'
	);
	await expect(page.getByRole('button', { name: /Queue scripted \+ apply/ })).toBeVisible();
	await expect(page.getByTestId('decision-context')).toContainText('witnessed knowledge only');
	if (process.env.CAPTURE_PHASE5_DECISION_JOBS) {
		await page.setViewportSize({ width: 1440, height: 1120 });
		await page.getByTestId('decision-job-bench').scrollIntoViewIfNeeded();
		await page.screenshot({ path: process.env.CAPTURE_PHASE5_DECISION_JOBS, fullPage: true });
	}
	if (process.env.CAPTURE_PHASE5_MODEL_ADAPTER) {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.getByTestId('model-policy-bench').scrollIntoViewIfNeeded();
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({ path: process.env.CAPTURE_PHASE5_MODEL_ADAPTER, fullPage: true });
	}
	if (process.env.CAPTURE_PHASE5_POLICIES) {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.screenshot({ path: process.env.CAPTURE_PHASE5_POLICIES, fullPage: true });
	}
	if (process.env.CAPTURE_PHASE5_COMMUNICATION) {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.screenshot({ path: process.env.CAPTURE_PHASE5_COMMUNICATION, fullPage: true });
	}
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
	await expect(page.getByTestId('living-settlement')).toBeVisible();
	await expect(page.getByTestId('living-settlement')).toHaveAttribute('data-hero-pose', 'idle');
	await page.getByRole('button', { name: /Return from Floor 01/ }).click();
	await expect(page.getByRole('heading', { name: 'One core. Three promises.' })).toBeVisible();
	await page.getByRole('button', { name: /The Tempered Yard/ }).click();
	await expect(page.getByRole('dialog')).toContainText('The Tempered Yard');
	await page.getByRole('button', { name: /Bind the First Ember/ }).click();
	await expect(page.locator('.ember-council')).toContainText('safer training');
	await expect(page.locator('.ember-council')).toContainText('Mara Vey');
	await expect(page.locator('.ember-council')).toContainText('Immediate response');
	await expect(page.getByTestId('hero-social-ledger')).toContainText('5 held beliefs');
	await expect(page.getByTestId('hero-social-ledger')).toContainText('provisional authority');
	await expect(page.getByTestId('hero-social-ledger')).toContainText(
		'I will prepare this company for the tower as our founding priority.'
	);
	if (process.env.CAPTURE_PHASE5_SOCIAL) {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.screenshot({ path: process.env.CAPTURE_PHASE5_SOCIAL, fullPage: true });
	}
	if (process.env.CAPTURE_PHASE4_EMBER) {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_EMBER, fullPage: true });
	}
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
	await expect(page.getByTestId('first-ember-proof')).toContainText('committed');
	await expect(page.getByTestId('social-cognition-proof')).toContainText(
		'Hero cognition · provenance ledger'
	);
	await expect(page.getByTestId('social-cognition-proof')).toContainText('first-ember-commitment');
	await expect(page.getByTestId('social-cognition-proof')).toContainText('made-founding-promise');
	await expect(page.getByTestId('social-cognition-proof')).toContainText('consistency 7');
	await expect(page.getByTestId('communication-witness-ledger')).toContainText(
		'Communicative acts · witness chains'
	);
	await expect(page.getByTestId('communication-witness-ledger')).toContainText(
		'I am the Master of Hearth 01.'
	);
	await expect(page.getByTestId('communication-witness-ledger')).toContainText(
		'intended / addressed'
	);
	await expect(page.getByTestId('conversation-replay-turn')).toContainText('negotiated');
	await expect(page.getByTestId('conversation-replay-turn')).toContainText('preference +12');
	await page
		.getByTestId('building-training-ground')
		.getByRole('button', { name: 'assign', exact: true })
		.click();
	await expect(page.getByTestId('hero-assignment')).toContainText('training-ground');
	await expect(page.getByTestId('building-training-ground')).toContainText('powered');
	await expect(page.getByTestId('building-workshop')).toContainText('unpowered');
	await expect(page.getByTestId('pending-schedule')).toHaveText('No pending work');

	if (process.env.CAPTURE_PHASE4_OPERATIONS) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_OPERATIONS, fullPage: true });
	}

	await expect(page.getByTestId('routine-profile')).toContainText('Stable mind');
	await page.getByRole('button', { name: 'Plan day', exact: true }).click();
	await expect(page.getByTestId('daily-plan')).toContainText('Four intentions');
	await expect(page.getByTestId('daily-plan')).toContainText('pending');
	await page.getByRole('button', { name: /Follow next intention/ }).click();
	await expect(page.getByTestId('routine-resolution')).toContainText('Resolver trace');
	await expect(page.getByTestId('pending-schedule')).toContainText('hero.routine.complete');
	await expect(page.getByTestId('daily-plan')).toContainText('active');
	if (process.env.CAPTURE_PHASE4_ROUTINES) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_ROUTINES, fullPage: true });
	}
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('daily-plan')).toContainText('completed');
	await expect(page.getByText(/one daily routine resolved/i)).toBeVisible();
	await expect(page.getByTestId('replay-status')).toContainText('Verified');
	await expect(page.getByTestId('simulation-clock')).toContainText('4× real time');
	await page.getByRole('button', { name: /Simulate 6h away/ }).click();
	await expect(page.getByTestId('command-result')).toContainText('3 schedules');
	await expect(page.getByTestId('simulation-clock')).toContainText('2000-01-02');
	await expect(page.getByTestId('daily-plan')).toContainText('Day 2');
	await expect(page.getByTestId('pending-schedule')).toContainText('hero.routine.complete');
	await expect(page.getByText('simulation.clock.synced')).toBeVisible();
	if (process.env.CAPTURE_PHASE4_CATCHUP) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_CATCHUP, fullPage: true });
	}
	await page.getByRole('link', { name: /Return to settlement/ }).click();
	await expect(page.getByTestId('return-recap')).toBeVisible();
	await expect(page.getByTestId('return-recap')).toContainText('authoritative changes');
	await expect(page.getByTestId('return-recap')).toContainText('routines completed');
	if (process.env.CAPTURE_PHASE4_RECAP) {
		await page.setViewportSize({ width: 1280, height: 960 });
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_RECAP });
	}
	await page.reload();
	await expect(page.getByTestId('return-recap')).toBeVisible();
	await page.getByRole('button', { name: /Continue to settlement/ }).click();
	await expect(page.getByTestId('run-connection')).toContainText('Live');
	await page.getByRole('link', { name: 'Replay' }).click();
	await expect(page.getByTestId('replay-status')).toContainText('Verified');
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('pending-schedule')).toHaveText('No pending work');

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
	await page.getByRole('link', { name: /Return to settlement/ }).click();
	await expect(page.getByTestId('return-recap')).toBeVisible();
	await page.getByRole('button', { name: /Continue to settlement/ }).click();
	await expect(page.getByTestId('living-settlement')).toHaveAttribute('data-hero-pose', 'train');
	if (process.env.CAPTURE_PHASE4_LIVING) {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.screenshot({ path: process.env.CAPTURE_PHASE4_LIVING });
	}
	await page.getByRole('link', { name: 'Replay' }).click();
	await expect(page.getByTestId('pending-schedule')).toContainText('hero.activity.complete');
	await page.getByRole('button', { name: /Advance to outcome/ }).click();
	await expect(page.getByTestId('hero-xp')).toHaveText('2 / 12');
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

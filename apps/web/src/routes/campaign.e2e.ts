import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

test('enters the canonical Village and summons the first company in place', async ({
	page,
	request
}) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.addInitScript(() => {
		localStorage.setItem(
			'summonlab.player-settings.v2',
			JSON.stringify({
				motion: 'reduced',
				textScale: 'standard',
				controlMode: 'wait',
				sound: 'muted',
				soundCaptions: true
			})
		);
	});
	const creation = await request.post('/api/campaigns', {
		data: { seed: `campaign-e2e-${randomUUID()}`, controlMode: 'wait' }
	});
	expect(creation.status()).toBe(201);
	const { campaign, resumePath } = (await creation.json()) as {
		campaign: { runId: string };
		resumePath: string;
	};
	const campaignViewResponse = await request.get(`/api/campaigns/${campaign.runId}`);
	expect(campaignViewResponse.ok()).toBe(true);
	const campaignView = (await campaignViewResponse.json()) as {
		heroes: ReadonlyArray<{ draft: { manifest: { characterId: string } } }>;
	};
	const secondHeroId = campaignView.heroes[1]!.draft.manifest.characterId;

	const unsummonedAction = await request.post(`/api/runs/${campaign.runId}/city-actions`, {
		data: { action: 'rest', heroId: secondHeroId, expectedVersion: 0 }
	});
	expect(unsummonedAction.status()).toBe(409);
	expect((await unsummonedAction.json()).message).toBe('The requested hero has not been summoned.');
	const unsummonedConversation = await request.post(`/api/runs/${campaign.runId}/conversations`, {
		data: {
			targetHeroId: secondHeroId,
			kind: 'ask',
			exactText: 'What do you remember?',
			tone: 'reassuring',
			delivery: 'private',
			orderIntent: null
		}
	});
	expect(unsummonedConversation.status()).toBe(409);
	expect((await unsummonedConversation.json()).message).toBe(
		'The requested hero has not been summoned.'
	);

	await page.goto(resumePath);
	await expect(page).toHaveURL('/village');
	await expect(page.getByTestId('city-screen')).toBeVisible();
	await expect(page.getByTestId('campaign-onboarding')).toHaveCount(0);
	await expect(page.getByTestId('city-scene-resident')).toHaveCount(0);
	const dismissReturnSummary = async () => {
		const continueButton = page.getByRole('button', { name: 'Continue to settlement' });
		if (await continueButton.isVisible()) await continueButton.click();
	};
	const captureDirectory = process.env.CAPTURE_DIRECT_VILLAGE_SUMMON_DIR;
	const destinations = page
		.getByRole('navigation', { name: 'City destinations' })
		.getByRole('link');
	await expect(destinations).toHaveCount(5);
	if (captureDirectory) {
		await page.screenshot({ path: `${captureDirectory}/village-desktop.png`, fullPage: true });
		await page.getByRole('button', { name: 'Enter Summoning House' }).click();
		await expect(page.getByRole('dialog', { name: 'Summoning House' })).toBeVisible();
		await page.screenshot({
			path: `${captureDirectory}/summoning-house-desktop.png`,
			fullPage: true
		});
		await page.getByRole('button', { name: 'Close Summoning House' }).click();

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(destinations).toHaveCount(5);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		await page.screenshot({ path: `${captureDirectory}/village-phone.png`, fullPage: true });
		await page.getByRole('button', { name: 'Enter Summoning House' }).click();
		await expect(page.getByRole('dialog', { name: 'Summoning House' })).toBeVisible();
		await page.screenshot({
			path: `${captureDirectory}/summoning-house-phone.png`,
			fullPage: true
		});
		await page.getByRole('button', { name: 'Close Summoning House' }).click();
		await page.setViewportSize({ width: 1440, height: 1000 });
	}

	for (let ordinal = 1; ordinal <= 3; ordinal += 1) {
		await page.getByRole('button', { name: 'Enter Summoning House' }).click();
		const house = page.getByRole('dialog', { name: 'Summoning House' });
		await expect(house).toBeVisible();
		await house.getByRole('button', { name: 'Summon next hero' }).click();
		await expect(page.getByTestId('summon-reveal')).toHaveAttribute('data-phase', 'complete', {
			timeout: 15_000
		});
		await house.getByRole('button', { name: 'Return to Village' }).click();
		await expect(page.getByTestId('city-scene-resident')).toHaveCount(ordinal);
		await page.reload();
		await dismissReturnSummary();
		await expect(page.getByTestId('city-scene-resident')).toHaveCount(ordinal);
	}

	await dismissReturnSummary();
	await page.getByRole('button', { name: 'Enter Summoning House' }).click();
	const house = page.getByRole('dialog', { name: 'Summoning House' });
	for (let answered = 1; answered <= 3; answered += 1) {
		const unanswered = house.getByRole('button', { name: /Ask .* first question/u }).first();
		await unanswered.click();
		await expect(house.getByText('Answered', { exact: true })).toHaveCount(answered);
	}
	await house.getByRole('button', { name: 'Finish introductions' }).click();
	await expect(house).toHaveCount(0);
	await expect(page.getByTestId('city-scene-resident')).toHaveCount(3);

	await page
		.getByRole('navigation', { name: 'City destinations' })
		.getByRole('link', { name: 'Tower' })
		.click();
	await expect(page).toHaveURL('/tower');
	await expect(page.getByTestId('tower-screen')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Choose a floor' })).toBeVisible();
	await expect(page.locator('[data-floor]')).toHaveCount(5);
	await page.locator('[data-floor="1"]').getByRole('button', { name: 'Explore' }).click();
	await expect(page.getByRole('heading', { name: /The Unlit Muster/u })).toBeVisible();
	await expect(page.getByText(/Position f001-r016-c005/u)).toBeVisible();

	await page.reload();
	await expect(page.getByText(/Position f001-r016-c005/u)).toBeVisible();
	for (let step = 0; step < 11; step += 1) {
		await page.getByRole('button', { name: /north to/u }).click();
	}
	await expect(page.getByRole('heading', { name: /Opposition in/u })).toBeVisible();
	await expect(page.getByText(/f001-r005-c005/u)).toBeVisible();
	await page.getByRole('button', { name: 'Automated' }).click();
	await page.getByRole('button', { name: 'Run encounter' }).click();
	await expect(page.getByText(/Position f001-r005-c005/u)).toBeVisible();

	for (let step = 0; step < 4; step += 1) {
		await page.getByRole('button', { name: /north to/u }).click();
	}
	await expect(page.getByRole('heading', { name: /Opposition in/u })).toBeVisible();
	await expect(page.getByText(/f001-r001-c005/u)).toBeVisible();
	await page.getByRole('button', { name: 'Resolve turn' }).click();
	await page.getByRole('button', { name: /north to/u }).click();
	await expect(page.getByText(/Position f001-r000-c005/u)).toBeVisible();

	for (let step = 0; step < 16; step += 1) {
		await page.getByRole('button', { name: /south to/u }).click();
	}
	await page.getByRole('button', { name: 'Extract to Village' }).click();
	await expect(page.getByRole('heading', { name: /returned to Hearth 01/u })).toBeVisible();
	await page.getByRole('link', { name: 'Return to Village' }).click();
	await expect(page).toHaveURL('/village');
	await expect(page.getByTestId('city-scene-resident')).toHaveCount(3);
});

import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

test('enters the canonical Village and summons the first company in place', async ({
	page,
	request
}) => {
	test.setTimeout(120_000);
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
		await expect(page.getByTestId('city-scene-resident')).toHaveCount(ordinal);
	}

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
});

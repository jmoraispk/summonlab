import { expect, test, type APIRequestContext } from '@playwright/test';

const campaignSeed = 'village-shell-19aa1947-bcad-4fab-b2f8-e0e34a9b7eb3';
const expectedHeroNames = ['Yaso Dreno', 'Oren Sorin', 'Joror Pelleth'] as const;

async function prepareArrivedCampaign(request: APIRequestContext) {
	const creation = await request.post('/api/campaigns', {
		data: { seed: campaignSeed, controlMode: 'wait' }
	});
	expect(creation.status()).toBe(201);
	const { campaign } = (await creation.json()) as { campaign: { runId: string } };

	for (const step of [1, 2]) {
		const response = await request.post(`/api/campaigns/${campaign.runId}/onboarding`, {
			data: { step }
		});
		expect(response.ok()).toBe(true);
	}

	const viewResponse = await request.get(`/api/campaigns/${campaign.runId}`);
	expect(viewResponse.ok()).toBe(true);
	const view = (await viewResponse.json()) as {
		heroes: ReadonlyArray<{ draft: { manifest: { characterId: string; displayName: string } } }>;
		objectives: {
			objectives: ReadonlyArray<{ title: string; status: 'complete' | 'current' | 'locked' }>;
		};
	};
	expect(view.heroes.map((hero) => hero.draft.manifest.displayName)).toEqual(expectedHeroNames);

	for (const hero of view.heroes) {
		const conversation = await request.post(`/api/runs/${campaign.runId}/conversations`, {
			data: {
				targetHeroId: hero.draft.manifest.characterId,
				kind: 'ask',
				exactText: 'What do you need before we enter the tower?',
				tone: 'reassuring',
				delivery: 'private',
				orderIntent: null
			}
		});
		expect(conversation.ok()).toBe(true);
	}

	const decision = await request.post(`/api/runs/${campaign.runId}/decide`, {
		data: { directive: 'Choose what you need before we enter the tower.', trigger: 'step' }
	});
	expect(decision.ok()).toBe(true);
	expect(
		(
			await request.post(`/api/campaigns/${campaign.runId}/onboarding`, {
				data: { step: 3 }
			})
		).ok()
	).toBe(true);
	expect((await request.post(`/api/runs/${campaign.runId}/arrive`, { data: {} })).ok()).toBe(true);

	return {
		runId: campaign.runId,
		heroes: view.heroes.map((hero) => ({
			heroId: hero.draft.manifest.characterId,
			name: hero.draft.manifest.displayName
		})),
		currentMission: view.objectives.objectives.find((objective) => objective.status === 'current')!
	};
}

test('campaign City uses the shared shell, authoritative actions, and responsive dock', async ({
	page,
	request
}) => {
	test.setTimeout(90_000);
	const { runId, heroes, currentMission } = await prepareArrivedCampaign(request);
	await page.goto(`/play/${runId}`);

	await expect(page.getByTestId('city-screen')).toHaveCount(1);
	await expect(page.getByTestId('living-settlement')).toHaveCount(0);
	const desktopNav = page.getByRole('navigation', { name: 'City destinations' });
	await expect(desktopNav.getByRole('link')).toHaveCount(5);
	await expect(desktopNav.getByRole('link', { name: 'Village', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('link', { name: 'summonlab' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Journal/u })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Replay', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'New seed', exact: true })).toBeVisible();
	const sensoryControls = page.getByTestId('sensory-controls');
	await expect(sensoryControls).toBeVisible();
	await expect(sensoryControls.getByRole('button', { name: /sound/u })).toBeVisible();
	await expect(page.getByTestId('campaign-status-header')).toHaveCount(0);
	const desktopScene = page.getByTestId('city-village-viewport');
	const sceneResidents = desktopScene.getByTestId('city-scene-resident');
	await expect(sceneResidents).toHaveCount(3);
	const residentArt = sceneResidents.locator('img');
	await expect(residentArt).toHaveCount(3);
	for (const hero of heroes) {
		await expect(page.getByRole('button', { name: hero.name, exact: true })).toBeVisible();
	}
	await expect(desktopScene.locator('img.environment')).toBeVisible();
	const desktopFacilities = desktopScene.getByTestId('city-facility');
	await expect(desktopFacilities).toHaveCount(5);
	for (const label of ['Summoning Circle', 'Residence', 'Training Grounds', 'Forge', 'Portal']) {
		await expect(desktopFacilities.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(desktopFacilities.getByText('Tower Portal', { exact: true })).toHaveCount(0);
	const occupancy = page.getByLabel('City occupancy and assignment capacity');
	for (const label of ['Dorm', 'Kitchen', 'Gate', 'Training', 'Forge']) {
		await expect(occupancy.getByText(label, { exact: true })).toBeVisible();
	}

	await page.getByRole('button', { name: heroes[0]!.name, exact: true }).click();
	const quickView = page.getByTestId('resident-quick-view');
	await expect(quickView).toContainText(heroes[0]!.name);
	await quickView.getByRole('button', { name: 'Details' }).click();
	await expect(quickView).toHaveCount(0);
	await expect(page.getByTestId('resident-details')).toContainText(heroes[0]!.name);
	await page.getByRole('button', { name: 'Close resident details' }).click();

	const availableResident = sceneResidents.locator('[data-availability="available"]').first();
	await availableResident.click();
	const actionResponse = page.waitForResponse(
		(response) =>
			response.url().includes(`/api/runs/${runId}/city-actions`) &&
			response.request().method() === 'POST'
	);
	await page.getByTestId('resident-quick-view').getByRole('button', { name: 'Court training' }).click();
	const committedAction = await actionResponse;
	expect(committedAction.ok()).toBe(true);
	expect((await committedAction.json()).assignment).toEqual({
		buildingId: 'training-ground',
		role: 'trainee'
	});
	await expect(page.getByLabel('City occupancy and assignment capacity')).toContainText(
		'Training'
	);

	await page.getByRole('link', { name: 'Missions', exact: true }).click();
	await expect(page.getByTestId('village-missions')).toContainText(currentMission.title);

	await page.getByRole('link', { name: 'Inventory', exact: true }).click();
	await expect(page.getByTestId('village-inventory')).toContainText(
		'Shared Village Inventory is not established for this campaign yet.'
	);

	await page.getByRole('link', { name: 'Tower', exact: true }).click();
	await expect(page).toHaveURL(`/play/${runId}?mode=tower`);
	await expect(page.getByTestId('village-tower')).toContainText(
		'Expedition controls are not connected yet.'
	);
	await expect(page.getByRole('button', { name: /Depart|Repeat|Prepare/u })).toHaveCount(0);

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/play/${runId}`);
	const phoneScene = page.getByTestId('city-village-viewport');
	const phoneResidents = phoneScene.getByTestId('city-scene-resident');
	await expect(phoneResidents).toHaveCount(3);
	for (const resident of await phoneResidents.all()) {
		const box = await resident.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(44);
	}
	const phoneNav = page.getByRole('navigation', { name: 'City destinations' });
	const phoneLinks = phoneNav.getByRole('link');
	await expect(phoneLinks).toHaveCount(5);
	for (const link of await phoneLinks.all()) {
		const box = await link.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(44);
	}
	expect(await phoneNav.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	if (process.env.CAPTURE_VILLAGE_SHELL_DIR) {
		await page.screenshot({
			path: `${process.env.CAPTURE_VILLAGE_SHELL_DIR}/village-phone.png`,
			fullPage: true
		});
	}
});

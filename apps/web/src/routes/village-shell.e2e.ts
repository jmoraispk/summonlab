import { expect, test, type APIRequestContext } from '@playwright/test';

const campaignSeed = 'village-shell-19aa1947-bcad-4fab-b2f8-e0e34a9b7eb3';
const expectedHeroNames = ['Yaso Dreno', 'Oren Sorin', 'Joror Pelleth'] as const;

async function prepareArrivedCampaign(request: APIRequestContext) {
	const creation = await request.post('/api/campaigns', {
		data: { seed: campaignSeed, controlMode: 'wait' }
	});
	expect(creation.status()).toBe(201);
	const { campaign } = (await creation.json()) as { campaign: { runId: string } };

	for (const [index, ordinal] of [1, 2, 3].entries()) {
		const response = await request.post(`/api/campaigns/${campaign.runId}/summons`, {
			data: { ordinal, expectedSummonedHeroCount: index }
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

test('Village stays mounted after its client modules load', async ({ page, request }) => {
	test.setTimeout(90_000);
	const browserErrors: string[] = [];
	page.on('pageerror', (error) => browserErrors.push(error.message));
	await prepareArrivedCampaign(request);

	await page.goto('/village');
	await expect(page.getByTestId('city-screen')).toHaveCount(1);
	await page.waitForTimeout(1_000);

	expect(browserErrors).toEqual([]);
	await expect(page.getByText('Internal Error', { exact: true })).toHaveCount(0);
});

test('campaign City uses the shared shell, authoritative actions, and responsive dock', async ({
	page,
	request
}) => {
	test.setTimeout(90_000);
	const { runId, heroes, currentMission } = await prepareArrivedCampaign(request);
	await page.goto('/village');
	await expect(page).toHaveURL('/village');

	await expect(page.getByTestId('city-screen')).toHaveCount(1);
	await expect(page.getByTestId('run-connection')).toContainText('Live');
	await expect(page.getByTestId('living-settlement')).toHaveCount(0);
	await expect(page.locator('main > header')).toHaveCount(0);
	const desktopNav = page.getByRole('navigation', { name: 'City destinations' });
	await expect(desktopNav.getByRole('link')).toHaveCount(5);
	await expect(desktopNav.getByRole('link', { name: 'Village', exact: true })).toHaveAttribute(
		'href',
		'/village'
	);
	await expect(desktopNav.getByRole('link', { name: 'Residents', exact: true })).toHaveAttribute(
		'href',
		'/residents'
	);
	await expect(desktopNav.getByRole('link', { name: 'Tower', exact: true })).toHaveAttribute(
		'href',
		'/tower'
	);
	await expect(desktopNav.getByRole('link', { name: 'Inventory', exact: true })).toHaveAttribute(
		'href',
		'/inventory'
	);
	await expect(desktopNav.getByRole('link', { name: 'Missions', exact: true })).toHaveAttribute(
		'href',
		'/missions'
	);
	await expect(desktopNav.getByRole('link', { name: 'Village', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('link', { name: 'summonlab' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Journal/u })).toHaveCount(0);
	await expect(page.getByTestId('campaign-status-header')).toHaveCount(0);
	await expect(page.getByTestId('city-clock')).toContainText(/Day \d+/u);
	const desktopScene = page.getByTestId('city-village-viewport');
	const desktopWorld = desktopScene.getByTestId('city-world');
	const [desktopViewportBox, desktopWorldBox] = await Promise.all([
		desktopScene.boundingBox(),
		desktopWorld.boundingBox()
	]);
	expect(desktopWorldBox!.x).toBeLessThanOrEqual(desktopViewportBox!.x + 1);
	expect(desktopWorldBox!.y).toBeLessThanOrEqual(desktopViewportBox!.y + 1);
	expect(desktopWorldBox!.x + desktopWorldBox!.width).toBeGreaterThanOrEqual(
		desktopViewportBox!.x + desktopViewportBox!.width - 1
	);
	expect(desktopWorldBox!.y + desktopWorldBox!.height).toBeGreaterThanOrEqual(
		desktopViewportBox!.y + desktopViewportBox!.height - 1
	);
	const sceneResidents = desktopScene.getByTestId('city-scene-resident');
	await expect(sceneResidents).toHaveCount(3);
	const residentArt = sceneResidents.locator('img');
	await expect(residentArt).toHaveCount(3);
	for (const hero of heroes) {
		await expect(page.locator(`#city-resident-${hero.heroId}`)).toBeVisible();
	}
	await expect(page.getByLabel('Find a resident')).toHaveCount(0);
	await expect(desktopScene.getByRole('group', { name: 'Village camera controls' })).toBeVisible();
	await expect(desktopScene.locator('img.environment')).toBeVisible();
	const desktopFacilities = desktopScene.getByTestId('city-facility');
	const desktopFacilityLabels = desktopScene.getByTestId('city-facility-label');
	await expect(desktopFacilities).toHaveCount(5);
	await expect(desktopFacilityLabels).toHaveCount(5);
	for (const label of ['Summoning Circle', 'Residence', 'Training Grounds', 'Forge', 'Portal']) {
		await expect(desktopFacilityLabels.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(desktopFacilityLabels.getByText('Tower Portal', { exact: true })).toHaveCount(0);
	const occupancy = page.getByLabel('People in each place');
	for (const label of ['Dorm', 'Kitchen', 'Gate', 'Training', 'Forge']) {
		await expect(occupancy.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(occupancy.locator('li b')).toHaveCount(5);
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await expect(desktopScene).toHaveAttribute('data-zoom-percent', '125');
	await page.getByRole('button', { name: 'Fit Village' }).click();
	await expect(desktopScene).toHaveAttribute('data-zoom-percent', '100');
	await desktopScene.focus();
	await page.keyboard.press('+');
	await expect(desktopScene).toHaveAttribute('data-zoom-percent', '120');
	await page.keyboard.press('Home');
	await expect(desktopScene).toHaveAttribute('data-zoom-percent', '100');

	await page.locator(`#city-resident-${heroes[0]!.heroId}`).click();
	const quickView = page.getByTestId('resident-quick-view');
	await expect(quickView).toContainText(heroes[0]!.name);
	await quickView.getByRole('button', { name: 'Details' }).click();
	await expect(quickView).toHaveCount(0);
	await expect(page.getByTestId('resident-details')).toContainText(heroes[0]!.name);
	await page.getByRole('button', { name: 'Close resident details' }).click();

	const availableResident = page
		.locator('[data-testid="city-scene-resident"][data-availability="available"]')
		.first();
	await availableResident.click();
	const actionResponse = page.waitForResponse(
		(response) =>
			response.url().includes(`/api/runs/${runId}/city-actions`) &&
			response.request().method() === 'POST'
	);
	await page
		.getByTestId('resident-quick-view')
		.getByRole('button', { name: 'Court training' })
		.click();
	const committedAction = await actionResponse;
	expect(committedAction.ok()).toBe(true);
	expect((await committedAction.json()).assignment).toMatchObject({
		buildingId: 'training-ground',
		role: 'trainee'
	});
	await expect(page.getByLabel('People in each place')).toContainText('Training');

	const restingResident = page
		.locator('[data-testid="city-scene-resident"][data-availability="available"]')
		.first();
	await restingResident.click();
	const restResponse = page.waitForResponse(
		(response) =>
			response.url().includes(`/api/runs/${runId}/city-actions`) &&
			response.request().method() === 'POST'
	);
	await page.getByTestId('resident-quick-view').getByRole('button', { name: 'Rest' }).click();
	const committedRest = await restResponse;
	expect(committedRest.ok()).toBe(true);
	expect((await committedRest.json()).assignment).toMatchObject({
		buildingId: 'dormitory',
		role: 'resident'
	});
	await expect(page.getByTestId('resident-quick-view').locator('button:disabled')).toHaveCount(0);

	await page.getByRole('link', { name: 'Missions', exact: true }).click();
	await expect(page).toHaveURL('/missions');
	await expect(page.getByTestId('village-missions')).toContainText(currentMission.title);

	await page.getByRole('link', { name: 'Inventory', exact: true }).click();
	await expect(page).toHaveURL('/inventory');
	await expect(page.getByTestId('village-inventory')).toContainText(
		'Shared Village Inventory is not established for this campaign yet.'
	);

	await page.getByRole('link', { name: 'Tower', exact: true }).click();
	await expect(page).toHaveURL('/tower');
	await expect(page.getByTestId('tower-screen')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Choose a floor' })).toBeVisible();
	await expect(
		page.locator('[data-floor="1"]').getByRole('button', { name: 'Explore', exact: true })
	).toBeEnabled();

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/village');
	const phoneScene = page.getByTestId('city-village-viewport');
	const phoneWorld = phoneScene.getByTestId('city-world');
	const [phoneViewportBox, phoneWorldBox] = await Promise.all([
		phoneScene.boundingBox(),
		phoneWorld.boundingBox()
	]);
	expect(phoneWorldBox!.x).toBeLessThanOrEqual(phoneViewportBox!.x + 1);
	expect(phoneWorldBox!.y).toBeLessThanOrEqual(phoneViewportBox!.y + 1);
	expect(phoneWorldBox!.x + phoneWorldBox!.width).toBeGreaterThanOrEqual(
		phoneViewportBox!.x + phoneViewportBox!.width - 1
	);
	expect(phoneWorldBox!.y + phoneWorldBox!.height).toBeGreaterThanOrEqual(
		phoneViewportBox!.y + phoneViewportBox!.height - 1
	);
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

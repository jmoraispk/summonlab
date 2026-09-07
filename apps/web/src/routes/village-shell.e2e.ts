import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext } from '@playwright/test';

async function prepareArrivedCampaign(request: APIRequestContext) {
	const creation = await request.post('/api/campaigns', {
		data: { seed: `village-shell-${randomUUID()}`, controlMode: 'wait' }
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
		heroNames: view.heroes.map((hero) => hero.draft.manifest.displayName),
		currentMission: view.objectives.objectives.find((objective) => objective.status === 'current')!
	};
}

test('persistent Village shell connects campaign destinations on desktop and phone', async ({
	page,
	request
}) => {
	test.setTimeout(90_000);
	const { runId, heroNames, currentMission } = await prepareArrivedCampaign(request);
	await page.goto(`/play/${runId}`);

	const desktopNav = page.getByRole('navigation', { name: 'Village destinations' });
	await expect(desktopNav.getByRole('link')).toHaveCount(4);
	await expect(desktopNav.getByRole('link', { name: 'Village', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('link', { name: 'summonlab' })).toBeVisible();
	await expect(page.getByTestId('campaign-status-header')).toHaveCount(0);
	const desktopScene = page.getByTestId('living-settlement');
	const sceneResidents = desktopScene.getByTestId('village-scene-resident');
	await expect(sceneResidents).toHaveCount(3);
	for (const heroName of heroNames)
		await expect(desktopScene.getByText(heroName, { exact: true })).toBeVisible();
	await expect(desktopScene).not.toContainText('Dara Zev');
	await expect(desktopScene).not.toContainText('Mara Vey');
	await expect(desktopScene.getByText('Authoritative world')).toBeVisible();
	await expect(
		desktopScene.locator('[aria-label="Settlement occupancy and assignment capacity"]')
	).toBeVisible();
	if (process.env.CAPTURE_VILLAGE_SHELL_DIR) {
		await page.screenshot({
			path: `${process.env.CAPTURE_VILLAGE_SHELL_DIR}/village-desktop.png`,
			fullPage: true
		});
	}

	await desktopNav.getByRole('link', { name: 'Residents', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/play/${runId}\\?mode=residents$`, 'u'));
	const residents = page.getByTestId('village-residents');
	await expect(residents.getByTestId('village-resident')).toHaveCount(3);
	for (const heroName of heroNames) await expect(residents).toContainText(heroName);
	if (process.env.CAPTURE_VILLAGE_SHELL_DIR) {
		await page.screenshot({
			path: `${process.env.CAPTURE_VILLAGE_SHELL_DIR}/residents-desktop.png`,
			fullPage: true
		});
	}

	await page.getByRole('link', { name: 'Missions', exact: true }).click();
	await expect(page.getByTestId('village-missions')).toContainText(currentMission.title);

	await page.getByRole('link', { name: 'Inventory', exact: true }).click();
	await expect(page.getByTestId('village-inventory')).toContainText(
		'Shared Village Inventory is not established for this campaign yet.'
	);

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/play/${runId}`);
	const phoneNav = page.getByRole('navigation', { name: 'Village destinations' });
	const phoneLinks = phoneNav.getByRole('link');
	await expect(phoneLinks).toHaveCount(4);
	const approvedIconPaths = [
		'/ui/village-nav/village.png',
		'/ui/village-nav/residents.png',
		'/ui/village-nav/inventory.png',
		'/ui/village-nav/missions.png'
	];
	for (const [index, link] of (await phoneLinks.all()).entries()) {
		const box = await link.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(44);
		await expect(link.getByTestId('plan-nav-icon')).toHaveAttribute(
			'src',
			approvedIconPaths[index]!
		);
	}
	const navBox = await phoneNav.boundingBox();
	const objectiveBox = await page.getByTestId('active-objective').boundingBox();
	expect(objectiveBox!.y + objectiveBox!.height).toBeLessThanOrEqual(navBox!.y);
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

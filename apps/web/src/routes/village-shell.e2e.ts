import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';

const campaignSeed = 'village-shell-19aa1947-bcad-4fab-b2f8-e0e34a9b7eb3';
const expectedHeroNames = ['Yaso Dreno', 'Oren Sorin', 'Joror Pelleth'] as const;

interface Box {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

function boxesIntersect(left: Box, right: Box): boolean {
	return (
		left.x < right.x + right.width &&
		left.x + left.width > right.x &&
		left.y < right.y + right.height &&
		left.y + left.height > right.y
	);
}

async function expectPairwiseNonIntersecting(locator: Locator, label: string) {
	const boxes = await Promise.all((await locator.all()).map((entry) => entry.boundingBox()));
	for (const [index, box] of boxes.entries()) {
		expect(box, `${label} ${index + 1} must have rendered bounds`).not.toBeNull();
		for (let other = index + 1; other < boxes.length; other += 1) {
			expect(
				boxesIntersect(box!, boxes[other]!),
				`${label} ${index + 1} ${JSON.stringify(box)} and ${other + 1} ${JSON.stringify(boxes[other])} must not intersect`
			).toBe(false);
		}
	}
}

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

test('persistent Village shell connects campaign destinations on desktop and phone', async ({
	page,
	request
}) => {
	test.setTimeout(90_000);
	const { runId, heroes, currentMission } = await prepareArrivedCampaign(request);
	await page.goto(`/play/${runId}`);

	const desktopNav = page.getByRole('navigation', { name: 'Village destinations' });
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
	const desktopScene = page.getByTestId('living-settlement');
	const sceneResidents = desktopScene.getByTestId('village-scene-resident');
	await expect(sceneResidents).toHaveCount(3);
	const residentArt = desktopScene.locator('img.village-resident-art');
	await expect(residentArt).toHaveCount(3);
	await expect(desktopScene).not.toContainText('Art pending');
	for (const hero of heroes) {
		await expect(desktopScene.getByText(hero.name, { exact: true })).toBeVisible();
	}
	await expectPairwiseNonIntersecting(sceneResidents, 'desktop resident link');
	await expectPairwiseNonIntersecting(
		desktopScene.locator('.activity-tag'),
		'desktop resident tag'
	);
	for (const art of await residentArt.all()) {
		await expect(art).toBeVisible();
		const cornerAlpha = await art.evaluate(async (element) => {
			const image = element as HTMLImageElement;
			if (!image.complete) {
				await new Promise<void>((resolve, reject) => {
					image.addEventListener('load', () => resolve(), { once: true });
					image.addEventListener('error', () => reject(new Error('Resident art failed to load')), {
						once: true
					});
				});
			}
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d', { willReadFrequently: true });
			if (!context) throw new Error('Canvas 2D context unavailable');
			context.drawImage(image, 0, 0);
			return context.getImageData(0, 0, 1, 1).data[3];
		});
		expect(cornerAlpha).toBe(0);
	}
	await expect(desktopScene).not.toContainText('Dara Zev');
	await expect(desktopScene).not.toContainText('Mara Vey');
	await expect(desktopScene.locator('img.environment')).toBeVisible();
	const desktopFacilities = desktopScene.getByTestId('village-facility');
	await expect(desktopFacilities).toHaveCount(5);
	for (const label of [
		'Summoning Circle',
		'Residence',
		'Training Grounds',
		'Forge',
		'Tower Portal'
	]) {
		await expect(desktopFacilities.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(desktopFacilities.getByText('Kitchen', { exact: true })).toHaveCount(0);
	await expect(desktopFacilities.getByText('Dorm', { exact: true })).toHaveCount(0);
	await expect(desktopScene.locator('.time-plaque')).toBeVisible();
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

	for (const hero of heroes) {
		await page.goto(`/play/${runId}`);
		await page
			.getByTestId('living-settlement')
			.getByRole('link', { name: new RegExp(`^${hero.name}:`, 'u') })
			.click();
		await expect(page).toHaveURL(
			new RegExp(`/play/${runId}\\?mode=residents#resident-${hero.heroId}$`, 'u')
		);
		const residents = page.getByTestId('village-residents');
		await expect(residents.getByTestId('village-resident')).toHaveCount(3);
		await expect(page.locator(`#resident-${hero.heroId}`)).toBeVisible();
		await expect(residents).toContainText(hero.name);
	}

	await page.goto(`/play/${runId}`);
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
	const phoneScene = page.getByTestId('living-settlement');
	const phoneResidents = phoneScene.getByTestId('village-scene-resident');
	const phoneResidentArt = phoneScene.locator('img.village-resident-art');
	await expect(phoneResidents).toHaveCount(3);
	await expect(phoneResidentArt).toHaveCount(3);
	for (const [index, hero] of heroes.entries()) {
		await expect(phoneResidentArt.nth(index)).toBeVisible();
		await expect(phoneScene.getByText(hero.name, { exact: true })).toBeVisible();
		await expect(
			phoneScene.getByRole('link', { name: new RegExp(`^${hero.name}:`, 'u') })
		).toBeVisible();
	}
	for (const resident of await phoneResidents.all()) {
		const box = await resident.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(44);
	}
	await expectPairwiseNonIntersecting(phoneResidents, 'phone resident link');
	await expectPairwiseNonIntersecting(phoneScene.locator('.activity-tag'), 'phone resident tag');
	await expect(page.getByRole('button', { name: /Journal/u })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Replay', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'New seed', exact: true })).toBeVisible();
	await expect(sensoryControls).toBeVisible();
	await expect(sensoryControls.getByRole('button', { name: /sound/u })).toBeVisible();
	const soundBox = await sensoryControls.boundingBox();
	const timeBox = await phoneScene.locator('.time-plaque').boundingBox();
	expect(soundBox).not.toBeNull();
	expect(timeBox).not.toBeNull();
	expect(
		boxesIntersect(soundBox!, timeBox!),
		`phone sound ${JSON.stringify(soundBox)} and time ${JSON.stringify(timeBox)} controls must not intersect`
	).toBe(false);
	const phoneNav = page.getByRole('navigation', { name: 'Village destinations' });
	const phoneLinks = phoneNav.getByRole('link');
	await expect(phoneLinks).toHaveCount(5);
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

import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('forges, equips, and reloads one source-bound Standard item on phone', async ({ page }) => {
	test.setTimeout(120_000);
	const creation = await page.request.post('/api/dev/equipment-runs', {
		data: { seed: 'equipment-forging-phone-e2e' }
	});
	expect(creation.ok()).toBe(true);
	const fixture = (await creation.json()) as {
		runId: string;
		heroId: string;
	};

	await page.goto('/village', { waitUntil: 'domcontentloaded' });
	await expect(page).toHaveURL('/village');
	await expect(page.locator('html')).toHaveAttribute('data-player-ready', 'true');
	const workshop = page.getByTestId('equipment-workshop');
	await expect(workshop).toBeVisible();
	await expect(workshop.getByRole('heading', { name: 'The forge ledger' })).toBeVisible();
	const swordChoice = workshop.getByRole('button', { name: /Bronze Sword/ });
	await expect(swordChoice).toBeVisible();
	await swordChoice.click();
	await expect(swordChoice).toHaveAttribute('aria-pressed', 'true');
	const assay = page.getByTestId('equipment-assay');
	await expect(assay).toContainText('Bronze Sword');
	await expect(assay).toContainText('Standard');
	await expect(assay).toContainText('F base · F final');
	await expect(assay.locator('img')).toHaveAttribute('src', /\/detail\.[a-f0-9]{12}\.webp$/u);

	const equipmentResources = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.map((entry) => entry.name)
			.filter((name) => name.includes('/runtime/equipment-v1/'))
	);
	expect(equipmentResources.filter((name) => name.includes('/detail.'))).toHaveLength(1);
	expect(equipmentResources.length).toBeLessThan(20);
	if (process.env.CAPTURE_EQUIPMENT_WORKSHOP_ASSAY) {
		await workshop.getByRole('button', { name: /Forge Standard item/ }).focus();
		await assay.evaluate((element) => element.scrollIntoView({ block: 'start' }));
		await page.screenshot({
			path: process.env.CAPTURE_EQUIPMENT_WORKSHOP_ASSAY
		});
	}

	let forgeIdempotencyKey = '';
	page.on('request', (request) => {
		if (request.method() !== 'POST' || !request.url().endsWith('/equipment')) return;
		const body = request.postDataJSON() as { action?: string } | null;
		if (body?.action === 'forge') {
			forgeIdempotencyKey = request.headers()['idempotency-key'] ?? '';
		}
	});
	await workshop.getByRole('button', { name: /Forge Standard item/ }).click();
	await expect(page.getByTestId('forging-status')).toContainText('Bronze Sword');
	expect(forgeIdempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
	const replay = await page.request.post(`/api/runs/${fixture.runId}/equipment`, {
		headers: { 'Idempotency-Key': forgeIdempotencyKey },
		data: {
			action: 'forge',
			heroId: fixture.heroId,
			definitionId: 'equipment-bronze-sword'
		}
	});
	expect(replay.ok()).toBe(true);
	expect((await replay.json()).idempotentReplay).toBe(true);

	const projectionResponse = await page.request.get(
		`/api/runs/${fixture.runId}/equipment?heroId=${fixture.heroId}`
	);
	expect(projectionResponse.ok()).toBe(true);
	const projection = (await projectionResponse.json()) as {
		currentForging: { completesAt: string } | null;
	};
	expect(projection.currentForging).not.toBeNull();
	const clockResponse = await page.request.get(`/api/runs/${fixture.runId}/clock`);
	expect(clockResponse.ok()).toBe(true);
	const clock = (await clockResponse.json()) as {
		nextDueGameTime: string | null;
		nextDueRealTime: string | null;
	};
	expect(clock.nextDueGameTime).toBe(projection.currentForging?.completesAt);
	expect(clock.nextDueRealTime).not.toBeNull();
	const completion = await page.request.post(`/api/runs/${fixture.runId}/catch-up`, {
		data: { wallTime: clock.nextDueRealTime }
	});
	expect(completion.ok()).toBe(true);

	await page.reload({ waitUntil: 'domcontentloaded' });
	const forgedItem = page
		.getByTestId('equipment-inventory-item')
		.filter({ hasText: 'Bronze Sword' })
		.filter({ hasText: 'Forged' });
	await expect(forgedItem).toHaveCount(1);
	await expect(forgedItem).toContainText('standard');
	await expect(forgedItem).toContainText('F / main hand');
	await forgedItem.getByRole('button', { name: 'Equip' }).click();
	await expect(forgedItem).toContainText('Equipped');

	await page.reload({ waitUntil: 'domcontentloaded' });
	const persistedItem = page
		.getByTestId('equipment-inventory-item')
		.filter({ hasText: 'Bronze Sword' })
		.filter({ hasText: 'Forged' });
	await expect(persistedItem).toContainText('Equipped');
	await expect(page.getByTestId('equipment-loadout')).toContainText('Bronze Sword');
	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(1);

	if (process.env.CAPTURE_EQUIPMENT_WORKSHOP_PHONE) {
		await page
			.getByTestId('equipment-inventory-item')
			.filter({ hasText: 'Ash Bow' })
			.getByRole('button', { name: 'Equip' })
			.focus();
		await workshop
			.getByRole('heading', { name: 'Equipment inventory' })
			.evaluate((element) => element.scrollIntoView({ block: 'start' }));
		await page.screenshot({
			path: process.env.CAPTURE_EQUIPMENT_WORKSHOP_PHONE
		});
	}
});

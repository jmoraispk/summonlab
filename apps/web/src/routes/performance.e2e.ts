import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PhonePerformanceReportSchema, type PhonePerformanceReport } from '@summonlab/contracts';

import buildBudget from '../../../../docs/evidence/phase-3-runtime-budget.json' with { type: 'json' };

const profile = {
	name: 'mid-range-phone-390x844-2x',
	viewportWidth: 390,
	viewportHeight: 844,
	deviceScaleFactor: 2,
	networkLatencyMs: 150,
	downloadBytesPerSecond: 200_000,
	uploadBytesPerSecond: 93_750,
	cpuSlowdownMultiplier: 4
} as const;

const budgets = {
	interactiveShellMs: 4_000,
	initialJavaScriptGzipBytes: 700_000,
	playerTitleVisualBytes: 100_000,
	firstSettlementVisualBytes: 8_000_000,
	minimumActiveSceneFramesPerSecond: 30,
	interfaceResponseMs: 150,
	reconnectMs: 4_000,
	rendererWorkingSetReferenceBytes: 300_000_000
} as const;

async function prepareArrivedCampaign(request: APIRequestContext): Promise<string> {
	const creation = await request.post('/api/campaigns', {
		data: { seed: `fin005-${randomUUID()}`, controlMode: 'wait' }
	});
	expect(creation.ok()).toBe(true);
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
		heroes: ReadonlyArray<{ draft: { manifest: { characterId: string } } }>;
	};
	for (const hero of view.heroes) {
		const response = await request.post(`/api/runs/${campaign.runId}/conversations`, {
			data: {
				targetHeroId: hero.draft.manifest.characterId,
				kind: 'ask',
				exactText: 'What do you need before we enter the tower?',
				tone: 'reassuring',
				delivery: 'private',
				orderIntent: null
			}
		});
		expect(response.ok()).toBe(true);
	}
	const decision = await request.post(`/api/runs/${campaign.runId}/decide`, {
		data: { directive: 'Choose what you need before we enter the tower.', trigger: 'step' }
	});
	expect(decision.ok()).toBe(true);
	const completion = await request.post(`/api/campaigns/${campaign.runId}/onboarding`, {
		data: { step: 3 }
	});
	expect(completion.ok()).toBe(true);
	const arrival = await request.post(`/api/runs/${campaign.runId}/arrive`, { data: {} });
	expect(arrival.ok()).toBe(true);
	return campaign.runId;
}

async function waitForPlayerReady(page: Page) {
	await page.waitForFunction(() => document.documentElement.dataset.playerReady === 'true');
}

async function measureInterfaceResponse(page: Page): Promise<number> {
	const duration = await page.evaluate(
		() =>
			new Promise<number>((resolve) => {
				const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Pause menu"]');
				if (!trigger) throw new Error('Pause trigger is unavailable');
				const startedAt = performance.now();
				trigger.click();
				const observe = () => {
					if (document.querySelector('[role="dialog"][aria-label="Paused campaign menu"]')) {
						resolve(performance.now() - startedAt);
						return;
					}
					requestAnimationFrame(observe);
				};
				requestAnimationFrame(observe);
			})
	);
	await page.getByRole('button', { name: 'Resume game' }).click();
	await expect(page.getByRole('dialog', { name: 'Paused campaign menu' })).toBeHidden();
	return duration;
}

async function measureFrames(page: Page, durationMs: number): Promise<number> {
	return page.evaluate(
		(duration) =>
			new Promise<number>((resolve) => {
				const frames: number[] = [];
				const startedAt = performance.now();
				const sample = (timestamp: number) => {
					frames.push(timestamp);
					if (performance.now() - startedAt < duration) requestAnimationFrame(sample);
					else {
						const elapsed = frames.at(-1)! - frames[0]!;
						resolve(((frames.length - 1) * 1_000) / elapsed);
					}
				};
				requestAnimationFrame(sample);
			}),
		durationMs
	);
}

test('meets the complete target-phone performance budget', async ({ browser, request }) => {
	test.setTimeout(120_000);
	const runId = await prepareArrivedCampaign(request);
	const context = await browser.newContext({
		viewport: { width: profile.viewportWidth, height: profile.viewportHeight },
		deviceScaleFactor: profile.deviceScaleFactor,
		isMobile: true,
		hasTouch: true,
		reducedMotion: 'no-preference'
	});
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send('Network.enable');
	await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
	await cdp.send('Network.emulateNetworkConditions', {
		offline: false,
		latency: profile.networkLatencyMs,
		downloadThroughput: profile.downloadBytesPerSecond,
		uploadThroughput: profile.uploadBytesPerSecond,
		connectionType: 'cellular4g'
	});
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdownMultiplier });

	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await waitForPlayerReady(page);
	const interactiveShellMs = await page.evaluate(
		() => performance.getEntriesByName('summonlab:player-ready').at(-1)?.startTime ?? Infinity
	);
	await expect(page.getByTestId('campaign-title')).toBeVisible();
	await page.waitForFunction(() => {
		const image = document.querySelector<HTMLImageElement>('.key-art');
		return Boolean(image?.complete && image.naturalWidth > 0);
	});
	const titleResources = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.map((entry) => entry as PerformanceResourceTiming)
			.filter((entry) => entry.name.includes('/runtime/player/title-'))
			.map((entry) => ({ name: entry.name, encodedBodySize: entry.encodedBodySize }))
	);
	expect(titleResources).toHaveLength(1);
	expect(titleResources[0]!.name).toContain('title-phone');
	const playerTitleVisualBytes = titleResources[0]!.encodedBodySize;
	expect(playerTitleVisualBytes).toBeLessThanOrEqual(budgets.playerTitleVisualBytes);
	expect(interactiveShellMs).toBeLessThanOrEqual(budgets.interactiveShellMs);

	await page.goto(`/play/${runId}`, { waitUntil: 'domcontentloaded' });
	await waitForPlayerReady(page);
	await expect(page.getByTestId('living-settlement')).toBeVisible();
	await page.waitForFunction(() =>
		[...document.images]
			.filter((image) => image.closest('[data-testid="living-settlement"], .hero-hud'))
			.every((image) => image.complete && image.naturalWidth > 0)
	);
	const reconnectMs = await page.evaluate(() => performance.now());
	const playResources = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.map((entry) => entry as PerformanceResourceTiming)
			.map((entry) => ({
				name: entry.name,
				initiatorType: entry.initiatorType,
				encodedBodySize: entry.encodedBodySize
			}))
	);
	const settlementResources = playResources.filter((resource) =>
		resource.name.includes('/runtime/settlements/hearth-01/')
	);
	expect(settlementResources.some((resource) => resource.name.includes('/hearth-01/'))).toBe(true);
	expect(
		playResources.some(
			(resource) =>
				resource.initiatorType === 'img' &&
				resource.name.endsWith('.png') &&
				!resource.name.includes('/ui/village-nav/')
		)
	).toBe(false);
	const villageNavigationBytes = playResources
		.filter((resource) => resource.name.includes('/ui/village-nav/'))
		.reduce((total, resource) => total + resource.encodedBodySize, 0);
	expect(villageNavigationBytes).toBeLessThanOrEqual(128 * 1_024);
	const firstSettlementVisualBytes = settlementResources.reduce(
		(total, resource) => total + resource.encodedBodySize,
		0
	);
	expect(firstSettlementVisualBytes).toBeLessThanOrEqual(budgets.firstSettlementVisualBytes);
	expect(reconnectMs).toBeLessThanOrEqual(budgets.reconnectMs);
	if (process.env.CAPTURE_FIN005_SCREENSHOT) {
		await page.screenshot({ path: process.env.CAPTURE_FIN005_SCREENSHOT, fullPage: true });
	}

	const interfaceSamples: number[] = [];
	for (let index = 0; index < 5; index += 1) {
		interfaceSamples.push(await measureInterfaceResponse(page));
	}
	interfaceSamples.sort((left, right) => left - right);
	const interfaceResponseP95Ms = interfaceSamples[Math.ceil(interfaceSamples.length * 0.95) - 1]!;
	expect(interfaceResponseP95Ms).toBeLessThanOrEqual(budgets.interfaceResponseMs);

	const frameSampleDurationMs = 2_000;
	const activeSceneFramesPerSecond = await measureFrames(page, frameSampleDurationMs);
	expect(activeSceneFramesPerSecond).toBeGreaterThanOrEqual(
		budgets.minimumActiveSceneFramesPerSecond
	);

	await cdp.send('Performance.enable');
	const metrics = await cdp.send('Performance.getMetrics');
	const javascriptHeapBytes = Math.round(
		metrics.metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? Infinity
	);
	const decodedImageBytes = await page.evaluate(() =>
		[...document.images].reduce(
			(total, image) => total + image.naturalWidth * image.naturalHeight * 4,
			0
		)
	);
	const rendererWorkingSetReferenceBytes = javascriptHeapBytes + decodedImageBytes;
	expect(rendererWorkingSetReferenceBytes).toBeLessThanOrEqual(
		budgets.rendererWorkingSetReferenceBytes
	);

	const report: PhonePerformanceReport = PhonePerformanceReportSchema.parse({
		schemaVersion: 'phone-performance-report-v1',
		recordedAt: new Date().toISOString(),
		sourceRevision: process.env.SUMMONLAB_COMMIT_SHA ?? 'working-tree',
		profile,
		budgets,
		measurements: {
			interactiveShellMs: Math.round(interactiveShellMs * 10) / 10,
			initialJavaScriptGzipBytes: buildBudget.measurements.initialJavaScriptGzipBytes,
			playerTitleVisualBytes,
			firstSettlementVisualBytes,
			activeSceneFramesPerSecond: Math.round(activeSceneFramesPerSecond * 10) / 10,
			interfaceResponseP95Ms: Math.round(interfaceResponseP95Ms * 10) / 10,
			reconnectMs: Math.round(reconnectMs * 10) / 10,
			javascriptHeapBytes,
			decodedImageBytes,
			rendererWorkingSetReferenceBytes
		},
		status: {
			interactiveShell: 'within-budget',
			initialJavaScript: 'within-budget',
			playerTitleVisual: 'within-budget',
			firstSettlementVisuals: 'within-budget',
			activeSceneFrames: 'within-budget',
			interfaceResponse: 'within-budget',
			reconnect: 'within-budget',
			rendererWorkingSetReference: 'within-budget'
		},
		methodology: {
			browser: 'chromium',
			interfaceSamples: interfaceSamples.length,
			frameSampleDurationMs,
			memoryScope: 'javascript-heap-plus-decoded-images',
			realDeviceReview: 'required'
		}
	});
	if (process.env.CAPTURE_FIN005_REPORT) {
		await writeFile(process.env.CAPTURE_FIN005_REPORT, `${JSON.stringify(report, null, 2)}\n`);
	}
	await context.close();
});

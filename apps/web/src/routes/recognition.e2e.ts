import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('audits approved identity states and phone delivery without auto-approval', async ({
	page
}) => {
	await page.goto('/visual-lab/recognition');

	await expect(page.getByRole('heading', { name: /Recognize her/ })).toBeVisible();
	await expect(page.getByText('pending human review')).toBeVisible();
	await expect(page.getByTestId('phone-texture-ledger')).toContainText(
		'hero.ember-01-anchor-v1.roster'
	);
	await expect(page.getByText('47.8 KB over the wire')).toBeVisible();

	const settlementNightWalk = page.getByRole('radio', { name: /Settlement night walk/ });
	await settlementNightWalk.click();
	await expect(settlementNightWalk).toBeChecked();
	await expect(page.getByTestId('recognition-stage')).toContainText('48×86 CSS px', {
		timeout: 15_000
	});
	await expect
		.poll(async () => Math.round((await page.locator('.actual-scale').boundingBox())?.width ?? 0))
		.toBe(48);
	await expect
		.poll(async () => Math.round((await page.locator('.actual-scale').boundingBox())?.height ?? 0))
		.toBe(86);
	await expect(page.getByTestId('recognition-cues')).toContainText('not claimed at this distance');
	await expect(page.getByTestId('recognition-cues').getByText('human check required')).toHaveCount(
		4
	);

	await page.getByRole('radio', { name: /Mission exertion/ }).click();
	await expect
		.poll(async () => {
			const text = await page.getByTestId('interaction-latency').locator('strong').textContent();
			return Number.parseFloat(text ?? 'Infinity');
		})
		.toBeLessThan(150);
	await expect
		.poll(async () => {
			const text = await page.getByTestId('observed-fps').locator('strong').textContent();
			return Number.parseFloat(text ?? '0');
		})
		.toBeGreaterThanOrEqual(30);

	const reviewConsole = page.getByTestId('review-console');
	for (const button of await reviewConsole
		.getByRole('button', { name: 'Pass', exact: true })
		.all()) {
		await button.click();
	}
	await reviewConsole.getByLabel('Reviewer').fill('test:recognition-e2e');
	await reviewConsole
		.getByLabel('Observation')
		.fill('Mission-scale identity survives motion and equipment stress.');
	await reviewConsole.getByRole('button', { name: 'Record pass' }).click();
	await expect(reviewConsole).toContainText('Recorded pass evidence for Mission exertion.');
	await expect(reviewConsole).toContainText('Latest evidencepass');

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);

	if (process.env.CAPTURE_PHASE3_RECOGNITION) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE3_RECOGNITION, fullPage: true });
	}

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload();
	await page.getByRole('radio', { name: /Settlement night walk/ }).click();
	await expect(page.getByText('reduced motion active')).toBeVisible();
	await expect
		.poll(() =>
			page
				.locator('.actual-scale .figure')
				.evaluate((element) => getComputedStyle(element).animationName)
		)
		.toBe('none');
});

test('binds recognition evidence to the current audit and exact required cues', async ({
	request
}) => {
	const audit = JSON.parse(
		await readFile(
			new URL('../../../../assets/heroes/visuals/recognition-audit.json', import.meta.url),
			'utf8'
		)
	) as {
		auditHash: string;
		catalogVersion: string;
		characterId: string;
		cases: Array<{ caseId: string; requiredCues: string[] }>;
	};
	const auditCase = audit.cases.find((candidate) => candidate.caseId === 'settlement-night-walk')!;
	const payload = {
		reviewId: randomUUID(),
		auditHash: audit.auditHash,
		catalogVersion: audit.catalogVersion,
		characterId: audit.characterId,
		caseId: auditCase.caseId,
		outcomes: auditCase.requiredCues.map((cue) => ({ cue, verdict: 'pass' })),
		verdict: 'pass',
		note: 'Automated recognition API contract proof.',
		reviewer: 'test:playwright-api'
	};

	const created = await request.post('/api/dev/recognition-reviews', { data: payload });
	expect(created.status()).toBe(201);
	expect((await created.json()).reviewId).toBe(payload.reviewId);
	const retried = await request.post('/api/dev/recognition-reviews', { data: payload });
	expect(retried.status()).toBe(200);
	const conflicted = await request.post('/api/dev/recognition-reviews', {
		data: { ...payload, note: 'A conflicting retry.' }
	});
	expect(conflicted.status()).toBe(409);
	const stale = await request.post('/api/dev/recognition-reviews', {
		data: { ...payload, reviewId: randomUUID(), auditHash: '0'.repeat(64) }
	});
	expect(stale.status()).toBe(409);
	const incomplete = await request.post('/api/dev/recognition-reviews', {
		data: { ...payload, reviewId: randomUUID(), outcomes: payload.outcomes.slice(1) }
	});
	expect(incomplete.status()).toBe(400);
	const wrongCueSet = await request.post('/api/dev/recognition-reviews', {
		data: { ...payload, reviewId: randomUUID(), caseId: 'summon-neutral' }
	});
	expect(wrongCueSet.status()).toBe(409);

	const listed = await request.get('/api/dev/recognition-reviews?includeAutomated=true');
	expect(listed.status()).toBe(200);
	const body = (await listed.json()) as {
		reviews: Array<{ reviewId: string }>;
		latestByCase: Record<string, { reviewId: string }>;
	};
	expect(body.reviews.some((review) => review.reviewId === payload.reviewId)).toBe(true);
	expect(body.latestByCase[auditCase.caseId]).toBeDefined();
});

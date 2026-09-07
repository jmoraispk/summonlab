import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const summonableCatalogSource = JSON.parse(
	readFileSync(
		new URL(
			'../../../../assets/heroes/approved/summonable-roster-v1/catalog.json',
			import.meta.url
		),
		'utf8'
	)
) as {
	entries: Array<{
		heroId: string;
		draft: { manifestHash: string; manifest: { artKey: string | null } };
	}>;
};
const summonableRuntimeManifestSource = JSON.parse(
	readFileSync(
		new URL('../../static/runtime/summonable-heroes-v1/manifest.json', import.meta.url),
		'utf8'
	)
) as {
	entries: Array<{
		heroId: string;
		bundle: {
			assets: Array<{
				usage: string;
				sourceStatus: string;
				manifestHashes: string[];
				publicPath: string;
			}>;
		};
	}>;
};

const recipe = {
	seed: 'foundation-final-fix-b',
	generationVersion: 'human-v1',
	cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
};

test('follows the real summon CTA, recalls an away hero, and persists automatic combat', async ({
	page
}) => {
	test.setTimeout(60_000);
	const createdResponse = await page.request.post('/api/runs', {
		data: { recipe, controlMode: 'random', directive: '' }
	});
	expect(createdResponse.status()).toBe(201);
	const { runId } = (await createdResponse.json()) as { runId: string };
	const publicRunResponse = await page.request.get(`/api/runs/${runId}`);
	expect(publicRunResponse.status()).toBe(200);
	const publicRun = (await publicRunResponse.json()) as {
		manifest: { artKey: string | null; displayName: string };
	};
	const approvedHero = summonableCatalogSource.entries.find(
		(entry) => entry.draft.manifest.artKey === publicRun.manifest.artKey
	);
	expect(approvedHero).toBeDefined();
	const approvedRuntimeEntry = summonableRuntimeManifestSource.entries.find(
		(entry) => entry.heroId === approvedHero?.heroId
	);
	const approvedCombatChibi = approvedRuntimeEntry?.bundle.assets.find(
		(asset) => asset.usage === 'combat-chibi'
	);
	expect(approvedCombatChibi?.sourceStatus).toBe('approved');
	expect(approvedCombatChibi?.manifestHashes).toContain(approvedHero?.draft.manifestHash);

	await page.goto(`/summon/${runId}`);
	await page.getByRole('button', { name: /Break the seal/ }).click();
	const follow = page.getByRole('link', {
		name: /Follow to the (kitchen|training ground)/
	});
	await expect(follow).toBeVisible({ timeout: 5_000 });
	await follow.click();

	await expect(page).toHaveURL(new RegExp(`/play/${runId}$`, 'u'));
	await expect(page.getByTestId('living-settlement')).toBeVisible({ timeout: 7_000 });
	await page.getByRole('link', { name: 'Floor 01' }).click();

	const roster = page.getByTestId('hero-roster-card');
	await expect(page).toHaveURL(new RegExp(`/mission/${runId}$`, 'u'));
	await expect(page.getByText('Tower Floor 01 / operator-bound combat')).toBeVisible();
	await expect(roster).toContainText('UNAVAILABLE');
	await expect(roster).toContainText('Away from the Tower Threshold.');
	await expect(page.getByTestId('prepare-party')).toBeDisabled();
	if (process.env.CAPTURE_FINAL_FIX_B_AWAY) {
		await page.setViewportSize({ width: 1440, height: 1100 });
		await page.screenshot({ path: process.env.CAPTURE_FINAL_FIX_B_AWAY, fullPage: true });
	}

	await page.getByTestId('request-readiness-return').click();
	await expect(roster).toContainText('READY');
	await expect(roster).toContainText('At the Tower Threshold.');
	await expect(page.getByTestId('prepare-party')).toBeEnabled();
	await expect(page.getByText(/At the Master's request, the hero began/).first()).toBeVisible();
	if (process.env.CAPTURE_FINAL_FIX_B_READY) {
		await page.screenshot({ path: process.env.CAPTURE_FINAL_FIX_B_READY, fullPage: true });
	}

	await page.getByTestId('prepare-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('preparing');
	await page.getByTestId('deploy-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('deployed');
	const heroCombatArt = page.getByTestId('hero-combat-art');
	await expect(heroCombatArt).toHaveAttribute('data-character-art-status', 'approved');
	await expect(heroCombatArt).toHaveAttribute('src', approvedCombatChibi?.publicPath ?? 'missing');
	await expect(heroCombatArt).toHaveAttribute(
		'alt',
		`${publicRun.manifest.displayName} combat chibi`
	);
	await expect(page.getByTestId('master-combat-art-missing')).toHaveAttribute(
		'data-character-art-status',
		'missing'
	);
	await expect(page.getByTestId('master-roster-art-missing')).toHaveAttribute(
		'data-character-art-status',
		'missing'
	);
	await expect(page.getByTestId('enemy-combat-art-missing')).not.toHaveCount(0);
	await expect(page.locator('[data-character-art-status="missing"] img')).toHaveCount(0);
	await expect(page.locator('.actor-token, .monster-token, .master-portrait')).toHaveCount(0);
	if (process.env.CAPTURE_FINAL_FIX_B_ART_MOBILE) {
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(heroCombatArt).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		await page.screenshot({ path: process.env.CAPTURE_FINAL_FIX_B_ART_MOBILE, fullPage: true });
		await page.setViewportSize({ width: 1440, height: 1100 });
	}
	await page.getByTestId('continue-battle').click();
	await expect(page.getByTestId('initiative-report')).toBeVisible();
	const versionBeforeReload = await page.getByTestId('run-version').textContent();
	if (process.env.CAPTURE_FINAL_FIX_B_COMBAT) {
		await page.screenshot({ path: process.env.CAPTURE_FINAL_FIX_B_COMBAT, fullPage: true });
	}

	await page.reload();
	await expect(page.getByTestId('initiative-report')).toBeVisible();
	await expect(page.getByTestId('run-version')).toHaveText(versionBeforeReload ?? '');
	await expect(page.getByText('mission.round.resolved').first()).toBeVisible();
});

test('keeps a wait-mode hero at the threshold directly selectable', async ({ page }) => {
	const createdResponse = await page.request.post('/api/runs', {
		data: {
			recipe: { ...recipe, seed: 'foundation-final-fix-b-wait' },
			controlMode: 'wait',
			directive: ''
		}
	});
	expect(createdResponse.status()).toBe(201);
	const { runId } = (await createdResponse.json()) as { runId: string };

	await page.goto(`/mission/${runId}`);
	const roster = page.getByTestId('hero-roster-card');
	await expect(roster).toContainText('READY');
	await expect(roster).toContainText('At the Tower Threshold.');
	await expect(page.getByTestId('request-readiness-return')).toHaveCount(0);
	await expect(page.getByTestId('prepare-party')).toBeEnabled();
});

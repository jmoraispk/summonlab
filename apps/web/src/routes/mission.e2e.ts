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
		displayName: string;
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
		manifestHash: string;
		bundle: {
			assets: Array<{
				usage: string;
				sourceAssetKey: string;
				sourceStatus: string;
				manifestHashes: string[];
				publicPath: string;
			}>;
		};
	}>;
};

const recipe = {
	seed: 'ember-01',
	generationVersion: 'human-v1',
	cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
};

test('binds the current summoned identity and advances v25 automatic combat', async ({
	page,
	request
}) => {
	const createdResponse = await request.post('/api/runs', {
		data: { recipe, controlMode: 'wait', directive: '' }
	});
	expect(createdResponse.status()).toBe(201);
	const created = (await createdResponse.json()) as { runId: string };
	const publicRunResponse = await request.get(`/api/runs/${created.runId}`);
	expect(publicRunResponse.status()).toBe(200);
	const publicRun = (await publicRunResponse.json()) as {
		manifest: { artKey: string | null; displayName: string };
	};
	const approvedHero = summonableCatalogSource.entries.find(
		(entry) => entry.draft.manifest.artKey === publicRun.manifest.artKey
	);
	expect(approvedHero?.displayName).toBe(publicRun.manifest.displayName);
	const runtimeEntry = summonableRuntimeManifestSource.entries.find(
		(entry) => entry.heroId === approvedHero?.heroId
	);
	expect(runtimeEntry?.manifestHash).toBe(approvedHero?.draft.manifestHash);
	const rosterArt = runtimeEntry?.bundle.assets.find(
		(asset) => asset.usage === 'summon' && asset.sourceAssetKey === publicRun.manifest.artKey
	);
	const combatArt = runtimeEntry?.bundle.assets.find((asset) => asset.usage === 'combat-chibi');
	for (const asset of [rosterArt, combatArt]) {
		expect(asset?.sourceStatus).toBe('approved');
		expect(asset?.manifestHashes).toContain(approvedHero?.draft.manifestHash);
	}

	await page.goto(`/mission/${created.runId}`);
	await expect(page.getByRole('heading', { name: /The Unlit Muster/ })).toBeVisible();
	await expect(page.getByText('Tower Floor 01 / operator-bound combat')).toBeVisible();
	await expect(
		page.getByText('31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02')
	).toBeVisible();
	const roster = page.getByTestId('hero-roster-card');
	await expect(roster).toContainText(publicRun.manifest.displayName);
	await expect(roster.locator('img')).toHaveAttribute('src', rosterArt?.publicPath ?? 'missing');
	await expect(page.locator('.phase-heading h2')).toHaveText('available');

	await page.getByTestId('prepare-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('preparing');
	await expect(page.getByText('mission.preparation.started')).toBeVisible();
	await page.getByTestId('deploy-party').click();
	await expect(page.locator('.phase-heading h2')).toHaveText('deployed');
	await expect(page.getByTestId('mission-board')).toBeVisible();
	await expect(page.getByTestId('threat-intents')).toContainText('Declared threats');
	const enemyArtGaps = page.getByTestId('enemy-combat-art-missing');
	const enemyCount = await enemyArtGaps.count();
	expect(enemyCount).toBeGreaterThanOrEqual(3);
	expect(enemyCount).toBeLessThanOrEqual(4);
	await expect(enemyArtGaps.filter({ hasText: 'Ember Hauler 01' })).toHaveCount(1);
	await expect(page.getByTestId('threat-intents').locator('article')).toHaveCount(enemyCount);
	await expect(page.getByTestId('hero-combat-art')).toHaveAttribute(
		'src',
		combatArt?.publicPath ?? 'missing'
	);
	await expect(page.getByTestId('continue-battle')).toBeVisible();
	await expect(page.getByTestId('master-turn-actions')).toHaveCount(0);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.getByTestId('mission-board')).toBeVisible();
	await expect(page.getByTestId('continue-battle')).toBeVisible();
	await page.setViewportSize({ width: 1280, height: 720 });
	const versionBeforeRound = await page.getByTestId('run-version').textContent();
	await page.getByTestId('continue-battle').click();
	await expect(page.getByTestId('initiative-report')).toBeVisible();
	await expect
		.poll(() => page.getByTestId('run-version').textContent())
		.not.toBe(versionBeforeRound);
	const versionAfterRound = await page.getByTestId('run-version').textContent();
	await expect(page.getByText('mission.round.resolved').first()).toBeVisible();

	await page.reload();
	await expect(page.getByTestId('initiative-report')).toBeVisible();
	await expect(page.getByTestId('run-version')).toHaveText(versionAfterRound ?? '');
	await expect(page.getByText('mission.round.resolved').first()).toBeVisible();
});

import { expect, test } from '@playwright/test';

test('previews a hash-bound summon card without enabling paid generation', async ({ page }) => {
	await page.goto('/visual-lab/summon-card');

	await expect(page.getByRole('heading', { name: /The image may imagine/ })).toBeVisible();
	await expect(page.getByTestId('generation-state')).toContainText('Disabled by default');
	await expect(page.getByText('gpt-image-2-2026-04-21').first()).toBeVisible();
	await expect(page.getByText('$0.005 USD')).toBeVisible();
	await expect(page.getByText('ephemeral-response-only')).toBeVisible();
	await expect(page.getByText('false', { exact: true })).toBeVisible();

	const initialHash = await page.getByTestId('prompt-hash').textContent();
	await page.getByLabel('Optional art direction').fill('A distant alarm casts colder gate light.');
	await page.getByRole('button', { name: 'Rebuild deterministic preview' }).click();
	await expect(page.getByTestId('request-result')).toContainText('No provider call was made');
	await expect(page.getByTestId('prompt-hash')).not.toHaveText(initialHash ?? '');
	await expect(page.getByText(/A distant alarm casts colder gate light/)).toBeVisible();

	await page.getByRole('button', { name: /Remy Nahl/ }).click();
	await expect(page.getByAltText('Remy Nahl exact identity anchor')).toBeVisible();
	await expect(page.getByText(/Adult age: 24/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Generate one candidate' })).toBeDisabled();

	if (process.env.CAPTURE_PHASE3_CARD) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE3_CARD, fullPage: true });
	}
});

test('rejects generation at the API boundary when the development flag is off', async ({
	request
}) => {
	const catalog = JSON.parse(
		await (
			await import('node:fs/promises')
		).readFile(new URL('../../../../assets/heroes/visuals/catalog.json', import.meta.url), 'utf8')
	) as {
		catalogVersion: string;
		assets: Array<{
			assetKey: string;
			role: string;
			contentHash: string;
			manifestHashes: string[];
		}>;
	};
	const asset = catalog.assets.find((candidate) => candidate.assetKey === 'ember-01-anchor-v1')!;
	const response = await request.post('/api/dev/summon-card/generate', {
		data: {
			requestId: '372babd1-b6b0-4877-88dc-2efeab37b3ae',
			assetKey: asset.assetKey,
			catalogVersion: catalog.catalogVersion,
			assetContentHash: asset.contentHash,
			manifestHash: asset.manifestHashes[0],
			direction: '',
			costAcknowledged: true
		}
	});

	expect(response.status()).toBe(503);
	expect(await response.json()).toMatchObject({ code: 'IMAGE_GENERATION_DISABLED' });
});

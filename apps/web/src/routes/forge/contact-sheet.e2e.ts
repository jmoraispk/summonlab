import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('renders and exports the deterministic 100-seed Forge audit', async ({ page }) => {
	await page.goto('/forge/contact-sheet');
	await expect(page.getByRole('heading', { name: /Variation/ })).toBeVisible();
	await expect(page.getByTestId('contact-count')).toHaveText('100');
	await expect(page.getByTestId('unique-name-count')).not.toHaveText(/^(?:[0-8]?\d|90)$/);
	await expect(page.getByTestId('contact-card')).toHaveCount(100);
	await expect(page.getByText('cohort-0', { exact: true })).toBeVisible();
	await expect(page.getByText('cohort-99', { exact: true })).toBeVisible();
	if (process.env.CAPTURE_PHASE3_CONTACT) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE3_CONTACT, fullPage: true });
	}

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download audit JSON' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('summonlab-human-v2-100-seed-audit.json');
	const path = await download.path();
	expect(path).not.toBeNull();
	const audit = JSON.parse(await readFile(path!, 'utf8')) as {
		generationVersion: string;
		characters: Array<{ recipe: { seed: string }; manifestHash: string }>;
	};
	expect(audit.generationVersion).toBe('human-v3');
	expect(audit.characters).toHaveLength(100);
	expect(audit.characters[0]?.recipe.seed).toBe('cohort-0');
	expect(audit.characters[99]?.recipe.seed).toBe('cohort-99');
	expect(audit.characters.every((character) => character.manifestHash.length === 64)).toBe(true);
});

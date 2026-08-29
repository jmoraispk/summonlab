import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('renders and exports the deterministic Pack 2 cohort audit', async ({ page }) => {
	await page.goto('/forge/contact-sheet');
	await expect(page.getByRole('heading', { name: /Variation/ })).toBeVisible();
	await expect(page.getByTestId('audit-count')).toHaveText('1000');
	await expect(page.getByTestId('contact-count')).toHaveText('100');
	await expect(page.getByTestId('contact-card')).toHaveCount(100);
	await expect(page.getByTestId('independence-check')).toHaveCount(7);
	await expect(page.getByTestId('independence-check')).toContainText([
		'Pass',
		'Pass',
		'Pass',
		'Pass',
		'Pass',
		'Pass',
		'Pass'
	]);
	await expect(page.getByText('pack-two-cohort-0', { exact: true })).toBeVisible();
	await expect(page.getByText('pack-two-cohort-99', { exact: true })).toBeVisible();
	const renderedDimensions = await page
		.getByTestId('contact-card')
		.locator('figure')
		.evaluateAll((figures) => ({
			builds: new Set(figures.map((figure) => (figure as HTMLElement).dataset.build)).size,
			heightBands: new Set(figures.map((figure) => (figure as HTMLElement).dataset.heightBand))
				.size,
			proportions: new Set(figures.map((figure) => (figure as HTMLElement).dataset.proportion)).size
		}));
	expect(renderedDimensions).toEqual({ builds: 6, heightBands: 4, proportions: 4 });
	if (process.env.CAPTURE_PHASE3_CONTACT) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE3_CONTACT, fullPage: true });
	}

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download audit JSON' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('summonlab-human-v5-1000-seed-audit.json');
	const path = await download.path();
	expect(path).not.toBeNull();
	const audit = JSON.parse(await readFile(path!, 'utf8')) as {
		generationVersion: string;
		characters: Array<{ recipe: { seed: string }; manifestHash: string }>;
	};
	expect(audit.generationVersion).toBe('human-v5');
	expect(audit.characters).toHaveLength(1_000);
	expect(audit.characters[0]?.recipe.seed).toBe('pack-two-cohort-0');
	expect(audit.characters[999]?.recipe.seed).toBe('pack-two-cohort-999');
	expect(audit.characters.every((character) => character.manifestHash.length === 64)).toBe(true);
});

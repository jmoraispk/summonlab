import { expect, test } from '@playwright/test';

const combatUrl = '/living-village-lab/combat';

test('plays, skips, and replays the deterministic combat motion receipt', async ({ page }) => {
	await page.goto(combatUrl);
	await expect(page.getByTestId('combat-pixi-canvas')).toBeVisible();
	await expect(page.getByTestId('combat-pixi-host')).toHaveAttribute('data-board-contract', '7x9');
	await expect(page.getByTestId('combat-pixi-host')).toHaveAttribute('data-cell-width', '82');
	await expect(page.getByTestId('combat-pixi-host')).toHaveAttribute('data-cell-height', '82');
	await expect(page.getByTestId('combat-beat')).toContainText('Choose an action');
	await expect(page.getByTestId('initiative-rail')).toContainText('Mara');
	await expect(page.getByLabel('Latest combat activity').first()).toContainText('I see an opening');

	await expect(page.getByTestId('commit-combat-action')).toBeEnabled();
	await page.getByTestId('commit-combat-action').click();
	await expect(page.getByTestId('combat-beat')).not.toContainText('Choose an action');
	await page.getByRole('button', { name: 'Skip' }).click();
	await expect(page.getByTestId('combat-beat')).toContainText('Resolution settled');
	await expect(page.getByLabel('Latest combat activity').first()).toContainText('goblin_02 died');
	await expect(page.getByText('Final target vitality').locator('..')).toContainText('0');
	if (process.env.CAPTURE_LV_COMBAT_DESKTOP) {
		await page.screenshot({ path: process.env.CAPTURE_LV_COMBAT_DESKTOP, fullPage: true });
	}

	await page
		.getByLabel('Playback controls')
		.getByRole('button', { name: 'Replay', exact: true })
		.click();
	await expect(page.getByTestId('combat-beat')).not.toContainText('Resolution settled');
	await page.getByTestId('toggle-combat-playback').click();
	await expect(page.getByTestId('toggle-combat-playback')).toHaveText('Resume');
});

test('keeps the 390px reduced-motion combat readable without horizontal overflow', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(combatUrl);
	await expect(page.getByTestId('combat-pixi-canvas')).toBeVisible();
	await expect(page.getByTestId('commit-combat-action')).toBeEnabled();
	await page.getByTestId('commit-combat-action').click();
	await expect(page.getByTestId('combat-beat')).toContainText('Resolution settled');
	await expect(page.getByTestId('combat-stage').getByLabel('Latest combat activity')).toContainText(
		'goblin_02 died'
	);

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);
	if (process.env.CAPTURE_LV_COMBAT_MOBILE) {
		await page.screenshot({ path: process.env.CAPTURE_LV_COMBAT_MOBILE, fullPage: true });
	}
});

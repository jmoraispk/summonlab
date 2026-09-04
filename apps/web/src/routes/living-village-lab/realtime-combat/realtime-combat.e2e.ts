import { expect, test } from '@playwright/test';

const combatUrl = '/living-village-lab/realtime-combat';

test('switches presentation without restarting the autonomous fight', async ({ page }) => {
	await page.goto(combatUrl);
	await expect(page.getByTestId('realtime-combat-pixi-canvas')).toBeVisible();
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-presentation-mode',
		'2.5d-v2'
	);
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-applied-presentation-mode',
		'2.5d-v2'
	);
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-animated-actor-count',
		'8'
	);
	await expect(page.getByTestId('presentation-evidence')).toContainText(
		'Trapezoidal lane convergence is on'
	);

	await page.getByRole('button', { name: 'Pause agents' }).click();
	const pausedTime = await page.getByTestId('combat-phase').locator('small').textContent();
	await page.getByRole('button', { name: '2.5D Depth staged' }).click();
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-presentation-mode',
		'2.5d'
	);
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-applied-presentation-mode',
		'2.5d'
	);
	await expect(page.getByTestId('presentation-evidence')).toContainText(
		'Rectangular coordinates remain intact'
	);
	await expect(page.getByTestId('combat-phase').locator('small')).toHaveText(pausedTime!);

	await page.getByRole('button', { name: '2D Fixed scale' }).click();
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-presentation-mode',
		'2d'
	);
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-applied-presentation-mode',
		'2d'
	);
	await expect(page.getByTestId('presentation-evidence')).toContainText(
		'Every actor keeps one scale'
	);
	await expect(page.getByTestId('combat-phase').locator('small')).toHaveText(pausedTime!);

	await page.getByRole('button', { name: 'Resume agents' }).click();
	await expect(page.getByTestId('combat-phase').locator('small')).not.toHaveText(pausedTime!);
});

test('keeps the mobile battlefield and controls readable', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(combatUrl);
	await expect(page.getByRole('heading', { name: 'Hold the village gate.' })).toBeVisible();
	await expect(page.getByRole('button', { name: '2.5D V2 Trapezoid on' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Pause agents' })).toBeEnabled();

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);
});

import { expect, test } from '@playwright/test';

const combatUrl = '/living-village-lab/realtime-combat';
const motionPackVersions = 'asha:2,iron-guardian:5,moss-archer:4,rat-brute:1,lesser-rat:2';

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
	await expect(page.getByTestId('combat-rejection')).toHaveCount(0);
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-animated-actor-count',
		'8'
	);
	await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
		'data-motion-pack-versions',
		motionPackVersions
	);
	await expect(page.getByTestId('presentation-evidence')).toContainText(
		'Trapezoidal lane convergence is on'
	);

	await page.getByRole('button', { name: 'Pause agents' }).click();
	const pausedTime = await page.getByTestId('combat-phase').locator('small').textContent();
	for (const { button, mode } of [
		{ button: '2D Fixed scale', mode: '2d' },
		{ button: '2.5D Depth staged', mode: '2.5d' },
		{ button: '2.5D V2 Trapezoid on', mode: '2.5d-v2' }
	] as const) {
		await page.getByRole('button', { name: button }).click();
		await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
			'data-applied-presentation-mode',
			mode
		);
		await expect(page.getByTestId('realtime-combat-pixi-host')).toHaveAttribute(
			'data-motion-pack-versions',
			motionPackVersions
		);
	}

	await page.getByRole('button', { name: '2.5D Depth staged' }).click();
	await expect(page.getByTestId('presentation-evidence')).toContainText(
		'Rectangular coordinates remain intact'
	);
	await expect(page.getByTestId('combat-phase').locator('small')).toHaveText(pausedTime!);

	await page.getByRole('button', { name: '2D Fixed scale' }).click();
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

test('returns one bounded receipt and replays without a second completion', async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(combatUrl);
	await expect(page.getByTestId('combat-resolution')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('combat-receipt')).toContainText('Victory');
	await expect(page.getByTestId('combat-receipt')).toContainText('3 heroes · 5 enemies');
	await expect(page.getByTestId('combat-completion-count')).toHaveText('1');
	const receiptId = await page.getByTestId('combat-receipt-id').textContent();

	await page.getByRole('button', { name: 'Replay verified fight' }).click();
	await expect(page.getByTestId('combat-replay-status')).toHaveText('Replay verified', {
		timeout: 45_000
	});
	await expect(page.getByTestId('combat-completion-count')).toHaveText('1');
	await expect(page.getByTestId('combat-receipt-id')).toHaveText(receiptId!);
});

test('creates a newly keyed fixture request from Run it again', async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(combatUrl);
	await expect(page.getByTestId('combat-resolution')).toBeVisible({ timeout: 45_000 });

	await page.getByRole('button', { name: 'Run it again' }).click();
	await expect(page.getByTestId('combat-rejection')).toContainText('canonical fixture request');
	await expect(page.getByTestId('combat-receipt')).toHaveCount(0);
});

test('reports an unavailable presentation without a defeat receipt', async ({ page }) => {
	await page.route('**/rat-brute-motion-v1.json', (route) => route.abort());
	await page.goto(combatUrl);
	await expect(page.getByTestId('combat-unavailable')).toContainText('could not be loaded');
	await expect(page.getByTestId('combat-receipt')).toHaveCount(0);
	await expect(page.getByText('Party overwhelmed')).toHaveCount(0);
});

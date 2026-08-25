import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('reveals Floor 01 topology only through legal authored affordances', async ({ page }) => {
	await page.goto('/mission-lab');

	await expect(page.getByRole('heading', { name: /The Unlit Muster/ })).toBeVisible();
	await expect(page.getByText('31f756076a3e67ad')).toBeVisible();
	await expect(page.getByText('Recover the First Ember')).toBeVisible();
	await expect(page.locator('.arena-node')).toHaveCount(5);
	await expect(page.getByTestId('mission-route')).toContainText('4 actions');
	await expect(page.getByTestId('mission-route')).toContainText('exposed exposure');

	await page.getByRole('button', { name: 'Inspect Oath Hall' }).click();
	await expect(page.getByText(/Warm soot moves sideways/)).toBeVisible({ timeout: 10_000 });
	await expect(page.getByText('Legal discovery actions').locator('..')).toContainText('2');
	await page.getByRole('button', { name: /Inspect the warm soot seam/ }).click();

	await expect(page.getByTestId('mission-discovery')).toContainText('The soot seam opens');
	await expect(page.locator('.arena-node')).toHaveCount(6);
	await expect(page.getByTestId('mission-route')).toContainText('3 actions');
	await expect(page.getByTestId('mission-route')).toContainText('low exposure');
	await expect(page.getByTestId('mission-route')).toContainText('Ash Duct');

	await page.getByRole('button', { name: 'Author truth' }).click();
	await expect(page.locator('.arena-node')).toHaveCount(7);
	await expect(page.locator('.arena-node.concealed')).toHaveCount(1);
	await page.getByRole('button', { name: 'Hero knowledge' }).click();
	await expect(page.locator('.arena-node')).toHaveCount(6);

	await page.getByRole('button', { name: 'Inspect Shattered Gallery' }).click();
	await page.getByRole('button', { name: /Put weight on the severed bell chain/ }).click();
	await expect(page.getByTestId('mission-discovery')).toContainText('A stair behind the bell');
	await expect(page.locator('.arena-node')).toHaveCount(7);

	await expect(page.getByTestId('story-envelope')).toContainText('Agent patch slot');
	await expect(page.getByTestId('story-envelope')).toContainText('Choose 1 of 2');
	await expect(page.getByTestId('story-envelope')).toContainText(
		'world-laws · primary-objective · arena-truth · reward-budget · required-anchors'
	);

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);

	if (process.env.CAPTURE_PHASE6_MISSION) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE6_MISSION, fullPage: true });
	}

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.reload();
	await expect
		.poll(() =>
			page
				.locator('.arena-edge')
				.first()
				.evaluate((element) => getComputedStyle(element).transitionDuration)
		)
		.toBe('0s');
});

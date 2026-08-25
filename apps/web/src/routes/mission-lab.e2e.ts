import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('reveals Floor 01 topology only through legal authored affordances', async ({ page }) => {
	await page.goto('/mission-lab');

	await expect(page.getByRole('heading', { name: /The Unlit Muster/ })).toBeVisible();
	await expect(page.getByText('31f756076a3e67ad')).toBeVisible();
	await expect(page.locator('.mission-seal')).toContainText('Recover the First Ember');
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

test('previews the authored first band and gates the Floor 05 maintenance route on memory', async ({
	page
}) => {
	await page.goto('/mission-lab');

	await page.getByRole('button', { name: /05 The Living Foundry/ }).click();
	await expect(page.getByRole('heading', { name: 'The Living Foundry' })).toBeVisible();
	await expect(page.locator('.mission-seal')).toContainText('Defeat the Foundry Warden');
	await expect(page.getByText('8d4b12beee900c17')).toBeVisible();
	await expect(page.locator('.arena-node')).toHaveCount(4);
	await expect(page.getByTestId('mission-route')).toContainText('5 actions');
	await expect(page.getByTestId('route-memory-gate')).toContainText('The route is not a free hint');

	await page.getByRole('button', { name: 'Inspect Ash Intake' }).click();
	await expect(
		page.getByText('No unresolved authored discovery action is legal here.')
	).toBeVisible();
	await page.getByRole('button', { name: 'Preview retained memory' }).click();
	await expect(page.getByRole('button', { name: /Match the soot seam/ })).toBeVisible();
	await page.getByRole('button', { name: /Match the soot seam/ }).click();

	await expect(page.getByTestId('mission-discovery')).toContainText('The schematic was true');
	await expect(page.locator('.arena-node')).toHaveCount(6);
	await expect(page.getByTestId('mission-route')).toContainText('4 actions');
	await expect(page.getByTestId('mission-route')).toContainText('Maintenance Seam');
	await expect(page.getByText('foundry-warden-v1')).toBeVisible();
	await expect(page.getByTestId('story-envelope')).toContainText('Break or quench');

	if (process.env.CAPTURE_PHASE6_BAND) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE6_BAND, fullPage: true });
	}

	const horizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(horizontalOverflow).toBeLessThanOrEqual(0);
});

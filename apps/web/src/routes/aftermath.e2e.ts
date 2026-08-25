import { expect, test, type Page } from '@playwright/test';

async function chooseMasterAction(page: Page, label: string) {
	await page.getByTestId('master-turn-actions').getByRole('button', { name: label }).click();
	await page.getByTestId('resolve-turn').click();
	await page.waitForFunction(
		() => !document.querySelector('[data-testid="master-turn-actions"] button.selected')
	);
}

test('persists injury, gear wear, witnessed memory, and permadeath from a real mission', async ({
	page
}) => {
	await page.goto('/aftermath');
	await expect(page.getByRole('heading', { name: /The Red Tithe/ })).toBeVisible();
	await expect(page.getByText('Direction to the summoned hero')).toBeVisible();
	const response = await page.request.post('/api/dev/aftermath-runs', {
		data: {
			direction: 'When threatened, attack and strike the nearest threat.',
			seed: 'red-tithe-3046c768-2575-4f27-948a-9154ab4d07c5'
		}
	});
	expect(response.ok()).toBe(true);
	const { runId } = (await response.json()) as { runId: string };
	await page.goto(`/mission/${runId}`);
	await expect(page).toHaveURL(/\/mission\/[0-9a-f-]+$/u);
	await expect(page.getByRole('heading', { name: /The Red Tithe/ })).toBeVisible();
	await expect(page.getByTestId('aftermath-console')).toContainText('0 recorded');

	await page.getByTestId('prepare-party').click();
	await page.getByTestId('deploy-party').click();
	for (const label of [
		'Move to Cut Stair',
		'Move to Red Gallery',
		'Move to Tithe Pit',
		'Move to Red Gallery'
	]) {
		await chooseMasterAction(page, label);
	}

	for (let round = 0; round < 10; round += 1) {
		if ((await page.getByTestId('aftermath-entry').count()) > 0) break;
		await chooseMasterAction(page, 'Hold position');
	}
	const firstWear = page.getByTestId('aftermath-entry').filter({ hasText: 'gear 6 → 5' });
	await expect(firstWear).toContainText('strain');
	await expect(firstWear).toContainText('1 surviving witness');
	await expect(page.getByTestId('hero-roster-card')).not.toContainText('100 / 100 vitality');
	if (process.env.CAPTURE_PHASE6_AFTERMATH) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE6_AFTERMATH, fullPage: true });
	}

	for (let round = 0; round < 12; round += 1) {
		if ((await page.locator('.phase-heading h2').textContent())?.trim() === 'death') break;
		await chooseMasterAction(page, 'Hold position');
	}
	await expect(page.locator('.phase-heading h2')).toHaveText('death');
	await expect(page.getByTestId('hero-roster-card')).toContainText('0 / 100 vitality · dead');
	await expect(page.getByTestId('aftermath-console')).toContainText('Permanent death');
	await expect(page.getByTestId('aftermath-console')).toContainText('0 surviving witnesses');

	await page.reload();
	await expect(page.locator('.phase-heading h2')).toHaveText('death');
	await expect(page.getByTestId('aftermath-console')).toContainText('Permanent death');
});

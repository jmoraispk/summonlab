import { expect, test } from '@playwright/test';

test('plays the four-stage opening into the Village without invoking combat APIs', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	const captureDirectory = process.env.CAPTURE_OPENING_DIR;
	const capture = async (name: string) => {
		if (!captureDirectory) return;
		await page.screenshot({ path: `${captureDirectory}/${name}.png`, fullPage: true });
	};
	const apiRequests: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
	});

	await page.goto('/living-village-lab/opening');
	await expect(page.getByTestId('stage-connection')).toBeVisible();
	await expect(page.getByText('PROLOGUE · 1/4')).toBeVisible();
	await capture('opening-01-connection');
	await page.getByRole('button', { name: 'Begin summoning' }).click();

	await expect(page.getByTestId('stage-arrivals')).toBeVisible();
	await expect(page.getByText('PROLOGUE · 2/4')).toBeVisible();
	await expect(page.getByText('Threat clock begins after your reply')).toBeVisible();
	await expect(page.getByLabel('Explain what you know')).toBeFocused();
	await capture('opening-02-arrivals');
	await page.getByLabel('Explain what you know').fill('Stay together. I will explain what I can.');
	await page.getByRole('button', { name: 'Send reply' }).click();

	await expect(page.getByTestId('stage-weapons')).toBeVisible();
	await expect(page.getByText('PROLOGUE · 3/4')).toBeVisible();
	await expect(page.getByText('Stay together. I will explain what I can.')).toBeVisible();
	await expect(page.getByTestId('weapon-dara-zev')).toContainText('Sword');
	await expect(page.getByTestId('weapon-mara-vey')).toContainText('Spear');
	await capture('opening-03-weapons');
	await page.getByLabel('Weapon for Dara Zev').getByRole('button', { name: 'Spear' }).click();
	await expect(page.getByTestId('weapon-dara-zev')).toContainText('Spear');
	await expect(page.getByTestId('weapon-mara-vey')).toContainText('Sword');
	await page.getByRole('button', { name: 'Confirm equipment' }).click();

	await expect(page.getByTestId('stage-briefing')).toBeVisible();
	await expect(page.getByText('PROLOGUE · 4/4')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'The Tower holds the breach' })).toBeFocused();
	await expect(page.getByText('Recover the First Ember')).toBeVisible();
	await capture('opening-04-briefing');
	await page.getByRole('button', { name: 'Enter Village' }).click();
	await expect(page).toHaveURL(/\/living-village-lab\/village$/u);
	await expect(page.getByRole('heading', { name: 'Hearth 01' })).toBeVisible();
	expect(apiRequests).toEqual([]);
});

test('keeps the prologue usable at phone width and supports quick reply and restart', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const captureDirectory = process.env.CAPTURE_OPENING_DIR;
	await page.goto('/living-village-lab/opening');
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	if (captureDirectory) {
		await page.screenshot({ path: `${captureDirectory}/opening-phone-01.png`, fullPage: true });
	}
	await page.getByRole('button', { name: 'Begin summoning' }).click();
	await page.getByRole('button', { name: 'Reassure them' }).click();
	await expect(page.getByTestId('stage-weapons')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	if (captureDirectory) {
		await page.screenshot({ path: `${captureDirectory}/opening-phone-03.png`, fullPage: true });
	}
	await page.getByRole('button', { name: 'Restart' }).click();
	await expect(page.getByTestId('stage-connection')).toBeVisible();
});

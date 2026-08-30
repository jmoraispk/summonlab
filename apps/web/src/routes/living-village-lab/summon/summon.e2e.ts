import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const route = '/living-village-lab/summon';
const evidence = (filename: string) =>
	fileURLToPath(new URL(`../../../../../../docs/evidence/${filename}`, import.meta.url));

async function chooseDirection(page: Page, name: string, direction: string) {
	await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-direction', direction);
}

test('portal discloses fixture economy and supports every reveal control', async ({ page }) => {
	await page.goto(route);

	await expect(page).toHaveTitle(/Summoning Portal/);
	await expect(page.getByTestId('wallet-sigil')).toContainText('7');
	await expect(page.getByTestId('wallet-sigil')).toContainText('Fixture');
	await expect(page.getByTestId('wallet-gem')).toContainText('2,480');
	const bannerRail = page.getByRole('navigation', { name: 'Summon banners' });
	await expect(bannerRail.getByRole('button', { name: /Standard/ })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(bannerRail.getByRole('button', { name: /Limited/ })).toBeDisabled();
	await expect(bannerRail.getByRole('button', { name: /Limited/ })).toContainText('Preview');
	await expect(bannerRail.getByRole('button', { name: /Equipment/ })).toBeDisabled();

	await page.getByRole('button', { name: /Rates & details/ }).click();
	const rates = page.getByTestId('rates-panel');
	await expect(rates).toBeVisible();
	await expect(rates).toContainText('Review values only');
	await expect(rates).toContainText('79.0%');
	await expect(rates).toContainText('Guarantee behavior');
	await expect(rates).toContainText('six unique people');
	await expect(rates).toContainText('10 paid + 1 bonus');
	await page.getByRole('button', { name: 'Close rates and details' }).click();

	await expect(page.getByTestId('summon-single')).toContainText('1 Gate sigil or 160 gems');
	await expect(page.getByTestId('summon-batch')).toContainText('Summon ×10 + 1 bonus');
	await expect(page.getByTestId('summon-batch')).toContainText('1,600 gems');

	await chooseDirection(page, 'Gate ignition', 'gate');
	await expect(page.getByTestId('reveal-stage')).not.toHaveAttribute('data-phase', 'idle');
	await page.getByRole('button', { name: 'Skip reveal' }).click();
	await expect(page.getByTestId('summon-results')).toBeVisible();

	await page.getByRole('button', { name: 'Replay', exact: true }).click();
	await expect(page.getByTestId('reveal-stage')).not.toHaveAttribute('data-phase', 'complete');
	await page.getByRole('button', { name: 'Skip reveal' }).click();

	await chooseDirection(page, 'Constellation assembly', 'constellation');
	await expect(page.getByTestId('reveal-stage')).not.toHaveAttribute('data-phase', 'idle');
	await page.getByRole('button', { name: 'Skip reveal' }).click();

	await chooseDirection(page, 'Immediate identity', 'identity');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-direction', 'identity');
	await page.getByRole('button', { name: 'Skip reveal' }).click();

	await page.getByTestId('reduced-motion-toggle').click();
	await expect(page.getByTestId('reduced-motion-toggle')).toHaveAttribute('aria-pressed', 'true');
	await page.getByTestId('summon-single').click();
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'complete');
	await expect(page.getByTestId('recognition-timing')).toContainText(
		/Recognizable identity: \d+ ms/
	);

	await page.getByTestId('summon-batch').click();
	await expect(page.getByTestId('summon-results')).toBeVisible();
	await expect(page.getByTestId('batch-result')).toHaveCount(11);
	await expect(page.getByTestId('summon-results')).toContainText('No durable hero copies created');

	const permittedNames = new Set([
		'Dara Zev',
		'Mara Vey',
		'Jori Daro',
		'Kira Toren',
		'Iven Orra',
		'Remy Nahl'
	]);
	for (const result of await page.getByTestId('batch-result').all()) {
		const text = (await result.innerText()).split('\n');
		expect(text.some((line) => permittedNames.has(line.trim()))).toBe(true);
	}
});

test('captures the portal and reveal comparison evidence', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto(route);
	await page.screenshot({ path: evidence('living-village-summon-desktop.png') });

	await chooseDirection(page, 'Gate ignition', 'gate');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'threshold');
	await page.getByTestId('reveal-stage').screenshot({
		path: evidence('living-village-summon-animation-gate.png')
	});

	await chooseDirection(page, 'Constellation assembly', 'constellation');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'form');
	await page.getByTestId('reveal-stage').screenshot({
		path: evidence('living-village-summon-animation-constellation.png')
	});

	await chooseDirection(page, 'Immediate identity', 'identity');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'identity');
	await page.getByTestId('reveal-stage').screenshot({
		path: evidence('living-village-summon-animation-identity.png')
	});
	await page.getByRole('button', { name: 'Skip reveal' }).click();
	await page.getByTestId('summon-results').screenshot({
		path: evidence('living-village-summon-single-result.png')
	});
	await page.getByTestId('summon-batch').click();
	await page.getByRole('button', { name: 'Skip reveal' }).click();
	await page.getByTestId('summon-results').screenshot({
		path: evidence('living-village-summon-batch-result.png')
	});

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(route);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.screenshot({ path: evidence('living-village-summon-mobile.png') });
});

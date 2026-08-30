import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const route = '/living-village-lab/summon';
const evidence = (filename: string) =>
	fileURLToPath(new URL(`../../../../../../docs/evidence/${filename}`, import.meta.url));

async function chooseDirection(page: Page, name: string, direction: string) {
	await page.getByRole('button', { name: /Rates & details/ }).click();
	const panel = page.getByTestId('rates-panel');
	await panel.getByRole('button', { name: new RegExp(`^${name}`, 'i') }).click();
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-direction', direction);
}

async function enableReducedMotion(page: Page) {
	await page.getByRole('button', { name: /Rates & details/ }).click();
	const toggle = page.getByTestId('reduced-motion-toggle');
	if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Close rates and details' }).click();
}

test('portal connects spending, reveal controls, arrival history, and hero dossiers', async ({
	page
}) => {
	await page.goto(route);

	await expect(page).toHaveTitle(/Summoning Portal/);
	await expect(page.getByTestId('portal-canvas')).toHaveAttribute('data-ready', 'true');
	await expect(page.getByTestId('wallet-sigil')).toContainText('7');
	await expect(page.getByTestId('wallet-sigil')).not.toContainText('Preview');
	await expect(page.getByTestId('wallet-gem')).toContainText('2,480');
	const bannerRail = page.getByRole('navigation', { name: 'Summon banners' });
	await expect(bannerRail.getByRole('button', { name: /Standard/ })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(bannerRail.getByRole('button', { name: /Limited/ })).toBeDisabled();
	await expect(bannerRail.getByRole('button', { name: /Limited/ })).toContainText('Coming soon');

	await page.getByRole('button', { name: /Rates & details/ }).click();
	const rates = page.getByTestId('rates-panel');
	await expect(rates).toContainText('79.0%');
	await expect(rates).toContainText('10 + 1 bonus');
	await expect(rates).toContainText('Demo values');
	await expect(rates).toContainText('Reveal ritual');
	const rateSurface = rates.locator('.rate-list > div').first();
	await expect(rateSurface).toHaveCSS('color', 'rgb(238, 233, 223)');
	expect(
		await rateSurface.evaluate((element) => getComputedStyle(element).backgroundImage)
	).toContain('linear-gradient');
	await page.getByRole('button', { name: 'Close rates and details' }).click();

	await expect(page.getByTestId('summon-single')).toContainText('1 Gate sigil or 160 gems');
	await expect(page.getByTestId('summon-batch')).toContainText('Summon ×10 + 1 bonus');
	await expect(page.getByTestId('summon-batch')).toContainText('1,600 gems');

	await chooseDirection(page, 'Gate', 'gate');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'threshold');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-vessel-visible', 'true');
	await expect(page.getByTestId('reveal-portrait')).toHaveCSS('opacity', '0');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'silhouette');
	await expect(page.getByTestId('reveal-portrait')).not.toHaveCSS('opacity', '0');
	await expect(page.getByTestId('reveal-portrait')).toHaveCSS('object-fit', 'contain');
	await page.getByRole('button', { name: 'Skip', exact: true }).click();
	await expect(page.getByTestId('summon-results')).toBeVisible();
	await page.getByRole('button', { name: 'Replay', exact: true }).click();
	await expect(page.getByTestId('reveal-stage')).not.toHaveAttribute('data-phase', 'complete');
	await page.getByRole('button', { name: 'Skip', exact: true }).click();

	await chooseDirection(page, 'Constellation', 'constellation');
	await page.getByRole('button', { name: 'Skip', exact: true }).click();
	await chooseDirection(page, 'Identity first', 'identity');
	await page.getByRole('button', { name: 'Skip', exact: true }).click();

	await enableReducedMotion(page);
	for (let pull = 0; pull < 5; pull += 1) {
		await page.getByTestId('summon-single').click();
		await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'complete');
	}
	await expect(page.getByTestId('wallet-sigil')).toContainText('2');
	await expect(page.getByTestId('guarantee-progress')).toContainText('0 / 30');
	await expect(page.getByTestId('guarantee-progress')).toContainText(
		'3★ arrived · guarantee renewed'
	);
	await page.getByRole('button', { name: /Rates & details/ }).click();
	await expect(page.getByTestId('rates-guarantee-progress')).toContainText('0 / 30');
	await page.getByRole('button', { name: 'Close rates and details' }).click();
	const history = page.getByTestId('arrival-history');
	await expect(history.getByRole('button')).toHaveCount(5);
	await expect(history.getByText('New', { exact: true })).toHaveCount(5);
	const oneStar = history.getByRole('button', { name: /View Mara Vey stats/ });
	const twoStar = history.getByRole('button', { name: /View Kira Toren stats/ });
	await expect(oneStar).toHaveAttribute('data-stars', '1');
	await expect(twoStar).toHaveAttribute('data-stars', '2');
	const [oneStarColor, twoStarColor] = await Promise.all([
		oneStar.evaluate((element) => getComputedStyle(element).getPropertyValue('--rarity')),
		twoStar.evaluate((element) => getComputedStyle(element).getPropertyValue('--rarity'))
	]);
	expect(oneStarColor).not.toBe(twoStarColor);

	await oneStar.click();
	const dossier = page.getByTestId('hero-dossier');
	await expect(dossier).toBeVisible();
	await expect(dossier).toContainText('Attributes');
	await expect(dossier).toContainText('Personality');
	await expect(dossier).toContainText('Might');
	await expect(dossier).toContainText('Vitality');
	await expect(dossier).toContainText('Agility');
	await expect(dossier).toContainText('Dexterity');
	await expect(dossier).toContainText('Intellect');
	await expect(dossier).toContainText('Spirit');
	await expect(dossier.getByTestId('hero-attribute')).toHaveCount(6);
	await expect(dossier.getByTestId('body-attributes').getByTestId('hero-attribute')).toHaveCount(4);
	await expect(dossier.getByTestId('mind-attributes').getByTestId('hero-attribute')).toHaveCount(2);
	const [bodyBox, mindBox] = await Promise.all([
		dossier.getByTestId('body-attributes').boundingBox(),
		dossier.getByTestId('mind-attributes').boundingBox()
	]);
	expect(bodyBox!.x).toBeLessThan(mindBox!.x);
	await expect(dossier.locator('[data-icon="ember"]')).toBeVisible();
	await expect(dossier.locator('[data-icon="martial"]').first()).toBeVisible();
	await expect(dossier.locator('[data-icon="magic"]')).toBeVisible();
	await page.getByRole('button', { name: 'Close hero details' }).click();
	await expect(history.getByText('New', { exact: true })).toHaveCount(4);
	await expect(oneStar).toHaveAttribute('aria-label', 'View Mara Vey stats');
	await twoStar.click();
	await expect(page.getByTestId('hero-dossier').locator('[data-icon="crafting"]')).toBeVisible();
	await page.getByRole('button', { name: 'Close hero details' }).click();

	await page.getByTestId('summon-batch').click();
	await expect(page.getByTestId('wallet-gem')).toContainText('880');
	await expect(page.getByTestId('guarantee-progress')).toContainText('1 / 30');
	await expect(page.getByTestId('arrival-card')).toHaveCount(11);
	await expect(page.getByTestId('summon-results')).toContainText('10 summoned + 1 bonus');
	await expect(page.getByTestId('summon-results')).toContainText('Bonus');
	const batchResults = page.getByTestId('summon-results');
	await expect(batchResults.locator('.star-mark')).toHaveCount(11);
	await expect(batchResults.locator('.star-mark').filter({ hasText: '3★' })).toHaveCount(2);
	const cards = page.getByTestId('arrival-card');
	const cardBoxes = await Promise.all(
		Array.from({ length: 11 }, (_, index) => cards.nth(index).boundingBox())
	);
	const gridBox = await batchResults.locator('.result-grid').boundingBox();
	for (let index = 1; index < 5; index += 1)
		expect(Math.abs(cardBoxes[index]!.y - cardBoxes[0]!.y)).toBeLessThan(2);
	for (let index = 6; index < 10; index += 1)
		expect(Math.abs(cardBoxes[index]!.y - cardBoxes[5]!.y)).toBeLessThan(2);
	expect(cardBoxes[5]!.y).toBeGreaterThan(cardBoxes[0]!.y);
	expect(cardBoxes[10]!.y).toBeGreaterThan(cardBoxes[5]!.y);
	expect(
		Math.abs(cardBoxes[10]!.x + cardBoxes[10]!.width / 2 - (gridBox!.x + gridBox!.width / 2))
	).toBeLessThan(2);
	await expect(batchResults.getByText('New', { exact: true })).toHaveCount(11);
	const unreadMaraCards = batchResults.getByRole('button', {
		name: /Inspect Mara Vey.*new arrival/
	});
	await expect(unreadMaraCards).toHaveCount(2);
	await unreadMaraCards.first().click();
	await expect(page.getByTestId('hero-dossier')).toContainText('Mara Vey');
	await page.getByRole('button', { name: 'Close hero details' }).click();
	await expect(batchResults.getByText('New', { exact: true })).toHaveCount(10);
	await expect(unreadMaraCards).toHaveCount(1);
});

test('captures the release portal and animation comparison', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto(route);
	await expect(page.getByTestId('portal-canvas')).toHaveAttribute('data-ready', 'true');
	await page.screenshot({ path: evidence('living-village-summon-desktop.png') });

	await chooseDirection(page, 'Gate', 'gate');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'silhouette');
	await page.getByTestId('reveal-stage').screenshot({
		path: evidence('living-village-summon-animation-gate.png')
	});

	await chooseDirection(page, 'Constellation', 'constellation');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'form');
	await page.getByTestId('reveal-stage').screenshot({
		path: evidence('living-village-summon-animation-constellation.png')
	});

	await chooseDirection(page, 'Identity first', 'identity');
	await expect(page.getByTestId('reveal-stage')).toHaveAttribute('data-phase', 'identity');
	await page.getByTestId('reveal-stage').screenshot({
		path: evidence('living-village-summon-animation-identity.png')
	});

	await enableReducedMotion(page);
	await page.getByTestId('summon-single').click();
	await page.getByTestId('reveal-stage').screenshot({
		path: evidence('living-village-summon-single-result.png')
	});
	await page.getByTestId('arrival-card').click();
	await page.getByTestId('hero-dossier').screenshot({
		path: evidence('living-village-summon-dossier.png')
	});
	await page.getByRole('button', { name: 'Close hero details' }).click();
	await page.getByTestId('summon-batch').click();
	await page.getByTestId('reveal-stage').screenshot({
		path: evidence('living-village-summon-batch-result.png')
	});
	await page.screenshot({ path: evidence('living-village-summon-connected-spend.png') });

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(route);
	await expect(page.getByTestId('portal-canvas')).toHaveAttribute('data-ready', 'true');
	await page.screenshot({ path: evidence('living-village-summon-mobile.png') });
});

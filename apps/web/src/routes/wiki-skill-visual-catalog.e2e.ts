import { expect, test, type Locator } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const catalogPath = '/wiki/mechanics/skills/visual-catalog';
const reportAssets = new URL('../../../../docs/superpowers/reports/assets/', import.meta.url);
const updateReportScreenshots = process.env.UPDATE_WIKI_SKILL_VISUAL_CATALOG_SCREENSHOTS === '1';

function familySelect(catalog: Locator): Locator {
	return catalog
		.locator('.catalog-controls label')
		.filter({ hasText: /^Family/u })
		.locator('select');
}

test('filters, shares, expands, and clears the complete skill catalog', async ({ page }) => {
	await page.goto(catalogPath);

	const catalog = page.getByRole('region', { name: 'Skill visual catalog' });
	await expect(catalog.getByRole('status')).toHaveText('456 skills');
	await expect(catalog.locator('.skill-card')).toHaveCount(120);
	await expect(catalog.locator('.skill-card img')).toHaveCount(120);
	expect(
		await catalog
			.locator('.skill-card img')
			.evaluateAll((images) => images.every((image) => image.getAttribute('loading') === 'lazy'))
	).toBe(true);
	await expect(catalog.locator('.skill-card img').first()).toHaveAttribute(
		'alt',
		'Swordsmanship skill emblem'
	);
	await expect(catalog.locator('.skill-card dt').filter({ hasText: /^Rarity$/u })).toHaveCount(0);

	await catalog.getByLabel('Domain').selectOption('Martial');
	await expect(catalog.getByRole('status')).toHaveText('258 skills');
	await familySelect(catalog).selectOption('Blade');
	await catalog.getByRole('searchbox').fill('parry');
	await expect(page).toHaveURL(/domain=Martial/u);
	await expect(page).toHaveURL(/family=Blade/u);
	await expect(page).toHaveURL(/q=parry/u);

	await catalog.getByRole('button', { name: /clear filters/i }).click();
	await expect(catalog.getByRole('status')).toHaveText('456 skills');
	await expect(catalog.getByRole('searchbox')).toHaveValue('');
	await expect(catalog.getByLabel('Domain')).toHaveValue('');
	await expect(page).toHaveURL(catalogPath);

	await catalog.getByRole('button', { name: /load 120 more/i }).click();
	await expect(catalog.locator('.skill-card')).toHaveCount(240);
});

test('hydrates a shared query and keeps dependent filters compatible', async ({ page }) => {
	await page.goto(`${catalogPath}?q=parry&domain=Martial&family=Blade&motif=blade.dual-guard`);

	const catalog = page.getByRole('region', { name: 'Skill visual catalog' });
	await expect(catalog.getByRole('searchbox')).toHaveValue('parry');
	await expect(catalog.getByLabel('Domain')).toHaveValue('Martial');
	await expect(familySelect(catalog)).toHaveValue('Blade');
	await expect(catalog.getByLabel('Motif family')).toHaveValue('blade.dual-guard');
	await expect(catalog.getByRole('status')).toHaveText('1 skill');
	await expect(catalog.getByRole('heading', { name: 'Double Parry' })).toBeVisible();

	await page.reload();
	await expect(catalog.getByRole('searchbox')).toHaveValue('parry');
	await expect(catalog.getByLabel('Motif family')).toHaveValue('blade.dual-guard');
	await expect(catalog.getByRole('heading', { name: 'Double Parry' })).toBeVisible();

	await catalog.getByRole('searchbox').fill('');
	await catalog.getByLabel('Motif family').selectOption('blade.precision-cut');
	await expect(catalog.getByRole('status')).toHaveText('8 skills');
	await expect(
		catalog.locator('.skill-card code').filter({ hasText: 'blade.precision-cut' })
	).toHaveCount(8);
	await catalog.getByLabel('Domain').selectOption('Magical');
	await expect(familySelect(catalog)).toHaveValue('');
	await expect(catalog.getByLabel('Motif family')).toHaveValue('');
	await expect(page).not.toHaveURL(/family=/u);
	await expect(page).not.toHaveURL(/motif=/u);
});

test('recovers from no results and exposes provenance to pointer and keyboard users', async ({
	page
}) => {
	await page.goto(catalogPath);

	const catalog = page.getByRole('region', { name: 'Skill visual catalog' });
	const search = catalog.getByRole('searchbox');
	await search.fill('no-skill-can-match-this-query');
	await expect(catalog.getByRole('status')).toHaveText('0 skills');
	await expect(catalog.getByText('No skills match these filters.', { exact: true })).toBeVisible();

	const recovery = catalog.locator('.no-results').getByRole('button', { name: /clear filters/i });
	await recovery.focus();
	await page.keyboard.press('Enter');
	await expect(catalog.getByRole('status')).toHaveText('456 skills');

	await search.focus();
	await page.keyboard.press('Tab');
	await expect(catalog.getByLabel('Domain')).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(catalog.getByLabel('Domain')).toHaveValue('Martial');
	await expect(catalog.getByRole('status')).toHaveText('258 skills');
	await page.keyboard.press('Tab');
	await expect(familySelect(catalog)).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(familySelect(catalog)).toHaveValue('Blade');
	await page.keyboard.press('Tab');
	await expect(catalog.getByLabel('Motif family')).toBeFocused();
	await page.keyboard.press('Tab');
	const keyboardClear = catalog.getByRole('button', { name: /clear filters/i });
	await expect(keyboardClear).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(catalog.getByRole('status')).toHaveText('456 skills');

	const provenance = catalog.locator('.skill-card').first().getByText('Production provenance');
	await provenance.focus();
	await page.keyboard.press('Enter');
	await expect(catalog.locator('.skill-card').first().locator('details')).toHaveAttribute(
		'open',
		''
	);
	await expect(catalog.locator('.skill-card').first()).toContainText('martial:blade:swordsmanship');
	await expect(catalog.locator('.skill-card').first()).toContainText('candidate');
	await expect(catalog.locator('.skill-card').first()).toContainText('Source PNG');
	await expect(catalog.locator('.skill-card').first()).toContainText('Runtime derivative');

	const loadMore = catalog.getByRole('button', { name: /load 120 more/i });
	await loadMore.focus();
	await page.keyboard.press('Enter');
	await expect(catalog.locator('.skill-card')).toHaveCount(240);
});

test('settles production hydration promptly without browser errors', async ({ page }, testInfo) => {
	const browserErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') browserErrors.push(message.text());
	});
	page.on('pageerror', (error) => browserErrors.push(error.message));

	const sharedQuery = `${catalogPath}?q=parry&domain=Martial&family=Blade&motif=blade.dual-guard`;
	const startedAt = Date.now();
	const response = await page.goto(sharedQuery, { waitUntil: 'domcontentloaded' });
	const domContentLoadedMs = Date.now() - startedAt;
	const ssrHtml = await response?.text();
	expect(ssrHtml).toMatch(
		/class="result-count[^>]*" role="status" aria-live="polite">\s*456\s+skills/u
	);
	expect(ssrHtml?.match(/class="skill-card\b/gu)).toHaveLength(120);

	const catalog = page.getByRole('region', { name: 'Skill visual catalog' });
	await expect(catalog.getByRole('searchbox')).toHaveValue('parry', { timeout: 15_000 });
	await expect(catalog.getByLabel('Domain')).toHaveValue('Martial');
	await expect(familySelect(catalog)).toHaveValue('Blade');
	await expect(catalog.getByLabel('Motif family')).toHaveValue('blade.dual-guard');
	await expect(catalog.getByRole('status')).toHaveText('1 skill');
	await expect(catalog.locator('.skill-card')).toHaveCount(1);
	await expect(page).toHaveURL(sharedQuery);
	const interactiveMs = Date.now() - startedAt;
	const navigation = await page.evaluate(() => {
		const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
		return entry
			? {
					domContentLoaded: Math.round(entry.domContentLoadedEventEnd),
					load: Math.round(entry.loadEventEnd),
					responseBytes: entry.transferSize
				}
			: null;
	});

	await testInfo.attach('catalog-hydration-timing.json', {
		body: JSON.stringify(
			{
				status: response?.status(),
				domContentLoadedMs,
				interactiveMs,
				navigation,
				browserErrors
			},
			null,
			2
		),
		contentType: 'application/json'
	});
	expect(response?.status()).toBe(200);
	expect(interactiveMs).toBeLessThan(15_000);
	expect(browserErrors).toEqual([]);
});

test('renders four non-overlapping desktop cards on a solid image well', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto(catalogPath);
	await expect(page.getByRole('status')).toHaveText('456 skills');

	const cards = page.locator('.skill-card');
	const boxes = await Promise.all([0, 1, 2, 3, 4].map((index) => cards.nth(index).boundingBox()));
	for (const box of boxes) expect(box).not.toBeNull();
	for (let index = 0; index < 4; index += 1) {
		expect(boxes[index]!.y).toBeCloseTo(boxes[0]!.y, 0);
		if (index > 0) {
			expect(boxes[index]!.x).toBeGreaterThanOrEqual(
				boxes[index - 1]!.x + boxes[index - 1]!.width - 1
			);
		}
	}
	expect(boxes[4]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height - 1);

	const background = await page
		.locator('.image-well')
		.first()
		.evaluate((well) => {
			const style = getComputedStyle(well);
			return { color: style.backgroundColor, image: style.backgroundImage };
		});
	expect(background.color).toBe('rgb(9, 8, 5)');
	expect(background.image).toBe('none');
	expect(background.image).not.toContain('repeating-conic-gradient');

	if (updateReportScreenshots) {
		await page.screenshot({
			path: fileURLToPath(new URL('wiki-skill-visual-catalog-desktop.png', reportAssets))
		});
	}
});

test('stacks wrapped controls and cards without phone overflow', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(catalogPath);
	await expect(page.getByRole('status')).toHaveText('456 skills');

	const controlBoxes = await page.locator('.catalog-controls label').evaluateAll((labels) =>
		labels.map((label) => {
			const box = label.getBoundingClientRect();
			return { x: box.x, y: box.y, width: box.width, height: box.height };
		})
	);
	expect(controlBoxes).toHaveLength(4);
	for (let index = 1; index < controlBoxes.length; index += 1) {
		expect(controlBoxes[index]!.x).toBeCloseTo(controlBoxes[0]!.x, 0);
		expect(controlBoxes[index]!.y).toBeGreaterThanOrEqual(
			controlBoxes[index - 1]!.y + controlBoxes[index - 1]!.height - 1
		);
	}

	const first = await page.locator('.skill-card').nth(0).boundingBox();
	const second = await page.locator('.skill-card').nth(1).boundingBox();
	expect(first).not.toBeNull();
	expect(second).not.toBeNull();
	expect(second!.x).toBeCloseTo(first!.x, 0);
	expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height - 1);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

	if (updateReportScreenshots) {
		await page.screenshot({
			path: fileURLToPath(new URL('wiki-skill-visual-catalog-phone.png', reportAssets))
		});
	}
});

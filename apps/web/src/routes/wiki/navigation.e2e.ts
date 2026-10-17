import { expect, test } from '@playwright/test';

const raceGroup = 'Monster Families and Races';
const firstVolume = '/wiki/creatures/monster-races/generator-bestiary-01';
const goblinoids = '/wiki/creatures/monster-races/goblinoids';

for (const width of [1400, 390]) {
	test.describe(`wiki index at ${width}px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test('keeps every collapsible heading at the same level', async ({ page }) => {
			await page.goto(firstVolume, { waitUntil: 'networkidle' });
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			const index = page.getByRole('complementary', { name: 'Wiki index' });
			await expect(index.locator('details details')).toHaveCount(0);
			await expect(
				index.locator('.nav-scroll > details > summary').filter({ hasText: raceGroup })
			).toHaveCount(1);
		});

		test('aligns heading and page labels without inset indentation', async ({ page }) => {
			await page.goto(firstVolume, { waitUntil: 'networkidle' });
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			const index = page.getByRole('complementary', { name: 'Wiki index' });
			for (const heading of await index.locator('summary').all()) {
				await heading.evaluate((element) => {
					if (!element.parentElement?.hasAttribute('open')) (element as HTMLElement).click();
				});
			}
			const labels = await index
				.locator('details summary > span, details a')
				.evaluateAll((elements) =>
					elements.map((element) => {
						const range = document.createRange();
						range.selectNodeContents(element);
						return range.getBoundingClientRect().left;
					})
				);
			expect(labels.length).toBeGreaterThan(10);
			expect(Math.max(...labels) - Math.min(...labels)).toBeLessThanOrEqual(1);
		});

		test('opens the active race heading with an explicit overview and working page links', async ({
			page
		}) => {
			await page.goto(firstVolume, { waitUntil: 'networkidle' });
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			const index = page.getByRole('complementary', { name: 'Wiki index' });
			const group = index
				.locator('details')
				.filter({
					has: page.locator('summary').filter({ hasText: new RegExp(`^${raceGroup}`) })
				})
				.last();
			await expect(group).toHaveAttribute('open', '');
			await group.locator(':scope > summary').click();
			await expect(group).not.toHaveAttribute('open');
			await group.locator(':scope > summary').click();
			await expect(group).toHaveAttribute('open', '');
			await expect(
				group.getByRole('link', { name: `${raceGroup} overview`, exact: true })
			).toHaveAttribute('href', '/wiki/creatures/monster-races');
			await expect(group.locator('a[aria-current="page"]')).toHaveAttribute('href', firstVolume);
			await expect(group.getByRole('link', { name: /^Monster Races —/ })).toHaveCount(5);
			await expect(group.getByRole('link')).toHaveCount(7);
			for (const volume of ['01', '02', '03', '04', '05']) {
				await expect(
					group.locator(`a[href="/wiki/creatures/monster-races/generator-bestiary-${volume}"]`)
				).toBeVisible();
			}
			expect(await index.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
				true
			);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
			).toBe(true);
			await expect(group.locator('a').filter({ hasText: /approved|proposed|draft/i })).toHaveCount(
				0
			);
			await group.getByRole('link', { name: 'Goblinoids', exact: true }).click();
			await expect(page).toHaveURL(new RegExp(`${goblinoids}$`));
			await expect(page.getByRole('heading', { level: 1, name: 'Goblinoids' })).toBeVisible();
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			await index.getByRole('link', { name: `${raceGroup} overview`, exact: true }).click();
			await expect(page).toHaveURL(/\/wiki\/creatures\/monster-races$/);
			await expect(page.getByRole('heading', { level: 1, name: raceGroup })).toBeVisible();
		});

		test('keeps the parent overview when search matches a child and clears an empty search', async ({
			page
		}) => {
			await page.goto('/wiki', { waitUntil: 'networkidle' });
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			const index = page.getByRole('complementary', { name: 'Wiki index' });
			await index.getByRole('searchbox').fill('Goblinoids');
			await expect(index.getByRole('link', { name: 'Goblinoids', exact: true })).toBeVisible();
			await expect(
				index.getByRole('link', { name: `${raceGroup} overview`, exact: true })
			).toBeVisible();
			await expect(index.getByRole('link', { name: /^Monster Races —/ })).toHaveCount(0);
			await index.getByRole('searchbox').fill('no-such-archive-page');
			await expect(index.getByText('No pages match “no-such-archive-page”.')).toBeVisible();
			await index.getByRole('searchbox').fill('');
			await expect(index.getByText('No pages match', { exact: false })).toHaveCount(0);
			await expect(index.locator('details > summary').filter({ hasText: raceGroup })).toHaveCount(
				1
			);
		});
	});
}

test('phone index opens, closes, and follows shortcuts without horizontal overflow', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/wiki', { waitUntil: 'networkidle' });
	const toggle = page.getByRole('button', { name: 'Open index' });
	const index = page.getByRole('complementary', { name: 'Wiki index' });
	await expect(index).not.toBeVisible();
	await toggle.click();
	await expect(index).toBeVisible();
	await expect(page.getByRole('button', { name: 'Close index', exact: true })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await page.keyboard.press('Escape');
	await expect(index).not.toBeVisible();
	await expect(toggle).toBeFocused();
	await toggle.click();
	await page.getByRole('button', { name: 'Close index', exact: true }).click();
	await expect(index).not.toBeVisible();
	await toggle.click();
	await index.getByRole('link', { name: /Monster database/ }).click();
	await expect(page).toHaveURL(/\/wiki\/creatures\/monsters$/);
	await expect(index).not.toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await toggle.click();
	expect(await index.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

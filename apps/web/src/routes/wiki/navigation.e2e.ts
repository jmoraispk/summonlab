import { expect, test } from '@playwright/test';

const raceGroup = 'Monsters';
const races = '/wiki/creatures/monster-races';
const firstVolume = '/wiki/creatures/monster-races/generator-bestiary-01';
const goblinoids = '/wiki/creatures/monster-races/goblinoids';

for (const width of [1400, 390]) {
	test.describe(`wiki index at ${width}px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test('keeps artwork in its subject section and prototype references in Other', async ({
			page
		}) => {
			await page.goto('/wiki/mechanics/equipment', { waitUntil: 'networkidle' });
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			const index = page.getByRole('complementary', { name: 'Wiki index' });
			await expect(
				index.locator('summary').filter({ hasText: /Art book|Milestones|Affinities/ })
			).toHaveCount(0);
			for (const [section, href] of [
				['Equipment', '/wiki/mechanics/equipment'],
				['Skills', '/wiki/mechanics/skills/visual-catalog'],
				['Monsters', '/wiki/art/monster-gallery'],
				['Other', '/wiki/art/living-village-heroes']
			]) {
				const group = index
					.locator('details')
					.filter({ has: page.locator('summary').filter({ hasText: new RegExp(`^${section}`) }) });
				if (!(await group.getAttribute('open'))) {
					await group.locator('summary').evaluate((element) => {
						if (!element.parentElement?.hasAttribute('open')) (element as HTMLElement).click();
					});
				}
				await expect(group.locator(`a[href="${href}"]`)).toBeVisible();
			}
			await expect(index.locator('details details')).toHaveCount(0);
			await expect(
				index
					.getByRole('navigation', { name: 'Wiki shortcuts' })
					.locator('a[href="/wiki/art/living-village-heroes"]')
			).toHaveCount(0);
			await index.getByRole('searchbox').fill('Fire');
			await expect(index.locator('a[href="/wiki/mechanics/progression/affinities"]')).toBeVisible();
			await expect(index.locator('a[href^="/wiki/mechanics/affinities"]')).toHaveCount(0);
			await page.goto('/wiki/mechanics/affinities', { waitUntil: 'networkidle' });
			await expect(page).toHaveURL(/\/wiki\/mechanics\/progression\/affinities$/);
			await expect(
				page.getByRole('heading', { level: 1, name: 'Affinities', exact: true })
			).toBeVisible();
		});

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

		test('opens a compact Monsters index and browses all races on one page', async ({ page }) => {
			await page.goto(firstVolume, { waitUntil: 'networkidle' });
			await expect(page).toHaveURL(new RegExp(`${races}$`));
			await expect(
				page.getByRole('heading', { level: 1, name: 'Monster Races', exact: true })
			).toBeVisible();
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			const index = page.getByRole('complementary', { name: 'Wiki index' });
			const group = index.locator('details').filter({
				has: page.locator('summary').filter({ hasText: new RegExp(`^${raceGroup}`) })
			});
			await expect(group).toHaveAttribute('open', '');
			await group.locator(':scope > summary').click();
			await expect(group).not.toHaveAttribute('open');
			await group.locator(':scope > summary').click();
			await expect(group.locator('a[aria-current="page"]')).toHaveAttribute('href', races);
			await expect(group.getByRole('link')).toHaveCount(5);
			await expect(
				group.getByRole('link', { name: 'Monster bestiary', exact: true })
			).toBeVisible();
			await expect(
				index.locator('summary').filter({ hasText: /Creatures|Monster Families and Races/ })
			).toHaveCount(0);
			await expect(group.getByRole('link', { name: /^Monster Races —/ })).toHaveCount(0);
			await group.getByRole('link', { name: 'Monster Races', exact: true }).click();
			await page.getByRole('link', { name: 'Doppelgangers', exact: true }).click();
			await expect(page).toHaveURL(new RegExp(`${races}#30-doppelgangers$`));
			await expect(page.locator('[id="30-doppelgangers"]')).toBeInViewport();
			await page.getByRole('link', { name: 'Creature taxonomy', exact: true }).click();
			await expect(page.locator('#creature-taxonomy')).toBeInViewport();
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
			).toBe(true);
			await page.goto(goblinoids);
			await expect(page).toHaveURL(new RegExp(`${races}$`));
			await expect(page.locator('#implemented-combat-grammar')).toHaveText(
				'Implemented combat grammar'
			);
		});

		test('preserves race fragments on old URLs and keeps detail routes under the active Monsters heading', async ({
			page
		}) => {
			await page.goto(`${firstVolume}#2-orcs`, { waitUntil: 'networkidle' });
			await expect(page).toHaveURL(new RegExp(`${races}#2-orcs$`));
			await expect(page.locator('[id="2-orcs"]')).toBeInViewport();
			await page.goto(`${goblinoids}#open-questions`, { waitUntil: 'networkidle' });
			await expect(page.locator('#open-questions')).toBeInViewport();
			await expect(page.locator('#goblinoid-open-questions')).toHaveText(
				'Goblinoid open questions'
			);
			await expect(page.locator('#taxonomy-open-questions')).toHaveText('Taxonomy open questions');
			await page.goto('/wiki/creatures/monsters', { waitUntil: 'networkidle' });
			await page
				.locator('.family header a[href="/wiki/creatures/monsters/families/goblins"]')
				.click();
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			const index = page.getByRole('complementary', { name: 'Wiki index' });
			const group = index
				.locator('details')
				.filter({ has: page.locator('summary').filter({ hasText: /^Monsters/ }) });
			await expect(group).toHaveAttribute('open', '');
			await expect(group.locator('a[aria-current="page"]')).toHaveCount(0);
			if (width === 390)
				await page.getByRole('button', { name: 'Close index', exact: true }).click();
			await page.locator('.family-form-card[href="/wiki/creatures/monsters/goblin-runt"]').click();
			await expect(page).toHaveURL(/\/wiki\/creatures\/monsters\/goblin-runt$/);
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			await expect(group).toHaveAttribute('open', '');
			await expect(group.getByRole('link')).toHaveCount(5);
		});

		test('searches the consolidated page and clears an empty search', async ({ page }) => {
			await page.goto('/wiki', { waitUntil: 'networkidle' });
			if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
			const index = page.getByRole('complementary', { name: 'Wiki index' });
			await index.getByRole('searchbox').fill('Monster Races');
			await expect(index.getByRole('link', { name: 'Monster Races', exact: true })).toBeVisible();
			await expect(index.locator('.nav-scroll details a')).toHaveCount(1);
			for (const query of ['Goblinoids', 'Goblins', 'taxonomy', 'Doppelgangers']) {
				await index.getByRole('searchbox').fill(query);
				await expect(index.getByRole('link', { name: 'Monster Races', exact: true })).toBeVisible();
			}
			await index.getByRole('searchbox').fill('Goblin Runt');
			await expect(
				index.getByRole('link', { name: 'Monster bestiary', exact: true })
			).toBeVisible();
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

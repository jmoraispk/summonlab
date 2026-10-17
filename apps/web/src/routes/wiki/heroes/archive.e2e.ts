import { expect, test } from '@playwright/test';

for (const width of [1400, 390]) {
	test.describe(`hero archive at ${width}px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test('browses real portraits, searches names and hair, and filters collections', async ({
			page
		}) => {
			await page.goto('/wiki/heroes', { waitUntil: 'networkidle' });
			await expect(
				page.getByRole('heading', { name: 'The hero archive', exact: true })
			).toBeVisible();
			await expect(page.locator('main article')).toHaveCount(24);
			await expect(page.locator('.results-heading')).toContainText('736 heroes');
			await page.locator('main article img').evaluateAll((images) => {
				for (const image of images) (image as HTMLImageElement).loading = 'eager';
			});
			await expect
				.poll(() =>
					page
						.locator('main article img')
						.evaluateAll((images) =>
							images.every(
								(image) =>
									(image as HTMLImageElement).complete &&
									(image as HTMLImageElement).naturalWidth > 0
							)
						)
				)
				.toBe(true);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
			).toBe(true);
			const firstName = await page.locator('main article h2').first().textContent();
			await page.getByRole('link', { name: 'Next →', exact: true }).first().click();
			await expect(page).toHaveURL(/page=2/);
			await expect(page.locator('main article h2').first()).not.toHaveText(firstName ?? '');
			for (const [collection, count] of [
				['approved', 200],
				['candidates', 471]
			] as const) {
				await page.getByLabel('Collection', { exact: true }).selectOption(collection);
				await page.getByRole('button', { name: 'Find heroes', exact: true }).click();
				await expect(page.locator('.results-heading')).toContainText(`${count} heroes`);
				await expect(page.locator('.results-heading')).toContainText('Page 1');
			}
			await page.getByLabel('Collection', { exact: true }).selectOption('all');
			for (const name of ['Eirar', 'Valu']) {
				await page.getByLabel('Name, hair, or wardrobe').fill(name);
				await page.getByRole('button', { name: 'Find heroes', exact: true }).click();
				await expect(page.locator('main article h2').first()).toContainText(name);
			}
			await page.getByLabel('Name, hair, or wardrobe').fill('locs');
			await page.getByRole('button', { name: 'Find heroes', exact: true }).click();
			await expect(page.locator('main article').first()).toBeVisible();
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
			).toBe(true);
		});
	});
}

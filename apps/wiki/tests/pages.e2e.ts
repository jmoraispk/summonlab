import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
	test(`browses static galleries, navigation, and image arrows at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		const missing: string[] = [];
		page.on('response', (response) => {
			if (response.status() === 404 && response.url().startsWith('http://127.0.0.1:5189'))
				missing.push(response.url());
		});
		await page.route('https://media.githubusercontent.com/**', (route) => route.abort());
		await page.goto('/summonlab/wiki/creatures/monsters/', { waitUntil: 'networkidle' });
		const opener = page.getByRole('button', { name: 'Enlarge Brute, Normal affinity' });
		await opener.click();
		await page.getByRole('button', { name: 'Next image', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Hill Giant, Normal affinity' })).toBeVisible();
		await expect(page.getByRole('dialog').getByRole('img')).toHaveAttribute(
			'src',
			/^\/summonlab\/runtime\//
		);
		await page.getByRole('button', { name: 'Close image' }).click();
		await expect(opener).toBeFocused();
		await page.goto('/summonlab/wiki/mechanics/equipment/', { waitUntil: 'networkidle' });
		await expect(page.locator('.equipment-catalog .equipment-card')).toHaveCount(21);
		await expect(page.locator('.equipment-catalog img').first()).toHaveJSProperty(
			'naturalHeight',
			768
		);
		await page.goto('/summonlab/wiki/mechanics/skills/visual-catalog/', {
			waitUntil: 'networkidle'
		});
		await expect(page.locator('.skill-catalog img').first()).toHaveJSProperty('naturalWidth', 512);
		if (width === 390) await page.getByRole('button', { name: 'Open index' }).click();
		const index = page.getByRole('complementary', { name: 'Wiki index' });
		await index.getByRole('searchbox').fill('Monster bestiary');
		await index.getByRole('link', { name: 'Monster bestiary', exact: true }).last().click();
		await expect(page).toHaveURL(/\/summonlab\/wiki\/creatures\/monsters\/$/);
		expect(missing).toEqual([]);
	});
}

test('filters the complete static hero archive through shared queries and browser history', async ({
	page
}) => {
	await page.goto('/summonlab/wiki/heroes/?q=Asha&collection=prototypes', {
		waitUntil: 'networkidle'
	});
	await expect(page.locator('.portraits article')).toHaveCount(1);
	await expect(page.locator('.portraits')).toContainText('Asha');
	await expect(page.locator('.portraits img')).toHaveJSProperty('naturalWidth', 240);
	await page.goto('/summonlab/wiki/heroes/?collection=candidates&page=2', {
		waitUntil: 'networkidle'
	});
	await expect(page.locator('.results-heading')).toContainText('Page 2 of 20');
	await page.getByRole('link', { name: 'Next →', exact: true }).first().click();
	await expect(page.locator('.results-heading')).toContainText('Page 3 of 20');
	await page.goBack();
	await expect(page.locator('.results-heading')).toContainText('Page 2 of 20');
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.locator('.results-heading')).toContainText('Page 2 of 20');
});

test('opens legacy redirects directly on static hosting', async ({ page }) => {
	await page.goto('/summonlab/wiki/mechanics/affinities/', { waitUntil: 'networkidle' });
	await expect(page).toHaveURL(/\/summonlab\/wiki\/mechanics\/progression\/affinities\/$/);
	await expect(page.getByRole('heading', { name: 'Affinities', exact: true })).toBeVisible();
	await page.goto('/summonlab/wiki/creatures/monsters/gray-wolf/', { waitUntil: 'networkidle' });
	await expect(page).toHaveURL(/\/summonlab\/wiki\/creatures\/monsters\/wolf-gray-wolf\/$/);
});

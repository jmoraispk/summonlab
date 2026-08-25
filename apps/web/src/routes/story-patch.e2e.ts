import { expect, test } from '@playwright/test';

test('commits one knowledge-bound story patch and reloads its canonical proof', async ({
	page
}) => {
	await page.goto('/story-patch');
	await expect(page.getByRole('heading', { name: /Let the story breathe/i })).toBeVisible();

	const response = await page.request.post('/api/dev/story-patch-runs', {
		data: { seed: 'runtime-story-patch-e2e' }
	});
	expect(response.ok()).toBe(true);
	const { runId } = (await response.json()) as { runId: string };
	await page.goto(`/story-patch/${runId}`);

	await expect(page.getByTestId('runtime-story-patch')).toBeVisible();
	await expect(page.getByTestId('story-patch-option')).toHaveCount(2);
	await expect(page.getByTestId('story-patch-validator')).toContainText('17 / 17 checks pass');
	await expect(page.getByTestId('story-patch-option').first()).toContainText('ROUTEBEARER');
	await expect(page.getByTestId('story-patch-option').last()).toContainText('NONE REQUIRED');

	await page.getByTestId('apply-story-patch-role-expression').click();
	await expect(page.getByTestId('story-patch-committed')).toContainText(
		'floor four optional discovery'
	);
	await expect(page.getByTestId('story-patch-committed')).toContainText('Let the summon who holds');
	await expect(page.getByTestId('story-patch-validator')).toContainText('17 / 17 checks pass');

	await page.reload();
	await expect(page.getByTestId('story-patch-committed')).toBeVisible();
	await expect(page.getByTestId('runtime-story-patch')).toContainText('REPLAY-BOUND');
	if (process.env.CAPTURE_PHASE6_STORY_PATCH) {
		await page.screenshot({ path: process.env.CAPTURE_PHASE6_STORY_PATCH, fullPage: true });
	}
});

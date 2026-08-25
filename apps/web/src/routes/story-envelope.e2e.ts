import { expect, test } from '@playwright/test';

test('shows one fixed five-floor spine through two distinct summon voices', async ({ page }) => {
	await page.goto('/story-envelope');

	await expect(page.getByTestId('story-envelope-proof')).toBeVisible();
	await expect(page.getByRole('heading', { name: /authority no one gave you/i })).toBeVisible();
	await expect(page.getByTestId('story-floor-1')).toContainText('The Unlit Muster');
	await expect(page.getByTestId('story-floor-5')).toContainText('The Living Foundry');
	await page.getByTestId('story-floor-5').click();
	await expect(page.getByTestId('selected-story-floor')).toContainText(
		'Judge authority by preparation and consequence'
	);
	await expect(page.getByTestId('story-eligibility-checkpoint')).toContainText(
		'floor four confrontation'
	);
	await expect(page.getByTestId('story-expression-proof')).toContainText(
		'The Signal Dais exposes a true clue about the Floor 05 Foundry.'
	);
	await expect(page.getByTestId('story-voice')).toHaveCount(2);
	await expect(page.getByTestId('story-voice').first()).toContainText('operational');
	await expect(page.getByTestId('story-voice').last()).toContainText('analytical');
});

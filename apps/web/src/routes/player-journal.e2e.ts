import { expect, test } from '@playwright/test';

test('filters authoritative growth, company, direction, and replay records', async ({ page }) => {
	await page.goto('/player-journal');
	await expect(page.getByRole('heading', { name: /Deeds become history/i })).toBeVisible();

	const response = await page.request.post('/api/dev/player-journal-runs', {
		data: { seed: 'company-ledger-e2e' }
	});
	expect(response.ok()).toBe(true);
	const { runId } = (await response.json()) as { runId: string };
	await page.goto(`/mission/${runId}`);

	const journal = page.getByTestId('player-journal');
	await expect(journal).toBeVisible();
	await expect(journal).toContainText('+16 XP');
	await expect(journal).toContainText('+1 levels');
	await expect(journal).toContainText('1 attempts');
	await expect(journal.getByTestId('journal-story-change').first()).toBeVisible();

	await journal.getByTestId('journal-filter-facet-progression').click();
	await expect(journal.getByTestId('journal-entry')).toHaveCount(2);
	await expect(journal.getByTestId('journal-delta').first()).toContainText('experience');

	await journal.getByRole('button', { name: 'Clear filters' }).click();
	await journal.getByTestId('journal-filter-facet-direction').click();
	await expect(journal.getByTestId('journal-direction').first()).toContainText(
		'Advance the objective, but preserve the company'
	);
	await expect(journal.getByTestId('journal-direction').first()).toContainText('not evaluated');

	await journal.getByRole('button', { name: 'Clear filters' }).click();
	await page.getByTestId('deploy-party').click();
	await journal.getByTestId('journal-filter-facet-party').click();
	await expect(journal).toContainText('deployments');
	await expect(journal.getByTestId('journal-visible-count')).not.toHaveText('0');

	const journalResponse = await page.request.get(`/api/runs/${runId}/journal`);
	expect(journalResponse.ok()).toBe(true);
	const report = (await journalResponse.json()) as {
		reportVersion: string;
		toCursor: number;
		entryCount: number;
		reportHash: string;
		partyTotals: { deployments: number };
	};
	expect(report.reportVersion).toBe('player-journal-v1');
	expect(report.toCursor).toBe(report.entryCount);
	expect(report.reportHash).toMatch(/^[a-f0-9]{64}$/u);
	expect(report.partyTotals.deployments).toBe(1);

	if (process.env.CAPTURE_PHASE6_PLAYER_JOURNAL) {
		await journal.getByRole('button', { name: 'Clear filters' }).click();
		await page.screenshot({ path: process.env.CAPTURE_PHASE6_PLAYER_JOURNAL, fullPage: true });
	}
});

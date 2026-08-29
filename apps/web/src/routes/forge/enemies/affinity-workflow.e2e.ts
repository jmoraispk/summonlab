import { expect, test } from '@playwright/test';

test('renders partial affinity cohorts without implying approval', async ({ page }) => {
	await page.goto('/forge/enemies/affinity-workflow');
	await expect(
		page.getByRole('heading', { name: 'Recognize the creature. Then read its affinity.' })
	).toBeVisible();
	await expect(page.getByTestId('affinity-cell')).toHaveCount(84);
	await expect(page.getByText('Unapproved candidate').first()).toBeVisible();
	await expect(page.getByText('Pending generation').first()).toBeVisible();
	await expect(page.getByText('No automatic promotion')).toBeVisible();
	await expect(page.getByText('Final controlled rerun required')).toBeVisible();
	await expect(page.getByText('10 current · 10 max · 20 required')).toBeVisible();
	await expect(page.getByText('0 current · 21 max · 23 required')).toBeVisible();
	await expect(page.getByText('0 current · 17 max · 20 required')).toBeVisible();

	const reviseEvidence = page
		.getByTestId('affinity-cell')
		.filter({ hasText: 'Revision required' })
		.first();
	await reviseEvidence.getByRole('button', { name: /^Inspect / }).click();
	const reviseDialog = page.getByRole('dialog', { name: 'Candidate inspector' });
	await expect(reviseDialog.getByRole('img')).toBeVisible();
	await expect(reviseDialog.getByText('Revision evidence · inspectable')).toBeVisible();
	await expect(reviseDialog.getByRole('form', { name: 'Review candidate' })).toHaveCount(0);
	await reviseDialog.getByRole('button', { name: 'Close inspector' }).click();

	await page
		.getByRole('button', { name: /^Inspect / })
		.first()
		.click();
	await expect(page.getByRole('form', { name: 'Review candidate' })).toHaveCount(0);
	await expect(page.getByText('Review entry is disabled while labels are visible.')).toBeVisible();
	await page.getByRole('button', { name: 'Close inspector' }).click();

	await page.getByRole('button', { name: 'Breadth · 4' }).click();
	await expect(page.getByTestId('affinity-cell')).toHaveCount(24);
});

test('blind mode withholds semantic labels and uses opaque media sources', async ({ page }) => {
	await page.goto('/forge/enemies/affinity-workflow?mode=blind');
	await expect(page.getByText('Blind recognition', { exact: true })).toBeVisible();
	await expect(page.getByText('Specimen 01')).toBeVisible();
	await expect(page.getByTestId('affinity-cell')).toHaveCount(24);
	await expect(page.getByText(/0 \/ 21/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Breadth · 4' })).toHaveCount(0);

	const image = page
		.getByTestId('affinity-cell')
		.filter({ hasText: 'Unapproved candidate' })
		.first()
		.locator('button.thumbnail img');
	await expect(image).toHaveAttribute('alt', 'Unlabeled experiment candidate');
	await expect(image).toHaveAttribute(
		'src',
		/^\/forge\/enemies\/affinity-workflow\/media\/[a-f0-9]{24}$/
	);
	await image.click();
	await expect(page.getByRole('dialog', { name: 'Candidate inspector' })).toBeVisible();
	await expect(page.getByLabel('Species guess')).toBeVisible();
	await expect(page.getByLabel('Affinity guess')).toBeVisible();
	await expect(page.getByRole('form', { name: 'Review unlabeled candidate' })).toBeVisible();
	await expect(page.getByText('No target, source, prompt, filename, content hash')).toBeVisible();
	const saveReview = page.getByRole('button', { name: 'Save review' });
	if (await saveReview.isVisible()) {
		await page.getByLabel('Reviewer').fill(`test:affinity-page-${Date.now()}`);
		await page.getByLabel('Species guess').selectOption('death-knight');
		await page.getByLabel('Affinity guess').selectOption('normal');
		await page.getByRole('radio', { name: 'Candidate' }).check();
		await page.getByLabel('Review note').fill('Automated blind-mode persistence proof.');
		await saveReview.click();
		await expect(page.getByRole('status')).toContainText(
			/Review saved against the verified candidate hash|already saved/
		);
	} else {
		await expect(page.getByRole('button', { name: 'Persistence unavailable' })).toBeDisabled();
	}

	const html = await page.content();
	expect(html).not.toContain('affinity-workflow-v1-death-knight-');
	expect(html).not.toContain('normal-v1.png');
	expect(html).not.toContain('exactPrompt');
	expect(html).not.toContain('contentHash');
});

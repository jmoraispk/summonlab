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
	await expect(page.getByRole('heading', { name: 'Later-pack visual rules' })).toBeVisible();
	await expect(page.getByText('Evidence remains incomplete')).toBeVisible();
	await expect(page.getByRole('form', { name: 'Later-pack visual-rule decision' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Waiting for eligible evidence' })).toBeDisabled();
	await expect(page.getByRole('radio', { name: 'Accept' }).first()).not.toBeChecked();
	await expect(page.getByRole('radio', { name: 'Reject' }).first()).not.toBeChecked();

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

test('keeps the current final-controlled design-risk gate locked and blank', async ({ page }) => {
	await page.goto('/forge/enemies/affinity-workflow');

	const riskHeading = page.getByRole('heading', { name: 'Resolve 16 design risks' });
	if (await riskHeading.isVisible()) {
		const form = page.getByRole('form', { name: 'Final controlled design-risk decision' });

		await expect(page.getByText('Locked', { exact: true })).toBeVisible();
		await expect(page.getByText('Decision controls are locked')).toBeVisible();
		await expect(page.getByText('exported-blind-review-inventory-mismatch')).toBeVisible();
		await expect(
			page.getByText('Expected exactly 21 exported blind reviews; found 0.')
		).toBeVisible();
		await expect(form.locator('.risk-grid fieldset')).toHaveCount(16);
		await expect(form.getByRole('radio')).toHaveCount(48);
		await expect(form.locator('input[type="radio"]:checked')).toHaveCount(0);
		await expect(form.getByRole('checkbox')).toHaveCount(5);
		await expect(form.locator('input[type="checkbox"]:checked')).toHaveCount(0);
		await expect(form.getByRole('button', { name: 'Waiting for evidence' })).toBeDisabled();
	} else {
		// A configured review actor requires PostgreSQL to load its append-only history. If that
		// dependency is unavailable, the route must fail closed without rendering decision controls.
		await expect(page.getByRole('heading', { name: 'Design-risk review withheld' })).toBeVisible();
		await expect(
			page.getByText(
				'Final-controlled design-risk review is unavailable. Verify PostgreSQL and the current baseline evidence.'
			)
		).toBeVisible();
		await expect(
			page.getByRole('form', { name: 'Final controlled design-risk decision' })
		).toHaveCount(0);
	}
});

test('blind mode withholds semantic labels and uses opaque media sources', async ({ page }) => {
	await page.goto('/forge/enemies/affinity-workflow?mode=blind');
	await expect(page.getByText('Blind recognition', { exact: true })).toBeVisible();
	const reviewerInput = page.getByLabel('Reviewer identity');
	if (await reviewerInput.isVisible()) {
		await reviewerInput.fill(`test:affinity-page-${Date.now()}`);
		await page.getByRole('button', { name: 'Begin reviewer-bound session' }).click();
	} else {
		// AFFINITY_REVIEW_ACTOR can bind the session before the page renders.
		await expect(page.getByText(/^Reviewer-bound · /)).toBeVisible();
	}
	await expect(page.getByText('Specimen 01')).toBeVisible();
	await expect(page.getByTestId('affinity-cell')).toHaveCount(24);
	await expect(page.getByText(/\d+ \/ 21/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Breadth · 4' })).toHaveCount(0);

	const image = page
		.getByTestId('affinity-cell')
		.filter({ hasText: 'Unapproved candidate' })
		.first()
		.locator('button.thumbnail img');
	await expect(image).toHaveAttribute('alt', 'Unlabeled experiment candidate');
	await expect(image).toHaveAttribute(
		'src',
		/^\/forge\/enemies\/affinity-workflow\/media\/[a-f0-9]{24}\?round=baseline-v1&scope=controlled$/
	);
	await image.click();
	await expect(page.getByRole('dialog', { name: 'Candidate inspector' })).toBeVisible();
	await expect(page.getByLabel('Species guess')).toBeVisible();
	await expect(page.getByLabel('Affinity guess')).toBeVisible();
	await expect(page.getByRole('form', { name: 'Review unlabeled candidate' })).toBeVisible();
	await expect(page.getByText('No target, source, prompt, filename, content hash')).toBeVisible();
	if (!(await page.getByRole('button', { name: 'Save review' }).isVisible())) {
		await expect(page.getByRole('button', { name: 'Persistence unavailable' })).toBeDisabled();
	}

	const html = await page.content();
	expect(html).not.toContain('affinity-workflow-v1-death-knight-');
	expect(html).not.toContain('normal-v1.png');
	expect(html).not.toContain('exactPrompt');
	expect(html).not.toContain('contentHash');
	expect(html).not.toContain('affinity-changes-construction');
	expect(html).not.toContain('death-knight-normal-legacy-design');
	expect(html).not.toContain('death-knight-normal-v4');
	expect(html).not.toContain('final-controlled-activation-v1');
	expect(html).not.toContain('Resolve 16 design risks');
	expect(html).not.toContain('Decision history');
});

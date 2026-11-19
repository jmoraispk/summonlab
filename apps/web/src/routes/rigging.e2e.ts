import { expect, test } from '@playwright/test';

const BENCH = 'https://assets.summonlab.ai/bench/rigging/index.html';

// Stand-in for the hosted bench: reports a selection the way the real page does.
const stub = `<!doctype html><title>bench</title><script>
	const entry = new URLSearchParams(location.search).get('entry') ?? 'api/asha-neutral';
	const report = () =>
		parent.postMessage({ type: 'rig-bench-entry', entry: entry + '-selected' }, '*');
	report(); // may arrive before the host page listens
	addEventListener('message', (event) => {
		if (event.data?.type === 'rig-bench-hello') report();
	});
	parent.postMessage({ type: 'rig-bench-entry', entry: 42 }, '*');
</script>`;

test('embeds the hosted rig bench and keeps the link in step with its selection', async ({
	page
}) => {
	await page.route(`${BENCH}**`, (route) =>
		route.fulfill({ status: 200, contentType: 'text/html', body: stub })
	);
	await page.goto('/rigging?entry=api%2Fwolf-neutral');

	const frame = page.locator('iframe[title="Rig test bench"]');
	await expect(frame).toBeVisible();
	await expect(frame).toHaveAttribute('src', `${BENCH}?entry=api%2Fwolf-neutral`);
	await expect(page).toHaveURL(/[?&]entry=api%2Fwolf-neutral-selected$/u);
	await expect(page).toHaveTitle('Summonlab · Rig test bench');
});

test('ignores messages from other origins', async ({ page }) => {
	await page.route(`${BENCH}**`, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'text/html',
			body: '<!doctype html><title>b</title>'
		})
	);
	await page.goto('/rigging');
	await expect(page.locator('iframe[title="Rig test bench"]')).toHaveAttribute('src', BENCH);
	await page.evaluate(() =>
		window.postMessage({ type: 'rig-bench-entry', entry: 'api/forged' }, '*')
	);
	await page.waitForTimeout(200);
	expect(new URL(page.url()).searchParams.get('entry')).toBeNull();
});

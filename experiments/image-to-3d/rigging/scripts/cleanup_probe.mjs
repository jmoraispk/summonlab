// Deformation with and without the import cleanup: node rigging/scripts/cleanup_probe.mjs <entry> [clip ...]
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5187' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
const [entry, ...clips] = process.argv.slice(2);
for (const cleanup of ['0', '1']) {
	await page.goto(`http://127.0.0.1:5187/rigging/engine.html?shot=1&cleanup=${cleanup}&entry=${encodeURIComponent(entry)}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	const out = await page.evaluate((cl) => {
		const a = window.__engine;
		const names = cl.length ? cl : Object.keys(a.ch.clips);
		return { cleanup: a.cleanup, clips: Object.fromEntries(names.map((c) => { const d = a.E.deformation(a.ch, c, 24); return [c, { all: d.peak.all, knee: d.peak.knee, loincloth: d.peak.loincloth }]; })) };
	}, clips);
	console.log(cleanup === '1' ? 'cleanup ' : 'raw     ', JSON.stringify(out));
}
await browser.close(); server.kill();

// Skirt-weight variants on one entry: node rigging/scripts/skirt_variants.mjs <entry> '<json variants>'
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5188' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
for (const v of JSON.parse(process.argv[3])) {
	await page.goto(`http://127.0.0.1:5188/rigging/engine.html?shot=1&cleanup=0&entry=${encodeURIComponent(process.argv[2])}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	const out = await page.evaluate((opts) => {
		const a = window.__engine;
		const rep = opts ? a.E.skinCleanup(a.ch, opts) : null;
		const r = {};
		for (const c of ['run', 'attack', 'walk', 'death']) { const d = a.E.deformation(a.ch, c, 24); r[c] = d.peak.all; }
		return { skirt: rep?.skirtVertices, ...r };
	}, v);
	console.log(JSON.stringify(v), JSON.stringify(out));
}
await browser.close(); server.kill();

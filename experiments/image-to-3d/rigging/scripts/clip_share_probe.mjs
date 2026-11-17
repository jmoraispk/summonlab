// Clip sharing: deformation of a rig with its own Tripo clips vs another character's clips (same Mixamo
// skeleton names). node rigging/scripts/clip_share_probe.mjs <own entry> <borrowed entry>
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5189' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
for (const id of process.argv.slice(2)) {
	await page.goto(`http://127.0.0.1:5189/rigging/engine.html?shot=1&entry=${encodeURIComponent(id)}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	console.log(id, JSON.stringify(await page.evaluate(() => {
		const a = window.__engine;
		return Object.fromEntries(['walk', 'run', 'attack', 'death'].map((c) => [c, a.E.deformation(a.ch, c, 24)?.peak.all]));
	})));
}
await browser.close(); server.kill();

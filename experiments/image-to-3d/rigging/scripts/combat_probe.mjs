// Combat clips on each rig: worst-1% stretch per combat clip. node rigging/scripts/combat_probe.mjs <entry ...>
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5193' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
const COMBAT = ['chop', 'box_01', 'front_kick_01', 'hit_to_head', 'defeat_02'];
for (const id of process.argv.slice(2)) {
	await page.goto(`http://127.0.0.1:5193/rigging/engine.html?shot=1&entry=${encodeURIComponent(id)}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	console.log(id.padEnd(30), JSON.stringify(await page.evaluate((cs) => {
		const a = window.__engine;
		return { borrowed: a.ch.borrowed?.length ?? 0, ...Object.fromEntries(cs.filter((c) => a.ch.clips[c]).map((c) => [c, +a.E.deformation(a.ch, c, 24).peak.all.toFixed(2)])) };
	}, COMBAT)));
}
await browser.close(); server.kill();

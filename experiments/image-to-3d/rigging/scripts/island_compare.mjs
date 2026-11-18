// Before/after the island cleanup, close to the removed pieces: node rigging/scripts/island_compare.mjs <out.webp> <entry ...>
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5197' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const W = 360, H = 360;
const page = await browser.newPage({ viewport: { width: W, height: H } });
const [out, ...ids] = process.argv.slice(2);
const tiles = [];
for (const [r, id] of ids.entries()) {
	let target = null;
	for (const [c, cleanup] of ['1', '0', '1'].entries()) {
		await page.goto(`http://127.0.0.1:5197/rigging/engine.html?shot=1&cleanup=${cleanup}&entry=${encodeURIComponent(id)}`);
		await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
		if (c === 0) target = await page.evaluate(() => { const r = window.__engine.ch.flaggedIslands?.[0]; return r ? r.center.toArray() : null; });
		await page.evaluate(([t, cl, mark, label]) => {
			const a = window.__engine, h = a.ch.height;
			a.play('(rest pose)');
			if (t) { a.stage.controls.target.set(...t); a.stage.camera.position.set(t[0] + 0.35 * h, t[1] + 0.1 * h, t[2] + 0.45 * h); a.stage.controls.update(); }
			if (mark) a.islands(true);
			a.tag(`${label} · ${cl === '0' ? 'before cleanup' : mark ? 'flagged (marked)' : 'after cleanup'}`);
			a.render();
		}, [target, cleanup, c === 0, id.split('/')[1].replace('-neutral', '')]);
		await page.waitForTimeout(60);
		tiles.push({ input: await page.screenshot(), left: c * W, top: r * H });
	}
}
await sharp({ create: { width: 3 * W, height: ids.length * H, channels: 3, background: '#222' } }).composite(tiles).webp({ quality: 78 }).toFile(out);
await browser.close(); server.kill();

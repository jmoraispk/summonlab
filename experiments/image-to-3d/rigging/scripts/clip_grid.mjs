// Grid of clip frames: rows = entries, columns = clip@time. node rigging/scripts/clip_grid.mjs <out.webp> '<json [[clip,t],...]>' <entry ...>
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5194' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const W = 260, H = 320;
const page = await browser.newPage({ viewport: { width: W, height: H } });
const [out, colsJson, ...ids] = process.argv.slice(2);
const cols = JSON.parse(colsJson);
const tiles = [];
for (const [r, id] of ids.entries()) {
	await page.goto(`http://127.0.0.1:5194/rigging/engine.html?shot=1&entry=${encodeURIComponent(id)}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	for (const [c, [clip, f]] of cols.entries()) {
		await page.evaluate(([cl, ff, label]) => { const a = window.__engine; const d = a.ch.clips[cl]?.duration ?? 1; a.play(cl, ff * d); a.view('threeq', 0.85); a.tag(`${label} · ${cl}`); a.render(); }, [clip, f, id.split('/')[1].replace('-neutral', '')]);
		await page.waitForTimeout(50);
		tiles.push({ input: await page.screenshot(), left: c * W, top: r * H });
	}
}
await sharp({ create: { width: cols.length * W, height: ids.length * H, channels: 3, background: '#222' } }).composite(tiles).webp({ quality: 74 }).toFile(out);
await browser.close(); server.kill();

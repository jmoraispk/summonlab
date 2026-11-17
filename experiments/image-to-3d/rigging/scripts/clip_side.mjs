// Side-view strip of a walk clip (rest, then three times): node rigging/scripts/clip_side.mjs <out.webp> <entry>
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5185' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto('http://127.0.0.1:5185/rigging/engine.html?shot=1&entry=' + encodeURIComponent(process.argv[3] ?? 'api/wolf-neutral') + '');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const frames = [];
for (const t of [null, 0, 0.4, 0.8]) {
	await page.evaluate((tt) => { const a = window.__engine; if (tt === null) a.play('(rest pose)'); else a.play('walk', tt); a.view('side'); a.tag(tt === null ? 'rest' : `walk ${tt}s`); a.render(); }, t);
	await page.waitForTimeout(80);
	frames.push(await page.screenshot());
}
await sharp({ create: { width: 1600, height: 300, channels: 3, background: '#222' } }).composite(frames.map((f, i) => ({ input: f, left: i * 400, top: 0 }))).webp({ quality: 80 }).toFile(process.argv[2]);
await browser.close(); server.kill();

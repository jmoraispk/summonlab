// Side-by-side frames with cloth bones off and on: node rigging/scripts/cloth_shots.mjs <entry> <out.webp> [clip] [t ...]
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5191' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 400 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
const [entry, out, clip = 'run', ...ts] = process.argv.slice(2);
const times = ts.length ? ts.map(Number) : [null, 0.2, 0.45];
const rows = [];
for (const cloth of ['0', '1']) {
	await page.goto(`http://127.0.0.1:5191/rigging/engine.html?shot=1&cloth=${cloth}&entry=${encodeURIComponent(entry)}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	for (const t of times) {
		await page.evaluate(([c, tt, cl]) => { const a = window.__engine; if (tt === null) a.play('(rest pose)'); else a.play(c, tt); a.view('threeq', 0.8); a.tag(`${cl === '1' ? 'cloth bones' : 'Tripo rig'} · ${tt === null ? 'rest' : c + ' ' + tt + 's'}`); a.render(); }, [clip, t, cloth]);
		await page.waitForTimeout(60);
		rows.push(await page.screenshot());
	}
}
const cols = times.length;
await sharp({ create: { width: 320 * cols, height: 800, channels: 3, background: '#222' } }).composite(rows.map((b, i) => ({ input: b, left: (i % cols) * 320, top: Math.floor(i / cols) * 400 }))).webp({ quality: 78 }).toFile(out);
await browser.close(); server.kill();

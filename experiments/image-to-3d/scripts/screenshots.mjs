// Capture turntable screenshots (4 angles) for each model and compose them next to the source art.
// Output: previews/turntables/<tool>--<subject>.webp (committed, small) and previews/compare/<subject>.webp.
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const EXP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 5181;
const ANGLES = [0, 90, 180, 270];
const W = 420, H = 480;
const index = JSON.parse(await readFile(path.join(EXP, 'work/models/index.json'), 'utf8'));
const only = new Set(process.argv.slice(2));

const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const exe = [path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome')].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await mkdir(path.join(EXP, 'previews/turntables'), { recursive: true });
await mkdir(path.join(EXP, 'previews/compare'), { recursive: true });

const strips = {};
for (const m of index.models) {
	if (only.size && !only.has(m.subject) && !only.has(m.tool)) continue;
	const frames = [];
	for (const a of ANGLES) {
		await page.goto(`http://127.0.0.1:${PORT}/viewer.html?shot=1&model=${encodeURIComponent(m.key)}&angle=${a}&variant=optimized`);
		await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
		await page.waitForTimeout(400);
		frames.push(await page.screenshot());
	}
	const strip = await sharp({ create: { width: W * ANGLES.length, height: H, channels: 3, background: '#2a2f36' } })
		.composite(frames.map((input, i) => ({ input, left: i * W, top: 0 }))).png().toBuffer();
	strips[m.subject] ??= [];
	strips[m.subject].push({ tool: m.toolLabel, strip });
	await sharp(strip).resize({ width: 1200 }).webp({ quality: 80 }).toFile(path.join(EXP, `previews/turntables/${m.tool}--${m.subject}.webp`));
	console.log('shot', m.key);
}

// Animation frame strips: side view, 5 evenly spaced frames per clip.
await mkdir(path.join(EXP, 'previews/animation'), { recursive: true });
for (const m of index.models) {
	if (!m.animated || (only.size && !only.has(m.subject) && !only.has(m.tool))) continue;
	for (const [clip, dur] of [['walk', 1.0], ['attack', 0.8]]) {
		const frames = [];
		for (let i = 0; i < 5; i++) {
			const t = (dur * i) / 5;
			await page.goto(`http://127.0.0.1:${PORT}/viewer.html?shot=1&model=${encodeURIComponent(m.key)}&angle=${m.sideYaw ?? 90}&clip=${clip}&t=${t}`);
			await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
			await page.waitForTimeout(300);
			frames.push(await page.screenshot());
		}
		const strip = await sharp({ create: { width: W * 5, height: H, channels: 3, background: '#2a2f36' } })
			.composite(frames.map((input, i) => ({ input, left: i * W, top: 0 }))).png().toBuffer();
		await sharp(strip).resize({ width: 1400 }).webp({ quality: 78 }).toFile(path.join(EXP, `previews/animation/${m.tool}--${m.subject}--${clip}.webp`));
		console.log('anim', m.key, clip);
	}
}

// Comparison sheet per subject: source/clean pair on top, one turntable strip per tool below with a label.
for (const [subject, rows] of Object.entries(strips)) {
	const src = await sharp(path.join(EXP, `previews/sources/${subject}.webp`)).resize({ height: H }).png().toBuffer();
	const srcW = (await sharp(src).metadata()).width;
	const width = W * ANGLES.length;
	const label = (t) => Buffer.from(`<svg width="${width}" height="34"><rect width="100%" height="100%" fill="#1d2024"/><text x="12" y="23" font-family="sans-serif" font-size="18" fill="#e6e3dc">${t}</text></svg>`);
	const layers = [{ input: src, left: Math.round((width - srcW) / 2), top: 0 }];
	let y = H;
	for (const r of rows) {
		layers.push({ input: label(r.tool), left: 0, top: y }); y += 34;
		layers.push({ input: r.strip, left: 0, top: y }); y += H;
	}
	const sheet = await sharp({ create: { width, height: y, channels: 3, background: '#15171a' } }).composite(layers).png().toBuffer();
	await sharp(sheet).resize({ width: 1200 }).webp({ quality: 80 }).toFile(path.join(EXP, `previews/compare/${subject}.webp`));
	console.log('compare', subject);
}
await browser.close();
server.kill();

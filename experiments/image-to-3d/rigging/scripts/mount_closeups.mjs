// Close-ups of weapon mounts: node rigging/scripts/mount_closeups.mjs <out.webp> <entry ...>
// Per entry: sword grip (rest, walk) at the right hand, helmet front and side.
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5195' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const W = 300, H = 300;
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
const [out, ...ids] = process.argv.slice(2);
const tiles = [];
const shots = [
	['sword (Tripo)', '(rest pose)', 0, 'hand_r', null],
	['sword (Tripo)', 'walk', 0.3, 'hand_r', null],
	['sword (Tripo)', 'attack', 0.45, 'hand_r', null],
	['helmet (Tripo)', '(rest pose)', 0, 'head', 'front'],
	['helmet (Tripo)', '(rest pose)', 0, 'head', 'side'],
];
for (const [r, id] of ids.entries()) {
	await page.goto(`http://127.0.0.1:5195/rigging/engine.html?shot=1&entry=${encodeURIComponent(id)}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	for (const [c, [w, clip, f, bone, side]] of shots.entries()) {
		await page.evaluate(async ([w, clip, f, bone, side, label]) => {
			const a = window.__engine;
			await a.setWeapon(w);
			const d = a.ch.clips[clip]?.duration ?? 1;
			a.play(clip, clip === '(rest pose)' ? null : f * d);
			a.focus(bone);
			if (side) {
				const t = a.stage.controls.target, h = a.ch.height;
				a.stage.camera.position.set(t.x + (side === 'side' ? 0.45 * h : 0), t.y + 0.03 * h, t.z + (side === 'front' ? 0.45 * h : 0.05 * h));
				a.stage.controls.update();
			}
			a.tag(`${label} · ${w.split(' ')[0]} · ${clip === '(rest pose)' ? 'rest' : clip}${side ? ' · ' + side : ''}`);
			a.render();
		}, [w, clip, f, bone, side, id.split('/')[1].replace('-neutral', '')]);
		await page.waitForTimeout(60);
		tiles.push({ input: await page.screenshot(), left: c * W, top: r * H });
	}
}
await sharp({ create: { width: shots.length * W, height: ids.length * H, channels: 3, background: '#222' } }).composite(tiles).webp({ quality: 78 }).toFile(out);
await browser.close(); server.kill();

// Bone world heights at rest vs a clip time, for diagnosing clips that move a creature off the ground.
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5186' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
await page.goto(`http://127.0.0.1:5186/rigging/engine.html?shot=1&entry=${encodeURIComponent(process.argv[2])}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
console.log(await page.evaluate(([clip, t]) => {
	const a = window.__engine, ch = a.ch;
	const snap = () => Object.fromEntries(ch.skeleton.bones.filter((b, i) => i < 40).map((b) => { const p = b.getWorldPosition(b.position.clone()); return [b.name.replace('tripo', ''), p.y.toFixed(2)]; }));
	a.play('(rest pose)'); ch.root.updateMatrixWorld(true); const rest = snap();
	a.play(clip, t); ch.root.updateMatrixWorld(true); const anim = snap();
	const track = ch.clips[clip].tracks.filter((k) => !k.name.endsWith('.quaternion')).map((k) => `${k.name} ${Array.from(k.values.slice(0, 3)).map((v) => v.toFixed(3))}`);
	return JSON.stringify({ rest, anim, nonRotationTracks: track });
}, [process.argv[3] ?? 'walk', Number(process.argv[4] ?? 0)]));
await browser.close(); server.kill();

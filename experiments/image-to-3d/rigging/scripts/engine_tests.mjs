// Run the in-engine tests for every manifest entry (or those matching argv filters) in headless Chromium.
// Writes rigging/results/<slug>.json and rigging/previews/<slug>/*.webp (small, committed).
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const RIG = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXP = path.resolve(RIG, '..');
const PORT = 5182;
const W = 360, H = 440;
const manifest = JSON.parse(await readFile(path.join(RIG, 'manifest.json'), 'utf8'));
const only = process.argv.slice(2);
const entries = manifest.entries.filter((e) => !only.length || only.some((o) => e.id.includes(o)));

const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({
	executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
const ev = (fn, arg) => page.evaluate(fn, arg);
const snap = async () => { await ev(() => window.__engine.render()); await page.waitForTimeout(60); return page.screenshot(); };

async function strip(frames, file, cols = frames.length) {
	const rows = Math.ceil(frames.length / cols);
	const img = await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#20242a' } })
		.composite(frames.map((input, i) => ({ input, left: (i % cols) * W, top: Math.floor(i / cols) * H }))).png().toBuffer();
	await sharp(img).resize({ width: Math.min(W * cols, 1500) }).webp({ quality: 78 }).toFile(file);
}

for (const entry of entries) {
	const slug = entry.id.replace(/[^a-z0-9]+/gi, '-');
	const out = path.join(RIG, 'previews', slug);
	await mkdir(out, { recursive: true });
	await mkdir(path.join(RIG, 'results'), { recursive: true });
	await page.goto(`http://127.0.0.1:${PORT}/rigging/engine.html?shot=1&entry=${encodeURIComponent(entry.id)}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
	const result = { entry: entry.id, label: entry.label, at: new Date().toISOString() };

	// Skeleton and rest pose.
	result.skeleton = await ev(() => {
		const a = window.__engine, ch = a.ch, c = ch.bones.canon, THREE = null;
		ch.skeleton.pose(); ch.root.updateMatrixWorld(true);
		const P = (b) => b && b.getWorldPosition(new b.position.constructor());
		const angle = (b, d) => { if (!b || !d) return null; const v = P(d).sub(P(b)).normalize(); return +(Math.acos(Math.max(-1, Math.min(1, -v.y))) * 180 / Math.PI).toFixed(1); };
		return { ...a.skeleton, restPose: { leftArmFromVerticalDeg: angle(c.upperarm_l, c.forearm_l), rightArmFromVerticalDeg: angle(c.upperarm_r, c.forearm_r),
			leftElbowBendDeg: c.forearm_l && c.hand_l ? +(P(c.forearm_l).sub(P(c.upperarm_l)).angleTo(P(c.hand_l).sub(P(c.forearm_l))) * 180 / Math.PI).toFixed(1) : null,
			leftKneeBendDeg: c.shin_l && c.foot_l ? +(P(c.shin_l).sub(P(c.thigh_l)).angleTo(P(c.foot_l).sub(P(c.shin_l))) * 180 / Math.PI).toFixed(1) : null } };
	});
	const clips = await ev(() => Object.keys(window.__engine.ch.clips));
	result.clips = clips;

	// 1. Deformation: metric per clip, worst frame, and a 5-frame strip.
	result.deformation = {};
	for (const clip of clips) {
		const d = await ev((c) => window.__engine.E.deformation(window.__engine.ch, c, 24), clip);
		result.deformation[clip] = d;
		await ev(() => window.__engine.view('threeq'));
		const frames = [];
		for (let i = 0; i < 5; i++) {
			const t = (d.duration * i) / 5;
			await ev(([c, tt]) => { window.__engine.play(c, tt); window.__engine.tag(`${c} ${tt.toFixed(2)}s`); }, [clip, t]);
			frames.push(await snap());
		}
		await strip(frames, path.join(out, `clip-${clip}.webp`));
		await ev(([c, tt, s]) => { window.__engine.play(c, tt); window.__engine.tag(`${c} worst frame ${tt.toFixed(2)}s · p99 stretch ${(s * 100).toFixed(0)}%`); }, [clip, d.worstFrame.t, d.worstFrame.stretch.all ?? 0]);
		const worst = [];
		for (const v of ['threeq', 'front', 'side']) { await ev((vv) => window.__engine.view(vv), v); worst.push(await snap()); }
		await strip(worst, path.join(out, `worst-${clip}.webp`));
		console.log(entry.id, 'clip', clip, JSON.stringify(d.peak));
	}

	// 2. Weapon attachment: each weapon in the right hand through attack and walk, then a swap.
	result.weapons = {};
	for (const [key, w] of Object.entries(entry.weapons ?? {})) {
		try {
			await ev((k) => window.__engine.setWeapon(k), key);
			const frames = [];
			for (const clip of ['attack', 'walk'].filter((c) => clips.includes(c))) {
				const dur = result.deformation[clip].duration;
				for (const f of [0.15, 0.45, 0.75]) {
					await ev(([c, tt, k]) => { window.__engine.view('threeq'); window.__engine.play(c, tt); window.__engine.tag(`${k} · ${c}`); }, [clip, dur * f, key]);
					frames.push(await snap());
				}
			}
			const slugW = key.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
			if (frames.length) await strip(frames, path.join(out, `weapon-${slugW}.webp`), 3);
			result.weapons[key] = { ok: true, mode: w.mode };
		} catch (e) {
			result.weapons[key] = { ok: false, error: String(e.message ?? e) };
		}
	}
	await ev(() => window.__engine.setWeapon(''));

	// 3. Ragdoll: kill mid-walk (or mid first clip) and fall under 3x gravity.
	const killClip = clips.includes('walk') ? 'walk' : clips[0];
	if (killClip) {
		const dur = result.deformation[killClip].duration;
		await ev(([c, t]) => { window.__engine.view('side'); window.__engine.play(c, t); }, [killClip, dur * 0.4]);
		await ev(([c, t]) => window.__engine.kill(c, t), [killClip, dur * 0.4]);
		const frames = [];
		let elapsed = 0;
		const stats = [];
		for (const at of [0, 0.2, 0.4, 0.7, 1.2, 2.5]) {
			const s = await ev((dt) => window.__engine.simulate(dt), at - elapsed);
			elapsed = at;
			stats.push({ t: at, ...s });
			await ev((t) => window.__engine.tag(`ragdoll ${t.toFixed(1)}s`), at);
			frames.push(await snap());
		}
		await strip(frames, path.join(out, 'ragdoll.webp'), 6);
		result.ragdoll = { killClip, killAt: +(dur * 0.4).toFixed(2), gravity: '3x', stats };
		await page.goto(`http://127.0.0.1:${PORT}/rigging/engine.html?shot=1&entry=${encodeURIComponent(entry.id)}`);
		await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
	}

	// 4. Hit regions.
	result.hitRegions = await ev(() => window.__engine.hits);
	const regionFrames = [];
	for (const r of ['head', 'throat', 'torso', 'elbow', 'forearm', 'wrist', 'knee']) {
		await ev((rr) => { window.__engine.play('(rest pose)'); window.__engine.view('front'); window.__engine.region(rr); window.__engine.tag(`hit: ${rr}`); }, r);
		regionFrames.push(await snap());
	}
	await ev(() => window.__engine.region(null));
	await strip(regionFrames, path.join(out, 'hit-regions.webp'), 7);

	// 5. Texture under day and night lighting (rest pose, front and three-quarter).
	const tex = [];
	for (const light of ['day', 'night']) for (const v of ['front', 'threeq']) {
		await ev(([l, vv]) => { window.__engine.light(l); window.__engine.view(vv); window.__engine.play(window.__engine.ch.clips.idle ? 'idle' : '(rest pose)', 0); window.__engine.tag(l); }, [light, v]);
		tex.push(await snap());
	}
	await strip(tex, path.join(out, 'texture-day-night.webp'), 4);

	await writeFile(path.join(RIG, 'results', `${slug}.json`), JSON.stringify(result, null, 2));
	console.log('done', entry.id);
}
await browser.close();
server.kill();

// Head measurements for helmet fitting: node rigging/scripts/head_probe.mjs <entry ...>
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5196' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
for (const id of process.argv.slice(2)) {
	await page.goto(`http://127.0.0.1:5196/rigging/engine.html?shot=1&entry=${encodeURIComponent(id)}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	await page.evaluate(async () => { await window.__engine.setWeapon('helmet (Tripo)'); window.__engine.play('(rest pose)'); });
	console.log(id, 'helmet', JSON.stringify(await page.evaluate(() => {
		const a = window.__engine; let helm = null;
		a.ch.bones.canon.head.traverse((o) => { if (o.isMesh && !helm) helm = o; });
		const THREE = a.E; const box = new (a.stage.scene.constructor === Object ? Object : a.ch.root.constructor)();
		const b = new window.__engine.stage.camera.position.constructor();
		let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
		a.ch.bones.canon.head.updateMatrixWorld(true);
		helm.geometry.computeBoundingBox();
		const bb = helm.geometry.boundingBox; const corners = [];
		for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { const v = b.clone().set(x, y, z).applyMatrix4(helm.matrixWorld); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v.getComponent(k)); max[k] = Math.max(max[k], v.getComponent(k)); } }
		return { min: min.map((v) => +v.toFixed(3)), max: max.map((v) => +v.toFixed(3)), meshes: (() => { let n = 0; a.ch.bones.canon.head.traverse((o) => { if (o.isMesh) n++; }); return n; })() };
	})));
	console.log(id, JSON.stringify(await page.evaluate(() => {
		const a = window.__engine, ch = a.ch, S = a.E.segments(ch), head = ch.bones.canon.head, hs = S.byBone.get(head);
		const ys = hs.verts.map((i) => S.pos[i * 3 + 1]).sort((x, y) => x - y);
		const q = (arr, f) => arr[Math.floor(f * (arr.length - 1))];
		const allY = []; for (let i = 0; i < S.n; i++) allY.push(S.pos[i * 3 + 1]); allY.sort((x, y) => x - y);
		const top = head.children.find((k) => k.isBone);
		const r = (v) => +v.toFixed(3);
		return { headVerts: hs.verts.length, headBoneY: r(head.getWorldPosition(head.position.clone()).y), headTopY: top ? r(top.getWorldPosition(top.position.clone()).y) : null,
			ysP05: r(q(ys, 0.05)), ysP50: r(q(ys, 0.5)), ysP97: r(q(ys, 0.97)), meshTopY: r(allY.at(-1)), height: ch.height };
	})));
}
await browser.close(); server.kill();

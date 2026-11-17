// Ragdoll stability probe: max body speed over 3 s for option variants (diagnostics only).
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const EXP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 5183;
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 320 } });
const variants = JSON.parse(process.argv[3] ?? '[{}]');
for (const v of variants) {
	await page.goto(`http://127.0.0.1:${PORT}/rigging/engine.html?shot=1&entry=${encodeURIComponent(process.argv[2])}`);
	await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
	const trace = await page.evaluate(async (opts) => {
		const a = window.__engine; a.ragdollOptions = opts;
		await a.kill('(rest pose)', null);
		const out = [];
		let s;
		for (let i = 0; i < 6; i++) { s = a.simulate(0.5); out.push(s.maxSpeed); }
		out.push(`hits=${s.limitHits} excess=${s.maxLimitExcess}`);
		return out;
	}, v);
	console.log(JSON.stringify(v), trace.join(' '));
}
await browser.close(); server.kill();

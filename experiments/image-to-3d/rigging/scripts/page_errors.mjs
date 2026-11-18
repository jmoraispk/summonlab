// Load one bench entry and print console errors and page errors (debugging aid).
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const EXP = process.cwd();
const server = spawn(process.execPath, [path.join(EXP, 'scripts/serve.mjs')], { env: { ...process.env, PORT: '5198' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ executablePath: path.join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto(`http://127.0.0.1:5198/rigging/engine.html?shot=1&entry=${encodeURIComponent(process.argv[2])}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).then(() => console.log('ready'), () => console.log('not ready'));
await browser.close(); server.kill();

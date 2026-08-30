import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const traceTempDirectory = await mkdtemp(join(tmpdir(), 'summonlab-vercel-trace-'));
const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

try {
	const exitCode = await new Promise((resolve, reject) => {
		const child = spawn(pnpmExecutable, ['exec', 'vite', 'build'], {
			cwd: new URL('../apps/web/', import.meta.url),
			stdio: 'inherit',
			env: {
				...process.env,
				TMPDIR: traceTempDirectory,
				TEMP: traceTempDirectory,
				TMP: traceTempDirectory
			}
		});

		child.once('error', reject);
		child.once('exit', (code, signal) => {
			if (signal) reject(new Error(`Web build terminated by ${signal}.`));
			else resolve(code ?? 1);
		});
	});

	process.exitCode = exitCode;
} finally {
	await rm(traceTempDirectory, { recursive: true, force: true });
}

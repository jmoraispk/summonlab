import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {readonly string[]} args */
export function normalizePlaywrightArgs(args) {
	return args[0] === '--' ? args.slice(1) : [...args];
}

/** @param {readonly string[]} args */
export function runPlaywright(args) {
	const require = createRequire(import.meta.url);
	const playwrightCli = require.resolve('@playwright/test/cli');
	const child = spawn(process.execPath, [playwrightCli, 'test', ...normalizePlaywrightArgs(args)], {
		stdio: 'inherit'
	});

	child.once('error', (error) => {
		console.error(error);
		process.exitCode = 1;
	});
	child.once('exit', (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		else process.exitCode = code ?? 1;
	});
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	runPlaywright(process.argv.slice(2));
}

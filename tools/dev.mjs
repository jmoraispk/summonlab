import { execFileSync, spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const withDatabase = process.argv.includes('--with-db');
const smoke = process.argv.includes('--smoke');
const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
	encoding: 'utf8'
}).trim();
const environment = { ...process.env, SUMMONLAB_COMMIT_SHA: commit };

function run(command, args) {
	const windows = process.platform === 'win32';
	const executable = windows ? (process.env.ComSpec ?? 'cmd.exe') : command;
	const executableArguments = windows ? ['/d', '/s', '/c', command, ...args] : args;
	return spawn(executable, executableArguments, {
		stdio: 'inherit',
		env: environment,
		shell: false
	});
}

if (withDatabase) {
	const database = run('pnpm', ['db:start']);
	const exitCode = await new Promise((resolve) => database.once('exit', resolve));
	if (exitCode !== 0) {
		process.exitCode = typeof exitCode === 'number' ? exitCode : 1;
		throw new Error('PostgreSQL failed to start. Install Docker or use pnpm dev:app.');
	}
}

const web = run('pnpm', ['--filter', '@summonlab/web', 'dev', '--host', '0.0.0.0']);
const worker = run('pnpm', ['--filter', '@summonlab/worker', 'dev']);
const children = [web, worker];
let stopping = false;

function stop(signal) {
	if (stopping) return;
	stopping = true;
	for (const child of children) {
		if (process.platform === 'win32' && child.pid) {
			spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
		} else {
			child.kill(signal);
		}
	}
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

if (smoke) {
	let webHealth;
	let workerHealth;

	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const [webResponse, workerResponse] = await Promise.all([
				fetch('http://127.0.0.1:5173/health'),
				fetch('http://127.0.0.1:4174/health')
			]);
			if (!webResponse.ok || !workerResponse.ok) throw new Error('Health is degraded');
			webHealth = await webResponse.json();
			workerHealth = await workerResponse.json();
			break;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	if (!webHealth || !workerHealth) {
		stop('SIGTERM');
		throw new Error('Web and worker did not become healthy within 30 seconds.');
	}

	process.stdout.write(
		`web=${JSON.stringify(webHealth)}\nworker=${JSON.stringify(workerHealth)}\n`
	);
	stop('SIGTERM');
	process.exit(0);
}

const exitCode = await new Promise((resolve) => {
	for (const child of children) {
		child.once('exit', (code) => resolve(typeof code === 'number' ? code : 1));
	}
});

stop('SIGTERM');
process.exitCode = exitCode;

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const operation = process.argv[2];
const composeArguments = {
	start: ['compose', 'up', '-d', '--wait', 'postgres'],
	stop: ['compose', 'down'],
	logs: ['compose', 'logs', '-f', 'postgres']
};

if (!(operation in composeArguments)) {
	process.stderr.write('Usage: node tools/database.mjs <start|stop|logs>\n');
	process.exit(2);
}

function isAvailable(command, args) {
	return spawnSync(command, args, { stdio: 'ignore', shell: false }).status === 0;
}

let command;
let args;

if (isAvailable('docker', ['version'])) {
	command = 'docker';
	args = composeArguments[operation];
} else if (process.platform === 'win32' && isAvailable('wsl.exe', ['--', 'docker', 'version'])) {
	command = 'wsl.exe';
	args = ['--cd', process.cwd(), '--', 'docker', ...composeArguments[operation]];
} else {
	process.stderr.write(
		'Docker is unavailable. Install Docker Desktop, provide Docker in WSL, or run pnpm dev:app.\n'
	);
	process.exit(1);
}

const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exit(result.status ?? 1);

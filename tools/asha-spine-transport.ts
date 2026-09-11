import { runAshaSpineTransport } from './asha-spine-transport-lib.js';

const mode = process.argv[2];
if (mode !== '--write' && mode !== '--check') {
	throw new Error('Usage: tsx tools/asha-spine-transport.ts --write|--check');
}

const result = await runAshaSpineTransport({
	workspaceRoot: process.cwd(),
	mode: mode === '--write' ? 'write' : 'check',
	log: (message) => process.stdout.write(`${message}\n`)
});

process.stdout.write(
	`Asha Spine transport ${result.mode} passed: ${result.validation.pageWidth}x${result.validation.pageHeight}, ${result.validation.animationDurationSeconds}s probe.\n`
);

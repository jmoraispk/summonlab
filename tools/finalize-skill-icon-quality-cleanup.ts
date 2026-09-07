import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { finalizeSkillIconQualityCleanup } from './skill-icon-quality-cleanup-lib.js';

function parseMode(args: readonly string[]): 'write' | 'check' {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? '')) {
		throw new Error('Usage: tsx tools/finalize-skill-icon-quality-cleanup.ts --write|--check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	finalizeSkillIconQualityCleanup({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => {
			process.stdout.write(`${JSON.stringify(report)}\n`);
			if (!report.ready || report.drifted.length > 0) process.exitCode = 1;
		})
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}

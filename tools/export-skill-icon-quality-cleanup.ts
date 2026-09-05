import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { exportSkillIconQualityCleanup } from './skill-icon-quality-cleanup-lib.js';

function parseMode(args: readonly string[]): 'write' | 'check' {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? '')) {
		throw new Error('Usage: tsx tools/export-skill-icon-quality-cleanup.ts --write|--check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	exportSkillIconQualityCleanup({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => {
			process.stdout.write(
				`${report.mode}: ${report.counts.total} skills (${report.counts.Martial} Martial, ${report.counts.Magical} Magical, ${report.counts.Craft} Craft); ${report.written.length} written; ${report.drifted.length} drifted\n`
			);
			if (report.drifted.length > 0) process.exitCode = 1;
		})
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { finalizeCleanupRevisionV2 } from './skill-icon-quality-cleanup-v2-lib.js';

function parseArgs(args: readonly string[]): { readonly requireComplete: boolean } {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (
		normalized.length !== 1 ||
		(normalized[0] !== '--check' && normalized[0] !== '--require-complete')
	) {
		throw new Error(
			'Usage: tsx tools/finalize-skill-icon-quality-cleanup-v2.ts --check|--require-complete'
		);
	}
	return { requireComplete: normalized[0] === '--require-complete' };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	let args: { readonly requireComplete: boolean } | undefined;
	try {
		args = parseArgs(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
	if (args) {
		finalizeCleanupRevisionV2({})
			.then((report) => {
				process.stdout.write(
					`${JSON.stringify({
						ready: report.ready,
						candidateCount: report.candidateCount,
						unresolved: report.selection.unresolved,
						pendingGenerationTargetIds: report.pendingGenerationTargetIds
					})}\n`
				);
				if (args.requireComplete && !report.ready) process.exitCode = 1;
			})
			.catch((error: unknown) => {
				process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
				process.exitCode = 1;
			});
	}
}

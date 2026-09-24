import { resolve } from 'node:path';

import {
	loadDecompositionBrief,
	materializeDecompositionCandidate,
	parseDecompositionCliArgs,
	preflightDecomposition
} from './asha-spine-decomposition-lib.js';

const BRIEF_PATH = 'assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/brief.json';

async function main(): Promise<void> {
	const parsed = parseDecompositionCliArgs(process.argv.slice(2));
	const { command, version } = parsed;
	const workspaceRoot = process.cwd();
	const brief = await loadDecompositionBrief(resolve(workspaceRoot, BRIEF_PATH));
	if (command === 'materialize') {
		const result = await materializeDecompositionCandidate({
			brief,
			workspaceRoot,
			version,
			providerOutputPath: parsed.providerOutputPath
		});
		process.stdout.write(
			`Asha Spine decomposition materialized v${version}: ${result.disposition}.\n`
		);
		return;
	}
	await preflightDecomposition(
		brief,
		workspaceRoot,
		command === 'preflight' ? 'write' : 'check',
		version
	);
	process.stdout.write(`Asha Spine decomposition ${command} passed for v${version}.\n`);
}

void main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

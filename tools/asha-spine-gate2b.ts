import { resolve } from 'node:path';

import {
	loadGate2BContract,
	materializeGate2BCandidate,
	parseGate2BCliArgs,
	preflightGate2B
} from './asha-spine-gate2b-lib.js';

const CONTRACT_PATH =
	'assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1/gate-2b.json';

async function main(): Promise<void> {
	const workspaceRoot = process.cwd();
	const parsed = parseGate2BCliArgs(process.argv.slice(2));
	const contract = await loadGate2BContract(resolve(workspaceRoot, CONTRACT_PATH));
	if (parsed.command === 'materialize') {
		const result = await materializeGate2BCandidate({
			contract,
			workspaceRoot,
			providerOutputPath: parsed.providerOutputPath,
			keyedOutputPath: parsed.keyedOutputPath,
			materializationRevision: parsed.materializationRevision
		});
		process.stdout.write(
			`Asha Spine Gate 2B materialized v2-r${parsed.materializationRevision}: ${result.disposition}.\n`
		);
		return;
	}
	await preflightGate2B(
		contract,
		workspaceRoot,
		parsed.command === 'preflight' ? 'write' : 'check',
		parsed.materializationRevision
	);
	process.stdout.write(
		`Asha Spine Gate 2B ${parsed.command} passed for v2-r${parsed.materializationRevision}.\n`
	);
}

void main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { computeFamilyAffinityProductionSurface } from './check-family-affinity-production-dispatch.js';
import { stableFamilyAffinityJson } from './family-affinity-production-lib.js';

const CONTRACT_PATH = 'skills/summonlab-image-production/references/contract-v3.json';
const CONTRACT_SURFACE_PATH = 'references/contract-v3.json';

type ExecutionSurfaceContract = {
	executionSurface?: {
		files?: unknown;
		expectedNonContractSha256?: unknown;
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

function stringRecord(value: unknown): value is Record<string, string> {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.values(value).every((entry) => typeof entry === 'string')
	);
}

function assertExecutionSurfaceContract(
	value: unknown
): asserts value is ExecutionSurfaceContract & {
	executionSurface: {
		files: string[];
		expectedNonContractSha256: Record<string, string>;
	};
} {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Family production contract must be an object');
	}
	const executionSurface = (value as ExecutionSurfaceContract).executionSurface;
	if (
		executionSurface === null ||
		typeof executionSurface !== 'object' ||
		!Array.isArray(executionSurface.files) ||
		!executionSurface.files.every((entry): entry is string => typeof entry === 'string') ||
		new Set(executionSurface.files).size !== executionSurface.files.length ||
		!executionSurface.files.includes(CONTRACT_SURFACE_PATH) ||
		!stringRecord(executionSurface.expectedNonContractSha256)
	) {
		throw new Error('Family production contract has an invalid execution surface');
	}
	const expectedKeys = executionSurface.files
		.filter((entry) => entry !== CONTRACT_SURFACE_PATH)
		.sort();
	const actualKeys = Object.keys(executionSurface.expectedNonContractSha256).sort();
	if (
		expectedKeys.length !== actualKeys.length ||
		expectedKeys.some((entry, index) => entry !== actualKeys[index])
	) {
		throw new Error('Family production contract execution-surface hash keys are incomplete');
	}
}

export async function resealFamilyProductionExecutionSurface(input: {
	repositoryRoot: string;
	write: boolean;
}) {
	const repositoryRoot = path.resolve(input.repositoryRoot);
	const skillRoot = path.join(repositoryRoot, 'skills/summonlab-image-production');
	const contractPath = path.join(repositoryRoot, CONTRACT_PATH);
	const source = await readFile(contractPath, 'utf8');
	const contract = JSON.parse(source) as unknown;
	assertExecutionSurfaceContract(contract);

	const surface = await computeFamilyAffinityProductionSurface(skillRoot);
	const expectedNonContractSha256 = Object.fromEntries(
		surface.files
			.filter(({ path: surfacePath }) => surfacePath !== CONTRACT_SURFACE_PATH)
			.map(({ path: surfacePath, sha256 }) => [surfacePath, sha256])
	);
	const current = contract.executionSurface.expectedNonContractSha256;
	const drifted =
		stableFamilyAffinityJson(current) !== stableFamilyAffinityJson(expectedNonContractSha256);
	if (!drifted) {
		return { mode: 'check' as const, files: Object.keys(expectedNonContractSha256).length };
	}
	if (!input.write) throw new Error('Family production execution surface seal drifted');

	const resealed = {
		...contract,
		executionSurface: {
			...contract.executionSurface,
			expectedNonContractSha256
		}
	};
	await writeFile(contractPath, `${JSON.stringify(resealed, null, '\t')}\n`, 'utf8');
	return { mode: 'write' as const, files: Object.keys(expectedNonContractSha256).length };
}

async function main(): Promise<void> {
	const mode = process.argv[2];
	if (mode !== '--write' && mode !== '--check') {
		throw new Error('usage: reseal-family-production-execution-surface.ts --write|--check');
	}
	const result = await resealFamilyProductionExecutionSurface({
		repositoryRoot: process.cwd(),
		write: mode === '--write'
	});
	process.stdout.write(
		`${result.mode === 'write' ? 'Resealed' : 'Verified'} ${result.files} family production execution-surface file hashes.\n`
	);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}

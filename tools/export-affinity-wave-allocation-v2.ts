import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { format } from 'prettier';

import {
	AFFINITY_WAVE_ALLOCATION_V1_PATH,
	AFFINITY_WAVE_ALLOCATION_V2_PATH,
	AffinityWaveAllocationV1SourceSchema,
	AffinityWaveAllocationV2Schema,
	FINAL_CONTROLLED_RERUN_PLAN_PATH,
	FinalControlledPlanAllocationSourceSchema,
	buildAffinityWaveAllocationV2,
	canonicalJsonSha256V2
} from './affinity-wave-allocation-v2.js';

export type AffinityWaveAllocationV2ExportMode = 'check' | 'write';

export interface AffinityWaveAllocationV2ExportReport {
	readonly mode: AffinityWaveAllocationV2ExportMode;
	readonly artifactPath: typeof AFFINITY_WAVE_ALLOCATION_V2_PATH;
	readonly canonicalSha256: string;
	readonly sourceFinalControlledPlanCanonicalSha256: string;
	readonly sourceAllocationV1CanonicalSha256: string;
	readonly workloadCount: number;
	readonly finalControlledJobCount: number;
	readonly futureSentinelCount: number;
	readonly inSync: boolean;
	readonly written: boolean;
}

async function readJson(workspaceRoot: string, repositoryPath: string): Promise<unknown> {
	return JSON.parse(await readFile(path.resolve(workspaceRoot, repositoryPath), 'utf8')) as unknown;
}

async function allocationText(repositoryPath: string, value: unknown): Promise<string> {
	return format(JSON.stringify(value), {
		filepath: repositoryPath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
}

export async function exportAffinityWaveAllocationV2(options: {
	readonly workspaceRoot?: string;
	readonly mode: AffinityWaveAllocationV2ExportMode;
}): Promise<AffinityWaveAllocationV2ExportReport> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const [finalPlanInput, legacyInput] = await Promise.all([
		readJson(workspaceRoot, FINAL_CONTROLLED_RERUN_PLAN_PATH),
		readJson(workspaceRoot, AFFINITY_WAVE_ALLOCATION_V1_PATH)
	]);
	const finalPlan = FinalControlledPlanAllocationSourceSchema.parse(finalPlanInput);
	const legacyAllocation = AffinityWaveAllocationV1SourceSchema.parse(legacyInput);
	const finalPlanCanonicalSha256 = canonicalJsonSha256V2(finalPlanInput);
	const legacyAllocationCanonicalSha256 = canonicalJsonSha256V2(legacyInput);
	const allocation = AffinityWaveAllocationV2Schema.parse(
		buildAffinityWaveAllocationV2({
			finalPlan,
			finalPlanCanonicalSha256,
			legacyAllocation,
			legacyAllocationCanonicalSha256
		})
	);
	const expectedText = await allocationText(AFFINITY_WAVE_ALLOCATION_V2_PATH, allocation);
	const destination = path.resolve(workspaceRoot, AFFINITY_WAVE_ALLOCATION_V2_PATH);
	const current = await readFile(destination, 'utf8').catch(() => null);
	const initiallyInSync = current === expectedText;
	let written = false;
	if (options.mode === 'write' && !initiallyInSync) {
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, expectedText, 'utf8');
		written = true;
	}
	const finalWorkloadIds = new Set([
		'final-canary',
		'final-pilot',
		'final-controlled-a',
		'final-controlled-b',
		'final-controlled-c'
	]);
	return {
		mode: options.mode,
		artifactPath: AFFINITY_WAVE_ALLOCATION_V2_PATH,
		canonicalSha256: canonicalJsonSha256V2(allocation),
		sourceFinalControlledPlanCanonicalSha256: finalPlanCanonicalSha256,
		sourceAllocationV1CanonicalSha256: legacyAllocationCanonicalSha256,
		workloadCount: 9,
		finalControlledJobCount: allocation.workloads
			.filter((workload) => finalWorkloadIds.has(workload.workloadId))
			.flatMap((workload) => workload.jobs).length,
		futureSentinelCount: allocation.workloads
			.flatMap((workload) => workload.jobs)
			.filter((job) => job.manifestState === 'future-sentinel').length,
		inSync: initiallyInSync || written,
		written
	};
}

function parseMode(args: readonly string[]): AffinityWaveAllocationV2ExportMode {
	if (args.length !== 1 || !['--check', '--write'].includes(args[0] ?? ''))
		throw new Error('Usage: tsx tools/export-affinity-wave-allocation-v2.ts --check|--write');
	return args[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const report = await exportAffinityWaveAllocationV2({ mode: parseMode(process.argv.slice(2)) });
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		if (!report.inSync) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}

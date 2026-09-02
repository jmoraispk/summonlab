import { pathToFileURL } from 'node:url';

import {
	allocateFamilyAffinityRevisionBatch,
	FAMILY_AFFINITY_ROOT
} from './family-affinity-production-lib.js';
import type { FamilyAffinityRevisionBatchEntry } from './family-affinity-production-lib.js';

const SINGLETON_FLAGS = ['--caller-role', '--namespace', '--coordinate', '--review-path'] as const;
const ALLOWED_FLAGS = new Set<string>([...SINGLETON_FLAGS, '--entry']);
const ENTRY_KEYS = ['coordinateId', 'namespace', 'reviewPath'] as const;

export function parseFamilyAffinityRevisionCli(argv: readonly string[]): {
	callerRole: string;
	entries: FamilyAffinityRevisionBatchEntry[];
} {
	const values = new Map<string, string[]>();
	for (let index = 0; index < argv.length; index += 2) {
		const flag = argv[index];
		const value = argv[index + 1];
		if (!flag || !flag.startsWith('--') || !ALLOWED_FLAGS.has(flag)) {
			throw new Error(`Unknown or positional argument: ${flag ?? '<missing>'}`);
		}
		if (!value || value.startsWith('--')) throw new Error(`Missing value after ${flag}`);
		values.set(flag, [...(values.get(flag) ?? []), value]);
	}
	for (const flag of SINGLETON_FLAGS) {
		if ((values.get(flag)?.length ?? 0) > 1) throw new Error(`Repeated singleton flag: ${flag}`);
	}
	const requiredSingleton = (flag: (typeof SINGLETON_FLAGS)[number]) => {
		const value = values.get(flag)?.[0];
		if (!value) throw new Error(`Missing required argument ${flag}`);
		return value;
	};
	const callerRole = requiredSingleton('--caller-role');
	const encodedEntries = values.get('--entry') ?? [];
	let entries: FamilyAffinityRevisionBatchEntry[];
	if (encodedEntries.length > 0) {
		if (['--namespace', '--coordinate', '--review-path'].some((flag) => values.has(flag))) {
			throw new Error('--entry cannot be mixed with single-allocation flags');
		}
		entries = encodedEntries.map((encoded, index) => {
			let value: unknown;
			try {
				value = JSON.parse(encoded);
			} catch {
				throw new Error(`--entry ${index + 1} must be valid JSON`);
			}
			if (value === null || typeof value !== 'object' || Array.isArray(value)) {
				throw new Error(`--entry ${index + 1} must be a strict object`);
			}
			const record = value as Record<string, unknown>;
			if (
				Object.keys(record).sort().join('\0') !== [...ENTRY_KEYS].sort().join('\0') ||
				(record.namespace !== 'canonical' && record.namespace !== 'bridge') ||
				typeof record.coordinateId !== 'string' ||
				record.coordinateId.length === 0 ||
				typeof record.reviewPath !== 'string' ||
				record.reviewPath.length === 0
			) {
				throw new Error(
					`--entry ${index + 1} must contain exactly namespace, coordinateId, and reviewPath`
				);
			}
			return {
				namespace: record.namespace,
				coordinateId: record.coordinateId,
				reviewPath: record.reviewPath
			};
		});
	} else {
		const namespace = requiredSingleton('--namespace');
		if (namespace !== 'canonical' && namespace !== 'bridge') {
			throw new Error('--namespace must be canonical or bridge');
		}
		entries = [
			{
				namespace,
				coordinateId: requiredSingleton('--coordinate'),
				reviewPath: requiredSingleton('--review-path')
			}
		];
	}
	return { callerRole, entries };
}

export async function runFamilyAffinityRevisionCli(argv: readonly string[]): Promise<string> {
	const parsed = parseFamilyAffinityRevisionCli(argv);
	const allocations = await allocateFamilyAffinityRevisionBatch({
		repositoryRoot: process.cwd(),
		manifestPath: `${FAMILY_AFFINITY_ROOT}/manifest.json`,
		...parsed
	});
	return (
		allocations
			.map(
				(allocated) =>
					`Allocated ${allocated.target.targetId}\n${allocated.targetPath}\n${allocated.assignmentPath}`
			)
			.join('\n') + '\n'
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.stdout.write(await runFamilyAffinityRevisionCli(process.argv.slice(2)));
}

import {
	allocateFamilyAffinityRevisionBatch,
	FAMILY_AFFINITY_ROOT
} from './family-affinity-production-lib.js';
import type { FamilyAffinityRevisionBatchEntry } from './family-affinity-production-lib.js';

function requiredArgument(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing required argument ${name}`);
	return value;
}

function repeatedArguments(name: string): string[] {
	return process.argv.flatMap((value, index) => {
		if (value !== name) return [];
		const argument = process.argv[index + 1];
		if (!argument) throw new Error(`Missing value after ${name}`);
		return [argument];
	});
}

const encodedEntries = repeatedArguments('--entry');
let entries: FamilyAffinityRevisionBatchEntry[];
if (encodedEntries.length > 0) {
	if (
		['--namespace', '--coordinate', '--review-path'].some((flag) => process.argv.includes(flag))
	) {
		throw new Error('--entry cannot be mixed with single-allocation flags');
	}
	entries = encodedEntries.map((encoded, index) => {
		let value: unknown;
		try {
			value = JSON.parse(encoded);
		} catch {
			throw new Error(`--entry ${index + 1} must be valid JSON`);
		}
		if (
			value === null ||
			typeof value !== 'object' ||
			!('namespace' in value) ||
			!('coordinateId' in value) ||
			!('reviewPath' in value) ||
			(value.namespace !== 'canonical' && value.namespace !== 'bridge') ||
			typeof value.coordinateId !== 'string' ||
			typeof value.reviewPath !== 'string'
		) {
			throw new Error(`--entry ${index + 1} must contain namespace, coordinateId, and reviewPath`);
		}
		return {
			namespace: value.namespace,
			coordinateId: value.coordinateId,
			reviewPath: value.reviewPath
		};
	});
} else {
	const namespace = requiredArgument('--namespace');
	if (namespace !== 'canonical' && namespace !== 'bridge') {
		throw new Error('--namespace must be canonical or bridge');
	}
	entries = [
		{
			namespace,
			coordinateId: requiredArgument('--coordinate'),
			reviewPath: requiredArgument('--review-path')
		}
	];
}

const allocations = await allocateFamilyAffinityRevisionBatch({
	repositoryRoot: process.cwd(),
	manifestPath: `${FAMILY_AFFINITY_ROOT}/manifest.json`,
	callerRole: requiredArgument('--caller-role'),
	entries
});

process.stdout.write(
	allocations
		.map(
			(allocated) =>
				`Allocated ${allocated.target.targetId}\n${allocated.targetPath}\n${allocated.assignmentPath}`
		)
		.join('\n') + '\n'
);

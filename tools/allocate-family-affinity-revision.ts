import {
	allocateFamilyAffinityRevision,
	FAMILY_AFFINITY_ROOT
} from './family-affinity-production-lib.js';

function requiredArgument(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing required argument ${name}`);
	return value;
}

const namespace = requiredArgument('--namespace');
if (namespace !== 'canonical' && namespace !== 'bridge') {
	throw new Error('--namespace must be canonical or bridge');
}

const allocated = await allocateFamilyAffinityRevision({
	repositoryRoot: process.cwd(),
	manifestPath: `${FAMILY_AFFINITY_ROOT}/manifest.json`,
	namespace,
	coordinateId: requiredArgument('--coordinate'),
	callerRole: requiredArgument('--caller-role'),
	reviewPath: requiredArgument('--review-path')
});

process.stdout.write(
	`Allocated ${allocated.target.targetId}\n${allocated.targetPath}\n${allocated.assignmentPath}\n`
);

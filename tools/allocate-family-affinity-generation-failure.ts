import { constants as fsConstants } from 'node:fs';
import { access, mkdir, open, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	canonicalAttemptPaths,
	familyAffinitySha256,
	stableFamilyAffinityJson,
	validateFamilyAffinityAttemptCrossBinding
} from './family-affinity-production-lib.js';
import {
	FamilyAffinityGenerationFailureSchema,
	familyAffinityGenerationFailurePath,
	validateFamilyAffinityGenerationFailureEvidence
} from './family-affinity-review-lib.js';

const MANIFEST_PATH = `${FAMILY_AFFINITY_ROOT}/manifest.json`;

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function allocateGenerationFailureSupersession(input: {
	repositoryRoot: string;
	callerRole: string;
	coordinateId: string;
	evidenceSourcePath: string;
}) {
	if (input.callerRole !== 'integration-controller') {
		throw new Error('Only integration-controller may supersede a generation-failed attempt');
	}
	const root = resolve(input.repositoryRoot);
	const manifestAbsolute = resolve(root, MANIFEST_PATH);
	const lockPath = `${manifestAbsolute}.revision-allocation.lock`;
	const lock = await open(
		lockPath,
		fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL
	);
	await lock.writeFile(`${process.pid}\n`);
	await lock.close();
	const created: string[] = [];
	let temporaryManifest: string | undefined;
	try {
		const manifestBytes = await readFile(manifestAbsolute);
		const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
		const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
			(entry) => entry.coordinateId === input.coordinateId
		);
		if (!coordinate || coordinate.namespace !== 'canonical') {
			throw new Error('Unknown canonical family-affinity coordinate');
		}
		const target = FamilyAffinityTargetSchema.parse(
			JSON.parse(await readFile(resolve(root, coordinate.targetPath), 'utf8'))
		);
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(await readFile(resolve(root, coordinate.assignmentPath), 'utf8'))
		);
		validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
		for (const forbidden of [
			target.ownedPaths.candidate,
			target.ownedPaths.result,
			target.ownedPaths.decision,
			target.ownedPaths.blindReview
		]) {
			if (await exists(resolve(root, forbidden))) {
				throw new Error(`Generation-failed attempt has retained or review evidence: ${forbidden}`);
			}
		}
		const evidence = FamilyAffinityGenerationFailureSchema.parse(
			JSON.parse(await readFile(resolve(root, input.evidenceSourcePath), 'utf8'))
		);
		validateFamilyAffinityGenerationFailureEvidence({
			target,
			targetPath: coordinate.targetPath,
			assignment,
			assignmentPath: coordinate.assignmentPath,
			evidence
		});
		const nextVersion = target.version + 1;
		const paths = canonicalAttemptPaths(
			target.familyId,
			target.formId,
			target.affinity,
			nextVersion
		);
		const nextTarget = FamilyAffinityTargetSchema.parse({
			...target,
			targetId: `canonical/${target.coordinateId}/v${nextVersion}`,
			version: nextVersion,
			ownedPaths: {
				candidate: paths.candidate,
				result: paths.result,
				decision: paths.decision,
				blindReview: paths.blindReview
			},
			// v2 retained no candidate. Its explicit failure evidence supplies the v2 link,
			// while this field truthfully preserves the last retained candidate provenance (v1).
			precedingAttempt: target.precedingAttempt
		});
		const nextAssignment = FamilyAffinityAssignmentSchema.parse({
			schemaVersion: 'family-affinity-assignment-v1',
			assignmentId: `${nextTarget.targetId}/assignment`,
			targetId: nextTarget.targetId,
			targetSha256: familyAffinitySha256(nextTarget),
			coordinateId: nextTarget.coordinateId,
			namespace: nextTarget.namespace,
			version: nextTarget.version,
			producerRole: 'image-producer',
			allowedOutputs: { candidate: paths.candidate, result: paths.result },
			retryCeiling: assignment.retryCeiling,
			dispatchStatus: nextTarget.status,
			selfPromotionForbidden: true,
			runtimeCatalogMutationForbidden: true
		});
		const failurePath = familyAffinityGenerationFailurePath(target);
		const proposed = [
			paths.target,
			paths.assignment,
			paths.candidate,
			paths.result,
			paths.decision,
			paths.blindReview,
			failurePath
		];
		for (const path of proposed) {
			if (await exists(resolve(root, path))) throw new Error(`Supersession collision: ${path}`);
		}
		const nextManifest = structuredClone(manifest);
		const nextCoordinate = nextManifest.canonicalMatrix.activeCoordinates.find(
			(entry) => entry.coordinateId === input.coordinateId
		)!;
		nextCoordinate.activeVersion = nextVersion;
		nextCoordinate.targetPath = paths.target;
		nextCoordinate.targetSha256 = familyAffinitySha256(nextTarget);
		nextCoordinate.assignmentPath = paths.assignment;
		nextCoordinate.assignmentSha256 = familyAffinitySha256(nextAssignment);
		nextCoordinate.status = nextTarget.status;
		FamilyAffinityManifestSchema.parse(nextManifest);

		for (const [path, value] of [
			[paths.target, nextTarget],
			[paths.assignment, nextAssignment],
			[failurePath, evidence]
		] as const) {
			const absolute = resolve(root, path);
			await mkdir(dirname(absolute), { recursive: true });
			await writeFile(absolute, stableFamilyAffinityJson(value), { flag: 'wx' });
			created.push(absolute);
		}
		if (!(await readFile(manifestAbsolute)).equals(manifestBytes)) {
			throw new Error('Manifest changed during generation-failure supersession');
		}
		temporaryManifest = `${manifestAbsolute}.generation-failure.tmp`;
		await writeFile(temporaryManifest, stableFamilyAffinityJson(nextManifest), { flag: 'wx' });
		await rename(temporaryManifest, manifestAbsolute);
		temporaryManifest = undefined;
		return { failurePath, targetPath: paths.target, assignmentPath: paths.assignment };
	} catch (error) {
		if (temporaryManifest) await rm(temporaryManifest, { force: true });
		for (const path of created.reverse()) await rm(path, { force: true });
		throw error;
	} finally {
		await unlink(lockPath).catch(() => undefined);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const args = process.argv.slice(2);
	const value = (flag: string) => {
		const index = args.indexOf(flag);
		if (index < 0 || !args[index + 1]) throw new Error(`Missing ${flag}`);
		return args[index + 1]!;
	};
	allocateGenerationFailureSupersession({
		repositoryRoot: process.cwd(),
		callerRole: value('--caller-role'),
		coordinateId: value('--coordinate'),
		evidenceSourcePath: value('--evidence-source')
	}).then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`));
}

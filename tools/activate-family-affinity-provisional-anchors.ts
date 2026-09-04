import { lstat, rename, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	PRODUCTION_AFFINITIES,
	canonicalAttemptPaths,
	familyAffinityRawSha256,
	familyAffinityReviewAssignmentPath,
	familyAffinitySha256,
	familyAffinitySourcePacketBinding,
	readFamilyAffinityOwnedFile,
	stableFamilyAffinityJson,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityCandidateEvidence,
	validateFamilyAffinityNormalAnchorEvidence,
	validateFamilyAffinitySourcePacket,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';

const AFFINITIES = PRODUCTION_AFFINITIES.filter(
	(affinity): affinity is Exclude<(typeof PRODUCTION_AFFINITIES)[number], 'normal'> =>
		affinity !== 'normal'
);

export type ActivateFamilyAffinityProvisionalAnchorsInput = {
	repositoryRoot: string;
	manifestPath: string;
	callerRole: string;
	allVerifiedNormalCandidates: true;
};

export type FamilyAffinityProvisionalActivationReport = {
	schemaVersion: 'family-affinity-provisional-anchor-activation-v1';
	manifestPath: string;
	manifestBeforeSha256: string;
	manifestAfterSha256: string;
	verifiedNormalCount: number;
	canonicalAffinityCount: number;
	activatedCount: number;
	activatedCoordinateIds: string[];
	skippedApprovedCount: number;
	skippedApprovedCoordinateIds: string[];
	alreadyProvisionalCount: number;
	alreadyProvisionalCoordinateIds: string[];
	rejectedCount: number;
	rejected: Array<{ coordinateId: string; reason: string }>;
	runtimeCatalogMutationForbidden: true;
};

type Replacement = { path: string; previousBytes: Buffer; nextBytes: Buffer };

function absoluteOwnedPath(repositoryRoot: string, ownedPath: string): string {
	if (!ownedPath || ownedPath.startsWith('/') || ownedPath.includes('..')) {
		throw new Error(`Provisional activation path is not repository-owned: ${ownedPath}`);
	}
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, ownedPath);
	if (!absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Provisional activation path escapes repository root: ${ownedPath}`);
	}
	return absolute;
}

async function assertRealRegularOwnedPath(
	repositoryRoot: string,
	ownedPath: string
): Promise<string> {
	const root = resolve(repositoryRoot);
	const absolute = absoluteOwnedPath(root, ownedPath);
	let cursor = root;
	for (const part of relative(root, absolute).split(sep).filter(Boolean)) {
		cursor = resolve(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) {
			throw new Error(`Symlinked provisional activation path is forbidden: ${ownedPath}`);
		}
		if (cursor === absolute && !metadata.isFile()) {
			throw new Error(`Provisional activation path is not a regular file: ${ownedPath}`);
		}
	}
	return absolute;
}

async function existsNoFollow(repositoryRoot: string, ownedPath: string): Promise<boolean> {
	try {
		const metadata = await lstat(absoluteOwnedPath(repositoryRoot, ownedPath));
		if (metadata.isSymbolicLink()) {
			throw new Error(`Symlinked output collision is forbidden: ${ownedPath}`);
		}
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function readTracked(
	repositoryRoot: string,
	ownedPath: string,
	protectedBytes: Map<string, Buffer>
): Promise<Buffer> {
	const bytes = await readFamilyAffinityOwnedFile(repositoryRoot, ownedPath);
	protectedBytes.set(ownedPath, bytes);
	return bytes;
}

async function assertProtectedInputsUnchanged(
	repositoryRoot: string,
	protectedBytes: Map<string, Buffer>
): Promise<void> {
	for (const [path, expected] of protectedBytes) {
		const actual = await readFamilyAffinityOwnedFile(repositoryRoot, path);
		if (!actual.equals(expected)) {
			throw new Error(`Provisional activation input changed before atomic commit: ${path}`);
		}
	}
}

async function assertNoAffinityEvidenceCollision(
	repositoryRoot: string,
	target: FamilyAffinityTarget
): Promise<void> {
	for (const path of [
		target.ownedPaths.candidate,
		target.ownedPaths.result,
		target.ownedPaths.decision,
		target.ownedPaths.blindReview,
		familyAffinityReviewAssignmentPath('ordinary', target, target.version),
		familyAffinityReviewAssignmentPath('blind', target, target.version)
	]) {
		if (await existsNoFollow(repositoryRoot, path)) {
			throw new Error(`Affinity output or review collision blocks provisional activation: ${path}`);
		}
	}
}

function emptyReport(input: {
	manifestPath: string;
	manifestBeforeSha256: string;
	manifestAfterSha256?: string;
}): FamilyAffinityProvisionalActivationReport {
	return {
		schemaVersion: 'family-affinity-provisional-anchor-activation-v1',
		manifestPath: input.manifestPath,
		manifestBeforeSha256: input.manifestBeforeSha256,
		manifestAfterSha256: input.manifestAfterSha256 ?? input.manifestBeforeSha256,
		verifiedNormalCount: 0,
		canonicalAffinityCount: 0,
		activatedCount: 0,
		activatedCoordinateIds: [],
		skippedApprovedCount: 0,
		skippedApprovedCoordinateIds: [],
		alreadyProvisionalCount: 0,
		alreadyProvisionalCoordinateIds: [],
		rejectedCount: 0,
		rejected: [],
		runtimeCatalogMutationForbidden: true
	};
}

async function prepareActivation(input: ActivateFamilyAffinityProvisionalAnchorsInput) {
	const protectedBytes = new Map<string, Buffer>();
	const manifestBytes = await readTracked(input.repositoryRoot, input.manifestPath, protectedBytes);
	const manifestBeforeSha256 = familyAffinityRawSha256(manifestBytes);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const nextManifest = structuredClone(manifest);
	const report = emptyReport({ manifestPath: input.manifestPath, manifestBeforeSha256 });
	const replacements: Replacement[] = [];
	const collisionTargets: FamilyAffinityTarget[] = [];
	const normals = manifest.canonicalMatrix.activeCoordinates
		.filter(({ affinity }) => affinity === 'normal')
		.sort((left, right) => left.coordinateId.localeCompare(right.coordinateId));
	if (normals.length !== 150)
		throw new Error(`Expected 150 active Normal coordinates, found ${normals.length}`);

	for (const normalCoordinate of normals) {
		try {
			const [normalTargetBytes, normalAssignmentBytes] = await Promise.all([
				readTracked(input.repositoryRoot, normalCoordinate.targetPath, protectedBytes),
				readTracked(input.repositoryRoot, normalCoordinate.assignmentPath, protectedBytes)
			]);
			const normalTarget = FamilyAffinityTargetSchema.parse(
				JSON.parse(normalTargetBytes.toString('utf8'))
			);
			const normalAssignment = FamilyAffinityAssignmentSchema.parse(
				JSON.parse(normalAssignmentBytes.toString('utf8'))
			);
			validateFamilyAffinityAttemptCrossBinding(normalCoordinate, normalTarget, normalAssignment);
			if (
				normalTarget.namespace !== 'canonical' ||
				normalTarget.affinity !== 'normal' ||
				normalTarget.anchor.kind !== 'normal-self' ||
				normalTarget.status !== 'planned'
			) {
				throw new Error('Active Normal coordinate is not a canonical planned normal-self target');
			}
			const source = familyAffinitySourcePacketBinding(normalTarget);
			const [sourceBytes, candidateBytes, resultBytes] = await Promise.all([
				readTracked(input.repositoryRoot, source.path, protectedBytes),
				readTracked(input.repositoryRoot, normalTarget.ownedPaths.candidate, protectedBytes),
				readTracked(input.repositoryRoot, normalTarget.ownedPaths.result, protectedBytes)
			]);
			validateFamilyAffinitySourcePacket(normalTarget, sourceBytes);
			const evidence = validateFamilyAffinityCandidateEvidence({
				target: normalTarget,
				assignment: normalAssignment,
				familyPacketBytes: sourceBytes,
				candidateBytes,
				resultBytes
			});
			report.verifiedNormalCount += 1;

			for (const affinity of AFFINITIES) {
				const coordinateId = `${normalTarget.familyId}/${normalTarget.formId}/${affinity}`;
				report.canonicalAffinityCount += 1;
				const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
					(candidate) => candidate.coordinateId === coordinateId
				);
				if (!coordinate || coordinate.namespace !== 'canonical') {
					throw new Error(`Missing canonical affinity coordinate: ${coordinateId}`);
				}
				const [targetBytes, assignmentBytes] = await Promise.all([
					readTracked(input.repositoryRoot, coordinate.targetPath, protectedBytes),
					readTracked(input.repositoryRoot, coordinate.assignmentPath, protectedBytes)
				]);
				const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
				const assignment = FamilyAffinityAssignmentSchema.parse(
					JSON.parse(assignmentBytes.toString('utf8'))
				);
				validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
				validateFamilyAffinitySourcePacket(
					target,
					await readTracked(
						input.repositoryRoot,
						familyAffinitySourcePacketBinding(target).path,
						protectedBytes
					)
				);

				if (target.status === 'planned' && target.anchor.kind === 'normal-approved-review') {
					await validateFamilyAffinityNormalAnchorEvidence({
						repositoryRoot: input.repositoryRoot,
						manifestPath: input.manifestPath,
						targetPath: coordinate.targetPath
					});
					report.skippedApprovedCoordinateIds.push(coordinateId);
					continue;
				}
				if (
					target.status === 'planned-provisional-anchor' &&
					target.anchor.kind === 'normal-verified-candidate'
				) {
					await validateFamilyAffinityNormalAnchorEvidence({
						repositoryRoot: input.repositoryRoot,
						manifestPath: input.manifestPath,
						targetPath: coordinate.targetPath
					});
					report.alreadyProvisionalCoordinateIds.push(coordinateId);
					continue;
				}
				if (
					target.status !== 'blocked-on-anchor' ||
					assignment.dispatchStatus !== 'blocked-on-anchor' ||
					target.anchor.kind !== 'normal-approved-review' ||
					target.anchor.normalCoordinateId !== normalTarget.coordinateId ||
					[
						target.anchor.reviewReceiptSha256,
						target.anchor.normalCandidatePath,
						target.anchor.normalCandidateSha256,
						target.anchor.normalResultPath,
						target.anchor.normalResultSha256
					].some((value) => value !== null)
				) {
					throw new Error(`Affinity target is not a pristine blocked anchor: ${coordinateId}`);
				}
				const blockedAnchor = target.anchor;
				const historicalNormalPaths = canonicalAttemptPaths(
					target.familyId,
					target.formId,
					'normal',
					blockedAnchor.normalVersion
				);
				if (blockedAnchor.normalTargetPath !== historicalNormalPaths.target) {
					throw new Error(`Blocked affinity target has a foreign Normal path: ${coordinateId}`);
				}
				const historicalNormalBytes = await readTracked(
					input.repositoryRoot,
					blockedAnchor.normalTargetPath,
					protectedBytes
				);
				const historicalNormalTarget = FamilyAffinityTargetSchema.parse(
					JSON.parse(historicalNormalBytes.toString('utf8'))
				);
				if (
					historicalNormalTarget.coordinateId !== blockedAnchor.normalCoordinateId ||
					historicalNormalTarget.affinity !== 'normal' ||
					historicalNormalTarget.familyId !== target.familyId ||
					historicalNormalTarget.formId !== target.formId ||
					historicalNormalTarget.version !== blockedAnchor.normalVersion ||
					familyAffinitySha256(historicalNormalTarget) !== blockedAnchor.normalTargetSha256 ||
					blockedAnchor.reviewReceiptPath !== historicalNormalTarget.ownedPaths.decision
				) {
					throw new Error(
						`Blocked affinity target has stale Normal control evidence: ${coordinateId}`
					);
				}
				await assertNoAffinityEvidenceCollision(input.repositoryRoot, target);
				const nextTarget = FamilyAffinityTargetSchema.parse({
					...target,
					status: 'planned-provisional-anchor',
					anchor: {
						kind: 'normal-verified-candidate',
						normalCoordinateId: normalTarget.coordinateId,
						normalVersion: normalTarget.version,
						normalTargetPath: normalCoordinate.targetPath,
						normalTargetSha256: familyAffinitySha256(normalTarget),
						normalCandidatePath: normalTarget.ownedPaths.candidate,
						normalCandidateSha256: evidence.result.candidateSha256,
						normalResultPath: normalTarget.ownedPaths.result,
						normalResultSha256: evidence.resultSha256,
						sourcePacketPath: source.path,
						sourcePacketSha256: source.sha256,
						humanReviewPending: true,
						runtimeCatalogMutationForbidden: true
					}
				});
				const nextAssignment = FamilyAffinityAssignmentSchema.parse({
					...assignment,
					dispatchStatus: 'planned-provisional-anchor',
					targetSha256: familyAffinitySha256(nextTarget)
				});
				const nextCoordinate = nextManifest.canonicalMatrix.activeCoordinates.find(
					(candidate) => candidate.coordinateId === coordinateId
				)!;
				nextCoordinate.status = 'planned-provisional-anchor';
				nextCoordinate.targetSha256 = familyAffinitySha256(nextTarget);
				nextCoordinate.assignmentSha256 = familyAffinitySha256(nextAssignment);
				replacements.push(
					{
						path: coordinate.targetPath,
						previousBytes: targetBytes,
						nextBytes: Buffer.from(stableFamilyAffinityJson(nextTarget))
					},
					{
						path: coordinate.assignmentPath,
						previousBytes: assignmentBytes,
						nextBytes: Buffer.from(stableFamilyAffinityJson(nextAssignment))
					}
				);
				collisionTargets.push(target);
				report.activatedCoordinateIds.push(coordinateId);
			}
		} catch (error) {
			report.rejected.push({
				coordinateId: normalCoordinate.coordinateId,
				reason: error instanceof Error ? error.message : String(error)
			});
		}
	}

	for (const key of [
		'activatedCoordinateIds',
		'skippedApprovedCoordinateIds',
		'alreadyProvisionalCoordinateIds'
	] as const)
		report[key].sort();
	report.activatedCount = report.activatedCoordinateIds.length;
	report.skippedApprovedCount = report.skippedApprovedCoordinateIds.length;
	report.alreadyProvisionalCount = report.alreadyProvisionalCoordinateIds.length;
	report.rejected.sort((left, right) => left.coordinateId.localeCompare(right.coordinateId));
	report.rejectedCount = report.rejected.length;
	if (report.rejectedCount > 0) {
		throw new Error(stableFamilyAffinityJson(report).trimEnd());
	}
	FamilyAffinityManifestSchema.parse(nextManifest);
	const nextManifestBytes = Buffer.from(stableFamilyAffinityJson(nextManifest));
	report.manifestAfterSha256 = familyAffinityRawSha256(nextManifestBytes);
	return {
		manifestBytes,
		nextManifestBytes,
		protectedBytes,
		replacements,
		collisionTargets,
		report
	};
}

async function restore(replacement: Replacement): Promise<void> {
	const temporary = `${replacement.path}.provisional-anchor-rollback.tmp`;
	await unlink(temporary).catch(() => undefined);
	await writeFile(temporary, replacement.previousBytes, { flag: 'wx' });
	await rename(temporary, replacement.path);
}

async function activateUnlocked(input: ActivateFamilyAffinityProvisionalAnchorsInput) {
	const prepared = await prepareActivation(input);
	const manifestAbsolute = await assertRealRegularOwnedPath(
		input.repositoryRoot,
		input.manifestPath
	);
	const staged: Array<{ replacement: Replacement; temporary: string }> = [];
	const committed: Replacement[] = [];
	let manifestTemporary: string | undefined;
	try {
		for (const replacement of prepared.replacements) {
			const absolute = await assertRealRegularOwnedPath(input.repositoryRoot, replacement.path);
			const temporary = `${absolute}.provisional-anchor-activation.tmp`;
			await writeFile(temporary, replacement.nextBytes, { flag: 'wx' });
			staged.push({ replacement: { ...replacement, path: absolute }, temporary });
		}
		manifestTemporary = `${manifestAbsolute}.provisional-anchor-activation.tmp`;
		await writeFile(manifestTemporary, prepared.nextManifestBytes, { flag: 'wx' });
		await assertProtectedInputsUnchanged(input.repositoryRoot, prepared.protectedBytes);
		for (const target of prepared.collisionTargets) {
			await assertNoAffinityEvidenceCollision(input.repositoryRoot, target);
		}
		for (const item of staged) {
			await rename(item.temporary, item.replacement.path);
			committed.push(item.replacement);
		}
		await rename(manifestTemporary, manifestAbsolute);
		manifestTemporary = undefined;
		return prepared.report;
	} catch (error) {
		for (const replacement of committed.reverse()) await restore(replacement);
		throw error;
	} finally {
		if (manifestTemporary) await unlink(manifestTemporary).catch(() => undefined);
		for (const { temporary } of staged) await unlink(temporary).catch(() => undefined);
	}
}

export async function activateFamilyAffinityProvisionalAnchors(
	input: ActivateFamilyAffinityProvisionalAnchorsInput
): Promise<FamilyAffinityProvisionalActivationReport> {
	if (input.callerRole !== 'integration-controller') {
		throw new Error('Only the integration-controller may activate provisional Normal anchors');
	}
	if (input.allVerifiedNormalCandidates !== true) {
		throw new Error('Provisional activation requires the all-verified-normal-candidates scope');
	}
	const lockPath = `${absoluteOwnedPath(input.repositoryRoot, input.manifestPath)}.revision-allocation.lock`;
	try {
		await writeFile(lockPath, `${process.pid}\n`, { flag: 'wx' });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error('Family affinity controller mutation is already in progress');
		}
		throw error;
	}
	try {
		return await activateUnlocked(input);
	} finally {
		await unlink(lockPath).catch(() => undefined);
	}
}

export function parseFamilyAffinityProvisionalActivationCli(argv: readonly string[]): {
	callerRole: string;
	allVerifiedNormalCandidates: true;
} {
	let callerRole: string | undefined;
	let allVerifiedNormalCandidates = false;
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (flag === '--caller-role') {
			const value = argv[index + 1];
			if (callerRole !== undefined || !value || value.startsWith('--')) {
				throw new Error('Invalid or repeated --caller-role');
			}
			callerRole = value;
			index += 1;
			continue;
		}
		if (flag === '--all-verified-normal-candidates') {
			if (allVerifiedNormalCandidates) {
				throw new Error('Repeated --all-verified-normal-candidates');
			}
			allVerifiedNormalCandidates = true;
			continue;
		}
		throw new Error(`Invalid provisional activation argument: ${flag ?? '<missing>'}`);
	}
	if (!callerRole) throw new Error('Missing required argument --caller-role');
	if (!allVerifiedNormalCandidates) {
		throw new Error('Missing required argument --all-verified-normal-candidates');
	}
	return { callerRole, allVerifiedNormalCandidates: true };
}

export async function runFamilyAffinityProvisionalActivationCli(argv: readonly string[]) {
	const parsed = parseFamilyAffinityProvisionalActivationCli(argv);
	const report = await activateFamilyAffinityProvisionalAnchors({
		repositoryRoot: process.cwd(),
		manifestPath: `${FAMILY_AFFINITY_ROOT}/manifest.json`,
		...parsed
	});
	return stableFamilyAffinityJson(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.stdout.write(await runFamilyAffinityProvisionalActivationCli(process.argv.slice(2)));
}

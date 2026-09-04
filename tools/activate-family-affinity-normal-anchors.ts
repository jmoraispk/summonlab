import { lstat, rename, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityBlindReviewReceiptSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityReviewAssignmentSchema,
	FamilyAffinityReviewReceiptSchema,
	FamilyAffinityTargetSchema,
	PRODUCTION_AFFINITIES,
	familyAffinityRawSha256,
	familyAffinityReviewAssignmentPath,
	familyAffinitySha256,
	familyAffinitySourcePacketBinding,
	readFamilyAffinityOwnedFile,
	stableFamilyAffinityJson,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityCandidateEvidence,
	validateFamilyAffinityReceiptEvidence,
	validateFamilyAffinityReviewAssignmentEvidence,
	validateFamilyAffinitySourcePacket,
	type FamilyAffinityAssignment,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';

const ELEMENTAL_AFFINITIES = PRODUCTION_AFFINITIES.filter(
	(affinity): affinity is Exclude<(typeof PRODUCTION_AFFINITIES)[number], 'normal'> =>
		affinity !== 'normal'
);

export type ActivateFamilyAffinityNormalAnchorsInput = {
	repositoryRoot: string;
	manifestPath: string;
	callerRole: string;
	normalCoordinateIds: readonly string[];
};

export type FamilyAffinityAnchorActivation = {
	normalCoordinateId: string;
	elementalCoordinateIds: string[];
};

type PreparedReplacement = {
	path: string;
	previousBytes: Buffer;
	nextBytes: Buffer;
};

function absoluteOwnedPath(repositoryRoot: string, ownedPath: string): string {
	if (!ownedPath || ownedPath.startsWith('/') || ownedPath.includes('..')) {
		throw new Error(`Anchor activation path is not repository-owned: ${ownedPath}`);
	}
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, ownedPath);
	if (!absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Anchor activation path escapes repository root: ${ownedPath}`);
	}
	return absolute;
}

async function pathEntryExistsNoFollow(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
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
			throw new Error(`Symlinked anchor activation path is forbidden: ${ownedPath}`);
		}
		if (cursor === absolute && !metadata.isFile()) {
			throw new Error(`Anchor activation path is not a regular file: ${ownedPath}`);
		}
	}
	return absolute;
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
			throw new Error(`Anchor activation input changed before atomic commit: ${path}`);
		}
	}
}

async function assertNoElementalEvidenceCollisions(
	repositoryRoot: string,
	target: FamilyAffinityTarget
): Promise<void> {
	const paths = [
		target.ownedPaths.candidate,
		target.ownedPaths.result,
		target.ownedPaths.decision,
		target.ownedPaths.blindReview,
		familyAffinityReviewAssignmentPath('ordinary', target, target.version),
		familyAffinityReviewAssignmentPath('blind', target, target.version)
	];
	for (const path of paths) {
		if (await pathEntryExistsNoFollow(absoluteOwnedPath(repositoryRoot, path))) {
			throw new Error(`Elemental output or review collision blocks anchor activation: ${path}`);
		}
	}
}

async function validateReviewChain(input: {
	repositoryRoot: string;
	manifestPath: string;
	manifestSha256: string;
	normalTargetPath: string;
	normalAssignmentPath: string;
	target: FamilyAffinityTarget;
	assignment: FamilyAffinityAssignment;
	protectedBytes: Map<string, Buffer>;
}) {
	const source = familyAffinitySourcePacketBinding(input.target);
	const [sourceBytes, candidateBytes, resultBytes, ordinaryBytes] = await Promise.all([
		readTracked(input.repositoryRoot, source.path, input.protectedBytes),
		readTracked(input.repositoryRoot, input.target.ownedPaths.candidate, input.protectedBytes),
		readTracked(input.repositoryRoot, input.target.ownedPaths.result, input.protectedBytes),
		readTracked(input.repositoryRoot, input.target.ownedPaths.decision, input.protectedBytes)
	]);
	validateFamilyAffinitySourcePacket(input.target, sourceBytes);
	const evidence = validateFamilyAffinityCandidateEvidence({
		target: input.target,
		assignment: input.assignment,
		familyPacketBytes: sourceBytes,
		candidateBytes,
		resultBytes
	});
	const ordinary = validateFamilyAffinityReceiptEvidence({
		target: input.target,
		result: evidence.result,
		resultSha256: evidence.resultSha256,
		receipt: FamilyAffinityReviewReceiptSchema.parse(JSON.parse(ordinaryBytes.toString('utf8'))),
		kind: 'ordinary'
	});
	if (ordinary.decision !== 'approved-review') {
		throw new Error(`Normal anchor lacks an ordinary approval: ${input.target.coordinateId}`);
	}
	const ordinaryAssignmentPath = familyAffinityReviewAssignmentPath(
		'ordinary',
		input.target,
		ordinary.decisionVersion
	);
	const ordinaryAssignmentBytes = await readTracked(
		input.repositoryRoot,
		ordinaryAssignmentPath,
		input.protectedBytes
	);
	const ordinaryAssignment = validateFamilyAffinityReviewAssignmentEvidence({
		reviewAssignment: FamilyAffinityReviewAssignmentSchema.parse(
			JSON.parse(ordinaryAssignmentBytes.toString('utf8'))
		),
		reviewAssignmentPath: ordinaryAssignmentPath,
		kind: 'ordinary',
		manifestPath: input.manifestPath,
		manifestSha256: input.manifestSha256,
		target: input.target,
		targetPath: input.normalTargetPath,
		productionAssignment: input.assignment,
		productionAssignmentPath: input.normalAssignmentPath,
		result: evidence.result,
		resultSha256: evidence.resultSha256
	});
	if (ordinaryAssignment.reviewerId !== ordinary.reviewerId) {
		throw new Error('Normal approval reviewer does not match its controller assignment');
	}

	if (input.target.tier === 'T3' || input.target.tier === 'T5') {
		const blindBytes = await readTracked(
			input.repositoryRoot,
			input.target.ownedPaths.blindReview,
			input.protectedBytes
		);
		const blind = validateFamilyAffinityReceiptEvidence({
			target: input.target,
			result: evidence.result,
			resultSha256: evidence.resultSha256,
			receipt: FamilyAffinityBlindReviewReceiptSchema.parse(
				JSON.parse(blindBytes.toString('utf8'))
			),
			kind: 'blind'
		});
		const blindAssignmentPath = familyAffinityReviewAssignmentPath(
			'blind',
			input.target,
			blind.decisionVersion
		);
		const blindAssignmentBytes = await readTracked(
			input.repositoryRoot,
			blindAssignmentPath,
			input.protectedBytes
		);
		const blindAssignment = validateFamilyAffinityReviewAssignmentEvidence({
			reviewAssignment: FamilyAffinityReviewAssignmentSchema.parse(
				JSON.parse(blindAssignmentBytes.toString('utf8'))
			),
			reviewAssignmentPath: blindAssignmentPath,
			kind: 'blind',
			manifestPath: input.manifestPath,
			manifestSha256: input.manifestSha256,
			target: input.target,
			targetPath: input.normalTargetPath,
			productionAssignment: input.assignment,
			productionAssignmentPath: input.normalAssignmentPath,
			result: evidence.result,
			resultSha256: evidence.resultSha256
		});
		if (
			blind.decision !== 'approved-review' ||
			blind.decision !== ordinary.decision ||
			blind.reviewerId === ordinary.reviewerId ||
			blindAssignment.reviewerId !== blind.reviewerId
		) {
			throw new Error(
				`Normal ${input.target.tier} anchor lacks an independent agreeing blind approval`
			);
		}
	}

	return {
		reviewReceiptSha256: familyAffinityRawSha256(ordinaryBytes),
		normalCandidatePath: ordinary.candidatePath,
		normalCandidateSha256: ordinary.candidateSha256,
		normalResultPath: ordinary.resultPath,
		normalResultSha256: ordinary.resultSha256
	};
}

async function prepareActivation(input: ActivateFamilyAffinityNormalAnchorsInput) {
	if (input.normalCoordinateIds.length === 0) {
		throw new Error('Anchor activation requires at least one Normal coordinate');
	}
	if (new Set(input.normalCoordinateIds).size !== input.normalCoordinateIds.length) {
		throw new Error('Anchor activation contains a duplicate Normal coordinate');
	}
	if (input.normalCoordinateIds.some((coordinateId) => !coordinateId.endsWith('/normal'))) {
		throw new Error('Anchor activation accepts only explicit canonical Normal coordinates');
	}

	const protectedBytes = new Map<string, Buffer>();
	const manifestBytes = await readTracked(input.repositoryRoot, input.manifestPath, protectedBytes);
	const manifestSha256 = familyAffinityRawSha256(manifestBytes);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const nextManifest = structuredClone(manifest);
	const replacements: PreparedReplacement[] = [];
	const collisionTargets: FamilyAffinityTarget[] = [];
	const activations: FamilyAffinityAnchorActivation[] = [];

	for (const normalCoordinateId of input.normalCoordinateIds) {
		const normalCoordinate = manifest.canonicalMatrix.activeCoordinates.find(
			({ coordinateId }) => coordinateId === normalCoordinateId
		);
		if (!normalCoordinate || normalCoordinate.affinity !== 'normal') {
			throw new Error(`Unknown canonical Normal coordinate: ${normalCoordinateId}`);
		}
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
			normalTarget.anchor.kind !== 'normal-self' ||
			normalTarget.status !== 'planned'
		) {
			throw new Error(
				`Selected coordinate is not an active canonical Normal anchor: ${normalCoordinateId}`
			);
		}
		const approved = await validateReviewChain({
			repositoryRoot: input.repositoryRoot,
			manifestPath: input.manifestPath,
			manifestSha256,
			normalTargetPath: normalCoordinate.targetPath,
			normalAssignmentPath: normalCoordinate.assignmentPath,
			target: normalTarget,
			assignment: normalAssignment,
			protectedBytes
		});

		const elementalCoordinateIds: string[] = [];
		for (const affinity of ELEMENTAL_AFFINITIES) {
			const coordinateId = `${normalTarget.familyId}/${normalTarget.formId}/${affinity}`;
			const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
				(candidate) => candidate.coordinateId === coordinateId
			);
			if (!coordinate) throw new Error(`Missing elemental coordinate: ${coordinateId}`);
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
			if (
				target.familyId !== normalTarget.familyId ||
				target.formId !== normalTarget.formId ||
				target.version !== coordinate.activeVersion ||
				target.status !== 'blocked-on-anchor' ||
				assignment.dispatchStatus !== 'blocked-on-anchor' ||
				target.anchor.kind !== 'normal-approved-review' ||
				target.anchor.normalCoordinateId !== normalTarget.coordinateId ||
				target.anchor.normalVersion !== normalTarget.version ||
				target.anchor.normalTargetPath !== normalCoordinate.targetPath ||
				target.anchor.normalTargetSha256 !== familyAffinitySha256(normalTarget) ||
				target.anchor.reviewReceiptPath !== normalTarget.ownedPaths.decision ||
				target.anchor.reviewReceiptSha256 !== null ||
				target.anchor.normalCandidatePath !== null ||
				target.anchor.normalCandidateSha256 !== null ||
				target.anchor.normalResultPath !== null ||
				target.anchor.normalResultSha256 !== null
			) {
				throw new Error(`Elemental target is not a pristine blocked anchor: ${coordinateId}`);
			}
			await assertNoElementalEvidenceCollisions(input.repositoryRoot, target);
			const nextTarget = FamilyAffinityTargetSchema.parse({
				...target,
				status: 'planned',
				anchor: { ...target.anchor, ...approved }
			});
			const nextAssignment = FamilyAffinityAssignmentSchema.parse({
				...assignment,
				dispatchStatus: 'planned',
				targetSha256: familyAffinitySha256(nextTarget)
			});
			const nextCoordinate = nextManifest.canonicalMatrix.activeCoordinates.find(
				(candidate) => candidate.coordinateId === coordinateId
			)!;
			nextCoordinate.status = 'planned';
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
			elementalCoordinateIds.push(coordinateId);
		}
		activations.push({ normalCoordinateId, elementalCoordinateIds });
	}

	FamilyAffinityManifestSchema.parse(nextManifest);
	return {
		manifestBytes,
		nextManifestBytes: Buffer.from(stableFamilyAffinityJson(nextManifest)),
		protectedBytes,
		replacements,
		collisionTargets,
		activations
	};
}

async function restoreReplacement(replacement: PreparedReplacement): Promise<void> {
	const temporary = `${replacement.path}.anchor-activation-rollback.tmp`;
	await unlink(temporary).catch(() => undefined);
	await writeFile(temporary, replacement.previousBytes, { flag: 'wx' });
	await rename(temporary, replacement.path);
}

async function activateUnlocked(input: ActivateFamilyAffinityNormalAnchorsInput) {
	const prepared = await prepareActivation(input);
	const manifestAbsolute = await assertRealRegularOwnedPath(
		input.repositoryRoot,
		input.manifestPath
	);
	const staged: Array<{ replacement: PreparedReplacement; temporary: string }> = [];
	let manifestTemporary: string | undefined;
	const committed: PreparedReplacement[] = [];
	try {
		for (const replacement of prepared.replacements) {
			const absolute = await assertRealRegularOwnedPath(input.repositoryRoot, replacement.path);
			const temporary = `${absolute}.anchor-activation.tmp`;
			await writeFile(temporary, replacement.nextBytes, { flag: 'wx' });
			staged.push({ replacement: { ...replacement, path: absolute }, temporary });
		}
		manifestTemporary = `${manifestAbsolute}.anchor-activation.tmp`;
		await writeFile(manifestTemporary, prepared.nextManifestBytes, { flag: 'wx' });
		await assertProtectedInputsUnchanged(input.repositoryRoot, prepared.protectedBytes);
		for (const target of prepared.collisionTargets) {
			await assertNoElementalEvidenceCollisions(input.repositoryRoot, target);
		}
		for (const item of staged) {
			await rename(item.temporary, item.replacement.path);
			committed.push(item.replacement);
		}
		await rename(manifestTemporary, manifestAbsolute);
		manifestTemporary = undefined;
		return prepared.activations;
	} catch (error) {
		for (const replacement of committed.reverse()) await restoreReplacement(replacement);
		throw error;
	} finally {
		if (manifestTemporary) await unlink(manifestTemporary).catch(() => undefined);
		for (const { temporary } of staged) await unlink(temporary).catch(() => undefined);
	}
}

export async function activateFamilyAffinityNormalAnchors(
	input: ActivateFamilyAffinityNormalAnchorsInput
): Promise<FamilyAffinityAnchorActivation[]> {
	if (input.callerRole !== 'integration-controller') {
		throw new Error('Only the integration-controller may activate Normal anchors');
	}
	const manifestAbsolute = absoluteOwnedPath(input.repositoryRoot, input.manifestPath);
	const lockPath = `${manifestAbsolute}.revision-allocation.lock`;
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

export function parseFamilyAffinityAnchorActivationCli(argv: readonly string[]): {
	callerRole: string;
	normalCoordinateIds: string[];
} {
	const normalCoordinateIds: string[] = [];
	let callerRole: string | undefined;
	for (let index = 0; index < argv.length; index += 2) {
		const flag = argv[index];
		const value = argv[index + 1];
		if (
			(flag !== '--caller-role' && flag !== '--normal-coordinate') ||
			!value ||
			value.startsWith('--')
		) {
			throw new Error(`Invalid anchor activation argument: ${flag ?? '<missing>'}`);
		}
		if (flag === '--caller-role') {
			if (callerRole !== undefined) throw new Error('Repeated --caller-role');
			callerRole = value;
		} else {
			normalCoordinateIds.push(value);
		}
	}
	if (!callerRole) throw new Error('Missing required argument --caller-role');
	if (normalCoordinateIds.length === 0) {
		throw new Error('At least one --normal-coordinate is required');
	}
	return { callerRole, normalCoordinateIds };
}

export async function runFamilyAffinityAnchorActivationCli(
	argv: readonly string[]
): Promise<string> {
	const parsed = parseFamilyAffinityAnchorActivationCli(argv);
	const activations = await activateFamilyAffinityNormalAnchors({
		repositoryRoot: process.cwd(),
		manifestPath: `${FAMILY_AFFINITY_ROOT}/manifest.json`,
		...parsed
	});
	return `${activations
		.map(
			({ normalCoordinateId, elementalCoordinateIds }) =>
				`Activated ${normalCoordinateId}: ${elementalCoordinateIds.join(', ')}`
		)
		.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.stdout.write(await runFamilyAffinityAnchorActivationCli(process.argv.slice(2)));
}

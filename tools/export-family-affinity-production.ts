import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	buildFamilyAffinityProductionBundle,
	CurrentClassMappingFileSchema,
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityReviewReceiptSchema,
	FamilyAffinityTargetSchema,
	familyAffinitySha256,
	FamilyPacketSchema,
	stableFamilyAffinityJson,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityProductionBundle,
	validateFamilyAffinityReviewPromotion,
	type FamilyAffinityAssignment,
	type FamilyAffinityManifest,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function listFiles(directory: string): Promise<string[]> {
	if (!(await fileExists(directory))) return [];
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);
			return entry.isDirectory() ? listFiles(path) : [path];
		})
	);
	return nested.flat().sort();
}

function pathAtVersion(path: string, activeVersion: number, version: number): string {
	const suffix = `v${activeVersion}.json`;
	if (!path.endsWith(suffix)) throw new Error(`Versioned attempt path is malformed: ${path}`);
	return `${path.slice(0, -suffix.length)}v${version}.json`;
}

type LoadedCorpus = {
	manifest: FamilyAffinityManifest;
	targets: FamilyAffinityTarget[];
	assignments: FamilyAffinityAssignment[];
	expectedAttemptPaths: Set<string>;
};

async function loadAndValidateExistingCorpus(
	repositoryRoot: string,
	manifestPath: string,
	sourceBundle: ReturnType<typeof buildFamilyAffinityProductionBundle>
): Promise<LoadedCorpus> {
	const manifest = FamilyAffinityManifestSchema.parse(
		JSON.parse(await readFile(join(repositoryRoot, manifestPath), 'utf8'))
	);
	const expectedV1 = new Map(
		sourceBundle.artifacts
			.filter(({ path }) => path !== manifestPath)
			.map(({ path, value }) => [path, stableFamilyAffinityJson(value)] as const)
	);
	const expectedCanonicalIds = new Set(
		sourceBundle.manifest.canonicalMatrix.activeCoordinates.map(({ coordinateId }) => coordinateId)
	);
	const expectedCanonicalOrder = sourceBundle.manifest.canonicalMatrix.activeCoordinates.map(
		({ coordinateId }) => coordinateId
	);
	const actualCanonicalIds = manifest.canonicalMatrix.activeCoordinates.map(
		({ coordinateId }) => coordinateId
	);
	if (
		actualCanonicalIds.length !== 750 ||
		new Set(actualCanonicalIds).size !== 750 ||
		actualCanonicalIds.some(
			(coordinateId, index) =>
				!expectedCanonicalIds.has(coordinateId) || coordinateId !== expectedCanonicalOrder[index]
		)
	) {
		throw new Error('Existing manifest canonical coordinates do not match the packet-derived 750');
	}

	const expectedAttemptPaths = new Set<string>();
	const activeTargets: FamilyAffinityTarget[] = [];
	const activeAssignments: FamilyAffinityAssignment[] = [];
	for (const coordinate of [
		...manifest.canonicalMatrix.activeCoordinates,
		...manifest.bridge.activeCoordinates
	]) {
		let previousTarget: FamilyAffinityTarget | undefined;
		for (let version = 1; version <= coordinate.activeVersion; version += 1) {
			const targetPath = pathAtVersion(coordinate.targetPath, coordinate.activeVersion, version);
			const assignmentPath = pathAtVersion(
				coordinate.assignmentPath,
				coordinate.activeVersion,
				version
			);
			expectedAttemptPaths.add(targetPath);
			expectedAttemptPaths.add(assignmentPath);
			if (!(await fileExists(join(repositoryRoot, targetPath)))) {
				throw new Error(`Missing immutable attempt target: ${targetPath}`);
			}
			if (!(await fileExists(join(repositoryRoot, assignmentPath)))) {
				throw new Error(`Missing immutable attempt assignment: ${assignmentPath}`);
			}
			const targetBytes = await readFile(join(repositoryRoot, targetPath), 'utf8');
			const assignmentBytes = await readFile(join(repositoryRoot, assignmentPath), 'utf8');
			if (coordinate.namespace === 'canonical' && version === 1) {
				if (targetBytes !== expectedV1.get(targetPath)) {
					throw new Error(`Immutable packet-derived v1 target drift: ${targetPath}`);
				}
				if (assignmentBytes !== expectedV1.get(assignmentPath)) {
					throw new Error(`Immutable packet-derived v1 assignment drift: ${assignmentPath}`);
				}
			}
			const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes));
			const assignment = FamilyAffinityAssignmentSchema.parse(JSON.parse(assignmentBytes));
			const derivedCoordinate = {
				...coordinate,
				activeVersion: version,
				targetPath,
				targetSha256: familyAffinitySha256(target),
				assignmentPath,
				assignmentSha256: familyAffinitySha256(assignment),
				status: target.status
			};
			validateFamilyAffinityAttemptCrossBinding(derivedCoordinate, target, assignment);
			if (version === 1 && target.precedingAttempt !== null) {
				throw new Error(`Initial attempt cannot link a predecessor: ${targetPath}`);
			}
			if (
				version > 1 &&
				(!previousTarget ||
					target.precedingAttempt?.targetId !== previousTarget.targetId ||
					target.precedingAttempt.targetSha256 !== familyAffinitySha256(previousTarget) ||
					target.precedingAttempt.candidatePath !== previousTarget.ownedPaths.candidate ||
					target.precedingAttempt.resultPath !== previousTarget.ownedPaths.result ||
					target.precedingAttempt.reviewPath !== previousTarget.ownedPaths.decision)
			) {
				throw new Error(
					`Attempt history is skipped, orphaned, or cross-bound incorrectly: ${targetPath}`
				);
			}
			previousTarget = target;
			if (version === coordinate.activeVersion) {
				validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
				activeTargets.push(target);
				activeAssignments.push(assignment);
			}
		}
	}

	const actualAttemptPaths = [
		...(
			await Promise.all(
				['targets', 'assignments'].map((directory) =>
					listFiles(join(repositoryRoot, FAMILY_AFFINITY_ROOT, directory))
				)
			)
		).flat(),
		...(await listFiles(join(repositoryRoot, FAMILY_AFFINITY_ROOT, 'bridge'))).filter((path) =>
			/\/(?:target|assignment)-v\d+\.json$/u.test(path)
		)
	].map((path) => relative(repositoryRoot, path));
	for (const path of actualAttemptPaths) {
		if (!expectedAttemptPaths.has(path)) {
			throw new Error(`Orphan or unreferenced immutable attempt: ${path}`);
		}
	}

	const canonicalTargets = activeTargets.filter(({ namespace }) => namespace === 'canonical');
	const canonicalAssignments = activeAssignments.filter(
		({ namespace }) => namespace === 'canonical'
	);
	const reviewReceipts: Record<string, unknown> = {};
	for (const target of canonicalTargets) {
		if (
			target.affinity !== 'normal' &&
			target.status === 'planned' &&
			target.anchor.kind === 'normal-approved-review'
		) {
			const receipt = FamilyAffinityReviewReceiptSchema.parse(
				JSON.parse(await readFile(join(repositoryRoot, target.anchor.reviewReceiptPath), 'utf8'))
			);
			const candidateBytes = await readFile(join(repositoryRoot, receipt.candidatePath));
			const resultBytes = await readFile(join(repositoryRoot, receipt.resultPath));
			if (
				createHash('sha256').update(candidateBytes).digest('hex') !== receipt.candidateSha256 ||
				createHash('sha256').update(resultBytes).digest('hex') !== receipt.resultSha256
			) {
				throw new Error(`Normal approval candidate/result hash mismatch: ${target.targetId}`);
			}
			reviewReceipts[target.anchor.reviewReceiptPath] = receipt;
		}
	}
	validateFamilyAffinityProductionBundle(
		{
			manifest,
			targets: canonicalTargets,
			assignments: canonicalAssignments,
			artifacts: [
				{ path: manifestPath, value: manifest },
				...manifest.canonicalMatrix.activeCoordinates.flatMap((coordinate, index) => [
					{ path: coordinate.targetPath, value: canonicalTargets[index]! },
					{ path: coordinate.assignmentPath, value: canonicalAssignments[index]! }
				])
			]
		},
		reviewReceipts
	);
	for (const target of activeTargets.filter(({ namespace }) => namespace === 'bridge')) {
		if (target.affinity !== 'normal' && target.status === 'planned') {
			if (target.anchor.kind !== 'normal-approved-review') {
				throw new Error(`Bridge elemental target lacks an exact Normal anchor: ${target.targetId}`);
			}
			const anchor = target.anchor;
			const normalCoordinate = manifest.canonicalMatrix.activeCoordinates.find(
				({ coordinateId }) => coordinateId === `${target.familyId}/${target.formId}/normal`
			);
			const normalTarget = canonicalTargets.find(
				({ coordinateId }) => coordinateId === normalCoordinate?.coordinateId
			);
			const receipt = FamilyAffinityReviewReceiptSchema.parse(
				JSON.parse(await readFile(join(repositoryRoot, anchor.reviewReceiptPath), 'utf8'))
			);
			const candidateBytes = await readFile(join(repositoryRoot, receipt.candidatePath));
			const resultBytes = await readFile(join(repositoryRoot, receipt.resultPath));
			if (
				!normalCoordinate ||
				!normalTarget ||
				normalCoordinate.activeVersion !== anchor.normalVersion ||
				normalCoordinate.targetPath !== anchor.normalTargetPath ||
				normalCoordinate.targetSha256 !== anchor.normalTargetSha256 ||
				familyAffinitySha256(normalTarget) !== anchor.normalTargetSha256 ||
				anchor.reviewReceiptPath !== normalTarget.ownedPaths.decision ||
				familyAffinitySha256(receipt) !== anchor.reviewReceiptSha256 ||
				receipt.decision !== 'approved-review' ||
				receipt.targetId !== normalTarget.targetId ||
				receipt.targetSha256 !== anchor.normalTargetSha256 ||
				receipt.candidatePath !== anchor.normalCandidatePath ||
				receipt.candidateSha256 !== anchor.normalCandidateSha256 ||
				receipt.resultPath !== anchor.normalResultPath ||
				receipt.resultSha256 !== anchor.normalResultSha256 ||
				createHash('sha256').update(candidateBytes).digest('hex') !== receipt.candidateSha256 ||
				createHash('sha256').update(resultBytes).digest('hex') !== receipt.resultSha256
			) {
				throw new Error(
					`Bridge elemental target has stale or foreign Normal evidence: ${target.targetId}`
				);
			}
		}
		if (await fileExists(join(repositoryRoot, target.ownedPaths.decision))) {
			const receipt = FamilyAffinityReviewReceiptSchema.parse(
				JSON.parse(await readFile(join(repositoryRoot, target.ownedPaths.decision), 'utf8'))
			);
			validateFamilyAffinityReviewPromotion(target, receipt);
		}
	}
	return { manifest, targets: activeTargets, assignments: activeAssignments, expectedAttemptPaths };
}

function mergedDerivedManifest(
	existing: FamilyAffinityManifest,
	derived: FamilyAffinityManifest
): FamilyAffinityManifest {
	return FamilyAffinityManifestSchema.parse({
		...existing,
		canonicalMatrix: {
			...existing.canonicalMatrix,
			familyCount: derived.canonicalMatrix.familyCount,
			formCount: derived.canonicalMatrix.formCount,
			affinities: derived.canonicalMatrix.affinities,
			targetCount: derived.canonicalMatrix.targetCount,
			assignmentCount: derived.canonicalMatrix.assignmentCount
		},
		mappingReservations: derived.mappingReservations,
		ownership: derived.ownership
	});
}

export async function exportFamilyAffinityProduction(options: {
	repositoryRoot: string;
	check: boolean;
}) {
	const familyDirectory = join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, 'families');
	const familyFileNames = (await readdir(familyDirectory))
		.filter((fileName) => /^\d{2}-[a-z0-9-]+\.json$/u.test(fileName))
		.sort();
	const families = await Promise.all(
		familyFileNames.map(async (fileName) =>
			FamilyPacketSchema.parse(JSON.parse(await readFile(join(familyDirectory, fileName), 'utf8')))
		)
	);
	const mapping = CurrentClassMappingFileSchema.parse(
		JSON.parse(
			await readFile(
				join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, 'current-class-mapping.json'),
				'utf8'
			)
		)
	);
	const bundle = buildFamilyAffinityProductionBundle(families, mapping);
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	const manifestAbsolute = join(options.repositoryRoot, manifestPath);
	const lockPath = `${manifestAbsolute}.revision-allocation.lock`;
	await mkdir(dirname(manifestAbsolute), { recursive: true });
	try {
		await writeFile(lockPath, `${process.pid}\n`, { flag: 'wx' });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error('Family affinity export is blocked by the exclusive controller lock');
		}
		throw error;
	}
	try {
		if (await fileExists(manifestAbsolute)) {
			const loaded = await loadAndValidateExistingCorpus(
				options.repositoryRoot,
				manifestPath,
				bundle
			);
			const merged = mergedDerivedManifest(loaded.manifest, bundle.manifest);
			const mergedBytes = stableFamilyAffinityJson(merged);
			const currentBytes = await readFile(manifestAbsolute, 'utf8');
			if (options.check && currentBytes !== mergedBytes) {
				throw new Error(
					'Family affinity production export check failed: drifted safe manifest metadata'
				);
			}
			if (!options.check && currentBytes !== mergedBytes) {
				const temporary = `${manifestAbsolute}.export-${process.pid}-${Date.now()}`;
				try {
					await writeFile(temporary, mergedBytes, { flag: 'wx' });
					await rename(temporary, manifestAbsolute);
				} finally {
					await unlink(temporary).catch(() => undefined);
				}
			}
			return {
				mode: options.check ? ('check' as const) : ('write' as const),
				artifactCount: loaded.expectedAttemptPaths.size + 1
			};
		}

		const actualAttemptFiles = [
			...(
				await Promise.all(
					['targets', 'assignments'].map((directory) =>
						listFiles(join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, directory))
					)
				)
			).flat(),
			...(await listFiles(join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, 'bridge'))).filter(
				(path) => /\/(?:target|assignment)-v\d+\.json$/u.test(path)
			)
		];
		if (options.check) {
			throw new Error('Family affinity production export check failed: missing manifest');
		}
		if (actualAttemptFiles.length > 0) {
			throw new Error(
				'Refusing bootstrap because an immutable target/assignment corpus already exists'
			);
		}
		const created: string[] = [];
		try {
			for (const { path, value } of bundle.artifacts.filter(({ path }) => path !== manifestPath)) {
				const absolute = join(options.repositoryRoot, path);
				await mkdir(dirname(absolute), { recursive: true });
				await writeFile(absolute, stableFamilyAffinityJson(value), { flag: 'wx' });
				created.push(absolute);
			}
			await writeFile(manifestAbsolute, stableFamilyAffinityJson(bundle.manifest), { flag: 'wx' });
			created.push(manifestAbsolute);
		} catch (error) {
			for (const path of created.reverse()) await unlink(path).catch(() => undefined);
			throw error;
		}
		return { mode: 'write' as const, artifactCount: bundle.artifacts.length };
	} finally {
		await unlink(lockPath).catch(() => undefined);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const check = process.argv.slice(2).includes('--check');
	const result = await exportFamilyAffinityProduction({ repositoryRoot: process.cwd(), check });
	process.stdout.write(
		`${result.mode === 'check' ? 'Verified' : 'Wrote'} ${result.artifactCount} family affinity production artifacts.\n`
	);
}

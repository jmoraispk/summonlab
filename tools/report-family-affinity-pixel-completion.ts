import { lstat, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FAMILY_AFFINITY_ROOT,
	FAMILY_AFFINITY_SKILL_CONTRACT_PATH,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	familyAffinityRawSha256,
	familyAffinitySourcePacketBinding,
	preflightFamilyAffinityProductionDispatch,
	readFamilyAffinityOwnedFile,
	stableFamilyAffinityJson,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityCandidateEvidence,
	validateFamilyAffinityNormalAnchorEvidence
} from './family-affinity-production-lib.js';

async function exists(repositoryRoot: string, path: string): Promise<boolean> {
	try {
		const metadata = await lstat(join(repositoryRoot, path));
		if (metadata.isSymbolicLink() || !metadata.isFile()) {
			throw new Error(`Pixel-completion evidence is not a real regular file: ${path}`);
		}
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

export async function reportFamilyAffinityPixelCompletion(repositoryRootInput: string) {
	const repositoryRoot = resolve(repositoryRootInput);
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	const compatibilityPath = `${FAMILY_AFFINITY_ROOT}/production-compatibility.json`;
	const reviewCatalogPath = `${FAMILY_AFFINITY_ROOT}/review/catalog.json`;
	const [manifestBytes, compatibilityBytes, contractBytes, reviewCatalogBytes] = await Promise.all([
		readFamilyAffinityOwnedFile(repositoryRoot, manifestPath),
		readFamilyAffinityOwnedFile(repositoryRoot, compatibilityPath),
		readFile(join(repositoryRoot, FAMILY_AFFINITY_SKILL_CONTRACT_PATH)),
		readFamilyAffinityOwnedFile(repositoryRoot, reviewCatalogPath)
	]);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const compatibility = JSON.parse(compatibilityBytes.toString('utf8'));
	const reviewCatalog = JSON.parse(reviewCatalogBytes.toString('utf8')) as {
		runtimeCount?: unknown;
	};
	if (reviewCatalog.runtimeCount !== 0)
		throw new Error('Family affinity runtimeCount must remain zero');

	let generatedCount = 0;
	let normalGeneratedCount = 0;
	let affinityGeneratedCount = 0;
	let affinityDispatchableCount = 0;
	const missingCoordinateIds: string[] = [];
	for (const coordinate of manifest.canonicalMatrix.activeCoordinates) {
		const [targetBytes, assignmentBytes] = await Promise.all([
			readFamilyAffinityOwnedFile(repositoryRoot, coordinate.targetPath),
			readFamilyAffinityOwnedFile(repositoryRoot, coordinate.assignmentPath)
		]);
		const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(assignmentBytes.toString('utf8'))
		);
		validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
		const source = familyAffinitySourcePacketBinding(target);
		const sourceBytes = await readFamilyAffinityOwnedFile(repositoryRoot, source.path);
		const promptBytes = Buffer.from(
			stableFamilyAffinityJson({
				schemaVersion: 'family-affinity-prompt-material-v1',
				target,
				assignment
			}).slice(0, -1)
		);
		preflightFamilyAffinityProductionDispatch({
			compatibility,
			installedContractBytes: contractBytes,
			target,
			assignment,
			targetPath: coordinate.targetPath,
			assignmentPath: coordinate.assignmentPath,
			familyPacketBytes: sourceBytes,
			renderedPromptBytes: promptBytes
		});
		if (target.affinity !== 'normal') {
			await validateFamilyAffinityNormalAnchorEvidence({
				repositoryRoot,
				manifestPath,
				targetPath: coordinate.targetPath
			});
			affinityDispatchableCount += 1;
		}
		const [candidateExists, resultExists] = await Promise.all([
			exists(repositoryRoot, target.ownedPaths.candidate),
			exists(repositoryRoot, target.ownedPaths.result)
		]);
		if (candidateExists !== resultExists) {
			throw new Error(`Partial candidate/result evidence: ${target.coordinateId}`);
		}
		if (!candidateExists) {
			missingCoordinateIds.push(target.coordinateId);
			continue;
		}
		const [candidateBytes, resultBytes] = await Promise.all([
			readFamilyAffinityOwnedFile(repositoryRoot, target.ownedPaths.candidate),
			readFamilyAffinityOwnedFile(repositoryRoot, target.ownedPaths.result)
		]);
		validateFamilyAffinityCandidateEvidence({
			target,
			assignment,
			familyPacketBytes: sourceBytes,
			candidateBytes,
			resultBytes
		});
		generatedCount += 1;
		if (target.affinity === 'normal') normalGeneratedCount += 1;
		else affinityGeneratedCount += 1;
	}
	missingCoordinateIds.sort();
	return {
		schemaVersion: 'family-affinity-pixel-completion-report-v1' as const,
		coordinateCount: manifest.canonicalMatrix.activeCoordinates.length,
		affinityDispatchableCount,
		generatedCount,
		normalGeneratedCount,
		affinityGeneratedCount,
		missingCount: missingCoordinateIds.length,
		missingAffinityCount: missingCoordinateIds.filter(
			(coordinateId) => !coordinateId.endsWith('/normal')
		).length,
		missingCoordinateIds,
		runtimeCount: 0 as const
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.stdout.write(
		stableFamilyAffinityJson(await reportFamilyAffinityPixelCompletion(process.cwd()))
	);
}

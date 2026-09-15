import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	activateFamilyAffinityProvisionalAnchors,
	parseFamilyAffinityProvisionalActivationCli
} from './activate-family-affinity-provisional-anchors.js';
import {
	FAUNA_FAMILY_ROOT,
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	FaunaFamilyManifestSchema,
	buildFaunaFamilyProductionBundle,
	buildFamilyAffinityProductionBundle,
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinitySha256,
	loadFamilyAffinityActiveSources,
	preflightFamilyAffinityProductionDispatch,
	stableFamilyAffinityJson,
	validateFamilyAffinityNormalAnchorEvidence
} from './family-affinity-production-lib.js';

const PROJECT_ROOT = process.cwd();
const roots: string[] = [];

async function writeOwned(root: string, path: string, value: unknown): Promise<Buffer> {
	const absolute = join(root, path);
	await mkdir(dirname(absolute), { recursive: true });
	const bytes = Buffer.isBuffer(value) ? value : Buffer.from(stableFamilyAffinityJson(value));
	await writeFile(absolute, bytes);
	return bytes;
}

async function makeFixture() {
	const root = await mkdtemp(join(tmpdir(), 'family-provisional-activation-'));
	roots.push(root);
	const { families, mapping } = await loadFamilyAffinityActiveSources(PROJECT_ROOT);
	const bundle = buildFamilyAffinityProductionBundle(families, mapping);
	for (const artifact of bundle.artifacts) await writeOwned(root, artifact.path, artifact.value);
	for (const family of families) {
		const normal = bundle.targets.find(
			({ familyId, affinity }) => familyId === family.familyId && affinity === 'normal'
		)!;
		await writeOwned(root, normal.sources.familyPacketPath, family);
	}
	for (const target of bundle.targets.filter(({ affinity }) => affinity === 'normal')) {
		const assignment = bundle.assignments.find(({ targetId }) => targetId === target.targetId)!;
		const candidateBytes = await writeOwned(
			root,
			target.ownedPaths.candidate,
			Buffer.from(`candidate:${target.coordinateId}`)
		);
		const result = {
			schemaVersion: 'family-affinity-result-v1' as const,
			targetId: target.targetId,
			targetSha256: familyAffinitySha256(target),
			coordinateId: target.coordinateId,
			candidateVersion: target.version,
			producerId: 'fixture-producer',
			candidatePath: target.ownedPaths.candidate,
			candidateSha256: familyAffinityRawSha256(candidateBytes),
			resultPath: target.ownedPaths.result,
			sourcePath: target.sources.familyPacketPath,
			sourceSha256: target.sources.familyPacketSha256,
			promptSha256: familyAffinityPromptSha256(target, assignment),
			state: 'candidate-only' as const,
			runtimeCatalogMutationForbidden: true as const
		};
		await writeOwned(root, target.ownedPaths.result, result);
	}
	return { root, manifestPath: `${FAMILY_AFFINITY_ROOT}/manifest.json`, bundle };
}

async function makeFaunaFixture() {
	const root = await mkdtemp(join(tmpdir(), 'fauna-provisional-activation-'));
	roots.push(root);
	const activeSources = JSON.parse(
		await readFile(join(PROJECT_ROOT, FAUNA_FAMILY_ROOT, 'active-sources.json'), 'utf8')
	) as { familyPacketPaths: string[] };
	const familyInputs = await Promise.all(
		activeSources.familyPacketPaths.map(async (path) =>
			JSON.parse(await readFile(join(PROJECT_ROOT, path), 'utf8'))
		)
	);
	const currentManifest = FaunaFamilyManifestSchema.parse(
		JSON.parse(await readFile(join(PROJECT_ROOT, FAUNA_FAMILY_ROOT, 'manifest.json'), 'utf8'))
	);
	const bundle = buildFaunaFamilyProductionBundle(familyInputs, {
		schemaVersion: 'fauna-family-design-manifest-v1',
		experimentId: 'fauna-family-v1',
		status: 'design-complete-production-not-started',
		scope: currentManifest.scope,
		production: {},
		legacyClassMigrations: currentManifest.legacyClassMigrations,
		ownership: {}
	});
	for (const artifact of bundle.artifacts) await writeOwned(root, artifact.path, artifact.value);
	for (const [index, family] of familyInputs.entries()) {
		await writeOwned(root, activeSources.familyPacketPaths[index]!, family);
	}
	for (const target of bundle.targets.filter(({ affinity }) => affinity === 'normal')) {
		const assignment = bundle.assignments.find(({ targetId }) => targetId === target.targetId)!;
		const candidateBytes = await writeOwned(
			root,
			target.ownedPaths.candidate,
			Buffer.from(`candidate:${target.coordinateId}`)
		);
		await writeOwned(root, target.ownedPaths.result, {
			schemaVersion: 'family-affinity-result-v1' as const,
			targetId: target.targetId,
			targetSha256: familyAffinitySha256(target),
			coordinateId: target.coordinateId,
			candidateVersion: target.version,
			producerId: 'fauna-fixture-producer',
			candidatePath: target.ownedPaths.candidate,
			candidateSha256: familyAffinityRawSha256(candidateBytes),
			resultPath: target.ownedPaths.result,
			sourcePath: target.sources.familyPacketPath,
			sourceSha256: target.sources.familyPacketSha256,
			promptSha256: familyAffinityPromptSha256(target, assignment),
			state: 'candidate-only' as const,
			runtimeCatalogMutationForbidden: true as const
		});
	}
	return { root, manifestPath: `${FAUNA_FAMILY_ROOT}/manifest.json`, bundle };
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('family affinity provisional Normal anchor activation', () => {
	it('atomically opens all 600 affinity coordinates from 150 verified Normal candidates', async () => {
		const fixture = await makeFixture();
		const report = await activateFamilyAffinityProvisionalAnchors({
			repositoryRoot: fixture.root,
			manifestPath: fixture.manifestPath,
			callerRole: 'integration-controller',
			allVerifiedNormalCandidates: true
		});
		expect(report).toMatchObject({
			verifiedNormalCount: 150,
			canonicalAffinityCount: 600,
			activatedCount: 600,
			skippedApprovedCount: 0,
			alreadyProvisionalCount: 0,
			rejectedCount: 0,
			runtimeCatalogMutationForbidden: true
		});
		const manifest = FamilyAffinityManifestSchema.parse(
			JSON.parse(await readFile(join(fixture.root, fixture.manifestPath), 'utf8'))
		);
		expect(
			manifest.canonicalMatrix.activeCoordinates.filter(
				({ affinity, status }) => affinity !== 'normal' && status === 'planned-provisional-anchor'
			)
		).toHaveLength(600);
		const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
			({ coordinateId }) => coordinateId === 'goblins/goblin-runt/fire'
		)!;
		const target = FamilyAffinityTargetSchema.parse(
			JSON.parse(await readFile(join(fixture.root, coordinate.targetPath), 'utf8'))
		);
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(await readFile(join(fixture.root, coordinate.assignmentPath), 'utf8'))
		);
		expect(target.anchor).toMatchObject({
			kind: 'normal-verified-candidate',
			humanReviewPending: true,
			runtimeCatalogMutationForbidden: true
		});
		expect(assignment).toMatchObject({
			dispatchStatus: 'planned-provisional-anchor',
			targetSha256: familyAffinitySha256(target)
		});
		await expect(
			validateFamilyAffinityNormalAnchorEvidence({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				targetPath: coordinate.targetPath
			})
		).resolves.toBeUndefined();
		const compatibility = JSON.parse(
			await readFile(
				join(PROJECT_ROOT, FAMILY_AFFINITY_ROOT, 'production-compatibility.json'),
				'utf8'
			)
		);
		const contractBytes = await readFile(
			join(PROJECT_ROOT, 'skills/summonlab-image-production/references/contract-v3.json')
		);
		const packetBytes = await readFile(join(fixture.root, target.sources.familyPacketPath));
		const promptBytes = Buffer.from(
			stableFamilyAffinityJson({
				schemaVersion: 'family-affinity-prompt-material-v1',
				target,
				assignment
			}).slice(0, -1)
		);
		expect(
			preflightFamilyAffinityProductionDispatch({
				compatibility,
				installedContractBytes: contractBytes,
				target,
				assignment,
				targetPath: coordinate.targetPath,
				assignmentPath: coordinate.assignmentPath,
				familyPacketBytes: packetBytes,
				renderedPromptBytes: promptBytes
			})
		).toMatchObject({ dispatchable: true, status: 'planned-provisional-anchor' });

		const manifestBeforeRerun = await readFile(join(fixture.root, fixture.manifestPath));
		const rerun = await activateFamilyAffinityProvisionalAnchors({
			repositoryRoot: fixture.root,
			manifestPath: fixture.manifestPath,
			callerRole: 'integration-controller',
			allVerifiedNormalCandidates: true
		});
		expect(rerun).toMatchObject({ activatedCount: 0, alreadyProvisionalCount: 600 });
		expect(await readFile(join(fixture.root, fixture.manifestPath))).toEqual(manifestBeforeRerun);
	}, 30_000);

	it('rejects one drifted Normal chain before mutating any affinity target', async () => {
		const fixture = await makeFixture();
		const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath));
		const affinity = fixture.bundle.manifest.canonicalMatrix.activeCoordinates.find(
			({ coordinateId }) => coordinateId === 'goblins/goblin-runt/fire'
		)!;
		const targetBefore = await readFile(join(fixture.root, affinity.targetPath));
		const normal = fixture.bundle.targets.filter(({ affinity }) => affinity === 'normal').at(-1)!;
		await writeFile(join(fixture.root, normal.ownedPaths.candidate), 'drifted');
		await expect(
			activateFamilyAffinityProvisionalAnchors({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				callerRole: 'integration-controller',
				allVerifiedNormalCandidates: true
			})
		).rejects.toThrow(new RegExp(`${normal.coordinateId.replaceAll('/', '\\/')}|candidate`, 'i'));
		expect(await readFile(join(fixture.root, fixture.manifestPath))).toEqual(manifestBefore);
		expect(await readFile(join(fixture.root, affinity.targetPath))).toEqual(targetBefore);
	}, 30_000);

	it('atomically opens all 160 fauna affinities from 40 verified Normal candidates', async () => {
		const fixture = await makeFaunaFixture();
		const report = await activateFamilyAffinityProvisionalAnchors({
			repositoryRoot: fixture.root,
			manifestPath: fixture.manifestPath,
			callerRole: 'integration-controller',
			allVerifiedNormalCandidates: true
		});
		expect(report).toMatchObject({
			verifiedNormalCount: 40,
			canonicalAffinityCount: 160,
			activatedCount: 160,
			skippedApprovedCount: 0,
			alreadyProvisionalCount: 0,
			rejectedCount: 0,
			runtimeCatalogMutationForbidden: true
		});
		const manifest = FaunaFamilyManifestSchema.parse(
			JSON.parse(await readFile(join(fixture.root, fixture.manifestPath), 'utf8'))
		);
		expect(
			manifest.canonicalMatrix.activeCoordinates.filter(
				({ affinity, status }) => affinity !== 'normal' && status === 'planned-provisional-anchor'
			)
		).toHaveLength(160);
		const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
			({ coordinateId }) => coordinateId === 'wolves/wolf-gray-wolf/fire'
		)!;
		const target = FamilyAffinityTargetSchema.parse(
			JSON.parse(await readFile(join(fixture.root, coordinate.targetPath), 'utf8'))
		);
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(await readFile(join(fixture.root, coordinate.assignmentPath), 'utf8'))
		);
		expect(target).toMatchObject({
			experimentId: 'fauna-family-v1',
			status: 'planned-provisional-anchor',
			anchor: {
				kind: 'normal-verified-candidate',
				normalCoordinateId: 'wolves/wolf-gray-wolf/normal',
				humanReviewPending: true,
				runtimeCatalogMutationForbidden: true
			}
		});
		expect(assignment).toMatchObject({
			experimentId: 'fauna-family-v1',
			dispatchStatus: 'planned-provisional-anchor',
			targetSha256: familyAffinitySha256(target),
			runtimeCatalogMutationForbidden: true
		});
		expect(coordinate).toMatchObject({
			status: 'planned-provisional-anchor',
			targetSha256: familyAffinitySha256(target),
			assignmentSha256: familyAffinitySha256(assignment)
		});
		await expect(
			validateFamilyAffinityNormalAnchorEvidence({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				targetPath: coordinate.targetPath
			})
		).resolves.toBeUndefined();

		const compatibility = JSON.parse(
			await readFile(join(PROJECT_ROOT, FAUNA_FAMILY_ROOT, 'production-compatibility.json'), 'utf8')
		);
		const contractBytes = await readFile(
			join(PROJECT_ROOT, 'skills/summonlab-image-production/references/contract-v3.json')
		);
		const packetBytes = await readFile(join(fixture.root, target.sources.familyPacketPath));
		const promptBytes = Buffer.from(
			stableFamilyAffinityJson({
				schemaVersion: 'family-affinity-prompt-material-v1',
				target,
				assignment
			}).slice(0, -1)
		);
		expect(
			preflightFamilyAffinityProductionDispatch({
				compatibility,
				installedContractBytes: contractBytes,
				target,
				assignment,
				targetPath: coordinate.targetPath,
				assignmentPath: coordinate.assignmentPath,
				familyPacketBytes: packetBytes,
				renderedPromptBytes: promptBytes
			})
		).toMatchObject({ dispatchable: true, status: 'planned-provisional-anchor' });

		const manifestBeforeRerun = await readFile(join(fixture.root, fixture.manifestPath));
		const rerun = await activateFamilyAffinityProvisionalAnchors({
			repositoryRoot: fixture.root,
			manifestPath: fixture.manifestPath,
			callerRole: 'integration-controller',
			allVerifiedNormalCandidates: true
		});
		expect(rerun).toMatchObject({ activatedCount: 0, alreadyProvisionalCount: 160 });
		expect(await readFile(join(fixture.root, fixture.manifestPath))).toEqual(manifestBeforeRerun);
	}, 30_000);

	it('rejects a fauna affinity output collision before mutating the manifest or target', async () => {
		const fixture = await makeFaunaFixture();
		const coordinate = fixture.bundle.manifest.canonicalMatrix.activeCoordinates.find(
			({ coordinateId }) => coordinateId === 'wolves/wolf-gray-wolf/fire'
		)!;
		const target = fixture.bundle.targets.find(
			({ coordinateId }) => coordinateId === coordinate.coordinateId
		)!;
		await writeOwned(fixture.root, target.ownedPaths.candidate, Buffer.from('collision'));
		const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath));
		const targetBefore = await readFile(join(fixture.root, coordinate.targetPath));
		await expect(
			activateFamilyAffinityProvisionalAnchors({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				callerRole: 'integration-controller',
				allVerifiedNormalCandidates: true
			})
		).rejects.toThrow(/collision|wolves\/wolf-gray-wolf\/normal/i);
		expect(await readFile(join(fixture.root, fixture.manifestPath))).toEqual(manifestBefore);
		expect(await readFile(join(fixture.root, coordinate.targetPath))).toEqual(targetBefore);
	}, 30_000);

	it('requires controller authority and an unambiguous all-candidates CLI scope', async () => {
		expect(
			parseFamilyAffinityProvisionalActivationCli([
				'--caller-role',
				'integration-controller',
				'--all-verified-normal-candidates'
			])
		).toEqual({ callerRole: 'integration-controller', allVerifiedNormalCandidates: true });
		expect(
			parseFamilyAffinityProvisionalActivationCli([
				'--fauna',
				'--caller-role',
				'integration-controller',
				'--all-verified-normal-candidates'
			])
		).toEqual({
			callerRole: 'integration-controller',
			allVerifiedNormalCandidates: true,
			fauna: true
		});
		expect(() =>
			parseFamilyAffinityProvisionalActivationCli(['--caller-role', 'integration-controller'])
		).toThrow(/all-verified/i);
		expect(() =>
			parseFamilyAffinityProvisionalActivationCli([
				'--caller-role',
				'integration-controller',
				'--all-verified-normal-candidates',
				'yes'
			])
		).toThrow(/invalid/i);
		expect(() =>
			parseFamilyAffinityProvisionalActivationCli([
				'--fauna',
				'--fauna',
				'--caller-role',
				'integration-controller',
				'--all-verified-normal-candidates'
			])
		).toThrow(/repeated.*fauna/i);
	});
});

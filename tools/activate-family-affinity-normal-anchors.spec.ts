import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	activateFamilyAffinityNormalAnchors,
	parseFamilyAffinityAnchorActivationCli
} from './activate-family-affinity-normal-anchors.js';
import {
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	buildFamilyAffinityProductionBundle,
	familyAffinityPromptSha256,
	familyAffinityProducerIdentitySha256,
	familyAffinityRawSha256,
	familyAffinityReviewAssignmentPath,
	familyAffinityReviewIssuerAttestationSha256,
	familyAffinitySha256,
	loadFamilyAffinityActiveSources,
	stableFamilyAffinityJson,
	validateFamilyAffinityNormalAnchorEvidence,
	type FamilyAffinityReviewReceipt,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';

const PROJECT_ROOT = process.cwd();
const roots: string[] = [];

async function writeOwned(root: string, path: string, value: unknown): Promise<Buffer> {
	const absolute = join(root, path);
	await mkdir(dirname(absolute), { recursive: true });
	const bytes = Buffer.isBuffer(value)
		? value
		: Buffer.from(typeof value === 'string' ? value : stableFamilyAffinityJson(value));
	await writeFile(absolute, bytes);
	return bytes;
}

function passingRubric() {
	return Object.fromEntries(
		[
			'identity',
			'tier',
			'archetype',
			'anatomy',
			'affinity',
			'counterplay',
			'framing',
			'finish'
		].map((key) => [key, { verdict: 'pass', notes: `${key} passes.` }])
	);
}

async function makeFixture(
	formId: 'elemental-wisp' | 'elemental-warden' = 'elemental-wisp',
	blindDecision: 'approved-review' | 'revise' = 'approved-review'
) {
	const root = await mkdtemp(join(tmpdir(), 'family-anchor-activation-'));
	roots.push(root);
	const { families, mapping } = await loadFamilyAffinityActiveSources(PROJECT_ROOT);
	const bundle = buildFamilyAffinityProductionBundle(families, mapping);
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	const manifestBytes = await writeOwned(root, manifestPath, bundle.manifest);
	const manifestSha256 = familyAffinityRawSha256(manifestBytes);
	const formCoordinates = bundle.manifest.canonicalMatrix.activeCoordinates.filter(
		({ familyId, formId: candidateFormId }) =>
			familyId === 'elementals' && candidateFormId === formId
	);
	for (const coordinate of formCoordinates) {
		const target = bundle.targets.find(
			({ coordinateId }) => coordinateId === coordinate.coordinateId
		)!;
		const assignment = bundle.assignments.find(
			({ coordinateId }) => coordinateId === coordinate.coordinateId
		)!;
		await writeOwned(root, coordinate.targetPath, target);
		await writeOwned(root, coordinate.assignmentPath, assignment);
	}
	const target = bundle.targets.find(
		({ coordinateId }) => coordinateId === `elementals/${formId}/normal`
	)!;
	const coordinate = bundle.manifest.canonicalMatrix.activeCoordinates.find(
		({ coordinateId }) => coordinateId === target.coordinateId
	)!;
	const productionAssignment = bundle.assignments.find(
		({ coordinateId }) => coordinateId === target.coordinateId
	)!;
	const family = families.find(({ familyId }) => familyId === 'elementals')!;
	await writeOwned(root, target.sources.familyPacketPath, family);
	const candidateBytes = await writeOwned(root, target.ownedPaths.candidate, 'normal-candidate');
	const result = {
		schemaVersion: 'family-affinity-result-v1' as const,
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		producerId: 'producer-alpha',
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: familyAffinityRawSha256(candidateBytes),
		resultPath: target.ownedPaths.result,
		sourcePath: target.sources.familyPacketPath,
		sourceSha256: target.sources.familyPacketSha256,
		promptSha256: familyAffinityPromptSha256(target, productionAssignment),
		state: 'candidate-only' as const,
		runtimeCatalogMutationForbidden: true as const
	};
	const resultBytes = await writeOwned(root, target.ownedPaths.result, result);
	const commonReceipt = {
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		decisionVersion: target.version,
		producerIdentitySha256: familyAffinityProducerIdentitySha256(result.producerId),
		candidatePath: result.candidatePath,
		candidateSha256: result.candidateSha256,
		resultPath: result.resultPath,
		resultSha256: familyAffinityRawSha256(resultBytes),
		sourcePath: result.sourcePath,
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256,
		rubric: passingRubric(),
		runtimeCatalogMutationForbidden: true as const
	};
	const ordinary = {
		...commonReceipt,
		schemaVersion: 'family-affinity-review-decision-v1' as const,
		receiptType: 'ordinary' as const,
		producerId: result.producerId,
		reviewerId: 'reviewer-beta',
		decision: 'approved-review' as const
	};
	await writeReviewChain({
		root,
		kind: 'ordinary',
		manifestPath,
		manifestSha256,
		target,
		targetPath: coordinate.targetPath,
		productionAssignment,
		productionAssignmentPath: coordinate.assignmentPath,
		result,
		resultSha256: commonReceipt.resultSha256,
		receipt: ordinary
	});
	if (target.tier === 'T3' || target.tier === 'T5') {
		const blind = {
			...commonReceipt,
			schemaVersion: 'family-affinity-blind-review-v1' as const,
			receiptType: 'blind' as const,
			reviewerId: 'reviewer-gamma',
			decision: blindDecision,
			blindToProducerIdentity: true as const,
			blindToOrdinaryDecision: true as const
		};
		await writeReviewChain({
			root,
			kind: 'blind',
			manifestPath,
			manifestSha256,
			target,
			targetPath: coordinate.targetPath,
			productionAssignment,
			productionAssignmentPath: coordinate.assignmentPath,
			result,
			resultSha256: commonReceipt.resultSha256,
			receipt: blind
		});
	}
	return { root, manifestPath, target, coordinate, formCoordinates };
}

async function writeReviewChain(input: {
	root: string;
	kind: 'ordinary' | 'blind';
	manifestPath: string;
	manifestSha256: string;
	target: FamilyAffinityTarget;
	targetPath: string;
	productionAssignment: ReturnType<typeof FamilyAffinityAssignmentSchema.parse>;
	productionAssignmentPath: string;
	result: {
		producerId: string;
		candidatePath: string;
		candidateSha256: string;
		resultPath: string;
		sourcePath: string;
		sourceSha256: string;
		promptSha256: string;
	};
	resultSha256: string;
	receipt: FamilyAffinityReviewReceipt | Record<string, unknown>;
}) {
	const receipt = input.receipt as FamilyAffinityReviewReceipt & { reviewerId: string };
	const receiptPath =
		input.kind === 'ordinary'
			? input.target.ownedPaths.decision
			: input.target.ownedPaths.blindReview;
	const assignmentPath = familyAffinityReviewAssignmentPath(
		input.kind,
		input.target,
		input.target.version
	);
	const issuerId = input.kind === 'ordinary' ? 'controller-ordinary' : 'controller-blind';
	const assignment = {
		schemaVersion: 'family-affinity-review-assignment-v1' as const,
		issuerRole: 'controller' as const,
		issuerId,
		issuerAttestationSha256: familyAffinityReviewIssuerAttestationSha256({
			issuerId,
			reviewerId: receipt.reviewerId,
			kind: input.kind,
			manifestPath: input.manifestPath,
			manifestSha256: input.manifestSha256,
			target: input.target,
			targetPath: input.targetPath,
			productionAssignment: input.productionAssignment,
			productionAssignmentPath: input.productionAssignmentPath,
			result: input.result as never,
			resultSha256: input.resultSha256,
			decisionVersion: input.target.version,
			permittedReceiptPath: receiptPath
		}),
		reviewKind: input.kind,
		assignmentId: `${input.target.targetId}/${input.kind}-review-v${input.target.version}/assignment`,
		reviewerId: receipt.reviewerId,
		producerId: input.kind === 'ordinary' ? input.result.producerId : null,
		producerIdentitySha256: familyAffinityProducerIdentitySha256(input.result.producerId),
		manifestPath: input.manifestPath,
		manifestSha256: input.manifestSha256,
		targetId: input.target.targetId,
		targetPath: input.targetPath,
		targetSha256: familyAffinitySha256(input.target),
		productionAssignmentPath: input.productionAssignmentPath,
		productionAssignmentSha256: familyAffinitySha256(input.productionAssignment),
		coordinateId: input.target.coordinateId,
		candidateVersion: input.target.version,
		decisionVersion: input.target.version,
		candidatePath: input.result.candidatePath,
		candidateSha256: input.result.candidateSha256,
		resultPath: input.result.resultPath,
		resultSha256: input.resultSha256,
		sourcePath: input.result.sourcePath,
		sourceSha256: input.result.sourceSha256,
		promptSha256: input.result.promptSha256,
		permittedReceiptPath: receiptPath,
		exclusiveCreateRequired: true as const,
		runtimeCatalogMutationForbidden: true as const
	};
	await writeOwned(input.root, assignmentPath, assignment);
	await writeOwned(input.root, receiptPath, input.receipt);
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('family affinity Normal anchor activation', () => {
	it('atomically activates exactly four affinity targets without changing Normal evidence', async () => {
		const fixture = await makeFixture();
		const protectedPaths = [
			fixture.coordinate.targetPath,
			fixture.coordinate.assignmentPath,
			fixture.target.ownedPaths.candidate,
			fixture.target.ownedPaths.result,
			fixture.target.ownedPaths.decision,
			familyAffinityReviewAssignmentPath('ordinary', fixture.target, fixture.target.version)
		];
		const before = new Map(
			await Promise.all(
				protectedPaths.map(
					async (path) => [path, await readFile(join(fixture.root, path))] as const
				)
			)
		);
		const [activation] = await activateFamilyAffinityNormalAnchors({
			repositoryRoot: fixture.root,
			manifestPath: fixture.manifestPath,
			callerRole: 'integration-controller',
			normalCoordinateIds: [fixture.target.coordinateId]
		});
		expect(activation?.elementalCoordinateIds).toHaveLength(4);
		for (const coordinate of fixture.formCoordinates.filter(
			({ affinity }) => affinity !== 'normal'
		)) {
			const target = FamilyAffinityTargetSchema.parse(
				JSON.parse(await readFile(join(fixture.root, coordinate.targetPath), 'utf8'))
			);
			const assignment = FamilyAffinityAssignmentSchema.parse(
				JSON.parse(await readFile(join(fixture.root, coordinate.assignmentPath), 'utf8'))
			);
			expect(target.status).toBe('planned');
			expect(target.anchor).toMatchObject({
				kind: 'normal-approved-review',
				normalCandidatePath: fixture.target.ownedPaths.candidate,
				normalResultPath: fixture.target.ownedPaths.result
			});
			expect(assignment).toMatchObject({
				dispatchStatus: 'planned',
				targetSha256: familyAffinitySha256(target)
			});
			await expect(
				validateFamilyAffinityNormalAnchorEvidence({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					targetPath: coordinate.targetPath
				})
			).resolves.toBeUndefined();
		}
		for (const [path, bytes] of before) {
			expect(await readFile(join(fixture.root, path))).toEqual(bytes);
		}
		const manifest = FamilyAffinityManifestSchema.parse(
			JSON.parse(await readFile(join(fixture.root, fixture.manifestPath), 'utf8'))
		);
		expect(
			manifest.canonicalMatrix.activeCoordinates.filter(
				({ familyId, formId, affinity, status }) =>
					familyId === 'elementals' &&
					formId === 'elemental-wisp' &&
					affinity !== 'normal' &&
					status === 'planned'
			)
		).toHaveLength(4);
	});

	it('fails closed when a required blind review disagrees', async () => {
		const fixture = await makeFixture('elemental-warden', 'revise');
		const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath));
		await expect(
			activateFamilyAffinityNormalAnchors({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				callerRole: 'integration-controller',
				normalCoordinateIds: [fixture.target.coordinateId]
			})
		).rejects.toThrow(/agreeing blind approval/i);
		expect(await readFile(join(fixture.root, fixture.manifestPath))).toEqual(manifestBefore);
	});

	it('rejects pre-existing elemental output and leaves the manifest unchanged', async () => {
		const fixture = await makeFixture();
		const fireTarget = FamilyAffinityTargetSchema.parse(
			JSON.parse(
				await readFile(
					join(
						fixture.root,
						fixture.formCoordinates.find(({ affinity }) => affinity === 'fire')!.targetPath
					),
					'utf8'
				)
			)
		);
		await writeOwned(fixture.root, fireTarget.ownedPaths.candidate, 'foreign-output');
		const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath));
		await expect(
			activateFamilyAffinityNormalAnchors({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				callerRole: 'integration-controller',
				normalCoordinateIds: [fixture.target.coordinateId]
			})
		).rejects.toThrow(/collision/i);
		expect(await readFile(join(fixture.root, fixture.manifestPath))).toEqual(manifestBefore);
	});

	it('rejects source drift and missing required blind evidence without a partial activation', async () => {
		const sourceDrift = await makeFixture();
		const manifestBefore = await readFile(join(sourceDrift.root, sourceDrift.manifestPath));
		await writeFile(
			join(sourceDrift.root, sourceDrift.target.sources.familyPacketPath),
			'{"drifted":true}\n'
		);
		await expect(
			activateFamilyAffinityNormalAnchors({
				repositoryRoot: sourceDrift.root,
				manifestPath: sourceDrift.manifestPath,
				callerRole: 'integration-controller',
				normalCoordinateIds: [sourceDrift.target.coordinateId]
			})
		).rejects.toThrow();
		expect(await readFile(join(sourceDrift.root, sourceDrift.manifestPath))).toEqual(
			manifestBefore
		);

		const missingBlind = await makeFixture('elemental-warden');
		const blindAssignmentPath = familyAffinityReviewAssignmentPath(
			'blind',
			missingBlind.target,
			missingBlind.target.version
		);
		await rm(join(missingBlind.root, blindAssignmentPath));
		const missingBlindManifestBefore = await readFile(
			join(missingBlind.root, missingBlind.manifestPath)
		);
		await expect(
			activateFamilyAffinityNormalAnchors({
				repositoryRoot: missingBlind.root,
				manifestPath: missingBlind.manifestPath,
				callerRole: 'integration-controller',
				normalCoordinateIds: [missingBlind.target.coordinateId]
			})
		).rejects.toThrow();
		expect(await readFile(join(missingBlind.root, missingBlind.manifestPath))).toEqual(
			missingBlindManifestBefore
		);
	});

	it('rejects non-controller callers and strict CLI ambiguity', async () => {
		const fixture = await makeFixture();
		await expect(
			activateFamilyAffinityNormalAnchors({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				callerRole: 'image-producer',
				normalCoordinateIds: [fixture.target.coordinateId]
			})
		).rejects.toThrow(/integration-controller/i);
		expect(() =>
			parseFamilyAffinityAnchorActivationCli([
				'--caller-role',
				'integration-controller',
				'--unknown',
				fixture.target.coordinateId
			])
		).toThrow(/invalid/i);
	});
});

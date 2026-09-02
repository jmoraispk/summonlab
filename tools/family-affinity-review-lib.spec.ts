import { createHash } from 'node:crypto';
import {
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	BlindReviewReceiptSchema,
	FamilyAffinityCandidateResultSchema,
	OrdinaryReviewReceiptSchema,
	buildFamilyAffinityReviewArtifacts,
	createReviewReceiptExclusive,
	evaluateFamilyAffinityReviewAttempt,
	issueReviewAssignmentExclusive,
	reviewReceiptPath,
	validateReviewTransition
} from './family-affinity-review-lib.js';
import {
	allocateFamilyAffinityRevision,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	bridgeAttemptPaths,
	canonicalAttemptPaths,
	familyAffinityProducerIdentitySha256,
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinityReviewAssignmentPath,
	familyAffinityReviewIssuerAttestationSha256,
	familyAffinitySha256,
	stableFamilyAffinityJson,
	type FamilyAffinityAssignment,
	type FamilyAffinityReviewAssignment,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';
import { exportFamilyAffinityReview } from './export-family-affinity-review.js';

const temporaryRoots: string[] = [];
const sha = (character: string) => character.repeat(64);

function target(tier: 'T1' | 'T3' | 'T5' = 'T1'): FamilyAffinityTarget {
	const formId = tier === 'T1' ? 'goblin-runt' : tier === 'T3' ? 'goblin-raider' : 'goblin-king';
	const raw = JSON.parse(
		requireRead(
			join(
				process.cwd(),
				`assets/enemies/experiments/family-affinity-v1/targets/goblins/${formId}/normal/target-v1.json`
			)
		)
	) as Record<string, unknown>;
	const paths = canonicalAttemptPaths('goblins', formId, 'normal', 1);
	raw.ownedPaths = {
		candidate: paths.candidate,
		result: paths.result,
		decision: paths.decision,
		blindReview: paths.blindReview
	};
	return FamilyAffinityTargetSchema.parse(raw);
}

function requireRead(path: string): string {
	return process.getBuiltinModule('node:fs').readFileSync(path, 'utf8');
}

function assignmentFor(activeTarget: FamilyAffinityTarget): FamilyAffinityAssignment {
	const raw = JSON.parse(
		requireRead(
			join(
				process.cwd(),
				canonicalAttemptPaths(
					activeTarget.familyId,
					activeTarget.formId,
					activeTarget.affinity,
					activeTarget.version
				).assignment
			)
		)
	) as FamilyAffinityAssignment;
	return { ...raw, targetSha256: familyAffinitySha256(activeTarget) };
}

function packetBytesFor(activeTarget: FamilyAffinityTarget): Buffer {
	return Buffer.from(requireRead(join(process.cwd(), activeTarget.sources.familyPacketPath)));
}

async function stageLiveAttempt(
	tier: 'T1' | 'T3' = 'T1',
	captureBaseline = false
) {
	const root = await mkdtemp(join(tmpdir(), 'family-review-live-'));
	temporaryRoots.push(root);
	const source = join(process.cwd(), 'assets/enemies/experiments/family-affinity-v1');
	const destination = join(root, 'assets/enemies/experiments/family-affinity-v1');
	await cp(source, destination, { recursive: true });
	await stripBridgeFixture(root);
	const baselineCatalog = captureBaseline
		? (await buildFamilyAffinityReviewArtifacts(root)).catalog
		: undefined;
	const activeTarget = target(tier);
	const paths = canonicalAttemptPaths(
		activeTarget.familyId,
		activeTarget.formId,
		activeTarget.affinity,
		activeTarget.version
	);
	const candidateBytes = await sharp({
		create: { width: 8, height: 8, channels: 3, background: '#497a53' }
	})
		.png({ compressionLevel: 9, adaptiveFiltering: false })
		.toBuffer();
	const result = resultFor(activeTarget, candidateBytes);
	for (const [path, bytes] of [
		[activeTarget.ownedPaths.candidate, candidateBytes],
		[activeTarget.ownedPaths.result, Buffer.from(stableFamilyAffinityJson(result))]
	] as const) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), bytes);
	}
	return { root, activeTarget, paths, candidateBytes, result, baselineCatalog };
}

const familyAffinityRoot = 'assets/enemies/experiments/family-affinity-v1';
const familyAffinityManifestPath = `${familyAffinityRoot}/manifest.json`;

async function stripBridgeFixture(root: string): Promise<void> {
	const manifest = FamilyAffinityManifestSchema.parse(
		JSON.parse(await readFile(join(root, familyAffinityManifestPath), 'utf8'))
	);
	manifest.bridge = { targetCount: 0, assignmentCount: 0, activeCoordinates: [] };
	await writeFile(join(root, familyAffinityManifestPath), stableFamilyAffinityJson(manifest));
	await rm(join(root, familyAffinityRoot, 'bridge'), { recursive: true, force: true });
	await rm(join(root, familyAffinityRoot, 'review/bridge'), { recursive: true, force: true });
}

async function retainOnlyPlannedBridgeControls(root: string): Promise<number> {
	const manifest = FamilyAffinityManifestSchema.parse(
		JSON.parse(await readFile(join(root, familyAffinityManifestPath), 'utf8'))
	);
	const activeCoordinates = manifest.bridge?.activeCoordinates ?? [];
	const plannedControls = (
		await Promise.all(
			activeCoordinates.map(async (coordinate) => {
				if (coordinate.activeVersion !== 1) return undefined;
				const targetBytes = await readFile(join(root, coordinate.targetPath));
				const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
				const candidateExists = await readFile(join(root, target.ownedPaths.candidate)).then(
					() => true,
					() => false
				);
				if (candidateExists) return undefined;
				return {
					coordinate,
					files: [
						{ path: coordinate.targetPath, bytes: targetBytes },
						{
							path: coordinate.assignmentPath,
							bytes: await readFile(join(root, coordinate.assignmentPath))
						}
					] as const
				};
			})
		)
	).filter((control): control is NonNullable<typeof control> => control !== undefined);
	manifest.bridge = {
		targetCount: plannedControls.length,
		assignmentCount: plannedControls.length,
		activeCoordinates: plannedControls.map(({ coordinate }) => coordinate)
	};
	await writeFile(join(root, familyAffinityManifestPath), stableFamilyAffinityJson(manifest));
	await rm(join(root, familyAffinityRoot, 'bridge'), { recursive: true, force: true });
	await rm(join(root, familyAffinityRoot, 'review/bridge'), { recursive: true, force: true });
	for (const { path, bytes } of plannedControls.flatMap(({ files }) => files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), bytes);
	}
	return plannedControls.length;
}

function reviewIssueInput(
	live: Awaited<ReturnType<typeof stageLiveAttempt>>,
	kind: 'ordinary' | 'blind',
	reviewerId: string
) {
	return {
		callerRole: 'controller' as const,
		issuerId: 'review-controller-alpha',
		kind,
		reviewerId,
		targetPath: live.paths.target,
		productionAssignmentPath: live.paths.assignment,
		decisionVersion: 1
	};
}

function reviewIssuanceLockPath(live: Awaited<ReturnType<typeof stageLiveAttempt>>): string {
	return `assets/enemies/experiments/family-affinity-v1/review/assignments/locks/${live.activeTarget.familyId}/${live.activeTarget.formId}/${live.activeTarget.affinity}/candidate-v${live.activeTarget.version}.lock`;
}

async function existingReviewAssignmentPaths(root: string, paths: string[]): Promise<string[]> {
	const reads = await Promise.allSettled(paths.map((path) => readFile(join(root, path))));
	return paths.filter((_, index) => reads[index]?.status === 'fulfilled');
}

type IssuanceSwapHooks = {
	afterLockParentAnchored?: () => Promise<void>;
	afterAssignmentParentAnchored?: () => Promise<void>;
	beforeLockRelease?: () => Promise<void>;
};

function reviewAssignmentWithIdentity(
	live: Awaited<ReturnType<typeof stageLiveAttempt>>,
	assignment: FamilyAffinityReviewAssignment,
	overrides: Pick<FamilyAffinityReviewAssignment, 'issuerId' | 'reviewerId'>
): FamilyAffinityReviewAssignment {
	const changed = { ...assignment, ...overrides };
	return {
		...changed,
		issuerAttestationSha256: familyAffinityReviewIssuerAttestationSha256({
			issuerId: changed.issuerId,
			reviewerId: changed.reviewerId,
			kind: changed.reviewKind,
			manifestPath: changed.manifestPath,
			manifestSha256: changed.manifestSha256,
			target: live.activeTarget,
			targetPath: changed.targetPath,
			productionAssignment: assignmentFor(live.activeTarget),
			productionAssignmentPath: changed.productionAssignmentPath,
			result: live.result,
			resultSha256: familyAffinityRawSha256(stableFamilyAffinityJson(live.result)),
			decisionVersion: changed.decisionVersion,
			permittedReceiptPath: changed.permittedReceiptPath
		})
	};
}

function resultFor(activeTarget: FamilyAffinityTarget, candidateBytes = Buffer.from('candidate')) {
	const assignment = assignmentFor(activeTarget);
	return FamilyAffinityCandidateResultSchema.parse({
		schemaVersion: 'family-affinity-result-v1',
		targetId: activeTarget.targetId,
		targetSha256: familyAffinitySha256(activeTarget),
		coordinateId: activeTarget.coordinateId,
		candidateVersion: activeTarget.version,
		producerId: 'producer-alpha',
		candidatePath: activeTarget.ownedPaths.candidate,
		candidateSha256: createHash('sha256').update(candidateBytes).digest('hex'),
		resultPath: activeTarget.ownedPaths.result,
		sourcePath: activeTarget.sources.familyPacketPath,
		sourceSha256: activeTarget.sources.familyPacketSha256,
		promptSha256: familyAffinityPromptSha256(activeTarget, assignment),
		state: 'candidate-only',
		runtimeCatalogMutationForbidden: true
	});
}

function ordinaryFor(
	activeTarget: FamilyAffinityTarget,
	result: ReturnType<typeof resultFor>,
	decision: 'approved-review' | 'rejected' | 'revise' = 'approved-review'
) {
	return OrdinaryReviewReceiptSchema.parse({
		schemaVersion: 'family-affinity-review-decision-v1',
		receiptType: 'ordinary',
		targetId: activeTarget.targetId,
		targetSha256: familyAffinitySha256(activeTarget),
		coordinateId: activeTarget.coordinateId,
		candidateVersion: 1,
		decisionVersion: 1,
		producerId: result.producerId,
		reviewerId: 'reviewer-beta',
		producerIdentitySha256: familyAffinityProducerIdentitySha256(result.producerId),
		candidatePath: result.candidatePath,
		candidateSha256: result.candidateSha256,
		resultPath: result.resultPath,
		resultSha256: familyAffinityRawSha256(stableFamilyAffinityJson(result)),
		sourcePath: result.sourcePath,
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256,
		decision,
		rubric: Object.fromEntries(
			[
				'identity',
				'tier',
				'archetype',
				'anatomy',
				'affinity',
				'counterplay',
				'framing',
				'finish'
			].map((key) => [key, { verdict: 'pass', notes: `${key} reviewed independently` }])
		),
		runtimeCatalogMutationForbidden: true
	});
}

function blindFor(
	activeTarget: FamilyAffinityTarget,
	result: ReturnType<typeof resultFor>,
	decision: 'approved-review' | 'rejected' | 'revise' = 'approved-review'
) {
	return BlindReviewReceiptSchema.parse({
		...Object.fromEntries(
			Object.entries(ordinaryFor(activeTarget, result, decision)).filter(
				([key]) => key !== 'producerId'
			)
		),
		schemaVersion: 'family-affinity-blind-review-v1',
		receiptType: 'blind',
		reviewerId: 'reviewer-gamma',
		blindToProducerIdentity: true,
		blindToOrdinaryDecision: true
	});
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('family-affinity review receipt contract', () => {
	it('derives collision-safe immutable ordinary and blind receipt paths', () => {
		expect(reviewReceiptPath('ordinary', 'goblins', 'goblin-raider', 'fire', 2, 3)).toBe(
			'assets/enemies/experiments/family-affinity-v1/review/decisions/goblins/goblin-raider/fire/candidate-v2-review-v3.json'
		);
		expect(reviewReceiptPath('blind', 'goblins', 'goblin-raider', 'fire', 2, 3)).toBe(
			'assets/enemies/experiments/family-affinity-v1/review/blind/goblins/goblin-raider/fire/candidate-v2-blind-v3.json'
		);
	});

	it('allows only planned to candidate to approved-review and rejects runtime', () => {
		expect(() => validateReviewTransition('planned', 'candidate')).not.toThrow();
		expect(() => validateReviewTransition('candidate', 'approved-review')).not.toThrow();
		expect(() => validateReviewTransition('planned', 'approved-review')).toThrow(/candidate/i);
		expect(() => validateReviewTransition('approved-review', 'runtime' as never)).toThrow(
			/runtime/i
		);
	});

	it('requires current candidate bytes, result receipt, and independent approval', () => {
		const activeTarget = target();
		const candidateBytes = Buffer.from('candidate');
		const result = resultFor(activeTarget, candidateBytes);
		const ordinary = ordinaryFor(activeTarget, result);
		expect(
			evaluateFamilyAffinityReviewAttempt({
				target: activeTarget,
				assignment: assignmentFor(activeTarget),
				familyPacketBytes: packetBytesFor(activeTarget),
				candidateBytes,
				resultBytes: Buffer.from(stableFamilyAffinityJson(result)),
				ordinary
			})
		).toMatchObject({ state: 'approved-review', revisionRequired: false });

		expect(() => evaluateFamilyAffinityReviewAttempt({ target: activeTarget, ordinary })).toThrow(
			/result receipt/i
		);
		expect(() =>
			evaluateFamilyAffinityReviewAttempt({
				target: activeTarget,
				assignment: assignmentFor(activeTarget),
				familyPacketBytes: packetBytesFor(activeTarget),
				candidateBytes: Buffer.from('stale'),
				resultBytes: Buffer.from(stableFamilyAffinityJson(result)),
				ordinary
			})
		).toThrow(/candidate.*(stale|forged|cross-bound)/i);
		expect(() =>
			evaluateFamilyAffinityReviewAttempt({
				target: activeTarget,
				assignment: assignmentFor(activeTarget),
				familyPacketBytes: packetBytesFor(activeTarget),
				candidateBytes,
				resultBytes: Buffer.from(stableFamilyAffinityJson(result)),
				ordinary: { ...ordinary, reviewerId: result.producerId }
			})
		).toThrow(/self-approval/i);
	});

	it('requires an independent agreeing blind receipt for every T3 and T5 candidate version', () => {
		for (const tier of ['T3', 'T5'] as const) {
			const activeTarget = target(tier);
			const candidateBytes = Buffer.from(`candidate-${tier}`);
			const result = resultFor(activeTarget, candidateBytes);
			const ordinary = ordinaryFor(activeTarget, result);
			expect(() =>
				evaluateFamilyAffinityReviewAttempt({
					target: activeTarget,
					assignment: assignmentFor(activeTarget),
					familyPacketBytes: packetBytesFor(activeTarget),
					candidateBytes,
					resultBytes: Buffer.from(stableFamilyAffinityJson(result)),
					ordinary
				})
			).toThrow(/blind/i);
			expect(
				evaluateFamilyAffinityReviewAttempt({
					target: activeTarget,
					assignment: assignmentFor(activeTarget),
					familyPacketBytes: packetBytesFor(activeTarget),
					candidateBytes,
					resultBytes: Buffer.from(stableFamilyAffinityJson(result)),
					ordinary,
					blind: blindFor(activeTarget, result)
				})
			).toMatchObject({ state: 'approved-review' });
			expect(() =>
				evaluateFamilyAffinityReviewAttempt({
					target: activeTarget,
					assignment: assignmentFor(activeTarget),
					familyPacketBytes: packetBytesFor(activeTarget),
					candidateBytes,
					resultBytes: Buffer.from(stableFamilyAffinityJson(result)),
					ordinary,
					blind: { ...blindFor(activeTarget, result, 'revise'), reviewerId: 'reviewer-beta' }
				})
			).toThrow(/independent|disagree/i);
		}
	});

	it('keeps reject and revise decisions non-approved and requests controller allocation', () => {
		const activeTarget = target();
		const candidateBytes = Buffer.from('candidate');
		const result = resultFor(activeTarget, candidateBytes);
		for (const decision of ['rejected', 'revise'] as const) {
			expect(
				evaluateFamilyAffinityReviewAttempt({
					target: activeTarget,
					assignment: assignmentFor(activeTarget),
					familyPacketBytes: packetBytesFor(activeTarget),
					candidateBytes,
					resultBytes: Buffer.from(stableFamilyAffinityJson(result)),
					ordinary: ordinaryFor(activeTarget, result, decision)
				})
			).toEqual({ state: decision, revisionRequired: true, approved: false });
		}
	});

	it('refuses receipt creation without controller-issued reviewer authorization', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-review-'));
		temporaryRoots.push(root);
		const activeTarget = target();
		const result = resultFor(activeTarget);
		const receipt = ordinaryFor(activeTarget, result);
		const path = reviewReceiptPath('ordinary', 'goblins', 'goblin-runt', 'normal', 1, 1);
		await expect(createReviewReceiptExclusive(root, path, receipt)).rejects.toThrow(
			/missing immutable review artifact/i
		);
	});

	it('allows only an identity-separated controller to issue immutable review authorization', async () => {
		for (const [callerRole, issuerId] of [
			['producer', 'producer-alpha'],
			['reviewer', 'reviewer-beta'],
			['operator', 'review-controller-alpha']
		] as const) {
			const live = await stageLiveAttempt();
			await expect(
				issueReviewAssignmentExclusive(live.root, {
					...reviewIssueInput(live, 'ordinary', 'reviewer-beta'),
					callerRole,
					issuerId
				})
			).rejects.toThrow(/controller|issuer|separate/i);
			await expect(
				readFile(
					join(
						live.root,
						'assets/enemies/experiments/family-affinity-v1/review/assignments/decisions/goblins/goblin-runt/normal/candidate-v1-ordinary-v1-assignment.json'
					)
				)
			).rejects.toMatchObject({ code: 'ENOENT' });
		}

		for (const issuerId of ['producer-alpha', 'reviewer-beta']) {
			const live = await stageLiveAttempt();
			await expect(
				issueReviewAssignmentExclusive(live.root, {
					...reviewIssueInput(live, 'ordinary', 'reviewer-beta'),
					issuerId
				})
			).rejects.toThrow(/identity|separate|collision/i);
		}

		const live = await stageLiveAttempt();
		const issued = await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'ordinary', 'reviewer-beta')
		);
		expect(issued.assignment).toMatchObject({
			issuerRole: 'controller',
			issuerId: 'review-controller-alpha'
		});
		await expect(
			issueReviewAssignmentExclusive(live.root, reviewIssueInput(live, 'ordinary', 'reviewer-beta'))
		).rejects.toThrow(/EEXIST|exist/i);
		await writeFile(
			join(live.root, issued.path),
			stableFamilyAffinityJson({
				...issued.assignment,
				issuerId: 'forged-controller'
			})
		);
		await expect(
			createReviewReceiptExclusive(
				live.root,
				issued.path,
				ordinaryFor(live.activeTarget, live.result)
			)
		).rejects.toThrow(/attestation|stale|forged|cross-bound/i);
	}, 15_000);

	it.each(['ordinary-first', 'blind-first'] as const)(
		'atomically rejects conflicting concurrent %s cross-kind issuance',
		async (order) => {
			const live = await stageLiveAttempt('T3');
			const ordinaryInput = reviewIssueInput(live, 'ordinary', 'reviewer-beta');
			const blindInput = {
				...reviewIssueInput(live, 'blind', 'reviewer-beta'),
				issuerId: 'review-controller-delta'
			};
			const scheduled =
				order === 'ordinary-first' ? [ordinaryInput, blindInput] : [blindInput, ordinaryInput];
			const results = await Promise.allSettled(
				scheduled.map((input) => issueReviewAssignmentExclusive(live.root, input))
			);
			expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
			const rejected = results.filter(
				(result): result is PromiseRejectedResult => result.status === 'rejected'
			);
			expect(rejected).toHaveLength(1);
			expect(String(rejected[0]!.reason)).toMatch(/issuance lock|active issuance/i);

			const ordinaryPath = familyAffinityReviewAssignmentPath('ordinary', live.activeTarget, 1);
			const blindPath = familyAffinityReviewAssignmentPath('blind', live.activeTarget, 1);
			expect(
				await existingReviewAssignmentPaths(live.root, [ordinaryPath, blindPath])
			).toHaveLength(1);
			const missingKind = (await readFile(join(live.root, ordinaryPath)).catch(() => undefined))
				? 'blind'
				: 'ordinary';
			await expect(
				issueReviewAssignmentExclusive(
					live.root,
					missingKind === 'ordinary' ? ordinaryInput : blindInput
				)
			).rejects.toThrow(/independent|cross-kind|separate|reviewer/i);
			expect(
				await existingReviewAssignmentPaths(live.root, [ordinaryPath, blindPath])
			).toHaveLength(1);
			await expect(readFile(join(live.root, reviewIssuanceLockPath(live)))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	);

	it('allows the compatible concurrent loser to retry after the winner releases the lock', async () => {
		const live = await stageLiveAttempt('T3');
		const inputs = [
			reviewIssueInput(live, 'ordinary', 'reviewer-beta'),
			reviewIssueInput(live, 'blind', 'reviewer-gamma')
		] as const;
		const results = await Promise.allSettled(
			inputs.map((input) => issueReviewAssignmentExclusive(live.root, input))
		);
		expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		const failedIndex = results.findIndex(({ status }) => status === 'rejected');
		expect(failedIndex).toBeGreaterThanOrEqual(0);
		expect(String((results[failedIndex] as PromiseRejectedResult).reason)).toMatch(
			/issuance lock|active issuance/i
		);
		await expect(
			issueReviewAssignmentExclusive(live.root, inputs[failedIndex]!)
		).resolves.toBeDefined();
		expect(
			await existingReviewAssignmentPaths(live.root, [
				familyAffinityReviewAssignmentPath('ordinary', live.activeTarget, 1),
				familyAffinityReviewAssignmentPath('blind', live.activeTarget, 1)
			])
		).toHaveLength(2);
		await expect(readFile(join(live.root, reviewIssuanceLockPath(live)))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it.each(['existing-file', 'symlink'] as const)(
		'fails closed on an issuance-lock %s without creating an assignment',
		async (mode) => {
			const live = await stageLiveAttempt('T3');
			const lockPath = reviewIssuanceLockPath(live);
			await mkdir(dirname(join(live.root, lockPath)), { recursive: true });
			if (mode === 'existing-file') {
				await writeFile(join(live.root, lockPath), 'active issuance\n');
			} else {
				const stored = join(live.root, 'stored-review-issuance-lock');
				await writeFile(stored, 'forged lock target\n');
				await symlink(stored, join(live.root, lockPath));
			}
			const assignmentPath = familyAffinityReviewAssignmentPath('ordinary', live.activeTarget, 1);
			await expect(
				issueReviewAssignmentExclusive(
					live.root,
					reviewIssueInput(live, 'ordinary', 'reviewer-beta')
				)
			).rejects.toThrow(/lock|active|collision|exist/i);
			await expect(readFile(join(live.root, assignmentPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	);

	it.each(['lock-create', 'assignment-write', 'lock-release'] as const)(
		'anchors %s mutation against a concurrent external symlink swap',
		async (boundary) => {
			const live = await stageLiveAttempt('T3');
			const external = await mkdtemp(join(tmpdir(), 'family-review-external-'));
			temporaryRoots.push(external);
			const externalSentinel = join(external, 'sentinel.txt');
			await writeFile(externalSentinel, 'external sentinel unchanged\n');
			const lockPath = reviewIssuanceLockPath(live);
			const assignmentPath = familyAffinityReviewAssignmentPath('ordinary', live.activeTarget, 1);
			const visibleParent = join(
				live.root,
				boundary === 'assignment-write' ? dirname(assignmentPath) : dirname(lockPath)
			);
			const anchoredParent = `${visibleParent}.anchored`;
			let seamCalled = false;
			const swap = async () => {
				seamCalled = true;
				await rename(visibleParent, anchoredParent);
				await symlink(external, visibleParent);
			};
			const hooks: IssuanceSwapHooks =
				boundary === 'lock-create'
					? { afterLockParentAnchored: swap }
					: boundary === 'assignment-write'
						? { afterAssignmentParentAnchored: swap }
						: { beforeLockRelease: swap };
			const issuance = issueReviewAssignmentExclusive(
				live.root,
				reviewIssueInput(live, 'ordinary', 'reviewer-beta'),
				hooks
			);
			if (boundary === 'lock-release') {
				await expect(issuance).resolves.toMatchObject({ path: assignmentPath });
				await expect(readFile(join(live.root, assignmentPath))).resolves.toBeDefined();
			} else {
				await expect(issuance).rejects.toThrow(/anchored|changed|symlink|binding|no-follow/i);
				await expect(readFile(join(live.root, assignmentPath))).rejects.toMatchObject({
					code: 'ENOENT'
				});
			}
			expect(seamCalled).toBe(true);
			expect((await lstat(visibleParent)).isSymbolicLink()).toBe(true);
			expect(await readdir(external)).toEqual(['sentinel.txt']);
			expect(await readFile(externalSentinel, 'utf8')).toBe('external sentinel unchanged\n');
			expect(await readdir(anchoredParent)).toEqual([]);
			await expect(
				readFile(join(live.root, familyAffinityReviewAssignmentPath('blind', live.activeTarget, 1)))
			).rejects.toMatchObject({ code: 'ENOENT' });
		},
		20_000
	);

	it.each([
		{
			name: 'one reviewer receiving both roles',
			kind: 'blind' as const,
			reviewerId: 'reviewer-beta',
			issuerId: 'review-controller-delta'
		},
		{
			name: 'ordinary reviewer issuing the blind assignment',
			kind: 'blind' as const,
			reviewerId: 'reviewer-gamma',
			issuerId: 'reviewer-beta'
		},
		{
			name: 'ordinary assignment issuer receiving the blind role',
			kind: 'blind' as const,
			reviewerId: 'review-controller-alpha',
			issuerId: 'review-controller-delta'
		}
	])('rejects $name when ordinary authorization exists first', async (attempt) => {
		const live = await stageLiveAttempt('T3');
		await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'ordinary', 'reviewer-beta')
		);
		const invalidPath = familyAffinityReviewAssignmentPath('blind', live.activeTarget, 1);
		await expect(
			issueReviewAssignmentExclusive(live.root, {
				...reviewIssueInput(live, attempt.kind, attempt.reviewerId),
				issuerId: attempt.issuerId
			})
		).rejects.toThrow(/independent|cross-kind|separate|reviewer/i);
		await expect(readFile(join(live.root, invalidPath))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(readFile(join(live.root, reviewIssuanceLockPath(live)))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it.each([
		{
			name: 'one reviewer receiving both roles',
			kind: 'ordinary' as const,
			reviewerId: 'reviewer-gamma',
			issuerId: 'review-controller-delta'
		},
		{
			name: 'blind reviewer issuing the ordinary assignment',
			kind: 'ordinary' as const,
			reviewerId: 'reviewer-beta',
			issuerId: 'reviewer-gamma'
		},
		{
			name: 'blind assignment issuer receiving the ordinary role',
			kind: 'ordinary' as const,
			reviewerId: 'review-controller-alpha',
			issuerId: 'review-controller-delta'
		}
	])('rejects $name when blind authorization exists first', async (attempt) => {
		const live = await stageLiveAttempt('T3');
		await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'blind', 'reviewer-gamma')
		);
		const invalidPath = familyAffinityReviewAssignmentPath('ordinary', live.activeTarget, 1);
		await expect(
			issueReviewAssignmentExclusive(live.root, {
				...reviewIssueInput(live, attempt.kind, attempt.reviewerId),
				issuerId: attempt.issuerId
			})
		).rejects.toThrow(/independent|cross-kind|separate|reviewer/i);
		await expect(readFile(join(live.root, invalidPath))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(readFile(join(live.root, reviewIssuanceLockPath(live)))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('fails closed before write when opposite-kind authorization is malformed, tampered, or symlinked', async () => {
		for (const mode of ['malformed', 'tampered', 'symlink'] as const) {
			const live = await stageLiveAttempt('T3');
			const ordinary = await issueReviewAssignmentExclusive(
				live.root,
				reviewIssueInput(live, 'ordinary', 'reviewer-beta')
			);
			if (mode === 'malformed') {
				await writeFile(join(live.root, ordinary.path), '{}\n');
			} else if (mode === 'tampered') {
				await writeFile(
					join(live.root, ordinary.path),
					stableFamilyAffinityJson({
						...ordinary.assignment,
						issuerId: 'forged-controller'
					})
				);
			} else {
				const stored = `${ordinary.path}.stored`;
				await writeFile(join(live.root, stored), stableFamilyAffinityJson(ordinary.assignment));
				await rm(join(live.root, ordinary.path));
				await symlink(join(live.root, stored), join(live.root, ordinary.path));
			}
			const invalidPath = familyAffinityReviewAssignmentPath('blind', live.activeTarget, 1);
			await expect(
				issueReviewAssignmentExclusive(live.root, reviewIssueInput(live, 'blind', 'reviewer-gamma'))
			).rejects.toThrow(/symlink|schema|invalid|expected|review/i);
			await expect(readFile(join(live.root, invalidPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	});

	it.each([
		{
			name: 'the same reviewer in ordinary and blind roles',
			kind: 'blind' as const,
			issuerId: 'review-controller-alpha',
			reviewerId: 'reviewer-beta'
		},
		{
			name: 'the ordinary reviewer as blind issuer',
			kind: 'blind' as const,
			issuerId: 'reviewer-beta',
			reviewerId: 'reviewer-gamma'
		},
		{
			name: 'the blind reviewer as ordinary issuer',
			kind: 'ordinary' as const,
			issuerId: 'reviewer-gamma',
			reviewerId: 'reviewer-beta'
		},
		{
			name: 'the producer as blind controller issuer',
			kind: 'blind' as const,
			issuerId: 'producer-alpha',
			reviewerId: 'reviewer-gamma'
		}
	])('aggregation rejects externally placed assignments with $name', async (mutation) => {
		const live = await stageLiveAttempt('T3');
		const ordinary = await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'ordinary', 'reviewer-beta')
		);
		const blind = await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'blind', 'reviewer-gamma')
		);
		const selected = mutation.kind === 'ordinary' ? ordinary : blind;
		const changed = reviewAssignmentWithIdentity(live, selected.assignment, {
			issuerId: mutation.issuerId,
			reviewerId: mutation.reviewerId
		});
		await writeFile(join(live.root, selected.path), stableFamilyAffinityJson(changed));
		await expect(buildFamilyAffinityReviewArtifacts(live.root)).rejects.toThrow(
			/independent|cross-kind|separate|reviewer|unauthorized|cross-bound/i
		);
	});

	it('runs producer result through independent ordinary and T3 blind approval into aggregation', async () => {
		const live = await stageLiveAttempt('T3', true);
		const ordinaryAssignment = await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'ordinary', 'reviewer-beta')
		);
		const blindAssignment = await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'blind', 'reviewer-gamma')
		);
		await createReviewReceiptExclusive(
			live.root,
			ordinaryAssignment.path,
			ordinaryFor(live.activeTarget, live.result)
		);
		await createReviewReceiptExclusive(
			live.root,
			blindAssignment.path,
			blindFor(live.activeTarget, live.result)
		);
		const artifacts = await buildFamilyAffinityReviewArtifacts(live.root);
		const goblins = artifacts.families.find(({ familyId }) => familyId === 'goblins')!;
		expect(
			goblins.summary.cells.find(
				({ coordinateId }) => coordinateId === live.activeTarget.coordinateId
			)
		).toMatchObject({ state: 'approved-review', candidateSha256: live.result.candidateSha256 });
		expect(artifacts.catalog).toMatchObject({
			generatedCount: live.baselineCatalog!.generatedCount + 1,
			approvedReviewCount: live.baselineCatalog!.approvedReviewCount + 1
		});
	}, 15_000);

	it('retains immutable rejected v1 history while deriving current review state only from active v2', async () => {
		const live = await stageLiveAttempt('T1', true);
		const issued = await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'ordinary', 'reviewer-beta')
		);
		await createReviewReceiptExclusive(
			live.root,
			issued.path,
			ordinaryFor(live.activeTarget, live.result, 'rejected')
		);
		const immutablePaths = [
			live.activeTarget.ownedPaths.result,
			issued.path,
			live.activeTarget.ownedPaths.decision
		];
		const before = await Promise.all(immutablePaths.map((path) => readFile(join(live.root, path))));
		await allocateFamilyAffinityRevision({
			repositoryRoot: live.root,
			manifestPath: 'assets/enemies/experiments/family-affinity-v1/manifest.json',
			namespace: 'canonical',
			coordinateId: live.activeTarget.coordinateId,
			callerRole: 'integration-controller',
			reviewPath: live.activeTarget.ownedPaths.decision
		});

		const artifacts = await buildFamilyAffinityReviewArtifacts(live.root);
		const cell = artifacts.families
			.find(({ familyId }) => familyId === 'goblins')!
			.summary.cells.find(({ coordinateId }) => coordinateId === live.activeTarget.coordinateId)!;
		expect(cell).toMatchObject({
			activeVersion: 2,
			state: 'planned',
			label: 'NOT GENERATED',
			historyAttemptCount: 1,
			historyRevisionRequiredCount: 1
		});
		expect(artifacts.catalog).toMatchObject({
			generatedCount: live.baselineCatalog!.generatedCount,
			approvedReviewCount: live.baselineCatalog!.approvedReviewCount,
			historicalAttemptCount: live.baselineCatalog!.historicalAttemptCount + 1,
			historicalRevisionRequiredCount:
				live.baselineCatalog!.historicalRevisionRequiredCount + 1
		});
		await exportFamilyAffinityReview(live.root, 'write');
		await exportFamilyAffinityReview(live.root, 'check');
		await exportFamilyAffinityReview(live.root, 'write');
		const after = await Promise.all(immutablePaths.map((path) => readFile(join(live.root, path))));
		expect(after).toEqual(before);

		const orphanPath = canonicalAttemptPaths('goblins', 'goblin-runt', 'normal', 9).target;
		await mkdir(dirname(join(live.root, orphanPath)), { recursive: true });
		await writeFile(join(live.root, orphanPath), stableFamilyAffinityJson(live.activeTarget));
		await expect(buildFamilyAffinityReviewArtifacts(live.root)).rejects.toThrow(/orphan|unbound/i);
		await rm(join(live.root, orphanPath));
		const orphanResult = canonicalAttemptPaths('goblins', 'goblin-runt', 'normal', 9).result;
		await mkdir(dirname(join(live.root, orphanResult)), { recursive: true });
		await writeFile(join(live.root, orphanResult), stableFamilyAffinityJson(live.result));
		await expect(buildFamilyAffinityReviewArtifacts(live.root)).rejects.toThrow(/orphan|unbound/i);
	}, 30_000);

	it('binds resultSha256 to raw result bytes, including otherwise harmless whitespace', async () => {
		const live = await stageLiveAttempt();
		const reviewAssignment = await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'ordinary', 'reviewer-beta')
		);
		await writeFile(
			join(live.root, live.activeTarget.ownedPaths.result),
			`${stableFamilyAffinityJson(live.result)}\n`
		);
		await expect(
			createReviewReceiptExclusive(
				live.root,
				reviewAssignment.path,
				ordinaryFor(live.activeTarget, live.result)
			)
		).rejects.toThrow(/stale|cross-bound/i);
	});

	it('rejects echoed source or prompt hashes that disagree with authoritative artifacts', async () => {
		for (const field of ['sourceSha256', 'promptSha256'] as const) {
			const live = await stageLiveAttempt();
			await writeFile(
				join(live.root, live.activeTarget.ownedPaths.result),
				stableFamilyAffinityJson({ ...live.result, [field]: sha('0') })
			);
			await expect(
				issueReviewAssignmentExclusive(
					live.root,
					reviewIssueInput(live, 'ordinary', 'reviewer-beta')
				)
			).rejects.toThrow(/stale|forged|cross-bound/i);
		}
	});

	it('parses and cross-binds any supplied blind receipt before ordinary-review early returns', () => {
		const t1 = target('T1');
		const t1Bytes = Buffer.from('candidate-T1');
		const t1Result = resultFor(t1, t1Bytes);
		expect(() =>
			evaluateFamilyAffinityReviewAttempt({
				target: t1,
				assignment: assignmentFor(t1),
				familyPacketBytes: packetBytesFor(t1),
				candidateBytes: t1Bytes,
				resultBytes: Buffer.from(stableFamilyAffinityJson(t1Result)),
				blind: blindFor(t1, t1Result)
			})
		).toThrow(/T3\/T5/i);

		const t3 = target('T3');
		const t3Bytes = Buffer.from('candidate-T3');
		const t3Result = resultFor(t3, t3Bytes);
		expect(() =>
			evaluateFamilyAffinityReviewAttempt({
				target: t3,
				assignment: assignmentFor(t3),
				familyPacketBytes: packetBytesFor(t3),
				candidateBytes: t3Bytes,
				resultBytes: Buffer.from(stableFamilyAffinityJson(t3Result)),
				blind: { ...blindFor(t3, t3Result), candidateSha256: sha('0') }
			})
		).toThrow(/stale|forged|cross-bound/i);
	});

	it.each(['manifest', 'packet', 'target', 'assignment', 'candidate', 'result'] as const)(
		'fails closed when the live %s artifact is symlinked',
		async (kind) => {
			const live = await stageLiveAttempt();
			const ownedPath =
				kind === 'manifest'
					? 'assets/enemies/experiments/family-affinity-v1/manifest.json'
					: kind === 'packet'
						? live.activeTarget.sources.familyPacketPath
						: kind === 'target'
							? live.paths.target
							: kind === 'assignment'
								? live.paths.assignment
								: live.activeTarget.ownedPaths[kind];
			const absolute = join(live.root, ownedPath);
			const external = join(live.root, `outside-${kind}`);
			await writeFile(external, await readFile(absolute));
			await rm(absolute);
			await symlink(external, absolute);
			await expect(
				issueReviewAssignmentExclusive(
					live.root,
					reviewIssueInput(live, 'ordinary', 'reviewer-beta')
				)
			).rejects.toThrow(/symlink/i);
		}
	);

	it('fails closed on symlinked controller assignments and immutable receipt collisions', async () => {
		const live = await stageLiveAttempt();
		const issued = await issueReviewAssignmentExclusive(
			live.root,
			reviewIssueInput(live, 'ordinary', 'reviewer-beta')
		);
		const assignmentAbsolute = join(live.root, issued.path);
		const external = join(live.root, 'outside-review-assignment.json');
		await writeFile(external, await readFile(assignmentAbsolute));
		await rm(assignmentAbsolute);
		await symlink(external, assignmentAbsolute);
		await expect(
			createReviewReceiptExclusive(
				live.root,
				issued.path,
				ordinaryFor(live.activeTarget, live.result)
			)
		).rejects.toThrow(/symlink/i);

		const collision = await stageLiveAttempt();
		const collisionAssignment = await issueReviewAssignmentExclusive(
			collision.root,
			reviewIssueInput(collision, 'ordinary', 'reviewer-beta')
		);
		const receipt = ordinaryFor(collision.activeTarget, collision.result);
		await createReviewReceiptExclusive(collision.root, collisionAssignment.path, receipt);
		await expect(
			createReviewReceiptExclusive(collision.root, collisionAssignment.path, receipt)
		).rejects.toThrow(/EEXIST|exist/i);
		const receiptAbsolute = join(collision.root, collision.activeTarget.ownedPaths.decision);
		const receiptExternal = join(collision.root, 'outside-review-receipt.json');
		await writeFile(receiptExternal, await readFile(receiptAbsolute));
		await rm(receiptAbsolute);
		await symlink(receiptExternal, receiptAbsolute);
		await expect(buildFamilyAffinityReviewArtifacts(collision.root)).rejects.toThrow(/symlink/i);
	});
});

describe('initial family review evidence', () => {
	it('builds thirty deterministic 5x5 sheets with truthful live counts', async () => {
		const first = await buildFamilyAffinityReviewArtifacts(process.cwd());
		const second = await buildFamilyAffinityReviewArtifacts(process.cwd());
		expect(first.catalog).toMatchObject({
			schemaVersion: 'family-affinity-review-catalog-v1',
			familyCount: 30,
			coordinateCount: 750,
			runtimeCount: 0
		});
		expect(first.families).toHaveLength(30);
		expect(
			first.families.every(
				({ summary }) => summary.notGeneratedCount + summary.generatedCount === 25
			)
		).toBe(true);
		expect(first.families.every(({ summary }) => summary.cells.length === 25)).toBe(true);
		expect(
			first.families.every(
				({ summary }) =>
					summary.cells.filter((cell) => cell.label === 'NOT GENERATED').length ===
					summary.notGeneratedCount
			)
		).toBe(true);
		expect(first.catalog.generatedCount).toBe(
			first.families.reduce((count, { summary }) => count + summary.generatedCount, 0)
		);
		expect(first.catalog.approvedReviewCount).toBe(
			first.families.reduce((count, { summary }) => count + summary.approvedReviewCount, 0)
		);
		expect(first.digest).toBe(second.digest);
		for (let index = 0; index < first.families.length; index += 1) {
			expect(first.families[index]!.contactSheet.equals(second.families[index]!.contactSheet)).toBe(
				true
			);
			expect(await sharp(first.families[index]!.contactSheet).metadata()).toMatchObject({
				format: 'png',
				width: 1600,
				height: 1200
			});
		}
	}, 15_000);

	it('fails closed when an owned candidate path traverses a symlinked directory', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-review-corpus-'));
		temporaryRoots.push(root);
		const source = join(process.cwd(), 'assets/enemies/experiments/family-affinity-v1');
		const destination = join(root, 'assets/enemies/experiments/family-affinity-v1');
		await cp(source, destination, {
			recursive: true,
			filter: (path) => !path.includes(`${join(source, 'review')}`)
		});
		await stripBridgeFixture(root);
		const external = join(root, 'outside');
		await mkdir(join(destination, 'candidates'), { recursive: true });
		await mkdir(external);
		await symlink(external, join(destination, 'candidates/goblins'));
		await expect(buildFamilyAffinityReviewArtifacts(root)).rejects.toThrow(/symlink/i);
	});

	it('fails closed on malformed or extraneous files inside review-owned paths', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-review-corpus-'));
		temporaryRoots.push(root);
		const source = join(process.cwd(), 'assets/enemies/experiments/family-affinity-v1');
		const destination = join(root, 'assets/enemies/experiments/family-affinity-v1');
		await cp(source, destination, {
			recursive: true,
			filter: (path) => !path.includes(`${join(source, 'review')}`)
		});
		await stripBridgeFixture(root);
		await mkdir(join(destination, 'review/decisions'), { recursive: true });
		await writeFile(join(destination, 'review/decisions/not-a-receipt.json'), '{}');
		await expect(buildFamilyAffinityReviewArtifacts(root)).rejects.toThrow(/extraneous/i);
	});

	it('reports provisional Earth bridge candidates separately from the canonical 750', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-review-bridge-'));
		temporaryRoots.push(root);
		const source = join(process.cwd(), 'assets/enemies/experiments/family-affinity-v1');
		const destination = join(root, 'assets/enemies/experiments/family-affinity-v1');
		await cp(source, destination, { recursive: true });
		await stripBridgeFixture(root);
		const canonicalBaseline = (await buildFamilyAffinityReviewArtifacts(root)).catalog;
		const canonicalPaths = canonicalAttemptPaths('goblins', 'goblin-runt', 'earth', 1);
		const canonicalTarget = FamilyAffinityTargetSchema.parse(
			JSON.parse(await readFile(join(root, canonicalPaths.target), 'utf8'))
		);
		const canonicalAssignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(await readFile(join(root, canonicalPaths.assignment), 'utf8'))
		);
		const bridgePaths = bridgeAttemptPaths('legacy-goblin', 'earth', 1);
		const coordinateId = 'legacy-goblin/goblins/goblin-runt/earth';
		const bridgeTarget = FamilyAffinityTargetSchema.parse({
			...canonicalTarget,
			namespace: 'bridge',
			canonicalCoordinateId: canonicalTarget.coordinateId,
			coordinateId,
			targetId: `bridge/${coordinateId}/v1`,
			currentClassId: 'legacy-goblin',
			ownedPaths: {
				candidate: bridgePaths.candidate,
				result: bridgePaths.result,
				decision: bridgePaths.decision,
				blindReview: bridgePaths.blindReview
			},
			anchor: {
				kind: 'earth-bridge-provisional',
				normalCandidatePath: canonicalAttemptPaths('goblins', 'goblin-runt', 'normal', 1).candidate,
				normalCandidateSha256: sha('a')
			},
			status: 'earth-bridge-provisional'
		});
		const bridgeAssignment = FamilyAffinityAssignmentSchema.parse({
			...canonicalAssignment,
			assignmentId: `${bridgeTarget.targetId}/assignment`,
			targetId: bridgeTarget.targetId,
			targetSha256: familyAffinitySha256(bridgeTarget),
			coordinateId,
			namespace: 'bridge',
			allowedOutputs: {
				candidate: bridgePaths.candidate,
				result: bridgePaths.result
			},
			dispatchStatus: 'earth-bridge-provisional'
		});
		const manifestPath = 'assets/enemies/experiments/family-affinity-v1/manifest.json';
		const manifest = FamilyAffinityManifestSchema.parse(
			JSON.parse(await readFile(join(root, manifestPath), 'utf8'))
		);
		manifest.bridge = {
			targetCount: 1,
			assignmentCount: 1,
			activeCoordinates: [
				{
					namespace: 'bridge',
					coordinateId,
					familyId: bridgeTarget.familyId,
					formId: bridgeTarget.formId,
					currentClassId: 'legacy-goblin',
					affinity: 'earth',
					activeVersion: 1,
					targetPath: bridgePaths.target,
					targetSha256: familyAffinitySha256(bridgeTarget),
					assignmentPath: bridgePaths.assignment,
					assignmentSha256: familyAffinitySha256(bridgeAssignment),
					status: 'earth-bridge-provisional'
				}
			]
		};
		const candidateBytes = await sharp({
			create: { width: 8, height: 8, channels: 3, background: '#745a38' }
		})
			.png({ compressionLevel: 9, adaptiveFiltering: false })
			.toBuffer();
		const result = FamilyAffinityCandidateResultSchema.parse({
			schemaVersion: 'family-affinity-result-v1',
			targetId: bridgeTarget.targetId,
			targetSha256: familyAffinitySha256(bridgeTarget),
			coordinateId,
			candidateVersion: 1,
			producerId: 'producer-alpha',
			candidatePath: bridgePaths.candidate,
			candidateSha256: familyAffinityRawSha256(candidateBytes),
			resultPath: bridgePaths.result,
			sourcePath: bridgeTarget.sources.familyPacketPath,
			sourceSha256: bridgeTarget.sources.familyPacketSha256,
			promptSha256: familyAffinityPromptSha256(bridgeTarget, bridgeAssignment),
			state: 'candidate-only',
			runtimeCatalogMutationForbidden: true
		});
		for (const [path, value] of [
			[bridgePaths.target, stableFamilyAffinityJson(bridgeTarget)],
			[bridgePaths.assignment, stableFamilyAffinityJson(bridgeAssignment)],
			[bridgePaths.candidate, candidateBytes],
			[bridgePaths.result, stableFamilyAffinityJson(result)],
			[manifestPath, stableFamilyAffinityJson(manifest)]
		] as const) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), value);
		}
		const artifacts = await buildFamilyAffinityReviewArtifacts(root);
		expect(artifacts.catalog).toMatchObject({
			coordinateCount: 750,
			generatedCount: canonicalBaseline.generatedCount,
			approvedReviewCount: canonicalBaseline.approvedReviewCount,
			bridgeCoordinateCount: 1,
			bridgeGeneratedCount: 1,
			bridgeApprovedReviewCount: 0
		});
		const issued = await issueReviewAssignmentExclusive(root, {
			callerRole: 'controller',
			issuerId: 'review-controller-alpha',
			kind: 'ordinary',
			reviewerId: 'reviewer-beta',
			targetPath: bridgePaths.target,
			productionAssignmentPath: bridgePaths.assignment,
			decisionVersion: 1
		});
		await createReviewReceiptExclusive(
			root,
			issued.path,
			ordinaryFor(bridgeTarget, result, 'revise')
		);
		const historyPaths = [bridgePaths.result, issued.path, bridgePaths.decision];
		const before = await Promise.all(historyPaths.map((path) => readFile(join(root, path))));
		await allocateFamilyAffinityRevision({
			repositoryRoot: root,
			manifestPath,
			namespace: 'bridge',
			coordinateId,
			callerRole: 'integration-controller',
			reviewPath: bridgePaths.decision
		});
		const afterRevision = await buildFamilyAffinityReviewArtifacts(root);
		expect(afterRevision.catalog).toMatchObject({
			coordinateCount: 750,
			generatedCount: canonicalBaseline.generatedCount,
			approvedReviewCount: canonicalBaseline.approvedReviewCount,
			bridgeCoordinateCount: 1,
			bridgeGeneratedCount: 0,
			bridgeApprovedReviewCount: 0,
			historicalAttemptCount: 1,
			historicalRevisionRequiredCount: 1
		});
		expect(await Promise.all(historyPaths.map((path) => readFile(join(root, path))))).toEqual(
			before
		);
	}, 30_000);

	it('tracks planned no-candidate bridge controls without changing canonical review totals', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-review-planned-bridge-'));
		temporaryRoots.push(root);
		const source = join(process.cwd(), 'assets/enemies/experiments/family-affinity-v1');
		const destination = join(root, 'assets/enemies/experiments/family-affinity-v1');
		await cp(source, destination, { recursive: true });
		const bridgeCoordinateCount = await retainOnlyPlannedBridgeControls(root);

		const materialized = await buildFamilyAffinityReviewArtifacts(root);
		expect(materialized.catalog).toMatchObject({
			coordinateCount: 750,
			bridgeCoordinateCount,
			bridgeGeneratedCount: 0,
			bridgeApprovedReviewCount: 0,
			runtimeCount: 0
		});

		const manifestPath = join(destination, 'manifest.json');
		const manifest = FamilyAffinityManifestSchema.parse(
			JSON.parse(await readFile(manifestPath, 'utf8'))
		);
		manifest.bridge = { targetCount: 0, assignmentCount: 0, activeCoordinates: [] };
		await writeFile(manifestPath, stableFamilyAffinityJson(manifest));
		await rm(join(destination, 'bridge'), { recursive: true, force: true });

		const removed = await buildFamilyAffinityReviewArtifacts(root);
		expect(removed.catalog).toMatchObject({
			coordinateCount: 750,
			generatedCount: materialized.catalog.generatedCount,
			approvedReviewCount: materialized.catalog.approvedReviewCount,
			bridgeCoordinateCount: 0,
			bridgeGeneratedCount: 0,
			bridgeApprovedReviewCount: 0,
			runtimeCount: 0
		});
	}, 30_000);
});

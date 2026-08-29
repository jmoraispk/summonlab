/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	ImageProductionCatalogSchema,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { sha256Json } from './image-production-lib.js';
import {
	FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
	activateFinalControlledRerun,
	verifyFinalControlledActivationReceipt
} from './activate-final-controlled-rerun.js';
import {
	buildFinalControlledRerunBundle,
	type FinalControlledRerunPlan
} from './prepare-final-controlled-rerun.js';
import type {
	ActivationReadinessInput,
	StagedVerification
} from './report-final-controlled-activation-readiness.js';

const SOURCE_ROOT = path.resolve('assets/enemies/experiments/affinity-workflow-v1');
const temporaryRoots: string[] = [];
const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, 'utf8'));

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function authorizedInput(): Promise<ActivationReadinessInput> {
	const plan = (await readJson(
		path.join(SOURCE_ROOT, 'review/final-controlled-rerun-plan.json')
	)) as FinalControlledRerunPlan;
	const catalog = ImageProductionCatalogSchema.parse(
		await readJson(path.join(SOURCE_ROOT, 'review/catalog.json'))
	);
	const originalTargets = (await Promise.all(
		plan.targets.map((target) =>
			readJson(path.join(SOURCE_ROOT, `targets/${target.speciesId}/${target.affinity}.json`))
		)
	)) as ImageProductionTarget[];
	const entries = catalog.entries.filter((entry) =>
		originalTargets.some((target) => target.targetId === entry.targetId)
	);
	const results = (await Promise.all(
		entries.map((entry) => {
			const target = originalTargets.find((item) => item.targetId === entry.targetId)!;
			return readJson(path.resolve(target.output.resultPath));
		})
	)) as any[];
	const candidateIds = results
		.filter((result) => result.status === 'candidate')
		.map((result) => result.targetId)
		.toSorted();
	const reviews = {
		schemaVersion: 'image-production-blind-reviews-v1',
		experimentId: 'affinity-workflow-v1',
		updatedAt: '2026-08-29T20:00:00.000Z',
		reviews: candidateIds.map((targetId, index) => {
			const target = originalTargets.find((item) => item.targetId === targetId)!;
			const entry = catalog.entries.find((item) => item.targetId === targetId)!;
			return {
				reviewId: `00000000-0000-4000-8${String(index).padStart(3, '0')}-000000000000`,
				targetId,
				candidateContentHash: entry.candidateHash,
				reviewer: 'Human reviewer',
				reviewMode: 'blind',
				reviewedAt: '2026-08-29T20:00:00.000Z',
				identifiedSpeciesId: target.speciesId,
				identifiedAffinity: target.affinity,
				speciesCorrect: true,
				affinityCorrect: true,
				scores: {
					speciesIdentity: 5,
					affinityReadability: 5,
					silhouetteAndDuty: 5,
					materialCredibility: 5,
					anatomyAndGroundContact: 5,
					affinityIntegration: 5,
					styleCohesion: 5
				},
				verdict: 'candidate',
				note: 'Human blind assessment.'
			};
		})
	};
	const bundle = buildFinalControlledRerunBundle(plan);
	const staged: Record<string, StagedVerification> = {};
	const resolutions = plan.designRiskReview.risks.map((risk) => {
		const expected = bundle.targets.find((target) => target.targetId.endsWith(risk.coordinate))!;
		const original = originalTargets.find(
			(target) => target.speciesId === expected.speciesId && target.affinity === expected.affinity
		)!;
		const originalResult = results.find((result) => result.targetId === original.targetId)!;
		const review = reviews.reviews.find((item) => item.targetId === original.targetId);
		let stagedTarget = null;
		if (risk.severity === 'blocking') {
			const target = {
				...expected,
				presentation: {
					...expected.presentation,
					composition: `${expected.presentation.composition} Human-reviewed correction for ${risk.riskId}.`
				}
			};
			const stagePath = `assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/${target.speciesId}/${target.affinity}-${risk.coordinate.match(/v\d+$/u)![0]}.json`;
			const exactPrompt = `canonical prompt for ${risk.riskId}`;
			staged[stagePath] = {
				target,
				exactPrompt,
				referenceHashes: Object.fromEntries(
					target.references.map((reference) => [reference.path, reference.contentHash])
				)
			};
			stagedTarget = {
				path: stagePath,
				canonicalHash: sha256Json(target),
				promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
				promptByteLength: Buffer.byteLength(exactPrompt)
			};
		}
		return {
			riskId: risk.riskId,
			coordinate: risk.coordinate,
			sourceTargetId: risk.sourceTargetId,
			severity: risk.severity,
			status: 'resolved',
			decision: risk.severity === 'blocking' ? 'replace-derived-target' : 'retain',
			humanRationale: 'Human reviewed the blind evidence and selected this resolution.',
			blindReviewEvidence: review ? [{ id: review.reviewId, contentHash: sha256Json(review) }] : [],
			reviseResultEvidence:
				originalResult.status === 'revise'
					? [
							{
								id: originalResult.resultId,
								contentHash: sha256Json(originalResult)
							}
						]
					: [],
			stagedTarget
		};
	});
	const snapshot = originalTargets
		.map((target) => {
			const result = results.find((item) => item.targetId === target.targetId);
			return {
				targetId: target.targetId,
				targetHash: sha256Json(target),
				resultId: result?.resultId ?? null,
				resultHash: result ? sha256Json(result) : null,
				status: result?.status ?? null
			};
		})
		.toSorted((left, right) => left.targetId.localeCompare(right.targetId));
	return {
		plan,
		blindReviews: reviews,
		catalog,
		originalTargets,
		results,
		resolutions: {
			schemaVersion: 'affinity-final-controlled-design-risk-resolutions-v1',
			experimentId: 'affinity-workflow-v1',
			planContentHash: sha256Json(plan),
			blindReviewCollectionHash: sha256Json(reviews),
			catalogContentHash: sha256Json(catalog),
			executionSnapshotHash: sha256Json(snapshot),
			eligibleOriginalControlledTargetIds: candidateIds,
			reviseResults: results
				.filter((result) => result.status === 'revise')
				.map((result) => ({
					id: result.resultId,
					targetId: result.targetId,
					contentHash: sha256Json(result)
				}))
				.toSorted((left, right) => left.targetId.localeCompare(right.targetId)),
			resolutions
		},
		staged,
		currentWorkspaceValid: true,
		plannedPathsAbsent: true
	};
}

async function workspace(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-final-activation-'));
	temporaryRoots.push(root);
	return root;
}

describe('guarded final-controlled activation', () => {
	it('writes staged overlays and regenerated assignments, commits receipt last, and is idempotent', async () => {
		const root = await workspace();
		const input = await authorizedInput();
		const loadInput = async () => input;
		const first = await activateFinalControlledRerun({
			workspaceRoot: root,
			acknowledgeLiveManifestActivation: true,
			loadInput,
			now: () => '2026-08-29T21:00:00.000Z'
		});
		expect(first.status).toBe('activated');
		expect(first.receipt.artifacts).toHaveLength(48);
		expect(first.receipt.artifacts.filter((artifact) => artifact.source === 'staged')).toHaveLength(
			8
		);
		const verification = await verifyFinalControlledActivationReceipt(root);
		expect(verification.valid, verification.issues.join('\n')).toBe(true);
		const second = await activateFinalControlledRerun({
			workspaceRoot: root,
			acknowledgeLiveManifestActivation: true,
			loadInput
		});
		expect(second.status).toBe('already-activated');
	});

	it('performs zero writes when authorization is false', async () => {
		const root = await workspace();
		const input = { ...(await authorizedInput()), currentWorkspaceValid: false };
		await expect(
			activateFinalControlledRerun({
				workspaceRoot: root,
				acknowledgeLiveManifestActivation: true,
				loadInput: async () => input
			})
		).rejects.toThrow('unauthorized');
		await expect(lstat(path.join(root, 'assets'))).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rolls back only transaction-owned files after an interrupted publish', async () => {
		const root = await workspace();
		const input = await authorizedInput();
		await expect(
			activateFinalControlledRerun({
				workspaceRoot: root,
				acknowledgeLiveManifestActivation: true,
				loadInput: async () => input,
				failAfterPublished: 5
			})
		).rejects.toThrow('Injected activation failure');
		const bundle = buildFinalControlledRerunBundle(input.plan);
		for (const repositoryPath of bundle.plannedPaths)
			await expect(lstat(path.resolve(root, repositoryPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		await expect(
			lstat(path.resolve(root, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('refuses collisions without overwriting them', async () => {
		const root = await workspace();
		const input = await authorizedInput();
		const firstPath = buildFinalControlledRerunBundle(input.plan).artifacts[0]!.livePath;
		await mkdir(path.dirname(path.resolve(root, firstPath)), { recursive: true });
		await writeFile(path.resolve(root, firstPath), 'user-owned');
		await expect(
			activateFinalControlledRerun({
				workspaceRoot: root,
				acknowledgeLiveManifestActivation: true,
				loadInput: async () => input
			})
		).rejects.toThrow('already exists');
		expect(await readFile(path.resolve(root, firstPath), 'utf8')).toBe('user-owned');
	});

	it('refuses symlinked destination ancestors', async () => {
		const root = await workspace();
		const outside = await workspace();
		await mkdir(path.join(root, 'assets'));
		await symlink(outside, path.join(root, 'assets/enemies'));
		const input = await authorizedInput();
		await expect(
			activateFinalControlledRerun({
				workspaceRoot: root,
				acknowledgeLiveManifestActivation: true,
				loadInput: async () => input
			})
		).rejects.toThrow('Unsafe destination ancestor');
	});

	it('refuses idempotence when a receipt-bound manifest has drifted', async () => {
		const root = await workspace();
		const input = await authorizedInput();
		const activated = await activateFinalControlledRerun({
			workspaceRoot: root,
			acknowledgeLiveManifestActivation: true,
			loadInput: async () => input
		});
		const artifact = activated.receipt.artifacts[0]!;
		await writeFile(path.resolve(root, artifact.livePath), '{}');
		await expect(
			activateFinalControlledRerun({
				workspaceRoot: root,
				acknowledgeLiveManifestActivation: true,
				loadInput: async () => input
			})
		).rejects.toThrow('Existing activation receipt is invalid');
	});

	it('refuses idempotence when the receipt-bound plan has drifted', async () => {
		const root = await workspace();
		const input = await authorizedInput();
		await activateFinalControlledRerun({
			workspaceRoot: root,
			acknowledgeLiveManifestActivation: true,
			loadInput: async () => input
		});
		const drifted = structuredClone(input) as any;
		drifted.plan.purpose = `${drifted.plan.purpose} Drifted after activation.`;
		await expect(
			activateFinalControlledRerun({
				workspaceRoot: root,
				acknowledgeLiveManifestActivation: true,
				loadInput: async () => drifted
			})
		).rejects.toThrow('different final-controlled plan');
	});
});

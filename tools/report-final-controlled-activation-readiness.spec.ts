/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	ImageProductionCatalogSchema,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { canonicalJson, sha256Json } from './image-production-lib.js';
import {
	buildFinalControlledRerunBundle,
	type FinalControlledRerunPlan
} from './prepare-final-controlled-rerun.js';
import {
	FinalControlledDesignRiskResolutionCollectionSchema,
	buildFinalControlledActivationReadiness,
	loadStagedVerification,
	repositoryPathIsAbsent,
	type ActivationReadinessInput,
	type StagedVerification
} from './report-final-controlled-activation-readiness.js';

const ROOT = path.resolve('assets/enemies/experiments/affinity-workflow-v1');
const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, 'utf8'));

async function fixture(): Promise<ActivationReadinessInput> {
	const plan = (await readJson(
		path.join(ROOT, 'review/final-controlled-rerun-plan.json')
	)) as FinalControlledRerunPlan;
	const catalog = ImageProductionCatalogSchema.parse(
		await readJson(path.join(ROOT, 'review/catalog.json'))
	);
	const originalTargets = (await Promise.all(
		plan.targets.map((t) => readJson(path.join(ROOT, `targets/${t.speciesId}/${t.affinity}.json`)))
	)) as ImageProductionTarget[];
	const entries = catalog.entries.filter((e) =>
		originalTargets.some((t) => t.targetId === e.targetId)
	);
	const results = (await Promise.all(
		entries.map((e) =>
			readJson(
				path.resolve(originalTargets.find((t) => t.targetId === e.targetId)!.output.resultPath)
			)
		)
	)) as any[];
	const candidateIds = results
		.filter((r) => r.status === 'candidate')
		.map((r) => r.targetId)
		.toSorted();
	const reviews = {
		schemaVersion: 'image-production-blind-reviews-v1',
		experimentId: 'affinity-workflow-v1',
		updatedAt: '2026-08-29T20:00:00.000Z',
		reviews: candidateIds.map((targetId, index) => {
			const target = originalTargets.find((t) => t.targetId === targetId)!;
			const entry = catalog.entries.find((e) => e.targetId === targetId)!;
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
		const expected = bundle.targets.find((t) => t.targetId.endsWith(risk.coordinate))!;
		const original = originalTargets.find(
			(target) => target.speciesId === expected.speciesId && target.affinity === expected.affinity
		)!;
		const originalResult = results.find((result) => result.targetId === original.targetId)!;
		const review = reviews.reviews.find((candidate) => candidate.targetId === original.targetId);
		let stagedTarget = null;
		if (risk.severity === 'blocking') {
			const target = {
				...expected,
				presentation: {
					...expected.presentation,
					composition: `${expected.presentation.composition} Human-reviewed correction for ${risk.riskId}.`
				}
			};
			const stagePath = `assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/${target.speciesId}/${target.affinity}-${risk.coordinate.match(/v\d+$/)![0]}.json`;
			const exactPrompt = `canonical prompt for ${risk.riskId}`;
			staged[stagePath] = {
				target,
				exactPrompt,
				referenceHashes: Object.fromEntries(
					target.references.map((ref) => [ref.path, ref.contentHash])
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
					? [{ id: originalResult.resultId, contentHash: sha256Json(originalResult) }]
					: [],
			stagedTarget
		};
	});
	const snapshot = originalTargets
		.map((target) => {
			const result = results.find((r) => r.targetId === target.targetId);
			return {
				targetId: target.targetId,
				targetHash: sha256Json(target),
				resultId: result?.resultId ?? null,
				resultHash: result ? sha256Json(result) : null,
				status: result?.status ?? null
			};
		})
		.toSorted((a, b) => a.targetId.localeCompare(b.targetId));
	const ledger = {
		schemaVersion: 'affinity-final-controlled-design-risk-resolutions-v1',
		experimentId: 'affinity-workflow-v1',
		planContentHash: sha256Json(plan),
		blindReviewCollectionHash: sha256Json(reviews),
		catalogContentHash: sha256Json(catalog),
		executionSnapshotHash: sha256Json(snapshot),
		eligibleOriginalControlledTargetIds: candidateIds,
		reviseResults: results
			.filter((r) => r.status === 'revise')
			.map((r) => ({ id: r.resultId, targetId: r.targetId, contentHash: sha256Json(r) }))
			.toSorted((a, b) => a.targetId.localeCompare(b.targetId)),
		resolutions
	};
	return {
		plan,
		blindReviews: reviews,
		catalog,
		originalTargets,
		results,
		resolutions: ledger,
		staged,
		currentWorkspaceValid: true,
		plannedPathsAbsent: true
	};
}

describe('final controlled activation readiness', () => {
	it('authorizes only a complete, canonically bound synthetic fixture', async () => {
		const input = await fixture();
		expect(
			FinalControlledDesignRiskResolutionCollectionSchema.parse(input.resolutions)
		).toBeTruthy();
		const report = buildFinalControlledActivationReadiness(input);
		expect(report.authorized, JSON.stringify(report.blockers)).toBe(true);
		expect(report.counts).toMatchObject({
			eligibleCandidates: 21,
			eligibleBlindReviews: 21,
			reviseResults: 3,
			risks: 16,
			resolvedRisks: 16
		});
	});
	it('does not let rationale or revise evidence replace a blind acceptance', async () => {
		const input = await fixture();
		const blindReviews = structuredClone(input.blindReviews as any);
		blindReviews.reviews.pop();
		const resolutions = structuredClone(input.resolutions as any);
		resolutions.blindReviewCollectionHash = sha256Json(blindReviews);
		resolutions.resolutions[0].humanRationale += ' Revise evidence considered.';
		resolutions.resolutions[0].reviseResultEvidence = [resolutions.reviseResults[0]];
		const report = buildFinalControlledActivationReadiness({ ...input, blindReviews, resolutions });
		expect(report.authorized).toBe(false);
		expect(report.blockers.map((b) => b.code)).toContain('blind-review-incomplete');
	});
	it('rejects stale risk bindings and an unchanged risky staged target', async () => {
		const input = await fixture();
		const resolutions = structuredClone(input.resolutions as any);
		resolutions.resolutions[0].sourceTargetId = 'obsolete-source';
		let report = buildFinalControlledActivationReadiness({ ...input, resolutions });
		expect(report.blockers.map((b) => b.code)).toContain('risk-binding-mismatch');
		const clean = await fixture();
		const risk = (clean.plan as FinalControlledRerunPlan).designRiskReview.risks.find(
			(r) => r.severity === 'blocking'
		)!;
		const planned = buildFinalControlledRerunBundle(clean.plan).targets.find((t) =>
			t.targetId.endsWith(risk.coordinate)
		)!;
		const ledger = structuredClone(clean.resolutions as any);
		const resolution = ledger.resolutions.find((r: any) => r.riskId === risk.riskId);
		resolution.stagedTarget.canonicalHash = sha256Json(planned);
		(clean.staged as any)[resolution.stagedTarget.path].target = planned;
		report = buildFinalControlledActivationReadiness({ ...clean, resolutions: ledger });
		expect(report.blockers.map((b) => b.code)).toContain('staged-target-verification-failed');
	});
	it('requires risk evidence from the same original species-affinity coordinate', async () => {
		const input = await fixture();
		const resolutions = structuredClone(input.resolutions as any);
		const candidateResolution = resolutions.resolutions.find(
			(resolution: any) => resolution.blindReviewEvidence.length > 0
		);
		const otherReview = resolutions.resolutions.find(
			(resolution: any) =>
				resolution.riskId !== candidateResolution.riskId &&
				resolution.blindReviewEvidence.length > 0
		).blindReviewEvidence[0];
		candidateResolution.blindReviewEvidence = [otherReview];
		let report = buildFinalControlledActivationReadiness({ ...input, resolutions });
		expect(report.blockers.map((blocker) => blocker.code)).toContain(
			'missing-coordinate-review-evidence'
		);

		const reviseInput = await fixture();
		const reviseLedger = structuredClone(reviseInput.resolutions as any);
		const reviseResolution = reviseLedger.resolutions.find(
			(resolution: any) => resolution.reviseResultEvidence.length > 0
		);
		reviseResolution.reviseResultEvidence = [];
		report = buildFinalControlledActivationReadiness({
			...reviseInput,
			resolutions: reviseLedger
		});
		expect(report.blockers.map((blocker) => blocker.code)).toContain(
			'missing-coordinate-revise-evidence'
		);
	});
	it('rejects nonblind review payloads and stale canonical hashes', async () => {
		const input = await fixture();
		const reviews = structuredClone(input.blindReviews as any);
		reviews.reviews[0].reviewMode = 'api-unverified';
		let report = buildFinalControlledActivationReadiness({ ...input, blindReviews: reviews });
		expect(report.blockers[0]?.code).toBe('invalid-input');
		const resolutions = structuredClone(input.resolutions as any);
		resolutions.planContentHash = 'f'.repeat(64);
		report = buildFinalControlledActivationReadiness({ ...input, resolutions });
		expect(report.blockers.map((b) => b.code)).toContain('stale-binding');
	});
	it('rejects staged protocol, reference, and canonical-prompt tampering', async () => {
		for (const tamper of ['protocol', 'reference', 'prompt'] as const) {
			const input = await fixture();
			const ledger = structuredClone(input.resolutions as any);
			const resolution = ledger.resolutions.find((entry: any) => entry.stagedTarget);
			const verification = (input.staged as any)[resolution.stagedTarget.path];
			if (tamper === 'protocol') verification.target.promptProtocol = 'safe-frame-v3';
			if (tamper === 'reference')
				verification.referenceHashes[verification.target.references[0].path] = '0'.repeat(64);
			if (tamper === 'prompt') verification.exactPrompt += ' tampered';
			const report = buildFinalControlledActivationReadiness({ ...input, resolutions: ledger });
			expect(report.blockers.map((blocker) => blocker.code)).toContain(
				'staged-target-verification-failed'
			);
		}
	});
	it('is deterministic and does not mutate its input', async () => {
		const input = await fixture();
		const before = canonicalJson(input);
		const first = buildFinalControlledActivationReadiness(input);
		const second = buildFinalControlledActivationReadiness(input);
		expect(first).toEqual(second);
		expect(canonicalJson(input)).toBe(before);
	});
	it('rejects coordinate traversal and direct staged-target symlinks before reading them', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-stage-containment-'));
		try {
			const expected =
				'assets/enemies/experiments/affinity-workflow-v1/review/activation-staging/targets/death-knight/fire-v4.json';
			await expect(
				loadStagedVerification(root, `${expected}/../escape.json`, expected)
			).rejects.toThrow('does not match');
			const outside = path.join(root, 'outside.json');
			await writeFile(outside, '{}');
			const staged = path.resolve(root, expected);
			await mkdir(path.dirname(staged), { recursive: true });
			await symlink(outside, staged);
			await expect(loadStagedVerification(root, expected, expected)).rejects.toThrow('symlink');
		} finally {
			await rm(root, { recursive: true });
		}
	});
	it('does not misclassify an existing non-file path as absent', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-strict-absence-'));
		try {
			await mkdir(path.join(root, 'occupied'));
			expect(await repositoryPathIsAbsent(root, 'occupied')).toBe(false);
			expect(await repositoryPathIsAbsent(root, 'missing')).toBe(true);
		} finally {
			await rm(root, { recursive: true });
		}
	});
});

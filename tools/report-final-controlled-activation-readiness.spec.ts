/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	FinalControlledDesignRiskResolutionLedgerV2Schema,
	ImageProductionCatalogSchema,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { canonicalJson, sha256Json } from './image-production-lib.js';
import {
	buildFinalControlledRerunBundle,
	type FinalControlledRerunPlan
} from './prepare-final-controlled-rerun.js';
import {
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
			blindReviewEvidence: review
				? [
						{
							id: review.reviewId,
							targetId: review.targetId,
							candidateContentHash: review.candidateContentHash,
							contentHash: sha256Json(review)
						}
					]
				: [],
			reviseResultEvidence:
				originalResult.status === 'revise'
					? [
							{
								id: originalResult.resultId,
								targetId: originalResult.targetId,
								contentHash: sha256Json(originalResult)
							}
						]
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
	const evidenceBindings = {
		planCanonicalSha256: sha256Json(plan),
		catalogCanonicalSha256: sha256Json(catalog),
		executionSnapshotCanonicalSha256: sha256Json(snapshot),
		blindReviewCollectionCanonicalSha256: sha256Json(reviews),
		sourceAuditCanonicalSha256: sha256Json(plan.designRiskReview)
	};
	const humanDecisionRecord = {
		decisionId: '00000000-0000-4000-8000-000000000100',
		experimentId: 'affinity-workflow-v1',
		scopeId: 'final-controlled-activation-v1',
		mode: 'human-interactive',
		actor: 'Human reviewer',
		evidenceBindings,
		supersedesDecisionId: null,
		decisions: resolutions.map(
			({ riskId, coordinate, sourceTargetId, severity, decision, humanRationale }) => ({
				riskId,
				coordinate,
				sourceTargetId,
				severity,
				decision,
				humanRationale
			})
		),
		attestation: {
			producerDidNotResolveRisks: true,
			reviewedEligibleBlindEvidence: true,
			reviewedCompleteSourceAudit: true,
			deliberatelyResolvedAllRisks: true,
			understandsActivationRequiresIndependentVerification: true
		},
		decidedAt: '2026-08-29T20:30:00.000Z'
	};
	const ledger = {
		schemaVersion: 'affinity-final-controlled-design-risk-resolutions-v2',
		experimentId: 'affinity-workflow-v1',
		scopeId: 'final-controlled-activation-v1',
		status: 'resolved',
		resolutionId: humanDecisionRecord.decisionId,
		actor: humanDecisionRecord.actor,
		decidedAt: humanDecisionRecord.decidedAt,
		mode: 'human-interactive-db-export',
		humanDecisionRecord: {
			record: humanDecisionRecord,
			recordCanonicalSha256: sha256Json(humanDecisionRecord)
		},
		evidenceBindings,
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
		decisionList: {
			experimentId: 'affinity-workflow-v1',
			scopeId: 'final-controlled-activation-v1',
			records: [humanDecisionRecord],
			latestByActor: [humanDecisionRecord]
		},
		decisionDatabaseAvailable: true,
		staged,
		currentWorkspaceValid: true,
		plannedPathsAbsent: true
	};
}

describe('final controlled activation readiness', () => {
	it('authorizes only a complete, canonically bound synthetic fixture', async () => {
		const input = await fixture();
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.parse(input.resolutions)).toBeTruthy();
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
		resolutions.evidenceBindings.blindReviewCollectionCanonicalSha256 = sha256Json(blindReviews);
		resolutions.humanDecisionRecord.record.evidenceBindings = structuredClone(
			resolutions.evidenceBindings
		);
		resolutions.humanDecisionRecord.recordCanonicalSha256 = sha256Json(
			resolutions.humanDecisionRecord.record
		);
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
		expect(report.blockers.map((b) => b.code)).toContain('missing-or-invalid-v2-resolutions');
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
			'missing-or-invalid-v2-resolutions'
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
			'missing-or-invalid-v2-resolutions'
		);
	});
	it('rejects v1 ledgers and a forged embedded DB decision hash', async () => {
		const input = await fixture();
		const v1 = structuredClone(input.resolutions as any);
		v1.schemaVersion = 'affinity-final-controlled-design-risk-resolutions-v1';
		let report = buildFinalControlledActivationReadiness({ ...input, resolutions: v1 });
		expect(report.blockers.map((blocker) => blocker.code)).toContain(
			'missing-or-invalid-v2-resolutions'
		);

		const forged = structuredClone(input.resolutions as any);
		forged.humanDecisionRecord.recordCanonicalSha256 = '0'.repeat(64);
		report = buildFinalControlledActivationReadiness({ ...input, resolutions: forged });
		expect(report.blockers.map((blocker) => blocker.code)).toContain(
			'invalid-human-decision-record-hash'
		);
	});
	it('requires canonical equality with the latest unsuperseded DB decision', async () => {
		const staleInput = await fixture();
		const staleList = structuredClone(staleInput.decisionList as any);
		staleList.records[0].decisions[0].humanRationale += ' Database drift.';
		staleList.latestByActor = [staleList.records[0]];
		let report = buildFinalControlledActivationReadiness({
			...staleInput,
			decisionList: staleList
		});
		expect(report.blockers.map((blocker) => blocker.code)).toContain(
			'noncurrent-or-inauthentic-human-decision'
		);

		const nonlatestInput = await fixture();
		const oldRecord = (nonlatestInput.decisionList as any).records[0];
		const newerRecord = structuredClone(oldRecord);
		newerRecord.decisionId = '00000000-0000-4000-8000-000000000101';
		newerRecord.supersedesDecisionId = oldRecord.decisionId;
		newerRecord.decidedAt = '2026-08-29T20:31:00.000Z';
		report = buildFinalControlledActivationReadiness({
			...nonlatestInput,
			decisionList: {
				...(nonlatestInput.decisionList as any),
				records: [oldRecord, newerRecord],
				latestByActor: [newerRecord]
			}
		});
		expect(report.blockers.map((blocker) => blocker.code)).toContain(
			'noncurrent-or-inauthentic-human-decision'
		);
	});
	it('reports a sanitized blocker when DB decision evidence is unavailable', async () => {
		const input = await fixture();
		const report = buildFinalControlledActivationReadiness({
			...input,
			decisionList: undefined,
			decisionDatabaseAvailable: false
		});
		expect(report.blockers).toContainEqual({
			code: 'decision-database-unavailable',
			detail: 'Authoritative design-risk decision evidence is unavailable'
		});
		expect(JSON.stringify(report)).not.toContain('postgresql://');
	});
	it('recomputes all five evidence bindings, including the source audit', async () => {
		const bindingKeys = [
			'planCanonicalSha256',
			'catalogCanonicalSha256',
			'executionSnapshotCanonicalSha256',
			'blindReviewCollectionCanonicalSha256',
			'sourceAuditCanonicalSha256'
		] as const;
		for (const key of bindingKeys) {
			const input = await fixture();
			const ledger = structuredClone(input.resolutions as any);
			ledger.evidenceBindings[key] = 'f'.repeat(64);
			ledger.humanDecisionRecord.record.evidenceBindings[key] = 'f'.repeat(64);
			ledger.humanDecisionRecord.recordCanonicalSha256 = sha256Json(
				ledger.humanDecisionRecord.record
			);
			const report = buildFinalControlledActivationReadiness({ ...input, resolutions: ledger });
			expect(
				report.blockers.map((blocker) => blocker.code),
				key
			).toContain('stale-binding');
		}
	});
	it('rejects reordered risks and retention of a blocking risk', async () => {
		const input = await fixture();
		const reordered = structuredClone(input.resolutions as any);
		[reordered.resolutions[0], reordered.resolutions[1]] = [
			reordered.resolutions[1],
			reordered.resolutions[0]
		];
		let report = buildFinalControlledActivationReadiness({ ...input, resolutions: reordered });
		expect(report.blockers.map((blocker) => blocker.code)).toContain(
			'missing-or-invalid-v2-resolutions'
		);

		const retainedBlocker = structuredClone(input.resolutions as any);
		retainedBlocker.resolutions[0].decision = 'retain';
		retainedBlocker.resolutions[0].stagedTarget = null;
		report = buildFinalControlledActivationReadiness({
			...input,
			resolutions: retainedBlocker
		});
		expect(report.blockers.map((blocker) => blocker.code)).toContain(
			'missing-or-invalid-v2-resolutions'
		);
	});
	it('rejects nonblind review payloads and stale canonical hashes', async () => {
		const input = await fixture();
		const reviews = structuredClone(input.blindReviews as any);
		reviews.reviews[0].reviewMode = 'api-unverified';
		let report = buildFinalControlledActivationReadiness({ ...input, blindReviews: reviews });
		expect(report.blockers[0]?.code).toBe('invalid-input');
		const resolutions = structuredClone(input.resolutions as any);
		resolutions.evidenceBindings.planCanonicalSha256 = 'f'.repeat(64);
		resolutions.humanDecisionRecord.record.evidenceBindings.planCanonicalSha256 = 'f'.repeat(64);
		resolutions.humanDecisionRecord.recordCanonicalSha256 = sha256Json(
			resolutions.humanDecisionRecord.record
		);
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

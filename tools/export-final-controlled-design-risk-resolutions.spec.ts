import { mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
	FinalControlledDesignRiskDecisionListSchema,
	FinalControlledDesignRiskStagedTargetPaths,
	FinalControlledDesignRisks,
	FinalControlledEligibleOriginalCandidateTargetIds,
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	type FinalControlledDesignRiskDecisionList,
	type ImageProductionBlindReview
} from '../packages/contracts/src/index.js';
import { beforeAll, describe, expect, it } from 'vitest';

import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	sha256Json
} from './image-production-lib.js';
import {
	buildFinalControlledExecutionSnapshot,
	type FinalControlledDesignRiskReadinessReport
} from './final-controlled-design-risk-readiness.js';
import {
	FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH,
	buildFinalControlledDesignRiskResolutionLedger,
	exportFinalControlledDesignRiskResolutions,
	parseFinalControlledDesignRiskExportArgs,
	verifyFinalControlledDesignRiskResolutionLedger,
	type FinalControlledDesignRiskExportEvidence
} from './export-final-controlled-design-risk-resolutions.js';
import {
	FinalControlledRerunPlanSchema,
	buildFinalControlledRerunBundle
} from './prepare-final-controlled-rerun.js';

const repositoryRoot = process.cwd();
const experimentRoot = path.resolve(repositoryRoot, AFFINITY_EXPERIMENT_ROOT);

interface Fixture {
	readonly readiness: FinalControlledDesignRiskReadinessReport;
	readonly decisionList: FinalControlledDesignRiskDecisionList;
	readonly evidence: FinalControlledDesignRiskExportEvidence;
}

let fixture: Fixture;

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

function reviewId(index: number): string {
	return `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

beforeAll(async () => {
	const plan = FinalControlledRerunPlanSchema.parse(
		await readJson(path.join(experimentRoot, 'review/final-controlled-rerun-plan.json'))
	);
	const catalog = ImageProductionCatalogSchema.parse(
		await readJson(path.join(experimentRoot, 'review/catalog.json'))
	);
	const targets = await Promise.all(
		plan.targets.map(async (planned) =>
			ImageProductionTargetSchema.parse(
				await readJson(
					path.join(experimentRoot, `targets/${planned.speciesId}/${planned.affinity}.json`)
				)
			)
		)
	);
	const results = await Promise.all(
		targets.map(async (target) =>
			ImageProductionResultSchema.parse(
				await readJson(path.resolve(repositoryRoot, target.output.resultPath))
			)
		)
	);
	const targetById = new Map(targets.map((target) => [target.targetId, target]));
	const candidateById = new Map(
		catalog.entries
			.filter((entry) => entry.cohort === 'controlled' && entry.status === 'candidate')
			.map((entry) => [entry.targetId, entry])
	);
	const reviews: ImageProductionBlindReview[] =
		FinalControlledEligibleOriginalCandidateTargetIds.map((targetId, index) => {
			const target = targetById.get(targetId)!;
			const catalogEntry = candidateById.get(targetId)!;
			return {
				reviewId: reviewId(index),
				targetId,
				candidateContentHash: catalogEntry.candidateHash!,
				reviewer: 'visual-director',
				reviewMode: 'blind',
				reviewedAt: `2026-08-29T20:${String(index).padStart(2, '0')}:00.000Z`,
				identifiedSpeciesId: target.speciesId,
				identifiedAffinity: target.affinity,
				speciesCorrect: true,
				affinityCorrect: true,
				scores: {
					speciesIdentity: 4,
					affinityReadability: 4,
					silhouetteAndDuty: 4,
					materialCredibility: 4,
					anatomyAndGroundContact: 4,
					affinityIntegration: 4,
					styleCohesion: 4
				},
				verdict: 'candidate',
				note: `Blind evidence for ${targetId}.`
			};
		});
	const blindReviewCollection = ImageProductionBlindReviewCollectionSchema.parse({
		schemaVersion: 'image-production-blind-reviews-v1',
		experimentId: 'affinity-workflow-v1',
		updatedAt: reviews.at(-1)!.reviewedAt,
		reviews
	});
	const bindings = {
		planCanonicalSha256: sha256Json(plan),
		catalogCanonicalSha256: sha256Json(catalog),
		executionSnapshotCanonicalSha256: sha256Json(
			buildFinalControlledExecutionSnapshot(targets, results)
		),
		blindReviewCollectionCanonicalSha256: sha256Json(blindReviewCollection),
		sourceAuditCanonicalSha256: sha256Json(plan.designRiskReview)
	};
	const decision = {
		decisionId: '20000000-0000-4000-8000-000000000001',
		experimentId: 'affinity-workflow-v1' as const,
		scopeId: 'final-controlled-activation-v1' as const,
		mode: 'human-interactive' as const,
		actor: 'visual-director',
		evidenceBindings: bindings,
		supersedesDecisionId: null,
		decisions: FinalControlledDesignRisks.map((risk) => ({
			...risk,
			decision:
				risk.severity === 'blocking' ? ('replace-derived-target' as const) : ('retain' as const),
			humanRationale: `Human decision for ${risk.riskId}.`
		})),
		attestation: {
			producerDidNotResolveRisks: true as const,
			reviewedEligibleBlindEvidence: true as const,
			reviewedCompleteSourceAudit: true as const,
			deliberatelyResolvedAllRisks: true as const,
			understandsActivationRequiresIndependentVerification: true as const
		},
		decidedAt: '2026-08-29T23:00:00.000Z'
	};
	const decisionList = FinalControlledDesignRiskDecisionListSchema.parse({
		experimentId: 'affinity-workflow-v1',
		scopeId: 'final-controlled-activation-v1',
		records: [decision],
		latestByActor: [decision]
	});
	const bundle = buildFinalControlledRerunBundle(plan);
	const staged = Object.fromEntries(
		decision.decisions.flatMap((humanDecision, index) => {
			if (!humanDecision.decision.startsWith('replace-')) return [];
			const expected = bundle.targets.find((target) =>
				target.targetId.endsWith(humanDecision.coordinate)
			)!;
			const target = ImageProductionTargetSchema.parse({
				...expected,
				identityInvariants: [
					...expected.identityInvariants,
					`Human-directed replacement invariant ${index + 1}.`
				]
			});
			const exactPrompt = `Canonical staged prompt ${index + 1}.`;
			return [
				[
					FinalControlledDesignRiskStagedTargetPaths[index],
					{
						target,
						exactPrompt,
						referenceHashes: Object.fromEntries(
							target.references.map((reference) => [reference.path, reference.contentHash])
						)
					}
				]
			];
		})
	);
	fixture = {
		readiness: {
			schemaVersion: 'final-controlled-design-risk-readiness-v1',
			status: 'ready',
			reviewer: 'visual-director',
			counts: {
				targetCount: 24,
				resultCount: 24,
				candidateCount: 21,
				reviseCount: 3,
				exportedBlindReviewCount: 21,
				databaseLatestBlindReviewCount: 21
			},
			evidenceBindings: bindings,
			blockers: []
		},
		decisionList,
		evidence: { plan, catalog, targets, results, blindReviewCollection, staged }
	};
});

function build(overrides: Partial<Fixture> = {}) {
	return buildFinalControlledDesignRiskResolutionLedger({
		actor: 'visual-director',
		readiness: overrides.readiness ?? fixture.readiness,
		decisionList: overrides.decisionList ?? fixture.decisionList,
		evidence: overrides.evidence ?? fixture.evidence
	});
}

describe('final-controlled design-risk resolution exporter', () => {
	it('builds and verifies an exact 21/3/16 v2 ledger from the latest DB decision', () => {
		const ledger = build();
		expect(ledger.eligibleOriginalControlledTargetIds).toHaveLength(21);
		expect(ledger.reviseResults).toHaveLength(3);
		expect(ledger.resolutions).toHaveLength(16);
		expect(ledger.resolutions.filter((resolution) => resolution.stagedTarget)).toHaveLength(8);
		expect(ledger.humanDecisionRecord.recordCanonicalSha256).toBe(
			sha256Json(ledger.humanDecisionRecord.record)
		);
		expect(verifyFinalControlledDesignRiskResolutionLedger(ledger)).toEqual(ledger);
	});

	it('fails closed for a blocked gate, wrong actor, stale five-hash binding, and non-latest record', () => {
		expect(() =>
			build({
				readiness: {
					...fixture.readiness,
					status: 'blocked',
					blockers: [{ code: 'x', detail: 'x' }]
				}
			})
		).toThrow(/not ready/u);
		expect(() =>
			buildFinalControlledDesignRiskResolutionLedger({
				actor: 'other-actor',
				readiness: fixture.readiness,
				decisionList: fixture.decisionList,
				evidence: fixture.evidence
			})
		).toThrow(/reviewer does not match/u);
		const staleReadiness = structuredClone(fixture.readiness);
		staleReadiness.evidenceBindings!.catalogCanonicalSha256 = 'f'.repeat(64);
		expect(() => build({ readiness: staleReadiness })).toThrow(/stale|five DB-bound/u);
		const noLatest = { ...fixture.decisionList, latestByActor: [] };
		expect(() => build({ decisionList: noLatest })).toThrow();
	});

	it('redacts a decision database failure and performs no evidence load or write', async () => {
		let evidenceLoaded = false;
		await expect(
			exportFinalControlledDesignRiskResolutions({
				databaseUrl: 'secret-database-url',
				actor: 'visual-director',
				mode: 'check',
				dependencies: {
					loadReadiness: async () => fixture.readiness,
					loadDecisions: async () => {
						throw new Error('driver leaked secret-database-url');
					},
					loadEvidence: async () => {
						evidenceLoaded = true;
						return fixture.evidence;
					}
				}
			})
		).rejects.toThrow('The final-controlled decision database is unavailable or invalid.');
		expect(evidenceLoaded).toBe(false);
	});

	it('rejects staged identity/reference drift and verifies prompt/hash/byte evidence on replay', () => {
		const firstPath = FinalControlledDesignRiskStagedTargetPaths[0];
		const originalVerification = fixture.evidence.staged[firstPath]!;
		const wrongReference = {
			...structuredClone(originalVerification),
			referenceHashes: {
				...originalVerification.referenceHashes,
				[ImageProductionTargetSchema.parse(originalVerification.target).references[0]!.path]:
					'0'.repeat(64)
			}
		};
		expect(() =>
			build({
				evidence: {
					...fixture.evidence,
					staged: { ...fixture.evidence.staged, [firstPath]: wrongReference }
				}
			})
		).toThrow(/reference binding/u);

		const ledger = build();
		const tamperedPrompt = structuredClone(ledger);
		tamperedPrompt.resolutions[0]!.stagedTarget!.promptByteLength += 1;
		expect(() => verifyFinalControlledDesignRiskResolutionLedger(tamperedPrompt, ledger)).toThrow();
		const tamperedRecordHash = structuredClone(ledger);
		tamperedRecordHash.humanDecisionRecord.recordCanonicalSha256 = '0'.repeat(64);
		expect(() => verifyFinalControlledDesignRiskResolutionLedger(tamperedRecordHash)).toThrow(
			/decision canonical hash/u
		);
	});

	it('keeps check mode zero-write and exclusive write idempotent without touching staged inputs', async () => {
		const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'final-risk-export-'));
		await mkdir(
			path.resolve(workspaceRoot, path.dirname(FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH)),
			{
				recursive: true
			}
		);
		const dependencies = {
			loadReadiness: async () => fixture.readiness,
			loadDecisions: async () => fixture.decisionList,
			loadEvidence: async () => fixture.evidence
		};
		const checked = await exportFinalControlledDesignRiskResolutions({
			workspaceRoot,
			databaseUrl: 'unused',
			actor: 'visual-director',
			mode: 'check',
			dependencies
		});
		expect(checked).toMatchObject({ written: false, inSync: false });
		expect(
			await readFile(path.resolve(workspaceRoot, FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH)).catch(
				() => null
			)
		).toBeNull();
		expect(
			await readdir(
				path.resolve(workspaceRoot, path.dirname(FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH))
			)
		).toEqual([]);

		const written = await exportFinalControlledDesignRiskResolutions({
			workspaceRoot,
			databaseUrl: 'unused',
			actor: 'visual-director',
			mode: 'write',
			dependencies
		});
		expect(written).toMatchObject({ written: true, inSync: true });
		const repeated = await exportFinalControlledDesignRiskResolutions({
			workspaceRoot,
			databaseUrl: 'unused',
			actor: 'visual-director',
			mode: 'write',
			dependencies
		});
		expect(repeated).toMatchObject({ written: false, inSync: true });
		const beforeConflict = await readFile(
			path.resolve(workspaceRoot, FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH)
		);
		const firstPath = FinalControlledDesignRiskStagedTargetPaths[0];
		await expect(
			exportFinalControlledDesignRiskResolutions({
				workspaceRoot,
				databaseUrl: 'unused',
				actor: 'visual-director',
				mode: 'check',
				dependencies: {
					...dependencies,
					loadEvidence: async () => ({
						...fixture.evidence,
						staged: {
							...fixture.evidence.staged,
							[firstPath]: {
								...fixture.evidence.staged[firstPath]!,
								exactPrompt: 'Conflicting staged prompt.'
							}
						}
					})
				}
			})
		).rejects.toThrow(/stale or conflicting/u);
		expect(
			await readFile(path.resolve(workspaceRoot, FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH))
		).toEqual(beforeConflict);
		expect(
			verifyFinalControlledDesignRiskResolutionLedger(
				JSON.parse(
					await readFile(
						path.resolve(workspaceRoot, FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH),
						'utf8'
					)
				)
			).resolutionId
		).toBe(fixture.decisionList.latestByActor[0]!.decisionId);
	});

	it('parses exactly one mode and one explicit actor', () => {
		expect(
			parseFinalControlledDesignRiskExportArgs(['--check', '--', '--actor', 'visual-director'])
		).toEqual({
			mode: 'check',
			actor: 'visual-director'
		});
		expect(() => parseFinalControlledDesignRiskExportArgs(['--check'])).toThrow();
		expect(() =>
			parseFinalControlledDesignRiskExportArgs(['--check', '--write', '--actor', 'x'])
		).toThrow();
		expect(() =>
			parseFinalControlledDesignRiskExportArgs(['--check', '--', '--', '--actor', 'x'])
		).toThrow();
	});
});

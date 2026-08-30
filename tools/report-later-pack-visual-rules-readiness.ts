import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	LaterPackRulesHumanDecisionRecordSchema,
	type ImageProductionResult
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import { AFFINITY_EXPERIMENT_ROOT, sha256Json } from './image-production-lib.js';
import {
	AffinityRoundBlindReviewCollectionSchema,
	loadRoundBlindReviews,
	loadVerifiedAffinityReviewRound
} from './affinity-round-postgeneration-lib.js';
import { readContainedRoundJson } from './affinity-review-round-lib.js';
import {
	FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
	FinalControlledActivationReceiptSchema,
	verifyFinalControlledActivationReceipt
} from './final-controlled-activation-evidence.js';
import { FinalControlledRerunPlanSchema } from './prepare-final-controlled-rerun.js';

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Slug = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);
const DOMAINS = [
	'affinity-construction',
	'normal-neutrality',
	'species-identity',
	'grade-separation',
	'pack-style',
	'power-signaling',
	'human-variation',
	'quality-ethics'
] as const;
const RULE_IDS = [
	'affinity-changes-construction',
	'normal-remains-unaffiliated',
	'species-identity-survives-affinity',
	'grade-and-affinity-stay-separate',
	'packs-declare-coherent-style',
	'power-uses-material-hierarchy',
	'humans-vary-with-compatibility',
	'quality-without-objectification'
] as const;

export const LATER_PACK_RULES_PROPOSAL_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/later-pack-visual-rules-proposal.json` as const;
export const ACCEPTED_LATER_PACK_RULES_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/accepted-later-pack-visual-rules.json` as const;

function textHash(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

const ProposedRuleSchema = z
	.object({
		ruleId: z.enum(RULE_IDS),
		domain: z.enum(DOMAINS),
		requiredDecision: z.literal(true),
		text: z.string().trim().min(1).max(1_000),
		textHash: Hash
	})
	.strict()
	.superRefine((rule, context) => {
		if (textHash(rule.text) !== rule.textHash)
			context.addIssue({ code: 'custom', path: ['textHash'], message: 'Text hash is stale' });
	});

export const LaterPackVisualRulesProposalSchema = z
	.object({
		schemaVersion: z.literal('affinity-later-pack-visual-rules-proposal-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('proposed-not-accepted'),
		rules: z.array(ProposedRuleSchema).length(8)
	})
	.strict()
	.superRefine((proposal, context) => {
		for (const [field, expected] of [
			['ruleId', RULE_IDS],
			['domain', DOMAINS]
		] as const) {
			const actual = proposal.rules.map((rule) => rule[field]);
			if (actual.some((value, index) => value !== expected[index]))
				context.addIssue({
					code: 'custom',
					path: ['rules'],
					message: `${field} order/set is not plan-owned`
				});
		}
	});
export type LaterPackVisualRulesProposal = z.infer<typeof LaterPackVisualRulesProposalSchema>;

const ReviewBindingSchema = z
	.object({ reviewId: z.string().uuid(), targetId: Slug, candidateHash: Hash, reviewHash: Hash })
	.strict();
const RuleDecisionSchema = z
	.object({
		ruleId: z.enum(RULE_IDS),
		domain: z.enum(DOMAINS),
		textHash: Hash,
		decision: z.literal('accepted'),
		humanRationale: z.string().trim().min(1).max(2_000)
	})
	.strict();

export const AcceptedLaterPackVisualRulesV2Schema = z
	.object({
		schemaVersion: z.literal('affinity-accepted-later-pack-visual-rules-v2'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('accepted'),
		acceptanceId: z.string().uuid(),
		acceptedBy: z.string().trim().min(1).max(80),
		acceptedAt: z.iso.datetime(),
		acceptanceMode: z.literal('human-interactive-db-export'),
		humanDecisionRecord: z.object({ decisionId: z.string().uuid(), contentHash: Hash }).strict(),
		sources: z
			.object({
				proposalCanonicalSha256: Hash,
				planCanonicalSha256: Hash,
				activationReceiptCanonicalSha256: Hash,
				catalogCanonicalSha256: Hash,
				blindReviewCollectionCanonicalSha256: Hash,
				executionSnapshotCanonicalSha256: Hash,
				gateEvidenceCanonicalSha256: Hash
			})
			.strict(),
		eligibleBlindReviews: z.array(ReviewBindingSchema).length(24),
		rules: z.array(RuleDecisionSchema).length(8)
	})
	.strict()
	.superRefine((artifact, context) => {
		if (new Set(artifact.eligibleBlindReviews.map((item) => item.targetId)).size !== 24)
			context.addIssue({
				code: 'custom',
				path: ['eligibleBlindReviews'],
				message: 'Target IDs must be unique'
			});
		if (
			artifact.rules.some(
				(rule, index) => rule.ruleId !== RULE_IDS[index] || rule.domain !== DOMAINS[index]
			)
		)
			context.addIssue({
				code: 'custom',
				path: ['rules'],
				message: 'Rule set/order is not plan-owned'
			});
	});
export type AcceptedLaterPackVisualRulesV2 = z.infer<typeof AcceptedLaterPackVisualRulesV2Schema>;

export interface LaterPackRulesReadinessInput {
	readonly proposal: unknown;
	readonly plan: unknown;
	readonly activationReceipt: unknown;
	readonly activationReceiptValid: boolean;
	readonly catalog: unknown;
	readonly blindReviews: unknown;
	readonly finalTargets: readonly unknown[];
	readonly finalResults: readonly unknown[];
	readonly acceptedArtifact?: unknown;
	readonly humanDecisionRecord?: unknown;
}

function selectedHash(result: ImageProductionResult): string | null {
	const attempt = result.attempts.find((item) => item.attemptId === result.selectedAttemptId);
	return attempt?.output?.contentHash ?? null;
}

export function buildLaterPackRulesReadiness(input: LaterPackRulesReadinessInput) {
	const blockers: { code: string; detail: string }[] = [];
	const proposalResult = LaterPackVisualRulesProposalSchema.safeParse(input.proposal);
	const planResult = FinalControlledRerunPlanSchema.safeParse(input.plan);
	const receiptResult = FinalControlledActivationReceiptSchema.safeParse(input.activationReceipt);
	const catalogResult = ImageProductionCatalogSchema.safeParse(input.catalog);
	const reviewsResult = AffinityRoundBlindReviewCollectionSchema.safeParse(input.blindReviews);
	const targetsResult = z.array(ImageProductionTargetSchema).safeParse(input.finalTargets);
	const resultsResult = z.array(ImageProductionResultSchema).safeParse(input.finalResults);
	for (const [code, result] of [
		['invalid-proposal', proposalResult],
		['invalid-plan', planResult],
		['missing-or-invalid-activation-receipt', receiptResult],
		['invalid-catalog', catalogResult],
		['invalid-blind-reviews', reviewsResult],
		['invalid-final-targets', targetsResult],
		['invalid-final-results', resultsResult]
	] as const)
		if (!result.success) blockers.push({ code, detail: result.error.message });
	if (
		!proposalResult.success ||
		!planResult.success ||
		!catalogResult.success ||
		!reviewsResult.success ||
		!targetsResult.success ||
		!resultsResult.success
	) {
		return {
			schemaVersion: 'affinity-later-pack-rules-readiness-v1' as const,
			eligibleForHumanAcceptance: false,
			acceptedArtifactValid: false,
			counts: {
				finalTargets: 0,
				finalCandidates: 0,
				eligibleBlindReviews: 0,
				proposalRules: proposalResult.success ? 8 : 0
			},
			blockers
		};
	}
	const proposal = proposalResult.data,
		plan = planResult.data,
		catalog = catalogResult.data,
		reviewCollection = reviewsResult.data;
	const targets = targetsResult.data,
		results = resultsResult.data;
	if (!input.activationReceiptValid || !receiptResult.success)
		blockers.push({
			code: 'activation-not-verified',
			detail:
				'The final-controlled activation receipt is absent or fails byte/canonical verification.'
		});
	else if (receiptResult.data.bindings.planCanonicalSha256 !== sha256Json(plan))
		blockers.push({
			code: 'activation-plan-binding-mismatch',
			detail: 'Activation receipt does not bind the current plan.'
		});
	const plannedIds = plan.targets.map((item) => `affinity-workflow-v1-${item.key}`).toSorted();
	const finalTargets = targets
		.filter((target) => plannedIds.includes(target.targetId))
		.toSorted((a, b) => a.targetId.localeCompare(b.targetId));
	const finalResults = results
		.filter((result) => plannedIds.includes(result.targetId))
		.toSorted((a, b) => a.targetId.localeCompare(b.targetId));
	if (finalTargets.length !== 24 || finalResults.length !== 24)
		blockers.push({
			code: 'final-cohort-incomplete',
			detail: `Expected 24 final targets/results; found ${finalTargets.length}/${finalResults.length}.`
		});
	const resultByTarget = new Map(finalResults.map((result) => [result.targetId, result]));
	const catalogByTarget = new Map(catalog.entries.map((entry) => [entry.targetId, entry]));
	const candidates = finalTargets.filter((target) => {
		const result = resultByTarget.get(target.targetId),
			entry = catalogByTarget.get(target.targetId),
			hash = result ? selectedHash(result) : null;
		return (
			result?.status === 'candidate' &&
			hash !== null &&
			entry?.status === 'candidate' &&
			entry.candidateHash === hash
		);
	});
	if (candidates.length !== 24)
		blockers.push({
			code: 'final-candidates-incomplete',
			detail: `Expected 24 current catalog-bound final candidates; found ${candidates.length}.`
		});
	const candidateHashes = new Map(
		candidates.map((target) => [
			target.targetId,
			selectedHash(resultByTarget.get(target.targetId)!)!
		])
	);
	const eligibleReviews = reviewCollection.reviews
		.filter((review) => candidateHashes.get(review.targetId) === review.candidateContentHash)
		.toSorted((a, b) => a.targetId.localeCompare(b.targetId));
	if (
		eligibleReviews.length !== 24 ||
		new Set(eligibleReviews.map((review) => review.targetId)).size !== 24
	)
		blockers.push({
			code: 'eligible-blind-reviews-incomplete',
			detail: `Expected 24 unique current-hash blind reviews; found ${eligibleReviews.length}.`
		});
	const firstAttempt = candidates.filter((target) => {
		const result = resultByTarget.get(target.targetId)!;
		return result.selectedAttemptId === result.attempts[0]?.attemptId;
	}).length;
	const speciesCorrect = eligibleReviews.filter((review) => review.speciesCorrect).length;
	const affinityCorrect = eligibleReviews.filter((review) => review.affinityCorrect).length;
	const normalCorrect = eligibleReviews.filter(
		(review) =>
			finalTargets.find((target) => target.targetId === review.targetId)?.affinity === 'normal' &&
			review.affinityCorrect
	).length;
	const meaningfulAccepted = eligibleReviews.filter(
		(review) =>
			finalTargets.find((target) => target.targetId === review.targetId)?.affinity !== 'normal' &&
			review.verdict === 'candidate'
	).length;
	const criticalAccepted = eligibleReviews.filter(
		(review) =>
			review.verdict === 'candidate' &&
			resultByTarget
				.get(review.targetId)
				?.attempts.find(
					(attempt) => attempt.attemptId === resultByTarget.get(review.targetId)?.selectedAttemptId
				)
				?.findings.some(
					(finding) =>
						finding.outcome === 'fail' &&
						['anatomy', 'canvas-completion', 'framing', 'silhouette'].includes(finding.category)
				)
	).length;
	const gateEvidence = {
		firstAttempt,
		speciesCorrect,
		affinityCorrect,
		normalCorrect,
		meaningfulAccepted,
		criticalAccepted
	};
	if (
		firstAttempt < 20 ||
		speciesCorrect < 23 ||
		affinityCorrect < 20 ||
		normalCorrect !== 4 ||
		meaningfulAccepted < 20 ||
		criticalAccepted !== 0
	)
		blockers.push({
			code: 'final-human-gate-not-passed',
			detail: `Final gate is ${firstAttempt}/20 first-attempt, ${speciesCorrect}/23 species, ${affinityCorrect}/20 affinity, ${normalCorrect}/4 Normal, ${meaningfulAccepted}/20 meaningful accepted, ${criticalAccepted}/0 accepted critical failures.`
		});
	const snapshot = finalTargets.map((target) => ({
		targetId: target.targetId,
		targetHash: sha256Json(target),
		resultHash: resultByTarget.has(target.targetId)
			? sha256Json(resultByTarget.get(target.targetId))
			: null,
		candidateHash: candidateHashes.get(target.targetId) ?? null
	}));
	const bindings = eligibleReviews.map((review) => ({
		reviewId: review.reviewId,
		targetId: review.targetId,
		candidateHash: review.candidateContentHash,
		reviewHash: sha256Json(review)
	}));
	const expectedSources = {
		proposalCanonicalSha256: sha256Json(proposal),
		planCanonicalSha256: sha256Json(plan),
		activationReceiptCanonicalSha256: receiptResult.success
			? sha256Json(receiptResult.data)
			: '0'.repeat(64),
		catalogCanonicalSha256: sha256Json(catalog),
		blindReviewCollectionCanonicalSha256: sha256Json(reviewCollection),
		executionSnapshotCanonicalSha256: sha256Json(snapshot),
		gateEvidenceCanonicalSha256: sha256Json(gateEvidence)
	};
	const sourceReadinessCanonicalSha256 = sha256Json({
		sources: expectedSources,
		eligibleBlindReviews: bindings,
		gateEvidence
	});
	let acceptedArtifactValid = false;
	if (input.acceptedArtifact !== undefined) {
		const artifact = AcceptedLaterPackVisualRulesV2Schema.safeParse(input.acceptedArtifact),
			decision = LaterPackRulesHumanDecisionRecordSchema.safeParse(input.humanDecisionRecord);
		if (!artifact.success || !decision.success)
			blockers.push({
				code: 'invalid-accepted-artifact-or-human-record',
				detail: 'Acceptance requires strict v2 artifact and current human-interactive DB decision.'
			});
		else {
			const sourcesMatch = Object.entries(expectedSources).every(
				([key, value]) => artifact.data.sources[key as keyof typeof expectedSources] === value
			);
			const decisionsMatch =
				sha256Json(artifact.data.rules) === sha256Json(decision.data.decisions) &&
				artifact.data.humanDecisionRecord.decisionId === decision.data.decisionId &&
				artifact.data.humanDecisionRecord.contentHash === sha256Json(decision.data) &&
				artifact.data.acceptedBy === decision.data.actor &&
				artifact.data.acceptedAt === decision.data.decidedAt &&
				decision.data.proposalCanonicalSha256 === expectedSources.proposalCanonicalSha256 &&
				decision.data.sourceReadinessCanonicalSha256 === sourceReadinessCanonicalSha256;
			const reviewsMatch = sha256Json(artifact.data.eligibleBlindReviews) === sha256Json(bindings);
			const ruleHashesMatch = artifact.data.rules.every(
				(rule, index) => rule.textHash === proposal.rules[index]?.textHash
			);
			acceptedArtifactValid = sourcesMatch && decisionsMatch && reviewsMatch && ruleHashesMatch;
			if (!acceptedArtifactValid)
				blockers.push({
					code: 'stale-or-unbound-accepted-artifact',
					detail:
						'Accepted artifact is not canonically bound to current evidence and human decision.'
				});
		}
	}
	return {
		schemaVersion: 'affinity-later-pack-rules-readiness-v1' as const,
		eligibleForHumanAcceptance: blockers.every(
			(blocker) =>
				![
					'invalid-proposal',
					'invalid-plan',
					'missing-or-invalid-activation-receipt',
					'invalid-catalog',
					'invalid-blind-reviews',
					'invalid-final-targets',
					'invalid-final-results',
					'activation-not-verified',
					'activation-plan-binding-mismatch',
					'final-cohort-incomplete',
					'final-candidates-incomplete',
					'eligible-blind-reviews-incomplete',
					'final-human-gate-not-passed'
				].includes(blocker.code)
		),
		acceptedArtifactValid,
		counts: {
			finalTargets: finalTargets.length,
			finalCandidates: candidates.length,
			eligibleBlindReviews: eligibleReviews.length,
			proposalRules: proposal.rules.length
		},
		bindings: {
			...expectedSources,
			sourceReadinessCanonicalSha256,
			eligibleBlindReviews: bindings,
			gateEvidence
		},
		blockers
	};
}

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8'));
}
export async function reportCurrentLaterPackRulesReadiness(
	workspaceRoot = process.cwd(),
	acceptance?: { readonly acceptedArtifact: unknown; readonly humanDecisionRecord: unknown }
) {
	const experiment = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const plan = await readJson(path.join(experiment, 'review/final-controlled-rerun-plan.json'));
	const proposal = await readJson(path.resolve(workspaceRoot, LATER_PACK_RULES_PROPOSAL_PATH));
	const finalRound = await loadVerifiedAffinityReviewRound(
		workspaceRoot,
		'final-controlled-v1'
	).catch((error) => ({ error }) as const);
	if ('error' in finalRound)
		return {
			schemaVersion: 'affinity-later-pack-rules-readiness-v1' as const,
			eligibleForHumanAcceptance: false,
			acceptedArtifactValid: false,
			counts: { finalTargets: 0, finalCandidates: 0, eligibleBlindReviews: 0, proposalRules: 8 },
			blockers: [
				{
					code: 'final-round-not-integrated',
					detail:
						finalRound.error instanceof Error ? finalRound.error.message : String(finalRound.error)
				}
			]
		};
	const blindReviews = await loadRoundBlindReviews(workspaceRoot, 'final-controlled-v1', true);
	const activationReceipt = await readJson(
		path.resolve(workspaceRoot, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH)
	).catch(() => undefined);
	const finalTargets = finalRound.registry.entries.map((entry) => entry.target);
	const finalResults = await Promise.all(
		finalRound.registry.entries.map((entry) =>
			readContainedRoundJson(workspaceRoot, entry.target.output.resultPath)
		)
	);
	const activationReceiptValid = await verifyFinalControlledActivationReceipt(
		workspaceRoot,
		sha256Json(FinalControlledRerunPlanSchema.parse(plan))
	).then(
		(result) => result.valid,
		() => false
	);
	const report = buildLaterPackRulesReadiness({
		proposal,
		plan,
		activationReceipt,
		activationReceiptValid,
		catalog: finalRound.catalog,
		blindReviews,
		finalTargets,
		finalResults,
		...(acceptance ?? {})
	});
	if (
		blindReviews?.integrationReceiptCanonicalSha256 !== finalRound.integrationReceiptCanonicalSha256
	)
		return {
			...report,
			eligibleForHumanAcceptance: false,
			blockers: [
				...report.blockers,
				{
					code: 'blind-review-integration-binding-mismatch',
					detail: 'Blind reviews do not bind the current final-controlled integration receipt.'
				}
			]
		};
	return report;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
	reportCurrentLaterPackRulesReadiness()
		.then((report) => {
			process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
			process.exitCode = report.eligibleForHumanAcceptance ? 0 : 1;
		})
		.catch((error) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});

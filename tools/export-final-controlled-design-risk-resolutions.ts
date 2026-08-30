import { createHash, randomUUID } from 'node:crypto';
import { link, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getConfig } from '../packages/config/src/index.js';
import {
	FinalControlledDesignRiskDecisionListSchema,
	FinalControlledDesignRiskResolutionLedgerV2Schema,
	FinalControlledDesignRiskStagedTargetPaths,
	FinalControlledDesignRisks,
	FinalControlledEligibleOriginalCandidateTargetIds,
	FinalControlledOriginalReviseResults,
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	type FinalControlledDesignRiskDecisionList,
	type FinalControlledDesignRiskDecisionRecord,
	type FinalControlledDesignRiskEvidenceBindings,
	type FinalControlledDesignRiskResolutionLedgerV2,
	type ImageProductionResult,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { listFinalControlledDesignRiskDecisions } from '../packages/database/src/index.js';

import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	canonicalJson,
	sha256Json,
	type ImageProductionBlindReviewCollection
} from './image-production-lib.js';
import {
	buildFinalControlledExecutionSnapshot,
	reportFinalControlledDesignRiskReadiness,
	type FinalControlledDesignRiskReadinessReport
} from './final-controlled-design-risk-readiness.js';
import {
	FinalControlledRerunPlanSchema,
	buildFinalControlledRerunBundle,
	type FinalControlledRerunPlan
} from './prepare-final-controlled-rerun.js';
import {
	loadStagedVerification,
	type StagedVerification
} from './report-final-controlled-activation-readiness.js';

export const FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-design-risk-resolutions.json` as const;
const EXPERIMENT_ID = 'affinity-workflow-v1' as const;
const SCOPE_ID = 'final-controlled-activation-v1' as const;

export type FinalControlledDesignRiskExportMode = 'check' | 'write';

export interface FinalControlledDesignRiskExportEvidence {
	readonly plan: unknown;
	readonly catalog: unknown;
	readonly targets: readonly unknown[];
	readonly results: readonly unknown[];
	readonly blindReviewCollection: unknown;
	readonly staged: Readonly<Record<string, StagedVerification>>;
}

export interface FinalControlledDesignRiskExportReport {
	readonly mode: FinalControlledDesignRiskExportMode;
	readonly actor: string;
	readonly decisionId: string;
	readonly outputPath: typeof FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH;
	readonly written: boolean;
	readonly inSync: boolean;
	readonly ledgerCanonicalSha256: string;
	readonly replacementCount: number;
	readonly retainedCount: number;
}

export type FinalControlledDesignRiskDecisionLoader = (
	databaseUrl: string,
	experimentId: typeof EXPERIMENT_ID,
	scopeId: typeof SCOPE_ID
) => Promise<FinalControlledDesignRiskDecisionList>;

export interface FinalControlledDesignRiskExporterDependencies {
	readonly loadReadiness?: (
		actor: string,
		workspaceRoot: string
	) => Promise<FinalControlledDesignRiskReadinessReport>;
	readonly loadDecisions?: FinalControlledDesignRiskDecisionLoader;
	readonly loadEvidence?: (
		workspaceRoot: string,
		decision: FinalControlledDesignRiskDecisionRecord
	) => Promise<FinalControlledDesignRiskExportEvidence>;
}

function explicitActor(input: unknown): string {
	if (typeof input !== 'string') throw new Error('An explicit --actor <name> is required.');
	const actor = input.trim();
	if (!actor || actor.length > 80 || /\p{C}/u.test(actor)) {
		throw new Error('An explicit printable --actor <name> of at most 80 characters is required.');
	}
	return actor;
}

function jsonText(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

function equalBindings(
	left: FinalControlledDesignRiskEvidenceBindings,
	right: FinalControlledDesignRiskEvidenceBindings
): boolean {
	return canonicalJson(left) === canonicalJson(right);
}

function selectCurrentHumanDecision(input: {
	readonly actor: string;
	readonly readiness: FinalControlledDesignRiskReadinessReport;
	readonly decisionList: unknown;
}): FinalControlledDesignRiskDecisionRecord {
	if (
		input.readiness.status !== 'ready' ||
		input.readiness.blockers.length !== 0 ||
		!input.readiness.evidenceBindings
	) {
		throw new Error(
			`Current design-risk evidence is not ready: ${input.readiness.blockers.map((blocker) => blocker.code).join(', ') || 'missing-current-bindings'}`
		);
	}
	if (input.readiness.reviewer !== input.actor) {
		throw new Error('The readiness reviewer does not match the explicit export actor.');
	}
	const list = FinalControlledDesignRiskDecisionListSchema.parse(input.decisionList);
	if (list.experimentId !== EXPERIMENT_ID || list.scopeId !== SCOPE_ID) {
		throw new Error('The design-risk decision list belongs to another experiment or scope.');
	}
	const matching = list.latestByActor.filter((record) => record.actor === input.actor);
	if (matching.length !== 1) {
		throw new Error(`Expected exactly one latest unsuperseded decision for ${input.actor}.`);
	}
	const decision = matching[0]!;
	if (!equalBindings(decision.evidenceBindings, input.readiness.evidenceBindings)) {
		throw new Error('The actor’s latest decision is stale for the current five evidence bindings.');
	}
	return decision;
}

function currentBindings(input: {
	readonly plan: FinalControlledRerunPlan;
	readonly catalog: unknown;
	readonly targets: readonly ImageProductionTarget[];
	readonly results: readonly ImageProductionResult[];
	readonly blindReviewCollection: ImageProductionBlindReviewCollection;
}): FinalControlledDesignRiskEvidenceBindings {
	const catalog = ImageProductionCatalogSchema.parse(input.catalog);
	return {
		planCanonicalSha256: sha256Json(input.plan),
		catalogCanonicalSha256: sha256Json(catalog),
		executionSnapshotCanonicalSha256: sha256Json(
			buildFinalControlledExecutionSnapshot(input.targets, input.results)
		),
		blindReviewCollectionCanonicalSha256: sha256Json(input.blindReviewCollection),
		sourceAuditCanonicalSha256: sha256Json(input.plan.designRiskReview)
	};
}

function originalTargetIdForCoordinate(coordinate: string): string {
	return `${EXPERIMENT_ID}-${coordinate.replace(/-v\d+$/u, '')}`;
}

function sha256Text(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function verifyStagedTarget(input: {
	readonly index: number;
	readonly decision: FinalControlledDesignRiskDecisionRecord['decisions'][number];
	readonly expected: ImageProductionTarget;
	readonly verification: StagedVerification | undefined;
}) {
	const expectedPath = FinalControlledDesignRiskStagedTargetPaths[input.index];
	if (!expectedPath || !input.verification) {
		throw new Error(`Replacement ${input.decision.riskId} has no staged target at its owned path.`);
	}
	const verification = input.verification;
	const target = ImageProductionTargetSchema.parse(verification.target);
	const referencesMatch =
		target.references.length === Object.keys(verification.referenceHashes).length &&
		target.references.every(
			(reference) => verification.referenceHashes[reference.path] === reference.contentHash
		);
	if (
		target.targetId !== input.expected.targetId ||
		target.assetId !== input.expected.assetId ||
		target.experimentId !== input.expected.experimentId ||
		target.packId !== input.expected.packId ||
		target.speciesId !== input.expected.speciesId ||
		target.affinity !== input.expected.affinity ||
		target.cohort !== input.expected.cohort ||
		target.promptProtocol !== input.expected.promptProtocol ||
		target.authoringProtocol !== input.expected.authoringProtocol ||
		canonicalJson(target.output) !== canonicalJson(input.expected.output) ||
		!referencesMatch
	) {
		throw new Error(
			`Staged target ${expectedPath} failed coordinate, protocol, output, or reference binding.`
		);
	}
	if (sha256Json(target) === sha256Json(input.expected)) {
		throw new Error(`Staged target ${expectedPath} does not contain a replacement design.`);
	}
	return {
		path: expectedPath,
		canonicalHash: sha256Json(target),
		promptHash: sha256Text(verification.exactPrompt),
		promptByteLength: Buffer.byteLength(verification.exactPrompt)
	};
}

export function verifyFinalControlledDesignRiskResolutionLedger(
	ledgerInput: unknown,
	expected?: FinalControlledDesignRiskResolutionLedgerV2
): FinalControlledDesignRiskResolutionLedgerV2 {
	const ledger = FinalControlledDesignRiskResolutionLedgerV2Schema.parse(ledgerInput);
	if (
		ledger.humanDecisionRecord.recordCanonicalSha256 !==
		sha256Json(ledger.humanDecisionRecord.record)
	) {
		throw new Error('The embedded DB decision canonical hash is invalid.');
	}
	if (expected && canonicalJson(ledger) !== canonicalJson(expected)) {
		throw new Error('The existing final-controlled design-risk ledger is stale or conflicting.');
	}
	return ledger;
}

export function buildFinalControlledDesignRiskResolutionLedger(input: {
	readonly actor: unknown;
	readonly readiness: FinalControlledDesignRiskReadinessReport;
	readonly decisionList: unknown;
	readonly evidence: FinalControlledDesignRiskExportEvidence;
}): FinalControlledDesignRiskResolutionLedgerV2 {
	const actor = explicitActor(input.actor);
	const decision = selectCurrentHumanDecision({
		actor,
		readiness: input.readiness,
		decisionList: input.decisionList
	});
	const plan = FinalControlledRerunPlanSchema.parse(input.evidence.plan);
	const bundle = buildFinalControlledRerunBundle(plan);
	const catalog = ImageProductionCatalogSchema.parse(input.evidence.catalog);
	const targets = input.evidence.targets.map((target) => ImageProductionTargetSchema.parse(target));
	const results = input.evidence.results.map((result) => ImageProductionResultSchema.parse(result));
	const reviews = ImageProductionBlindReviewCollectionSchema.parse(
		input.evidence.blindReviewCollection
	);
	const recomputedBindings = currentBindings({
		plan,
		catalog: input.evidence.catalog,
		targets,
		results,
		blindReviewCollection: reviews
	});
	if (
		!input.readiness.evidenceBindings ||
		!equalBindings(recomputedBindings, input.readiness.evidenceBindings) ||
		!equalBindings(recomputedBindings, decision.evidenceBindings)
	) {
		throw new Error(
			'Current workspace evidence does not match all five DB-bound readiness hashes.'
		);
	}

	const blindByTarget = new Map(reviews.reviews.map((review) => [review.targetId, review]));
	const reviewedTargetIds = reviews.reviews.map((review) => review.targetId).toSorted();
	if (
		reviews.reviews.length !== 21 ||
		new Set(reviewedTargetIds).size !== 21 ||
		canonicalJson(reviewedTargetIds) !==
			canonicalJson([...FinalControlledEligibleOriginalCandidateTargetIds].toSorted())
	) {
		throw new Error('The ledger requires blind evidence for the exact canonical 21 candidates.');
	}
	for (const review of reviews.reviews) {
		const catalogEntry = catalog.entries.find((entry) => entry.targetId === review.targetId);
		if (
			review.reviewer !== actor ||
			!catalogEntry ||
			catalogEntry.cohort !== 'controlled' ||
			catalogEntry.status !== 'candidate' ||
			catalogEntry.candidateHash !== review.candidateContentHash
		) {
			throw new Error(
				`Blind review ${review.reviewId} is not current actor-bound candidate evidence.`
			);
		}
	}
	const reviseResults = FinalControlledOriginalReviseResults.map((expected) => {
		const matches = results.filter(
			(result) =>
				result.resultId === expected.id &&
				result.targetId === expected.targetId &&
				result.status === 'revise'
		);
		if (matches.length !== 1) {
			throw new Error(`Missing exact immutable revise result ${expected.id}.`);
		}
		return { ...expected, contentHash: sha256Json(matches[0]) };
	});

	const claimedOutputPaths = new Set<string>();
	const resolutions = FinalControlledDesignRisks.map((risk, index) => {
		const humanDecision = decision.decisions[index]!;
		const originalTargetId = originalTargetIdForCoordinate(risk.coordinate);
		const revise = reviseResults.find((result) => result.targetId === originalTargetId);
		const blindReview = blindByTarget.get(originalTargetId);
		if (!revise && !blindReview) {
			throw new Error(`Risk ${risk.riskId} lacks evidence for its own original coordinate.`);
		}
		let stagedTarget = null;
		if (humanDecision.decision.startsWith('replace-')) {
			const expected = bundle.targets.find((target) => target.targetId.endsWith(risk.coordinate));
			const stagedPath = FinalControlledDesignRiskStagedTargetPaths[index]!;
			if (!expected) throw new Error(`No final-controlled target exists for ${risk.coordinate}.`);
			for (const ownedPath of Object.values(expected.output)) {
				if (claimedOutputPaths.has(ownedPath)) {
					throw new Error(`Staged replacement output collision: ${ownedPath}.`);
				}
				claimedOutputPaths.add(ownedPath);
			}
			stagedTarget = verifyStagedTarget({
				index,
				decision: humanDecision,
				expected,
				verification: input.evidence.staged[stagedPath]
			});
		}
		return {
			...humanDecision,
			status: 'resolved' as const,
			blindReviewEvidence: blindReview
				? [
						{
							id: blindReview.reviewId,
							targetId: blindReview.targetId,
							candidateContentHash: blindReview.candidateContentHash,
							contentHash: sha256Json(blindReview)
						}
					]
				: [],
			reviseResultEvidence: revise ? [revise] : [],
			stagedTarget
		};
	});

	const ledger = FinalControlledDesignRiskResolutionLedgerV2Schema.parse({
		schemaVersion: 'affinity-final-controlled-design-risk-resolutions-v2',
		experimentId: EXPERIMENT_ID,
		scopeId: SCOPE_ID,
		status: 'resolved',
		resolutionId: decision.decisionId,
		actor: decision.actor,
		decidedAt: decision.decidedAt,
		mode: 'human-interactive-db-export',
		humanDecisionRecord: {
			record: decision,
			recordCanonicalSha256: sha256Json(decision)
		},
		evidenceBindings: recomputedBindings,
		eligibleOriginalControlledTargetIds: [...FinalControlledEligibleOriginalCandidateTargetIds],
		reviseResults,
		resolutions
	});
	return verifyFinalControlledDesignRiskResolutionLedger(ledger);
}

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

async function loadCurrentEvidence(
	workspaceRoot: string,
	decision: FinalControlledDesignRiskDecisionRecord
): Promise<FinalControlledDesignRiskExportEvidence> {
	const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const plan = await readJson(path.join(experimentRoot, 'review/final-controlled-rerun-plan.json'));
	const catalog = await readJson(path.join(experimentRoot, 'review/catalog.json'));
	const blindReviewCollection = await readJson(
		path.join(experimentRoot, 'review/blind-review.json')
	);
	const parsedPlan = FinalControlledRerunPlanSchema.parse(plan);
	const targets = await Promise.all(
		parsedPlan.targets.map((target) =>
			readJson(path.join(experimentRoot, `targets/${target.speciesId}/${target.affinity}.json`))
		)
	);
	const results = await Promise.all(
		targets.map((target) =>
			readJson(
				path.resolve(workspaceRoot, ImageProductionTargetSchema.parse(target).output.resultPath)
			)
		)
	);
	const staged: Record<string, StagedVerification> = {};
	for (const [index, humanDecision] of decision.decisions.entries()) {
		if (!humanDecision.decision.startsWith('replace-')) continue;
		const stagedPath = FinalControlledDesignRiskStagedTargetPaths[index]!;
		staged[stagedPath] = await loadStagedVerification(workspaceRoot, stagedPath, stagedPath);
	}
	return { plan, catalog, targets, results, blindReviewCollection, staged };
}

async function readExisting(file: string): Promise<unknown | null> {
	return readFile(file, 'utf8').then(
		(text) => JSON.parse(text) as unknown,
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		}
	);
}

async function exclusivePublish(destination: string, value: unknown): Promise<void> {
	const temporary = `${destination}.resolution-export-${process.pid}-${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, jsonText(value), { encoding: 'utf8', flag: 'wx' });
		await link(temporary, destination);
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
}

export async function exportFinalControlledDesignRiskResolutions(input: {
	readonly workspaceRoot?: string;
	readonly databaseUrl: string;
	readonly actor: unknown;
	readonly mode: FinalControlledDesignRiskExportMode;
	readonly dependencies?: FinalControlledDesignRiskExporterDependencies;
}): Promise<FinalControlledDesignRiskExportReport> {
	const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
	const actor = explicitActor(input.actor);
	if (input.mode !== 'check' && input.mode !== 'write') {
		throw new Error('Export mode must be check or write.');
	}
	const dependencies = input.dependencies ?? {};
	const readiness = await (dependencies.loadReadiness ?? reportFinalControlledDesignRiskReadiness)(
		actor,
		workspaceRoot
	);
	let decisionList: FinalControlledDesignRiskDecisionList;
	try {
		decisionList = await (dependencies.loadDecisions ?? listFinalControlledDesignRiskDecisions)(
			input.databaseUrl,
			EXPERIMENT_ID,
			SCOPE_ID
		);
	} catch (error) {
		throw new Error('The final-controlled decision database is unavailable or invalid.', {
			cause: error
		});
	}
	const decision = selectCurrentHumanDecision({ actor, readiness, decisionList });
	const evidence = await (dependencies.loadEvidence ?? loadCurrentEvidence)(
		workspaceRoot,
		decision
	);
	const ledger = buildFinalControlledDesignRiskResolutionLedger({
		actor,
		readiness,
		decisionList,
		evidence
	});
	const destination = path.resolve(workspaceRoot, FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH);
	const existing = await readExisting(destination);
	if (existing !== null) {
		verifyFinalControlledDesignRiskResolutionLedger(existing, ledger);
	}
	let written = false;
	if (input.mode === 'write' && existing === null) {
		try {
			await exclusivePublish(destination, ledger);
			written = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			verifyFinalControlledDesignRiskResolutionLedger(await readExisting(destination), ledger);
		}
	}
	return {
		mode: input.mode,
		actor,
		decisionId: ledger.resolutionId,
		outputPath: FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH,
		written,
		inSync: existing !== null || written,
		ledgerCanonicalSha256: sha256Json(ledger),
		replacementCount: ledger.resolutions.filter((resolution) => resolution.stagedTarget).length,
		retainedCount: ledger.resolutions.filter((resolution) => !resolution.stagedTarget).length
	};
}

export function parseFinalControlledDesignRiskExportArgs(args: readonly string[]): {
	readonly mode: FinalControlledDesignRiskExportMode;
	readonly actor: string;
} {
	let mode: FinalControlledDesignRiskExportMode | undefined;
	let actor: string | undefined;
	let separatorSeen = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === '--') {
			if (separatorSeen) throw new Error('Specify the argument separator at most once.');
			separatorSeen = true;
		} else if (argument === '--check' || argument === '--write') {
			if (mode) throw new Error('Specify exactly one of --check or --write.');
			mode = argument === '--check' ? 'check' : 'write';
		} else if (argument === '--actor') {
			if (actor !== undefined) throw new Error('Specify --actor exactly once.');
			actor = args[++index];
			if (!actor || actor.startsWith('--')) throw new Error('Specify --actor <name>.');
		} else {
			throw new Error(`Unknown argument: ${argument ?? ''}`);
		}
	}
	if (!mode || actor === undefined) throw new Error('Usage: --check|--write --actor <name>');
	return { mode, actor: explicitActor(actor) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const options = parseFinalControlledDesignRiskExportArgs(process.argv.slice(2));
		const report = await exportFinalControlledDesignRiskResolutions({
			databaseUrl: getConfig().databaseUrl,
			...options
		});
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		if (!report.inSync) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}

import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import {
	FinalControlledDesignRiskDecisionCreateRequestSchema,
	FinalControlledDesignRiskDecisionListSchema,
	FinalControlledDesignRiskEvidenceBindingsSchema,
	FinalControlledDesignRisks,
	type FinalControlledDesignRiskDecisionList,
	type FinalControlledDesignRiskDecisionRecord
} from '@summonlab/contracts';
import {
	createFinalControlledDesignRiskDecision,
	listFinalControlledDesignRiskDecisions
} from '@summonlab/database';

import {
	reportFinalControlledDesignRiskReadiness,
	type FinalControlledDesignRiskReadinessReport
} from '../../../../../tools/final-controlled-design-risk-readiness.js';
import { sha256Json } from '../../../../../tools/image-production-lib.js';
import { findSummonlabRepositoryRoot } from './later-pack-rule-review.js';

const EXPERIMENT_ID = 'affinity-workflow-v1' as const;
const SCOPE_ID = 'final-controlled-activation-v1' as const;

type Readiness = FinalControlledDesignRiskReadinessReport;

interface FinalControlledDesignRiskClientRequest {
	readonly evidenceFingerprint: string;
	readonly decisions: FinalControlledDesignRiskDecisionRecord['decisions'];
	readonly attestation: FinalControlledDesignRiskDecisionRecord['attestation'];
}

export interface FinalControlledDesignRiskReviewDependencies {
	readonly loadConfig: () => {
		readonly databaseUrl: string;
		readonly affinityReviewActor: string | null;
	};
	readonly loadReadiness: (reviewer: string | null, workspaceRoot: string) => Promise<Readiness>;
	readonly listDecisions: typeof listFinalControlledDesignRiskDecisions;
	readonly createDecision: typeof createFinalControlledDesignRiskDecision;
	readonly createDecisionId: () => string;
}

const defaultDependencies: FinalControlledDesignRiskReviewDependencies = {
	loadConfig: () => getConfig(),
	loadReadiness: (reviewer, workspaceRoot) =>
		reportFinalControlledDesignRiskReadiness(reviewer, workspaceRoot),
	listDecisions: listFinalControlledDesignRiskDecisions,
	createDecision: createFinalControlledDesignRiskDecision,
	createDecisionId: randomUUID
};

export interface FinalControlledDesignRiskReviewSurface {
	readonly schemaVersion: 'final-controlled-design-risk-review-surface-v1';
	readonly status: 'ready' | 'locked';
	readonly ready: boolean;
	readonly actor: string | null;
	readonly evidenceFingerprint: string | null;
	readonly blockers: Readiness['blockers'];
	readonly counts: Readiness['counts'];
	readonly risks: ReadonlyArray<
		(typeof FinalControlledDesignRisks)[number] & {
			readonly decision: null;
			readonly humanRationale: '';
		}
	>;
	readonly attestation: {
		readonly producerDidNotResolveRisks: false;
		readonly reviewedEligibleBlindEvidence: false;
		readonly reviewedCompleteSourceAudit: false;
		readonly deliberatelyResolvedAllRisks: false;
		readonly understandsActivationRequiresIndependentVerification: false;
	};
	readonly history: readonly FinalControlledDesignRiskDecisionRecord[];
}

export class FinalControlledDesignRiskReviewRequestError extends Error {
	public constructor(
		public readonly status: 400 | 409,
		message: string,
		public readonly currentState?: FinalControlledDesignRiskReviewSurface
	) {
		super(message);
		this.name = 'FinalControlledDesignRiskReviewRequestError';
	}
}

function parseClientRequest(input: unknown): FinalControlledDesignRiskClientRequest {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new FinalControlledDesignRiskReviewRequestError(
			400,
			'The final-controlled design-risk decision is invalid: expected an object.'
		);
	}
	const value = input as Record<string, unknown>;
	const expectedKeys = ['attestation', 'decisions', 'evidenceFingerprint'];
	if (
		Object.keys(value).length !== expectedKeys.length ||
		Object.keys(value).some((key) => !expectedKeys.includes(key))
	) {
		throw new FinalControlledDesignRiskReviewRequestError(
			400,
			'The final-controlled design-risk decision is invalid: only evidenceFingerprint, decisions, and attestation are accepted.'
		);
	}
	const fingerprint =
		FinalControlledDesignRiskEvidenceBindingsSchema.shape.planCanonicalSha256.safeParse(
			value.evidenceFingerprint
		);
	const content = FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse({
		decisionId: '00000000-0000-4000-8000-000000000000',
		experimentId: EXPERIMENT_ID,
		scopeId: SCOPE_ID,
		mode: 'human-interactive',
		actor: 'server-validation-placeholder',
		evidenceBindings: {
			planCanonicalSha256: '0'.repeat(64),
			catalogCanonicalSha256: '0'.repeat(64),
			executionSnapshotCanonicalSha256: '0'.repeat(64),
			blindReviewCollectionCanonicalSha256: '0'.repeat(64),
			sourceAuditCanonicalSha256: '0'.repeat(64)
		},
		supersedesDecisionId: null,
		decisions: value.decisions,
		attestation: value.attestation
	});
	if (!fingerprint.success || !content.success) {
		const issues = [
			...(fingerprint.success ? [] : fingerprint.error.issues),
			...(content.success ? [] : content.error.issues)
		];
		throw new FinalControlledDesignRiskReviewRequestError(
			400,
			`The final-controlled design-risk decision is invalid: ${issues
				.map((issue) => issue.message)
				.join('; ')}`
		);
	}
	return {
		evidenceFingerprint: fingerprint.data,
		decisions: content.data.decisions,
		attestation: content.data.attestation
	};
}

function actorHistory(
	actor: string,
	decisionList: FinalControlledDesignRiskDecisionList
): FinalControlledDesignRiskDecisionList {
	return FinalControlledDesignRiskDecisionListSchema.parse({
		experimentId: EXPERIMENT_ID,
		scopeId: SCOPE_ID,
		records: decisionList.records.filter((record) => record.actor === actor),
		latestByActor: decisionList.latestByActor.filter((record) => record.actor === actor)
	});
}

function blankRisks(): FinalControlledDesignRiskReviewSurface['risks'] {
	return FinalControlledDesignRisks.map((risk) => ({
		...risk,
		decision: null,
		humanRationale: ''
	}));
}

function blankAttestation(): FinalControlledDesignRiskReviewSurface['attestation'] {
	return {
		producerDidNotResolveRisks: false,
		reviewedEligibleBlindEvidence: false,
		reviewedCompleteSourceAudit: false,
		deliberatelyResolvedAllRisks: false,
		understandsActivationRequiresIndependentVerification: false
	};
}

function buildSurface(
	actor: string | null,
	readiness: Readiness,
	history: readonly FinalControlledDesignRiskDecisionRecord[]
): FinalControlledDesignRiskReviewSurface {
	const ready =
		actor !== null && readiness.status === 'ready' && readiness.evidenceBindings !== null;
	return {
		schemaVersion: 'final-controlled-design-risk-review-surface-v1',
		status: ready ? 'ready' : 'locked',
		ready,
		actor,
		evidenceFingerprint: ready ? sha256Json(readiness.evidenceBindings) : null,
		blockers: readiness.blockers,
		counts: readiness.counts,
		risks: blankRisks(),
		attestation: blankAttestation(),
		history
	};
}

async function loadCurrentState(input: {
	readonly workspaceRoot?: string;
	readonly dependencies?: FinalControlledDesignRiskReviewDependencies;
}): Promise<{
	readonly databaseUrl: string;
	readonly actor: string | null;
	readonly readiness: Readiness;
	readonly decisions: FinalControlledDesignRiskDecisionList;
	readonly surface: FinalControlledDesignRiskReviewSurface;
}> {
	const dependencies = input.dependencies ?? defaultDependencies;
	const config = dependencies.loadConfig();
	const actor = config.affinityReviewActor;
	const workspaceRoot = input.workspaceRoot ?? findSummonlabRepositoryRoot();
	const readinessPromise = dependencies.loadReadiness(actor, workspaceRoot);
	const decisionListPromise = actor
		? dependencies.listDecisions(config.databaseUrl, EXPERIMENT_ID, SCOPE_ID)
		: Promise.resolve({
				experimentId: EXPERIMENT_ID,
				scopeId: SCOPE_ID,
				records: [],
				latestByActor: []
			});
	const [readiness, unfilteredDecisions] = await Promise.all([
		readinessPromise,
		decisionListPromise
	]);
	const decisions = actor
		? actorHistory(actor, FinalControlledDesignRiskDecisionListSchema.parse(unfilteredDecisions))
		: FinalControlledDesignRiskDecisionListSchema.parse(unfilteredDecisions);
	return {
		databaseUrl: config.databaseUrl,
		actor,
		readiness,
		decisions,
		surface: buildSurface(actor, readiness, decisions.records)
	};
}

export async function loadFinalControlledDesignRiskReviewSurface(
	input: {
		readonly workspaceRoot?: string;
		readonly dependencies?: FinalControlledDesignRiskReviewDependencies;
	} = {}
): Promise<FinalControlledDesignRiskReviewSurface> {
	return (await loadCurrentState(input)).surface;
}

export async function createFinalControlledDesignRiskReview(input: {
	readonly request: unknown;
	readonly workspaceRoot?: string;
	readonly dependencies?: FinalControlledDesignRiskReviewDependencies;
}) {
	const parsed = parseClientRequest(input.request);

	const dependencies = input.dependencies ?? defaultDependencies;
	const current = await loadCurrentState({
		workspaceRoot: input.workspaceRoot,
		dependencies
	});
	if (!current.surface.ready || !current.actor || !current.readiness.evidenceBindings) {
		throw new FinalControlledDesignRiskReviewRequestError(
			409,
			'Final-controlled design-risk review is locked until the authoritative evidence is ready.',
			current.surface
		);
	}
	if (parsed.evidenceFingerprint !== current.surface.evidenceFingerprint) {
		throw new FinalControlledDesignRiskReviewRequestError(
			409,
			'The final-controlled design-risk evidence changed. Reload before deciding.',
			current.surface
		);
	}

	const latest = current.decisions.latestByActor[0] ?? null;
	if (
		latest &&
		sha256Json({
			evidenceBindings: latest.evidenceBindings,
			decisions: latest.decisions,
			attestation: latest.attestation
		}) ===
			sha256Json({
				evidenceBindings: current.readiness.evidenceBindings,
				decisions: parsed.decisions,
				attestation: parsed.attestation
			})
	) {
		return { decision: latest, created: false };
	}
	const authoritativeRequest = FinalControlledDesignRiskDecisionCreateRequestSchema.parse({
		decisionId: dependencies.createDecisionId(),
		experimentId: EXPERIMENT_ID,
		scopeId: SCOPE_ID,
		mode: 'human-interactive',
		actor: current.actor,
		evidenceBindings: current.readiness.evidenceBindings,
		supersedesDecisionId: latest?.decisionId ?? null,
		decisions: parsed.decisions,
		attestation: parsed.attestation
	});
	return dependencies.createDecision(current.databaseUrl, authoritativeRequest);
}

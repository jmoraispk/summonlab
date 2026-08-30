import {
	FinalControlledDesignRiskDecisionCreateRequestSchema,
	FinalControlledDesignRiskDecisionListSchema,
	FinalControlledDesignRiskDecisionRecordSchema,
	FinalControlledDesignRiskDecisionScopeSchema,
	type FinalControlledDesignRiskDecisionCreateRequest,
	type FinalControlledDesignRiskDecisionList,
	type FinalControlledDesignRiskDecisionRecord
} from '@summonlab/contracts';
import postgres from 'postgres';

interface DecisionRow {
	decision_id: string;
	experiment_id: string;
	scope_id: string;
	mode: string;
	actor: string;
	plan_canonical_sha256: string;
	catalog_canonical_sha256: string;
	execution_snapshot_canonical_sha256: string;
	blind_review_collection_canonical_sha256: string;
	source_audit_canonical_sha256: string;
	supersedes_decision_id: string | null;
	decisions: unknown;
	attestation: unknown;
	decided_at: Date | string;
}

export class FinalControlledDesignRiskDecisionIdempotencyConflictError extends Error {
	public readonly code = 'FINAL_CONTROLLED_DESIGN_RISK_DECISION_IDEMPOTENCY_CONFLICT';

	public constructor(decisionId: string) {
		super(`Final-controlled design-risk decision id ${decisionId} was reused for other evidence`);
		this.name = 'FinalControlledDesignRiskDecisionIdempotencyConflictError';
	}
}

export class FinalControlledDesignRiskDecisionSupersessionConflictError extends Error {
	public readonly code = 'FINAL_CONTROLLED_DESIGN_RISK_DECISION_SUPERSESSION_CONFLICT';

	public constructor(message: string) {
		super(message);
		this.name = 'FinalControlledDesignRiskDecisionSupersessionConflictError';
	}
}

function fromRow(row: DecisionRow): FinalControlledDesignRiskDecisionRecord {
	return FinalControlledDesignRiskDecisionRecordSchema.parse({
		decisionId: row.decision_id,
		experimentId: row.experiment_id,
		scopeId: row.scope_id,
		mode: row.mode,
		actor: row.actor,
		evidenceBindings: {
			planCanonicalSha256: row.plan_canonical_sha256,
			catalogCanonicalSha256: row.catalog_canonical_sha256,
			executionSnapshotCanonicalSha256: row.execution_snapshot_canonical_sha256,
			blindReviewCollectionCanonicalSha256: row.blind_review_collection_canonical_sha256,
			sourceAuditCanonicalSha256: row.source_audit_canonical_sha256
		},
		supersedesDecisionId: row.supersedes_decision_id,
		decisions: row.decisions,
		attestation: row.attestation,
		decidedAt:
			row.decided_at instanceof Date
				? row.decided_at.toISOString()
				: new Date(row.decided_at).toISOString()
	});
}

function matchesRequest(
	record: FinalControlledDesignRiskDecisionRecord,
	request: FinalControlledDesignRiskDecisionCreateRequest
): boolean {
	return (
		record.decisionId === request.decisionId &&
		record.experimentId === request.experimentId &&
		record.scopeId === request.scopeId &&
		record.mode === request.mode &&
		record.actor === request.actor &&
		JSON.stringify(record.evidenceBindings) === JSON.stringify(request.evidenceBindings) &&
		record.supersedesDecisionId === request.supersedesDecisionId &&
		JSON.stringify(record.decisions) === JSON.stringify(request.decisions) &&
		JSON.stringify(record.attestation) === JSON.stringify(request.attestation)
	);
}

export async function createFinalControlledDesignRiskDecision(
	databaseUrl: string,
	input: FinalControlledDesignRiskDecisionCreateRequest
): Promise<{ decision: FinalControlledDesignRiskDecisionRecord; created: boolean }> {
	const request = FinalControlledDesignRiskDecisionCreateRequestSchema.parse(input);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			await transaction`select pg_advisory_xact_lock(hashtext(${request.decisionId}))`;
			await transaction`
				select pg_advisory_xact_lock(
					hashtext(${JSON.stringify([request.experimentId, request.scopeId, request.actor])})
				)
			`;
			const existing = await transaction<DecisionRow[]>`
				select * from summonlab_final_controlled_design_risk_decisions
				where decision_id = ${request.decisionId}
			`;
			if (existing[0]) {
				const decision = fromRow(existing[0]);
				if (!matchesRequest(decision, request)) {
					throw new FinalControlledDesignRiskDecisionIdempotencyConflictError(request.decisionId);
				}
				return { decision, created: false };
			}
			const latest = await transaction<DecisionRow[]>`
				select parent.*
				from summonlab_final_controlled_design_risk_decisions parent
				where parent.experiment_id = ${request.experimentId}
				  and parent.scope_id = ${request.scopeId}
				  and parent.actor = ${request.actor}
				  and not exists (
					select 1 from summonlab_final_controlled_design_risk_decisions child
					where child.supersedes_decision_id = parent.decision_id
				  )
				order by parent.decided_at desc, parent.decision_id desc
				limit 1
			`;
			const latestId = latest[0]?.decision_id ?? null;
			if (request.supersedesDecisionId !== latestId) {
				throw new FinalControlledDesignRiskDecisionSupersessionConflictError(
					latestId === null
						? 'The first decision for an actor and scope must not supersede another decision'
						: `A new decision must supersede the actor's current latest decision ${latestId}`
				);
			}
			const bindings = request.evidenceBindings;
			const inserted = await transaction<DecisionRow[]>`
				insert into summonlab_final_controlled_design_risk_decisions (
					decision_id, experiment_id, scope_id, mode, actor,
					plan_canonical_sha256, catalog_canonical_sha256,
					execution_snapshot_canonical_sha256,
					blind_review_collection_canonical_sha256,
					source_audit_canonical_sha256, supersedes_decision_id,
					decisions, attestation
				) values (
					${request.decisionId}, ${request.experimentId}, ${request.scopeId}, ${request.mode},
					${request.actor}, ${bindings.planCanonicalSha256},
					${bindings.catalogCanonicalSha256},
					${bindings.executionSnapshotCanonicalSha256},
					${bindings.blindReviewCollectionCanonicalSha256},
					${bindings.sourceAuditCanonicalSha256}, ${request.supersedesDecisionId},
					${sql.json(request.decisions)}, ${sql.json(request.attestation)}
				)
				returning *
			`;
			return { decision: fromRow(inserted[0]!), created: true };
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function listFinalControlledDesignRiskDecisions(
	databaseUrl: string,
	experimentId: 'affinity-workflow-v1' = 'affinity-workflow-v1',
	scopeId: 'final-controlled-activation-v1' = 'final-controlled-activation-v1',
	options: { includeAutomated?: boolean } = {}
): Promise<FinalControlledDesignRiskDecisionList> {
	const scope = FinalControlledDesignRiskDecisionScopeSchema.parse({ experimentId, scopeId });
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = options.includeAutomated
			? await sql<DecisionRow[]>`
					select * from summonlab_final_controlled_design_risk_decisions
					where experiment_id = ${scope.experimentId} and scope_id = ${scope.scopeId}
					order by decided_at asc, decision_id asc
				`
			: await sql<DecisionRow[]>`
					select * from summonlab_final_controlled_design_risk_decisions
					where experiment_id = ${scope.experimentId} and scope_id = ${scope.scopeId}
					  and actor not like 'test:%'
					order by decided_at asc, decision_id asc
				`;
		const records = rows.map(fromRow);
		const superseded = new Set(
			records.flatMap((record) =>
				record.supersedesDecisionId ? [record.supersedesDecisionId] : []
			)
		);
		return FinalControlledDesignRiskDecisionListSchema.parse({
			experimentId: scope.experimentId,
			scopeId: scope.scopeId,
			records,
			latestByActor: records.filter((record) => !superseded.has(record.decisionId))
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

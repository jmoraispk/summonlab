import {
	LaterPackRulesHumanDecisionCreateRequestSchema,
	LaterPackRulesHumanDecisionListSchema,
	LaterPackRulesHumanDecisionRecordSchema,
	LaterPackRulesHumanDecisionScopeSchema,
	type LaterPackRulesHumanDecisionCreateRequest,
	type LaterPackRulesHumanDecisionList,
	type LaterPackRulesHumanDecisionRecord
} from '@summonlab/contracts';
import postgres from 'postgres';

interface DecisionRow {
	decision_id: string;
	experiment_id: string;
	round_id: string;
	mode: string;
	actor: string;
	proposal_canonical_sha256: string;
	source_readiness_canonical_sha256: string;
	supersedes_decision_id: string | null;
	decisions: unknown;
	attestation: unknown;
	decided_at: Date | string;
}

export class LaterPackRuleDecisionIdempotencyConflictError extends Error {
	public readonly code = 'LATER_PACK_RULE_DECISION_IDEMPOTENCY_CONFLICT';
	public constructor(decisionId: string) {
		super(`Later-pack rule decision id ${decisionId} was already used for different evidence`);
		this.name = 'LaterPackRuleDecisionIdempotencyConflictError';
	}
}

export class LaterPackRuleDecisionSupersessionConflictError extends Error {
	public readonly code = 'LATER_PACK_RULE_DECISION_SUPERSESSION_CONFLICT';
	public constructor(message: string) {
		super(message);
		this.name = 'LaterPackRuleDecisionSupersessionConflictError';
	}
}

function fromRow(row: DecisionRow): LaterPackRulesHumanDecisionRecord {
	return LaterPackRulesHumanDecisionRecordSchema.parse({
		decisionId: row.decision_id,
		experimentId: row.experiment_id,
		roundId: row.round_id,
		mode: row.mode,
		actor: row.actor,
		proposalCanonicalSha256: row.proposal_canonical_sha256,
		sourceReadinessCanonicalSha256: row.source_readiness_canonical_sha256,
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
	record: LaterPackRulesHumanDecisionRecord,
	request: LaterPackRulesHumanDecisionCreateRequest
): boolean {
	return (
		record.decisionId === request.decisionId &&
		record.experimentId === request.experimentId &&
		record.roundId === request.roundId &&
		record.mode === request.mode &&
		record.actor === request.actor &&
		record.proposalCanonicalSha256 === request.proposalCanonicalSha256 &&
		record.sourceReadinessCanonicalSha256 === request.sourceReadinessCanonicalSha256 &&
		record.supersedesDecisionId === request.supersedesDecisionId &&
		JSON.stringify(record.decisions) === JSON.stringify(request.decisions) &&
		JSON.stringify(record.attestation) === JSON.stringify(request.attestation)
	);
}

export async function createLaterPackRuleDecision(
	databaseUrl: string,
	input: LaterPackRulesHumanDecisionCreateRequest
): Promise<{ decision: LaterPackRulesHumanDecisionRecord; created: boolean }> {
	const request = LaterPackRulesHumanDecisionCreateRequestSchema.parse(input);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			await transaction`select pg_advisory_xact_lock(hashtext(${request.decisionId}))`;
			await transaction`
				select pg_advisory_xact_lock(
					hashtext(${JSON.stringify([request.experimentId, request.roundId, request.actor])})
				)
			`;
			const existing = await transaction<DecisionRow[]>`
				select * from summonlab_later_pack_rule_decisions
				where decision_id = ${request.decisionId}
			`;
			if (existing[0]) {
				const decision = fromRow(existing[0]);
				if (!matchesRequest(decision, request))
					throw new LaterPackRuleDecisionIdempotencyConflictError(request.decisionId);
				return { decision, created: false };
			}
			const latest = await transaction<DecisionRow[]>`
				select parent.*
				from summonlab_later_pack_rule_decisions parent
				where parent.experiment_id = ${request.experimentId}
				  and parent.round_id = ${request.roundId}
				  and parent.actor = ${request.actor}
				  and not exists (
					select 1 from summonlab_later_pack_rule_decisions child
					where child.supersedes_decision_id = parent.decision_id
				  )
				order by parent.decided_at desc, parent.decision_id desc
				limit 1
			`;
			const latestId = latest[0]?.decision_id ?? null;
			if (request.supersedesDecisionId !== latestId) {
				throw new LaterPackRuleDecisionSupersessionConflictError(
					latestId === null
						? 'The first decision for an actor must not supersede another decision'
						: `A new decision must supersede the actor's current latest decision ${latestId}`
				);
			}
			const inserted = await transaction<DecisionRow[]>`
				insert into summonlab_later_pack_rule_decisions (
					decision_id, experiment_id, round_id, mode, actor,
					proposal_canonical_sha256, source_readiness_canonical_sha256,
					supersedes_decision_id, decisions, attestation
				) values (
					${request.decisionId}, ${request.experimentId}, ${request.roundId}, ${request.mode},
					${request.actor}, ${request.proposalCanonicalSha256},
					${request.sourceReadinessCanonicalSha256}, ${request.supersedesDecisionId},
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

export async function listLaterPackRuleDecisions(
	databaseUrl: string,
	experimentId: 'affinity-workflow-v1' = 'affinity-workflow-v1',
	roundId: 'final-controlled-v1' = 'final-controlled-v1',
	options: { includeAutomated?: boolean } = {}
): Promise<LaterPackRulesHumanDecisionList> {
	const scope = LaterPackRulesHumanDecisionScopeSchema.parse({ experimentId, roundId });
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = options.includeAutomated
			? await sql<DecisionRow[]>`
					select * from summonlab_later_pack_rule_decisions
					where experiment_id = ${scope.experimentId} and round_id = ${scope.roundId}
					order by decided_at asc, decision_id asc
				`
			: await sql<DecisionRow[]>`
					select * from summonlab_later_pack_rule_decisions
					where experiment_id = ${scope.experimentId} and round_id = ${scope.roundId}
					  and actor not like 'test:%'
					order by decided_at asc, decision_id asc
				`;
		const records = rows.map(fromRow);
		const superseded = new Set(
			records.flatMap((record) =>
				record.supersedesDecisionId ? [record.supersedesDecisionId] : []
			)
		);
		return LaterPackRulesHumanDecisionListSchema.parse({
			experimentId: scope.experimentId,
			roundId: scope.roundId,
			records,
			latestByActor: records.filter((record) => !superseded.has(record.decisionId))
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

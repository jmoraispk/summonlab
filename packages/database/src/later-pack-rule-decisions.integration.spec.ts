import { randomUUID } from 'node:crypto';

import { LaterPackRuleDomains, LaterPackRuleIds } from '@summonlab/contracts';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	LaterPackRuleDecisionIdempotencyConflictError,
	LaterPackRuleDecisionSupersessionConflictError,
	createLaterPackRuleDecision,
	listLaterPackRuleDecisions
} from './later-pack-rule-decisions.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

async function cleanup(): Promise<void> {
	if (!databaseUrl) return;
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql`delete from summonlab_later_pack_rule_decisions where actor like 'test:rules-%'`;
	} finally {
		await sql.end();
	}
}

function request(actor: string, overrides: Record<string, unknown> = {}) {
	return {
		decisionId: randomUUID(),
		experimentId: 'affinity-workflow-v1' as const,
		roundId: 'final-controlled-v1' as const,
		mode: 'human-interactive' as const,
		actor,
		proposalCanonicalSha256: 'a'.repeat(64),
		sourceReadinessCanonicalSha256: 'b'.repeat(64),
		supersedesDecisionId: null,
		decisions: LaterPackRuleIds.map((ruleId, index) => ({
			ruleId,
			domain: LaterPackRuleDomains[index]!,
			textHash: String(index).repeat(64),
			decision: 'accepted' as const,
			humanRationale: `Human rationale for ${ruleId}.`
		})),
		attestation: {
			producerDidNotApprove: true as const,
			reviewedEligibleBlindEvidence: true as const,
			acceptsRulesForLaterPacks: true as const
		},
		...overrides
	};
}

describe('later-pack rule decision persistence', () => {
	beforeEach(cleanup);
	afterEach(cleanup);

	run(
		'is append-only, server-timestamped, idempotent, and linearly superseded per actor',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const actor = `test:rules-${randomUUID()}`;
			const firstRequest = request(actor);
			const first = await createLaterPackRuleDecision(databaseUrl, firstRequest);
			expect(first.created).toBe(true);
			expect(Date.parse(first.decision.decidedAt)).not.toBeNaN();
			expect(await createLaterPackRuleDecision(databaseUrl, firstRequest)).toEqual({
				decision: first.decision,
				created: false
			});

			await expect(
				createLaterPackRuleDecision(databaseUrl, {
					...firstRequest,
					sourceReadinessCanonicalSha256: 'c'.repeat(64)
				})
			).rejects.toBeInstanceOf(LaterPackRuleDecisionIdempotencyConflictError);
			await expect(createLaterPackRuleDecision(databaseUrl, request(actor))).rejects.toBeInstanceOf(
				LaterPackRuleDecisionSupersessionConflictError
			);

			const second = await createLaterPackRuleDecision(
				databaseUrl,
				request(actor, {
					supersedesDecisionId: first.decision.decisionId,
					sourceReadinessCanonicalSha256: 'c'.repeat(64)
				})
			);
			await expect(
				createLaterPackRuleDecision(
					databaseUrl,
					request(actor, { supersedesDecisionId: first.decision.decisionId })
				)
			).rejects.toBeInstanceOf(LaterPackRuleDecisionSupersessionConflictError);

			const other = await createLaterPackRuleDecision(databaseUrl, request(`${actor}-other`));
			const listed = await listLaterPackRuleDecisions(
				databaseUrl,
				'affinity-workflow-v1',
				'final-controlled-v1',
				{ includeAutomated: true }
			);
			expect(listed.records.filter((record) => record.actor.startsWith(actor))).toHaveLength(3);
			expect(listed.latestByActor).toEqual(
				expect.arrayContaining([second.decision, other.decision])
			);
			expect(listed.latestByActor).not.toContainEqual(first.decision);
		}
	);
});

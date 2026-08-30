import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
	LaterPackRuleDomains,
	LaterPackRuleIds,
	LaterPackRulesHumanDecisionListSchema,
	LaterPackRulesHumanDecisionRecordSchema
} from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sha256Json } from './image-production-lib.js';
import {
	ACCEPTED_LATER_PACK_RULES_PATH,
	AcceptedLaterPackVisualRulesV2Schema
} from './report-later-pack-visual-rules-readiness.js';
import {
	buildAcceptedLaterPackVisualRulesArtifact,
	exportAcceptedLaterPackVisualRules
} from './export-accepted-later-pack-visual-rules.js';

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function readiness() {
	return {
		eligibleForHumanAcceptance: true,
		blockers: [],
		bindings: {
			proposalCanonicalSha256: 'a'.repeat(64),
			planCanonicalSha256: 'b'.repeat(64),
			activationReceiptCanonicalSha256: 'c'.repeat(64),
			catalogCanonicalSha256: 'd'.repeat(64),
			blindReviewCollectionCanonicalSha256: 'e'.repeat(64),
			executionSnapshotCanonicalSha256: 'f'.repeat(64),
			gateEvidenceCanonicalSha256: '1'.repeat(64),
			sourceReadinessCanonicalSha256: '2'.repeat(64),
			eligibleBlindReviews: Array.from({ length: 24 }, (_, index) => ({
				reviewId: `00000000-0000-4000-8${String(index).padStart(3, '0')}-000000000000`,
				targetId: `final-controlled-target-${index}`,
				candidateHash: '3'.repeat(64),
				reviewHash: String((index % 7) + 3).repeat(64)
			}))
		}
	};
}

function decision(overrides: Record<string, unknown> = {}) {
	return LaterPackRulesHumanDecisionRecordSchema.parse({
		decisionId: '11111111-1111-4111-8111-111111111111',
		experimentId: 'affinity-workflow-v1',
		roundId: 'final-controlled-v1',
		mode: 'human-interactive',
		actor: 'product-owner',
		proposalCanonicalSha256: 'a'.repeat(64),
		sourceReadinessCanonicalSha256: '2'.repeat(64),
		supersedesDecisionId: null,
		decisions: LaterPackRuleIds.map((ruleId, index) => ({
			ruleId,
			domain: LaterPackRuleDomains[index]!,
			textHash: String(index).repeat(64),
			decision: 'accepted',
			humanRationale: `Human acceptance rationale for ${ruleId}.`
		})),
		attestation: {
			producerDidNotApprove: true,
			reviewedEligibleBlindEvidence: true,
			acceptsRulesForLaterPacks: true
		},
		decidedAt: '2026-08-29T22:00:00.000Z',
		...overrides
	});
}

function list(records = [decision()], latestByActor = records.slice(-1)) {
	return LaterPackRulesHumanDecisionListSchema.parse({
		experimentId: 'affinity-workflow-v1',
		roundId: 'final-controlled-v1',
		records,
		latestByActor
	});
}

async function workspace(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-accepted-rules-'));
	roots.push(root);
	await mkdir(path.dirname(path.resolve(root, ACCEPTED_LATER_PACK_RULES_PATH)), {
		recursive: true
	});
	return root;
}

describe('accepted later-pack visual-rules export', () => {
	it('derives strict v2 evidence only from the actor’s latest accepted DB decision', () => {
		const record = decision();
		const artifact = buildAcceptedLaterPackVisualRulesArtifact({
			actor: record.actor,
			decisionList: list([record]),
			readiness: readiness()
		});
		expect(AcceptedLaterPackVisualRulesV2Schema.parse(artifact)).toBeTruthy();
		expect(artifact).toMatchObject({
			acceptanceId: record.decisionId,
			acceptedBy: record.actor,
			acceptedAt: record.decidedAt,
			humanDecisionRecord: { contentHash: sha256Json(record) }
		});
	});

	it('rejects rejected, stale, absent, and not-latest decisions', () => {
		const rejectedDecisions = decision().decisions.map((item, index) =>
			index === 0 ? { ...item, decision: 'rejected' as const } : item
		);
		expect(() =>
			buildAcceptedLaterPackVisualRulesArtifact({
				actor: 'product-owner',
				decisionList: list([decision({ decisions: rejectedDecisions })]),
				readiness: readiness()
			})
		).toThrow('All eight');
		expect(() =>
			buildAcceptedLaterPackVisualRulesArtifact({
				actor: 'product-owner',
				decisionList: list([decision({ proposalCanonicalSha256: '9'.repeat(64) })]),
				readiness: readiness()
			})
		).toThrow('stale');
		expect(() =>
			buildAcceptedLaterPackVisualRulesArtifact({
				actor: 'missing-actor',
				decisionList: list(),
				readiness: readiness()
			})
		).toThrow('No latest');
		const first = decision();
		const latest = decision({
			decisionId: '22222222-2222-4222-8222-222222222222',
			supersedesDecisionId: first.decisionId,
			sourceReadinessCanonicalSha256: '9'.repeat(64),
			decidedAt: '2026-08-29T23:00:00.000Z'
		});
		expect(() =>
			buildAcceptedLaterPackVisualRulesArtifact({
				actor: 'product-owner',
				decisionList: list([first, latest], [latest]),
				readiness: readiness()
			})
		).toThrow('stale');
	});

	it('keeps check mode zero-write and exclusive write idempotent', async () => {
		const root = await workspace();
		const loadReadiness = vi.fn(async () => readiness());
		const loadDecisions = vi.fn(async () => list());
		const base = {
			workspaceRoot: root,
			databaseUrl: 'not-used-by-loader',
			actor: 'product-owner',
			loadReadiness,
			loadDecisions
		};
		const checked = await exportAcceptedLaterPackVisualRules({ ...base, mode: 'check' });
		expect(checked).toMatchObject({ written: false, inSync: false });
		await expect(
			readFile(path.resolve(root, ACCEPTED_LATER_PACK_RULES_PATH), 'utf8')
		).rejects.toMatchObject({ code: 'ENOENT' });
		const written = await exportAcceptedLaterPackVisualRules({ ...base, mode: 'write' });
		expect(written).toMatchObject({ written: true, inSync: true });
		const bytes = await readFile(path.resolve(root, ACCEPTED_LATER_PACK_RULES_PATH), 'utf8');
		const repeated = await exportAcceptedLaterPackVisualRules({ ...base, mode: 'write' });
		expect(repeated).toMatchObject({ written: false, inSync: true });
		expect(await readFile(path.resolve(root, ACCEPTED_LATER_PACK_RULES_PATH), 'utf8')).toBe(bytes);
	});

	it('never overwrites a conflicting or prior-decision artifact', async () => {
		const root = await workspace();
		const destination = path.resolve(root, ACCEPTED_LATER_PACK_RULES_PATH);
		await writeFile(destination, '{"conflict":true}\n', 'utf8');
		await expect(
			exportAcceptedLaterPackVisualRules({
				workspaceRoot: root,
				databaseUrl: 'unused',
				actor: 'product-owner',
				mode: 'write',
				loadReadiness: async () => readiness(),
				loadDecisions: async () => list()
			})
		).rejects.toThrow('refusing to overwrite');
		expect(await readFile(destination, 'utf8')).toBe('{"conflict":true}\n');
	});

	it('fails closed on incomplete readiness or unavailable DB without writing', async () => {
		const root = await workspace();
		const databaseLoader = vi.fn(async () => {
			throw new Error('database unavailable');
		});
		await expect(
			exportAcceptedLaterPackVisualRules({
				workspaceRoot: root,
				databaseUrl: 'unavailable',
				actor: 'product-owner',
				mode: 'write',
				loadReadiness: async () => ({
					eligibleForHumanAcceptance: false,
					blockers: [{ code: 'final-cohort-incomplete', detail: 'No final cohort.' }]
				}),
				loadDecisions: databaseLoader
			})
		).rejects.toThrow('not eligible');
		expect(databaseLoader).not.toHaveBeenCalled();
		await expect(
			exportAcceptedLaterPackVisualRules({
				workspaceRoot: root,
				databaseUrl: 'unavailable',
				actor: 'product-owner',
				mode: 'write',
				loadReadiness: async () => readiness(),
				loadDecisions: databaseLoader
			})
		).rejects.toThrow('database unavailable');
		await expect(
			readFile(path.resolve(root, ACCEPTED_LATER_PACK_RULES_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});
});

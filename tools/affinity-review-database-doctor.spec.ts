import { describe, expect, it, vi } from 'vitest';

import {
	evaluateAffinityReviewDatabaseSnapshot,
	runAffinityReviewDatabaseDoctor,
	type AffinityReviewDatabaseSnapshot
} from './affinity-review-database-doctor.js';

const EXPECTED = [
	'0011_campaign_experience.sql',
	'0012_playtest_consent_analytics.sql',
	'0013_affinity_reviews.sql',
	'0014_affinity_review_mode.sql',
	'0015_later_pack_rule_decisions.sql',
	'0016_final_controlled_design_risk_decisions.sql',
	'0017_normalize_design_risk_index_names.sql'
] as const;

function healthySnapshot(): AffinityReviewDatabaseSnapshot {
	return {
		appliedMigrations: EXPECTED,
		tables: [
			'summonlab_migrations',
			'summonlab_affinity_workflow_reviews',
			'summonlab_later_pack_rule_decisions',
			'summonlab_final_controlled_design_risk_decisions'
		],
		columns: {
			summonlab_affinity_workflow_reviews: [
				'review_id',
				'experiment_id',
				'target_id',
				'candidate_content_hash',
				'reviewer',
				'identified_species_id',
				'identified_affinity',
				'species_identity_score',
				'affinity_readability_score',
				'silhouette_and_duty_score',
				'material_credibility_score',
				'anatomy_and_ground_contact_score',
				'affinity_integration_score',
				'style_cohesion_score',
				'verdict',
				'note',
				'reviewed_at',
				'review_mode'
			],
			summonlab_later_pack_rule_decisions: [
				'decision_id',
				'experiment_id',
				'round_id',
				'mode',
				'actor',
				'proposal_canonical_sha256',
				'source_readiness_canonical_sha256',
				'supersedes_decision_id',
				'decisions',
				'attestation',
				'decided_at'
			],
			summonlab_final_controlled_design_risk_decisions: [
				'decision_id',
				'experiment_id',
				'scope_id',
				'mode',
				'actor',
				'plan_canonical_sha256',
				'catalog_canonical_sha256',
				'execution_snapshot_canonical_sha256',
				'blind_review_collection_canonical_sha256',
				'source_audit_canonical_sha256',
				'supersedes_decision_id',
				'decisions',
				'attestation',
				'decided_at'
			]
		},
		indexes: [
			'summonlab_affinity_workflow_reviews_latest_idx',
			'summonlab_affinity_workflow_reviews_mode_latest_idx',
			'summonlab_later_pack_rule_decisions_first_actor_idx',
			'summonlab_later_pack_rule_decisions_superseded_once_idx',
			'summonlab_later_pack_rule_decisions_scope_time_idx',
			'summonlab_fc_design_risk_first_actor_idx',
			'summonlab_fc_design_risk_superseded_once_idx',
			'summonlab_final_controlled_design_risk_decisions_scope_time_idx'
		]
	};
}

describe('affinity review database doctor', () => {
	it('reports ready only when migration ledger and required schema objects are present', () => {
		const report = evaluateAffinityReviewDatabaseSnapshot({
			expectedMigrations: EXPECTED,
			snapshot: healthySnapshot()
		});
		expect(report).toMatchObject({
			status: 'ready',
			readOnly: true,
			migrationsApplied: false,
			credentialsReported: false,
			connection: 'available',
			missingMigrations: [],
			missingRequiredMigrations: [],
			missingTables: [],
			missingColumns: [],
			missingIndexes: [],
			failureCode: null
		});
	});

	it('identifies incomplete 0013-0017 ledger and schema state precisely', () => {
		const snapshot = healthySnapshot();
		const report = evaluateAffinityReviewDatabaseSnapshot({
			expectedMigrations: EXPECTED,
			snapshot: {
				...snapshot,
				appliedMigrations: EXPECTED.filter(
					(name) =>
						!name.startsWith('0014_') && !name.startsWith('0016_') && !name.startsWith('0017_')
				),
				tables: snapshot.tables.filter(
					(table) =>
						table !== 'summonlab_later_pack_rule_decisions' &&
						table !== 'summonlab_final_controlled_design_risk_decisions'
				),
				columns: {
					...snapshot.columns,
					summonlab_affinity_workflow_reviews: snapshot.columns[
						'summonlab_affinity_workflow_reviews'
					]!.filter((column) => column !== 'review_mode')
				},
				indexes: snapshot.indexes.filter(
					(index) => index !== 'summonlab_affinity_workflow_reviews_mode_latest_idx'
				)
			}
		});
		expect(report.status).toBe('blocked');
		expect(report.failureCode).toBe('schema-incomplete');
		expect(report.missingRequiredMigrations).toEqual([
			'0014_affinity_review_mode.sql',
			'0016_final_controlled_design_risk_decisions.sql',
			'0017_normalize_design_risk_index_names.sql'
		]);
		expect(report.missingTables).toContain('summonlab_later_pack_rule_decisions');
		expect(report.missingTables).toContain('summonlab_final_controlled_design_risk_decisions');
		expect(report.missingColumns).toContain('summonlab_affinity_workflow_reviews.review_mode');
		expect(report.missingIndexes).toContain('summonlab_affinity_workflow_reviews_mode_latest_idx');
	});

	it('uses only the injected probe and never invokes a migration or mutation dependency', async () => {
		const probe = vi.fn(async () => healthySnapshot());
		const report = await runAffinityReviewDatabaseDoctor({
			databaseUrl: 'postgresql://user:secret@localhost:5432/summonlab',
			loadExpectedMigrations: async () => EXPECTED,
			probe
		});
		expect(report.status).toBe('ready');
		expect(probe).toHaveBeenCalledOnce();
		expect(report.migrationsApplied).toBe(false);
	});

	it('fails without leaking credentials when connection or probing fails', async () => {
		const secretUrl = 'postgresql://private-user:extremely-secret@localhost:5432/summonlab';
		const report = await runAffinityReviewDatabaseDoctor({
			databaseUrl: secretUrl,
			loadExpectedMigrations: async () => EXPECTED,
			probe: async () => {
				throw new Error(`connect ECONNREFUSED ${secretUrl}`);
			}
		});
		const serialized = JSON.stringify(report);
		expect(report).toMatchObject({
			status: 'unavailable',
			connection: 'unavailable',
			failureCode: 'connection-or-probe-unavailable',
			readOnly: true,
			migrationsApplied: false,
			credentialsReported: false
		});
		expect(serialized).not.toContain('private-user');
		expect(serialized).not.toContain('extremely-secret');
		expect(serialized).not.toContain('postgresql://');
	});
});

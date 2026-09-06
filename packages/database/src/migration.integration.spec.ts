import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('database migration', () => {
	run('applies the foundation migration to PostgreSQL', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const sql = postgres(databaseUrl, { max: 1 });
		const directory = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
		const migrations = await Promise.all(
			(await readdir(directory))
				.filter((name) => name.endsWith('.sql'))
				.sort()
				.map((name) => readFile(join(directory, name), 'utf8'))
		);

		try {
			for (const migration of migrations) await sql.unsafe(migration);
			const rows = await sql<{ table_name: string }[]>`
				select table_name
				from information_schema.tables
				where table_schema = 'public'
					and table_name in (
						'summonlab_runtime_metadata',
						'summonlab_campaign_runs',
						'summonlab_proof_runs',
						'summonlab_proof_events',
						'summonlab_engine_runs',
						'summonlab_engine_commands',
						'summonlab_engine_events',
						'summonlab_engine_snapshots',
						'summonlab_engine_scheduled_events',
						'summonlab_engine_clocks',
						'summonlab_decision_jobs',
						'summonlab_decision_job_attempts',
						'summonlab_decision_job_transitions',
						'summonlab_playtest_consents',
						'summonlab_playtest_sessions',
						'summonlab_playtest_events',
						'summonlab_visual_asset_reviews',
						'summonlab_visual_recognition_reviews',
						'summonlab_affinity_workflow_reviews',
						'summonlab_later_pack_rule_decisions',
						'summonlab_final_controlled_design_risk_decisions'
					)
			`;
			expect(rows).toHaveLength(21);
			const proofColumns = await sql<
				{ column_name: string; is_nullable: 'YES' | 'NO'; column_default: string | null }[]
			>`
				select column_name, is_nullable, column_default
				from information_schema.columns
				where table_schema = 'public'
					and table_name = 'summonlab_proof_runs'
					and column_name in ('capability_profile', 'character_schema_version')
				order by column_name
			`;
			expect(proofColumns).toEqual([
				{ column_name: 'capability_profile', is_nullable: 'YES', column_default: null },
				{
					column_name: 'character_schema_version',
					is_nullable: 'NO',
					column_default: "'character-v1'::text"
				}
			]);
		} finally {
			await sql.end({ timeout: 5 });
		}
	});
});

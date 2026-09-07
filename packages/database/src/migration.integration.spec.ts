import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;
const execFileAsync = promisify(execFile);
const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const entropyMigrationName = '0020_private_capability_entropy_shape.sql';

describe.sequential('database migration', () => {
	run('applies the foundation migration to PostgreSQL', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const sql = postgres(databaseUrl, { max: 1 });
		const migrations = await Promise.all(
			(await readdir(migrationDirectory))
				.filter((name) => name.endsWith('.sql'))
				.sort()
				.map((name) => readFile(join(migrationDirectory, name), 'utf8'))
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
					and column_name in ('capability_entropy', 'capability_profile', 'character_schema_version')
				order by column_name
			`;
			expect(proofColumns).toEqual([
				{ column_name: 'capability_entropy', is_nullable: 'YES', column_default: null },
				{ column_name: 'capability_profile', is_nullable: 'YES', column_default: null },
				{
					column_name: 'character_schema_version',
					is_nullable: 'NO',
					column_default: "'character-v1'::text"
				}
			]);
			const entropyConstraints = await sql<{ constraint_name: string }[]>`
				select constraint_name
				from information_schema.table_constraints
				where table_schema = 'public'
					and table_name = 'summonlab_proof_runs'
					and constraint_name = 'summonlab_proof_runs_capability_entropy_shape'
			`;
			expect(entropyConstraints).toEqual([
				{ constraint_name: 'summonlab_proof_runs_capability_entropy_shape' }
			]);
		} finally {
			await sql.end({ timeout: 5 });
		}
	});

	run('reapplies the private entropy constraint without duplicate-object failure', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const sql = postgres(databaseUrl, { max: 1 });
		const statement = await readFile(join(migrationDirectory, entropyMigrationName), 'utf8');
		try {
			await sql.unsafe(statement);
			await sql.unsafe(statement);
			const [legacyState] = await sql<{ has_invalid_entropy: boolean }[]>`
				select exists (
					select 1
					from summonlab_proof_runs
					where capability_entropy is not null
						and capability_entropy !~ ${'^[0-9a-f]{64}$'}
				) as has_invalid_entropy
			`;
			const constraints = await sql<
				{ constraint_name: string; definition: string; convalidated: boolean }[]
			>`
				select
					conname as constraint_name,
					regexp_replace(pg_get_constraintdef(oid), ' NOT VALID$', '') as definition,
					convalidated
				from pg_constraint
				where conrelid = 'summonlab_proof_runs'::regclass
					and conname = 'summonlab_proof_runs_capability_entropy_shape'
			`;
			expect(constraints).toEqual([
				{
					constraint_name: 'summonlab_proof_runs_capability_entropy_shape',
					definition:
						"CHECK (((capability_entropy IS NULL) OR (capability_entropy ~ '^[0-9a-f]{64}$'::text)))",
					convalidated: !legacyState?.has_invalid_entropy
				}
			]);

			await expect(
				sql.begin(async (transaction) => {
					await transaction`
						insert into summonlab_proof_runs (
							run_id, control_mode, recipe, manifest, mind,
							manifest_hash, first_observation, capability_entropy
						) values (
							${randomUUID()}, 'autonomous', ${transaction.json({})},
							${transaction.json({})}, ${transaction.json({})},
							${'0'.repeat(64)}, '', ${'A'.repeat(64)}
						)
					`;
				})
			).rejects.toMatchObject({ code: '23514' });
		} finally {
			await sql.end({ timeout: 5 });
		}
	});

	run('validates the complete constraint when the database has no legacy violations', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const sql = postgres(databaseUrl, { max: 1 });
		const statement = await readFile(join(migrationDirectory, entropyMigrationName), 'utf8');
		const rollback = new Error('rollback clean entropy validation fixture');
		try {
			await expect(
				sql.begin(async (transaction) => {
					await transaction`
						alter table summonlab_proof_runs
						drop constraint summonlab_proof_runs_capability_entropy_shape
					`;
					await transaction`
						update summonlab_proof_runs
						set capability_entropy = null
						where capability_entropy is not null
							and capability_entropy !~ ${'^[0-9a-f]{64}$'}
					`;
					await transaction.unsafe(statement);
					const validation = await transaction<{ convalidated: boolean }[]>`
						select convalidated
						from pg_constraint
						where conrelid = 'summonlab_proof_runs'::regclass
							and conname = 'summonlab_proof_runs_capability_entropy_shape'
					`;
					expect(validation).toEqual([{ convalidated: true }]);
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await sql.end({ timeout: 5 });
		}
	});

	run('recovers when the constraint exists but its migration ledger entry is absent', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const sql = postgres(databaseUrl, { max: 1 });
		try {
			await sql`delete from summonlab_migrations where name = ${entropyMigrationName}`;
			await execFileAsync('pnpm', ['migrate'], {
				cwd: join(migrationDirectory, '..'),
				env: { ...process.env, DATABASE_URL: databaseUrl }
			});
			const ledger = await sql<{ name: string }[]>`
				select name from summonlab_migrations where name = ${entropyMigrationName}
			`;
			expect(ledger).toEqual([{ name: entropyMigrationName }]);
			await execFileAsync('pnpm', ['migrate'], {
				cwd: join(migrationDirectory, '..'),
				env: { ...process.env, DATABASE_URL: databaseUrl }
			});
		} finally {
			await sql.end({ timeout: 5 });
		}
	});
});

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
const combatWindowMigrationName = '0021_combat_decision_windows.sql';

describe.sequential('database migration', () => {
	run('applies the foundation migration to PostgreSQL', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const sourceUrl = new URL(databaseUrl);
		const temporaryDatabaseName = `summonlab_migration_${randomUUID().replaceAll('-', '')}`;
		const adminUrl = new URL(sourceUrl);
		adminUrl.pathname = '/postgres';
		const temporaryUrl = new URL(sourceUrl);
		temporaryUrl.pathname = `/${temporaryDatabaseName}`;
		const admin = postgres(adminUrl.toString(), { max: 1 });
		await admin`create database ${admin(temporaryDatabaseName)}`;
		const sql = postgres(temporaryUrl.toString(), { max: 1 });
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
						'summonlab_combat_decision_windows',
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
			expect(rows).toHaveLength(22);
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
			await admin`drop database ${admin(temporaryDatabaseName)}`;
			await admin.end({ timeout: 5 });
		}
	});

	run(
		'reapplies combat decision cohort storage and preserves legacy job null bindings',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const sql = postgres(databaseUrl, { max: 1 });
			const statement = await readFile(join(migrationDirectory, combatWindowMigrationName), 'utf8');
			try {
				await sql.unsafe(statement);
				await sql.unsafe(statement);
				const columns = await sql<{ column_name: string; is_nullable: 'YES' | 'NO' }[]>`
				select column_name, is_nullable from information_schema.columns
				where table_schema = 'public' and table_name = 'summonlab_decision_jobs'
					and column_name in ('window_id', 'actor_view_hash', 'deterministic_fallback')
				order by column_name
			`;
				expect(columns).toEqual([
					{ column_name: 'actor_view_hash', is_nullable: 'YES' },
					{ column_name: 'deterministic_fallback', is_nullable: 'YES' },
					{ column_name: 'window_id', is_nullable: 'YES' }
				]);
				const uniqueIndexes = await sql<{ indexname: string }[]>`
				select indexname from pg_indexes where schemaname = 'public'
					and tablename = 'summonlab_decision_jobs'
					and indexname = 'summonlab_decision_jobs_window_actor'
			`;
				expect(uniqueIndexes).toEqual([{ indexname: 'summonlab_decision_jobs_window_actor' }]);
				const legacyBindings = await sql<{ invalid_count: number }[]>`
				select count(*)::integer as invalid_count from summonlab_decision_jobs
				where schema_version in ('decision-job-v1', 'decision-job-v2')
					and (window_id is not null or actor_view_hash is not null or deterministic_fallback is not null)
			`;
				expect(legacyBindings).toEqual([{ invalid_count: 0 }]);
			} finally {
				await sql.end({ timeout: 5 });
			}
		}
	);

	run('rejects combat-shaped legacy jobs and non-combat v3 jobs at the SQL boundary', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const sql = postgres(databaseUrl, { max: 1 });
		const runId = randomUUID();
		const windowId = randomUUID();
		const actorId = randomUUID();
		const attemptId = randomUUID();
		const hash = 'e'.repeat(64);
		const source = {
			source: 'system',
			timing: null,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		};
		try {
			await sql`
				insert into summonlab_proof_runs (
					run_id, control_mode, recipe, manifest, mind, manifest_hash, first_observation
				) values (${runId}, 'wait', ${sql.json({})}, ${sql.json({})}, ${sql.json({})},
					${hash}, 'constraint fixture')
			`;
			await sql`
				insert into summonlab_engine_runs (
					run_id, seed, content_version, status, version, event_cursor, entropy_cursor,
					simulated_at, state_hash
				) values (${runId}, 'seed', 'engine-v26', 'active', 0, 1, 0, now(), ${hash})
			`;
			await sql`
				insert into summonlab_combat_decision_windows (
					window_id, run_id, attempt_id, tick, snapshot_hash, expected_run_version,
					expected_event_cursor, snapshot
				) values (${windowId}, ${runId}, ${attemptId}, 0, ${hash}, 0, 1, ${sql.json({})})
			`;

			const v2JobId = randomUUID();
			await expect(
				sql`
					insert into summonlab_decision_jobs (
						decision_job_id, schema_version, root_job_id, run_id, hero_id, decision_kind,
						requested_policy, expected_run_version, expected_event_cursor,
						decision_game_time, packet_id, packet_hash, state_hash, legal_action_hash,
						prompt_version, context_policy_version, packet
					) values (${v2JobId}, 'decision-job-v2', ${v2JobId}, ${runId}, ${actorId},
						'combat-action', 'scripted', 0, 1, now(), ${randomUUID()}, ${hash}, ${hash},
						${hash}, 'legacy-prompt-v1', 'legacy-context-v1', ${sql.json({})})
				`
			).rejects.toMatchObject({ code: '23514' });

			const v3JobId = randomUUID();
			await expect(
				sql`
					insert into summonlab_decision_jobs (
						decision_job_id, schema_version, root_job_id, run_id, hero_id, decision_kind,
						requested_policy, expected_run_version, expected_event_cursor,
						decision_game_time, packet_id, packet_hash, state_hash, legal_action_hash,
						prompt_version, context_policy_version, packet, window_id, actor_view_hash,
						deterministic_fallback
					) values (${v3JobId}, 'decision-job-v3', ${v3JobId}, ${runId}, ${actorId},
						'settlement-action', 'scripted', 0, 1, now(), ${windowId}, ${hash}, ${hash},
						${hash}, 'combat-action-prompt-v1', 'actor-decision-view-v1', ${sql.json({})},
						${windowId}, ${hash}, ${sql.json({})})
				`
			).rejects.toMatchObject({ code: '23514' });

			const exactCommandId = randomUUID();
			await sql`
				insert into summonlab_engine_commands (
					command_id, run_id, expected_version, command_type, command, correlation_id,
					accepted_sequence
				) values (${exactCommandId}, ${runId}, 0, 'mission.apply.combat-choice-batch',
					${sql.json({})}, ${exactCommandId}, 2)
			`;
			await sql`
				insert into summonlab_engine_events (
					event_id, run_id, sequence, schema_version, event_type, simulated_at, actor_id,
					command_id, causation_id, correlation_id, source, seed_cursor, before_state_hash,
					after_state_hash, content_version, payload
				) values (${randomUUID()}, ${runId}, 2, 26,
					'mission.combat.choice-batch.applied', now(), ${actorId}, ${exactCommandId}, null,
					${exactCommandId}, ${sql.json(source)}, 0, ${hash}, ${hash}, 'engine-v26',
					${sql.json({})})
			`;
			const wrongCommandId = randomUUID();
			await sql`
				insert into summonlab_engine_commands (
					command_id, run_id, expected_version, command_type, command, correlation_id,
					accepted_sequence
				) values (${wrongCommandId}, ${runId}, 0, 'mission.apply.combat-choice-batch',
					${sql.json({})}, ${wrongCommandId}, 3)
			`;
			await expect(
				sql`
					insert into summonlab_engine_events (
						event_id, run_id, sequence, schema_version, event_type, simulated_at, actor_id,
						command_id, causation_id, correlation_id, source, seed_cursor,
						before_state_hash, after_state_hash, content_version, payload
					) values (${randomUUID()}, ${runId}, 3, 26,
						'mission.combat.other-choice.applied', now(), ${actorId}, ${wrongCommandId}, null,
						${wrongCommandId}, ${sql.json(source)}, 0, ${hash}, ${hash}, 'engine-v26',
						${sql.json({})})
				`
			).rejects.toMatchObject({ code: '23514' });
		} finally {
			await sql`delete from summonlab_proof_runs where run_id = ${runId}`;
			await sql.end({ timeout: 5 });
		}
	});

	run('recovers the combat migration ledger with v3 rows present and then no-ops', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const sql = postgres(databaseUrl, { max: 1 });
		const runId = randomUUID();
		const windowId = randomUUID();
		const jobId = randomUUID();
		const actorId = randomUUID();
		const attemptId = randomUUID();
		const hash = 'd'.repeat(64);
		try {
			await sql.begin(async (transaction) => {
				await transaction`
					insert into summonlab_proof_runs (
						run_id, control_mode, recipe, manifest, mind, manifest_hash, first_observation
					) values (${runId}, 'wait', ${transaction.json({})}, ${transaction.json({})},
						${transaction.json({})}, ${hash}, 'migration fixture')
				`;
				await transaction`
					insert into summonlab_engine_runs (
						run_id, seed, content_version, status, version, event_cursor, entropy_cursor,
						simulated_at, state_hash
					) values (${runId}, 'seed', 'engine-v26', 'active', 0, 1, 0, now(), ${hash})
				`;
				await transaction`
					insert into summonlab_combat_decision_windows (
						window_id, run_id, attempt_id, tick, snapshot_hash, expected_run_version,
						expected_event_cursor, snapshot
					) values (${windowId}, ${runId}, ${attemptId}, 0, ${hash}, 0, 1, ${transaction.json({})})
				`;
				await transaction`
					insert into summonlab_decision_jobs (
						decision_job_id, schema_version, root_job_id, run_id, hero_id, decision_kind,
						requested_policy, expected_run_version, expected_event_cursor, decision_game_time,
						packet_id, packet_hash, state_hash, legal_action_hash, prompt_version,
						context_policy_version, packet, window_id, actor_view_hash, deterministic_fallback
					) values (${jobId}, 'decision-job-v3', ${jobId}, ${runId}, ${actorId},
						'combat-action', 'scripted', 0, 1, now(), ${windowId}, ${hash}, ${hash}, ${hash},
						'combat-action-prompt-v1', 'actor-decision-view-v1', ${transaction.json({})},
						${windowId}, ${hash}, ${transaction.json({})})
				`;
			});
			await sql`delete from summonlab_migrations where name = ${combatWindowMigrationName}`;
			await execFileAsync('pnpm', ['migrate'], {
				cwd: join(migrationDirectory, '..'),
				env: { ...process.env, DATABASE_URL: databaseUrl }
			});
			expect(
				await sql<{ name: string }[]>`
					select name from summonlab_migrations where name = ${combatWindowMigrationName}
				`
			).toEqual([{ name: combatWindowMigrationName }]);
			await execFileAsync('pnpm', ['migrate'], {
				cwd: join(migrationDirectory, '..'),
				env: { ...process.env, DATABASE_URL: databaseUrl }
			});
		} finally {
			await sql`delete from summonlab_proof_runs where run_id = ${runId}`;
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

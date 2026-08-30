import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getConfig } from '../packages/config/src/index.js';
import postgres from 'postgres';

const REQUIRED_MIGRATIONS = [
	'0013_affinity_reviews.sql',
	'0014_affinity_review_mode.sql',
	'0015_later_pack_rule_decisions.sql',
	'0016_final_controlled_design_risk_decisions.sql',
	'0017_normalize_design_risk_index_names.sql'
] as const;
const REQUIRED_TABLES = [
	'summonlab_migrations',
	'summonlab_affinity_workflow_reviews',
	'summonlab_later_pack_rule_decisions',
	'summonlab_final_controlled_design_risk_decisions'
] as const;
const REQUIRED_COLUMNS = {
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
} as const;
const REQUIRED_INDEXES = [
	'summonlab_affinity_workflow_reviews_latest_idx',
	'summonlab_affinity_workflow_reviews_mode_latest_idx',
	'summonlab_later_pack_rule_decisions_first_actor_idx',
	'summonlab_later_pack_rule_decisions_superseded_once_idx',
	'summonlab_later_pack_rule_decisions_scope_time_idx',
	'summonlab_fc_design_risk_first_actor_idx',
	'summonlab_fc_design_risk_superseded_once_idx',
	'summonlab_final_controlled_design_risk_decisions_scope_time_idx'
] as const;

export interface AffinityReviewDatabaseSnapshot {
	readonly appliedMigrations: readonly string[];
	readonly tables: readonly string[];
	readonly columns: Readonly<Record<string, readonly string[]>>;
	readonly indexes: readonly string[];
}

export type AffinityReviewDatabaseProbe = (
	databaseUrl: string
) => Promise<AffinityReviewDatabaseSnapshot>;
export type ExpectedMigrationLoader = (workspaceRoot: string) => Promise<readonly string[]>;

export interface AffinityReviewDatabaseDoctorReport {
	readonly schemaVersion: 'affinity-review-database-doctor-v1';
	readonly status: 'ready' | 'blocked' | 'unavailable';
	readonly readOnly: true;
	readonly migrationsApplied: false;
	readonly credentialsReported: false;
	readonly connection: 'available' | 'unavailable';
	readonly expectedMigrationCount: number;
	readonly appliedMigrationCount: number;
	readonly latestExpectedMigration: string | null;
	readonly missingMigrations: readonly string[];
	readonly missingRequiredMigrations: readonly string[];
	readonly unexpectedAppliedMigrations: readonly string[];
	readonly missingTables: readonly string[];
	readonly missingColumns: readonly string[];
	readonly missingIndexes: readonly string[];
	readonly failureCode: 'connection-or-probe-unavailable' | 'schema-incomplete' | null;
}

export function evaluateAffinityReviewDatabaseSnapshot(input: {
	readonly expectedMigrations: readonly string[];
	readonly snapshot: AffinityReviewDatabaseSnapshot;
}): AffinityReviewDatabaseDoctorReport {
	const expectedMigrations = [...new Set(input.expectedMigrations)].sort();
	const appliedMigrations = [...new Set(input.snapshot.appliedMigrations)].sort();
	const applied = new Set(appliedMigrations);
	const expected = new Set(expectedMigrations);
	const tables = new Set(input.snapshot.tables);
	const indexes = new Set(input.snapshot.indexes);
	const missingMigrations = expectedMigrations.filter((migration) => !applied.has(migration));
	const missingRequiredMigrations = REQUIRED_MIGRATIONS.filter(
		(migration) => !applied.has(migration)
	);
	const unexpectedAppliedMigrations = appliedMigrations.filter(
		(migration) => !expected.has(migration)
	);
	const missingTables = REQUIRED_TABLES.filter((table) => !tables.has(table));
	const missingColumns = Object.entries(REQUIRED_COLUMNS).flatMap(([table, required]) => {
		const actual = new Set(input.snapshot.columns[table] ?? []);
		return required.filter((column) => !actual.has(column)).map((column) => `${table}.${column}`);
	});
	const missingIndexes = REQUIRED_INDEXES.filter((index) => !indexes.has(index));
	const incomplete =
		missingMigrations.length > 0 ||
		missingRequiredMigrations.length > 0 ||
		missingTables.length > 0 ||
		missingColumns.length > 0 ||
		missingIndexes.length > 0;
	return {
		schemaVersion: 'affinity-review-database-doctor-v1',
		status: incomplete ? 'blocked' : 'ready',
		readOnly: true,
		migrationsApplied: false,
		credentialsReported: false,
		connection: 'available',
		expectedMigrationCount: expectedMigrations.length,
		appliedMigrationCount: appliedMigrations.length,
		latestExpectedMigration: expectedMigrations.at(-1) ?? null,
		missingMigrations,
		missingRequiredMigrations,
		unexpectedAppliedMigrations,
		missingTables,
		missingColumns,
		missingIndexes,
		failureCode: incomplete ? 'schema-incomplete' : null
	};
}

async function loadExpectedMigrations(workspaceRoot: string): Promise<readonly string[]> {
	return (await readdir(path.resolve(workspaceRoot, 'packages/database/migrations')))
		.filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/u.test(name))
		.sort();
}

async function probeDatabase(databaseUrl: string): Promise<AffinityReviewDatabaseSnapshot> {
	const sql = postgres(databaseUrl, {
		max: 1,
		connect_timeout: 2,
		idle_timeout: 1,
		max_lifetime: 5
	});
	try {
		return await sql.begin('read only', async (transaction) => {
			await transaction`select 1 as healthy`;
			const tableRows = await transaction<{ table_name: string }[]>`
				select table_name
				from information_schema.tables
				where table_schema = 'public'
				  and table_name in (
					'summonlab_migrations',
					'summonlab_affinity_workflow_reviews',
					'summonlab_later_pack_rule_decisions',
					'summonlab_final_controlled_design_risk_decisions'
				  )
				order by table_name
			`;
			const tables = tableRows.map((row) => row.table_name);
			const appliedMigrations = tables.includes('summonlab_migrations')
				? (
						await transaction<{ name: string }[]>`
							select name from public.summonlab_migrations order by name
						`
					).map((row) => row.name)
				: [];
			const columnRows = await transaction<{ table_name: string; column_name: string }[]>`
				select table_name, column_name
				from information_schema.columns
				where table_schema = 'public'
				  and table_name in (
					'summonlab_affinity_workflow_reviews',
					'summonlab_later_pack_rule_decisions',
					'summonlab_final_controlled_design_risk_decisions'
				  )
				order by table_name, ordinal_position
			`;
			const columns: Record<string, string[]> = {};
			for (const row of columnRows) (columns[row.table_name] ??= []).push(row.column_name);
			const indexRows = await transaction<{ indexname: string }[]>`
				select indexname
				from pg_catalog.pg_indexes
				where schemaname = 'public'
				  and tablename in (
					'summonlab_affinity_workflow_reviews',
					'summonlab_later_pack_rule_decisions',
					'summonlab_final_controlled_design_risk_decisions'
				  )
				order by indexname
			`;
			return {
				appliedMigrations,
				tables,
				columns,
				indexes: indexRows.map((row) => row.indexname)
			};
		});
	} finally {
		await sql.end({ timeout: 1 });
	}
}

function unavailableReport(
	expectedMigrations: readonly string[]
): AffinityReviewDatabaseDoctorReport {
	return {
		schemaVersion: 'affinity-review-database-doctor-v1',
		status: 'unavailable',
		readOnly: true,
		migrationsApplied: false,
		credentialsReported: false,
		connection: 'unavailable',
		expectedMigrationCount: expectedMigrations.length,
		appliedMigrationCount: 0,
		latestExpectedMigration: expectedMigrations.at(-1) ?? null,
		missingMigrations: [],
		missingRequiredMigrations: [],
		unexpectedAppliedMigrations: [],
		missingTables: [],
		missingColumns: [],
		missingIndexes: [],
		failureCode: 'connection-or-probe-unavailable'
	};
}

export async function runAffinityReviewDatabaseDoctor(
	options: {
		readonly workspaceRoot?: string;
		readonly databaseUrl?: string;
		readonly loadDatabaseUrl?: () => string;
		readonly loadExpectedMigrations?: ExpectedMigrationLoader;
		readonly probe?: AffinityReviewDatabaseProbe;
	} = {}
): Promise<AffinityReviewDatabaseDoctorReport> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const expectedMigrations = await (options.loadExpectedMigrations ?? loadExpectedMigrations)(
		workspaceRoot
	);
	let databaseUrl: string;
	try {
		databaseUrl =
			options.databaseUrl ?? (options.loadDatabaseUrl ?? (() => getConfig().databaseUrl))();
		if (!databaseUrl) return unavailableReport(expectedMigrations);
	} catch {
		return unavailableReport(expectedMigrations);
	}
	try {
		const snapshot = await (options.probe ?? probeDatabase)(databaseUrl);
		return evaluateAffinityReviewDatabaseSnapshot({ expectedMigrations, snapshot });
	} catch {
		// Deliberately omit the database URL and underlying message: drivers may echo credentials.
		return unavailableReport(expectedMigrations);
	}
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	if (process.argv.length !== 2) throw new Error('This read-only doctor accepts no CLI arguments.');
	const report = await runAffinityReviewDatabaseDoctor();
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (report.status !== 'ready') process.exitCode = 1;
}

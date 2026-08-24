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
						'summonlab_proof_runs',
						'summonlab_proof_events',
						'summonlab_engine_runs',
						'summonlab_engine_commands',
						'summonlab_engine_events',
						'summonlab_engine_snapshots',
						'summonlab_engine_scheduled_events',
						'summonlab_visual_asset_reviews'
					)
			`;
			expect(rows).toHaveLength(9);
		} finally {
			await sql.end({ timeout: 5 });
		}
	});
});

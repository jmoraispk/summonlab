import { readFile } from 'node:fs/promises';
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
		const migration = await readFile(
			join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations', '0001_foundation.sql'),
			'utf8'
		);

		try {
			await sql.unsafe(migration);
			const rows = await sql<{ table_name: string }[]>`
				select table_name
				from information_schema.tables
				where table_schema = 'public' and table_name = 'summonlab_runtime_metadata'
			`;
			expect(rows).toHaveLength(1);
		} finally {
			await sql.end({ timeout: 5 });
		}
	});
});

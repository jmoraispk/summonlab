import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getConfig } from '@summonlab/config';
import postgres from 'postgres';

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const config = getConfig();
const sql = postgres(config.databaseUrl, { max: 1 });

try {
	await sql`
		create table if not exists summonlab_migrations (
			name text primary key,
			applied_at timestamptz not null default now()
		)
	`;

	const files = (await readdir(migrationDirectory))
		.filter((file) => file.endsWith('.sql'))
		.sort((left, right) => left.localeCompare(right));

	for (const file of files) {
		const applied = await sql<{ name: string }[]>`
			select name from summonlab_migrations where name = ${file}
		`;
		if (applied.length > 0) continue;

		const statement = await readFile(join(migrationDirectory, file), 'utf8');
		await sql.begin(async (transaction) => {
			await transaction.unsafe(statement);
			await transaction`insert into summonlab_migrations (name) values (${file})`;
		});
	}
} finally {
	await sql.end({ timeout: 5 });
}

import type { DatabaseHealth } from '@summonlab/contracts';
import postgres from 'postgres';

export * from './affinity-review.js';
export * from './campaign.js';
export * from './catch-up.js';
export * from './clock.js';
export * from './decision-jobs.js';
export * from './proof.js';
export * from './engine.js';
export * from './events.js';
export * from './later-pack-rule-decisions.js';
export * from './playtest.js';
export * from './recognition-review.js';
export * from './visual-review.js';

export async function checkDatabaseHealth(databaseUrl: string): Promise<DatabaseHealth> {
	const startedAt = performance.now();
	const sql = postgres(databaseUrl, {
		max: 1,
		connect_timeout: 1,
		idle_timeout: 1,
		max_lifetime: 2
	});

	try {
		await sql`select 1 as healthy`;
		return {
			status: 'available',
			latencyMs: Math.round((performance.now() - startedAt) * 10) / 10
		};
	} catch {
		return { status: 'unavailable', latencyMs: null };
	} finally {
		await sql.end({ timeout: 1 });
	}
}

export async function openDatabase(databaseUrl: string) {
	return postgres(databaseUrl, { max: 5 });
}

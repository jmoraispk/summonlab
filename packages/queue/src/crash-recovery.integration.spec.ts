import { randomUUID } from 'node:crypto';

import { PgBoss } from 'pg-boss';
import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('pg-boss crash recovery spike', () => {
	run('redelivers a claimed job after its worker disappears', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const schema = `queue_spike_${randomUUID().replaceAll('-', '')}`;
		const queueName = 'crash-recovery';
		const producer = new PgBoss({
			connectionString: databaseUrl,
			schema,
			superviseIntervalSeconds: 1,
			monitorIntervalSeconds: 1
		});

		await producer.start();
		await producer.createQueue(queueName, {
			retryLimit: 1,
			retryDelay: 0,
			expireInSeconds: 1
		});
		const jobId = await producer.send(queueName, { runId: randomUUID() });
		const claimed = await producer.fetch(queueName);
		expect(claimed).toHaveLength(1);
		await producer.stop();

		const recovery = new PgBoss({
			connectionString: databaseUrl,
			schema,
			superviseIntervalSeconds: 1,
			monitorIntervalSeconds: 1,
			__test__enableSpies: true
		});

		try {
			await recovery.start();
			const spy = recovery.getSpy(queueName);
			await recovery.work(queueName, { pollingIntervalSeconds: 0.5 }, async () => ({
				recovered: true
			}));
			if (!jobId) throw new Error('Expected a job id');
			const completed = await spy.waitForJobWithId(jobId, 'completed');
			expect(completed.output).toEqual({ recovered: true });
		} finally {
			await recovery.stop();
		}
	});
});

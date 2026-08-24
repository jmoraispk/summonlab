import { PgBoss } from 'pg-boss';
import { z } from 'zod';

export const DECISION_QUEUE = 'hero-decision';

export const DecisionQueueJobSchema = z
	.object({
		decisionJobId: z.string().uuid()
	})
	.strict();

export const DecisionJobSchema = DecisionQueueJobSchema;
export type DecisionQueueJob = z.infer<typeof DecisionQueueJobSchema>;
export type DecisionJob = DecisionQueueJob;

export function createJobQueue(databaseUrl: string, testSpies = false): PgBoss {
	return new PgBoss({
		connectionString: databaseUrl,
		schema: 'summonlab_jobs',
		application_name: 'summonlab-worker',
		useListenNotify: true,
		persistWarnings: true,
		__test__enableSpies: testSpies
	});
}

export async function ensureDecisionQueue(queue: PgBoss): Promise<void> {
	await queue.createQueue(DECISION_QUEUE, {
		retryLimit: 0,
		expireInSeconds: 60,
		notify: true
	});
}

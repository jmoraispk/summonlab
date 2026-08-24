import { PgBoss } from 'pg-boss';
import { z } from 'zod';

export const DECISION_QUEUE = 'hero-decision';

export const DecisionJobSchema = z
	.object({
		decisionJobId: z.string().uuid(),
		runId: z.string().uuid(),
		heroId: z.string().uuid(),
		expectedRunVersion: z.number().int().nonnegative(),
		decisionGameTime: z.string().datetime({ offset: true }),
		legalActionHash: z.string().regex(/^[a-f0-9]{64}$/u),
		promptVersion: z.string().min(1).max(80),
		contextPolicyVersion: z.string().min(1).max(80)
	})
	.strict();

export type DecisionJob = z.infer<typeof DecisionJobSchema>;

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
		retryLimit: 2,
		retryDelay: 1,
		retryBackoff: true,
		expireInSeconds: 30,
		notify: true
	});
}

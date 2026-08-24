import { getConfig } from '@summonlab/config';
import { HealthResponseSchema, type HealthResponse } from '@summonlab/contracts';
import { checkDatabaseHealth } from '@summonlab/database';
import { createLogger } from '@summonlab/observability';

const config = getConfig();
const logger = createLogger({ service: 'web', level: config.logLevel });

export async function getWebHealth(requestId: string): Promise<HealthResponse> {
	const database = await checkDatabaseHealth(config.databaseUrl);
	const health = HealthResponseSchema.parse({
		status: database.status === 'available' ? 'ok' : 'degraded',
		service: 'web',
		version: '0.0.0',
		commit: config.commit,
		policyMode: config.policyMode,
		database,
		timestamp: new Date().toISOString(),
		requestId
	});

	logger.info(
		{
			requestId,
			status: health.status,
			databaseStatus: health.database.status,
			policyMode: health.policyMode
		},
		'health checked'
	);

	return health;
}

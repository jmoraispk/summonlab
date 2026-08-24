import { getConfig } from '@summonlab/config';
import { createLogger } from '@summonlab/observability';

import { createWorkerServer } from './server.js';

const config = getConfig();
const logger = createLogger({ service: 'worker', level: config.logLevel });
const server = createWorkerServer(config);

server.listen(config.workerPort, config.host, () => {
	logger.info(
		{
			host: config.host,
			port: config.workerPort,
			commit: config.commit,
			policyMode: config.policyMode
		},
		'worker health process listening'
	);
});

function shutdown(signal: string): void {
	logger.info({ signal }, 'worker shutting down');
	server.close((error) => {
		if (error) {
			logger.error({ error }, 'worker shutdown failed');
			process.exitCode = 1;
		}
	});
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

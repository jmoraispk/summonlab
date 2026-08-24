import { getConfig } from '@summonlab/config';
import { createLogger } from '@summonlab/observability';

import { startCatchUpWorker } from './catch-up.js';
import { createWorkerServer } from './server.js';

const config = getConfig();
const logger = createLogger({ service: 'worker', level: config.logLevel });
const server = createWorkerServer(config);
const catchUpWorker = startCatchUpWorker(config, logger);

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

let stopping = false;
async function shutdown(signal: string): Promise<void> {
	if (stopping) return;
	stopping = true;
	logger.info({ signal }, 'worker shutting down');
	await catchUpWorker.stop();
	await new Promise<void>((resolve) => {
		server.close((error) => {
			if (error) {
				logger.error({ error }, 'worker shutdown failed');
				process.exitCode = 1;
			}
			resolve();
		});
	});
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

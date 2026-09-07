import { getConfig } from '@summonlab/config';
import { createLogger } from '@summonlab/observability';

import { startCatchUpWorker } from './catch-up.js';
import { startCombatDecisionWorker } from './combat-decision.js';
import { startDecisionWorker } from './decision.js';
import { createWorkerServer } from './server.js';

const config = getConfig();
const logger = createLogger({ service: 'worker', level: config.logLevel });
const server = createWorkerServer(config);
const catchUpWorker = startCatchUpWorker(config, logger);
const decisionWorker = await startDecisionWorker(config, logger).catch((error) => {
	logger.error({ error }, 'decision worker unavailable; health process will remain online');
	return null;
});
const combatDecisionWorker = await startCombatDecisionWorker(config, logger).catch((error) => {
	logger.error({ error }, 'combat decision worker unavailable; health process will remain online');
	return null;
});

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
	await decisionWorker?.stop();
	await combatDecisionWorker?.stop();
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

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { AppConfig } from '@summonlab/config';
import { HealthResponseSchema } from '@summonlab/contracts';
import { checkDatabaseHealth } from '@summonlab/database';
import {
	createLogger,
	requestIdFromHeaders,
	requestLogger,
	REQUEST_ID_HEADER
} from '@summonlab/observability';

function toHeaders(request: IncomingMessage): Headers {
	const headers = new Headers();
	for (const [name, value] of Object.entries(request.headers)) {
		if (Array.isArray(value)) {
			for (const item of value) headers.append(name, item);
		} else if (value !== undefined) {
			headers.set(name, value);
		}
	}
	return headers;
}

function sendJson(
	response: ServerResponse,
	status: number,
	requestId: string,
	value: unknown
): void {
	response.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		[REQUEST_ID_HEADER]: requestId
	});
	response.end(JSON.stringify(value));
}

export function createWorkerServer(config: AppConfig): Server {
	const logger = createLogger({ service: 'worker', level: config.logLevel });

	return createServer(async (request, response) => {
		const requestId = requestIdFromHeaders(toHeaders(request));
		const log = requestLogger(logger, requestId);

		if (request.method !== 'GET' || request.url !== '/health') {
			sendJson(response, 404, requestId, { error: 'NOT_FOUND', requestId });
			return;
		}

		const database = await checkDatabaseHealth(config.databaseUrl);
		const health = HealthResponseSchema.parse({
			status: database.status === 'available' ? 'ok' : 'degraded',
			service: 'worker',
			version: '0.0.0',
			commit: config.commit,
			policyMode: config.policyMode,
			database,
			timestamp: new Date().toISOString(),
			requestId
		});

		log.info(
			{ status: health.status, databaseStatus: database.status, policyMode: config.policyMode },
			'health checked'
		);
		sendJson(response, health.status === 'ok' ? 200 : 503, requestId, health);
	});
}

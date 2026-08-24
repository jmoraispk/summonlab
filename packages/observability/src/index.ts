import { randomUUID } from 'node:crypto';

import pino, { type Logger } from 'pino';

const REQUEST_ID_HEADER = 'x-request-id';

export interface LoggerContext {
	service: string;
	level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

export function createLogger(context: LoggerContext): Logger {
	return pino({
		level: context.level,
		base: { service: context.service },
		redact: {
			paths: [
				'apiKey',
				'authorization',
				'req.headers.authorization',
				'headers.authorization',
				'playerDialogue',
				'decisionPacket.raw'
			],
			censor: '[REDACTED]'
		}
	});
}

export function requestIdFromHeaders(headers: Headers): string {
	const provided = headers.get(REQUEST_ID_HEADER)?.trim();
	if (provided && /^[a-zA-Z0-9._:-]{8,128}$/u.test(provided)) return provided;
	return randomUUID();
}

export function requestLogger(logger: Logger, requestId: string): Logger {
	return logger.child({ requestId });
}

export { REQUEST_ID_HEADER };

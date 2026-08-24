import { once } from 'node:events';

import { parseConfig } from '@summonlab/config';
import { HealthResponseSchema } from '@summonlab/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { createWorkerServer } from './server.js';

const servers: ReturnType<typeof createWorkerServer>[] = [];

afterEach(async () => {
	await Promise.all(
		servers.splice(0).map(
			(server) =>
				new Promise<void>((resolve, reject) => {
					server.close((error) => (error ? reject(error) : resolve()));
				})
		)
	);
});

describe('worker health process', () => {
	it('returns a typed degraded response when the database is offline', async () => {
		const config = parseConfig({
			NODE_ENV: 'test',
			DATABASE_URL: 'postgresql://summonlab:summonlab@127.0.0.1:1/summonlab',
			LOG_LEVEL: 'fatal',
			SUMMONLAB_COMMIT_SHA: 'test-commit'
		});
		const server = createWorkerServer(config);
		servers.push(server);
		server.listen(0, '127.0.0.1');
		await once(server, 'listening');
		const address = server.address();
		if (!address || typeof address === 'string') throw new Error('Expected a TCP address');

		const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
			headers: { 'x-request-id': 'worker-test-request' }
		});
		const payload = HealthResponseSchema.parse(await response.json());

		expect(response.status).toBe(503);
		expect(response.headers.get('x-request-id')).toBe('worker-test-request');
		expect(payload).toMatchObject({
			service: 'worker',
			commit: 'test-commit',
			requestId: 'worker-test-request',
			database: { status: 'unavailable' }
		});
	});
});

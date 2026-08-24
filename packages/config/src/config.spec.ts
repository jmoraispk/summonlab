import { describe, expect, it } from 'vitest';

import { parseConfig } from './index.js';

describe('configuration', () => {
	it('uses safe local defaults', () => {
		const config = parseConfig({});

		expect(config.policyMode).toBe('scripted');
		expect(config.workerPort).toBe(4174);
		expect(config.databaseUrl).toContain('54329/summonlab');
		expect(config.devRoutesEnabled).toBe(true);
	});

	it('keeps development inspectors off in production unless explicitly enabled', () => {
		expect(parseConfig({ NODE_ENV: 'production' }).devRoutesEnabled).toBe(false);
		expect(
			parseConfig({ NODE_ENV: 'production', ENABLE_DEV_ROUTES: 'true' }).devRoutesEnabled
		).toBe(true);
	});

	it('rejects invalid ports and policy modes', () => {
		expect(() => parseConfig({ WORKER_PORT: '70000' })).toThrow();
		expect(() => parseConfig({ POLICY_MODE: 'unbounded' })).toThrow();
	});
});

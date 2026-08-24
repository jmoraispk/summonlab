import { describe, expect, it } from 'vitest';

import { parseConfig } from './index.js';

describe('configuration', () => {
	it('uses safe local defaults', () => {
		const config = parseConfig({});

		expect(config.policyMode).toBe('scripted');
		expect(config.workerPort).toBe(4174);
		expect(config.simulationSpeed).toBe(4);
		expect(config.catchUpPollMs).toBe(1_000);
		expect(config.databaseUrl).toContain('54329/summonlab');
		expect(config.devRoutesEnabled).toBe(true);
		expect(config.imageGenerationEnabled).toBe(false);
		expect(config.openAiApiKey).toBeUndefined();
		expect(config.imageModel).toBe('gpt-image-2-2026-04-21');
		expect(config.imageQuality).toBe('low');
		expect(config.imageSize).toBe('1024x1536');
		expect(config.imageTimeoutMs).toBe(120_000);
	});

	it('requires an explicit image flag while keeping provider settings configurable', () => {
		const config = parseConfig({
			ENABLE_IMAGE_GENERATION: 'true',
			OPENAI_API_KEY: 'test-only-key',
			OPENAI_IMAGE_QUALITY: 'medium',
			OPENAI_IMAGE_SIZE: '1536x1024',
			OPENAI_IMAGE_TIMEOUT_MS: '90000'
		});

		expect(config.imageGenerationEnabled).toBe(true);
		expect(config.openAiApiKey).toBe('test-only-key');
		expect(config.imageQuality).toBe('medium');
		expect(config.imageSize).toBe('1536x1024');
		expect(config.imageTimeoutMs).toBe(90_000);
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
		expect(() => parseConfig({ SIMULATION_SPEED: '3' })).toThrow();
		expect(() => parseConfig({ CATCH_UP_POLL_MS: '100' })).toThrow();
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	refresh: vi.fn(),
	apply: vi.fn()
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({ databaseUrl: 'postgres://unused' })
}));

vi.mock('@summonlab/database', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@summonlab/database')>();
	return {
		...actual,
		getCombatDecisionWindow: mocks.get,
		refreshCombatDecisionWindow: mocks.refresh,
		applyCombatDecisionWindowBatch: mocks.apply
	};
});

import { GET } from './+server.js';

const collecting = {
	windowId: 'window-1',
	runId: 'run-1',
	attemptId: 'attempt-1',
	tick: 7,
	status: 'collecting',
	createdAt: '2000-01-01T00:00:00.000Z',
	updatedAt: '2000-01-01T00:00:01.000Z',
	jobs: [{ status: 'created', heroId: 'hero-1' }]
};

function call(runId = 'run-1'): Promise<Response> {
	return GET({ params: { runId, windowId: 'window-1' } } as never) as Promise<Response>;
}

describe('combat decision window polling', () => {
	beforeEach(() => {
		mocks.get.mockReset().mockResolvedValue(collecting);
		mocks.refresh.mockReset().mockResolvedValue(collecting);
		mocks.apply.mockReset();
	});

	it('returns only the public progress fields while decisions are collecting', async () => {
		const response = await call();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toStrictEqual({
			windowId: 'window-1',
			status: 'collecting',
			tick: 7,
			readyActors: 0,
			totalActors: 1,
			updatedAt: '2000-01-01T00:00:01.000Z'
		});
		expect(JSON.stringify(body)).not.toContain('hero-1');
	});

	it('rejects a window owned by another run', async () => {
		const response = await call('run-2');

		expect(response.status).toBe(404);
		expect(mocks.refresh).not.toHaveBeenCalled();
	});
});

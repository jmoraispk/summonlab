import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	window: null as null | Record<string, unknown>,
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
		getCombatDecisionWindow: vi.fn(async () => mocks.window),
		refreshCombatDecisionWindow: mocks.refresh,
		applyCombatDecisionWindowBatch: mocks.apply
	};
});

import { GET } from './+server.js';

const RUN_ID = '10000000-0000-4000-8000-000000000001';
const WINDOW_ID = '10000000-0000-4000-8000-000000000002';

function window(status: 'collecting' | 'ready' | 'applied' | 'stale' | 'failed') {
	return {
		windowId: WINDOW_ID,
		runId: RUN_ID,
		attemptId: '10000000-0000-4000-8000-000000000003',
		tick: 12,
		status,
		batch: status === 'ready' ? { batchVersion: 'combat-choice-batch-v1' } : null,
		updatedAt: '2000-01-01T00:00:00.000Z',
		jobs: [
			{ status: 'completed', actorViewHash: 'private-a', view: { legalActions: ['private'] } },
			{ status: 'created', actorViewHash: 'private-b', view: { legalActions: ['private'] } }
		]
	};
}

function call(runId = RUN_ID): Promise<Response> {
	return GET({ params: { runId, windowId: WINDOW_ID } } as never) as Promise<Response>;
}

describe('GET durable combat-window status', () => {
	beforeEach(() => {
		mocks.window = window('collecting');
		mocks.refresh.mockReset().mockImplementation(async () => mocks.window);
		mocks.apply.mockReset();
	});

	it('returns only public counts while a cohort is pending', async () => {
		const response = await call();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toStrictEqual({
			windowId: WINDOW_ID,
			status: 'collecting',
			tick: 12,
			readyActors: 1,
			totalActors: 2,
			updatedAt: '2000-01-01T00:00:00.000Z'
		});
		expect(JSON.stringify(body)).not.toMatch(/actorView|legalActions|provider|snapshot|batch/iu);
	});

	it('applies a ready batch through the authoritative CAS and reports the stored result', async () => {
		mocks.window = window('ready');
		mocks.refresh.mockResolvedValue(mocks.window);
		mocks.apply.mockResolvedValue({
			disposition: 'applied',
			window: window('applied'),
			receipt: { stateHash: 'private-state-hash' }
		});

		const response = await call();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mocks.apply).toHaveBeenCalledOnce();
		expect(body.status).toBe('applied');
		expect(JSON.stringify(body)).not.toContain('private-state-hash');
	});

	it('does not reapply an already-applied window on a duplicate poll', async () => {
		mocks.window = window('ready');
		mocks.refresh.mockImplementation(async () => mocks.window);
		mocks.apply.mockImplementation(async () => {
			mocks.window = window('applied');
			return { disposition: 'applied', window: mocks.window, receipt: {} };
		});

		expect((await (await call()).json()).status).toBe('applied');
		expect((await (await call()).json()).status).toBe('applied');
		expect(mocks.apply).toHaveBeenCalledOnce();
	});

	it.each(['applied', 'stale', 'failed'] as const)(
		'reports terminal window state %s without applying again',
		async (status) => {
			mocks.window = window(status);
			mocks.refresh.mockResolvedValue(mocks.window);
			const response = await call();
			expect((await response.json()).status).toBe(status);
			expect(mocks.apply).not.toHaveBeenCalled();
		}
	);

	it('does not reveal whether a window belongs to another run', async () => {
		const response = await call('10000000-0000-4000-8000-000000000099');
		expect(response.status).toBe(404);
		expect(mocks.refresh).not.toHaveBeenCalled();
	});
});

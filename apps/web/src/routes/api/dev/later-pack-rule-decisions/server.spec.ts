import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	devRoutesEnabled: true,
	list: vi.fn(),
	create: vi.fn()
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		devRoutesEnabled: mocks.devRoutesEnabled,
		databaseUrl: 'postgres://unused'
	})
}));

vi.mock('$lib/server/later-pack-rule-review.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/later-pack-rule-review.js')>();
	return {
		...actual,
		listLaterPackRuleReviewForActor: mocks.list,
		createLaterPackRuleReviewForActor: mocks.create
	};
});

import { GET, POST } from './+server.js';

async function callGet(search = ''): Promise<Response> {
	return (await GET({
		url: new URL(`http://summonlab.test/api/dev/later-pack-rule-decisions${search}`)
	} as never)) as Response;
}

async function callPost(search: string, body: unknown): Promise<Response> {
	return (await POST({
		url: new URL(`http://summonlab.test/api/dev/later-pack-rule-decisions${search}`),
		request: new Request('http://summonlab.test/api/dev/later-pack-rule-decisions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never)) as Response;
}

describe('later-pack rule decision API', () => {
	beforeEach(() => {
		mocks.devRoutesEnabled = true;
		mocks.list.mockReset();
		mocks.create.mockReset();
	});

	it('requires an explicit actor and lists that actor with no-store semantics', async () => {
		expect((await callGet()).status).toBe(400);
		mocks.list.mockResolvedValue({ actor: 'visual-director', decisions: { records: [] } });
		const response = await callGet('?actor=visual-director');
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(mocks.list).toHaveBeenCalledWith({
			databaseUrl: 'postgres://unused',
			actor: 'visual-director'
		});
	});

	it('delegates the untouched decision to the strict service and reports create/idempotency', async () => {
		const body = { decisions: [{ decision: 'rejected' }] };
		mocks.create.mockResolvedValue({ created: true, decision: { decisionId: 'decision-1' } });
		const created = await callPost('?actor=visual-director', body);
		expect(created.status).toBe(201);
		expect(mocks.create).toHaveBeenCalledWith({
			databaseUrl: 'postgres://unused',
			actor: 'visual-director',
			request: body
		});
		mocks.create.mockResolvedValue({ created: false, decision: { decisionId: 'decision-1' } });
		expect((await callPost('?actor=visual-director', body)).status).toBe(200);
	});

	it('keeps the endpoint disabled with developer routes and maps service failures', async () => {
		mocks.devRoutesEnabled = false;
		expect((await callGet('?actor=visual-director')).status).toBe(404);
		mocks.devRoutesEnabled = true;
		mocks.create.mockRejectedValue(new Error('database unavailable'));
		const response = await callPost('?actor=visual-director', {});
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			message: 'The later-pack rule decision could not be persisted.'
		});
	});
});

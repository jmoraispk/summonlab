import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	devRoutesEnabled: true,
	load: vi.fn(),
	create: vi.fn()
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		devRoutesEnabled: mocks.devRoutesEnabled,
		databaseUrl: 'postgres://unused',
		affinityReviewActor: 'visual-director'
	})
}));

vi.mock('$lib/server/final-controlled-design-risk-review.js', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('$lib/server/final-controlled-design-risk-review.js')>();
	return {
		...actual,
		loadFinalControlledDesignRiskReviewSurface: mocks.load,
		createFinalControlledDesignRiskReview: mocks.create
	};
});

import { FinalControlledDesignRiskDecisionIdempotencyConflictError } from '@summonlab/database';

import { FinalControlledDesignRiskReviewRequestError } from '$lib/server/final-controlled-design-risk-review.js';

import { GET, POST } from './+server.js';

async function callGet(): Promise<Response> {
	return (await GET({} as never)) as Response;
}

async function callPost(body: unknown): Promise<Response> {
	return (await POST({
		request: new Request('http://summonlab.test/api/dev/final-controlled-design-risk-decisions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never)) as Response;
}

describe('final-controlled design-risk decision API', () => {
	beforeEach(() => {
		mocks.devRoutesEnabled = true;
		mocks.load.mockReset();
		mocks.create.mockReset();
	});

	it('serves the server-derived review surface with no-store semantics', async () => {
		mocks.load.mockResolvedValue({
			status: 'ready',
			actor: 'visual-director',
			risks: [],
			history: []
		});
		const response = await callGet();
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toMatchObject({
			status: 'ready',
			actor: 'visual-director'
		});
		expect(mocks.load).toHaveBeenCalledWith();
	});

	it('passes only the received body to the strict service and reports creation', async () => {
		const body = {
			evidenceFingerprint: '1'.repeat(64),
			decisions: [],
			attestation: {}
		};
		mocks.create.mockResolvedValue({ created: true, decision: { decisionId: 'server-id' } });
		const response = await callPost(body);
		expect(response.status).toBe(201);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(mocks.create).toHaveBeenCalledWith({ request: body });
	});

	it('returns the current state with 409 when evidence changed', async () => {
		const currentState = {
			status: 'ready' as const,
			evidenceFingerprint: '2'.repeat(64)
		};
		mocks.create.mockRejectedValue(
			new FinalControlledDesignRiskReviewRequestError(
				409,
				'The evidence changed.',
				currentState as never
			)
		);
		const response = await callPost({});
		expect(response.status).toBe(409);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			message: 'The evidence changed.',
			currentState
		});
	});

	it('maps persistence races to an opaque 409 and disables the endpoint with dev routes', async () => {
		mocks.create.mockRejectedValue(
			new FinalControlledDesignRiskDecisionIdempotencyConflictError(
				'11111111-1111-4111-8111-111111111111'
			)
		);
		const conflict = await callPost({});
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toEqual({
			message: 'The decision history changed. Reload before deciding.'
		});

		mocks.devRoutesEnabled = false;
		expect((await callGet()).status).toBe(404);
		expect((await callPost({})).status).toBe(404);
	});
});

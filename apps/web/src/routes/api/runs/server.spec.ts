import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	generatedEntropy: null as string | null,
	persistedEntropy: null as string | null,
	persistenceFailure: null as string | null
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({ databaseUrl: 'postgres://unused', simulationSpeed: 1 })
}));

vi.mock('@summonlab/characters', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@summonlab/characters')>();
	return {
		...actual,
		generateSummonableCharacterDraft: vi.fn(
			async (recipe: unknown, options: { capabilityEntropy?: string }) => {
				mocks.generatedEntropy = options.capabilityEntropy ?? null;
				return {
					recipe,
					manifest: { characterId: '00000000-0000-4000-8000-000000000001' },
					manifestHash: 'a'.repeat(64)
				};
			}
		)
	};
});

vi.mock('@summonlab/database', () => ({
	createProofRun: vi.fn(async (_databaseUrl: string, input: { capabilityEntropy?: string }) => {
		mocks.persistedEntropy = input.capabilityEntropy ?? null;
		if (mocks.persistenceFailure) throw new Error(mocks.persistenceFailure);
		return { runId: '00000000-0000-4000-8000-000000000002', manifestHash: 'a'.repeat(64) };
	})
}));

import { POST } from './+server.js';

describe('POST /api/runs private capability entropy', () => {
	it('generates and persists a server-only high-entropy capability secret', async () => {
		const response = (await POST({
			request: new Request('http://summonlab.test/api/runs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					recipe: {
						seed: 'player-visible-recipe',
						generationVersion: 'human-v6',
						cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
					},
					controlMode: 'wait',
					directive: ''
				})
			})
		} as never)) as Response;

		expect(response.status).toBe(201);
		expect(mocks.generatedEntropy).toMatch(/^[a-f0-9]{64}$/u);
		expect(mocks.persistedEntropy).toBe(mocks.generatedEntropy);
		const serialized = JSON.stringify(await response.json());
		expect(serialized).not.toContain(mocks.generatedEntropy!);
		expect(serialized).not.toContain('player-visible-recipe');
	});

	it('does not reflect persistence details that could contain the private entropy', async () => {
		mocks.persistenceFailure = 'database rejected secret-value-that-must-stay-private';
		try {
			const response = (await POST({
				request: new Request('http://summonlab.test/api/runs', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						recipe: {
							seed: 'player-visible-recipe',
							generationVersion: 'human-v6',
							cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
						},
						controlMode: 'wait',
						directive: ''
					})
				})
			} as never)) as Response;

			expect(response.status).toBe(503);
			expect(JSON.stringify(await response.json())).not.toContain('secret-value-that-must-stay-private');
		} finally {
			mocks.persistenceFailure = null;
		}
	});
});

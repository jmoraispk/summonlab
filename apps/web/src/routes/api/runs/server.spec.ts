import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	combatMode: 'agent-readiness-v1' as 'legacy-auto-v1' | 'agent-readiness-v1',
	generatedEntropy: null as string | null,
	persistedEntropy: null as string | null,
	persistedCombatMode: null as string | null,
	persistenceFailure: null as string | null
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		databaseUrl: 'postgres://unused',
		simulationSpeed: 1,
		combatMode: mocks.combatMode
	})
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
					manifest: {
						characterId: '00000000-0000-4000-8000-000000000001',
						displayName: 'Public Hero',
						rarityStars: 1,
						adultAge: 24,
						heightCm: 172,
						bodyBuild: 'athletic',
						voice: { cadence: 'measured' },
						posture: 'grounded',
						artKey: null
					},
					manifestHash: 'a'.repeat(64)
				};
			}
		)
	};
});

vi.mock('@summonlab/database', () => ({
	createProofRun: vi.fn(
		async (_databaseUrl: string, input: { capabilityEntropy?: string; combatMode?: string }) => {
			mocks.persistedEntropy = input.capabilityEntropy ?? null;
			mocks.persistedCombatMode = input.combatMode ?? null;
			if (mocks.persistenceFailure) throw new Error(mocks.persistenceFailure);
			return { runId: '00000000-0000-4000-8000-000000000002', manifestHash: 'a'.repeat(64) };
		}
	)
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
		expect(mocks.persistedCombatMode).toBe('agent-readiness-v1');
		const serialized = JSON.stringify(await response.json());
		expect(Object.keys(JSON.parse(serialized)).sort()).toEqual(['publicManifestHash', 'runId']);
		expect(serialized).not.toContain(mocks.generatedEntropy!);
		expect(serialized).not.toContain('player-visible-recipe');
	});

	it('rejects client combat and provider overrides before run creation', async () => {
		mocks.persistedCombatMode = null;
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
					directive: '',
					combatMode: 'legacy-auto-v1',
					provider: 'random'
				})
			})
		} as never)) as Response;

		expect(response.status).toBe(400);
		expect(mocks.persistedCombatMode).toBeNull();
	});

	it('does not reflect persistence details that could contain the private entropy', async () => {
		mocks.persistenceFailure = 'database rejected secret-value-that-must-stay-private';
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
			expect(JSON.stringify(await response.json())).not.toContain(
				'secret-value-that-must-stay-private'
			);
		} finally {
			mocks.persistenceFailure = null;
			consoleError.mockRestore();
		}
	});
});

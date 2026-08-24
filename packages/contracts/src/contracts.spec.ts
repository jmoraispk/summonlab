import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	CharacterManifestSchema,
	HealthResponseSchema,
	LegalActionSchema,
	RewardDeltaSchema
} from './index.js';

describe('foundation contracts', () => {
	it('accepts an adult deterministic character manifest', () => {
		const result = CharacterManifestSchema.parse({
			characterId: randomUUID(),
			appearanceSeed: 'forge-seed-1',
			generationVersion: 'human-v1',
			adultAge: 25,
			genderPresentation: 'androgynous',
			bodyFrame: 'balanced',
			heightCm: 172,
			phenotype: {
				skinTone: 'deep umber',
				hairTexture: 'coiled',
				hairColor: 'black',
				eyeColor: 'brown'
			},
			visualTraits: ['left brow scar']
		});

		expect(result.adultAge).toBe(25);
	});

	it('rejects an underage manifest', () => {
		expect(() =>
			CharacterManifestSchema.parse({
				characterId: randomUUID(),
				appearanceSeed: 'seed',
				generationVersion: 'human-v1',
				adultAge: 17,
				genderPresentation: 'feminine',
				bodyFrame: 'slight',
				heightCm: 165,
				phenotype: {
					skinTone: 'olive',
					hairTexture: 'wavy',
					hairColor: 'brown',
					eyeColor: 'hazel'
				},
				visualTraits: []
			})
		).toThrow();
	});

	it('keeps actions constrained to declared legal targets', () => {
		const actorId = randomUUID();
		const action = LegalActionSchema.parse({
			actionId: 'tower.inspect-wall',
			actorId,
			kind: 'interact',
			label: 'Inspect the warm wall',
			description: 'Search the wall without creating a hidden path.',
			targetIds: [randomUUID()],
			resourceCosts: {},
			tags: ['reveals-secret']
		});

		expect(action.actorId).toBe(actorId);
	});

	it('validates health payloads and exact reward arithmetic', () => {
		expect(
			HealthResponseSchema.parse({
				status: 'degraded',
				service: 'worker',
				version: '0.0.0',
				commit: 'local',
				policyMode: 'scripted',
				database: { status: 'unavailable', latencyMs: null },
				timestamp: new Date().toISOString(),
				requestId: randomUUID()
			}).status
		).toBe('degraded');

		expect(() =>
			RewardDeltaSchema.parse({
				ownerId: randomUUID(),
				kind: 'experience',
				key: 'hero-xp',
				before: 10,
				after: 15,
				delta: 4
			})
		).toThrow();
	});
});

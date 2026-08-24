import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	CharacterManifestSchema,
	HealthResponseSchema,
	LegalActionSchema,
	RewardDeltaSchema,
	VisualIdentityCheckSchema,
	VisualReviewCreateRequestSchema,
	VisualReviewListSchema,
	VisualReviewRecordSchema
} from './index.js';

function validCharacterManifest(adultAge = 25) {
	return {
		characterId: randomUUID(),
		displayName: 'Test Hero',
		appearanceSeed: 'forge-seed-1',
		generationVersion: 'human-v1',
		rarityStars: 1,
		adultAge,
		genderPresentation: 'androgynous',
		pronouns: 'they/them',
		bodyFrame: 'balanced',
		bodyBuild: 'athletic',
		heightCm: 172,
		phenotype: {
			skinTone: 'deep umber',
			faceShape: 'oval',
			noseProfile: 'broad straight',
			hairTexture: 'coiled',
			hairColor: 'black',
			hairStyle: 'high knot',
			eyeColor: 'brown'
		},
		voice: { register: 'mid', texture: 'clear', cadence: 'measured' },
		posture: 'grounded',
		handedness: 'right',
		visualTraits: ['left brow scar'],
		palette: { skin: '#633b2d', hair: '#17151b', cloth: '#272932', accent: '#d49b47' },
		rig: {
			headScale: 1,
			shoulderWidth: 1,
			hipWidth: 1,
			legRatio: 1,
			anchors: { head: [50, 17], leftHand: [27, 56], rightHand: [73, 56], back: [50, 36] }
		},
		artKey: null,
		assetProvenance: 'procedural'
	};
}

describe('foundation contracts', () => {
	it('accepts an adult deterministic character manifest', () => {
		const result = CharacterManifestSchema.parse(validCharacterManifest());

		expect(result.adultAge).toBe(25);
	});

	it('rejects an underage manifest', () => {
		expect(() => CharacterManifestSchema.parse(validCharacterManifest(17))).toThrow();
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

	it('requires visual recognition scores to equal their explicit checks', () => {
		expect(() =>
			VisualIdentityCheckSchema.parse({
				characterId: randomUUID(),
				face: false,
				hair: true,
				silhouette: true,
				palette: true,
				signatureTraits: true,
				score: 5
			})
		).toThrow();
	});

	it('rejects internally inconsistent visual review lists', () => {
		const request = {
			reviewId: 'a4d12f1f-af58-47ac-a889-c250cbabc1d8',
			assetKey: 'hearth-02-anchor-v1',
			catalogVersion: 'visual-catalog-v1',
			assetContentHash: '1'.repeat(64),
			verdict: 'approved' as const,
			note: 'Identity reads clearly at every required scale.',
			reviewer: 'local-lead'
		};
		const review = VisualReviewRecordSchema.parse({
			...request,
			createdAt: '2026-08-24T05:00:00.000Z'
		});

		expect(VisualReviewCreateRequestSchema.parse(request).note).toBe(request.note);
		expect(
			VisualReviewListSchema.safeParse({
				reviews: [review],
				latestByAsset: { 'different-asset': review }
			}).success
		).toBe(false);
	});
});

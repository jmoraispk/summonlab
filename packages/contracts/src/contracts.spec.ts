import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	CharacterManifestSchema,
	HealthResponseSchema,
	LegalActionSchema,
	RewardDeltaSchema,
	RuntimeVisualManifestSchema,
	SummonCardGenerateRequestSchema,
	SummonCardGenerationSpecSchema,
	VisualIdentityCheckSchema,
	VisualRecognitionAuditSchema,
	VisualReviewCreateRequestSchema,
	VisualReviewListSchema,
	VisualReviewRecordSchema,
	WebBuildBudgetReportSchema
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

	it('keeps summon-card generation explicit, ephemeral, and non-canonical', () => {
		const request = {
			requestId: randomUUID(),
			assetKey: 'ember-01-anchor-v1',
			catalogVersion: 'visual-catalog-v1',
			assetContentHash: '1'.repeat(64),
			manifestHash: '2'.repeat(64),
			direction: 'A restrained arrival at the circular gate.',
			costAcknowledged: true as const
		};
		const spec = SummonCardGenerationSpecSchema.parse({
			schemaVersion: 'summon-card-request-v1',
			assetKey: request.assetKey,
			catalogVersion: request.catalogVersion,
			assetContentHash: request.assetContentHash,
			manifestHash: request.manifestHash,
			endpoint: '/v1/images/edits',
			model: 'gpt-image-2-2026-04-21',
			quality: 'low',
			size: '1024x1536',
			outputFormat: 'png',
			moderation: 'auto',
			candidateCount: 1,
			prompt: 'Create one original portrait summon card from the supplied identity reference.',
			promptHash: '3'.repeat(64),
			estimatedOutputCostUsd: 0.005,
			costEstimateDate: '2026-08-23',
			costExclusions: ['Prompt and reference-image input tokens are additional.'],
			canonical: false,
			persistence: 'ephemeral-response-only',
			retryPolicy: 'none'
		});

		expect(SummonCardGenerateRequestSchema.parse(request).costAcknowledged).toBe(true);
		expect(spec.canonical).toBe(false);
		expect(spec.candidateCount).toBe(1);
		expect(() =>
			SummonCardGenerateRequestSchema.parse({ ...request, costAcknowledged: false })
		).toThrow();
	});

	it('requires runtime bundle totals, budgets, and Pixi projections to agree', () => {
		const asset = {
			alias: 'hero.ember-01-anchor-v1.roster',
			usage: 'roster' as const,
			sourceAssetKey: 'ember-01-anchor-v1',
			sourceStatus: 'approved' as const,
			sourceContentHash: '1'.repeat(64),
			manifestHashes: ['2'.repeat(64)],
			file: 'runtime/visual-catalog-v1/hero-ember-01-anchor-v1/roster.abc123.webp',
			publicPath: '/runtime/visual-catalog-v1/hero-ember-01-anchor-v1/roster.abc123.webp',
			width: 256,
			height: 384,
			bytes: 40_000,
			contentHash: '3'.repeat(64),
			budgetBytes: 80_000,
			budgetStatus: 'within-budget' as const,
			encoder: {
				format: 'webp' as const,
				quality: 78,
				effort: 6,
				preset: 'drawing' as const,
				smartSubsample: true as const,
				metadata: 'stripped' as const
			}
		};
		const manifest = {
			schemaVersion: 'runtime-visual-manifest-v1' as const,
			catalogVersion: 'visual-catalog-v1',
			catalogContentHash: '4'.repeat(64),
			exporterVersion: 'runtime-visual-exporter-v1' as const,
			initialPayloadBudgetBytes: 8_000_000 as const,
			initialPayloadBytes: asset.bytes,
			initialPayloadStatus: 'within-budget' as const,
			toolchain: { pixi: '8.20.0', sharp: '0.35.3', vips: '8.18.0', webp: '1.6.0' },
			bundles: [
				{
					name: 'hero-ember-01-anchor-v1',
					budgetBytes: 80_000,
					bytes: asset.bytes,
					budgetStatus: 'within-budget' as const,
					assets: [asset]
				}
			],
			deferred: [],
			pixiManifest: {
				bundles: [
					{
						name: 'hero-ember-01-anchor-v1',
						assets: [{ alias: asset.alias, src: asset.publicPath }]
					}
				]
			},
			manifestHash: '5'.repeat(64)
		};

		expect(RuntimeVisualManifestSchema.parse(manifest).initialPayloadBytes).toBe(40_000);
		expect(() =>
			RuntimeVisualManifestSchema.parse({ ...manifest, initialPayloadBytes: 39_999 })
		).toThrow();
		expect(() =>
			RuntimeVisualManifestSchema.parse({
				...manifest,
				pixiManifest: { bundles: [{ name: 'hero-ember-01-anchor-v1', assets: [] }] }
			})
		).toThrow();
	});

	it('keeps recognition audits human-gated and internally measurable', () => {
		const recognitionCase = {
			caseId: 'settlement-night-walk',
			label: 'Settlement night walk',
			cameraTier: 'settlement' as const,
			expression: 'neutral' as const,
			paletteMode: 'night' as const,
			equipment: 'none' as const,
			walking: true,
			displayCssWidth: 48,
			displayCssHeight: 86,
			requiredCues: ['hair', 'silhouette', 'palette', 'signature-traits'] as const,
			requiredStateLayers: ['palette', 'gait'] as const,
			humanReviewStatus: 'pending-human-review' as const,
			reviewPrompt: 'Do four non-facial cues still identify the hero?'
		};
		const texture = {
			alias: 'hero.ember-01-anchor-v1.roster',
			usage: 'roster' as const,
			width: 256,
			height: 384,
			displayCssWidth: 96,
			displayCssHeight: 144,
			requiredPixelWidth: 192,
			requiredPixelHeight: 288,
			densityMargin: 1.333,
			encodedBytes: 3_484,
			decodedRgbaBytes: 393_216,
			densityStatus: 'sufficient' as const
		};
		const cases = [
			recognitionCase,
			...(['summon', 'dialogue', 'roster', 'mission'] as const).map((cameraTier) => ({
				...recognitionCase,
				caseId: `${cameraTier}-case`,
				cameraTier,
				requiredCues: ['face', 'hair', 'silhouette', 'palette', 'signature-traits'] as const
			}))
		];
		const audit = {
			schemaVersion: 'visual-recognition-audit-v1' as const,
			catalogVersion: 'visual-catalog-v1',
			catalogContentHash: '1'.repeat(64),
			characterId: randomUUID(),
			manifestHash: '2'.repeat(64),
			approvedSourceAssetKey: 'ember-01-anchor-v1',
			approvedSourceContentHash: '3'.repeat(64),
			cases,
			coverage: {
				expressions: ['neutral', 'alert', 'injured'] as const,
				cameraTiers: ['summon', 'dialogue', 'roster', 'settlement', 'mission'] as const,
				paletteModes: ['base', 'night', 'injured'] as const,
				equipment: ['none', 'practice-blade', 'short-bow'] as const
			},
			phoneDelivery: {
				profile: 'mid-range-phone-390x844-2x' as const,
				viewportCssWidth: 390 as const,
				viewportCssHeight: 844 as const,
				devicePixelRatio: 2 as const,
				textures: [
					{ ...texture, alias: 'hero.a.summon', usage: 'summon' as const },
					{ ...texture, alias: 'hero.a.dialogue', usage: 'dialogue' as const },
					texture
				],
				totalEncodedBytes: texture.encodedBytes * 3,
				totalDecodedRgbaBytes: texture.decodedRgbaBytes * 3,
				visualPayloadBudgetBytes: 8_000_000 as const,
				textureMemoryReferenceBytes: 300_000_000 as const,
				payloadStatus: 'within-budget' as const,
				textureMemoryProxyStatus: 'within-reference' as const
			},
			humanReviewStatus: 'pending-human-review' as const,
			auditHash: '4'.repeat(64)
		};

		expect(VisualRecognitionAuditSchema.parse(audit).cases).toHaveLength(5);
		expect(() =>
			VisualRecognitionAuditSchema.parse({
				...audit,
				phoneDelivery: { ...audit.phoneDelivery, totalEncodedBytes: 1 }
			})
		).toThrow();
		expect(() =>
			VisualRecognitionAuditSchema.parse({
				...audit,
				cases: [
					{
						...recognitionCase,
						requiredCues: ['face', 'hair', 'silhouette', 'palette', 'signature-traits']
					},
					...cases.slice(1)
				]
			})
		).toThrow();
	});

	it('rejects measured web payloads that exceed their recorded budgets', () => {
		const report = {
			schemaVersion: 'web-build-budget-v1' as const,
			budgets: {
				initialJavaScriptGzipBytes: 700_000,
				runtimeInspectorLoadedJavaScriptGzipBytes: 700_000,
				recognitionAuditLoadedJavaScriptGzipBytes: 700_000,
				runtimeVisualPayloadBytes: 8_000_000
			},
			measurements: {
				initialJavaScriptGzipBytes: 36_788,
				runtimeInspectorLoadedJavaScriptGzipBytes: 371_947,
				recognitionAuditLoadedJavaScriptGzipBytes: 48_000,
				largestRuntimeLazyChunkGzipBytes: 174_947,
				runtimeVisualPayloadBytes: 47_758
			},
			status: {
				initialJavaScript: 'within-budget' as const,
				runtimeInspectorLoadedJavaScript: 'within-budget' as const,
				recognitionAuditLoadedJavaScript: 'within-budget' as const,
				runtimeVisualPayload: 'within-budget' as const
			}
		};

		expect(WebBuildBudgetReportSchema.parse(report).measurements.initialJavaScriptGzipBytes).toBe(
			36_788
		);
		expect(() =>
			WebBuildBudgetReportSchema.parse({
				...report,
				measurements: { ...report.measurements, initialJavaScriptGzipBytes: 700_001 }
			})
		).toThrow();
	});
});

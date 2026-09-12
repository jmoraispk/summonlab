import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	CharacterManifestSchema,
	CharacterDraftV2Schema,
	CombatAttributesSchema,
	EquipmentRuntimeVisualAssetSchema,
	EquipmentRuntimeVisualManifestSchema,
	HealthResponseSchema,
	LegalActionSchema,
	PhonePerformanceReportSchema,
	PlaytestAnalyticsEventSchema,
	PlaytestAnalyticsReportSchema,
	PlaytestConsentGrantRequestSchema,
	ProofRunSnapshotV2Schema,
	PublicProofRunSnapshotV2Schema,
	PlayerVisualManifestSchema,
	RecognitionReviewCreateRequestSchema,
	RecognitionReviewListSchema,
	RecognitionReviewRecordSchema,
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
	it('exports the four canonical combat attributes from the root contract entry point', () => {
		expect(
			CombatAttributesSchema.safeParse({ strength: 1, agility: 1, vitality: 1, magic: 1 }).success
		).toBe(true);
	});

	it('exports representative v2 character and proof contracts from the root contract entry point', () => {
		const recipe = {
			seed: 'capability-seed',
			generationVersion: 'human-v1' as const,
			cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
		};
		const mind = {
			personality: {
				openness: 50,
				conscientiousness: 50,
				extraversion: 50,
				agreeableness: 50,
				emotionalVolatility: 50
			},
			primaryValue: 'duty' as const,
			primaryDrive: 'protect' as const,
			socialStyle: 'direct' as const,
			stressResponse: 'prepare' as const,
			dailyHabit: 'stretches-at-dawn' as const
		};
		const capabilityProfile = {
			profileVersion: 'character-capability-v1' as const,
			attributes: { strength: 51, agility: 53, vitality: 52, magic: 54 },
			learning: {
				cognitiveLearningScore: 55,
				domainAptitudes: {
					martial: 56,
					magical: 57,
					crafting: 58,
					survival: 59,
					social: 60
				}
			}
		};
		const draft = CharacterDraftV2Schema.parse({
			recipe,
			manifest: validCharacterManifest(),
			mind,
			capabilityProfile,
			manifestHash: 'a'.repeat(64)
		});
		const internalProof = ProofRunSnapshotV2Schema.parse({
			runId: randomUUID(),
			characterSchemaVersion: 'character-v2',
			storyEnvelopeId: 'first-ember-v1',
			controlMode: 'autonomous',
			directive: '',
			recipe: draft.recipe,
			manifest: draft.manifest,
			mind: draft.mind,
			capabilityProfile: draft.capabilityProfile,
			manifestHash: draft.manifestHash,
			firstObservation: 'A fire flickers in the distance.',
			firstLine: null,
			destination: null,
			storyBranch: null,
			arrived: false,
			events: [],
			createdAt: '2026-09-06T00:00:00.000Z'
		});
		const publicProof = PublicProofRunSnapshotV2Schema.parse({
			runId: internalProof.runId,
			characterSchemaVersion: internalProof.characterSchemaVersion,
			storyEnvelopeId: internalProof.storyEnvelopeId,
			controlMode: internalProof.controlMode,
			manifest: {
				characterId: internalProof.manifest.characterId,
				displayName: internalProof.manifest.displayName,
				rarityStars: internalProof.manifest.rarityStars,
				adultAge: internalProof.manifest.adultAge,
				heightCm: internalProof.manifest.heightCm,
				bodyBuild: internalProof.manifest.bodyBuild,
				voiceCadence: internalProof.manifest.voice.cadence,
				posture: internalProof.manifest.posture,
				artKey: internalProof.manifest.artKey
			},
			publicManifestHash: 'b'.repeat(64),
			firstObservation: internalProof.firstObservation,
			firstLine: internalProof.firstLine,
			destination: internalProof.destination,
			storyBranch: internalProof.storyBranch,
			arrived: internalProof.arrived,
			events: [],
			createdAt: internalProof.createdAt,
			capabilityProfile: {
				profileVersion: internalProof.capabilityProfile.profileVersion,
				attributes: internalProof.capabilityProfile.attributes
			}
		});

		expect(publicProof.capabilityProfile).not.toHaveProperty('learning');
	});

	it('keeps playtest consent affirmative and analytics free of arbitrary text', () => {
		expect(
			PlaytestConsentGrantRequestSchema.safeParse({
				noticeVersion: 'playtest-consent-v1',
				analyticsVersion: 'playtest-analytics-v1',
				ageConfirmed: true,
				voluntary: true
			}).success
		).toBe(true);
		expect(
			PlaytestConsentGrantRequestSchema.safeParse({
				noticeVersion: 'playtest-consent-v1',
				analyticsVersion: 'playtest-analytics-v1',
				ageConfirmed: false,
				voluntary: true
			}).success
		).toBe(false);
		const event = {
			eventId: randomUUID(),
			sessionId: randomUUID(),
			runId: null,
			eventType: 'route_viewed' as const,
			route: 'title' as const,
			viewport: 'phone' as const,
			occurredAt: '2026-08-25T22:00:00.000Z'
		};
		expect(PlaytestAnalyticsEventSchema.safeParse(event).success).toBe(true);
		expect(
			PlaytestAnalyticsEventSchema.safeParse({ ...event, rawQuestion: 'What do you fear?' }).success
		).toBe(false);
	});

	it('requires aggregate playtest totals and funnel stages to agree', () => {
		const report = {
			schemaVersion: 'playtest-analytics-v1' as const,
			generatedAt: '2026-08-25T22:00:00.000Z',
			privacy: {
				noticeVersion: 'playtest-consent-v1' as const,
				retentionDays: 30 as const,
				storesRawText: false as const,
				storesIpAddress: false as const,
				storesUserAgent: false as const,
				withdrawalDeletesEvents: true as const,
				reportIsAggregateOnly: true as const
			},
			consents: { granted: 1, withdrawn: 0, expired: 0 },
			retainedSessionCount: 1,
			retainedEventCount: 4,
			eventCounts: {
				route_viewed: 1,
				campaign_started: 1,
				onboarding_step_completed: 1,
				hearth_entered: 1,
				pause_opened: 0,
				campaign_restarted: 0,
				reconnect_completed: 0
			},
			funnel: {
				titleViewedSessions: 1,
				campaignStartedSessions: 1,
				onboardingCompletedSessions: 1,
				hearthEnteredSessions: 1
			}
		};
		expect(PlaytestAnalyticsReportSchema.safeParse(report).success).toBe(true);
		expect(
			PlaytestAnalyticsReportSchema.safeParse({ ...report, retainedEventCount: 5 }).success
		).toBe(false);
		expect(
			PlaytestAnalyticsReportSchema.safeParse({
				...report,
				funnel: { ...report.funnel, hearthEnteredSessions: 2 }
			}).success
		).toBe(false);
	});

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

	it('requires complete and internally consistent recognition review evidence', () => {
		const request = {
			reviewId: randomUUID(),
			auditHash: '4'.repeat(64),
			catalogVersion: 'visual-catalog-v1',
			characterId: randomUUID(),
			caseId: 'settlement-night-walk',
			outcomes: [
				{ cue: 'hair', verdict: 'pass' },
				{ cue: 'silhouette', verdict: 'pass' },
				{ cue: 'palette', verdict: 'pass' },
				{ cue: 'signature-traits', verdict: 'pass' }
			] as const,
			verdict: 'pass' as const,
			note: 'The non-facial identity survives settlement scale.',
			reviewer: 'local-lead'
		};
		const review = RecognitionReviewRecordSchema.parse({
			...request,
			createdAt: '2026-08-24T05:00:00.000Z'
		});

		expect(RecognitionReviewCreateRequestSchema.parse(request).outcomes).toHaveLength(4);
		expect(
			RecognitionReviewCreateRequestSchema.safeParse({
				...request,
				outcomes: [request.outcomes[0], request.outcomes[0], ...request.outcomes.slice(2)]
			}).success
		).toBe(false);
		expect(
			RecognitionReviewCreateRequestSchema.safeParse({
				...request,
				outcomes: request.outcomes.map((outcome, index) =>
					index === 0 ? { ...outcome, verdict: 'fail' } : outcome
				)
			}).success
		).toBe(false);
		expect(
			RecognitionReviewListSchema.safeParse({
				reviews: [review],
				latestByCase: { 'different-case': review }
			}).success
		).toBe(false);
	});

	it('rejects measured web payloads that exceed their recorded budgets', () => {
		const report = {
			schemaVersion: 'web-build-budget-v1' as const,
			budgets: {
				initialJavaScriptGzipBytes: 700_000,
				runtimeInspectorLoadedJavaScriptGzipBytes: 700_000,
				recognitionAuditLoadedJavaScriptGzipBytes: 700_000,
				settlementRouteLabLoadedJavaScriptGzipBytes: 700_000,
				missionPackageLabLoadedJavaScriptGzipBytes: 700_000,
				missionLifecycleLoadedJavaScriptGzipBytes: 700_000,
				runtimeVisualPayloadBytes: 8_000_000
			},
			measurements: {
				initialJavaScriptGzipBytes: 36_788,
				runtimeInspectorLoadedJavaScriptGzipBytes: 371_947,
				recognitionAuditLoadedJavaScriptGzipBytes: 48_000,
				settlementRouteLabLoadedJavaScriptGzipBytes: 52_000,
				missionPackageLabLoadedJavaScriptGzipBytes: 45_000,
				missionLifecycleLoadedJavaScriptGzipBytes: 57_000,
				largestRuntimeLazyChunkGzipBytes: 174_947,
				runtimeVisualPayloadBytes: 47_758
			},
			status: {
				initialJavaScript: 'within-budget' as const,
				runtimeInspectorLoadedJavaScript: 'within-budget' as const,
				recognitionAuditLoadedJavaScript: 'within-budget' as const,
				settlementRouteLabLoadedJavaScript: 'within-budget' as const,
				missionPackageLabLoadedJavaScript: 'within-budget' as const,
				missionLifecycleLoadedJavaScript: 'within-budget' as const,
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

	it('binds purpose-sized player title variants to encoded and decoded budgets', () => {
		const asset = {
			usage: 'title-phone' as const,
			sourceFile: 'assets/agent-summoning-concept.png',
			sourceContentHash: '1'.repeat(64),
			file: 'apps/web/static/runtime/player/title-phone.123456789abc.webp',
			publicPath: '/runtime/player/title-phone.123456789abc.webp',
			width: 768,
			height: 427,
			bytes: 40_820,
			contentHash: '2'.repeat(64),
			budgetBytes: 100_000,
			budgetStatus: 'within-budget' as const,
			decodedRgbaBytes: 768 * 427 * 4,
			decodedMemoryBudgetBytes: 2_000_000,
			decodedMemoryStatus: 'within-budget' as const,
			encoder: {
				format: 'webp' as const,
				quality: 78,
				effort: 6,
				preset: 'picture' as const,
				smartSubsample: true as const,
				metadata: 'stripped' as const
			}
		};
		const manifest = {
			schemaVersion: 'player-visual-manifest-v1' as const,
			exporterVersion: 'player-visual-exporter-v1' as const,
			manifestHash: '3'.repeat(64),
			assets: [
				asset,
				{
					...asset,
					usage: 'title-desktop' as const,
					publicPath: '/runtime/player/title-desktop.456789abcdef.webp',
					width: 1_681,
					height: 935,
					bytes: 175_324,
					contentHash: '4'.repeat(64),
					budgetBytes: 250_000,
					decodedRgbaBytes: 1_681 * 935 * 4,
					decodedMemoryBudgetBytes: 8_000_000
				}
			]
		};
		expect(PlayerVisualManifestSchema.parse(manifest).assets).toHaveLength(2);
		expect(() =>
			PlayerVisualManifestSchema.parse({
				...manifest,
				assets: [asset, { ...asset, usage: 'title-phone' }]
			})
		).toThrow();
	});

	it('rejects a phone performance report when any target budget is missed', () => {
		const report = {
			schemaVersion: 'phone-performance-report-v1' as const,
			recordedAt: '2026-08-25T22:30:00.000Z',
			sourceRevision: 'working-tree',
			profile: {
				name: 'mid-range-phone-390x844-2x' as const,
				viewportWidth: 390 as const,
				viewportHeight: 844 as const,
				deviceScaleFactor: 2 as const,
				networkLatencyMs: 150 as const,
				downloadBytesPerSecond: 200_000 as const,
				uploadBytesPerSecond: 93_750 as const,
				cpuSlowdownMultiplier: 4 as const
			},
			budgets: {
				interactiveShellMs: 4_000 as const,
				initialJavaScriptGzipBytes: 700_000 as const,
				playerTitleVisualBytes: 100_000 as const,
				firstSettlementVisualBytes: 8_000_000 as const,
				minimumActiveSceneFramesPerSecond: 30 as const,
				interfaceResponseMs: 150 as const,
				reconnectMs: 4_000 as const,
				rendererWorkingSetReferenceBytes: 300_000_000 as const
			},
			measurements: {
				interactiveShellMs: 900,
				initialJavaScriptGzipBytes: 44_000,
				playerTitleVisualBytes: 47_288,
				firstSettlementVisualBytes: 310_000,
				activeSceneFramesPerSecond: 58,
				interfaceResponseP95Ms: 24,
				reconnectMs: 1_100,
				javascriptHeapBytes: 20_000_000,
				decodedImageBytes: 7_000_000,
				rendererWorkingSetReferenceBytes: 27_000_000
			},
			status: {
				interactiveShell: 'within-budget' as const,
				initialJavaScript: 'within-budget' as const,
				playerTitleVisual: 'within-budget' as const,
				firstSettlementVisuals: 'within-budget' as const,
				activeSceneFrames: 'within-budget' as const,
				interfaceResponse: 'within-budget' as const,
				reconnect: 'within-budget' as const,
				rendererWorkingSetReference: 'within-budget' as const
			},
			methodology: {
				browser: 'chromium' as const,
				interfaceSamples: 5,
				frameSampleDurationMs: 1_500,
				memoryScope: 'javascript-heap-plus-decoded-images' as const,
				realDeviceReview: 'required' as const
			}
		};
		expect(PhonePerformanceReportSchema.parse(report).measurements.reconnectMs).toBe(1_100);
		expect(() =>
			PhonePerformanceReportSchema.parse({
				...report,
				measurements: { ...report.measurements, activeSceneFramesPerSecond: 29 }
			})
		).toThrow();
	});

	it('accepts a strict, lazy Equipment runtime visual catalog with 140 two-size bundles', () => {
		const sourceManifestHash = 'a'.repeat(64);
		const bundles = Array.from({ length: 140 }, (_, index) => {
			const sourceAssetKey = `equipment-v1-f-bronze-sword-${index}`;
			const assets = (['card', 'detail'] as const).map((usage) => {
				const isCard = usage === 'card';
				const contentHash = (isCard ? 'b' : 'c').repeat(64);
				const publicPath = `/runtime/equipment-v1/${sourceAssetKey}/${usage}.${contentHash.slice(0, 12)}.webp`;
				return {
					alias: `equipment.${sourceAssetKey}.${usage}`,
					usage,
					sourceAssetKey,
					sourceRole: 'item' as const,
					sourceApprovalStatus: 'approved' as const,
					sourceApprovedPath: `assets/equipment/approved/material-equipment-v1/items/f/bronze/sword-${index}.png`,
					sourceContentHash: 'd'.repeat(64),
					approvedSourceManifestHash: sourceManifestHash,
					file: `apps/web/static${publicPath}`,
					publicPath,
					width: isCard ? 256 : 512,
					height: isCard ? 256 : 512,
					bytes: isCard ? 1_000 : 4_000,
					contentHash,
					budgetBytes: isCard ? (16_000 as const) : (64_000 as const),
					budgetStatus: 'within-budget' as const,
					encoder: {
						format: 'webp' as const,
						quality: isCard ? (76 as const) : (80 as const),
						effort: 6 as const,
						preset: 'drawing' as const,
						smartSubsample: true as const,
						metadata: 'stripped' as const
					}
				};
			});
			return {
				name: sourceAssetKey,
				sourceAssetKey,
				loadPolicy: 'lazy' as const,
				bytes: 5_000,
				budgetBytes: 80_000 as const,
				budgetStatus: 'within-budget' as const,
				assets
			};
		});
		const manifest = {
			schemaVersion: 'equipment-runtime-visual-manifest-v1' as const,
			catalogVersion: 'equipment-v1' as const,
			exporterVersion: 'equipment-runtime-visual-exporter-v1' as const,
			approvedSource: {
				schemaVersion: 'equipment-approved-source-manifest-v1' as const,
				catalogId: 'material-equipment-v1' as const,
				manifestPath: 'assets/equipment/approved/material-equipment-v1/manifest.json' as const,
				manifestContentHash: sourceManifestHash,
				createdAt: '2026-09-04T02:25:27Z',
				createdBy: 'summonlab-owner'
			},
			loading: {
				catalogLoadPolicy: 'lazy-per-definition' as const,
				includedInInitialPhonePayload: false as const,
				initialPayloadBytes: 0 as const
			},
			profiles: [
				{
					usage: 'card' as const,
					boundPixels: 256 as const,
					quality: 76 as const,
					budgetBytes: 16_000 as const
				},
				{
					usage: 'detail' as const,
					boundPixels: 512 as const,
					quality: 80 as const,
					budgetBytes: 64_000 as const
				}
			],
			toolchain: { sharp: '0.35.3', vips: '8.17.3', webp: '1.6.0' },
			summary: {
				bundleCount: 140 as const,
				assetCount: 280 as const,
				armourSetReferenceCount: 0 as const,
				cardBytes: 140_000,
				detailBytes: 560_000,
				totalBytes: 700_000
			},
			bundles,
			manifestHash: 'e'.repeat(64)
		};
		expect(EquipmentRuntimeVisualManifestSchema.parse(manifest).bundles).toHaveLength(140);
		expect(EquipmentRuntimeVisualManifestSchema.parse(manifest).loading.initialPayloadBytes).toBe(
			0
		);
	});

	it('rejects non-approved Equipment sources, set references, and broken output evidence', () => {
		const sourceAssetKey = 'equipment-v1-f-bronze-sword';
		const contentHash = 'b'.repeat(64);
		const publicPath = `/runtime/equipment-v1/${sourceAssetKey}/card.${contentHash.slice(0, 12)}.webp`;
		const valid = {
			alias: `equipment.${sourceAssetKey}.card`,
			usage: 'card' as const,
			sourceAssetKey,
			sourceRole: 'item' as const,
			sourceApprovalStatus: 'approved' as const,
			sourceApprovedPath:
				'assets/equipment/approved/material-equipment-v1/items/f/bronze/sword.png',
			sourceContentHash: 'a'.repeat(64),
			approvedSourceManifestHash: 'c'.repeat(64),
			file: `apps/web/static${publicPath}`,
			publicPath,
			width: 256,
			height: 256,
			bytes: 8_000,
			contentHash,
			budgetBytes: 16_000 as const,
			budgetStatus: 'within-budget' as const,
			encoder: {
				format: 'webp' as const,
				quality: 76 as const,
				effort: 6 as const,
				preset: 'drawing' as const,
				smartSubsample: true as const,
				metadata: 'stripped' as const
			}
		};
		expect(EquipmentRuntimeVisualAssetSchema.parse(valid).usage).toBe('card');
		expect(() =>
			EquipmentRuntimeVisualAssetSchema.parse({
				...valid,
				sourceApprovedPath: 'assets/equipment/experiments/material-equipment-v3/candidate.png'
			})
		).toThrow();
		expect(() =>
			EquipmentRuntimeVisualAssetSchema.parse({ ...valid, sourceRole: 'armour-set-reference' })
		).toThrow();
		expect(() => EquipmentRuntimeVisualAssetSchema.parse({ ...valid, bytes: 16_001 })).toThrow(
			/budget/i
		);
		expect(() => EquipmentRuntimeVisualAssetSchema.parse({ ...valid, unexpected: true })).toThrow();
	});
});

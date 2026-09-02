import { describe, expect, it } from 'vitest';

import {
	EquipmentArmourSourceReviewReceiptSchema,
	EquipmentImageAssignmentSchema,
	EquipmentImageResultSchema,
	EquipmentImageTargetSchema,
	EquipmentRunActivationSchema,
	EquipmentRunEventRequestSchema,
	EquipmentRunEventSchema,
	EquipmentRunPlanSchema,
	EquipmentRunReadinessReportSchema,
	EquipmentRunReportSchema,
	EquipmentVisualProfileAcceptanceSchema,
	EquipmentVisualProfileSchema
} from './equipment-image-production-contract.js';

const hash = 'a'.repeat(64);
const secondHash = 'b'.repeat(64);
const root = 'assets/equipment/experiments/material-equipment-v1';
const candidatePath = `${root}/candidates/f/copper/sword-v1.png`;
const resultPath = `${root}/results/f/copper/sword-v1.json`;

const validProfile = {
	schemaVersion: 'equipment-visual-profile-v1' as const,
	profileId: 'equipment-material-visual-profile-v1',
	status: 'approval-candidate' as const,
	craftsmanship: { grade: 'Standard' as const, rankAdjustment: 0 as const },
	style: {
		medium: 'premium realistic painterly dark fantasy',
		construction: 'grounded medieval construction with structurally plausible joins',
		materialResponse: 'honest wear and restrained local magic',
		lighting: 'cold key light with a restrained warm rim',
		background: 'midnight-charcoal presentation ground'
	},
	isolatedPresentation: {
		mode: 'isolated-item-or-piece' as const,
		subject: 'one-complete-object-or-required-pair' as const,
		composition: 'neutral three-quarter view entirely inside the safe margin',
		canvas: {
			width: 1024 as const,
			height: 1024 as const,
			mediaType: 'image/png' as const,
			safeMarginPercent: 8 as const
		}
	},
	fullSetPresentation: {
		mode: 'complete-armour-set' as const,
		subject: 'featureless-charcoal-display-form' as const,
		composition: 'full body visible with all four armour slots readable together',
		canvas: {
			width: 1024 as const,
			height: 1536 as const,
			mediaType: 'image/png' as const,
			safeMarginPercent: 8 as const
		}
	},
	dependentPiecePresentation: {
		mode: 'dependent-armour-piece' as const,
		subject: 'one-matching-object-or-required-pair' as const,
		composition: 'isolated piece derived from the accepted full-set source',
		canvas: {
			width: 1024 as const,
			height: 1024 as const,
			mediaType: 'image/png' as const,
			safeMarginPercent: 8 as const
		},
		continuityRequirements: ['material', 'silhouette-language', 'slot-boundary']
	},
	equipmentClassDefaults: [
		{ equipmentClass: 'sword', description: 'practical hand-and-a-half straight sword' }
	],
	references: [
		{
			path: 'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png',
			contentHash: hash,
			purpose: 'Painterly finish and material response only; do not transfer the subject.'
		}
	],
	negativeConstraints: ['no-text', 'no-ui', 'no-frames', 'no-logos', 'no-watermarks']
};

const validProfileAcceptance = {
	schemaVersion: 'equipment-visual-profile-acceptance-v1' as const,
	acceptanceId: 'equipment-material-visual-profile-v1-owner-acceptance',
	profileId: validProfile.profileId,
	profilePath: `${root}/visual-profile/profile.json`,
	profileCanonicalSha256: hash,
	decision: 'accepted' as const,
	reviewer: 'owner',
	acceptedAt: '2026-09-01T23:00:00.000Z'
};

const validTarget = {
	schemaVersion: 'equipment-image-target-v1' as const,
	targetId: 'material-equipment-v1-copper-sword-v1',
	productionId: 'material-equipment-v1',
	profileId: validProfile.profileId,
	manifestCanonicalSha256: hash,
	allocationCanonicalSha256: secondHash,
	profileCanonicalSha256: hash,
	profileAcceptanceCanonicalSha256: secondHash,
	material: {
		id: 'copper',
		name: 'Copper',
		family: 'metal' as const,
		rank: 'F' as const,
		craftsmanship: 'Standard' as const
	},
	equipment: {
		class: 'sword',
		artifactRole: 'item' as const,
		slot: null
	},
	consistencySource: null,
	references: validProfile.references,
	presentation: {
		mode: 'isolated-item' as const,
		subject: 'one-complete-object-or-required-pair' as const,
		composition: 'neutral three-quarter view entirely inside the safe margin',
		canvas: {
			width: 1024 as const,
			height: 1024 as const,
			mediaType: 'image/png' as const,
			safeMarginPercent: 8 as const
		},
		negativeConstraints: ['no-text', 'no-watermarks']
	},
	acceptanceCriteria: [
		{
			criterionId: 'complete-canvas-safe-framing',
			category: 'canvas-and-framing' as const,
			description: 'The entire item is visible inside the safe margin.',
			required: true as const
		}
	],
	output: { candidatePath, resultPath }
};

const validAssignment = {
	schemaVersion: 'equipment-image-assignment-v1' as const,
	assignmentId: 'assignment-material-equipment-v1-copper-sword-v1',
	targetId: validTarget.targetId,
	contractVersion: 'equipment-image-production-contract-v1',
	rendererVersion: 'equipment-image-prompt-v1',
	assignedAt: '2026-09-01T23:05:00.000Z',
	dryRun: false as const,
	retryCeiling: 0 as const,
	permittedOutputs: { candidatePath, resultPath },
	forbiddenSharedPaths: [
		`${root}/manifest.json`,
		'assets/enemies',
		'packages/contracts/src/image-production.ts'
	],
	completionContract: {
		oneTargetOneImage: true as const,
		structuredResultRequired: true as const,
		sharedFilesMustRemainUntouched: true as const,
		selfPromotionForbidden: true as const
	}
};

const validResult = {
	schemaVersion: 'equipment-image-result-v1' as const,
	resultId: 'result-material-equipment-v1-copper-sword-v1',
	targetId: validTarget.targetId,
	assignmentId: validAssignment.assignmentId,
	status: 'candidate' as const,
	promptSha256: hash,
	referenceInputs: [
		{
			path: 'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png',
			contentHash: hash
		}
	],
	attempts: [
		{
			attemptId: 'attempt-material-equipment-v1-copper-sword-v1',
			attemptNumber: 1 as const,
			sourceOutputId: 'imagegen-output-1',
			requestStartedAt: '2026-09-01T23:06:00.000Z',
			generationCompletedAt: '2026-09-01T23:06:30.000Z',
			inspectionCompletedAt: '2026-09-01T23:06:40.000Z'
		}
	],
	findings: [
		{
			criterionId: 'complete-canvas-safe-framing',
			outcome: 'pass' as const,
			observation: 'The complete sword is visible inside the safe margin.'
		}
	],
	candidate: {
		path: candidatePath,
		mediaType: 'image/png' as const,
		width: 1024 as const,
		height: 1024 as const,
		bytes: 1000,
		sha256: hash
	},
	candidateSha256: hash,
	startedAt: '2026-09-01T23:06:00.000Z',
	completedAt: '2026-09-01T23:06:40.000Z',
	writtenOutputPaths: [candidatePath, resultPath],
	noSharedFilesEdited: true as const,
	selfPromoted: false as const
};

const validReceipt = {
	schemaVersion: 'equipment-armour-source-review-receipt-v1' as const,
	receiptId: 'receipt-copper-heavy-armour-full-set-v1',
	runId: 'material-equipment-v1-run-001',
	runPlanCanonicalSha256: hash,
	manifestCanonicalSha256: hash,
	allocationCanonicalSha256: secondHash,
	profileCanonicalSha256: hash,
	gateId: 'material-equipment-v1-copper-heavy-armour-full-set-v1-review-pass',
	sourceTargetId: 'material-equipment-v1-copper-heavy-armour-full-set-v1',
	sourceResultCanonicalSha256: secondHash,
	candidateSha256: hash,
	decision: 'accepted' as const,
	reviewer: 'owner',
	reviewedAt: '2026-09-01T23:10:00.000Z'
};

const armourSlots = ['head', 'torso', 'legs', 'boots'] as const;
const rootTargetIds = Array.from({ length: 77 }, (_, index) => {
	if (index === 0) return validTarget.targetId;
	if (index === 1) return validReceipt.sourceTargetId;
	return `material-equipment-v1-root-${String(index + 1).padStart(3, '0')}`;
});
const gatedTargetIdsByGate = Array.from({ length: 21 }, (_, gateIndex) =>
	armourSlots.map((slot) =>
		gateIndex === 0
			? `material-equipment-v1-copper-heavy-armour-${slot}-v1`
			: `material-equipment-v1-armour-set-${String(gateIndex + 1).padStart(2, '0')}-${slot}-v1`
	)
);
const gatedTargetIds = gatedTargetIdsByGate.flat();
const rootPackets = rootTargetIds.map((targetId, index) => {
	const fixtureId = String(index + 1).padStart(3, '0');
	return {
		targetId,
		targetPath: `${root}/targets/f/fixture/root-${fixtureId}.json`,
		targetCanonicalSha256: hash,
		assignmentPath: `${root}/assignments/f/fixture/root-${fixtureId}.json`,
		assignmentCanonicalSha256: secondHash
	};
});
const reviewGates = gatedTargetIdsByGate.map((unlocksTargetIds, gateIndex) => {
	if (gateIndex === 0) {
		return {
			gateId: validReceipt.gateId,
			sourceTargetId: validReceipt.sourceTargetId,
			unlocksTargetIds,
			reviewPath: `${root}/reviews/f/copper/heavy-armour-full-set-v1.json`
		};
	}
	const fixtureId = String(gateIndex + 1).padStart(2, '0');
	return {
		gateId: `material-equipment-v1-armour-set-${fixtureId}-review-pass`,
		sourceTargetId: rootTargetIds[gateIndex + 1]!,
		unlocksTargetIds,
		reviewPath: `${root}/reviews/f/fixture/armour-set-${fixtureId}.json`
	};
});

const validRunPlan = {
	schemaVersion: 'equipment-production-run-plan-v1' as const,
	runId: 'material-equipment-v1-run-001',
	productionId: 'material-equipment-v1',
	createdAt: '2026-09-01T23:15:00.000Z',
	maximumConcurrency: 16 as const,
	boundArtifacts: {
		manifestCanonicalSha256: hash,
		allocationCanonicalSha256: secondHash,
		profileCanonicalSha256: hash,
		profileAcceptanceCanonicalSha256: secondHash
	},
	versions: {
		contract: 'equipment-image-production-contract-v1',
		renderer: 'equipment-image-prompt-v1',
		verifier: 'equipment-image-result-verifier-v1',
		persistence: 'equipment-image-persistence-v1',
		journal: 'equipment-production-journal-v1'
	},
	targetIds: [...rootTargetIds, ...gatedTargetIds],
	rootPackets,
	reviewGates,
	unmaterializedReviewGatedTargetIds: gatedTargetIds,
	reservedPaths: {
		candidates: [candidatePath],
		results: [resultPath],
		reviews: [`${root}/reviews/f/copper/heavy-armour-full-set-v1.json`],
		runArtifacts: [
			`${root}/runs/material-equipment-v1-run-001/plan.json`,
			`${root}/runs/material-equipment-v1-run-001/activation.json`
		]
	}
};

const validRunActivation = {
	schemaVersion: 'equipment-production-run-activation-v1' as const,
	activationId: 'material-equipment-v1-run-001-activation',
	runId: validRunPlan.runId,
	runPlanCanonicalSha256: hash,
	activatedAt: '2026-09-01T23:16:00.000Z',
	activatedBy: 'owner'
};

const validEventRequest = {
	schemaVersion: 'equipment-production-event-request-v1' as const,
	eventId: 'material-equipment-v1-run-001-started',
	runId: validRunPlan.runId,
	kind: 'run-started' as const,
	requestedAt: '2026-09-01T23:17:00.000Z',
	actor: 'orchestrator',
	epochId: 'epoch-001'
};

const validEvent = {
	schemaVersion: 'equipment-production-event-v1' as const,
	sequence: 1,
	previousEventCanonicalSha256: null,
	recordedAt: '2026-09-01T23:17:00.001Z',
	request: validEventRequest
};

const validReadinessReport = {
	schemaVersion: 'equipment-production-run-readiness-report-v1' as const,
	runId: validRunPlan.runId,
	checkedAt: '2026-09-01T23:18:00.000Z',
	status: 'ready' as const,
	writesPerformed: 0 as const,
	summary: {
		totalJobs: 161 as const,
		materializedRootJobs: 77 as const,
		gatedPieceJobs: 84 as const,
		armourReviewGates: 21 as const,
		maximumConcurrency: 16 as const
	},
	blockers: []
};

const validRunReport = {
	schemaVersion: 'equipment-production-run-report-v1' as const,
	reportId: 'material-equipment-v1-run-001-report-001',
	runId: validRunPlan.runId,
	generatedAt: '2026-09-01T23:19:00.000Z',
	status: 'running' as const,
	summary: {
		totalJobs: 161 as const,
		readyJobs: 76,
		claimedJobs: 0,
		activeJobs: 1,
		terminalJobs: 0,
		acceptedArmourGates: 0,
		technicalFailuresInEpoch: 0,
		peakActiveEquipmentWorkers: 1,
		maximumConcurrency: 16 as const
	},
	readyTargetIds: [validTarget.targetId],
	claimedTargetIds: [],
	activeTargetIds: [validTarget.targetId],
	terminalTargetIds: [],
	blockers: []
};

describe('Equipment image-production contracts', () => {
	it('parses one valid value for every public schema', () => {
		for (const [schema, value] of [
			[EquipmentVisualProfileSchema, validProfile],
			[EquipmentVisualProfileAcceptanceSchema, validProfileAcceptance],
			[EquipmentImageTargetSchema, validTarget],
			[EquipmentImageAssignmentSchema, validAssignment],
			[EquipmentImageResultSchema, validResult],
			[EquipmentArmourSourceReviewReceiptSchema, validReceipt],
			[EquipmentRunPlanSchema, validRunPlan],
			[EquipmentRunActivationSchema, validRunActivation],
			[EquipmentRunEventRequestSchema, validEventRequest],
			[EquipmentRunEventSchema, validEvent],
			[EquipmentRunReadinessReportSchema, validReadinessReport],
			[EquipmentRunReportSchema, validRunReport]
		] as const) {
			expect(schema.parse(value)).toEqual(value);
		}
	});

	it('rejects unknown target fields and paths outside the Equipment production root', () => {
		expect(() => EquipmentImageTargetSchema.parse({ ...validTarget, extra: true })).toThrow();
		expect(() =>
			EquipmentImageTargetSchema.parse({
				...validTarget,
				output: { ...validTarget.output, candidatePath: 'assets/enemies/bad.png' }
			})
		).toThrow();
	});

	it('locks the visual profile to the exact isolated-item canvas contract', () => {
		expect(() =>
			EquipmentVisualProfileSchema.parse({
				...validProfile,
				isolatedPresentation: { ...validProfile.isolatedPresentation, width: 1536 }
			})
		).toThrow();
		expect(() =>
			EquipmentVisualProfileSchema.parse({
				...validProfile,
				isolatedPresentation: {
					...validProfile.isolatedPresentation,
					canvas: { ...validProfile.isolatedPresentation.canvas, width: 1536 }
				}
			})
		).toThrow();
	});

	it('requires lowercase SHA-256 fields on accepted Armour receipts', () => {
		expect(() =>
			EquipmentArmourSourceReviewReceiptSchema.parse({
				...validReceipt,
				decision: 'accepted',
				candidateSha256: 'not-a-hash'
			})
		).toThrow();
		expect(() =>
			EquipmentArmourSourceReviewReceiptSchema.parse({
				...validReceipt,
				candidateSha256: 'A'.repeat(64)
			})
		).toThrow();
	});

	it('requires the exact 161-target, 77-root, 21-gate, and 84-gated topology', () => {
		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				targetIds: validRunPlan.targetIds.slice(0, -1)
			})
		).toThrow();
		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				rootPackets: validRunPlan.rootPackets.slice(0, -1)
			})
		).toThrow();
		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				reviewGates: validRunPlan.reviewGates.slice(0, -1)
			})
		).toThrow();
		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				unmaterializedReviewGatedTargetIds: validRunPlan.unmaterializedReviewGatedTargetIds.slice(
					0,
					-1
				)
			})
		).toThrow();
	});

	it('requires four distinct children per gate and 84 globally distinct children', () => {
		const firstGate = validRunPlan.reviewGates[0]!;
		const secondGate = validRunPlan.reviewGates[1]!;
		const firstChild = firstGate.unlocksTargetIds[0]!;

		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				reviewGates: [
					{
						...firstGate,
						unlocksTargetIds: [firstChild, firstChild, ...firstGate.unlocksTargetIds.slice(2)]
					},
					...validRunPlan.reviewGates.slice(1)
				]
			})
		).toThrow();
		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				reviewGates: [
					firstGate,
					{
						...secondGate,
						unlocksTargetIds: [firstChild, ...secondGate.unlocksTargetIds.slice(1)]
					},
					...validRunPlan.reviewGates.slice(2)
				]
			})
		).toThrow();
	});

	it('partitions target IDs exactly between root packets and review-gated children', () => {
		const rootTargetId = validRunPlan.rootPackets[0]!.targetId;
		const gatedTargetId = validRunPlan.unmaterializedReviewGatedTargetIds[0]!;

		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				unmaterializedReviewGatedTargetIds: [
					rootTargetId,
					...validRunPlan.unmaterializedReviewGatedTargetIds.slice(1)
				]
			})
		).toThrow();
		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				targetIds: ['material-equipment-v1-unowned-target-v1', ...validRunPlan.targetIds.slice(1)]
			})
		).toThrow();
		expect(() =>
			EquipmentRunPlanSchema.parse({
				...validRunPlan,
				reviewGates: [
					{ ...validRunPlan.reviewGates[0]!, sourceTargetId: gatedTargetId },
					...validRunPlan.reviewGates.slice(1)
				]
			})
		).toThrow();
	});

	it('rejects reviewer-owned and run-owned result write claims', () => {
		expect(() =>
			EquipmentImageResultSchema.parse({
				...validResult,
				writtenOutputPaths: [
					candidatePath,
					`${root}/reviews/f/copper/heavy-armour-full-set-v1.json`
				]
			})
		).toThrow();
		expect(() =>
			EquipmentImageResultSchema.parse({
				...validResult,
				writtenOutputPaths: [candidatePath, `${root}/runs/material-equipment-v1-run-001/plan.json`]
			})
		).toThrow();
	});
});

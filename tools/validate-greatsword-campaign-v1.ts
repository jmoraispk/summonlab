import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const CAMPAIGN_RELATIVE_ROOT = 'assets/equipment/experiments/two-handed-greatsword-v1';
const EXPECTED_CELLS = [
	{ rank: 'F', materialId: 'bronze', materialName: 'Bronze' },
	{ rank: 'E', materialId: 'iron', materialName: 'Iron' },
	{ rank: 'D', materialId: 'steel', materialName: 'Steel' },
	{ rank: 'C', materialId: 'blacksteel', materialName: 'Blacksteel' },
	{ rank: 'B', materialId: 'skyiron', materialName: 'Skyiron' },
	{ rank: 'A', materialId: 'starmetal', materialName: 'Starmetal' },
	{ rank: 'S', materialId: 'sunsteel', materialName: 'Sunsteel' }
] as const;

const ReferenceSchema = z
	.object({
		path: z.string().min(1),
		sha256: z.string().regex(HASH_PATTERN),
		purpose: z.string().min(1)
	})
	.strict();

const ManifestSchema = z
	.object({
		schemaVersion: z.literal('equipment-greatsword-campaign-v1'),
		campaignId: z.literal('two-handed-greatsword-v1'),
		lifecycleState: z.enum([
			'direction-proportion-revision-assigned',
			'direction-proportion-candidate-pending-owner-review',
			'direction-proportion-revision-review-pending-owner'
		]),
		itemModel: z.object({
			stableVisualFamilyId: z.literal('greatsword'),
			mechanicalClass: z.literal('sword'),
			slot: z.literal('main-hand'),
			handedness: z.literal('two-handed'),
			weightClass: z.literal('heavy'),
			rankBearingMaterialFamily: z.literal('metal')
		}),
		coverage: z.object({
			orderedRanks: z.array(z.string()),
			materialCells: z.array(
				z.object({ rank: z.string(), materialId: z.string(), materialName: z.string() })
			),
			directionImageCount: z.number().int(),
			dedicatedCandidateCount: z.number().int(),
			initialPixelCallCount: z.number().int(),
			currentDispatchablePixelCallCount: z.number().int()
		}),
		productionStats: z.object({
			completedPixelCallCount: z.number().int().min(2),
			completedInitialDirectionCalls: z.literal(1),
			completedBoundedCorrectionCalls: z.union([z.literal(1), z.literal(2)]),
			assignedProportionRevisionCalls: z.literal(1),
			dedicatedItemCallsRemainingAfterDirectionAcceptance: z.literal(7)
		}),
		references: z.array(ReferenceSchema),
		direction: z.object({
			targetPath: z.string(),
			assignmentPath: z.string(),
			promptPath: z.string(),
			candidatePath: z.string(),
			resultPath: z.string(),
			decisionPath: z.string(),
			status: z.literal('revise')
		}),
		proportionReview: z.object({
			contractPath: z.string(),
			v1MeasurementsPath: z.string(),
			status: z.literal('owner-approved')
		}),
		directionRevision: z.object({
			targetPath: z.string(),
			assignmentPath: z.string(),
			promptPath: z.string(),
			candidatePath: z.string(),
			resultPath: z.string(),
			measurementPath: z.string(),
			decisionPath: z.string(),
			status: z.enum(['assigned', 'candidate', 'revise'])
		}),
		plannedItems: z.array(
			z.object({
				targetId: z.string(),
				rank: z.string(),
				materialId: z.string(),
				candidatePath: z.string(),
				status: z.string()
			})
		),
		forbiddenWrites: z.array(z.string())
	});

const TargetSchema = z
	.object({
		schemaVersion: z.literal('equipment-greatsword-direction-target-v2'),
		targetId: z.literal('greatsword-v1-metal-rank-direction-v2'),
		campaignId: z.literal('two-handed-greatsword-v1'),
		artifactRole: z.literal('direction-reference'),
		visualFamilyId: z.literal('greatsword'),
		mechanicalClass: z.literal('sword'),
		revisionOfTargetId: z.literal('greatsword-v1-metal-rank-direction'),
		proportionContractPath: z.string(),
		orderedRanks: z.array(z.string()),
		orderedMaterials: z.array(z.string()),
		width: z.literal(1536),
		height: z.literal(1024),
		mediaType: z.literal('image/png'),
		candidatePath: z.string(),
		resultPath: z.string(),
		measurementPath: z.string()
	});

const AssignmentSchema = z
	.object({
		schemaVersion: z.literal('equipment-greatsword-direction-assignment-v2'),
		assignmentId: z.literal('assignment-greatsword-v1-metal-rank-direction-v2'),
		targetId: z.literal('greatsword-v1-metal-rank-direction-v2'),
		immutable: z.literal(true),
		dryRun: z.literal(false),
		retryCeiling: z.union([z.literal(0), z.literal(1)]),
		promptPath: z.string(),
		promptSha256: z.string().regex(HASH_PATTERN),
		references: z.array(ReferenceSchema),
		proportionContract: z.object({ path: z.string(), sha256: z.string().regex(HASH_PATTERN) }),
		permittedOutputs: z.object({
			candidatePath: z.string(),
			resultPath: z.string(),
			measurementPath: z.string()
		}),
		selfPromotionForbidden: z.literal(true)
	});

const RevisionResultSchema = z
	.object({
		schemaVersion: z.literal('equipment-greatsword-direction-result-v2'),
		resultId: z.string().min(1),
		targetId: z.literal('greatsword-v1-metal-rank-direction-v2'),
		assignmentId: z.literal('assignment-greatsword-v1-metal-rank-direction-v2'),
		attempt: z.number().int().min(1).max(2),
		status: z.enum(['candidate', 'revise']),
		provider: z.literal('OpenAI image generation'),
		promptSha256: z.string().regex(HASH_PATTERN),
		output: z.object({
			path: z.string(),
			sha256: z.string().regex(HASH_PATTERN),
			bytes: z.number().int().positive(),
			width: z.number().int().positive(),
			height: z.number().int().positive(),
			mediaType: z.literal('image/png')
		})
	});

const MeasurementReviewSchema = z.object({
	schemaVersion: z.literal('equipment-greatsword-proportion-review-v2'),
	reviewId: z.string().min(1),
	candidate: z.object({ path: z.string(), sha256: z.string().regex(HASH_PATTERN) }),
	contract: z.object({ path: z.string(), sha256: z.string().regex(HASH_PATTERN) }),
	measurements: z.array(
		z.object({
			rank: z.string(),
			materialId: z.string(),
			bladePx: z.number().positive(),
			fullHiltPx: z.number().positive(),
			exposedGripPx: z.number().positive(),
			guardWidthPx: z.number().positive(),
			pommelPx: z.number().positive(),
			overallPx: z.number().positive(),
			bladeToFullHilt: z.number().positive(),
			bladeToExposedGrip: z.number().positive(),
			bladePercent: z.number().positive(),
			guardPercent: z.number().positive(),
			pommelPercent: z.number().positive(),
			status: z.enum(['pass', 'fail']),
			failedCriteria: z.array(
				z.enum([
					'bladeToFullHilt',
					'bladeToExposedGrip',
					'bladePercent',
					'guardPercent',
					'pommelPercent'
				])
			)
		})
	),
	conclusion: z.enum(['candidate', 'revise']),
	humanReviewPending: z.literal(true)
});

export type GreatswordCampaignSummary = {
	campaignId: 'two-handed-greatsword-v1';
	materialCellCount: 7;
	dedicatedCandidateCount: 7;
	initialPixelCallCount: 8;
	currentDispatchablePixelCallCount: 0 | 1;
	state:
		| 'direction-proportion-revision-assigned'
		| 'direction-proportion-candidate-pending-owner-review'
		| 'direction-proportion-revision-review-pending-owner';
};

type GreatswordMeasurements = {
	bladePx: number;
	fullHiltPx: number;
	exposedGripPx: number;
	guardWidthPx: number;
	pommelPx: number;
	overallPx: number;
};

type GreatswordRatios = {
	bladeToFullHilt: number;
	bladeToExposedGrip: number;
	bladePercent: number;
	guardPercent: number;
	pommelPercent: number;
};

type GreatswordCriterion = keyof GreatswordRatios;

export function reviewGreatswordProportions(measurement: GreatswordMeasurements): {
	ratios: GreatswordRatios;
	status: 'pass' | 'fail';
	failedCriteria: GreatswordCriterion[];
} {
	const measurementKeys = [
		'bladePx',
		'fullHiltPx',
		'exposedGripPx',
		'guardWidthPx',
		'pommelPx',
		'overallPx'
	] as const;
	for (const name of measurementKeys) {
		const value = measurement[name];
		if (!Number.isFinite(value) || value <= 0) {
			throw new Error(`${name} must be a positive finite measurement.`);
		}
	}
	if (Math.abs(measurement.bladePx + measurement.fullHiltPx - measurement.overallPx) > 1) {
		throw new Error('Overall length must equal blade plus full-hilt length within one pixel.');
	}

	const round = (value: number) => Math.round(value * 100) / 100;
	const ratios = {
		bladeToFullHilt: round(measurement.bladePx / measurement.fullHiltPx),
		bladeToExposedGrip: round(measurement.bladePx / measurement.exposedGripPx),
		bladePercent: round((measurement.bladePx / measurement.overallPx) * 100),
		guardPercent: round((measurement.guardWidthPx / measurement.overallPx) * 100),
		pommelPercent: round((measurement.pommelPx / measurement.overallPx) * 100)
	};
	const failedCriteria: GreatswordCriterion[] = [];
	if (ratios.bladeToFullHilt < 2.5 || ratios.bladeToFullHilt > 2.8)
		failedCriteria.push('bladeToFullHilt');
	if (ratios.bladeToExposedGrip < 3.2 || ratios.bladeToExposedGrip > 3.7)
		failedCriteria.push('bladeToExposedGrip');
	if (ratios.bladePercent < 71 || ratios.bladePercent > 74)
		failedCriteria.push('bladePercent');
	if (ratios.guardPercent < 24 || ratios.guardPercent > 30)
		failedCriteria.push('guardPercent');
	if (ratios.pommelPercent < 4 || ratios.pommelPercent > 6)
		failedCriteria.push('pommelPercent');

	return { ratios, status: failedCriteria.length === 0 ? 'pass' : 'fail', failedCriteria };
}

export function validateGreatswordProportions(
	measurement: GreatswordMeasurements
): GreatswordRatios {
	const review = reviewGreatswordProportions(measurement);
	const messages: Record<GreatswordCriterion, string> = {
		bladeToFullHilt: 'Greatsword blade-to-full-hilt ratio must be between 2.5 and 2.8.',
		bladeToExposedGrip:
			'Greatsword blade-to-exposed-grip ratio must be between 3.2 and 3.7.',
		bladePercent: 'Greatsword blade must occupy between 71 and 74 percent of overall length.',
		guardPercent: 'Greatsword guard width must occupy between 24 and 30 percent of overall length.',
		pommelPercent: 'Greatsword pommel must occupy between 4 and 6 percent of overall length.'
	};
	if (review.failedCriteria[0]) throw new Error(messages[review.failedCriteria[0]]);
	return review.ratios;
}

export function validateGreatswordCampaign(input: {
	manifest: unknown;
	target: unknown;
	assignment: unknown;
	prompt: string;
}): GreatswordCampaignSummary {
	const manifest = ManifestSchema.parse(input.manifest);
	const target = TargetSchema.parse(input.target);
	const assignment = AssignmentSchema.parse(input.assignment);
	const expectedRanks = EXPECTED_CELLS.map(({ rank }) => rank);
	const expectedMaterials = EXPECTED_CELLS.map(({ materialId }) => materialId);

	if (JSON.stringify(manifest.coverage.materialCells) !== JSON.stringify(EXPECTED_CELLS)) {
		throw new Error('Greatsword coverage must contain exactly Bronze F through Sunsteel S.');
	}
	if (JSON.stringify(manifest.coverage.orderedRanks) !== JSON.stringify(expectedRanks)) {
		throw new Error('Greatsword rank order must be F, E, D, C, B, A, S.');
	}
	if (
		JSON.stringify(target.orderedRanks) !== JSON.stringify(expectedRanks) ||
		JSON.stringify(target.orderedMaterials) !== JSON.stringify(expectedMaterials)
	) {
		throw new Error('Direction target does not match the canonical Greatsword coverage.');
	}
	if (
		manifest.coverage.directionImageCount !== 1 ||
		manifest.coverage.dedicatedCandidateCount !== 7 ||
		manifest.coverage.initialPixelCallCount !== 8 ||
		manifest.coverage.currentDispatchablePixelCallCount !==
			(manifest.lifecycleState === 'direction-proportion-revision-assigned' ? 1 : 0)
	) {
		throw new Error('Greatsword image counts must remain 1 direction + 7 dedicated = 8.');
	}
	if (manifest.plannedItems.length !== 7) {
		throw new Error('Greatsword campaign must plan exactly seven dedicated candidates.');
	}
	for (const [index, item] of manifest.plannedItems.entries()) {
		const expected = EXPECTED_CELLS[index]!;
		if (item.rank !== expected.rank || item.materialId !== expected.materialId) {
			throw new Error('Planned Greatsword items must follow the canonical material ladder.');
		}
		if (item.status !== 'blocked-on-direction-decision') {
			throw new Error('Every standalone item must remain blocked-on-direction-decision.');
		}
	}
	const uniqueTargetIds = new Set(manifest.plannedItems.map(({ targetId }) => targetId));
	const uniqueCandidatePaths = new Set(manifest.plannedItems.map(({ candidatePath }) => candidatePath));
	if (uniqueTargetIds.size !== 7 || uniqueCandidatePaths.size !== 7) {
		throw new Error('Greatsword target IDs and candidate paths must be collision-safe and unique.');
	}
	const promptSha256 = createHash('sha256').update(input.prompt).digest('hex');
	if (assignment.promptSha256 !== promptSha256) {
		throw new Error('Direction assignment prompt SHA-256 does not match prompt bytes.');
	}
	if (assignment.targetId !== target.targetId) {
		throw new Error('Direction target and assignment IDs do not match.');
	}
	if (
		assignment.permittedOutputs.candidatePath !== target.candidatePath ||
		assignment.permittedOutputs.resultPath !== target.resultPath ||
		assignment.permittedOutputs.measurementPath !== target.measurementPath ||
		manifest.directionRevision.candidatePath !== target.candidatePath ||
		manifest.directionRevision.resultPath !== target.resultPath ||
		manifest.directionRevision.measurementPath !== target.measurementPath
	) {
		throw new Error('Direction output ownership is not consistently bound.');
	}
	if (assignment.references.length !== 0) {
		throw new Error('The proportion revision must not inherit short-sword image geometry.');
	}
	if (
		assignment.proportionContract.path !== manifest.proportionReview.contractPath ||
		target.proportionContractPath !== manifest.proportionReview.contractPath
	) {
		throw new Error('The v2 target and assignment must bind the approved proportion contract.');
	}
	for (const path of [
		target.candidatePath,
		target.resultPath,
		...manifest.plannedItems.map(({ candidatePath }) => candidatePath)
	]) {
		if (!path.startsWith(`${CAMPAIGN_RELATIVE_ROOT}/`)) {
			throw new Error(`Campaign output escapes its owned namespace: ${path}`);
		}
	}

	return {
		campaignId: manifest.campaignId,
		materialCellCount: 7,
		dedicatedCandidateCount: 7,
		initialPixelCallCount: 8,
		currentDispatchablePixelCallCount: manifest.coverage.currentDispatchablePixelCallCount as 0 | 1,
		state: manifest.lifecycleState
	};
}

export async function validateGreatswordCampaignFiles(repositoryRoot: string): Promise<
	GreatswordCampaignSummary & {
		artifactState:
			| 'ready-for-proportion-revision-call'
			| 'direction-proportion-candidate-recorded'
			| 'direction-proportion-revision-recorded';
		referenceCount: 0;
	}
> {
	const campaignRoot = `${repositoryRoot}/${CAMPAIGN_RELATIVE_ROOT}`;
	const manifest = JSON.parse(readFileSync(`${campaignRoot}/manifest.json`, 'utf8')) as unknown;
	const target = JSON.parse(
		readFileSync(`${campaignRoot}/direction/greatsword-metal-ranks-v2.target.json`, 'utf8')
	) as unknown;
	const assignment = JSON.parse(
		readFileSync(`${campaignRoot}/direction/greatsword-metal-ranks-v2.assignment.json`, 'utf8')
	) as unknown;
	const prompt = readFileSync(
		`${campaignRoot}/direction/greatsword-metal-ranks-v2.prompt.txt`,
		'utf8'
	);
	const summary = validateGreatswordCampaign({ manifest, target, assignment, prompt });
	const parsedAssignment = AssignmentSchema.parse(assignment);
	const parsedTarget = TargetSchema.parse(target);

	const proportionContractBytes = readFileSync(
		`${repositoryRoot}/${parsedAssignment.proportionContract.path}`
	);
	const proportionContractSha256 = createHash('sha256')
		.update(proportionContractBytes)
		.digest('hex');
	if (proportionContractSha256 !== parsedAssignment.proportionContract.sha256) {
		throw new Error('Proportion contract SHA-256 mismatch.');
	}

	const candidateAbsolutePath = `${repositoryRoot}/${parsedTarget.candidatePath}`;
	const resultAbsolutePath = `${repositoryRoot}/${parsedTarget.resultPath}`;
	const measurementAbsolutePath = `${repositoryRoot}/${parsedTarget.measurementPath}`;
	const candidateExists = existsSync(candidateAbsolutePath);
	const resultExists = existsSync(resultAbsolutePath);
	const measurementExists = existsSync(measurementAbsolutePath);
	if (new Set([candidateExists, resultExists, measurementExists]).size !== 1) {
		throw new Error(
			'Direction candidate, result receipt, and proportion measurements must all exist or all be absent.'
		);
	}
	if (!candidateExists) {
		return {
			...summary,
			artifactState: 'ready-for-proportion-revision-call',
			referenceCount: 0
		};
	}

	const result = RevisionResultSchema.parse(JSON.parse(readFileSync(resultAbsolutePath, 'utf8')));
	const measurementReview = MeasurementReviewSchema.parse(
		JSON.parse(readFileSync(measurementAbsolutePath, 'utf8'))
	);
	const candidateBytes = readFileSync(candidateAbsolutePath);
	const candidateSha256 = createHash('sha256').update(candidateBytes).digest('hex');
	const metadata = await sharp(candidateBytes).metadata();
	if (
		result.promptSha256 !== parsedAssignment.promptSha256 ||
		result.output.path !== parsedTarget.candidatePath ||
		result.output.sha256 !== candidateSha256 ||
		result.output.bytes !== candidateBytes.length ||
		result.output.width !== metadata.width ||
		result.output.height !== metadata.height ||
		metadata.format !== 'png'
	) {
		throw new Error('Direction result receipt does not match the retained candidate bytes.');
	}
	if (
		measurementReview.candidate.path !== parsedTarget.candidatePath ||
		measurementReview.candidate.sha256 !== candidateSha256 ||
		measurementReview.contract.path !== parsedAssignment.proportionContract.path ||
		measurementReview.contract.sha256 !== parsedAssignment.proportionContract.sha256 ||
		measurementReview.measurements.length !== 7
	) {
		throw new Error('Proportion review does not bind the v2 candidate and contract.');
	}
	for (const [index, measurement] of measurementReview.measurements.entries()) {
		const expected = EXPECTED_CELLS[index]!;
		if (measurement.rank !== expected.rank || measurement.materialId !== expected.materialId) {
			throw new Error('Proportion review measurements must follow the canonical rank order.');
		}
		const review = reviewGreatswordProportions(measurement);
		for (const key of Object.keys(review.ratios) as Array<keyof typeof review.ratios>) {
			if (measurement[key] !== review.ratios[key]) {
				throw new Error(`Recorded proportion ${key} does not match its source measurements.`);
			}
		}
		if (
			measurement.status !== review.status ||
			JSON.stringify(measurement.failedCriteria) !== JSON.stringify(review.failedCriteria)
		) {
			throw new Error('Recorded proportion status does not match its source measurements.');
		}
	}
	const hasFailedMeasurement = measurementReview.measurements.some(
		(measurement) => measurement.status === 'fail'
	);
	if (
		(measurementReview.conclusion === 'revise') !== hasFailedMeasurement ||
		(result.status === 'revise') !== hasFailedMeasurement ||
		(summary.state === 'direction-proportion-revision-review-pending-owner') !==
			hasFailedMeasurement
	) {
		throw new Error('Campaign state, result status, and proportion conclusion must agree.');
	}

	return {
		...summary,
		artifactState: hasFailedMeasurement
			? 'direction-proportion-revision-recorded'
			: 'direction-proportion-candidate-recorded',
		referenceCount: 0
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const repositoryRoot = process.cwd();
	validateGreatswordCampaignFiles(repositoryRoot)
		.then((summary) => console.log(JSON.stringify(summary, null, 2)))
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		});
}

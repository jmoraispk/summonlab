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
		lifecycleState: z.literal('direction-candidate-pending-owner-review'),
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
		references: z.array(ReferenceSchema),
		direction: z.object({
			targetPath: z.string(),
			assignmentPath: z.string(),
			promptPath: z.string(),
			candidatePath: z.string(),
			resultPath: z.string(),
			decisionPath: z.string(),
			status: z.literal('candidate')
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
		schemaVersion: z.literal('equipment-greatsword-direction-target-v1'),
		targetId: z.literal('greatsword-v1-metal-rank-direction'),
		campaignId: z.literal('two-handed-greatsword-v1'),
		artifactRole: z.literal('direction-reference'),
		visualFamilyId: z.literal('greatsword'),
		mechanicalClass: z.literal('sword'),
		orderedRanks: z.array(z.string()),
		orderedMaterials: z.array(z.string()),
		width: z.literal(1536),
		height: z.literal(1024),
		mediaType: z.literal('image/png'),
		candidatePath: z.string(),
		resultPath: z.string()
	});

const AssignmentSchema = z
	.object({
		schemaVersion: z.literal('equipment-greatsword-direction-assignment-v1'),
		assignmentId: z.literal('assignment-greatsword-v1-metal-rank-direction'),
		targetId: z.literal('greatsword-v1-metal-rank-direction'),
		immutable: z.literal(true),
		dryRun: z.literal(false),
		retryCeiling: z.union([z.literal(0), z.literal(1)]),
		promptPath: z.string(),
		promptSha256: z.string().regex(HASH_PATTERN),
		references: z.array(ReferenceSchema),
		permittedOutputs: z.object({ candidatePath: z.string(), resultPath: z.string() }),
		selfPromotionForbidden: z.literal(true)
	});

const ResultSchema = z
	.object({
		schemaVersion: z.literal('equipment-greatsword-direction-result-v1'),
		resultId: z.string().min(1),
		targetId: z.literal('greatsword-v1-metal-rank-direction'),
		assignmentId: z.literal('assignment-greatsword-v1-metal-rank-direction'),
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

export type GreatswordCampaignSummary = {
	campaignId: 'two-handed-greatsword-v1';
	materialCellCount: 7;
	dedicatedCandidateCount: 7;
	initialPixelCallCount: 8;
	currentDispatchablePixelCallCount: 0;
	state: 'direction-candidate-pending-owner-review';
};

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
		manifest.coverage.currentDispatchablePixelCallCount !== 0
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
		manifest.direction.candidatePath !== target.candidatePath ||
		manifest.direction.resultPath !== target.resultPath
	) {
		throw new Error('Direction output ownership is not consistently bound.');
	}
	if (JSON.stringify(manifest.references) !== JSON.stringify(assignment.references)) {
		throw new Error('Manifest and assignment reference bindings differ.');
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
		currentDispatchablePixelCallCount: 0,
		state: manifest.lifecycleState
	};
}

export async function validateGreatswordCampaignFiles(repositoryRoot: string): Promise<
	GreatswordCampaignSummary & {
		artifactState: 'ready-for-direction-call' | 'direction-candidate-recorded';
		referenceCount: 2;
	}
> {
	const campaignRoot = `${repositoryRoot}/${CAMPAIGN_RELATIVE_ROOT}`;
	const manifest = JSON.parse(readFileSync(`${campaignRoot}/manifest.json`, 'utf8')) as unknown;
	const target = JSON.parse(
		readFileSync(`${campaignRoot}/direction/greatsword-metal-ranks-v1.target.json`, 'utf8')
	) as unknown;
	const assignment = JSON.parse(
		readFileSync(`${campaignRoot}/direction/greatsword-metal-ranks-v1.assignment.json`, 'utf8')
	) as unknown;
	const prompt = readFileSync(
		`${campaignRoot}/direction/greatsword-metal-ranks-v1.prompt.txt`,
		'utf8'
	);
	const summary = validateGreatswordCampaign({ manifest, target, assignment, prompt });
	const parsedAssignment = AssignmentSchema.parse(assignment);
	const parsedTarget = TargetSchema.parse(target);

	for (const reference of parsedAssignment.references) {
		const bytes = readFileSync(`${repositoryRoot}/${reference.path}`);
		const actualSha256 = createHash('sha256').update(bytes).digest('hex');
		if (actualSha256 !== reference.sha256) {
			throw new Error(`Reference SHA-256 mismatch: ${reference.path}`);
		}
	}

	const candidateAbsolutePath = `${repositoryRoot}/${parsedTarget.candidatePath}`;
	const resultAbsolutePath = `${repositoryRoot}/${parsedTarget.resultPath}`;
	const candidateExists = existsSync(candidateAbsolutePath);
	const resultExists = existsSync(resultAbsolutePath);
	if (candidateExists !== resultExists) {
		throw new Error('Direction candidate and result receipt must either both exist or both be absent.');
	}
	if (!candidateExists) {
		return { ...summary, artifactState: 'ready-for-direction-call', referenceCount: 2 };
	}

	const result = ResultSchema.parse(JSON.parse(readFileSync(resultAbsolutePath, 'utf8')));
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

	return { ...summary, artifactState: 'direction-candidate-recorded', referenceCount: 2 };
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

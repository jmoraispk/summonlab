import { createHash } from 'node:crypto';
import { lstat, unlink } from 'node:fs/promises';

import { z } from 'zod';

import {
	EquipmentV2ImageAssignmentSchema,
	EquipmentV2ImageTargetSchema,
	EquipmentV2ProfileAcceptanceSchema
} from './equipment-image-production-contract-v2.js';
import {
	EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH,
	buildEquipmentV2ProfileAcceptance,
	canonicalJsonSha256V2
} from './equipment-image-profile-acceptance-v2.js';
import {
	EQUIPMENT_V2_VISUAL_PROFILE_PATH,
	EquipmentVisualProfileV2Schema,
	buildEquipmentVisualProfileV2
} from './equipment-image-profile-v2.js';
import { buildRootEquipmentPacketsV2 } from './equipment-image-packets-v2.js';
import {
	EQUIPMENT_V2_ALLOCATION_PLAN_PATH,
	EQUIPMENT_V2_MANIFEST_PATH,
	EQUIPMENT_V2_PRODUCTION_ROOT,
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';
import {
	equipmentRepositoryAbsolute,
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,159}$/u);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const IsoDateTimeSchema = z.iso.datetime({ offset: true });
const NonEmptyTextSchema = z.string().trim().min(1).max(4_000);

const V2PathSchema = z
	.string()
	.refine((value) => value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/`), {
		message: 'Run artifact path must remain inside the Equipment v2 production root'
	})
	.refine(
		(value) =>
			!value.includes('\\') &&
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Run artifact path must be repository-relative POSIX without traversal' }
	);

const TargetPacketPathSchema = V2PathSchema.refine(
	(value) =>
		value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/targets/`) && value.endsWith('.json'),
	{ message: 'Expected an Equipment v2 target packet path' }
);
const AssignmentPacketPathSchema = V2PathSchema.refine(
	(value) =>
		value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/assignments/`) && value.endsWith('.json'),
	{ message: 'Expected an Equipment v2 assignment packet path' }
);
const CandidatePathSchema = V2PathSchema.refine(
	(value) =>
		value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/candidates/`) && value.endsWith('.png'),
	{ message: 'Expected an Equipment v2 candidate path' }
);
const ResultPathSchema = V2PathSchema.refine(
	(value) =>
		value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/results/`) && value.endsWith('.json'),
	{ message: 'Expected an Equipment v2 result path' }
);
const ReviewPathSchema = V2PathSchema.refine(
	(value) =>
		value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/reviews/`) && value.endsWith('.json'),
	{ message: 'Expected an Equipment v2 review path' }
);
const RunArtifactPathSchema = V2PathSchema.refine(
	(value) => value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/runs/`) && value.endsWith('.json'),
	{ message: 'Expected an Equipment v2 run artifact path' }
);

const BoundArtifactsSchema = z
	.object({
		manifestCanonicalSha256: HashSchema,
		allocationCanonicalSha256: HashSchema,
		profileCanonicalSha256: HashSchema,
		profileAcceptanceCanonicalSha256: HashSchema
	})
	.strict();

const RootPacketBindingSchema = z
	.object({
		targetId: SlugSchema,
		targetPath: TargetPacketPathSchema,
		targetCanonicalSha256: HashSchema,
		assignmentPath: AssignmentPacketPathSchema,
		assignmentCanonicalSha256: HashSchema
	})
	.strict();

const ReviewGateSchema = z
	.object({
		gateId: SlugSchema,
		sourceTargetId: SlugSchema,
		unlocksTargetIds: z.array(SlugSchema).length(4),
		reviewPath: ReviewPathSchema
	})
	.strict();

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
	const leftSet = new Set(left);
	const rightSet = new Set(right);
	return leftSet.size === rightSet.size && [...leftSet].every((value) => rightSet.has(value));
}

export const EquipmentV2RunPlanSchema = z
	.object({
		schemaVersion: z.literal('equipment-production-run-plan-v2'),
		runId: SlugSchema,
		productionId: z.literal('material-equipment-v2'),
		createdAt: IsoDateTimeSchema,
		maximumConcurrency: z.literal(16),
		boundArtifacts: BoundArtifactsSchema,
		versions: z
			.object({
				contract: z.literal('equipment-image-production-contract-v2'),
				renderer: z.literal('equipment-image-prompt-v2'),
				verifier: z.literal('equipment-image-result-verifier-v2'),
				persistence: z.literal('equipment-image-persistence-v2'),
				journal: z.literal('equipment-production-journal-v2')
			})
			.strict(),
		targetIds: z.array(SlugSchema).length(161),
		rootPackets: z.array(RootPacketBindingSchema).length(77),
		reviewGates: z.array(ReviewGateSchema).length(21),
		gatedChildTargetIds: z.array(SlugSchema).length(84),
		initialGeneration: z
			.object({
				scope: z.literal('root-targets-only'),
				authorizedTargetIds: z.array(SlugSchema).length(77),
				gatedChildrenAuthorized: z.literal(false)
			})
			.strict(),
		reservedPaths: z
			.object({
				candidates: z.array(CandidatePathSchema).length(161),
				results: z.array(ResultPathSchema).length(161),
				reviews: z.array(ReviewPathSchema).length(21),
				runArtifacts: z.tuple([RunArtifactPathSchema, RunArtifactPathSchema])
			})
			.strict()
	})
	.strict()
	.superRefine((plan, context) => {
		const rootIds = plan.rootPackets.map(({ targetId }) => targetId);
		const gateChildren = plan.reviewGates.flatMap(({ unlocksTargetIds }) => unlocksTargetIds);
		const uniqueCollections: Array<[string, readonly string[]]> = [
			['target IDs', plan.targetIds],
			['root target IDs', rootIds],
			['gate IDs', plan.reviewGates.map(({ gateId }) => gateId)],
			['gate source IDs', plan.reviewGates.map(({ sourceTargetId }) => sourceTargetId)],
			['gate child IDs', gateChildren],
			['reserved paths', Object.values(plan.reservedPaths).flat()]
		];
		for (const [label, values] of uniqueCollections) {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', message: `Run plan ${label} must be unique` });
			}
		}
		if (!sameMembers(rootIds, plan.initialGeneration.authorizedTargetIds)) {
			context.addIssue({
				code: 'custom',
				message: 'Initial generation authorization must equal the 77 root packets'
			});
		}
		if (!sameMembers(gateChildren, plan.gatedChildTargetIds)) {
			context.addIssue({
				code: 'custom',
				message: 'The 84 gated children must equal the review-gate unlock set'
			});
		}
		if (!sameMembers([...rootIds, ...plan.gatedChildTargetIds], plan.targetIds)) {
			context.addIssue({
				code: 'custom',
				message: 'Root and gated targets must partition all 161 targets'
			});
		}
		const rootSet = new Set(rootIds);
		if (plan.reviewGates.some(({ sourceTargetId }) => !rootSet.has(sourceTargetId))) {
			context.addIssue({
				code: 'custom',
				message: 'Every review gate source must be a materialized root packet'
			});
		}
	});

export const EquipmentV2RunActivationSchema = z
	.object({
		schemaVersion: z.literal('equipment-production-run-activation-v2'),
		activationId: SlugSchema,
		runId: SlugSchema,
		runPlanCanonicalSha256: HashSchema,
		activatedAt: IsoDateTimeSchema,
		activatedBy: NonEmptyTextSchema.max(120),
		authorization: z
			.object({
				scope: z.literal('root-targets-only'),
				imageGenerationAuthorized: z.literal(true),
				authorizedTargetIds: z.array(SlugSchema).length(77),
				maximumConcurrency: z.literal(16),
				gatedChildrenAuthorized: z.literal(false)
			})
			.strict()
	})
	.strict();

const BlockerSchema = z
	.object({
		code: SlugSchema,
		message: NonEmptyTextSchema,
		path: V2PathSchema.optional()
	})
	.strict();

export const EquipmentV2RunReadinessSchema = z
	.object({
		schemaVersion: z.literal('equipment-production-run-readiness-v2'),
		runId: SlugSchema,
		checkedAt: IsoDateTimeSchema,
		status: z.enum(['ready-to-activate', 'activated-root-generation-authorized', 'blocked']),
		writesPerformed: z.literal(0),
		summary: z
			.object({
				totalTargets: z.literal(161),
				materializedRootPackets: z.literal(77),
				initiallyAuthorizedImages: z.literal(77),
				gatedChildTargets: z.literal(84),
				armourReviewGates: z.literal(21),
				maximumConcurrency: z.literal(16)
			})
			.strict(),
		generation: z
			.object({
				authorized: z.boolean(),
				scope: z.enum(['none', 'root-targets-only']),
				authorizedTargetCount: z.union([z.literal(0), z.literal(77)]),
				gatedChildrenAuthorized: z.literal(false)
			})
			.strict(),
		blockers: z.array(BlockerSchema)
	})
	.strict()
	.superRefine((report, context) => {
		const blocked = report.status === 'blocked';
		if (blocked !== report.blockers.length > 0) {
			context.addIssue({ code: 'custom', message: 'Only blocked readiness may have blockers' });
		}
		const activated = report.status === 'activated-root-generation-authorized';
		if (
			report.generation.authorized !== activated ||
			report.generation.scope !== (activated ? 'root-targets-only' : 'none') ||
			report.generation.authorizedTargetCount !== (activated ? 77 : 0)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Generation authorization must exactly match readiness activation state'
			});
		}
	});

export type EquipmentV2RunPlan = z.infer<typeof EquipmentV2RunPlanSchema>;
export type EquipmentV2RunActivation = z.infer<typeof EquipmentV2RunActivationSchema>;
export type EquipmentV2RunReadiness = z.infer<typeof EquipmentV2RunReadinessSchema>;

export const DEFAULT_EQUIPMENT_V2_RUN_ID = 'material-equipment-v2-run-001' as const;

function runPaths(runId: string) {
	const directory = `${EQUIPMENT_V2_PRODUCTION_ROOT}/runs/${runId}`;
	return {
		directory,
		planPath: `${directory}/plan.json`,
		activationPath: `${directory}/activation.json`,
		lockPath: `${EQUIPMENT_V2_PRODUCTION_ROOT}/runs/.${runId}.activation.lock`
	};
}

function packetPathForCandidate(candidatePath: string, directory: 'targets' | 'assignments') {
	const prefix = `${EQUIPMENT_V2_PRODUCTION_ROOT}/candidates/`;
	if (!candidatePath.startsWith(prefix) || !candidatePath.endsWith('.png')) {
		throw new Error(`Invalid Equipment v2 candidate path: ${candidatePath}`);
	}
	return `${EQUIPMENT_V2_PRODUCTION_ROOT}/${directory}/${candidatePath.slice(prefix.length, -4)}.json`;
}

function byteSha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function serializeJson(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

async function readBoundSources(workspaceRoot: string) {
	const [manifestValue, allocationValue, profileValue, acceptanceValue] = await Promise.all([
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V2_MANIFEST_PATH),
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V2_ALLOCATION_PLAN_PATH),
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V2_VISUAL_PROFILE_PATH),
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH)
	]);
	const expectedManifest = buildEquipmentMaterialProductionManifestV2();
	const expectedAllocation = buildEquipmentMaterialAllocationPlanV2();
	if (canonicalJsonSha256V2(manifestValue) !== canonicalJsonSha256V2(expectedManifest)) {
		throw new Error('Equipment v2 manifest is stale or not deterministic');
	}
	if (canonicalJsonSha256V2(allocationValue) !== canonicalJsonSha256V2(expectedAllocation)) {
		throw new Error('Equipment v2 allocation is stale or not deterministic');
	}
	const profile = EquipmentVisualProfileV2Schema.parse(profileValue);
	if (canonicalJsonSha256V2(profile) !== canonicalJsonSha256V2(buildEquipmentVisualProfileV2())) {
		throw new Error('Equipment v2 profile is stale or not deterministic');
	}
	const acceptance = EquipmentV2ProfileAcceptanceSchema.parse(acceptanceValue);
	const expectedAcceptance = buildEquipmentV2ProfileAcceptance({
		profile,
		acknowledgedProfileSha256: acceptance.profileCanonicalSha256,
		acceptedAt: acceptance.acceptedAt
	});
	if (canonicalJsonSha256V2(acceptance) !== canonicalJsonSha256V2(expectedAcceptance)) {
		throw new Error('Equipment v2 profile acceptance is stale or not deterministic');
	}
	for (const reference of profile.references) {
		const bytes = await readEquipmentRepositoryFile(workspaceRoot, reference.path);
		if (byteSha256(bytes) !== reference.contentHash) {
			throw new Error(`Equipment v2 reference hash mismatch: ${reference.path}`);
		}
	}
	return {
		manifest: expectedManifest,
		allocation: expectedAllocation,
		profile,
		acceptance
	};
}

export async function buildEquipmentV2RunPlan(input: {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly createdAt: string;
}): Promise<EquipmentV2RunPlan> {
	const sources = await readBoundSources(input.workspaceRoot);
	const expectedPackets = buildRootEquipmentPacketsV2(sources);
	const rootPackets = await Promise.all(
		expectedPackets.map(async (expected) => {
			const [targetValue, assignmentValue] = await Promise.all([
				readEquipmentRepositoryJson(input.workspaceRoot, expected.targetPath),
				readEquipmentRepositoryJson(input.workspaceRoot, expected.assignmentPath)
			]);
			const target = EquipmentV2ImageTargetSchema.parse(targetValue);
			const assignment = EquipmentV2ImageAssignmentSchema.parse(assignmentValue);
			if (
				canonicalJsonSha256V2(target) !== canonicalJsonSha256V2(expected.target) ||
				canonicalJsonSha256V2(assignment) !== canonicalJsonSha256V2(expected.assignment)
			) {
				throw new Error(
					`Equipment v2 packet is stale or not deterministic: ${expected.targetPath}`
				);
			}
			return {
				targetId: target.targetId,
				targetPath: expected.targetPath,
				targetCanonicalSha256: canonicalJsonSha256V2(target),
				assignmentPath: expected.assignmentPath,
				assignmentCanonicalSha256: canonicalJsonSha256V2(assignment)
			};
		})
	);
	const gatedChildTargetIds = sources.manifest.targets
		.filter(({ dependsOnTargetId }) => dependsOnTargetId !== null)
		.map(({ targetId }) => targetId);
	const paths = runPaths(input.runId);
	return EquipmentV2RunPlanSchema.parse({
		schemaVersion: 'equipment-production-run-plan-v2',
		runId: input.runId,
		productionId: sources.manifest.productionId,
		createdAt: input.createdAt,
		maximumConcurrency: 16,
		boundArtifacts: {
			manifestCanonicalSha256: canonicalJsonSha256V2(sources.manifest),
			allocationCanonicalSha256: canonicalJsonSha256V2(sources.allocation),
			profileCanonicalSha256: canonicalJsonSha256V2(sources.profile),
			profileAcceptanceCanonicalSha256: canonicalJsonSha256V2(sources.acceptance)
		},
		versions: {
			contract: 'equipment-image-production-contract-v2',
			renderer: 'equipment-image-prompt-v2',
			verifier: 'equipment-image-result-verifier-v2',
			persistence: 'equipment-image-persistence-v2',
			journal: 'equipment-production-journal-v2'
		},
		targetIds: sources.manifest.targets.map(({ targetId }) => targetId),
		rootPackets,
		reviewGates: sources.allocation.reviewGates.map((gate) => ({
			gateId: gate.gateId,
			sourceTargetId: gate.sourceTargetId,
			unlocksTargetIds: gate.unlocksTargetIds,
			reviewPath: gate.evidencePath
		})),
		gatedChildTargetIds,
		initialGeneration: {
			scope: 'root-targets-only',
			authorizedTargetIds: rootPackets.map(({ targetId }) => targetId),
			gatedChildrenAuthorized: false
		},
		reservedPaths: {
			candidates: sources.manifest.targets.map(({ output }) => output.candidatePath),
			results: sources.manifest.targets.map(({ output }) => output.provenanceResultPath),
			reviews: sources.allocation.reviewGates.map(({ evidencePath }) => evidencePath),
			runArtifacts: [paths.planPath, paths.activationPath]
		}
	});
}

async function activationState(input: {
	readonly workspaceRoot: string;
	readonly expectedPlan: EquipmentV2RunPlan;
}): Promise<{ state: 'absent' | 'valid' | 'invalid'; blockers: z.infer<typeof BlockerSchema>[] }> {
	const paths = runPaths(input.expectedPlan.runId);
	try {
		const [planState, receiptState] = await Promise.all([
			equipmentRepositoryPathState(input.workspaceRoot, paths.planPath),
			equipmentRepositoryPathState(input.workspaceRoot, paths.activationPath)
		]);
		if (planState === 'absent' && receiptState === 'absent')
			return { state: 'absent', blockers: [] };
		if (planState !== 'file' || receiptState !== 'file') {
			throw new Error('Immutable run plan and activation receipt must both exist as regular files');
		}
		const persistedPlan = EquipmentV2RunPlanSchema.parse(
			await readEquipmentRepositoryJson(input.workspaceRoot, paths.planPath)
		);
		const expectedWithPersistedTime = EquipmentV2RunPlanSchema.parse({
			...input.expectedPlan,
			createdAt: persistedPlan.createdAt
		});
		if (canonicalJsonSha256V2(persistedPlan) !== canonicalJsonSha256V2(expectedWithPersistedTime)) {
			throw new Error('Persisted Equipment v2 run plan is stale');
		}
		const receipt = EquipmentV2RunActivationSchema.parse(
			await readEquipmentRepositoryJson(input.workspaceRoot, paths.activationPath)
		);
		if (
			receipt.runId !== persistedPlan.runId ||
			receipt.runPlanCanonicalSha256 !== canonicalJsonSha256V2(persistedPlan) ||
			!sameMembers(
				receipt.authorization.authorizedTargetIds,
				persistedPlan.initialGeneration.authorizedTargetIds
			)
		) {
			throw new Error('Equipment v2 activation does not bind the immutable root-only run plan');
		}
		return { state: 'valid', blockers: [] };
	} catch (error) {
		return {
			state: 'invalid',
			blockers: [
				{
					code: 'invalid-activation',
					message: error instanceof Error ? error.message : String(error),
					path: paths.directory
				}
			]
		};
	}
}

async function outputAndChildPacketBlockers(
	workspaceRoot: string,
	plan: EquipmentV2RunPlan
): Promise<z.infer<typeof BlockerSchema>[]> {
	const blockers: z.infer<typeof BlockerSchema>[] = [];
	for (let index = 0; index < plan.targetIds.length; index += 1) {
		const candidatePath = plan.reservedPaths.candidates[index]!;
		const resultPath = plan.reservedPaths.results[index]!;
		try {
			const [candidateState, resultState] = await Promise.all([
				equipmentRepositoryPathState(workspaceRoot, candidatePath),
				equipmentRepositoryPathState(workspaceRoot, resultPath)
			]);
			if (candidateState !== 'absent' || resultState !== 'absent') {
				blockers.push({
					code:
						candidateState === 'absent' || resultState === 'absent'
							? 'partial-output'
							: 'unexpected-output',
					message: `Reserved candidate/result output already exists for ${plan.targetIds[index]}`,
					path: candidateState !== 'absent' ? candidatePath : resultPath
				});
			}
		} catch (error) {
			blockers.push({
				code: 'unsafe-output-path',
				message: error instanceof Error ? error.message : String(error),
				path: candidatePath
			});
		}
	}
	const candidateByTargetId = new Map(
		plan.targetIds.map(
			(targetId, index) => [targetId, plan.reservedPaths.candidates[index]!] as const
		)
	);
	for (const targetId of plan.gatedChildTargetIds) {
		const candidatePath = candidateByTargetId.get(targetId)!;
		for (const packetPath of [
			packetPathForCandidate(candidatePath, 'targets'),
			packetPathForCandidate(candidatePath, 'assignments')
		]) {
			try {
				if ((await equipmentRepositoryPathState(workspaceRoot, packetPath)) !== 'absent') {
					blockers.push({
						code: 'premature-child-packet',
						message: `Review-gated child packet must remain absent: ${packetPath}`,
						path: packetPath
					});
				}
			} catch (error) {
				blockers.push({
					code: 'premature-child-packet',
					message: error instanceof Error ? error.message : String(error),
					path: packetPath
				});
			}
		}
	}
	return blockers;
}

export async function reportEquipmentV2RunReadiness(input: {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly createdAt: string;
	readonly checkedAt: string;
}): Promise<EquipmentV2RunReadiness> {
	let plan: EquipmentV2RunPlan;
	try {
		plan = await buildEquipmentV2RunPlan(input);
	} catch (error) {
		return EquipmentV2RunReadinessSchema.parse({
			schemaVersion: 'equipment-production-run-readiness-v2',
			runId: input.runId,
			checkedAt: input.checkedAt,
			status: 'blocked',
			writesPerformed: 0,
			summary: {
				totalTargets: 161,
				materializedRootPackets: 77,
				initiallyAuthorizedImages: 77,
				gatedChildTargets: 84,
				armourReviewGates: 21,
				maximumConcurrency: 16
			},
			generation: {
				authorized: false,
				scope: 'none',
				authorizedTargetCount: 0,
				gatedChildrenAuthorized: false
			},
			blockers: [
				{
					code: 'static-or-packet-invalid',
					message: error instanceof Error ? error.message : String(error)
				}
			]
		});
	}
	const activation = await activationState({
		workspaceRoot: input.workspaceRoot,
		expectedPlan: plan
	});
	const blockers = [
		...activation.blockers,
		...(activation.state === 'absent'
			? await outputAndChildPacketBlockers(input.workspaceRoot, plan)
			: [])
	];
	const activated = activation.state === 'valid' && blockers.length === 0;
	return EquipmentV2RunReadinessSchema.parse({
		schemaVersion: 'equipment-production-run-readiness-v2',
		runId: input.runId,
		checkedAt: input.checkedAt,
		status:
			blockers.length > 0
				? 'blocked'
				: activated
					? 'activated-root-generation-authorized'
					: 'ready-to-activate',
		writesPerformed: 0,
		summary: {
			totalTargets: 161,
			materializedRootPackets: 77,
			initiallyAuthorizedImages: 77,
			gatedChildTargets: 84,
			armourReviewGates: 21,
			maximumConcurrency: 16
		},
		generation: {
			authorized: activated,
			scope: activated ? 'root-targets-only' : 'none',
			authorizedTargetCount: activated ? 77 : 0,
			gatedChildrenAuthorized: false
		},
		blockers
	});
}

interface FileIdentity {
	readonly device: number;
	readonly inode: number;
}

async function identityFor(repositoryPath: string, workspaceRoot: string): Promise<FileIdentity> {
	const metadata = await lstat(equipmentRepositoryAbsolute(workspaceRoot, repositoryPath));
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Equipment v2 activation artifact is not a regular file: ${repositoryPath}`);
	}
	return { device: metadata.dev, inode: metadata.ino };
}

async function releaseOwnedPath(
	workspaceRoot: string,
	repositoryPath: string,
	identity: FileIdentity
): Promise<void> {
	const absolute = equipmentRepositoryAbsolute(workspaceRoot, repositoryPath);
	const metadata = await lstat(absolute).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (
		metadata !== null &&
		!metadata.isSymbolicLink() &&
		metadata.isFile() &&
		metadata.dev === identity.device &&
		metadata.ino === identity.inode
	) {
		await unlink(absolute);
	}
}

export async function activateEquipmentV2Run(input: {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly createdAt: string;
	readonly activatedAt: string;
	readonly activatedBy: string;
}): Promise<{
	readonly runId: string;
	readonly planPath: string;
	readonly activationPath: string;
	readonly runPlanCanonicalSha256: string;
	readonly authorizedRootTargets: 77;
	readonly maximumConcurrency: 16;
	readonly writesPerformed: 2;
}> {
	const paths = runPaths(input.runId);
	const initial = await reportEquipmentV2RunReadiness({
		...input,
		checkedAt: input.activatedAt
	});
	if (initial.status !== 'ready-to-activate') {
		throw new Error(
			`Equipment v2 activation refused: ${initial.blockers.map(({ message }) => message).join('; ') || initial.status}`
		);
	}
	await exclusiveCreateEquipmentRepositoryFile(
		input.workspaceRoot,
		paths.lockPath,
		serializeJson({ runId: input.runId, acquiredAt: input.activatedAt, actor: input.activatedBy })
	);
	const lockIdentity = await identityFor(paths.lockPath, input.workspaceRoot);
	let planIdentity: FileIdentity | undefined;
	try {
		const readiness = await reportEquipmentV2RunReadiness({
			...input,
			checkedAt: input.activatedAt
		});
		if (readiness.status !== 'ready-to-activate') {
			throw new Error(
				`Equipment v2 activation refused after lock: ${readiness.blockers.map(({ message }) => message).join('; ') || readiness.status}`
			);
		}
		const plan = await buildEquipmentV2RunPlan(input);
		const planHash = canonicalJsonSha256V2(plan);
		await exclusiveCreateEquipmentRepositoryFile(
			input.workspaceRoot,
			paths.planPath,
			serializeJson(plan)
		);
		planIdentity = await identityFor(paths.planPath, input.workspaceRoot);
		const persistedPlan = EquipmentV2RunPlanSchema.parse(
			await readEquipmentRepositoryJson(input.workspaceRoot, paths.planPath)
		);
		if (canonicalJsonSha256V2(persistedPlan) !== planHash) {
			throw new Error('Persisted Equipment v2 run plan hash mismatch');
		}
		const activation = EquipmentV2RunActivationSchema.parse({
			schemaVersion: 'equipment-production-run-activation-v2',
			activationId: `${input.runId}-activation`,
			runId: input.runId,
			runPlanCanonicalSha256: planHash,
			activatedAt: input.activatedAt,
			activatedBy: input.activatedBy,
			authorization: {
				scope: 'root-targets-only',
				imageGenerationAuthorized: true,
				authorizedTargetIds: plan.initialGeneration.authorizedTargetIds,
				maximumConcurrency: 16,
				gatedChildrenAuthorized: false
			}
		});
		await exclusiveCreateEquipmentRepositoryFile(
			input.workspaceRoot,
			paths.activationPath,
			serializeJson(activation)
		);
		return {
			runId: input.runId,
			planPath: paths.planPath,
			activationPath: paths.activationPath,
			runPlanCanonicalSha256: planHash,
			authorizedRootTargets: 77,
			maximumConcurrency: 16,
			writesPerformed: 2
		};
	} catch (error) {
		if (planIdentity !== undefined) {
			await releaseOwnedPath(input.workspaceRoot, paths.planPath, planIdentity);
		}
		throw error;
	} finally {
		await releaseOwnedPath(input.workspaceRoot, paths.lockPath, lockIdentity);
	}
}

export const EQUIPMENT_V2_RUN_PLAN_PATH = (runId: string) => runPaths(runId).planPath;
export const EQUIPMENT_V2_RUN_ACTIVATION_PATH = (runId: string) => runPaths(runId).activationPath;

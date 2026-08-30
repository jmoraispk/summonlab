import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema,
	type ImageProductionAssignment,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import sharp from 'sharp';
import { z } from 'zod';

import {
	assignmentArtifactPath,
	createAffinityWorkflowExportBundle,
	sha256Json,
	targetArtifactPath
} from './image-production-lib.js';
import {
	AFFINITY_WAVE_ALLOCATION_V2_PATH,
	AffinityWaveAllocationV2Schema,
	EXPECTED_AFFINITY_WAVE_ALLOCATION_V2_SHA256,
	type AffinityWaveAllocationJobV2
} from './affinity-wave-allocation-v2.js';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const RepositoryPathSchema = z
	.string()
	.min(1)
	.refine((value) => !path.posix.isAbsolute(value) && !value.includes('\\'), {
		message: 'Expected a repository-relative POSIX path'
	})
	.refine(
		(value) =>
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Repository paths cannot contain empty, current, or parent segments' }
	);

export const BREADTH_GENERATION_ALLOCATION_V2_PATH = AFFINITY_WAVE_ALLOCATION_V2_PATH;
const REPOSITORY_SKILL_PATH = 'skills/summonlab-image-production' as const;
const INSTALLED_SKILL_PATH = '/home/joao/.codex/skills/summonlab-image-production' as const;

const CANARY_COORDINATES = [
	{ speciesId: 'goblin', affinity: 'normal' },
	{ speciesId: 'tunnel-boar', affinity: 'fire' }
] as const;

const BlockerSchema = z.enum([
	'breadth-target-count',
	'breadth-assignment-count',
	'breadth-coordinate-set-mismatch',
	'breadth-target-manifest-invalid-or-drifted',
	'breadth-assignment-manifest-invalid-or-drifted',
	'breadth-manifest-pair-invalid',
	'canary-coordinate-mismatch',
	'owned-output-collision',
	'owned-output-not-absent',
	'repository-skill-invalid',
	'installed-skill-invalid',
	'installed-skill-stale',
	'reference-invalid-or-stale',
	'allocation-v2-missing',
	'allocation-v2-invalid',
	'allocation-v2-coverage-mismatch',
	'allocation-v2-canary-mismatch'
]);

const ManifestPairEvidenceSchema = z
	.object({
		targetId: z.string().min(1),
		speciesId: z.string().min(1),
		affinity: z.string().min(1),
		targetPath: RepositoryPathSchema,
		targetCanonicalSha256: HashSchema,
		assignmentId: z.string().min(1),
		assignmentPath: RepositoryPathSchema,
		assignmentCanonicalSha256: HashSchema,
		candidatePath: RepositoryPathSchema,
		resultPath: RepositoryPathSchema
	})
	.strict();

const ReferenceEvidenceSchema = z
	.object({
		path: RepositoryPathSchema,
		contentSha256: HashSchema,
		bytes: z.number().int().positive(),
		mediaType: z.enum(['image/png', 'image/webp']).nullable(),
		width: z.number().int().positive().nullable(),
		height: z.number().int().positive().nullable()
	})
	.strict();

export const BreadthGenerationReadinessReportSchema = z
	.object({
		schemaVersion: z.literal('affinity-breadth-generation-readiness-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.enum(['ready', 'blocked']),
		preparationOnly: z.literal(true),
		writesPerformed: z.literal(0),
		blockers: z.array(BlockerSchema),
		evidence: z
			.object({
				targetCount: z.number().int().nonnegative(),
				assignmentCount: z.number().int().nonnegative(),
				validPairCount: z.number().int().min(0).max(24),
				coordinateCount: z.number().int().min(0).max(24),
				ownedOutputCount: z.number().int().min(0).max(48),
				uniqueOwnedOutputCount: z.number().int().min(0).max(48),
				absentOwnedOutputCount: z.number().int().min(0).max(48),
				manifestSetCanonicalSha256: HashSchema.nullable(),
				manifestPairs: z.array(ManifestPairEvidenceSchema).max(24),
				canaryCoordinates: z
					.tuple([
						z.object({ speciesId: z.literal('goblin'), affinity: z.literal('normal') }).strict(),
						z.object({ speciesId: z.literal('tunnel-boar'), affinity: z.literal('fire') }).strict()
					])
					.nullable(),
				repositorySkillPath: z.literal(REPOSITORY_SKILL_PATH),
				installedSkillPath: z.literal(INSTALLED_SKILL_PATH),
				repositorySkillTreeSha256: HashSchema.nullable(),
				installedSkillTreeSha256: HashSchema.nullable(),
				skillTreesMatch: z.boolean(),
				referenceCount: z.number().int().nonnegative(),
				references: z.array(ReferenceEvidenceSchema),
				allocationPath: RepositoryPathSchema,
				allocationStatus: z.enum(['verified', 'missing', 'invalid']),
				allocationCanonicalSha256: HashSchema.nullable(),
				allocationCoveredPairCount: z.number().int().min(0).max(24),
				allocationCanariesExact: z.boolean()
			})
			.strict()
	})
	.strict()
	.superRefine((report, context) => {
		if ((report.status === 'ready') !== (report.blockers.length === 0))
			context.addIssue({
				code: 'custom',
				path: ['status'],
				message: 'Ready status must exactly match an empty blocker set'
			});
	});

export type BreadthGenerationReadinessReport = z.infer<
	typeof BreadthGenerationReadinessReportSchema
>;

interface JsonArtifactInput {
	readonly path: string;
	readonly value: unknown;
}

export interface BreadthGenerationReadinessInput {
	readonly targets: readonly JsonArtifactInput[];
	readonly assignments: readonly JsonArtifactInput[];
	readonly repositorySkillTreeSha256: string | null;
	readonly installedSkillTreeSha256: string | null;
	readonly skillTreesMatch: boolean;
	readonly references: readonly z.infer<typeof ReferenceEvidenceSchema>[];
	readonly invalidReferenceCount: number;
	readonly absentOutputPaths: ReadonlySet<string>;
	readonly allocationPath: string;
	readonly allocation: unknown | null;
	readonly allocationCanonicalSha256: string | null;
}

function expectedBreadthPairs() {
	const bundle = createAffinityWorkflowExportBundle();
	const assignments = new Map(
		bundle.assignments.map((assignment) => [assignment.targetId, assignment] as const)
	);
	return bundle.targets
		.filter((target) => target.cohort === 'breadth')
		.map((target) => ({
			target,
			assignment: assignments.get(target.targetId)!,
			targetPath: targetArtifactPath(target),
			assignmentPath: assignmentArtifactPath(target)
		}))
		.toSorted((left, right) => left.targetPath.localeCompare(right.targetPath));
}

function coordinate(target: Pick<ImageProductionTarget, 'speciesId' | 'affinity'>): string {
	return `${target.speciesId}:${target.affinity}`;
}

function pairKey(pair: { readonly targetPath: string; readonly assignmentPath: string }): string {
	return `${pair.targetPath}\0${pair.assignmentPath}`;
}

function exactBreadthCanaryJobs(input: unknown): AffinityWaveAllocationJobV2[] | null {
	if (input === null || typeof input !== 'object' || !('workloads' in input)) return null;
	const workloads = (input as { readonly workloads?: unknown }).workloads;
	if (!Array.isArray(workloads)) return null;
	const canary = workloads.find(
		(workload) =>
			workload !== null &&
			typeof workload === 'object' &&
			'workloadId' in workload &&
			workload.workloadId === 'breadth-canary'
	);
	if (canary === null || typeof canary !== 'object' || !('jobs' in canary)) return null;
	const jobs = canary.jobs;
	if (!Array.isArray(jobs)) return null;
	return jobs.flatMap((job) => {
		if (job === null || typeof job !== 'object') return [];
		const candidate = job as Partial<AffinityWaveAllocationJobV2>;
		return typeof candidate.targetPath === 'string' &&
			typeof candidate.assignmentPath === 'string' &&
			typeof candidate.speciesId === 'string' &&
			typeof candidate.affinity === 'string'
			? [candidate as AffinityWaveAllocationJobV2]
			: [];
	});
}

export function buildBreadthGenerationReadiness(
	input: BreadthGenerationReadinessInput
): BreadthGenerationReadinessReport {
	const blockers = new Set<z.infer<typeof BlockerSchema>>();
	const expected = expectedBreadthPairs();
	if (input.targets.length !== 24) blockers.add('breadth-target-count');
	if (input.assignments.length !== 24) blockers.add('breadth-assignment-count');

	const targetsByPath = new Map(input.targets.map((artifact) => [artifact.path, artifact.value]));
	const assignmentsByPath = new Map(
		input.assignments.map((artifact) => [artifact.path, artifact.value])
	);
	const observedBreadthTargets = input.targets.flatMap((artifact) => {
		const parsed = ImageProductionTargetSchema.safeParse(artifact.value);
		return parsed.success && parsed.data.cohort === 'breadth' ? [parsed.data] : [];
	});
	const outputPaths = observedBreadthTargets.flatMap((target) => [
		target.output.candidatePath,
		target.output.resultPath
	]);
	const uniqueOutputPaths = new Set(outputPaths);
	if (uniqueOutputPaths.size !== outputPaths.length) blockers.add('owned-output-collision');
	const absentOwnedOutputCount = outputPaths.filter((value) =>
		input.absentOutputPaths.has(value)
	).length;
	if (absentOwnedOutputCount !== outputPaths.length) blockers.add('owned-output-not-absent');
	const manifestPairs: z.infer<typeof ManifestPairEvidenceSchema>[] = [];
	const coordinates = new Set<string>();
	for (const expectedPair of expected) {
		const targetResult = ImageProductionTargetSchema.safeParse(
			targetsByPath.get(expectedPair.targetPath)
		);
		if (
			!targetResult.success ||
			sha256Json(targetResult.data) !== sha256Json(expectedPair.target)
		) {
			blockers.add('breadth-target-manifest-invalid-or-drifted');
			continue;
		}
		const assignmentResult = ImageProductionAssignmentSchema.safeParse(
			assignmentsByPath.get(expectedPair.assignmentPath)
		);
		if (
			!assignmentResult.success ||
			sha256Json(assignmentResult.data) !== sha256Json(expectedPair.assignment)
		) {
			blockers.add('breadth-assignment-manifest-invalid-or-drifted');
			continue;
		}
		const target = targetResult.data;
		const assignment = assignmentResult.data;
		if (
			assignment.targetId !== target.targetId ||
			assignment.dryRun ||
			assignment.retryCeiling !== 1 ||
			assignment.permittedOutputs.candidatePath !== target.output.candidatePath ||
			assignment.permittedOutputs.resultPath !== target.output.resultPath
		) {
			blockers.add('breadth-manifest-pair-invalid');
			continue;
		}
		coordinates.add(coordinate(target));
		manifestPairs.push({
			targetId: target.targetId,
			speciesId: target.speciesId,
			affinity: target.affinity,
			targetPath: expectedPair.targetPath,
			targetCanonicalSha256: sha256Json(target),
			assignmentId: assignment.assignmentId,
			assignmentPath: expectedPair.assignmentPath,
			assignmentCanonicalSha256: sha256Json(assignment),
			candidatePath: target.output.candidatePath,
			resultPath: target.output.resultPath
		});
	}
	const expectedCoordinates = new Set(expected.map(({ target }) => coordinate(target)));
	if (
		coordinates.size !== expectedCoordinates.size ||
		[...expectedCoordinates].some((value) => !coordinates.has(value))
	)
		blockers.add('breadth-coordinate-set-mismatch');

	const canariesPresent = CANARY_COORDINATES.every((canary) =>
		manifestPairs.some(
			(pair) => pair.speciesId === canary.speciesId && pair.affinity === canary.affinity
		)
	);
	if (!canariesPresent) blockers.add('canary-coordinate-mismatch');
	const canaryCoordinates = canariesPresent ? CANARY_COORDINATES : null;

	if (!input.repositorySkillTreeSha256) blockers.add('repository-skill-invalid');
	if (!input.installedSkillTreeSha256) blockers.add('installed-skill-invalid');
	if (!input.skillTreesMatch || input.repositorySkillTreeSha256 !== input.installedSkillTreeSha256)
		blockers.add('installed-skill-stale');
	if (input.invalidReferenceCount > 0) blockers.add('reference-invalid-or-stale');

	let allocationStatus: 'verified' | 'missing' | 'invalid' = 'missing';
	let allocationCoveredPairCount = 0;
	let allocationCanariesExact = false;
	if (input.allocation === null) {
		blockers.add('allocation-v2-missing');
	} else {
		const rawCanaryJobs = exactBreadthCanaryJobs(input.allocation);
		const expectedCanaryKeys = CANARY_COORDINATES.map((canary) => {
			const pair = expected.find(
				({ target }) => target.speciesId === canary.speciesId && target.affinity === canary.affinity
			)!;
			return pairKey(pair);
		});
		allocationCanariesExact =
			rawCanaryJobs?.length === 2 &&
			rawCanaryJobs.every(
				(job, index) =>
					job.speciesId === CANARY_COORDINATES[index]!.speciesId &&
					job.affinity === CANARY_COORDINATES[index]!.affinity &&
					pairKey(job) === expectedCanaryKeys[index]
			);
		if (!allocationCanariesExact) blockers.add('allocation-v2-canary-mismatch');

		const parsed = AffinityWaveAllocationV2Schema.safeParse(input.allocation);
		if (
			!parsed.success ||
			input.allocationCanonicalSha256 !== sha256Json(input.allocation) ||
			input.allocationCanonicalSha256 !== EXPECTED_AFFINITY_WAVE_ALLOCATION_V2_SHA256
		) {
			allocationStatus = 'invalid';
			blockers.add('allocation-v2-invalid');
		} else {
			const expectedPairKeys = new Set(
				expected.map(({ targetPath, assignmentPath }) => pairKey({ targetPath, assignmentPath }))
			);
			const breadthJobs = parsed.data.workloads
				.flatMap((workload) => workload.jobs)
				.filter((job) => job.manifestState === 'live-unexecuted-breadth');
			const coveredKeys = new Set(
				breadthJobs.filter((job) => expectedPairKeys.has(pairKey(job))).map(pairKey)
			);
			allocationCoveredPairCount = coveredKeys.size;
			if (
				breadthJobs.length !== 24 ||
				allocationCoveredPairCount !== 24 ||
				breadthJobs.some((job) => !expectedPairKeys.has(pairKey(job)))
			)
				blockers.add('allocation-v2-coverage-mismatch');
			allocationStatus =
				blockers.has('allocation-v2-coverage-mismatch') ||
				blockers.has('allocation-v2-canary-mismatch')
					? 'invalid'
					: 'verified';
		}
	}

	const orderedPairs = manifestPairs.toSorted((left, right) =>
		left.targetPath.localeCompare(right.targetPath)
	);
	const orderedBlockers = [...blockers].toSorted();
	return BreadthGenerationReadinessReportSchema.parse({
		schemaVersion: 'affinity-breadth-generation-readiness-v1',
		experimentId: 'affinity-workflow-v1',
		status: orderedBlockers.length === 0 ? 'ready' : 'blocked',
		preparationOnly: true,
		writesPerformed: 0,
		blockers: orderedBlockers,
		evidence: {
			targetCount: input.targets.length,
			assignmentCount: input.assignments.length,
			validPairCount: orderedPairs.length,
			coordinateCount: coordinates.size,
			ownedOutputCount: outputPaths.length,
			uniqueOwnedOutputCount: uniqueOutputPaths.size,
			absentOwnedOutputCount,
			manifestSetCanonicalSha256: orderedPairs.length === 24 ? sha256Json(orderedPairs) : null,
			manifestPairs: orderedPairs,
			canaryCoordinates,
			repositorySkillPath: REPOSITORY_SKILL_PATH,
			installedSkillPath: INSTALLED_SKILL_PATH,
			repositorySkillTreeSha256: input.repositorySkillTreeSha256,
			installedSkillTreeSha256: input.installedSkillTreeSha256,
			skillTreesMatch: input.skillTreesMatch,
			referenceCount: input.references.length,
			references: [...input.references].toSorted((left, right) =>
				left.path.localeCompare(right.path)
			),
			allocationPath: input.allocationPath,
			allocationStatus,
			allocationCanonicalSha256: input.allocationCanonicalSha256,
			allocationCoveredPairCount,
			allocationCanariesExact
		}
	});
}

function resolveRepositoryPath(workspaceRoot: string, repositoryPath: string): string {
	RepositoryPathSchema.parse(repositoryPath);
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${path.sep}`))
		throw new Error(`Repository path escapes workspace: ${repositoryPath}`);
	return absolute;
}

async function readRegularFile(workspaceRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolute = resolveRepositoryPath(workspaceRoot, repositoryPath);
	let cursor = path.resolve(workspaceRoot);
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${repositoryPath}`);
	}
	const metadata = await lstat(absolute);
	if (!metadata.isFile()) throw new Error(`Expected regular file: ${repositoryPath}`);
	return readFile(absolute);
}

async function listSkillTree(root: string, prefix = ''): Promise<string[]> {
	const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const relative = path.posix.join(prefix.split(path.sep).join('/'), entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Skill tree contains symlink: ${relative}`);
			if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) return [];
			return entry.isDirectory() ? listSkillTree(root, relative) : [relative];
		})
	);
	return nested.flat().sort();
}

async function hashSkillTree(root: string): Promise<string> {
	const hash = createHash('sha256');
	for (const relative of await listSkillTree(root)) {
		hash.update(relative);
		hash.update('\0');
		hash.update(await readFile(path.join(root, relative)));
		hash.update('\0');
	}
	return hash.digest('hex');
}

async function loadReferenceEvidence(
	workspaceRoot: string,
	targets: readonly ImageProductionTarget[]
): Promise<{ references: z.infer<typeof ReferenceEvidenceSchema>[]; invalidCount: number }> {
	const referencesByPath = new Map<string, string>();
	let invalidCount = 0;
	for (const reference of targets.flatMap((target) => target.references)) {
		const prior = referencesByPath.get(reference.path);
		if (prior && prior !== reference.contentHash) invalidCount += 1;
		else referencesByPath.set(reference.path, reference.contentHash);
	}
	const references: z.infer<typeof ReferenceEvidenceSchema>[] = [];
	for (const [repositoryPath, expectedHash] of referencesByPath) {
		try {
			const bytes = await readRegularFile(workspaceRoot, repositoryPath);
			const contentSha256 = createHash('sha256').update(bytes).digest('hex');
			if (contentSha256 !== expectedHash) invalidCount += 1;
			const metadata = await sharp(bytes)
				.metadata()
				.catch(() => null);
			const mediaType =
				metadata?.format === 'png'
					? 'image/png'
					: metadata?.format === 'webp'
						? 'image/webp'
						: null;
			if (
				(/\.png$/u.test(repositoryPath) && mediaType !== 'image/png') ||
				(/\.webp$/u.test(repositoryPath) && mediaType !== 'image/webp') ||
				mediaType === null ||
				metadata?.width === undefined ||
				metadata.height === undefined
			)
				invalidCount += 1;
			references.push({
				path: repositoryPath,
				contentSha256,
				bytes: bytes.byteLength,
				mediaType,
				width: metadata?.width ?? null,
				height: metadata?.height ?? null
			});
		} catch {
			invalidCount += 1;
		}
	}
	return { references, invalidCount };
}

async function pathAbsent(workspaceRoot: string, repositoryPath: string): Promise<boolean> {
	const absolute = resolveRepositoryPath(workspaceRoot, repositoryPath);
	let cursor = path.resolve(workspaceRoot);
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		try {
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink()) return false;
			if (cursor === absolute) return false;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
			throw error;
		}
	}
	return true;
}

export interface BreadthGenerationReadinessDependencies {
	readonly allocationInput?: unknown | null;
	readonly allocationCanonicalSha256?: string | null;
}

export async function inspectBreadthGenerationReadinessInput(
	options: {
		readonly workspaceRoot?: string;
		readonly allocationPath?: string;
		readonly dependencies?: BreadthGenerationReadinessDependencies;
	} = {}
): Promise<BreadthGenerationReadinessInput> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const allocationPath = options.allocationPath ?? BREADTH_GENERATION_ALLOCATION_V2_PATH;
	const expected = expectedBreadthPairs();
	const targets: JsonArtifactInput[] = [];
	const assignments: JsonArtifactInput[] = [];
	for (const pair of expected) {
		targets.push({
			path: pair.targetPath,
			value: JSON.parse((await readRegularFile(workspaceRoot, pair.targetPath)).toString('utf8'))
		});
		assignments.push({
			path: pair.assignmentPath,
			value: JSON.parse(
				(await readRegularFile(workspaceRoot, pair.assignmentPath)).toString('utf8')
			)
		});
	}

	let repositorySkillTreeSha256: string | null = null;
	let installedSkillTreeSha256: string | null = null;
	let skillTreesMatch = false;
	try {
		const [repositoryRealPath, installedRealPath] = await Promise.all([
			realpath(path.resolve(workspaceRoot, REPOSITORY_SKILL_PATH)),
			realpath(INSTALLED_SKILL_PATH)
		]);
		[repositorySkillTreeSha256, installedSkillTreeSha256] = await Promise.all([
			hashSkillTree(repositoryRealPath),
			hashSkillTree(installedRealPath)
		]);
		skillTreesMatch =
			repositorySkillTreeSha256 === installedSkillTreeSha256 &&
			repositoryRealPath === installedRealPath;
	} catch {
		// The strict report records missing/stale skill evidence as blockers.
	}

	const parsedTargets = targets.flatMap((artifact) => {
		const parsed = ImageProductionTargetSchema.safeParse(artifact.value);
		return parsed.success ? [parsed.data] : [];
	});
	const referenceEvidence = await loadReferenceEvidence(workspaceRoot, parsedTargets);
	const outputPaths = parsedTargets.flatMap((target) => [
		target.output.candidatePath,
		target.output.resultPath
	]);
	const absentOutputPaths = new Set<string>();
	for (const outputPath of outputPaths)
		if (await pathAbsent(workspaceRoot, outputPath)) absentOutputPaths.add(outputPath);

	let allocation = options.dependencies?.allocationInput;
	let allocationCanonicalSha256 = options.dependencies?.allocationCanonicalSha256;
	if (allocation === undefined) {
		try {
			allocation = JSON.parse(
				(await readRegularFile(workspaceRoot, allocationPath)).toString('utf8')
			);
			allocationCanonicalSha256 = sha256Json(allocation);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			allocation = null;
			allocationCanonicalSha256 = null;
		}
	}

	return {
		targets,
		assignments,
		repositorySkillTreeSha256,
		installedSkillTreeSha256,
		skillTreesMatch,
		references: referenceEvidence.references,
		invalidReferenceCount: referenceEvidence.invalidCount,
		absentOutputPaths,
		allocationPath,
		allocation: allocation ?? null,
		allocationCanonicalSha256: allocationCanonicalSha256 ?? null
	};
}

export async function reportBreadthGenerationReadiness(
	options: {
		readonly workspaceRoot?: string;
		readonly allocationPath?: string;
		readonly dependencies?: BreadthGenerationReadinessDependencies;
	} = {}
): Promise<BreadthGenerationReadinessReport> {
	return buildBreadthGenerationReadiness(await inspectBreadthGenerationReadinessInput(options));
}

export function parseBreadthGenerationReadinessArgs(args: readonly string[]) {
	let allocationPath: string | null = null;
	let separatorSeen = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === '--') {
			if (separatorSeen) throw new Error('Specify at most one -- argument separator.');
			separatorSeen = true;
			continue;
		}
		if (argument !== '--allocation') throw new Error(`Unknown argument: ${argument}`);
		if (allocationPath !== null) throw new Error('Specify --allocation exactly once.');
		allocationPath = args[index + 1] ?? null;
		if (!allocationPath || allocationPath.startsWith('--'))
			throw new Error('Specify --allocation <repository-relative-path>.');
		index += 1;
	}
	return { allocationPath: allocationPath ?? BREADTH_GENERATION_ALLOCATION_V2_PATH };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const args = parseBreadthGenerationReadinessArgs(process.argv.slice(2));
		const report = await reportBreadthGenerationReadiness(args);
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		if (report.status !== 'ready') process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}

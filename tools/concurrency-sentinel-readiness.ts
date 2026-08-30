import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getConfig } from '../packages/config/src/index.js';
import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema,
	type ImageProductionAssignment,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';

import {
	AffinityRoundFinalEvaluationReceiptSchema,
	AffinityRoundFinalEvaluationSchema,
	deriveAffinityRoundFinalEvaluation
} from './finalize-affinity-round-evaluation.js';
import {
	AffinityReviewRoundIdSchema,
	affinityRoundRoot,
	sha256Bytes,
	type AffinityReviewRoundEntry
} from './affinity-review-round-lib.js';
import {
	loadVerifiedAffinityReviewRound,
	verifiedRegularBytes
} from './affinity-round-postgeneration-lib.js';
import {
	AffinityWaveAllocationSpecSchema,
	type AffinityWaveAllocationSpec
} from './affinity-wave-scheduler-lib.js';
import {
	ACCEPTED_LATER_PACK_RULES_PATH,
	AcceptedLaterPackVisualRulesV2Schema
} from './report-later-pack-visual-rules-readiness.js';
import {
	AFFINITY_EXPERIMENT_ROOT,
	canonicalJson,
	createImageProductionAssignments,
	sha256Json
} from './image-production-lib.js';
import { verifyAcceptedLaterPackRulesForCompletion } from './verify-accepted-later-pack-rules-completion.js';

export const CONCURRENCY_SENTINEL_ALLOCATION_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/wave-plans/exact-concurrency-final-and-breadth-v1.json` as const;
export const EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256 =
	'9ca2f78071ba39904e5d7194e9d52a8d6966c6dc6e3dc5f95d98b0dab05a4fa9' as const;
const REPOSITORY_SKILL_PATH = 'skills/summonlab-image-production' as const;
const INSTALLED_SKILL_PATH = '/home/joao/.codex/skills/summonlab-image-production' as const;
const SENTINEL_FORBIDDEN_PATHS = [
	CONCURRENCY_SENTINEL_ALLOCATION_PATH,
	`${affinityRoundRoot('final-controlled-v1')}/integration-receipt.json`,
	`${affinityRoundRoot('final-controlled-v1')}/final-evaluation.json`,
	`${affinityRoundRoot('final-controlled-v1')}/final-evaluation-receipt.json`,
	`${affinityRoundRoot('breadth-v1')}/integration-receipt.json`,
	`${affinityRoundRoot('breadth-v1')}/final-evaluation.json`,
	`${affinityRoundRoot('breadth-v1')}/final-evaluation-receipt.json`,
	ACCEPTED_LATER_PACK_RULES_PATH
] as const;

type SentinelJob = AffinityWaveAllocationSpec['stages'][number]['jobs'][number];

export interface ConcurrencySentinelSource {
	readonly targetPath: string;
	readonly target: ImageProductionTarget;
}

export interface ConcurrencySentinelArtifact {
	readonly kind: 'target' | 'assignment';
	readonly livePath: string;
	readonly value: ImageProductionTarget | ImageProductionAssignment;
}

export interface ConcurrencySentinelBundle {
	readonly allocationCanonicalSha256: typeof EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256;
	readonly targets: readonly ImageProductionTarget[];
	readonly assignments: readonly ImageProductionAssignment[];
	readonly artifacts: readonly ConcurrencySentinelArtifact[];
	readonly sourceBindings: readonly {
		readonly sentinelTargetId: string;
		readonly sourceTargetId: string;
		readonly sourceTargetPath: string;
		readonly sourceTargetCanonicalSha256: string;
	}[];
	readonly ownedPaths: readonly string[];
	readonly loadTargetIds: readonly string[];
	readonly scaleTargetIds: readonly string[];
}

function sentinelJobs(allocation: AffinityWaveAllocationSpec): {
	readonly load: readonly SentinelJob[];
	readonly scale: readonly SentinelJob[];
	readonly all: readonly SentinelJob[];
} {
	const load =
		allocation.stages
			.find((stage) => stage.stage === 'load')
			?.jobs.filter((job) => job.manifestState === 'future-sentinel') ?? [];
	const scale =
		allocation.stages
			.find((stage) => stage.stage === 'scale')
			?.jobs.filter((job) => job.manifestState === 'future-sentinel') ?? [];
	const elsewhere = allocation.stages
		.filter((stage) => !['load', 'scale'].includes(stage.stage))
		.flatMap((stage) => stage.jobs)
		.filter((job) => job.manifestState === 'future-sentinel');
	if (load.length !== 6 || scale.length !== 8 || elsewhere.length !== 0)
		throw new Error('Future sentinels must be partitioned exactly as Load 6 and Scale 8.');
	return { load, scale, all: [...load, ...scale] };
}

export function buildConcurrencySentinelBundle(input: {
	readonly allocation: unknown;
	readonly finalControlledSources: readonly ConcurrencySentinelSource[];
	readonly assignedAt: string;
}): ConcurrencySentinelBundle {
	const allocation = AffinityWaveAllocationSpecSchema.parse(input.allocation);
	const allocationCanonicalSha256 = sha256Json(allocation);
	if (allocationCanonicalSha256 !== EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256)
		throw new Error('Exact-concurrency allocation hash differs from the reviewed allocation.');
	const jobs = sentinelJobs(allocation);
	const sourcesByCoordinate = new Map<string, ConcurrencySentinelSource[]>();
	for (const source of input.finalControlledSources) {
		const target = ImageProductionTargetSchema.parse(source.target);
		const coordinate = `${target.speciesId}:${target.affinity}`;
		sourcesByCoordinate.set(coordinate, [
			...(sourcesByCoordinate.get(coordinate) ?? []),
			{ targetPath: source.targetPath, target }
		]);
	}
	const sourceBindings: ConcurrencySentinelBundle['sourceBindings'][number][] = [];
	const targets = jobs.all.map((job) => {
		const matches = sourcesByCoordinate.get(`${job.speciesId}:${job.affinity}`) ?? [];
		if (matches.length !== 1)
			throw new Error(
				`Expected exactly one final-controlled source for ${job.speciesId}/${job.affinity}.`
			);
		const source = matches[0]!;
		const sourceVersion = ['death-knight', 'elemental'].includes(job.speciesId) ? 'v4' : 'v3';
		const expectedSourceTargetId = `affinity-workflow-v1-${job.speciesId}-${job.affinity}-${sourceVersion}`;
		const expectedSourcePath = `${AFFINITY_EXPERIMENT_ROOT}/targets/final-controlled/${job.speciesId}/${job.affinity}-${sourceVersion}.json`;
		if (
			source.target.cohort !== 'controlled' ||
			source.target.promptProtocol !== 'safe-frame-v4' ||
			source.target.authoringProtocol !== 'semantic-v2' ||
			source.target.targetId !== expectedSourceTargetId ||
			source.targetPath !== expectedSourcePath
		)
			throw new Error(`Sentinel source is not final protocol: ${source.target.targetId}.`);
		const targetId = `affinity-workflow-v1-${job.key}`;
		const target = ImageProductionTargetSchema.parse({
			...source.target,
			targetId,
			assetId: targetId,
			cohort: 'regression',
			output: { candidatePath: job.candidatePath, resultPath: job.resultPath }
		});
		sourceBindings.push({
			sentinelTargetId: targetId,
			sourceTargetId: source.target.targetId,
			sourceTargetPath: source.targetPath,
			sourceTargetCanonicalSha256: sha256Json(source.target)
		});
		return target;
	});
	const assignments = createImageProductionAssignments(targets).map((assignment) =>
		ImageProductionAssignmentSchema.parse({
			...assignment,
			assignedAt: input.assignedAt,
			forbiddenSharedPaths: [
				...new Set([...assignment.forbiddenSharedPaths, ...SENTINEL_FORBIDDEN_PATHS])
			]
		})
	);
	const artifacts = jobs.all.flatMap((job, index): ConcurrencySentinelArtifact[] => [
		{ kind: 'target', livePath: job.targetPath, value: targets[index]! },
		{ kind: 'assignment', livePath: job.assignmentPath, value: assignments[index]! }
	]);
	const ownedPaths = jobs.all.flatMap((job) => [
		job.targetPath,
		job.assignmentPath,
		job.candidatePath,
		job.resultPath
	]);
	if (
		targets.length !== 14 ||
		assignments.length !== 14 ||
		artifacts.length !== 28 ||
		ownedPaths.length !== 56 ||
		new Set(targets.map((target) => target.targetId)).size !== 14 ||
		new Set(assignments.map((assignment) => assignment.assignmentId)).size !== 14 ||
		new Set(ownedPaths).size !== 56 ||
		new Set(sourceBindings.map((binding) => binding.sourceTargetId)).size !== 14
	)
		throw new Error('Concurrency sentinel IDs, sources, artifacts, or owned paths are not exact.');
	return {
		allocationCanonicalSha256,
		targets,
		assignments,
		artifacts,
		sourceBindings,
		ownedPaths,
		loadTargetIds: targets.slice(0, jobs.load.length).map((target) => target.targetId),
		scaleTargetIds: targets.slice(jobs.load.length).map((target) => target.targetId)
	};
}

export interface VerifiedSentinelRound {
	readonly roundId: 'final-controlled-v1' | 'breadth-v1';
	readonly integrationReceiptCanonicalSha256: string;
	readonly finalEvaluationReceiptCanonicalSha256: string;
	readonly completedAt: string;
	readonly entries: readonly AffinityReviewRoundEntry[];
}

export interface SentinelSkillState {
	readonly matchesInstalled: boolean;
	readonly repositoryTreeSha256: string | null;
	readonly installedTreeSha256: string | null;
}

export interface ConcurrencySentinelReadinessDependencies {
	readonly loadAllocation?: (
		workspaceRoot: string
	) => Promise<{ readonly allocation: unknown; readonly canonicalSha256: string }>;
	readonly loadRound?: (
		workspaceRoot: string,
		roundId: 'final-controlled-v1' | 'breadth-v1'
	) => Promise<VerifiedSentinelRound>;
	readonly verifyAcceptedRules?: (
		workspaceRoot: string,
		actor: string | null,
		databaseUrl?: string
	) => Promise<{ readonly valid: boolean; readonly canonicalSha256: string | null }>;
	readonly inspectSkill?: (workspaceRoot: string) => Promise<SentinelSkillState>;
	readonly validateReferences?: (
		workspaceRoot: string,
		targets: readonly ImageProductionTarget[]
	) => Promise<boolean>;
	readonly pathsAbsent?: (workspaceRoot: string, paths: readonly string[]) => Promise<boolean>;
}

export interface ConcurrencySentinelReadinessReport {
	readonly schemaVersion: 'affinity-concurrency-sentinel-readiness-v1';
	readonly experimentId: 'affinity-workflow-v1';
	readonly status: 'ready' | 'blocked';
	readonly preparationOnly: true;
	readonly livePublicationAuthorized: false;
	readonly writesPerformed: 0;
	readonly allocationPath: typeof CONCURRENCY_SENTINEL_ALLOCATION_PATH;
	readonly allocationCanonicalSha256: string | null;
	readonly expectedAllocationCanonicalSha256: typeof EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256;
	readonly targetCount: number;
	readonly assignmentCount: number;
	readonly sourceCount: number;
	readonly ownedPathCount: number;
	readonly loadCount: number;
	readonly scaleCount: number;
	readonly finalControlledIntegrationReceiptCanonicalSha256: string | null;
	readonly finalControlledEvaluationReceiptCanonicalSha256: string | null;
	readonly breadthIntegrationReceiptCanonicalSha256: string | null;
	readonly breadthEvaluationReceiptCanonicalSha256: string | null;
	readonly acceptedRulesCanonicalSha256: string | null;
	readonly repositorySkillTreeSha256: string | null;
	readonly installedSkillTreeSha256: string | null;
	readonly sourceSetCanonicalSha256: string | null;
	readonly sentinelBundleCanonicalSha256: string | null;
	readonly blockers: readonly string[];
}

async function readJsonRegular(workspaceRoot: string, repositoryPath: string): Promise<unknown> {
	const absolute = path.resolve(workspaceRoot, repositoryPath);
	const root = path.resolve(workspaceRoot);
	if (!absolute.startsWith(`${root}${path.sep}`))
		throw new Error('Repository path escapes workspace.');
	let cursor = root;
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${repositoryPath}`);
	}
	const metadata = await lstat(absolute);
	if (!metadata.isFile()) throw new Error(`Expected regular file: ${repositoryPath}`);
	return JSON.parse(await readFile(absolute, 'utf8'));
}

async function defaultLoadAllocation(workspaceRoot: string) {
	const allocation = await readJsonRegular(workspaceRoot, CONCURRENCY_SENTINEL_ALLOCATION_PATH);
	return { allocation, canonicalSha256: sha256Json(allocation) };
}

async function defaultLoadRound(
	workspaceRoot: string,
	roundId: 'final-controlled-v1' | 'breadth-v1'
): Promise<VerifiedSentinelRound> {
	AffinityReviewRoundIdSchema.parse(roundId);
	const round = await loadVerifiedAffinityReviewRound(workspaceRoot, roundId);
	const root = affinityRoundRoot(roundId);
	const evaluationPath = `${root}/final-evaluation.json`;
	const receiptPath = `${root}/final-evaluation-receipt.json`;
	const evaluationBytes = await verifiedRegularBytes(workspaceRoot, evaluationPath);
	const evaluation = AffinityRoundFinalEvaluationSchema.parse(
		JSON.parse(evaluationBytes.toString('utf8'))
	);
	const receipt = AffinityRoundFinalEvaluationReceiptSchema.parse(
		await readJsonRegular(workspaceRoot, receiptPath)
	);
	const derivation = await deriveAffinityRoundFinalEvaluation(workspaceRoot, roundId);
	if (
		!derivation.eligible ||
		!derivation.evaluation ||
		canonicalJson(evaluation) !== canonicalJson(derivation.evaluation) ||
		evaluation.integrationReceiptCanonicalSha256 !== round.integrationReceiptCanonicalSha256 ||
		receipt.roundId !== roundId ||
		receipt.integrationReceiptCanonicalSha256 !== round.integrationReceiptCanonicalSha256 ||
		receipt.blindReviewCanonicalSha256 !== evaluation.blindReviewCanonicalSha256 ||
		receipt.evaluationPath !== evaluationPath ||
		receipt.evaluationCanonicalSha256 !== sha256Json(evaluation) ||
		receipt.evaluationByteSha256 !== sha256Bytes(evaluationBytes)
	)
		throw new Error(`${roundId} final evaluation is absent, stale, or not canonically derived.`);
	return {
		roundId,
		integrationReceiptCanonicalSha256: round.integrationReceiptCanonicalSha256,
		finalEvaluationReceiptCanonicalSha256: sha256Json(receipt),
		completedAt: receipt.completedAt,
		entries: round.registry.entries
	};
}

async function defaultVerifyAcceptedRules(
	workspaceRoot: string,
	actor: string | null,
	databaseUrl?: string
) {
	const verification = await verifyAcceptedLaterPackRulesForCompletion({
		workspaceRoot,
		actor,
		...(databaseUrl ? { databaseUrl } : { loadDatabaseUrl: () => getConfig().databaseUrl })
	});
	if (!verification.acceptedArtifactValid) return { valid: false, canonicalSha256: null };
	const artifact = AcceptedLaterPackVisualRulesV2Schema.parse(
		await readJsonRegular(workspaceRoot, ACCEPTED_LATER_PACK_RULES_PATH)
	);
	return { valid: true, canonicalSha256: sha256Json(artifact) };
}

async function listTree(root: string, prefix = ''): Promise<string[]> {
	const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const relative = path.posix.join(prefix.split(path.sep).join('/'), entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Skill tree contains symlink: ${relative}`);
			return entry.isDirectory() ? listTree(root, relative) : [relative];
		})
	);
	return nested.flat().sort();
}

async function hashTree(root: string): Promise<string> {
	const hash = createHash('sha256');
	for (const relative of await listTree(root)) {
		hash.update(relative);
		hash.update('\0');
		hash.update(await readFile(path.join(root, relative)));
		hash.update('\0');
	}
	return hash.digest('hex');
}

async function defaultInspectSkill(workspaceRoot: string): Promise<SentinelSkillState> {
	const repository = path.resolve(workspaceRoot, REPOSITORY_SKILL_PATH);
	const [repositoryReal, installedReal] = await Promise.all([
		realpath(repository),
		realpath(INSTALLED_SKILL_PATH)
	]);
	const repositoryTreeSha256 = await hashTree(repositoryReal);
	const installedTreeSha256 = await hashTree(installedReal);
	return {
		matchesInstalled:
			repositoryReal === installedReal && repositoryTreeSha256 === installedTreeSha256,
		repositoryTreeSha256,
		installedTreeSha256
	};
}

async function defaultValidateReferences(
	workspaceRoot: string,
	targets: readonly ImageProductionTarget[]
): Promise<boolean> {
	const references = new Map<string, (typeof targets)[number]['references'][number]>();
	for (const reference of targets.flatMap((target) => target.references)) {
		const prior = references.get(reference.path);
		if (prior && prior.contentHash !== reference.contentHash) return false;
		references.set(reference.path, reference);
	}
	const root = path.resolve(workspaceRoot);
	for (const reference of references.values()) {
		const absolute = path.resolve(root, reference.path);
		if (!absolute.startsWith(`${root}${path.sep}`)) return false;
		let cursor = root;
		for (const segment of reference.path.split('/')) {
			cursor = path.join(cursor, segment);
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink()) return false;
		}
		const metadata = await lstat(absolute);
		if (!metadata.isFile()) return false;
		if (sha256Bytes(await readFile(absolute)) !== reference.contentHash) return false;
	}
	return true;
}

async function defaultPathsAbsent(
	workspaceRoot: string,
	repositoryPaths: readonly string[]
): Promise<boolean> {
	const root = path.resolve(workspaceRoot);
	for (const repositoryPath of repositoryPaths) {
		const absolute = path.resolve(root, repositoryPath);
		if (!absolute.startsWith(`${root}${path.sep}`)) return false;
		let cursor = root;
		for (const segment of repositoryPath.split('/')) {
			cursor = path.join(cursor, segment);
			try {
				const metadata = await lstat(cursor);
				if (metadata.isSymbolicLink() || cursor === absolute) return false;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
				throw error;
			}
		}
	}
	return true;
}

export async function reportConcurrencySentinelReadiness(
	options: {
		readonly workspaceRoot?: string;
		readonly actor?: string | null;
		readonly databaseUrl?: string;
		readonly dependencies?: ConcurrencySentinelReadinessDependencies;
	} = {}
): Promise<ConcurrencySentinelReadinessReport> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const dependencies = options.dependencies ?? {};
	const blockers: string[] = [];
	let allocationLoad: Awaited<ReturnType<typeof defaultLoadAllocation>> | null = null;
	let finalRound: VerifiedSentinelRound | null = null;
	let breadthRound: VerifiedSentinelRound | null = null;
	let accepted = { valid: false, canonicalSha256: null as string | null };
	let skill: SentinelSkillState = {
		matchesInstalled: false,
		repositoryTreeSha256: null,
		installedTreeSha256: null
	};
	try {
		allocationLoad = await (dependencies.loadAllocation ?? defaultLoadAllocation)(workspaceRoot);
		if (allocationLoad.canonicalSha256 !== EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256)
			blockers.push('allocation-hash-mismatch');
		AffinityWaveAllocationSpecSchema.parse(allocationLoad.allocation);
	} catch {
		blockers.push('allocation-missing-invalid-or-stale');
	}
	for (const roundId of ['final-controlled-v1', 'breadth-v1'] as const) {
		try {
			const round = await (dependencies.loadRound ?? defaultLoadRound)(workspaceRoot, roundId);
			if (roundId === 'final-controlled-v1') finalRound = round;
			else breadthRound = round;
		} catch {
			blockers.push(`${roundId}-not-finalized`);
		}
	}
	try {
		accepted = await (dependencies.verifyAcceptedRules ?? defaultVerifyAcceptedRules)(
			workspaceRoot,
			options.actor?.trim() || null,
			options.databaseUrl
		);
		if (!accepted.valid || !accepted.canonicalSha256) blockers.push('accepted-rules-not-current');
	} catch {
		blockers.push('accepted-rules-not-current');
	}
	try {
		skill = await (dependencies.inspectSkill ?? defaultInspectSkill)(workspaceRoot);
		if (!skill.matchesInstalled || !skill.repositoryTreeSha256 || !skill.installedTreeSha256)
			blockers.push('production-skill-not-current-or-installed');
	} catch {
		blockers.push('production-skill-not-current-or-installed');
	}
	let bundle: ConcurrencySentinelBundle | null = null;
	if (allocationLoad && finalRound && breadthRound) {
		try {
			bundle = buildConcurrencySentinelBundle({
				allocation: allocationLoad.allocation,
				finalControlledSources: finalRound.entries.map((entry) => ({
					targetPath: entry.targetPath,
					target: entry.target
				})),
				assignedAt: breadthRound.completedAt
			});
			if (
				!(await (dependencies.validateReferences ?? defaultValidateReferences)(
					workspaceRoot,
					bundle.targets
				))
			)
				blockers.push('source-reference-invalid-or-stale');
			if (
				!(await (dependencies.pathsAbsent ?? defaultPathsAbsent)(workspaceRoot, bundle.ownedPaths))
			)
				blockers.push('sentinel-owned-path-collision');
		} catch {
			blockers.push('sentinel-bundle-invalid');
		}
	}
	return {
		schemaVersion: 'affinity-concurrency-sentinel-readiness-v1',
		experimentId: 'affinity-workflow-v1',
		status: blockers.length === 0 ? 'ready' : 'blocked',
		preparationOnly: true,
		livePublicationAuthorized: false,
		writesPerformed: 0,
		allocationPath: CONCURRENCY_SENTINEL_ALLOCATION_PATH,
		allocationCanonicalSha256: allocationLoad?.canonicalSha256 ?? null,
		expectedAllocationCanonicalSha256: EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256,
		targetCount: bundle?.targets.length ?? 0,
		assignmentCount: bundle?.assignments.length ?? 0,
		sourceCount: bundle?.sourceBindings.length ?? 0,
		ownedPathCount: bundle?.ownedPaths.length ?? 0,
		loadCount: bundle?.loadTargetIds.length ?? 0,
		scaleCount: bundle?.scaleTargetIds.length ?? 0,
		finalControlledIntegrationReceiptCanonicalSha256:
			finalRound?.integrationReceiptCanonicalSha256 ?? null,
		finalControlledEvaluationReceiptCanonicalSha256:
			finalRound?.finalEvaluationReceiptCanonicalSha256 ?? null,
		breadthIntegrationReceiptCanonicalSha256:
			breadthRound?.integrationReceiptCanonicalSha256 ?? null,
		breadthEvaluationReceiptCanonicalSha256:
			breadthRound?.finalEvaluationReceiptCanonicalSha256 ?? null,
		acceptedRulesCanonicalSha256: accepted.canonicalSha256,
		repositorySkillTreeSha256: skill.repositoryTreeSha256,
		installedSkillTreeSha256: skill.installedTreeSha256,
		sourceSetCanonicalSha256: bundle ? sha256Json(bundle.sourceBindings) : null,
		sentinelBundleCanonicalSha256: bundle
			? sha256Json({ targets: bundle.targets, assignments: bundle.assignments })
			: null,
		blockers: [...new Set(blockers)]
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const args = process.argv.slice(2);
	const actorAt = args.indexOf('--actor');
	const known = new Set(['--actor']);
	for (let index = 0; index < args.length; index += 1) {
		if (!known.has(args[index]!)) throw new Error(`Unknown argument: ${args[index]}`);
		index += 1;
	}
	const actor = actorAt >= 0 ? (args[actorAt + 1] ?? null) : null;
	const report = await reportConcurrencySentinelReadiness({ actor });
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (report.status !== 'ready') process.exitCode = 1;
}

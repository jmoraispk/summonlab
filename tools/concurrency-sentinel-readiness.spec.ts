import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ImageProductionTargetSchema } from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
	CONCURRENCY_SENTINEL_ALLOCATION_PATH,
	EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256,
	buildConcurrencySentinelBundle,
	reportConcurrencySentinelReadiness,
	type ConcurrencySentinelReadinessDependencies,
	type ConcurrencySentinelSource,
	type VerifiedSentinelRound
} from './concurrency-sentinel-readiness.js';
import {
	createAffinityWorkflowExportBundle,
	createImageProductionAssignments,
	sha256Json
} from './image-production-lib.js';

const WORKSPACE_ROOT = path.resolve('.');
const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function allocation(): Promise<unknown> {
	return JSON.parse(
		await readFile(path.resolve(WORKSPACE_ROOT, CONCURRENCY_SENTINEL_ALLOCATION_PATH), 'utf8')
	);
}

function finalSources(): ConcurrencySentinelSource[] {
	return createAffinityWorkflowExportBundle()
		.targets.filter((target) => target.cohort === 'controlled')
		.map((source) => {
			const version = ['death-knight', 'elemental'].includes(source.speciesId) ? 'v4' : 'v3';
			const targetId = `affinity-workflow-v1-${source.speciesId}-${source.affinity}-${version}`;
			return {
				targetPath: `assets/enemies/experiments/affinity-workflow-v1/targets/final-controlled/${source.speciesId}/${source.affinity}-${version}.json`,
				target: ImageProductionTargetSchema.parse({
					...source,
					targetId,
					assetId: targetId,
					promptProtocol: 'safe-frame-v4',
					authoringProtocol: 'semantic-v2'
				})
			};
		});
}

function verifiedRound(
	roundId: 'final-controlled-v1' | 'breadth-v1',
	sources: readonly ConcurrencySentinelSource[]
): VerifiedSentinelRound {
	const targets = sources.map((source) => source.target);
	const assignments = createImageProductionAssignments(targets);
	return {
		roundId,
		integrationReceiptCanonicalSha256:
			roundId === 'final-controlled-v1' ? 'a'.repeat(64) : 'b'.repeat(64),
		finalEvaluationReceiptCanonicalSha256:
			roundId === 'final-controlled-v1' ? 'c'.repeat(64) : 'd'.repeat(64),
		completedAt: '2026-08-29T23:00:00.000Z',
		entries: sources.map((source, index) => ({
			targetPath: source.targetPath,
			assignmentPath: source.targetPath.replace('/targets/', '/assignments/'),
			target: source.target,
			assignment: assignments[index]!
		}))
	};
}

function readyDependencies(input: unknown): ConcurrencySentinelReadinessDependencies {
	const sources = finalSources();
	return {
		loadAllocation: async () => ({
			allocation: input,
			canonicalSha256: sha256Json(input)
		}),
		loadRound: async (_workspaceRoot, roundId) => verifiedRound(roundId, sources),
		verifyAcceptedRules: async () => ({ valid: true, canonicalSha256: 'e'.repeat(64) }),
		inspectSkill: async () => ({
			matchesInstalled: true,
			repositoryTreeSha256: 'f'.repeat(64),
			installedTreeSha256: 'f'.repeat(64)
		}),
		validateReferences: async () => true,
		pathsAbsent: async () => true
	};
}

describe('concurrency sentinel readiness', () => {
	it('derives exactly 14 source-bound manifests and 56 collision-free owned paths in memory', async () => {
		const input = await allocation();
		const bundle = buildConcurrencySentinelBundle({
			allocation: input,
			finalControlledSources: finalSources(),
			assignedAt: '2026-08-29T23:00:00.000Z'
		});

		expect(bundle.allocationCanonicalSha256).toBe(EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256);
		expect(bundle.targets).toHaveLength(14);
		expect(bundle.assignments).toHaveLength(14);
		expect(bundle.sourceBindings).toHaveLength(14);
		expect(bundle.ownedPaths).toHaveLength(56);
		expect(new Set(bundle.ownedPaths)).toHaveProperty('size', 56);
		expect(bundle.loadTargetIds).toHaveLength(6);
		expect(bundle.scaleTargetIds).toHaveLength(8);
		expect(bundle.targets.every((target) => target.cohort === 'regression')).toBe(true);
		expect(
			bundle.assignments.every(
				(assignment, index) =>
					assignment.targetId === bundle.targets[index]!.targetId &&
					assignment.permittedOutputs.candidatePath ===
						bundle.targets[index]!.output.candidatePath &&
					assignment.permittedOutputs.resultPath === bundle.targets[index]!.output.resultPath
			)
		).toBe(true);
	});

	it('rejects allocation drift, missing sources, and pre-final source protocols', async () => {
		const input = (await allocation()) as { purpose: string };
		expect(() =>
			buildConcurrencySentinelBundle({
				allocation: { ...input, purpose: `${input.purpose} drift` },
				finalControlledSources: finalSources(),
				assignedAt: '2026-08-29T23:00:00.000Z'
			})
		).toThrow('allocation hash');
		expect(() =>
			buildConcurrencySentinelBundle({
				allocation: input,
				finalControlledSources: finalSources().slice(1),
				assignedAt: '2026-08-29T23:00:00.000Z'
			})
		).toThrow('exactly one final-controlled source');
		const stale = finalSources();
		stale[0] = {
			...stale[0]!,
			target: ImageProductionTargetSchema.parse({
				...stale[0]!.target,
				authoringProtocol: 'basic-v1'
			})
		};
		expect(() =>
			buildConcurrencySentinelBundle({
				allocation: input,
				finalControlledSources: stale,
				assignedAt: '2026-08-29T23:00:00.000Z'
			})
		).toThrow('not final protocol');
	});

	it('reports ready only with every current gate while never authorizing publication', async () => {
		const input = await allocation();
		const report = await reportConcurrencySentinelReadiness({
			workspaceRoot: WORKSPACE_ROOT,
			actor: 'human-reviewer',
			dependencies: readyDependencies(input)
		});
		expect(report).toMatchObject({
			status: 'ready',
			preparationOnly: true,
			livePublicationAuthorized: false,
			writesPerformed: 0,
			targetCount: 14,
			assignmentCount: 14,
			sourceCount: 14,
			ownedPathCount: 56,
			loadCount: 6,
			scaleCount: 8,
			blockers: []
		});
	});

	it('fails closed on reference drift and any owned-path collision', async () => {
		const input = await allocation();
		const dependencies = readyDependencies(input);
		const report = await reportConcurrencySentinelReadiness({
			workspaceRoot: WORKSPACE_ROOT,
			dependencies: {
				...dependencies,
				validateReferences: async () => false,
				pathsAbsent: async () => false
			}
		});
		expect(report.status).toBe('blocked');
		expect(report.blockers).toEqual(
			expect.arrayContaining(['source-reference-invalid-or-stale', 'sentinel-owned-path-collision'])
		);
		expect(report.writesPerformed).toBe(0);
	});

	it('is a zero-write blocked check when all gated evidence is absent', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-sentinel-readiness-'));
		temporaryRoots.push(root);
		expect(await readdir(root)).toEqual([]);
		const report = await reportConcurrencySentinelReadiness({ workspaceRoot: root });
		expect(report.status).toBe('blocked');
		expect(report.writesPerformed).toBe(0);
		expect(report.blockers).toEqual(
			expect.arrayContaining([
				'allocation-missing-invalid-or-stale',
				'final-controlled-v1-not-finalized',
				'breadth-v1-not-finalized',
				'accepted-rules-not-current',
				'production-skill-not-current-or-installed'
			])
		);
		expect(await readdir(root)).toEqual([]);
	});
});

import { execFile } from 'node:child_process';
import {
	copyFile,
	lstat,
	link,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	unlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { ImageProductionResultSchema } from '../packages/contracts/src/index.js';
import {
	AffinityRoundEvaluationSchema,
	AffinityRoundIntegrationReceiptSchema,
	affinityRoundAggregatePaths,
	loadAffinityReviewRoundRegistry
} from './affinity-review-round-lib.js';
import { syncAffinityReviewRound } from './sync-affinity-review-round.js';

const REPOSITORY_ROOT = path.resolve('.');
const temporaryRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function temporaryRoot(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-round-sync-'));
	temporaryRoots.push(root);
	return root;
}

async function copyArtifact(root: string, repositoryPath: string): Promise<void> {
	const source = path.resolve(REPOSITORY_ROOT, repositoryPath);
	const destination = path.resolve(root, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await link(source, destination).catch(async (error: NodeJS.ErrnoException) => {
		if (error.code !== 'EXDEV') throw error;
		await copyFile(source, destination);
	});
}

async function baselineFixture(
	options: {
		readonly includeResults?: boolean;
		readonly omitLastResult?: boolean;
	} = {}
): Promise<string> {
	const root = await temporaryRoot();
	const registry = await loadAffinityReviewRoundRegistry(root, 'baseline-v1');
	for (const [index, entry] of registry.entries.entries()) {
		await copyArtifact(root, entry.targetPath);
		await copyArtifact(root, entry.assignmentPath);
		if (options.includeResults === false || (options.omitLastResult && index === 23)) continue;
		await copyArtifact(root, entry.target.output.resultPath);
		const result = ImageProductionResultSchema.parse(
			JSON.parse(
				await readFile(path.resolve(REPOSITORY_ROOT, entry.target.output.resultPath), 'utf8')
			)
		);
		const output =
			result.status === 'candidate'
				? result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)?.output
				: [...result.attempts].reverse().find((attempt) => attempt.output)?.output;
		if (output) await copyArtifact(root, output.path);
	}
	return root;
}

describe('round-safe affinity review synchronization', () => {
	it('loads the baseline check through the real CLI entrypoint without an ESM cycle', async () => {
		const { stdout } = await execFileAsync(path.resolve('node_modules/.bin/tsx'), [
			'tools/sync-affinity-review-round.ts',
			'--check',
			'--round',
			'baseline-v1'
		]);
		expect(JSON.parse(stdout)).toMatchObject({
			mode: 'check',
			roundId: 'baseline-v1',
			inSync: true,
			written: false
		});
	});

	it('defines exact isolated baseline and Breadth registries and gates final on activation', async () => {
		const root = await temporaryRoot();
		const baseline = await loadAffinityReviewRoundRegistry(root, 'baseline-v1');
		const breadth = await loadAffinityReviewRoundRegistry(root, 'breadth-v1');
		expect(baseline.entries).toHaveLength(24);
		expect(breadth.entries).toHaveLength(24);
		expect(new Set(baseline.entries.map((entry) => entry.target.targetId))).not.toEqual(
			new Set(breadth.entries.map((entry) => entry.target.targetId))
		);
		expect(baseline.entries.every((entry) => entry.target.cohort === 'controlled')).toBe(true);
		expect(breadth.entries.every((entry) => entry.target.cohort === 'breadth')).toBe(true);
		const planPath =
			'assets/enemies/experiments/affinity-workflow-v1/review/final-controlled-rerun-plan.json';
		await copyArtifact(root, planPath);
		await expect(loadAffinityReviewRoundRegistry(root, 'final-controlled-v1')).rejects.toThrow(
			'activation receipt is invalid'
		);
	});

	it('writes a complete unpromoted baseline catalog and evaluation before its receipt', async () => {
		const root = await baselineFixture();
		const report = await syncAffinityReviewRound({
			workspaceRoot: root,
			roundId: 'baseline-v1',
			mode: 'write'
		});
		expect(report).toMatchObject({
			status: 'complete',
			targetCount: 24,
			resultCount: 24,
			written: true,
			inSync: true
		});
		const paths = affinityRoundAggregatePaths('baseline-v1');
		const catalog = JSON.parse(await readFile(path.resolve(root, paths.catalog), 'utf8'));
		expect(catalog.entries).toHaveLength(24);
		expect(catalog.entries.every((entry: { promoted: boolean }) => !entry.promoted)).toBe(true);
		expect(
			catalog.entries.every((entry: { reviewState: string }) => entry.reviewState === 'pending')
		).toBe(true);
		AffinityRoundEvaluationSchema.parse(
			JSON.parse(await readFile(path.resolve(root, paths.evaluation), 'utf8'))
		);
		AffinityRoundIntegrationReceiptSchema.parse(
			JSON.parse(await readFile(path.resolve(root, paths.receipt), 'utf8'))
		);
		const check = await syncAffinityReviewRound({
			workspaceRoot: root,
			roundId: 'baseline-v1',
			mode: 'check'
		});
		expect(check.inSync).toBe(true);
		expect(check.written).toBe(false);
	});

	it('coexists with regression manifests and serializes identical concurrent publications', async () => {
		const root = await baselineFixture();
		const regressionTargetPath =
			'assets/enemies/experiments/affinity-workflow-v1/targets/regression/death-knight/metal-v2.json';
		const regressionAssignmentPath =
			'assets/enemies/experiments/affinity-workflow-v1/assignments/regression/death-knight/metal-v2.json';
		await copyArtifact(root, regressionTargetPath);
		await copyArtifact(root, regressionAssignmentPath);
		const regressionTarget = JSON.parse(
			await readFile(path.resolve(REPOSITORY_ROOT, regressionTargetPath), 'utf8')
		) as { output: { resultPath: string } };
		await copyArtifact(root, regressionTarget.output.resultPath);
		const regressionResult = ImageProductionResultSchema.parse(
			JSON.parse(
				await readFile(path.resolve(REPOSITORY_ROOT, regressionTarget.output.resultPath), 'utf8')
			)
		);
		const regressionOutput =
			regressionResult.attempts.find(
				(attempt) => attempt.attemptId === regressionResult.selectedAttemptId
			)?.output ??
			[...regressionResult.attempts].reverse().find((attempt) => attempt.output)?.output;
		if (regressionOutput) await copyArtifact(root, regressionOutput.path);
		const reports = await Promise.all(
			Array.from({ length: 2 }, () =>
				syncAffinityReviewRound({
					workspaceRoot: root,
					roundId: 'baseline-v1',
					mode: 'write'
				})
			)
		);
		expect(reports.every((report) => report.inSync)).toBe(true);
		const check = await syncAffinityReviewRound({
			workspaceRoot: root,
			roundId: 'baseline-v1',
			mode: 'check'
		});
		expect(check.inSync).toBe(true);
	});

	it('refuses partial rounds before creating aggregate paths', async () => {
		const root = await baselineFixture({ omitLastResult: true });
		await expect(
			syncAffinityReviewRound({ workspaceRoot: root, roundId: 'baseline-v1', mode: 'write' })
		).rejects.toThrow();
		const paths = affinityRoundAggregatePaths('baseline-v1');
		await expect(lstat(path.resolve(root, paths.catalog))).rejects.toMatchObject({
			code: 'ENOENT'
		});
		await expect(lstat(path.resolve(root, paths.receipt))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('writes nothing for the currently incomplete final and Breadth round shapes', async () => {
		const root = await temporaryRoot();
		const breadth = await loadAffinityReviewRoundRegistry(root, 'breadth-v1');
		for (const entry of breadth.entries) {
			await copyArtifact(root, entry.targetPath);
			await copyArtifact(root, entry.assignmentPath);
		}
		await expect(
			syncAffinityReviewRound({ workspaceRoot: root, roundId: 'breadth-v1', mode: 'write' })
		).rejects.toThrow();
		const breadthPaths = affinityRoundAggregatePaths('breadth-v1');
		await expect(lstat(path.resolve(root, breadthPaths.catalog))).rejects.toMatchObject({
			code: 'ENOENT'
		});
		const planPath =
			'assets/enemies/experiments/affinity-workflow-v1/review/final-controlled-rerun-plan.json';
		await copyArtifact(root, planPath);
		await expect(
			syncAffinityReviewRound({
				workspaceRoot: root,
				roundId: 'final-controlled-v1',
				mode: 'write'
			})
		).rejects.toThrow('activation receipt is invalid');
		const finalPaths = affinityRoundAggregatePaths('final-controlled-v1');
		await expect(lstat(path.resolve(root, finalPaths.receipt))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('permits shared namespaces but refuses cross-round identity collisions', async () => {
		const root = await baselineFixture({ includeResults: false });
		const registry = await loadAffinityReviewRoundRegistry(root, 'baseline-v1');
		const collisionPath = path.resolve(
			root,
			'assets/enemies/experiments/affinity-workflow-v1/targets/collision/duplicate.json'
		);
		await mkdir(path.dirname(collisionPath), { recursive: true });
		await writeFile(collisionPath, `${JSON.stringify(registry.entries[0]!.target)}\n`);
		await expect(
			syncAffinityReviewRound({ workspaceRoot: root, roundId: 'baseline-v1', mode: 'write' })
		).rejects.toThrow('Duplicate target ID across rounds');
	});

	it('refuses candidate byte drift without writing aggregates', async () => {
		const root = await baselineFixture();
		const registry = await loadAffinityReviewRoundRegistry(root, 'baseline-v1');
		await unlink(path.resolve(root, registry.entries[0]!.target.output.candidatePath));
		await writeFile(path.resolve(root, registry.entries[0]!.target.output.candidatePath), 'drift');
		await expect(
			syncAffinityReviewRound({ workspaceRoot: root, roundId: 'baseline-v1', mode: 'write' })
		).rejects.toThrow('Candidate byte provenance differs');
		const paths = affinityRoundAggregatePaths('baseline-v1');
		await expect(lstat(path.resolve(root, paths.receipt))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('refuses drift of receipt-bound aggregates', async () => {
		const root = await baselineFixture();
		await syncAffinityReviewRound({
			workspaceRoot: root,
			roundId: 'baseline-v1',
			mode: 'write'
		});
		const paths = affinityRoundAggregatePaths('baseline-v1');
		await writeFile(path.resolve(root, paths.catalog), '{}\n');
		await expect(
			syncAffinityReviewRound({ workspaceRoot: root, roundId: 'baseline-v1', mode: 'check' })
		).rejects.toThrow('Receipt-bound aggregate drift');
	});
});

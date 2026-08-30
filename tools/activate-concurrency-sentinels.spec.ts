import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ImageProductionTargetSchema } from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
	CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH,
	activateConcurrencySentinels,
	parseActivateConcurrencySentinelArgs,
	verifyConcurrencySentinelActivationReceipt
} from './activate-concurrency-sentinels.js';
import {
	CONCURRENCY_SENTINEL_ALLOCATION_PATH,
	EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256,
	buildConcurrencySentinelBundle,
	type PreparedConcurrencySentinels
} from './concurrency-sentinel-readiness.js';
import { createAffinityWorkflowExportBundle, sha256Json } from './image-production-lib.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function exists(file: string) {
	return stat(file).then(
		() => true,
		() => false
	);
}

async function prepared(): Promise<PreparedConcurrencySentinels> {
	const allocation: unknown = JSON.parse(
		await readFile(path.resolve(CONCURRENCY_SENTINEL_ALLOCATION_PATH), 'utf8')
	);
	const finalControlledSources = createAffinityWorkflowExportBundle()
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
	const bundle = buildConcurrencySentinelBundle({
		allocation,
		finalControlledSources,
		assignedAt: '2026-08-29T23:00:00.000Z'
	});
	const sourceSetCanonicalSha256 = sha256Json(bundle.sourceBindings);
	const sentinelBundleCanonicalSha256 = sha256Json({
		targets: bundle.targets,
		assignments: bundle.assignments
	});
	return {
		bundle,
		report: {
			schemaVersion: 'affinity-concurrency-sentinel-readiness-v2',
			experimentId: 'affinity-workflow-v1',
			status: 'ready',
			preparationOnly: true,
			livePublicationAuthorized: false,
			writesPerformed: 0,
			allocationPath: CONCURRENCY_SENTINEL_ALLOCATION_PATH,
			allocationCanonicalSha256: EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256,
			expectedAllocationCanonicalSha256: EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256,
			targetCount: 14,
			assignmentCount: 14,
			sourceCount: 14,
			ownedPathCount: 56,
			loadCount: 6,
			scaleCount: 8,
			finalControlledIntegrationReceiptCanonicalSha256: 'a'.repeat(64),
			finalControlledEvaluationReceiptCanonicalSha256: 'b'.repeat(64),
			assignedAt: '2026-08-29T23:00:00.000Z',
			acceptedRulesCanonicalSha256: 'c'.repeat(64),
			repositorySkillTreeSha256: 'd'.repeat(64),
			installedSkillTreeSha256: 'd'.repeat(64),
			sourceSetCanonicalSha256,
			sentinelBundleCanonicalSha256,
			blockers: []
		}
	};
}

async function workspace() {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-sentinel-activation-'));
	temporaryRoots.push(root);
	return root;
}

describe('guarded concurrency-sentinel activation', () => {
	it('requires strict explicit live activation arguments', () => {
		expect(
			parseActivateConcurrencySentinelArgs([
				'--',
				'--actor',
				'operator',
				'--acknowledge-live-sentinel-activation'
			])
		).toEqual({ actor: 'operator', acknowledge: true });
		expect(() => parseActivateConcurrencySentinelArgs(['--wat'])).toThrow('Unknown argument');
		expect(() =>
			parseActivateConcurrencySentinelArgs([
				'--acknowledge-live-sentinel-activation',
				'--acknowledge-live-sentinel-activation'
			])
		).toThrow('exactly once');
	});

	it('publishes 28 exact manifests, commits the receipt last, and is idempotent', async () => {
		const root = await workspace();
		const snapshot = await prepared();
		const loadPrepared = async () => snapshot;
		const first = await activateConcurrencySentinels({
			workspaceRoot: root,
			actor: 'operator',
			acknowledgeLiveSentinelActivation: true,
			loadPrepared,
			now: () => '2026-08-29T23:30:00.000Z'
		});
		expect(first.status).toBe('activated');
		expect(first.receipt.artifacts).toHaveLength(28);
		expect(first.receipt.bindings.sentinelBundleCanonicalSha256).toBe(
			snapshot.report.sentinelBundleCanonicalSha256
		);
		const verification = await verifyConcurrencySentinelActivationReceipt(root);
		expect(verification.valid, verification.issues.join('\n')).toBe(true);
		const second = await activateConcurrencySentinels({
			workspaceRoot: root,
			actor: 'operator',
			acknowledgeLiveSentinelActivation: true,
			loadPrepared
		});
		expect(second.status).toBe('already-activated');
	});

	it('rolls back only transaction-owned manifests when publication fails', async () => {
		const root = await workspace();
		const snapshot = await prepared();
		await expect(
			activateConcurrencySentinels({
				workspaceRoot: root,
				actor: 'operator',
				acknowledgeLiveSentinelActivation: true,
				loadPrepared: async () => snapshot,
				failAfterPublished: 5
			})
		).rejects.toThrow('after 5 artifacts');
		for (const artifact of snapshot.bundle!.artifacts)
			expect(await exists(path.resolve(root, artifact.livePath))).toBe(false);
		expect(await exists(path.resolve(root, CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH))).toBe(
			false
		);
	});

	it('fails closed before any writes when the live acknowledgment is absent', async () => {
		const root = await workspace();
		await expect(
			activateConcurrencySentinels({
				workspaceRoot: root,
				actor: 'operator',
				acknowledgeLiveSentinelActivation: false,
				loadPrepared: async () => prepared()
			})
		).rejects.toThrow('acknowledge-live-sentinel-activation');
		expect(await exists(path.resolve(root, 'assets'))).toBe(false);
	});
});

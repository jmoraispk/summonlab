import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { EQUIPMENT_PRODUCTION_ROOT } from './equipment-image-production-contract.js';
import { runEquipmentImageProductionCli } from './equipment-image-production.js';
import { reportEquipmentRun, simulateEquipmentRun } from './equipment-image-run-reconcile.js';
import { DEFAULT_EQUIPMENT_RUN_ID } from './equipment-image-run-readiness.js';
import { makeCleanEquipmentTestWorkspace } from './equipment-test-workspace.js';

async function snapshotTree(workspaceRoot: string): Promise<string[]> {
	const entries: string[] = [];
	async function visit(absoluteDirectory: string, relativeDirectory: string): Promise<void> {
		for (const name of (await readdir(absoluteDirectory)).sort()) {
			const absolutePath = path.join(absoluteDirectory, name);
			const relativePath = path.posix.join(relativeDirectory, name);
			const metadata = await lstat(absolutePath);
			if (metadata.isSymbolicLink()) {
				entries.push(`link:${relativePath}`);
			} else if (metadata.isDirectory()) {
				entries.push(`directory:${relativePath}`);
				await visit(absolutePath, relativePath);
			} else {
				entries.push(
					`file:${relativePath}:${createHash('sha256')
						.update(await readFile(absolutePath))
						.digest('hex')}`
				);
			}
		}
	}
	await visit(path.resolve(workspaceRoot, EQUIPMENT_PRODUCTION_ROOT), EQUIPMENT_PRODUCTION_ROOT);
	return entries;
}

describe('Equipment production dry integration', () => {
	it('simulates the complete 161-job topology with zero images and zero writes', () => {
		const report = simulateEquipmentRun({
			availableWorkerSlots: 16,
			unrelatedActiveWorkMetadata: {
				activeTasks: 400,
				reservedOrchestratorSlots: 15,
				voluntaryThrottle: true
			}
		});

		expect(report.summary).toEqual({
			totalJobs: 161,
			initiallyReadyJobs: 77,
			gatedPieceJobs: 84,
			armourReviewGates: 21,
			maximumConcurrency: 16,
			generatedImages: 0
		});
		expect(report.firstAdmission.targetIds).toHaveLength(16);
		expect(report.allAcceptedGateSimulation.unlockedPieceJobs).toBe(84);
		expect(report.circuitBreakerSimulation).toMatchObject({
			technicalFailuresBeforePause: 3,
			claimsWhilePaused: 0,
			resumedInLaterEpoch: true
		});
		expect(report.circuitBreakerSimulation.claimsAfterResume).toBeGreaterThan(0);
		expect(report.unrelatedWorkSimulation).toEqual({
			availableWorkerSlots: 16,
			baselineAdmission: 16,
			admissionWithUnrelatedMetadata: 16
		});
		expect(report.sharedFilesChanged).toEqual([]);
		expect(report.writesPerformed).toBe(0);
	});

	it('reports current ready-for-activation state and runs report/simulate with zero writes', async () => {
		const workspaceRoot = await makeCleanEquipmentTestWorkspace(
			process.cwd(),
			'equipment-production-integration-'
		);
		const before = await snapshotTree(workspaceRoot);
		const report = await reportEquipmentRun({
			workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			createdAt: '2026-09-01T23:15:00.000Z',
			generatedAt: '2026-09-02T01:00:00.000Z'
		});
		const cliReport = await runEquipmentImageProductionCli({
			workspaceRoot,
			args: [
				'report',
				'--run-id',
				DEFAULT_EQUIPMENT_RUN_ID,
				'--created-at',
				'2026-09-01T23:15:00.000Z',
				'--generated-at',
				'2026-09-02T01:00:00.000Z'
			]
		});
		const cliSimulation = await runEquipmentImageProductionCli({
			workspaceRoot,
			args: ['simulate', '--available-worker-slots', '16']
		});

		expect(report).toMatchObject({
			status: 'not-started',
			writesPerformed: 0,
			activationState: 'absent',
			readinessStatus: 'ready',
			summary: {
				totalJobs: 161,
				readyJobs: 77,
				claimedJobs: 0,
				activeJobs: 0,
				terminalJobs: 0,
				acceptedArmourGates: 0,
				technicalFailuresInEpoch: 0,
				peakActiveEquipmentWorkers: 0,
				maximumConcurrency: 16
			}
		});
		expect(cliReport).toMatchObject({
			command: 'report',
			status: 'not-started',
			writesPerformed: 0
		});
		expect(cliSimulation).toMatchObject({
			command: 'simulate',
			writesPerformed: 0,
			summary: { generatedImages: 0 }
		});
		expect(await snapshotTree(workspaceRoot)).toEqual(before);
		await rm(workspaceRoot, { recursive: true, force: true });
	});
});

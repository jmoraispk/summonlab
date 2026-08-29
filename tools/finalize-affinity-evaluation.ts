import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ImageProductionEvaluationSchema } from '../packages/contracts/src/index.js';
import { AFFINITY_EXPERIMENT_ROOT } from './image-production-lib.js';
import {
	reportAffinityGateReadiness,
	type AffinityGateReadinessReport
} from './report-affinity-gate-readiness.js';
import {
	scanAffinityReviewWorkspace,
	syncAffinityReviewWorkspace
} from './sync-affinity-review.js';

const EVALUATION_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/evaluation.json` as const;

export interface AffinityEvaluationFinalizationReport {
	readonly mode: 'check' | 'write';
	readonly eligible: boolean;
	readonly desiredStatus: 'incomplete' | 'passed';
	readonly priorStatus: 'incomplete' | 'passed' | 'failed';
	readonly finalStatus: 'incomplete' | 'passed' | 'failed';
	readonly inSync: boolean;
	readonly written: boolean;
	readonly blockers: readonly string[];
}

export function finalizationBlockers(report: AffinityGateReadinessReport): readonly string[] {
	const blockers: string[] = [];
	if (!report.workspace.valid) blockers.push('workspace-invalid');
	for (const criterion of report.gate.unattainableCriteria)
		blockers.push(`unattainable:${criterion}`);
	for (const [criterionId, criterion] of Object.entries(report.criteria)) {
		if (!criterion.satisfied && criterion.attainable) blockers.push(`pending:${criterionId}`);
	}
	return blockers;
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	const temporary = `${filePath}.finalize-${process.pid}.tmp`;
	await writeFile(temporary, `${JSON.stringify(value, null, '\t')}\n`, { flag: 'wx' });
	await rename(temporary, filePath);
}

/**
 * Explicitly seals a passing human-reviewed evaluation. Synchronization remains conservative and
 * never invents the transition; this command makes the human-controlled release decision only
 * after every machine-derived threshold is already satisfied.
 */
export async function finalizeAffinityEvaluation(
	workspaceRoot = process.cwd(),
	mode: 'check' | 'write' = 'check'
): Promise<AffinityEvaluationFinalizationReport> {
	const sync = await syncAffinityReviewWorkspace(workspaceRoot, 'check');
	if (sync.issueCount > 0 || !sync.inSync) {
		throw new Error('Affinity aggregates must be valid and synchronized before finalization.');
	}
	const [scan, readiness] = await Promise.all([
		scanAffinityReviewWorkspace(workspaceRoot),
		reportAffinityGateReadiness(workspaceRoot)
	]);
	const blockers = finalizationBlockers(readiness);
	const eligible = readiness.gate.currentlySatisfied && blockers.length === 0;
	const desiredStatus = eligible ? 'passed' : 'incomplete';
	const priorStatus = scan.evaluation.status;
	if (priorStatus === 'failed') {
		return {
			mode,
			eligible: false,
			desiredStatus,
			priorStatus,
			finalStatus: priorStatus,
			inSync: false,
			written: false,
			blockers: ['evaluation-explicitly-failed', ...blockers]
		};
	}
	let written = false;
	if (mode === 'write' && eligible && priorStatus !== 'passed') {
		const evaluation = ImageProductionEvaluationSchema.parse({
			...scan.evaluation,
			status: 'passed'
		});
		await atomicWriteJson(path.resolve(workspaceRoot, EVALUATION_PATH), evaluation);
		written = true;
	}
	const finalStatus = written ? ('passed' as const) : priorStatus;
	return {
		mode,
		eligible,
		desiredStatus,
		priorStatus,
		finalStatus,
		inSync: finalStatus === desiredStatus,
		written,
		blockers
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const mode = process.argv.includes('--write') ? 'write' : 'check';
	const report = await finalizeAffinityEvaluation(process.cwd(), mode);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (!report.inSync) process.exitCode = 1;
}

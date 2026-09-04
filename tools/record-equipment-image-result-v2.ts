import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { EquipmentV2ImageTargetSchema } from './equipment-image-production-contract-v2.js';
import {
	buildEquipmentImageResultEvidenceV2,
	persistEquipmentImageResultEvidenceV2
} from './equipment-image-result-v2.js';
import { readEquipmentRepositoryJson } from './equipment-repository-io.js';

function option(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string): string {
	const value = option(name);
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	const workspaceRoot = required('--workspace-root');
	const targetPath = required('--target');
	const assignmentPath = required('--assignment');
	const status = required('--status') as 'candidate' | 'revise' | 'failed';
	if (!['candidate', 'revise', 'failed'].includes(status)) throw new Error('Invalid --status');
	const concernCriterion = option('--concern-criterion');
	if (status === 'revise' && !concernCriterion) {
		throw new Error('Revise evidence requires --concern-criterion');
	}
	const target = EquipmentV2ImageTargetSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, targetPath)
	);
	if (
		concernCriterion !== undefined &&
		!target.acceptanceCriteria.some(({ criterionId }) => criterionId === concernCriterion)
	) {
		throw new Error(`Unknown concern criterion: ${concernCriterion}`);
	}
	const findings = target.acceptanceCriteria.map(({ criterionId }) => ({
		criterionId,
		outcome:
			status === 'failed'
				? ('not-applicable' as const)
				: criterionId === concernCriterion
					? ('concern' as const)
					: ('pass' as const),
		observation:
			status === 'failed'
				? 'No image was available for producer inspection.'
				: criterionId === concernCriterion
					? 'Producer inspection found a concern requiring human review.'
					: 'Producer inspection passed this declared criterion.'
	}));
	const result = await buildEquipmentImageResultEvidenceV2({
		workspaceRoot,
		targetPath,
		assignmentPath,
		status,
		sourceOutputId: status === 'failed' ? null : required('--source-output-id'),
		requestStartedAt: required('--request-started-at'),
		generationCompletedAt: required('--generation-completed-at'),
		inspectionCompletedAt: required('--inspection-completed-at'),
		startedAt: required('--request-started-at'),
		completedAt: required('--inspection-completed-at'),
		findings
	});
	const persisted = await persistEquipmentImageResultEvidenceV2({
		workspaceRoot,
		targetPath,
		assignmentPath,
		result
	});
	process.stdout.write(
		`${JSON.stringify(
			{
				targetId: persisted.targetId,
				status: persisted.status,
				humanReviewLabel: persisted.humanReviewLabel,
				candidate: persisted.candidate,
				resultCanonicalSha256: persisted.resultCanonicalSha256
			},
			null,
			2
		)}\n`
	);
}

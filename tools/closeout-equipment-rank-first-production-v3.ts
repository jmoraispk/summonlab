import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
	EquipmentCandidateCloseoutV3Schema,
	EquipmentCandidatePromotionProposalV3Schema,
	EquipmentCheckpointReceiptV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_V3_MANIFEST_PATH,
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	canonicalSha256,
	fileSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import { resolveEquipmentCheckpointImagePathsV3 } from './record-equipment-rank-first-checkpoint-v3.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';
import { validateEquipmentRankFirstEvidenceV3 } from './validate-equipment-rank-first-evidence-v3.js';
import { validateEquipmentRankFirstTerminalEvidenceV3 } from './validate-equipment-rank-first-terminal-evidence-v3.js';

const execFileAsync = promisify(execFile);

export const EQUIPMENT_V3_PROMOTION_PROPOSAL_PATH = `${EQUIPMENT_V3_ROOT}/reviews/proposed-promotions/candidate-promotion-v1.json`;
export const EQUIPMENT_V3_CLOSEOUT_PATH = `${EQUIPMENT_V3_ROOT}/runs/material-equipment-v3-run-001/candidate-closeout-v1.json`;

const CHECKPOINT_PATHS = [
	`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-1-directions.json`,
	`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-2-roots.json`,
	`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-3-armour-pieces.json`
] as const;

async function git(workspaceRoot: string, args: readonly string[]): Promise<string> {
	return (await execFileAsync('git', args, { cwd: workspaceRoot })).stdout.trim();
}

export async function closeoutEquipmentRankFirstProductionV3(input: {
	workspaceRoot: string;
	baseCommit: string;
	createdAt: string;
	createdBy: string;
}) {
	await validateEquipmentRankFirstEvidenceV3({
		workspaceRoot: input.workspaceRoot,
		phase: 'closeout'
	});
	const terminalEvidence = await validateEquipmentRankFirstTerminalEvidenceV3(input.workspaceRoot);
	for (const outputPath of [EQUIPMENT_V3_PROMOTION_PROPOSAL_PATH, EQUIPMENT_V3_CLOSEOUT_PATH]) {
		if ((await equipmentRepositoryPathState(input.workspaceRoot, outputPath)) !== 'absent') {
			throw new Error(`Equipment closeout path collision: ${outputPath}`);
		}
	}
	if ((await git(input.workspaceRoot, ['status', '--porcelain=v1'])) !== '') {
		throw new Error('Equipment closeout requires a clean working tree');
	}
	await git(input.workspaceRoot, ['merge-base', '--is-ancestor', input.baseCommit, 'HEAD']);
	const [branch, basisCommit, commitLog] = await Promise.all([
		git(input.workspaceRoot, ['branch', '--show-current']),
		git(input.workspaceRoot, ['rev-parse', 'HEAD']),
		git(input.workspaceRoot, ['log', '--reverse', '--format=%H%x09%s', `${input.baseCommit}..HEAD`])
	]);
	const commits = commitLog
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const separator = line.indexOf('\t');
			if (separator < 1) throw new Error('Unexpected Equipment closeout git-log format');
			return { hash: line.slice(0, separator), subject: line.slice(separator + 1) };
		});
	const checkpointValues = await Promise.all(
		CHECKPOINT_PATHS.map((checkpointPath) =>
			readEquipmentRepositoryJson(input.workspaceRoot, checkpointPath)
		)
	);
	const checkpointReceipts = checkpointValues.map((value) =>
		EquipmentCheckpointReceiptV3Schema.parse(value)
	);
	const rootPaths = await resolveEquipmentCheckpointImagePathsV3(input.workspaceRoot, '2');
	const piecePaths = await resolveEquipmentCheckpointImagePathsV3(input.workspaceRoot, '3');
	const rootDecisions = new Map(
		checkpointReceipts[1]!.decisions.map((decision) => [decision.subjectId, decision])
	);
	const pieceDecisions = new Map(
		checkpointReceipts[2]!.decisions.map((decision) => [decision.subjectId, decision])
	);
	const entries = [];
	let excludedRevise = 0;
	let excludedDefer = 0;
	for (const target of buildEquipmentCandidateTargetsV3()) {
		const isPiece = target.artifactRole === 'armour-piece';
		const decision = (isPiece ? pieceDecisions : rootDecisions).get(target.targetId);
		const candidatePath = (isPiece ? piecePaths : rootPaths).get(target.targetId);
		if (!decision || !candidatePath || decision.imagePath !== candidatePath) {
			throw new Error(`Closeout decision/candidate mismatch: ${target.targetId}`);
		}
		if (decision.decision === 'accept') {
			entries.push({
				targetId: target.targetId,
				candidatePath,
				candidateSha256: fileSha256(path.join(input.workspaceRoot, ...candidatePath.split('/'))),
				ownerDecision: 'accept' as const
			});
		} else if (decision.decision === 'revise') excludedRevise += 1;
		else excludedDefer += 1;
	}
	const checkpoint3CanonicalSha256 = canonicalSha256(checkpointValues[2]);
	const proposal = EquipmentCandidatePromotionProposalV3Schema.parse({
		schemaVersion: 'equipment-candidate-promotion-proposal-v3',
		proposalId: 'material-equipment-v3-candidate-promotion-v1',
		createdAt: input.createdAt,
		createdBy: input.createdBy,
		status: 'proposal-only',
		checkpoint3: {
			path: CHECKPOINT_PATHS[2],
			canonicalSha256: checkpoint3CanonicalSha256
		},
		entries,
		excluded: { accept: 0, revise: excludedRevise, defer: excludedDefer },
		forbiddenActions: [
			'do not copy candidates into approved or runtime paths without a separate owner decision',
			'do not edit shared runtime catalogs from this proposal',
			'do not treat proposal inclusion as approval or integration'
		],
		noRuntimeMutation: true
	});
	const decisionTotals = checkpointReceipts.reduce(
		(totals, receipt) => ({
			accept: totals.accept + receipt.summary.accept,
			revise: totals.revise + receipt.summary.revise,
			defer: totals.defer + receipt.summary.defer,
			noImage: 0 as const
		}),
		{ accept: 0, revise: 0, defer: 0, noImage: 0 as const }
	);
	const manifestValue = await readEquipmentRepositoryJson(
		input.workspaceRoot,
		EQUIPMENT_V3_MANIFEST_PATH
	);
	const report = EquipmentCandidateCloseoutV3Schema.parse({
		schemaVersion: 'equipment-candidate-closeout-v3',
		reportId: 'material-equipment-v3-candidate-closeout-v1',
		runId: 'material-equipment-v3-run-001',
		createdAt: input.createdAt,
		createdBy: input.createdBy,
		status: 'candidate-closeout',
		manifest: {
			path: EQUIPMENT_V3_MANIFEST_PATH,
			canonicalSha256: canonicalSha256(manifestValue)
		},
		repository: { branch, basisCommit, commits },
		checkpoints: CHECKPOINT_PATHS.map((checkpointPath, index) => ({
			path: checkpointPath,
			canonicalSha256: canonicalSha256(checkpointValues[index]),
			summary: checkpointReceipts[index]!.summary
		})),
		decisionTotals,
		evidence: {
			directionSheetCount: 11,
			rootCandidateCount: 77,
			armourPieceCandidateCount: 84,
			classAuditCount: 11,
			materialAuditCount: 28,
			armourAuditCount: 21,
			baseAssignmentCount: terminalEvidence.baseAssignmentCount,
			revisionAssignmentCount: terminalEvidence.revisionAssignmentCount,
			terminalResultCount: terminalEvidence.terminalResultCount,
			succeededResultCount: terminalEvidence.succeededResultCount,
			failedResultCount: terminalEvidence.failedResultCount,
			withheldCallCount: terminalEvidence.withheldCallCount
		},
		promotionProposal: {
			path: EQUIPMENT_V3_PROMOTION_PROPOSAL_PATH,
			canonicalSha256: canonicalSha256(proposal)
		},
		validationCommands: [
			'corepack pnpm tsc -p tools/tsconfig.equipment-rank-first-v3.json --noEmit',
			'corepack pnpm vitest run tools/equipment-rank-first-production-v3.spec.ts tools/equipment-armour-review.spec.ts tools/equipment-armour-piece-revisions-v3.spec.ts tools/equipment-rank-first-failures-v3.spec.ts',
			'corepack pnpm tsx tools/export-equipment-rank-first-production-v3.ts --check',
			'corepack pnpm tsx tools/validate-equipment-rank-first-evidence-v3.ts --phase closeout',
			'corepack pnpm tsx tools/validate-equipment-rank-first-terminal-evidence-v3.ts'
		],
		unresolvedIntegrationRequests: [
			'Approved-source promotion and runtime catalog integration require a separate owner decision and root-orchestrator coordination.'
		],
		candidateOnly: true,
		noRuntimeMutation: true
	});
	await exclusiveCreateEquipmentRepositoryFile(
		input.workspaceRoot,
		EQUIPMENT_V3_PROMOTION_PROPOSAL_PATH,
		serializeJson(proposal)
	);
	await exclusiveCreateEquipmentRepositoryFile(
		input.workspaceRoot,
		EQUIPMENT_V3_CLOSEOUT_PATH,
		serializeJson(report)
	);
	return {
		closeoutPath: EQUIPMENT_V3_CLOSEOUT_PATH,
		promotionProposalPath: EQUIPMENT_V3_PROMOTION_PROPOSAL_PATH,
		promotionCandidateCount: entries.length,
		decisionTotals,
		basisCommit
	};
}

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	process.stdout.write(
		`${JSON.stringify(
			await closeoutEquipmentRankFirstProductionV3({
				workspaceRoot: process.cwd(),
				baseCommit: option('--base-commit'),
				createdAt: option('--created-at'),
				createdBy: option('--created-by')
			}),
			null,
			2
		)}\n`
	);
}

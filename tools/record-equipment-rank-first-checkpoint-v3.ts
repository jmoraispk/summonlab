import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EquipmentCheckpointReceiptV3Schema,
	EquipmentRootCandidateSelectionManifestV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_CLASS_DIRECTIONS_V3,
	EQUIPMENT_V3_MANIFEST_PATH,
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	canonicalSha256,
	fileSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import { EQUIPMENT_V3_ROOT_SELECTION_PATH } from './materialize-equipment-rank-first-revisions-v3.js';
import { resolveEquipmentArmourPieceCandidatesV3 } from './materialize-equipment-armour-piece-selections-v3.js';
import {
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

interface DecisionInput {
	readonly subjectId: string;
	readonly imagePath: string;
	readonly decision: 'accept' | 'revise' | 'defer';
	readonly notes?: string;
}

const CHECKPOINTS = {
	'1': {
		id: 'equipment-v3-checkpoint-1-directions',
		path: `${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-1-directions.json`,
		expected: () =>
			EQUIPMENT_CLASS_DIRECTIONS_V3.filter(({ status }) => status === 'generation-required').map(
				({ classId }) => `equipment-v3-${classId}-rank-progression`
			)
	},
	'2': {
		id: 'equipment-v3-checkpoint-2-roots',
		path: `${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-2-roots.json`,
		expected: () =>
			buildEquipmentCandidateTargetsV3()
				.filter(({ dependsOnTargetId }) => dependsOnTargetId === null)
				.map(({ targetId }) => targetId)
	},
	'3': {
		id: 'equipment-v3-checkpoint-3-armour-pieces',
		path: `${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-3-armour-pieces.json`,
		expected: () =>
			buildEquipmentCandidateTargetsV3()
				.filter(({ artifactRole }) => artifactRole === 'armour-piece')
				.map(({ targetId }) => targetId)
	}
} as const;

const CHECKPOINT_GALLERIES = {
	'1': `${EQUIPMENT_V3_ROOT}/reviews/checkpoint-1/index.html`,
	'2': `${EQUIPMENT_V3_ROOT}/reviews/checkpoint-2-final/index.html`
} as const;

export async function resolveEquipmentCheckpointImagePathsV3(
	workspaceRoot: string,
	checkpoint: keyof typeof CHECKPOINTS
): Promise<Map<string, string>> {
	if (checkpoint === '1') {
		return new Map(
			EQUIPMENT_CLASS_DIRECTIONS_V3.filter(({ status }) => status === 'generation-required').map(
				(direction) => [`equipment-v3-${direction.classId}-rank-progression`, direction.imagePath]
			)
		);
	}
	const targets = buildEquipmentCandidateTargetsV3().filter((target) =>
		checkpoint === '2' ? target.dependsOnTargetId === null : target.artifactRole === 'armour-piece'
	);
	if (checkpoint === '3') {
		return (await resolveEquipmentArmourPieceCandidatesV3(workspaceRoot)).candidatePaths;
	}
	const selections = EquipmentRootCandidateSelectionManifestV3Schema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V3_ROOT_SELECTION_PATH)
	).selections;
	return new Map(
		targets.map((target) => [
			target.targetId,
			selections.find(({ targetId }) => targetId === target.targetId)?.candidatePath ??
				target.output.candidatePath
		])
	);
}

export async function recordEquipmentCheckpointV3(input: {
	readonly workspaceRoot: string;
	readonly checkpoint: keyof typeof CHECKPOINTS;
	readonly decisions: readonly DecisionInput[];
	readonly decidedBy: string;
	readonly createdAt: string;
	readonly galleryPath: string;
}) {
	const definition = CHECKPOINTS[input.checkpoint];
	const expected = definition.expected();
	const supplied = input.decisions.map(({ subjectId }) => subjectId);
	if (new Set(supplied).size !== supplied.length)
		throw new Error('Duplicate checkpoint subject ID');
	if (supplied.length !== expected.length || expected.some((value) => !supplied.includes(value))) {
		throw new Error(
			`Checkpoint ${input.checkpoint} requires exactly its ${expected.length} subjects`
		);
	}
	const pieceSelections =
		input.checkpoint === '3'
			? await resolveEquipmentArmourPieceCandidatesV3(input.workspaceRoot)
			: null;
	const expectedGalleryPath =
		input.checkpoint === '3'
			? `${EQUIPMENT_V3_ROOT}/reviews/checkpoint-3${pieceSelections?.manifest ? '-final' : ''}/index.html`
			: CHECKPOINT_GALLERIES[input.checkpoint];
	if (input.galleryPath !== expectedGalleryPath) {
		throw new Error(`Checkpoint ${input.checkpoint} gallery path is not authoritative`);
	}
	const imagePaths = await resolveEquipmentCheckpointImagePathsV3(
		input.workspaceRoot,
		input.checkpoint
	);
	for (const decision of input.decisions) {
		if (imagePaths.get(decision.subjectId) !== decision.imagePath) {
			throw new Error(`Checkpoint image path is stale or unselected: ${decision.subjectId}`);
		}
	}
	const decisions = input.decisions.map((decision) => ({
		...decision,
		imageSha256: fileSha256(path.join(input.workspaceRoot, ...decision.imagePath.split('/'))),
		notes: decision.notes ?? ''
	}));
	const summary = decisions.reduce(
		(counts, decision) => {
			counts[decision.decision] += 1;
			return counts;
		},
		{ accept: 0, revise: 0, defer: 0 }
	);
	const manifestValue = await readEquipmentRepositoryJson(
		input.workspaceRoot,
		EQUIPMENT_V3_MANIFEST_PATH
	);
	const receipt = EquipmentCheckpointReceiptV3Schema.parse({
		schemaVersion: 'equipment-owner-checkpoint-receipt-v3',
		checkpointId: definition.id,
		createdAt: input.createdAt,
		decidedBy: input.decidedBy,
		manifestCanonicalSha256: canonicalSha256(manifestValue),
		galleryPath: input.galleryPath,
		decisions,
		summary
	});
	await exclusiveCreateEquipmentRepositoryFile(
		input.workspaceRoot,
		definition.path,
		serializeJson(receipt)
	);
	return { path: definition.path, receipt };
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
async function runCli(): Promise<void> {
	const decisions = JSON.parse(await readFile(option('--decisions'), 'utf8')) as DecisionInput[];
	const output = await recordEquipmentCheckpointV3({
		workspaceRoot: process.cwd(),
		checkpoint: option('--checkpoint') as keyof typeof CHECKPOINTS,
		decisions,
		decidedBy: option('--decided-by'),
		createdAt: option('--created-at'),
		galleryPath: option('--gallery')
	});
	process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (isCli) void runCli();

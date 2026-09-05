import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	EquipmentArmourPieceCandidateSelectionManifestV3Schema,
	EquipmentArmourPieceRevisionPlanV3Schema,
	EquipmentCandidateRevisionAssignmentV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import { materializeEquipmentArmourPieceRevisionsV3 } from './materialize-equipment-armour-piece-revisions-v3.js';
import {
	EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH,
	materializeEquipmentArmourPieceSelectionsV3,
	resolveEquipmentArmourPieceCandidatesV3
} from './materialize-equipment-armour-piece-selections-v3.js';
import { resolveEquipmentCheckpointImagePathsV3 } from './record-equipment-rank-first-checkpoint-v3.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

function sha256(contents: string | Uint8Array): string {
	return createHash('sha256').update(contents).digest('hex');
}

async function writeRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string,
	contents: string | Uint8Array
): Promise<void> {
	const absolute = path.join(workspaceRoot, ...repositoryPath.split('/'));
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, contents);
}

async function fixture(hasBaseCandidate: boolean) {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-equipment-piece-revision-'));
	temporaryDirectories.push(workspaceRoot);
	const targets = buildEquipmentCandidateTargetsV3();
	const target = targets.find(({ artifactRole }) => artifactRole === 'armour-piece')!;
	const sourceTarget = targets.find(({ targetId }) => targetId === target.dependsOnTargetId)!;
	const referenceBytes = {
		classDirection: Buffer.from('accepted class direction'),
		finishReference: Buffer.from('accepted finish reference'),
		consistencySource: Buffer.from('accepted full set')
	};
	const referencePaths = {
		classDirection: `${EQUIPMENT_V3_ROOT}/test-fixtures/class-direction.png`,
		finishReference: `${EQUIPMENT_V3_ROOT}/test-fixtures/finish.png`,
		consistencySource: sourceTarget.output.candidatePath
	};
	for (const key of Object.keys(referenceBytes) as (keyof typeof referenceBytes)[]) {
		await writeRepositoryFile(workspaceRoot, referencePaths[key], referenceBytes[key]);
	}
	const basePrompt = 'Render the isolated Armour piece from the accepted full set.';
	const baseAssignment = {
		schemaVersion: 'equipment-rank-first-assignment-v3' as const,
		assignmentId: `assignment-${target.targetId}`,
		targetId: target.targetId,
		immutable: true as const,
		classDirection: {
			path: referencePaths.classDirection,
			sha256: sha256(referenceBytes.classDirection),
			purpose: 'accepted class direction'
		},
		materialBrief: { path: target.materialBriefPath, canonicalSha256: '0'.repeat(64) },
		finishReference: {
			path: referencePaths.finishReference,
			sha256: sha256(referenceBytes.finishReference),
			purpose: 'accepted finish'
		},
		consistencySource: {
			path: referencePaths.consistencySource,
			sha256: sha256(referenceBytes.consistencySource),
			purpose: 'accepted full-set source'
		},
		prompt: basePrompt,
		promptSha256: sha256(basePrompt),
		permittedOutputs: {
			candidatePath: target.output.candidatePath,
			resultPath: target.output.provenanceResultPath
		},
		forbiddenActions: ['no overwrite']
	};
	await writeRepositoryFile(
		workspaceRoot,
		target.output.assignmentPath,
		serializeJson(baseAssignment)
	);
	const baseCandidateBytes = Buffer.from('first-pass piece candidate');
	if (hasBaseCandidate) {
		await writeRepositoryFile(workspaceRoot, target.output.candidatePath, baseCandidateBytes);
	}
	const reviewPath = `${EQUIPMENT_V3_ROOT}/reviews/test-piece-audit.json`;
	await writeRepositoryFile(workspaceRoot, reviewPath, '{}\n');
	const planPath = `${EQUIPMENT_V3_ROOT}/reviews/revision-plans/armour-pieces-v1.json`;
	const plan = EquipmentArmourPieceRevisionPlanV3Schema.parse({
		schemaVersion: 'equipment-armour-piece-revision-plan-v3',
		revisionPlanId: 'equipment-v3-armour-piece-revisions-v1',
		createdAt: '2026-09-03T18:00:00.000Z',
		createdBy: 'test-reviewer',
		reviewBasis: [reviewPath],
		revisions: [
			{
				targetId: target.targetId,
				attempt: 2,
				classification: 'class-rule-violation',
				correction: 'Remove the adjacent slot and preserve only the declared piece boundary.'
			}
		]
	});
	await writeRepositoryFile(workspaceRoot, planPath, serializeJson(plan));
	return {
		workspaceRoot,
		target,
		baseAssignment,
		baseCandidateBytes,
		plan,
		planPath,
		referencePaths
	};
}

describe('Equipment v3 Armour-piece revisions and selections', () => {
	it('materializes an attempt-scoped piece revision from the base candidate and full set', async () => {
		const input = await fixture(true);
		const output = await materializeEquipmentArmourPieceRevisionsV3(input);
		expect(output.assignments).toHaveLength(1);
		expect(output.assignments[0]).toMatchObject({
			targetId: input.target.targetId,
			attempt: 2,
			revisionSource: 'base-candidate'
		});
		const assignmentPath = output.assignments[0]!.assignmentPath;
		const assignment = EquipmentCandidateRevisionAssignmentV3Schema.parse(
			JSON.parse(
				await readFile(path.join(input.workspaceRoot, ...assignmentPath.split('/')), 'utf8')
			)
		);
		expect(assignment.revisionSource).toMatchObject({
			path: input.target.output.candidatePath,
			sha256: sha256(input.baseCandidateBytes)
		});
		expect(assignment.references.map(({ path: referencePath }) => referencePath)).toEqual([
			input.referencePaths.consistencySource,
			input.target.output.candidatePath,
			input.referencePaths.classDirection,
			input.referencePaths.finishReference
		]);
		expect(assignment.prompt).toContain(input.plan.revisions[0]!.correction);
		await expect(materializeEquipmentArmourPieceRevisionsV3(input)).rejects.toThrow(
			/Armour-piece revision path collision/u
		);
	});

	it('uses the accepted full set as the revision source when the base candidate is absent', async () => {
		const input = await fixture(false);
		const output = await materializeEquipmentArmourPieceRevisionsV3(input);
		expect(output.assignments[0]!.revisionSource).toBe('full-set');
		const assignment = EquipmentCandidateRevisionAssignmentV3Schema.parse(
			JSON.parse(
				await readFile(
					path.join(input.workspaceRoot, ...output.assignments[0]!.assignmentPath.split('/')),
					'utf8'
				)
			)
		);
		expect(assignment.revisionSource.path).toBe(input.referencePaths.consistencySource);
		expect(assignment.references.map(({ path: referencePath }) => referencePath)).toEqual([
			input.referencePaths.consistencySource,
			input.referencePaths.classDirection,
			input.referencePaths.finishReference
		]);
		expect(assignment.prompt).toContain('No first-pass piece candidate exists');
	});

	it('hash-binds a successful selected revision and resolves selected and base piece paths', async () => {
		const input = await fixture(true);
		const revisions = await materializeEquipmentArmourPieceRevisionsV3(input);
		const packet = revisions.assignments[0]!;
		const assignment = EquipmentCandidateRevisionAssignmentV3Schema.parse(
			JSON.parse(
				await readFile(path.join(input.workspaceRoot, ...packet.assignmentPath.split('/')), 'utf8')
			)
		);
		const revisedCandidate = Buffer.from('successful revised piece candidate');
		await writeRepositoryFile(input.workspaceRoot, packet.candidatePath, revisedCandidate);
		await writeRepositoryFile(
			input.workspaceRoot,
			packet.resultPath,
			serializeJson({
				schemaVersion: 'equipment-rank-first-provenance-result-v3',
				resultId: `result-${input.target.targetId}-attempt-2`,
				targetId: input.target.targetId,
				assignmentId: assignment.assignmentId,
				attempt: 2,
				status: 'succeeded',
				startedAt: '2026-09-03T18:01:00.000Z',
				completedAt: '2026-09-03T18:02:00.000Z',
				provider: 'test-provider',
				model: 'test-model',
				promptSha256: assignment.promptSha256,
				references: assignment.references,
				source: {
					path: '/generated/revision.png',
					sha256: sha256(revisedCandidate),
					bytes: revisedCandidate.byteLength,
					width: 1024,
					height: 1024,
					mediaType: 'image/png'
				},
				persistenceOperation: 'exclusive-copy',
				output: {
					path: packet.candidatePath,
					sha256: sha256(revisedCandidate),
					bytes: revisedCandidate.byteLength,
					width: 1024,
					height: 1024,
					mediaType: 'image/png'
				},
				error: null
			})
		);
		await materializeEquipmentArmourPieceSelectionsV3(input);
		const manifest = EquipmentArmourPieceCandidateSelectionManifestV3Schema.parse(
			JSON.parse(
				await readFile(
					path.join(input.workspaceRoot, ...EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH.split('/')),
					'utf8'
				)
			)
		);
		expect(manifest.selections[0]).toMatchObject({
			targetId: input.target.targetId,
			selectedAttempt: 2,
			candidatePath: packet.candidatePath,
			candidateSha256: sha256(revisedCandidate)
		});
		const resolved = await resolveEquipmentArmourPieceCandidatesV3(input.workspaceRoot);
		expect(resolved.candidatePaths.get(input.target.targetId)).toBe(packet.candidatePath);
		expect(
			(await resolveEquipmentCheckpointImagePathsV3(input.workspaceRoot, '3')).get(
				input.target.targetId
			)
		).toBe(packet.candidatePath);
		const untouchedPiece = buildEquipmentCandidateTargetsV3().find(
			(target) =>
				target.artifactRole === 'armour-piece' && target.targetId !== input.target.targetId
		)!;
		expect(resolved.candidatePaths.get(untouchedPiece.targetId)).toBe(
			untouchedPiece.output.candidatePath
		);
		await expect(materializeEquipmentArmourPieceSelectionsV3(input)).rejects.toThrow(
			/selection manifest collision/u
		);
		await writeRepositoryFile(input.workspaceRoot, packet.candidatePath, 'drift');
		await expect(resolveEquipmentArmourPieceCandidatesV3(input.workspaceRoot)).rejects.toThrow(
			/selection evidence hash mismatch/u
		);
	});

	it('materializes a collision-preflighted 28-correction Armour-piece plan', async () => {
		const workspaceRoot = await mkdtemp(
			path.join(tmpdir(), 'summonlab-equipment-piece-revision-wave-')
		);
		temporaryDirectories.push(workspaceRoot);
		const targets = buildEquipmentCandidateTargetsV3();
		const targetsById = new Map(targets.map((target) => [target.targetId, target]));
		const pieces = targets
			.filter(({ artifactRole }) => artifactRole === 'armour-piece')
			.slice(0, 28);
		const classPath = `${EQUIPMENT_V3_ROOT}/test-fixtures/wave-class.png`;
		const finishPath = `${EQUIPMENT_V3_ROOT}/test-fixtures/wave-finish.png`;
		const classBytes = Buffer.from('wave class direction');
		const finishBytes = Buffer.from('wave finish direction');
		await writeRepositoryFile(workspaceRoot, classPath, classBytes);
		await writeRepositoryFile(workspaceRoot, finishPath, finishBytes);
		const writtenFullSets = new Set<string>();
		for (const target of pieces) {
			const source = targetsById.get(target.dependsOnTargetId!)!;
			const sourceBytes = Buffer.from(`accepted full set ${source.targetId}`);
			if (!writtenFullSets.has(source.output.candidatePath)) {
				await writeRepositoryFile(workspaceRoot, source.output.candidatePath, sourceBytes);
				writtenFullSets.add(source.output.candidatePath);
			}
			const prompt = `Base piece prompt for ${target.targetId}`;
			await writeRepositoryFile(
				workspaceRoot,
				target.output.assignmentPath,
				serializeJson({
					schemaVersion: 'equipment-rank-first-assignment-v3',
					assignmentId: `assignment-${target.targetId}`,
					targetId: target.targetId,
					immutable: true,
					classDirection: {
						path: classPath,
						sha256: sha256(classBytes),
						purpose: 'accepted class direction'
					},
					materialBrief: { path: target.materialBriefPath, canonicalSha256: '0'.repeat(64) },
					finishReference: {
						path: finishPath,
						sha256: sha256(finishBytes),
						purpose: 'accepted finish'
					},
					consistencySource: {
						path: source.output.candidatePath,
						sha256: sha256(sourceBytes),
						purpose: 'accepted full-set source'
					},
					prompt,
					promptSha256: sha256(prompt),
					permittedOutputs: {
						candidatePath: target.output.candidatePath,
						resultPath: target.output.provenanceResultPath
					},
					forbiddenActions: ['no overwrite']
				})
			);
		}
		const reviewPath = `${EQUIPMENT_V3_ROOT}/reviews/test-piece-wave-audit.json`;
		await writeRepositoryFile(workspaceRoot, reviewPath, '{}\n');
		const planPath = `${EQUIPMENT_V3_ROOT}/reviews/revision-plans/armour-pieces-wave-v1.json`;
		await writeRepositoryFile(
			workspaceRoot,
			planPath,
			serializeJson({
				schemaVersion: 'equipment-armour-piece-revision-plan-v3',
				revisionPlanId: 'equipment-v3-armour-piece-revisions-v2',
				createdAt: '2026-09-03T18:00:00.000Z',
				createdBy: 'test-reviewer',
				reviewBasis: [reviewPath],
				revisions: pieces.map((target) => ({
					targetId: target.targetId,
					attempt: 2,
					classification: 'class-rule-violation',
					correction: `Correct the isolated ${target.slot} boundary for ${target.setId}.`
				}))
			})
		);
		const output = await materializeEquipmentArmourPieceRevisionsV3({
			workspaceRoot,
			planPath
		});
		expect(output.assignmentCount).toBe(28);
		expect(output.assignments.every(({ revisionSource }) => revisionSource === 'full-set')).toBe(
			true
		);
		for (const assignment of output.assignments) {
			await expect(
				readFile(path.join(workspaceRoot, ...assignment.assignmentPath.split('/')), 'utf8')
			).resolves.toContain('equipment-rank-first-revision-assignment-v3');
			await expect(
				readFile(path.join(workspaceRoot, ...assignment.promptPath.split('/')), 'utf8')
			).resolves.toContain('REVISION PASS 2');
		}
	});

	it('rejects root targets without writing a revision packet', async () => {
		const input = await fixture(false);
		const rootTarget = buildEquipmentCandidateTargetsV3().find(
			({ artifactRole }) => artifactRole === 'item'
		)!;
		const invalidPlan = {
			...input.plan,
			revisions: [{ ...input.plan.revisions[0]!, targetId: rootTarget.targetId }]
		};
		await writeRepositoryFile(input.workspaceRoot, input.planPath, serializeJson(invalidPlan));
		await expect(materializeEquipmentArmourPieceRevisionsV3(input)).rejects.toThrow(
			/not an Armour piece/u
		);
	});
});

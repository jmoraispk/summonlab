import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EquipmentProvenanceResultV3Schema } from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import { materializeEquipmentRankFirstFailuresV3 } from './materialize-equipment-rank-first-failures-v3.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

async function writeFixtureFile(
	workspaceRoot: string,
	filePath: string,
	contents: string | Uint8Array
) {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, contents);
}

async function fixture() {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-failure-result-'));
	temporaryDirectories.push(workspaceRoot);
	const target = buildEquipmentCandidateTargetsV3().find(
		({ artifactRole }) => artifactRole === 'armour-piece'
	)!;
	const classReferencePath = `${EQUIPMENT_V3_ROOT}/fixtures/class.png`;
	const finishReferencePath = `${EQUIPMENT_V3_ROOT}/fixtures/finish.png`;
	const fullSetReferencePath = `${EQUIPMENT_V3_ROOT}/fixtures/full-set.png`;
	const references = [
		[classReferencePath, Buffer.from('class')],
		[finishReferencePath, Buffer.from('finish')],
		[fullSetReferencePath, Buffer.from('full-set')]
	] as const;
	for (const [repositoryPath, bytes] of references) {
		await writeFixtureFile(workspaceRoot, path.join(workspaceRoot, repositoryPath), bytes);
	}
	const prompt = 'Render one bounded Armour piece.';
	const assignment = {
		schemaVersion: 'equipment-rank-first-assignment-v3',
		assignmentId: `assignment-${target.targetId}`,
		targetId: target.targetId,
		immutable: true,
		classDirection: {
			path: classReferencePath,
			sha256: sha256(references[0][1]),
			purpose: 'class'
		},
		materialBrief: { path: target.materialBriefPath, canonicalSha256: '0'.repeat(64) },
		finishReference: {
			path: finishReferencePath,
			sha256: sha256(references[1][1]),
			purpose: 'finish'
		},
		consistencySource: {
			path: fullSetReferencePath,
			sha256: sha256(references[2][1]),
			purpose: 'full set'
		},
		prompt,
		promptSha256: sha256(prompt),
		permittedOutputs: {
			candidatePath: target.output.candidatePath,
			resultPath: target.output.provenanceResultPath
		},
		forbiddenActions: ['no overwrite']
	};
	await writeFixtureFile(
		workspaceRoot,
		path.join(workspaceRoot, target.output.assignmentPath),
		serializeJson(assignment)
	);
	const sourcePath = path.join(workspaceRoot, 'provider-source.png');
	const sourceBytes = Buffer.from('rejected provider source');
	await writeFixtureFile(workspaceRoot, sourcePath, sourceBytes);
	const auditPath = `${EQUIPMENT_V3_ROOT}/reviews/withheld-calls.json`;
	await writeFixtureFile(
		workspaceRoot,
		path.join(workspaceRoot, auditPath),
		serializeJson({
			schemaVersion: 'equipment-armour-piece-withheld-call-audit-v1',
			auditId: 'equipment-v3-armour-piece-withheld-calls-v1',
			auditedAt: '2026-09-03T18:00:00Z',
			provider: 'test-provider',
			model: 'test-model',
			callCount: 1,
			policy: 'Withhold visual-contract failures.',
			calls: [
				{
					targetId: target.targetId,
					attempt: 1,
					sourcePath,
					sourceSha256: sha256(sourceBytes),
					rejection: 'Included another slot.'
				}
			]
		})
	);
	return { workspaceRoot, target, auditPath };
}

describe('Equipment v3 failed-attempt evidence', () => {
	it('materializes a collision-safe failed terminal result without a candidate', async () => {
		const input = await fixture();
		const output = await materializeEquipmentRankFirstFailuresV3(input);
		expect(output).toMatchObject({
			callCount: 1,
			attemptGroupCount: 1,
			createdFailedResults: 1,
			verifiedSucceededResults: 0,
			verifiedFailedResults: 0
		});
		const result = EquipmentProvenanceResultV3Schema.parse(
			JSON.parse(
				await readFile(
					path.join(input.workspaceRoot, input.target.output.provenanceResultPath),
					'utf8'
				)
			)
		);
		expect(result).toMatchObject({
			targetId: input.target.targetId,
			attempt: 1,
			status: 'failed',
			source: null,
			output: null,
			error: { kind: 'visual-contract-rejection' }
		});
	});

	it('verifies an existing failed result instead of overwriting it', async () => {
		const input = await fixture();
		await materializeEquipmentRankFirstFailuresV3(input);
		const output = await materializeEquipmentRankFirstFailuresV3(input);
		expect(output).toMatchObject({
			createdFailedResults: 0,
			verifiedFailedResults: 1
		});
	});
});

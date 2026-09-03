import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { EquipmentDirectionResultV3Schema } from './equipment-rank-first-contract-v3.js';
import {
	buildEquipmentDirectionPacketsV3,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import { persistEquipmentRankFirstOutputV3 } from './persist-equipment-rank-first-output-v3.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

async function writeRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string,
	contents: string | Uint8Array
): Promise<void> {
	const absolute = path.join(workspaceRoot, ...repositoryPath.split('/'));
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, contents);
}

describe('Equipment rank-first v3 output persistence', () => {
	it('hash-validates a direction packet and exclusively persists its normalized PNG plus provenance', async () => {
		const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-equipment-v3-persist-'));
		temporaryDirectories.push(workspaceRoot);
		const packet = buildEquipmentDirectionPacketsV3()[0]!;
		await writeRepositoryFile(
			workspaceRoot,
			packet.targetPath,
			serializeJson({
				schemaVersion: 'equipment-class-direction-target-v3',
				directionId: packet.directionId,
				classId: packet.classId,
				width: 1536,
				height: 1024,
				mediaType: 'image/png',
				orderedRanks: ['F', 'E', 'D', 'C', 'B', 'A', 'S'],
				candidatePath: packet.candidatePath,
				resultPath: packet.resultPath
			})
		);
		await writeRepositoryFile(
			workspaceRoot,
			packet.assignmentPath,
			serializeJson({
				schemaVersion: 'equipment-class-direction-assignment-v3',
				assignmentId: `assignment-${packet.directionId}`,
				directionId: packet.directionId,
				immutable: true,
				prompt: packet.prompt,
				promptSha256: packet.promptSha256,
				references: packet.references,
				permittedOutputs: {
					candidatePath: packet.candidatePath,
					resultPath: packet.resultPath
				},
				selfPromotionForbidden: true
			})
		);
		for (const reference of packet.references) {
			const destination = path.join(workspaceRoot, ...reference.path.split('/'));
			await mkdir(path.dirname(destination), { recursive: true });
			await cp(path.join(process.cwd(), ...reference.path.split('/')), destination);
		}
		const sourcePath = path.join(workspaceRoot, 'generated.webp');
		await writeFile(
			sourcePath,
			await sharp({
				create: {
					width: 768,
					height: 512,
					channels: 4,
					background: '#283548ff'
				}
			})
				.webp()
				.toBuffer()
		);
		const options = {
			workspaceRoot,
			kind: 'direction' as const,
			sourcePath,
			targetPath: packet.targetPath,
			assignmentPath: packet.assignmentPath,
			attempt: 1,
			startedAt: '2026-09-02T20:00:00.000Z',
			completedAt: '2026-09-02T20:01:00.000Z',
			provider: 'test-provider',
			model: 'test-model'
		};
		const receipt = await persistEquipmentRankFirstOutputV3(options);
		expect(receipt.operation).toBe('exclusive-normalize');
		const result = EquipmentDirectionResultV3Schema.parse(
			JSON.parse(await readFile(path.join(workspaceRoot, ...packet.resultPath.split('/')), 'utf8'))
		);
		expect(result).toMatchObject({
			directionId: packet.directionId,
			status: 'succeeded',
			output: { width: 1536, height: 1024, mediaType: 'image/png' }
		});
		await expect(persistEquipmentRankFirstOutputV3(options)).rejects.toThrow(/Collision/u);
	});
});

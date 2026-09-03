import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
	buildEquipmentV2ProfileAcceptance
} from './equipment-image-profile-acceptance-v2.js';
import { buildEquipmentVisualProfileV2 } from './equipment-image-profile-v2.js';
import { buildRootEquipmentPacketsV2 } from './equipment-image-packets-v2.js';
import {
	DEFAULT_EQUIPMENT_V2_RUN_ID,
	activateEquipmentV2Run
} from './equipment-image-run-activation-v2.js';
import {
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';
import {
	persistEquipmentImageProductionOutputV2,
	type PersistEquipmentImageProductionOutputV2Options
} from './persist-equipment-image-production-output-v2.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

function jsonBytes(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

async function writeRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string,
	contents: string | Uint8Array
): Promise<void> {
	const absolutePath = path.join(workspaceRoot, ...repositoryPath.split('/'));
	await mkdir(path.dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, contents);
}

async function fixture() {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-equipment-v2-persist-'));
	temporaryDirectories.push(workspaceRoot);
	const manifest = buildEquipmentMaterialProductionManifestV2();
	const allocation = buildEquipmentMaterialAllocationPlanV2();
	const profile = buildEquipmentVisualProfileV2();
	const acceptance = buildEquipmentV2ProfileAcceptance({
		profile,
		acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
	});
	const packets = buildRootEquipmentPacketsV2({ manifest, allocation, profile, acceptance });
	const packet = packets[0]!;
	await Promise.all([
		writeRepositoryFile(
			workspaceRoot,
			'assets/equipment/experiments/material-equipment-v2/manifest.json',
			jsonBytes(manifest)
		),
		writeRepositoryFile(
			workspaceRoot,
			'assets/equipment/experiments/material-equipment-v2/allocation-plan.json',
			jsonBytes(allocation)
		),
		writeRepositoryFile(
			workspaceRoot,
			'assets/equipment/experiments/material-equipment-v2/visual-profile/profile.json',
			jsonBytes(profile)
		),
		writeRepositoryFile(
			workspaceRoot,
			'assets/equipment/experiments/material-equipment-v2/visual-profile/acceptance.json',
			jsonBytes(acceptance)
		),
		...packets.flatMap((rootPacket) => [
			writeRepositoryFile(workspaceRoot, rootPacket.targetPath, jsonBytes(rootPacket.target)),
			writeRepositoryFile(
				workspaceRoot,
				rootPacket.assignmentPath,
				jsonBytes(rootPacket.assignment)
			)
		]),
		...profile.references.map(async ({ path: repositoryPath }) => {
			const destination = path.join(workspaceRoot, ...repositoryPath.split('/'));
			await mkdir(path.dirname(destination), { recursive: true });
			await cp(path.join(process.cwd(), ...repositoryPath.split('/')), destination);
		})
	]);
	await activateEquipmentV2Run({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
		createdAt: '2026-09-02T21:00:00.000Z',
		activatedAt: '2026-09-02T21:01:00.000Z',
		activatedBy: 'equipment-v2-persistence-test'
	});
	return { workspaceRoot, packet };
}

async function sourceImage(
	workspaceRoot: string,
	name: string,
	input: { readonly width: number; readonly height: number; readonly format: 'png' | 'webp' }
): Promise<string> {
	const sourcePath = path.join(workspaceRoot, name);
	let pipeline = sharp({
		create: {
			width: input.width,
			height: input.height,
			channels: 4,
			background: '#26313fff'
		}
	});
	pipeline = input.format === 'png' ? pipeline.png() : pipeline.webp();
	await writeFile(sourcePath, await pipeline.toBuffer());
	return sourcePath;
}

function options(
	workspaceRoot: string,
	packet: Awaited<ReturnType<typeof fixture>>['packet'],
	sourcePath: string,
	overrides: Partial<PersistEquipmentImageProductionOutputV2Options> = {}
): PersistEquipmentImageProductionOutputV2Options {
	return {
		workspaceRoot,
		sourcePath,
		targetPath: packet.targetPath,
		assignmentPath: packet.assignmentPath,
		destinationPath: packet.target.output.candidatePath,
		...overrides
	};
}

describe('Equipment v2 candidate persistence', () => {
	it('validates the exact packet and exclusive-creates an exact PNG candidate', async () => {
		const { workspaceRoot, packet } = await fixture();
		const sourcePath = await sourceImage(workspaceRoot, 'source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});
		const receipt = await persistEquipmentImageProductionOutputV2(
			options(workspaceRoot, packet, sourcePath)
		);
		expect(receipt).toMatchObject({
			schemaVersion: 'equipment-candidate-persistence-receipt-v2',
			targetId: packet.target.targetId,
			assignmentId: packet.assignment.assignmentId,
			operation: 'exclusive-copy',
			retained: {
				path: packet.target.output.candidatePath,
				width: 1024,
				height: 1024,
				mediaType: 'image/png'
			}
		});
		expect(receipt.retained.bytes).toBeGreaterThan(0);
		expect(receipt.retained.sha256).toMatch(/^[a-f0-9]{64}$/u);
		expect(
			await readFile(path.join(workspaceRoot, ...packet.target.output.candidatePath.split('/')))
		).toEqual(await readFile(sourcePath));
		await expect(
			persistEquipmentImageProductionOutputV2(options(workspaceRoot, packet, sourcePath))
		).rejects.toThrow(/already exists|collision/iu);
	});

	it('normalizes a same-aspect WebP to the exact target PNG canvas', async () => {
		const { workspaceRoot, packet } = await fixture();
		const sourcePath = await sourceImage(workspaceRoot, 'source.webp', {
			width: 512,
			height: 512,
			format: 'webp'
		});
		const receipt = await persistEquipmentImageProductionOutputV2(
			options(workspaceRoot, packet, sourcePath)
		);
		expect(receipt.operation).toBe('exclusive-resize-near-match');
		expect(receipt.source).toMatchObject({
			width: 512,
			height: 512,
			mediaType: 'image/webp'
		});
		expect(
			await sharp(
				path.join(workspaceRoot, ...packet.target.output.candidatePath.split('/'))
			).metadata()
		).toMatchObject({ format: 'png', width: 1024, height: 1024 });
	});

	it('rejects any destination or packet path outside the exact v2 reservation', async () => {
		const { workspaceRoot, packet } = await fixture();
		const sourcePath = await sourceImage(workspaceRoot, 'source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});
		await expect(
			persistEquipmentImageProductionOutputV2(
				options(workspaceRoot, packet, sourcePath, {
					destinationPath:
						'assets/equipment/experiments/material-equipment-v1/candidates/f/copper/sword-v1.png'
				})
			)
		).rejects.toThrow(/exactly match/u);
		await expect(
			persistEquipmentImageProductionOutputV2(
				options(workspaceRoot, packet, sourcePath, {
					targetPath:
						'assets/equipment/experiments/material-equipment-v2/targets/f/bronze/dagger-v2.json'
				})
			)
		).rejects.toThrow();
		await expect(
			readFile(path.join(workspaceRoot, ...packet.target.output.candidatePath.split('/')))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rejects an aspect mismatch without creating the candidate', async () => {
		const { workspaceRoot, packet } = await fixture();
		const sourcePath = await sourceImage(workspaceRoot, 'source.png', {
			width: 900,
			height: 1024,
			format: 'png'
		});
		await expect(
			persistEquipmentImageProductionOutputV2(options(workspaceRoot, packet, sourcePath))
		).rejects.toThrow(/aspect ratio/u);
		await expect(
			readFile(path.join(workspaceRoot, ...packet.target.output.candidatePath.split('/')))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});
});

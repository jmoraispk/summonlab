import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
	buildEquipmentV2ProfileAcceptance
} from './equipment-image-profile-acceptance-v2.js';
import { buildEquipmentVisualProfileV2 } from './equipment-image-profile-v2.js';
import {
	buildRootEquipmentPacketsV2,
	materializeRootEquipmentPacketsV2
} from './equipment-image-packets-v2.js';
import {
	EQUIPMENT_V2_PRODUCTION_ROOT,
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

function fixture() {
	const manifest = buildEquipmentMaterialProductionManifestV2();
	const allocation = buildEquipmentMaterialAllocationPlanV2();
	const profile = buildEquipmentVisualProfileV2();
	const acceptance = buildEquipmentV2ProfileAcceptance({
		profile,
		acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
	});
	return { manifest, allocation, profile, acceptance };
}

async function countJsonFiles(directory: string): Promise<number> {
	const entries = await readdir(directory, { withFileTypes: true });
	const counts = await Promise.all(
		entries.map((entry) =>
			entry.isDirectory()
				? countJsonFiles(path.join(directory, entry.name))
				: Promise.resolve(entry.name.endsWith('.json') ? 1 : 0)
		)
	);
	return counts.reduce((total, count) => total + count, 0);
}

describe('Equipment v2 root packet materialization', () => {
	it('exclusive-creates exactly 77 deterministic target and assignment pairs without images', async () => {
		const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-v2-packets-'));
		temporaryDirectories.push(workspaceRoot);
		const sources = fixture();
		const packets = buildRootEquipmentPacketsV2(sources);

		await expect(materializeRootEquipmentPacketsV2({ workspaceRoot, ...sources })).resolves.toEqual(
			{
				mode: 'write',
				targetCount: 77,
				assignmentCount: 77,
				writesPerformed: 154
			}
		);
		expect(
			await countJsonFiles(path.join(workspaceRoot, EQUIPMENT_V2_PRODUCTION_ROOT, 'targets'))
		).toBe(77);
		expect(
			await countJsonFiles(path.join(workspaceRoot, EQUIPMENT_V2_PRODUCTION_ROOT, 'assignments'))
		).toBe(77);

		const first = packets[0]!;
		expect(await readFile(path.join(workspaceRoot, first.targetPath), 'utf8')).toBe(
			`${JSON.stringify(first.target, null, '\t')}\n`
		);
		await expect(
			stat(path.join(workspaceRoot, first.target.output.candidatePath))
		).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			stat(path.join(workspaceRoot, first.target.output.provenanceResultPath))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('check mode accepts exact packets without rewriting and rejects stale bytes', async () => {
		const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-v2-packet-check-'));
		temporaryDirectories.push(workspaceRoot);
		const sources = fixture();
		const first = buildRootEquipmentPacketsV2(sources)[0]!;
		await materializeRootEquipmentPacketsV2({ workspaceRoot, ...sources });
		const absolute = path.join(workspaceRoot, first.targetPath);
		const before = await stat(absolute);

		await expect(
			materializeRootEquipmentPacketsV2({ workspaceRoot, ...sources, check: true })
		).resolves.toEqual({
			mode: 'check',
			targetCount: 77,
			assignmentCount: 77,
			writesPerformed: 0
		});
		expect((await stat(absolute)).mtimeMs).toBe(before.mtimeMs);

		await writeFile(absolute, '{}\n', 'utf8');
		await expect(
			materializeRootEquipmentPacketsV2({ workspaceRoot, ...sources, check: true })
		).rejects.toThrow(`V2 root packet is missing or stale: ${first.targetPath}`);
	});

	it('preflights every destination and refuses a collision before writing any other packet', async () => {
		const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-v2-packet-collision-'));
		temporaryDirectories.push(workspaceRoot);
		const sources = fixture();
		const packets = buildRootEquipmentPacketsV2(sources);
		const collision = packets.at(-1)!;
		const collisionAbsolute = path.join(workspaceRoot, collision.assignmentPath);
		await mkdir(path.dirname(collisionAbsolute), { recursive: true });
		await writeFile(collisionAbsolute, 'preexisting\n', 'utf8');

		await expect(materializeRootEquipmentPacketsV2({ workspaceRoot, ...sources })).rejects.toThrow(
			`V2 root packet collision: ${collision.assignmentPath}`
		);
		expect(await readFile(collisionAbsolute, 'utf8')).toBe('preexisting\n');
		await expect(stat(path.join(workspaceRoot, packets[0]!.targetPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});
});

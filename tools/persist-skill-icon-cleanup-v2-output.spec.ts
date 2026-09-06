import { copyFile, link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
	buildCleanupRevisionV2Packets,
	cleanupRevisionV2JsonBytes
} from './skill-icon-quality-cleanup-v2-lib.js';
import { persistCleanupRevisionV2 } from './persist-skill-icon-cleanup-v2-output.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const temporaryRoots: string[] = [];

afterAll(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

async function seedFile(root: string, repositoryPath: string): Promise<void> {
	const source = path.join(workspaceRoot, repositoryPath);
	const destination = path.join(root, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await link(source, destination).catch(async (error: NodeJS.ErrnoException) => {
		if (error.code !== 'EXDEV') throw error;
		await copyFile(source, destination);
	});
}

async function seedDeterministicPacket() {
	const root = await mkdtemp(path.join(tmpdir(), 'skill-icon-cleanup-v2-persist-'));
	temporaryRoots.push(root);
	const packet = (await buildCleanupRevisionV2Packets(workspaceRoot)).find(
		({ packet: candidate }) => candidate.targetId === 'martial:blade:blade-dance'
	);
	if (!packet) throw new Error('Expected the Blade Dance v2 packet.');
	for (const repositoryPath of [
		packet.packet.predecessor.packet.path,
		packet.packet.predecessor.result.path,
		packet.packet.predecessor.providerSource.path,
		packet.packet.predecessor.revisedInterior.path,
		packet.packet.predecessor.composite.path,
		...Object.values(packet.packet.compositionAuthority).map((binding) => binding.path),
		...packet.packet.references.map((reference) => reference.path)
	]) {
		await seedFile(root, repositoryPath);
	}
	const packetPath = path.join(root, packet.path);
	await mkdir(path.dirname(packetPath), { recursive: true });
	await writeFile(packetPath, cleanupRevisionV2JsonBytes(packet.packet));
	return { root, packet };
}

describe('cleanup semantic-revision v2 persistence', () => {
	it('publishes the deterministic recovery with honest zero-call timing and cannot publish it twice', async () => {
		const fixture = await seedDeterministicPacket();
		const result = await persistCleanupRevisionV2({
			root: fixture.root,
			packetPath: fixture.packet.path,
			fullSizeOutcome: 'pass',
			fullSizeObservation:
				'The complete sword and action remain inside the aperture after the v2 inset.',
			display384Outcome: 'pass',
			display384Observation:
				'The sword action remains readable without the named arrow glyph at 384 pixels.'
		});

		expect(result).toMatchObject({
			schemaVersion: 'skill-icon-quality-cleanup-revision-result-v2',
			revision: 2,
			status: 'candidate',
			targetId: 'martial:blade:blade-dance',
			execution: {
				generation: { attemptCount: 0, callIdentifiers: [] },
				normalizationTransactionCount: 1,
				invocation: {
					tool: 'tools/persist-skill-icon-cleanup-v2-output.ts',
					command: 'persist:skill-icon-cleanup-v2-output'
				}
			}
		});
		expect(result.execution.phases.map((phase) => phase.name)).toEqual([
			'source-read',
			'normalization',
			'composition',
			'inspection',
			'publication'
		]);
		for (const phase of result.execution.phases) {
			expect(Date.parse(phase.finishedAt)).toBeGreaterThanOrEqual(Date.parse(phase.startedAt));
			expect(phase.durationMs).toBeGreaterThanOrEqual(0);
		}
		expect(result.writtenOutputPaths).toHaveLength(4);
		for (const repositoryPath of result.writtenOutputPaths) {
			expect((await readFile(path.join(fixture.root, repositoryPath))).byteLength).toBeGreaterThan(
				0
			);
		}
		expect(Date.parse(result.execution.finishedAt)).toBeGreaterThanOrEqual(
			Date.parse(result.execution.startedAt)
		);

		await expect(
			persistCleanupRevisionV2({
				root: fixture.root,
				packetPath: fixture.packet.path,
				fullSizeOutcome: 'pass',
				fullSizeObservation: 'A second write must not replace the first candidate.',
				display384Outcome: 'pass',
				display384Observation: 'A second write must not replace the first candidate.'
			})
		).rejects.toThrow(/already exists|replace|collision/i);
	}, 30_000);
});

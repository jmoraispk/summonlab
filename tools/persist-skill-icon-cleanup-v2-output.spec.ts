import { createHash } from 'node:crypto';
import { copyFile, link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
	authenticateCleanupRevisionReceipt,
	buildCleanupRevisionV2Packets,
	cleanupRevisionV2JsonBytes,
	computeCleanupRevisionTransactionContentHash
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
			'inspection'
		]);
		const auditPath =
			'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results/completion-audits/martial-blade-blade-dance-v2.json';
		const audit = JSON.parse(
			(await readFile(path.join(fixture.root, auditPath))).toString('utf8')
		) as {
			readonly corePublication: {
				readonly startedAt: string;
				readonly completedAt: string;
				readonly artifacts: { readonly result: { readonly path: string } };
			};
		};
		expect(Date.parse(audit.corePublication.completedAt)).toBeGreaterThanOrEqual(
			Date.parse(audit.corePublication.startedAt)
		);
		expect(audit.corePublication.artifacts.result.path).toBe(result.resultPath);
		await expect(
			authenticateCleanupRevisionReceipt({ root: fixture.root, packetPath: fixture.packet.path })
		).resolves.toMatchObject({ result: { transactionContentHash: result.transactionContentHash } });

		// A receipt and audit can be edited together in a temporary fixture, but
		// the finalizer still independently pins the tool identity and rejects it.
		const resultPath = path.join(fixture.root, result.resultPath);
		const tampered = JSON.parse((await readFile(resultPath)).toString('utf8')) as Record<
			string,
			any
		>;
		tampered.execution.invocation.nodeVersion = 'v0.0.0-tampered';
		tampered.transactionContentHash = computeCleanupRevisionTransactionContentHash({
			packetContentHash: tampered.revisionPacket.contentHash,
			predecessor: tampered.predecessor,
			sourceMode: tampered.sourceMode,
			transform: tampered.transform,
			providerSourceContentHash: tampered.providerSource.contentHash,
			revisedInteriorContentHash: tampered.revisedInterior.contentHash,
			compositionAuthority: tampered.compositionAuthority,
			compositeContentHash: tampered.composite.contentHash,
			display384ContentHash: tampered.display384.contentHash,
			inspection: tampered.inspection,
			execution: tampered.execution,
			output: fixture.packet.packet.output
		});
		const tamperedResultBytes = cleanupRevisionV2JsonBytes(tampered);
		await writeFile(resultPath, tamperedResultBytes);
		const tamperedAudit = JSON.parse(
			(await readFile(path.join(fixture.root, auditPath))).toString('utf8')
		) as Record<string, any>;
		const tamperedResultHash = createHash('sha256').update(tamperedResultBytes).digest('hex');
		tamperedAudit.result.contentHash = tamperedResultHash;
		tamperedAudit.corePublication.artifacts.result.contentHash = tamperedResultHash;
		await writeFile(path.join(fixture.root, auditPath), cleanupRevisionV2JsonBytes(tamperedAudit));
		await expect(
			authenticateCleanupRevisionReceipt({ root: fixture.root, packetPath: fixture.packet.path })
		).rejects.toThrow(/invocation provenance drift/i);
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

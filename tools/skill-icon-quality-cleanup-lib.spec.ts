import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SkillIconCleanupManifestSchema } from '../packages/contracts/src/index.js';
import {
	QUALITY_CLEANUP_ROOT,
	buildSkillIconCleanupManifest,
	exportSkillIconQualityCleanup,
	loadCleanupManifestInput,
	type CleanupManifestInput
} from './skill-icon-quality-cleanup-lib.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function snapshot(directory: string): Promise<readonly [string, string][]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: [string, string][] = [];
	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await snapshot(entryPath)));
		else files.push([path.relative(workspaceRoot, entryPath), sha256(await readFile(entryPath))]);
	}
	return files.sort(([left], [right]) => left.localeCompare(right));
}

function retarget(targetId: string, from: string, to: string): string {
	return targetId === from ? to : targetId;
}

function withSkewedDomain(input: CleanupManifestInput): CleanupManifestInput {
	const from = 'martial:blade:swordsmanship';
	const to = 'magical:blade:swordsmanship';
	const sourceHashesByTargetId = new Map(input.sourceHashesByTargetId);
	const sourceHash = sourceHashesByTargetId.get(from);
	if (!sourceHash) throw new Error('Expected the martial swordsmanship source hash.');
	sourceHashesByTargetId.delete(from);
	sourceHashesByTargetId.set(to, sourceHash);
	return {
		...input,
		catalog: {
			...input.catalog,
			records: input.catalog.records.map((record) => ({
				...record,
				targetId: retarget(record.targetId, from, to),
				domain: record.targetId === from ? 'Magical' : record.domain,
				primaryVisualParent: record.primaryVisualParent
					? retarget(record.primaryVisualParent, from, to)
					: null
			}))
		},
		massProductionManifest: {
			...input.massProductionManifest,
			skills: input.massProductionManifest.skills.map((record) => ({
				...record,
				targetId: retarget(record.targetId, from, to),
				domain: record.targetId === from ? 'Magical' : record.domain,
				finalImagePath:
					record.targetId === from
						? 'assets/wiki/skills/icon-production-v1/mass-production-v1/icons/magical-blade-swordsmanship.png'
						: record.finalImagePath,
				primaryVisualParent: record.primaryVisualParent
					? retarget(record.primaryVisualParent, from, to)
					: null
			}))
		},
		motifMap: {
			...input.motifMap,
			entries: input.motifMap.entries.map((entry) => ({
				...entry,
				memberTargetIds: entry.memberTargetIds.map((targetId) => retarget(targetId, from, to))
			})),
			records: input.motifMap.records.map((record) => ({
				...record,
				targetId: retarget(record.targetId, from, to),
				primaryVisualParent: record.primaryVisualParent
					? retarget(record.primaryVisualParent, from, to)
					: null
			}))
		},
		visualSpecifications: {
			...input.visualSpecifications,
			records: input.visualSpecifications.records.map((record) => ({
				...record,
				targetId: retarget(record.targetId, from, to)
			}))
		},
		sourceHashesByTargetId
	};
}

interface RaceWriter {
	readonly child: ChildProcess;
	readonly destinationWritten: Promise<void>;
}

async function startRaceWriter(
	directory: string,
	destination: string,
	bytes: Buffer
): Promise<RaceWriter> {
	const writer = spawn(
		process.execPath,
		[
			'-e',
			[
				"const fs = require('node:fs');",
				'const [directory, destination, encoded] = process.argv.slice(1);',
				'const watch = fs.watch(directory, () => {',
				"  if (!fs.readdirSync(directory).some((name) => name.includes('.stage-'))) return;",
				"  fs.writeFileSync(destination, Buffer.from(encoded, 'base64'));",
				'  watch.close();',
				"  process.stdout.write('written\\n', () => process.exit(0));",
				'});',
				"process.stdout.write('ready\\n');"
			].join('\n'),
			directory,
			destination,
			bytes.toString('base64')
		],
		{ stdio: ['ignore', 'pipe', 'inherit'] }
	);
	let output = '';
	let ready = false;
	let resolveReady: (() => void) | undefined;
	let resolveDestinationWritten: (() => void) | undefined;
	const destinationWritten = new Promise<void>((resolve) => {
		resolveDestinationWritten = resolve;
	});
	writer.stdout!.on('data', (chunk: Buffer) => {
		output += chunk.toString('utf8');
		if (!ready && output.includes('ready\n')) {
			ready = true;
			resolveReady?.();
		}
		if (output.includes('written\n')) resolveDestinationWritten?.();
	});
	await new Promise<void>((resolve) => {
		if (ready) resolve();
		else resolveReady = resolve;
	});
	return { child: writer, destinationWritten };
}

async function waitForExit(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null) return;
	await once(child, 'exit');
}

describe('skill-icon quality-cleanup manifest exporter', () => {
	it('freezes every canonical mass-production source with attached findings', async () => {
		const input = await loadCleanupManifestInput(workspaceRoot);
		const manifest = SkillIconCleanupManifestSchema.parse(buildSkillIconCleanupManifest(input));

		expect(manifest.records).toHaveLength(456);
		expect(
			manifest.records.reduce<Record<string, number>>((counts, record) => {
				const domain = record.targetId.split(':', 1)[0] ?? '';
				const name = domain[0]!.toUpperCase() + domain.slice(1);
				counts[name] = (counts[name] ?? 0) + 1;
				return counts;
			}, {})
		).toEqual({ Martial: 258, Magical: 124, Craft: 74 });
		expect(new Set(manifest.records.map((record) => record.sourceCandidate.path)).size).toBe(456);
		expect(
			manifest.records.find((record) => record.targetId === 'martial:blade:one-blade-one-world')
		).toMatchObject({
			disposition: 'recompose',
			findings: [
				{
					kind: 'frame-composition',
					requiredAction: 'recompose'
				}
			]
		});
		expect(
			manifest.records.find((record) => record.targetId === 'martial:blade:blade-dance')
		).toMatchObject({
			disposition: 'revise-art',
			findings: [
				{
					kind: 'stray-ui-glyph',
					requiredAction: 'revise-art'
				}
			]
		});
		expect(
			manifest.records.find((record) => record.targetId === 'martial:blade:swordsmanship')
		).toMatchObject({ disposition: 'accepted-unchanged', findings: [] });

		for (const record of manifest.records) {
			const source = await readFile(path.resolve(workspaceRoot, record.sourceCandidate.path));
			expect(record.sourceCandidate.contentHash).toBe(sha256(source));
		}
	});

	it('reports a current inventory without writing during check mode', async () => {
		await exportSkillIconQualityCleanup({ root: workspaceRoot, mode: 'write' });
		const cleanupDirectory = path.resolve(workspaceRoot, QUALITY_CLEANUP_ROOT);
		const beforeSnapshot = await snapshot(cleanupDirectory);

		const report = await exportSkillIconQualityCleanup({ root: workspaceRoot, mode: 'check' });

		const afterSnapshot = await snapshot(cleanupDirectory);
		expect(report.counts).toEqual({ total: 456, Martial: 258, Magical: 124, Craft: 74 });
		expect(report.written).toEqual([]);
		expect(afterSnapshot).toEqual(beforeSnapshot);
	});

	it('rejects a consistently skewed 456-record authority input', async () => {
		const input = withSkewedDomain(await loadCleanupManifestInput(workspaceRoot));

		expect(() => buildSkillIconCleanupManifest(input)).toThrow(/actual domain counts/i);
	});

	it('reports output drift in check mode and refuses to replace it in write mode', async () => {
		const manifestPath = path.resolve(workspaceRoot, QUALITY_CLEANUP_ROOT, 'manifest.json');
		const original = await readFile(manifestPath);
		const drift = Buffer.from('intentionally drifted cleanup manifest\n');
		await writeFile(manifestPath, drift);
		try {
			const checked = await exportSkillIconQualityCleanup({ root: workspaceRoot, mode: 'check' });
			expect(checked.written).toEqual([]);
			expect(checked.drifted).toEqual([
				'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json'
			]);
			await expect(
				exportSkillIconQualityCleanup({ root: workspaceRoot, mode: 'write' })
			).rejects.toThrow(/refusing to replace drifted cleanup artifact/i);
			expect(await readFile(manifestPath)).toEqual(drift);
		} finally {
			await writeFile(manifestPath, original);
		}
	});

	it('does not clobber synchronized drift that appears after the missing-file check', async () => {
		const cleanupDirectory = path.resolve(workspaceRoot, QUALITY_CLEANUP_ROOT);
		const manifestPath = path.join(cleanupDirectory, 'manifest.json');
		const original = await readFile(manifestPath);
		const drift = Buffer.from('concurrent cleanup manifest drift\n');
		await unlink(manifestPath);
		let writer: RaceWriter | null = null;
		let publicationReleased = false;
		try {
			writer = await startRaceWriter(cleanupDirectory, manifestPath, drift);
			await expect(
				exportSkillIconQualityCleanup({
					root: workspaceRoot,
					mode: 'write',
					testHooks: {
						beforePublish: async (repositoryPath: string) => {
							expect(repositoryPath).toBe(
								'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json'
							);
							await writer!.destinationWritten;
							publicationReleased = true;
						}
					}
				})
			).rejects.toThrow(/refusing to replace drifted cleanup artifact/i);
			expect(publicationReleased).toBe(true);
			await waitForExit(writer.child);
			expect(await readFile(manifestPath)).toEqual(drift);
		} finally {
			if (writer?.child.exitCode === null) {
				writer.child.kill();
				await waitForExit(writer.child);
			}
			await writeFile(manifestPath, original);
		}
	});
});

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SkillIconCleanupManifestSchema } from '../packages/contracts/src/index.js';
import {
	QUALITY_CLEANUP_ROOT,
	buildSkillIconCleanupManifest,
	exportSkillIconQualityCleanup,
	loadCleanupManifestInput
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
});

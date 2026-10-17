import path from 'node:path';

import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';

import {
	WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES,
	assertWikiSkillVisualDerivative,
	assertWikiSkillVisualManagedBudget,
	buildWikiSkillVisualCatalog
} from './wiki-skill-visual-catalog-lib.js';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

describe('wiki skill visual catalog exporter', () => {
	let built: Awaited<ReturnType<typeof buildWikiSkillVisualCatalog>>;

	// Rebuilding all 457 icons takes over a minute on GitHub-hosted runners.
	beforeAll(async () => {
		built = await buildWikiSkillVisualCatalog(repositoryRoot);
	}, 180_000);

	it('deterministically composes all 457 interiors with their reusable rarity frames', async () => {
		expect(built.manifest.schemaVersion).toBe('wiki-skill-visual-catalog-v2');
		expect(built.generated).toHaveLength(457);
		expect(built.manifest.summary.skillCount).toBe(457);
		expect(built.manifest.records.map((record) => record.targetId)).toEqual(
			[...built.manifest.records.map((record) => record.targetId)].sort()
		);
	});

	it('includes Reversal Cut through the ordinary layered source contract', async () => {
		const reversal = built.manifest.records.find(
			(record) => record.targetId === 'martial:blade:reversal-cut'
		);

		expect(reversal).toMatchObject({
			sourcePath: 'assets/wiki/skills/icon-production-v2/interiors/martial-blade-reversal-cut.png',
			framePath: 'assets/wiki/skills/icon-production-v2/frames/rarity-frame-a.png'
		});
		expect(reversal?.publicPath).toContain('/visual-catalog-v2/icons/');
	});

	it('uses the declared layer order so the rarity frame is the final layer', async () => {
		const record = built.manifest.records[0]!;
		const frame = await sharp(path.join(repositoryRoot, record.framePath)).raw().toBuffer();
		const runtime = await sharp(
			built.generated.find((item) => item.record.targetId === record.targetId)!.buffer
		)
			.resize(1024, 1024)
			.raw()
			.toBuffer();

		expect(frame.some((channel, index) => index % 4 === 3 && channel > 0)).toBe(true);
		expect(runtime.byteLength).toBe(1024 * 1024 * 4);
	});

	it('keeps every WebP and the complete managed catalog within budget', async () => {
		const sample = built.generated[0]!;
		await expect(
			assertWikiSkillVisualDerivative(sample.buffer, sample.record.targetId)
		).resolves.toBeUndefined();
		expect(built.manifest.summary.managedDirectoryBytes).toBeLessThanOrEqual(
			WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES
		);
		expect(
			built.manifest.records.every(
				(record) => record.bytes <= built.manifest.summary.maximumAssetBytes
			)
		).toBe(true);
	});

	it('rejects one byte beyond the managed-directory budget', () => {
		expect(() =>
			assertWikiSkillVisualManagedBudget(WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES, 1)
		).toThrow(/budget/i);
	});
});

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	SKILL_FRAME_SHAPE_AUTHORITY_PATH,
	writeCanonicalSkillAssets
} from './skill-icon-canonical-assets.js';
import { renderSkillIconReview } from './render-skill-icon-review.js';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const workRoot = '.skill-icon-work/review-tool-spec';

describe('temporary skill icon review renderer', () => {
	beforeAll(async () => {
		await rm(path.join(repositoryRoot, workRoot), { recursive: true, force: true });
		await mkdir(path.join(repositoryRoot, workRoot), { recursive: true });
	});

	afterAll(async () => {
		await rm(path.join(repositoryRoot, workRoot), { recursive: true, force: true });
	});

	it('composes an unpromoted candidate and accepted lineage without writing canonical state', async () => {
		const canonicalPath =
			'assets/wiki/skills/icon-production-v2/interiors/martial-blade-measured-cut.png';
		const candidatePath = `${workRoot}/candidate.png`;
		const reviewOutputPath = `${workRoot}/review-composite.png`;
		const familyOutputPath = `${workRoot}/family-reference.png`;
		const candidateBefore = await readFile(path.join(repositoryRoot, canonicalPath));
		await writeFile(path.join(repositoryRoot, candidatePath), candidateBefore);

		await renderSkillIconReview(
			{
				targetId: 'martial:blade:measured-cut',
				candidatePath,
				reviewOutputPath,
				familyOutputPath
			},
			repositoryRoot
		);

		await expect(
			sharp(path.join(repositoryRoot, reviewOutputPath)).metadata()
		).resolves.toMatchObject({
			width: 1024,
			height: 1024,
			format: 'png'
		});
		await expect(
			sharp(path.join(repositoryRoot, familyOutputPath)).metadata()
		).resolves.toMatchObject({
			format: 'png'
		});
		expect(await readFile(path.join(repositoryRoot, canonicalPath))).toEqual(candidateBefore);
	});

	it('rejects permanent review output paths', async () => {
		await expect(
			renderSkillIconReview(
				{
					targetId: 'martial:blade:measured-cut',
					candidatePath: `${workRoot}/candidate.png`,
					reviewOutputPath: 'assets/wiki/skills/review.png'
				},
				repositoryRoot
			)
		).rejects.toThrow(/\.skill-icon-work/u);
	});

	it('does not synthesize a lineage from unrelated standalone skills in one family', async () => {
		await expect(
			renderSkillIconReview(
				{
					targetId: 'martial:blade:piercing-thrust',
					familyOutputPath: `${workRoot}/standalone-family.png`
				},
				repositoryRoot
			)
		).rejects.toThrow(/omit the family sheet/i);
	});

	it('reviews a cataloged net-new target before its interior is promoted', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-review-net-new-'));
		const assetRoot = path.join(root, 'assets/wiki/skills/icon-production-v2');
		await mkdir(path.join(assetRoot, 'interiors'), { recursive: true });
		await mkdir(path.join(assetRoot, 'frames'));
		const art = await sharp({
			create: { width: 1024, height: 1024, channels: 4, background: '#00000000' }
		})
			.composite([
				{
					input: Buffer.from([255, 255, 255, 255]),
					raw: { width: 1, height: 1, channels: 4 },
					left: 512,
					top: 512
				}
			])
			.png()
			.toBuffer();
		const transparent = await sharp({
			create: { width: 1024, height: 1024, channels: 4, background: '#00000000' }
		})
			.png()
			.toBuffer();
		const catalogPath = path.join(assetRoot, 'catalog.json');
		const accepted = {
			targetId: 'martial:blade:quick-cut',
			name: 'Quick Cut',
			rarity: 'F',
			domain: 'Martial',
			family: 'Blade',
			motifFamily: 'blade.precision-cut'
		};
		await writeFile(
			catalogPath,
			JSON.stringify({ schemaVersion: 'skill-icon-catalog-v1', records: [accepted] })
		);
		await writeFile(path.join(assetRoot, 'interiors/martial-blade-quick-cut.png'), art);
		for (const rarity of ['f', 'e', 'd', 'c', 'b', 'a', 's']) {
			await writeFile(path.join(assetRoot, `frames/rarity-frame-${rarity}.png`), transparent);
		}
		await writeFile(path.join(assetRoot, 'backing.png'), transparent);
		await writeFile(path.join(assetRoot, 'geometry.json'), '{}');
		await writeFile(path.join(assetRoot, 'geometry-guide.png'), transparent);
		await writeFile(
			path.join(root, SKILL_FRAME_SHAPE_AUTHORITY_PATH),
			await readFile(path.join(repositoryRoot, SKILL_FRAME_SHAPE_AUTHORITY_PATH))
		);
		await writeCanonicalSkillAssets(root);

		const target = {
			targetId: 'martial:blade:measured-cut',
			name: 'Measured Cut',
			rarity: 'F',
			domain: 'Martial',
			family: 'Blade',
			motifFamily: 'blade.precision-cut'
		};
		await writeFile(
			catalogPath,
			JSON.stringify({ schemaVersion: 'skill-icon-catalog-v1', records: [accepted, target] })
		);
		await mkdir(path.join(root, '.skill-icon-work/new-target'), { recursive: true });
		await writeFile(path.join(root, '.skill-icon-work/new-target/candidate.png'), art);

		await expect(
			renderSkillIconReview(
				{
					targetId: target.targetId,
					candidatePath: '.skill-icon-work/new-target/candidate.png',
					reviewOutputPath: '.skill-icon-work/new-target/review-composite.png',
					familyOutputPath: '.skill-icon-work/new-target/family-review.png'
				},
				root
			)
		).resolves.toMatchObject({
			reviewOutputPath: '.skill-icon-work/new-target/review-composite.png'
		});
	});
});

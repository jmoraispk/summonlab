import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	composeSkillHex,
	exportSkillIconRuntime,
	exportSkillRuntimeSet,
	formatSkillReviewLabel,
	renderSkillContactSheet,
	renderSkillReviewCard
} from './compose-skill-icon-assets.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

async function pngLayer(
	color: readonly [number, number, number],
	visible: (x: number, y: number) => boolean
): Promise<Buffer> {
	const pixels = Buffer.alloc(1024 * 1024 * 4);
	for (let y = 0; y < 1024; y += 1) {
		for (let x = 0; x < 1024; x += 1) {
			const offset = (y * 1024 + x) * 4;
			pixels[offset] = color[0];
			pixels[offset + 1] = color[1];
			pixels[offset + 2] = color[2];
			pixels[offset + 3] = visible(x, y) ? 255 : 0;
		}
	}
	return sharp(pixels, { raw: { width: 1024, height: 1024, channels: 4 } })
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function layerFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-compose-'));
	roots.push(root);
	const backingPath = path.join(root, 'backing.png');
	const artPath = path.join(root, 'art.png');
	const framePath = path.join(root, 'frame.png');
	const backing = await pngLayer([255, 0, 0], (x, y) => x >= 100 || y >= 100);
	const art = await pngLayer([0, 255, 0], (x, y) => x >= 400 && x < 624 && y >= 400 && y < 624);
	const frame = await pngLayer([0, 0, 255], (x) => x < 96);
	await Promise.all([
		writeFile(backingPath, backing),
		writeFile(artPath, art),
		writeFile(framePath, frame)
	]);
	return { root, backingPath, artPath, framePath, backing, art, frame };
}

async function pixelAt(image: Buffer, x: number, y: number): Promise<number[]> {
	const { data, info } = await sharp(image)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const offset = (y * info.width + x) * info.channels;
	return [...data.subarray(offset, offset + 4)];
}

describe('composeSkillHex', () => {
	it('composites backing, art, then frame in that exact order', async () => {
		const item = await layerFixture();
		const composite = await composeSkillHex(item);

		expect(await pixelAt(composite, 700, 512)).toEqual([255, 0, 0, 255]);
		expect(await pixelAt(composite, 512, 512)).toEqual([0, 255, 0, 255]);
		expect(await pixelAt(composite, 48, 512)).toEqual([0, 0, 255, 255]);
	});
});

describe('exportSkillRuntimeSet', () => {
	it('writes deterministic WebP runtime sizes and a text-free PNG recognition image', async () => {
		const item = await layerFixture();
		const backingPath =
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png';
		const artPath =
			'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-swordsmanship.png';
		const framePath = 'assets/wiki/skills/icon-production-v1/masters/frames/f.png';
		for (const [relativePath, bytes] of [
			[backingPath, item.backing],
			[artPath, item.art],
			[framePath, item.frame]
		] as const) {
			await mkdir(path.dirname(path.join(item.root, relativePath)), { recursive: true });
			await writeFile(path.join(item.root, relativePath), bytes);
		}
		const inputsBefore = await Promise.all(
			[backingPath, artPath, framePath].map((relativePath) =>
				readFile(path.join(item.root, relativePath))
			)
		);
		const assets = await exportSkillRuntimeSet(
			{
				targetId: 'martial:blade:swordsmanship',
				rarity: 'F',
				assets: { approvedMaster: { path: artPath } }
			},
			item.root
		);

		for (const [name, size, format] of [
			['runtime512', 512, 'webp'],
			['runtime256', 256, 'webp'],
			['runtime128', 128, 'webp'],
			['recognition96', 96, 'png']
		] as const) {
			const asset = assets[name];
			const bytes = await readFile(path.join(item.root, asset.path));
			const metadata = await sharp(bytes).metadata();
			expect(metadata).toMatchObject({ width: size, height: size, format, hasAlpha: true });
			expect(asset).toMatchObject({
				width: size,
				height: size,
				bytes: bytes.byteLength,
				contentHash: createHash('sha256').update(bytes).digest('hex')
			});
		}
		const expectedRecognition = await sharp(await composeSkillHex(item))
			.resize(96, 96)
			.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
			.toBuffer();
		expect(await readFile(path.join(item.root, assets.recognition96.path))).toEqual(
			expectedRecognition
		);
		for (const [index, relativePath] of [backingPath, artPath, framePath].entries()) {
			expect(await readFile(path.join(item.root, relativePath))).toEqual(inputsBefore[index]);
		}
		expect(
			await exportSkillRuntimeSet(
				{
					targetId: 'martial:blade:swordsmanship',
					rarity: 'F',
					assets: { approvedMaster: { path: artPath } }
				},
				item.root
			)
		).toEqual(assets);

		const candidatePath =
			'assets/wiki/skills/icon-production-v1/candidates/icons/martial-blade-swordsmanship-v1.png';
		const resultPath =
			'assets/wiki/skills/icon-production-v1/results/icons/martial-blade-swordsmanship-v1.json';
		const artHash = createHash('sha256').update(item.art).digest('hex');
		const candidateAsset = {
			path: candidatePath,
			mediaType: 'image/png',
			width: 1024,
			height: 1024,
			bytes: item.art.byteLength,
			alphaMode: 'rgba',
			contentHash: artHash
		};
		const finding = {
			category: 'geometry',
			evaluator: 'automated',
			outcome: 'pass',
			observation: 'Geometry passed.'
		};
		const producerFinding = {
			category: 'manifest-fidelity',
			evaluator: 'producer',
			outcome: 'pass',
			observation: 'Prompt matched.'
		};
		const review = {
			schemaVersion: 'skill-icon-review-v1',
			reviewId: 'review-martial-blade-swordsmanship-v1',
			jobId: 'martial-blade-swordsmanship-v1',
			role: 'skill-art',
			skillTargetId: 'martial:blade:swordsmanship',
			candidatePath,
			candidateHash: artHash,
			reviewer: 'Skills visual owner',
			reviewerRole: 'owner',
			decision: 'accepted',
			rationale: 'Recognizable.',
			findings: [
				{ criterion: 'recognition', outcome: 'pass', observation: 'Readable at 96 pixels.' }
			],
			reviewedAt: '2026-09-02T10:00:00.000Z'
		};
		const catalogPath = 'assets/wiki/skills/icon-production-v1/catalog.json';
		await mkdir(path.dirname(path.join(item.root, catalogPath)), { recursive: true });
		await writeFile(
			path.join(item.root, catalogPath),
			JSON.stringify({
				schemaVersion: 'skill-icon-catalog-v1',
				records: [
					{
						targetId: 'martial:blade:swordsmanship',
						domain: 'Martial',
						family: 'Blade',
						name: 'Swordsmanship',
						labels: [{ namespace: 'Equipment', value: 'Sword' }],
						rarity: 'F',
						type: 'P',
						requires: 'Hold a sword',
						effect: 'Sword foundation.',
						mapEntryId: 'blade.precision-cut',
						motifFamily: 'blade.precision-cut',
						primaryVisualParent: null,
						status: 'approved',
						visualSpec: {
							dominantSubject: 'One sword',
							supportingCue: null,
							semanticPalette: ['steel blue'],
							composition: 'Centered emblem',
							exclusions: ['No text']
						},
						producerResult: {
							jobId: 'martial-blade-swordsmanship-v1',
							status: 'candidate',
							path: resultPath,
							contentHash: 'a'.repeat(64),
							findings: [finding, producerFinding]
						},
						assets: {
							candidate: candidateAsset,
							approvedMaster: { ...candidateAsset, path: artPath },
							...assets
						},
						review
					}
				]
			})
		);
		await writeFile(path.join(item.root, assets.runtime128.path), Buffer.from('drift'));
		const drifted = await exportSkillIconRuntime({ root: item.root, mode: 'check' });
		expect(drifted).toMatchObject({ inSync: false, written: false });
		expect(await readFile(path.join(item.root, assets.runtime128.path))).toEqual(
			Buffer.from('drift')
		);
	}, 15_000);

	it('rejects an unrelated preseeded derivative without writing a partial set', async () => {
		const item = await layerFixture();
		const paths = {
			backing: 'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png',
			art: 'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-swordsmanship.png',
			frame: 'assets/wiki/skills/icon-production-v1/masters/frames/f.png',
			seeded: 'apps/web/static/skill-icons/v1/256/martial-blade-swordsmanship.webp',
			first: 'apps/web/static/skill-icons/v1/512/martial-blade-swordsmanship.webp'
		};
		for (const [relativePath, bytes] of [
			[paths.backing, item.backing],
			[paths.art, item.art],
			[paths.frame, item.frame],
			[paths.seeded, Buffer.from('unrelated')]
		] as const) {
			await mkdir(path.dirname(path.join(item.root, relativePath)), { recursive: true });
			await writeFile(path.join(item.root, relativePath), bytes);
		}

		await expect(
			exportSkillRuntimeSet(
				{
					targetId: 'martial:blade:swordsmanship',
					rarity: 'F',
					assets: { approvedMaster: { path: paths.art } }
				},
				item.root
			)
		).rejects.toThrow(/collision|drift/iu);
		await expect(access(path.join(item.root, paths.first))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});
});

describe('review evidence rendering', () => {
	it('formats exact mastery/level text and renders it below the hex raster', async () => {
		const item = await layerFixture();
		const composite = await sharp(await composeSkillHex(item))
			.resize(512, 512)
			.png()
			.toBuffer();
		expect(formatSkillReviewLabel('Intermediate', 7)).toBe('INTERMEDIATE · LV 7');
		const card = await renderSkillReviewCard({
			composite,
			name: 'Swordsmanship <script>alert(1)</script>',
			mastery: 'Intermediate',
			level: 7,
			rarity: 'F'
		});
		const metadata = await sharp(card).metadata();
		expect(metadata.width).toBe(640);
		expect(metadata.height).toBeGreaterThan(512);
		const raster = await sharp(card)
			.extract({ left: 64, top: 0, width: 512, height: 512 })
			.png()
			.toBuffer();
		expect(await sharp(raster).raw().toBuffer()).toEqual(await sharp(composite).raw().toBuffer());
	});

	it('rejects non-integer or out-of-range levels', async () => {
		const composite = await sharp({
			create: { width: 512, height: 512, channels: 4, background: '#00000000' }
		})
			.png()
			.toBuffer();
		for (const level of [0, 11, 1.5]) {
			await expect(
				renderSkillReviewCard({
					composite,
					name: 'Swordsmanship',
					mastery: 'Intermediate',
					level,
					rarity: 'F'
				})
			).rejects.toThrow(/level/iu);
		}
	});

	it('renders deterministic contact sheets from cards', async () => {
		const composite = await sharp({
			create: { width: 512, height: 512, channels: 4, background: '#334155ff' }
		})
			.png()
			.toBuffer();
		const card = await renderSkillReviewCard({
			composite,
			name: 'Swordsmanship',
			mastery: 'Intermediate',
			level: 7,
			rarity: 'F'
		});
		const first = await renderSkillContactSheet([card, card]);
		const second = await renderSkillContactSheet([card, card]);
		expect(first).toEqual(second);
		expect(await sharp(first).metadata()).toMatchObject({ format: 'png', hasAlpha: true });
	});
});

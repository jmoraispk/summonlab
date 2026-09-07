import { createHash } from 'node:crypto';

import { SummonableHeroCatalogSchema } from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import catalogSource from '../assets/heroes/approved/summonable-roster-v1/catalog.json';
import {
	VillageCutoutBackfillManifestSchema,
	buildVillageCutoutBackfillManifest,
	validateVillageCutoutCandidate
} from './village-cutout-backfill-lib.js';

const catalog = SummonableHeroCatalogSchema.parse(catalogSource);
const heroIds = ['yaso-dreno', 'oren-sorin', 'joror-pelleth'] as const;

async function transparentPngWithRectangle(top: number): Promise<Buffer> {
	return sharp({
		create: {
			width: 1024,
			height: 1536,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite([
			{
				input: {
					create: {
						width: 512,
						height: 768,
						channels: 4,
						background: { r: 240, g: 180, b: 120, alpha: 1 }
					}
				},
				left: 256,
				top
			}
		])
		.png()
		.toBuffer();
}

describe('Village cutout backfill evidence', () => {
	it('accepts only a 1024x1536 true-alpha figure inside the canvas', async () => {
		const validTransparentPng = await transparentPngWithRectangle(384);
		const opaquePng = await sharp({
			create: {
				width: 1024,
				height: 1536,
				channels: 4,
				background: { r: 240, g: 180, b: 120, alpha: 1 }
			}
		})
			.png()
			.toBuffer();
		const edgeTouchingPng = await transparentPngWithRectangle(0);

		await expect(validateVillageCutoutCandidate(validTransparentPng)).resolves.toMatchObject({
			width: 1024,
			height: 1536,
			status: 'valid'
		});
		await expect(validateVillageCutoutCandidate(opaquePng)).rejects.toThrow(/true alpha/u);
		await expect(validateVillageCutoutCandidate(edgeTouchingPng)).rejects.toThrow(/canvas edge/u);
	});

	it('binds the ordered current-company candidates to exact approved summon authority', () => {
		const candidateHashes = {
			'yaso-dreno': createHash('sha256').update('yaso candidate').digest('hex'),
			'oren-sorin': createHash('sha256').update('oren candidate').digest('hex'),
			'joror-pelleth': createHash('sha256').update('joror candidate').digest('hex')
		};
		const modelSha256 = 'a'.repeat(64);
		const manifest = buildVillageCutoutBackfillManifest(catalog, heroIds, {
			candidateHashes,
			modelSha256
		});

		expect(manifest.heroes.map((hero) => hero.heroId)).toEqual([
			'yaso-dreno',
			'oren-sorin',
			'joror-pelleth'
		]);
		expect(manifest).toMatchObject({
			schemaVersion: 'village-cutout-backfill-v1',
			batchId: 'village-cutout-backfill-20260906-current-company-001',
			lifecycle: 'candidate',
			isolation: {
				tool: 'rembg',
				version: '2.0.83',
				commandEnvelope: {
					package: 'rembg[cpu,cli]==2.0.83',
					supersedesFailedPackage: 'rembg[cpu]==2.0.83',
					correctionReason: 'rembg CLI requires its declared cli extra'
				},
				model: {
					name: 'u2net_human_seg',
					cacheRelativePath: 'models/u2net_human_seg/u2net_human_seg.onnx',
					sha256: modelSha256
				},
				alphaMatting: {
					foregroundThreshold: 240,
					backgroundThreshold: 10,
					erodeSize: 15
				}
			}
		});
		expect(manifest.heroes).toEqual([
			expect.objectContaining({
				heroId: 'yaso-dreno',
				summon: {
					assetKey: 'yaso-dreno-summon-v1',
					path: 'assets/heroes/experiments/one-star-overnight-200-001/waves/wave-07/candidates/yaso-dreno/summon-v1.png',
					sha256: '2c757553d089e409e79cdf403b4c170de5e47b84d2f48a25cba57fa8838537e0',
					manifestSha256: '6cec5db614ec93fab229d7b24bd4d83bb9255c9ea52bcfadd7ca84bcfcfe1db4'
				},
				candidate: expect.objectContaining({ sha256: candidateHashes['yaso-dreno'] })
			}),
			expect.objectContaining({
				heroId: 'oren-sorin',
				summon: {
					assetKey: 'oren-sorin-summon-v1',
					path: 'assets/heroes/experiments/one-star-overnight-200-001/waves/wave-05/candidates/oren-sorin/summon-v2.png',
					sha256: '00b1cee63c25ce4590afea39e5539c4b1aeb4e63a2dc61ace2bdc830c10a9b4b',
					manifestSha256: '1532dbdc8342ee47453c748bdebfabe684ce3208d30231ba46d189425fb1e249'
				},
				candidate: expect.objectContaining({ sha256: candidateHashes['oren-sorin'] })
			}),
			expect.objectContaining({
				heroId: 'joror-pelleth',
				summon: {
					assetKey: 'joror-pelleth-summon-v1',
					path: 'assets/heroes/experiments/one-star-overnight-200-001/waves/wave-09/candidates/joror-pelleth/summon-v1.png',
					sha256: '130360a4f48dff40971d9039a6a813fa549549f03627cdb87422cd400864819f',
					manifestSha256: '97667fed1d0ec5be0ca326ef9e364a2bd301ff44f1921656c401295f007ca04b'
				},
				candidate: expect.objectContaining({ sha256: candidateHashes['joror-pelleth'] })
			})
		]);
		for (const hero of manifest.heroes) {
			expect(hero.providerSource.sha256).toBe(hero.candidate.sha256);
			expect(hero.providerSource.path).toContain(`/heroes/${hero.heroId}/provider-source-v1.png`);
			expect(hero.candidate.path).toContain(`/heroes/${hero.heroId}/candidate-v1.png`);
		}
		expect(VillageCutoutBackfillManifestSchema.parse(manifest)).toEqual(manifest);
		expect(
			VillageCutoutBackfillManifestSchema.safeParse({ ...manifest, approval: 'approved' }).success
		).toBe(false);
	});
});

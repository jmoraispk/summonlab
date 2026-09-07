import { createHash } from 'node:crypto';

import { SummonableHeroCatalogSchema } from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import catalogSource from '../assets/heroes/approved/summonable-roster-v1/catalog.json';
import manifestSource from '../assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/manifest.json';
import {
	VillageCutoutBackfillManifestSchema,
	buildVillageCutoutBackfillManifest,
	promoteVillageCutouts,
	validateVillageCutoutCandidate
} from './village-cutout-backfill-lib.js';

const catalog = SummonableHeroCatalogSchema.parse(catalogSource);
const manifest = VillageCutoutBackfillManifestSchema.parse(manifestSource);
const heroIds = ['yaso-dreno', 'oren-sorin', 'joror-pelleth'] as const;
const approval = {
	schemaVersion: 'village-cutout-backfill-approval-v1',
	approvalId: 'village-cutout-backfill-20260906-current-company-001-owner-approval-v1',
	batchId: 'village-cutout-backfill-20260906-current-company-001',
	manifestSha256: 'd1241e189493db9f11900d0a854c769b303659cd3549f038db80321630493a37',
	reviewer: 'owner',
	reviewDate: '2026-09-06',
	verdict: 'approved',
	acceptedHeroIds: heroIds,
	approvalText: 'approve',
	acceptedCandidates: [
		{
			heroId: 'yaso-dreno',
			file: 'assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/yaso-dreno/candidate-v1.png',
			bytes: 962120,
			contentHash: '542ead078129c1578bef6c107b75ebfdbed8dfda845ca2de4d9b5e8ed5ae786f'
		},
		{
			heroId: 'oren-sorin',
			file: 'assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/oren-sorin/candidate-v1.png',
			bytes: 1125692,
			contentHash: '9ddd269e490bd2a294eb3d3c4f7801694232dcdb8d7e5dde9dd9e7483876fadf'
		},
		{
			heroId: 'joror-pelleth',
			file: 'assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/joror-pelleth/candidate-v1.png',
			bytes: 897825,
			contentHash: '1758fe2d1d1e46fea3991553ea5a1cd0b73e26b0c818becbd35da47a426427c3'
		}
	]
} as const;

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

describe('Village cutout promotion', () => {
	it('rejects a missing approval', () => {
		expect(() => promoteVillageCutouts(catalog, manifest, undefined)).toThrow(/approval/u);
	});

	it('rejects a stale manifest hash', () => {
		expect(() =>
			promoteVillageCutouts(catalog, manifest, {
				...approval,
				manifestSha256: 'f'.repeat(64)
			})
		).toThrow(/manifest hash/u);
	});

	it('rejects an accepted hero outside the exact current company', () => {
		expect(() =>
			promoteVillageCutouts(catalog, manifest, {
				...approval,
				acceptedHeroIds: ['yaso-dreno', 'oren-sorin', 'wenyn-amarun']
			})
		).toThrow(/accepted hero|approval/u);
	});

	it('rejects a changed candidate hash', () => {
		const changedManifest = structuredClone(manifest);
		changedManifest.heroes[0].candidate.sha256 = 'f'.repeat(64);
		changedManifest.heroes[0].providerSource.sha256 = 'f'.repeat(64);

		expect(() => promoteVillageCutouts(catalog, changedManifest, approval)).toThrow(
			/manifest hash|candidate hash/u
		);
	});

	it('rejects a revise verdict', () => {
		expect(() =>
			promoteVillageCutouts(catalog, manifest, { ...approval, verdict: 'revise' })
		).toThrow(/approved|approval/u);
	});

	it('promotes exactly the three approved immutable candidates', () => {
		const promoted = promoteVillageCutouts(catalog, manifest, approval);

		expect(
			promoted.entries
				.filter((entry) => entry.visuals.villageCutout)
				.map((entry) => entry.heroId)
				.sort()
		).toEqual(['joror-pelleth', 'oren-sorin', 'yaso-dreno']);
		for (const candidate of approval.acceptedCandidates) {
			const binding = promoted.entries.find((entry) => entry.heroId === candidate.heroId)!.visuals
				.villageCutout!;
			expect(binding).toMatchObject({
				sourceSummonAssetKey: `${candidate.heroId}-summon-v1`,
				asset: {
					assetKey: `${candidate.heroId}-village-cutout-v1`,
					role: 'village-cutout',
					status: 'approved',
					file: candidate.file,
					bytes: candidate.bytes,
					contentHash: candidate.contentHash,
					sourceExperimentId: approval.batchId,
					approvalId: approval.approvalId
				}
			});
		}
	});
});

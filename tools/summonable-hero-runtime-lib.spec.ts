import { resolve } from 'node:path';

import { SummonableHeroCatalogSchema } from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import catalogSource from '../assets/heroes/approved/summonable-roster-v1/catalog.json';
import {
	assertVillageCutoutAlpha,
	planSummonableHeroRuntime,
	verifyApprovedHeroSource
} from './summonable-hero-runtime-lib.js';

const workspaceRoot = resolve(import.meta.dirname, '..');
const catalog = SummonableHeroCatalogSchema.parse(catalogSource);

async function pngWithOpaqueRectangle(top: number): Promise<Buffer> {
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
						background: { r: 255, g: 255, b: 255, alpha: 1 }
					}
				},
				left: 256,
				top
			}
		])
		.png()
		.toBuffer();
}

describe('summonable hero runtime export', () => {
	it('plans 400 required hero assets plus three approved lazy Village cutouts', () => {
		const plan = planSummonableHeroRuntime(catalog);

		expect(plan).toHaveLength(403);
		expect(plan.filter((entry) => entry.usage === 'summon')).toHaveLength(200);
		expect(plan.filter((entry) => entry.usage === 'combat-chibi')).toHaveLength(200);
		expect(plan.filter((entry) => entry.usage === 'village-cutout')).toHaveLength(3);
		expect(new Set(plan.map((entry) => entry.alias)).size).toBe(403);
	});

	it('rejects a source whose approved content hash no longer matches', async () => {
		const source = catalog.entries[0]!.visuals.summon;
		await expect(
			verifyApprovedHeroSource(workspaceRoot, { ...source, contentHash: 'f'.repeat(64) })
		).rejects.toThrow(/Approved source changed before runtime export/u);
	});

	it('plans optional Village cutouts and validates their alpha bounds', async () => {
		const first = catalog.entries[0]!;
		const catalogWithOneCutout = SummonableHeroCatalogSchema.parse({
			...catalog,
			entries: catalog.entries.map((entry, index) =>
				index === 0
					? {
							...entry,
							visuals: {
								...entry.visuals,
								villageCutout: {
									sourceSummonAssetKey: entry.visuals.summon.assetKey,
									sourceSummonContentHash: entry.visuals.summon.contentHash,
									asset: {
										...entry.visuals.summon,
										assetKey: `${entry.heroId}-village-cutout-v1`,
										role: 'village-cutout',
										file: 'assets/heroes/experiments/example/village-cutout.png'
									}
								}
							}
						}
					: entry
			)
		});
		const validCutoutBytes = await pngWithOpaqueRectangle(384);
		const opaquePngBytes = await sharp({
			create: {
				width: 1024,
				height: 1536,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 1 }
			}
		})
			.png()
			.toBuffer();
		const edgeTouchingBytes = await pngWithOpaqueRectangle(0);

		expect(first.visuals.villageCutout).toBeUndefined();
		expect(planSummonableHeroRuntime(catalogWithOneCutout)).toHaveLength(404);
		expect(
			planSummonableHeroRuntime(catalogWithOneCutout).filter(
				(entry) => entry.usage === 'village-cutout'
			)
		).toHaveLength(4);
		await expect(assertVillageCutoutAlpha(validCutoutBytes)).resolves.toBeUndefined();
		await expect(assertVillageCutoutAlpha(opaquePngBytes)).rejects.toThrow(/true alpha/u);
		await expect(assertVillageCutoutAlpha(edgeTouchingBytes)).rejects.toThrow(/canvas edge/u);
	});
});

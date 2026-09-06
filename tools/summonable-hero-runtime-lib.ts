import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
	SummonableHeroRuntimeManifestSchema,
	type ApprovedHeroSourceAsset,
	type RuntimeVisualAsset,
	type SummonableHeroCatalog,
	type SummonableHeroRuntimeManifest
} from '../packages/contracts/src/index.js';
import sharp from 'sharp';

const EXPORTER_VERSION = 'summonable-hero-runtime-exporter-v2' as const;

export interface SummonableHeroRuntimePlanEntry {
	readonly heroId: string;
	readonly characterId: string;
	readonly manifestHash: string;
	readonly bundleName: string;
	readonly alias: string;
	readonly usage: 'summon' | 'combat-chibi' | 'village-cutout';
	readonly width: number;
	readonly quality: number;
	readonly budgetBytes: number;
	readonly source: ApprovedHeroSourceAsset;
}

interface GeneratedRuntimeAsset {
	readonly heroId: string;
	readonly record: RuntimeVisualAsset;
	readonly buffer: Buffer;
}

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

export function planSummonableHeroRuntime(
	catalog: SummonableHeroCatalog
): readonly SummonableHeroRuntimePlanEntry[] {
	return catalog.entries.flatMap((entry) =>
		(
			[
				{
					usage: 'summon' as const,
					width: 768,
					quality: 82,
					budgetBytes: 300_000,
					source: entry.visuals.summon
				},
				{
					usage: 'combat-chibi' as const,
					width: 384,
					quality: 80,
					budgetBytes: 120_000,
					source: entry.visuals.combatChibi
				},
				...(entry.visuals.villageCutout
					? [
							{
								usage: 'village-cutout' as const,
								width: 384,
								quality: 82,
								budgetBytes: 120_000,
								source: entry.visuals.villageCutout.asset
							}
						]
					: [])
			] as const
		).map((profile) => ({
			heroId: entry.heroId,
			characterId: entry.draft.manifest.characterId,
			manifestHash: entry.draft.manifestHash,
			bundleName: `hero-${entry.heroId}`,
			alias: `hero.${entry.heroId}.${profile.usage}`,
			...profile
		}))
	);
}

export async function assertVillageCutoutAlpha(bytes: Buffer): Promise<void> {
	const source = sharp(bytes);
	const metadata = await source.metadata();
	if (metadata.format !== 'png') {
		throw new Error('Village cutout must be a PNG');
	}
	if (metadata.width !== 1024 || metadata.height !== 1536) {
		throw new Error('Village cutout must be 1024x1536');
	}
	if (metadata.hasAlpha !== true) {
		throw new Error('Village cutout must have true alpha');
	}
	const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const alphaChannel = info.channels - 1;
	const alphaAt = (x: number, y: number) =>
		data[(y * info.width + x) * info.channels + alphaChannel]!;
	let coveredPixels = 0;
	let edgeHasVisiblePixel = false;
	for (let y = 0; y < info.height; y += 1) {
		for (let x = 0; x < info.width; x += 1) {
			const alpha = alphaAt(x, y);
			if (alpha > 8) {
				coveredPixels += 1;
				if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
					edgeHasVisiblePixel = true;
				}
			}
		}
	}
	if (coveredPixels === info.width * info.height) {
		throw new Error('Village cutout must have true alpha');
	}
	if (coveredPixels === 0) {
		throw new Error('Village cutout cannot be fully transparent');
	}
	if (edgeHasVisiblePixel) {
		throw new Error('Village cutout cannot touch the canvas edge');
	}
	const coverage = coveredPixels / (info.width * info.height);
	if (coverage < 0.02 || coverage > 0.6) {
		throw new Error('Village cutout alpha coverage must be within 0.02..0.60');
	}
}

export async function verifyApprovedHeroSource(
	workspaceRoot: string,
	source: ApprovedHeroSourceAsset
): Promise<Buffer> {
	const bytes = await readFile(resolve(workspaceRoot, source.file));
	if (bytes.byteLength !== source.bytes || sha256(bytes) !== source.contentHash) {
		throw new Error(`Approved source changed before runtime export: ${source.assetKey}`);
	}
	return bytes;
}

async function generateRuntimeAsset(
	workspaceRoot: string,
	plan: SummonableHeroRuntimePlanEntry
): Promise<GeneratedRuntimeAsset> {
	const sourceBytes = await verifyApprovedHeroSource(workspaceRoot, plan.source);
	if (plan.usage === 'village-cutout') await assertVillageCutoutAlpha(sourceBytes);
	const { data, info } = await sharp(sourceBytes)
		.rotate()
		.resize({ width: plan.width, fit: 'inside', withoutEnlargement: true })
		.webp({
			quality: plan.quality,
			effort: 6,
			preset: 'drawing',
			smartSubsample: true
		})
		.toBuffer({ resolveWithObject: true });
	if (plan.usage === 'village-cutout' && (await sharp(data).metadata()).hasAlpha !== true) {
		throw new Error(`Village cutout runtime output lost alpha: ${plan.heroId}`);
	}
	if (data.byteLength > plan.budgetBytes) {
		throw new Error(
			`${plan.heroId}/${plan.usage} is ${data.byteLength} bytes; budget is ${plan.budgetBytes}`
		);
	}
	const contentHash = sha256(data);
	const file = `runtime/summonable-heroes-v1/${plan.heroId}/${plan.usage}.${contentHash.slice(0, 12)}.webp`;
	return {
		heroId: plan.heroId,
		buffer: data,
		record: {
			alias: plan.alias,
			usage: plan.usage,
			sourceAssetKey: plan.source.assetKey,
			sourceStatus: 'approved',
			sourceContentHash: plan.source.contentHash,
			manifestHashes: [plan.manifestHash],
			file,
			publicPath: `/${file}`,
			width: info.width,
			height: info.height,
			bytes: data.byteLength,
			contentHash,
			budgetBytes: plan.budgetBytes,
			budgetStatus: 'within-budget',
			encoder: {
				format: 'webp',
				quality: plan.quality,
				effort: 6,
				preset: 'drawing',
				smartSubsample: true,
				metadata: 'stripped'
			}
		}
	};
}

export async function buildSummonableHeroRuntime(
	workspaceRoot: string,
	catalog: SummonableHeroCatalog,
	pixiVersion: string
): Promise<{
	readonly manifest: SummonableHeroRuntimeManifest;
	readonly generated: readonly GeneratedRuntimeAsset[];
}> {
	if (!/^8\.\d+\.\d+$/u.test(pixiVersion)) {
		throw new Error('The summonable runtime manifest requires an exact PixiJS v8 dependency');
	}
	const plan = planSummonableHeroRuntime(catalog);
	const generated: GeneratedRuntimeAsset[] = [];
	const concurrency = 8;
	for (let index = 0; index < plan.length; index += concurrency) {
		generated.push(
			...(await Promise.all(
				plan
					.slice(index, index + concurrency)
					.map((entry) => generateRuntimeAsset(workspaceRoot, entry))
			))
		);
	}
	const entries = catalog.entries.map((entry) => {
		const assets = generated
			.filter((asset) => asset.heroId === entry.heroId)
			.map((asset) => asset.record);
		const bytes = assets.reduce((total, asset) => total + asset.bytes, 0);
		return {
			heroId: entry.heroId,
			characterId: entry.draft.manifest.characterId,
			manifestHash: entry.draft.manifestHash,
			bundle: {
				name: `hero-${entry.heroId}`,
				budgetBytes: assets.reduce((total, asset) => total + asset.budgetBytes, 0),
				bytes,
				budgetStatus: 'within-budget' as const,
				assets
			}
		};
	});
	const core = {
		schemaVersion: 'summonable-hero-runtime-manifest-v2' as const,
		catalogVersion: catalog.catalogVersion,
		sourceCatalogContentHash: sha256(canonicalJson(catalog)),
		exporterVersion: EXPORTER_VERSION,
		loading: 'lazy-per-hero' as const,
		totalBytes: entries.reduce((total, entry) => total + entry.bundle.bytes, 0),
		entries,
		pixiManifest: {
			bundles: entries.map((entry) => ({
				name: entry.bundle.name,
				assets: entry.bundle.assets.map((asset) => ({ alias: asset.alias, src: asset.publicPath }))
			}))
		}
	};
	return {
		manifest: SummonableHeroRuntimeManifestSchema.parse({
			...core,
			manifestHash: sha256(canonicalJson(core))
		}),
		generated
	};
}

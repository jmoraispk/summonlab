import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from '../packages/characters/src/index.js';
import {
	CharacterVisualCatalogSchema,
	RuntimeVisualManifestSchema,
	type CharacterVisualAsset,
	type RuntimeVisualAsset,
	type RuntimeVisualManifest,
	type RuntimeVisualUsage
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';
import sharp from 'sharp';

const EXPORTER_VERSION = 'runtime-visual-exporter-v1' as const;
const INITIAL_PHONE_BUDGET_BYTES = 8_000_000 as const;
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(workspaceRoot, 'assets/heroes/visuals/catalog.json');
const webPackagePath = resolve(workspaceRoot, 'apps/web/package.json');
const staticRoot = resolve(workspaceRoot, 'apps/web/static');

interface ExportProfile {
	readonly usage: RuntimeVisualUsage;
	readonly width: number;
	readonly quality: number;
	readonly budgetBytes: number;
}

interface GeneratedAsset {
	readonly record: RuntimeVisualAsset;
	readonly buffer: Buffer;
}

const exportProfiles: Partial<Record<CharacterVisualAsset['role'], readonly ExportProfile[]>> = {
	anchor: [
		{ usage: 'summon', width: 768, quality: 82, budgetBytes: 300_000 },
		{ usage: 'dialogue', width: 512, quality: 80, budgetBytes: 180_000 },
		{ usage: 'roster', width: 256, quality: 76, budgetBytes: 70_000 }
	],
	'roster-group': [{ usage: 'roster-group', width: 960, quality: 80, budgetBytes: 400_000 }],
	'settlement-scale': [
		{ usage: 'settlement-preview', width: 1280, quality: 78, budgetBytes: 600_000 }
	],
	'dialogue-closeup': [{ usage: 'dialogue', width: 512, quality: 80, budgetBytes: 180_000 }],
	'summon-card': [{ usage: 'summon-card', width: 768, quality: 82, budgetBytes: 300_000 }]
};

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

async function generateAsset(
	catalogVersion: string,
	source: CharacterVisualAsset,
	profile: ExportProfile
): Promise<GeneratedAsset> {
	const sourcePath = resolve(workspaceRoot, source.file);
	const sourceBytes = await readFile(sourcePath);
	if (sourceBytes.byteLength !== source.bytes || sha256(sourceBytes) !== source.contentHash) {
		throw new Error(`Source changed before runtime export: ${source.assetKey}`);
	}
	const { data, info } = await sharp(sourceBytes)
		.rotate()
		.resize({ width: profile.width, fit: 'inside', withoutEnlargement: true })
		.webp({
			quality: profile.quality,
			effort: 6,
			preset: 'drawing',
			smartSubsample: true
		})
		.toBuffer({ resolveWithObject: true });
	const contentHash = sha256(data);
	if (data.byteLength > profile.budgetBytes) {
		throw new Error(
			`${source.assetKey}/${profile.usage} is ${data.byteLength} bytes; budget is ${profile.budgetBytes}`
		);
	}
	const bundleName = `hero-${source.assetKey}`;
	const file = `runtime/${catalogVersion}/${bundleName}/${profile.usage}.${contentHash.slice(0, 12)}.webp`;
	return {
		buffer: data,
		record: {
			alias: `hero.${source.assetKey}.${profile.usage}`,
			usage: profile.usage,
			sourceAssetKey: source.assetKey,
			sourceStatus: 'approved',
			sourceContentHash: source.contentHash,
			manifestHashes: source.manifestHashes,
			file,
			publicPath: `/${file}`,
			width: info.width,
			height: info.height,
			bytes: data.byteLength,
			contentHash,
			budgetBytes: profile.budgetBytes,
			budgetStatus: 'within-budget',
			encoder: {
				format: 'webp',
				quality: profile.quality,
				effort: 6,
				preset: 'drawing',
				smartSubsample: true,
				metadata: 'stripped'
			}
		}
	};
}

async function buildManifest(): Promise<{
	manifest: RuntimeVisualManifest;
	generated: readonly GeneratedAsset[];
}> {
	const catalogBytes = await readFile(catalogPath);
	const webPackage = JSON.parse(await readFile(webPackagePath, 'utf8')) as {
		dependencies?: Record<string, string>;
	};
	const pixiVersion = webPackage.dependencies?.['pixi.js'];
	if (!pixiVersion || !/^8\.\d+\.\d+$/u.test(pixiVersion)) {
		throw new Error('The runtime manifest requires an exact PixiJS v8 dependency');
	}
	const catalog = CharacterVisualCatalogSchema.parse(JSON.parse(catalogBytes.toString('utf8')));
	const generated: GeneratedAsset[] = [];
	const deferred: RuntimeVisualManifest['deferred'] = [];

	for (const source of catalog.assets) {
		if (source.status !== 'approved') {
			deferred.push({
				sourceAssetKey: source.assetKey,
				sourceContentHash: source.contentHash,
				sourceStatus: source.status,
				reason:
					source.status === 'approval-candidate' ? 'awaiting-human-approval' : 'rejected-source'
			});
			continue;
		}
		const profiles = exportProfiles[source.role];
		if (!profiles?.length) {
			deferred.push({
				sourceAssetKey: source.assetKey,
				sourceContentHash: source.contentHash,
				sourceStatus: source.status,
				reason:
					source.role === 'continuity-sheet' ? 'development-reference-only' : 'no-export-profile'
			});
			continue;
		}
		for (const profile of profiles) {
			generated.push(await generateAsset(catalog.catalogVersion, source, profile));
		}
	}

	const bundleNames = [...new Set(generated.map(({ record }) => `hero-${record.sourceAssetKey}`))];
	const bundles = bundleNames.map((name) => {
		const assets = generated
			.map(({ record }) => record)
			.filter((asset) => `hero-${asset.sourceAssetKey}` === name);
		return {
			name,
			budgetBytes: assets.reduce((total, asset) => total + asset.budgetBytes, 0),
			bytes: assets.reduce((total, asset) => total + asset.bytes, 0),
			budgetStatus: 'within-budget' as const,
			assets
		};
	});
	const initialPayloadBytes = bundles.reduce((total, bundle) => total + bundle.bytes, 0);
	if (initialPayloadBytes > INITIAL_PHONE_BUDGET_BYTES) {
		throw new Error(
			`Initial visual payload is ${initialPayloadBytes} bytes; phone budget is ${INITIAL_PHONE_BUDGET_BYTES}`
		);
	}
	const core = {
		schemaVersion: 'runtime-visual-manifest-v1' as const,
		catalogVersion: catalog.catalogVersion,
		catalogContentHash: sha256(catalogBytes),
		exporterVersion: EXPORTER_VERSION,
		initialPayloadBudgetBytes: INITIAL_PHONE_BUDGET_BYTES,
		initialPayloadBytes,
		initialPayloadStatus: 'within-budget' as const,
		toolchain: {
			pixi: pixiVersion,
			sharp: sharp.versions.sharp,
			vips: sharp.versions.vips,
			webp: sharp.versions.webp
		},
		bundles,
		deferred,
		pixiManifest: {
			bundles: bundles.map((bundle) => ({
				name: bundle.name,
				assets: bundle.assets.map((asset) => ({
					alias: asset.alias,
					src: asset.publicPath
				}))
			}))
		}
	};
	return {
		manifest: RuntimeVisualManifestSchema.parse({
			...core,
			manifestHash: sha256(canonicalJson(core))
		}),
		generated
	};
}

async function listFiles(root: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
		const path = resolve(root, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(path)));
		else files.push(path);
	}
	return files;
}

async function check(manifest: RuntimeVisualManifest, generated: readonly GeneratedAsset[]) {
	const outputRoot = resolve(staticRoot, 'runtime', manifest.catalogVersion);
	const manifestPath = resolve(outputRoot, 'manifest.json');
	const stored = RuntimeVisualManifestSchema.parse(
		JSON.parse(await readFile(manifestPath, 'utf8'))
	);
	if (canonicalJson(stored) !== canonicalJson(manifest)) {
		throw new Error('Checked-in runtime visual manifest is stale; run pnpm export:runtime-visuals');
	}
	const expectedFiles = new Set([manifestPath]);
	for (const output of generated) {
		const path = resolve(staticRoot, output.record.file);
		expectedFiles.add(path);
		const storedBytes = await readFile(path);
		if (!storedBytes.equals(output.buffer)) {
			throw new Error(`Checked-in runtime visual bytes are stale: ${output.record.file}`);
		}
	}
	const extras = (await listFiles(outputRoot)).filter((path) => !expectedFiles.has(path));
	if (extras.length) {
		throw new Error(`Unexpected runtime visual output: ${relative(workspaceRoot, extras[0]!)}`);
	}
}

async function write(manifest: RuntimeVisualManifest, generated: readonly GeneratedAsset[]) {
	if (!/^[a-z0-9-]+$/u.test(manifest.catalogVersion)) {
		throw new Error('Catalog version is unsafe for an output directory');
	}
	const outputRoot = resolve(staticRoot, 'runtime', manifest.catalogVersion);
	const requiredPrefix = `${resolve(staticRoot, 'runtime')}${sep}`;
	if (!outputRoot.startsWith(requiredPrefix) || outputRoot === resolve(staticRoot, 'runtime')) {
		throw new Error('Refusing to replace an unsafe runtime output directory');
	}
	await rm(outputRoot, { recursive: true, force: true });
	for (const output of generated) {
		const path = resolve(staticRoot, output.record.file);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, output.buffer);
	}
	await mkdir(outputRoot, { recursive: true });
	const manifestText = await format(JSON.stringify(manifest), {
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
	await writeFile(resolve(outputRoot, 'manifest.json'), manifestText);
}

const mode = process.argv.includes('--check') ? 'check' : 'write';
const { manifest, generated } = await buildManifest();
if (mode === 'check') await check(manifest, generated);
else await write(manifest, generated);

process.stdout.write(
	`${JSON.stringify(
		{
			mode,
			catalogVersion: manifest.catalogVersion,
			bundleCount: manifest.bundles.length,
			assetCount: generated.length,
			deferredCount: manifest.deferred.length,
			bytes: manifest.initialPayloadBytes,
			budgetBytes: manifest.initialPayloadBudgetBytes,
			budgetUsedPercent: Number(
				((manifest.initialPayloadBytes / manifest.initialPayloadBudgetBytes) * 100).toFixed(2)
			),
			manifestHash: manifest.manifestHash
		},
		null,
		2
	)}\n`
);

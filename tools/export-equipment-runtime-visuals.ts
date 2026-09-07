import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EQUIPMENT_RUNTIME_CARD_BUDGET_BYTES,
	EQUIPMENT_RUNTIME_DETAIL_BUDGET_BYTES,
	EquipmentRuntimeVisualAssetSchema,
	EquipmentRuntimeVisualManifestSchema,
	type EquipmentRuntimeVisualAsset,
	type EquipmentRuntimeVisualManifest,
	type EquipmentRuntimeVisualUsage
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';
import sharp from 'sharp';

import {
	EQUIPMENT_APPROVED_MANIFEST_PATH,
	EquipmentApprovedSourceManifestV1Schema,
	type EquipmentApprovedSourceRecordV1
} from './equipment-approved-source-contract.js';

export const EQUIPMENT_RUNTIME_EXPORTER_VERSION = 'equipment-runtime-visual-exporter-v1' as const;
export const EQUIPMENT_RUNTIME_ROOT = 'apps/web/static/runtime/equipment-v1' as const;
export const EQUIPMENT_RUNTIME_MANIFEST_PATH = `${EQUIPMENT_RUNTIME_ROOT}/manifest.json` as const;
export const EQUIPMENT_RUNTIME_REVIEW_PATH =
	'assets/equipment/approved/material-equipment-v1/reviews/runtime-v1/index.html' as const;

export interface EquipmentExportProfile {
	readonly usage: EquipmentRuntimeVisualUsage;
	readonly boundPixels: 256 | 512;
	readonly quality: 76 | 80;
	readonly budgetBytes: 16_000 | 64_000;
}

export const EQUIPMENT_EXPORT_PROFILES = [
	{
		usage: 'card',
		boundPixels: 256,
		quality: 76,
		budgetBytes: EQUIPMENT_RUNTIME_CARD_BUDGET_BYTES
	},
	{
		usage: 'detail',
		boundPixels: 512,
		quality: 80,
		budgetBytes: EQUIPMENT_RUNTIME_DETAIL_BUDGET_BYTES
	}
] as const satisfies readonly EquipmentExportProfile[];

export interface GeneratedEquipmentRuntimeAsset {
	readonly record: EquipmentRuntimeVisualAsset;
	readonly buffer: Buffer;
}

export interface BuiltEquipmentRuntimeCatalog {
	readonly manifest: EquipmentRuntimeVisualManifest;
	readonly generated: readonly GeneratedEquipmentRuntimeAsset[];
	readonly sourceRecords: readonly EquipmentApprovedSourceRecordV1[];
	readonly galleryHtml: string;
}

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

async function mapConcurrent<T, U>(
	values: readonly T[],
	concurrency: number,
	mapper: (value: T, index: number) => Promise<U>
): Promise<U[]> {
	const results = new Array<U>(values.length);
	let cursor = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, values.length) }, async () => {
			while (cursor < values.length) {
				const index = cursor++;
				results[index] = await mapper(values[index]!, index);
			}
		})
	);
	return results;
}

export async function generateEquipmentRuntimeAsset(
	source: Extract<EquipmentApprovedSourceRecordV1, { role: 'item' }>,
	sourceBytes: Buffer,
	approvedSourceManifestHash: string,
	profile: EquipmentExportProfile
): Promise<GeneratedEquipmentRuntimeAsset> {
	if (
		sourceBytes.byteLength !== source.approved.bytes ||
		sha256(sourceBytes) !== source.approved.sha256
	) {
		throw new Error(`Approved source changed before runtime export: ${source.assetKey}`);
	}
	const { data, info } = await sharp(sourceBytes)
		.rotate()
		.resize({
			width: profile.boundPixels,
			height: profile.boundPixels,
			fit: 'inside',
			withoutEnlargement: true
		})
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
	const publicPath = `/runtime/equipment-v1/${source.assetKey}/${profile.usage}.${contentHash.slice(0, 12)}.webp`;
	const record = EquipmentRuntimeVisualAssetSchema.parse({
		alias: `equipment.${source.assetKey}.${profile.usage}`,
		usage: profile.usage,
		sourceAssetKey: source.assetKey,
		sourceRole: source.role,
		sourceApprovalStatus: 'approved',
		sourceApprovedPath: source.approved.path,
		sourceContentHash: source.approved.sha256,
		approvedSourceManifestHash,
		file: `apps/web/static${publicPath}`,
		publicPath,
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
	});
	return { record, buffer: data };
}

function buildGallery(
	manifest: EquipmentRuntimeVisualManifest,
	sources: readonly EquipmentApprovedSourceRecordV1[]
): string {
	const galleryDirectory = dirname(EQUIPMENT_RUNTIME_REVIEW_PATH);
	const sourceByKey = new Map(sources.map((source) => [source.assetKey, source]));
	const entries = manifest.bundles.map((bundle) => {
		const source = sourceByKey.get(bundle.sourceAssetKey);
		if (!source || source.role !== 'item')
			throw new Error(`Missing gallery source: ${bundle.name}`);
		const card = bundle.assets.find(({ usage }) => usage === 'card')!;
		const detail = bundle.assets.find(({ usage }) => usage === 'detail')!;
		return {
			assetKey: source.assetKey,
			rank: source.rank,
			material: source.materialId,
			form: source.artifactId,
			equipmentClass: source.equipmentClass,
			slot: source.slot,
			sourcePath: relative(galleryDirectory, source.approved.path),
			sourceHash: source.approved.sha256,
			card: {
				path: relative(galleryDirectory, card.file),
				bytes: card.bytes,
				width: card.width,
				height: card.height,
				hash: card.contentHash
			},
			detail: {
				path: relative(galleryDirectory, detail.file),
				bytes: detail.bytes,
				width: detail.width,
				height: detail.height,
				hash: detail.contentHash
			}
		};
	});
	const data = JSON.stringify(entries).replaceAll('<', '\\u003c');
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Equipment runtime v1 review</title>
<style>
:root{color-scheme:dark;--ink:#f4ead6;--muted:#ad9f8a;--panel:#171817;--line:#3a342a;--gold:#d8a849;--bg:#0c0d0c}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -20%,#303023 0,transparent 34rem),var(--bg);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,sans-serif}header{position:sticky;z-index:3;top:0;padding:18px clamp(16px,4vw,52px);border-bottom:1px solid var(--line);background:#0c0d0ced;backdrop-filter:blur(14px)}h1{margin:0;font:700 clamp(24px,4vw,42px)/1.05 ui-serif,Georgia,serif;letter-spacing:-.03em}.lede{margin:7px 0 14px;color:var(--muted)}.stats{color:var(--gold);font-variant-numeric:tabular-nums}.controls{display:grid;grid-template-columns:2fr repeat(4,minmax(100px,1fr));gap:8px;max-width:1050px}input,select{width:100%;border:1px solid var(--line);border-radius:7px;background:#141512;color:var(--ink);padding:9px 10px}main{padding:24px clamp(12px,3vw,44px) 80px}.rank{margin:32px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line);font:700 22px ui-serif,Georgia,serif;color:var(--gold)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.item{overflow:hidden;border:1px solid var(--line);border-radius:12px;background:linear-gradient(145deg,#1b1c19,#111210);box-shadow:0 10px 30px #0005}.visuals{display:grid;grid-template-columns:1fr 1fr;align-items:end;gap:1px;background:#070807}.visual{display:grid;place-items:center;min-height:170px;background:repeating-conic-gradient(#121311 0 25%,#181a17 0 50%) 50%/16px 16px}.visual img{display:block;max-width:100%;height:auto;object-fit:contain}.visual.card img{width:128px}.visual.detail img{width:256px}.info{padding:12px 14px}.title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-weight:750}.badge{border:1px solid #775c28;border-radius:99px;padding:1px 7px;color:var(--gold)}.meta,.hashes{margin-top:5px;color:var(--muted);font-size:12px}.hashes{font-family:ui-monospace,SFMono-Regular,monospace}.source{color:#e8c983;text-decoration:none}.empty{padding:80px;text-align:center;color:var(--muted)}@media(max-width:720px){.controls{grid-template-columns:1fr 1fr}.controls input{grid-column:1/-1}.grid{grid-template-columns:1fr}.visuals{grid-template-columns:1fr 1fr}.visual.detail img{width:220px}}
</style>
</head>
<body>
<header><h1>Equipment runtime v1</h1><p class="lede">Phone-sized card/detail derivatives — approved sources remain immutable and linked below.</p><div class="stats" id="stats"></div><div class="controls"><input id="search" type="search" placeholder="Search material, form, class…"><select id="rank"><option value="">All ranks</option></select><select id="material"><option value="">All materials</option></select><select id="form"><option value="">All forms</option></select><select id="usage"><option value="both">Card + detail</option><option value="card">Card only</option><option value="detail">Detail only</option></select></div></header>
<main id="gallery"></main><script>const entries=${data};const rankOrder=['F','E','D','C','B','A','S'];const $=id=>document.getElementById(id);function fill(id,values){for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;$(id).append(option)}}fill('rank',rankOrder);fill('material',[...new Set(entries.map(x=>x.material))].sort());fill('form',[...new Set(entries.map(x=>x.form))].sort());function kb(n){return(n/1024).toFixed(1)+' KB'}function render(){const query=$('search').value.toLowerCase();const usage=$('usage').value;const filtered=entries.filter(x=>(!query||[x.assetKey,x.material,x.form,x.equipmentClass,x.slot].join(' ').toLowerCase().includes(query))&&(!$('rank').value||x.rank===$('rank').value)&&(!$('material').value||x.material===$('material').value)&&(!$('form').value||x.form===$('form').value));$('stats').textContent=filtered.length+' / 140 items · '+(filtered.length*2)+' derivatives · catalog '+${JSON.stringify(manifest.summary.totalBytes)}.toLocaleString()+' bytes';const groups=rankOrder.map(rank=>[rank,filtered.filter(x=>x.rank===rank)]).filter(([,items])=>items.length);$('gallery').innerHTML=groups.map(([rank,items])=>'<section><h2 class="rank">Rank '+rank+' · '+items.length+'</h2><div class="grid">'+items.map(x=>'<article class="item"><div class="visuals">'+(usage!=='detail'?'<a class="visual card" href="'+x.card.path+'"><img loading="lazy" src="'+x.card.path+'" alt="'+x.material+' '+x.form+' card"></a>':'')+(usage!=='card'?'<a class="visual detail" href="'+x.detail.path+'"><img loading="lazy" src="'+x.detail.path+'" alt="'+x.material+' '+x.form+' detail"></a>':'')+'</div><div class="info"><div class="title"><span>'+x.material.replaceAll('-',' ')+' '+x.form.replaceAll('-',' ')+'</span><span class="badge">'+x.rank+'</span></div><div class="meta">'+x.equipmentClass+(x.slot?' · '+x.slot:'')+' · card '+kb(x.card.bytes)+' · detail '+kb(x.detail.bytes)+'</div><div class="hashes">src '+x.sourceHash.slice(0,12)+' · card '+x.card.hash.slice(0,12)+' · detail '+x.detail.hash.slice(0,12)+'</div><a class="source" href="'+x.sourcePath+'">Open approved PNG source</a></div></article>').join('')+'</div></section>').join('')||'<div class="empty">No matching equipment.</div>'}for(const id of ['search','rank','material','form','usage'])$(id).addEventListener('input',render);render();</script></body></html>`;
}

export async function buildEquipmentRuntimeCatalog(
	workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
): Promise<BuiltEquipmentRuntimeCatalog> {
	const approvedManifestPath = resolve(workspaceRoot, EQUIPMENT_APPROVED_MANIFEST_PATH);
	const approvedManifestBytes = await readFile(approvedManifestPath);
	const approvedManifest = EquipmentApprovedSourceManifestV1Schema.parse(
		JSON.parse(approvedManifestBytes.toString('utf8'))
	);
	const approvedSourceManifestHash = sha256(approvedManifestBytes);
	const sources = approvedManifest.records.filter(
		(record): record is Extract<EquipmentApprovedSourceRecordV1, { role: 'item' }> =>
			record.role === 'item'
	);
	if (sources.length !== 140)
		throw new Error(`Expected 140 approved item sources; got ${sources.length}`);

	const generated = (
		await mapConcurrent(sources, 16, async (source) => {
			if (source.approved.path.includes('/experiments/')) {
				throw new Error(`Runtime export cannot read experiment source: ${source.assetKey}`);
			}
			const sourceBytes = await readFile(resolve(workspaceRoot, source.approved.path));
			return Promise.all(
				EQUIPMENT_EXPORT_PROFILES.map((profile) =>
					generateEquipmentRuntimeAsset(source, sourceBytes, approvedSourceManifestHash, profile)
				)
			);
		})
	).flat();

	const bundles = sources.map((source) => {
		const assets = generated
			.filter(({ record }) => record.sourceAssetKey === source.assetKey)
			.map(({ record }) => record);
		return {
			name: source.assetKey,
			sourceAssetKey: source.assetKey,
			loadPolicy: 'lazy' as const,
			bytes: assets.reduce((total, asset) => total + asset.bytes, 0),
			budgetBytes: EQUIPMENT_RUNTIME_CARD_BUDGET_BYTES + EQUIPMENT_RUNTIME_DETAIL_BUDGET_BYTES,
			budgetStatus: 'within-budget' as const,
			assets
		};
	});
	const assets = generated.map(({ record }) => record);
	const cardBytes = assets
		.filter(({ usage }) => usage === 'card')
		.reduce((sum, { bytes }) => sum + bytes, 0);
	const detailBytes = assets
		.filter(({ usage }) => usage === 'detail')
		.reduce((sum, { bytes }) => sum + bytes, 0);
	const core = {
		schemaVersion: 'equipment-runtime-visual-manifest-v1' as const,
		catalogVersion: 'equipment-v1' as const,
		exporterVersion: EQUIPMENT_RUNTIME_EXPORTER_VERSION,
		approvedSource: {
			schemaVersion: approvedManifest.schemaVersion,
			catalogId: approvedManifest.catalogId,
			manifestPath: EQUIPMENT_APPROVED_MANIFEST_PATH,
			manifestContentHash: approvedSourceManifestHash,
			createdAt: approvedManifest.createdAt,
			createdBy: approvedManifest.createdBy
		},
		loading: {
			catalogLoadPolicy: 'lazy-per-definition' as const,
			includedInInitialPhonePayload: false as const,
			initialPayloadBytes: 0 as const
		},
		profiles: EQUIPMENT_EXPORT_PROFILES,
		toolchain: {
			sharp: sharp.versions.sharp,
			vips: sharp.versions.vips,
			webp: sharp.versions.webp
		},
		summary: {
			bundleCount: 140 as const,
			assetCount: 280 as const,
			armorSetReferenceCount: 0 as const,
			cardBytes,
			detailBytes,
			totalBytes: cardBytes + detailBytes
		},
		bundles
	};
	const manifest = EquipmentRuntimeVisualManifestSchema.parse({
		...core,
		manifestHash: sha256(canonicalJson(core))
	});
	return {
		manifest,
		generated,
		sourceRecords: approvedManifest.records,
		galleryHtml: buildGallery(manifest, approvedManifest.records)
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

function assertSafeRuntimeRoot(workspaceRoot: string): string {
	const root = resolve(workspaceRoot, EQUIPMENT_RUNTIME_ROOT);
	const parent = resolve(workspaceRoot, 'apps/web/static/runtime');
	if (!root.startsWith(`${parent}${sep}`) || root === parent) {
		throw new Error('Refusing to replace an unsafe Equipment runtime output directory');
	}
	return root;
}

async function formattedManifest(manifest: EquipmentRuntimeVisualManifest): Promise<string> {
	return format(JSON.stringify(manifest), {
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
}

export async function checkEquipmentRuntimeCatalog(
	built: BuiltEquipmentRuntimeCatalog,
	workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
): Promise<void> {
	const outputRoot = assertSafeRuntimeRoot(workspaceRoot);
	const manifestPath = resolve(workspaceRoot, EQUIPMENT_RUNTIME_MANIFEST_PATH);
	const stored = EquipmentRuntimeVisualManifestSchema.parse(
		JSON.parse(await readFile(manifestPath, 'utf8'))
	);
	if (canonicalJson(stored) !== canonicalJson(built.manifest)) {
		throw new Error(
			'Checked-in Equipment runtime manifest is stale; run pnpm export:equipment-runtime-visuals'
		);
	}
	const { manifestHash: ignored, ...core } = stored;
	void ignored;
	if (stored.manifestHash !== sha256(canonicalJson(core)))
		throw new Error('Equipment runtime manifest hash is stale');
	const expected = new Set([manifestPath]);
	for (const output of built.generated) {
		const path = resolve(workspaceRoot, output.record.file);
		expected.add(path);
		const storedBytes = await readFile(path);
		if (!storedBytes.equals(output.buffer) || sha256(storedBytes) !== output.record.contentHash) {
			throw new Error(`Checked-in Equipment runtime bytes are stale: ${output.record.file}`);
		}
	}
	const extras = (await listFiles(outputRoot)).filter((path) => !expected.has(path));
	if (extras.length)
		throw new Error(`Unexpected Equipment runtime output: ${relative(workspaceRoot, extras[0]!)}`);
	const webps = [...expected].filter((path) => path.endsWith('.webp'));
	if (webps.length !== 280 || stored.bundles.length !== 140)
		throw new Error('Equipment runtime catalog count drift');
	const gallery = await readFile(resolve(workspaceRoot, EQUIPMENT_RUNTIME_REVIEW_PATH), 'utf8');
	if (gallery !== built.galleryHtml) throw new Error('Equipment runtime review gallery is stale');
}

export async function writeEquipmentRuntimeCatalog(
	built: BuiltEquipmentRuntimeCatalog,
	workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
): Promise<void> {
	const outputRoot = assertSafeRuntimeRoot(workspaceRoot);
	const stagingRoot = `${outputRoot}.staging`;
	const backupRoot = `${outputRoot}.backup`;
	await rm(stagingRoot, { recursive: true, force: true });
	await rm(backupRoot, { recursive: true, force: true });
	await mkdir(dirname(stagingRoot), { recursive: true });
	await mkdir(stagingRoot, { recursive: false });
	for (const output of built.generated) {
		const relativeOutput = relative(outputRoot, resolve(workspaceRoot, output.record.file));
		if (relativeOutput.startsWith('..') || relativeOutput.includes(`${sep}..${sep}`)) {
			throw new Error(`Unsafe staged Equipment output: ${output.record.file}`);
		}
		const destination = resolve(stagingRoot, relativeOutput);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, output.buffer, { flag: 'wx' });
	}
	await writeFile(resolve(stagingRoot, 'manifest.json'), await formattedManifest(built.manifest), {
		flag: 'wx'
	});
	const stagedFiles = await listFiles(stagingRoot);
	if (stagedFiles.length !== 281)
		throw new Error(`Staged Equipment export has ${stagedFiles.length} files; expected 281`);
	let hadPrevious = false;
	try {
		await rename(outputRoot, backupRoot);
		hadPrevious = true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	try {
		await rename(stagingRoot, outputRoot);
	} catch (error) {
		if (hadPrevious) await rename(backupRoot, outputRoot);
		throw error;
	}
	await rm(backupRoot, { recursive: true, force: true });

	const galleryPath = resolve(workspaceRoot, EQUIPMENT_RUNTIME_REVIEW_PATH);
	await mkdir(dirname(galleryPath), { recursive: true });
	const galleryStagingPath = `${galleryPath}.staging`;
	await writeFile(galleryStagingPath, built.galleryHtml);
	await rename(galleryStagingPath, galleryPath);
}

async function runCli(): Promise<void> {
	const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
	const built = await buildEquipmentRuntimeCatalog(workspaceRoot);
	const mode = process.argv.includes('--check') ? 'check' : 'write';
	if (mode === 'check') await checkEquipmentRuntimeCatalog(built, workspaceRoot);
	else await writeEquipmentRuntimeCatalog(built, workspaceRoot);
	process.stdout.write(
		`${JSON.stringify(
			{
				mode,
				catalogVersion: built.manifest.catalogVersion,
				bundles: built.manifest.summary.bundleCount,
				assets: built.manifest.summary.assetCount,
				armorSetReferences: built.manifest.summary.armorSetReferenceCount,
				cardBytes: built.manifest.summary.cardBytes,
				detailBytes: built.manifest.summary.detailBytes,
				totalBytes: built.manifest.summary.totalBytes,
				initialPayloadBytes: built.manifest.loading.initialPayloadBytes,
				manifestHash: built.manifest.manifestHash,
				review: EQUIPMENT_RUNTIME_REVIEW_PATH
			},
			null,
			2
		)}\n`
	);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) await runCli();

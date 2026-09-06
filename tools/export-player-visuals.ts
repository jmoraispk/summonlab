import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from '../packages/characters/src/index.js';
import {
	PlayerVisualManifestSchema,
	type PlayerVisualAsset,
	type PlayerVisualManifest
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';
import sharp from 'sharp';

const EXPORTER_VERSION = 'player-visual-exporter-v1' as const;
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(workspaceRoot, 'apps/web/static/runtime/player');
const manifestPath = resolve(outputRoot, 'manifest.json');

const profiles = [
	{
		usage: 'title-phone' as const,
		sourceFile: 'assets/title-gateway-background-phone-v1.png',
		width: 480,
		quality: 78,
		budgetBytes: 100_000,
		decodedMemoryBudgetBytes: 2_000_000
	},
	{
		usage: 'title-desktop' as const,
		sourceFile: 'assets/title-gateway-background-desktop-v1.png',
		width: 1_486,
		quality: 82,
		budgetBytes: 250_000,
		decodedMemoryBudgetBytes: 8_000_000
	}
] as const;

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

async function buildManifest(): Promise<{
	manifest: PlayerVisualManifest;
	generated: ReadonlyArray<{ record: PlayerVisualAsset; buffer: Buffer }>;
}> {
	const generated = await Promise.all(
		profiles.map(async (profile) => {
			const source = await readFile(resolve(workspaceRoot, profile.sourceFile));
			const sourceContentHash = sha256(source);
			const { data, info } = await sharp(source)
				.rotate()
				.resize({ width: profile.width, fit: 'inside', withoutEnlargement: true })
				.webp({
					quality: profile.quality,
					effort: 6,
					preset: 'picture',
					smartSubsample: true
				})
				.toBuffer({ resolveWithObject: true });
			const contentHash = sha256(data);
			const file = `runtime/player/${profile.usage}.${contentHash.slice(0, 12)}.webp`;
			return {
				buffer: data,
				record: PlayerVisualManifestSchema.shape.assets.element.parse({
					usage: profile.usage,
					sourceFile: profile.sourceFile,
					sourceContentHash,
					file: `apps/web/static/${file}`,
					publicPath: `/${file}`,
					width: info.width,
					height: info.height,
					bytes: data.byteLength,
					contentHash,
					budgetBytes: profile.budgetBytes,
					budgetStatus: 'within-budget',
					decodedRgbaBytes: info.width * info.height * 4,
					decodedMemoryBudgetBytes: profile.decodedMemoryBudgetBytes,
					decodedMemoryStatus: 'within-budget',
					encoder: {
						format: 'webp',
						quality: profile.quality,
						effort: 6,
						preset: 'picture',
						smartSubsample: true,
						metadata: 'stripped'
					}
				})
			};
		})
	);
	const core = {
		schemaVersion: 'player-visual-manifest-v1' as const,
		exporterVersion: EXPORTER_VERSION,
		assets: generated.map(({ record }) => record)
	};
	return {
		manifest: PlayerVisualManifestSchema.parse({
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

async function check(
	manifest: PlayerVisualManifest,
	generated: ReadonlyArray<{ record: PlayerVisualAsset; buffer: Buffer }>
) {
	const stored = PlayerVisualManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
	if (canonicalJson(stored) !== canonicalJson(manifest)) {
		throw new Error('Checked-in player visual manifest is stale; run pnpm export:player-visuals');
	}
	const expected = new Set([manifestPath]);
	for (const output of generated) {
		const path = resolve(workspaceRoot, output.record.file);
		expected.add(path);
		if (!(await readFile(path)).equals(output.buffer)) {
			throw new Error(`Checked-in player visual bytes are stale: ${output.record.file}`);
		}
	}
	const extra = (await listFiles(outputRoot)).find((path) => !expected.has(path));
	if (extra) throw new Error(`Unexpected player visual output: ${relative(workspaceRoot, extra)}`);
}

async function write(
	manifest: PlayerVisualManifest,
	generated: ReadonlyArray<{ record: PlayerVisualAsset; buffer: Buffer }>
) {
	await rm(outputRoot, { recursive: true, force: true });
	await mkdir(outputRoot, { recursive: true });
	for (const output of generated) {
		const path = resolve(workspaceRoot, output.record.file);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, output.buffer);
	}
	await writeFile(
		manifestPath,
		await format(JSON.stringify(manifest), {
			parser: 'json',
			useTabs: true,
			printWidth: 100,
			trailingComma: 'none'
		})
	);
}

const { manifest, generated } = await buildManifest();
if (process.argv.includes('--check')) await check(manifest, generated);
else await write(manifest, generated);

process.stdout.write(
	`${JSON.stringify(
		{
			manifestHash: manifest.manifestHash,
			assets: manifest.assets.map(({ usage, bytes, budgetBytes, decodedRgbaBytes }) => ({
				usage,
				bytes,
				budgetBytes,
				decodedRgbaBytes
			}))
		},
		null,
		2
	)}\n`
);

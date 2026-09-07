import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SummonableHeroCatalogSchema } from '../packages/contracts/src/index.js';
import sharp from 'sharp';

import catalogSource from '../assets/heroes/approved/summonable-roster-v1/catalog.json';
import {
	VILLAGE_CUTOUT_BACKFILL_HERO_IDS,
	VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH,
	VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH,
	VillageCutoutBackfillManifestSchema,
	buildVillageCutoutBackfillManifest,
	stableVillageCutoutJson,
	validateVillageCutoutCandidate,
	villageCutoutSha256
} from './village-cutout-backfill-lib.js';

type ExportMode = 'write' | 'check';

function ownedAbsolutePath(repositoryRoot: string, repositoryPath: string): string {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${sep}`)) throw new Error('Backfill path escapes repository');
	return absolute;
}

async function requireRegularFile(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolute = ownedAbsolutePath(repositoryRoot, repositoryPath);
	const metadata = await lstat(absolute);
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error(`Backfill input must be a real file: ${repositoryPath}`);
	}
	return readFile(absolute);
}

async function outputExists(repositoryRoot: string, repositoryPath: string): Promise<boolean> {
	try {
		await lstat(ownedAbsolutePath(repositoryRoot, repositoryPath));
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function ensureRealParents(repositoryRoot: string, repositoryPath: string): Promise<void> {
	const root = resolve(repositoryRoot);
	const parent = dirname(ownedAbsolutePath(repositoryRoot, repositoryPath));
	const parts = parent
		.slice(root.length + 1)
		.split(sep)
		.filter(Boolean);
	let cursor = root;
	for (const part of parts) {
		cursor = `${cursor}${sep}${part}`;
		try {
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
				throw new Error(`Backfill output parent must be a real directory: ${cursor}`);
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			await mkdir(cursor);
		}
	}
}

async function exclusiveCreate(
	repositoryRoot: string,
	repositoryPath: string,
	bytes: Buffer
): Promise<void> {
	await ensureRealParents(repositoryRoot, repositoryPath);
	await writeFile(ownedAbsolutePath(repositoryRoot, repositoryPath), bytes, { flag: 'wx' });
}

function checkerboardSvg(): Buffer {
	const tile = 48;
	const cells: string[] = [];
	for (let y = 0; y < 1152; y += tile) {
		for (let x = 0; x < 768; x += tile) {
			if ((x / tile + y / tile) % 2 === 0) continue;
			cells.push(`<rect x="${x}" y="${y}" width="${tile}" height="${tile}"/>`);
		}
	}
	return Buffer.from(
		`<svg width="768" height="1152" xmlns="http://www.w3.org/2000/svg"><rect width="768" height="1152" fill="#d7d2c8"/><g fill="#bdb8ae">${cells.join('')}</g></svg>`
	);
}

async function composeReviewSheet(
	repositoryRoot: string,
	heroes: readonly {
		readonly summonPath: string;
		readonly candidateBytes: Buffer;
	}[]
): Promise<Buffer> {
	const checkerboard = checkerboardSvg();
	const composites = [];
	for (const [index, hero] of heroes.entries()) {
		const top = index * 1152;
		const summon = await sharp(ownedAbsolutePath(repositoryRoot, hero.summonPath))
			.resize(768, 1152, { fit: 'fill' })
			.png()
			.toBuffer();
		const cutout = await sharp(hero.candidateBytes)
			.resize(768, 1152, { fit: 'fill' })
			.png()
			.toBuffer();
		composites.push(
			{ input: summon, left: 0, top },
			{ input: checkerboard, left: 768, top },
			{ input: cutout, left: 768, top }
		);
	}
	return sharp({
		create: {
			width: 1536,
			height: 3456,
			channels: 4,
			background: { r: 215, g: 210, b: 200, alpha: 1 }
		}
	})
		.composite(composites)
		.png({ compressionLevel: 9 })
		.toBuffer();
}

async function observedModelSha256(
	mode: ExportMode,
	manifestBytes: Buffer | null
): Promise<string> {
	if (mode === 'check') {
		if (!manifestBytes) throw new Error('Village cutout manifest is missing');
		const parsed = VillageCutoutBackfillManifestSchema.parse(
			JSON.parse(manifestBytes.toString('utf8'))
		);
		return parsed.isolation.model.sha256;
	}
	const modelHome = process.env.U2NET_HOME;
	if (!modelHome) throw new Error('U2NET_HOME must bind the task-specific rembg model directory');
	const modelPath = resolve(modelHome, 'models/u2net_human_seg/u2net_human_seg.onnx');
	const metadata = await lstat(modelPath);
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error('The rembg model must be a real file in U2NET_HOME');
	}
	return villageCutoutSha256(await readFile(modelPath));
}

export async function exportVillageCutoutReview(
	repositoryRoot = process.cwd(),
	mode: ExportMode = 'check'
): Promise<{
	readonly batchId: 'village-cutout-backfill-20260906-current-company-001';
	readonly heroIds: readonly ['yaso-dreno', 'oren-sorin', 'joror-pelleth'];
	readonly manifestSha256: string;
	readonly reviewSheetPath: typeof VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH;
}> {
	const manifestPresent = await outputExists(repositoryRoot, VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH);
	const reviewPresent = await outputExists(repositoryRoot, VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH);
	if (mode === 'write' && (manifestPresent || reviewPresent)) {
		throw new Error('Refusing to overwrite existing Village cutout review evidence');
	}
	if (mode === 'check' && (!manifestPresent || !reviewPresent)) {
		throw new Error('Village cutout review evidence is incomplete');
	}
	const existingManifestBytes = manifestPresent
		? await requireRegularFile(repositoryRoot, VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH)
		: null;
	const modelSha256 = await observedModelSha256(mode, existingManifestBytes);
	const catalog = SummonableHeroCatalogSchema.parse(catalogSource);
	const candidateHashes = {} as Record<(typeof VILLAGE_CUTOUT_BACKFILL_HERO_IDS)[number], string>;
	const reviewHeroes = [];
	for (const heroId of VILLAGE_CUTOUT_BACKFILL_HERO_IDS) {
		const entry = catalog.entries.find((candidate) => candidate.heroId === heroId);
		if (!entry) throw new Error(`Approved catalog is missing ${heroId}`);
		const summonBytes = await requireRegularFile(repositoryRoot, entry.visuals.summon.file);
		if (villageCutoutSha256(summonBytes) !== entry.visuals.summon.contentHash) {
			throw new Error(`Approved summon bytes drifted for ${heroId}`);
		}
		const base = `assets/heroes/experiments/village-cutout-backfill-20260906-current-company-001/heroes/${heroId}`;
		const providerBytes = await requireRegularFile(
			repositoryRoot,
			`${base}/provider-source-v1.png`
		);
		const candidateBytes = await requireRegularFile(repositoryRoot, `${base}/candidate-v1.png`);
		if (!providerBytes.equals(candidateBytes)) {
			throw new Error(`Provider and candidate bytes differ for ${heroId}`);
		}
		await validateVillageCutoutCandidate(candidateBytes);
		candidateHashes[heroId] = villageCutoutSha256(candidateBytes);
		reviewHeroes.push({ summonPath: entry.visuals.summon.file, candidateBytes });
	}
	const manifest = buildVillageCutoutBackfillManifest(catalog, VILLAGE_CUTOUT_BACKFILL_HERO_IDS, {
		candidateHashes,
		modelSha256
	});
	const manifestBytes = Buffer.from(stableVillageCutoutJson(manifest));
	const reviewBytes = await composeReviewSheet(repositoryRoot, reviewHeroes);
	if (mode === 'write') {
		await exclusiveCreate(repositoryRoot, VILLAGE_CUTOUT_BACKFILL_MANIFEST_PATH, manifestBytes);
		await exclusiveCreate(repositoryRoot, VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH, reviewBytes);
	} else {
		if (!existingManifestBytes?.equals(manifestBytes)) {
			throw new Error('Village cutout backfill manifest is stale or divergent');
		}
		const existingReviewBytes = await requireRegularFile(
			repositoryRoot,
			VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH
		);
		if (!existingReviewBytes.equals(reviewBytes)) {
			throw new Error('Village cutout review sheet is stale or divergent');
		}
	}
	return {
		batchId: 'village-cutout-backfill-20260906-current-company-001',
		heroIds: VILLAGE_CUTOUT_BACKFILL_HERO_IDS,
		manifestSha256: villageCutoutSha256(manifestBytes),
		reviewSheetPath: VILLAGE_CUTOUT_BACKFILL_REVIEW_PATH
	};
}

async function main(): Promise<void> {
	const arguments_ = process.argv.slice(2);
	if (arguments_.some((argument) => argument !== '--write' && argument !== '--check')) {
		throw new Error(`Unknown arguments: ${arguments_.join(' ')}`);
	}
	if (arguments_.includes('--write') && arguments_.includes('--check')) {
		throw new Error('Choose exactly one export mode');
	}
	const mode: ExportMode = arguments_.includes('--write') ? 'write' : 'check';
	console.log(JSON.stringify(await exportVillageCutoutReview(process.cwd(), mode)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}

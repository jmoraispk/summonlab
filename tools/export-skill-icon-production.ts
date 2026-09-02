import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	buildSkillIconCatalog,
	loadCanonicalSkillRows,
	parseAcceptedMotifMap,
	summarizeSkillIconCatalog,
	type SkillIconVisualSpecs
} from './skill-icon-production-lib.js';

export const SKILL_ICON_MOTIF_SOURCE_PATH =
	'docs/superpowers/specs/2026-09-01-skill-icon-motif-map.md' as const;
export const SKILL_ICON_MOTIF_MAP_PATH =
	'assets/wiki/skills/icon-production-v1/motif-map.json' as const;
export const SKILL_ICON_VISUAL_SPECS_PATH =
	'assets/wiki/skills/icon-production-v1/visual-specs.json' as const;
export const SKILL_ICON_CATALOG_PATH =
	'assets/wiki/skills/icon-production-v1/catalog.json' as const;

export type SkillIconProductionExportMode = 'check' | 'write';

export interface SkillIconProductionExportReport {
	readonly mode: SkillIconProductionExportMode;
	readonly inSync: boolean;
	readonly written: readonly string[];
	readonly files: readonly { path: string; current: boolean; sha256: string }[];
	readonly summary: ReturnType<typeof summarizeSkillIconCatalog>;
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function regularFileBytes(filePath: string): Promise<Buffer | null> {
	const metadata = await lstat(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (!metadata) return null;
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Refusing non-regular skill icon catalog path: ${filePath}`);
	}
	return readFile(filePath);
}

function isInside(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function metadataOrNull(filePath: string) {
	return lstat(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
}

async function assertSafeDestination(
	root: string,
	destination: string,
	createParents: boolean
): Promise<void> {
	const realRoot = await realpath(root);
	const relativeDestination = path.relative(root, destination);
	if (
		relativeDestination === '' ||
		path.isAbsolute(relativeDestination) ||
		relativeDestination === '..' ||
		relativeDestination.startsWith(`..${path.sep}`)
	) {
		throw new Error(`Skill icon output resolves outside workspace root: ${destination}`);
	}

	const parentRelative = path.dirname(relativeDestination);
	const segments = parentRelative === '.' ? [] : parentRelative.split(path.sep);
	let cursor = root;
	for (const segment of segments) {
		cursor = path.join(cursor, segment);
		let metadata = await metadataOrNull(cursor);
		if (!metadata) {
			if (!createParents) return;
			await mkdir(cursor).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== 'EEXIST') throw error;
			});
			metadata = await metadataOrNull(cursor);
		}
		if (metadata?.isSymbolicLink()) {
			throw new Error(`Refusing symbolic link ancestor in skill icon output path: ${cursor}`);
		}
		if (!metadata?.isDirectory()) {
			throw new Error(`Skill icon output ancestor is not a directory: ${cursor}`);
		}
		const realCursor = await realpath(cursor);
		if (!isInside(realRoot, realCursor)) {
			throw new Error(`Skill icon output parent resolves outside real workspace root: ${cursor}`);
		}
	}

	const destinationMetadata = await metadataOrNull(destination);
	if (destinationMetadata?.isSymbolicLink()) {
		throw new Error(`Refusing symbolic link skill icon output destination: ${destination}`);
	}
	if (destinationMetadata && !destinationMetadata.isFile()) {
		throw new Error(`Skill icon output destination is not a regular file: ${destination}`);
	}
}

async function writeAtomically(destination: string, bytes: Buffer): Promise<void> {
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}.tmp`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(temporary, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await rename(temporary, destination);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
}

function seedVisualSpecs(targetIds: readonly string[]): SkillIconVisualSpecs {
	return {
		schemaVersion: 'skill-icon-visual-specs-v1',
		records: targetIds.map((targetId) => ({
			targetId,
			status: 'mapped',
			visualSpec: null,
			assets: null,
			review: null
		}))
	};
}

export async function exportSkillIconProduction(options: {
	readonly root?: string;
	readonly mode: SkillIconProductionExportMode;
}): Promise<SkillIconProductionExportReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const rows = await loadCanonicalSkillRows(root);
	if (rows.length !== 456)
		throw new Error(`Expected exactly 456 canonical skills, found ${rows.length}`);
	const domainCounts = Object.fromEntries(
		(['Martial', 'Magical', 'Craft'] as const).map((domain) => [
			domain,
			rows.filter((row) => row.domain === domain).length
		])
	);
	if (domainCounts.Martial !== 258 || domainCounts.Magical !== 124 || domainCounts.Craft !== 74) {
		throw new Error(
			`Expected canonical domain counts 258/124/74, found ${domainCounts.Martial}/${domainCounts.Magical}/${domainCounts.Craft}`
		);
	}
	const motifMarkdown = await readFile(path.resolve(root, SKILL_ICON_MOTIF_SOURCE_PATH), 'utf8');
	const motifMap = parseAcceptedMotifMap(motifMarkdown, rows);
	const visualSpecsDestination = path.resolve(root, SKILL_ICON_VISUAL_SPECS_PATH);
	await assertSafeDestination(root, visualSpecsDestination, false);
	const currentVisualBytes = await regularFileBytes(visualSpecsDestination);
	const visualSpecs = currentVisualBytes
		? (JSON.parse(currentVisualBytes.toString('utf8')) as SkillIconVisualSpecs)
		: seedVisualSpecs(rows.map((row) => row.targetId));
	const catalog = buildSkillIconCatalog(rows, motifMap, visualSpecs);
	const summary = summarizeSkillIconCatalog(catalog);
	if (
		summary.mapped !== 456 ||
		summary.mapEntries !== 124 ||
		summary.calibrationFamilies !== 104 ||
		summary.standalones !== 20 ||
		summary.longestLineage !== 12
	) {
		throw new Error(`Accepted motif map has unexpected coverage: ${JSON.stringify(summary)}`);
	}

	const outputs = [
		{ path: SKILL_ICON_MOTIF_MAP_PATH, bytes: jsonBytes(motifMap), source: false },
		{
			path: SKILL_ICON_VISUAL_SPECS_PATH,
			bytes: currentVisualBytes ?? jsonBytes(visualSpecs),
			source: true
		},
		{ path: SKILL_ICON_CATALOG_PATH, bytes: jsonBytes(catalog), source: false }
	] as const;
	const files: { path: string; current: boolean; sha256: string }[] = [];
	const written: string[] = [];
	for (const output of outputs) {
		const destination = path.resolve(root, output.path);
		await assertSafeDestination(root, destination, false);
		const current = await regularFileBytes(destination);
		const matches = current?.equals(output.bytes) ?? false;
		if (options.mode === 'write' && !matches) {
			if (output.source && current !== null) {
				throw new Error(`Refusing to rewrite authored visual state: ${output.path}`);
			}
			await assertSafeDestination(root, destination, true);
			await writeAtomically(destination, output.bytes);
			written.push(output.path);
		}
		files.push({
			path: output.path,
			current: options.mode === 'write' ? true : matches,
			sha256: sha256(output.bytes)
		});
	}

	return {
		mode: options.mode,
		inSync: files.every((file) => file.current),
		written,
		files,
		summary
	};
}

function parseMode(args: readonly string[]): SkillIconProductionExportMode {
	if (args.length !== 1 || !['--check', '--write'].includes(args[0] ?? '')) {
		throw new Error('Usage: tsx tools/export-skill-icon-production.ts --check|--write');
	}
	return args[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	exportSkillIconProduction({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => {
			for (const file of report.files) {
				process.stdout.write(`${file.current ? 'current' : 'stale'} ${file.path} ${file.sha256}\n`);
			}
			process.stdout.write(
				`${report.summary.canonical} canonical, ${report.summary.mapped} mapped, ${report.summary.mapEntries} map entries, ${report.summary.calibrationFamilies} calibration families, ${report.summary.standalones} standalones, longest lineage ${report.summary.longestLineage}\n`
			);
			if (!report.inSync) process.exitCode = 1;
		})
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}

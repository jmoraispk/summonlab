import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	buildSkillIconCatalog,
	loadCanonicalSkillRows,
	summarizeSkillIconCatalog,
	type SkillIconMotifMap,
	type SkillIconVisualSpecs
} from './skill-icon-production-lib.js';

export const SKILL_ICON_ROOT = 'assets/wiki/skills/icon-production-v2' as const;
export const SKILL_ICON_MOTIF_MAP_PATH = `${SKILL_ICON_ROOT}/motif-map.json` as const;
export const SKILL_ICON_VISUAL_SPECS_PATH = `${SKILL_ICON_ROOT}/visual-specs.json` as const;
export const SKILL_ICON_CATALOG_PATH = `${SKILL_ICON_ROOT}/catalog.json` as const;

export type SkillIconProductionExportMode = 'check' | 'write';

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function regularFile(filePath: string): Promise<Buffer> {
	const metadata = await lstat(filePath);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Expected regular file: ${filePath}`);
	return readFile(filePath);
}

async function writeAtomically(destination: string, bytes: Buffer): Promise<void> {
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.close();
		handle = undefined;
		await rename(stage, destination);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

export async function exportSkillIconProduction(options: {
	readonly root?: string;
	readonly mode: SkillIconProductionExportMode;
}) {
	const root = path.resolve(options.root ?? process.cwd());
	const [rows, motifBytes, visualBytes] = await Promise.all([
		loadCanonicalSkillRows(root),
		regularFile(path.join(root, SKILL_ICON_MOTIF_MAP_PATH)),
		regularFile(path.join(root, SKILL_ICON_VISUAL_SPECS_PATH))
	]);
	const motifMap = JSON.parse(motifBytes.toString('utf8')) as SkillIconMotifMap;
	const visualSpecs = JSON.parse(visualBytes.toString('utf8')) as SkillIconVisualSpecs;
	const catalog = buildSkillIconCatalog(rows, motifMap, visualSpecs);
	const output = Buffer.from(`${JSON.stringify(catalog, null, '\t')}\n`);
	const destination = path.join(root, SKILL_ICON_CATALOG_PATH);
	const current = await regularFile(destination);
	const inSync = current.equals(output);
	if (options.mode === 'write' && !inSync) await writeAtomically(destination, output);
	return {
		mode: options.mode,
		inSync: options.mode === 'write' ? true : inSync,
		written: options.mode === 'write' && !inSync ? [SKILL_ICON_CATALOG_PATH] : [],
		files: [
			{
				path: SKILL_ICON_CATALOG_PATH,
				current: options.mode === 'write' || inSync,
				sha256: sha256(output)
			}
		],
		summary: summarizeSkillIconCatalog(catalog)
	};
}

function mode(): SkillIconProductionExportMode {
	const value = process.argv.at(-1);
	if (value === '--write' || value === '--check')
		return value.slice(2) as SkillIconProductionExportMode;
	throw new Error('Usage: tsx tools/export-skill-icon-production.ts --write|--check');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const report = await exportSkillIconProduction({ mode: mode() });
	for (const file of report.files) {
		process.stdout.write(`${file.current ? 'current' : 'stale'} ${file.path} ${file.sha256}\n`);
	}
	process.stdout.write(`${report.summary.canonical} canonical skills\n`);
	if (!report.inSync) process.exitCode = 1;
}

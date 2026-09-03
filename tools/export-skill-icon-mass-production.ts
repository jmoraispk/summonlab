import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { SkillIconCatalogSchema } from '../packages/contracts/src/index.js';
import { exportSkillIconProduction } from './export-skill-icon-production.js';
import type { SkillIconMotifMap, SkillIconVisualSpecs } from './skill-icon-production-lib.js';
import {
	buildMassProductionManifest,
	inferredVisualSpec,
	MASS_PRODUCTION_FRAME_AUTHORITY_HASH,
	MASS_PRODUCTION_FRAME_AUTHORITY_PATH,
	MASS_PRODUCTION_MANIFEST_PATH,
	sha256
} from './skill-icon-mass-production-lib.js';

const CATALOG_PATH = 'assets/wiki/skills/icon-production-v1/catalog.json';
const MOTIF_MAP_PATH = 'assets/wiki/skills/icon-production-v1/motif-map.json';
const VISUAL_SPECS_PATH = 'assets/wiki/skills/icon-production-v1/visual-specs.json';

type Mode = 'check' | 'write';

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

async function regularBytes(filePath: string): Promise<Buffer | null> {
	const metadata = await lstat(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (!metadata) return null;
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Refusing non-regular mass-production path: ${filePath}`);
	}
	return readFile(filePath);
}

async function writeAtomic(destination: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(destination), { recursive: true });
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await rename(stage, destination);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

async function syncFile(
	root: string,
	relativePath: string,
	expected: Buffer,
	mode: Mode
): Promise<boolean> {
	const destination = path.resolve(root, relativePath);
	const current = await regularBytes(destination);
	if (current?.equals(expected)) return true;
	if (mode === 'check') return false;
	await writeAtomic(destination, expected);
	return true;
}

function parseMode(args: readonly string[]): Mode {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--check', '--write'].includes(normalized[0] ?? '')) {
		throw new Error('Usage: tsx tools/export-skill-icon-mass-production.ts --check|--write');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

export async function exportSkillIconMassProduction(options: {
	readonly root?: string;
	readonly mode: Mode;
}): Promise<{ readonly current: number; readonly total: number }> {
	const root = path.resolve(options.root ?? process.cwd());
	let catalogBytes = await readFile(path.resolve(root, CATALOG_PATH));
	const motifBytes = await readFile(path.resolve(root, MOTIF_MAP_PATH));
	let visualBytes = await readFile(path.resolve(root, VISUAL_SPECS_PATH));
	const frameBytes = await readFile(path.resolve(root, MASS_PRODUCTION_FRAME_AUTHORITY_PATH));
	if (sha256(frameBytes) !== MASS_PRODUCTION_FRAME_AUTHORITY_HASH) {
		throw new Error('Approved seven-frame authority hash does not match the owner-selected source');
	}
	let catalog = SkillIconCatalogSchema.parse(JSON.parse(catalogBytes.toString('utf8')));
	const visualSpecs = JSON.parse(visualBytes.toString('utf8')) as SkillIconVisualSpecs;
	const stateById = new Map(visualSpecs.records.map((record) => [record.targetId, record]));
	const unAuthored = catalog.records.filter((record) => record.visualSpec === null);
	if (unAuthored.length > 0 && options.mode === 'write') {
		const nextVisualSpecs: SkillIconVisualSpecs = {
			schemaVersion: 'skill-icon-visual-specs-v1',
			records: catalog.records.map((record) => {
				const state = stateById.get(record.targetId);
				if (!state) throw new Error(`Missing visual state for ${record.targetId}`);
				if (record.visualSpec !== null) return state;
				return {
					targetId: record.targetId,
					status: 'authored' as const,
					visualSpec: inferredVisualSpec(record),
					assets: null,
					review: null
				};
			})
		};
		await writeAtomic(path.resolve(root, VISUAL_SPECS_PATH), jsonBytes(nextVisualSpecs));
		await exportSkillIconProduction({ root, mode: 'write' });
		visualBytes = await readFile(path.resolve(root, VISUAL_SPECS_PATH));
		catalogBytes = await readFile(path.resolve(root, CATALOG_PATH));
		catalog = SkillIconCatalogSchema.parse(JSON.parse(catalogBytes.toString('utf8')));
	}
	if (catalog.records.some((record) => record.visualSpec === null)) {
		throw new Error('Mass production requires authored visual specifications for every skill');
	}
	const motifMap = JSON.parse(motifBytes.toString('utf8')) as SkillIconMotifMap;
	const built = buildMassProductionManifest({
		catalog,
		motifMap,
		hashes: {
			catalog: sha256(catalogBytes),
			motifMap: sha256(motifBytes),
			visualSpecs: sha256(visualBytes)
		}
	});
	const outputs: { path: string; bytes: Buffer }[] = [
		{ path: MASS_PRODUCTION_MANIFEST_PATH, bytes: jsonBytes(built.manifest) },
		...built.familyPrompts.map((packet) => ({
			path: built.manifest.families.find((family) => family.familyId === packet.identity)!
				.promptPath,
			bytes: jsonBytes(packet)
		})),
		...built.skillPrompts.map((packet) => ({
			path: built.manifest.skills.find((skill) => skill.targetId === packet.identity)!.promptPath,
			bytes: jsonBytes(packet)
		})),
		...built.manifest.families.map((family) => ({
			path: family.cellMapPath,
			bytes: jsonBytes({
				schemaVersion: 'skill-icon-family-cell-map-v1',
				familyId: family.familyId,
				columns: 4,
				rows: Math.ceil(family.memberTargetIds.length / 4),
				cells: family.memberTargetIds.map((targetId, index) => {
					const skill = built.manifest.skills.find((record) => record.targetId === targetId)!;
					return {
						index: index + 1,
						targetId,
						name: skill.name,
						rarity: skill.rarity,
						row: Math.floor(index / 4) + 1,
						column: (index % 4) + 1
					};
				})
			})
		}))
	];
	let current = 0;
	for (const output of outputs) {
		if (await syncFile(root, output.path, output.bytes, options.mode)) current += 1;
	}
	process.stdout.write(
		`${options.mode}: ${current}/${outputs.length} current files; ${built.manifest.expected.families} families; ${built.manifest.expected.skills} skills; frame ${createHash('sha256').update(frameBytes).digest('hex')}\n`
	);
	if (current !== outputs.length) process.exitCode = 1;
	return { current, total: outputs.length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	exportSkillIconMassProduction({ mode: parseMode(process.argv.slice(2)) }).catch(
		(error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		}
	);
}

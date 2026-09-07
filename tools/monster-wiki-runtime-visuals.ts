import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import type {
	CanonicalMonsterWikiDatabase,
	MonsterWikiPresentationStatus
} from './wiki-monster-database-lib.js';

const CATALOG_SCHEMA = 'monster-wiki-visual-catalog-v1' as const;
const EXPORTER_VERSION = 'monster-wiki-visual-exporter-v1' as const;
const OUTPUT_ROOT = 'apps/web/static/runtime/enemies/monster-wiki-v1';
const CATALOG_PATH = 'assets/enemies/runtime/monster-wiki-v1/catalog.json';
const MAX_DIMENSION = 640;
const MAX_DERIVATIVE_BYTES = 180_000;
const MAX_GENERATED_BYTES = 75_000_000;
const ENCODER_CONCURRENCY = 4;

export type FaunaRuntimeCatalog = {
	schemaVersion: 'fauna-family-runtime-catalog-v1';
	records: Array<{
		coordinateId: string;
		familyId: string;
		formId: string;
		affinity: string;
		source: { path: string; sha256: string };
		runtime: {
			path: string;
			publicUrl: string;
			sha256: string;
			width: number;
			height: number;
			bytes: number;
		};
	}>;
};

type PlannedBaseRecord = {
	coordinateId: string;
	familyId: string;
	formId: string;
	affinity: string;
	presentationStatus: MonsterWikiPresentationStatus;
	sourcePath: string;
	sourceSha256: string;
};

export type PlannedGeneratedRecord = PlannedBaseRecord & { delivery: 'generate' };

export type PlannedReusedRecord = PlannedBaseRecord & {
	delivery: 'reuse';
	runtime: FaunaRuntimeCatalog['records'][number]['runtime'];
};

export type PlannedMonsterWikiVisualRecord = PlannedGeneratedRecord | PlannedReusedRecord;

export type MonsterWikiVisualPlan = {
	records: PlannedMonsterWikiVisualRecord[];
	generated: PlannedGeneratedRecord[];
	reused: PlannedReusedRecord[];
};

export type GeneratedMonsterWikiDerivative = PlannedGeneratedRecord & {
	buffer: Buffer;
	path: string;
	publicUrl: string;
	sha256: string;
	width: number;
	height: number;
	bytes: number;
};

export type MonsterWikiVisualCatalogRecord = PlannedBaseRecord & {
	delivery: 'generated' | 'reused';
	runtime: {
		path: string;
		publicUrl: string;
		sha256: string;
		width: number;
		height: number;
		bytes: number;
	};
};

export type MonsterWikiVisualCatalog = {
	schemaVersion: typeof CATALOG_SCHEMA;
	exporterVersion: typeof EXPORTER_VERSION;
	familyCount: 38;
	formCount: 190;
	coordinateCount: 950;
	generatedCount: 750;
	reusedCount: 200;
	generatedBytes: number;
	encoder: {
		format: 'webp';
		maxDimension: 640;
		quality: 72;
		effort: 4;
		preset: 'picture';
		smartSubsample: true;
		metadata: 'stripped';
	};
	records: MonsterWikiVisualCatalogRecord[];
};

function sha256(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function faunaBindingError(coordinateId: string): never {
	throw new Error(`Monster wiki fauna runtime binding drift: ${coordinateId}`);
}

export function buildMonsterWikiVisualPlan(
	database: CanonicalMonsterWikiDatabase,
	faunaCatalog: FaunaRuntimeCatalog
): MonsterWikiVisualPlan {
	if (
		database.counts.families !== 38 ||
		database.counts.forms !== 190 ||
		database.counts.coordinates !== 950 ||
		faunaCatalog.schemaVersion !== 'fauna-family-runtime-catalog-v1' ||
		faunaCatalog.records.length !== 200
	) {
		throw new Error('Monster wiki visual plan requires the complete integrated database');
	}
	const faunaByCoordinate = new Map(
		faunaCatalog.records.map((record) => [record.coordinateId, record])
	);
	if (faunaByCoordinate.size !== 200) {
		throw new Error('Monster wiki fauna runtime catalog contains duplicate coordinates');
	}

	const records: PlannedMonsterWikiVisualRecord[] = [];
	for (const family of database.families) {
		for (const form of family.forms) {
			for (const coordinate of form.coordinates) {
				if (!coordinate.sourceContentHash) {
					throw new Error(
						`Monster wiki coordinate lacks source evidence: ${coordinate.coordinateId}`
					);
				}
				const base: PlannedBaseRecord = {
					coordinateId: coordinate.coordinateId,
					familyId: family.familyId,
					formId: form.formId,
					affinity: coordinate.affinity,
					presentationStatus: coordinate.presentationStatus,
					sourcePath: coordinate.approvedPath ?? coordinate.candidatePath,
					sourceSha256: coordinate.sourceContentHash
				};
				if (coordinate.presentationStatus !== 'runtime') {
					records.push({ ...base, delivery: 'generate' });
					continue;
				}
				const fauna = faunaByCoordinate.get(coordinate.coordinateId);
				if (
					!fauna ||
					fauna.familyId !== family.familyId ||
					fauna.formId !== form.formId ||
					fauna.affinity !== coordinate.affinity ||
					fauna.source.path !== base.sourcePath ||
					fauna.source.sha256 !== base.sourceSha256 ||
					fauna.runtime.path !== coordinate.runtimePath ||
					fauna.runtime.publicUrl !== coordinate.runtimePublicUrl ||
					!/^apps\/web\/static\/runtime\/enemies\/fauna-family-v1\//u.test(fauna.runtime.path) ||
					!/^\/runtime\/enemies\/fauna-family-v1\//u.test(fauna.runtime.publicUrl) ||
					!Number.isInteger(fauna.runtime.width) ||
					!Number.isInteger(fauna.runtime.height) ||
					!Number.isInteger(fauna.runtime.bytes) ||
					!/^[a-f0-9]{64}$/u.test(fauna.runtime.sha256)
				) {
					faunaBindingError(coordinate.coordinateId);
				}
				records.push({ ...base, delivery: 'reuse', runtime: fauna.runtime });
			}
		}
	}
	if (
		records.length !== 950 ||
		new Set(records.map(({ coordinateId }) => coordinateId)).size !== 950
	) {
		throw new Error('Monster wiki visual plan must contain 950 unique coordinates');
	}
	const generated = records.filter(
		(record): record is PlannedGeneratedRecord => record.delivery === 'generate'
	);
	const reused = records.filter(
		(record): record is PlannedReusedRecord => record.delivery === 'reuse'
	);
	if (generated.length !== 750 || reused.length !== 200) {
		throw new Error('Monster wiki visual plan must generate 750 and reuse 200 coordinates');
	}
	return { records, generated, reused };
}

export async function encodeMonsterWikiDerivative(
	repositoryRoot: string,
	source: PlannedGeneratedRecord
): Promise<GeneratedMonsterWikiDerivative> {
	const sourceBytes = await readFile(resolve(repositoryRoot, source.sourcePath));
	if (sha256(sourceBytes) !== source.sourceSha256) {
		throw new Error(`Monster wiki source hash drift: ${source.coordinateId}`);
	}
	const { data, info } = await sharp(sourceBytes)
		.rotate()
		.resize({
			width: MAX_DIMENSION,
			height: MAX_DIMENSION,
			fit: 'inside',
			withoutEnlargement: true
		})
		.webp({
			quality: 72,
			effort: 4,
			preset: 'picture',
			smartSubsample: true
		})
		.toBuffer({ resolveWithObject: true });
	if (data.byteLength > MAX_DERIVATIVE_BYTES) {
		throw new Error(
			`Monster wiki derivative exceeds ${MAX_DERIVATIVE_BYTES} bytes: ${source.coordinateId}`
		);
	}
	const derivativeSha256 = sha256(data);
	const path = `${OUTPUT_ROOT}/${source.familyId}/${source.formId}/${source.affinity}.${derivativeSha256.slice(0, 12)}.webp`;
	return {
		...source,
		buffer: data,
		path,
		publicUrl: `/${path.replace(/^apps\/web\/static\//u, '')}`,
		sha256: derivativeSha256,
		width: info.width,
		height: info.height,
		bytes: data.byteLength
	};
}

async function mapConcurrent<T, U>(
	values: readonly T[],
	worker: (value: T) => Promise<U>
): Promise<U[]> {
	const output = new Array<U>(values.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: ENCODER_CONCURRENCY }, async () => {
			while (next < values.length) {
				const index = next++;
				output[index] = await worker(values[index]!);
			}
		})
	);
	return output;
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

function catalogText(catalog: MonsterWikiVisualCatalog): string {
	return `${JSON.stringify(catalog, null, 2)}\n`;
}

type MonsterWikiDerivativeEncoder = (
	repositoryRoot: string,
	source: PlannedGeneratedRecord
) => Promise<GeneratedMonsterWikiDerivative>;

export async function syncMonsterWikiRuntimeVisuals(
	repositoryRoot: string,
	database: CanonicalMonsterWikiDatabase,
	mode: 'write' | 'check',
	encode: MonsterWikiDerivativeEncoder = encodeMonsterWikiDerivative
): Promise<MonsterWikiVisualCatalog> {
	const faunaCatalog = JSON.parse(
		await readFile(
			resolve(repositoryRoot, 'assets/enemies/runtime/fauna-family-v1/catalog.json'),
			'utf8'
		)
	) as FaunaRuntimeCatalog;
	const plan = buildMonsterWikiVisualPlan(database, faunaCatalog);
	const generated = await mapConcurrent(plan.generated, (source) => encode(repositoryRoot, source));
	const generatedBytes = generated.reduce((total, derivative) => total + derivative.bytes, 0);
	if (generatedBytes > MAX_GENERATED_BYTES) {
		throw new Error(
			`Monster wiki derivatives total ${generatedBytes}; budget is ${MAX_GENERATED_BYTES}`
		);
	}
	const generatedByCoordinate = new Map(
		generated.map((derivative) => [derivative.coordinateId, derivative])
	);
	const records: MonsterWikiVisualCatalogRecord[] = plan.records.map((record) => {
		if (record.delivery === 'reuse') {
			return { ...record, delivery: 'reused', runtime: record.runtime };
		}
		const derivative = generatedByCoordinate.get(record.coordinateId)!;
		return {
			...record,
			delivery: 'generated',
			runtime: {
				path: derivative.path,
				publicUrl: derivative.publicUrl,
				sha256: derivative.sha256,
				width: derivative.width,
				height: derivative.height,
				bytes: derivative.bytes
			}
		};
	});
	const catalog: MonsterWikiVisualCatalog = {
		schemaVersion: CATALOG_SCHEMA,
		exporterVersion: EXPORTER_VERSION,
		familyCount: 38,
		formCount: 190,
		coordinateCount: 950,
		generatedCount: 750,
		reusedCount: 200,
		generatedBytes,
		encoder: {
			format: 'webp',
			maxDimension: 640,
			quality: 72,
			effort: 4,
			preset: 'picture',
			smartSubsample: true,
			metadata: 'stripped'
		},
		records
	};

	const outputRoot = resolve(repositoryRoot, OUTPUT_ROOT);
	const allowedOutputRoot = resolve(
		repositoryRoot,
		'apps/web/static/runtime/enemies/monster-wiki-v1'
	);
	if (outputRoot !== allowedOutputRoot) {
		throw new Error('Refusing unsafe monster wiki runtime output root');
	}
	const catalogPath = resolve(repositoryRoot, CATALOG_PATH);
	if (mode === 'write') {
		await rm(outputRoot, { recursive: true, force: true });
		for (const derivative of generated) {
			const path = resolve(repositoryRoot, derivative.path);
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, derivative.buffer);
		}
		await mkdir(dirname(catalogPath), { recursive: true });
		await writeFile(catalogPath, catalogText(catalog));
		return catalog;
	}

	const storedCatalog = await readFile(catalogPath, 'utf8').catch(() => null);
	if (storedCatalog !== catalogText(catalog)) {
		throw new Error('Monster wiki visual catalog is stale');
	}
	const expectedFiles = new Set<string>();
	for (const derivative of generated) {
		const path = resolve(repositoryRoot, derivative.path);
		expectedFiles.add(path);
		const stored = await readFile(path).catch(() => null);
		if (!stored?.equals(derivative.buffer)) {
			throw new Error(`Monster wiki derivative is stale: ${derivative.coordinateId}`);
		}
	}
	const extras = (await listFiles(outputRoot)).filter((path) => !expectedFiles.has(path));
	if (extras.length > 0) {
		throw new Error(`Unexpected monster wiki derivative: ${relative(repositoryRoot, extras[0]!)}`);
	}
	return catalog;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	const write = process.argv.includes('--write');
	const check = process.argv.includes('--check');
	if (write === check) throw new Error('Pass exactly one of --write or --check');
	const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
	const { loadIntegratedMonsterWikiDatabase } = await import('./wiki-fauna-integration.js');
	const database = await loadIntegratedMonsterWikiDatabase(repositoryRoot);
	const catalog = await syncMonsterWikiRuntimeVisuals(
		repositoryRoot,
		database,
		write ? 'write' : 'check'
	);
	console.log(
		`Monster wiki visuals: ${catalog.generatedCount} generated, ${catalog.reusedCount} reused, ${catalog.generatedBytes} generated bytes.`
	);
}

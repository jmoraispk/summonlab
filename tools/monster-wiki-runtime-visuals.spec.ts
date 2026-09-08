import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	buildMonsterWikiVisualPlan,
	encodeMonsterWikiDerivative,
	syncMonsterWikiRuntimeVisuals,
	type GeneratedMonsterWikiDerivative,
	type PlannedGeneratedRecord,
	type FaunaRuntimeCatalog
} from './monster-wiki-runtime-visuals.js';
import { loadIntegratedMonsterWikiDatabase } from './wiki-fauna-integration.js';
import type { CanonicalMonsterWikiDatabase } from './wiki-monster-database-lib.js';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
let database: CanonicalMonsterWikiDatabase;
let runtimeCatalog: FaunaRuntimeCatalog;
const temporaryRoots: string[] = [];

async function faunaRuntimeCatalog(): Promise<FaunaRuntimeCatalog> {
	return JSON.parse(
		await readFile(
			new URL('../assets/enemies/runtime/fauna-family-v1/catalog.json', import.meta.url),
			'utf8'
		)
	) as FaunaRuntimeCatalog;
}

beforeAll(async () => {
	[database, runtimeCatalog] = await Promise.all([
		loadIntegratedMonsterWikiDatabase(repositoryRoot),
		faunaRuntimeCatalog()
	]);
}, 120_000);

afterAll(async () => {
	await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

describe('monster wiki runtime visuals', () => {
	it('plans exactly 750 generated original coordinates and reuses 200 fauna coordinates', async () => {
		const plan = buildMonsterWikiVisualPlan(database, runtimeCatalog);

		expect(plan.records).toHaveLength(950);
		expect(plan.generated).toHaveLength(750);
		expect(plan.reused).toHaveLength(200);
		expect(new Set(plan.records.map(({ coordinateId }) => coordinateId))).toHaveLength(950);
		expect(plan.records[0]).toMatchObject({
			coordinateId: 'goblins/goblin-runt/normal',
			presentationStatus: 'approved-review',
			sourcePath:
				'assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-runt/normal-v1.png',
			delivery: 'generate'
		});
		expect(plan.records.at(-1)).toMatchObject({
			coordinateId: 'raptors/raptor-roc/water',
			presentationStatus: 'runtime',
			delivery: 'reuse'
		});
	});

	it('encodes a bounded deterministic WebP derivative from hash-bound source evidence', async () => {
		const plan = buildMonsterWikiVisualPlan(database, runtimeCatalog);
		const derivative = await encodeMonsterWikiDerivative(repositoryRoot, plan.generated[0]!);

		expect(Math.max(derivative.width, derivative.height)).toBe(640);
		expect(derivative.bytes).toBeLessThanOrEqual(180_000);
		expect(derivative.path).toMatch(/normal\.[a-f0-9]{12}\.webp$/u);
		expect(createHash('sha256').update(derivative.buffer).digest('hex')).toBe(derivative.sha256);
	});

	it('rejects fauna runtime catalog drift instead of substituting another image', async () => {
		const catalog = structuredClone(runtimeCatalog);
		catalog.records[0]!.runtime.publicUrl = '/runtime/enemies/wrong.webp';

		expect(() => buildMonsterWikiVisualPlan(database, catalog)).toThrow(
			/fauna.*binding.*wolves\/wolf-gray-wolf\/normal/iu
		);
	});

	it('writes a complete catalog and detects a missing generated derivative', async () => {
		const workspace = await mkdtemp(join(tmpdir(), 'monster-wiki-runtime-'));
		temporaryRoots.push(workspace);
		const faunaPath = resolve(workspace, 'assets/enemies/runtime/fauna-family-v1/catalog.json');
		await mkdir(dirname(faunaPath), { recursive: true });
		await writeFile(faunaPath, `${JSON.stringify(runtimeCatalog)}\n`);
		const encode = async (
			_root: string,
			source: PlannedGeneratedRecord
		): Promise<GeneratedMonsterWikiDerivative> => {
			const buffer = Buffer.from(source.coordinateId);
			const hash = createHash('sha256').update(buffer).digest('hex');
			const path = `apps/web/static/runtime/enemies/monster-wiki-v1/${source.familyId}/${source.formId}/${source.affinity}.${hash.slice(0, 12)}.webp`;
			return {
				...source,
				buffer,
				path,
				publicUrl: `/${path.replace(/^apps\/web\/static\//u, '')}`,
				sha256: hash,
				width: 640,
				height: 400,
				bytes: buffer.byteLength
			};
		};

		const catalog = await syncMonsterWikiRuntimeVisuals(workspace, database, 'write', encode);
		expect(catalog.records).toHaveLength(950);
		expect(
			JSON.parse(
				await readFile(
					resolve(workspace, 'assets/enemies/runtime/monster-wiki-v1/catalog.json'),
					'utf8'
				)
			).records
		).toHaveLength(950);

		const firstPath = resolve(
			workspace,
			catalog.records.find(({ delivery }) => delivery === 'generated')!.runtime.path
		);
		await rm(firstPath);
		await expect(
			syncMonsterWikiRuntimeVisuals(workspace, database, 'check', encode)
		).rejects.toThrow(/derivative is stale/iu);
	}, 120_000);
});

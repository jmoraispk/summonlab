import { lstat, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	buildFaunaFamilyProductionBundle,
	FAUNA_FAMILY_ROOT,
	FamilyPacketSchema,
	FaunaFamilyManifestSchema,
	stableFamilyAffinityJson,
	validateFaunaFamilyProductionBundle
} from './family-affinity-production-lib.js';
import { validateFaunaFamilyPromotion } from './fauna-family-promotion.js';

const ACTIVE_SOURCES_PATH = `${FAUNA_FAMILY_ROOT}/active-sources.json`;

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function assertRealFile(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${sep}`))
		throw new Error(`Path escapes repository: ${repositoryPath}`);
	let cursor = root;
	for (const part of relative(root, absolute).split(sep).filter(Boolean)) {
		cursor = join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink())
			throw new Error(`Symlinked source is forbidden: ${repositoryPath}`);
	}
	return readFile(absolute);
}

async function listFiles(directory: string): Promise<string[]> {
	if (!(await exists(directory))) return [];
	const entries = await readdir(directory, { withFileTypes: true });
	return (
		await Promise.all(
			entries.map(async (entry) => {
				const path = join(directory, entry.name);
				if (entry.isSymbolicLink()) throw new Error(`Symlinked production path: ${path}`);
				return entry.isDirectory() ? listFiles(path) : [path];
			})
		)
	).flat();
}

function designInput(manifest: unknown): unknown {
	const production = FaunaFamilyManifestSchema.safeParse(manifest);
	if (!production.success) return manifest;
	return {
		schemaVersion: 'fauna-family-design-manifest-v1',
		experimentId: 'fauna-family-v1',
		status: 'design-complete-production-not-started',
		scope: production.data.scope,
		production: {},
		legacyClassMigrations: production.data.legacyClassMigrations,
		ownership: {}
	};
}

export async function exportFaunaFamilyProduction(input: {
	repositoryRoot: string;
	check: boolean;
}) {
	const activeSources = JSON.parse(
		(await assertRealFile(input.repositoryRoot, ACTIVE_SOURCES_PATH)).toString('utf8')
	) as { experimentId?: unknown; familyPacketPaths?: unknown };
	if (
		activeSources.experimentId !== 'fauna-family-v1' ||
		!Array.isArray(activeSources.familyPacketPaths) ||
		activeSources.familyPacketPaths.length !== 8 ||
		!activeSources.familyPacketPaths.every(
			(path): path is string =>
				typeof path === 'string' && path.startsWith(`${FAUNA_FAMILY_ROOT}/families/`)
		)
	) {
		throw new Error('Fauna active sources must bind exactly eight ordered family packets');
	}
	const families = await Promise.all(
		activeSources.familyPacketPaths.map(async (path) =>
			FamilyPacketSchema.parse(
				JSON.parse((await assertRealFile(input.repositoryRoot, path)).toString('utf8'))
			)
		)
	);
	const manifestPath = `${FAUNA_FAMILY_ROOT}/manifest.json`;
	const currentManifest = JSON.parse(
		(await assertRealFile(input.repositoryRoot, manifestPath)).toString('utf8')
	) as unknown;
	const parsedCurrent = FaunaFamilyManifestSchema.safeParse(currentManifest);
	let targetCount: number;
	let assignmentCount: number;
	if (parsedCurrent.success) {
		const targets = await Promise.all(
			parsedCurrent.data.canonicalMatrix.activeCoordinates.map(async ({ targetPath }) =>
				JSON.parse((await assertRealFile(input.repositoryRoot, targetPath)).toString('utf8'))
			)
		);
		const assignments = await Promise.all(
			parsedCurrent.data.canonicalMatrix.activeCoordinates.map(async ({ assignmentPath }) =>
				JSON.parse((await assertRealFile(input.repositoryRoot, assignmentPath)).toString('utf8'))
			)
		);
		validateFaunaFamilyProductionBundle(
			{ manifest: parsedCurrent.data, targets, assignments, artifacts: [] },
			families
		);
		targetCount = targets.length;
		assignmentCount = assignments.length;
	} else {
		const bundle = buildFaunaFamilyProductionBundle(
			families,
			designInput(currentManifest),
			ACTIVE_SOURCES_PATH
		);
		for (const artifact of bundle.artifacts) {
			const absolute = join(input.repositoryRoot, artifact.path);
			const expected = stableFamilyAffinityJson(artifact.value);
			if (await exists(absolute)) {
				const actual = await readFile(absolute, 'utf8');
				if (actual === expected) continue;
				if (artifact.path !== manifestPath) {
					throw new Error(`Fauna production artifact drift or collision: ${artifact.path}`);
				}
				if (input.check) throw new Error('Fauna production manifest is not materialized');
				const temporary = `${absolute}.fauna-materialization-${process.pid}`;
				try {
					await writeFile(temporary, expected, { flag: 'wx' });
					await rename(temporary, absolute);
				} finally {
					await unlink(temporary).catch(() => undefined);
				}
				continue;
			}
			if (input.check) throw new Error(`Missing fauna production artifact: ${artifact.path}`);
			await mkdir(dirname(absolute), { recursive: true });
			await writeFile(absolute, expected, { flag: 'wx' });
		}
		targetCount = bundle.targets.length;
		assignmentCount = bundle.assignments.length;
	}

	const candidateFiles = await listFiles(
		join(input.repositoryRoot, FAUNA_FAMILY_ROOT, 'candidates')
	);
	const resultFiles = await listFiles(join(input.repositoryRoot, FAUNA_FAMILY_ROOT, 'results'));
	const retiredAfterPromotion = candidateFiles.length === 0 && resultFiles.length === 200;
	if (retiredAfterPromotion) {
		await validateFaunaFamilyPromotion(input.repositoryRoot);
	} else if (candidateFiles.length !== resultFiles.length) {
		throw new Error(
			`Fauna production has partial candidate/result coverage: ${candidateFiles.length}/${resultFiles.length}`
		);
	}
	return {
		status: input.check ? ('verified' as const) : ('materialized' as const),
		experimentId: 'fauna-family-v1' as const,
		familyCount: 8,
		formCount: 40,
		targetCount,
		assignmentCount,
		candidateCount: retiredAfterPromotion ? 200 : candidateFiles.length,
		resultCount: resultFiles.length
	};
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	exportFaunaFamilyProduction({
		repositoryRoot: process.cwd(),
		check: process.argv.includes('--check')
	})
		.then((report) => console.log(JSON.stringify(report, null, 2)))
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		});
}

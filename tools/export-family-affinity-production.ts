import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	buildFamilyAffinityProductionBundle,
	CurrentClassMappingFileSchema,
	FAMILY_AFFINITY_ROOT,
	FamilyPacketSchema,
	stableFamilyAffinityJson
} from './family-affinity-production-lib.js';

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function listFiles(directory: string): Promise<string[]> {
	if (!(await fileExists(directory))) return [];
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);
			return entry.isDirectory() ? listFiles(path) : [path];
		})
	);
	return nested.flat().sort();
}

export async function exportFamilyAffinityProduction(options: {
	repositoryRoot: string;
	check: boolean;
}) {
	const familyDirectory = join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, 'families');
	const familyFileNames = (await readdir(familyDirectory))
		.filter((fileName) => /^\d{2}-[a-z0-9-]+\.json$/u.test(fileName))
		.sort();
	const families = await Promise.all(
		familyFileNames.map(async (fileName) =>
			FamilyPacketSchema.parse(JSON.parse(await readFile(join(familyDirectory, fileName), 'utf8')))
		)
	);
	const mapping = CurrentClassMappingFileSchema.parse(
		JSON.parse(
			await readFile(
				join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, 'current-class-mapping.json'),
				'utf8'
			)
		)
	);
	const bundle = buildFamilyAffinityProductionBundle(families, mapping);
	const expected = new Map(
		bundle.artifacts.map(({ path, value }) => [path, stableFamilyAffinityJson(value)] as const)
	);

	if (options.check) {
		const errors: string[] = [];
		for (const [path, content] of expected) {
			const absolute = join(options.repositoryRoot, path);
			if (!(await fileExists(absolute))) {
				errors.push(`missing ${path}`);
				continue;
			}
			if ((await readFile(absolute, 'utf8')) !== content) errors.push(`drifted ${path}`);
		}
		const generatedRoots = [
			join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, 'targets'),
			join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, 'assignments')
		];
		const actualGenerated = (
			await Promise.all(generatedRoots.map((directory) => listFiles(directory)))
		)
			.flat()
			.map((path) => relative(options.repositoryRoot, path));
		for (const path of actualGenerated) {
			if (!expected.has(path)) errors.push(`extra ${path}`);
		}
		if (errors.length > 0)
			throw new Error(`Family affinity production export check failed:\n${errors.join('\n')}`);
		return { mode: 'check' as const, artifactCount: expected.size };
	}

	for (const [path, content] of expected) {
		const absolute = join(options.repositoryRoot, path);
		await mkdir(dirname(absolute), { recursive: true });
		await writeFile(absolute, content);
	}
	return { mode: 'write' as const, artifactCount: expected.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const check = process.argv.slice(2).includes('--check');
	const result = await exportFamilyAffinityProduction({ repositoryRoot: process.cwd(), check });
	process.stdout.write(
		`${result.mode === 'check' ? 'Verified' : 'Wrote'} ${result.artifactCount} family affinity production artifacts.\n`
	);
}

import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FAMILY_AFFINITY_REVIEW_CATALOG_PATH,
	FAMILY_AFFINITY_RETAINED_PACK_PATH,
	buildFamilyAffinityReviewArtifacts
} from './family-affinity-review-lib.js';
import { stableFamilyAffinityJson } from './family-affinity-production-lib.js';

type ExportMode = 'write' | 'check';

function absolutePath(repositoryRoot: string, ownedPath: string): string {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, ownedPath);
	if (!absolute.startsWith(`${root}${sep}`))
		throw new Error('Review artifact path escapes repository');
	return absolute;
}

async function ensureControllerParent(repositoryRoot: string, ownedPath: string): Promise<void> {
	const parent = dirname(absolutePath(repositoryRoot, ownedPath));
	const root = resolve(repositoryRoot);
	const relativeParts = parent
		.slice(root.length + 1)
		.split(sep)
		.filter(Boolean);
	let cursor = root;
	for (const part of relativeParts) {
		cursor = `${cursor}${sep}${part}`;
		try {
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
				throw new Error(`Controller output parent must be a real directory: ${cursor}`);
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			await mkdir(cursor);
		}
	}
}

async function currentBytes(repositoryRoot: string, ownedPath: string): Promise<Buffer | null> {
	const absolute = absolutePath(repositoryRoot, ownedPath);
	try {
		const metadata = await lstat(absolute);
		if (metadata.isSymbolicLink() || !metadata.isFile()) {
			throw new Error(`Controller output must be a real file: ${ownedPath}`);
		}
		return await readFile(absolute);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

async function writeAtomic(
	repositoryRoot: string,
	ownedPath: string,
	bytes: Buffer
): Promise<void> {
	await ensureControllerParent(repositoryRoot, ownedPath);
	const absolute = absolutePath(repositoryRoot, ownedPath);
	const temporary = `${absolute}.controller-${process.pid}.tmp`;
	await writeFile(temporary, bytes, { flag: 'wx' });
	await rename(temporary, absolute);
}

export async function exportFamilyAffinityReview(
	repositoryRoot = process.cwd(),
	mode: ExportMode = 'check'
): Promise<{
	mode: ExportMode;
	familyCount: 30;
	coordinateCount: 750;
	generatedCount: number;
	approvedReviewCount: number;
	contactSheetCount: 0;
	artifactCount: number;
	retainedPackCount: 0 | 750;
	digest: string;
	writtenCount: number;
	inSync: boolean;
}> {
	const bundle = await buildFamilyAffinityReviewArtifacts(repositoryRoot);
	const artifacts: Array<{ path: string; bytes: Buffer }> = [
		{
			path: FAMILY_AFFINITY_REVIEW_CATALOG_PATH,
			bytes: Buffer.from(stableFamilyAffinityJson(bundle.catalog))
		},
		...bundle.families.map((family) => ({
			path: family.summaryPath,
			bytes: Buffer.from(stableFamilyAffinityJson(family.summary))
		})),
		...(bundle.retainedPack
			? [
					{
						path: FAMILY_AFFINITY_RETAINED_PACK_PATH,
						bytes: Buffer.from(stableFamilyAffinityJson(bundle.retainedPack))
					}
				]
			: [])
	];
	const expectedArtifactCount = bundle.retainedPack ? 32 : 31;
	if (artifacts.length !== expectedArtifactCount) {
		throw new Error(
			`Expected ${expectedArtifactCount} controller artifacts, found ${artifacts.length}`
		);
	}
	let writtenCount = 0;
	for (const artifact of artifacts) {
		const current = await currentBytes(repositoryRoot, artifact.path);
		if (current?.equals(artifact.bytes)) continue;
		if (mode === 'check')
			throw new Error(`Family affinity review artifact is stale: ${artifact.path}`);
		await writeAtomic(repositoryRoot, artifact.path, artifact.bytes);
		writtenCount += 1;
	}
	return {
		mode,
		familyCount: 30,
		coordinateCount: 750,
		generatedCount: bundle.catalog.generatedCount,
		approvedReviewCount: bundle.catalog.approvedReviewCount,
		contactSheetCount: 0,
		artifactCount: artifacts.length,
		retainedPackCount: bundle.retainedPack ? 750 : 0,
		digest: bundle.digest,
		writtenCount,
		inSync: mode === 'check' || writtenCount === 0
	};
}

async function main(): Promise<void> {
	const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
	if (unknownArguments.length > 0)
		throw new Error(`Unknown arguments: ${unknownArguments.join(' ')}`);
	const mode: ExportMode = process.argv.includes('--check') ? 'check' : 'write';
	const report = await exportFamilyAffinityReview(process.cwd(), mode);
	console.log(
		`family-affinity-review mode=${report.mode} families=${report.familyCount} coordinates=${report.coordinateCount} generated=${report.generatedCount} approved=${report.approvedReviewCount} retained=${report.retainedPackCount} sheets=${report.contactSheetCount} artifacts=${report.artifactCount} written=${report.writtenCount} digest=${report.digest}`
	);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}

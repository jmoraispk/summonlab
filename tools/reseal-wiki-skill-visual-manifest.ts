import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { format, resolveConfig } from 'prettier';

import {
	WIKI_SKILL_VISUAL_EXPORTER_VERSION,
	WIKI_SKILL_VISUAL_MANIFEST_PATH,
	finalizeWikiSkillVisualManagedDirectorySummary,
	formatWikiSkillVisualManifest,
	type WikiSkillVisualRuntimeManifest
} from './wiki-skill-visual-catalog-lib.js';

const CATALOG_PATH = 'assets/wiki/skills/icon-production-v1/catalog.json';
const MASS_PRODUCTION_MANIFEST_PATH =
	'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_MASS_PRODUCTION_MANIFEST_PATH = path.join(
	REPOSITORY_ROOT,
	...MASS_PRODUCTION_MANIFEST_PATH.split('/')
);

interface SkillIconMassProductionManifest {
	readonly schemaVersion: string;
	readonly authorities: {
		readonly catalog: { readonly path: string; contentHash: string };
	};
	readonly [key: string]: unknown;
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

async function formatMassProductionManifest(
	manifest: SkillIconMassProductionManifest
): Promise<string> {
	const config = await resolveConfig(REPOSITORY_MASS_PRODUCTION_MANIFEST_PATH, {
		useCache: false
	});
	return format(JSON.stringify(manifest), {
		...config,
		filepath: REPOSITORY_MASS_PRODUCTION_MANIFEST_PATH,
		parser: 'json'
	});
}

export async function resealWikiSkillVisualManifestContents(source: string): Promise<string> {
	const manifest = JSON.parse(source) as WikiSkillVisualRuntimeManifest;
	if (
		manifest.schemaVersion !== 'wiki-skill-visual-catalog-v1' ||
		manifest.exporterVersion !== WIKI_SKILL_VISUAL_EXPORTER_VERSION
	) {
		throw new Error('Invalid wiki skill visual manifest authority');
	}
	const resealed = await finalizeWikiSkillVisualManagedDirectorySummary(manifest);
	return (await formatWikiSkillVisualManifest(resealed)).toString('utf8');
}

export async function resealWikiSkillVisualAuthorityContents(input: {
	readonly catalogContents: string;
	readonly massProductionManifestContents: string;
	readonly runtimeManifestContents: string;
}): Promise<{
	readonly massProductionManifestContents: string;
	readonly runtimeManifestContents: string;
}> {
	const massProductionManifest = JSON.parse(
		input.massProductionManifestContents
	) as SkillIconMassProductionManifest;
	if (
		massProductionManifest.schemaVersion !== 'skill-icon-mass-production-manifest-v1' ||
		massProductionManifest.authorities?.catalog?.path !== CATALOG_PATH
	) {
		throw new Error('Invalid wiki skill mass-production manifest authority');
	}
	massProductionManifest.authorities.catalog.contentHash = sha256(input.catalogContents);
	const massProductionManifestContents = await formatMassProductionManifest(massProductionManifest);

	const runtimeManifest = JSON.parse(
		input.runtimeManifestContents
	) as WikiSkillVisualRuntimeManifest;
	if (
		runtimeManifest.sourceAuthorities?.catalog?.path !== CATALOG_PATH ||
		runtimeManifest.sourceAuthorities?.massProductionManifest?.path !==
			MASS_PRODUCTION_MANIFEST_PATH
	) {
		throw new Error('Invalid wiki skill visual source authority paths');
	}
	const resealedRuntimeManifest: WikiSkillVisualRuntimeManifest = {
		...runtimeManifest,
		sourceAuthorities: {
			catalog: {
				...runtimeManifest.sourceAuthorities.catalog,
				contentHash: sha256(input.catalogContents)
			},
			massProductionManifest: {
				...runtimeManifest.sourceAuthorities.massProductionManifest,
				contentHash: sha256(massProductionManifestContents)
			}
		}
	};
	const runtimeManifestContents = await resealWikiSkillVisualManifestContents(
		JSON.stringify(resealedRuntimeManifest)
	);
	return { massProductionManifestContents, runtimeManifestContents };
}

async function main(): Promise<void> {
	const catalogPath = path.join(process.cwd(), ...CATALOG_PATH.split('/'));
	const massProductionManifestPath = path.join(
		process.cwd(),
		...MASS_PRODUCTION_MANIFEST_PATH.split('/')
	);
	const manifestPath = path.join(process.cwd(), ...WIKI_SKILL_VISUAL_MANIFEST_PATH.split('/'));
	const [catalogContents, massProductionManifestContents, runtimeManifestContents] =
		await Promise.all([
			readFile(catalogPath, 'utf8'),
			readFile(massProductionManifestPath, 'utf8'),
			readFile(manifestPath, 'utf8')
		]);
	const expected = await resealWikiSkillVisualAuthorityContents({
		catalogContents,
		massProductionManifestContents,
		runtimeManifestContents
	});
	if (expected.massProductionManifestContents !== massProductionManifestContents) {
		await writeFile(massProductionManifestPath, expected.massProductionManifestContents, 'utf8');
	}
	if (expected.runtimeManifestContents !== runtimeManifestContents) {
		await writeFile(manifestPath, expected.runtimeManifestContents, 'utf8');
	}
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}

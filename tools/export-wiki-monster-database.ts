import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	loadFamilyAffinityActiveSources,
	type FamilyAffinityManifest
} from './family-affinity-production-lib.js';
import { buildFamilyAffinityReviewArtifacts } from './family-affinity-review-lib.js';
import {
	assertGeneratedMonsterWikiFreshness,
	assertManagedMonsterCatalogEntries,
	buildCanonicalMonsterWikiDatabase,
	buildMonsterDatabaseIndex,
	buildMonsterVisualIndex,
	buildMonsterWikiPage,
	generatedMonsterPageFileNames,
	obsoleteGeneratedMonsterPages,
	RETIRED_CANONICAL_MONSTER_FORM_IDS,
	unmanagedMonsterPageCollisions,
	type CanonicalMonsterWikiDatabase,
	type LegacyCandidateReference,
	type MonsterWikiBuildInput
} from './wiki-monster-database-lib.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productionRoot = resolve(repositoryRoot, 'assets/enemies/experiments/family-affinity-v1');
const monsterWikiRoot = resolve(repositoryRoot, 'docs/wiki/creatures/monsters');
const visualIndexPath = resolve(monsterWikiRoot, 'visual-index.json');
const wikiCatalogPath = resolve(repositoryRoot, 'docs/wiki/catalog.json');
const legacyCatalogPaths = [
	resolve(repositoryRoot, 'assets/enemies/experiments/affinity-workflow-v1/review/catalog.json'),
	resolve(repositoryRoot, 'assets/enemies/experiments/affinity-expansion-v1/review/catalog.json')
];

type WikiCatalog = {
	schemaVersion: string;
	lastReviewed: string;
	entries: Array<Record<string, unknown> & { wikiId: string }>;
};

type LegacyCatalogEntry = {
	speciesId: string;
	affinity: string;
	status: 'candidate' | 'revise';
	candidatePath: string;
	candidateHash?: string;
	contentHash?: string;
	selectedVersion?: string;
};

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T;
}

function versionFrom(entry: LegacyCatalogEntry): number {
	return Number(
		entry.selectedVersion?.match(/v(\d+)/u)?.[1] ??
			entry.candidatePath.match(/-v(\d+)\.png$/u)?.[1] ??
			1
	);
}

async function loadBuildInput(): Promise<MonsterWikiBuildInput> {
	const { families, mapping } = await loadFamilyAffinityActiveSources(repositoryRoot);
	const reviewArtifacts = await buildFamilyAffinityReviewArtifacts(repositoryRoot);
	const manifest = FamilyAffinityManifestSchema.parse(
		await readJson(resolve(productionRoot, 'manifest.json'))
	);
	const targets = await Promise.all(
		manifest.canonicalMatrix.activeCoordinates.map(async ({ targetPath }) =>
			FamilyAffinityTargetSchema.parse(await readJson(resolve(repositoryRoot, targetPath)))
		)
	);
	const candidateReferences: LegacyCandidateReference[] = [];
	for (const catalogPath of legacyCatalogPaths) {
		const catalog = await readJson<{ entries: LegacyCatalogEntry[] }>(catalogPath);
		for (const entry of catalog.entries) {
			const contentHash = entry.contentHash ?? entry.candidateHash;
			if (!contentHash) throw new Error(`Missing candidate hash for ${entry.candidatePath}`);
			candidateReferences.push({
				currentClassId: entry.speciesId,
				affinity: entry.affinity,
				candidatePath: entry.candidatePath,
				contentHash,
				sourceStatus: 'candidate-only',
				selectionStatus: entry.status,
				version: versionFrom(entry)
			});
		}
	}
	const reviewEvidence = reviewArtifacts.families.flatMap(({ summary }) => summary.cells);
	return { families, mapping, manifest, targets, reviewEvidence, candidateReferences };
}

function buildCatalog(current: WikiCatalog, database: CanonicalMonsterWikiDatabase): WikiCatalog {
	assertManagedMonsterCatalogEntries(database, current.entries);
	const replaceableWikiIds = new Set([
		'creatures.monster-database',
		...database.forms.map(({ formId }) => `monster.${formId}`),
		...database.reconciliation.map(({ currentClassId }) => `monster.${currentClassId}`),
		...RETIRED_CANONICAL_MONSTER_FORM_IDS.map((formId) => `monster.${formId}`)
	]);
	const retained = current.entries.filter((entry) => !replaceableWikiIds.has(entry.wikiId));
	return {
		...current,
		lastReviewed: '2026-09-01',
		entries: [
			...retained,
			{
				wikiId: 'creatures.monster-database',
				path: 'docs/wiki/creatures/monsters/README.md',
				pageType: 'monster-database',
				owner: 'visuals-content',
				designStatus: 'draft',
				implementationStatus: 'partial',
				visualStatus: 'brief',
				spoilerScope: 'discoverable'
			},
			...database.forms.map(({ formId }) => ({
				wikiId: `monster.${formId}`,
				path: `docs/wiki/creatures/monsters/${formId}.md`,
				pageType: 'monster-entry',
				owner: 'visuals-content',
				designStatus: 'draft',
				implementationStatus: 'none',
				visualStatus: 'brief',
				spoilerScope: 'discoverable'
			}))
		]
	};
}

async function validateReferenceAssets(
	reconciliation: ReturnType<typeof buildCanonicalMonsterWikiDatabase>['reconciliation']
): Promise<void> {
	for (const entry of reconciliation) {
		for (const reference of entry.references) {
			const absolutePath = resolve(repositoryRoot, reference.candidatePath);
			if (!existsSync(absolutePath)) {
				throw new Error(`Missing candidate-only reference ${reference.candidatePath}`);
			}
			const digest = createHash('sha256')
				.update(await readFile(absolutePath))
				.digest('hex');
			if (digest !== reference.contentHash) {
				throw new Error(`Candidate-only reference hash drift ${reference.candidatePath}`);
			}
		}
	}
}

async function validateSourcePages(manifest: FamilyAffinityManifest): Promise<void> {
	const sourcePages = new Set<string>();
	for (const coordinate of manifest.canonicalMatrix.activeCoordinates) {
		const target = FamilyAffinityTargetSchema.parse(
			await readJson(resolve(repositoryRoot, coordinate.targetPath))
		);
		sourcePages.add(target.sources.sourcePage);
	}
	for (const sourcePage of sourcePages) {
		if (!existsSync(resolve(repositoryRoot, sourcePage))) {
			throw new Error(`Missing family source page ${sourcePage}`);
		}
	}
}

async function writeOutputs(input: MonsterWikiBuildInput): Promise<number> {
	const database = buildCanonicalMonsterWikiDatabase(input);
	await validateReferenceAssets(database.reconciliation);
	await validateSourcePages(input.manifest);
	await mkdir(monsterWikiRoot, { recursive: true });
	const existingFileNames = await readdir(monsterWikiRoot);
	const unmanagedPages = unmanagedMonsterPageCollisions(database, existingFileNames);
	if (unmanagedPages.length > 0) {
		throw new Error(`Unmanaged monster page collision: ${unmanagedPages.join(', ')}`);
	}
	const currentCatalog = await readJson<WikiCatalog>(wikiCatalogPath);
	assertManagedMonsterCatalogEntries(database, currentCatalog.entries);
	const obsoletePages = obsoleteGeneratedMonsterPages(database, existingFileNames);
	for (const fileName of obsoletePages) await unlink(resolve(monsterWikiRoot, fileName));

	await writeFile(resolve(monsterWikiRoot, 'README.md'), buildMonsterDatabaseIndex(database));
	for (const form of database.forms) {
		await writeFile(resolve(monsterWikiRoot, `${form.formId}.md`), buildMonsterWikiPage(form));
	}
	await writeFile(
		visualIndexPath,
		`${JSON.stringify(buildMonsterVisualIndex(database), null, 2)}\n`
	);
	await writeFile(
		wikiCatalogPath,
		`${JSON.stringify(buildCatalog(currentCatalog, database), null, 2)}\n`
	);
	return obsoletePages.length;
}

async function checkOutputs(input: MonsterWikiBuildInput): Promise<void> {
	const database = buildCanonicalMonsterWikiDatabase(input);
	await validateReferenceAssets(database.reconciliation);
	await validateSourcePages(input.manifest);
	const existingFileNames = await readdir(monsterWikiRoot);
	const pages = new Map<string, string>();
	for (const fileName of generatedMonsterPageFileNames(database)) {
		if (existsSync(resolve(monsterWikiRoot, fileName))) {
			pages.set(fileName, await readFile(resolve(monsterWikiRoot, fileName), 'utf8'));
		}
	}
	assertGeneratedMonsterWikiFreshness(database, {
		readme: await readFile(resolve(monsterWikiRoot, 'README.md'), 'utf8'),
		visualIndex: await readFile(visualIndexPath, 'utf8'),
		pages,
		existingFileNames
	});
	const catalog = await readJson<WikiCatalog>(wikiCatalogPath);
	const expectedCatalog = buildCatalog(catalog, database);
	if (JSON.stringify(catalog) !== JSON.stringify(expectedCatalog)) {
		throw new Error('Wiki catalog monster registrations are stale');
	}
}

const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
if (write === check) throw new Error('Pass exactly one of --write or --check');

const input = await loadBuildInput();
if (write) {
	const deleted = await writeOutputs(input);
	console.log(
		`Exported 30 families, 150 canonical forms, 750 production coordinates, and 40 reconciliations; removed ${deleted} obsolete generated pages.`
	);
} else {
	await checkOutputs(input);
	console.log(
		'Validated 30 families, 150 canonical forms, 750 production coordinates, and 40 reconciliations.'
	);
}

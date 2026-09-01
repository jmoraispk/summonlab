import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	ENEMY_ARCHETYPES,
	ENEMY_REVIEW_FAMILIES,
	PACK_TWO_MONSTER_ARCHETYPES,
	PACK_TWO_MONSTER_FAMILIES
} from '../packages/content/src/index.js';
import {
	buildMonsterWikiPage,
	CURRENT_MONSTER_PRODUCTION_TARGET,
	LEGACY_MONSTER_VISUAL_STUDIES,
	matchesContentHash,
	MONSTER_AFFINITIES,
	presentationStatusForVisualStudy,
	selectCanonicalVariants,
	type CurrentMonsterAffinity,
	type MonsterAffinity,
	type MonsterVisualCandidate,
	type MonsterVisualPresentationStatus,
	type MonsterWikiIdentity,
	wikiPresentationCounterplay
} from './wiki-monster-database-lib.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monsterWikiRoot = resolve(repositoryRoot, 'docs/wiki/creatures/monsters');
const visualIndexPath = resolve(monsterWikiRoot, 'visual-index.json');
const wikiCatalogPath = resolve(repositoryRoot, 'docs/wiki/catalog.json');
const baselineCatalogPath = resolve(
	repositoryRoot,
	'assets/enemies/experiments/affinity-workflow-v1/review/catalog.json'
);
const expansionCatalogPath = resolve(
	repositoryRoot,
	'assets/enemies/experiments/affinity-expansion-v1/review/catalog.json'
);

type SourceCatalogEntry = {
	targetId: string;
	speciesId: string;
	affinity: MonsterAffinity;
	status: 'candidate' | 'revise';
	candidatePath: string;
	candidateHash?: string;
	contentHash?: string;
	selectedVersion?: string;
};

type WikiCatalog = {
	schemaVersion: string;
	lastReviewed: string;
	entries: Array<Record<string, unknown> & { wikiId: string }>;
};

type MonsterVisualIndexEntry = MonsterWikiIdentity & {
	variants: Array<
		MonsterVisualCandidate & {
			presentationStatus: MonsterVisualPresentationStatus;
			thumbnailPath: string;
			thumbnailHash: string;
		}
	>;
};

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T;
}

function contentHash(buffer: Buffer): string {
	return createHash('sha256').update(buffer).digest('hex');
}

function versionFrom(entry: SourceCatalogEntry): number {
	const explicit = entry.selectedVersion?.match(/v(\d+)/u)?.[1];
	const fromPath = entry.candidatePath.match(/-v(\d+)\.png$/u)?.[1];
	return Number(explicit ?? fromPath ?? 1);
}

function normalizeCandidate(entry: SourceCatalogEntry): MonsterVisualCandidate {
	const hash = entry.contentHash ?? entry.candidateHash;
	if (!hash) throw new Error(`Missing source hash for ${entry.targetId}`);
	return {
		targetId: entry.targetId,
		speciesId: entry.speciesId,
		affinity: entry.affinity,
		status: entry.status,
		candidatePath: entry.candidatePath,
		contentHash: hash,
		version: versionFrom(entry)
	};
}

function monsterIdentities(): MonsterWikiIdentity[] {
	const packOneFamilies = new Map(ENEMY_REVIEW_FAMILIES.map((family) => [family.id, family.name]));
	const packTwoFamilies = new Map(
		PACK_TWO_MONSTER_FAMILIES.map((family) => [family.id, family.name])
	);
	const packOne = ENEMY_ARCHETYPES.map((monster) => ({
		id: monster.id,
		name: monster.name,
		familyId: monster.family,
		familyName: packOneFamilies.get(monster.family)!,
		role: monster.role,
		telegraph: `Signature actions: ${monster.skills.join(', ')}.`,
		counterplay: `Teaches ${monster.teaches.join(', ')}.`,
		skills: [...monster.skills],
		debutFloor: monster.debutFloor
	}));
	const packTwo = PACK_TWO_MONSTER_ARCHETYPES.map((monster) => ({
		id: monster.id,
		name: monster.name,
		familyId: monster.family,
		familyName: packTwoFamilies.get(monster.family)!,
		role: monster.duty,
		telegraph: monster.telegraph,
		counterplay: wikiPresentationCounterplay(monster.id, monster.weakPoint),
		skills: [] as string[],
		debutFloor: null
	}));
	return [...packOne, ...packTwo].sort(
		(left, right) =>
			left.familyName.localeCompare(right.familyName) || left.name.localeCompare(right.name)
	);
}

function buildDatabaseIndex(monsters: readonly MonsterWikiIdentity[]): string {
	const families = new Map<string, { name: string; monsters: MonsterWikiIdentity[] }>();
	for (const monster of monsters) {
		const family = families.get(monster.familyId) ?? { name: monster.familyName, monsters: [] };
		family.monsters.push(monster);
		families.set(monster.familyId, family);
	}
	const sections = [...families.entries()]
		.sort((left, right) => left[1].name.localeCompare(right[1].name))
		.map(
			([, family]) => `## ${family.name}

${family.monsters.map((monster) => `- [${monster.name}](${monster.id}.md) — ${monster.role}`).join('\n')}`
		)
		.join('\n\n');
	return `# Monster database

Wiki ID: \`creatures.monster-database\`

This is the visual identity index for the **40 currently authored monster archetypes**. Every card
opens a dedicated monster page. Each page leads with the identity reference and separates the
accepted target from preserved visual evidence.

Current production target: Normal, Fire, Earth, Wind, Water

Legacy visual studies: Wood and Metal candidates; not current affinities and not runtime assets

The online images are web derivatives of candidate artwork. Earth remains a current target without
an available candidate in this preserved set. Candidate evidence is not approved or runtime art;
source provenance and review state remain in the visual catalog.

${sections}

## Production synchronization

Visual workers own only their manifest-bound target, candidate, and result paths. The coordinator
refreshes this database with \`pnpm export:wiki-monsters\` after branches are consolidated. This
keeps individual image production collision-safe while making the wiki the shared review surface.
`;
}

function buildCatalog(current: WikiCatalog, monsters: readonly MonsterWikiIdentity[]): WikiCatalog {
	const retained = current.entries.filter(
		(entry) => entry.wikiId !== 'creatures.monster-database' && !entry.wikiId.startsWith('monster.')
	);
	const shared = {
		owner: 'visuals-content',
		designStatus: 'draft',
		implementationStatus: 'partial',
		visualStatus: 'candidate',
		spoilerScope: 'discoverable'
	};
	return {
		...current,
		lastReviewed: '2026-08-31',
		entries: [
			...retained,
			{
				wikiId: 'creatures.monster-database',
				path: 'docs/wiki/creatures/monsters/README.md',
				pageType: 'monster-database',
				...shared
			},
			...monsters.map((monster) => ({
				wikiId: `monster.${monster.id}`,
				path: `docs/wiki/creatures/monsters/${monster.id}.md`,
				pageType: 'monster-entry',
				...shared
			}))
		]
	};
}

async function renderThumbnail(source: Buffer): Promise<Buffer> {
	return sharp(source)
		.resize({ width: 720, height: 480, fit: 'cover', position: 'centre', withoutEnlargement: true })
		.webp({ quality: 82, effort: 5, smartSubsample: true })
		.toBuffer();
}

async function buildVisualIndex(write: boolean): Promise<MonsterVisualIndexEntry[]> {
	const baseline = await readJson<{ entries: SourceCatalogEntry[] }>(baselineCatalogPath);
	const expansion = await readJson<{ entries: SourceCatalogEntry[] }>(expansionCatalogPath);
	const candidates = [...baseline.entries, ...expansion.entries].map(normalizeCandidate);
	const monsters = monsterIdentities();
	const result: MonsterVisualIndexEntry[] = [];
	for (const monster of monsters) {
		const variants = selectCanonicalVariants(
			candidates.filter((candidate) => candidate.speciesId === monster.id)
		);
		const rendered = [];
		for (const variant of variants) {
			const thumbnailPath = `/wiki-media/monsters/${monster.id}/${variant.affinity}.webp`;
			const outputPath = resolve(repositoryRoot, `apps/web/static${thumbnailPath}`);
			const sourcePath = resolve(repositoryRoot, variant.candidatePath);
			const source = await readFile(sourcePath);
			if (!matchesContentHash(source, variant.contentHash)) {
				throw new Error(`Source hash mismatch ${variant.candidatePath}`);
			}
			const thumbnail = await renderThumbnail(source);
			if (write) {
				await mkdir(dirname(outputPath), { recursive: true });
				await writeFile(outputPath, thumbnail);
			}
			rendered.push({
				...variant,
				presentationStatus: presentationStatusForVisualStudy(variant.affinity),
				thumbnailPath,
				thumbnailHash: contentHash(thumbnail)
			});
		}
		result.push({ ...monster, variants: rendered });
	}
	return result;
}

async function writeOutputs(monsters: readonly MonsterVisualIndexEntry[]): Promise<void> {
	await mkdir(monsterWikiRoot, { recursive: true });
	await writeFile(resolve(monsterWikiRoot, 'README.md'), buildDatabaseIndex(monsters));
	for (const monster of monsters) {
		const pagePath = resolve(monsterWikiRoot, `${monster.id}.md`);
		await writeFile(pagePath, buildMonsterWikiPage(monster));
	}
	await writeFile(
		visualIndexPath,
		`${JSON.stringify(
			{
				schemaVersion: 'summonlab-monster-visual-index-v1',
				sourceStatus: 'producer-candidates',
				monsterCount: monsters.length,
				affinities: CURRENT_MONSTER_PRODUCTION_TARGET,
				legacyVisualStudies: LEGACY_MONSTER_VISUAL_STUDIES,
				sourceVisualLabels: MONSTER_AFFINITIES,
				monsters
			},
			null,
			2
		)}\n`
	);
	const catalog = await readJson<WikiCatalog>(wikiCatalogPath);
	await writeFile(wikiCatalogPath, `${JSON.stringify(buildCatalog(catalog, monsters), null, 2)}\n`);
}

async function checkOutputs(monsters: readonly MonsterVisualIndexEntry[]): Promise<void> {
	const stored = await readJson<{
		schemaVersion: string;
		monsterCount: number;
		affinities: readonly CurrentMonsterAffinity[];
		legacyVisualStudies: readonly string[];
		sourceVisualLabels: readonly MonsterAffinity[];
		monsters: MonsterVisualIndexEntry[];
	}>(visualIndexPath);
	if (stored.schemaVersion !== 'summonlab-monster-visual-index-v1' || stored.monsterCount !== 40) {
		throw new Error('Monster visual index schema or count is stale');
	}
	if (
		JSON.stringify(stored.affinities) !== JSON.stringify(CURRENT_MONSTER_PRODUCTION_TARGET) ||
		JSON.stringify(stored.legacyVisualStudies) !== JSON.stringify(LEGACY_MONSTER_VISUAL_STUDIES) ||
		JSON.stringify(stored.sourceVisualLabels) !== JSON.stringify(MONSTER_AFFINITIES)
	) {
		throw new Error('Monster visual index production-target metadata is stale');
	}
	if (JSON.stringify(stored.monsters) !== JSON.stringify(monsters)) {
		throw new Error('Monster visual index entries are stale');
	}
	const currentById = new Map(monsters.map((monster) => [monster.id, monster]));
	for (const storedMonster of stored.monsters) {
		const current = currentById.get(storedMonster.id);
		if (!current) throw new Error(`Unexpected stored monster ${storedMonster.id}`);
		for (const storedVariant of storedMonster.variants) {
			const currentVariant = current.variants.find(
				(variant) => variant.affinity === storedVariant.affinity
			);
			if (!currentVariant) throw new Error(`Missing ${storedMonster.id}/${storedVariant.affinity}`);
			for (const key of [
				'candidatePath',
				'contentHash',
				'status',
				'presentationStatus',
				'version',
				'thumbnailHash'
			] as const) {
				if (storedVariant[key] !== currentVariant[key]) {
					throw new Error(`Stale ${storedMonster.id}/${storedVariant.affinity} ${key}`);
				}
			}
			const thumbnailFile = resolve(
				repositoryRoot,
				`apps/web/static${storedVariant.thumbnailPath}`
			);
			if (!existsSync(thumbnailFile))
				throw new Error(`Missing thumbnail ${storedVariant.thumbnailPath}`);
			const thumbnailHash = contentHash(await readFile(thumbnailFile));
			if (thumbnailHash !== storedVariant.thumbnailHash) {
				throw new Error(`Thumbnail hash mismatch ${storedVariant.thumbnailPath}`);
			}
		}
		const pagePath = resolve(monsterWikiRoot, `${storedMonster.id}.md`);
		if (!existsSync(pagePath)) throw new Error(`Missing wiki page for ${storedMonster.id}`);
		const page = await readFile(pagePath, 'utf8');
		if (page !== buildMonsterWikiPage(current)) {
			throw new Error(`Generated wiki page is stale for ${storedMonster.id}`);
		}
	}
	const databaseIndex = await readFile(resolve(monsterWikiRoot, 'README.md'), 'utf8');
	if (databaseIndex !== buildDatabaseIndex(monsters)) {
		throw new Error('Generated monster database index is stale');
	}
	const catalog = await readJson<WikiCatalog>(wikiCatalogPath);
	const expectedCatalog = buildCatalog(catalog, monsters);
	if (JSON.stringify(catalog) !== JSON.stringify(expectedCatalog)) {
		throw new Error('Wiki catalog monster registrations are stale');
	}
}

const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
if (write === check) throw new Error('Pass exactly one of --write or --check');

const monsters = await buildVisualIndex(write);
if (monsters.length !== 40 || monsters.some((monster) => monster.variants.length !== 6)) {
	throw new Error('Expected 40 monsters with six preserved visual studies each');
}
if (write) {
	await writeOutputs(monsters);
	console.log('Exported 40 monster pages and 240 preserved web visual studies.');
} else {
	await checkOutputs(monsters);
	console.log('Validated 40 monster pages and 240 preserved web visual studies.');
}

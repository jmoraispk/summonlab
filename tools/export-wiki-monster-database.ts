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
	matchesContentHash,
	MONSTER_AFFINITIES,
	selectCanonicalVariants,
	type MonsterAffinity,
	type MonsterVisualCandidate,
	type MonsterWikiIdentity
} from './wiki-monster-database-lib.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monsterWikiRoot = resolve(repositoryRoot, 'docs/wiki/creatures/monsters');
const thumbnailRoot = resolve(repositoryRoot, 'apps/web/static/wiki-media/monsters');
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
		counterplay: monster.weakPoint,
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
opens a dedicated monster page. Each page leads with the identity reference and keeps
Wood, Fire, Metal, Water, and Wind directly beneath it as variants of the same identity.

The online images are web derivatives of hash-bound production candidates. Candidate and revision
labels remain visible; appearing in this database does not silently approve an image for runtime.

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
		lastReviewed: '2026-08-30',
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

async function createThumbnail(source: Buffer, outputPath: string): Promise<string> {
	await mkdir(dirname(outputPath), { recursive: true });
	const output = await sharp(source)
		.resize({ width: 720, height: 480, fit: 'cover', position: 'centre', withoutEnlargement: true })
		.webp({ quality: 82, effort: 5, smartSubsample: true })
		.toBuffer();
	await writeFile(outputPath, output);
	return contentHash(output);
}

async function buildVisualIndex(write: boolean): Promise<MonsterVisualIndexEntry[]> {
	const baseline = await readJson<{ entries: SourceCatalogEntry[] }>(baselineCatalogPath);
	const expansion = await readJson<{ entries: SourceCatalogEntry[] }>(expansionCatalogPath);
	const candidates = [...baseline.entries, ...expansion.entries].map(normalizeCandidate);
	const monsters = monsterIdentities();
	const existing = existsSync(visualIndexPath)
		? await readJson<{ monsters: MonsterVisualIndexEntry[] }>(visualIndexPath)
		: { monsters: [] };
	const existingHash = new Map(
		existing.monsters.flatMap((monster) =>
			monster.variants.map((variant) => [
				`${monster.id}/${variant.affinity}`,
				variant.thumbnailHash
			])
		)
	);
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
			const thumbnailHash = write
				? await createThumbnail(source, outputPath)
				: (existingHash.get(`${monster.id}/${variant.affinity}`) ?? '');
			rendered.push({ ...variant, thumbnailPath, thumbnailHash });
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
		if (!existsSync(pagePath)) await writeFile(pagePath, buildMonsterWikiPage(monster));
	}
	await writeFile(
		visualIndexPath,
		`${JSON.stringify(
			{
				schemaVersion: 'summonlab-monster-visual-index-v1',
				sourceStatus: 'producer-candidates',
				monsterCount: monsters.length,
				affinities: MONSTER_AFFINITIES,
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
		affinities: readonly MonsterAffinity[];
		monsters: MonsterVisualIndexEntry[];
	}>(visualIndexPath);
	if (stored.schemaVersion !== 'summonlab-monster-visual-index-v1' || stored.monsterCount !== 40) {
		throw new Error('Monster visual index schema or count is stale');
	}
	if (JSON.stringify(stored.affinities) !== JSON.stringify(MONSTER_AFFINITIES)) {
		throw new Error('Monster visual index affinity order is stale');
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
			for (const key of ['candidatePath', 'contentHash', 'status', 'version'] as const) {
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
		if (!page.includes(`Wiki ID: \`monster.${storedMonster.id}\``)) {
			throw new Error(`Wiki page does not declare monster.${storedMonster.id}`);
		}
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
	throw new Error('Expected 40 monsters with six affinity variants each');
}
if (write) {
	await writeOutputs(monsters);
	console.log('Exported 40 monster pages and 240 web affinity images.');
} else {
	await checkOutputs(monsters);
	console.log('Validated 40 monster pages and 240 web affinity images.');
}

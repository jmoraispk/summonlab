import { readFile, readdir } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
	CurrentClassMappingFileSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	FamilyPacketSchema
} from './family-affinity-production-lib.js';
import {
	assertGeneratedMonsterWikiFreshness,
	buildCanonicalMonsterWikiDatabase,
	buildMonsterDatabaseIndex,
	buildMonsterVisualIndex,
	buildMonsterWikiPage,
	generatedMonsterPageFileNames,
	obsoleteGeneratedMonsterPages,
	type LegacyCandidateReference,
	type MonsterWikiBuildInput
} from './wiki-monster-database-lib.js';

const productionRoot = new URL(
	'../assets/enemies/experiments/family-affinity-v1/',
	import.meta.url
);

async function json<T>(url: URL): Promise<T> {
	return JSON.parse(await readFile(url, 'utf8')) as T;
}

async function productionInput(): Promise<MonsterWikiBuildInput> {
	const familyDirectory = new URL('families/', productionRoot);
	const familyFileNames = (await readdir(familyDirectory))
		.filter((fileName) => /^\d{2}-[a-z0-9-]+\.json$/u.test(fileName))
		.sort();
	const families = await Promise.all(
		familyFileNames.map(async (fileName) =>
			FamilyPacketSchema.parse(await json(new URL(fileName, familyDirectory)))
		)
	);
	const mapping = CurrentClassMappingFileSchema.parse(
		await json(new URL('current-class-mapping.json', productionRoot))
	);
	const manifest = FamilyAffinityManifestSchema.parse(
		await json(new URL('manifest.json', productionRoot))
	);
	const targets = await Promise.all(
		manifest.canonicalMatrix.activeCoordinates.map(async ({ targetPath }) =>
			FamilyAffinityTargetSchema.parse(await json(new URL(`../${targetPath}`, import.meta.url)))
		)
	);
	const catalogPaths = [
		new URL(
			'../assets/enemies/experiments/affinity-workflow-v1/review/catalog.json',
			import.meta.url
		),
		new URL(
			'../assets/enemies/experiments/affinity-expansion-v1/review/catalog.json',
			import.meta.url
		)
	];
	const candidateReferences: LegacyCandidateReference[] = [];
	for (const catalogPath of catalogPaths) {
		const catalog = await json<{
			entries: Array<{
				speciesId: string;
				affinity: string;
				candidatePath: string;
				candidateHash?: string;
				contentHash?: string;
				status: 'candidate' | 'revise';
				selectedVersion?: string;
			}>;
		}>(catalogPath);
		for (const entry of catalog.entries) {
			candidateReferences.push({
				currentClassId: entry.speciesId,
				affinity: entry.affinity,
				candidatePath: entry.candidatePath,
				contentHash: entry.contentHash ?? entry.candidateHash ?? '',
				sourceStatus: 'candidate-only',
				selectionStatus: entry.status,
				version: Number(
					entry.selectedVersion?.match(/v(\d+)/u)?.[1] ??
						entry.candidatePath.match(/-v(\d+)\.png$/u)?.[1] ??
						1
				)
			});
		}
	}
	return { families, mapping, manifest, targets, candidateReferences };
}

function cloneInput(input: MonsterWikiBuildInput): MonsterWikiBuildInput {
	return structuredClone(input);
}

describe('canonical monster wiki database', () => {
	it('builds exactly thirty families, 150 forms, 750 planned coordinates, and forty reconciliations', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());

		expect(database.counts).toEqual({
			families: 30,
			forms: 150,
			coordinates: 750,
			currentClasses: 40,
			canonicalMappings: 10,
			bridgeOnly: 30,
			legacyCandidateReferences: 160
		});
		expect(database.families).toHaveLength(30);
		expect(database.forms).toHaveLength(150);
		expect(new Set(database.forms.map(({ formId }) => formId))).toHaveLength(150);
		for (const family of database.families) {
			expect(family.floorSlot).toBeNull();
			expect(family.forms.map(({ tier }) => tier)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
		}
		for (const form of database.forms) {
			expect(form.coordinates.map(({ affinity }) => affinity)).toEqual([
				'normal',
				'fire',
				'earth',
				'wind',
				'water'
			]);
			expect(form.coordinates.map(({ status }) => status)).toEqual([
				'planned',
				'blocked-on-anchor',
				'blocked-on-anchor',
				'blocked-on-anchor',
				'blocked-on-anchor'
			]);
		}
		expect(database.reconciliation.map(({ currentClassId }) => currentClassId)).toHaveLength(40);
		expect(
			database.reconciliation.every(({ candidateReuseByAffinity }) =>
				Object.values(candidateReuseByAffinity).every((eligible) => eligible === false)
			)
		).toBe(true);
	});

	it('renders family mechanics, canonical form detail, and candidate-safe production semantics', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		const goblins = database.families.find(({ familyId }) => familyId === 'goblins')!;
		const goblinKing = database.forms.find(({ formId }) => formId === 'goblin-king')!;
		const index = buildMonsterDatabaseIndex(database);
		const page = buildMonsterWikiPage(goblinKing);

		expect(index).toContain('## 01 · Goblins');
		expect(index).toContain(goblins.classificationNotes);
		expect(index).toContain(goblins.escalationAxis);
		expect(index).toContain(goblinKing.signatureMechanic);
		expect(index).toContain('Floor assignment | Unassigned');
		expect(index).toContain('### Current class reconciliation');
		expect(index.match(/^\| `[^`]+` \|/gmu)).toHaveLength(40);
		expect(index).toContain('[Goblin King](goblin-king.md)');
		expect(page).toContain('# Goblin King');
		expect(page).toContain('Tier | T5 — Sovereign');
		expect(page).toContain('## Combat reading');
		expect(page).toContain('### Lower-form interaction');
		expect(page).toContain('## Five-coordinate candidate-production matrix');
		expect(page).toContain('`planned` means the Normal identity-anchor attempt is owned');
		expect(page).toContain('`blocked-on-anchor` means an elemental attempt must wait');
		expect(page).toContain('`assets/enemies/experiments/family-affinity-v1/candidates/');
		expect(page).not.toMatch(
			/\]\(assets\/enemies\/experiments\/family-affinity-v1\/(?:candidates|results)/u
		);
		expect(`${index}\n${page}`).not.toMatch(/\b(?:Wood|Metal|Resonance)\b/u);
		expect(`${index}\n${page}`).not.toMatch(/status:\s*(?:approved|runtime)/iu);
	});

	it('emits deterministic canonical and separate candidate-only reconciliation records', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		const first = buildMonsterVisualIndex(database);
		const second = buildMonsterVisualIndex(database);

		expect(second).toEqual(first);
		expect(first).toMatchObject({
			schemaVersion: 'summonlab-monster-visual-index-v2',
			sourceStatus: 'canonical-production-plan',
			familyCount: 30,
			formCount: 150,
			coordinateCount: 750,
			currentClassCount: 40
		});
		expect(first.monsters).toHaveLength(150);
		expect(first.monsters.every(({ variants }) => variants.length === 5)).toBe(true);
		expect(first.reconciliation.entries).toHaveLength(40);
		expect(first.reconciliation.sourceStatus).toBe('candidate-only-reference');
		expect(first.reconciliation.entries.flatMap(({ references }) => references)).toHaveLength(160);
		expect(
			first.reconciliation.entries
				.flatMap(({ references }) => references)
				.every(({ presentationStatus }) => presentationStatus === 'candidate-only')
		).toBe(true);
	});

	it.each([
		['149 forms', (input: MonsterWikiBuildInput): unknown => input.families[0]!.forms.pop()],
		[
			'151 forms',
			(input: MonsterWikiBuildInput): unknown =>
				input.families[0]!.forms.push(structuredClone(input.families[0]!.forms[0]!))
		],
		[
			'duplicate family',
			(input: MonsterWikiBuildInput): unknown =>
				(input.families[1]!.familyId = input.families[0]!.familyId)
		],
		[
			'duplicate form',
			(input: MonsterWikiBuildInput): unknown =>
				(input.families[1]!.forms[0]!.formId = input.families[0]!.forms[0]!.formId)
		],
		[
			'duplicate tier',
			(input: MonsterWikiBuildInput): unknown =>
				(input.families[0]!.forms[1]!.tier = input.families[0]!.forms[0]!.tier)
		],
		[
			'missing affinity',
			(input: MonsterWikiBuildInput): unknown =>
				input.manifest.canonicalMatrix.activeCoordinates.pop()
		],
		[
			'fake current class',
			(input: MonsterWikiBuildInput): unknown =>
				(input.mapping.entries[0]!.currentClassId = 'fake-class')
		],
		[
			'bridge-only counted as canonical',
			(input: MonsterWikiBuildInput): void => {
				input.mapping.entries[0]!.canonicalFamilyId = 'arachnids';
				input.mapping.entries[0]!.canonicalFormId = 'arachnid-crawler';
			}
		],
		[
			'candidate portrayed as approved',
			(input: MonsterWikiBuildInput): unknown =>
				(input.candidateReferences[0]!.sourceStatus = 'approved' as 'candidate-only')
		],
		[
			'invented floor',
			(input: MonsterWikiBuildInput): unknown => (input.families[0]!.floorSlot = 1)
		],
		[
			'broken reconciliation link',
			(input: MonsterWikiBuildInput): unknown =>
				(input.mapping.entries.find(({ disposition }) => disposition === 'map')!.canonicalFormId =
					'missing-form')
		],
		[
			'source/index drift',
			(input: MonsterWikiBuildInput): unknown =>
				(input.manifest.canonicalMatrix.activeCoordinates[0]!.targetSha256 = '0'.repeat(64))
		]
	] as const)('rejects %s', async (_label, mutate) => {
		const input = cloneInput(await productionInput());
		mutate(input);
		expect(() => buildCanonicalMonsterWikiDatabase(input)).toThrow();
	});

	it('allowlists cleanup to obsolete generated monster pages only', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		const expected = generatedMonsterPageFileNames(database);
		const existing = ['README.md', 'visual-index.json', ...expected, 'old-class.md', 'notes.txt'];

		expect(obsoleteGeneratedMonsterPages(existing, expected)).toEqual(['old-class.md']);
	});

	it('detects stale generated content, missing pages, and extra obsolete pages', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		const pages = new Map(
			database.forms.map((form) => [`${form.formId}.md`, buildMonsterWikiPage(form)])
		);
		const index = buildMonsterDatabaseIndex(database);
		const visualIndex = `${JSON.stringify(buildMonsterVisualIndex(database), null, 2)}\n`;

		expect(() =>
			assertGeneratedMonsterWikiFreshness(database, {
				readme: index,
				visualIndex,
				pages,
				existingFileNames: ['README.md', 'visual-index.json', ...pages.keys()]
			})
		).not.toThrow();

		pages.delete('goblin-runt.md');
		expect(() =>
			assertGeneratedMonsterWikiFreshness(database, {
				readme: `${index}\n<!-- stale -->`,
				visualIndex,
				pages,
				existingFileNames: ['README.md', 'visual-index.json', ...pages.keys(), 'old-class.md']
			})
		).toThrow(/stale|missing|obsolete/iu);
	});
});

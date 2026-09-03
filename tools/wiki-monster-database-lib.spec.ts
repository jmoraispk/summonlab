import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	loadFamilyAffinityActiveSources
} from './family-affinity-production-lib.js';
import { familyAffinitySha256 } from './family-affinity-production-lib.js';
import {
	FamilyAffinityGenerationFailureSchema,
	familyAffinityGenerationFailurePath,
	type CanonicalGenerationFailureSupersessionSourceBinding
} from './family-affinity-review-lib.js';
import {
	assertCandidateSafeRenderedMonsterWiki,
	assertGeneratedMonsterWikiFreshness,
	assertManagedMonsterCatalogEntries,
	buildCanonicalMonsterWikiDatabase,
	buildMonsterDatabaseIndex,
	buildMonsterVisualIndex,
	buildMonsterWikiPage,
	generatedMonsterPageFileNames,
	legacyMonsterPageFileNames,
	legacyMonsterRouteMap,
	obsoleteGeneratedMonsterPages,
	RETIRED_CANONICAL_MONSTER_FORM_IDS,
	unmanagedMonsterPageCollisions,
	type LegacyCandidateReference,
	type MonsterWikiBuildInput
} from './wiki-monster-database-lib.js';

const productionRoot = new URL(
	'../assets/enemies/experiments/family-affinity-v1/',
	import.meta.url
);
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

async function json<T>(url: URL): Promise<T> {
	return JSON.parse(await readFile(url, 'utf8')) as T;
}

async function productionInput(): Promise<MonsterWikiBuildInput> {
	const { families, mapping } = await loadFamilyAffinityActiveSources(repositoryRoot);
	const manifest = FamilyAffinityManifestSchema.parse(
		await json(new URL('manifest.json', productionRoot))
	);
	const targets = await Promise.all(
		manifest.canonicalMatrix.activeCoordinates.map(async ({ targetPath }) =>
			FamilyAffinityTargetSchema.parse(await json(new URL(`../${targetPath}`, import.meta.url)))
		)
	);
	const generationFailureSourceBindings: CanonicalGenerationFailureSupersessionSourceBinding[] = [];
	async function loadGenerationFailureSourceBinding(
		coordinate: (typeof manifest.canonicalMatrix.activeCoordinates)[number],
		version: number
	): Promise<CanonicalGenerationFailureSupersessionSourceBinding | undefined> {
		if (version <= 1) return undefined;
		const previousVersion = version - 1;
		const targetSuffix = `v${coordinate.activeVersion}.json`;
		const previousTargetPath = `${coordinate.targetPath.slice(0, -targetSuffix.length)}v${previousVersion}.json`;
		const assignmentSuffix = `v${coordinate.activeVersion}.json`;
		const previousAssignmentPath = `${coordinate.assignmentPath.slice(0, -assignmentSuffix.length)}v${previousVersion}.json`;
		const previousTarget = FamilyAffinityTargetSchema.parse(
			await json(new URL(`../${previousTargetPath}`, import.meta.url))
		);
		const failurePath = familyAffinityGenerationFailurePath(previousTarget);
		if (!existsSync(new URL(`../${failurePath}`, import.meta.url))) return undefined;
		const generationFailure = FamilyAffinityGenerationFailureSchema.parse(
			await json(new URL(`../${failurePath}`, import.meta.url))
		);
		return {
			previousTargetPath,
			previousAssignmentPath,
			previousTarget,
			previousAssignment: FamilyAffinityAssignmentSchema.parse(
				await json(new URL(`../${previousAssignmentPath}`, import.meta.url))
			),
			generationFailure,
			previousBinding: await loadGenerationFailureSourceBinding(coordinate, previousVersion)
		};
	}
	for (const coordinate of manifest.canonicalMatrix.activeCoordinates) {
		const binding = await loadGenerationFailureSourceBinding(coordinate, coordinate.activeVersion);
		if (binding) generationFailureSourceBindings.push(binding);
	}
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
	const reviewEvidence = (
		await Promise.all(
			families.map(async ({ familyId }) =>
				json<{ cells: MonsterWikiBuildInput['reviewEvidence'] }>(
					new URL(`review/families/${familyId}/summary.json`, productionRoot)
				)
			)
		)
	).flatMap(({ cells }) => cells);
	return {
		families,
		mapping,
		manifest,
		targets,
		reviewEvidence,
		candidateReferences,
		generationFailureSourceBindings
	};
}

function cloneInput(input: MonsterWikiBuildInput): MonsterWikiBuildInput {
	return structuredClone(input);
}

describe('canonical monster wiki database', () => {
	it('builds exactly thirty families, 150 forms, 750 evidence-backed coordinates, and forty reconciliations', async () => {
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
			expect(
				form.coordinates.every(
					({ status }) =>
						status === 'planned' ||
						status === 'planned-provisional-anchor' ||
						status === 'blocked-on-anchor'
				)
			).toBe(true);
		}
		expect(database.reconciliation.map(({ currentClassId }) => currentClassId)).toHaveLength(40);
		expect(
			database.reconciliation.every(({ candidateReuseByAffinity }) =>
				Object.values(candidateReuseByAffinity).every((eligible) => eligible === false)
			)
		).toBe(true);
	});

	it('reflects the current Elementals candidate and review state without claiming runtime', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		for (const formId of ['elemental-wisp', 'elemental-spirit']) {
			const form = database.forms.find((candidate) => candidate.formId === formId)!;
			expect(form.coordinates.map(({ presentationStatus }) => presentationStatus)).toEqual([
				'approved-review',
				'approved-review',
				'approved-review',
				'approved-review',
				'approved-review'
			]);
			expect(buildMonsterWikiPage(form)).toContain(
				'Normal: approved-review; Fire: approved-review; Earth: approved-review; Wind: approved-review; Water: approved-review.'
			);
		}
		for (const formId of ['elemental-warden', 'elemental-colossus']) {
			const form = database.forms.find((candidate) => candidate.formId === formId)!;
			expect(form.coordinates.map(({ presentationStatus }) => presentationStatus)).toEqual([
				'approved-review',
				'candidate-only',
				'candidate-only',
				'candidate-only',
				'candidate-only'
			]);
			expect(buildMonsterWikiPage(form)).toContain(
				'Normal: approved-review; Fire: candidate-only; Earth: candidate-only; Wind: candidate-only; Water: candidate-only.'
			);
		}

		const sovereign = database.forms.find(
			(candidate) => candidate.formId === 'elemental-sovereign'
		)!;
		expect(sovereign.coordinates.map(({ status }) => status)).toEqual([
			'planned',
			'planned-provisional-anchor',
			'planned-provisional-anchor',
			'planned-provisional-anchor',
			'planned-provisional-anchor'
		]);
		expect(sovereign.coordinates.map(({ presentationStatus }) => presentationStatus)).toEqual([
			'candidate-only',
			'planned',
			'planned',
			'planned',
			'planned'
		]);
		expect(sovereign.coordinates[0]).toMatchObject({
			version: 3,
			candidateExists: true,
			historyAttemptCount: 2,
			historyRevisionRequiredCount: 2
		});
		const page = buildMonsterWikiPage(sovereign);
		expect(page).toContain('Normal: candidate-only');
		expect(page).toContain('`planned-provisional-anchor` means candidate generation is authorized');
		expect(page).toContain(
			'Candidate and review evidence only; no coordinate on this page is runtime art.'
		);
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
		expect(page).toContain('`planned` means the active attempt is owned');
		expect(page).toContain('`blocked-on-anchor` means the active attempt must wait');
		expect(page).toContain('`assets/enemies/experiments/family-affinity-v1/candidates/');
		expect(page).not.toMatch(
			/\]\(assets\/enemies\/experiments\/family-affinity-v1\/(?:candidates|results)/u
		);
		expect(`${index}\n${page}`).not.toMatch(/\b(?:Wood|Metal|Resonance)\b/u);
		expect(`${index}\n${page}`).not.toMatch(/status:\s*(?:approved|runtime)/iu);
	});

	it('emits deterministic canonical and separate candidate-only reconciliation records', async () => {
		const input = await productionInput();
		const database = buildCanonicalMonsterWikiDatabase(input);
		const first = buildMonsterVisualIndex(database);
		const second = buildMonsterVisualIndex(database);
		const sourceRationaleByCurrentClassId = new Map(
			input.mapping.entries.map(({ currentClassId, rationale }) => [currentClassId, rationale])
		);

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
		expect(
			first.reconciliation.entries.map(({ currentClassId, rationale }) => [
				currentClassId,
				rationale
			])
		).toEqual(
			input.mapping.entries.map(({ currentClassId, rationale }) => [currentClassId, rationale])
		);
		const reconciliationReadme = buildMonsterDatabaseIndex(database);
		for (const { rationale } of input.mapping.entries) {
			expect(reconciliationReadme).toContain(rationale);
		}
		expect(
			first.reconciliation.entries.find(({ currentClassId }) => currentClassId === 'hill-giant')
		).toMatchObject({
			disposition: 'map',
			rationale: sourceRationaleByCurrentClassId.get('hill-giant')
		});
		expect(
			first.reconciliation.entries.find(({ currentClassId }) => currentClassId === 'grey-wolf')
		).toMatchObject({
			disposition: 'fauna',
			rationale: sourceRationaleByCurrentClassId.get('grey-wolf')
		});
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
			'missing review evidence',
			(input: MonsterWikiBuildInput): unknown =>
				(input.reviewEvidence as MonsterWikiBuildInput['reviewEvidence'][number][]).pop()
		],
		[
			'stale review evidence version',
			(input: MonsterWikiBuildInput): number => ++input.reviewEvidence[0]!.activeVersion
		],
		[
			'planned state with forged candidate evidence',
			(input: MonsterWikiBuildInput): void => {
				const evidence = input.reviewEvidence.find(
					({ state, candidatePath }) => state === 'planned' && candidatePath === null
				)!;
				const target = input.targets.find(
					({ coordinateId }) => coordinateId === evidence.coordinateId
				)!;
				evidence.candidatePath = target.ownedPaths.candidate;
				evidence.candidateSha256 = 'a'.repeat(64);
			}
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

	it('deletes managed legacy and retired canonical pages while preserving unknown Markdown', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		const expected = generatedMonsterPageFileNames(database);
		const managedLegacy = legacyMonsterPageFileNames(database);
		const existing = [
			'README.md',
			'visual-index.json',
			...expected,
			...managedLegacy,
			...RETIRED_CANONICAL_MONSTER_FORM_IDS.map((formId) => `${formId}.md`),
			'hand-authored-encounter.md',
			'notes.txt'
		];

		expect(managedLegacy).toHaveLength(40);
		expect(obsoleteGeneratedMonsterPages(database, existing)).toEqual(
			[
				...managedLegacy,
				...RETIRED_CANONICAL_MONSTER_FORM_IDS.map((formId) => `${formId}.md`)
			].sort()
		);
		expect(unmanagedMonsterPageCollisions(database, existing)).toEqual([
			'hand-authored-encounter.md'
		]);
	});

	it('fails closed on an unknown monster catalog registration without removing it', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		const entries = [
			{ wikiId: 'creatures.monster-database' },
			{ wikiId: 'monster.goblin-runt' },
			{ wikiId: 'monster.grey-wolf' },
			{ wikiId: 'monster.hand-authored-encounter' },
			{ wikiId: 'system.visuals' }
		];
		const snapshot = structuredClone(entries);

		expect(() => assertManagedMonsterCatalogEntries(database, entries)).toThrow(
			/unmanaged.*monster.*catalog/iu
		);
		expect(entries).toEqual(snapshot);
	});

	async function freshStoredOutputs() {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		const pages = new Map(
			database.forms.map((form) => [`${form.formId}.md`, buildMonsterWikiPage(form)])
		);
		const index = buildMonsterDatabaseIndex(database);
		const visualIndex = `${JSON.stringify(buildMonsterVisualIndex(database), null, 2)}\n`;

		return {
			database,
			stored: {
				readme: index,
				visualIndex,
				pages,
				existingFileNames: ['README.md', 'visual-index.json', ...pages.keys()]
			}
		};
	}

	it('accepts a fresh complete generated wiki', async () => {
		const { database, stored } = await freshStoredOutputs();
		expect(() => assertGeneratedMonsterWikiFreshness(database, stored)).not.toThrow();
	});

	it('detects a stale README independently', async () => {
		const { database, stored } = await freshStoredOutputs();
		expect(() =>
			assertGeneratedMonsterWikiFreshness(database, {
				...stored,
				readme: `${stored.readme}\n<!-- stale -->`
			})
		).toThrow(/README is stale/iu);
	});

	it('detects a missing canonical page independently', async () => {
		const { database, stored } = await freshStoredOutputs();
		stored.pages.delete('goblin-runt.md');
		expect(() => assertGeneratedMonsterWikiFreshness(database, stored)).toThrow(
			/missing generated page goblin-runt/iu
		);
	});

	it('detects an altered canonical page independently', async () => {
		const { database, stored } = await freshStoredOutputs();
		stored.pages.set('goblin-runt.md', `${stored.pages.get('goblin-runt.md')}\nchanged`);
		expect(() => assertGeneratedMonsterWikiFreshness(database, stored)).toThrow(
			/goblin-runt.*stale/iu
		);
	});

	it('detects a managed extra old page independently', async () => {
		const { database, stored } = await freshStoredOutputs();
		stored.existingFileNames = [...stored.existingFileNames, 'grey-wolf.md'];
		expect(() => assertGeneratedMonsterWikiFreshness(database, stored)).toThrow(
			/managed legacy.*grey-wolf/iu
		);
	});

	it('detects an unknown hand-authored collision independently', async () => {
		const { database, stored } = await freshStoredOutputs();
		stored.existingFileNames = [...stored.existingFileNames, 'hand-authored-encounter.md'];
		expect(() => assertGeneratedMonsterWikiFreshness(database, stored)).toThrow(
			/unmanaged.*hand-authored-encounter/iu
		);
	});

	it.each([
		[
			'archetype',
			(input: MonsterWikiBuildInput) => (input.families[0]!.forms[0]!.primaryArchetype += ' drift')
		],
		[
			'duty',
			(input: MonsterWikiBuildInput) => (input.families[0]!.forms[0]!.battlefieldDuty += ' drift')
		],
		[
			'telegraph',
			(input: MonsterWikiBuildInput) => (input.families[0]!.forms[0]!.telegraph! += ' drift')
		],
		[
			'counterplay',
			(input: MonsterWikiBuildInput) => (input.families[0]!.forms[0]!.counterplay! += ' drift')
		],
		[
			'source',
			(input: MonsterWikiBuildInput) => input.families[0]!.forms[0]!.sourceReferences.push('Drift')
		],
		[
			'constant',
			(input: MonsterWikiBuildInput) => (input.families[0]!.visualConstants[0] += ' drift')
		],
		[
			'T5 teaching goal',
			(input: MonsterWikiBuildInput) => (input.families[0]!.forms[4]!.teachingGoal += ' drift')
		],
		[
			'T5 lower-form interaction',
			(input: MonsterWikiBuildInput) =>
				(input.families[0]!.forms[4]!.lowerFormInteraction! += ' drift')
		],
		[
			'escalation axis',
			(input: MonsterWikiBuildInput) => (input.families[0]!.escalationAxis += ' drift')
		],
		[
			'classification notes',
			(input: MonsterWikiBuildInput) => (input.families[0]!.classificationNotes += ' drift')
		]
	] as const)('rejects packet-to-target %s drift', async (_label, mutate) => {
		const input = cloneInput(await productionInput());
		mutate(input);
		expect(() => buildCanonicalMonsterWikiDatabase(input)).toThrow(
			/packet.*target|source.*drift/iu
		);
	});

	it('rejects target source-field drift even when the manifest hash is refreshed', async () => {
		const input = cloneInput(await productionInput());
		const target = input.targets[0]!;
		target.telegraph += ' forged';
		input.manifest.canonicalMatrix.activeCoordinates[0]!.targetSha256 =
			familyAffinitySha256(target);
		expect(() => buildCanonicalMonsterWikiDatabase(input)).toThrow(
			/packet.*target|source.*drift/iu
		);
	});

	it('requires authenticated supersession evidence for active source overrides', async () => {
		const input = cloneInput(await productionInput());
		input.generationFailureSourceBindings = [];
		expect(() => buildCanonicalMonsterWikiDatabase(input)).toThrow(
			/packet.*target|source.*drift/iu
		);
	});

	it('requires the complete authenticated chain for repeated source overrides', async () => {
		const input = cloneInput(await productionInput());
		const waterBinding = input.generationFailureSourceBindings.find(
			({ generationFailure }) =>
				(generationFailure as { coordinateId?: string }).coordinateId ===
				'doppelgangers/doppelganger-blank/water'
		)!;
		waterBinding.previousBinding = undefined;
		expect(() => buildCanonicalMonsterWikiDatabase(input)).toThrow(
			/packet.*target|source.*drift/iu
		);
	});

	it('rejects superseding target values that differ from the authenticated override', async () => {
		const input = cloneInput(await productionInput());
		const target = input.targets.find(
			({ coordinateId }) => coordinateId === 'vampires/vampire-progenitor/normal'
		)!;
		target.telegraph += ' forged';
		input.manifest.canonicalMatrix.activeCoordinates.find(
			({ coordinateId }) => coordinateId === target.coordinateId
		)!.targetSha256 = familyAffinitySha256(target);
		expect(() => buildCanonicalMonsterWikiDatabase(input)).toThrow(
			/override.*target|source.*drift/iu
		);
	});

	it('rejects unrelated source drift despite an authenticated supersession override', async () => {
		const input = cloneInput(await productionInput());
		const target = input.targets.find(
			({ coordinateId }) => coordinateId === 'vampires/vampire-progenitor/normal'
		)!;
		target.battlefieldDuty += ' forged';
		input.manifest.canonicalMatrix.activeCoordinates.find(
			({ coordinateId }) => coordinateId === target.coordinateId
		)!.targetSha256 = familyAffinitySha256(target);
		expect(() => buildCanonicalMonsterWikiDatabase(input)).toThrow(
			/packet.*target|source.*drift/iu
		);
	});

	it('audits every rendered page and rejects affirmative candidate promotion wording', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		expect(() => assertCandidateSafeRenderedMonsterWiki(database)).not.toThrow();
		const changed = structuredClone(database);
		changed.forms[0]!.battlefieldDuty = 'This candidate is approved runtime art.';
		expect(() => assertCandidateSafeRenderedMonsterWiki(changed)).toThrow(
			/affirmative.*approved|runtime/iu
		);
	});

	it('builds forty loop-free typed legacy routes with canonical and reconciliation destinations', async () => {
		const database = buildCanonicalMonsterWikiDatabase(await productionInput());
		const routes = legacyMonsterRouteMap(database);
		expect(routes).toHaveLength(40);
		expect(new Set(routes.map(({ currentClassId }) => currentClassId))).toHaveLength(40);
		expect(routes.find(({ currentClassId }) => currentClassId === 'hill-giant')).toMatchObject({
			disposition: 'map',
			destination: '/wiki/creatures/monsters/giant-hill-giant',
			statusCode: 308
		});
		expect(
			routes.find(({ currentClassId }) => currentClassId === 'goblin-chieftain')
		).toMatchObject({
			disposition: 'rename-map',
			destination: '/wiki/creatures/monsters/goblin-warboss'
		});
		expect(
			routes.find(({ currentClassId }) => currentClassId === 'death-knight')?.destination
		).toBe('/wiki/creatures/monsters#current-class-reconciliation');
		expect(routes.find(({ currentClassId }) => currentClassId === 'grey-wolf')?.destination).toBe(
			'/wiki/creatures/monsters#current-class-reconciliation'
		);
		for (const route of routes) {
			expect(route.destination).not.toBe(`/wiki/creatures/monsters/${route.currentClassId}`);
		}
	});
});

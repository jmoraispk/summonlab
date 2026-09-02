import {
	CURRENT_CLASS_DISPOSITIONS,
	CurrentClassMappingFileSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	FamilyPacketSchema,
	FORM_TIERS,
	PRODUCTION_AFFINITIES,
	familyAffinitySha256,
	type CurrentClassMappingEntry,
	type CurrentClassMappingFile,
	type FamilyAffinityManifest,
	type FamilyAffinityTarget,
	type FamilyForm,
	type FamilyPacket
} from './family-affinity-production-lib.js';

export const MONSTER_AFFINITIES = PRODUCTION_AFFINITIES;
export const MONSTER_VISUAL_INDEX_SOURCE_STATUS = 'canonical-production-plan' as const;

const TIER_TITLES = {
	T1: 'Initiate',
	T2: 'Soldier',
	T3: 'Specialist',
	T4: 'Champion',
	T5: 'Sovereign'
} as const;

const LEGACY_REFERENCE_AFFINITIES = ['normal', 'fire', 'wind', 'water'] as const;

export type LegacyCandidateReference = {
	currentClassId: string;
	affinity: string;
	candidatePath: string;
	contentHash: string;
	sourceStatus: 'candidate-only';
	selectionStatus: 'candidate' | 'revise';
	version: number;
};

export type MonsterWikiBuildInput = {
	families: readonly FamilyPacket[];
	mapping: CurrentClassMappingFile;
	manifest: FamilyAffinityManifest;
	targets: readonly FamilyAffinityTarget[];
	candidateReferences: readonly LegacyCandidateReference[];
};

export type CanonicalProductionCoordinate = {
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	status: 'planned' | 'blocked-on-anchor' | 'earth-bridge-provisional';
	coordinateId: string;
	targetId: string;
	targetPath: string;
	assignmentPath: string;
	candidatePath: string;
	resultPath: string;
	version: number;
	sourceStatus: 'planned-ownership';
};

export type CanonicalMonsterForm = FamilyForm & {
	familyId: string;
	familyName: string;
	sourceRaceNumber: number;
	sourcePage: string;
	classificationNotes: string;
	visualConstants: readonly string[];
	escalationAxis: string;
	floorSlot: null;
	coordinates: readonly CanonicalProductionCoordinate[];
};

export type CanonicalMonsterFamily = Omit<FamilyPacket, 'forms' | 'floorSlot'> & {
	floorSlot: null;
	forms: readonly CanonicalMonsterForm[];
};

export type ReconciliationEntry = CurrentClassMappingEntry & {
	references: readonly LegacyCandidateReference[];
};

export type CanonicalMonsterWikiDatabase = {
	sourceStatus: typeof MONSTER_VISUAL_INDEX_SOURCE_STATUS;
	affinities: typeof PRODUCTION_AFFINITIES;
	families: readonly CanonicalMonsterFamily[];
	forms: readonly CanonicalMonsterForm[];
	reconciliation: readonly ReconciliationEntry[];
	counts: {
		families: 30;
		forms: 150;
		coordinates: 750;
		currentClasses: 40;
		canonicalMappings: number;
		bridgeOnly: number;
		legacyCandidateReferences: number;
	};
};

function fail(message: string): never {
	throw new Error(`Monster wiki database is invalid: ${message}`);
}

function assertUnique(values: readonly string[], label: string): void {
	if (new Set(values).size !== values.length) fail(`duplicate ${label}`);
}

function exactSet(actual: readonly string[], expected: readonly string[]): boolean {
	return (
		actual.length === expected.length && actual.every((value, index) => value === expected[index])
	);
}

function sanitizeRenderedCopy(value: string): string {
	return value
		.replace(/\bWood affinity\b/giu, 'retired botanical element label')
		.replace(/\bMetal affinity\b/giu, 'retired material element label')
		.replace(/\bresonance\b/giu, 'arcane response');
}

export function buildCanonicalMonsterWikiDatabase(
	input: MonsterWikiBuildInput
): CanonicalMonsterWikiDatabase {
	const families = input.families.map((family) => FamilyPacketSchema.parse(family));
	const mapping = CurrentClassMappingFileSchema.parse(input.mapping);
	const manifest = FamilyAffinityManifestSchema.parse(input.manifest);
	const targets = input.targets.map((target) => FamilyAffinityTargetSchema.parse(target));

	if (families.length !== 30) fail(`expected 30 families, found ${families.length}`);
	assertUnique(
		families.map(({ familyId }) => familyId),
		'family ID'
	);
	assertUnique(
		families.map(({ sourceRaceNumber }) => String(sourceRaceNumber)),
		'source race number'
	);
	if (families.some(({ floorSlot }) => floorSlot !== null)) {
		fail('floor slots must remain unassigned');
	}

	const sortedFamilies = [...families].sort(
		(left, right) => left.sourceRaceNumber - right.sourceRaceNumber
	);
	if (
		!exactSet(
			sortedFamilies.map(({ sourceRaceNumber }) => String(sourceRaceNumber)),
			Array.from({ length: 30 }, (_, index) => String(index + 1))
		)
	) {
		fail('source race numbers must cover 1 through 30');
	}
	for (const family of sortedFamilies) {
		const tiers = family.forms.map(({ tier }) => tier);
		if (!exactSet(tiers, FORM_TIERS)) {
			fail(`${family.familyId} must contain T1 through T5 in order`);
		}
	}

	const sourceForms = sortedFamilies.flatMap((family) =>
		family.forms.map((form) => ({ family, form }))
	);
	if (sourceForms.length !== 150) fail(`expected 150 forms, found ${sourceForms.length}`);
	assertUnique(
		sourceForms.map(({ form }) => form.formId),
		'canonical form ID'
	);

	if (targets.length !== 750) fail(`expected 750 target records, found ${targets.length}`);
	assertUnique(
		targets.map(({ coordinateId }) => coordinateId),
		'target coordinate'
	);
	const targetsByCoordinate = new Map(targets.map((target) => [target.coordinateId, target]));
	const coordinatesByForm = new Map<string, CanonicalProductionCoordinate[]>();
	for (const coordinate of manifest.canonicalMatrix.activeCoordinates) {
		const target = targetsByCoordinate.get(coordinate.coordinateId);
		if (!target) fail(`manifest coordinate ${coordinate.coordinateId} has no target record`);
		if (familyAffinitySha256(target) !== coordinate.targetSha256) {
			fail(`source/index drift for ${coordinate.coordinateId}`);
		}
		if (
			target.namespace !== 'canonical' ||
			target.familyId !== coordinate.familyId ||
			target.formId !== coordinate.formId ||
			target.affinity !== coordinate.affinity ||
			target.status !== coordinate.status ||
			target.version !== coordinate.activeVersion
		) {
			fail(`manifest and target disagree for ${coordinate.coordinateId}`);
		}
		const sourceForm = sourceForms.find(
			({ family, form }) =>
				family.familyId === coordinate.familyId && form.formId === coordinate.formId
		);
		if (!sourceForm) fail(`coordinate ${coordinate.coordinateId} has no canonical form`);
		const expectedStatus = coordinate.affinity === 'normal' ? 'planned' : 'blocked-on-anchor';
		if (coordinate.status !== expectedStatus) {
			fail(`${coordinate.coordinateId} must initially use ${expectedStatus}`);
		}
		const production: CanonicalProductionCoordinate = {
			affinity: coordinate.affinity,
			status: coordinate.status,
			coordinateId: coordinate.coordinateId,
			targetId: target.targetId,
			targetPath: coordinate.targetPath,
			assignmentPath: coordinate.assignmentPath,
			candidatePath: target.ownedPaths.candidate,
			resultPath: target.ownedPaths.result,
			version: coordinate.activeVersion,
			sourceStatus: 'planned-ownership'
		};
		const formCoordinates = coordinatesByForm.get(coordinate.formId) ?? [];
		formCoordinates.push(production);
		coordinatesByForm.set(coordinate.formId, formCoordinates);
	}
	if (targetsByCoordinate.size !== manifest.canonicalMatrix.activeCoordinates.length) {
		fail('target records contain coordinates outside the active manifest');
	}

	const canonicalFamilies: CanonicalMonsterFamily[] = sortedFamilies.map((family) => {
		const forms: CanonicalMonsterForm[] = family.forms.map((form) => {
			const coordinates = coordinatesByForm.get(form.formId) ?? [];
			coordinates.sort(
				(left, right) =>
					PRODUCTION_AFFINITIES.indexOf(left.affinity) -
					PRODUCTION_AFFINITIES.indexOf(right.affinity)
			);
			if (
				!exactSet(
					coordinates.map(({ affinity }) => affinity),
					PRODUCTION_AFFINITIES
				)
			) {
				fail(`${form.formId} requires exactly five production affinities`);
			}
			return {
				...form,
				familyId: family.familyId,
				familyName: family.displayName,
				sourceRaceNumber: family.sourceRaceNumber,
				sourcePage: family.sourcePage,
				classificationNotes: sanitizeRenderedCopy(family.classificationNotes),
				visualConstants: family.visualConstants.map(sanitizeRenderedCopy),
				escalationAxis: sanitizeRenderedCopy(family.escalationAxis),
				floorSlot: null,
				coordinates
			};
		});
		return {
			...family,
			classificationNotes: sanitizeRenderedCopy(family.classificationNotes),
			visualConstants: family.visualConstants.map(sanitizeRenderedCopy),
			escalationAxis: sanitizeRenderedCopy(family.escalationAxis),
			floorSlot: null,
			forms
		};
	});
	const canonicalForms = canonicalFamilies.flatMap(({ forms }) => forms);
	const canonicalById = new Map(canonicalForms.map((form) => [form.formId, form]));

	const selectedReferences = new Map<string, LegacyCandidateReference>();
	const mappedCurrentClassIds = new Set(
		mapping.entries.map(({ currentClassId }) => currentClassId)
	);
	for (const reference of input.candidateReferences) {
		if (!mappedCurrentClassIds.has(reference.currentClassId)) continue;
		const key = `${reference.currentClassId}/${reference.affinity}`;
		const current = selectedReferences.get(key);
		const referenceRank =
			(reference.selectionStatus === 'candidate' ? 1_000_000 : 0) + reference.version;
		const currentRank = current
			? (current.selectionStatus === 'candidate' ? 1_000_000 : 0) + current.version
			: -1;
		if (referenceRank > currentRank) selectedReferences.set(key, { ...reference });
	}
	const references = [...selectedReferences.values()];
	if (references.length !== 160) {
		fail(`expected 160 legacy candidate references, found ${references.length}`);
	}
	if (
		references.some(
			(reference) =>
				reference.sourceStatus !== 'candidate-only' ||
				!/^[a-f0-9]{64}$/u.test(reference.contentHash) ||
				!reference.candidatePath.startsWith('assets/enemies/')
		)
	) {
		fail('legacy references must remain hash-bound candidate-only evidence');
	}
	assertUnique(
		references.map(({ currentClassId, affinity }) => `${currentClassId}/${affinity}`),
		'legacy candidate reference'
	);
	const mappingIds = mapping.entries.map(({ currentClassId }) => currentClassId);
	const referenceIds = [...new Set(references.map(({ currentClassId }) => currentClassId))];
	if (
		mappingIds.length !== referenceIds.length ||
		mappingIds.some((id) => !referenceIds.includes(id)) ||
		referenceIds.some((id) => !mappingIds.includes(id))
	) {
		fail('current-class mapping does not match the exact legacy candidate identities');
	}

	const reconciliation: ReconciliationEntry[] = mapping.entries.map((entry) => {
		const entryReferences = references
			.filter(({ currentClassId }) => currentClassId === entry.currentClassId)
			.sort(
				(left, right) =>
					LEGACY_REFERENCE_AFFINITIES.indexOf(
						left.affinity as (typeof LEGACY_REFERENCE_AFFINITIES)[number]
					) -
					LEGACY_REFERENCE_AFFINITIES.indexOf(
						right.affinity as (typeof LEGACY_REFERENCE_AFFINITIES)[number]
					)
			);
		if (
			!exactSet(
				entryReferences.map(({ affinity }) => affinity),
				LEGACY_REFERENCE_AFFINITIES
			)
		) {
			fail(`${entry.currentClassId} must retain exactly four candidate-only references`);
		}
		if (Object.values(entry.candidateReuseByAffinity).some(Boolean)) {
			fail(`${entry.currentClassId} cannot claim automatic candidate reuse`);
		}
		const mapsCanonical = entry.disposition === 'map' || entry.disposition === 'rename-map';
		if (mapsCanonical) {
			const form = canonicalById.get(entry.canonicalFormId!);
			if (!form || form.familyId !== entry.canonicalFamilyId) {
				fail(`${entry.currentClassId} links to a missing canonical family/form page`);
			}
		} else if (entry.canonicalFamilyId !== null || entry.canonicalFormId !== null) {
			fail(`${entry.currentClassId} bridge-only identity cannot count as a canonical form`);
		}
		return { ...entry, references: entryReferences };
	});

	const canonicalMappings = reconciliation.filter(
		({ disposition }) => disposition === 'map' || disposition === 'rename-map'
	).length;
	const bridgeOnly = reconciliation.filter(
		({ disposition }) => disposition === 'secondary-archetype' || disposition === 'fauna'
	).length;
	if (canonicalMappings !== 10 || bridgeOnly !== 30) {
		fail(`expected 10 canonical mappings and 30 bridge-only identities`);
	}

	return {
		sourceStatus: MONSTER_VISUAL_INDEX_SOURCE_STATUS,
		affinities: PRODUCTION_AFFINITIES,
		families: canonicalFamilies,
		forms: canonicalForms,
		reconciliation,
		counts: {
			families: 30,
			forms: 150,
			coordinates: 750,
			currentClasses: 40,
			canonicalMappings,
			bridgeOnly,
			legacyCandidateReferences: references.length
		}
	};
}

function sourceLink(sourcePage: string): string {
	return `../monster-races/${sourcePage.split('/').at(-1)}`;
}

function textOrNotApplicable(value: string | null): string {
	return value === null ? 'Not applicable for this form.' : sanitizeRenderedCopy(value);
}

export function buildMonsterWikiPage(form: CanonicalMonsterForm): string {
	const coordinates = form.coordinates
		.map(
			(coordinate) =>
				`| ${coordinate.affinity[0]!.toUpperCase()}${coordinate.affinity.slice(1)} | \`${coordinate.status}\` | \`${coordinate.targetPath}\` | \`${coordinate.assignmentPath}\` | \`${coordinate.candidatePath}\` | \`${coordinate.resultPath}\` |`
		)
		.join('\n');
	const constants = form.visualConstants
		.map((constant) => `- ${sanitizeRenderedCopy(constant)}`)
		.join('\n');
	return `# ${form.displayName}

Wiki ID: \`monster.${form.formId}\`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **planned; no coordinate on this page is approved or runtime art**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | ${form.familyName} (family ${String(form.sourceRaceNumber).padStart(2, '0')}) |
| Canonical form ID | \`${form.formId}\` |
| Tier | ${form.tier} — ${TIER_TITLES[form.tier]} |
| Primary archetype | ${sanitizeRenderedCopy(form.primaryArchetype)} |
| Floor assignment | Unassigned |
| Source | [Generator bestiary](${sourceLink(form.sourcePage)}) — ${form.sourceReferences.map(sanitizeRenderedCopy).join('; ')} |

${form.classificationNotes}

## Family visual grammar

${constants}

**Escalation axis:** ${form.escalationAxis}

**This form's visual delta:** ${sanitizeRenderedCopy(form.visualDelta)}

## Combat reading

### Battlefield duty

${sanitizeRenderedCopy(form.battlefieldDuty)}

### Teaching goal

${sanitizeRenderedCopy(form.teachingGoal)}

### Signature mechanic

${textOrNotApplicable(form.signatureMechanic)}

### Telegraph

${textOrNotApplicable(form.telegraph)}

### Counterplay

${textOrNotApplicable(form.counterplay)}

### Lower-form interaction

${textOrNotApplicable(form.lowerFormInteraction)}

## Five-coordinate candidate-production matrix

| Affinity | Production status | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- |
${coordinates}

### Status semantics

- \`planned\` means the Normal identity-anchor attempt is owned and may be produced; it does not mean an image exists.
- \`blocked-on-anchor\` means an elemental attempt must wait for accepted Normal anchor evidence before production.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Any future image remains candidate-only until independent review. Runtime promotion is a separate integration decision.
`;
}

function renderFamilySection(family: CanonicalMonsterFamily): string {
	const constants = family.visualConstants.map((constant) => `- ${constant}`).join('\n');
	const rows = family.forms
		.map(
			(form) =>
				`| ${form.tier} — ${TIER_TITLES[form.tier]} | [${form.displayName}](${form.formId}.md) | ${sanitizeRenderedCopy(form.primaryArchetype)} | ${sanitizeRenderedCopy(form.battlefieldDuty)} | ${sanitizeRenderedCopy(form.teachingGoal)} | ${textOrNotApplicable(form.signatureMechanic)} | ${textOrNotApplicable(form.telegraph)} | ${textOrNotApplicable(form.counterplay)} | ${textOrNotApplicable(form.lowerFormInteraction)} |`
		)
		.join('\n');
	return `## ${String(family.sourceRaceNumber).padStart(2, '0')} · ${family.displayName}

| Family field | Definition |
| --- | --- |
| Family ID | \`${family.familyId}\` |
| Floor assignment | Unassigned |
| Classification caveat | ${family.classificationNotes} |
| Escalation axis | ${family.escalationAxis} |
| Source | [Generator bestiary](${sourceLink(family.sourcePage)}) |

**Visual constants**

${constants}

| Tier / function | Canonical form | Primary archetype | Battlefield duty | Teaching goal | Signature mechanic | Telegraph | Counterplay | Lower-form interaction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}`;
}

function dispositionMeaning(disposition: CurrentClassMappingEntry['disposition']): string {
	return {
		map: 'canonical identity retained',
		'rename-map': 'renamed into a canonical form',
		'secondary-archetype': 'bridge-only secondary combat role',
		fauna: 'bridge-only expedition fauna',
		retire: 'retired from current production'
	}[disposition];
}

export function buildMonsterDatabaseIndex(database: CanonicalMonsterWikiDatabase): string {
	const familySections = database.families.map(renderFamilySection).join('\n\n');
	const reconciliationRows = database.reconciliation
		.map((entry) => {
			const canonical =
				entry.canonicalFormId === null
					? 'Not a canonical form; retained as bridge/reference identity'
					: `[${entry.canonicalFormId}](${entry.canonicalFormId}.md)`;
			return `| \`${entry.currentClassId}\` | ${entry.sourceFamilyLabel} | \`${entry.disposition}\` — ${dispositionMeaning(entry.disposition)} | ${canonical} | No (every target affinity) | ${entry.references.length} candidate-only references |`;
		})
		.join('\n');
	return `# Canonical monster family database

Wiki ID: \`creatures.monster-database\`

This database publishes **30 production families**, **150 canonical T1–T5 forms**, and **750
Normal/Fire/Earth/Wind/Water image coordinates**. Family is a production and encounter grouping;
it does not by itself establish biology, ancestry, personhood, culture, morality, or universal
hostility. Read the [creature taxonomy](../taxonomy.md) before turning a family label into lore.

No floor order or difficulty value is assigned here. Every \`floorSlot\` remains unassigned until a
separate authored combat integration chooses it.

Production statuses describe owned attempts, not finished images. Candidate, approved-review, and
runtime are separate states; this export promotes nothing.

${familySections}

## Current class reconciliation

The forty earlier class identities are reconciled exactly once below. Ten map or rename-map into
the 150 canonical forms. The other thirty are useful secondary roles or expedition fauna retained
as bridge-only identities; they are not “missing” canonical forms and do not increase the 150-form
count. Their 160 old public images remain candidate-only reference evidence. Every reuse flag is
false, so none is automatically accepted for a canonical coordinate.

### Current class reconciliation

| Current class ID | Source family label | Disposition | Canonical destination | Reuse eligibility | Preserved provenance |
| --- | --- | --- | --- | --- | --- |
${reconciliationRows}

## Production synchronization

Run \`pnpm export:wiki-monsters\` after packet or manifest changes. The exporter reads the validated
family packets, current-class mapping, and 750-coordinate manifest; it never derives canonical
identity from the old visual index. Generated pages and the JSON index remain deterministic, while
candidate and result paths stay collision-safe ownership declarations until pixels are produced.
`;
}

export function buildMonsterVisualIndex(database: CanonicalMonsterWikiDatabase) {
	return {
		schemaVersion: 'summonlab-monster-visual-index-v2' as const,
		sourceStatus: MONSTER_VISUAL_INDEX_SOURCE_STATUS,
		familyCount: database.counts.families,
		formCount: database.counts.forms,
		coordinateCount: database.counts.coordinates,
		currentClassCount: database.counts.currentClasses,
		affinities: database.affinities,
		families: database.families.map((family) => ({
			familyId: family.familyId,
			displayName: family.displayName,
			sourceRaceNumber: family.sourceRaceNumber,
			floorSlot: family.floorSlot,
			formIds: family.forms.map(({ formId }) => formId)
		})),
		monsters: database.forms.map((form) => ({
			id: form.formId,
			name: form.displayName,
			familyId: form.familyId,
			familyName: form.familyName,
			tier: form.tier,
			role: form.primaryArchetype,
			floorSlot: form.floorSlot,
			pagePath: `docs/wiki/creatures/monsters/${form.formId}.md`,
			variants: form.coordinates.map((coordinate) => ({
				affinity: coordinate.affinity,
				status: coordinate.status,
				presentationStatus: coordinate.sourceStatus,
				targetId: coordinate.targetId,
				targetPath: coordinate.targetPath,
				assignmentPath: coordinate.assignmentPath,
				candidatePath: coordinate.candidatePath,
				resultPath: coordinate.resultPath,
				version: coordinate.version
			}))
		})),
		reconciliation: {
			sourceStatus: 'candidate-only-reference' as const,
			entries: database.reconciliation.map((entry) => ({
				currentClassId: entry.currentClassId,
				sourceFamilyLabel: entry.sourceFamilyLabel,
				disposition: entry.disposition,
				canonicalFamilyId: entry.canonicalFamilyId,
				canonicalFormId: entry.canonicalFormId,
				candidateReuseByAffinity: entry.candidateReuseByAffinity,
				references: entry.references.map((reference) => ({
					affinity: reference.affinity,
					presentationStatus: reference.sourceStatus,
					candidatePath: reference.candidatePath,
					contentHash: reference.contentHash
				}))
			}))
		}
	};
}

export function generatedMonsterPageFileNames(database: CanonicalMonsterWikiDatabase): string[] {
	return database.forms.map(({ formId }) => `${formId}.md`).sort();
}

export function obsoleteGeneratedMonsterPages(
	existingFileNames: readonly string[],
	expectedPageFileNames: readonly string[]
): string[] {
	const expected = new Set(expectedPageFileNames);
	return existingFileNames
		.filter(
			(fileName) =>
				fileName !== 'README.md' &&
				/^[a-z][a-z0-9-]*\.md$/u.test(fileName) &&
				!expected.has(fileName)
		)
		.sort();
}

export type StoredMonsterWikiOutputs = {
	readme: string;
	visualIndex: string;
	pages: ReadonlyMap<string, string>;
	existingFileNames: readonly string[];
};

export function assertGeneratedMonsterWikiFreshness(
	database: CanonicalMonsterWikiDatabase,
	stored: StoredMonsterWikiOutputs
): void {
	const expectedPages = generatedMonsterPageFileNames(database);
	if (stored.readme !== buildMonsterDatabaseIndex(database)) fail('README is stale');
	const expectedIndex = `${JSON.stringify(buildMonsterVisualIndex(database), null, 2)}\n`;
	if (stored.visualIndex !== expectedIndex) fail('visual index is stale');
	for (const form of database.forms) {
		const fileName = `${form.formId}.md`;
		const page = stored.pages.get(fileName);
		if (page === undefined) fail(`missing generated page ${fileName}`);
		if (page !== buildMonsterWikiPage(form)) fail(`generated page ${fileName} is stale`);
	}
	const obsolete = obsoleteGeneratedMonsterPages(stored.existingFileNames, expectedPages);
	if (obsolete.length > 0) fail(`obsolete generated pages remain: ${obsolete.join(', ')}`);
}

// Legacy symbols retained only so retirement checks can import this module while the new exporter
// no longer treats the old candidate catalogs as a canonical identity source.
export function presentationStatusForVisualStudy(): 'candidate-only' {
	return 'candidate-only';
}

export function assertMonsterVisualIndexProvenance(index: { sourceStatus?: unknown }): void {
	if (index.sourceStatus !== MONSTER_VISUAL_INDEX_SOURCE_STATUS) {
		fail(`expected ${MONSTER_VISUAL_INDEX_SOURCE_STATUS}, found ${String(index.sourceStatus)}`);
	}
}

export function wikiPresentationCounterplay(
	_monsterId: string,
	authoredCounterplay: string
): string {
	return sanitizeRenderedCopy(authoredCounterplay);
}

export { CURRENT_CLASS_DISPOSITIONS };

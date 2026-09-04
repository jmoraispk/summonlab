import {
	CURRENT_CLASS_DISPOSITIONS,
	CurrentClassMappingFileSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	FamilyPacketSchema,
	FORM_TIERS,
	PRODUCTION_AFFINITIES,
	familyAffinitySha256,
	validateCanonicalTargetSourceBinding,
	type CurrentClassMappingEntry,
	type CurrentClassMappingFile,
	type FamilyAffinityManifest,
	type FamilyAffinityTarget,
	type FamilyForm,
	type FamilyPacket
} from './family-affinity-production-lib.js';
import {
	FamilyAffinityGenerationFailureSchema,
	validateCanonicalGenerationFailureSupersessionSourceBinding,
	type CanonicalGenerationFailureSupersessionSourceBinding
} from './family-affinity-review-lib.js';

export const MONSTER_AFFINITIES = PRODUCTION_AFFINITIES;
export const MONSTER_VISUAL_INDEX_SOURCE_STATUS = 'canonical-production-plan' as const;
export const RETIRED_CANONICAL_MONSTER_FORM_IDS = [
	'flame-elemental-wisp',
	'flame-elemental-flame-spirit',
	'flame-elemental-blaze-warden',
	'flame-elemental-magma-lord',
	'flame-elemental-conflagration-sovereign'
] as const;

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
	reviewEvidence: readonly MonsterWikiReviewEvidence[];
	candidateReferences: readonly LegacyCandidateReference[];
	generationFailureSourceBindings: readonly CanonicalGenerationFailureSupersessionSourceBinding[];
};

export type MonsterWikiReviewEvidence = {
	coordinateId: string;
	activeVersion: number;
	state: 'planned' | 'candidate' | 'approved-review' | 'rejected' | 'revise';
	candidatePath: string | null;
	candidateSha256: string | null;
	revisionRequired: boolean;
	historyAttemptCount: number;
	historyRevisionRequiredCount: number;
};

export type MonsterWikiPresentationStatus =
	| 'planned'
	| 'blocked-on-anchor'
	| 'candidate-only'
	| 'approved-review'
	| 'revision-required'
	| 'runtime';

export type CanonicalProductionCoordinate = {
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	status: 'planned' | 'planned-provisional-anchor' | 'blocked-on-anchor';
	presentationStatus: MonsterWikiPresentationStatus;
	coordinateId: string;
	targetId: string;
	targetPath: string;
	assignmentPath: string;
	candidatePath: string;
	resultPath: string;
	version: number;
	candidateExists: boolean;
	historyAttemptCount: number;
	historyRevisionRequiredCount: number;
	approvedPath?: string;
	runtimePath?: string;
	runtimePublicUrl?: string;
	contentHash?: string;
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
		families: number;
		forms: number;
		coordinates: number;
		currentClasses: number;
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
	const generationFailureSourceBindings = input.generationFailureSourceBindings.map((binding) => ({
		...binding,
		generationFailure: FamilyAffinityGenerationFailureSchema.parse(binding.generationFailure)
	}));
	assertUnique(
		generationFailureSourceBindings.map(({ generationFailure }) => generationFailure.coordinateId),
		'generation-failure source binding coordinate'
	);
	const generationFailureSourceBindingByCoordinate = new Map(
		generationFailureSourceBindings.map((binding) => [
			binding.generationFailure.coordinateId,
			binding
		])
	);
	const usedGenerationFailureSourceBindings = new Set<string>();
	const reviewEvidenceByCoordinate = new Map(
		input.reviewEvidence.map((evidence) => [evidence.coordinateId, evidence])
	);
	assertUnique(
		input.reviewEvidence.map(({ coordinateId }) => coordinateId),
		'review evidence coordinate'
	);

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
		const generationFailureSourceBinding = generationFailureSourceBindingByCoordinate.get(
			coordinate.coordinateId
		);
		if (generationFailureSourceBinding) {
			validateCanonicalGenerationFailureSupersessionSourceBinding({
				family: sourceForm.family,
				form: sourceForm.form,
				supersedingTarget: target,
				binding: generationFailureSourceBinding
			});
			usedGenerationFailureSourceBindings.add(coordinate.coordinateId);
		} else {
			validateCanonicalTargetSourceBinding(target, sourceForm.family, sourceForm.form);
		}
		if (
			coordinate.status !== 'planned' &&
			coordinate.status !== 'planned-provisional-anchor' &&
			coordinate.status !== 'blocked-on-anchor'
		) {
			fail(
				`${coordinate.coordinateId} must use planned, planned-provisional-anchor, or blocked-on-anchor status`
			);
		}
		const reviewEvidence = reviewEvidenceByCoordinate.get(coordinate.coordinateId);
		if (!reviewEvidence) fail(`missing review evidence for ${coordinate.coordinateId}`);
		if (reviewEvidence.activeVersion !== coordinate.activeVersion) {
			fail(`review evidence version drift for ${coordinate.coordinateId}`);
		}
		const hasCandidate = reviewEvidence.candidatePath !== null;
		if (hasCandidate !== (reviewEvidence.candidateSha256 !== null)) {
			fail(`incomplete candidate evidence for ${coordinate.coordinateId}`);
		}
		if (
			!Number.isInteger(reviewEvidence.historyAttemptCount) ||
			!Number.isInteger(reviewEvidence.historyRevisionRequiredCount) ||
			reviewEvidence.historyAttemptCount < 0 ||
			reviewEvidence.historyRevisionRequiredCount < 0 ||
			reviewEvidence.historyRevisionRequiredCount > reviewEvidence.historyAttemptCount
		) {
			fail(`invalid review history counts for ${coordinate.coordinateId}`);
		}
		if (
			hasCandidate &&
			(reviewEvidence.candidatePath !== target.ownedPaths.candidate ||
				!/^[a-f0-9]{64}$/u.test(reviewEvidence.candidateSha256 ?? ''))
		) {
			fail(`candidate evidence drift for ${coordinate.coordinateId}`);
		}
		if (
			(reviewEvidence.state === 'candidate' ||
				reviewEvidence.state === 'approved-review' ||
				reviewEvidence.state === 'rejected' ||
				reviewEvidence.state === 'revise') &&
			!hasCandidate
		) {
			fail(`review state requires candidate evidence for ${coordinate.coordinateId}`);
		}
		if (reviewEvidence.state === 'planned' && hasCandidate) {
			fail(
				`planned review state cannot carry active candidate evidence: ${coordinate.coordinateId}`
			);
		}
		if (
			reviewEvidence.revisionRequired !==
			(reviewEvidence.state === 'rejected' || reviewEvidence.state === 'revise')
		) {
			fail(`revision-required evidence disagrees with review state: ${coordinate.coordinateId}`);
		}
		if (coordinate.status === 'blocked-on-anchor' && reviewEvidence.state !== 'planned') {
			fail(`blocked coordinate cannot carry active candidate evidence: ${coordinate.coordinateId}`);
		}
		const presentationStatus: MonsterWikiPresentationStatus =
			coordinate.status === 'blocked-on-anchor'
				? 'blocked-on-anchor'
				: reviewEvidence.state === 'approved-review'
					? 'approved-review'
					: reviewEvidence.state === 'candidate'
						? 'candidate-only'
						: reviewEvidence.state === 'rejected' ||
							  reviewEvidence.state === 'revise' ||
							  reviewEvidence.revisionRequired ||
							  reviewEvidence.historyRevisionRequiredCount > 0
							? 'revision-required'
							: 'planned';
		const production: CanonicalProductionCoordinate = {
			affinity: coordinate.affinity,
			status: coordinate.status,
			presentationStatus,
			coordinateId: coordinate.coordinateId,
			targetId: target.targetId,
			targetPath: coordinate.targetPath,
			assignmentPath: coordinate.assignmentPath,
			candidatePath: target.ownedPaths.candidate,
			resultPath: target.ownedPaths.result,
			version: coordinate.activeVersion,
			candidateExists: hasCandidate,
			historyAttemptCount: reviewEvidence.historyAttemptCount,
			historyRevisionRequiredCount: reviewEvidence.historyRevisionRequiredCount
		};
		const formCoordinates = coordinatesByForm.get(coordinate.formId) ?? [];
		formCoordinates.push(production);
		coordinatesByForm.set(coordinate.formId, formCoordinates);
	}
	if (usedGenerationFailureSourceBindings.size !== generationFailureSourceBindings.length) {
		fail('orphan generation-failure source binding evidence');
	}
	if (targetsByCoordinate.size !== manifest.canonicalMatrix.activeCoordinates.length) {
		fail('target records contain coordinates outside the active manifest');
	}
	if (reviewEvidenceByCoordinate.size !== manifest.canonicalMatrix.activeCoordinates.length) {
		fail('review evidence contains coordinates outside the active manifest');
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

	const database: CanonicalMonsterWikiDatabase = {
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
	assertCandidateSafeRenderedMonsterWiki(database);
	return database;
}

function sourceLink(sourcePage: string): string {
	if (sourcePage.startsWith('docs/wiki/creatures/monster-races/')) {
		return `../monster-races/${sourcePage.split('/').at(-1)}`;
	}
	if (sourcePage.startsWith('docs/superpowers/specs/')) {
		return `../../../superpowers/specs/${sourcePage.split('/').at(-1)}`;
	}
	return `../../../${sourcePage.replace(/^docs\//u, '')}`;
}

function sourceLabel(sourcePage: string): string {
	return sourcePage.startsWith('docs/superpowers/specs/')
		? 'Accepted fauna design'
		: 'Generator bestiary';
}

function textOrNotApplicable(value: string | null): string {
	return value === null ? 'Not applicable for this form.' : sanitizeRenderedCopy(value);
}

function affinityLabel(affinity: (typeof PRODUCTION_AFFINITIES)[number]): string {
	return `${affinity[0]!.toUpperCase()}${affinity.slice(1)}`;
}

function coordinateEvidenceLabel(coordinate: CanonicalProductionCoordinate): string {
	if (coordinate.presentationStatus === 'revision-required') {
		return coordinate.historyRevisionRequiredCount > 0
			? `revision-required (${coordinate.historyRevisionRequiredCount} prior attempt${coordinate.historyRevisionRequiredCount === 1 ? '' : 's'}; active v${coordinate.version} not generated)`
			: 'revision-required';
	}
	return coordinate.presentationStatus;
}

function formVisualProductionStatus(form: CanonicalMonsterForm): string {
	if (form.coordinates.every(({ presentationStatus }) => presentationStatus === 'runtime')) {
		return 'Owner approved — one Normal image plus four affinity-variant images are published as approved sources and wiki-runtime assets.';
	}
	const states = form.coordinates
		.map(
			(coordinate) =>
				`${affinityLabel(coordinate.affinity)}: ${coordinateEvidenceLabel(coordinate)}`
		)
		.join('; ');
	return `${states}. Candidate and review evidence only; no coordinate on this page is runtime art.`;
}

export function buildMonsterWikiPage(form: CanonicalMonsterForm): string {
	if (form.coordinates.every(({ presentationStatus }) => presentationStatus === 'runtime')) {
		return buildRuntimeMonsterWikiPage(form);
	}
	const coordinates = form.coordinates
		.map(
			(coordinate) =>
				`| ${affinityLabel(coordinate.affinity)} | \`${coordinate.status}\` | \`${coordinateEvidenceLabel(coordinate)}\` | v${coordinate.version} | \`${coordinate.targetPath}\` | \`${coordinate.assignmentPath}\` | \`${coordinate.candidatePath}\` | \`${coordinate.resultPath}\` |`
		)
		.join('\n');
	const constants = form.visualConstants
		.map((constant) => `- ${sanitizeRenderedCopy(constant)}`)
		.join('\n');
	return `# ${form.displayName}

Wiki ID: \`monster.${form.formId}\`

[← Canonical monster database](README.md)

Design status: **draft canonical form**

Visual-production status: **${formVisualProductionStatus(form)}**

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

| Affinity | Production status | Evidence status | Active version | Target definition | Assignment | Candidate ownership path | Result ownership path |
| --- | --- | --- | --- | --- | --- | --- | --- |
${coordinates}

### Status semantics

- \`planned\` means the active attempt is owned and may be produced; it does not mean an image exists.
- \`planned-provisional-anchor\` means candidate generation is authorized by the exact verified Normal candidate/result chain while human review remains pending. It implies neither approval nor runtime promotion.
- \`blocked-on-anchor\` means the active attempt must wait for accepted Normal anchor evidence before production.
- \`candidate-only\` means immutable candidate and result evidence exists; review approval has not occurred, and the image is not runtime art.
- \`approved-review\` means the immutable review evidence accepted the candidate; it is not runtime art.
- \`revision-required\` means review evidence requires another attempt. Where the active version has not been generated, the label reports the prior failed-attempt count.
- Candidate and result paths reserve collision-safe ownership. They are intentionally plain code paths, not links to nonexistent pixels.
- Runtime promotion is a separate integration decision and is never performed by this wiki export.
`;
}

function buildRuntimeMonsterWikiPage(form: CanonicalMonsterForm): string {
	const coordinates = form.coordinates
		.map(
			(coordinate) =>
				`| ${affinityLabel(coordinate.affinity)} | \`runtime\` | v${coordinate.version} | \`${coordinate.targetPath}\` | \`${coordinate.candidatePath}\` | \`${coordinate.approvedPath}\` | \`${coordinate.runtimePath}\` | \`${coordinate.contentHash}\` |`
		)
		.join('\n');
	const constants = form.visualConstants
		.map((constant) => `- ${sanitizeRenderedCopy(constant)}`)
		.join('\n');
	return `# ${form.displayName}

Wiki ID: \`monster.${form.formId}\`

[← Canonical monster database](README.md)

Design status: **accepted canonical form**

Visual-production status: **${formVisualProductionStatus(form)}**

## Identity

| Field | Canonical definition |
| --- | --- |
| Family | ${form.familyName} (family ${String(form.sourceRaceNumber).padStart(2, '0')}) |
| Canonical form ID | \`${form.formId}\` |
| Tier | ${form.tier} — ${TIER_TITLES[form.tier]} |
| Primary archetype | ${sanitizeRenderedCopy(form.primaryArchetype)} |
| Floor assignment | Unassigned |
| Source | [Accepted fauna design](${sourceLink(form.sourcePage)}) — ${form.sourceReferences.map(sanitizeRenderedCopy).join('; ')} |

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

## Five-coordinate approved runtime matrix

| Affinity | State | Version | Target evidence | Candidate provenance | Approved source | Wiki-runtime asset | Source SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${coordinates}

### State semantics

- \`runtime\` means the exact owner-approved PNG source has a hash-bound WebP derivative in the enemy-only wiki-runtime catalog.
- Candidate provenance remains immutable under \`assets/enemies/experiments/fauna-family-v1\`.
- Approved sources live separately under \`assets/enemies/approved/fauna-family-v1\` and are byte-identical to the selected candidates.
- Wiki-runtime derivatives are presentation assets only; this promotion does not assign floors or change combat engine contracts.
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
| Source | [${sourceLabel(family.sourcePage)}](${sourceLink(family.sourcePage)}) |

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
			return `| \`${entry.currentClassId}\` | ${entry.sourceFamilyLabel} | \`${entry.disposition}\` — ${dispositionMeaning(entry.disposition)} | ${canonical} | ${sanitizeRenderedCopy(entry.rationale)} | No (every target affinity) | ${entry.references.length} candidate-only references |`;
		})
		.join('\n');
	return `# Canonical monster family database

Wiki ID: \`creatures.monster-database\`

This database publishes **${database.counts.families} production families**, **${database.counts.forms} canonical T1–T5 forms**, and **${database.counts.coordinates}
Normal/Fire/Earth/Wind/Water image coordinates**. Family is a production and encounter grouping;
it does not by itself establish biology, ancestry, personhood, culture, morality, or universal
hostility. Read the [creature taxonomy](../taxonomy.md) before turning a family label into lore.

No floor order or difficulty value is assigned here. Every \`floorSlot\` remains unassigned until a
separate authored combat integration chooses it.

Production statuses describe target availability. Evidence statuses are derived from validated,
immutable candidate/result/review records and the separate fauna approval/runtime catalogs.
Candidate, approved-review, approved-source, and runtime remain distinct states.

${familySections}

## Fauna expansion — approved and wired

The original 30-family, 750-coordinate matrix remains frozen and will not be regenerated. Eight
accepted fauna families—Wolves, Bears, Boars, Burrowers, Great Cats, Serpents, Crocodilians, and
Raptors—add 40 T1–T5 forms and 200 coordinates. All 200 have immutable candidate provenance,
byte-identical approved PNG sources, and hash-addressed wiki-runtime WebP derivatives. See the
[fauna family expansion](../fauna-family-expansion.md) for progression and promotion evidence.

## Completed v1 class reconciliation

The forty earlier class identities remain preserved as historical production provenance. The fauna
integration redirects Grey Wolf, Dire Wolf, Cave Bear, Tunnel Boar, and Burrowing Worm to their new
canonical forms without rewriting the original program. Armored Brood Guard, Death Knight, and Cave
Drake remain secondary archetypes in Arachnids, Skeletons, and Dragons. Old images remain
candidate-only reference evidence and are not substituted for the approved fauna coordinates.

### Current class reconciliation

| Current class ID | Source family label | Disposition | Canonical destination | Mapping rationale | Reuse eligibility | Preserved provenance |
| --- | --- | --- | --- | --- | --- | --- |
${reconciliationRows}

## Production synchronization

Run \`pnpm export:wiki-monsters\` after source or catalog changes. The exporter reads the validated
30-family production program plus the separate approved eight-family fauna program. Generated pages
and the JSON index remain deterministic; approval and runtime bindings come only from the enemy-owned
fauna catalogs.
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
				presentationStatus: coordinate.presentationStatus,
				targetId: coordinate.targetId,
				targetPath: coordinate.targetPath,
				assignmentPath: coordinate.assignmentPath,
				candidatePath: coordinate.candidatePath,
				resultPath: coordinate.resultPath,
				version: coordinate.version,
				candidateExists: coordinate.candidateExists,
				historyAttemptCount: coordinate.historyAttemptCount,
				historyRevisionRequiredCount: coordinate.historyRevisionRequiredCount,
				...(coordinate.approvedPath
					? {
							approvedPath: coordinate.approvedPath,
							runtimePath: coordinate.runtimePath,
							runtimePublicUrl: coordinate.runtimePublicUrl,
							contentHash: coordinate.contentHash
						}
					: {})
			}))
		})),
		legacyRoutes: legacyMonsterRouteMap(database),
		reconciliation: {
			sourceStatus: 'candidate-only-reference' as const,
			entries: database.reconciliation.map((entry) => ({
				currentClassId: entry.currentClassId,
				sourceFamilyLabel: entry.sourceFamilyLabel,
				disposition: entry.disposition,
				canonicalFamilyId: entry.canonicalFamilyId,
				canonicalFormId: entry.canonicalFormId,
				rationale: entry.rationale,
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

export function legacyMonsterPageFileNames(database: CanonicalMonsterWikiDatabase): string[] {
	const canonicalIds = new Set(database.forms.map(({ formId }) => formId));
	return database.reconciliation
		.map(({ currentClassId }) => currentClassId)
		.filter((currentClassId) => !canonicalIds.has(currentClassId))
		.map((currentClassId) => `${currentClassId}.md`)
		.sort();
}

export function obsoleteGeneratedMonsterPages(
	database: CanonicalMonsterWikiDatabase,
	existingFileNames: readonly string[]
): string[] {
	const existing = new Set(existingFileNames);
	return [
		...legacyMonsterPageFileNames(database),
		...RETIRED_CANONICAL_MONSTER_FORM_IDS.map((formId) => `${formId}.md`)
	]
		.filter((fileName) => existing.has(fileName))
		.sort();
}

export function unmanagedMonsterPageCollisions(
	database: CanonicalMonsterWikiDatabase,
	existingFileNames: readonly string[]
): string[] {
	const managed = new Set([
		'README.md',
		...generatedMonsterPageFileNames(database),
		...legacyMonsterPageFileNames(database),
		...RETIRED_CANONICAL_MONSTER_FORM_IDS.map((formId) => `${formId}.md`)
	]);
	return existingFileNames
		.filter((fileName) => /^[a-z][a-z0-9-]*\.md$/u.test(fileName) && !managed.has(fileName))
		.sort();
}

export function assertManagedMonsterCatalogEntries(
	database: CanonicalMonsterWikiDatabase,
	entries: readonly { wikiId: string }[]
): void {
	const allowedMonsterWikiIds = new Set([
		...database.forms.map(({ formId }) => `monster.${formId}`),
		...database.reconciliation.map(({ currentClassId }) => `monster.${currentClassId}`),
		...RETIRED_CANONICAL_MONSTER_FORM_IDS.map((formId) => `monster.${formId}`)
	]);
	const unknown = entries
		.map(({ wikiId }) => wikiId)
		.filter((wikiId) => wikiId.startsWith('monster.') && !allowedMonsterWikiIds.has(wikiId));
	if (unknown.length > 0) {
		fail(`unmanaged monster catalog collision: ${unknown.sort().join(', ')}`);
	}
}

export type LegacyMonsterRoute = {
	currentClassId: string;
	disposition: CurrentClassMappingEntry['disposition'];
	destination: string;
	statusCode: 308;
};

export function legacyMonsterRouteMap(
	database: CanonicalMonsterWikiDatabase
): LegacyMonsterRoute[] {
	return database.reconciliation.map((entry) => {
		const destination =
			entry.canonicalFormId === null
				? '/wiki/creatures/monsters#current-class-reconciliation'
				: `/wiki/creatures/monsters/${entry.canonicalFormId}`;
		if (destination === `/wiki/creatures/monsters/${entry.currentClassId}`) {
			fail(`legacy route would redirect-loop: ${entry.currentClassId}`);
		}
		return {
			currentClassId: entry.currentClassId,
			disposition: entry.disposition,
			destination,
			statusCode: 308
		};
	});
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
	if (stored.readme !== buildMonsterDatabaseIndex(database)) fail('README is stale');
	const expectedIndex = `${JSON.stringify(buildMonsterVisualIndex(database), null, 2)}\n`;
	if (stored.visualIndex !== expectedIndex) fail('visual index is stale');
	for (const form of database.forms) {
		const fileName = `${form.formId}.md`;
		const page = stored.pages.get(fileName);
		if (page === undefined) fail(`missing generated page ${fileName}`);
		if (page !== buildMonsterWikiPage(form)) fail(`generated page ${fileName} is stale`);
	}
	const obsolete = obsoleteGeneratedMonsterPages(database, stored.existingFileNames);
	if (obsolete.length > 0) fail(`managed legacy pages remain: ${obsolete.join(', ')}`);
	const unmanaged = unmanagedMonsterPageCollisions(database, stored.existingFileNames);
	if (unmanaged.length > 0) fail(`unmanaged monster page collision: ${unmanaged.join(', ')}`);
}

export function assertCandidateSafeRenderedMonsterWiki(
	database: CanonicalMonsterWikiDatabase
): void {
	const rendered = [
		['README.md', buildMonsterDatabaseIndex(database)],
		...database.forms.map((form) => [`${form.formId}.md`, buildMonsterWikiPage(form)] as const)
	] as const;
	for (const [fileName, source] of rendered) {
		const withoutFixedNegativeLanguage = source
			.replace(/no coordinate[^.\n]*(?:approved|runtime)[^.\n]*/giu, '')
			.replace(/(?:is|are|remains?)\s+(?:intentionally\s+)?not\s+(?:approved|runtime)/giu, '')
			.replace(/neither\s+approved\s+nor\s+runtime/giu, '')
			.replace(/never\s+(?:a\s+)?runtime(?:\s+asset)?/giu, '')
			.replace(/does\s+not\s+(?:mean|make)[^.\n]*(?:approved|runtime)/giu, '');
		if (
			/\bcandidate\s+(?:is|are|becomes?|status\s*:)\s*(?:approved|runtime)\b/iu.test(
				withoutFixedNegativeLanguage
			) ||
			/\b(?:approved|runtime)\s+candidate\b/iu.test(withoutFixedNegativeLanguage)
		) {
			fail(`affirmative candidate-as-approved/runtime wording in ${fileName}`);
		}
	}
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

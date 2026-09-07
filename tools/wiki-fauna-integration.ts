import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
	FAUNA_FAMILY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	FamilyPacketSchema,
	FaunaFamilyManifestSchema,
	PRODUCTION_AFFINITIES,
	familyAffinityRawSha256,
	familyAffinitySha256,
	loadFamilyAffinityActiveSources,
	validateCanonicalTargetSourceBinding,
	type FamilyAffinityManifest
} from './family-affinity-production-lib.js';
import {
	FamilyAffinityGenerationFailureSchema,
	buildFamilyAffinityReviewArtifacts,
	familyAffinityGenerationFailurePath,
	type CanonicalGenerationFailureSupersessionSourceBinding
} from './family-affinity-review-lib.js';
import {
	FAUNA_APPROVED_MANIFEST_PATH,
	FAUNA_OWNER_APPROVAL_PATH,
	FAUNA_RUNTIME_CATALOG_PATH
} from './fauna-family-promotion.js';
import {
	assertCandidateSafeRenderedMonsterWiki,
	buildCanonicalMonsterWikiDatabase,
	type CanonicalMonsterFamily,
	type CanonicalMonsterForm,
	type CanonicalMonsterWikiDatabase,
	type LegacyCandidateReference,
	type MonsterWikiBuildInput
} from './wiki-monster-database-lib.js';

type LegacyCatalogEntry = {
	speciesId: string;
	affinity: string;
	status: 'candidate' | 'revise';
	candidatePath: string;
	candidateHash?: string;
	contentHash?: string;
	selectedVersion?: string;
};

type ApprovedRecord = {
	assetKey: string;
	coordinateId: string;
	familyId: string;
	formId: string;
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	activeVersion: number;
	target: { path: string; sha256: string };
	assignment: { path: string; sha256: string };
	candidate: { path: string; sha256: string };
	provenance: { path: string; sha256: string };
	approved: { path: string; sha256: string };
};

type RuntimeRecord = {
	assetKey: string;
	coordinateId: string;
	familyId: string;
	formId: string;
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	source: { path: string; sha256: string };
	runtime: { path: string; publicUrl: string; sha256: string };
};

async function readJson<T>(repositoryRoot: string, path: string): Promise<T> {
	return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8')) as T;
}

async function rawSha256(repositoryRoot: string, path: string): Promise<string> {
	return createHash('sha256')
		.update(await readFile(resolve(repositoryRoot, path)))
		.digest('hex');
}

function pathAtVersion(path: string, activeVersion: number, version: number): string {
	const suffix = `v${activeVersion}.json`;
	if (!path.endsWith(suffix)) throw new Error(`Versioned attempt path is malformed: ${path}`);
	return `${path.slice(0, -suffix.length)}v${version}.json`;
}

function versionFrom(entry: LegacyCatalogEntry): number {
	return Number(
		entry.selectedVersion?.match(/v(\d+)/u)?.[1] ??
			entry.candidatePath.match(/-v(\d+)\.png$/u)?.[1] ??
			1
	);
}

export async function loadBaseMonsterWikiBuildInput(
	repositoryRoot: string
): Promise<MonsterWikiBuildInput> {
	const { families, mapping } = await loadFamilyAffinityActiveSources(repositoryRoot);
	const reviewArtifacts = await buildFamilyAffinityReviewArtifacts(repositoryRoot);
	const manifest = FamilyAffinityManifestSchema.parse(
		await readJson(
			resolve(repositoryRoot),
			'assets/enemies/experiments/family-affinity-v1/manifest.json'
		)
	);
	const targets = await Promise.all(
		manifest.canonicalMatrix.activeCoordinates.map(async ({ targetPath }) =>
			FamilyAffinityTargetSchema.parse(await readJson(repositoryRoot, targetPath))
		)
	);
	async function loadGenerationFailureSourceBinding(
		coordinate: (typeof manifest.canonicalMatrix.activeCoordinates)[number],
		version: number
	): Promise<CanonicalGenerationFailureSupersessionSourceBinding | undefined> {
		if (version <= 1) return undefined;
		const previousVersion = version - 1;
		const previousTargetPath = pathAtVersion(
			coordinate.targetPath,
			coordinate.activeVersion,
			previousVersion
		);
		const previousAssignmentPath = pathAtVersion(
			coordinate.assignmentPath,
			coordinate.activeVersion,
			previousVersion
		);
		const previousTarget = FamilyAffinityTargetSchema.parse(
			await readJson(repositoryRoot, previousTargetPath)
		);
		const failurePath = familyAffinityGenerationFailurePath(previousTarget);
		if (!existsSync(resolve(repositoryRoot, failurePath))) return undefined;
		const generationFailure = FamilyAffinityGenerationFailureSchema.parse(
			await readJson(repositoryRoot, failurePath)
		);
		const previousBinding = await loadGenerationFailureSourceBinding(coordinate, previousVersion);
		return {
			previousTargetPath,
			previousAssignmentPath,
			previousTarget,
			previousAssignment: FamilyAffinityAssignmentSchema.parse(
				await readJson(repositoryRoot, previousAssignmentPath)
			),
			generationFailure,
			...(previousBinding ? { previousBinding } : {})
		};
	}
	const generationFailureSourceBindings: CanonicalGenerationFailureSupersessionSourceBinding[] = [];
	for (const coordinate of manifest.canonicalMatrix.activeCoordinates) {
		const binding = await loadGenerationFailureSourceBinding(coordinate, coordinate.activeVersion);
		if (binding) generationFailureSourceBindings.push(binding);
	}
	const candidateReferences: LegacyCandidateReference[] = [];
	for (const path of [
		'assets/enemies/experiments/affinity-workflow-v1/review/catalog.json',
		'assets/enemies/experiments/affinity-expansion-v1/review/catalog.json'
	]) {
		const catalog = await readJson<{ entries: LegacyCatalogEntry[] }>(repositoryRoot, path);
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
	return {
		families,
		mapping,
		manifest,
		targets,
		reviewEvidence: reviewArtifacts.families.flatMap(({ summary }) => summary.cells),
		candidateReferences,
		generationFailureSourceBindings
	};
}

const promotedLegacyForms = new Map([
	['grey-wolf', ['wolves', 'wolf-grey-wolf']],
	['dire-wolf', ['wolves', 'wolf-dire-wolf']],
	['cave-bear', ['bears', 'bear-cave-bear']],
	['tunnel-boar', ['boars', 'boar-tunnel-boar']],
	['burrowing-worm', ['burrowers', 'burrower-burrowing-worm']]
]);

async function extendWithFauna(
	repositoryRoot: string,
	base: CanonicalMonsterWikiDatabase
): Promise<CanonicalMonsterWikiDatabase> {
	const activeSources = await readJson<{ familyPacketPaths: string[] }>(
		repositoryRoot,
		`${FAUNA_FAMILY_ROOT}/active-sources.json`
	);
	const families = await Promise.all(
		activeSources.familyPacketPaths.map(async (path) =>
			FamilyPacketSchema.parse(await readJson(repositoryRoot, path))
		)
	);
	const manifest = FaunaFamilyManifestSchema.parse(
		await readJson(repositoryRoot, `${FAUNA_FAMILY_ROOT}/manifest.json`)
	);
	const approvedManifest = await readJson<{
		schemaVersion: string;
		records: ApprovedRecord[];
	}>(repositoryRoot, FAUNA_APPROVED_MANIFEST_PATH);
	const runtimeCatalog = await readJson<{
		schemaVersion: string;
		ownerApproval: { path: string; sha256: string };
		records: RuntimeRecord[];
	}>(repositoryRoot, FAUNA_RUNTIME_CATALOG_PATH);
	if (
		families.length !== 8 ||
		manifest.canonicalMatrix.activeCoordinates.length !== 200 ||
		approvedManifest.schemaVersion !== 'fauna-family-approved-manifest-v1' ||
		runtimeCatalog.schemaVersion !== 'fauna-family-runtime-catalog-v1' ||
		approvedManifest.records.length !== 200 ||
		runtimeCatalog.records.length !== 200 ||
		runtimeCatalog.ownerApproval.path !== FAUNA_OWNER_APPROVAL_PATH ||
		(await rawSha256(repositoryRoot, FAUNA_OWNER_APPROVAL_PATH)) !==
			runtimeCatalog.ownerApproval.sha256
	) {
		throw new Error('Fauna wiki integration requires the complete approved runtime catalogs');
	}
	const approvedByCoordinate = new Map(
		approvedManifest.records.map((record) => [record.coordinateId, record])
	);
	const runtimeByCoordinate = new Map(
		runtimeCatalog.records.map((record) => [record.coordinateId, record])
	);
	if (approvedByCoordinate.size !== 200 || runtimeByCoordinate.size !== 200) {
		throw new Error('Fauna wiki integration found duplicate promotion coordinates');
	}
	const manifestByCoordinate = new Map(
		manifest.canonicalMatrix.activeCoordinates.map((coordinate) => [
			coordinate.coordinateId,
			coordinate
		])
	);

	const faunaFamilies: CanonicalMonsterFamily[] = [];
	for (const family of families) {
		const forms: CanonicalMonsterForm[] = [];
		for (const form of family.forms) {
			const coordinates: CanonicalMonsterForm['coordinates'][number][] = [];
			for (const affinity of PRODUCTION_AFFINITIES) {
				const coordinateId = `${family.familyId}/${form.formId}/${affinity}`;
				const coordinate = manifestByCoordinate.get(coordinateId);
				const approved = approvedByCoordinate.get(coordinateId);
				const runtime = runtimeByCoordinate.get(coordinateId);
				if (!coordinate || !approved || !runtime) {
					throw new Error(`Missing fauna wiki promotion binding: ${coordinateId}`);
				}
				if (coordinate.status === 'earth-bridge-provisional') {
					throw new Error(`Fauna coordinate cannot use a bridge status: ${coordinateId}`);
				}
				const target = FamilyAffinityTargetSchema.parse(
					await readJson(repositoryRoot, coordinate.targetPath)
				);
				validateCanonicalTargetSourceBinding(target, family, form);
				if (
					familyAffinitySha256(target) !== coordinate.targetSha256 ||
					approved.target.path !== coordinate.targetPath ||
					approved.target.sha256 !== coordinate.targetSha256 ||
					approved.familyId !== family.familyId ||
					approved.formId !== form.formId ||
					approved.affinity !== affinity ||
					runtime.assetKey !== approved.assetKey ||
					runtime.source.path !== approved.approved.path ||
					runtime.source.sha256 !== approved.approved.sha256
				) {
					throw new Error(`Fauna wiki promotion hash drift: ${coordinateId}`);
				}
				coordinates.push({
					affinity,
					status: coordinate.status,
					presentationStatus: 'runtime',
					coordinateId,
					targetId: target.targetId,
					targetPath: coordinate.targetPath,
					assignmentPath: coordinate.assignmentPath,
					candidatePath: approved.candidate.path,
					resultPath: approved.provenance.path,
					version: coordinate.activeVersion,
					candidateExists: true,
					sourceContentHash: approved.approved.sha256,
					historyAttemptCount: 1,
					historyRevisionRequiredCount: 0,
					approvedPath: approved.approved.path,
					runtimePath: runtime.runtime.path,
					runtimePublicUrl: runtime.runtime.publicUrl,
					contentHash: approved.approved.sha256
				});
			}
			forms.push({
				...form,
				familyId: family.familyId,
				familyName: family.displayName,
				sourceRaceNumber: family.sourceRaceNumber,
				sourcePage: family.sourcePage,
				classificationNotes: family.classificationNotes,
				visualConstants: family.visualConstants,
				escalationAxis: family.escalationAxis,
				floorSlot: null,
				coordinates
			});
		}
		faunaFamilies.push({ ...family, floorSlot: null, forms });
	}
	const allFamilies = [...base.families, ...faunaFamilies];
	const allForms = [...base.forms, ...faunaFamilies.flatMap(({ forms }) => forms)];
	const reconciliation = base.reconciliation.map((entry) => {
		const destination = promotedLegacyForms.get(entry.currentClassId);
		if (!destination) return entry;
		return {
			...entry,
			disposition: 'rename-map' as const,
			canonicalFamilyId: destination[0]!,
			canonicalFormId: destination[1]!,
			rationale: `${entry.rationale} The accepted fauna expansion now promotes this identity to ${destination[1]}.`
		};
	});
	const canonicalMappings = reconciliation.filter(
		({ disposition }) => disposition === 'map' || disposition === 'rename-map'
	).length;
	const bridgeOnly = reconciliation.filter(
		({ disposition }) => disposition === 'secondary-archetype' || disposition === 'fauna'
	).length;
	const integrated: CanonicalMonsterWikiDatabase = {
		...base,
		families: allFamilies,
		forms: allForms,
		reconciliation,
		counts: {
			...base.counts,
			families: 38,
			forms: 190,
			coordinates: 950,
			canonicalMappings,
			bridgeOnly
		}
	};
	assertCandidateSafeRenderedMonsterWiki(integrated);
	return integrated;
}

export async function loadIntegratedMonsterWikiDatabase(
	repositoryRoot: string
): Promise<CanonicalMonsterWikiDatabase> {
	const baseInput = await loadBaseMonsterWikiBuildInput(repositoryRoot);
	const base = buildCanonicalMonsterWikiDatabase(baseInput);
	return extendWithFauna(repositoryRoot, base);
}

export async function loadBaseMonsterManifest(
	repositoryRoot: string
): Promise<FamilyAffinityManifest> {
	return FamilyAffinityManifestSchema.parse(
		await readJson(repositoryRoot, 'assets/enemies/experiments/family-affinity-v1/manifest.json')
	);
}

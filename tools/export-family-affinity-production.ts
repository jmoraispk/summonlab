import { lstat, mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	buildFamilyAffinityProductionBundle,
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityReviewReceiptSchema,
	FamilyAffinityTargetSchema,
	loadFamilyAffinityActiveSources,
	readFamilyAffinityOwnedFile,
	familyAffinityRawSha256,
	familyAffinitySha256,
	FamilyPacketSchema,
	stableFamilyAffinityJson,
	validateCanonicalTargetSourceBinding,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityNormalAnchorEvidence,
	validateFamilyAffinityProductionBundle,
	validateFamilyAffinityReviewPromotion,
	type FamilyAffinityAssignment,
	type FamilyAffinityManifest,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';
import {
	familyAffinityGenerationFailurePath,
	validateFamilyAffinityGenerationFailureEvidence,
	type FamilyAffinityGenerationFailure
} from './family-affinity-review-lib.js';

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function listFiles(directory: string): Promise<string[]> {
	if (!(await fileExists(directory))) return [];
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Symlinked owned path is forbidden: ${path}`);
			return entry.isDirectory() ? listFiles(path) : [path];
		})
	);
	return nested.flat().sort();
}

function legacyReviewPathTarget(target: FamilyAffinityTarget): FamilyAffinityTarget {
	return {
		...target,
		anchor:
			target.anchor.kind === 'normal-approved-review'
				? {
						...target.anchor,
						reviewReceiptPath: `${FAMILY_AFFINITY_ROOT}/reviews/${target.familyId}/${target.formId}/normal/decision-v${target.anchor.normalVersion}.json`
					}
				: target.anchor,
		ownedPaths: {
			...target.ownedPaths,
			decision: `${FAMILY_AFFINITY_ROOT}/reviews/${target.familyId}/${target.formId}/${target.affinity}/decision-v${target.version}.json`,
			blindReview: `${FAMILY_AFFINITY_ROOT}/blind-reviews/${target.familyId}/${target.formId}/${target.affinity}/review-v${target.version}.json`
		}
	};
}

async function migrateExactLegacyReviewPaths(
	repositoryRoot: string,
	manifestPath: string,
	bundle: ReturnType<typeof buildFamilyAffinityProductionBundle>,
	check: boolean
): Promise<boolean> {
	const legacyPathTargets = bundle.targets.map(legacyReviewPathTarget);
	const legacyNormalShaByForm = new Map(
		legacyPathTargets
			.filter(({ affinity }) => affinity === 'normal')
			.map(
				(target) => [`${target.familyId}/${target.formId}`, familyAffinitySha256(target)] as const
			)
	);
	const legacyTargets = legacyPathTargets.map((target) =>
		target.anchor.kind === 'normal-approved-review'
			? {
					...target,
					anchor: {
						...target.anchor,
						normalTargetSha256: legacyNormalShaByForm.get(`${target.familyId}/${target.formId}`)!
					}
				}
			: target
	);
	const legacyTargetByCoordinate = new Map(
		legacyTargets.map((target) => [target.coordinateId, target] as const)
	);
	const legacyAssignments = bundle.assignments.map((assignment) => ({
		...assignment,
		targetSha256: familyAffinitySha256(legacyTargetByCoordinate.get(assignment.coordinateId)!)
	}));
	const legacyAssignmentByCoordinate = new Map(
		legacyAssignments.map((assignment) => [assignment.coordinateId, assignment] as const)
	);
	const legacyManifest = {
		...bundle.manifest,
		canonicalMatrix: {
			...bundle.manifest.canonicalMatrix,
			activeCoordinates: bundle.manifest.canonicalMatrix.activeCoordinates.map((coordinate) => ({
				...coordinate,
				targetSha256: familyAffinitySha256(legacyTargetByCoordinate.get(coordinate.coordinateId)!),
				assignmentSha256: familyAffinitySha256(
					legacyAssignmentByCoordinate.get(coordinate.coordinateId)!
				)
			}))
		}
	};
	const legacyArtifacts = [
		{ path: manifestPath, value: legacyManifest },
		...bundle.manifest.canonicalMatrix.activeCoordinates.flatMap((coordinate) => [
			{
				path: coordinate.targetPath,
				value: legacyTargetByCoordinate.get(coordinate.coordinateId)!
			},
			{
				path: coordinate.assignmentPath,
				value: legacyAssignmentByCoordinate.get(coordinate.coordinateId)!
			}
		])
	];
	for (const artifact of legacyArtifacts) {
		const absolute = join(repositoryRoot, artifact.path);
		if (!(await fileExists(absolute))) return false;
		if (
			(await readFamilyAffinityOwnedFile(repositoryRoot, artifact.path)).toString('utf8') !==
			stableFamilyAffinityJson(artifact.value)
		)
			return false;
	}
	const evidenceRoots = [
		'candidates',
		'results',
		'reviews',
		'blind-reviews',
		'review/decisions',
		'review/blind',
		'review/assignments',
		'review/bridge'
	];
	for (const directory of evidenceRoots) {
		if ((await listFiles(join(repositoryRoot, FAMILY_AFFINITY_ROOT, directory))).length !== 0) {
			return false;
		}
	}
	if (check) {
		throw new Error(
			'Family affinity production export check failed: legacy review paths require migration'
		);
	}
	for (const artifact of bundle.artifacts) {
		const absolute = join(repositoryRoot, artifact.path);
		const temporary = `${absolute}.review-path-migration-${process.pid}`;
		try {
			await writeFile(temporary, stableFamilyAffinityJson(artifact.value), { flag: 'wx' });
			await rename(temporary, absolute);
		} finally {
			await unlink(temporary).catch(() => undefined);
		}
	}
	return true;
}

function pathAtVersion(path: string, activeVersion: number, version: number): string {
	const suffix = `v${activeVersion}.json`;
	if (!path.endsWith(suffix)) throw new Error(`Versioned attempt path is malformed: ${path}`);
	return `${path.slice(0, -suffix.length)}v${version}.json`;
}

type LoadedCorpus = {
	manifest: FamilyAffinityManifest;
	targets: FamilyAffinityTarget[];
	assignments: FamilyAffinityAssignment[];
	expectedAttemptPaths: Set<string>;
};

const ELEMENTAL_REPLACEMENT_MIGRATION_ID = 'flame-elementals-to-elementals-v1';
const ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID = 'flame-elementals';
const ELEMENTAL_REPLACEMENT_TARGET_FAMILY_ID = 'elementals';
const ELEMENTAL_REPLACEMENT_RECEIPT_PATH = `${FAMILY_AFFINITY_ROOT}/migrations/${ELEMENTAL_REPLACEMENT_MIGRATION_ID}.json`;
const ELEMENTAL_REPLACEMENT_ARCHIVE_ROOT = `${FAMILY_AFFINITY_ROOT}/migrations/archive/${ELEMENTAL_REPLACEMENT_MIGRATION_ID}`;
const LEGACY_WISP_RETIREMENT_ID = 'retire-legacy-ember-wisp-bridge-v1';
const LEGACY_WISP_RETIREMENT_RECEIPT_PATH = `${FAMILY_AFFINITY_ROOT}/migrations/${LEGACY_WISP_RETIREMENT_ID}.json`;
const LEGACY_WISP_RETIREMENT_ARCHIVE_ROOT = `${FAMILY_AFFINITY_ROOT}/migrations/archive/${LEGACY_WISP_RETIREMENT_ID}`;

async function rejectElementalReplacementEvidence(
	repositoryRoot: string,
	target: FamilyAffinityTarget
): Promise<void> {
	for (const path of Object.values(target.ownedPaths)) {
		if (await fileExists(join(repositoryRoot, path))) {
			throw new Error(
				`Elemental family replacement refuses produced or reviewed evidence: ${path}`
			);
		}
	}
	for (const reviewRoot of ['review/assignments', 'review/blind', 'review/decisions']) {
		const files = await listFiles(join(repositoryRoot, FAMILY_AFFINITY_ROOT, reviewRoot));
		if (files.some((path) => path.includes(`/${ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID}/`))) {
			throw new Error('Elemental family replacement refuses existing canonical review evidence');
		}
	}
}

async function maybeMigrateElementalFamilyReplacement(input: {
	repositoryRoot: string;
	manifestPath: string;
	sourceBundle: ReturnType<typeof buildFamilyAffinityProductionBundle>;
	check: boolean;
}): Promise<boolean> {
	const manifestBytes = await readFamilyAffinityOwnedFile(input.repositoryRoot, input.manifestPath);
	const existing = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const existingFamilyIds = new Set(
		existing.canonicalMatrix.activeCoordinates.map(({ familyId }) => familyId)
	);
	const expectedFamilyIds = new Set(
		input.sourceBundle.manifest.canonicalMatrix.activeCoordinates.map(({ familyId }) => familyId)
	);
	if (!existingFamilyIds.has(ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID)) return false;
	if (
		expectedFamilyIds.has(ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID) &&
		!expectedFamilyIds.has(ELEMENTAL_REPLACEMENT_TARGET_FAMILY_ID)
	) {
		return false;
	}
	if (
		existingFamilyIds.has(ELEMENTAL_REPLACEMENT_TARGET_FAMILY_ID) ||
		expectedFamilyIds.has(ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID) ||
		!expectedFamilyIds.has(ELEMENTAL_REPLACEMENT_TARGET_FAMILY_ID)
	) {
		throw new Error(
			'Existing canonical family set differs outside the supported Elementals replacement'
		);
	}
	if (input.check) {
		throw new Error(
			'Family affinity production export check failed: Elementals migration required'
		);
	}
	const oldCoordinates = existing.canonicalMatrix.activeCoordinates.filter(
		({ familyId }) => familyId === ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID
	);
	const newCoordinates = input.sourceBundle.manifest.canonicalMatrix.activeCoordinates.filter(
		({ familyId }) => familyId === ELEMENTAL_REPLACEMENT_TARGET_FAMILY_ID
	);
	if (oldCoordinates.length !== 25 || newCoordinates.length !== 25) {
		throw new Error('Elemental family replacement requires exactly 25 old and 25 new coordinates');
	}
	const preservedExpectedIds = input.sourceBundle.manifest.canonicalMatrix.activeCoordinates
		.filter(({ familyId }) => familyId !== ELEMENTAL_REPLACEMENT_TARGET_FAMILY_ID)
		.map(({ coordinateId }) => coordinateId);
	const preservedExistingIds = existing.canonicalMatrix.activeCoordinates
		.filter(({ familyId }) => familyId !== ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID)
		.map(({ coordinateId }) => coordinateId);
	if (
		preservedExpectedIds.length !== 725 ||
		preservedExpectedIds.some((coordinateId, index) => coordinateId !== preservedExistingIds[index])
	) {
		throw new Error('Elemental family replacement would alter a non-replaced canonical coordinate');
	}
	const legacyPacketPath = `${FAMILY_AFFINITY_ROOT}/families/21-flame-elementals.json`;
	const legacyPacketBytes = await readFamilyAffinityOwnedFile(
		input.repositoryRoot,
		legacyPacketPath
	);
	const legacyPacket = FamilyPacketSchema.parse(JSON.parse(legacyPacketBytes.toString('utf8')));
	if (
		legacyPacket.familyId !== ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID ||
		legacyPacket.sourceRaceNumber !== 21 ||
		legacyPacket.packetPath !== undefined
	) {
		throw new Error('Legacy Flame Elementals packet is not the expected immutable source packet');
	}
	const oldArtifacts: Array<{ path: string; archivePath: string; sha256: string }> = [];
	for (const coordinate of oldCoordinates) {
		if (coordinate.activeVersion !== 1) {
			throw new Error('Elemental family replacement refuses revised canonical coordinates');
		}
		const targetBytes = await readFamilyAffinityOwnedFile(
			input.repositoryRoot,
			coordinate.targetPath
		);
		const assignmentBytes = await readFamilyAffinityOwnedFile(
			input.repositoryRoot,
			coordinate.assignmentPath
		);
		const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(assignmentBytes.toString('utf8'))
		);
		if (
			target.status !== (target.affinity === 'normal' ? 'planned' : 'blocked-on-anchor') ||
			target.precedingAttempt !== null ||
			target.sources.familyPacketPath !== legacyPacketPath
		) {
			throw new Error('Elemental family replacement refuses a non-pristine old planning target');
		}
		const form = legacyPacket.forms.find(({ formId }) => formId === target.formId);
		if (!form) throw new Error(`Legacy Elemental target has an unknown form: ${target.formId}`);
		validateCanonicalTargetSourceBinding(target, legacyPacket, form);
		validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
		await rejectElementalReplacementEvidence(input.repositoryRoot, target);
		for (const [path, bytes] of [
			[coordinate.targetPath, targetBytes],
			[coordinate.assignmentPath, assignmentBytes]
		] as const) {
			oldArtifacts.push({
				path,
				archivePath: `${ELEMENTAL_REPLACEMENT_ARCHIVE_ROOT}/${path.slice(`${FAMILY_AFFINITY_ROOT}/`.length)}`,
				sha256: familyAffinityRawSha256(bytes)
			});
		}
	}
	const retiredControllerArtifacts: Array<{
		path: string;
		archivePath: string;
		sha256: string;
	}> = [];
	for (const path of [
		`${FAMILY_AFFINITY_ROOT}/review/families/flame-elementals/summary.json`,
		`${FAMILY_AFFINITY_ROOT}/review/families/flame-elementals/contact-sheet.png`
	]) {
		if (!(await fileExists(join(input.repositoryRoot, path)))) continue;
		const bytes = await readFamilyAffinityOwnedFile(input.repositoryRoot, path);
		retiredControllerArtifacts.push({
			path,
			archivePath: `${ELEMENTAL_REPLACEMENT_ARCHIVE_ROOT}/${path.slice(`${FAMILY_AFFINITY_ROOT}/`.length)}`,
			sha256: familyAffinityRawSha256(bytes)
		});
	}
	const newArtifactValues = new Map(
		input.sourceBundle.artifacts.map(({ path, value }) => [path, value] as const)
	);
	const newArtifacts = newCoordinates.flatMap((coordinate) => [
		{ path: coordinate.targetPath, value: newArtifactValues.get(coordinate.targetPath) },
		{ path: coordinate.assignmentPath, value: newArtifactValues.get(coordinate.assignmentPath) }
	]);
	if (newArtifacts.some(({ value }) => value === undefined)) {
		throw new Error('Elemental family replacement is missing a derived planning artifact');
	}
	for (const { path } of newArtifacts) {
		if (await fileExists(join(input.repositoryRoot, path))) {
			throw new Error(`Elemental family replacement path already exists: ${path}`);
		}
	}
	for (const { archivePath } of [...oldArtifacts, ...retiredControllerArtifacts]) {
		if (await fileExists(join(input.repositoryRoot, archivePath))) {
			throw new Error(`Elemental family replacement archive path already exists: ${archivePath}`);
		}
	}
	if (await fileExists(join(input.repositoryRoot, ELEMENTAL_REPLACEMENT_RECEIPT_PATH))) {
		throw new Error('Elemental family replacement receipt exists before manifest migration');
	}
	const replacementByIndex = new Map(
		oldCoordinates.map((coordinate, index) => [coordinate.coordinateId, newCoordinates[index]!])
	);
	const nextManifest = FamilyAffinityManifestSchema.parse({
		...existing,
		canonicalMatrix: {
			...existing.canonicalMatrix,
			activeCoordinates: existing.canonicalMatrix.activeCoordinates.map((coordinate) =>
				coordinate.familyId === ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID
					? replacementByIndex.get(coordinate.coordinateId)!
					: coordinate
			)
		},
		mappingReservations: input.sourceBundle.manifest.mappingReservations,
		ownership: input.sourceBundle.manifest.ownership
	});
	const receipt = {
		schemaVersion: 'family-affinity-family-replacement-v1',
		migrationId: ELEMENTAL_REPLACEMENT_MIGRATION_ID,
		sourceFamilyId: ELEMENTAL_REPLACEMENT_SOURCE_FAMILY_ID,
		replacementFamilyId: ELEMENTAL_REPLACEMENT_TARGET_FAMILY_ID,
		canonicalCoordinateCount: 25,
		oldPlanningArtifactCount: oldArtifacts.length,
		newPlanningArtifactCount: newArtifacts.length,
		retiredControllerArtifactCount: retiredControllerArtifacts.length,
		legacyPacketPath,
		legacyPacketSha256: familyAffinityRawSha256(legacyPacketBytes),
		bridgeCoordinatesPreserved: existing.bridge.activeCoordinates.length,
		oldArtifacts,
		retiredControllerArtifacts,
		newArtifacts: newArtifacts.map(({ path, value }) => ({
			path,
			sha256: familyAffinityRawSha256(stableFamilyAffinityJson(value))
		})),
		runtimeCatalogMutationForbidden: true
	};
	const created: string[] = [];
	const archived: Array<{ path: string; archivePath: string }> = [];
	let receiptWritten = false;
	try {
		for (const { path, value } of newArtifacts) {
			const absolute = join(input.repositoryRoot, path);
			await mkdir(dirname(absolute), { recursive: true });
			await writeFile(absolute, stableFamilyAffinityJson(value), { flag: 'wx' });
			created.push(path);
		}
		for (const artifact of [...oldArtifacts, ...retiredControllerArtifacts]) {
			const archiveAbsolute = join(input.repositoryRoot, artifact.archivePath);
			await mkdir(dirname(archiveAbsolute), { recursive: true });
			await rename(join(input.repositoryRoot, artifact.path), archiveAbsolute);
			archived.push(artifact);
		}
		const receiptAbsolute = join(input.repositoryRoot, ELEMENTAL_REPLACEMENT_RECEIPT_PATH);
		await mkdir(dirname(receiptAbsolute), { recursive: true });
		await writeFile(receiptAbsolute, stableFamilyAffinityJson(receipt), { flag: 'wx' });
		receiptWritten = true;
		const manifestTemporary = `${join(input.repositoryRoot, input.manifestPath)}.family-replacement-${process.pid}`;
		await writeFile(manifestTemporary, stableFamilyAffinityJson(nextManifest), { flag: 'wx' });
		await rename(manifestTemporary, join(input.repositoryRoot, input.manifestPath));
	} catch (error) {
		if (receiptWritten) {
			await unlink(join(input.repositoryRoot, ELEMENTAL_REPLACEMENT_RECEIPT_PATH)).catch(
				() => undefined
			);
		}
		for (const artifact of archived.reverse()) {
			await rename(
				join(input.repositoryRoot, artifact.archivePath),
				join(input.repositoryRoot, artifact.path)
			).catch(() => undefined);
		}
		for (const path of created.reverse()) {
			await unlink(join(input.repositoryRoot, path)).catch(() => undefined);
		}
		throw error;
	}
	return true;
}

async function maybeRetireLegacyWispBridge(input: {
	repositoryRoot: string;
	manifestPath: string;
	check: boolean;
}): Promise<boolean> {
	const manifestBytes = await readFamilyAffinityOwnedFile(input.repositoryRoot, input.manifestPath);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const coordinate = manifest.bridge.activeCoordinates.find(
		(entry) => entry.currentClassId === 'ember-wisp'
	);
	if (!coordinate) {
		if (!(await fileExists(join(input.repositoryRoot, LEGACY_WISP_RETIREMENT_RECEIPT_PATH)))) {
			return false;
		}
		return true;
	}
	if (
		coordinate.coordinateId !== 'ember-wisp/flame-elementals/flame-elemental-wisp/earth' ||
		coordinate.activeVersion !== 4 ||
		coordinate.status !== 'earth-bridge-provisional'
	) {
		throw new Error('Legacy Wisp bridge retirement found an unexpected active coordinate');
	}
	if (input.check) {
		throw new Error(
			'Family affinity production export check failed: legacy Wisp retirement required'
		);
	}
	const protectedPaths = new Set<string>();
	for (let version = 1; version <= coordinate.activeVersion; version += 1) {
		const targetPath = pathAtVersion(coordinate.targetPath, coordinate.activeVersion, version);
		const assignmentPath = pathAtVersion(
			coordinate.assignmentPath,
			coordinate.activeVersion,
			version
		);
		const target = FamilyAffinityTargetSchema.parse(
			JSON.parse(
				(await readFamilyAffinityOwnedFile(input.repositoryRoot, targetPath)).toString('utf8')
			)
		);
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(
				(await readFamilyAffinityOwnedFile(input.repositoryRoot, assignmentPath)).toString('utf8')
			)
		);
		validateFamilyAffinityAttemptCrossBinding(
			{
				...coordinate,
				activeVersion: version,
				targetPath,
				targetSha256: familyAffinitySha256(target),
				assignmentPath,
				assignmentSha256: familyAffinitySha256(assignment)
			},
			target,
			assignment
		);
		protectedPaths.add(targetPath);
		protectedPaths.add(assignmentPath);
		for (const path of Object.values(target.ownedPaths)) {
			if (await fileExists(join(input.repositoryRoot, path))) protectedPaths.add(path);
		}
	}
	for (const root of [
		`${FAMILY_AFFINITY_ROOT}/review/bridge/assignments`,
		`${FAMILY_AFFINITY_ROOT}/review/bridge/decisions`,
		`${FAMILY_AFFINITY_ROOT}/review/bridge/blind`
	]) {
		for (const absolutePath of await listFiles(join(input.repositoryRoot, root))) {
			const ownedPath = relative(input.repositoryRoot, absolutePath).split(sep).join('/');
			if (ownedPath.includes('/ember-wisp/')) protectedPaths.add(ownedPath);
		}
	}
	const archivedArtifacts = await Promise.all(
		[...protectedPaths].sort().map(async (path) => {
			const bytes = await readFamilyAffinityOwnedFile(input.repositoryRoot, path);
			return {
				path,
				archivePath: `${LEGACY_WISP_RETIREMENT_ARCHIVE_ROOT}/${path.slice(`${FAMILY_AFFINITY_ROOT}/`.length)}`,
				sha256: familyAffinityRawSha256(bytes)
			};
		})
	);
	for (const { archivePath } of archivedArtifacts) {
		if (await fileExists(join(input.repositoryRoot, archivePath))) {
			throw new Error(`Legacy Wisp retirement archive collision: ${archivePath}`);
		}
	}
	if (await fileExists(join(input.repositoryRoot, LEGACY_WISP_RETIREMENT_RECEIPT_PATH))) {
		throw new Error('Legacy Wisp retirement receipt exists before bridge retirement');
	}
	const nextManifest = FamilyAffinityManifestSchema.parse({
		...manifest,
		bridge: {
			targetCount: manifest.bridge.targetCount - 1,
			assignmentCount: manifest.bridge.assignmentCount - 1,
			activeCoordinates: manifest.bridge.activeCoordinates.filter(
				(entry) => entry.currentClassId !== 'ember-wisp'
			)
		}
	});
	const receipt = {
		schemaVersion: 'family-affinity-bridge-retirement-v1',
		retirementId: LEGACY_WISP_RETIREMENT_ID,
		currentClassId: 'ember-wisp',
		playerFacingReplacement: 'elementals/elemental-wisp',
		retiredCoordinate: coordinate,
		archivedArtifactCount: archivedArtifacts.length,
		archivedArtifacts,
		activeBridgeCoordinateCountAfterRetirement: nextManifest.bridge.targetCount,
		candidatePromotionForbidden: true,
		runtimeCatalogMutationForbidden: true
	};
	const moved: typeof archivedArtifacts = [];
	let receiptWritten = false;
	try {
		for (const artifact of archivedArtifacts) {
			const archiveAbsolute = join(input.repositoryRoot, artifact.archivePath);
			await mkdir(dirname(archiveAbsolute), { recursive: true });
			await rename(join(input.repositoryRoot, artifact.path), archiveAbsolute);
			moved.push(artifact);
		}
		const receiptAbsolute = join(input.repositoryRoot, LEGACY_WISP_RETIREMENT_RECEIPT_PATH);
		await mkdir(dirname(receiptAbsolute), { recursive: true });
		await writeFile(receiptAbsolute, stableFamilyAffinityJson(receipt), { flag: 'wx' });
		receiptWritten = true;
		const manifestTemporary = `${join(input.repositoryRoot, input.manifestPath)}.wisp-retirement-${process.pid}`;
		await writeFile(manifestTemporary, stableFamilyAffinityJson(nextManifest), { flag: 'wx' });
		await rename(manifestTemporary, join(input.repositoryRoot, input.manifestPath));
	} catch (error) {
		if (receiptWritten) {
			await unlink(join(input.repositoryRoot, LEGACY_WISP_RETIREMENT_RECEIPT_PATH)).catch(
				() => undefined
			);
		}
		for (const artifact of moved.reverse()) {
			await rename(
				join(input.repositoryRoot, artifact.archivePath),
				join(input.repositoryRoot, artifact.path)
			).catch(() => undefined);
		}
		throw error;
	}
	return true;
}

async function loadAndValidateExistingCorpus(
	repositoryRoot: string,
	manifestPath: string,
	sourceBundle: ReturnType<typeof buildFamilyAffinityProductionBundle>
): Promise<LoadedCorpus> {
	const manifest = FamilyAffinityManifestSchema.parse(
		JSON.parse((await readFamilyAffinityOwnedFile(repositoryRoot, manifestPath)).toString('utf8'))
	);
	const expectedV1 = new Map(
		sourceBundle.artifacts
			.filter(({ path }) => path !== manifestPath)
			.map(({ path, value }) => [path, stableFamilyAffinityJson(value)] as const)
	);
	const expectedCanonicalIds = new Set(
		sourceBundle.manifest.canonicalMatrix.activeCoordinates.map(({ coordinateId }) => coordinateId)
	);
	const expectedCanonicalOrder = sourceBundle.manifest.canonicalMatrix.activeCoordinates.map(
		({ coordinateId }) => coordinateId
	);
	const actualCanonicalIds = manifest.canonicalMatrix.activeCoordinates.map(
		({ coordinateId }) => coordinateId
	);
	if (
		actualCanonicalIds.length !== 750 ||
		new Set(actualCanonicalIds).size !== 750 ||
		actualCanonicalIds.some(
			(coordinateId, index) =>
				!expectedCanonicalIds.has(coordinateId) || coordinateId !== expectedCanonicalOrder[index]
		)
	) {
		throw new Error('Existing manifest canonical coordinates do not match the packet-derived 750');
	}

	const expectedAttemptPaths = new Set<string>();
	const expectedFailurePaths = new Set<string>();
	const activeTargets: FamilyAffinityTarget[] = [];
	const activeAssignments: FamilyAffinityAssignment[] = [];
	for (const coordinate of [
		...manifest.canonicalMatrix.activeCoordinates,
		...manifest.bridge.activeCoordinates
	]) {
		let previousTarget: FamilyAffinityTarget | undefined;
		let previousGenerationFailure: FamilyAffinityGenerationFailure | undefined;
		for (let version = 1; version <= coordinate.activeVersion; version += 1) {
			const targetPath = pathAtVersion(coordinate.targetPath, coordinate.activeVersion, version);
			const assignmentPath = pathAtVersion(
				coordinate.assignmentPath,
				coordinate.activeVersion,
				version
			);
			expectedAttemptPaths.add(targetPath);
			expectedAttemptPaths.add(assignmentPath);
			if (!(await fileExists(join(repositoryRoot, targetPath)))) {
				throw new Error(`Missing immutable attempt target: ${targetPath}`);
			}
			if (!(await fileExists(join(repositoryRoot, assignmentPath)))) {
				throw new Error(`Missing immutable attempt assignment: ${assignmentPath}`);
			}
			const targetBytes = (await readFamilyAffinityOwnedFile(repositoryRoot, targetPath)).toString(
				'utf8'
			);
			const assignmentBytes = (
				await readFamilyAffinityOwnedFile(repositoryRoot, assignmentPath)
			).toString('utf8');
			let target: FamilyAffinityTarget;
			let assignment: FamilyAffinityAssignment;
			try {
				target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes));
			} catch {
				throw new Error(`Immutable attempt target drift: ${targetPath}`);
			}
			try {
				assignment = FamilyAffinityAssignmentSchema.parse(JSON.parse(assignmentBytes));
			} catch {
				throw new Error(`Immutable attempt assignment drift: ${assignmentPath}`);
			}
			if (coordinate.namespace === 'canonical' && version === 1) {
				const expectedTargetBytes = expectedV1.get(targetPath);
				const expectedAssignmentBytes = expectedV1.get(assignmentPath);
				if (!expectedTargetBytes || !expectedAssignmentBytes) {
					throw new Error(`Missing packet-derived v1 control: ${targetPath}`);
				}
				if (targetBytes !== expectedTargetBytes || assignmentBytes !== expectedAssignmentBytes) {
					const expectedTarget = FamilyAffinityTargetSchema.parse(JSON.parse(expectedTargetBytes));
					const expectedAssignment = FamilyAffinityAssignmentSchema.parse(
						JSON.parse(expectedAssignmentBytes)
					);
					if (
						expectedTarget.affinity === 'normal' ||
						expectedTarget.status !== 'blocked-on-anchor' ||
						target.status !== 'planned' ||
						target.anchor.kind !== 'normal-approved-review'
					) {
						throw new Error(`Immutable packet-derived v1 target drift: ${targetPath}`);
					}
					const normalizedTarget = FamilyAffinityTargetSchema.parse({
						...target,
						status: 'blocked-on-anchor',
						anchor: {
							...target.anchor,
							reviewReceiptSha256: null,
							normalCandidatePath: null,
							normalCandidateSha256: null,
							normalResultPath: null,
							normalResultSha256: null
						}
					});
					if (stableFamilyAffinityJson(normalizedTarget) !== expectedTargetBytes) {
						throw new Error(`Immutable packet-derived v1 target drift: ${targetPath}`);
					}
					// targetSha256 is the mechanical consequence of the target transition;
					// dispatchStatus is the assignment's only independent semantic delta.
					const normalizedAssignment = FamilyAffinityAssignmentSchema.parse({
						...assignment,
						dispatchStatus: 'blocked-on-anchor',
						targetSha256: familyAffinitySha256(expectedTarget)
					});
					if (
						assignment.dispatchStatus !== 'planned' ||
						assignment.targetSha256 !== familyAffinitySha256(target) ||
						stableFamilyAffinityJson(normalizedAssignment) !== expectedAssignmentBytes
					) {
						throw new Error(`Immutable packet-derived v1 assignment drift: ${assignmentPath}`);
					}
					await validateFamilyAffinityNormalAnchorEvidence({
						repositoryRoot,
						manifestPath,
						targetPath
					});
				}
			}
			const derivedCoordinate = {
				...coordinate,
				activeVersion: version,
				targetPath,
				targetSha256: familyAffinitySha256(target),
				assignmentPath,
				assignmentSha256: familyAffinitySha256(assignment),
				status: target.status
			};
			validateFamilyAffinityAttemptCrossBinding(derivedCoordinate, target, assignment);
			const failurePath = familyAffinityGenerationFailurePath(target);
			const generationFailure = (await fileExists(join(repositoryRoot, failurePath)))
				? validateFamilyAffinityGenerationFailureEvidence({
						target,
						targetPath,
						assignment,
						assignmentPath,
						evidence: JSON.parse(
							(await readFamilyAffinityOwnedFile(repositoryRoot, failurePath)).toString('utf8')
						)
					})
				: undefined;
			if (generationFailure) expectedFailurePaths.add(failurePath);
			if (version === coordinate.activeVersion && generationFailure) {
				throw new Error(`Active attempt cannot be generation-failed: ${targetPath}`);
			}
			if (version === 1 && target.precedingAttempt !== null) {
				throw new Error(`Initial attempt cannot link a predecessor: ${targetPath}`);
			}
			if (version > 1 && previousGenerationFailure) {
				if (
					!previousTarget ||
					stableFamilyAffinityJson(target.precedingAttempt) !==
						stableFamilyAffinityJson(previousTarget.precedingAttempt)
				) {
					throw new Error(
						`Generation-failed history did not preserve last retained attempt: ${targetPath}`
					);
				}
			} else if (
				version > 1 &&
				(!previousTarget ||
					target.precedingAttempt?.targetId !== previousTarget.targetId ||
					target.precedingAttempt.targetSha256 !== familyAffinitySha256(previousTarget) ||
					target.precedingAttempt.candidatePath !== previousTarget.ownedPaths.candidate ||
					target.precedingAttempt.resultPath !== previousTarget.ownedPaths.result ||
					target.precedingAttempt.reviewPath !== previousTarget.ownedPaths.decision)
			) {
				throw new Error(
					`Attempt history is skipped, orphaned, or cross-bound incorrectly: ${targetPath}`
				);
			}
			previousTarget = target;
			previousGenerationFailure = generationFailure;
			if (version === coordinate.activeVersion) {
				validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
				activeTargets.push(target);
				activeAssignments.push(assignment);
			}
		}
	}

	const actualAttemptPaths = [
		...(
			await Promise.all(
				['targets', 'assignments'].map((directory) =>
					listFiles(join(repositoryRoot, FAMILY_AFFINITY_ROOT, directory))
				)
			)
		).flat(),
		...(await listFiles(join(repositoryRoot, FAMILY_AFFINITY_ROOT, 'bridge'))).filter((path) =>
			/\/(?:target|assignment)-v\d+\.json$/u.test(path)
		)
	].map((path) => relative(repositoryRoot, path));
	for (const path of actualAttemptPaths) {
		if (!expectedAttemptPaths.has(path)) {
			throw new Error(`Orphan or unreferenced immutable attempt: ${path}`);
		}
	}
	const actualFailurePaths = (
		await listFiles(join(repositoryRoot, FAMILY_AFFINITY_ROOT, 'generation-failures'))
	).map((path) => relative(repositoryRoot, path));
	for (const path of actualFailurePaths) {
		if (!expectedFailurePaths.has(path)) {
			throw new Error(`Orphan or unreferenced generation-failure evidence: ${path}`);
		}
	}

	const canonicalTargets = activeTargets.filter(({ namespace }) => namespace === 'canonical');
	const canonicalAssignments = activeAssignments.filter(
		({ namespace }) => namespace === 'canonical'
	);
	const reviewReceipts: Record<string, { receipt: unknown; bytes: Uint8Array }> = {};
	for (const target of canonicalTargets) {
		if (
			target.affinity !== 'normal' &&
			target.status === 'planned' &&
			target.anchor.kind === 'normal-approved-review'
		) {
			await validateFamilyAffinityNormalAnchorEvidence({
				repositoryRoot,
				manifestPath,
				targetPath: manifest.canonicalMatrix.activeCoordinates.find(
					({ coordinateId }) => coordinateId === target.coordinateId
				)!.targetPath
			});
			const receiptBytes = await readFamilyAffinityOwnedFile(
				repositoryRoot,
				target.anchor.reviewReceiptPath
			);
			const receipt = FamilyAffinityReviewReceiptSchema.parse(
				JSON.parse(receiptBytes.toString('utf8'))
			);
			reviewReceipts[target.anchor.reviewReceiptPath] = { receipt, bytes: receiptBytes };
		}
	}
	validateFamilyAffinityProductionBundle(
		{
			manifest,
			targets: canonicalTargets,
			assignments: canonicalAssignments,
			artifacts: [
				{ path: manifestPath, value: manifest },
				...manifest.canonicalMatrix.activeCoordinates.flatMap((coordinate, index) => [
					{ path: coordinate.targetPath, value: canonicalTargets[index]! },
					{ path: coordinate.assignmentPath, value: canonicalAssignments[index]! }
				])
			]
		},
		reviewReceipts
	);
	for (const target of activeTargets.filter(({ namespace }) => namespace === 'bridge')) {
		if (target.affinity !== 'normal' && target.status === 'planned') {
			const coordinate = manifest.bridge.activeCoordinates.find(
				({ coordinateId }) => coordinateId === target.coordinateId
			)!;
			await validateFamilyAffinityNormalAnchorEvidence({
				repositoryRoot,
				manifestPath,
				targetPath: coordinate.targetPath
			});
		}
		if (await fileExists(join(repositoryRoot, target.ownedPaths.decision))) {
			const receipt = FamilyAffinityReviewReceiptSchema.parse(
				JSON.parse(
					(await readFamilyAffinityOwnedFile(repositoryRoot, target.ownedPaths.decision)).toString(
						'utf8'
					)
				)
			);
			validateFamilyAffinityReviewPromotion(target, receipt);
		}
	}
	return { manifest, targets: activeTargets, assignments: activeAssignments, expectedAttemptPaths };
}

function mergedDerivedManifest(
	existing: FamilyAffinityManifest,
	derived: FamilyAffinityManifest
): FamilyAffinityManifest {
	return FamilyAffinityManifestSchema.parse({
		...existing,
		canonicalMatrix: {
			...existing.canonicalMatrix,
			familyCount: derived.canonicalMatrix.familyCount,
			formCount: derived.canonicalMatrix.formCount,
			affinities: derived.canonicalMatrix.affinities,
			targetCount: derived.canonicalMatrix.targetCount,
			assignmentCount: derived.canonicalMatrix.assignmentCount
		},
		mappingReservations: derived.mappingReservations,
		ownership: derived.ownership
	});
}

export async function exportFamilyAffinityProduction(options: {
	repositoryRoot: string;
	check: boolean;
}) {
	const { families, mapping } = await loadFamilyAffinityActiveSources(options.repositoryRoot);
	const bundle = buildFamilyAffinityProductionBundle(families, mapping);
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	const manifestAbsolute = join(options.repositoryRoot, manifestPath);
	const lockPath = `${manifestAbsolute}.revision-allocation.lock`;
	await mkdir(dirname(manifestAbsolute), { recursive: true });
	try {
		await writeFile(lockPath, `${process.pid}\n`, { flag: 'wx' });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error('Family affinity export is blocked by the exclusive controller lock');
		}
		throw error;
	}
	try {
		if (await fileExists(manifestAbsolute)) {
			await maybeMigrateElementalFamilyReplacement({
				repositoryRoot: options.repositoryRoot,
				manifestPath,
				sourceBundle: bundle,
				check: options.check
			});
			await maybeRetireLegacyWispBridge({
				repositoryRoot: options.repositoryRoot,
				manifestPath,
				check: options.check
			});
			await migrateExactLegacyReviewPaths(
				options.repositoryRoot,
				manifestPath,
				bundle,
				options.check
			);
			const loaded = await loadAndValidateExistingCorpus(
				options.repositoryRoot,
				manifestPath,
				bundle
			);
			const merged = mergedDerivedManifest(loaded.manifest, bundle.manifest);
			const mergedBytes = stableFamilyAffinityJson(merged);
			const currentBytes = (
				await readFamilyAffinityOwnedFile(options.repositoryRoot, manifestPath)
			).toString('utf8');
			if (options.check && currentBytes !== mergedBytes) {
				throw new Error(
					'Family affinity production export check failed: drifted safe manifest metadata'
				);
			}
			if (!options.check && currentBytes !== mergedBytes) {
				const temporary = `${manifestAbsolute}.export-${process.pid}-${Date.now()}`;
				try {
					await writeFile(temporary, mergedBytes, { flag: 'wx' });
					await rename(temporary, manifestAbsolute);
				} finally {
					await unlink(temporary).catch(() => undefined);
				}
			}
			return {
				mode: options.check ? ('check' as const) : ('write' as const),
				artifactCount: loaded.expectedAttemptPaths.size + 1
			};
		}

		const actualAttemptFiles = [
			...(
				await Promise.all(
					['targets', 'assignments'].map((directory) =>
						listFiles(join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, directory))
					)
				)
			).flat(),
			...(await listFiles(join(options.repositoryRoot, FAMILY_AFFINITY_ROOT, 'bridge'))).filter(
				(path) => /\/(?:target|assignment)-v\d+\.json$/u.test(path)
			)
		];
		if (options.check) {
			throw new Error('Family affinity production export check failed: missing manifest');
		}
		if (actualAttemptFiles.length > 0) {
			throw new Error(
				'Refusing bootstrap because an immutable target/assignment corpus already exists'
			);
		}
		const created: string[] = [];
		try {
			for (const { path, value } of bundle.artifacts.filter(({ path }) => path !== manifestPath)) {
				const absolute = join(options.repositoryRoot, path);
				await mkdir(dirname(absolute), { recursive: true });
				await writeFile(absolute, stableFamilyAffinityJson(value), { flag: 'wx' });
				created.push(absolute);
			}
			await writeFile(manifestAbsolute, stableFamilyAffinityJson(bundle.manifest), { flag: 'wx' });
			created.push(manifestAbsolute);
		} catch (error) {
			for (const path of created.reverse()) await unlink(path).catch(() => undefined);
			throw error;
		}
		return { mode: 'write' as const, artifactCount: bundle.artifacts.length };
	} finally {
		await unlink(lockPath).catch(() => undefined);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const check = process.argv.slice(2).includes('--check');
	const result = await exportFamilyAffinityProduction({ repositoryRoot: process.cwd(), check });
	process.stdout.write(
		`${result.mode === 'check' ? 'Verified' : 'Wrote'} ${result.artifactCount} family affinity production artifacts.\n`
	);
}

import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import {
	BridgeIdentityPacketSchema,
	bridgeAttemptPaths,
	CurrentClassMappingFileSchema,
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	familyAffinityRawSha256,
	familyAffinitySha256,
	stableFamilyAffinityJson,
	type BridgeIdentityPacket,
	type FamilyAffinityAssignment,
	type FamilyAffinityManifest,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const IdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/u);
const OwnedPathSchema = z
	.string()
	.regex(/^assets\/enemies\/experiments\/family-affinity-v1\//u)
	.refine((path) => !path.includes('..'));
const LegacyCandidatePathSchema = z
	.string()
	.regex(
		/^assets\/enemies\/experiments\/(?:affinity-workflow-v1|affinity-expansion-v1)\/candidates\/[a-z][a-z0-9-]*\/normal-v[1-9][0-9]*\.png$/u
	);
const DispositionSchema = z.enum(['map', 'rename-map', 'secondary-archetype', 'fauna', 'retire']);

const NormalReferenceSchema = z
	.object({
		candidatePath: LegacyCandidatePathSchema,
		candidateSha256: Sha256Schema,
		referenceStatus: z.literal('earth-bridge-provisional'),
		legacyResultStatus: z.enum(['candidate', 'revise', 'failed']),
		approvalEvidence: z.literal(false)
	})
	.strict();

const EarthBridgeWaveEntrySchema = z
	.object({
		currentClassId: IdSchema,
		disposition: DispositionSchema.exclude(['retire']),
		targetKind: z.enum(['mapped-primary-bridge', 'bridge-only', 'blocked-bridge-only']),
		affinity: z.literal('earth'),
		canonicalCoordinateId: z.string().min(1).nullable(),
		coordinateId: z.string().min(1).nullable(),
		targetPath: OwnedPathSchema.nullable(),
		targetSha256: Sha256Schema.nullable(),
		assignmentPath: OwnedPathSchema.nullable(),
		assignmentSha256: Sha256Schema.nullable(),
		identityPacketPath: OwnedPathSchema.nullable(),
		identityPacketSha256: Sha256Schema.nullable(),
		normalReference: NormalReferenceSchema,
		status: z.enum(['earth-bridge-provisional', 'blocked-on-identity-decision']),
		identityDecisionRequired: z.string().min(1).nullable(),
		promotionCeiling: z.literal('candidate-only'),
		approvedReviewForbiddenUntil: z.literal('canonical-normal-anchor-approved'),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict()
	.superRefine((entry, context) => {
		const ownsIdentity = entry.targetKind !== 'mapped-primary-bridge';
		if (
			ownsIdentity !== (entry.identityPacketPath !== null && entry.identityPacketSha256 !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Only bridge-only entries own bridge identity packets'
			});
		}
		const blocked = entry.targetKind === 'blocked-bridge-only';
		if (
			blocked !==
			(entry.targetPath === null &&
				entry.targetSha256 === null &&
				entry.assignmentPath === null &&
				entry.assignmentSha256 === null &&
				entry.coordinateId === null &&
				entry.status === 'blocked-on-identity-decision' &&
				entry.identityDecisionRequired !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Blocked bridge entries cannot grant output authority'
			});
		}
		if ((entry.targetKind === 'mapped-primary-bridge') !== (entry.canonicalCoordinateId !== null)) {
			context.addIssue({
				code: 'custom',
				message: 'Only mapped primaries carry canonical references'
			});
		}
	});

export const EarthBridgeWaveSchema = z
	.object({
		schemaVersion: z.literal('earth-bridge-wave-v1'),
		waveId: z.literal('earth-bridge-v1'),
		sourceMappingPath: z.literal(
			'assets/enemies/experiments/family-affinity-v1/current-class-mapping.json'
		),
		sourceMappingSha256: Sha256Schema,
		sourceVisualIndexPath: z.literal('docs/wiki/creatures/monsters/visual-index.json'),
		sourceVisualIndexSha256: Sha256Schema,
		affinity: z.literal('earth'),
		targetCount: z.literal(40),
		mappedPrimaryCount: z.literal(10),
		bridgeOnlyTargetCount: z.literal(30),
		dispatchableTargetCount: z.literal(39),
		blockedCount: z.literal(1),
		classificationCounts: z
			.object({
				map: z.literal(1),
				'rename-map': z.literal(9),
				'secondary-archetype': z.literal(25),
				fauna: z.literal(5),
				retire: z.literal(0)
			})
			.strict(),
		entries: z.array(EarthBridgeWaveEntrySchema).min(1).max(40),
		productionState: z.literal('candidate-only'),
		approvedReviewForbiddenUntil: z.literal('canonical-normal-anchor-approved'),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict()
	.superRefine((wave, context) => {
		if (wave.targetCount !== wave.entries.length) {
			context.addIssue({ code: 'custom', message: 'Wave target count does not match entries' });
		}
		const mapped = wave.entries.filter(({ targetKind }) => targetKind === 'mapped-primary-bridge');
		const bridge = wave.entries.filter(({ targetKind }) => targetKind !== 'mapped-primary-bridge');
		const blocked = wave.entries.filter(({ targetKind }) => targetKind === 'blocked-bridge-only');
		if (
			wave.mappedPrimaryCount !== mapped.length ||
			wave.bridgeOnlyTargetCount !== bridge.length ||
			wave.blockedCount !== blocked.length ||
			wave.dispatchableTargetCount !== wave.entries.length - blocked.length
		) {
			context.addIssue({ code: 'custom', message: 'Wave namespace counts do not match entries' });
		}
		if (
			new Set(wave.entries.map(({ currentClassId }) => currentClassId)).size !== wave.entries.length
		) {
			context.addIssue({ code: 'custom', message: 'Wave currentClassId values must be unique' });
		}
		if (
			new Set(mapped.map(({ canonicalCoordinateId }) => canonicalCoordinateId)).size !==
			mapped.length
		) {
			context.addIssue({ code: 'custom', message: 'Wave has a duplicate canonical coordinate' });
		}
	});

export type EarthBridgeWave = z.infer<typeof EarthBridgeWaveSchema>;

type LegacyNormalTarget = {
	schemaVersion: 'image-production-target-v1' | 'image-production-target-v2';
	speciesId: string;
	threat: { presentationTier: string; canonicalGrade: number | null };
	battlefieldDutyId: string;
	constructionMode: string;
	identityInvariants: string[];
	anatomyInvariants: string[];
	affinityDesign: { counterplayCue: string };
	prohibitedTraits: string[];
	references: Array<{ path: string; purpose: string; contentHash: string }>;
	presentation: { composition: string };
	output: { candidatePath: string; resultPath: string };
};

type VisualIndex = {
	reconciliation: {
		entries: Array<{
			currentClassId: string;
			references: Array<{
				affinity: string;
				candidatePath: string;
				contentHash: string;
			}>;
		}>;
	};
};

const EARTH_THEME = {
	constructionDimensions: [
		'Compressed mineral mass and sediment layers integrated into species-native anatomy.',
		'Load-bearing stone or crystal growth with rooted weight and localized dust.'
	],
	counterplaySignal:
		'Expose a fracture seam, binding joint, or load-bearing fault after committed movement.',
	forbidden: [
		'Brown recolor without material construction.',
		'Pasted rocks, generic foliage, or anatomy-obscuring mass.'
	]
} as const;

const PRESENTATION_CONTRACT = {
	framing: 'full-body-readable',
	background: 'cinematic-neutral-environment',
	featuredSubjects: 1,
	textAllowed: false,
	watermarkAllowed: false
} as const;

const DERIVED_APPROVED_SIGNAL_IDS = new Set([
	'cave-bear',
	'dire-wolf',
	'grey-wolf',
	'tunnel-boar',
	'crystal-guardian',
	'iron-sentinel',
	'goblin-archer',
	'goblin-hexweaver',
	'goblin-skirmisher',
	'cave-troll',
	'frost-giant',
	'ogoblin-brute'
]);

const DERIVED_APPROVED_SIGNALS: Readonly<
	Record<string, { telegraph: string; counterplay: string; rosterLines: string }>
> = {
	'cave-bear': {
		telegraph: 'shoulders rise/forelimbs load before overrun',
		counterplay: 'spacing, guard, injury control',
		rosterLines: 'lines 78-84'
	},
	'cave-troll': {
		telegraph: 'shoulder/arm loads and visible wound regrows',
		counterplay: 'fire, kiting, finishing',
		rosterLines: 'lines 105-111'
	},
	'crystal-guardian': {
		telegraph: 'facets align around core before beam/refraction',
		counterplay: 'spell control, damage typing, core targeting',
		rosterLines: 'lines 132-138'
	},
	'dire-wolf': {
		telegraph: 'head lowers and hindquarters load for pursuit',
		counterplay: 'stamina, rescue movement, composure',
		rosterLines: 'lines 60-66'
	},
	'frost-giant': {
		telegraph: 'iron/command arm rises as whiteout gathers',
		counterplay: 'cold survival, formation, sustained focus',
		rosterLines: 'lines 141-147'
	},
	'goblin-archer': {
		telegraph: 'bow draws and target mark settles',
		counterplay: 'cover, shield, closing distance',
		rosterLines: 'lines 15-21'
	},
	'goblin-hexweaver': {
		telegraph: 'marks converge and casting hand locks during concentration',
		counterplay: 'ward reading, interrupts, focus',
		rosterLines: 'lines 33-39'
	},
	'goblin-skirmisher': {
		telegraph: 'knife/lead foot feint commits',
		counterplay: 'guard timing, weapon handling, target focus',
		rosterLines: 'lines 6-12'
	},
	'grey-wolf': {
		telegraph: 'shoulder/gaze shifts to flank before trip',
		counterplay: 'footwork, perception, ally protection',
		rosterLines: 'lines 24-30'
	},
	'iron-sentinel': {
		telegraph: 'guard closes and weapon sets before parry',
		counterplay: 'feint, penetration, action economy',
		rosterLines: 'lines 114-120'
	},
	'ogoblin-brute': {
		telegraph: 'weapon or open grab hand winds up',
		counterplay: 'team rotation, restraint escape, damage windows',
		rosterLines: 'lines 87-93'
	},
	'tunnel-boar': {
		telegraph: 'head/tusks lower and forefeet brace',
		counterplay: 'dodge, bracing, terrain use',
		rosterLines: 'lines 51-57'
	}
};

function slug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-|-$/gu, '');
}

function rawHash(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function absoluteContainedPath(repositoryRoot: string, path: string): string {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, path);
	if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Path escapes repository root: ${path}`);
	}
	return absolute;
}

async function readRealFile(repositoryRoot: string, path: string): Promise<Buffer> {
	const absolute = absoluteContainedPath(repositoryRoot, path);
	let cursor = resolve(repositoryRoot);
	for (const part of relative(cursor, absolute).split(sep).filter(Boolean)) {
		cursor = join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlinked source path is forbidden: ${path}`);
	}
	return readFile(absolute);
}

async function findLegacyNormalTarget(
	repositoryRoot: string,
	currentClassId: string,
	candidatePath: string
): Promise<{ path: string; bytes: Buffer; target: LegacyNormalTarget }> {
	const experimentRoot = candidatePath.split('/candidates/')[0];
	if (!experimentRoot) throw new Error(`Malformed legacy Normal candidate path: ${candidatePath}`);
	const targetDirectory = `${experimentRoot}/targets/${currentClassId}`;
	const names = (await readdir(absoluteContainedPath(repositoryRoot, targetDirectory)))
		.filter((name) => /^normal(?:-v[1-9][0-9]*)?\.json$/u.test(name))
		.sort();
	const matches: Array<{ path: string; bytes: Buffer; target: LegacyNormalTarget }> = [];
	for (const name of names) {
		const path = `${targetDirectory}/${name}`;
		const bytes = await readRealFile(repositoryRoot, path);
		const target = JSON.parse(bytes.toString('utf8')) as LegacyNormalTarget;
		if (target.output?.candidatePath === candidatePath) matches.push({ path, bytes, target });
	}
	if (matches.length !== 1) {
		throw new Error(
			`${currentClassId} Normal reference requires exactly one source target; found ${matches.length}`
		);
	}
	return matches[0]!;
}

async function legacyResultStatus(
	repositoryRoot: string,
	target: LegacyNormalTarget
): Promise<'candidate' | 'revise' | 'failed'> {
	const result = JSON.parse(
		(await readRealFile(repositoryRoot, target.output.resultPath)).toString('utf8')
	) as { status?: unknown };
	if (result.status !== 'candidate' && result.status !== 'revise' && result.status !== 'failed') {
		throw new Error(`Legacy Normal result has unsupported status: ${target.output.resultPath}`);
	}
	return result.status;
}

function buildBridgeIdentityPacket(input: {
	entry: z.infer<typeof CurrentClassMappingFileSchema>['entries'][number];
	normalReference: z.infer<typeof NormalReferenceSchema>;
	sourceTargetPath: string;
	sourceTargetBytes: Buffer;
	sourceTarget: LegacyNormalTarget;
	sourceRosterSha256: string;
}): BridgeIdentityPacket {
	const {
		entry,
		normalReference,
		sourceTargetPath,
		sourceTargetBytes,
		sourceTarget,
		sourceRosterSha256
	} = input;
	if (entry.disposition !== 'secondary-archetype' && entry.disposition !== 'fauna') {
		throw new Error('Bridge identity packets are only valid for secondary archetypes and fauna');
	}
	if (sourceTarget.speciesId !== entry.currentClassId) {
		throw new Error(`${entry.currentClassId} legacy Normal source target identity mismatch`);
	}
	const dutyStatement =
		sourceTarget.identityInvariants.find((value) => /battlefield duty/iu.test(value)) ??
		sourceTarget.battlefieldDutyId;
	const sourceExactTelegraph =
		sourceTarget.identityInvariants.find(
			(value, index) => index > 1 && !/counterplay/iu.test(value)
		) ?? sourceTarget.affinityDesign.counterplayCue;
	const approvedSignals = DERIVED_APPROVED_SIGNALS[entry.currentClassId];
	const derivedApproved = approvedSignals !== undefined;
	if (derivedApproved !== DERIVED_APPROVED_SIGNAL_IDS.has(entry.currentClassId)) {
		throw new Error(`Derived signal approval registry drift: ${entry.currentClassId}`);
	}
	return BridgeIdentityPacketSchema.parse({
		schemaVersion: 'bridge-identity-packet-v1',
		currentClassId: entry.currentClassId,
		bridgeFamilyId: `bridge-${slug(entry.sourceFamilyLabel)}`,
		bridgeFormId: entry.currentClassId,
		sourceFamilyLabel: entry.sourceFamilyLabel,
		disposition: entry.disposition,
		sourceRoster: entry.sourceRoster,
		sourcePage: 'docs/wiki/creatures/monsters/README.md',
		mappingRationale: entry.rationale,
		sourceNormalTarget: { path: sourceTargetPath, sha256: rawHash(sourceTargetBytes) },
		normalReference,
		inferredTier: null,
		primaryArchetype: sourceTarget.battlefieldDutyId,
		battlefieldDuty: dutyStatement,
		identityInvariants: sourceTarget.identityInvariants,
		anatomyInvariants: sourceTarget.anatomyInvariants,
		telegraph: approvedSignals?.telegraph ?? sourceExactTelegraph,
		counterplay: approvedSignals?.counterplay ?? sourceTarget.affinityDesign.counterplayCue,
		signalSupport: derivedApproved ? 'derived-approved' : 'source-exact',
		signalEvidence: [
			...(approvedSignals
				? [
						{
							path: 'packages/content/src/enemy-roster.ts',
							locator: approvedSignals.rosterLines,
							sha256: sourceRosterSha256
						}
					]
				: []),
			{
				path: sourceTargetPath,
				locator:
					'/battlefieldDutyId; /identityInvariants; /anatomyInvariants; /affinityDesign/counterplayCue',
				sha256: rawHash(sourceTargetBytes)
			}
		],
		controllerApprovalReference: derivedApproved
			? 'root-approved-task10-derived-bridge-signals-2026-09-02'
			: null,
		framing: sourceTarget.presentation.composition,
		sourceReferences: sourceTarget.references,
		earthTheme: EARTH_THEME,
		presentationContract: PRESENTATION_CONTRACT,
		status:
			entry.currentClassId === 'tower-basilisk' ? 'blocked-on-identity-decision' : 'bridge-only',
		identityDecisionRequired:
			entry.currentClassId === 'tower-basilisk'
				? 'Choose quadrupedal or exactly six-legged Tower Basilisk anatomy, reconcile the mapping and source target, then produce a passing Normal rerender before Earth dispatch.'
				: null,
		runtimeCatalogMutationForbidden: true
	});
}

function buildBridgeTarget(packet: BridgeIdentityPacket): FamilyAffinityTarget {
	if (packet.status === 'blocked-on-identity-decision') {
		throw new Error(`${packet.currentClassId} is blocked and cannot receive output authority`);
	}
	const version = 1;
	const affinity = 'earth';
	const paths = bridgeAttemptPaths(packet.currentClassId, affinity, version);
	const identityPath = `${FAMILY_AFFINITY_ROOT}/bridge/identities/${packet.currentClassId}.json`;
	const coordinateId = `${packet.currentClassId}/${packet.bridgeFamilyId}/${packet.bridgeFormId}/earth`;
	return FamilyAffinityTargetSchema.parse({
		schemaVersion: 'family-affinity-target-v1',
		namespace: 'bridge',
		coordinateId,
		targetId: `bridge/${coordinateId}/v1`,
		familyId: packet.bridgeFamilyId,
		formId: packet.bridgeFormId,
		currentClassId: packet.currentClassId,
		affinity,
		tier: 'bridge-only',
		primaryArchetype: packet.primaryArchetype,
		battlefieldDuty: packet.battlefieldDuty,
		identityInvariants: packet.identityInvariants,
		anatomyInvariants: packet.anatomyInvariants,
		constructionDimensions: packet.earthTheme.constructionDimensions,
		telegraph: packet.telegraph,
		counterplay: `${packet.counterplay} ${packet.earthTheme.counterplaySignal}`,
		forbiddenTreatments: [
			...packet.earthTheme.forbidden,
			...packet.sourceReferences.map(
				({ purpose }) => `Do not transfer unrelated reference traits: ${purpose}`
			)
		],
		sources: {
			packetKind: 'bridge-identity',
			familyPacketPath: identityPath,
			familyPacketSha256: familyAffinitySha256(packet),
			sourcePage: packet.sourcePage,
			sourceReferences: packet.sourceReferences.map(({ path }) => path),
			mappingPath: `${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`
		},
		presentationContract: PRESENTATION_CONTRACT,
		acceptanceCriteria: [
			`Recognizably preserves the bridge-only ${packet.currentClassId} identity.`,
			`Preserves the ${packet.sourceFamilyLabel} source grouping without claiming canonical family membership.`,
			`Communicates the evidence-bound ${packet.battlefieldDuty} duty.`,
			'Preserves coherent load-bearing anatomy, complete limbs, and believable ground contact.',
			'Uses compressed mineral mass plus load-bearing stone or crystal construction.',
			'Keeps the attack telegraph and Earth fracture or binding counterplay visible.',
			'Frames one complete featured subject with no crop, labels, UI text, or watermark.',
			'Remains provisional candidate-only evidence outside the canonical 750 and runtime.'
		],
		ownedPaths: {
			candidate: paths.candidate,
			result: paths.result,
			decision: paths.decision,
			blindReview: paths.blindReview
		},
		anchor: {
			kind: 'earth-bridge-provisional',
			normalCandidatePath: packet.normalReference.candidatePath,
			normalCandidateSha256: packet.normalReference.candidateSha256
		},
		precedingAttempt: null,
		version,
		status: 'earth-bridge-provisional',
		promotionCeiling: 'approved-review',
		runtimeCatalogMutationForbidden: true
	});
}

function buildMappedPrimaryBridgeTarget(input: {
	currentClassId: string;
	canonicalCoordinateId: string;
	canonicalTarget: FamilyAffinityTarget;
	normalReference: z.infer<typeof NormalReferenceSchema>;
}): FamilyAffinityTarget {
	const { currentClassId, canonicalCoordinateId, canonicalTarget, normalReference } = input;
	if (
		canonicalTarget.namespace !== 'canonical' ||
		canonicalTarget.coordinateId !== canonicalCoordinateId ||
		canonicalTarget.affinity !== 'earth' ||
		!('familyPacketPath' in canonicalTarget.sources)
	) {
		throw new Error(
			`Mapped primary source is not an exact canonical Earth target: ${canonicalCoordinateId}`
		);
	}
	const paths = bridgeAttemptPaths(currentClassId, 'earth', 1);
	const coordinateId = `${currentClassId}/${canonicalTarget.familyId}/${canonicalTarget.formId}/earth`;
	return FamilyAffinityTargetSchema.parse({
		...canonicalTarget,
		namespace: 'bridge',
		coordinateId,
		targetId: `bridge/${coordinateId}/v1`,
		currentClassId,
		canonicalCoordinateId,
		ownedPaths: {
			candidate: paths.candidate,
			result: paths.result,
			decision: paths.decision,
			blindReview: paths.blindReview
		},
		anchor: {
			kind: 'earth-bridge-provisional',
			normalCandidatePath: normalReference.candidatePath,
			normalCandidateSha256: normalReference.candidateSha256
		},
		status: 'earth-bridge-provisional'
	});
}

function buildBridgeAssignment(target: FamilyAffinityTarget): FamilyAffinityAssignment {
	return FamilyAffinityAssignmentSchema.parse({
		schemaVersion: 'family-affinity-assignment-v1',
		assignmentId: `${target.targetId}/assignment`,
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		coordinateId: target.coordinateId,
		namespace: 'bridge',
		version: target.version,
		producerRole: 'image-producer',
		allowedOutputs: {
			candidate: target.ownedPaths.candidate,
			result: target.ownedPaths.result
		},
		retryCeiling: 1,
		dispatchStatus: 'earth-bridge-provisional',
		selfPromotionForbidden: true,
		runtimeCatalogMutationForbidden: true
	});
}

export type EarthBridgeBuild = {
	wave: EarthBridgeWave;
	manifest: FamilyAffinityManifest;
	bridgePackets: BridgeIdentityPacket[];
	bridgeTargets: FamilyAffinityTarget[];
	bridgeAssignments: FamilyAffinityAssignment[];
	artifacts: Array<{ path: string; value: unknown }>;
};

export async function buildEarthBridgeMaterialization(input: {
	repositoryRoot: string;
	mapping: unknown;
	visualIndex: unknown;
	manifest: unknown;
}): Promise<EarthBridgeBuild> {
	const mapping = CurrentClassMappingFileSchema.parse(input.mapping);
	const manifest = FamilyAffinityManifestSchema.parse(input.manifest);
	const visualIndex = input.visualIndex as VisualIndex;
	if (!Array.isArray(visualIndex.reconciliation?.entries)) {
		throw new Error('Visual index reconciliation entries are missing');
	}
	const reconciliation = new Map(
		visualIndex.reconciliation.entries.map((entry) => [entry.currentClassId, entry])
	);
	const classificationCounts = {
		map: 0,
		'rename-map': 0,
		'secondary-archetype': 0,
		fauna: 0,
		retire: 0
	};
	const entries: EarthBridgeWave['entries'] = [];
	const bridgePackets: BridgeIdentityPacket[] = [];
	const bridgeTargets: FamilyAffinityTarget[] = [];
	const bridgeAssignments: FamilyAffinityAssignment[] = [];
	const canonicalClaims = new Set<string>();
	const sourceRosterSha256 = rawHash(
		await readRealFile(input.repositoryRoot, 'packages/content/src/enemy-roster.ts')
	);
	for (const mappingEntry of mapping.entries) {
		classificationCounts[mappingEntry.disposition] += 1;
		if (mappingEntry.disposition === 'retire') continue;
		const source = reconciliation.get(mappingEntry.currentClassId);
		const normalReferences =
			source?.references.filter(({ affinity }) => affinity === 'normal') ?? [];
		if (normalReferences.length !== 1) {
			throw new Error(`${mappingEntry.currentClassId} requires exactly one Normal reference`);
		}
		const [normal] = normalReferences;
		const candidateBytes = await readRealFile(input.repositoryRoot, normal!.candidatePath);
		if (rawHash(candidateBytes) !== normal!.contentHash) {
			throw new Error(`${mappingEntry.currentClassId} Normal reference hash drift`);
		}
		const normalReference = NormalReferenceSchema.parse({
			candidatePath: normal!.candidatePath,
			candidateSha256: normal!.contentHash,
			referenceStatus: 'earth-bridge-provisional',
			legacyResultStatus: 'candidate',
			approvalEvidence: false
		});
		const sourceTarget = await findLegacyNormalTarget(
			input.repositoryRoot,
			mappingEntry.currentClassId,
			normal!.candidatePath
		);
		normalReference.legacyResultStatus = await legacyResultStatus(
			input.repositoryRoot,
			sourceTarget.target
		);
		if (mappingEntry.disposition === 'map' || mappingEntry.disposition === 'rename-map') {
			const canonicalCoordinateId = `${mappingEntry.canonicalFamilyId}/${mappingEntry.canonicalFormId}/earth`;
			if (canonicalClaims.has(canonicalCoordinateId)) {
				throw new Error(
					`Earth bridge has a duplicate canonical coordinate: ${canonicalCoordinateId}`
				);
			}
			canonicalClaims.add(canonicalCoordinateId);
			const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
				(candidate) => candidate.coordinateId === canonicalCoordinateId
			);
			if (!coordinate) {
				throw new Error(`Missing canonical Earth coordinate: ${canonicalCoordinateId}`);
			}
			const canonicalTarget = FamilyAffinityTargetSchema.parse(
				JSON.parse(
					(await readRealFile(input.repositoryRoot, coordinate.targetPath)).toString('utf8')
				)
			);
			if (familyAffinitySha256(canonicalTarget) !== coordinate.targetSha256) {
				throw new Error(`Canonical Earth target hash drift: ${canonicalCoordinateId}`);
			}
			const target = buildMappedPrimaryBridgeTarget({
				currentClassId: mappingEntry.currentClassId,
				canonicalCoordinateId,
				canonicalTarget,
				normalReference
			});
			const assignment = buildBridgeAssignment(target);
			const paths = bridgeAttemptPaths(mappingEntry.currentClassId, 'earth', 1);
			bridgeTargets.push(target);
			bridgeAssignments.push(assignment);
			entries.push({
				currentClassId: mappingEntry.currentClassId,
				disposition: mappingEntry.disposition,
				targetKind: 'mapped-primary-bridge',
				affinity: 'earth',
				canonicalCoordinateId,
				coordinateId: target.coordinateId,
				targetPath: paths.target,
				targetSha256: familyAffinitySha256(target),
				assignmentPath: paths.assignment,
				assignmentSha256: familyAffinitySha256(assignment),
				identityPacketPath: null,
				identityPacketSha256: null,
				normalReference,
				status: 'earth-bridge-provisional',
				identityDecisionRequired: null,
				promotionCeiling: 'candidate-only',
				approvedReviewForbiddenUntil: 'canonical-normal-anchor-approved',
				runtimeCatalogMutationForbidden: true
			});
			continue;
		}
		const packet = buildBridgeIdentityPacket({
			entry: mappingEntry,
			normalReference,
			sourceTargetPath: sourceTarget.path,
			sourceTargetBytes: sourceTarget.bytes,
			sourceTarget: sourceTarget.target,
			sourceRosterSha256
		});
		const identityPacketPath = `${FAMILY_AFFINITY_ROOT}/bridge/identities/${mappingEntry.currentClassId}.json`;
		bridgePackets.push(packet);
		if (packet.status === 'blocked-on-identity-decision') {
			entries.push({
				currentClassId: mappingEntry.currentClassId,
				disposition: mappingEntry.disposition,
				targetKind: 'blocked-bridge-only',
				affinity: 'earth',
				canonicalCoordinateId: null,
				coordinateId: null,
				targetPath: null,
				targetSha256: null,
				assignmentPath: null,
				assignmentSha256: null,
				identityPacketPath,
				identityPacketSha256: familyAffinitySha256(packet),
				normalReference,
				status: 'blocked-on-identity-decision',
				identityDecisionRequired: packet.identityDecisionRequired,
				promotionCeiling: 'candidate-only',
				approvedReviewForbiddenUntil: 'canonical-normal-anchor-approved',
				runtimeCatalogMutationForbidden: true
			});
			continue;
		}
		const target = buildBridgeTarget(packet);
		const assignment = buildBridgeAssignment(target);
		const paths = bridgeAttemptPaths(mappingEntry.currentClassId, 'earth', 1);
		bridgeTargets.push(target);
		bridgeAssignments.push(assignment);
		entries.push({
			currentClassId: mappingEntry.currentClassId,
			disposition: mappingEntry.disposition,
			targetKind: 'bridge-only',
			affinity: 'earth',
			canonicalCoordinateId: null,
			coordinateId: target.coordinateId,
			targetPath: paths.target,
			targetSha256: familyAffinitySha256(target),
			assignmentPath: paths.assignment,
			assignmentSha256: familyAffinitySha256(assignment),
			identityPacketPath,
			identityPacketSha256: familyAffinitySha256(packet),
			normalReference,
			status: 'earth-bridge-provisional',
			identityDecisionRequired: null,
			promotionCeiling: 'candidate-only',
			approvedReviewForbiddenUntil: 'canonical-normal-anchor-approved',
			runtimeCatalogMutationForbidden: true
		});
	}
	if (entries.length === 0 || entries.length > 40) {
		throw new Error(`Earth bridge targetCount must be between 1 and 40; got ${entries.length}`);
	}
	const mappingBytes = await readRealFile(
		input.repositoryRoot,
		`${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`
	);
	const visualIndexBytes = await readRealFile(
		input.repositoryRoot,
		'docs/wiki/creatures/monsters/visual-index.json'
	);
	const wave = EarthBridgeWaveSchema.parse({
		schemaVersion: 'earth-bridge-wave-v1',
		waveId: 'earth-bridge-v1',
		sourceMappingPath: `${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`,
		sourceMappingSha256: rawHash(mappingBytes),
		sourceVisualIndexPath: 'docs/wiki/creatures/monsters/visual-index.json',
		sourceVisualIndexSha256: rawHash(visualIndexBytes),
		affinity: 'earth',
		targetCount: entries.length,
		mappedPrimaryCount: entries.filter(({ targetKind }) => targetKind === 'mapped-primary-bridge')
			.length,
		bridgeOnlyTargetCount: entries.filter(
			({ targetKind }) => targetKind !== 'mapped-primary-bridge'
		).length,
		dispatchableTargetCount: bridgeTargets.length,
		blockedCount: entries.filter(({ targetKind }) => targetKind === 'blocked-bridge-only').length,
		classificationCounts,
		entries,
		productionState: 'candidate-only',
		approvedReviewForbiddenUntil: 'canonical-normal-anchor-approved',
		runtimeCatalogMutationForbidden: true
	});
	const bridgeCoordinates = bridgeTargets.map((target, index) => {
		const assignment = bridgeAssignments[index]!;
		const paths = bridgeAttemptPaths(target.currentClassId!, 'earth', 1);
		return {
			namespace: 'bridge' as const,
			coordinateId: target.coordinateId,
			familyId: target.familyId,
			formId: target.formId,
			currentClassId: target.currentClassId,
			affinity: 'earth' as const,
			activeVersion: 1,
			targetPath: paths.target,
			targetSha256: familyAffinitySha256(target),
			assignmentPath: paths.assignment,
			assignmentSha256: familyAffinitySha256(assignment),
			status: 'earth-bridge-provisional' as const
		};
	});
	const updatedManifest = FamilyAffinityManifestSchema.parse({
		...manifest,
		bridge: {
			targetCount: bridgeCoordinates.length,
			assignmentCount: bridgeCoordinates.length,
			activeCoordinates: bridgeCoordinates
		}
	});
	const artifacts: Array<{ path: string; value: unknown }> = [
		{ path: `${FAMILY_AFFINITY_ROOT}/manifest.json`, value: updatedManifest },
		{ path: `${FAMILY_AFFINITY_ROOT}/waves/earth-bridge-v1.json`, value: wave },
		...bridgePackets.map((packet) => ({
			path: `${FAMILY_AFFINITY_ROOT}/bridge/identities/${packet.currentClassId}.json`,
			value: packet
		})),
		...bridgeTargets.map((target) => ({
			path: bridgeAttemptPaths(target.currentClassId!, 'earth', 1).target,
			value: target
		})),
		...bridgeAssignments.map((assignment, index) => ({
			path: bridgeAttemptPaths(bridgeTargets[index]!.currentClassId!, 'earth', 1).assignment,
			value: assignment
		}))
	];
	return {
		wave,
		manifest: updatedManifest,
		bridgePackets,
		bridgeTargets,
		bridgeAssignments,
		artifacts
	};
}

export async function buildEarthBridgeWave(input: {
	repositoryRoot: string;
	mapping: unknown;
	visualIndex: unknown;
	manifest: unknown;
}): Promise<EarthBridgeWave> {
	return (await buildEarthBridgeMaterialization(input)).wave;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

export async function materializeEarthBridgeWave(options: {
	repositoryRoot: string;
	check: boolean;
}): Promise<{ mode: 'check' | 'write'; artifactCount: number; targetCount: number }> {
	const mapping = JSON.parse(
		(
			await readRealFile(
				options.repositoryRoot,
				`${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`
			)
		).toString('utf8')
	);
	const visualIndex = JSON.parse(
		(
			await readRealFile(options.repositoryRoot, 'docs/wiki/creatures/monsters/visual-index.json')
		).toString('utf8')
	);
	const manifest = JSON.parse(
		(await readRealFile(options.repositoryRoot, `${FAMILY_AFFINITY_ROOT}/manifest.json`)).toString(
			'utf8'
		)
	);
	const build = await buildEarthBridgeMaterialization({
		repositoryRoot: options.repositoryRoot,
		mapping,
		visualIndex,
		manifest: { ...manifest, bridge: { targetCount: 0, assignmentCount: 0, activeCoordinates: [] } }
	});
	for (const artifact of build.artifacts) {
		const absolute = absoluteContainedPath(options.repositoryRoot, artifact.path);
		const expected = stableFamilyAffinityJson(artifact.value);
		if (await fileExists(absolute)) {
			const current = await readRealFile(options.repositoryRoot, artifact.path);
			if (current.toString('utf8') !== expected) {
				if (options.check) throw new Error(`Earth bridge materialization drift: ${artifact.path}`);
				if (artifact.path !== `${FAMILY_AFFINITY_ROOT}/manifest.json`) {
					throw new Error(
						`Refusing to overwrite immutable Earth bridge artifact: ${artifact.path}`
					);
				}
				const temporary = `${absolute}.earth-bridge-${process.pid}`;
				await writeFile(temporary, expected, { flag: 'wx' });
				await rename(temporary, absolute);
				await unlink(temporary).catch(() => undefined);
			}
			continue;
		}
		if (options.check) throw new Error(`Missing Earth bridge materialization: ${artifact.path}`);
		await mkdir(dirname(absolute), { recursive: true });
		await writeFile(absolute, expected, { flag: 'wx' });
	}
	return {
		mode: options.check ? 'check' : 'write',
		artifactCount: build.artifacts.length,
		targetCount: build.wave.targetCount
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const result = await materializeEarthBridgeWave({
		repositoryRoot: process.cwd(),
		check: process.argv.slice(2).includes('--check')
	});
	process.stdout.write(
		`${result.mode === 'check' ? 'Verified' : 'Wrote'} ${result.artifactCount} Earth bridge control artifacts for ${result.targetCount} retained classes.\n`
	);
}

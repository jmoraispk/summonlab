import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentImageAssignmentSchema,
	EquipmentImageTargetSchema,
	EquipmentVisualProfileAcceptanceSchema,
	EquipmentVisualProfileSchema,
	type EquipmentImageAssignment,
	type EquipmentImageTarget,
	type EquipmentVisualProfile,
	type EquipmentVisualProfileAcceptance
} from './equipment-image-production-contract.js';
import {
	buildEquipmentMaterialAllocationPlan,
	buildEquipmentMaterialProductionManifest
} from './equipment-material-production-lib.js';

type EquipmentManifest = ReturnType<typeof buildEquipmentMaterialProductionManifest>;
type EquipmentAllocation = ReturnType<typeof buildEquipmentMaterialAllocationPlan>;

export const EQUIPMENT_PROFILE_ACCEPTANCE_PATH =
	`${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/acceptance.json` as const;
export const EQUIPMENT_PACKET_ASSIGNED_AT = '2026-09-01T23:05:00.000Z' as const;

const FORBIDDEN_SHARED_PATHS = [
	`${EQUIPMENT_PRODUCTION_ROOT}/manifest.json`,
	`${EQUIPMENT_PRODUCTION_ROOT}/allocation-plan.json`,
	`${EQUIPMENT_PRODUCTION_ROOT}/visual-profile`,
	`${EQUIPMENT_PRODUCTION_ROOT}/reviews`,
	`${EQUIPMENT_PRODUCTION_ROOT}/runs`,
	'assets/enemies',
	'packages/contracts/src/image-production.ts',
	'tools/persist-image-production-output.ts',
	'skills/summonlab-image-production'
] as const;

const ACCEPTANCE_CRITERIA = [
	{
		criterionId: 'complete-canvas-safe-framing',
		category: 'canvas-and-framing',
		description: 'The complete subject remains visible inside the declared safe margin.',
		required: true
	},
	{
		criterionId: 'expected-object-component-count',
		category: 'object-count',
		description: 'The image contains exactly the expected object, pair, or Armour components.',
		required: true
	},
	{
		criterionId: 'equipment-class-silhouette',
		category: 'equipment-silhouette',
		description: 'The silhouette reads immediately as the declared Equipment class.',
		required: true
	},
	{
		criterionId: 'structural-plausibility',
		category: 'structural-plausibility',
		description: 'Construction, joins, fastenings, grip, coverage, and weight are plausible.',
		required: true
	},
	{
		criterionId: 'rank-bearing-material-dominance',
		category: 'material-dominance',
		description: 'The declared material is dominant and supplies the only visible rank.',
		required: true
	},
	{
		criterionId: 'material-cue-strength',
		category: 'material-cue-strength',
		description:
			'One or two physical construction cues establish material identity beyond palette.',
		required: true
	},
	{
		criterionId: 'bounded-rank-behaviour',
		category: 'bounded-rank-behaviour',
		description:
			'Any supernatural material behaviour is bounded and does not become full-object glow.',
		required: true
	},
	{
		criterionId: 'profile-style-cohesion',
		category: 'style-cohesion',
		description:
			'Finish, wear, lighting, background, and construction follow the accepted profile.',
		required: true
	},
	{
		criterionId: 'negative-constraint-safety',
		category: 'negative-constraint-safety',
		description: 'Every declared negative constraint is satisfied.',
		required: true
	}
] as const;

const REQUIRED_CHECK_LABELS = [
	'complete canvas and safe framing',
	'expected object or component count',
	'equipment-class silhouette',
	'structural plausibility',
	'rank-bearing material dominance',
	'material-cue strength',
	'bounded rank behavior',
	'profile style cohesion',
	'negative-constraint safety'
] as const;

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
		.join(',')}}`;
}

export function canonicalJsonSha256(value: unknown): string {
	return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function byteSha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function buildEquipmentProfileAcceptance(input: {
	readonly profile: unknown;
	readonly profilePath: string;
	readonly reviewer: string;
	readonly acceptedAt: string;
	readonly acknowledgedProfileSha256: string;
}): EquipmentVisualProfileAcceptance {
	const profile = EquipmentVisualProfileSchema.parse(input.profile);
	const profileCanonicalSha256 = canonicalJsonSha256(profile);
	if (input.acknowledgedProfileSha256 !== profileCanonicalSha256) {
		throw new Error(
			`The acknowledged profile hash does not match the canonical profile SHA-256: expected ${profileCanonicalSha256}`
		);
	}
	return EquipmentVisualProfileAcceptanceSchema.parse({
		schemaVersion: 'equipment-visual-profile-acceptance-v1',
		acceptanceId: `${profile.profileId}-acceptance`,
		profileId: profile.profileId,
		profilePath: input.profilePath,
		profileCanonicalSha256,
		decision: 'accepted',
		reviewer: input.reviewer,
		acceptedAt: input.acceptedAt
	});
}

export interface EquipmentRootPacket {
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly target: EquipmentImageTarget;
	readonly assignment: EquipmentImageAssignment;
}

function artifactPacketPath(outputPath: string, directory: 'targets' | 'assignments'): string {
	const candidatePrefix = `${EQUIPMENT_PRODUCTION_ROOT}/candidates/`;
	if (!outputPath.startsWith(candidatePrefix) || !outputPath.endsWith('.png')) {
		throw new Error(`Invalid Equipment candidate output path: ${outputPath}`);
	}
	return `${EQUIPMENT_PRODUCTION_ROOT}/${directory}/${outputPath.slice(candidatePrefix.length, -4)}.json`;
}

function targetPresentation(
	profile: EquipmentVisualProfile,
	artifactRole: 'item' | 'set-source'
): EquipmentImageTarget['presentation'] {
	if (artifactRole === 'set-source') {
		return {
			mode: 'complete-armour-set',
			subject: profile.fullSetPresentation.subject,
			composition: profile.fullSetPresentation.composition,
			canvas: profile.fullSetPresentation.canvas,
			negativeConstraints: profile.negativeConstraints
		};
	}
	return {
		mode: 'isolated-item',
		subject: profile.isolatedPresentation.subject,
		composition: profile.isolatedPresentation.composition,
		canvas: profile.isolatedPresentation.canvas,
		negativeConstraints: profile.negativeConstraints
	};
}

function assertRootInputs(
	manifest: EquipmentManifest,
	allocation: EquipmentAllocation,
	profile: EquipmentVisualProfile,
	acceptance: EquipmentVisualProfileAcceptance
): void {
	if (
		canonicalJsonSha256(manifest) !==
		canonicalJsonSha256(buildEquipmentMaterialProductionManifest())
	) {
		throw new Error('Supplied manifest does not match the deterministic manifest exporter');
	}
	if (
		canonicalJsonSha256(allocation) !== canonicalJsonSha256(buildEquipmentMaterialAllocationPlan())
	) {
		throw new Error('Supplied allocation does not match the deterministic allocation exporter');
	}
	const manifestHash = canonicalJsonSha256(manifest);
	if (allocation.sourceManifest.canonicalSha256 !== manifestHash) {
		throw new Error('Allocation source-manifest hash does not match the supplied manifest');
	}
	if (allocation.productionId !== manifest.productionId) {
		throw new Error('Allocation and manifest production IDs do not match');
	}
	const profileHash = canonicalJsonSha256(profile);
	if (
		acceptance.profileId !== profile.profileId ||
		acceptance.profileCanonicalSha256 !== profileHash ||
		acceptance.decision !== 'accepted'
	) {
		throw new Error('Profile acceptance does not bind the supplied visual profile');
	}
	const rootTargets = manifest.targets.filter(
		({ dependsOnTargetId }) => dependsOnTargetId === null
	);
	const rootJobs = allocation.jobs.filter(({ phase }) => phase === 'independent');
	if (rootTargets.length !== 77 || rootJobs.length !== 77) {
		throw new Error('Expected exactly 77 manifest roots and 77 independent allocation jobs');
	}
	const rootTargetIds = rootTargets.map(({ targetId }) => targetId);
	if (
		new Set(rootTargetIds).size !== 77 ||
		rootJobs.some((job, index) => job.targetId !== rootTargetIds[index])
	) {
		throw new Error('Allocation root order does not exactly match the manifest root targets');
	}
}

export function buildRootEquipmentPackets(input: {
	readonly manifest: EquipmentManifest;
	readonly allocation: EquipmentAllocation;
	readonly profile: EquipmentVisualProfile;
	readonly acceptance: EquipmentVisualProfileAcceptance;
	readonly assignedAt?: string;
}): EquipmentRootPacket[] {
	const profile = EquipmentVisualProfileSchema.parse(input.profile);
	const acceptance = EquipmentVisualProfileAcceptanceSchema.parse(input.acceptance);
	assertRootInputs(input.manifest, input.allocation, profile, acceptance);

	const manifestCanonicalSha256 = canonicalJsonSha256(input.manifest);
	const allocationCanonicalSha256 = canonicalJsonSha256(input.allocation);
	const profileCanonicalSha256 = canonicalJsonSha256(profile);
	const profileAcceptanceCanonicalSha256 = canonicalJsonSha256(acceptance);
	const rootJobs = input.allocation.jobs.filter(({ phase }) => phase === 'independent');
	const jobByTargetId = new Map(rootJobs.map((job) => [job.targetId, job] as const));

	const packets = input.manifest.targets
		.filter(({ dependsOnTargetId }) => dependsOnTargetId === null)
		.map((manifestTarget) => {
			const job = jobByTargetId.get(manifestTarget.targetId);
			if (
				job === undefined ||
				job.permittedOutputs.candidatePath !== manifestTarget.output.candidatePath ||
				job.permittedOutputs.provenanceResultPath !== manifestTarget.output.provenanceResultPath ||
				job.synchronousRetryCeiling !== 0 ||
				job.dryRun
			) {
				throw new Error(`Allocation job does not exactly bind ${manifestTarget.targetId}`);
			}
			const output = {
				candidatePath: manifestTarget.output.candidatePath,
				resultPath: manifestTarget.output.provenanceResultPath
			};
			const target = EquipmentImageTargetSchema.parse({
				schemaVersion: 'equipment-image-target-v1',
				targetId: manifestTarget.targetId,
				productionId: input.manifest.productionId,
				profileId: profile.profileId,
				manifestCanonicalSha256,
				allocationCanonicalSha256,
				profileCanonicalSha256,
				profileAcceptanceCanonicalSha256,
				material: {
					id: manifestTarget.materialId,
					name: manifestTarget.materialName,
					family: manifestTarget.materialFamily,
					rank: manifestTarget.materialRank,
					craftsmanship: 'Standard'
				},
				equipment: {
					class: manifestTarget.equipmentClass,
					artifactRole: manifestTarget.artifactRole,
					slot: manifestTarget.slot
				},
				consistencySource: null,
				references: profile.references,
				presentation: targetPresentation(profile, manifestTarget.artifactRole),
				acceptanceCriteria: ACCEPTANCE_CRITERIA,
				output
			});
			const assignment = EquipmentImageAssignmentSchema.parse({
				schemaVersion: 'equipment-image-assignment-v1',
				assignmentId: `assignment-${target.targetId}`,
				targetId: target.targetId,
				contractVersion: 'equipment-image-production-contract-v1',
				rendererVersion: 'equipment-image-prompt-v1',
				assignedAt: input.assignedAt ?? EQUIPMENT_PACKET_ASSIGNED_AT,
				dryRun: false,
				retryCeiling: 0,
				permittedOutputs: output,
				forbiddenSharedPaths: FORBIDDEN_SHARED_PATHS,
				completionContract: {
					oneTargetOneImage: true,
					structuredResultRequired: true,
					sharedFilesMustRemainUntouched: true,
					selfPromotionForbidden: true
				}
			});
			return {
				targetPath: artifactPacketPath(output.candidatePath, 'targets'),
				assignmentPath: artifactPacketPath(output.candidatePath, 'assignments'),
				target,
				assignment
			};
		});

	const paths = packets.flatMap(({ targetPath, assignmentPath, target }) => [
		targetPath,
		assignmentPath,
		target.output.candidatePath,
		target.output.resultPath
	]);
	if (new Set(paths).size !== paths.length)
		throw new Error('Root packet paths must be globally unique');
	return packets;
}

function classDescription(target: EquipmentImageTarget): string {
	const descriptions: Record<string, string> = {
		sword: 'practical hand-and-a-half straight sword',
		dagger: 'compact single-hand fighting dagger',
		spear:
			'long two-hand spear with a dominant rank-bearing metal head and subordinate neutral seasoned-wood shaft',
		bow: 'practical recurved bow',
		axe: 'practical one-hand bearded axe',
		mace: 'practical one-hand flanged mace',
		shield: 'medium heater shield',
		staff: 'full-length, wood-led staff with subordinate fittings and no mandatory orb',
		'heavy-armour': 'metal-dominant articulated protection',
		'light-armour': 'hide- or scale-dominant mobile protection',
		robes: 'cloth-dominant layered clothing'
	};
	const description = descriptions[target.equipment.class];
	if (description === undefined)
		throw new Error(`No Equipment class prompt description for ${target.equipment.class}`);
	return description;
}

function presentationInstruction(target: EquipmentImageTarget): string {
	const presentation = target.presentation;
	if (presentation.mode === 'isolated-item') {
		return `Create one ${classDescription(target)} as ${presentation.subject} in a ${presentation.composition}.`;
	}
	if (presentation.mode === 'complete-armour-set') {
		return `Create one ${classDescription(target)} complete Armour set on a ${presentation.subject}. ${presentation.composition[0]!.toUpperCase()}${presentation.composition.slice(1)}.`;
	}
	if (target.consistencySource === null || target.equipment.slot === null) {
		throw new Error('Dependent-piece prompt requires a consistency source and Equipment slot');
	}
	return `Create only the matching ${target.equipment.slot} ${classDescription(target)} piece or required pair. ${presentation.composition[0]!.toUpperCase()}${presentation.composition.slice(1)}. Preserve exact continuity with accepted source ${target.consistencySource.targetId}.`;
}

export function renderEquipmentPrompt(unparsedTarget: EquipmentImageTarget): string {
	const target = EquipmentImageTargetSchema.parse(unparsedTarget);
	const references = target.references
		.map(
			({ path: referencePath, contentHash, purpose }) =>
				`${referencePath} [${contentHash}] — ${purpose}`
		)
		.join('; ');
	return [
		'Equipment image production prompt v1',
		`Target: ${target.targetId}`,
		presentationInstruction(target),
		`Material: ${target.material.name} (${target.material.family}, rank ${target.material.rank}), Standard craftsmanship (+0). The material supplies the only visible rank.`,
		'Style: premium realistic painterly dark fantasy. grounded medieval construction with structurally plausible joins, fastenings, grips, and weight. honest surface wear and material response with narrow controlled highlights and restrained local magic. Material identity uses one or two physical construction cues; palette alone never satisfies the material criterion; where the material calls for it, use one bounded supernatural behavior. Secondary materials stay neutral and subordinate and never assert a second rank. cold key light with a restrained warm rim. midnight-charcoal presentation ground with a restrained floor plane.',
		`Canvas: ${target.presentation.canvas.width}x${target.presentation.canvas.height} ${target.presentation.canvas.mediaType}; keep the whole subject inside an ${target.presentation.canvas.safeMarginPercent}% safe margin.`,
		`Reference use (ordered): ${references}`,
		`Required checks: ${REQUIRED_CHECK_LABELS.join('; ')}.`,
		`Forbid: ${target.presentation.negativeConstraints.join(', ')}.`,
		'Output exactly one candidate image and do not add text, labels, UI, borders, frames, logos, or watermarks.'
	].join('\n');
}

function repositoryAbsolute(workspaceRoot: string, repositoryPath: string): string {
	if (
		path.posix.isAbsolute(repositoryPath) ||
		repositoryPath.includes('\\') ||
		repositoryPath
			.split('/')
			.some((segment) => segment === '' || segment === '.' || segment === '..')
	) {
		throw new Error(`Invalid repository-relative POSIX path: ${repositoryPath}`);
	}
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, ...repositoryPath.split('/'));
	if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
		throw new Error(`Repository path escapes the workspace root: ${repositoryPath}`);
	}
	return absolute;
}

async function pathExists(absolutePath: string): Promise<boolean> {
	return lstat(absolutePath).then(
		() => true,
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return false;
			throw error;
		}
	);
}

async function readRegularRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string
): Promise<Buffer> {
	const absolute = repositoryAbsolute(workspaceRoot, repositoryPath);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Reference must be a regular non-symbolic file: ${repositoryPath}`);
	}
	return readFile(absolute);
}

export async function validateEquipmentPacket(input: {
	readonly workspaceRoot: string;
	readonly manifest: EquipmentManifest;
	readonly allocation: EquipmentAllocation;
	readonly profile: EquipmentVisualProfile;
	readonly acceptance: EquipmentVisualProfileAcceptance;
	readonly target: unknown;
	readonly assignment: unknown;
}): Promise<{ readonly ownedPaths: [string, string]; readonly promptSha256: string }> {
	const target = EquipmentImageTargetSchema.parse(input.target);
	const assignment = EquipmentImageAssignmentSchema.parse(input.assignment);
	const profile = EquipmentVisualProfileSchema.parse(input.profile);
	const acceptance = EquipmentVisualProfileAcceptanceSchema.parse(input.acceptance);
	if (assignment.targetId !== target.targetId)
		throw new Error('Assignment target ID does not match the target');
	if (canonicalJson(assignment.permittedOutputs) !== canonicalJson(target.output)) {
		throw new Error('Assignment permitted outputs do not exactly match target outputs');
	}
	if (
		target.manifestCanonicalSha256 !== canonicalJsonSha256(input.manifest) ||
		target.allocationCanonicalSha256 !== canonicalJsonSha256(input.allocation)
	) {
		throw new Error('Target manifest or allocation hash does not match the supplied source');
	}
	if (
		target.profileId !== profile.profileId ||
		target.profileCanonicalSha256 !== canonicalJsonSha256(profile) ||
		acceptance.profileId !== profile.profileId ||
		acceptance.profileCanonicalSha256 !== canonicalJsonSha256(profile) ||
		target.profileAcceptanceCanonicalSha256 !== canonicalJsonSha256(acceptance)
	) {
		throw new Error('Target profile or acceptance hash does not match the accepted profile');
	}
	if (canonicalJson(target.references) !== canonicalJson(profile.references)) {
		throw new Error('Target ordered references do not exactly match the accepted profile');
	}
	for (const reference of target.references) {
		const bytes = await readRegularRepositoryFile(input.workspaceRoot, reference.path);
		if (byteSha256(bytes) !== reference.contentHash) {
			throw new Error(`Reference byte hash mismatch: ${reference.path}`);
		}
	}
	for (const ownedPath of [target.output.candidatePath, target.output.resultPath]) {
		if (await pathExists(repositoryAbsolute(input.workspaceRoot, ownedPath))) {
			throw new Error(`Assigned output already exists: ${ownedPath}`);
		}
	}
	const expectedPacket = buildRootEquipmentPackets({
		manifest: input.manifest,
		allocation: input.allocation,
		profile,
		acceptance
	}).find((packet) => packet.target.targetId === target.targetId);
	if (
		expectedPacket === undefined ||
		canonicalJson(expectedPacket.target) !== canonicalJson(target) ||
		canonicalJson(expectedPacket.assignment) !== canonicalJson(assignment)
	) {
		throw new Error(`Packet does not match the deterministic root packet for ${target.targetId}`);
	}
	return {
		ownedPaths: [target.output.candidatePath, target.output.resultPath],
		promptSha256: byteSha256(renderEquipmentPrompt(target))
	};
}

function serializeJson(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

export async function materializeRootEquipmentPackets(input: {
	readonly workspaceRoot: string;
	readonly manifest: EquipmentManifest;
	readonly allocation: EquipmentAllocation;
	readonly profile: EquipmentVisualProfile;
	readonly acceptance: EquipmentVisualProfileAcceptance;
	readonly assignedAt?: string;
	readonly check?: boolean;
}): Promise<{
	readonly mode: 'write' | 'check';
	readonly targetCount: number;
	readonly assignmentCount: number;
	readonly writesPerformed: number;
}> {
	const packets = buildRootEquipmentPackets(input);
	const artifacts = packets.flatMap(({ targetPath, assignmentPath, target, assignment }) => [
		{ repositoryPath: targetPath, contents: serializeJson(target) },
		{ repositoryPath: assignmentPath, contents: serializeJson(assignment) }
	]);
	if (input.check) {
		for (const artifact of artifacts) {
			const current = await readFile(
				repositoryAbsolute(input.workspaceRoot, artifact.repositoryPath),
				'utf8'
			).catch(() => null);
			if (current !== artifact.contents) {
				throw new Error(`Root packet is missing or stale: ${artifact.repositoryPath}`);
			}
		}
		return { mode: 'check', targetCount: 77, assignmentCount: 77, writesPerformed: 0 };
	}

	for (const artifact of artifacts) {
		if (await pathExists(repositoryAbsolute(input.workspaceRoot, artifact.repositoryPath))) {
			throw new Error(`Root packet collision: ${artifact.repositoryPath}`);
		}
	}
	for (const artifact of artifacts) {
		const absolute = repositoryAbsolute(input.workspaceRoot, artifact.repositoryPath);
		await mkdir(path.dirname(absolute), { recursive: true });
		const handle = await open(absolute, 'wx');
		try {
			await handle.writeFile(artifact.contents, 'utf8');
			await handle.sync();
		} finally {
			await handle.close();
		}
	}
	return { mode: 'write', targetCount: 77, assignmentCount: 77, writesPerformed: 154 };
}

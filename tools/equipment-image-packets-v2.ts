import { createHash } from 'node:crypto';

import {
	EquipmentV2ArmourSourceReviewReceiptSchema,
	EquipmentV2ContractReadinessSchema,
	EquipmentV2ImageAssignmentSchema,
	EquipmentV2ImageResultSchema,
	EquipmentV2ImageTargetSchema,
	EquipmentV2ProfileAcceptanceSchema,
	type EquipmentV2ArmourSourceReviewReceipt,
	type EquipmentV2ContractReadiness,
	type EquipmentV2ImageAssignment,
	type EquipmentV2ImageTarget,
	type EquipmentV2ProfileAcceptance
} from './equipment-image-production-contract-v2.js';
import {
	EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH,
	canonicalJsonSha256V2
} from './equipment-image-profile-acceptance-v2.js';
import {
	EQUIPMENT_V2_VISUAL_PROFILE_PATH,
	EquipmentVisualProfileV2Schema,
	buildEquipmentVisualProfileV2
} from './equipment-image-profile-v2.js';
import {
	EQUIPMENT_V2_ALLOCATION_PLAN_PATH,
	EQUIPMENT_V2_MANIFEST_PATH,
	EQUIPMENT_V2_PRODUCTION_ROOT,
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';
import {
	equipmentRepositoryPathState,
	readEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

type EquipmentV2Manifest = ReturnType<typeof buildEquipmentMaterialProductionManifestV2>;
type EquipmentV2Allocation = ReturnType<typeof buildEquipmentMaterialAllocationPlanV2>;
type EquipmentV2Profile = ReturnType<typeof buildEquipmentVisualProfileV2>;

export const EQUIPMENT_V2_PACKET_ASSIGNED_AT = '2026-09-02T20:30:00.000Z' as const;

const FORBIDDEN_SHARED_PATHS = [
	'assets/equipment/experiments/material-equipment-v1',
	EQUIPMENT_V2_MANIFEST_PATH,
	EQUIPMENT_V2_ALLOCATION_PLAN_PATH,
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/visual-profile`,
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/targets`,
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/assignments`,
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/reviews`,
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/runs`,
	'assets/enemies',
	'packages/contracts/src/image-production.ts',
	'tools/persist-image-production-output.ts',
	'skills/summonlab-image-production'
] as const;

const COMMON_ACCEPTANCE_CRITERIA = [
	{
		criterionId: 'v2-framing',
		category: 'canvas-and-framing',
		description:
			'Aim for 8% clearance, never cross the 5% hard minimum, and preserve the class pose once the minimum is met.',
		required: true
	},
	{
		criterionId: 'expected-object-component-count',
		category: 'object-count',
		description: 'The image contains exactly the required object, pair, or four Armour components.',
		required: true
	},
	{
		criterionId: 'equipment-class-silhouette',
		category: 'equipment-silhouette',
		description: 'The silhouette reads immediately as the declared Equipment class.',
		required: true
	},
	{
		criterionId: 'class-pose-lock',
		category: 'class-pose-consistency',
		description: 'Camera, pivot, normalized scale, and presentation angle match the class lock.',
		required: true
	},
	{
		criterionId: 'structural-plausibility',
		category: 'structural-plausibility',
		description:
			'Construction, joins, fastenings, grip, coverage, balance, and weight are plausible.',
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
		description: 'Physical construction cues establish the material beyond palette.',
		required: true
	},
	{
		criterionId: 'bounded-rank-behaviour',
		category: 'bounded-rank-behaviour',
		description:
			'Any supernatural material behaviour is bounded and never becomes full-object glow.',
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

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
		.join(',')}}`;
}

function byteSha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export interface EquipmentV2Packet {
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly target: EquipmentV2ImageTarget;
	readonly assignment: EquipmentV2ImageAssignment;
}

function packetPath(outputPath: string, directory: 'targets' | 'assignments'): string {
	const prefix = `${EQUIPMENT_V2_PRODUCTION_ROOT}/candidates/`;
	if (!outputPath.startsWith(prefix) || !outputPath.endsWith('.png')) {
		throw new Error(`Invalid v2 candidate path: ${outputPath}`);
	}
	return `${EQUIPMENT_V2_PRODUCTION_ROOT}/${directory}/${outputPath.slice(prefix.length, -4)}.json`;
}

function assertStaticInputs(
	manifest: EquipmentV2Manifest,
	allocation: EquipmentV2Allocation,
	profile: EquipmentV2Profile,
	acceptance: EquipmentV2ProfileAcceptance
): void {
	if (
		canonicalJsonSha256V2(manifest) !==
		canonicalJsonSha256V2(buildEquipmentMaterialProductionManifestV2())
	) {
		throw new Error('Supplied v2 manifest does not match its deterministic exporter');
	}
	if (
		canonicalJsonSha256V2(allocation) !==
		canonicalJsonSha256V2(buildEquipmentMaterialAllocationPlanV2())
	) {
		throw new Error('Supplied v2 allocation does not match its deterministic exporter');
	}
	if (allocation.sourceManifest.canonicalSha256 !== canonicalJsonSha256V2(manifest)) {
		throw new Error('V2 allocation does not bind the supplied manifest');
	}
	if (
		acceptance.profileId !== profile.profileId ||
		acceptance.profileCanonicalSha256 !== canonicalJsonSha256V2(profile) ||
		acceptance.authorizationScope !== 'visual-profile-only'
	) {
		throw new Error('V2 acceptance does not bind the supplied profile');
	}
	const roots = manifest.targets.filter(({ dependsOnTargetId }) => dependsOnTargetId === null);
	const jobs = allocation.jobs.filter(({ phase }) => phase === 'independent');
	if (
		roots.length !== 77 ||
		jobs.length !== 77 ||
		jobs.some((job, index) => job.targetId !== roots[index]?.targetId)
	) {
		throw new Error('V2 root allocation must exactly match all 77 manifest roots in order');
	}
}

function scopedRootReferences(
	profile: EquipmentV2Profile,
	equipmentClass: EquipmentV2ImageTarget['equipment']['class'],
	presentationMode: 'isolated-item' | 'complete-armour-set',
	artifactRole: 'item' | 'set-source'
): EquipmentV2ImageTarget['references'] {
	const classDefault = profile.equipmentClassDefaults.find(
		(entry) => entry.equipmentClass === equipmentClass
	);
	if (classDefault === undefined) throw new Error(`Missing v2 class default: ${equipmentClass}`);
	const expectedIds = new Set(['remy-finish-style', classDefault.anchorReferenceId]);
	const references = profile.references
		.filter(({ referenceId }) => expectedIds.has(referenceId))
		.filter(
			({ appliesTo }) =>
				appliesTo.presentationModes.includes(presentationMode) &&
				appliesTo.artifactRoles.includes(artifactRole)
		)
		.map(({ referenceId, path, contentHash, usage, purpose }) => ({
			referenceId,
			path,
			contentHash,
			usage,
			purpose
		}));
	if (
		references.length !== 2 ||
		references[0]?.referenceId !== 'remy-finish-style' ||
		references[1]?.referenceId !== classDefault.anchorReferenceId ||
		references[0].usage !== 'style-only' ||
		(presentationMode === 'isolated-item'
			? references[1].usage !== 'pose-only'
			: references[1].usage !== 'camera-and-display-only')
	) {
		throw new Error(`V2 scoped reference routing is invalid for ${equipmentClass}`);
	}
	return references;
}

function classDirection(profile: EquipmentV2Profile, equipmentClass: string) {
	const classDefault = profile.equipmentClassDefaults.find(
		(entry) => entry.equipmentClass === equipmentClass
	);
	if (classDefault === undefined) throw new Error(`Missing v2 class direction: ${equipmentClass}`);
	return {
		description: classDefault.description,
		anchorReferenceId: classDefault.anchorReferenceId,
		pose: classDefault.pose,
		proportionRules: [...classDefault.proportionRules],
		consistencyLock: [...profile.isolatedPresentation.consistencyLock] as [
			'camera',
			'pivot',
			'normalized-scale',
			'presentation-angle'
		]
	};
}

function rootPresentation(
	profile: EquipmentV2Profile,
	artifactRole: 'item' | 'set-source'
): EquipmentV2ImageTarget['presentation'] {
	const framing = profile.framing;
	if (artifactRole === 'set-source') {
		return {
			mode: 'complete-armour-set',
			subject: profile.fullSetPresentation.subject,
			composition: profile.fullSetPresentation.composition,
			canvas: profile.fullSetPresentation.canvas,
			framing,
			interior: profile.fullSetPresentation.interior,
			requiredComponents: profile.fullSetPresentation.requiredComponents,
			negativeConstraints: profile.negativeConstraints
		};
	}
	return {
		mode: 'isolated-item',
		subject: profile.isolatedPresentation.subject,
		composition: profile.isolatedPresentation.commonPose,
		canvas: profile.isolatedPresentation.canvas,
		framing,
		negativeConstraints: profile.negativeConstraints
	};
}

function criteriaFor(mode: EquipmentV2ImageTarget['presentation']['mode']) {
	const criteria: Array<
		| (typeof COMMON_ACCEPTANCE_CRITERIA)[number]
		| {
				criterionId: string;
				category: 'empty-armour-display' | 'source-continuity';
				description: string;
				required: true;
		  }
	> = [...COMMON_ACCEPTANCE_CRITERIA];
	if (mode === 'complete-armour-set') {
		criteria.push({
			criterionId: 'empty-full-set',
			category: 'empty-armour-display',
			description:
				'The complete set is empty and self-supporting with natural cavity shadow only: no body, mannequin, or void figure.',
			required: true
		});
	}
	if (mode === 'dependent-armour-piece') {
		criteria.push({
			criterionId: 'accepted-source-continuity',
			category: 'source-continuity',
			description: 'The piece exactly preserves the accepted full-set design and slot boundary.',
			required: true
		});
	}
	return criteria;
}

function assignmentFor(
	target: EquipmentV2ImageTarget,
	assignedAt: string
): EquipmentV2ImageAssignment {
	return EquipmentV2ImageAssignmentSchema.parse({
		schemaVersion: 'equipment-image-assignment-v2',
		assignmentId: `assignment-${target.targetId}`,
		targetId: target.targetId,
		contractVersion: 'equipment-image-production-contract-v2',
		rendererVersion: 'equipment-image-prompt-v2',
		assignedAt,
		runActivationRequired: true,
		dryRun: false,
		retryCeiling: 0,
		permittedOutputs: target.output,
		forbiddenSharedPaths: FORBIDDEN_SHARED_PATHS,
		completionContract: {
			oneTargetOneImage: true,
			structuredResultRequired: true,
			sharedFilesMustRemainUntouched: true,
			selfPromotionForbidden: true
		}
	});
}

export function buildRootEquipmentPacketsV2(input: {
	readonly manifest: EquipmentV2Manifest;
	readonly allocation: EquipmentV2Allocation;
	readonly profile: EquipmentV2Profile;
	readonly acceptance: EquipmentV2ProfileAcceptance;
}): EquipmentV2Packet[] {
	const profile = EquipmentVisualProfileV2Schema.parse(input.profile);
	const acceptance = EquipmentV2ProfileAcceptanceSchema.parse(input.acceptance);
	assertStaticInputs(input.manifest, input.allocation, profile, acceptance);
	const manifestCanonicalSha256 = canonicalJsonSha256V2(input.manifest);
	const allocationCanonicalSha256 = canonicalJsonSha256V2(input.allocation);
	const profileCanonicalSha256 = canonicalJsonSha256V2(profile);
	const profileAcceptanceCanonicalSha256 = canonicalJsonSha256V2(acceptance);
	const rootJobs = new Map(
		input.allocation.jobs
			.filter(({ phase }) => phase === 'independent')
			.map((job) => [job.targetId, job] as const)
	);
	const packets = input.manifest.targets
		.filter(({ dependsOnTargetId }) => dependsOnTargetId === null)
		.map((manifestTarget) => {
			const equipmentClass =
				manifestTarget.equipmentClass as EquipmentV2ImageTarget['equipment']['class'];
			const job = rootJobs.get(manifestTarget.targetId);
			if (
				job === undefined ||
				job.permittedOutputs.candidatePath !== manifestTarget.output.candidatePath ||
				job.permittedOutputs.provenanceResultPath !== manifestTarget.output.provenanceResultPath ||
				job.synchronousRetryCeiling !== 0 ||
				job.dryRun
			) {
				throw new Error(`V2 allocation job does not bind ${manifestTarget.targetId}`);
			}
			const presentationMode =
				manifestTarget.artifactRole === 'set-source'
					? ('complete-armour-set' as const)
					: ('isolated-item' as const);
			const output = {
				candidatePath: manifestTarget.output.candidatePath,
				provenanceResultPath: manifestTarget.output.provenanceResultPath
			};
			const target = EquipmentV2ImageTargetSchema.parse({
				schemaVersion: 'equipment-image-target-v2',
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
					class: equipmentClass,
					artifactRole: manifestTarget.artifactRole,
					slot: null
				},
				classDirection: classDirection(profile, equipmentClass),
				consistencySource: null,
				references: scopedRootReferences(
					profile,
					equipmentClass,
					presentationMode,
					manifestTarget.artifactRole
				),
				presentation: rootPresentation(profile, manifestTarget.artifactRole),
				acceptanceCriteria: criteriaFor(presentationMode),
				output
			});
			return {
				targetPath: packetPath(output.candidatePath, 'targets'),
				assignmentPath: packetPath(output.candidatePath, 'assignments'),
				target,
				assignment: assignmentFor(target, EQUIPMENT_V2_PACKET_ASSIGNED_AT)
			};
		});
	const allPaths = packets.flatMap(({ targetPath, assignmentPath, target }) => [
		targetPath,
		assignmentPath,
		target.output.candidatePath,
		target.output.provenanceResultPath
	]);
	if (new Set(allPaths).size !== allPaths.length) throw new Error('V2 root packet paths collide');
	return packets;
}

function dependentComposition(slot: 'head' | 'torso' | 'legs' | 'boots'): string {
	return {
		head: 'Isolate exactly the accepted Head piece.',
		torso: 'Isolate exactly the accepted Torso piece.',
		legs: 'Isolate exactly the complete accepted Legs lower-body item or required pair.',
		boots: 'Isolate exactly one accepted matching Boots pair.'
	}[slot];
}

export function buildDependentArmourPacketsV2(input: {
	readonly manifest: EquipmentV2Manifest;
	readonly allocation: EquipmentV2Allocation;
	readonly profile: EquipmentV2Profile;
	readonly acceptance: EquipmentV2ProfileAcceptance;
	readonly sourceTarget: EquipmentV2ImageTarget;
	readonly receipt: EquipmentV2ArmourSourceReviewReceipt;
}): EquipmentV2Packet[] {
	const profile = EquipmentVisualProfileV2Schema.parse(input.profile);
	const acceptance = EquipmentV2ProfileAcceptanceSchema.parse(input.acceptance);
	const sourceTarget = EquipmentV2ImageTargetSchema.parse(input.sourceTarget);
	const receipt = EquipmentV2ArmourSourceReviewReceiptSchema.parse(input.receipt);
	assertStaticInputs(input.manifest, input.allocation, profile, acceptance);
	if (receipt.decision !== 'accepted') throw new Error('The v2 Armour source is not accepted');
	if (
		receipt.manifestCanonicalSha256 !== canonicalJsonSha256V2(input.manifest) ||
		receipt.allocationCanonicalSha256 !== canonicalJsonSha256V2(input.allocation) ||
		receipt.profileCanonicalSha256 !== canonicalJsonSha256V2(profile) ||
		receipt.profileAcceptanceCanonicalSha256 !== canonicalJsonSha256V2(acceptance)
	) {
		throw new Error('The v2 Armour receipt does not bind the source artifacts');
	}
	const expectedSource = buildRootEquipmentPacketsV2({
		manifest: input.manifest,
		allocation: input.allocation,
		profile,
		acceptance
	}).find(({ target }) => target.targetId === receipt.sourceTargetId);
	if (
		expectedSource === undefined ||
		canonicalJsonSha256V2(expectedSource.target) !== canonicalJsonSha256V2(sourceTarget) ||
		sourceTarget.presentation.mode !== 'complete-armour-set'
	) {
		throw new Error('The v2 Armour receipt source is not the deterministic full-set root');
	}
	const gate = input.allocation.reviewGates.find(({ gateId }) => gateId === receipt.gateId);
	if (gate === undefined || gate.sourceTargetId !== sourceTarget.targetId) {
		throw new Error('The v2 Armour receipt does not bind an allocation gate');
	}
	const children = input.manifest.targets.filter(
		({ dependsOnTargetId }) => dependsOnTargetId === sourceTarget.targetId
	);
	const slots = ['head', 'torso', 'legs', 'boots'] as const;
	if (
		children.length !== 4 ||
		children.some((child, index) => child.slot !== slots[index]) ||
		children.some((child, index) => child.targetId !== gate.unlocksTargetIds[index])
	) {
		throw new Error('The v2 Armour gate must unlock Head, Torso, Legs, and Boots in order');
	}
	const styleReference = profile.references.find(
		({ referenceId }) =>
			referenceId === profile.dependentPiecePresentation.additionalReferenceIds[0]
	);
	if (
		styleReference === undefined ||
		styleReference.usage !== 'style-only' ||
		!styleReference.appliesTo.presentationModes.includes('dependent-armour-piece') ||
		!styleReference.appliesTo.artifactRoles.includes('item')
	) {
		throw new Error('The v2 dependent-piece style reference is invalid');
	}
	return children.map((manifestTarget) => {
		const slot = manifestTarget.slot!;
		const output = {
			candidatePath: manifestTarget.output.candidatePath,
			provenanceResultPath: manifestTarget.output.provenanceResultPath
		};
		const target = EquipmentV2ImageTargetSchema.parse({
			schemaVersion: 'equipment-image-target-v2',
			targetId: manifestTarget.targetId,
			productionId: input.manifest.productionId,
			profileId: profile.profileId,
			manifestCanonicalSha256: canonicalJsonSha256V2(input.manifest),
			allocationCanonicalSha256: canonicalJsonSha256V2(input.allocation),
			profileCanonicalSha256: canonicalJsonSha256V2(profile),
			profileAcceptanceCanonicalSha256: canonicalJsonSha256V2(acceptance),
			material: {
				id: manifestTarget.materialId,
				name: manifestTarget.materialName,
				family: manifestTarget.materialFamily,
				rank: manifestTarget.materialRank,
				craftsmanship: 'Standard'
			},
			equipment: {
				class: manifestTarget.equipmentClass,
				artifactRole: 'item',
				slot
			},
			classDirection: classDirection(profile, manifestTarget.equipmentClass),
			consistencySource: {
				targetId: sourceTarget.targetId,
				candidatePath: sourceTarget.output.candidatePath,
				candidateSha256: receipt.candidateSha256,
				reviewReceiptPath: gate.evidencePath,
				reviewReceiptCanonicalSha256: canonicalJsonSha256V2(receipt)
			},
			references: [
				{
					referenceId: 'accepted-full-set-source',
					path: sourceTarget.output.candidatePath,
					contentHash: receipt.candidateSha256,
					usage: 'continuity-source',
					purpose:
						'Authoritative accepted full-set source; preserve its exact material, silhouette language, palette, trim, fastenings, wear, ornament, and slot boundary.'
				},
				{
					referenceId: styleReference.referenceId,
					path: styleReference.path,
					contentHash: styleReference.contentHash,
					usage: styleReference.usage,
					purpose: styleReference.purpose
				}
			],
			presentation: {
				mode: 'dependent-armour-piece',
				subject: profile.dependentPiecePresentation.subject,
				composition: `${dependentComposition(slot)} ${profile.dependentPiecePresentation.composition}`,
				canvas: profile.dependentPiecePresentation.canvas,
				framing: profile.framing,
				continuityRequirements: profile.dependentPiecePresentation.continuityRequirements,
				negativeConstraints: profile.negativeConstraints
			},
			acceptanceCriteria: criteriaFor('dependent-armour-piece'),
			output
		});
		return {
			targetPath: packetPath(output.candidatePath, 'targets'),
			assignmentPath: packetPath(output.candidatePath, 'assignments'),
			target,
			assignment: assignmentFor(target, EQUIPMENT_V2_PACKET_ASSIGNED_AT)
		};
	});
}

export function renderEquipmentPromptV2(targetInput: unknown): string {
	const target = EquipmentV2ImageTargetSchema.parse(targetInput);
	const framing = target.presentation.framing;
	const references = target.references
		.map(
			(reference, index) =>
				`${index + 1}. ${reference.usage.toUpperCase()}: ${reference.path} [${reference.contentHash}] — ${reference.purpose}`
		)
		.join('\n');
	const modeInstruction =
		target.presentation.mode === 'complete-armour-set'
			? `Create one empty, self-supporting complete Armour set. ${target.presentation.composition} Interior: ${target.presentation.interior}. Show exactly ${target.presentation.requiredComponents.join(', ')}; Boots are one pair. Never show a body, mannequin, support figure, or black void figure.`
			: target.presentation.mode === 'dependent-armour-piece'
				? `${target.presentation.composition} Preserve ${target.presentation.continuityRequirements.join(', ')} from reference 1. Do not redesign the accepted full set.`
				: `Create exactly one ${target.classDirection.description}. ${target.presentation.composition}`;
	const classInstructions =
		target.presentation.mode === 'dependent-armour-piece'
			? [
					`Class: isolated ${target.equipment.class} ${target.equipment.slot} component.`,
					'Piece pose and proportions must follow the accepted continuity source, not the full-set camera.'
				]
			: [
					`Class: ${target.classDirection.description}.`,
					`Pose: ${target.classDirection.pose}.`,
					`Proportions: ${target.classDirection.proportionRules.join('; ')}.`
				];
	return [
		'Equipment image production prompt v2',
		`Target: ${target.targetId}`,
		...classInstructions,
		modeInstruction,
		`Material: ${target.material.name} (${target.material.family}, rank ${target.material.rank}), Standard craftsmanship (+0). The material supplies the only visible rank.`,
		`Framing: aim for ${framing.compositionTargetPercent}% clearance and never go below ${framing.hardMinimumPercent}%. Once ${framing.hardMinimumPercent}% is met, preserve the class pose over adding margin.`,
		`Canvas: ${target.presentation.canvas.width}x${target.presentation.canvas.height} ${target.presentation.canvas.mediaType}.`,
		'Render style: premium realistic painterly dark fantasy; grounded medieval construction; honest material response and wear; cold key light with restrained warm rim; midnight-charcoal ground with a restrained floor plane.',
		`Ordered references:\n${references}`,
		`Required checks: ${target.acceptanceCriteria.map(({ criterionId }) => criterionId).join(', ')}.`,
		`Forbid: ${target.presentation.negativeConstraints.join(', ')}.`,
		'Output exactly one candidate image with no text, labels, UI, borders, frames, logos, or watermarks.'
	].join('\n');
}

export async function validateEquipmentPacketV2(input: {
	readonly workspaceRoot: string;
	readonly manifest: EquipmentV2Manifest;
	readonly allocation: EquipmentV2Allocation;
	readonly profile: EquipmentV2Profile;
	readonly acceptance: EquipmentV2ProfileAcceptance;
	readonly target: unknown;
	readonly assignment: unknown;
}): Promise<{ readonly ownedPaths: [string, string]; readonly promptSha256: string }> {
	const target = EquipmentV2ImageTargetSchema.parse(input.target);
	const assignment = EquipmentV2ImageAssignmentSchema.parse(input.assignment);
	if (assignment.targetId !== target.targetId) throw new Error('V2 assignment target mismatch');
	if (canonicalJson(assignment.permittedOutputs) !== canonicalJson(target.output)) {
		throw new Error('V2 assignment outputs do not exactly match the target');
	}
	let expected: EquipmentV2Packet | undefined;
	if (target.consistencySource === null) {
		expected = buildRootEquipmentPacketsV2(input).find(
			(packet) => packet.target.targetId === target.targetId
		);
	} else {
		const receiptValue = await readEquipmentRepositoryJson(
			input.workspaceRoot,
			target.consistencySource.reviewReceiptPath
		);
		const receipt = EquipmentV2ArmourSourceReviewReceiptSchema.parse(receiptValue);
		if (
			receipt.decision !== 'accepted' ||
			canonicalJsonSha256V2(receipt) !== target.consistencySource.reviewReceiptCanonicalSha256
		) {
			throw new Error('V2 dependent packet receipt mismatch');
		}
		const sourcePacket = buildRootEquipmentPacketsV2(input).find(
			(packet) => packet.target.targetId === receipt.sourceTargetId
		);
		if (sourcePacket === undefined) throw new Error('V2 dependent packet source is not a root');
		const source = sourcePacket.target;
		const sourceResult = validateEquipmentResultV2({
			target: source,
			assignment: sourcePacket.assignment,
			result: await readEquipmentRepositoryJson(
				input.workspaceRoot,
				source.output.provenanceResultPath
			)
		});
		if (
			sourceResult.status !== 'candidate' ||
			sourceResult.targetId !== source.targetId ||
			sourceResult.candidateSha256 !== receipt.candidateSha256 ||
			canonicalJsonSha256V2(sourceResult) !== receipt.sourceResultCanonicalSha256
		) {
			throw new Error('V2 Armour receipt does not bind the exact source result');
		}
		expected = buildDependentArmourPacketsV2({ ...input, sourceTarget: source, receipt }).find(
			(packet) => packet.target.targetId === target.targetId
		);
	}
	if (
		expected === undefined ||
		canonicalJson(expected.target) !== canonicalJson(target) ||
		canonicalJson(expected.assignment) !== canonicalJson(assignment)
	) {
		throw new Error('V2 packet does not match the deterministic renderer');
	}
	for (const reference of target.references) {
		const bytes = await readEquipmentRepositoryFile(input.workspaceRoot, reference.path);
		if (byteSha256(bytes) !== reference.contentHash) {
			throw new Error(`V2 packet reference byte hash mismatch: ${reference.path}`);
		}
	}
	for (const ownedPath of [target.output.candidatePath, target.output.provenanceResultPath]) {
		if ((await equipmentRepositoryPathState(input.workspaceRoot, ownedPath)) !== 'absent') {
			throw new Error(`V2 assigned output already exists: ${ownedPath}`);
		}
	}
	return {
		ownedPaths: [target.output.candidatePath, target.output.provenanceResultPath],
		promptSha256: byteSha256(renderEquipmentPromptV2(target))
	};
}

export function validateEquipmentResultV2(input: {
	readonly target: unknown;
	readonly assignment: unknown;
	readonly result: unknown;
}): ReturnType<typeof EquipmentV2ImageResultSchema.parse> {
	const target = EquipmentV2ImageTargetSchema.parse(input.target);
	const assignment = EquipmentV2ImageAssignmentSchema.parse(input.assignment);
	const result = EquipmentV2ImageResultSchema.parse(input.result);
	if (
		assignment.targetId !== target.targetId ||
		result.targetId !== target.targetId ||
		result.assignmentId !== assignment.assignmentId ||
		result.resultId !== `result-${target.targetId}`
	) {
		throw new Error('V2 result identity does not bind the target and assignment');
	}
	if (canonicalJson(assignment.permittedOutputs) !== canonicalJson(target.output)) {
		throw new Error('V2 result assignment does not bind the target outputs');
	}
	const expectedPromptSha256 = byteSha256(renderEquipmentPromptV2(target));
	if (result.promptSha256 !== expectedPromptSha256) {
		throw new Error('V2 result prompt hash does not match the deterministic target prompt');
	}
	const expectedReferences = target.references.map(({ referenceId, path, contentHash }) => ({
		referenceId,
		path,
		contentHash
	}));
	if (canonicalJson(result.referenceInputs) !== canonicalJson(expectedReferences)) {
		throw new Error('V2 result references do not exactly bind the ordered target references');
	}
	const expectedCriterionIds = target.acceptanceCriteria.map(({ criterionId }) => criterionId);
	if (
		canonicalJson(result.findings.map(({ criterionId }) => criterionId)) !==
		canonicalJson(expectedCriterionIds)
	) {
		throw new Error('V2 result findings do not cover the target criteria in order');
	}
	const expectedWrittenPaths =
		result.status === 'failed'
			? [target.output.provenanceResultPath]
			: [target.output.candidatePath, target.output.provenanceResultPath];
	if (canonicalJson(result.writtenOutputPaths) !== canonicalJson(expectedWrittenPaths)) {
		throw new Error('V2 result written paths do not exactly match its assigned outputs');
	}
	if (
		result.candidate !== null &&
		(result.candidate.path !== target.output.candidatePath ||
			result.candidate.width !== target.presentation.canvas.width ||
			result.candidate.height !== target.presentation.canvas.height ||
			result.candidate.mediaType !== target.presentation.canvas.mediaType)
	) {
		throw new Error('V2 candidate metadata does not match the target output and canvas');
	}
	return result;
}

export async function assessEquipmentV2ContractReadiness(input: {
	readonly workspaceRoot: string;
	readonly checkedAt: string;
}): Promise<EquipmentV2ContractReadiness> {
	const blockers: Array<{ code: string; message: string; path?: string }> = [];
	try {
		const [manifestValue, allocationValue, profileValue, acceptanceValue] = await Promise.all([
			readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_MANIFEST_PATH),
			readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_ALLOCATION_PLAN_PATH),
			readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_VISUAL_PROFILE_PATH),
			readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH)
		]);
		const manifest = manifestValue as EquipmentV2Manifest;
		const allocation = allocationValue as EquipmentV2Allocation;
		const profile = EquipmentVisualProfileV2Schema.parse(profileValue);
		const acceptance = EquipmentV2ProfileAcceptanceSchema.parse(acceptanceValue);
		const packets = buildRootEquipmentPacketsV2({ manifest, allocation, profile, acceptance });
		for (const reference of profile.references) {
			const bytes = await readEquipmentRepositoryFile(input.workspaceRoot, reference.path);
			if (byteSha256(bytes) !== reference.contentHash) {
				throw new Error(`Reference byte hash mismatch: ${reference.path}`);
			}
		}
		if (packets.length !== 77) throw new Error('Expected 77 deterministic v2 root packets');
		for (const manifestTarget of manifest.targets) {
			for (const outputPath of [
				manifestTarget.output.candidatePath,
				manifestTarget.output.provenanceResultPath
			]) {
				if ((await equipmentRepositoryPathState(input.workspaceRoot, outputPath)) !== 'absent') {
					throw new Error(`Reserved v2 output already exists: ${outputPath}`);
				}
			}
		}
	} catch (error) {
		blockers.push({
			code: 'contract-input-invalid',
			message: error instanceof Error ? error.message : String(error)
		});
	}
	return EquipmentV2ContractReadinessSchema.parse({
		schemaVersion: 'equipment-image-contract-readiness-v2',
		productionId: 'material-equipment-v2',
		checkedAt: input.checkedAt,
		status: blockers.length === 0 ? 'ready-for-run-contract' : 'blocked',
		writesPerformed: 0,
		summary: {
			rootTargets: 77,
			rootAssignments: 77,
			gatedArmourPieces: 84,
			armourReviewGates: 21,
			maximumConcurrency: 16
		},
		activation: {
			included: false,
			imageGenerationAuthorized: false,
			nextRequiredGate: 'v2-run-specific-activation'
		},
		blockers
	});
}

import { createHash } from 'node:crypto';

export const EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH =
	'assets/equipment/experiments/material-equipment-v1/manifest.json' as const;
export const EQUIPMENT_MATERIAL_ALLOCATION_PLAN_PATH =
	'assets/equipment/experiments/material-equipment-v1/allocation-plan.json' as const;

const PRODUCTION_ID = 'material-equipment-v1' as const;
const PRODUCTION_ROOT = `assets/equipment/experiments/${PRODUCTION_ID}` as const;
const ARMOUR_PIECE_ORDER = ['head', 'torso', 'legs', 'boots'] as const;

type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
type MaterialFamily = 'metal' | 'wood' | 'hide-scale' | 'cloth-fibre';
type ArmourSlot = (typeof ARMOUR_PIECE_ORDER)[number];

interface MaterialDefinition {
	readonly materialId: string;
	readonly displayName: string;
	readonly family: MaterialFamily;
	readonly rank: Rank;
}

interface EquipmentProductionTarget {
	readonly targetId: string;
	readonly productionOrder: number;
	readonly productionWave: number;
	readonly materialId: string;
	readonly materialName: string;
	readonly materialFamily: MaterialFamily;
	readonly materialRank: Rank;
	readonly equipmentClass: string;
	readonly artifactId: string;
	readonly artifactRole: 'item' | 'set-source';
	readonly slot: ArmourSlot | null;
	readonly setId: string | null;
	readonly dependsOnTargetId: string | null;
	readonly status: 'planned';
	readonly output: {
		readonly candidatePath: string;
		readonly provenanceResultPath: string;
		readonly reviewEvidencePath: string;
	};
}

const RANKED_MATERIALS: ReadonlyArray<
	readonly [Rank, string, string, string, string, string, string, string, string]
> = [
	['F', 'copper', 'Copper', 'coarse-hide', 'Coarse Hide', 'hemp-weave', 'Hemp Weave', 'ash', 'Ash'],
	['E', 'iron', 'Iron', 'boiled-leather', 'Boiled Leather', 'wool', 'Wool', 'yew', 'Yew'],
	[
		'D',
		'steel',
		'Steel',
		'beast-scale',
		'Beast Scale',
		'layered-silk',
		'Layered Silk',
		'ironwood',
		'Ironwood'
	],
	[
		'C',
		'blacksteel',
		'Blacksteel',
		'chitin',
		'Chitin',
		'spellweave',
		'Spellweave',
		'heartwood',
		'Heartwood'
	],
	[
		'B',
		'skyiron',
		'Skyiron',
		'drakescale',
		'Drakescale',
		'moonweave',
		'Moonweave',
		'spiritwood',
		'Spiritwood'
	],
	[
		'A',
		'starmetal',
		'Starmetal',
		'wyrmscale',
		'Wyrmscale',
		'starcloth',
		'Starcloth',
		'living-branch',
		'Living Branch'
	],
	[
		'S',
		'sunsteel',
		'Sunsteel',
		'ancient-dragon-scale',
		'Ancient Dragon Scale',
		'fateweave',
		'Fateweave',
		'worldtree-limb',
		'Worldtree Limb'
	]
];

const STANDALONE_BY_FAMILY = {
	metal: ['sword', 'dagger', 'spear', 'axe', 'mace', 'shield'],
	wood: ['bow', 'staff'],
	'hide-scale': [],
	'cloth-fibre': []
} as const satisfies Record<MaterialFamily, readonly string[]>;

const ARMOUR_CLASS_BY_FAMILY = {
	metal: 'heavy-armour',
	wood: null,
	'hide-scale': 'light-armour',
	'cloth-fibre': 'robes'
} as const satisfies Record<MaterialFamily, string | null>;

function materialsByRank(): MaterialDefinition[][] {
	return RANKED_MATERIALS.map(
		([rank, metalId, metalName, hideId, hideName, clothId, clothName, woodId, woodName]) => [
			{ materialId: metalId, displayName: metalName, family: 'metal', rank },
			{ materialId: woodId, displayName: woodName, family: 'wood', rank },
			{ materialId: hideId, displayName: hideName, family: 'hide-scale', rank },
			{ materialId: clothId, displayName: clothName, family: 'cloth-fibre', rank }
		]
	);
}

function outputPaths(rank: Rank, materialId: string, artifactId: string) {
	const rankDirectory = rank.toLowerCase();
	const basename = `${artifactId}-v1`;
	return {
		candidatePath: `${PRODUCTION_ROOT}/candidates/${rankDirectory}/${materialId}/${basename}.png`,
		provenanceResultPath: `${PRODUCTION_ROOT}/results/${rankDirectory}/${materialId}/${basename}.json`,
		reviewEvidencePath: `${PRODUCTION_ROOT}/reviews/${rankDirectory}/${materialId}/${basename}.json`
	};
}

function targetId(materialId: string, artifactId: string): string {
	return `${PRODUCTION_ID}-${materialId}-${artifactId}-v1`;
}

function buildTargets(materials: readonly MaterialDefinition[]): EquipmentProductionTarget[] {
	const targets: EquipmentProductionTarget[] = [];
	for (const material of materials) {
		const productionWave = RANKED_MATERIALS.findIndex(([rank]) => rank === material.rank) + 1;
		for (const equipmentClass of STANDALONE_BY_FAMILY[material.family]) {
			const artifactId = equipmentClass;
			targets.push({
				targetId: targetId(material.materialId, artifactId),
				productionOrder: targets.length + 1,
				productionWave,
				materialId: material.materialId,
				materialName: material.displayName,
				materialFamily: material.family,
				materialRank: material.rank,
				equipmentClass,
				artifactId,
				artifactRole: 'item',
				slot: null,
				setId: null,
				dependsOnTargetId: null,
				status: 'planned',
				output: outputPaths(material.rank, material.materialId, artifactId)
			});
		}

		const armourClass = ARMOUR_CLASS_BY_FAMILY[material.family];
		if (armourClass === null) continue;
		const setId = `${material.materialId}-${armourClass}`;
		const sourceArtifactId = `${armourClass}-full-set`;
		const sourceTargetId = targetId(material.materialId, sourceArtifactId);
		targets.push({
			targetId: sourceTargetId,
			productionOrder: targets.length + 1,
			productionWave,
			materialId: material.materialId,
			materialName: material.displayName,
			materialFamily: material.family,
			materialRank: material.rank,
			equipmentClass: armourClass,
			artifactId: sourceArtifactId,
			artifactRole: 'set-source',
			slot: null,
			setId,
			dependsOnTargetId: null,
			status: 'planned',
			output: outputPaths(material.rank, material.materialId, sourceArtifactId)
		});
		for (const slot of ARMOUR_PIECE_ORDER) {
			const artifactId = `${armourClass}-${slot}`;
			targets.push({
				targetId: targetId(material.materialId, artifactId),
				productionOrder: targets.length + 1,
				productionWave,
				materialId: material.materialId,
				materialName: material.displayName,
				materialFamily: material.family,
				materialRank: material.rank,
				equipmentClass: armourClass,
				artifactId,
				artifactRole: 'item',
				slot,
				setId,
				dependsOnTargetId: sourceTargetId,
				status: 'planned',
				output: outputPaths(material.rank, material.materialId, artifactId)
			});
		}
	}
	return targets;
}

function assertUnique(values: readonly string[], label: string): void {
	if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}

function assertManifestInvariants(
	materials: readonly MaterialDefinition[],
	targets: readonly EquipmentProductionTarget[]
): void {
	if (materials.length !== 28)
		throw new Error(`Expected 28 materials, received ${materials.length}`);
	if (targets.length !== 161) throw new Error(`Expected 161 targets, received ${targets.length}`);
	assertUnique(
		targets.map((target) => target.targetId),
		'target ID'
	);
	for (const key of ['candidatePath', 'provenanceResultPath', 'reviewEvidencePath'] as const) {
		assertUnique(
			targets.map((target) => target.output[key]),
			key
		);
	}
	for (const target of targets) {
		for (const outputPath of Object.values(target.output)) {
			if (!outputPath.startsWith(`${PRODUCTION_ROOT}/`)) {
				throw new Error(`Output escapes Equipment production root: ${outputPath}`);
			}
		}
	}
	for (const source of targets.filter((target) => target.artifactRole === 'set-source')) {
		const index = targets.indexOf(source);
		const sequence = targets.slice(index, index + 5);
		if (
			sequence.length !== 5 ||
			sequence[0] !== source ||
			sequence.slice(1).some((target) => target.dependsOnTargetId !== source.targetId) ||
			sequence.slice(1).some((target, pieceIndex) => target.slot !== ARMOUR_PIECE_ORDER[pieceIndex])
		) {
			throw new Error(`Invalid full-set-first sequence for ${source.targetId}`);
		}
	}
}

export function buildEquipmentMaterialProductionManifest() {
	const rankGroups = materialsByRank();
	const materials = rankGroups.flat();
	const targets = buildTargets(materials);
	assertManifestInvariants(materials, targets);

	return {
		schemaVersion: 'equipment-material-production-manifest-v1' as const,
		productionId: PRODUCTION_ID,
		authoredDate: '2026-09-01' as const,
		status: 'planning' as const,
		sourceDocuments: [
			{
				wikiId: 'mechanics.equipment.materials',
				path: 'docs/wiki/mechanics/equipment/materials.md',
				purpose: 'Canonical material families and ranks'
			},
			{
				wikiId: 'mechanics.equipment.weapons',
				path: 'docs/wiki/mechanics/equipment/weapons.md',
				purpose: 'Canonical weapon classes and rank-bearing material mapping'
			},
			{
				wikiId: 'mechanics.equipment.armour-shields',
				path: 'docs/wiki/mechanics/equipment/armour-and-shields.md',
				purpose: 'Four-piece armour slots and full-set-first production rule'
			},
			{
				wikiId: 'mechanics.equipment',
				path: 'docs/wiki/mechanics/equipment/README.md',
				purpose: 'Candidate image budget and lifecycle boundary'
			}
		],
		armourPieceOrder: ARMOUR_PIECE_ORDER,
		lifecycle: {
			pieceGenerationRequiresReviewedSetSource: true,
			candidateDoesNotMeanApproved: true,
			approvedAndRuntimePathsReserved: false
		},
		summary: {
			materialCount: 28,
			targetCount: 161,
			isolatedItemImageCount: 140,
			fullSetConsistencyImageCount: 21,
			imagesPerRank: 23,
			imageCountByMaterialFamily: {
				metal: 77,
				wood: 14,
				'hide-scale': 35,
				'cloth-fibre': 35
			}
		},
		materials,
		targets
	};
}

export function serializeEquipmentMaterialProductionManifest(): string {
	return `${JSON.stringify(buildEquipmentMaterialProductionManifest(), null, '\t')}\n`;
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonicalize(child)])
		);
	}
	return value;
}

function canonicalJsonSha256(value: unknown): string {
	return createHash('sha256')
		.update(JSON.stringify(canonicalize(value)))
		.digest('hex');
}

export function buildEquipmentMaterialAllocationPlan() {
	const manifest = buildEquipmentMaterialProductionManifest();
	const sourceTargets = manifest.targets.filter((target) => target.artifactRole === 'set-source');
	const reviewGates = sourceTargets.map((source) => ({
		gateId: `${source.targetId}-review-pass`,
		sourceTargetId: source.targetId,
		initialStatus: 'pending' as const,
		acceptanceRequirement: 'human-accepted-hash-bound-source-receipt' as const,
		fileExistenceDoesNotPass: true as const,
		receiptSchemaRequiredBeforeActivation: 'equipment-armour-source-review-receipt-v1' as const,
		evidencePath: source.output.reviewEvidencePath,
		unlocksTargetIds: manifest.targets
			.filter((target) => target.dependsOnTargetId === source.targetId)
			.map((target) => target.targetId)
	}));
	const reviewGateBySource = new Map(
		reviewGates.map((gate) => [gate.sourceTargetId, gate.gateId] as const)
	);
	const jobs = manifest.targets.map((target) => ({
		jobId: `job-${target.targetId}`,
		targetId: target.targetId,
		productionOrder: target.productionOrder,
		productionWave: target.productionWave,
		phase: target.dependsOnTargetId === null ? ('independent' as const) : ('armour-piece' as const),
		consistencySourceTargetId: target.dependsOnTargetId,
		executionEnvelopeMaterialization:
			target.dependsOnTargetId === null
				? ('before-root-dispatch' as const)
				: ('after-review-receipt-hash-is-known' as const),
		prerequisiteReviewGateId:
			target.dependsOnTargetId === null
				? null
				: (reviewGateBySource.get(target.dependsOnTargetId) ?? null),
		synchronousRetryCeiling: 0 as const,
		dryRun: false as const,
		permittedOutputs: {
			candidatePath: target.output.candidatePath,
			provenanceResultPath: target.output.provenanceResultPath
		},
		reviewEvidencePath: target.output.reviewEvidencePath
	}));
	const initiallyReadyJobCount = jobs.filter((job) => job.phase === 'independent').length;
	const armourPieceJobCount = jobs.length - initiallyReadyJobCount;
	if (initiallyReadyJobCount !== 77 || armourPieceJobCount !== 84 || reviewGates.length !== 21) {
		throw new Error('Equipment allocation-plan dependency counts drifted from the approved matrix');
	}
	assertUnique(
		jobs.map((job) => job.jobId),
		'Equipment job ID'
	);
	assertUnique(
		jobs.flatMap((job) => [...Object.values(job.permittedOutputs), job.reviewEvidencePath]),
		'Equipment reserved path'
	);
	if (jobs.some((job) => job.phase === 'armour-piece' && job.prerequisiteReviewGateId === null)) {
		throw new Error('An Armour piece is missing its full-set review gate');
	}

	return {
		schemaVersion: 'equipment-material-allocation-plan-v1' as const,
		planId: 'material-equipment-v1-full-production-allocation' as const,
		productionId: PRODUCTION_ID,
		artifactRole: 'non-executable-allocation-template' as const,
		status: 'gated' as const,
		activation: {
			includedInTemplate: false as const,
			requiresSeparateHashBoundAuthorization: true as const,
			requiresRunSpecificImmutableCopy: true as const,
			prerequisites: [
				'approved-equipment-visual-profile',
				'equipment-job-runner-with-strict-schema-reader',
				'equipment-armour-source-review-receipt-schema',
				'run-specific-immutable-plan-and-journal',
				'provider-capacity-verification'
			] as const
		},
		sourceManifest: {
			path: EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH,
			canonicalSha256: canonicalJsonSha256(manifest)
		},
		schedulerIntent: {
			mode: 'dependency-aware-ready-queue' as const,
			logicalProductionRunCount: 1 as const,
			configuredMaximumConcurrency: 16 as const,
			admissionFormula:
				'min(16 - activeEquipmentWorkers, availableWorkerSlots, readyUnclaimedJobs)' as const,
			parallelWorkPolicy: 'no-voluntary-throttling-for-unrelated-work' as const,
			technicalFailureCircuitBreaker: {
				failureCountPerEpoch: 3 as const,
				action: 'stop-new-starts-drain-active-resume-with-backoff' as const,
				synchronousRetry: false as const
			}
		},
		ownership: {
			root: PRODUCTION_ROOT,
			workerOwnedOutputKinds: ['candidate', 'provenance-result'] as const,
			reviewerOwnedOutputKinds: ['review-evidence'] as const,
			exclusiveCreateRequired: true as const,
			forbiddenSharedPaths: [
				'assets/enemies',
				'packages/contracts/src/image-production.ts',
				'skills/summonlab-image-production'
			]
		},
		summary: {
			jobCount: jobs.length,
			initiallyReadyJobCount,
			armourPieceJobCount,
			armourReviewGateCount: reviewGates.length
		},
		reviewGates,
		jobs
	};
}

export function serializeEquipmentMaterialAllocationPlan(): string {
	return `${JSON.stringify(buildEquipmentMaterialAllocationPlan(), null, '\t')}\n`;
}

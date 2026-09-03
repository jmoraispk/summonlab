import { createHash } from 'node:crypto';

export const EQUIPMENT_V2_PRODUCTION_ID = 'material-equipment-v2' as const;
export const EQUIPMENT_V2_PRODUCTION_ROOT =
	`assets/equipment/experiments/${EQUIPMENT_V2_PRODUCTION_ID}` as const;
export const EQUIPMENT_V2_MANIFEST_PATH = `${EQUIPMENT_V2_PRODUCTION_ROOT}/manifest.json` as const;
export const EQUIPMENT_V2_ALLOCATION_PLAN_PATH =
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/allocation-plan.json` as const;

const ARMOUR_PIECE_ORDER = ['head', 'torso', 'legs', 'boots'] as const;
const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;

type Rank = (typeof RANKS)[number];
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

const MATERIALS_BY_RANK = [
	[
		{ materialId: 'bronze', displayName: 'Bronze', family: 'metal', rank: 'F' },
		{ materialId: 'ash', displayName: 'Ash', family: 'wood', rank: 'F' },
		{ materialId: 'coarse-hide', displayName: 'Coarse Hide', family: 'hide-scale', rank: 'F' },
		{ materialId: 'hemp-weave', displayName: 'Hemp Weave', family: 'cloth-fibre', rank: 'F' }
	],
	[
		{ materialId: 'iron', displayName: 'Iron', family: 'metal', rank: 'E' },
		{ materialId: 'yew', displayName: 'Yew', family: 'wood', rank: 'E' },
		{ materialId: 'hard-leather', displayName: 'Hard Leather', family: 'hide-scale', rank: 'E' },
		{ materialId: 'wool', displayName: 'Wool', family: 'cloth-fibre', rank: 'E' }
	],
	[
		{ materialId: 'steel', displayName: 'Steel', family: 'metal', rank: 'D' },
		{ materialId: 'ironwood', displayName: 'Ironwood', family: 'wood', rank: 'D' },
		{ materialId: 'beast-scale', displayName: 'Beast Scale', family: 'hide-scale', rank: 'D' },
		{ materialId: 'layered-silk', displayName: 'Layered Silk', family: 'cloth-fibre', rank: 'D' }
	],
	[
		{ materialId: 'blacksteel', displayName: 'Blacksteel', family: 'metal', rank: 'C' },
		{ materialId: 'heartwood', displayName: 'Heartwood', family: 'wood', rank: 'C' },
		{ materialId: 'chitin', displayName: 'Chitin', family: 'hide-scale', rank: 'C' },
		{ materialId: 'spellweave', displayName: 'Spellweave', family: 'cloth-fibre', rank: 'C' }
	],
	[
		{ materialId: 'skyiron', displayName: 'Skyiron', family: 'metal', rank: 'B' },
		{ materialId: 'spiritwood', displayName: 'Spiritwood', family: 'wood', rank: 'B' },
		{ materialId: 'drakescale', displayName: 'Drakescale', family: 'hide-scale', rank: 'B' },
		{ materialId: 'moonweave', displayName: 'Moonweave', family: 'cloth-fibre', rank: 'B' }
	],
	[
		{ materialId: 'starmetal', displayName: 'Starmetal', family: 'metal', rank: 'A' },
		{ materialId: 'living-branch', displayName: 'Living Branch', family: 'wood', rank: 'A' },
		{ materialId: 'wyrmscale', displayName: 'Wyrmscale', family: 'hide-scale', rank: 'A' },
		{ materialId: 'starcloth', displayName: 'Starcloth', family: 'cloth-fibre', rank: 'A' }
	],
	[
		{ materialId: 'sunsteel', displayName: 'Sunsteel', family: 'metal', rank: 'S' },
		{ materialId: 'worldtree-limb', displayName: 'Worldtree Limb', family: 'wood', rank: 'S' },
		{
			materialId: 'ancient-dragon-scale',
			displayName: 'Ancient Dragon Scale',
			family: 'hide-scale',
			rank: 'S'
		},
		{ materialId: 'fateweave', displayName: 'Fateweave', family: 'cloth-fibre', rank: 'S' }
	]
] as const satisfies ReadonlyArray<ReadonlyArray<MaterialDefinition>>;

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

function outputPaths(rank: Rank, materialId: string, artifactId: string) {
	const basename = `${artifactId}-v2`;
	const materialRoot = `${rank.toLowerCase()}/${materialId}`;
	return {
		candidatePath: `${EQUIPMENT_V2_PRODUCTION_ROOT}/candidates/${materialRoot}/${basename}.png`,
		provenanceResultPath: `${EQUIPMENT_V2_PRODUCTION_ROOT}/results/${materialRoot}/${basename}.json`,
		reviewEvidencePath: `${EQUIPMENT_V2_PRODUCTION_ROOT}/reviews/${materialRoot}/${basename}.json`
	};
}

function targetId(materialId: string, artifactId: string): string {
	return `${EQUIPMENT_V2_PRODUCTION_ID}-${materialId}-${artifactId}-v2`;
}

function buildTargets(materials: readonly MaterialDefinition[]): EquipmentProductionTarget[] {
	const targets: EquipmentProductionTarget[] = [];
	for (const material of materials) {
		const productionWave = RANKS.indexOf(material.rank) + 1;
		for (const equipmentClass of STANDALONE_BY_FAMILY[material.family]) {
			targets.push({
				targetId: targetId(material.materialId, equipmentClass),
				productionOrder: targets.length + 1,
				productionWave,
				materialId: material.materialId,
				materialName: material.displayName,
				materialFamily: material.family,
				materialRank: material.rank,
				equipmentClass,
				artifactId: equipmentClass,
				artifactRole: 'item',
				slot: null,
				setId: null,
				dependsOnTargetId: null,
				status: 'planned',
				output: outputPaths(material.rank, material.materialId, equipmentClass)
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
	if (materials.length !== 28 || targets.length !== 161) {
		throw new Error(
			`Expected 28 materials and 161 targets; got ${materials.length}/${targets.length}`
		);
	}
	assertUnique(
		targets.map(({ targetId }) => targetId),
		'v2 target ID'
	);
	for (const key of ['candidatePath', 'provenanceResultPath', 'reviewEvidencePath'] as const) {
		assertUnique(
			targets.map((target) => target.output[key]),
			`v2 ${key}`
		);
	}
	for (const target of targets) {
		for (const outputPath of Object.values(target.output)) {
			if (!outputPath.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/`)) {
				throw new Error(`V2 output escapes its production root: ${outputPath}`);
			}
		}
	}
	for (const source of targets.filter(({ artifactRole }) => artifactRole === 'set-source')) {
		const index = targets.indexOf(source);
		const sequence = targets.slice(index, index + 5);
		if (
			sequence.length !== 5 ||
			sequence[0] !== source ||
			sequence.slice(1).some(({ dependsOnTargetId }) => dependsOnTargetId !== source.targetId) ||
			sequence.slice(1).some(({ slot }, pieceIndex) => slot !== ARMOUR_PIECE_ORDER[pieceIndex])
		) {
			throw new Error(`Invalid v2 full-set-first sequence for ${source.targetId}`);
		}
	}
}

export function buildEquipmentMaterialProductionManifestV2() {
	const materials = MATERIALS_BY_RANK.flat();
	const targets = buildTargets(materials);
	assertManifestInvariants(materials, targets);

	return {
		schemaVersion: 'equipment-material-production-manifest-v2' as const,
		productionId: EQUIPMENT_V2_PRODUCTION_ID,
		authoredDate: '2026-09-02' as const,
		status: 'planning' as const,
		revision: {
			previousProductionId: 'material-equipment-v1' as const,
			previousEvidenceIsImmutable: true as const,
			decisionRecordPath:
				'assets/equipment/experiments/material-equipment-v1/review-packets/material-equipment-v1-run-001/v2-revision-brief.md' as const,
			lockedVocabulary: ['Bronze', 'Ash', 'Hard Leather'] as const,
			standardAxeVariant: 'single-bit' as const,
			deferredAxeVariants: ['double-bit'] as const
		},
		sourceDocuments: [
			{
				wikiId: 'mechanics.equipment.materials',
				path: 'docs/wiki/mechanics/equipment/materials.md',
				purpose: 'Canonical material families, names, and ranks'
			},
			{
				wikiId: 'mechanics.equipment.weapons',
				path: 'docs/wiki/mechanics/equipment/weapons.md',
				purpose: 'Canonical weapon classes and visual comparison rules'
			},
			{
				wikiId: 'mechanics.equipment.armour-shields',
				path: 'docs/wiki/mechanics/equipment/armour-and-shields.md',
				purpose: 'Four-piece Armour slots, full-set sequence, and visual anchor'
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

export function buildEquipmentMaterialAllocationPlanV2() {
	const manifest = buildEquipmentMaterialProductionManifestV2();
	const sourceTargets = manifest.targets.filter(
		({ artifactRole }) => artifactRole === 'set-source'
	);
	const reviewGates = sourceTargets.map((source) => ({
		gateId: `${source.targetId}-review-pass`,
		sourceTargetId: source.targetId,
		initialStatus: 'pending' as const,
		acceptanceRequirement: 'human-accepted-hash-bound-source-receipt' as const,
		fileExistenceDoesNotPass: true as const,
		receiptSchemaRequiredBeforeActivation: 'equipment-armour-source-review-receipt-v2' as const,
		evidencePath: source.output.reviewEvidencePath,
		unlocksTargetIds: manifest.targets
			.filter(({ dependsOnTargetId }) => dependsOnTargetId === source.targetId)
			.map(({ targetId }) => targetId)
	}));
	const gateBySource = new Map(
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
				? ('after-v2-profile-acceptance' as const)
				: ('after-review-receipt-hash-is-known' as const),
		prerequisiteReviewGateId:
			target.dependsOnTargetId === null
				? null
				: (gateBySource.get(target.dependsOnTargetId) ?? null),
		synchronousRetryCeiling: 0 as const,
		dryRun: false as const,
		permittedOutputs: {
			candidatePath: target.output.candidatePath,
			provenanceResultPath: target.output.provenanceResultPath
		},
		reviewEvidencePath: target.output.reviewEvidencePath
	}));
	const initiallyReadyJobCount = jobs.filter(({ phase }) => phase === 'independent').length;
	const armourPieceJobCount = jobs.length - initiallyReadyJobCount;
	if (initiallyReadyJobCount !== 77 || armourPieceJobCount !== 84 || reviewGates.length !== 21) {
		throw new Error('V2 allocation dependency counts drifted from the approved 77/84/21 matrix');
	}
	assertUnique(
		jobs.map(({ jobId }) => jobId),
		'v2 job ID'
	);
	assertUnique(
		jobs.flatMap((job) => [...Object.values(job.permittedOutputs), job.reviewEvidencePath]),
		'v2 reserved path'
	);
	if (jobs.some((job) => job.phase === 'armour-piece' && job.prerequisiteReviewGateId === null)) {
		throw new Error('A v2 Armour piece is missing its full-set review gate');
	}

	return {
		schemaVersion: 'equipment-material-allocation-plan-v2' as const,
		planId: 'material-equipment-v2-full-production-allocation' as const,
		productionId: EQUIPMENT_V2_PRODUCTION_ID,
		artifactRole: 'non-executable-allocation-template' as const,
		status: 'gated' as const,
		activation: {
			includedInTemplate: false as const,
			requiresSeparateHashBoundAuthorization: true as const,
			requiresRunSpecificImmutableCopy: true as const,
			currentRunnerCompatible: false as const,
			prerequisites: [
				'accepted-equipment-visual-profile-v2',
				'equipment-v2-target-assignment-and-result-contracts',
				'equipment-v2-armour-source-review-receipt-schema',
				'run-specific-immutable-plan-and-journal',
				'provider-capacity-verification'
			] as const
		},
		sourceManifest: {
			path: EQUIPMENT_V2_MANIFEST_PATH,
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
			root: EQUIPMENT_V2_PRODUCTION_ROOT,
			workerOwnedOutputKinds: ['candidate', 'provenance-result'] as const,
			reviewerOwnedOutputKinds: ['review-evidence'] as const,
			exclusiveCreateRequired: true as const,
			forbiddenSharedPaths: [
				'assets/equipment/experiments/material-equipment-v1',
				'assets/enemies',
				'packages/contracts/src/image-production.ts',
				'skills/summonlab-image-production'
			] as const
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

export function serializeEquipmentMaterialProductionManifestV2(): string {
	return `${JSON.stringify(buildEquipmentMaterialProductionManifestV2(), null, '\t')}\n`;
}

export function serializeEquipmentMaterialAllocationPlanV2(): string {
	return `${JSON.stringify(buildEquipmentMaterialAllocationPlanV2(), null, '\t')}\n`;
}

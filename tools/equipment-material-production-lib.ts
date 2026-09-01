export const EQUIPMENT_MATERIAL_PRODUCTION_MANIFEST_PATH =
	'assets/equipment/experiments/material-equipment-v1/manifest.json' as const;

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

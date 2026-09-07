import {
	EquipmentRuntimeVisualManifestSchema,
	type EngineSnapshot,
	type EquipmentDefinition,
	type EquipmentMaterialId,
	type EquipmentRuntimeVisualAsset,
	type EquipmentRuntimeVisualManifest
} from '@summonlab/contracts';
import {
	EQUIPMENT_DEFINITIONS,
	EQUIPMENT_MATERIALS,
	getEquipmentDefinition
} from '@summonlab/content';
import { hashCanonical, legalActions, supportsEquipmentApi } from '@summonlab/engine';

import approvedSourceManifest from '../../../../../assets/equipment/approved/material-equipment-v1/manifest.json';
import runtimeVisualManifestSource from '../../../static/runtime/equipment-v1/manifest.json';

import { hashPublicProjection } from './public-projection-hash';

export interface EquipmentApprovedSourceRecord {
	readonly assetKey: string;
	readonly role: 'item' | 'armour-set-reference';
	readonly approved: {
		readonly path: string;
		readonly sha256: string;
	};
}

export interface EquipmentApprovedSourceManifest {
	readonly records: readonly EquipmentApprovedSourceRecord[];
}

export interface EquipmentRuntimeImage {
	readonly publicPath: string;
	readonly width: number;
	readonly height: number;
	readonly bytes: number;
	readonly contentHash: string;
}

export interface EquipmentVisualResolution {
	readonly sourceAssetKey: string;
	readonly card: EquipmentRuntimeImage;
	readonly detail: EquipmentRuntimeImage;
	readonly provenance: {
		readonly approvedPath: string;
		readonly sourceContentHash: string;
		readonly approvedSourceManifestHash: string;
		readonly runtimeManifestHash: string;
	};
}

export interface EquipmentWorkshopDefinitionView {
	readonly definitionId: string;
	readonly displayName: string;
	readonly materialId: EquipmentMaterialId;
	readonly materialName: string;
	readonly materialFamily: EquipmentDefinition['materialFamily'];
	readonly materialRank: EquipmentDefinition['materialRank'];
	readonly equipmentClass: EquipmentDefinition['equipmentClass'];
	readonly slot: EquipmentDefinition['slot'];
	readonly handedness: EquipmentDefinition['handedness'];
	readonly finalRank: EquipmentDefinition['materialRank'];
	readonly requiredLots: 1;
	readonly canForge: boolean;
	readonly card: EquipmentRuntimeImage;
}

export interface EquipmentWorkshopProjection {
	readonly schemaVersion: 'equipment-workshop-projection-v1';
	readonly runId: string;
	readonly heroId: string;
	readonly version: number;
	readonly eventCursor: number;
	readonly publicProjectionHash: string;
	readonly catalog: {
		readonly contentVersion: 'equipment-content-v1';
		readonly runtimeManifestHash: string;
		readonly initialEquipmentBinaryBytes: 0;
	};
	readonly workshop: {
		readonly powered: boolean;
		readonly assigned: boolean;
		readonly atForge: boolean;
	};
	readonly materials: readonly {
		readonly materialId: EquipmentMaterialId;
		readonly displayName: string;
		readonly family: EquipmentDefinition['materialFamily'];
		readonly rank: EquipmentDefinition['materialRank'];
		readonly lots: number;
	}[];
	readonly definitions: readonly EquipmentWorkshopDefinitionView[];
	readonly currentForging: null | {
		readonly definitionId: string;
		readonly displayName: string;
		readonly materialId: EquipmentMaterialId;
		readonly startedAt: string;
		readonly completesAt: string;
		readonly craftsmanship: 'standard';
		readonly finalRank: EquipmentDefinition['materialRank'];
		readonly card: EquipmentRuntimeImage;
	};
	readonly inventory: readonly {
		readonly itemId: string;
		readonly definitionId: string;
		readonly displayName: string;
		readonly materialName: string;
		readonly equipmentClass: EquipmentDefinition['equipmentClass'];
		readonly slot: EquipmentDefinition['slot'];
		readonly finalRank: EquipmentDefinition['materialRank'];
		readonly craftsmanship: 'standard' | 'fine' | 'masterwork';
		readonly equipped: boolean;
		readonly canEquip: boolean;
		readonly origin: string;
		readonly card: EquipmentRuntimeImage;
	}[];
	readonly loadout: Readonly<
		Record<'main-hand' | 'off-hand' | 'head' | 'torso' | 'legs' | 'boots', string | null>
	>;
	readonly inspection:
		| null
		| (EquipmentWorkshopDefinitionView & {
				readonly detail: EquipmentRuntimeImage;
				readonly provenance: EquipmentVisualResolution['provenance'];
		  });
}

function checkedRuntimeManifest(source: EquipmentRuntimeVisualManifest | unknown) {
	const manifest = EquipmentRuntimeVisualManifestSchema.parse(source);
	const { manifestHash, ...manifestBody } = manifest;
	if (hashCanonical(manifestBody) !== manifestHash) {
		throw new Error('Equipment runtime manifest hash is stale');
	}
	return manifest;
}

const runtimeVisualManifest = checkedRuntimeManifest(runtimeVisualManifestSource);
const approvedManifest = approvedSourceManifest as EquipmentApprovedSourceManifest;
const materialById = new Map(
	EQUIPMENT_MATERIALS.map((material) => [material.materialId, material] as const)
);

function runtimeImage(asset: EquipmentRuntimeVisualAsset): EquipmentRuntimeImage {
	return {
		publicPath: asset.publicPath,
		width: asset.width,
		height: asset.height,
		bytes: asset.bytes,
		contentHash: asset.contentHash
	};
}

export function resolveEquipmentVisual(
	sourceAssetKey: string,
	options: {
		readonly runtimeManifest?: EquipmentRuntimeVisualManifest | unknown;
		readonly approvedManifest?: EquipmentApprovedSourceManifest;
	} = {}
): EquipmentVisualResolution {
	const runtime = checkedRuntimeManifest(options.runtimeManifest ?? runtimeVisualManifest);
	const approved = options.approvedManifest ?? approvedManifest;
	const source = approved.records.find((record) => record.assetKey === sourceAssetKey);
	if (!source) throw new Error(`Equipment approved source is missing: ${sourceAssetKey}`);
	if (source.role !== 'item') {
		throw new Error(
			`Armour-set-reference keys cannot resolve as Equipment items: ${sourceAssetKey}`
		);
	}
	const bundle = runtime.bundles.find((candidate) => candidate.sourceAssetKey === sourceAssetKey);
	if (!bundle) throw new Error(`Equipment runtime bundle is missing: ${sourceAssetKey}`);
	const card = bundle.assets.find((asset) => asset.usage === 'card');
	const detail = bundle.assets.find((asset) => asset.usage === 'detail');
	if (!card || !detail)
		throw new Error(`Equipment runtime aliases are incomplete: ${sourceAssetKey}`);
	if (
		card.alias !== `equipment.${sourceAssetKey}.card` ||
		detail.alias !== `equipment.${sourceAssetKey}.detail`
	) {
		throw new Error(`Equipment runtime aliases are stale: ${sourceAssetKey}`);
	}
	if (
		card.sourceContentHash !== source.approved.sha256 ||
		detail.sourceContentHash !== source.approved.sha256 ||
		card.sourceApprovedPath !== source.approved.path ||
		detail.sourceApprovedPath !== source.approved.path
	) {
		throw new Error(`Equipment runtime source hash drifted: ${sourceAssetKey}`);
	}
	return {
		sourceAssetKey,
		card: runtimeImage(card),
		detail: runtimeImage(detail),
		provenance: {
			approvedPath: source.approved.path,
			sourceContentHash: source.approved.sha256,
			approvedSourceManifestHash: runtime.approvedSource.manifestContentHash,
			runtimeManifestHash: runtime.manifestHash
		}
	};
}

function definitionView(
	definition: Readonly<EquipmentDefinition>,
	canForge: boolean,
	runtime: EquipmentRuntimeVisualManifest,
	approved: EquipmentApprovedSourceManifest
): EquipmentWorkshopDefinitionView {
	const material = materialById.get(definition.materialId);
	if (!material) throw new Error(`Equipment material is missing: ${definition.materialId}`);
	const visual = resolveEquipmentVisual(definition.approvedVisualAssetKey, {
		runtimeManifest: runtime,
		approvedManifest: approved
	});
	return {
		definitionId: definition.definitionId,
		displayName: definition.displayName,
		materialId: definition.materialId,
		materialName: material.displayName,
		materialFamily: definition.materialFamily,
		materialRank: definition.materialRank,
		equipmentClass: definition.equipmentClass,
		slot: definition.slot,
		handedness: definition.handedness,
		finalRank: definition.materialRank,
		requiredLots: 1,
		canForge,
		card: visual.card
	};
}

export function projectEquipmentWorkshop(
	snapshot: EngineSnapshot,
	heroId: string,
	options: {
		readonly inspectDefinitionId?: string | null;
		readonly runtimeManifest?: EquipmentRuntimeVisualManifest | unknown;
		readonly approvedManifest?: EquipmentApprovedSourceManifest;
	} = {}
): EquipmentWorkshopProjection {
	if (!supportsEquipmentApi(snapshot.state)) {
		throw new Error(
			`Equipment workshop requires engine-v24, received v${snapshot.state.schemaVersion}`
		);
	}
	const state = snapshot.state;
	const hero = state.heroes[heroId];
	if (!hero) throw new Error(`Equipment workshop hero is missing: ${heroId}`);
	const runtime = checkedRuntimeManifest(options.runtimeManifest ?? runtimeVisualManifest);
	const approved = options.approvedManifest ?? approvedManifest;
	const actionIds = new Set(legalActions(state, heroId).map((action) => action.actionId));
	const materials = EQUIPMENT_MATERIALS.filter(
		(material) => state.settlement.materialLots[material.materialId] > 0
	).map((material) => ({
		materialId: material.materialId,
		displayName: material.displayName,
		family: material.family,
		rank: material.rank,
		lots: state.settlement.materialLots[material.materialId]
	}));
	const ownedMaterialIds = new Set(materials.map((material) => material.materialId));
	if (hero.currentForging) ownedMaterialIds.add(hero.currentForging.materialId);
	const definitions = EQUIPMENT_DEFINITIONS.filter((definition) =>
		ownedMaterialIds.has(definition.materialId)
	)
		.map((definition) =>
			definitionView(
				definition,
				actionIds.has(`hero.forge.${definition.definitionId}`),
				runtime,
				approved
			)
		)
		.sort(
			(left, right) =>
				left.materialRank.localeCompare(right.materialRank) ||
				left.displayName.localeCompare(right.displayName)
		);
	const itemViews = Object.values(state.items)
		.filter((item) => item.ownerId === heroId)
		.map((item) => {
			const definition = getEquipmentDefinition(item.definitionId);
			if (!definition) throw new Error(`Equipment definition is missing: ${item.definitionId}`);
			const material = materialById.get(definition.materialId)!;
			const visual = resolveEquipmentVisual(definition.approvedVisualAssetKey, {
				runtimeManifest: runtime,
				approvedManifest: approved
			});
			const origin =
				item.origin.kind === 'forged'
					? `Forged · event ${item.origin.forgeEventId.slice(0, 8)} · crafter ${item.origin.crafterId.slice(0, 8)}`
					: item.origin.kind === 'dropped'
						? `Dropped · ${item.origin.missionId} / ${item.origin.sourceId}`
						: `Legacy issue · ${item.origin.legacyTemplateId.replaceAll('-', ' ')}`;
			return {
				itemId: item.itemId,
				definitionId: definition.definitionId,
				displayName: definition.displayName,
				materialName: material.displayName,
				equipmentClass: definition.equipmentClass,
				slot: definition.slot,
				finalRank: item.finalRank,
				craftsmanship: item.craftsmanship.label,
				equipped: item.equippedById === heroId,
				canEquip: actionIds.has(`hero.equip.${item.itemId}`),
				origin,
				card: visual.card
			};
		})
		.sort((left, right) => left.displayName.localeCompare(right.displayName));
	const loadout = {
		'main-hand': hero.equipment.mainHand,
		'off-hand': hero.equipment.offHand,
		head: hero.equipment.head,
		torso: hero.equipment.torso,
		legs: hero.equipment.legs,
		boots: hero.equipment.boots
	};
	const currentDefinition = hero.currentForging
		? getEquipmentDefinition(hero.currentForging.definitionId)
		: undefined;
	const currentForging =
		hero.currentForging && currentDefinition
			? {
					definitionId: currentDefinition.definitionId,
					displayName: currentDefinition.displayName,
					materialId: currentDefinition.materialId,
					startedAt: hero.currentForging.startedAt,
					completesAt: hero.currentForging.completesAt,
					craftsmanship: 'standard' as const,
					finalRank: currentDefinition.materialRank,
					card: resolveEquipmentVisual(currentDefinition.approvedVisualAssetKey, {
						runtimeManifest: runtime,
						approvedManifest: approved
					}).card
				}
			: null;
	const inspected = options.inspectDefinitionId
		? getEquipmentDefinition(options.inspectDefinitionId)
		: undefined;
	if (options.inspectDefinitionId && !inspected) {
		throw new Error(`Equipment inspection definition is missing: ${options.inspectDefinitionId}`);
	}
	const inspectedView = inspected
		? definitionView(
				inspected,
				actionIds.has(`hero.forge.${inspected.definitionId}`),
				runtime,
				approved
			)
		: null;
	const inspectedVisual = inspected
		? resolveEquipmentVisual(inspected.approvedVisualAssetKey, {
				runtimeManifest: runtime,
				approvedManifest: approved
			})
		: null;
	const workshop = state.settlement.buildings.workshop;
	const publicFields = {
		schemaVersion: 'equipment-workshop-projection-v1',
		runId: state.runId,
		heroId,
		version: state.version,
		eventCursor: state.eventCursor,
		catalog: {
			contentVersion: 'equipment-content-v1',
			runtimeManifestHash: runtime.manifestHash,
			initialEquipmentBinaryBytes: 0
		},
		workshop: {
			powered: state.settlement.forgeSystemPower === 'powered',
			assigned: workshop?.assignedHeroIds.includes(heroId) ?? false,
			atForge:
				hero.location === 'workshop' &&
				hero.locationNodeId === 'workshop-forge' &&
				hero.assignment?.buildingId === 'workshop'
		},
		materials,
		definitions,
		currentForging,
		inventory: itemViews,
		loadout,
		inspection:
			inspectedView && inspectedVisual
				? {
						...inspectedView,
						detail: inspectedVisual.detail,
						provenance: inspectedVisual.provenance
					}
				: null
	} as const;
	return {
		...publicFields,
		publicProjectionHash: hashPublicProjection('equipment-workshop', publicFields)
	};
}

import {
	HEARTH_01_DEFINITION,
	EQUIPMENT_DEFINITION_CATALOG,
	getEquipmentDefinition,
	IRON_MOON_PACKAGE,
	TOWER_BAND_01_EQUIPMENT_DROP_FIXTURE,
	TOWER_BAND_01_RUNTIME_PACKAGES,
	TOWER_BAND_01_STORY_ENVELOPE,
	TOWER_FLOOR_01_PACKAGE
} from '@summonlab/content';
import type {
	EngineGameState,
	EngineGameStateV24,
	EquipmentDefinition,
	EquipmentLoadoutSlot,
	EquipmentRank,
	MissionEquipmentDropFixture,
	MissionPackage,
	SettlementDefinition
} from '@summonlab/contracts';

import { ReplayIntegrityError } from '../errors.js';
import { deterministicUuid, hashCanonical, sha256Hex } from '../hash.js';

type NavigationState = Extract<
	EngineGameState,
	{
		schemaVersion:
			| 3
			| 4
			| 5
			| 6
			| 7
			| 8
			| 9
			| 10
			| 11
			| 12
			| 13
			| 14
			| 15
			| 16
			| 17
			| 18
			| 19
			| 20
			| 21
			| 22
			| 23
			| 24;
	}
>;
type MissionState = Extract<
	EngineGameState,
	{ schemaVersion: 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 }
>;

let verifiedSettlement: SettlementDefinition | undefined;
const verifiedMissions = new Map<string, MissionPackage>();
let verifiedBandStory: typeof TOWER_BAND_01_STORY_ENVELOPE | undefined;
let verifiedEquipment = false;
let verifiedEquipmentDropFixture: MissionEquipmentDropFixture | undefined;
const EQUIPMENT_RANKS = Object.freeze(['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const);

function verifyEquipmentCatalog(): void {
	if (verifiedEquipment) return;
	const { contentHash } = EQUIPMENT_DEFINITION_CATALOG;
	const calculatedHash = sha256Hex(JSON.stringify(EQUIPMENT_DEFINITION_CATALOG.definitions));
	if (calculatedHash !== contentHash) {
		throw new Error(
			`Equipment content hash drifted: expected ${contentHash}, calculated ${calculatedHash}`
		);
	}
	verifiedEquipment = true;
}

export function verifiedEquipmentDefinition(definitionId: string): Readonly<EquipmentDefinition> {
	verifyEquipmentCatalog();
	const definition = getEquipmentDefinition(definitionId);
	if (!definition) throw new Error(`Equipment content is unavailable: ${definitionId}`);
	return definition;
}

export function verifiedEquipmentCatalogBinding(): Readonly<{
	contentVersion: 'equipment-content-v1';
	contentHash: string;
}> {
	verifyEquipmentCatalog();
	return Object.freeze({
		contentVersion: EQUIPMENT_DEFINITION_CATALOG.contentVersion,
		contentHash: EQUIPMENT_DEFINITION_CATALOG.contentHash
	});
}

export function verifiedMissionEquipmentDropFixture(): Readonly<MissionEquipmentDropFixture> {
	if (verifiedEquipmentDropFixture) return verifiedEquipmentDropFixture;
	const fixture = TOWER_BAND_01_EQUIPMENT_DROP_FIXTURE;
	const { contentHash, ...payload } = fixture;
	if (hashCanonical(payload) !== contentHash) {
		throw new Error(
			`Equipment drop fixture hash drifted: expected ${contentHash}, calculated ${hashCanonical(payload)}`
		);
	}
	const mission = verifiedMissionContent(fixture.missionId);
	if (!mission.monsterDuties.some((duty) => duty.dutySlotId === fixture.sourceId)) {
		throw new Error(`Equipment drop source is unavailable: ${fixture.sourceId}`);
	}
	verifiedEquipmentDefinition(fixture.definitionId);
	verifiedEquipmentDropFixture = fixture;
	return verifiedEquipmentDropFixture;
}

export function equipmentRankWithBonus(baseRank: EquipmentRank, bonus: 0 | 1 | 2): EquipmentRank {
	const baseIndex = EQUIPMENT_RANKS.indexOf(baseRank);
	return EQUIPMENT_RANKS[Math.min(EQUIPMENT_RANKS.length - 1, baseIndex + bonus)]!;
}

function equipmentItemDefinition(
	state: EngineGameStateV24,
	itemId: string
): Readonly<EquipmentDefinition> | undefined {
	const item = state.items[itemId];
	return item ? verifiedEquipmentDefinition(item.definitionId) : undefined;
}

export function equipmentSlotIsLegal(
	state: EngineGameStateV24,
	heroId: string,
	definition: Readonly<EquipmentDefinition>,
	targetSlot: EquipmentLoadoutSlot
): boolean {
	if (definition.handedness === 'none') return targetSlot === definition.slot;
	if (definition.equipmentClass === 'shield') {
		if (targetSlot !== 'off-hand') return false;
		const mainId = state.heroes[heroId]?.equipment.mainHand;
		const main = mainId ? equipmentItemDefinition(state, mainId) : undefined;
		return main?.handedness !== 'two-handed';
	}
	if (definition.handedness === 'two-handed') return targetSlot === 'main-hand';
	if (targetSlot === 'main-hand') {
		const offId = state.heroes[heroId]?.equipment.offHand;
		const off = offId ? equipmentItemDefinition(state, offId) : undefined;
		return (
			!off ||
			off.equipmentClass === 'shield' ||
			(['sword', 'dagger'].includes(definition.equipmentClass) &&
				['sword', 'dagger'].includes(off.equipmentClass))
		);
	}
	if (targetSlot !== 'off-hand' || !['sword', 'dagger'].includes(definition.equipmentClass)) {
		return false;
	}
	const mainId = state.heroes[heroId]?.equipment.mainHand;
	const main = mainId ? equipmentItemDefinition(state, mainId) : undefined;
	return Boolean(main && ['sword', 'dagger'].includes(main.equipmentClass));
}

export function validateEquipmentStateContent(state: EngineGameStateV24): void {
	for (const item of Object.values(state.items)) {
		const definition = verifiedEquipmentDefinition(item.definitionId);
		if (
			equipmentRankWithBonus(definition.materialRank, item.craftsmanship.bonus) !== item.finalRank
		) {
			throw new ReplayIntegrityError(
				'Equipment final rank diverged from content',
				state.eventCursor
			);
		}
	}
	for (const hero of Object.values(state.heroes)) {
		const job = hero.currentForging;
		if (job) {
			const definition = verifiedEquipmentDefinition(job.definitionId);
			const binding = verifiedEquipmentCatalogBinding();
			if (
				definition.forgeable !== true ||
				definition.materialId !== job.materialId ||
				job.recipe.definitionId !== definition.definitionId ||
				job.recipe.material.materialId !== definition.materialId ||
				job.recipe.material.lots !== 1 ||
				job.recipe.craftsmanship.label !== 'standard' ||
				job.recipe.craftsmanship.bonus !== 0 ||
				job.catalogContentVersion !== binding.contentVersion ||
				job.catalogContentHash !== binding.contentHash ||
				job.itemId !== deterministicUuid(`${job.forgeEventId}:forged-item`) ||
				state.items[job.itemId] !== undefined
			) {
				throw new ReplayIntegrityError(
					'Forging job diverged from equipment content',
					state.eventCursor
				);
			}
		}
		for (const [slot, itemId] of Object.entries(hero.equipment)) {
			if (!itemId) continue;
			const definition = equipmentItemDefinition(state, itemId);
			const targetSlot = slot === 'mainHand' ? 'main-hand' : slot === 'offHand' ? 'off-hand' : slot;
			if (
				!definition ||
				!equipmentSlotIsLegal(state, hero.heroId, definition, targetSlot as EquipmentLoadoutSlot)
			) {
				throw new ReplayIntegrityError(
					'Equipment loadout diverged from content',
					state.eventCursor
				);
			}
		}
	}
}

export function verifiedStoryEnvelope(): typeof TOWER_BAND_01_STORY_ENVELOPE {
	if (verifiedBandStory) return verifiedBandStory;
	const { contentHash, ...payload } = TOWER_BAND_01_STORY_ENVELOPE;
	const calculatedHash = hashCanonical(payload);
	if (calculatedHash !== contentHash) {
		throw new Error(
			`First-band story hash drifted: expected ${contentHash}, calculated ${calculatedHash}`
		);
	}
	verifiedBandStory = TOWER_BAND_01_STORY_ENVELOPE;
	return verifiedBandStory;
}

export function verifiedSettlementContent(): SettlementDefinition {
	if (verifiedSettlement) return verifiedSettlement;
	const { contentHash, ...payload } = HEARTH_01_DEFINITION;
	const calculatedHash = hashCanonical(payload);
	if (calculatedHash !== contentHash) {
		throw new Error(
			`Hearth 01 content hash drifted: expected ${contentHash}, calculated ${calculatedHash}`
		);
	}
	verifiedSettlement = HEARTH_01_DEFINITION;
	return verifiedSettlement;
}

export function verifiedMissionContent(
	missionId = TOWER_FLOOR_01_PACKAGE.missionId
): MissionPackage {
	const cached = verifiedMissions.get(missionId);
	if (cached) return cached;
	const mission =
		missionId === IRON_MOON_PACKAGE.missionId
			? IRON_MOON_PACKAGE.mission
			: TOWER_BAND_01_RUNTIME_PACKAGES.find((candidate) => candidate.missionId === missionId);
	if (!mission) throw new Error(`Mission content is unavailable: ${missionId}`);
	const { contentHash, ...payload } = mission;
	const calculatedHash = hashCanonical(payload);
	if (calculatedHash !== contentHash) {
		throw new Error(
			`${missionId} content hash drifted: expected ${contentHash}, calculated ${calculatedHash}`
		);
	}
	if (missionId === IRON_MOON_PACKAGE.missionId) {
		const { contentHash: portalHash, ...portalPayload } = IRON_MOON_PACKAGE;
		const calculatedPortalHash = hashCanonical(portalPayload);
		if (calculatedPortalHash !== portalHash) {
			throw new Error(
				`${missionId} portal content hash drifted: expected ${portalHash}, calculated ${calculatedPortalHash}`
			);
		}
	}
	verifiedMissions.set(missionId, mission);
	return mission;
}

export function verifiedMissionBinding(missionId: string) {
	const mission = verifiedMissionContent(missionId);
	return {
		missionId,
		contentVersion: mission.contentVersion,
		contentHash:
			missionId === IRON_MOON_PACKAGE.missionId
				? IRON_MOON_PACKAGE.contentHash
				: mission.contentHash
	};
}

export function settlementForState(state: NavigationState): SettlementDefinition {
	const definition = verifiedSettlementContent();
	const binding = state.settlement.navigation;
	if (
		binding.settlementId !== definition.settlementId ||
		binding.contentVersion !== definition.contentVersion ||
		binding.contentHash !== definition.contentHash
	) {
		throw new ReplayIntegrityError('Settlement content binding is unavailable', state.eventCursor);
	}
	return definition;
}

export function missionContentForState(state: MissionState): MissionPackage {
	const mission = verifiedMissionContent(state.mission.binding.missionId);
	const binding = verifiedMissionBinding(state.mission.binding.missionId);
	if (
		state.mission.binding.missionId !== binding.missionId ||
		state.mission.binding.contentVersion !== binding.contentVersion ||
		state.mission.binding.contentHash !== binding.contentHash
	) {
		throw new ReplayIntegrityError('Mission content binding is unavailable', state.eventCursor);
	}
	return mission;
}

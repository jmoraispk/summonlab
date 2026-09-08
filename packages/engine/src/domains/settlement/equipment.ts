import {
	EngineGameStateV24Schema,
	EngineGameStateV25Schema,
	EngineGameStateV26Schema,
	type EngineEquipmentItemStateV24,
	type EngineGameStateV24,
	type EngineGameStateV25,
	type EngineGameStateV26,
	type EquipmentLoadoutSlot
} from '@summonlab/contracts';

import { ReplayIntegrityError } from '../../errors.js';
import { equipmentSlotIsLegal, verifiedEquipmentDefinition } from '../../core/content-bindings.js';
import { createEquipmentItem } from '../../core/equipment.js';

export { createEquipmentItem } from '../../core/equipment.js';
export type { CreateEquipmentItemInput } from '../../core/equipment.js';

export { validateEquipmentStateContent } from '../../core/content-bindings.js';

export const LEGACY_EQUIPMENT_TEMPLATE_BINDINGS = Object.freeze({
	'practice-blade': Object.freeze({
		definitionId: 'equipment-bronze-sword',
		approvedVisualAssetKey: 'equipment-v1-f-bronze-sword'
	}),
	'short-bow': Object.freeze({
		definitionId: 'equipment-ash-bow',
		approvedVisualAssetKey: 'equipment-v1-f-ash-bow'
	})
} as const);

export interface EquipEquipmentItemInput {
	readonly heroId: string;
	readonly itemId: string;
	readonly targetSlot?: EquipmentLoadoutSlot;
}

type EquipmentGameState = EngineGameStateV24 | EngineGameStateV25 | EngineGameStateV26;

export function equipmentItemDisplayName(
	item: EngineGameStateV24['items'][string] | { readonly displayName: string }
): string {
	return 'displayName' in item
		? item.displayName
		: verifiedEquipmentDefinition(item.definitionId).displayName;
}

export function adaptLegacyEquipmentItem(input: {
	readonly itemId: string;
	readonly templateId: keyof typeof LEGACY_EQUIPMENT_TEMPLATE_BINDINGS;
	readonly ownerId: string;
	readonly equippedById: string | null;
	readonly durability: number;
	readonly maxDurability: number;
}): EngineEquipmentItemStateV24 {
	return createEquipmentItem({
		itemId: input.itemId,
		definitionId: LEGACY_EQUIPMENT_TEMPLATE_BINDINGS[input.templateId].definitionId,
		ownerId: input.ownerId,
		equippedById: input.equippedById,
		craftsmanship: { label: 'standard', bonus: 0 },
		durability: input.durability,
		maxDurability: input.maxDurability,
		origin: { kind: 'legacy', legacyTemplateId: input.templateId }
	});
}

function loadoutKey(
	slot: EquipmentLoadoutSlot
): keyof EngineGameStateV24['heroes'][string]['equipment'] {
	if (slot === 'main-hand') return 'mainHand';
	if (slot === 'off-hand') return 'offHand';
	return slot;
}

export function equipEquipmentItem(
	stateInput: EngineGameStateV24,
	input: EquipEquipmentItemInput
): EngineGameStateV24;
export function equipEquipmentItem(
	stateInput: EngineGameStateV25,
	input: EquipEquipmentItemInput
): EngineGameStateV25;
export function equipEquipmentItem(
	stateInput: EngineGameStateV26,
	input: EquipEquipmentItemInput
): EngineGameStateV26;
export function equipEquipmentItem(
	stateInput: EquipmentGameState,
	input: EquipEquipmentItemInput
): EquipmentGameState;
export function equipEquipmentItem(
	stateInput: EquipmentGameState,
	input: EquipEquipmentItemInput
): EquipmentGameState {
	const state =
		stateInput.schemaVersion === 26
			? EngineGameStateV26Schema.parse(stateInput)
			: stateInput.schemaVersion === 25
				? EngineGameStateV25Schema.parse(stateInput)
				: EngineGameStateV24Schema.parse(stateInput);
	const hero = state.heroes[input.heroId];
	const item = state.items[input.itemId];
	if (!hero || !item || item.ownerId !== input.heroId) {
		throw new ReplayIntegrityError('Equipment ownership failed', state.eventCursor);
	}
	if (item.equippedById !== null && item.equippedById !== input.heroId) {
		throw new ReplayIntegrityError('Equipment is already held by another hero', state.eventCursor);
	}
	const definition = verifiedEquipmentDefinition(item.definitionId);
	const targetSlot = input.targetSlot ?? definition.slot;
	if (!equipmentSlotIsLegal(state, input.heroId, definition, targetSlot)) {
		throw new ReplayIntegrityError('Equipment slot or handedness is not legal', state.eventCursor);
	}

	const equipment = { ...hero.equipment };
	const items = { ...state.items };
	const clearSlot = (slot: EquipmentLoadoutSlot): void => {
		const key = loadoutKey(slot);
		const previousId = equipment[key];
		if (previousId && previousId !== input.itemId) {
			items[previousId] = { ...items[previousId]!, equippedById: null };
		}
		equipment[key] = null;
	};

	for (const slot of ['main-hand', 'off-hand', 'head', 'torso', 'legs', 'boots'] as const) {
		if (equipment[loadoutKey(slot)] === input.itemId) clearSlot(slot);
	}
	if (definition.handedness === 'two-handed') {
		clearSlot('main-hand');
		clearSlot('off-hand');
	} else {
		clearSlot(targetSlot);
	}
	equipment[loadoutKey(targetSlot)] = input.itemId;
	items[input.itemId] = { ...item, equippedById: input.heroId };

	const nextState = {
		...state,
		items,
		heroes: { ...state.heroes, [input.heroId]: { ...hero, equipment } }
	};
	return state.schemaVersion === 26
		? EngineGameStateV26Schema.parse(nextState)
		: state.schemaVersion === 25
			? EngineGameStateV25Schema.parse(nextState)
			: EngineGameStateV24Schema.parse(nextState);
}

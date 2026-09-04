import {
	EngineEquipmentItemStateV24Schema,
	type EngineEquipmentItemStateV24,
	type EquipmentCraftsmanship,
	type EquipmentOrigin
} from '@summonlab/contracts';

import { equipmentRankWithBonus, verifiedEquipmentDefinition } from './content-bindings.js';

export interface CreateEquipmentItemInput {
	readonly itemId: string;
	readonly definitionId: string;
	readonly ownerId: string;
	readonly craftsmanship: EquipmentCraftsmanship;
	readonly origin: EquipmentOrigin;
	readonly equippedById?: string | null;
	readonly durability?: number;
	readonly maxDurability?: number;
}

export function createEquipmentItem(input: CreateEquipmentItemInput): EngineEquipmentItemStateV24 {
	const definition = verifiedEquipmentDefinition(input.definitionId);
	const maxDurability = input.maxDurability ?? 100;
	return EngineEquipmentItemStateV24Schema.parse({
		itemId: input.itemId,
		definitionId: definition.definitionId,
		ownerId: input.ownerId,
		equippedById: input.equippedById ?? null,
		craftsmanship: input.craftsmanship,
		finalRank: equipmentRankWithBonus(definition.materialRank, input.craftsmanship.bonus),
		durability: input.durability ?? maxDurability,
		maxDurability,
		origin: input.origin
	});
}

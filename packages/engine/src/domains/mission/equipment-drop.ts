import {
	EngineEquipmentItemStateV24Schema,
	type EngineGameStateV24,
	type MissionRunStateV8
} from '@summonlab/contracts';
import { z } from 'zod';

import {
	verifiedEquipmentCatalogBinding,
	verifiedMissionEquipmentDropFixture
} from '../../core/content-bindings.js';
import { createEquipmentItem } from '../../core/equipment.js';
import { ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';

export const MissionEquipmentDropOutcomeSchema = z
	.object({
		fixtureContentVersion: z.literal('tower-band-01-equipment-drop-v1'),
		fixtureContentHash: z.string().length(64),
		catalogContentVersion: z.literal('equipment-content-v1'),
		catalogContentHash: z.string().length(64),
		recipientHeroId: z.string().uuid(),
		item: EngineEquipmentItemStateV24Schema
	})
	.strict();

export type MissionEquipmentDropOutcome = z.infer<typeof MissionEquipmentDropOutcomeSchema>;

export function buildMissionEquipmentDrop(
	state: EngineGameStateV24,
	eventId: string,
	mission: MissionRunStateV8
): MissionEquipmentDropOutcome | null {
	const fixture = verifiedMissionEquipmentDropFixture();
	if (mission.binding.missionId !== fixture.missionId) return null;
	const attempt = mission.attempt;
	if (attempt?.status !== 'success' || attempt.outcome !== 'success') return null;
	const recipientHeroId = attempt.party.heroIds
		.filter((heroId) => state.heroes[heroId]?.lifeState === 'active')
		.sort((left, right) => left.localeCompare(right))[0];
	if (!recipientHeroId) {
		throw new ReplayIntegrityError(
			'Equipment drop has no surviving hero recipient',
			state.eventCursor
		);
	}
	const itemId = deterministicUuid(`${eventId}:${fixture.rewardId}:equipment-drop`);
	if (state.items[itemId]) {
		throw new ReplayIntegrityError('Equipment drop item already exists', state.eventCursor);
	}
	const catalog = verifiedEquipmentCatalogBinding();
	const item = createEquipmentItem({
		itemId,
		definitionId: fixture.definitionId,
		ownerId: recipientHeroId,
		craftsmanship: fixture.craftsmanship,
		durability: fixture.initialCondition.durability,
		maxDurability: fixture.initialCondition.maxDurability,
		origin: {
			kind: 'dropped',
			missionId: fixture.missionId,
			rewardId: fixture.rewardId,
			sourceId: fixture.sourceId
		}
	});
	return MissionEquipmentDropOutcomeSchema.parse({
		fixtureContentVersion: fixture.contentVersion,
		fixtureContentHash: fixture.contentHash,
		catalogContentVersion: catalog.contentVersion,
		catalogContentHash: catalog.contentHash,
		recipientHeroId,
		item
	});
}

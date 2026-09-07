import {
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	type EngineGameStateV24
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { parseGameState } from '../../core/state.js';
import { createBootstrapEngine } from '../../orchestration/bootstrap.js';
import { applyCommand } from '../../orchestration/apply-command.js';
import { deterministicUuid, sha256Hex } from '../../hash.js';
import {
	LEGACY_EQUIPMENT_TEMPLATE_BINDINGS,
	createEquipmentItem,
	equipEquipmentItem
} from './equipment.js';

function equipmentState(): EngineGameStateV24 {
	const result = createBootstrapEngine({
		runId: deterministicUuid('equipment-v24-run'),
		seed: 'equipment-v24-seed',
		heroId: deterministicUuid('equipment-v24-hero'),
		manifestHash: sha256Hex('equipment-v24-manifest'),
		developmentEquipmentScenario: { enabled: true, materialLots: { bronze: 2, ash: 1 } }
	});
	return EngineGameStateV24Schema.parse(result.snapshot.state);
}

function withItem(
	state: EngineGameStateV24,
	definitionId: string,
	key: string,
	ownerId = Object.keys(state.heroes)[0]!
): { state: EngineGameStateV24; itemId: string } {
	const itemId = deterministicUuid(`equipment-v24-item:${key}`);
	const item = createEquipmentItem({
		itemId,
		definitionId,
		ownerId,
		craftsmanship: { label: 'standard', bonus: 0 },
		origin: {
			kind: 'dropped',
			missionId: 'equipment-fixture',
			rewardId: `reward-${key}`,
			sourceId: 'fixture-source'
		}
	});
	return {
		itemId,
		state: EngineGameStateV24Schema.parse({
			...state,
			items: { ...state.items, [itemId]: item }
		})
	};
}

describe('engine-v24 equipment state', () => {
	it('keeps the ordinary bootstrap on v13 and creates v24 only through the explicit fixture', () => {
		const input = {
			runId: deterministicUuid('ordinary-bootstrap'),
			seed: 'ordinary-seed',
			heroId: deterministicUuid('ordinary-hero'),
			manifestHash: sha256Hex('ordinary-manifest')
		};
		expect(createBootstrapEngine(input).snapshot.state.schemaVersion).toBe(13);
		const state = equipmentState();
		expect(state.schemaVersion).toBe(24);
		expect(state.contentVersion).toBe('engine-v24');
		expect(Object.keys(state.settlement.materialLots)).toHaveLength(28);
		expect(state.settlement.materialLots.bronze).toBe(2);
	});

	it('adapts both legacy templates into existing approved definitions without changing IDs', () => {
		const state = equipmentState();
		const items = Object.values(state.items);
		expect(items).toHaveLength(2);
		expect(items.map((item) => item.definitionId).sort()).toEqual([
			'equipment-ash-bow',
			'equipment-bronze-sword'
		]);
		expect(items.map((item) => item.origin)).toEqual(
			expect.arrayContaining([
				{ kind: 'legacy', legacyTemplateId: 'practice-blade' },
				{ kind: 'legacy', legacyTemplateId: 'short-bow' }
			])
		);
		expect(LEGACY_EQUIPMENT_TEMPLATE_BINDINGS['practice-blade'].approvedVisualAssetKey).toBe(
			'equipment-v1-f-bronze-sword'
		);
		expect(LEGACY_EQUIPMENT_TEMPLATE_BINDINGS['short-bow'].approvedVisualAssetKey).toBe(
			'equipment-v1-f-ash-bow'
		);
	});

	it('computes +0/+1/+2 ranks from immutable content and caps them at S', () => {
		const ownerId = deterministicUuid('rank-owner');
		const origin = {
			kind: 'dropped' as const,
			missionId: 'rank-fixture',
			rewardId: 'rank-reward',
			sourceId: 'rank-source'
		};
		expect(
			createEquipmentItem({
				itemId: deterministicUuid('rank-standard'),
				definitionId: 'equipment-starmetal-sword',
				ownerId,
				craftsmanship: { label: 'standard', bonus: 0 },
				origin
			}).finalRank
		).toBe('A');
		expect(
			createEquipmentItem({
				itemId: deterministicUuid('rank-fine'),
				definitionId: 'equipment-starmetal-sword',
				ownerId,
				craftsmanship: { label: 'fine', bonus: 1 },
				origin
			}).finalRank
		).toBe('S');
		expect(
			createEquipmentItem({
				itemId: deterministicUuid('rank-masterwork'),
				definitionId: 'equipment-sunsteel-sword',
				ownerId,
				craftsmanship: { label: 'masterwork', bonus: 2 },
				origin
			}).finalRank
		).toBe('S');
	});

	it('rejects unknown definitions, rank drift, and durability overflow at the right boundaries', () => {
		expect(() =>
			createEquipmentItem({
				itemId: deterministicUuid('unknown-item'),
				definitionId: 'equipment-missing-sword',
				ownerId: deterministicUuid('unknown-owner'),
				craftsmanship: { label: 'standard', bonus: 0 },
				origin: {
					kind: 'dropped',
					missionId: 'fixture',
					rewardId: 'missing',
					sourceId: 'fixture'
				}
			})
		).toThrow('Equipment content is unavailable');

		const state = equipmentState();
		const itemId = Object.keys(state.items)[0]!;
		expect(() =>
			parseGameState({
				...state,
				items: {
					...state.items,
					[itemId]: { ...state.items[itemId]!, definitionId: 'equipment-missing-sword' }
				}
			})
		).toThrow('Equipment content is unavailable');
		expect(() =>
			parseGameState({
				...state,
				items: { ...state.items, [itemId]: { ...state.items[itemId]!, finalRank: 'S' } }
			})
		).toThrow('Equipment final rank diverged from content');
		expect(
			EngineGameStateV24Schema.safeParse({
				...state,
				items: {
					...state.items,
					[itemId]: { ...state.items[itemId]!, durability: 7, maxDurability: 6 }
				}
			}).success
		).toBe(false);
	});

	it('requires every canonical material lot and unique loadout occupancy', () => {
		const state = equipmentState();
		const missingBronze = Object.fromEntries(
			Object.entries(state.settlement.materialLots).filter(
				([materialId]) => materialId !== 'bronze'
			)
		);
		expect(
			EngineGameStateV24Schema.safeParse({
				...state,
				settlement: { ...state.settlement, materialLots: missingBronze }
			}).success
		).toBe(false);
		expect(
			EngineGameStateV24Schema.safeParse({
				...state,
				settlement: {
					...state.settlement,
					materialLots: { ...state.settlement.materialLots, bronze: -1 }
				}
			}).success
		).toBe(false);
		const heroId = Object.keys(state.heroes)[0]!;
		const mainHand = state.heroes[heroId]!.equipment.mainHand;
		expect(
			EngineGameStateV24Schema.safeParse({
				...state,
				heroes: {
					...state.heroes,
					[heroId]: {
						...state.heroes[heroId]!,
						equipment: { ...state.heroes[heroId]!.equipment, offHand: mainHand }
					}
				}
			}).success
		).toBe(false);
	});

	it('enforces shield, two-handed, armor, ownership, and sword/dagger dual-wield legality', () => {
		let state = equipmentState();
		const heroId = Object.keys(state.heroes)[0]!;
		const shield = withItem(state, 'equipment-bronze-shield', 'shield');
		state = equipEquipmentItem(shield.state, { heroId, itemId: shield.itemId });
		expect(state.heroes[heroId]!.equipment.offHand).toBe(shield.itemId);

		const bow = Object.values(state.items).find(
			(item) => item.definitionId === 'equipment-ash-bow'
		)!;
		state = equipEquipmentItem(state, { heroId, itemId: bow.itemId });
		expect(state.heroes[heroId]!.equipment).toMatchObject({
			mainHand: bow.itemId,
			offHand: null
		});

		const dagger = withItem(state, 'equipment-bronze-dagger', 'dagger');
		expect(() =>
			equipEquipmentItem(dagger.state, {
				heroId,
				itemId: dagger.itemId,
				targetSlot: 'off-hand'
			})
		).toThrow('Equipment slot or handedness is not legal');

		const sword = Object.values(dagger.state.items).find(
			(item) => item.definitionId === 'equipment-bronze-sword'
		)!;
		state = equipEquipmentItem(dagger.state, { heroId, itemId: sword.itemId });
		state = equipEquipmentItem(state, {
			heroId,
			itemId: dagger.itemId,
			targetSlot: 'off-hand'
		});
		expect(state.heroes[heroId]!.equipment.offHand).toBe(dagger.itemId);

		const axe = withItem(state, 'equipment-bronze-axe', 'axe');
		expect(() => equipEquipmentItem(axe.state, { heroId, itemId: axe.itemId })).toThrow(
			'Equipment slot or handedness is not legal'
		);

		const torso = withItem(state, 'equipment-bronze-heavy-armor-torso', 'torso');
		expect(() =>
			equipEquipmentItem(torso.state, { heroId, itemId: torso.itemId, targetSlot: 'head' })
		).toThrow('Equipment slot or handedness is not legal');
		expect(() =>
			equipEquipmentItem(
				withItem(state, 'equipment-bronze-shield', 'foreign', deterministicUuid('other-hero'))
					.state,
				{ heroId, itemId: deterministicUuid('equipment-v24-item:foreign') }
			)
		).toThrow('Equipment ownership failed');
	});

	it('keeps v23 strict and unable to accept the v24 loadout shape', () => {
		const state = equipmentState();
		const hero = Object.values(state.heroes)[0]!;
		expect(
			EngineGameStateV23Schema.safeParse({
				...state,
				schemaVersion: 23,
				contentVersion: 'engine-v23'
			}).success
		).toBe(false);
		expect(Object.keys(hero.equipment)).toEqual([
			'mainHand',
			'offHand',
			'head',
			'torso',
			'legs',
			'boots'
		]);
	});

	it('dispatches a v24 equip command through the authoritative event and reducer', () => {
		const base = equipmentState();
		const heroId = Object.keys(base.heroes)[0]!;
		const ready = EngineGameStateV24Schema.parse({
			...base,
			heroes: {
				...base.heroes,
				[heroId]: {
					...base.heroes[heroId]!,
					destination: 'training-ground',
					location: 'training-ground',
					locationNodeId: 'training-ring',
					firstArrivalCompleted: true
				}
			}
		});
		const shield = withItem(ready, 'equipment-bronze-shield', 'command-shield');
		const result = applyCommand(shield.state, {
			commandId: deterministicUuid('equipment-v24-command'),
			runId: shield.state.runId,
			actorId: heroId,
			expectedVersion: shield.state.version,
			correlationId: deterministicUuid('equipment-v24-command-correlation'),
			source: {
				source: 'manual',
				timing: 'step',
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'hero.equip.item',
			itemId: shield.itemId
		});
		expect(result.events.map((event) => event.eventType)).toEqual(['hero.item.equipped']);
		expect(result.state.schemaVersion).toBe(24);
		if (result.state.schemaVersion !== 24) throw new Error('Expected v24 equip result');
		expect(result.state.heroes[heroId]!.equipment.offHand).toBe(shield.itemId);
		expect(result.state.heroes[heroId]!.equipment.mainHand).not.toBeNull();
	});
});

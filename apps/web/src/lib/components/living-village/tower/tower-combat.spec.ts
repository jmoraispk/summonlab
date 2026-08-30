import { describe, expect, it } from 'vitest';
import { FLOORS, HEROES, speciesById } from './tower-fixtures';
import { simulateHunt } from './tower-combat';

describe('Living Village Tower hunt fixture', () => {
	it('repeats the same derived encounter sequence and haul exactly', () => {
		const spec = {
			floor: FLOORS[2]!,
			species: speciesById('ember-wisp'),
			party: HEROES,
			threshold: 50 as const
		};
		const first = simulateHunt(spec);
		const replay = simulateHunt(spec);

		expect(replay).toEqual(first);
		expect(first.combatReceipts.length).toBeGreaterThan(1);
		expect(first.haulHash).toMatch(/^[a-f0-9]{8}$/u);
		expect(first.materialHaul.length).toBeGreaterThan(0);
		expect(first.returnReason.code).toBe('inventory-capacity');
	});

	it('checks the threshold after a complete encounter and preserves a bounded haul', () => {
		const result = simulateHunt({
			floor: FLOORS[2]!,
			species: speciesById('ember-wisp'),
			party: HEROES,
			threshold: 75
		});

		expect(result.encountersCompleted).toBeGreaterThanOrEqual(1);
		expect(result.inventoryUsed).toBeLessThanOrEqual(result.inventoryCapacity);
		expect(result.finalResources.some((hero) => hero.health / hero.maxHealth <= 0.75)).toBe(true);
		expect(result.returnReason.summary).toContain('after');
	});

	it('stops before an unsafe next encounter without crossing into a new fight', () => {
		const result = simulateHunt({
			floor: FLOORS[0]!,
			species: speciesById('ember-wisp'),
			party: HEROES,
			threshold: 25,
			inventoryCapacity: 100,
			encounterCap: 12
		});

		expect(result.returnReason.code).toBe('next-encounter-unsafe');
		expect(result.returnReason.summary).toContain('0 Health');
		expect(result.combatReceipts).toHaveLength(result.encountersCompleted);
	});

	it('keeps encounter defeat and encounter cap as distinct bounded reasons', () => {
		const capped = simulateHunt({
			floor: FLOORS[0]!,
			species: speciesById('goblin-skirmisher'),
			party: HEROES,
			threshold: 25,
			inventoryCapacity: 100,
			encounterCap: 2
		});
		const defeated = simulateHunt({
			floor: FLOORS[9]!,
			species: speciesById('ember-wisp'),
			party: HEROES,
			threshold: 25,
			inventoryCapacity: 100,
			encounterCap: 6
		});

		expect(capped.returnReason.code).toBe('encounter-cap');
		expect(defeated.returnReason.code).toBe('encounter-defeat');
	});
});

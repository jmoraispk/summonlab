import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('canonical Tower screen ownership', () => {
	it('keeps floors, exploration, both combat modes, and extraction inside TowerScreen', () => {
		const root = fileURLToPath(new URL('.', import.meta.url));
		const source = readFileSync(`${root}/TowerScreen.svelte`, 'utf8');
		expect(source).toContain('TowerFloorList');
		expect(source).toContain('TowerExplorationMap');
		expect(source).toContain('TowerEncounter');
		expect(source).toContain('TowerReport');
		expect(source).toContain("command('encounter'");
		expect(source).not.toContain('/living-village-lab');
		expect(source).not.toContain('/mission/');
	});

	it('passes the exact expedition party and returns accepted travel before refreshing', () => {
		const root = fileURLToPath(new URL('.', import.meta.url));
		const source = readFileSync(`${root}/TowerScreen.svelte`, 'utf8');
		expect(source).toContain('exploration.partyHeroIds.includes(resident.heroId)');
		expect(source).toContain('return payload.travel;');
		expect(source).toContain('onTravelComplete={onChanged}');
	});
});

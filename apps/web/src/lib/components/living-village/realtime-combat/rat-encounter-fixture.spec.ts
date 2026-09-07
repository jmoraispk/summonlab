import { ExplorationEncounterRequestSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { combatRequestHash } from './combat-hash';
import { combatFixtureAssetBindings, RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';

describe('rat encounter fixture', () => {
	it('is a valid, self-hashed eight-actor fixture request', () => {
		const parsed = ExplorationEncounterRequestSchema.parse(RAT_ENCOUNTER_REQUEST);
		expect(parsed.party.map((hero) => hero.heroRef.heroId)).toEqual([
			'saffron-braid',
			'iron-guardian',
			'moss-archer'
		]);
		expect(parsed.enemies).toHaveLength(5);
		expect(parsed.bounds.maximumCombatants).toBe(8);
		expect(combatRequestHash(parsed)).toBe(parsed.requestHash);
	});

	it('binds every current raster and motion source by SHA-256', () => {
		const sources = combatFixtureAssetBindings(RAT_ENCOUNTER_REQUEST);
		expect(sources).toHaveLength(17);
		expect(new Set(sources.map((asset) => asset.contentHash)).size).toBe(17);
		expect(sources.every((asset) => asset.status === 'fixture')).toBe(true);
	});
});

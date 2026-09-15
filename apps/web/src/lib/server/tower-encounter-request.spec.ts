import { TOWER_FLOOR_01_EXPLORATION } from '@summonlab/content';
import { ExplorationEncounterRequestSchema } from '@summonlab/contracts';
import { createExplorationAttempt } from '@summonlab/engine/exploration';
import { describe, expect, it } from 'vitest';

import summonableCatalogSource from '../../../../../assets/heroes/approved/summonable-roster-v1/catalog.json';

import { combatRequestHash } from '../components/tower/combat/automated/combat-hash';
import { buildTowerEncounterRequest } from './tower-encounter-request';

describe('canonical Tower encounter request', () => {
	it('builds a production request for the exact summoned party', () => {
		const heroes = summonableCatalogSource.entries.slice(0, 3).map((entry, index) => ({
			heroId: entry.draft.manifest.characterId,
			manifestHash: entry.draft.manifestHash,
			artKey: entry.draft.manifest.artKey,
			displayName: entry.draft.manifest.displayName,
			health: 100 - index * 5,
			maximumHealth: 100,
			level: index + 1,
			equipment: { mainHand: null }
		}));
		const partyHeroIds = heroes.map((hero) => hero.heroId);
		const attempt = createExplorationAttempt(TOWER_FLOOR_01_EXPLORATION, {
			attemptId: '44444444-4444-4444-8444-444444444444',
			runId: '22222222-2222-4222-8222-222222222222',
			partyHeroIds,
			leaderHeroId: partyHeroIds[0]!
		});

		const request = buildTowerEncounterRequest({
			attempt,
			heroes,
			dutySlotId: 'goblin-chain-watch',
			observedGameTime: '2026-09-14T12:00:00.000Z'
		});

		expect(request.party.map((hero) => hero.heroRef.heroId)).toEqual(partyHeroIds);
		expect(
			request.party.every(
				(hero) => hero.presentation.combatAssetBinding.approvalStatus === 'approved'
			)
		).toBe(true);
		expect(request.enemies).toHaveLength(2);
		expect(request.enemies.every((enemy) => enemy.displayName.includes('Goblin'))).toBe(true);
		expect(request.battlefieldBinding.battlefieldId).toBe('ruined-threshold');
		expect(request.requestHash).toBe(combatRequestHash(request));
		expect(ExplorationEncounterRequestSchema.parse(request)).toEqual(request);
	});
});

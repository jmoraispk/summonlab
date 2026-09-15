import { TOWER_FLOOR_01_EXPLORATION } from '@summonlab/content';
import type { ExplorationCombatReceipt, ExplorationEncounterRequest } from '@summonlab/contracts';
import { createExplorationAttempt } from '@summonlab/engine/exploration';
import { describe, expect, it } from 'vitest';

import summonableCatalogSource from '../../../../../assets/heroes/approved/summonable-roster-v1/catalog.json';

import {
	RAT_ENCOUNTER_CLAIM_POLICY,
	RAT_ENCOUNTER_CLAIM_POLICY_BINDING,
	RAT_ENCOUNTER_REQUEST
} from '../components/tower/combat/automated/rat-encounter-fixture';
import { createCombatSession } from '../components/tower/combat/automated/combat-session';
import {
	TOWER_COMBAT_CLAIM_POLICY,
	TOWER_COMBAT_CLAIM_POLICY_BINDING
} from '../tower-combat-policy';
import { buildTowerEncounterRequest } from './tower-encounter-request';
import { validateTowerEncounterReceipt } from './tower-encounter';
import { TOWER_COMBAT_CONTENT_CATALOG } from './tower-combat-content';

function completedReceipt(
	request: ExplorationEncounterRequest,
	dependencies: Parameters<typeof createCombatSession>[1]
): ExplorationCombatReceipt {
	const session = createCombatSession(request, dependencies);
	session.markAssetsReady();
	for (let index = 0; index < request.bounds.maximumSimulationTicks; index += 1) {
		const snapshot = session.advanceFixedStep();
		if (snapshot.receipt) return snapshot.receipt;
	}
	throw new Error('Encounter did not complete');
}

function canonicalRequest(): ExplorationEncounterRequest {
	const heroes = summonableCatalogSource.entries.slice(0, 3).map((entry) => ({
		heroId: entry.draft.manifest.characterId,
		manifestHash: entry.draft.manifestHash,
		artKey: entry.draft.manifest.artKey,
		displayName: entry.draft.manifest.displayName,
		health: 100,
		maximumHealth: 100,
		level: 1,
		equipment: { mainHand: null }
	}));
	const partyHeroIds = heroes.map((hero) => hero.heroId);
	const attempt = createExplorationAttempt(TOWER_FLOOR_01_EXPLORATION, {
		attemptId: '44444444-4444-4444-8444-444444444444',
		runId: '22222222-2222-4222-8222-222222222222',
		partyHeroIds,
		leaderHeroId: partyHeroIds[0]!
	});
	return buildTowerEncounterRequest({
		attempt,
		heroes,
		dutySlotId: 'goblin-chain-watch',
		observedGameTime: '2026-09-14T12:00:00.000Z'
	});
}

describe('Tower encounter adapters', () => {
	it('rejects a receipt that does not match the persisted request', () => {
		const receipt = completedReceipt(RAT_ENCOUNTER_REQUEST, {
			claimPolicy: RAT_ENCOUNTER_CLAIM_POLICY,
			claimPolicyBinding: RAT_ENCOUNTER_CLAIM_POLICY_BINDING,
			fixtureRequestHash: RAT_ENCOUNTER_REQUEST.requestHash
		});
		const mismatchedRequestId = '00000000-0000-4000-8000-000000000099';
		const mismatchedReceipt = {
			...receipt,
			requestId: mismatchedRequestId,
			replayRef: { ...receipt.replayRef, requestId: mismatchedRequestId }
		};

		expect(() => validateTowerEncounterReceipt(RAT_ENCOUNTER_REQUEST, mismatchedReceipt)).toThrow(
			'Combat receipt does not match the active encounter'
		);
	});

	it('replays and accepts the canonical production encounter receipt', () => {
		const request = canonicalRequest();
		const receipt = completedReceipt(request, {
			claimPolicy: TOWER_COMBAT_CLAIM_POLICY,
			claimPolicyBinding: TOWER_COMBAT_CLAIM_POLICY_BINDING,
			contentCatalog: TOWER_COMBAT_CONTENT_CATALOG
		});

		expect(validateTowerEncounterReceipt(request, receipt)).toMatchObject({
			receiptId: receipt.receiptId,
			requestId: request.requestId,
			outcome: receipt.outcome,
			receiptHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
		});
	});
});

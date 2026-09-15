import {
	ExplorationCombatReceiptSchema,
	type ExplorationCombatReceipt,
	type ExplorationEncounterRequest
} from '@summonlab/contracts';

import {
	createReplayCombatSession,
	type CombatReplayVerification
} from '../components/tower/combat/automated/combat-session';
import { combatValueHash } from '../components/tower/combat/automated/combat-hash';
import {
	TOWER_COMBAT_CLAIM_POLICY,
	TOWER_COMBAT_CLAIM_POLICY_BINDING
} from '../tower-combat-policy';
import { TOWER_COMBAT_CONTENT_CATALOG } from './tower-combat-content';

export interface ValidatedTowerEncounterReceipt {
	readonly receiptId: string;
	readonly requestId: string;
	readonly receiptHash: string;
	readonly outcome: 'victory' | 'defeat';
	readonly summary: string;
}

function sameValues(left: unknown, right: unknown): boolean {
	return combatValueHash(left) === combatValueHash(right);
}

function encounterInputStateHash(request: ExplorationEncounterRequest): string {
	const { expectedExplorationStateHash, requestHash, ...inputState } = request;
	void expectedExplorationStateHash;
	void requestHash;
	return combatValueHash(inputState);
}

function assertRequestBinding(
	request: ExplorationEncounterRequest,
	receipt: ExplorationCombatReceipt
): void {
	const heroIds = request.party.map((hero) => hero.heroRef.heroId);
	const finalHeroIds = receipt.finalHeroes.map((hero) => hero.heroId);
	const enemyIds = request.enemies.map((enemy) => enemy.enemyInstanceId);
	const finalEnemyIds = receipt.finalEnemies.map((enemy) => enemy.enemyInstanceId);
	if (
		receipt.requestId !== request.requestId ||
		receipt.requestHash !== request.requestHash ||
		receipt.idempotencyKey !== request.idempotencyKey ||
		receipt.runId !== request.runId ||
		receipt.correlationId !== request.correlationId ||
		receipt.encounterId !== request.encounterId ||
		receipt.explorationAttemptId !== request.explorationAttemptId ||
		receipt.rulesetVersion !== request.rulesetVersion ||
		!sameValues(receipt.contentBindings, request.contentBindings) ||
		!sameValues(finalHeroIds, heroIds) ||
		!sameValues(finalEnemyIds, enemyIds) ||
		receipt.inputStateHash !== encounterInputStateHash(request) ||
		receipt.replayRef.seed !== request.seed ||
		receipt.replayRef.entropyCursor !== request.entropyCursor ||
		receipt.replayRef.battlefieldBindingHash !== combatValueHash(request.battlefieldBinding) ||
		receipt.replayRef.participantPresentationBindingsHash !==
			combatValueHash(
				[...request.party, ...request.enemies].map((participant) => participant.presentation)
			)
	) {
		throw new Error('Combat receipt does not match the active encounter');
	}
}

function verifyReplay(
	request: ExplorationEncounterRequest,
	receipt: ExplorationCombatReceipt
): CombatReplayVerification {
	const replay = createReplayCombatSession(request, receipt, {
		claimPolicy: TOWER_COMBAT_CLAIM_POLICY,
		claimPolicyBinding: TOWER_COMBAT_CLAIM_POLICY_BINDING,
		contentCatalog: TOWER_COMBAT_CONTENT_CATALOG
	});
	replay.markAssetsReady();
	for (let index = 0; index <= request.bounds.maximumSimulationTicks; index += 1) {
		if (replay.status !== 'running') break;
		replay.advanceFixedStep();
	}
	return replay.replayVerification ?? { kind: 'pending' };
}

export function validateTowerEncounterReceipt(
	request: ExplorationEncounterRequest,
	input: unknown
): ValidatedTowerEncounterReceipt {
	const receipt = ExplorationCombatReceiptSchema.parse(input);
	assertRequestBinding(request, receipt);
	const verification = verifyReplay(request, receipt);
	if (verification.kind !== 'verified') {
		throw new Error('Combat receipt does not match the active encounter');
	}
	return {
		receiptId: receipt.receiptId,
		requestId: receipt.requestId,
		receiptHash: combatValueHash(receipt),
		outcome: receipt.outcome,
		summary:
			receipt.outcome === 'victory'
				? 'The company policy resolved the encounter and holds the field.'
				: 'The company was defeated and must recover before returning.'
	};
}

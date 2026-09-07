import { CombatResultSchema, type CombatResult } from '@summonlab/contracts';

import type { CombatClaimReceipt } from '../core/combat-claims.js';
import type { CombatMissionClaimProjection } from '../domains/mission/lifecycle.js';
import { transitionCombatMissionClaims } from '../domains/mission/reducer.js';
import {
	applyCombatProgressionClaim,
	type CombatProgressionClaimProjection
} from '../domains/progression/claims.js';

export interface CombatClaimTransitionInput {
	readonly mission: CombatMissionClaimProjection;
	readonly progression: CombatProgressionClaimProjection;
}

export interface CombatClaimTransition extends CombatClaimTransitionInput {
	readonly receipts: readonly CombatClaimReceipt[];
}

/**
 * Coordinates owner-specific pure transitions without becoming a canonical state owner itself.
 * The caller persists the returned patches and receipts atomically with the terminal result.
 */
export function transitionCombatResultClaims(
	input: CombatClaimTransitionInput,
	resultInput: CombatResult
): CombatClaimTransition {
	const result = CombatResultSchema.parse(resultInput);
	const missionTransition = transitionCombatMissionClaims(input.mission, result);
	let progression = input.progression;
	const receiptsByKey = new Map(
		missionTransition.receipts.map((receipt) => [receipt.idempotencyKey, receipt])
	);
	for (const claim of result.claims) {
		if (claim.claimType !== 'skill-practice') continue;
		const applied = applyCombatProgressionClaim(progression, claim);
		progression = applied.projection;
		receiptsByKey.set(applied.receipt.idempotencyKey, applied.receipt);
	}
	return {
		mission: missionTransition.projection,
		progression,
		receipts: result.claims.map((claim) => {
			const receipt = receiptsByKey.get(claim.idempotencyKey);
			if (!receipt) throw new Error(`Combat claim lacks an owner: ${claim.idempotencyKey}`);
			return receipt;
		})
	};
}

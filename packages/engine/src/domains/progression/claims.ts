import type { CombatClaim } from '@summonlab/contracts';

import {
	combatClaimReceipt,
	existingCombatClaimReceipt,
	type CombatClaimReceipt
} from '../../core/combat-claims.js';
import { hashCanonical } from '../../hash.js';

/** Ephemeral deterministic transition projection; canonical progression remains the owner. */
export interface CombatProgressionClaimProjection {
	readonly practiceEvidence: Readonly<Record<string, Readonly<Record<string, number>>>>;
	readonly receipts: Readonly<Record<string, CombatClaimReceipt>>;
}

export function createCombatProgressionClaimProjection(): CombatProgressionClaimProjection {
	return { practiceEvidence: {}, receipts: {} };
}

export function applyCombatProgressionClaim(
	projection: CombatProgressionClaimProjection,
	claim: Extract<CombatClaim, { claimType: 'skill-practice' }>
): {
	readonly projection: CombatProgressionClaimProjection;
	readonly receipt: CombatClaimReceipt;
} {
	const existing = existingCombatClaimReceipt(projection.receipts, claim, 'progression');
	if (existing) return { projection, receipt: existing };

	const heroPractice = projection.practiceEvidence[claim.heroId] ?? {};
	const gained = claim.practiceEvidence;
	const nextEvidence = (heroPractice[claim.skillId] ?? 0) + gained;
	if (!Number.isSafeInteger(nextEvidence)) throw new Error('Combat practice evidence overflowed');
	const receipt = combatClaimReceipt(claim, 'progression', hashCanonical(projection));
	return {
		projection: {
			practiceEvidence: {
				...projection.practiceEvidence,
				[claim.heroId]: { ...heroPractice, [claim.skillId]: nextEvidence }
			},
			receipts: { ...projection.receipts, [claim.idempotencyKey]: receipt }
		},
		receipt
	};
}

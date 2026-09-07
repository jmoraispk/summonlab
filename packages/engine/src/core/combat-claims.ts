import type { CombatClaim } from '@summonlab/contracts';

import { deterministicUuid, hashCanonical } from '../hash.js';

export interface CombatClaimReceipt {
	readonly receiptVersion: 'combat-claim-receipt-v1';
	readonly receiptId: string;
	readonly claimId: string;
	readonly idempotencyKey: string;
	readonly inputHash: string;
	readonly claimHash: string;
	readonly owner: 'progression' | 'mission-aftermath';
}

export function combatClaimReceipt(
	claim: CombatClaim,
	owner: CombatClaimReceipt['owner'],
	inputHash: string
): CombatClaimReceipt {
	return {
		receiptVersion: 'combat-claim-receipt-v1',
		receiptId: deterministicUuid(`${claim.idempotencyKey}:receipt:${owner}:${inputHash}`),
		claimId: claim.claimId,
		idempotencyKey: claim.idempotencyKey,
		inputHash,
		claimHash: hashCanonical(claim),
		owner
	};
}

export function existingCombatClaimReceipt(
	receipts: Readonly<Record<string, CombatClaimReceipt>>,
	claim: CombatClaim,
	owner: CombatClaimReceipt['owner']
): CombatClaimReceipt | null {
	const existing = receipts[claim.idempotencyKey];
	if (!existing) return null;
	if (existing.claimHash !== hashCanonical(claim) || existing.owner !== owner) {
		throw new Error(`Combat claim idempotency collision: ${claim.idempotencyKey}`);
	}
	return existing;
}

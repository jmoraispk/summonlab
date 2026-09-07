import { CombatClaimSchema, type CombatClaim } from '@summonlab/contracts';
import { z } from 'zod';

import { deterministicUuid, hashCanonical } from '../hash.js';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const CombatClaimReceiptSchema = z
	.object({
		receiptVersion: z.literal('combat-claim-receipt-v1'),
		receiptId: z.string().uuid(),
		claimId: z.string().uuid(),
		idempotencyKey: z.string().trim().min(1).max(240),
		claim: CombatClaimSchema,
		inputHash: HashSchema,
		claimHash: HashSchema,
		effectHash: HashSchema,
		owner: z.enum(['progression', 'mission-aftermath'])
	})
	.strict();

export type CombatClaimReceipt = z.infer<typeof CombatClaimReceiptSchema>;

function receiptIdFor(
	idempotencyKey: string,
	owner: CombatClaimReceipt['owner'],
	inputHash: string
): string {
	return deterministicUuid(`${idempotencyKey}:receipt:${owner}:${inputHash}`);
}

function effectHashFor(
	claim: CombatClaim,
	owner: CombatClaimReceipt['owner'],
	inputHash: string
): string {
	return hashCanonical({ effectVersion: 'combat-claim-effect-v1', owner, inputHash, claim });
}

export function parseCombatClaimReceipt(input: unknown): CombatClaimReceipt {
	const receipt = CombatClaimReceiptSchema.parse(input);
	if (
		receipt.receiptId !== receiptIdFor(receipt.idempotencyKey, receipt.owner, receipt.inputHash)
	) {
		throw new Error(`Combat claim receipt identity is invalid: ${receipt.idempotencyKey}`);
	}
	if (
		receipt.claimId !== receipt.claim.claimId ||
		receipt.idempotencyKey !== receipt.claim.idempotencyKey ||
		receipt.claimHash !== hashCanonical(receipt.claim) ||
		receipt.effectHash !== effectHashFor(receipt.claim, receipt.owner, receipt.inputHash)
	) {
		throw new Error(`Combat claim receipt payload is invalid: ${receipt.idempotencyKey}`);
	}
	return receipt;
}

export function combatClaimReceipt(
	claim: CombatClaim,
	owner: CombatClaimReceipt['owner'],
	inputHash: string
): CombatClaimReceipt {
	return CombatClaimReceiptSchema.parse({
		receiptVersion: 'combat-claim-receipt-v1',
		receiptId: receiptIdFor(claim.idempotencyKey, owner, inputHash),
		claimId: claim.claimId,
		idempotencyKey: claim.idempotencyKey,
		claim,
		inputHash,
		claimHash: hashCanonical(claim),
		effectHash: effectHashFor(claim, owner, inputHash),
		owner
	});
}

export function existingCombatClaimReceipt(
	receipts: Readonly<Record<string, CombatClaimReceipt>>,
	claim: CombatClaim,
	owner: CombatClaimReceipt['owner']
): CombatClaimReceipt | null {
	const existingInput = receipts[claim.idempotencyKey];
	if (!existingInput) return null;
	const existing = parseCombatClaimReceipt(existingInput);
	if (
		existing.claimId !== claim.claimId ||
		existing.idempotencyKey !== claim.idempotencyKey ||
		existing.claimHash !== hashCanonical(claim) ||
		existing.effectHash !== effectHashFor(claim, owner, existing.inputHash) ||
		existing.owner !== owner
	) {
		throw new Error(`Combat claim idempotency collision: ${claim.idempotencyKey}`);
	}
	return existing;
}

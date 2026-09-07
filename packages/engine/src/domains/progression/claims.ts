import { CombatSkillIdSchema, type CombatClaim } from '@summonlab/contracts';
import { z } from 'zod';

import {
	combatClaimReceipt,
	CombatClaimReceiptSchema,
	existingCombatClaimReceipt,
	parseCombatClaimReceipt,
	type CombatClaimReceipt
} from '../../core/combat-claims.js';
import { hashCanonical } from '../../hash.js';

/** Ephemeral deterministic transition projection; canonical progression remains the owner. */
export interface CombatProgressionClaimProjection {
	readonly practiceEvidence: Readonly<Record<string, Readonly<Record<string, number>>>>;
	readonly receipts: Readonly<Record<string, CombatClaimReceipt>>;
}

export const CombatProgressionClaimProjectionSchema = z
	.object({
		practiceEvidence: z.record(
			z.string().uuid(),
			z.record(CombatSkillIdSchema, z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))
		),
		receipts: z.record(z.string().trim().min(1).max(240), CombatClaimReceiptSchema)
	})
	.strict()
	.superRefine((projection, context) => {
		for (const [key, receiptInput] of Object.entries(projection.receipts)) {
			const receipt = parseCombatClaimReceipt(receiptInput);
			if (receipt.idempotencyKey !== key || receipt.owner !== 'progression') {
				context.addIssue({
					code: 'custom',
					path: ['receipts', key],
					message: 'Progression combat claim receipt key or owner is inconsistent'
				});
			}
		}
	});

export function parseCombatProgressionClaimProjection(
	input: unknown
): CombatProgressionClaimProjection {
	return CombatProgressionClaimProjectionSchema.parse(input);
}

export function createCombatProgressionClaimProjection(): CombatProgressionClaimProjection {
	return parseCombatProgressionClaimProjection({ practiceEvidence: {}, receipts: {} });
}

export function applyCombatProgressionClaim(
	projection: CombatProgressionClaimProjection,
	claim: Extract<CombatClaim, { claimType: 'skill-practice' }>
): {
	readonly projection: CombatProgressionClaimProjection;
	readonly receipt: CombatClaimReceipt;
} {
	projection = parseCombatProgressionClaimProjection(projection);
	const existing = existingCombatClaimReceipt(projection.receipts, claim, 'progression');
	if (existing) return { projection, receipt: existing };

	const heroPractice = projection.practiceEvidence[claim.heroId] ?? {};
	const gained = claim.practiceEvidence;
	const nextEvidence = (heroPractice[claim.skillId] ?? 0) + gained;
	if (!Number.isSafeInteger(nextEvidence)) throw new Error('Combat practice evidence overflowed');
	const receipt = combatClaimReceipt(claim, 'progression', hashCanonical(projection));
	return {
		projection: parseCombatProgressionClaimProjection({
			practiceEvidence: {
				...projection.practiceEvidence,
				[claim.heroId]: { ...heroPractice, [claim.skillId]: nextEvidence }
			},
			receipts: { ...projection.receipts, [claim.idempotencyKey]: receipt }
		}),
		receipt
	};
}

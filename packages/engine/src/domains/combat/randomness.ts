import { z } from 'zod';

import { canonicalJson, sha256Hex } from '../../hash.js';

const PurposeKeyedIntegerInputSchema = z
	.object({
		seed: z.string().regex(/^[0-9a-f]{64}$/u),
		attemptId: z.string().uuid(),
		tick: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		actorId: z.string().uuid(),
		actionInstanceId: z.string().uuid(),
		targetId: z.string().uuid().nullable().optional(),
		purpose: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u),
		localSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
		minimum: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
		maximum: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
	})
	.strict();

export type PurposeKeyedIntegerInput = Readonly<z.input<typeof PurposeKeyedIntegerInputSchema>>;

export type PurposeKeyedIntegerDraw = Readonly<{
	value: number;
	keyHash: string;
}>;

function firstUnsigned64Bits(hexDigest: string): bigint {
	return BigInt(`0x${hexDigest.slice(0, 16)}`);
}

/**
 * Produces one deterministic draw from explicit combat coordinates. It has no
 * cursor and therefore cannot perturb legacy sequential entropy or sibling
 * actors/targets when collection membership changes.
 */
export function purposeKeyedInteger(input: PurposeKeyedIntegerInput): PurposeKeyedIntegerDraw {
	const parsed = PurposeKeyedIntegerInputSchema.safeParse(input);
	if (!parsed.success) {
		const purposeIssue = parsed.error.issues.find((issue) => issue.path[0] === 'purpose');
		if (purposeIssue) throw new Error('Combat randomness purpose must be canonical');
		const sequenceIssue = parsed.error.issues.find((issue) => issue.path[0] === 'localSequence');
		if (sequenceIssue) throw new Error('Combat randomness local sequence must be nonnegative');
		throw new Error(`Invalid purpose-keyed combat coordinate: ${parsed.error.message}`);
	}
	const coordinate = parsed.data;
	if (coordinate.minimum > coordinate.maximum) {
		throw new Error('Combat randomness bounds are invalid');
	}
	const keyHash = sha256Hex(
		canonicalJson([
			'agent-readiness-purpose-key-v1',
			coordinate.seed,
			coordinate.attemptId,
			coordinate.tick,
			coordinate.actorId,
			coordinate.actionInstanceId,
			coordinate.targetId ?? null,
			coordinate.purpose,
			coordinate.localSequence
		])
	);
	const minimum = BigInt(coordinate.minimum);
	const range = BigInt(coordinate.maximum) - minimum + 1n;
	const value = minimum + (firstUnsigned64Bits(keyHash) % range);
	const numericValue = Number(value);
	if (!Number.isSafeInteger(numericValue)) {
		throw new Error('Purpose-keyed combat draw exceeded the safe integer domain');
	}
	return Object.freeze({ value: numericValue, keyHash });
}

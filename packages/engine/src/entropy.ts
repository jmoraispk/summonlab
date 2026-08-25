import { EntropyDrawSchema, type EntropyDraw } from '@summonlab/contracts';
import { sha256 } from '@noble/hashes/sha2.js';

export interface EntropyCursor {
	readonly seed: string;
	readonly cursor: number;
}

export interface EntropyResult {
	readonly draw: EntropyDraw;
	readonly next: EntropyCursor;
}

export function createEntropyCursor(seed: string, cursor = 0): EntropyCursor {
	if (!seed) throw new Error('Entropy seed cannot be empty');
	if (!Number.isSafeInteger(cursor) || cursor < 0)
		throw new Error('Entropy cursor must be nonnegative');
	return Object.freeze({ seed, cursor });
}

function firstUint64(input: string): bigint {
	const bytes = sha256(new TextEncoder().encode(input));
	let value = 0n;
	for (const byte of bytes.slice(0, 8)) value = (value << 8n) | BigInt(byte);
	return value;
}

export function drawInteger(
	entropy: EntropyCursor,
	purpose: string,
	minimum: number,
	maximum: number
): EntropyResult {
	if (!/^[a-z][a-z0-9.-]{2,99}$/u.test(purpose))
		throw new Error('Entropy purpose is not canonical');
	if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum > maximum) {
		throw new Error('Entropy integer bounds are invalid');
	}
	const range = BigInt(maximum - minimum + 1);
	const sampled = firstUint64(`${entropy.seed}\u0000${entropy.cursor}\u0000${purpose}`);
	const value = minimum + Number(sampled % range);
	return {
		draw: EntropyDrawSchema.parse({ purpose, cursor: entropy.cursor, minimum, maximum, value }),
		next: createEntropyCursor(entropy.seed, entropy.cursor + 1)
	};
}

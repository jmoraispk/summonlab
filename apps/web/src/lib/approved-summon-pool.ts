export interface SummonPoolEntry<TManifest = unknown> {
	readonly id: string;
	readonly manifest: TManifest;
	readonly manifestHash: string;
	readonly sourceApproval: 'candidate' | 'approved';
	readonly summonEligibility: 'blocked' | 'eligible';
	readonly portrait: {
		readonly publicPath: string;
		readonly width: number;
		readonly height: number;
	} | null;
}

export function deterministicIndex(seed: string, length: number): number {
	if (!Number.isInteger(length) || length < 1) throw new Error('Draw pool must not be empty');
	let hash = 2_166_136_261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16_777_619);
	}
	return (hash >>> 0) % length;
}

export function eligibleSummonEntries<T>(
	pool: readonly SummonPoolEntry<T>[]
): readonly SummonPoolEntry<T>[] {
	return pool.filter(
		(entry) =>
			entry.sourceApproval === 'approved' &&
			entry.summonEligibility === 'eligible' &&
			entry.portrait !== null
	);
}

export function drawApprovedIdentity<T>(
	pool: readonly SummonPoolEntry<T>[],
	seed: string
): SummonPoolEntry<T> | null {
	const eligible = eligibleSummonEntries(pool);
	return eligible.length === 0 ? null : eligible[deterministicIndex(seed, eligible.length)]!;
}

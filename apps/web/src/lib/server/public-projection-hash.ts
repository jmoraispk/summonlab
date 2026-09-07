import { hashCanonical } from '@summonlab/engine';

export type PublicProjectionKind =
	| 'campaign-objectives'
	| 'engine-check'
	| 'engine-event'
	| 'engine-state'
	| 'equipment-workshop'
	| 'journal-entry'
	| 'journal-report'
	| 'proof-event'
	| 'proof-manifest'
	| 'world-presentation';

/**
 * Hashes an already-constructed public DTO with a domain/version prefix.
 * Callers must never pass an authoritative internal value to this function.
 */
export function hashPublicProjection(kind: PublicProjectionKind, projection: unknown): string {
	return hashCanonical({
		publicProjectionHashVersion: 'public-projection-hash-v1',
		kind,
		projection
	});
}

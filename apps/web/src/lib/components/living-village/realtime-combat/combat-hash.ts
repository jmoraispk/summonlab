import type { ExplorationEncounterRequest } from '@summonlab/contracts';
import { deterministicUuid, hashCanonical } from '@summonlab/engine/hash';

export function combatRequestHash(request: ExplorationEncounterRequest): string {
	const { requestHash, ...body } = request;
	void requestHash;
	return hashCanonical(body);
}

export function combatDeterministicId(namespace: string, value: unknown): string {
	return deterministicUuid(`${namespace}:${hashCanonical(value)}`);
}

export function combatValueHash(value: unknown): string {
	return hashCanonical(value);
}

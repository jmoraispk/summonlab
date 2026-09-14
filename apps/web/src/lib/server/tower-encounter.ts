import { createHash, randomUUID } from 'node:crypto';

export type TowerCombatMode = 'turn-based' | 'automated';

export interface TowerEncounterResolution {
	readonly receiptId: string;
	readonly requestId: string;
	readonly receiptHash: string;
	readonly outcome: 'victory';
	readonly summary: string;
}

export function resolveTowerEncounter(input: {
	readonly requestId: string;
	readonly requestHash: string;
	readonly mode: TowerCombatMode;
	readonly receiptId?: string;
}): TowerEncounterResolution {
	const receiptHash = createHash('sha256')
		.update(`tower-encounter-v1:${input.requestId}:${input.requestHash}:victory`)
		.digest('hex');
	return {
		receiptId: input.receiptId ?? randomUUID(),
		requestId: input.requestId,
		receiptHash,
		outcome: 'victory',
		summary:
			input.mode === 'turn-based'
				? 'Orders resolved. The company holds the field.'
				: 'The company policy resolved the encounter and holds the field.'
	};
}

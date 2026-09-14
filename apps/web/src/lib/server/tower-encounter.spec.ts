import { describe, expect, it } from 'vitest';

import { resolveTowerEncounter } from './tower-encounter';

describe('Tower encounter adapters', () => {
	it('settles turn-based and automated presentation through one receipt contract', () => {
		const request = {
			requestId: '00000000-0000-4000-8000-000000000021',
			requestHash: 'a'.repeat(64),
			receiptId: '00000000-0000-4000-8000-000000000022'
		};
		const turnBased = resolveTowerEncounter({ ...request, mode: 'turn-based' });
		const automated = resolveTowerEncounter({ ...request, mode: 'automated' });
		expect(turnBased).toMatchObject({ outcome: 'victory', requestId: request.requestId });
		expect(automated).toMatchObject({ outcome: 'victory', requestId: request.requestId });
		expect(turnBased.receiptHash).toBe(automated.receiptHash);
	});
});

import { describe, expect, it } from 'vitest';

import { rigBenchEntryFromMessage, rigBenchOrigin, rigBenchSource, rigBenchUrl } from './rig-bench';

describe('rig bench embedding', () => {
	it('points at the hosted bench and carries the entry in its link', () => {
		expect(rigBenchUrl).toBe('https://assets.summonlab.ai/bench/rigging/index.html');
		expect(rigBenchSource(null)).toBe(rigBenchUrl);
		expect(rigBenchSource('api/asha-neutral')).toBe(`${rigBenchUrl}?entry=api%2Fasha-neutral`);
	});

	it('accepts entry reports only from the bench origin', () => {
		const message = { type: 'rig-bench-entry', entry: 'combat/wenyn-neutral' };
		expect(rigBenchEntryFromMessage(rigBenchOrigin, message)).toBe('combat/wenyn-neutral');
		expect(rigBenchEntryFromMessage('https://example.test', message)).toBeNull();
		expect(rigBenchEntryFromMessage(rigBenchOrigin, { type: 'other', entry: 'x' })).toBeNull();
		expect(
			rigBenchEntryFromMessage(rigBenchOrigin, { type: 'rig-bench-entry', entry: 7 })
		).toBeNull();
		expect(rigBenchEntryFromMessage(rigBenchOrigin, null)).toBeNull();
	});
});

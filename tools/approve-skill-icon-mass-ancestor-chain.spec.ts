import { describe, expect, it } from 'vitest';

import {
	GUARD_FLOW_ANCESTOR_IDS,
	validateGuardFlowAncestorOrder
} from './approve-skill-icon-mass-ancestor-chain.js';

describe('guard-flow mass ancestor approval', () => {
	it('requires the complete immediate-parent chain in canonical order', () => {
		expect(
			validateGuardFlowAncestorOrder([
				'martial:blade:cross-guard',
				'martial:blade:binding-cut',
				'martial:blade:counter-flow',
				'martial:blade:still-water-stance',
				'martial:blade:mirrored-edge'
			])
		).toEqual(GUARD_FLOW_ANCESTOR_IDS);
	});

	it('rejects a partial or reordered approval chain', () => {
		expect(() =>
			validateGuardFlowAncestorOrder([
				'martial:blade:cross-guard',
				'martial:blade:counter-flow',
				'martial:blade:binding-cut',
				'martial:blade:still-water-stance',
				'martial:blade:mirrored-edge'
			])
		).toThrow(/exact canonical order/u);
	});
});

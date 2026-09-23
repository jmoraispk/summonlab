import { describe, expect, it } from 'vitest';

import {
	ASHA_EXPLORATION_VISIBLE_HEIGHT,
	ASHA_SPINE_DECOMPOSITION_STATUS,
	decompositionAssets
} from './asha-spine-decomposition.js';

describe('Asha decomposition review configuration', () => {
	it('keeps the owner-selected scale configurable at 84 px', () => {
		expect(ASHA_EXPLORATION_VISIBLE_HEIGHT).toBe(84);
		expect(decompositionAssets(2).recomposed.endsWith('asha-setup-v2-r2.png')).toBe(true);
	});

	it('labels the technically validated art as candidate-only', () => {
		expect(ASHA_SPINE_DECOMPOSITION_STATUS).toBe('candidate');
		expect(decompositionAssets(2).bodyCore).toContain('/review/asha-spine-decomposition/');
	});
});

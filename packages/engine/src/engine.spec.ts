import { describe, expect, it } from 'vitest';

import { ENGINE_INVARIANTS, IllegalActionError } from './index.js';

describe('engine boundary', () => {
	it('keeps external mutation sources outside the engine contract', () => {
		expect(ENGINE_INVARIANTS).toContain('no-model-sdk');
		expect(ENGINE_INVARIANTS).toContain('no-wall-clock');
	});

	it('uses a typed illegal action failure', () => {
		expect(new IllegalActionError('tower.create-secret')).toMatchObject({
			name: 'IllegalActionError',
			message: 'Action is not legal in the current state: tower.create-secret'
		});
	});
});

import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareReversalCutFrameCorrection } from './prepare-reversal-cut-frame-correction.js';

describe('historical Reversal Cut frame correction', () => {
	it('keeps historical verification read-only and rejects regeneration', async () => {
		const root = path.resolve('.');
		await expect(prepareReversalCutFrameCorrection({ root, mode: 'check' })).resolves.toMatchObject(
			{
				current: true,
				written: []
			}
		);
		await expect(prepareReversalCutFrameCorrection({ root, mode: 'write' })).rejects.toThrow(
			/decommissioned.*complete skill icon/iu
		);
	});
});

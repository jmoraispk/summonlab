import { describe, expect, it } from 'vitest';

import { projectCombatPoint } from './depth-projection';
import { layoutHealthBar } from './health-bar-layout';

describe('health bar layout', () => {
	it('keeps the bar above the top of the depth-scaled body canvas', () => {
		const projected = projectCombatPoint('2.5d-v2', 0.5, 0.8, { width: 700, height: 1050 });
		const bar = layoutHealthBar(projected, 178);
		const bodyTop = projected.y - 178 * projected.scale * 0.96;
		expect(bodyTop - bar.y).toBe(12);
	});

	it('keeps bar dimensions constant across depth', () => {
		const far = layoutHealthBar(
			projectCombatPoint('2.5d-v2', 0.5, 0.2, { width: 700, height: 1050 }),
			178
		);
		const near = layoutHealthBar(
			projectCombatPoint('2.5d-v2', 0.5, 0.85, { width: 700, height: 1050 }),
			178
		);
		expect(far.width).toBe(near.width);
		expect(far.height).toBe(near.height);
	});
});

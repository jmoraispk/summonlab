import { describe, expect, it } from 'vitest';

import {
	createMotionPack,
	motionPackVersionDiagnostic,
	REALTIME_COMBAT_MOTION
} from './motion-pack-config';

describe('realtime combat motion-pack configuration', () => {
	it('derives the diagnostic versions from the same URLs loaded by Pixi', () => {
		expect(motionPackVersionDiagnostic(REALTIME_COMBAT_MOTION)).toBe(
			'asha:2,iron-guardian:5,moss-archer:2,rat-brute:1,lesser-rat:2'
		);

		const changed = {
			...REALTIME_COMBAT_MOTION,
			'iron-guardian': createMotionPack(
				'/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v3.json'
			)
		};
		expect(motionPackVersionDiagnostic(changed)).toContain('iron-guardian:3');
	});

	it('rejects a motion URL without version metadata', () => {
		expect(() => createMotionPack('/runtime/combat/iron-guardian-motion.json')).toThrow(
			/versioned motion-pack URL/i
		);
	});
});

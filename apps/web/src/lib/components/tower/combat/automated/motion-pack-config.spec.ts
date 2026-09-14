import { describe, expect, it } from 'vitest';

import { createMotionPack, motionPackVersionDiagnostic } from './motion-pack-config';
import { RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';

describe('realtime combat motion-pack configuration', () => {
	it('derives the diagnostic versions from request bindings in actor order', () => {
		const bindings = [...RAT_ENCOUNTER_REQUEST.party, ...RAT_ENCOUNTER_REQUEST.enemies].map(
			(participant) => participant.presentation.motionPackBinding
		);
		expect(motionPackVersionDiagnostic(bindings)).toBe(
			'asha:2,iron-guardian:5,moss-archer:4,rat-brute:1,lesser-rat:2'
		);
		expect(bindings[2]?.source).toMatch(/\/moss-archer-motion-v4\.json$/);

		const changed = [...bindings];
		changed[1] = {
			...changed[1]!,
			...createMotionPack(
				'/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v3.json'
			),
			motionPackId: 'iron-guardian'
		};
		expect(motionPackVersionDiagnostic(changed)).toContain('iron-guardian:3');
	});

	it('rejects a motion URL without version metadata', () => {
		expect(() => createMotionPack('/runtime/combat/iron-guardian-motion.json')).toThrow(
			/versioned motion-pack URL/i
		);
	});
});

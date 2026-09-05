import { describe, expect, it } from 'vitest';

import { createActorAnimator, frameIndexForClip, stepActorAnimator } from './actor-animator';
import { createRealtimeCombat } from './realtime-combat';

describe('actor animator', () => {
	it('does not restart a clip while the simulation intent is unchanged', () => {
		const actor = createRealtimeCombat().actors[0]!;
		const initial = createActorAnimator(actor);
		const first = stepActorAnimator(initial, actor, 0.2);
		const second = stepActorAnimator(first, actor, 0.2);
		expect(second.clip).toBe('advance');
		expect(second.elapsedSeconds).toBeCloseTo(0.4);
	});

	it('consumes attack and hit revisions once and gives defeat precedence', () => {
		const actor = createRealtimeCombat().actors[0]!;
		let state = createActorAnimator(actor);
		actor.actionRevision += 1;
		state = stepActorAnimator(state, actor, 1 / 60);
		expect(state.clip).toBe('attack');
		const elapsed = state.elapsedSeconds;
		state = stepActorAnimator(state, actor, 1 / 60);
		expect(state.elapsedSeconds).toBeGreaterThan(elapsed);

		actor.hitRevision += 1;
		state = stepActorAnimator(state, actor, 1 / 60);
		expect(state.clip).toBe('hit');
		actor.health = 0;
		actor.defeatRevision += 1;
		state = stepActorAnimator(state, actor, 1 / 60);
		expect(state.clip).toBe('down');
	});

	it('loops movement frames and holds a non-looping final frame', () => {
		const actor = createRealtimeCombat().actors[0]!;
		const moving = { ...createActorAnimator(actor), elapsedSeconds: 0.7 };
		expect(frameIndexForClip(moving, 5, 10, true)).toBe(2);
		expect(frameIndexForClip(moving, 5, 10, false)).toBe(4);
	});
});

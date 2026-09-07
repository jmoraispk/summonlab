import { describe, expect, it } from 'vitest';

import { arenaBounds, isInsideObstacle } from './combat-spatial';
import { RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';
import { createRealtimeCombat, runRealtimeCombat, stepRealtimeCombat } from './realtime-combat';

describe('realtime combat simulation', () => {
	it('settles to the same deterministic victory every time', () => {
		const first = runRealtimeCombat(RAT_ENCOUNTER_REQUEST, 40);
		const second = runRealtimeCombat(RAT_ENCOUNTER_REQUEST, 40);

		expect(first).toEqual(second);
		expect(first.phase).toBe('victory');
		expect(first.defeatedEnemies).toBe(5);
		expect(first.elapsedSeconds).toBeLessThan(40);
	});

	it('projects every actor and resource from the encounter request', () => {
		const state = createRealtimeCombat(RAT_ENCOUNTER_REQUEST);
		expect(state.actors.map((actor) => actor.id)).toEqual([
			'saffron-braid',
			'iron-guardian',
			'moss-archer',
			'rat-brute',
			'plague-rat-1',
			'plague-rat-2',
			'plague-rat-3',
			'plague-rat-4'
		]);
		expect(state.actors.find((actor) => actor.id === 'moss-archer')).toMatchObject({
			health: 126,
			mana: 40,
			x: 0.66,
			y: 0.88
		});
	});

	it('emits authoritative action and resource events without presentation frames', () => {
		let state = createRealtimeCombat(RAT_ENCOUNTER_REQUEST);
		let actionEvents: ReturnType<typeof stepRealtimeCombat>['events'] = [];
		for (let tick = 0; tick < 600 && actionEvents.length === 0; tick += 1) {
			const stepped = stepRealtimeCombat(state, 1 / 60);
			state = stepped.state;
			actionEvents = stepped.events.filter((event) => event.kind === 'action-resolved');
		}
		expect(actionEvents[0]).toMatchObject({
			actorId: expect.any(String),
			targetIds: [expect.any(String)]
		});
		expect(actionEvents[0]?.healthDeltas).toHaveLength(1);
	});

	it('keeps a viable committed target when another enemy is only slightly nearer', () => {
		const state = createRealtimeCombat(RAT_ENCOUNTER_REQUEST);
		const asha = state.actors.find((entry) => entry.id === 'saffron-braid')!;
		asha.targetId = 'rat-brute';
		asha.x = 0.5;
		asha.y = 0.5;
		const brute = state.actors.find((entry) => entry.id === 'rat-brute')!;
		brute.x = 0.5;
		brute.y = 0.39;
		const nearer = state.actors.find((entry) => entry.id === 'plague-rat-1')!;
		nearer.x = 0.5;
		nearer.y = 0.4;

		const stepped = stepRealtimeCombat(state, 1 / 60).state;
		expect(stepped.actors.find((entry) => entry.id === 'saffron-braid')?.targetId).toBe(
			'rat-brute'
		);
	});

	it('does not mutate a settled receipt', () => {
		const settled = runRealtimeCombat(RAT_ENCOUNTER_REQUEST, 40);
		expect(stepRealtimeCombat(settled, 1).state).toBe(settled);
	});

	it('keeps living actors outside the solid well footprint throughout the encounter', () => {
		let state = createRealtimeCombat(RAT_ENCOUNTER_REQUEST);
		for (let tick = 0; tick < 40 * 60 && state.phase === 'running'; tick += 1) {
			state = stepRealtimeCombat(state, 1 / 60).state;
			for (const actor of state.actors.filter((entry) => entry.health > 0)) {
				expect(isInsideObstacle(actor), actor.id).toBe(false);
			}
		}
		expect(state.phase).toBe('victory');
	});

	it('locks engaged actors in place instead of continuously pushing them apart', () => {
		let state = createRealtimeCombat(RAT_ENCOUNTER_REQUEST);
		const asha = state.actors.find((entry) => entry.id === 'saffron-braid')!;
		const rat = state.actors.find((entry) => entry.id === 'plague-rat-1')!;
		for (const actor of state.actors) {
			if (actor !== asha && actor !== rat) actor.health = 0;
		}
		asha.x = 0.5;
		asha.y = 0.6;
		rat.x = 0.5;
		rat.y = 0.55;
		rat.health = 10_000;
		rat.maximumHealth = 10_000;

		state = stepRealtimeCombat(state, 1 / 60).state;
		const engagedAsha = state.actors.find((entry) => entry.id === 'saffron-braid')!;
		const lockedPosition = { x: engagedAsha.x, y: engagedAsha.y };
		expect(engagedAsha.intent).toBe('attack');

		for (let tick = 0; tick < 30; tick += 1) state = stepRealtimeCombat(state, 1 / 60).state;
		const settledAsha = state.actors.find((entry) => entry.id === 'saffron-braid')!;
		expect(settledAsha.intent).toBe('attack');
		expect({ x: settledAsha.x, y: settledAsha.y }).toEqual(lockedPosition);
	});

	it('keeps every living actor inside sprite-aware stage margins', () => {
		let state = createRealtimeCombat(RAT_ENCOUNTER_REQUEST);
		for (let tick = 0; tick < 40 * 60 && state.phase === 'running'; tick += 1) {
			state = stepRealtimeCombat(state, 1 / 60).state;
			for (const actor of state.actors.filter((entry) => entry.health > 0)) {
				const bounds = arenaBounds(actor);
				expect(actor.x, `${actor.id} minimum x`).toBeGreaterThanOrEqual(bounds.minimumX);
				expect(actor.x, `${actor.id} maximum x`).toBeLessThanOrEqual(bounds.maximumX);
			}
		}
	});
});

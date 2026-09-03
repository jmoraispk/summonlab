import { describe, expect, it } from 'vitest';
import {
	COMBAT_BEAT_DURATIONS,
	COMBAT_PLAYBACK_DURATION_MS,
	PROXY_COMBAT_RECEIPT,
	projectCombatPlayback
} from './combat-playback';

describe('combat playback projection', () => {
	it('keeps the receipt untouched before the player commits', () => {
		const snapshot = projectCombatPlayback(PROXY_COMBAT_RECEIPT, 0, { started: false });

		expect(snapshot.beat).toBe('ready');
		expect(snapshot.actors.find((actor) => actor.id === 'mara')?.position).toEqual({
			column: 3,
			row: 7
		});
		expect(snapshot.feed.at(-1)?.message).toBe('I see an opening.');
	});

	it('establishes the destination cell before impact', () => {
		const impactStart = COMBAT_BEAT_DURATIONS.focus + COMBAT_BEAT_DURATIONS.move;
		const snapshot = projectCombatPlayback(PROXY_COMBAT_RECEIPT, impactStart);

		expect(snapshot.beat).toBe('impact');
		expect(snapshot.actors.find((actor) => actor.id === 'mara')?.position).toEqual({
			column: 4,
			row: 4
		});
		expect(snapshot.actors.find((actor) => actor.id === 'goblin_02')?.health).toBe(26);
	});

	it('publishes only the resolved receipt at settle', () => {
		const snapshot = projectCombatPlayback(PROXY_COMBAT_RECEIPT, COMBAT_PLAYBACK_DURATION_MS);
		const target = snapshot.actors.find((actor) => actor.id === 'goblin_02');

		expect(snapshot.beat).toBe('complete');
		expect(snapshot.complete).toBe(true);
		expect(target).toMatchObject({ health: 0, status: 'defeated', downProgress: 1 });
		expect(snapshot.feed.at(-1)?.message).toContain('goblin_02 died');
		expect(snapshot.readyActorId).toBe('lyra');
	});

	it('collapses motion but preserves final evidence for reduced motion', () => {
		const snapshot = projectCombatPlayback(PROXY_COMBAT_RECEIPT, 0, { reducedMotion: true });

		expect(snapshot.complete).toBe(true);
		expect(snapshot.elapsedMs).toBe(COMBAT_PLAYBACK_DURATION_MS);
		expect(snapshot.feed.at(-1)?.tone).toBe('system');
	});
});

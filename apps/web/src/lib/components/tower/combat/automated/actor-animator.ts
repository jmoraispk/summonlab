import type { RealtimeActor } from './realtime-combat';

export type CombatClip = 'idle' | 'advance' | 'attack' | 'hit' | 'down';

export type ActorAnimatorState = Readonly<{
	clip: CombatClip;
	elapsedSeconds: number;
	seenActionRevision: number;
	seenHitRevision: number;
	seenDefeatRevision: number;
}>;

export type ClipDurations = Readonly<Record<CombatClip, number>>;

export const DEFAULT_CLIP_DURATIONS: ClipDurations = {
	idle: 0.8,
	advance: 0.55,
	attack: 0.42,
	hit: 0.24,
	down: 0.58
};

export function createActorAnimator(actor: RealtimeActor): ActorAnimatorState {
	return {
		clip: actor.intent === 'advance' ? 'advance' : actor.intent === 'down' ? 'down' : 'idle',
		elapsedSeconds: 0,
		seenActionRevision: actor.actionRevision,
		seenHitRevision: actor.hitRevision,
		seenDefeatRevision: actor.defeatRevision
	};
}

export function stepActorAnimator(
	previous: ActorAnimatorState,
	actor: RealtimeActor,
	deltaSeconds: number,
	durations: ClipDurations = DEFAULT_CLIP_DURATIONS
): ActorAnimatorState {
	let clip = previous.clip;
	let elapsedSeconds = previous.elapsedSeconds + Math.max(0, deltaSeconds);
	let seenActionRevision = previous.seenActionRevision;
	let seenHitRevision = previous.seenHitRevision;
	let seenDefeatRevision = previous.seenDefeatRevision;

	if (actor.defeatRevision > seenDefeatRevision || actor.health <= 0) {
		if (clip !== 'down') elapsedSeconds = 0;
		clip = 'down';
		seenDefeatRevision = actor.defeatRevision;
	} else if (actor.hitRevision > seenHitRevision) {
		clip = 'hit';
		elapsedSeconds = 0;
		seenHitRevision = actor.hitRevision;
	} else if (actor.actionRevision > seenActionRevision) {
		clip = 'attack';
		elapsedSeconds = 0;
		seenActionRevision = actor.actionRevision;
	} else if ((clip === 'attack' || clip === 'hit') && elapsedSeconds >= durations[clip]) {
		clip = actor.intent === 'advance' ? 'advance' : 'idle';
		elapsedSeconds = 0;
	} else if (clip !== 'attack' && clip !== 'hit' && clip !== 'down') {
		const desired = actor.intent === 'advance' ? 'advance' : 'idle';
		if (clip !== desired) elapsedSeconds = 0;
		clip = desired;
	}

	return {
		clip,
		elapsedSeconds,
		seenActionRevision,
		seenHitRevision,
		seenDefeatRevision
	};
}

export function frameIndexForClip(
	state: ActorAnimatorState,
	frameCount: number,
	framesPerSecond: number,
	loop: boolean
): number {
	if (frameCount <= 1) return 0;
	const raw = Math.floor(state.elapsedSeconds * framesPerSecond);
	return loop ? raw % frameCount : Math.min(frameCount - 1, raw);
}

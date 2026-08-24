import type { AuthoritativeEvent, LegalAction } from '@summonlab/contracts';

export const ENGINE_INVARIANTS = Object.freeze([
	'pure-transition',
	'engine-owned-legality',
	'seeded-entropy',
	'append-only-events',
	'no-network',
	'no-database',
	'no-wall-clock',
	'no-model-sdk'
] as const);

export interface EngineTransition<State, Action extends LegalAction = LegalAction> {
	readonly nextState: State;
	readonly acceptedAction: Action;
	readonly events: readonly AuthoritativeEvent[];
	readonly nextSeedCursor: number;
}

export interface Engine<State, Action extends LegalAction = LegalAction> {
	legalActions(state: State, actorId: string): readonly Action[];
	transition(
		state: State,
		action: Action,
		seed: string,
		seedCursor: number
	): EngineTransition<State>;
}

export class IllegalActionError extends Error {
	public constructor(actionId: string) {
		super(`Action is not legal in the current state: ${actionId}`);
		this.name = 'IllegalActionError';
	}
}

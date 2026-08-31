import type { EngineEventReducer } from '../core/types.js';

export interface EngineEventRegistry {
	readonly ownerIds: readonly string[];
	readonly eventTypes: readonly string[];
	reducerFor(eventType: string): EngineEventReducer | undefined;
}

export function createEventRegistry(reducers: readonly EngineEventReducer[]): EngineEventRegistry {
	const reducersByType = new Map<string, EngineEventReducer>();
	const ownerIds: string[] = [];
	const eventTypes: string[] = [];

	for (const reducer of reducers) {
		if (reducer.eventTypes.length === 0) {
			throw new Error(`Event owner ${reducer.ownerId} must declare at least one discriminator`);
		}
		ownerIds.push(reducer.ownerId);
		for (const eventType of reducer.eventTypes) {
			const existing = reducersByType.get(eventType);
			if (existing) {
				throw new Error(
					`Event discriminator ${eventType} is owned by both ${existing.ownerId} and ${reducer.ownerId}`
				);
			}
			reducersByType.set(eventType, reducer);
			eventTypes.push(eventType);
		}
	}

	return {
		ownerIds: Object.freeze([...ownerIds]),
		eventTypes: Object.freeze([...eventTypes]),
		reducerFor: (eventType) => reducersByType.get(eventType)
	};
}

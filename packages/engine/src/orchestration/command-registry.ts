import type { EngineCommand } from '@summonlab/contracts';

import type { EngineCommandHandler } from '../core/types.js';

export interface EngineCommandRegistry {
	readonly ownerIds: readonly string[];
	readonly commandTypes: readonly EngineCommand['commandType'][];
	handlerFor(commandType: EngineCommand['commandType']): EngineCommandHandler;
}

export function createCommandRegistry(
	handlers: readonly EngineCommandHandler[]
): EngineCommandRegistry {
	const handlersByType = new Map<EngineCommand['commandType'], EngineCommandHandler>();
	const ownerIds: string[] = [];
	const commandTypes: EngineCommand['commandType'][] = [];

	for (const handler of handlers) {
		if (handler.commandTypes.length === 0) {
			throw new Error(`Command owner ${handler.ownerId} must declare at least one discriminator`);
		}
		ownerIds.push(handler.ownerId);
		for (const commandType of handler.commandTypes) {
			const existing = handlersByType.get(commandType);
			if (existing) {
				throw new Error(
					`Command discriminator ${commandType} is owned by both ${existing.ownerId} and ${handler.ownerId}`
				);
			}
			handlersByType.set(commandType, handler);
			commandTypes.push(commandType);
		}
	}

	return {
		ownerIds: Object.freeze([...ownerIds]),
		commandTypes: Object.freeze([...commandTypes]),
		handlerFor(commandType) {
			const handler = handlersByType.get(commandType);
			if (!handler) throw new Error(`Command discriminator ${commandType} has no owner`);
			return handler;
		}
	};
}

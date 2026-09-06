import {
	EngineGameStateSchema,
	EngineGameStateV2Schema,
	EngineGameStateV3Schema,
	EngineGameStateV4Schema,
	EngineGameStateV5Schema,
	EngineGameStateV6Schema,
	EngineGameStateV7Schema,
	EngineGameStateV8Schema,
	EngineGameStateV9Schema,
	EngineGameStateV10Schema,
	EngineGameStateV11Schema,
	EngineGameStateV12Schema,
	EngineGameStateV13Schema,
	EngineGameStateV14Schema,
	EngineGameStateV15Schema,
	EngineGameStateV16Schema,
	EngineGameStateV17Schema,
	EngineGameStateV18Schema,
	EngineGameStateV19Schema,
	EngineGameStateV20Schema,
	EngineGameStateV21Schema,
	EngineGameStateV22Schema,
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	EngineGameStateV25Schema,
	type EngineGameState
} from '@summonlab/contracts';

import { hashCanonical } from '../hash.js';
import { validateEquipmentStateContent } from './content-bindings.js';
import type { EngineGameStateModern } from './types.js';

export function parseGameState(value: unknown): EngineGameState {
	const state = EngineGameStateSchema.parse(value);
	if (state.schemaVersion === 24 || state.schemaVersion === 25) {
		validateEquipmentStateContent(state);
	}
	return state;
}

export function hashGameState(state: EngineGameState): string {
	return hashParsedGameState(parseGameState(state));
}

export function hashParsedGameState(state: EngineGameState): string {
	return hashCanonical(state);
}

export function parseModernState(
	state: EngineGameStateModern,
	value: unknown
): EngineGameStateModern {
	if (state.schemaVersion === 2) return EngineGameStateV2Schema.parse(value);
	if (state.schemaVersion === 3) return EngineGameStateV3Schema.parse(value);
	if (state.schemaVersion === 4) return EngineGameStateV4Schema.parse(value);
	if (state.schemaVersion === 5) return EngineGameStateV5Schema.parse(value);
	if (state.schemaVersion === 6) return EngineGameStateV6Schema.parse(value);
	if (state.schemaVersion === 7) return EngineGameStateV7Schema.parse(value);
	if (state.schemaVersion === 8) return EngineGameStateV8Schema.parse(value);
	if (state.schemaVersion === 9) return EngineGameStateV9Schema.parse(value);
	if (state.schemaVersion === 10) return EngineGameStateV10Schema.parse(value);
	if (state.schemaVersion === 11) return EngineGameStateV11Schema.parse(value);
	if (state.schemaVersion === 12) return EngineGameStateV12Schema.parse(value);
	if (state.schemaVersion === 13) return EngineGameStateV13Schema.parse(value);
	if (state.schemaVersion === 14) return EngineGameStateV14Schema.parse(value);
	if (state.schemaVersion === 15) return EngineGameStateV15Schema.parse(value);
	if (state.schemaVersion === 16) return EngineGameStateV16Schema.parse(value);
	if (state.schemaVersion === 17) return EngineGameStateV17Schema.parse(value);
	if (state.schemaVersion === 18) return EngineGameStateV18Schema.parse(value);
	if (state.schemaVersion === 19) return EngineGameStateV19Schema.parse(value);
	if (state.schemaVersion === 20) return EngineGameStateV20Schema.parse(value);
	if (state.schemaVersion === 21) return EngineGameStateV21Schema.parse(value);
	if (state.schemaVersion === 22) return EngineGameStateV22Schema.parse(value);
	if (state.schemaVersion === 23) return EngineGameStateV23Schema.parse(value);
	if (state.schemaVersion === 24) {
		const parsed = EngineGameStateV24Schema.parse(value);
		validateEquipmentStateContent(parsed);
		return parsed;
	}
	const parsed = EngineGameStateV25Schema.parse(value);
	validateEquipmentStateContent(parsed);
	return parsed;
}

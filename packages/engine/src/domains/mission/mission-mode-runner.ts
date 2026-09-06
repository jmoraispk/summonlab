import type { EngineGameStateV25 } from '@summonlab/contracts';

import { IllegalActionError } from '../../errors.js';
import { combatModeAvailability } from './combat-mode.js';
import {
	resolveLegacyAutoV1Turn,
	type LegacyAutoV1CombatResolution
} from './legacy-auto-v1-resolver.js';

export function assertMissionModeAdvanceAvailable(state: EngineGameStateV25): 'legacy-auto-v1' {
	const attempt = state.mission.attempt;
	if (!attempt || !['deployed', 'resolving'].includes(attempt.status)) {
		throw new IllegalActionError('mission.advance.automatic');
	}
	const availability = combatModeAvailability(attempt.combatModeBinding);
	if (availability.status !== 'available') throw new Error(availability.message);
	return availability.modeId;
}

export function resolveMissionModeTurn(
	state: EngineGameStateV25,
	sourceEventId: string
): LegacyAutoV1CombatResolution {
	// Dispatch authority is the persisted attempt binding. Schema version only establishes that
	// this state can carry the binding; it never chooses a combat implementation.
	switch (assertMissionModeAdvanceAvailable(state)) {
		case 'legacy-auto-v1':
			return resolveLegacyAutoV1Turn(state, sourceEventId);
	}
}

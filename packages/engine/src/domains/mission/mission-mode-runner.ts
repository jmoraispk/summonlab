import type {
	EngineGameStateV25,
	EngineGameStateV26,
	MissionRunStateV9,
	MissionRunStateV10
} from '@summonlab/contracts';

import { IllegalActionError } from '../../errors.js';
import { combatModeAvailability } from './combat-mode.js';
import {
	resolveLegacyAutoV1Turn,
	type LegacyAutoV1CombatResolution
} from './legacy-auto-v1-resolver.js';
import {
	projectCurrentStateForLegacyResolver,
	restoreCurrentLegacyMission
} from './readiness-runtime.js';

type MissionModeState = EngineGameStateV25 | EngineGameStateV26;
type CurrentLegacyAutoV1CombatResolution = Omit<LegacyAutoV1CombatResolution, 'mission'> & {
	readonly mission: MissionRunStateV10;
};

export function assertMissionModeAdvanceAvailable(state: MissionModeState): 'legacy-auto-v1' {
	if (!state.mission.attempt || !['deployed', 'resolving'].includes(state.mission.attempt.status)) {
		throw new IllegalActionError('mission.advance.automatic');
	}
	if (state.schemaVersion === 26 && state.mission.attempt.combatState.modeId !== 'legacy-auto-v1') {
		throw new IllegalActionError('mission.advance.automatic');
	}
	const availability = combatModeAvailability(state.mission.attempt.combatModeBinding);
	if (availability.status !== 'available' || availability.modeId !== 'legacy-auto-v1') {
		throw new Error(
			availability.message ?? 'Readiness combat does not use automatic turn resolution'
		);
	}
	return 'legacy-auto-v1';
}

export function resolveMissionModeTurn(
	state: MissionModeState,
	sourceEventId: string
): LegacyAutoV1CombatResolution | CurrentLegacyAutoV1CombatResolution {
	// Dispatch authority is the persisted attempt binding. Schema version only establishes that
	// this state can carry the binding; it never chooses a combat implementation.
	switch (assertMissionModeAdvanceAvailable(state)) {
		case 'legacy-auto-v1':
			if (state.schemaVersion === 25) return resolveLegacyAutoV1Turn(state, sourceEventId);
			const resolved = resolveLegacyAutoV1Turn(
				projectCurrentStateForLegacyResolver(state),
				sourceEventId
			);
			return {
				...resolved,
				mission: restoreCurrentLegacyMission(state, resolved.mission as MissionRunStateV9)
			};
	}
}

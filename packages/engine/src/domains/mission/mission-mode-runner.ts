import type {
	EngineGameStateV25,
	EngineGameStateV26,
	EngineGameStateV27,
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

type MissionModeState = EngineGameStateV25 | EngineGameStateV26 | EngineGameStateV27;
export type CurrentLegacyAutoV1CombatResolution = Omit<
	LegacyAutoV1CombatResolution,
	'mission' | 'heroes'
> & {
	readonly mission: MissionRunStateV10;
	readonly heroes: EngineGameStateV26['heroes'] | EngineGameStateV27['heroes'];
};

export function assertMissionModeAdvanceAvailable(state: MissionModeState): 'legacy-auto-v1' {
	if (!state.mission.attempt || !['deployed', 'resolving'].includes(state.mission.attempt.status)) {
		throw new IllegalActionError('mission.advance.automatic');
	}
	if (
		(state.schemaVersion === 26 || state.schemaVersion === 27) &&
		state.mission.attempt.combatState.modeId !== 'legacy-auto-v1'
	) {
		throw new IllegalActionError('mission.advance.automatic');
	}
	const availability = combatModeAvailability(
		state.mission.attempt.combatModeBinding,
		state.schemaVersion
	);
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
		case 'legacy-auto-v1': {
			if (state.schemaVersion === 25) return resolveLegacyAutoV1Turn(state, sourceEventId);
			const resolved = resolveLegacyAutoV1Turn(
				projectCurrentStateForLegacyResolver(state),
				sourceEventId
			);
			const heroes =
				state.schemaVersion === 27
					? Object.fromEntries(
							Object.entries(resolved.heroes).map(([heroId, hero]) => {
								const current = state.heroes[heroId];
								if (!current) throw new Error(`Legacy resolver returned unknown hero ${heroId}`);
								return [
									heroId,
									{
										...current,
										health: hero.health,
										mana: hero.mana,
										lifeState: hero.lifeState,
										injuries: hero.injuries,
										location: hero.location,
										locationNodeId: hero.locationNodeId
									}
								];
							})
						)
					: Object.fromEntries(
							Object.entries(resolved.heroes).map(([heroId, hero]) => {
								const current = state.heroes[heroId];
								if (!current) throw new Error(`Legacy resolver returned unknown hero ${heroId}`);
								return [heroId, { ...hero, combatTraining: current.combatTraining }];
							})
						);
			return {
				...resolved,
				mission: restoreCurrentLegacyMission(state, resolved.mission as MissionRunStateV9),
				heroes
			};
		}
	}
}

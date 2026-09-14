import {
	EngineHeroStateV25Schema,
	MissionConsequenceRecordV4Schema,
	MissionRunStateV9Schema,
	type EngineGameStateV25,
	type EngineHeroStateV25,
	type MissionRunStateV8
} from '@summonlab/contracts';

import {
	resolveLegacyV24CombatTurn,
	type LegacyV24CombatResolution,
	type LegacyV24CombatResolverState
} from './combat.js';
import { legacyAutomaticChoices, legacyCapabilityProjection } from './legacy-auto.js';

export type LegacyAutoV1CombatResolution = Omit<LegacyV24CombatResolution, 'heroes'> & {
	readonly heroes: Record<string, EngineHeroStateV25>;
};

/**
 * The frozen rules consume a v24-shaped state. Capability-only fields are kept outside this
 * boundary and restored after resolution; only the agreed four-attribute aptitude projection
 * enters the legacy rules.
 */
export function projectLegacyAutoV1State(state: EngineGameStateV25): LegacyV24CombatResolverState {
	const heroes = Object.fromEntries(
		Object.entries(state.heroes).map(([heroId, hero]) => {
			const withoutCapabilityFields = Object.fromEntries(
				Object.entries(hero).filter(
					([key]) => !['capabilityProfile', 'mana', 'maxMana'].includes(key)
				)
			);
			const legacyProgression = Object.fromEntries(
				Object.entries(hero.progression).filter(
					([key]) => !['unspentAttributePoints', 'attributeGrowthReceipts'].includes(key)
				)
			);
			return [
				heroId,
				{
					...withoutCapabilityFields,
					mind: {
						...hero.mind,
						aptitudes: legacyCapabilityProjection(hero.capabilityProfile.attributes)
					},
					progression: legacyProgression
				}
			];
		})
	);
	const projectedAttempt = state.mission.attempt
		? Object.fromEntries(
				Object.entries(state.mission.attempt).filter(([key]) => key !== 'combatModeBinding')
			)
		: null;
	const projectedArchives = state.mission.aftermath.archives.map((archive) =>
		Object.fromEntries(Object.entries(archive).filter(([key]) => key !== 'combatModeBinding'))
	);

	return {
		...state,
		schemaVersion: 24,
		contentVersion: 'engine-v24',
		heroes,
		mission: {
			...state.mission,
			aftermath: {
				...state.mission.aftermath,
				aftermathVersion: 'mission-aftermath-v3',
				archives: projectedArchives
			},
			attempt: projectedAttempt
		}
	} as unknown as LegacyV24CombatResolverState;
}

function restoreCapabilityHeroes(
	state: EngineGameStateV25,
	resolvedHeroes: LegacyV24CombatResolution['heroes']
): Record<string, EngineHeroStateV25> {
	return Object.fromEntries(
		Object.entries(resolvedHeroes).map(([heroId, resolvedHero]) => {
			const original = state.heroes[heroId];
			if (!original) throw new Error(`Legacy automatic resolver returned unknown hero ${heroId}`);
			return [
				heroId,
				EngineHeroStateV25Schema.parse({
					...resolvedHero,
					mind: original.mind,
					capabilityProfile: original.capabilityProfile,
					progression: original.progression,
					mana: original.mana,
					maxMana: original.maxMana
				})
			];
		})
	);
}

export function resolveLegacyAutoV1Turn(
	state: EngineGameStateV25,
	sourceEventId: string
): LegacyAutoV1CombatResolution {
	const choices = legacyAutomaticChoices(state);
	const resolved = resolveLegacyV24CombatTurn(
		projectLegacyAutoV1State(state),
		choices,
		sourceEventId,
		{
			consequence: MissionConsequenceRecordV4Schema,
			mission: {
				parse(value: unknown) {
					const legacyMission = value as MissionRunStateV8;
					return MissionRunStateV9Schema.parse({
						...legacyMission,
						aftermath: {
							...legacyMission.aftermath,
							aftermathVersion: 'mission-aftermath-v4',
							archives: legacyMission.aftermath.archives.map((archive) => {
								const original = state.mission.aftermath.archives.find(
									(candidate) => candidate.attemptId === archive.attemptId
								);
								if (!original) {
									throw new Error(
										`Legacy automatic resolver returned unknown archive ${archive.attemptId}`
									);
								}
								return { ...archive, combatModeBinding: original.combatModeBinding };
							})
						},
						attempt:
							legacyMission.attempt && state.mission.attempt
								? {
										...legacyMission.attempt,
										combatModeBinding: state.mission.attempt.combatModeBinding
									}
								: null
					});
				}
			}
		}
	);
	return {
		...resolved,
		heroes: restoreCapabilityHeroes(state, resolved.heroes)
	};
}

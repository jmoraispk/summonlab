import type { EngineGameStateV25 } from '@summonlab/contracts';
import {
	decisionLegalActions,
	missionHeroReadiness,
	missionPreparationReadiness
} from '@summonlab/engine';

export type PublicMissionHeroReadiness = Readonly<{
	heroId: string;
	status: 'ready' | 'unavailable';
	reason: string;
	canSelect: boolean;
	canRequestReturn: boolean;
}>;

export type PublicMissionReadiness = Readonly<{
	canPrepare: boolean;
	partyReason: string | null;
	hero: PublicMissionHeroReadiness;
}>;

const PUBLIC_REASONS = {
	ready: 'At the Tower Threshold.',
	'hero-not-found': 'Unavailable.',
	'hero-terminal': 'No longer available.',
	'away-from-threshold': 'Away from the Tower Threshold.',
	'active-activity': 'Finishing another activity.',
	'in-transit': 'Already traveling through Hearth 01.',
	'active-routine': 'Following a daily routine.',
	'active-forging': 'Working at the forge.',
	assigned: 'Assigned to settlement duty.',
	'mission-unavailable': 'This floor is not available.',
	'party-duplicate': 'The party selection contains a duplicate.',
	'party-size': 'Choose a valid party.',
	'master-terminal': 'The Master cannot deploy.',
	'master-away': 'The Master is away from the Tower Threshold.'
} as const;

export function projectMissionReadinessForPublic(
	state: EngineGameStateV25,
	heroId: string
): PublicMissionReadiness {
	const heroReadiness = missionHeroReadiness(state, heroId);
	const partyReadiness = missionPreparationReadiness(state, [heroId]);
	const canRequestReturn =
		heroReadiness.reason === 'away-from-threshold' &&
		decisionLegalActions(state, heroId).some(
			(action) => action.actionId === 'hero.travel.gate-dais'
		);

	return {
		canPrepare: partyReadiness.ready,
		partyReason: partyReadiness.ready ? null : PUBLIC_REASONS[partyReadiness.reason],
		hero: {
			heroId,
			status: heroReadiness.ready ? 'ready' : 'unavailable',
			reason: PUBLIC_REASONS[heroReadiness.reason],
			canSelect: heroReadiness.ready,
			canRequestReturn
		}
	};
}

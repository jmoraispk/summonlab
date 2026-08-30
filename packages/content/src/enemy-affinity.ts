import type { AffinitySpeciesId } from './affinity-workflow.js';
import type { EnemyArchetypeId } from './enemy-roster.js';
import type { PackTwoMonsterId } from './pack-two-monsters.js';

export type CanonicalEnemyId = EnemyArchetypeId | PackTwoMonsterId;

export const ENEMY_AFFINITY_ARCHETYPE_LINKS = [
	{ archetypeId: 'grey-wolf', affinitySpeciesId: 'grey-wolf' },
	{ archetypeId: 'tunnel-boar', affinitySpeciesId: 'tunnel-boar' },
	{ archetypeId: 'cave-bear', affinitySpeciesId: 'cave-bear' },
	{ archetypeId: 'death-knight', affinitySpeciesId: 'death-knight' },
	{ archetypeId: 'cave-drake', affinitySpeciesId: 'cave-drake' },
	{ archetypeId: 'tower-basilisk', affinitySpeciesId: 'tower-basilisk' }
] as const satisfies readonly {
	readonly archetypeId: CanonicalEnemyId;
	readonly affinitySpeciesId: AffinitySpeciesId;
}[];

export const ENEMY_AFFINITY_FAMILY_PILOTS = [
	{
		familyId: 'goblinoids',
		affinitySpeciesId: 'goblin',
		label: 'Goblin family affinity pilot'
	},
	{
		familyId: 'elementals',
		affinitySpeciesId: 'elemental',
		label: 'Bound Vanguard Elemental affinity pilot'
	}
] as const satisfies readonly {
	readonly familyId: string;
	readonly affinitySpeciesId: AffinitySpeciesId;
	readonly label: string;
}[];

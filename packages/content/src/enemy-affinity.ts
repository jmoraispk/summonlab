import type { AffinitySpeciesId } from './affinity-workflow.js';
import type { EnemyAffinityExpansionSpeciesId } from './enemy-affinity-expansion.js';
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

export const ENEMY_AFFINITY_EXPANSION_ARCHETYPE_LINKS = (
	[
		'goblin-skirmisher',
		'goblin-archer',
		'goblin-hexweaver',
		'goblin-chieftain',
		'dire-wolf',
		'ember-wisp',
		'stone-breaker',
		'storm-stalker',
		'frost-colossus',
		'clay-golem',
		'stone-golem',
		'iron-sentinel',
		'crystal-guardian',
		'grave-sentinel',
		'tower-wraith',
		'bone-mage',
		'venom-wyvern',
		'armored-elder-drake',
		'giant-tower-dragon',
		'hungry-mimic',
		'slime-colony',
		'burrowing-worm',
		'ogoblin-brute',
		'cave-troll',
		'hill-giant',
		'frost-giant',
		'hex-adept',
		'ward-mage',
		'tower-summoner',
		'tower-archmage',
		'tunnel-spider',
		'web-caster',
		'armored-brood-guard',
		'giant-broodmother'
	] as const
).map((archetypeId) => ({
	archetypeId,
	affinitySpeciesId: archetypeId
})) satisfies readonly {
	readonly archetypeId: CanonicalEnemyId;
	readonly affinitySpeciesId: EnemyAffinityExpansionSpeciesId;
}[];

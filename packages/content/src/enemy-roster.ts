export const ENEMY_REVIEW_ROSTER_VERSION = 'enemy-review-roster-v1';
export const TOWER_PROGRESSION_PREVIEW_VERSION = 'tower-progression-preview-v1';

export const ENEMY_ARCHETYPES = [
	{
		id: 'goblin-skirmisher',
		name: 'Goblin Skirmisher',
		family: 'goblinoids',
		role: 'Mobile melee pressure',
		debutFloor: 1,
		skills: ['Knife fighting', 'Feinting', 'Pack movement'],
		teaches: ['Guard timing', 'Weapon handling', 'Target focus']
	},
	{
		id: 'goblin-archer',
		name: 'Goblin Archer',
		family: 'goblinoids',
		role: 'Ranged lane control',
		debutFloor: 2,
		skills: ['Shortbow', 'Repositioning', 'Target marking'],
		teaches: ['Cover use', 'Shield use', 'Closing distance']
	},
	{
		id: 'grey-wolf',
		name: 'Grey Wolf',
		family: 'beasts',
		role: 'Fast flanking predator',
		debutFloor: 3,
		skills: ['Pursuit', 'Flanking', 'Trip attack'],
		teaches: ['Footwork', 'Perception', 'Ally protection']
	},
	{
		id: 'goblin-hexweaver',
		name: 'Goblin Hexweaver',
		family: 'goblinoids',
		role: 'Telegraphed magical control',
		debutFloor: 4,
		skills: ['Ember hex', 'Binding mark', 'Concentration'],
		teaches: ['Ward reading', 'Interrupts', 'Focus']
	},
	{
		id: 'goblin-chieftain',
		name: 'Goblin Chieftain',
		family: 'goblinoids',
		role: 'Formation leader',
		debutFloor: 5,
		skills: ['Command', 'Heavy cleave', 'Rally'],
		teaches: ['Formation fighting', 'Disruption', 'Threat priority']
	},
	{
		id: 'tunnel-boar',
		name: 'Tunnel Boar',
		family: 'beasts',
		role: 'Armored line breaker',
		debutFloor: 6,
		skills: ['Charge', 'Brace', 'Trample'],
		teaches: ['Dodge timing', 'Bracing', 'Terrain use']
	},
	{
		id: 'dire-wolf',
		name: 'Dire Wolf',
		family: 'beasts',
		role: 'Relentless pursuit',
		debutFloor: 7,
		skills: ['Coordinated hunt', 'Hamstring', 'Fear scent'],
		teaches: ['Stamina', 'Rescue movement', 'Composure']
	},
	{
		id: 'clay-golem',
		name: 'Clay Golem',
		family: 'constructs',
		role: 'Slow attrition wall',
		debutFloor: 8,
		skills: ['Body block', 'Crushing grip', 'Re-form'],
		teaches: ['Blunt weapons', 'Weak-point study', 'Resource pacing']
	},
	{
		id: 'cave-bear',
		name: 'Cave Bear',
		family: 'beasts',
		role: 'Close-range damage test',
		debutFloor: 9,
		skills: ['Maul', 'Roar', 'Overrun'],
		teaches: ['Spacing', 'Guard discipline', 'Injury control']
	},
	{
		id: 'ogoblin-brute',
		name: 'Ogoblin Brute',
		family: 'large-threats',
		role: 'Boss-scale bruiser',
		debutFloor: 10,
		skills: ['Sweeping strike', 'Grab', 'Berserk'],
		teaches: ['Team rotation', 'Restraint escape', 'Damage windows']
	},
	{
		id: 'stone-golem',
		name: 'Stone Golem',
		family: 'constructs',
		role: 'Armor and pattern check',
		debutFloor: 11,
		skills: ['Stone guard', 'Ground slam', 'Pattern reset'],
		teaches: ['Armor breaking', 'Pattern memory', 'Stagger timing']
	},
	{
		id: 'cave-troll',
		name: 'Cave Troll',
		family: 'large-threats',
		role: 'Regenerating reach threat',
		debutFloor: 12,
		skills: ['Long reach', 'Regeneration', 'Corner pressure'],
		teaches: ['Fire use', 'Kiting', 'Finishing discipline']
	},
	{
		id: 'iron-sentinel',
		name: 'Iron Sentinel',
		family: 'constructs',
		role: 'Disciplined counter-attacker',
		debutFloor: 13,
		skills: ['Parry', 'Counter', 'Lock formation'],
		teaches: ['Feinting', 'Magic penetration', 'Action economy']
	},
	{
		id: 'hill-giant',
		name: 'Hill Giant',
		family: 'large-threats',
		role: 'Arena-scale displacement',
		debutFloor: 14,
		skills: ['Stone maul', 'Debris throw', 'Shock step'],
		teaches: ['Arena awareness', 'Ranged support', 'Fall recovery']
	},
	{
		id: 'crystal-guardian',
		name: 'Crystal Guardian',
		family: 'constructs',
		role: 'Reflective magic boss',
		debutFloor: 15,
		skills: ['Refraction', 'Core beam', 'Shard field'],
		teaches: ['Spell control', 'Damage typing', 'Core targeting']
	},
	{
		id: 'frost-giant',
		name: 'Frost Giant',
		family: 'large-threats',
		role: 'Environmental threshold boss',
		debutFloor: 20,
		skills: ['Cold field', 'Ancient iron', 'Whiteout command'],
		teaches: ['Cold survival', 'Formation command', 'Sustained focus']
	}
] as const;

export type EnemyArchetypeId = (typeof ENEMY_ARCHETYPES)[number]['id'];

export const ENEMY_REVIEW_FAMILIES = [
	{
		id: 'goblinoids',
		name: 'Goblinoid warband',
		plate: 'goblinoids-v1',
		enemyIds: ['goblin-skirmisher', 'goblin-archer', 'goblin-hexweaver', 'goblin-chieftain']
	},
	{
		id: 'beasts',
		name: 'Beasts',
		plate: 'beasts-v1',
		enemyIds: ['grey-wolf', 'dire-wolf', 'cave-bear', 'tunnel-boar']
	},
	{
		id: 'constructs',
		name: 'Construct escalation',
		plate: 'constructs-v1',
		enemyIds: ['clay-golem', 'stone-golem', 'iron-sentinel', 'crystal-guardian']
	},
	{
		id: 'large-threats',
		name: 'Large threats',
		plate: 'large-threats-v1',
		enemyIds: ['cave-troll', 'ogoblin-brute', 'hill-giant', 'frost-giant']
	}
] as const;

const floorEncounters: ReadonlyArray<{
	enemyIds: readonly EnemyArchetypeId[];
	skillTest: string;
	newPressure: string;
}> = [
	{
		enemyIds: ['goblin-skirmisher'],
		skillTest: 'Guard timing · basic attacks',
		newPressure: 'One readable melee tell'
	},
	{
		enemyIds: ['goblin-skirmisher', 'goblin-archer'],
		skillTest: 'Cover · closing distance',
		newPressure: 'Ranged lanes'
	},
	{
		enemyIds: ['grey-wolf', 'goblin-skirmisher'],
		skillTest: 'Footwork · perception',
		newPressure: 'Flanking'
	},
	{
		enemyIds: ['goblin-hexweaver', 'goblin-archer'],
		skillTest: 'Ward reading · interrupts',
		newPressure: 'Concentration timer'
	},
	{
		enemyIds: ['goblin-chieftain', 'goblin-skirmisher'],
		skillTest: 'Formation · threat priority',
		newPressure: 'First command boss'
	},
	{
		enemyIds: ['tunnel-boar', 'goblin-archer'],
		skillTest: 'Dodge · brace',
		newPressure: 'Line-breaking charge'
	},
	{
		enemyIds: ['dire-wolf', 'grey-wolf'],
		skillTest: 'Rescue movement · stamina',
		newPressure: 'Persistent pursuit'
	},
	{
		enemyIds: ['clay-golem', 'goblin-hexweaver'],
		skillTest: 'Blunt weapons · weak points',
		newPressure: 'Re-forming armor'
	},
	{
		enemyIds: ['cave-bear', 'dire-wolf'],
		skillTest: 'Spacing · injury control',
		newPressure: 'Close-range burst'
	},
	{
		enemyIds: ['ogoblin-brute', 'goblin-chieftain'],
		skillTest: 'Team rotation · restraint escape',
		newPressure: 'Two-stage boss'
	},
	{
		enemyIds: ['stone-golem', 'goblin-archer'],
		skillTest: 'Armor breaking · pattern memory',
		newPressure: 'Pattern reset'
	},
	{
		enemyIds: ['cave-troll', 'dire-wolf'],
		skillTest: 'Fire use · kiting',
		newPressure: 'Regeneration'
	},
	{
		enemyIds: ['iron-sentinel', 'clay-golem'],
		skillTest: 'Feinting · magic penetration',
		newPressure: 'Counter-attacks'
	},
	{
		enemyIds: ['hill-giant', 'goblin-archer'],
		skillTest: 'Arena awareness · ranged support',
		newPressure: 'Displacement'
	},
	{
		enemyIds: ['crystal-guardian', 'iron-sentinel'],
		skillTest: 'Spell control · damage typing',
		newPressure: 'Reflection boss'
	},
	{
		enemyIds: ['cave-troll', 'stone-golem'],
		skillTest: 'Finishing · stagger timing',
		newPressure: 'Paired recovery cycles'
	},
	{
		enemyIds: ['hill-giant', 'dire-wolf'],
		skillTest: 'Formation movement · composure',
		newPressure: 'Mixed scale'
	},
	{
		enemyIds: ['crystal-guardian', 'goblin-hexweaver'],
		skillTest: 'Focus · interrupts',
		newPressure: 'Overlapping spell tells'
	},
	{
		enemyIds: ['iron-sentinel', 'ogoblin-brute'],
		skillTest: 'Action economy · rescue',
		newPressure: 'Counter plus grab'
	},
	{
		enemyIds: ['frost-giant', 'crystal-guardian'],
		skillTest: 'Cold survival · command',
		newPressure: 'Environmental boss'
	}
];

export const TOWER_PROGRESSION_PREVIEW = floorEncounters.map((encounter, index) => {
	const floor = index + 1;
	const minimumLevel = Math.max(1, Math.ceil(floor * 0.7));
	return {
		floor,
		band: Math.ceil(floor / 5),
		threshold: floor % 5 === 0,
		recommendedLevels: [minimumLevel, minimumLevel + 2] as const,
		...encounter
	};
});

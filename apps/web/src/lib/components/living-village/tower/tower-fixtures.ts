export type Affinity = 'Fire' | 'Water' | 'Wood' | 'Earth' | 'Metal';
export type Availability = 'idle' | 'training' | 'deployed';
export type FloorState = 'cleared' | 'frontier' | 'locked';
export type HealthThreshold = 75 | 50 | 25;

export type MaterialFixture = {
	id: string;
	name: string;
	minimum: number;
	maximum: number;
};

export type SpeciesFixture = {
	id: 'goblin-skirmisher' | 'gray-wolf' | 'ember-wisp';
	name: string;
	family: string;
	affinity: Affinity;
	role: string;
	description: string;
	baseHealth: number;
	baseDamage: number;
	baseAgility: number;
	materials: MaterialFixture[];
};

export type FloorFixture = {
	id: string;
	number: number;
	name: string;
	difficulty: string;
	state: FloorState;
	speciesIds: SpeciesFixture['id'][];
	firstClearReward: string;
	repeatReward: string;
};

export type HeroFixture = {
	id: 'dara-zev' | 'mara-vey' | 'jori-daro';
	name: string;
	role: string;
	level: number;
	affinity: Affinity;
	maxHealth: number;
	maxMana: number;
	agility: number;
	armor: number;
	availability: Availability;
	skill: {
		id: string;
		name: string;
		base: number;
		manaCost: number;
		attributeScale: number;
		equipmentBonus: number;
		status: string;
	};
	equipment: string;
};

export const FIXTURE_VERSION = 'living-village-species-hunt-presentation-v0';
export const HUNT_SEED = 'tower-hunt-seed-0317';
export const INVENTORY_CAPACITY = 12;
export const ENCOUNTER_CAP = 6;
export const HEALTH_THRESHOLDS: HealthThreshold[] = [75, 50, 25];

export const SPECIES: SpeciesFixture[] = [
	{
		id: 'goblin-skirmisher',
		name: 'Goblin Skirmisher',
		family: 'Goblinoids',
		affinity: 'Metal',
		role: 'Formation pressure',
		description: 'A known low-tier skirmisher that tests guard coverage and target order.',
		baseHealth: 52,
		baseDamage: 8,
		baseAgility: 17,
		materials: [
			{ id: 'worked-scrap', name: 'Worked scrap', minimum: 1, maximum: 2 },
			{ id: 'tower-cloth', name: 'Tower cloth', minimum: 1, maximum: 1 }
		]
	},
	{
		id: 'gray-wolf',
		name: 'Gray Wolf',
		family: 'Beasts',
		affinity: 'Wood',
		role: 'Pack pursuit',
		description: 'A quick hunter whose repeated attacks make remaining Health easy to read.',
		baseHealth: 54,
		baseDamage: 9,
		baseAgility: 20,
		materials: [
			{ id: 'gray-hide', name: 'Gray hide', minimum: 1, maximum: 2 },
			{ id: 'keen-fang', name: 'Keen fang', minimum: 0, maximum: 1 }
		]
	},
	{
		id: 'ember-wisp',
		name: 'Ember Wisp',
		family: 'Elementals',
		affinity: 'Fire',
		role: 'Ignition harrier',
		description: 'A known elemental whose Burn pressure rewards affinity preparation.',
		baseHealth: 40,
		baseDamage: 10,
		baseAgility: 22,
		materials: [
			{ id: 'ember-cinder', name: 'Ember cinder', minimum: 1, maximum: 2 },
			{ id: 'mineral-core', name: 'Mineral core', minimum: 1, maximum: 1 }
		]
	}
];

const FLOOR_SPECIES: SpeciesFixture['id'][][] = [
	['goblin-skirmisher', 'gray-wolf'],
	['gray-wolf', 'goblin-skirmisher'],
	['ember-wisp', 'goblin-skirmisher'],
	['gray-wolf', 'ember-wisp'],
	['goblin-skirmisher', 'gray-wolf'],
	['ember-wisp', 'gray-wolf'],
	['goblin-skirmisher', 'ember-wisp'],
	['gray-wolf', 'goblin-skirmisher'],
	['ember-wisp', 'goblin-skirmisher'],
	['gray-wolf', 'ember-wisp']
];

const FLOOR_NAMES = [
	'Gate Galleries',
	'Chain Court',
	'Ember Stair',
	'Rooted Vault',
	'Iron Chorus',
	'Cinder Span',
	'Verdigris Hall',
	'Flooded Ring',
	'Ashen Crown',
	'First Threshold'
];

export const FLOORS: FloorFixture[] = FLOOR_NAMES.map((name, index) => {
	const number = index + 1;
	return {
		id: `tower-floor-${String(number).padStart(2, '0')}`,
		number,
		name,
		difficulty:
			number <= 2 ? 'Measured' : number <= 4 ? 'Watchful' : number <= 7 ? 'Severe' : 'Extreme',
		state: number <= 2 ? 'cleared' : number === 3 ? 'frontier' : 'locked',
		speciesIds: FLOOR_SPECIES[index]!,
		firstClearReward: `Floor ${number} training seal + authored equipment claim`,
		repeatReward: 'Level XP, practical skill evidence, and collected materials'
	};
});

export const HEROES: HeroFixture[] = [
	{
		id: 'dara-zev',
		name: 'Dara Zev',
		role: 'Front guard',
		level: 4,
		affinity: 'Wood',
		maxHealth: 112,
		maxMana: 42,
		agility: 15,
		armor: 5,
		availability: 'idle',
		skill: {
			id: 'shielding-cleave-v0',
			name: 'Shielding cleave',
			base: 23,
			manaCost: 4,
			attributeScale: 0.28,
			equipmentBonus: 0.12,
			status: 'Guarded'
		},
		equipment: 'Ironwood shield · +12% fixture term'
	},
	{
		id: 'mara-vey',
		name: 'Mara Vey',
		role: 'Mid evoker',
		level: 4,
		affinity: 'Fire',
		maxHealth: 88,
		maxMana: 70,
		agility: 18,
		armor: 2,
		availability: 'idle',
		skill: {
			id: 'cinder-lance-v0',
			name: 'Cinder lance',
			base: 27,
			manaCost: 7,
			attributeScale: 0.32,
			equipmentBonus: 0.08,
			status: 'Burn'
		},
		equipment: 'Copper focus · +8% fixture term'
	},
	{
		id: 'jori-daro',
		name: 'Jori Daro',
		role: 'Back hunter',
		level: 4,
		affinity: 'Metal',
		maxHealth: 96,
		maxMana: 56,
		agility: 17,
		armor: 3,
		availability: 'idle',
		skill: {
			id: 'measured-shot-v0',
			name: 'Measured shot',
			base: 24,
			manaCost: 5,
			attributeScale: 0.3,
			equipmentBonus: 0.1,
			status: 'Rend'
		},
		equipment: 'Hunting bow · +10% fixture term'
	}
];

export function speciesById(id: SpeciesFixture['id']): SpeciesFixture {
	const species = SPECIES.find((candidate) => candidate.id === id);
	if (!species) throw new Error(`Unknown species fixture: ${id}`);
	return species;
}

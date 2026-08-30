export const PACK_TWO_MONSTER_ROSTER_VERSION = 'pack-two-monsters-v1';

export const PACK_TWO_MONSTER_ARCHETYPES = [
	{
		id: 'ember-wisp',
		name: 'Ember Wisp',
		family: 'elementals',
		duty: 'Ignition harrier',
		dutyCue: 'small airborne coal body, streaming sparks, no defended front',
		sizeBand: 'small',
		telegraph: 'compresses to white heat before a darting ignition pass',
		weakPoint: 'cool mineral core exposed after its pass'
	},
	{
		id: 'stone-breaker',
		name: 'Stone Breaker',
		family: 'elementals',
		duty: 'Siege bruiser',
		dutyCue: 'massive wedge forearms and a low quarry-stone center of gravity',
		sizeBand: 'large',
		telegraph: 'plants both feet and raises one slab arm before impact',
		weakPoint: 'bright binding seams after a missed smash'
	},
	{
		id: 'storm-stalker',
		name: 'Storm Stalker',
		family: 'elementals',
		duty: 'Lane assassin',
		dutyCue: 'lean quadrupedal thunderhead with forward prongs and trailing vapor',
		sizeBand: 'medium',
		telegraph: 'prongs align and a straight ionized lane appears before the charge',
		weakPoint: 'grounded rear condensate node'
	},
	{
		id: 'frost-colossus',
		name: 'Frost Colossus',
		family: 'elementals',
		duty: 'Zone-denial boss',
		dutyCue: 'towering glacier torso, broad planted feet, and one sweeping ice arm',
		sizeBand: 'boss',
		telegraph: 'frost rings crawl across the floor before a freezing sweep',
		weakPoint: 'dark stone heart visible through cracked chest ice'
	},
	{
		id: 'hex-adept',
		name: 'Hex Adept',
		family: 'arcane-hostiles',
		duty: 'Debuff skirmisher',
		dutyCue: 'mobile one-handed caster with dangling curse tags and an open off-hand',
		sizeBand: 'human',
		telegraph: 'three tags lift and point at the marked target',
		weakPoint: 'interruptible casting hand'
	},
	{
		id: 'ward-mage',
		name: 'Ward Mage',
		family: 'arcane-hostiles',
		duty: 'Barrier support',
		dutyCue: 'square stance behind a broad forearm ward and layered defensive mantle',
		sizeBand: 'human',
		telegraph: 'ward facets rotate toward the ally about to be protected',
		weakPoint: 'unshielded back while channeling'
	},
	{
		id: 'tower-summoner',
		name: 'Tower Summoner',
		family: 'arcane-hostiles',
		duty: 'Reinforcement controller',
		dutyCue: 'wide ritual frame, two grounded focus pylons, and both hands occupied',
		sizeBand: 'human',
		telegraph: 'empty gate geometry assembles on the floor before an add arrives',
		weakPoint: 'paired focus pylons break the channel'
	},
	{
		id: 'tower-archmage',
		name: 'Tower Archmage',
		family: 'arcane-hostiles',
		duty: 'Multi-phase commander',
		dutyCue: 'tall asymmetric mantle, orbiting geometry, and three distinct casting anchors',
		sizeBand: 'elite',
		telegraph: 'one orbit locks into a recognizable attack geometry before each school',
		weakPoint: 'active focus changes with the current phase'
	},
	{
		id: 'tunnel-spider',
		name: 'Tunnel Spider',
		family: 'arachnids',
		duty: 'Low flanker',
		dutyCue: 'flat body, long sprinting legs, and stone-dust camouflage',
		sizeBand: 'medium',
		telegraph: 'outer legs lower before a lateral rush',
		weakPoint: 'soft abdomen during a turn'
	},
	{
		id: 'web-caster',
		name: 'Web Caster',
		family: 'arachnids',
		duty: 'Ranged restraint',
		dutyCue: 'raised abdomen, braced rear legs, and visible silk spinnerets',
		sizeBand: 'medium',
		telegraph: 'abdomen tilts and a pale silk line traces the target zone',
		weakPoint: 'spinnerets after a cast'
	},
	{
		id: 'armored-brood-guard',
		name: 'Armored Brood Guard',
		family: 'arachnids',
		duty: 'Chokepoint tank',
		dutyCue: 'broad plated cephalothorax and short shield-like front legs',
		sizeBand: 'large',
		telegraph: 'front plates close before a straight shove',
		weakPoint: 'leg joints exposed from the side'
	},
	{
		id: 'giant-broodmother',
		name: 'Giant Broodmother',
		family: 'arachnids',
		duty: 'Spawner boss',
		dutyCue: 'enormous suspended abdomen, egg clusters, and a guarded central nest',
		sizeBand: 'boss',
		telegraph: 'one egg cluster pulses before hatching or bursting',
		weakPoint: 'abdomen underside while deploying brood'
	},
	{
		id: 'grave-sentinel',
		name: 'Grave Sentinel',
		family: 'undead',
		duty: 'Attrition defender',
		dutyCue: 'shield-first corpse in collapsed burial armor with rooted feet',
		sizeBand: 'human',
		telegraph: 'shield scrapes inward before a locking counter',
		weakPoint: 'exposed binding nails behind the shield'
	},
	{
		id: 'tower-wraith',
		name: 'Tower Wraith',
		family: 'undead',
		duty: 'Phasing pursuer',
		dutyCue: 'forward-drifting shroud, absent feet, and long grasping arms',
		sizeBand: 'human',
		telegraph: 'body thins to a black edge before passing through cover',
		weakPoint: 'solid mask during its grasp'
	},
	{
		id: 'bone-mage',
		name: 'Bone Mage',
		family: 'undead',
		duty: 'Ranged artillery',
		dutyCue: 'arched skeletal frame carrying a rib-like launch focus',
		sizeBand: 'human',
		telegraph: 'ribs spread and gather pale fragments into one visible trajectory',
		weakPoint: 'spinal binding while the ribs remain open'
	},
	{
		id: 'death-knight',
		name: 'Death Knight',
		family: 'undead',
		duty: 'Formation commander',
		dutyCue: 'disciplined armored corpse, command pennant, and deliberate sword guard',
		sizeBand: 'elite',
		telegraph: 'pennant and sword point issue the formation order before allies move',
		weakPoint: 'command seal beneath the gorget'
	},
	{
		id: 'cave-drake',
		name: 'Cave Drake',
		family: 'draconic',
		duty: 'Ambush brawler',
		dutyCue: 'wingless low dragon with digging shoulders and a battering skull',
		sizeBand: 'large',
		telegraph: 'stone dust lifts around its foreclaws before a tunnel lunge',
		weakPoint: 'soft throat after impact'
	},
	{
		id: 'venom-wyvern',
		name: 'Venom Wyvern',
		family: 'draconic',
		duty: 'Aerial poison striker',
		dutyCue: 'two-legged wing silhouette, hooked tail stinger, and narrow diving head',
		sizeBand: 'large',
		telegraph: 'tail sac brightens and wings fold before a toxic dive',
		weakPoint: 'stinger sac after discharge'
	},
	{
		id: 'armored-elder-drake',
		name: 'Armored Elder Drake',
		family: 'draconic',
		duty: 'Breath-line tank',
		dutyCue: 'heavy quadruped, overlapping mineral plates, and a furnace throat',
		sizeBand: 'boss',
		telegraph: 'neck plates spread and trace the breath lane with heat',
		weakPoint: 'plate gaps along the expanded neck'
	},
	{
		id: 'giant-tower-dragon',
		name: 'Giant Tower Dragon',
		family: 'draconic',
		duty: 'Arena-scale apex boss',
		dutyCue: 'immense four-legged winged silhouette shaped around tower-scale movement',
		sizeBand: 'apex',
		telegraph: 'wings, throat, and tail each stage a distinct arena hazard',
		weakPoint: 'resonance scars exposed only after a committed attack'
	},
	{
		id: 'hungry-mimic',
		name: 'Hungry Mimic',
		family: 'dungeon-predators',
		duty: 'Object ambusher',
		dutyCue: 'broken chest silhouette opening into weight-bearing jaws and grasping tongue',
		sizeBand: 'medium',
		telegraph: 'false hinges flex and dust falls before the object unfolds',
		weakPoint: 'inner hinge after a bite'
	},
	{
		id: 'slime-colony',
		name: 'Slime Colony',
		family: 'dungeon-predators',
		duty: 'Splitting floor hazard',
		dutyCue: 'low translucent colony with several dense cores and a wide wet footprint',
		sizeBand: 'medium',
		telegraph: 'cores separate and the outer membrane stretches before division',
		weakPoint: 'isolated dense cores'
	},
	{
		id: 'tower-basilisk',
		name: 'Tower Basilisk',
		family: 'dungeon-predators',
		duty: 'Gaze-lane controller',
		dutyCue: 'low reptile with a rigid crown of forward-facing mineral eyes',
		sizeBand: 'large',
		telegraph: 'eye crown aligns and paints a narrow petrification lane',
		weakPoint: 'blind flank and fragile eye crown'
	},
	{
		id: 'burrowing-worm',
		name: 'Burrowing Worm',
		family: 'dungeon-predators',
		duty: 'Ground-eruption disruptor',
		dutyCue: 'segmented stone-boring body, circular mouth, and no defended rear',
		sizeBand: 'boss',
		telegraph: 'a moving ridge and concentric floor cracks reveal the eruption path',
		weakPoint: 'soft rear segments after surfacing'
	}
] as const;

export type PackTwoMonsterId = (typeof PACK_TWO_MONSTER_ARCHETYPES)[number]['id'];

export const PACK_TWO_MONSTER_FAMILIES = [
	{
		id: 'elementals',
		name: 'Elemental manifestations',
		plate: 'elementals-v1',
		monsterIds: ['ember-wisp', 'stone-breaker', 'storm-stalker', 'frost-colossus']
	},
	{
		id: 'arcane-hostiles',
		name: 'Arcane hostiles',
		plate: 'arcane-hostiles-v1',
		monsterIds: ['hex-adept', 'ward-mage', 'tower-summoner', 'tower-archmage']
	},
	{
		id: 'arachnids',
		name: 'Arachnids',
		plate: 'arachnids-v1',
		monsterIds: ['tunnel-spider', 'web-caster', 'armored-brood-guard', 'giant-broodmother']
	},
	{
		id: 'undead',
		name: 'Bound undead',
		plate: 'undead-v1',
		monsterIds: ['grave-sentinel', 'tower-wraith', 'bone-mage', 'death-knight']
	},
	{
		id: 'draconic',
		name: 'Draconic escalation',
		plate: 'draconic-v1',
		monsterIds: ['cave-drake', 'venom-wyvern', 'armored-elder-drake', 'giant-tower-dragon']
	},
	{
		id: 'dungeon-predators',
		name: 'Dungeon predators',
		plate: 'dungeon-predators-v1',
		monsterIds: ['hungry-mimic', 'slime-colony', 'tower-basilisk', 'burrowing-worm']
	}
] as const satisfies readonly {
	readonly id: string;
	readonly name: string;
	readonly plate: string;
	readonly monsterIds: readonly PackTwoMonsterId[];
}[];

export const PACK_TWO_MONSTER_GRADE_VERSION = 'pack-two-monster-grades-v1';

export const PACK_TWO_MONSTER_GRADES = [
	{ grade: 1, levelMin: 1, levelMean: 7, levelMax: 13, title: 'Lurking' },
	{ grade: 2, levelMin: 9, levelMean: 16, levelMax: 23, title: 'Hardened' },
	{ grade: 3, levelMin: 18, levelMean: 26, levelMax: 34, title: 'Veteran' },
	{ grade: 4, levelMin: 29, levelMean: 38, levelMax: 47, title: 'Elite' },
	{ grade: 5, levelMin: 40, levelMean: 51, levelMax: 62, title: 'Dire' },
	{ grade: 6, levelMin: 53, levelMean: 65, levelMax: 77, title: 'Tyrant' },
	{ grade: 7, levelMin: 67, levelMean: 80, levelMax: 93, title: 'Cataclysmic' },
	{ grade: 8, levelMin: 82, levelMean: 96, levelMax: 110, title: 'Mythic' },
	{ grade: 9, levelMin: 99, levelMean: 114, levelMax: 129, title: 'Calamity' },
	{ grade: 10, levelMin: 117, levelMean: 134, levelMax: 151, title: 'Tower-ending' }
] as const;

export type PackTwoMonsterGrade = (typeof PACK_TWO_MONSTER_GRADES)[number]['grade'];
export type PackTwoMonsterFamily = (typeof PACK_TWO_MONSTER_ARCHETYPES)[number]['family'];

export interface PackTwoMonsterVariant {
	readonly variantVersion: typeof PACK_TWO_MONSTER_GRADE_VERSION;
	readonly archetypeId: PackTwoMonsterId;
	readonly family: PackTwoMonsterFamily;
	readonly grade: PackTwoMonsterGrade;
	readonly gradeTitle: string;
	readonly level: number;
	readonly levelBand: { readonly min: number; readonly mean: number; readonly max: number };
	readonly sizeScale: number;
	readonly massScale: number;
	readonly musculatureScale: number;
	readonly ferocityScale: number;
	readonly magicGlowScale: number;
	readonly weaponScale: number;
	readonly mutationCount: number;
	readonly escalationCues: readonly string[];
}

function monsterHash32(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function monsterRandom(seed: string): () => number {
	let state = monsterHash32(seed);
	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function scale(value: number): number {
	return Number(value.toFixed(2));
}

const familyEscalation: Record<PackTwoMonsterFamily, readonly [string, string, string]> = {
	elementals: [
		'larger elemental body and denser core',
		'brighter binding seams and wider environmental wake',
		'arena-scale weather or terrain deformation'
	],
	'arcane-hostiles': [
		'more elaborate focus and controlled aura',
		'additional orbiting spell geometry',
		'multiple simultaneous casting anchors'
	],
	arachnids: [
		'larger abdomen and thicker load-bearing legs',
		'denser carapace, silk output, or brood payload',
		'nest-scale webbing and reinforced weak-point guards'
	],
	undead: [
		'denser spectral binding or heavier burial armor',
		'larger command weapon and stronger death-light',
		'legion-scale aura with layered binding seals'
	],
	draconic: [
		'larger frame, deeper musculature, and longer horns',
		'thicker plates, broader wings, and brighter breath organs',
		'arena-scale breath, tail, and wing hazards'
	],
	'dungeon-predators': [
		'larger feeding body and more visible predatory anatomy',
		'additional cores, teeth, eyes, or armor plates',
		'arena-scale burrow, split, gaze, or ambush footprint'
	]
};

function isMagicDuty(family: PackTwoMonsterFamily, duty: string): boolean {
	return (
		family === 'arcane-hostiles' || /\b(mage|summoner|wraith|artillery|zone|gaze)\b/iu.test(duty)
	);
}

function isWeaponDuty(duty: string): boolean {
	return /\b(bruiser|tank|defender|commander|brawler|guard|knight|sentinel)\b/iu.test(duty);
}

export function createPackTwoMonsterVariant(
	archetypeId: PackTwoMonsterId,
	grade: PackTwoMonsterGrade,
	seed: string
): PackTwoMonsterVariant {
	const archetype = PACK_TWO_MONSTER_ARCHETYPES.find((candidate) => candidate.id === archetypeId);
	if (!archetype) throw new Error(`Unknown Pack 2 monster archetype: ${archetypeId}`);
	const gradeProfile = PACK_TWO_MONSTER_GRADES.find((candidate) => candidate.grade === grade);
	if (!gradeProfile) throw new Error(`Unknown Pack 2 monster grade: ${grade}`);
	const random = monsterRandom(
		`${PACK_TWO_MONSTER_GRADE_VERSION}\u0000${archetypeId}\u0000${grade}\u0000${seed}`
	);
	const triangular = (random() + random()) / 2;
	const level = Math.round(
		gradeProfile.levelMin + triangular * (gradeProfile.levelMax - gradeProfile.levelMin)
	);
	const magicDuty = isMagicDuty(archetype.family, archetype.duty);
	const weaponDuty = isWeaponDuty(archetype.duty);
	const sizeJitter = (random() - 0.5) * 0.08;
	const sizeScale = scale(0.72 + grade * 0.13 + sizeJitter);
	const musculatureScale = scale(
		0.78 + grade * (magicDuty ? 0.055 : 0.115) + (random() - 0.5) * 0.06
	);
	const magicGlowScale = scale(0.75 + grade * (magicDuty ? 0.26 : 0.1) + (random() - 0.5) * 0.08);
	const weaponScale = scale(0.78 + grade * (weaponDuty ? 0.15 : 0.065) + (random() - 0.5) * 0.06);
	const cueCount = grade >= 9 ? 3 : grade >= 6 ? 2 : 1;

	return {
		variantVersion: PACK_TWO_MONSTER_GRADE_VERSION,
		archetypeId,
		family: archetype.family,
		grade,
		gradeTitle: gradeProfile.title,
		level,
		levelBand: {
			min: gradeProfile.levelMin,
			mean: gradeProfile.levelMean,
			max: gradeProfile.levelMax
		},
		sizeScale,
		massScale: scale(sizeScale ** 2.55),
		musculatureScale,
		ferocityScale: scale(0.7 + grade * 0.145 + (random() - 0.5) * 0.08),
		magicGlowScale,
		weaponScale,
		mutationCount: Math.max(0, Math.min(5, Math.floor((grade - 2 + random() * 2) / 2))),
		escalationCues: familyEscalation[archetype.family].slice(0, cueCount)
	};
}

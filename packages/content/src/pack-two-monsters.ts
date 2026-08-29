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
		name: 'Tower arachnids',
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

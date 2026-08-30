import {
	ImageProductionExpansionTargetSchema,
	type ImageProductionExpansionSpecies,
	type ImageProductionExpansionTarget,
	type ImageProductionReference
} from '@summonlab/contracts';

import { AFFINITY_DEFINITIONS, AFFINITY_IDS, type AffinityId } from './affinity-workflow.js';
import { ENEMY_ARCHETYPES, ENEMY_REVIEW_FAMILIES } from './enemy-roster.js';
import { PACK_TWO_MONSTER_ARCHETYPES, PACK_TWO_MONSTER_FAMILIES } from './pack-two-monsters.js';

export const ENEMY_AFFINITY_EXPANSION_VERSION = 'affinity-expansion-v1';

export const ENEMY_AFFINITY_EXPANSION_SPECIES_IDS = [
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
] as const satisfies readonly ImageProductionExpansionSpecies[];

export type EnemyAffinityExpansionSpeciesId = (typeof ENEMY_AFFINITY_EXPANSION_SPECIES_IDS)[number];

type ConstructionMode = ImageProductionExpansionTarget['constructionMode'];

const CONSTRUCTION_MODE_BY_SPECIES = {
	'goblin-skirmisher': 'humanoid-enemy',
	'goblin-archer': 'humanoid-enemy',
	'goblin-hexweaver': 'humanoid-enemy',
	'goblin-chieftain': 'humanoid-enemy',
	'dire-wolf': 'organic-quadruped',
	'ember-wisp': 'substance-bodied',
	'stone-breaker': 'substance-bodied',
	'storm-stalker': 'substance-bodied',
	'frost-colossus': 'substance-bodied',
	'clay-golem': 'constructed-humanoid',
	'stone-golem': 'constructed-humanoid',
	'iron-sentinel': 'constructed-humanoid',
	'crystal-guardian': 'constructed-humanoid',
	'grave-sentinel': 'armored-undead',
	'tower-wraith': 'incorporeal-undead',
	'bone-mage': 'skeletal-undead',
	'venom-wyvern': 'winged-draconic',
	'armored-elder-drake': 'draconic-quadruped',
	'giant-tower-dragon': 'winged-draconic',
	'hungry-mimic': 'object-bodied',
	'slime-colony': 'amorphous-colony',
	'burrowing-worm': 'limbless-segmented',
	'ogoblin-brute': 'giant-humanoid',
	'cave-troll': 'giant-humanoid',
	'hill-giant': 'giant-humanoid',
	'frost-giant': 'giant-humanoid',
	'hex-adept': 'humanoid-enemy',
	'ward-mage': 'humanoid-enemy',
	'tower-summoner': 'humanoid-enemy',
	'tower-archmage': 'humanoid-enemy',
	'tunnel-spider': 'eight-legged-arachnid',
	'web-caster': 'eight-legged-arachnid',
	'armored-brood-guard': 'eight-legged-arachnid',
	'giant-broodmother': 'eight-legged-arachnid'
} as const satisfies Record<EnemyAffinityExpansionSpeciesId, ConstructionMode>;

const ANATOMY_BY_MODE = {
	'humanoid-enemy': [
		'adult humanoid biped with exactly two arms and two legs',
		'credible hands, feet, joints, equipment grip, and grounded weight'
	],
	'organic-quadruped': [
		'exactly four legs with credible animal joints and paw contact',
		'coherent head, shoulders, spine, tail, and quadrupedal weight distribution'
	],
	'substance-bodied': [
		'one coherent declared elemental body plan around one readable core',
		'affinity material forms every load-bearing mass, joint, or directional wake'
	],
	'constructed-humanoid': [
		'exactly two articulated arms and two load-bearing legs',
		'one coherent controlling core with credible manufactured joints and ground contact'
	],
	'armored-undead': [
		'humanoid corpse with exactly two arms and two legs',
		'believable armor load paths, weapon grip, and grounded military stance'
	],
	'incorporeal-undead': [
		'one continuous spectral torso, two arms, and a tapering footless shroud',
		'solid mask and grasping hands remain connected to the phasing body'
	],
	'skeletal-undead': [
		'humanoid skeleton with exactly two arms and two legs',
		'coherent skull, spine, rib focus, hand articulation, and grounded stance'
	],
	'winged-draconic': [
		'the declared wyvern or dragon limb plan remains exact, complete, and countable',
		'connected head, neck, torso, tail, wing joints, and every grounded foot remain visible'
	],
	'draconic-quadruped': [
		'exactly four grounded legs and no wings',
		'credible draconic shoulders, neck, plate gaps, tail balance, and ground contact'
	],
	'object-bodied': [
		'one chest-like object body with connected lid, hinges, weight-bearing jaws, and tongue',
		'one coherent ambush creature rather than an object beside a separate monster'
	],
	'amorphous-colony': [
		'one connected low colony body containing several distinct dense cores',
		'continuous translucent membrane and one coherent wet ground footprint'
	],
	'limbless-segmented': [
		'one continuous limbless segmented body with a circular mouth and tapered rear',
		'credible weight, compression, and ground contact along the visible body'
	],
	'giant-humanoid': [
		'giant humanoid biped with exactly two arms and two legs',
		'credible hands, feet, joints, scale-bearing posture, and grounded weight'
	],
	'eight-legged-arachnid': [
		'exactly eight connected legs in four coherent pairs, all feet visible',
		'one connected cephalothorax and abdomen with credible joints and ground contact'
	]
} as const satisfies Record<ConstructionMode, readonly [string, string]>;

const PROHIBITED_BY_MODE = {
	'humanoid-enemy': ['childlike proportions', 'human glamour or sexualization', 'extra limbs'],
	'organic-quadruped': ['humanoid posture or armor', 'antlers or wings', 'extra or missing legs'],
	'substance-bodied': ['ordinary armored humanoid', 'decorative affinity overlay', 'extra limbs'],
	'constructed-humanoid': [
		'living human anatomy',
		'decorative affinity coating',
		'extra or missing limbs'
	],
	'armored-undead': ['living healthy face', 'random giant horns', 'implausibly oversized weapon'],
	'incorporeal-undead': [
		'ordinary robed living human',
		'separate duplicate ghost',
		'solid booted legs'
	],
	'skeletal-undead': [
		'living human face',
		'unconnected floating bones',
		'oversized unreadable spell effects'
	],
	'winged-draconic': ['wrong declared limb plan', 'extra wings or limbs', 'cropped tail or wings'],
	'draconic-quadruped': [
		'wyvern limb plan',
		'extra or missing legs',
		'hidden throat and plate counterplay'
	],
	'object-bodied': ['separate chest and monster', 'humanoid limbs', 'weightless disconnected jaws'],
	'amorphous-colony': [
		'humanoid face or limbs',
		'single featureless blob',
		'disconnected duplicate slimes'
	],
	'limbless-segmented': ['legs or wings', 'separate duplicate worm', 'hidden circular mouth'],
	'giant-humanoid': ['ordinary human scale', 'extra limbs', 'cropped hands, feet, or weapon'],
	'eight-legged-arachnid': [
		'six or ten legs',
		'humanoid face or hands',
		'detached legs or duplicate spider'
	]
} as const satisfies Record<ConstructionMode, readonly string[]>;

const PACK_ONE_VISUAL_CUES = {
	'goblin-skirmisher': 'lean mobile knife fighter with light layered scavenged clothing',
	'goblin-archer': 'ranged shortbow hunter with quiver, braced draw, and lane-reading posture',
	'goblin-hexweaver':
		'goblin caster with a compact ritual focus, binding marks, and open casting hand',
	'goblin-chieftain':
		'broad command silhouette with rally standard, heavy cleaver, and layered trophies',
	'dire-wolf':
		'large scarred pursuit wolf with long stride, heavy neck, and relentless forward posture',
	'clay-golem': 'broad hand-shaped clay guardian with compression seams and a reforming core',
	'stone-golem': 'quarry-stone defender with blocky guard plates and ground-slam weight',
	'iron-sentinel':
		'disciplined forged guardian with shielded stance and counter-attacking weapon guard',
	'crystal-guardian': 'faceted reflective construct organized around one exposed refracting core',
	'ogoblin-brute':
		'towering goblinoid bruiser with sweeping weapon, massive grip, and restraint-breaking mass',
	'cave-troll':
		'long-reach regenerating cave giant with raw hide, hunched shoulders, and powerful hands',
	'hill-giant':
		'arena-scale giant with stone maul, debris-ready off-hand, and displacement posture',
	'frost-giant':
		'ancient commanding giant with cold-weather layers, old iron, and whiteout authority'
} as const;

const FAMILY_REFERENCES = {
	goblinoids: {
		path: 'assets/enemies/review/goblinoids-v1.webp',
		contentHash: '7ba41d4405a752cbb19fb533a50c8b79b5ae60aa0b2aa8438afca7ce01781a32'
	},
	beasts: {
		path: 'assets/enemies/review/beasts-v1.webp',
		contentHash: 'd15b5b5e714076756e769ecdbb3b10c92bc9abf1e76bbf8094fd32537d47cc33'
	},
	constructs: {
		path: 'assets/enemies/review/constructs-v1.webp',
		contentHash: '01effbc663d3524aae462c32e472d119694f5c5f3242b82065cff6c267de2510'
	},
	'large-threats': {
		path: 'assets/enemies/review/large-threats-v1.webp',
		contentHash: 'd3349cd6590f769176c43144710fe35f4c9066853e236f37ef6ea84d531b416a'
	},
	elementals: {
		path: 'assets/enemies/review/pack-2/elementals-v1.png',
		contentHash: '54e0d1eaa6fe6af23fe8ef2e33b1d4f6893f964561502cf47fc43e7013d63786'
	},
	'arcane-hostiles': {
		path: 'assets/enemies/review/pack-2/arcane-hostiles-v1.png',
		contentHash: '18ece7c8c6b2d8a9a8a302e8afb66a2b1a3a01f0620e7786641de1b7a24e3c54'
	},
	arachnids: {
		path: 'assets/enemies/review/pack-2/arachnids-v1.png',
		contentHash: '45c2db02819964019a3d6b0640afc0e5d2d76b9d70e558d03ac24be3e909e604'
	},
	undead: {
		path: 'assets/enemies/review/pack-2/undead-v1.png',
		contentHash: '42fce852b38fe644311b6ae3cd78e38d880ce2192b6db7b5d19ea08ac61fd0aa'
	},
	draconic: {
		path: 'assets/enemies/review/pack-2/draconic-v1.png',
		contentHash: 'b340bb2b59fd697d4de3c49a90724ca43b4e734402510e9a279410baf65b30f9'
	},
	'dungeon-predators': {
		path: 'assets/enemies/review/pack-2/dungeon-predators-v1.png',
		contentHash: 'f30b1130a71a00166acc4299b982c9fadf9b143c95741fea5c9e5cef4d3c9d7e'
	}
} as const;

const STYLE_REFERENCE: ImageProductionReference = {
	path: 'assets/enemies/review/pack-2/monster-grade-escalation-v1.png',
	contentHash: '622a63ea55ab833f0451d29f0967f26f2335c912296ad45537e2a0889c8ecd2e',
	purpose:
		'Pack 2 realistic dark-fantasy finish, neutral presentation, material fidelity, and restrained emission only; do not transfer another species, anatomy, weapon, or scale'
};

const SHARED_PRESENTATION = {
	styleContract:
		'Pack 2 premium realistic painterly dark fantasy with coherent materials, controlled linework, grounded anatomy, distinct species identity, and restrained local magical emission.',
	medium: 'premium realistic painterly raster creature concept',
	lighting: 'controlled neutral key with restrained local affinity emission and readable materials',
	background: 'neutral cracked-stone floor against a charcoal-to-midnight backdrop',
	composition:
		'Exactly one subject; entire creature, equipment, wings, tail, and every extremity visible, centered with finished detail across the canvas.',
	canvas: { width: 1536, height: 1024, mediaType: 'image/png', safeMarginPercent: 8 },
	negativePrompt: [
		'No labels, text, UI, frame, logo, or watermark.',
		'No extra creature, duplicate body, cropped extremity, blank band, unfinished region, or abrupt canvas cutoff.',
		'No resemblance to a published character or reference person.',
		'No sexualized anatomy, costume, or pose.'
	]
} as const;

function canonicalEntry(speciesId: EnemyAffinityExpansionSpeciesId) {
	const packOne = ENEMY_ARCHETYPES.find((entry) => entry.id === speciesId) as
		(typeof ENEMY_ARCHETYPES)[number] | undefined;
	if (packOne) {
		const family = ENEMY_REVIEW_FAMILIES.find((entry) => entry.id === packOne.family)!;
		const visualCue = PACK_ONE_VISUAL_CUES[speciesId as keyof typeof PACK_ONE_VISUAL_CUES];
		if (!visualCue) throw new Error(`Missing Pack 1 visual cue: ${speciesId}`);
		return {
			pack: 'pack-1' as const,
			name: packOne.name,
			familyId: packOne.family,
			ordinal: (family.enemyIds as readonly string[]).indexOf(packOne.id) + 1,
			duty: packOne.role,
			visualCue,
			telegraph: `Signature skills remain visually supportable: ${packOne.skills.join(', ')}.`,
			counterplay: `The still image preserves readable counterplay for ${packOne.teaches.join(', ')}.`
		};
	}
	const packTwo = PACK_TWO_MONSTER_ARCHETYPES.find((entry) => entry.id === speciesId) as
		(typeof PACK_TWO_MONSTER_ARCHETYPES)[number] | undefined;
	if (!packTwo) throw new Error(`Unknown expansion species: ${speciesId}`);
	const family = PACK_TWO_MONSTER_FAMILIES.find((entry) => entry.id === packTwo.family)!;
	return {
		pack: 'pack-2' as const,
		name: packTwo.name,
		familyId: packTwo.family,
		ordinal: (family.monsterIds as readonly string[]).indexOf(packTwo.id) + 1,
		duty: packTwo.duty,
		visualCue: packTwo.dutyCue,
		telegraph: packTwo.telegraph,
		counterplay: packTwo.weakPoint
	};
}

function referencesFor(speciesId: EnemyAffinityExpansionSpeciesId): ImageProductionReference[] {
	const entry = canonicalEntry(speciesId);
	const familyReference = FAMILY_REFERENCES[entry.familyId];
	const references: ImageProductionReference[] = [
		{
			...familyReference,
			purpose: `Subject ${entry.ordinal} only: ${entry.name} identity, anatomy, duty silhouette, and material language; do not transfer another family member`
		},
		STYLE_REFERENCE
	];
	if (speciesId === 'stone-breaker') {
		references.push({
			path: 'assets/enemies/review/pack-2/benchmarks/stone-breaker-anchor-v1.png',
			contentHash: '60f46984679fe5f1bb16d2277b1d1aa7c6ca943f810d22e5dfe0ad82717f92c0',
			purpose:
				'Individual Stone Breaker framing, wedge forearms, grounded quarry mass, and readable core only'
		});
	}
	return references;
}

export function createEnemyAffinityExpansionTarget(
	speciesId: EnemyAffinityExpansionSpeciesId,
	affinityId: AffinityId
): ImageProductionExpansionTarget {
	const entry = canonicalEntry(speciesId);
	const affinity = AFFINITY_DEFINITIONS.find((candidate) => candidate.id === affinityId);
	if (!affinity) throw new Error(`Unknown affinity: ${affinityId}`);
	const constructionMode = CONSTRUCTION_MODE_BY_SPECIES[speciesId];
	const targetId = `${ENEMY_AFFINITY_EXPANSION_VERSION}-${speciesId}-${affinityId}`;
	return ImageProductionExpansionTargetSchema.parse({
		schemaVersion: 'image-production-target-v2',
		targetId,
		assetId: targetId,
		packId: 'affinity-expansion',
		experimentId: ENEMY_AFFINITY_EXPANSION_VERSION,
		promptProtocol: 'safe-frame-v4',
		authoringProtocol: 'semantic-v2',
		cohort: 'breadth',
		speciesId,
		affinity: affinityId,
		affinityDesign: {
			alteredDimensions: [...affinity.alteredDimensions],
			expression: affinity.construction,
			counterplayCue:
				affinityId === 'normal'
					? entry.counterplay
					: `${entry.counterplay} ${affinity.counterplayCue}`
		},
		threat: {
			presentationTier:
				speciesId === 'giant-tower-dragon' || speciesId === 'giant-broodmother'
					? 'apex'
					: entry.pack === 'pack-2'
						? 'elite'
						: 'standard',
			referenceGrade: 4,
			canonicalGrade: entry.pack === 'pack-2' ? 4 : null
		},
		battlefieldDutyId: `${speciesId}-duty`,
		constructionMode,
		identityInvariants: [
			`${entry.name} remains immediately recognizable`,
			`Battlefield duty remains ${entry.duty}`,
			entry.visualCue,
			entry.telegraph,
			`Counterplay remains visible: ${entry.counterplay}`
		],
		anatomyInvariants: [...ANATOMY_BY_MODE[constructionMode]],
		permittedTransformations: [...affinity.permittedTransformations],
		prohibitedTraits: [...PROHIBITED_BY_MODE[constructionMode], affinity.reject],
		references: referencesFor(speciesId),
		presentation: SHARED_PRESENTATION,
		acceptanceCriteria: [
			{
				criterionId: 'complete-safe-frame',
				kind: 'objective',
				description:
					'Entire silhouette, equipment, wings, tail, and every extremity are complete with at least eight percent safe margin.',
				required: true
			},
			{
				criterionId: 'single-finished-subject',
				kind: 'objective',
				description:
					'Exactly one subject appears and every canvas region is intentionally finished.',
				required: true
			},
			{
				criterionId: 'protocol-provenance',
				kind: 'objective',
				description:
					'The first submitted prompt exactly matches the canonical renderer and retained provenance is complete.',
				required: true
			},
			{
				criterionId: 'manifest-fidelity',
				kind: 'objective',
				description:
					'Every identity, anatomy, duty, counterplay, and prohibited-trait invariant is visibly satisfied.',
				required: true
			},
			{
				criterionId:
					affinityId === 'normal'
						? 'normal-unaffiliated-fidelity'
						: 'affinity-construction-fidelity',
				kind: 'objective',
				description:
					affinityId === 'normal'
						? 'The subject is explicitly unaffiliated, without elemental material, glow, anatomy, or wake.'
						: 'The affinity visibly changes at least two declared construction dimensions rather than acting as a color overlay.',
				required: true
			},
			...(affinityId === 'normal'
				? []
				: [
						{
							criterionId: 'visible-counterplay-cue',
							kind: 'objective' as const,
							description:
								'The declared weak point or counterplay state remains readable through the affinity transformation.',
							required: true
						}
					]),
			{
				criterionId: 'blind-species-identity',
				kind: 'human-review',
				description: 'A blind reviewer recognizes the exact archetype without seeing its label.',
				required: true
			},
			{
				criterionId: 'blind-affinity-integration',
				kind: 'human-review',
				description:
					affinityId === 'normal'
						? 'A blind reviewer reads the subject as unaffiliated.'
						: 'A blind reviewer recognizes the affinity through multiple visual dimensions.',
				required: true
			}
		],
		output: {
			candidatePath: `assets/enemies/experiments/${ENEMY_AFFINITY_EXPANSION_VERSION}/candidates/${speciesId}/${affinityId}-v1.png`,
			resultPath: `assets/enemies/experiments/${ENEMY_AFFINITY_EXPANSION_VERSION}/results/${speciesId}-${affinityId}-v1.json`
		}
	});
}

export const ENEMY_AFFINITY_EXPANSION_TARGETS = ENEMY_AFFINITY_EXPANSION_SPECIES_IDS.flatMap(
	(speciesId) =>
		AFFINITY_IDS.map((affinityId) => createEnemyAffinityExpansionTarget(speciesId, affinityId))
);

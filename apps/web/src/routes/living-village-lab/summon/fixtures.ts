import daraAnchor from '../village/cutouts/dara-zev.png';
import ivenAnchor from '../village/cutouts/iven-orra.png';
import joriAnchor from '../village/cutouts/jori-daro.png';
import kiraAnchor from '../village/cutouts/kira-toren.png';
import maraAnchor from '../village/cutouts/mara-vey.png';
import remyAnchor from '../village/cutouts/remy-nahl.png';

export type HeroId = 'dara' | 'mara' | 'jori' | 'kira' | 'iven' | 'remy';
export type RevealDirection = 'gate' | 'constellation' | 'identity';
export type OfferMode = 'single' | 'batch';
export type AffinityIcon = 'ember' | 'tide' | 'gale' | 'grove';
export type AptitudeClass = 'martial' | 'magic' | 'crafting';

export type AttributeName = 'Strength' | 'Agility' | 'Vitality' | 'Magic';

export type AttributeReadiness = {
	name: AttributeName;
	value: number;
};

export type PersonalityProfile = {
	traits: readonly string[];
	value: string;
	drive: string;
	socialStyle: string;
	stressResponse: string;
	tendency: string;
};

export type HeroFixture = {
	id: HeroId;
	name: string;
	identityLine: string;
	affinity: string;
	affinityIcon: AffinityIcon;
	calling: string;
	stars: number;
	image: string;
	attributes: readonly AttributeReadiness[];
	personality: PersonalityProfile;
	aptitudes: readonly { name: string; class: AptitudeClass }[];
};

export type RevealDirectionFixture = {
	id: RevealDirection;
	label: string;
	shortLabel: string;
	description: string;
};

const attributes = (
	strength: number,
	agility: number,
	vitality: number,
	magic: number
): readonly AttributeReadiness[] => [
	{ name: 'Strength', value: strength },
	{ name: 'Agility', value: agility },
	{ name: 'Vitality', value: vitality },
	{ name: 'Magic', value: magic }
];

export const heroes: readonly HeroFixture[] = [
	{
		id: 'dara',
		name: 'Dara Zev',
		identityLine: 'A watchful pathfinder who reads danger before it arrives.',
		affinity: 'Tide',
		affinityIcon: 'tide',
		calling: 'Pathfinder',
		stars: 1,
		image: daraAnchor,
		attributes: attributes(46, 78, 52, 57),
		personality: {
			traits: ['Observant', 'Self-contained', 'Adaptable'],
			value: 'Preparedness',
			drive: 'Find the safe path before others must risk it',
			socialStyle: 'Quiet, direct, attentive',
			stressResponse: 'Narrows focus and checks every exit',
			tendency: 'Measured risk · situational lead'
		},
		aptitudes: [
			{ name: 'Ranged', class: 'martial' },
			{ name: 'Body', class: 'martial' },
			{ name: 'Knowledge', class: 'crafting' }
		]
	},
	{
		id: 'mara',
		name: 'Mara Vey',
		identityLine: 'A guarded ember-bearer who holds the line when others falter.',
		affinity: 'Ember',
		affinityIcon: 'ember',
		calling: 'Vanguard',
		stars: 1,
		image: maraAnchor,
		attributes: attributes(72, 58, 82, 76),
		personality: {
			traits: ['Guarded', 'Steadfast', 'Exacting'],
			value: 'Reliability',
			drive: 'Be the person who does not yield',
			socialStyle: 'Reserved, candid, protective',
			stressResponse: 'Takes position and carries the pressure',
			tendency: 'Low risk · decisive under threat'
		},
		aptitudes: [
			{ name: 'Shield', class: 'martial' },
			{ name: 'Elemental', class: 'magic' },
			{ name: 'Body', class: 'martial' }
		]
	},
	{
		id: 'jori',
		name: 'Jori Daro',
		identityLine: 'A formal wardkeeper with an instinct for quiet protection.',
		affinity: 'Tide',
		affinityIcon: 'tide',
		calling: 'Wardkeeper',
		stars: 1,
		image: joriAnchor,
		attributes: attributes(68, 49, 77, 74),
		personality: {
			traits: ['Formal', 'Patient', 'Conscientious'],
			value: 'Stewardship',
			drive: 'Leave people safer than they were found',
			socialStyle: 'Courteous, structured, reassuring',
			stressResponse: 'Builds order and absorbs uncertainty',
			tendency: 'Low risk · consensus lead'
		},
		aptitudes: [
			{ name: 'Ward', class: 'magic' },
			{ name: 'Knowledge', class: 'crafting' },
			{ name: 'Restoration', class: 'magic' }
		]
	},
	{
		id: 'kira',
		name: 'Kira Toren',
		identityLine: 'A grounded envoy who turns careful attention into leverage.',
		affinity: 'Gale',
		affinityIcon: 'gale',
		calling: 'Envoy',
		stars: 2,
		image: kiraAnchor,
		attributes: attributes(55, 51, 70, 73),
		personality: {
			traits: ['Grounded', 'Perceptive', 'Deliberate'],
			value: 'Reciprocity',
			drive: 'Turn attention into durable agreement',
			socialStyle: 'Warm, economical, difficult to rush',
			stressResponse: 'Slows the room and tests assumptions',
			tendency: 'Balanced risk · diplomatic lead'
		},
		aptitudes: [
			{ name: 'Mind', class: 'magic' },
			{ name: 'Knowledge', class: 'crafting' },
			{ name: 'Enchantment', class: 'magic' }
		]
	},
	{
		id: 'iven',
		name: 'Iven Orra',
		identityLine: 'A precise ritual reader who notices the pattern beneath the noise.',
		affinity: 'Grove',
		affinityIcon: 'grove',
		calling: 'Ritualist',
		stars: 2,
		image: ivenAnchor,
		attributes: attributes(38, 57, 48, 84),
		personality: {
			traits: ['Precise', 'Curious', 'Composed'],
			value: 'Understanding',
			drive: 'Make hidden systems legible',
			socialStyle: 'Formal, thoughtful, gently corrective',
			stressResponse: 'Returns to first principles and pattern',
			tendency: 'Measured risk · technical lead'
		},
		aptitudes: [
			{ name: 'Ward', class: 'magic' },
			{ name: 'Enchantment', class: 'magic' },
			{ name: 'Knowledge', class: 'crafting' }
		]
	},
	{
		id: 'remy',
		name: 'Remy Nahl',
		identityLine: 'An open-hearted skirmisher with a patient eye for openings.',
		affinity: 'Ember',
		affinityIcon: 'ember',
		calling: 'Skirmisher',
		stars: 3,
		image: remyAnchor,
		attributes: attributes(62, 86, 64, 69),
		personality: {
			traits: ['Open-hearted', 'Patient', 'Playful'],
			value: 'Mutual trust',
			drive: 'Create the opening everyone can use',
			socialStyle: 'Easy, attentive, quietly encouraging',
			stressResponse: 'Stays mobile and keeps others connected',
			tendency: 'High risk · emergent lead'
		},
		aptitudes: [
			{ name: 'Blade', class: 'martial' },
			{ name: 'Body', class: 'martial' },
			{ name: 'Ranged', class: 'martial' }
		]
	}
] as const;

export const featuredHero = heroes[1]!;

export const batchReceipt: readonly HeroFixture[] = [
	heroes[1]!,
	heroes[3]!,
	heroes[0]!,
	heroes[5]!,
	heroes[2]!,
	heroes[4]!,
	heroes[1]!,
	heroes[0]!,
	heroes[2]!,
	heroes[5]!,
	heroes[3]!
] as const;

export const revealDirections: readonly RevealDirectionFixture[] = [
	{
		id: 'gate',
		label: 'Gate ignition',
		shortLabel: 'Gate',
		description: 'Portal charge, crossing silhouette, then identity and mechanics.'
	},
	{
		id: 'constellation',
		label: 'Constellation assembly',
		shortLabel: 'Constellation',
		description: 'Affinity and aptitude marks gather into a person before the portrait.'
	},
	{
		id: 'identity',
		label: 'Immediate identity',
		shortLabel: 'Identity first',
		description: 'Portrait first, restrained parallax, then staged details.'
	}
] as const;

export const wallets = [
	{
		id: 'sigil',
		label: 'Gate sigils',
		balance: 7,
		kind: 'earned' as const,
		glyph: 'sigil' as const
	},
	{
		id: 'gem',
		label: 'Hearth gems',
		balance: 2480,
		kind: 'premium' as const,
		glyph: 'gem' as const
	}
] as const;

export const rates = [
	{ band: '1★ arrival', value: '79.0%', note: 'Prototype fixture' },
	{ band: '2★ arrival', value: '18.0%', note: 'Prototype fixture' },
	{ band: '3★ arrival', value: '3.0%', note: 'Prototype fixture' }
] as const;

export const guarantee = {
	current: 14,
	threshold: 30,
	label: '3★ arrival guaranteed by',
	status: 'Prototype fixture'
} as const;

export const offers = {
	single: {
		mode: 'single' as const,
		label: 'Summon ×1',
		cost: '1 Gate sigil or 160 gems',
		resultCount: 1,
		bonusCount: 0
	},
	batch: {
		mode: 'batch' as const,
		label: 'Summon ×10 + 1 bonus',
		cost: '1,600 gems',
		resultCount: 11,
		bonusCount: 1
	}
} as const;

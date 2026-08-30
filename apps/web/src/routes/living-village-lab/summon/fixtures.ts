import daraAnchor from '../../../../../../assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png';
import maraAnchor from '../../../../../../assets/heroes/ember-01-anchor-v1.png';
import joriAnchor from '../../../../../../assets/heroes/visuals/owner-playtest-v1/jori-daro-anchor-v1.png';
import kiraAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/kira-toren-anchor-v1.png';
import ivenAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/iven-orra-anchor-v1.png';
import remyAnchor from '../../../../../../assets/heroes/visuals/hearth-02-anchor-v1.png';

export type HeroId = 'dara' | 'mara' | 'jori' | 'kira' | 'iven' | 'remy';
export type RevealDirection = 'gate' | 'constellation' | 'identity';
export type OfferMode = 'single' | 'batch';
export type AffinityIcon = 'ember' | 'tide' | 'gale' | 'grove';
export type AptitudeClass = 'martial' | 'magic' | 'crafting';

export type AttributeName = 'Might' | 'Vitality' | 'Agility' | 'Dexterity' | 'Intellect' | 'Spirit';

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
	recognitionTarget: string;
};

const attributes = (
	might: number,
	vitality: number,
	agility: number,
	dexterity: number,
	intellect: number,
	spirit: number
): readonly AttributeReadiness[] => [
	{ name: 'Might', value: might },
	{ name: 'Vitality', value: vitality },
	{ name: 'Agility', value: agility },
	{ name: 'Dexterity', value: dexterity },
	{ name: 'Intellect', value: intellect },
	{ name: 'Spirit', value: spirit }
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
		attributes: attributes(46, 52, 78, 72, 66, 57),
		personality: {
			traits: ['Observant', 'Self-contained', 'Adaptable'],
			value: 'Preparedness',
			drive: 'Find the safe path before others must risk it',
			socialStyle: 'Quiet, direct, attentive',
			stressResponse: 'Narrows focus and checks every exit',
			tendency: 'Measured risk · situational lead'
		},
		aptitudes: [
			{ name: 'Wayfinding', class: 'martial' },
			{ name: 'Fieldcraft', class: 'crafting' },
			{ name: 'Bow practice', class: 'martial' }
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
		attributes: attributes(72, 82, 58, 61, 54, 76),
		personality: {
			traits: ['Guarded', 'Steadfast', 'Exacting'],
			value: 'Reliability',
			drive: 'Be the person who does not yield',
			socialStyle: 'Reserved, candid, protective',
			stressResponse: 'Takes position and carries the pressure',
			tendency: 'Low risk · decisive under threat'
		},
		aptitudes: [
			{ name: 'Shieldwork', class: 'martial' },
			{ name: 'Ember control', class: 'magic' },
			{ name: 'Formation', class: 'martial' }
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
		attributes: attributes(68, 77, 49, 65, 70, 74),
		personality: {
			traits: ['Formal', 'Patient', 'Conscientious'],
			value: 'Stewardship',
			drive: 'Leave people safer than they were found',
			socialStyle: 'Courteous, structured, reassuring',
			stressResponse: 'Builds order and absorbs uncertainty',
			tendency: 'Low risk · consensus lead'
		},
		aptitudes: [
			{ name: 'Warding', class: 'magic' },
			{ name: 'Logistics', class: 'crafting' },
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
		attributes: attributes(55, 70, 51, 64, 82, 73),
		personality: {
			traits: ['Grounded', 'Perceptive', 'Deliberate'],
			value: 'Reciprocity',
			drive: 'Turn attention into durable agreement',
			socialStyle: 'Warm, economical, difficult to rush',
			stressResponse: 'Slows the room and tests assumptions',
			tendency: 'Balanced risk · diplomatic lead'
		},
		aptitudes: [
			{ name: 'Negotiation', class: 'martial' },
			{ name: 'Appraisal', class: 'crafting' },
			{ name: 'Court lore', class: 'magic' }
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
		attributes: attributes(38, 48, 57, 76, 88, 84),
		personality: {
			traits: ['Precise', 'Curious', 'Composed'],
			value: 'Understanding',
			drive: 'Make hidden systems legible',
			socialStyle: 'Formal, thoughtful, gently corrective',
			stressResponse: 'Returns to first principles and pattern',
			tendency: 'Measured risk · technical lead'
		},
		aptitudes: [
			{ name: 'Ritual reading', class: 'magic' },
			{ name: 'Focus craft', class: 'crafting' },
			{ name: 'Grove magic', class: 'magic' }
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
		attributes: attributes(62, 64, 86, 83, 67, 69),
		personality: {
			traits: ['Open-hearted', 'Patient', 'Playful'],
			value: 'Mutual trust',
			drive: 'Create the opening everyone can use',
			socialStyle: 'Easy, attentive, quietly encouraging',
			stressResponse: 'Stays mobile and keeps others connected',
			tendency: 'High risk · emergent lead'
		},
		aptitudes: [
			{ name: 'Short blade', class: 'martial' },
			{ name: 'Evasion', class: 'martial' },
			{ name: 'Team timing', class: 'martial' }
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
		description: 'Portal charge, crossing silhouette, then identity and mechanics.',
		recognitionTarget: '1.75 s target'
	},
	{
		id: 'constellation',
		label: 'Constellation assembly',
		shortLabel: 'Constellation',
		description: 'Affinity and skill marks gather into a person before the portrait.',
		recognitionTarget: '1.55 s target'
	},
	{
		id: 'identity',
		label: 'Immediate identity',
		shortLabel: 'Identity first',
		description: 'Portrait first, restrained parallax, then staged details.',
		recognitionTarget: '0.15 s target'
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

export const banners = [
	{
		id: 'standard',
		label: 'Standard',
		kicker: 'Hearthbound',
		state: 'active' as const,
		description: 'Fixed six-identity presentation pool'
	},
	{
		id: 'limited',
		label: 'Limited',
		kicker: 'Future preview',
		state: 'preview' as const,
		description: 'No working economy in this lab'
	},
	{
		id: 'equipment',
		label: 'Equipment',
		kicker: 'Future preview',
		state: 'preview' as const,
		description: 'Acquisition surface still under review'
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

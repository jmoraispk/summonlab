import daraAnchor from '../../../../../../assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png';
import maraAnchor from '../../../../../../assets/heroes/ember-01-anchor-v1.png';
import joriAnchor from '../../../../../../assets/heroes/visuals/owner-playtest-v1/jori-daro-anchor-v1.png';
import kiraAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/kira-toren-anchor-v1.png';
import ivenAnchor from '../../../../../../assets/heroes/visuals/forge-v2/pilot/iven-orra-anchor-v1.png';
import remyAnchor from '../../../../../../assets/heroes/visuals/hearth-02-anchor-v1.png';

export type HeroId = 'dara' | 'mara' | 'jori' | 'kira' | 'iven' | 'remy';
export type RevealDirection = 'gate' | 'constellation' | 'identity';
export type OfferMode = 'single' | 'batch';

export type HeroFixture = {
	id: HeroId;
	name: string;
	identityLine: string;
	affinity: string;
	calling: string;
	stars: number;
	image: string;
};

export type RevealDirectionFixture = {
	id: RevealDirection;
	label: string;
	shortLabel: string;
	description: string;
	recognitionTarget: string;
};

export const FIXTURE_VERSION = 'Portal review fixture · LV-SP-01';

export const heroes: readonly HeroFixture[] = [
	{
		id: 'dara',
		name: 'Dara Zev',
		identityLine: 'A watchful pathfinder who reads danger before it arrives.',
		affinity: 'Tide',
		calling: 'Pathfinder',
		stars: 1,
		image: daraAnchor
	},
	{
		id: 'mara',
		name: 'Mara Vey',
		identityLine: 'A guarded ember-bearer who holds the line when others falter.',
		affinity: 'Ember',
		calling: 'Vanguard',
		stars: 1,
		image: maraAnchor
	},
	{
		id: 'jori',
		name: 'Jori Daro',
		identityLine: 'A formal wardkeeper with an instinct for quiet protection.',
		affinity: 'Tide',
		calling: 'Wardkeeper',
		stars: 1,
		image: joriAnchor
	},
	{
		id: 'kira',
		name: 'Kira Toren',
		identityLine: 'A grounded envoy who turns careful attention into leverage.',
		affinity: 'Gale',
		calling: 'Envoy',
		stars: 2,
		image: kiraAnchor
	},
	{
		id: 'iven',
		name: 'Iven Orra',
		identityLine: 'A precise ritual reader who notices the pattern beneath the noise.',
		affinity: 'Grove',
		calling: 'Ritualist',
		stars: 2,
		image: ivenAnchor
	},
	{
		id: 'remy',
		name: 'Remy Nahl',
		identityLine: 'An open-hearted skirmisher with a patient eye for openings.',
		affinity: 'Ember',
		calling: 'Skirmisher',
		stars: 3,
		image: remyAnchor
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

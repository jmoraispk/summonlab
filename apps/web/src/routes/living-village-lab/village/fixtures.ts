import daraPortrait from './cutouts/dara-zev.png';
import ivenPortrait from './cutouts/iven-orra.png';
import joriPortrait from './cutouts/jori-daro.png';
import kiraPortrait from './cutouts/kira-toren.png';
import maraPortrait from './cutouts/mara-vey.png';
import remyPortrait from './cutouts/remy-nahl.png';

import type {
	VillageFacility,
	VillageHero,
	VillageSummaryItem
} from '$lib/components/living-village/village/types';

export const hearthEnvironment = {
	publicPath: '/runtime/settlements/hearth-01/environment.96cbb666f3d9.webp',
	width: 1536,
	height: 1024
} as const;

export const facilities = [
	{
		id: 'gate',
		name: 'Summoning Gate',
		shortName: 'Gate',
		state: 'Ready · 1 Normal token',
		action: 'Reveal the next fixed hero',
		detail: 'Kira Toren is bound to the Floor 3 token.',
		href: '/forge',
		position: { x: 0.5, y: 0.18 },
		bounds: { x: 0.385, y: 0.055, width: 0.23, height: 0.25 }
	},
	{
		id: 'court',
		name: 'Training Grounds',
		shortName: 'Training grounds',
		state: '3 slots open',
		action: 'Assign a resident to local training',
		detail: 'Training is available now and does not require a party.',
		position: { x: 0.76, y: 0.67 },
		bounds: { x: 0.65, y: 0.51, width: 0.27, height: 0.31 }
	},
	{
		id: 'tower',
		name: 'Tower Threshold',
		shortName: 'Tower',
		state: 'Floor 4 available',
		action: 'Send a resident on a species hunt',
		detail: 'Known Floor 4 signs: moss goblins, stoneback boars, and ash wisps.',
		position: { x: 0.5, y: 0.9 },
		bounds: { x: 0.385, y: 0.82, width: 0.23, height: 0.18 }
	}
] as const satisfies readonly VillageFacility[];

export const heroes = [
	{
		id: 'dara-zev',
		name: 'Dara Zev',
		level: 8,
		health: { current: 146, maximum: 160 },
		activity: 'Keeping gate watch',
		partyStatus: 'Party I · Vanguard',
		portrait: daraPortrait,
		portraitAlt: 'Dara Zev approved identity portrait',
		position: { x: 0.42, y: 0.38 },
		attributes: [
			{ label: 'Might', value: 18 },
			{ label: 'Guard', value: 21 },
			{ label: 'Focus', value: 12 }
		],
		skills: ['Shield line', 'Stone stance', 'Rallying call'],
		equipment: ['Ashwood shield', 'Iron scale', 'Wayfarer boots']
	},
	{
		id: 'mara-vey',
		name: 'Mara Vey',
		level: 8,
		health: { current: 112, maximum: 124 },
		activity: 'Mending field kit',
		partyStatus: 'Party I · Support',
		portrait: maraPortrait,
		portraitAlt: 'Mara Vey approved identity portrait',
		position: { x: 0.31, y: 0.51 },
		attributes: [
			{ label: 'Might', value: 11 },
			{ label: 'Guard', value: 14 },
			{ label: 'Focus', value: 22 }
		],
		skills: ['Ember stitch', 'Field remedy', 'Kindled ward'],
		equipment: ['Ember staff', 'Linen mantle', 'Remedy satchel']
	},
	{
		id: 'jori-daro',
		name: 'Jori Daro',
		level: 7,
		health: { current: 118, maximum: 136 },
		activity: 'Checking the perimeter',
		partyStatus: 'Party I · Striker',
		portrait: joriPortrait,
		portraitAlt: 'Jori Daro approved identity portrait',
		position: { x: 0.62, y: 0.43 },
		attributes: [
			{ label: 'Might', value: 20 },
			{ label: 'Guard', value: 13 },
			{ label: 'Focus', value: 16 }
		],
		skills: ['Hook step', 'Twin cut', 'Trail sense'],
		equipment: ['Paired falchions', 'Leather jack', 'Tower cord']
	},
	{
		id: 'kira-toren',
		name: 'Kira Toren',
		level: 5,
		health: { current: 98, maximum: 108 },
		activity: 'Sorting gate fragments',
		partyStatus: 'Reserve · Available',
		portrait: kiraPortrait,
		portraitAlt: 'Kira Toren fixed identity portrait',
		position: { x: 0.54, y: 0.53 },
		attributes: [
			{ label: 'Might', value: 13 },
			{ label: 'Guard', value: 12 },
			{ label: 'Focus', value: 19 }
		],
		skills: ['Prism spark', 'Quick study', 'Arc mark'],
		equipment: ['Glass focus', 'Bluecoat', 'Copper charm']
	},
	{
		id: 'iven-orra',
		name: 'Iven Orra',
		level: 6,
		health: { current: 132, maximum: 132 },
		activity: 'Preparing court weights',
		partyStatus: 'Reserve · Available',
		portrait: ivenPortrait,
		portraitAlt: 'Iven Orra fixed identity portrait',
		position: { x: 0.69, y: 0.58 },
		attributes: [
			{ label: 'Might', value: 21 },
			{ label: 'Guard', value: 17 },
			{ label: 'Focus', value: 10 }
		],
		skills: ['Hammer drive', 'Brace', 'Measured breath'],
		equipment: ['Stone maul', 'Padded coat', 'Grip wraps']
	},
	{
		id: 'remy-nahl',
		name: 'Remy Nahl',
		level: 6,
		health: { current: 104, maximum: 116 },
		activity: 'Cataloguing tower signs',
		partyStatus: 'Reserve · Available',
		portrait: remyPortrait,
		portraitAlt: 'Remy Nahl fixed identity portrait',
		position: { x: 0.4, y: 0.68 },
		attributes: [
			{ label: 'Might', value: 12 },
			{ label: 'Guard', value: 15 },
			{ label: 'Focus', value: 21 }
		],
		skills: ['Far sight', 'Pinning shot', 'Field notes'],
		equipment: ['Yew longbow', 'Travel cloak', 'Survey kit']
	}
] as const satisfies readonly VillageHero[];

export const summaryItems = [
	{
		label: 'Current party',
		value: '3 ready',
		detail: 'Dara · Mara · Jori',
		tone: 'ember'
	},
	{
		label: 'Training Court',
		value: '0 / 3',
		detail: 'All slots open',
		tone: 'aqua'
	},
	{
		label: 'Highest floor',
		value: 'Floor 3',
		detail: 'Floor 4 available',
		tone: 'violet'
	},
	{
		label: 'Summoning Gate',
		value: '1 Normal',
		detail: 'Kira token ready',
		tone: 'gold'
	},
	{
		label: 'Materials',
		value: '128 stock',
		detail: 'Iron 48 · Herb 62 · Ash 18',
		tone: 'stone'
	}
] as const satisfies readonly VillageSummaryItem[];

export const huntSpecies = ['Moss goblin', 'Stoneback boar', 'Ash wisp'] as const;

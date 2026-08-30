export type VillageFacilityId = 'gate' | 'court' | 'tower';

export type VillageHeroId =
	'dara-zev' | 'mara-vey' | 'jori-daro' | 'kira-toren' | 'iven-orra' | 'remy-nahl';

export type VillagePoint = {
	x: number;
	y: number;
};

export type VillageFacility = {
	id: VillageFacilityId;
	name: string;
	shortName: string;
	state: string;
	action: string;
	detail: string;
	href?: '/forge';
	position: VillagePoint;
	bounds: { x: number; y: number; width: number; height: number };
};

export type VillageHero = {
	id: VillageHeroId;
	name: string;
	level: number;
	health: { current: number; maximum: number };
	activity: string;
	partyStatus: string;
	portrait: string;
	portraitAlt: string;
	position: VillagePoint;
	attributes: readonly { label: string; value: number }[];
	skills: readonly string[];
	equipment: readonly string[];
};

export type VillageHeroRuntime = {
	activity: string;
	position: VillagePoint;
	order: string | null;
};

export type VillageSummaryItem = {
	label: string;
	value: string;
	detail: string;
	tone: 'ember' | 'aqua' | 'violet' | 'gold' | 'stone';
};

export type VillageOrder =
	| { kind: 'court'; heroId: VillageHeroId }
	| { kind: 'hunt'; heroId: VillageHeroId; species: string };

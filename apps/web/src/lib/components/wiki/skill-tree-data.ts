export type SkillTreeLabel = { namespace: 'Equipment' | 'Element'; value: string };

export type SkillTreeSkill = { name: string; href: string; labels: SkillTreeLabel[] };

export type SkillTreeFamily = {
	name: string;
	href: string;
	description: string;
	labels: SkillTreeLabel[];
	skills: SkillTreeSkill[];
	emptyLabelMessages?: Partial<Record<string, string>>;
};

export type SkillTreeDomain = {
	id: 'martial' | 'magical' | 'craft';
	name: string;
	image: string;
	description: string;
	families: SkillTreeFamily[];
};

const equipment = (value: string): SkillTreeLabel => ({ namespace: 'Equipment', value });
const element = (value: string): SkillTreeLabel => ({ namespace: 'Element', value });
const skill = (name: string, href: string, labels: SkillTreeLabel[] = []): SkillTreeSkill => ({
	name,
	href,
	labels
});

const bladeHref = '/wiki/mechanics/skills/martial-blade';
const polearmHref = '/wiki/mechanics/skills/martial-polearm';
const rangedHref = '/wiki/mechanics/skills/martial-ranged';
const shieldHref = '/wiki/mechanics/skills/martial-shield';
const bodyHref = '/wiki/mechanics/skills/martial-body';
const elementalHref = '/wiki/mechanics/skills/magical-elemental';
const disciplinesHref = '/wiki/mechanics/skills/magical-disciplines';
const craftHref = '/wiki/mechanics/skills/craft-and-life';

export const SKILL_DOMAINS: SkillTreeDomain[] = [
	{
		id: 'martial',
		name: 'Martial',
		image: '/wiki-media/skills/martial-domain.webp',
		description: 'Technique, tools, defense, endurance, and practiced combat judgment.',
		families: [
			{
				name: 'Blade',
				href: bladeHref,
				description: 'Cutting, thrusting, and coordinated blade handling.',
				labels: [equipment('Sword'), equipment('Dagger'), equipment('Greatsword')],
				skills: [
					skill('Swordsmanship', bladeHref, [equipment('Sword')]),
					skill('Reversal Cut', bladeHref, [equipment('Sword')]),
					skill('Blade Throw', bladeHref, [equipment('Dagger')]),
					skill('Great Blade', bladeHref, [equipment('Greatsword')]),
					skill('Two Blades', bladeHref)
				]
			},
			{
				name: 'Polearm',
				href: polearmHref,
				description: 'Reach, hooking, reaping, and crushing with long-shafted weapons.',
				labels: [
					equipment('Spear'),
					equipment('Glaive'),
					equipment('Halberd'),
					equipment('Polehammer')
				],
				skills: [
					skill('Polearm Handling', polearmHref),
					skill('Dragon Tail', polearmHref, [
						equipment('Spear'),
						equipment('Glaive'),
						equipment('Halberd')
					]),
					skill('Halberd Handling', polearmHref, [equipment('Halberd')]),
					skill('Polehammer Handling', polearmHref, [equipment('Polehammer')])
				]
			},
			{
				name: 'Ranged',
				href: rangedHref,
				description: 'Bow, crossbow, and sling practice across aimed, rapid, and siege fire.',
				labels: [equipment('Bow'), equipment('Crossbow'), equipment('Sling')],
				skills: [
					skill('Archery', rangedHref, [equipment('Bow')]),
					skill("Hunter's Mark", rangedHref, [equipment('Bow')]),
					skill('Crossbow Handling', rangedHref, [equipment('Crossbow')]),
					skill('Sling', rangedHref, [equipment('Sling')])
				]
			},
			{
				name: 'Shield',
				href: shieldHref,
				description: 'Blocking, interception, formation defense, and ally cover.',
				labels: [],
				skills: [
					skill('Shield Use', shieldHref),
					skill('Interpose', shieldHref),
					skill('Shield Throw', shieldHref)
				]
			},
			{
				name: 'Body',
				href: bodyHref,
				description:
					'Movement, endurance, unarmed form, mounted movement, and multi-companion combat command.',
				labels: [equipment('Unarmed')],
				skills: [
					skill('Footing', bodyHref),
					skill('Martial Form', bodyHref, [equipment('Unarmed')]),
					skill('Riding', bodyHref),
					skill('Pack Bond', bodyHref),
					skill('Mounted Combat', bodyHref),
					skill('Bonded Mount', bodyHref)
				]
			}
		]
	},
	{
		id: 'magical',
		name: 'Magic',
		image: '/wiki-media/skills/magical-domain-v2.webp',
		description: 'Affinity expression, wards, enchantment, restoration, and the mind.',
		families: [
			{
				name: 'Elemental',
				href: elementalHref,
				description:
					'Direct affinity expression, owned by one family and parameterized by element.',
				labels: [element('Fire'), element('Earth'), element('Wind'), element('Water')],
				emptyLabelMessages: {
					Wind: 'The Wind skill ladder is not published yet.'
				},
				skills: [
					skill('Ember', elementalHref, [element('Fire')]),
					skill('Water Bullet', elementalHref, [element('Water')]),
					skill('Stone Shard', elementalHref, [element('Earth')])
				]
			},
			{
				name: 'Ward',
				href: `${disciplinesHref}#ward`,
				description: 'Barriers, resistance, reflection, and dispelling.',
				labels: [element('Attuned')],
				skills: [
					skill('Warding', `${disciplinesHref}#ward`),
					skill('Shield Sigil', `${disciplinesHref}#ward`),
					skill('Elemental Guard', `${disciplinesHref}#ward`, [element('Attuned')])
				]
			},
			{
				name: 'Enchantment',
				href: `${disciplinesHref}#enchantment`,
				description: 'Blessings, object imbuing, and sustained magical properties.',
				labels: [element('Attuned')],
				skills: [
					skill('Imbuing', `${disciplinesHref}#enchantment`),
					skill('Minor Blessing', `${disciplinesHref}#enchantment`),
					skill('Weapon Oil', `${disciplinesHref}#enchantment`, [element('Attuned')])
				]
			},
			{
				name: 'Restoration',
				href: `${disciplinesHref}#restoration`,
				description: 'Healing, curing, recovery, and scarce revival techniques.',
				labels: [],
				skills: [
					skill('Mending', `${disciplinesHref}#restoration`),
					skill('Close Wound', `${disciplinesHref}#restoration`),
					skill('Cure', `${disciplinesHref}#restoration`)
				]
			},
			{
				name: 'Mind',
				href: `${disciplinesHref}#mind`,
				description: 'Perception, illusion, deception, and mental control.',
				labels: [],
				skills: [
					skill('Presence', `${disciplinesHref}#mind`),
					skill('Read Surface', `${disciplinesHref}#mind`),
					skill('Minor Illusion', `${disciplinesHref}#mind`)
				]
			}
		]
	},
	{
		id: 'craft',
		name: 'Craft',
		image: '/wiki-media/skills/craft-domain.webp',
		description: 'Making, gathering, care, field knowledge, and material transformation.',
		families: [
			{
				name: 'Forging',
				href: `${craftHref}#forging`,
				description: 'Weapons, armor, tools, alloys, and runic foundations.',
				labels: [],
				skills: [
					skill('Ore Sense', `${craftHref}#forging`),
					skill('Simple Smithing', `${craftHref}#forging`)
				]
			},
			{
				name: 'Alchemy',
				href: `${craftHref}#alchemy`,
				description: 'Potions, poisons, reagents, and volatile delivery.',
				labels: [],
				skills: [
					skill('Reagent Sense', `${craftHref}#alchemy`),
					skill('Grenade Throw', `${craftHref}#alchemy`)
				]
			},
			{
				name: 'Cooking',
				href: `${craftHref}#cooking`,
				description: 'Food, lasting preparation, morale, and roster-wide meals.',
				labels: [],
				skills: [
					skill('Cooking', `${craftHref}#cooking`),
					skill('Hearth Meal', `${craftHref}#cooking`)
				]
			},
			{
				name: 'Gathering',
				href: `${craftHref}#gathering`,
				description: 'Harvesting, living resources, creature care, taming, and breeding.',
				labels: [],
				skills: [
					skill('Gathering', `${craftHref}#gathering`),
					skill('Animal Handling', `${craftHref}#gathering`),
					skill('Taming', `${craftHref}#gathering`),
					skill('Greater Taming', `${craftHref}#gathering`),
					skill('Monarch of Beasts', `${craftHref}#gathering`)
				]
			},
			{
				name: 'Knowledge',
				href: `${craftHref}#knowledge`,
				description: 'Literacy, identification, mapping, languages, and research.',
				labels: [],
				skills: [
					skill('Literacy', `${craftHref}#knowledge`),
					skill('Languages', `${craftHref}#knowledge`),
					skill('Read the Body', `${craftHref}#knowledge`)
				]
			}
		]
	}
];

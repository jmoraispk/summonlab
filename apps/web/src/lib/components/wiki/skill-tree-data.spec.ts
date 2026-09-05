import { describe, expect, it } from 'vitest';

import { SKILL_DOMAINS } from './skill-tree-data';

function domain(id: (typeof SKILL_DOMAINS)[number]['id']) {
	const match = SKILL_DOMAINS.find((entry) => entry.id === id);
	if (!match) throw new Error(`Missing skill domain: ${id}`);
	return match;
}

function allSkills() {
	return SKILL_DOMAINS.flatMap((entry) =>
		entry.families.flatMap((family) =>
			family.skills.map((skill) => ({ ...skill, domain: entry.name, family: family.name }))
		)
	);
}

function allLabels() {
	return SKILL_DOMAINS.flatMap((entry) =>
		entry.families.flatMap((family) => [
			...family.labels,
			...family.skills.flatMap((skill) => skill.labels)
		])
	);
}

describe('skill tree navigation data', () => {
	it('publishes presentation names and the empty Wind ladder message', () => {
		expect(SKILL_DOMAINS.map(({ name }) => name)).toEqual(['Martial', 'Magic', 'Craft']);
		expect(domain('magical')).toMatchObject({
			id: 'magical',
			name: 'Magic',
			image: '/wiki-media/skills/magical-domain-v2.webp'
		});

		expect(domain('magical').families.find((family) => family.name === 'Elemental')).toMatchObject({
			emptyLabelMessages: {
				Wind: 'The Wind skill ladder is not published yet.'
			}
		});
	});

	it('publishes the exact 5/5/5 family model', () => {
		expect(domain('martial').families.map((family) => family.name)).toEqual([
			'Blade',
			'Polearm',
			'Ranged',
			'Shield',
			'Body'
		]);
		expect(domain('magical').families.map((family) => family.name)).toEqual([
			'Elemental',
			'Ward',
			'Enchantment',
			'Restoration',
			'Mind'
		]);
		expect(domain('craft').families.map((family) => family.name)).toEqual([
			'Forging',
			'Alchemy',
			'Cooking',
			'Gathering',
			'Knowledge'
		]);
		expect(SKILL_DOMAINS.flatMap((entry) => entry.families)).toHaveLength(15);
	});

	it('projects creature acquisition, learned knowledge, and pack command to their surviving families', () => {
		const craft = domain('craft');
		const martial = domain('martial');
		const gathering = craft.families.find((family) => family.name === 'Gathering');
		const knowledge = craft.families.find((family) => family.name === 'Knowledge');
		const body = martial.families.find((family) => family.name === 'Body');

		expect(body?.description).toContain('mounted movement');
		expect(body?.description).toContain('multi-companion combat command');

		expect(gathering?.skills).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Animal Handling',
					href: '/wiki/mechanics/skills/craft-and-life#gathering'
				}),
				expect.objectContaining({
					name: 'Monarch of Beasts',
					href: '/wiki/mechanics/skills/craft-and-life#gathering'
				})
			])
		);
		expect(knowledge?.skills).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Languages',
					href: '/wiki/mechanics/skills/craft-and-life#knowledge'
				}),
				expect.objectContaining({
					name: 'Read the Body',
					href: '/wiki/mechanics/skills/craft-and-life#knowledge'
				})
			])
		);
		expect(knowledge?.skills.some((entry) => entry.name === 'Beast Speech')).toBe(false);
		expect(body?.skills).toContainEqual({
			name: 'Pack Bond',
			href: '/wiki/mechanics/skills/martial-body',
			labels: []
		});
	});

	it('gives every representative skill one unique family owner', () => {
		const skills = allSkills();
		const names = skills.map((skill) => skill.name);

		expect(new Set(names).size).toBe(names.length);
		expect(skills.find((skill) => skill.name === 'Two Blades')).toMatchObject({
			family: 'Blade',
			labels: [],
			href: '/wiki/mechanics/skills/martial-blade'
		});
		expect(skills.find((skill) => skill.name === 'Reversal Cut')).toMatchObject({
			family: 'Blade',
			labels: [{ namespace: 'Equipment', value: 'Sword' }],
			href: '/wiki/mechanics/skills/martial-blade'
		});
		expect(skills.find((skill) => skill.name === 'Ember')).toMatchObject({
			family: 'Elemental',
			href: '/wiki/mechanics/skills/magical-elemental'
		});
	});

	it('uses only optional Equipment and Element labels', () => {
		const labels = allLabels();
		const values = labels.map((label) => label.value);

		expect(new Set(labels.map((label) => label.namespace))).toEqual(
			new Set(['Equipment', 'Element'])
		);
		expect(values).not.toContain('Two Blades');
		expect(values).not.toContain('Neutral');
		expect(domain('magical').families[0]?.labels.map((label) => label.value)).toEqual([
			'Fire',
			'Earth',
			'Wind',
			'Water'
		]);
		expect(domain('magical').families[0]?.skills.map((skill) => skill.name)).toEqual([
			'Ember',
			'Water Bullet',
			'Stone Shard'
		]);
		expect(
			domain('magical').families[0]?.skills.every(
				(skill) => skill.labels.filter((label) => label.namespace === 'Element').length === 1
			)
		).toBe(true);
		expect(labels.map((label) => label.value)).not.toContain('Wood');
		expect(labels.map((label) => label.value)).not.toContain('Metal');
		expect(domain('magical').families[1]?.labels.map((label) => label.value)).toEqual(['Attuned']);
		expect(domain('magical').families[2]?.labels.map((label) => label.value)).toEqual(['Attuned']);
	});

	it('exposes every retained Polearm and Ranged equipment path in discovery', () => {
		const polearm = domain('martial').families.find((family) => family.name === 'Polearm');
		const ranged = domain('martial').families.find((family) => family.name === 'Ranged');

		expect(polearm?.labels.map((label) => label.value)).toEqual([
			'Spear',
			'Glaive',
			'Halberd',
			'Polehammer'
		]);
		expect(polearm?.skills).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Dragon Tail',
					labels: [
						{ namespace: 'Equipment', value: 'Spear' },
						{ namespace: 'Equipment', value: 'Glaive' },
						{ namespace: 'Equipment', value: 'Halberd' }
					]
				}),
				expect.objectContaining({ name: 'Halberd Handling' }),
				expect.objectContaining({ name: 'Polehammer Handling' })
			])
		);
		expect(ranged?.labels.map((label) => label.value)).toEqual(['Bow', 'Crossbow', 'Sling']);
		expect(ranged?.skills).toContainEqual({
			name: 'Sling',
			href: '/wiki/mechanics/skills/martial-ranged',
			labels: [{ namespace: 'Equipment', value: 'Sling' }]
		});
	});

	it('contains no Universal branch or obsolete structural identity', () => {
		const serialized = JSON.stringify(SKILL_DOMAINS);

		expect(serialized).not.toMatch(
			/Universal Martial|Universal skills|Tracking|Paired Blades|"Beast"|"Lore"/u
		);
	});
});

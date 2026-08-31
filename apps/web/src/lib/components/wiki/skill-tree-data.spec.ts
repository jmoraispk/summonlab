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
	it('publishes the exact 5/5/6 family model', () => {
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
			'Beast',
			'Lore'
		]);
		expect(SKILL_DOMAINS.flatMap((entry) => entry.families)).toHaveLength(16);
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
			'Water',
			'Wood',
			'Earth',
			'Metal'
		]);
		expect(domain('magical').families[1]?.labels.map((label) => label.value)).toEqual(['Attuned']);
		expect(domain('magical').families[2]?.labels.map((label) => label.value)).toEqual(['Attuned']);
	});

	it('contains no Universal branch or obsolete structural identity', () => {
		const serialized = JSON.stringify(SKILL_DOMAINS);

		expect(serialized).not.toMatch(/Universal Martial|Universal skills|Tracking|Paired Blades/u);
	});
});

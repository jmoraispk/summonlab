import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '..');
const skillRoot = resolve(repositoryRoot, '.agents/skills/summonlab-enemy-creation');

async function readSkillFile(path: string): Promise<string> {
	return readFile(resolve(skillRoot, path), 'utf8');
}

describe('summonlab-enemy-creation skill', () => {
	it('ships a discoverable skill package whose local references resolve', async () => {
		const skill = await readSkillFile('SKILL.md');
		const agentConfig = await readSkillFile('agents/openai.yaml');

		expect(skill).toMatch(/^---\nname: summonlab-enemy-creation\n/);
		expect(skill).toContain('description: Use when');
		expect(agentConfig).toContain('$summonlab-enemy-creation');

		const referenceLinks = [...skill.matchAll(/\]\((references\/[^)]+\.md)\)/g)].map(
			(match) => match[1]
		);
		expect(referenceLinks.length).toBeGreaterThanOrEqual(2);
		await Promise.all(referenceLinks.map((path) => access(resolve(skillRoot, path))));
	});

	it('encodes the family, affinity, production-state, and repository boundaries', async () => {
		const documentation = [
			await readSkillFile('SKILL.md'),
			await readSkillFile('references/family-design-contract.md'),
			await readSkillFile('references/repository-workflow.md')
		].join('\n');

		for (const requiredTerm of [
			'T1',
			'T3',
			'T5',
			'Normal',
			'Fire',
			'Earth',
			'Wind',
			'Water',
			'candidate',
			'approved',
			'runtime',
			'summonlab-image-production',
			'FamilyPacketSchema',
			'collision-safe'
		]) {
			expect(documentation).toContain(requiredTerm);
		}
	});

	it('turns a minimal invocation into a complete intake without prompt boilerplate', async () => {
		const skill = await readSkillFile('SKILL.md');
		const familyContract = await readSkillFile('references/family-design-contract.md');
		const agentConfig = await readSkillFile('agents/openai.yaml');

		expect(agentConfig).toContain('Use $summonlab-enemy-creation to add Rodents as a new family.');
		for (const intakeDecision of [
			'new family',
			'standalone enemy',
			'family name',
			'long-form description',
			'requested production phase'
		]) {
			expect(`${skill}\n${familyContract}`).toContain(intakeDecision);
		}
	});
});

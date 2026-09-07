import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

describe('Summonlab skill creation and icon production skills', () => {
	it('keeps image generation strictly frameless and temporary', async () => {
		const producer = await read('skills/summonlab-skill-icon-production/SKILL.md');
		const target = await read('skills/summonlab-skill-icon-production/references/target-schema.md');

		expect(`${producer}\n${target}`).toContain(
			'Artwork layer only: transparent background; no rarity frame'
		);
		expect(producer).toContain('.skill-icon-work/');
		expect(producer).toContain('Never write to `assets/wiki/skills/icon-production-v2/`');
		expect(target).toContain('Do not supply a frame or backing as generation input.');
	});

	it('generates family context on demand and deletes it after promotion', async () => {
		const workflow = await read(
			'skills/summonlab-skill-creation/references/repository-workflow.md'
		);

		expect(workflow.toLowerCase()).toContain('generate a pre-generation family sheet on demand');
		expect(workflow).toContain('promotes the exact frameless file into the');
		expect(workflow).toContain('Do not retain either sheet');
	});

	it('documents ordinary canonical promotion without a special-case example', async () => {
		const files = await Promise.all([
			read('skills/summonlab-skill-creation/SKILL.md'),
			read('skills/summonlab-skill-creation/references/repository-workflow.md'),
			read('skills/summonlab-skill-icon-production/SKILL.md'),
			read('skills/summonlab-skill-icon-production/references/example.md')
		]);
		const combined = files.join('\n');

		expect(combined).not.toContain('Reversal Cut');
		expect(combined).toContain('Measured Cut');
		expect(combined).toContain('export:skill-icon-assets');
		expect(combined).toContain('export:wiki-skill-visual-catalog');
		expect(combined).toContain("sourcePolicy: 'exact-frameless-source'");
		expect(combined).toContain("interiorTransform: 'identity'");
		expect(combined).toContain('assignment.json');
		expect(combined).toContain('result.json');
	});

	it('keeps owner acceptance separate from producer and coordinator actions', async () => {
		const producer = await read('skills/summonlab-skill-icon-production/SKILL.md');
		const result = await read('skills/summonlab-skill-icon-production/references/result-schema.md');

		expect(producer).toContain('The producer stops at a frameless candidate under');
		expect(producer).toContain('After the owner accepts the isolated artwork');
		expect(producer).toMatch(/After the owner accepts that\s+composite/u);
		expect(result).toContain('Candidate means ready for owner review, never approved.');
	});
});

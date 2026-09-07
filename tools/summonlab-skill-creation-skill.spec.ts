import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '..');

async function readRepositoryFile(path: string): Promise<string> {
	return readFile(resolve(repositoryRoot, path), 'utf8');
}

describe('summonlab skill-icon producer and coordinator workflow', () => {
	it('keeps the producer frameless and makes its coordinator handoff explicit', async () => {
		const producerSkill = await readRepositoryFile(
			'skills/summonlab-skill-icon-production/SKILL.md'
		);
		const producerRubric = await readRepositoryFile(
			'skills/summonlab-skill-icon-production/references/review-rubric.md'
		);

		for (const term of [
			'frameless artwork layer',
			'Never resize, position, mask, add backing to, or apply a rarity frame to `skill-art`',
			'Never create a composite',
			'Never invoke `promote:skill-icon-output`',
			'artworkScale: 0.9',
			'922x922',
			'(51,51)',
			"compositionProfile: 'frame-opening-v3'",
			'frame is the final layer',
			'complete aperture coverage',
			'protected-band',
			'baked frame traces',
			'exterior opacity',
			'backing-only components',
			'layer-hash mismatch',
			'non-exact recomposition'
		]) {
			expect(producerSkill).toContain(term);
		}

		expect(producerRubric).toContain('do not resize, mask, composite, or promote it');
	});

	it('keeps deterministic assembly and fail-closed gates in the coordinator workflow', async () => {
		const creationSkill = await readRepositoryFile('skills/summonlab-skill-creation/SKILL.md');
		const individualWorkflow = await readRepositoryFile(
			'skills/summonlab-skill-creation/references/repository-workflow.md'
		);

		expect(creationSkill).toContain('coordinator owns its deterministic resize, masking, backing');
		for (const term of [
			'frameless artwork layer',
			'artworkScale: 0.9',
			'922x922',
			'(51,51)',
			"compositionProfile: 'frame-opening-v3'",
			'frame is the final layer',
			'complete aperture coverage',
			'protected-band',
			'baked frame traces',
			'exterior opacity',
			'backing-only components',
			'layer-hash mismatch',
			'non-exact recomposition'
		]) {
			expect(individualWorkflow).toContain(term);
		}
	});

	it('forbids framed individual-image instructions while preserving framed sheets as references', async () => {
		const individualWorkflow = await readRepositoryFile(
			'skills/summonlab-skill-creation/references/repository-workflow.md'
		);
		const normalizedWorkflow = individualWorkflow.replaceAll(/\s+/g, ' ');

		expect(normalizedWorkflow).toContain(
			'The individual producer receives no approved frame as generation content'
		);
		expect(normalizedWorkflow).toContain(
			'it does not authorize frame generation or cropping a framed cell into an individual artwork layer'
		);
		for (const forbiddenInstruction of [
			/\b(?:supply|provide|give|use)\b[^.]{0,120}\b(?:approved|canonical|rarity) frame\b[^.]{0,120}\b(?:generation|imagegen|individual)\b/i,
			/\b(?:bake|retain)\b[^.]{0,120}\bframe ornaments?\b/i,
			/\bgenerate\b[^.]{0,120}\bcomplete framed (?:individual )?(?:tile|icon|artwork)\b/i,
			/\bretain transparent exterior and all frame ornaments\b/i
		]) {
			expect(normalizedWorkflow).not.toMatch(forbiddenInstruction);
		}

		expect(normalizedWorkflow).toContain('complete framed review reference');
	});
});

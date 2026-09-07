import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '..');

async function readRepositoryFile(path: string): Promise<string> {
	return readFile(resolve(repositoryRoot, path), 'utf8');
}

describe('summonlab skill-icon producer and coordinator workflow', () => {
	it('keeps individual artwork frameless and binds deterministic coordinator assembly', async () => {
		const individualWorkflow = await readRepositoryFile(
			'skills/summonlab-skill-creation/references/repository-workflow.md'
		);
		const documentation = [
			await readRepositoryFile('skills/summonlab-skill-icon-production/SKILL.md'),
			await readRepositoryFile(
				'skills/summonlab-skill-icon-production/references/review-rubric.md'
			),
			await readRepositoryFile('skills/summonlab-skill-creation/SKILL.md'),
			individualWorkflow
		].join('\n');

		for (const term of [
			'frameless artwork layer',
			'artworkScale: 0.9',
			'922x922',
			'(51,51)',
			"compositionProfile: 'frame-opening-v3'",
			'frame is the final layer',
			'complete aperture coverage',
			'protected-band'
		]) {
			expect(documentation).toContain(term);
		}

		expect(individualWorkflow.replaceAll(/\s+/g, ' ')).not.toContain(
			'retain transparent exterior and all frame ornaments'
		);
	});
});

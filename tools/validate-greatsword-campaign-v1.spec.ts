import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	validateGreatswordCampaign,
	validateGreatswordCampaignFiles
} from './validate-greatsword-campaign-v1.js';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const campaignRoot = `${repositoryRoot}/assets/equipment/experiments/two-handed-greatsword-v1`;

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function fixtures() {
	return {
		manifest: readJson(`${campaignRoot}/manifest.json`),
		target: readJson(`${campaignRoot}/direction/greatsword-metal-ranks-v1.target.json`),
		assignment: readJson(`${campaignRoot}/direction/greatsword-metal-ranks-v1.assignment.json`),
		prompt: readFileSync(
			`${campaignRoot}/direction/greatsword-metal-ranks-v1.prompt.txt`,
			'utf8'
		)
	};
}

describe('Greatsword candidate campaign validation', () => {
	it('accepts the complete seven-rank metal matrix while every item call remains gated', () => {
		const summary = validateGreatswordCampaign(fixtures());

		expect(summary).toEqual({
			campaignId: 'two-handed-greatsword-v1',
			materialCellCount: 7,
			dedicatedCandidateCount: 7,
			initialPixelCallCount: 8,
			currentDispatchablePixelCallCount: 0,
			state: 'direction-candidate-pending-owner-review'
		});
	});

	it('verifies repository-bound prompt, reference, candidate, and result hashes', async () => {
		await expect(validateGreatswordCampaignFiles(repositoryRoot)).resolves.toMatchObject({
			artifactState: 'direction-candidate-recorded',
			referenceCount: 2
		});
	});

	it('rejects a standalone candidate that bypasses the owner direction gate', () => {
		const input = fixtures();
		const manifest = structuredClone(input.manifest) as {
			plannedItems: Array<{ status: string }>;
		};
		manifest.plannedItems[0]!.status = 'assigned';

		expect(() => validateGreatswordCampaign({ ...input, manifest })).toThrow(
			/blocked-on-direction-decision/
		);
	});

	it('rejects a reordered or incomplete canonical metal ladder', () => {
		const input = fixtures();
		const manifest = structuredClone(input.manifest) as {
			coverage: { materialCells: unknown[] };
		};
		manifest.coverage.materialCells = manifest.coverage.materialCells.slice(0, 6);

		expect(() => validateGreatswordCampaign({ ...input, manifest })).toThrow(
			/exactly Bronze F through Sunsteel S/
		);
	});
});

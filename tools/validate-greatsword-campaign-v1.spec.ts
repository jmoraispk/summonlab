import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	reviewGreatswordProportions,
	validateGreatswordCampaign,
	validateGreatswordCampaignFiles,
	validateGreatswordProportions
} from './validate-greatsword-campaign-v1.js';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const campaignRoot = `${repositoryRoot}/assets/equipment/experiments/two-handed-greatsword-v1`;

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function fixtures() {
	return {
		manifest: readJson(`${campaignRoot}/manifest.json`),
		target: readJson(`${campaignRoot}/direction/greatsword-metal-ranks-v2.target.json`),
		assignment: readJson(`${campaignRoot}/direction/greatsword-metal-ranks-v2.assignment.json`),
		prompt: readFileSync(`${campaignRoot}/direction/greatsword-metal-ranks-v2.prompt.txt`, 'utf8')
	};
}

describe('Greatsword candidate campaign validation', () => {
	it('accepts a museum-grounded greatsword proportion envelope', () => {
		expect(
			validateGreatswordProportions({
				bladePx: 620,
				fullHiltPx: 240,
				exposedGripPx: 180,
				guardWidthPx: 230,
				pommelPx: 43,
				overallPx: 860
			})
		).toEqual({
			bladeToFullHilt: 2.58,
			bladeToExposedGrip: 3.44,
			bladePercent: 72.09,
			guardPercent: 26.74,
			pommelPercent: 5
		});
	});

	it('rejects the short-bladed v1 silhouette', () => {
		expect(() =>
			validateGreatswordProportions({
				bladePx: 492,
				fullHiltPx: 236,
				exposedGripPx: 190,
				guardWidthPx: 175,
				pommelPx: 45,
				overallPx: 728
			})
		).toThrow(/blade-to-full-hilt ratio/);
	});

	it('records an otherwise corrected sword as revise when its guard is too narrow', () => {
		expect(
			reviewGreatswordProportions({
				bladePx: 678,
				fullHiltPx: 251,
				exposedGripPx: 194,
				guardWidthPx: 194,
				pommelPx: 43,
				overallPx: 929
			})
		).toEqual({
			ratios: {
				bladeToFullHilt: 2.7,
				bladeToExposedGrip: 3.49,
				bladePercent: 72.98,
				guardPercent: 20.88,
				pommelPercent: 4.63
			},
			status: 'fail',
			failedCriteria: ['guardPercent']
		});
	});

	it('unlocks exactly seven item calls after a hash-bound owner direction decision', () => {
		const summary = validateGreatswordCampaign(fixtures());

		expect(summary).toEqual({
			campaignId: 'two-handed-greatsword-v1',
			materialCellCount: 7,
			dedicatedCandidateCount: 7,
			initialPixelCallCount: 8,
			currentDispatchablePixelCallCount: 0,
			state: 'item-production-review-pending-owner'
		});
	});

	it('verifies seven hash-bound dedicated candidates and proportion reviews', async () => {
		await expect(validateGreatswordCampaignFiles(repositoryRoot)).resolves.toMatchObject({
			artifactState: 'item-candidates-recorded',
			referenceCount: 0
		});
	});

	it('rejects a standalone candidate that bypasses its assigned production call', () => {
		const input = fixtures();
		const manifest = structuredClone(input.manifest) as {
			plannedItems: Array<{ status: string }>;
		};
		manifest.plannedItems[0]!.status = 'assigned';

		expect(() => validateGreatswordCampaign({ ...input, manifest })).toThrow(/candidate/);
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

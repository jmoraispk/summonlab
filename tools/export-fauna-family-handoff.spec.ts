import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildFaunaFamilyHandoff } from './export-fauna-family-handoff.js';
import { FaunaFamilyManifestSchema } from './family-affinity-production-lib.js';

const repositoryRoot = resolve(import.meta.dirname, '..');

describe('fauna-family-v1 candidate handoff', () => {
	it('publishes the complete 200-coordinate matrix without promoting any candidate', async () => {
		const handoff = await buildFaunaFamilyHandoff(repositoryRoot);
		const inventory = JSON.parse(handoff.inventoryBytes.toString('utf8')) as {
			schemaVersion: string;
			stateCeiling: string;
			counts: Record<string, number>;
			families: Array<{
				familyId: string;
				counts: Record<string, number>;
				forms: Array<{
					tier: string;
					coordinates: Array<{
						affinity: string;
						activeVersion: number;
						state: string;
						approved: boolean;
						runtime: boolean;
						unresolvedProviderFailure: unknown;
					}>;
				}>;
			}>;
		};
		const manifest = JSON.parse(handoff.manifestBytes.toString('utf8')) as {
			status: string;
			production: Record<string, unknown>;
		};
		const expectedCounts = {
			familyCount: 8,
			formCount: 40,
			affinityCount: 5,
			coordinateCount: 200,
			targetCount: 200,
			assignmentCount: 200,
			candidateCount: 200,
			resultCount: 200,
			provenanceRecordCount: 200,
			unresolvedProviderFailureCount: 0,
			approvedCount: 0,
			runtimeCount: 0
		};

		expect(inventory.schemaVersion).toBe('fauna-family-candidate-inventory-v1');
		expect(inventory.stateCeiling).toBe('candidate-only');
		expect(inventory.counts).toEqual(expectedCounts);
		expect(inventory.families.map(({ familyId }) => familyId)).toEqual([
			'wolves',
			'bears',
			'boars',
			'burrowers',
			'great-cats',
			'serpents',
			'crocodilians',
			'raptors'
		]);
		for (const family of inventory.families) {
			expect(family.counts).toEqual({
				formCount: 5,
				coordinateCount: 25,
				targetCount: 25,
				assignmentCount: 25,
				candidateCount: 25,
				resultCount: 25,
				provenanceRecordCount: 25,
				unresolvedProviderFailureCount: 0,
				approvedCount: 0,
				runtimeCount: 0
			});
			expect(family.forms.map(({ tier }) => tier)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
			for (const form of family.forms) {
				expect(form.coordinates.map(({ affinity }) => affinity)).toEqual([
					'normal',
					'fire',
					'earth',
					'wind',
					'water'
				]);
				expect(form.coordinates).toHaveLength(5);
				for (const coordinate of form.coordinates) {
					expect(coordinate).toMatchObject({
						activeVersion: 1,
						state: 'candidate-only',
						approved: false,
						runtime: false,
						unresolvedProviderFailure: null
					});
				}
			}
		}
		expect(manifest).toMatchObject({
			status: 'candidate-matrix-complete',
			production: {
				candidateCount: 200,
				resultCount: 200,
				provenanceRecordCount: 200,
				unresolvedProviderFailureCount: 0,
				approvedCount: 0,
				runtimeCount: 0,
				inventoryPath: 'assets/enemies/experiments/fauna-family-v1/inventory.json',
				evidenceInventoryPath: 'docs/evidence/fauna-family-v1/inventory.json',
				reviewGalleryPath: 'docs/evidence/fauna-family-v1/index.html'
			}
		});
		expect(() => FaunaFamilyManifestSchema.parse(manifest)).not.toThrow();
		expect(handoff.evidenceInventoryBytes.equals(handoff.inventoryBytes)).toBe(true);
		const html = handoff.galleryBytes.toString('utf8');
		expect(html.match(/class="family"/gu) ?? []).toHaveLength(8);
		expect(html.match(/class="form"/gu) ?? []).toHaveLength(40);
		expect(html.match(/class="candidate-card"/gu) ?? []).toHaveLength(200);
		expect(html).toContain(
			'../../../assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-grey-wolf/normal-v1.png'
		);
		expect(html).toContain('Candidate-only · 0 approved · 0 runtime');
	});

	it('does not depend on the completed original 750-coordinate manifest', async () => {
		const before = await readFile(
			resolve(repositoryRoot, 'assets/enemies/experiments/family-affinity-v1/manifest.json')
		);
		await buildFaunaFamilyHandoff(repositoryRoot);
		const after = await readFile(
			resolve(repositoryRoot, 'assets/enemies/experiments/family-affinity-v1/manifest.json')
		);

		expect(after.equals(before)).toBe(true);
	});
});

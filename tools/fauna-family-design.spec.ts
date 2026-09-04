import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	FamilyPacketSchema,
	FORM_TIERS,
	PRODUCTION_AFFINITIES
} from './family-affinity-production-lib';

const repositoryRoot = resolve(import.meta.dirname, '..');
const expansionRoot = 'assets/enemies/experiments/fauna-family-v1';

async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8')) as unknown;
}

describe('fauna-family-v1 design', () => {
	it('contains exactly nine schema-valid families and 45 unique T1-T5 forms', async () => {
		const activeSources = (await readJson(`${expansionRoot}/active-sources.json`)) as {
			baseProgramMutationForbidden: boolean;
			familyPacketPaths: string[];
		};

		expect(activeSources.baseProgramMutationForbidden).toBe(true);
		expect(activeSources.familyPacketPaths).toHaveLength(9);
		expect(new Set(activeSources.familyPacketPaths)).toHaveLength(9);

		const packets = await Promise.all(
			activeSources.familyPacketPaths.map(async (path) =>
				FamilyPacketSchema.parse(await readJson(path))
			)
		);
		expect(new Set(packets.map((packet) => packet.familyId))).toHaveLength(9);
		expect(packets.map((packet) => packet.sourceRaceNumber)).toEqual([
			31, 32, 33, 34, 35, 36, 37, 38, 39
		]);

		const forms = packets.flatMap((packet) => packet.forms);
		expect(forms).toHaveLength(45);
		expect(new Set(forms.map((form) => form.formId))).toHaveLength(45);

		for (const packet of packets) {
			expect(packet.forms.map((form) => form.tier)).toEqual(FORM_TIERS);
			expect(Object.keys(packet.affinityThemes)).toEqual(PRODUCTION_AFFINITIES);
			expect(packet.forms[2]?.signatureMechanic).not.toBeNull();
			expect(packet.forms[2]?.telegraph).not.toBeNull();
			expect(packet.forms[2]?.counterplay).not.toBeNull();
			expect(packet.forms[4]?.lowerFormInteraction).not.toBeNull();
		}
	});

	it('declares a new-only 225-coordinate scope with no materialized or promoted assets', async () => {
		const manifest = (await readJson(`${expansionRoot}/manifest.json`)) as {
			scope: {
				existingFamilyAction: string;
				existingFamilyCount: number;
				existingFormCount: number;
				existingCoordinateCount: number;
				newFamilyIds: string[];
				affinities: string[];
				newFamilyCount: number;
				newFormCount: number;
				newCoordinateCount: number;
			};
			production: {
				targetMaterializationStatus: string;
				targetCount: number;
				assignmentCount: number;
				candidateCount: number;
				approvedCount: number;
				runtimeCount: number;
				runtimeCatalogMutationForbidden: boolean;
			};
		};

		expect(manifest.scope).toMatchObject({
			existingFamilyAction: 'retain-without-regeneration',
			existingFamilyCount: 30,
			existingFormCount: 150,
			existingCoordinateCount: 750,
			newFamilyCount: 9,
			newFormCount: 45,
			newCoordinateCount: 225
		});
		expect(manifest.scope.affinities).toEqual(PRODUCTION_AFFINITIES);
		expect(manifest.scope.newFamilyIds).toHaveLength(9);
		expect(manifest.production).toMatchObject({
			targetMaterializationStatus: 'not-started',
			targetCount: 0,
			assignmentCount: 0,
			candidateCount: 0,
			approvedCount: 0,
			runtimeCount: 0,
			runtimeCatalogMutationForbidden: true
		});
	});

	it('leaves the completed original production manifest at 30 families and 750 assignments', async () => {
		const original = (await readJson(
			'assets/enemies/experiments/family-affinity-v1/manifest.json'
		)) as {
			canonicalMatrix: {
				familyCount: number;
				formCount: number;
				targetCount: number;
				assignmentCount: number;
			};
		};

		expect(original.canonicalMatrix).toMatchObject({
			familyCount: 30,
			formCount: 150,
			targetCount: 750,
			assignmentCount: 750
		});
	});
});

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	FamilyAffinityActiveSourcesSchema,
	FamilyPacketSchema,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	FORM_TIERS,
	PRODUCTION_AFFINITIES,
	familyAffinitySha256
} from './family-affinity-production-lib';

const repositoryRoot = resolve(import.meta.dirname, '..');
const expansionRoot = 'assets/enemies/experiments/fauna-family-v1';

async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8')) as unknown;
}

describe('fauna-family-v1 design', () => {
	it('keeps legacy registries and manifests confined to the family-affinity root', async () => {
		const activeSources = (await readJson(
			'assets/enemies/experiments/family-affinity-v1/active-sources.json'
		)) as Record<string, unknown>;
		const manifest = (await readJson(
			'assets/enemies/experiments/family-affinity-v1/manifest.json'
		)) as {
			canonicalMatrix: { activeCoordinates: Array<Record<string, unknown>> };
		};
		const crossRootRegistry = structuredClone(activeSources) as {
			mappingPath: string;
			familyPacketPaths: string[];
		};
		crossRootRegistry.mappingPath = crossRootRegistry.mappingPath.replace(
			'family-affinity-v1',
			'fauna-family-v1'
		);
		crossRootRegistry.familyPacketPaths = crossRootRegistry.familyPacketPaths.map((path) =>
			path.replace('family-affinity-v1', 'fauna-family-v1')
		);
		const crossRootManifest = structuredClone(manifest);
		crossRootManifest.canonicalMatrix.activeCoordinates[0]!.targetPath =
			'assets/enemies/experiments/fauna-family-v1/targets/forged/target-v1.json';

		expect(FamilyAffinityActiveSourcesSchema.safeParse(crossRootRegistry).success).toBe(false);
		expect(FamilyAffinityManifestSchema.safeParse(crossRootManifest).success).toBe(false);
	});

	it('rejects target and assignment paths from the other family-production experiment', async () => {
		const cases = [
			{
				root: 'assets/enemies/experiments/family-affinity-v1',
				otherRoot: expansionRoot,
				targetPath:
					'assets/enemies/experiments/family-affinity-v1/targets/dragons/dragon-fledgling/fire/target-v1.json',
				assignmentPath:
					'assets/enemies/experiments/family-affinity-v1/assignments/dragons/dragon-fledgling/fire/assignment-v1.json'
			},
			{
				root: expansionRoot,
				otherRoot: 'assets/enemies/experiments/family-affinity-v1',
				targetPath: `${expansionRoot}/targets/great-cats/great-cat-sabercat/fire/target-v1.json`,
				assignmentPath: `${expansionRoot}/assignments/great-cats/great-cat-sabercat/fire/assignment-v1.json`
			}
		] as const;

		for (const testCase of cases) {
			const target = FamilyAffinityTargetSchema.parse(await readJson(testCase.targetPath));
			const assignment = FamilyAffinityAssignmentSchema.parse(
				await readJson(testCase.assignmentPath)
			);
			const crossRootPacket = {
				...target,
				sources: {
					...target.sources,
					familyPacketPath: target.sources.familyPacketPath.replace(
						testCase.root,
						testCase.otherRoot
					)
				}
			};
			const crossRootMapping = {
				...target,
				sources: {
					...target.sources,
					mappingPath: target.sources.mappingPath.replace(testCase.root, testCase.otherRoot)
				}
			};
			const crossRootAnchor = {
				...target,
				anchor:
					target.anchor.kind === 'normal-approved-review'
						? {
								...target.anchor,
								normalTargetPath: target.anchor.normalTargetPath.replace(
									testCase.root,
									testCase.otherRoot
								)
							}
						: target.anchor
			};
			const crossRootCandidate = {
				...assignment,
				allowedOutputs: {
					...assignment.allowedOutputs,
					candidate: assignment.allowedOutputs.candidate.replace(testCase.root, testCase.otherRoot)
				}
			};
			const crossRootResult = {
				...assignment,
				allowedOutputs: {
					...assignment.allowedOutputs,
					result: assignment.allowedOutputs.result.replace(testCase.root, testCase.otherRoot)
				}
			};

			expect(FamilyAffinityTargetSchema.safeParse(crossRootPacket).success).toBe(false);
			expect(FamilyAffinityTargetSchema.safeParse(crossRootMapping).success).toBe(false);
			expect(FamilyAffinityTargetSchema.safeParse(crossRootAnchor).success).toBe(false);
			expect(FamilyAffinityAssignmentSchema.safeParse(crossRootCandidate).success).toBe(false);
			expect(FamilyAffinityAssignmentSchema.safeParse(crossRootResult).success).toBe(false);
		}
	});

	it('contains exactly eight schema-valid families and 40 unique T1-T5 forms', async () => {
		const activeSources = (await readJson(`${expansionRoot}/active-sources.json`)) as {
			baseProgramMutationForbidden: boolean;
			familyPacketPaths: string[];
		};

		expect(activeSources.baseProgramMutationForbidden).toBe(true);
		expect(activeSources.familyPacketPaths).toHaveLength(8);
		expect(new Set(activeSources.familyPacketPaths)).toHaveLength(8);

		const packets = await Promise.all(
			activeSources.familyPacketPaths.map(async (path) =>
				FamilyPacketSchema.parse(await readJson(path))
			)
		);
		expect(new Set(packets.map((packet) => packet.familyId))).toHaveLength(8);
		expect(packets.map((packet) => packet.sourceRaceNumber)).toEqual([
			31, 32, 33, 34, 35, 36, 37, 38
		]);

		const forms = packets.flatMap((packet) => packet.forms);
		expect(forms).toHaveLength(40);
		expect(new Set(forms.map((form) => form.formId))).toHaveLength(40);

		for (const packet of packets) {
			expect(packet.forms.map((form) => form.tier)).toEqual(FORM_TIERS);
			expect(Object.keys(packet.affinityThemes)).toEqual(PRODUCTION_AFFINITIES);
			expect(packet.forms[2]?.signatureMechanic).not.toBeNull();
			expect(packet.forms[2]?.telegraph).not.toBeNull();
			expect(packet.forms[2]?.counterplay).not.toBeNull();
			expect(packet.forms[4]?.lowerFormInteraction).not.toBeNull();
		}
	});

	it('materializes exactly 200 collision-safe target and assignment pairs', async () => {
		const manifest = (await readJson(`${expansionRoot}/manifest.json`)) as {
			schemaVersion: string;
			experimentId: string;
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
			canonicalMatrix: {
				familyCount: number;
				formCount: number;
				affinities: string[];
				targetCount: number;
				assignmentCount: number;
				activeCoordinates: Array<{
					coordinateId: string;
					targetPath: string;
					targetSha256: string;
					assignmentPath: string;
					assignmentSha256: string;
				}>;
			};
		};

		expect(manifest.scope).toMatchObject({
			existingFamilyAction: 'retain-without-regeneration',
			existingFamilyCount: 30,
			existingFormCount: 150,
			existingCoordinateCount: 750,
			newFamilyCount: 8,
			newFormCount: 40,
			newCoordinateCount: 200
		});
		expect(manifest.scope.affinities).toEqual(PRODUCTION_AFFINITIES);
		expect(manifest.scope.newFamilyIds).toHaveLength(8);
		expect(manifest.production).toMatchObject({
			targetMaterializationStatus: 'materialized',
			targetCount: 200,
			assignmentCount: 200,
			candidateCount: 0,
			approvedCount: 0,
			runtimeCount: 0,
			runtimeCatalogMutationForbidden: true
		});
		expect(manifest.canonicalMatrix).toMatchObject({
			familyCount: 8,
			formCount: 40,
			affinities: PRODUCTION_AFFINITIES,
			targetCount: 200,
			assignmentCount: 200
		});
		expect(manifest.canonicalMatrix.activeCoordinates).toHaveLength(200);

		const seenTargets = new Set<string>();
		const seenAssignments = new Set<string>();
		const seenOutputs = new Set<string>();
		for (const coordinate of manifest.canonicalMatrix.activeCoordinates) {
			const target = FamilyAffinityTargetSchema.parse(await readJson(coordinate.targetPath));
			const assignment = FamilyAffinityAssignmentSchema.parse(
				await readJson(coordinate.assignmentPath)
			);
			expect(target.experimentId).toBe('fauna-family-v1');
			expect(assignment.experimentId).toBe('fauna-family-v1');
			expect(coordinate.targetSha256).toBe(familyAffinitySha256(target));
			expect(coordinate.assignmentSha256).toBe(familyAffinitySha256(assignment));
			expect(assignment.targetSha256).toBe(coordinate.targetSha256);
			expect(assignment.allowedOutputs).toEqual({
				candidate: target.ownedPaths.candidate,
				result: target.ownedPaths.result
			});
			seenTargets.add(coordinate.targetPath);
			seenAssignments.add(coordinate.assignmentPath);
			seenOutputs.add(target.ownedPaths.candidate);
			seenOutputs.add(target.ownedPaths.result);
		}
		const greyWolf = FamilyAffinityTargetSchema.parse(
			await readJson(`${expansionRoot}/targets/wolves/wolf-grey-wolf/normal/target-v1.json`)
		);
		expect((greyWolf as Record<string, unknown>).familyDisplayName).toBe('Wolves');
		expect((greyWolf as Record<string, unknown>).formDisplayName).toBe('Grey Wolf');
		expect(seenTargets).toHaveLength(200);
		expect(seenAssignments).toHaveLength(200);
		expect(seenOutputs).toHaveLength(400);
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

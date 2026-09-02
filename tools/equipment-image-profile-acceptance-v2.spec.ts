import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EquipmentV2ProfileAcceptanceSchema } from './equipment-image-production-contract-v2.js';
import {
	EQUIPMENT_V2_ACCEPTED_AT,
	EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
	EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH,
	buildEquipmentV2ProfileAcceptance,
	canonicalJsonSha256V2,
	persistEquipmentV2ProfileAcceptance
} from './equipment-image-profile-acceptance-v2.js';
import {
	EQUIPMENT_V2_VISUAL_PROFILE_PATH,
	buildEquipmentVisualProfileV2
} from './equipment-image-profile-v2.js';
import { EQUIPMENT_V2_PRODUCTION_ROOT } from './equipment-material-production-v2.js';

const SOURCE_ROOT = process.cwd();
const temporaryRoots: string[] = [];

function absolute(root: string, repositoryPath: string): string {
	return path.join(root, ...repositoryPath.split('/'));
}

async function makeFixture(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'equipment-v2-acceptance-'));
	temporaryRoots.push(root);
	const sourceProductionRoot = absolute(SOURCE_ROOT, EQUIPMENT_V2_PRODUCTION_ROOT);
	const excludedProductionDirectories = new Set([
		'targets',
		'assignments',
		'runs',
		'reviews',
		'candidates',
		'results'
	]);
	await cp(sourceProductionRoot, absolute(root, EQUIPMENT_V2_PRODUCTION_ROOT), {
		recursive: true,
		filter: (source) => {
			const relative = path.relative(sourceProductionRoot, source);
			return (
				relative.length === 0 || !excludedProductionDirectories.has(relative.split(path.sep)[0]!)
			);
		}
	});
	await rm(absolute(root, EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH), { force: true });
	for (const reference of buildEquipmentVisualProfileV2().references) {
		const destination = absolute(root, reference.path);
		await mkdir(path.dirname(destination), { recursive: true });
		await cp(absolute(SOURCE_ROOT, reference.path), destination);
	}
	return root;
}

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe('Equipment v2 visual-profile acceptance', () => {
	it('binds the exact semantically validated profile without authorizing a run', () => {
		const profile = buildEquipmentVisualProfileV2();
		expect(canonicalJsonSha256V2(profile)).toBe(EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256);
		expect(
			buildEquipmentV2ProfileAcceptance({
				profile,
				acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
			})
		).toEqual({
			schemaVersion: 'equipment-visual-profile-acceptance-v2',
			acceptanceId: 'equipment-material-visual-profile-v2-acceptance',
			productionId: 'material-equipment-v2',
			profileId: 'equipment-material-visual-profile-v2',
			profileSchemaVersion: 'equipment-visual-profile-v2',
			profilePath: EQUIPMENT_V2_VISUAL_PROFILE_PATH,
			profileCanonicalSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
			decision: 'accepted',
			reviewer: 'owner',
			acceptedAt: EQUIPMENT_V2_ACCEPTED_AT,
			authorizationScope: 'visual-profile-only'
		});
	});

	it('rejects a stale acknowledgement and semantic profile drift', () => {
		const profile = buildEquipmentVisualProfileV2();
		expect(() =>
			buildEquipmentV2ProfileAcceptance({
				profile,
				acknowledgedProfileSha256: '0'.repeat(64)
			})
		).toThrow('acknowledged v2 profile hash');
		expect(() =>
			buildEquipmentV2ProfileAcceptance({
				profile: {
					...profile,
					equipmentClassDefaults: profile.equipmentClassDefaults.slice(1)
				},
				acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
			})
		).toThrow();
		const cosmeticallyChangedProfile = {
			...profile,
			style: { ...profile.style, lighting: 'owner did not accept this changed lighting' }
		};
		expect(() =>
			buildEquipmentV2ProfileAcceptance({
				profile: cosmeticallyChangedProfile,
				acknowledgedProfileSha256: canonicalJsonSha256V2(cosmeticallyChangedProfile)
			})
		).toThrow('owner-accepted canonical SHA-256');
	});

	it('exclusive-creates only the acceptance receipt after checking every reference byte', async () => {
		const root = await makeFixture();
		await expect(
			persistEquipmentV2ProfileAcceptance({
				workspaceRoot: root,
				acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
			})
		).resolves.toEqual({ mode: 'write', writesPerformed: 1 });
		const receipt = EquipmentV2ProfileAcceptanceSchema.parse(
			JSON.parse(await readFile(absolute(root, EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH), 'utf8'))
		);
		expect(receipt.authorizationScope).toBe('visual-profile-only');
		for (const directory of [
			'targets',
			'assignments',
			'runs',
			'reviews',
			'candidates',
			'results'
		]) {
			await expect(
				readdir(absolute(root, `${EQUIPMENT_V2_PRODUCTION_ROOT}/${directory}`))
			).rejects.toMatchObject({ code: 'ENOENT' });
		}
		await expect(
			persistEquipmentV2ProfileAcceptance({
				workspaceRoot: root,
				acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
			})
		).rejects.toThrow(/already exists|collision/iu);
	});

	it('performs no acceptance write when a reference byte is stale', async () => {
		const root = await makeFixture();
		const referencePath = buildEquipmentVisualProfileV2().references[0]!.path;
		await writeFile(absolute(root, referencePath), 'stale-reference');
		await expect(
			persistEquipmentV2ProfileAcceptance({
				workspaceRoot: root,
				acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
			})
		).rejects.toThrow('reference byte hash mismatch');
		await expect(
			readFile(absolute(root, EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});
});

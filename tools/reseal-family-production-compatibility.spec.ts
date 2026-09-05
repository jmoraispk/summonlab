import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { stableFamilyAffinityJson } from './family-affinity-production-lib.js';
import { resealFamilyProductionCompatibility } from './reseal-family-production-compatibility.js';

const repositoryRoot = process.cwd();
const legacyPath = 'assets/enemies/experiments/family-affinity-v1/production-compatibility.json';
const faunaPath = 'assets/enemies/experiments/fauna-family-v1/production-compatibility.json';
const temporaryRoots: string[] = [];

async function stageResealFixture() {
	const fixtureRoot = await mkdtemp(join(tmpdir(), 'family-production-reseal-'));
	temporaryRoots.push(fixtureRoot);
	await cp(
		join(repositoryRoot, 'skills/summonlab-image-production'),
		join(fixtureRoot, 'skills/summonlab-image-production'),
		{ recursive: true }
	);
	for (const path of [legacyPath, faunaPath]) {
		await mkdir(dirname(join(fixtureRoot, path)), { recursive: true });
		await cp(join(repositoryRoot, path), join(fixtureRoot, path));
	}
	return fixtureRoot;
}

async function readReceipt(root: string, path: string) {
	return JSON.parse(await readFile(join(root, path), 'utf8'));
}

function approvalProjection(receipt: Record<string, unknown>) {
	return {
		approvedSkillRoot: receipt.approvedSkillRoot,
		reviewedAt: receipt.reviewedAt,
		approvalReference: receipt.approvalReference,
		...('bridgeExtension' in receipt ? { bridgeExtension: receipt.bridgeExtension } : {}),
		...('provisionalAnchorExtension' in receipt
			? { provisionalAnchorExtension: receipt.provisionalAnchorExtension }
			: {})
	};
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('family production compatibility reseal approval policy', () => {
	it('preserves each existing approval record during a hash-only reseal', async () => {
		const fixtureRoot = await stageResealFixture();
		const legacy = await readReceipt(fixtureRoot, legacyPath);
		const fauna = await readReceipt(fixtureRoot, faunaPath);
		legacy.approvedSkillRoot = '/approved/legacy/image-production';
		legacy.reviewedAt = '2026-09-02T23:59:58.000Z';
		legacy.bridgeExtension.reviewedAt = '2026-09-02T23:59:57.000Z';
		legacy.provisionalAnchorExtension.reviewedAt = '2026-09-03T23:59:56.000Z';
		fauna.approvedSkillRoot = '/approved/fauna/image-production';
		fauna.reviewedAt = '2026-09-04T23:59:55.000Z';
		await writeFile(join(fixtureRoot, legacyPath), stableFamilyAffinityJson(legacy));
		await writeFile(join(fixtureRoot, faunaPath), stableFamilyAffinityJson(fauna));

		const expected = {
			legacy: approvalProjection(legacy),
			fauna: approvalProjection(fauna)
		};
		await resealFamilyProductionCompatibility({ repositoryRoot: fixtureRoot, write: true });

		expect(approvalProjection(await readReceipt(fixtureRoot, legacyPath))).toEqual(expected.legacy);
		expect(approvalProjection(await readReceipt(fixtureRoot, faunaPath))).toEqual(expected.fauna);
	});

	it('rejects incomplete metadata instead of silently changing an approved root', async () => {
		const fixtureRoot = await stageResealFixture();
		await expect(
			resealFamilyProductionCompatibility({
				repositoryRoot: fixtureRoot,
				write: true,
				approvalMetadata: {
					schemaVersion: 'family-production-reseal-approval-v1',
					profiles: {
						'image-production-family-target-v1': {
							approvedSkillRoot: '/new/approved/root'
						}
					}
				} as never
			})
		).rejects.toThrow(/complete approval metadata/i);
	});

	it('changes approval fields only from a complete explicit approval record', async () => {
		const fixtureRoot = await stageResealFixture();
		const legacy = await readReceipt(fixtureRoot, legacyPath);
		const fauna = await readReceipt(fixtureRoot, faunaPath);
		const approvalMetadata = {
			schemaVersion: 'family-production-reseal-approval-v1' as const,
			profiles: {
				'image-production-family-target-v1': {
					...approvalProjection(legacy),
					approvedSkillRoot: '/explicitly/approved/legacy-root'
				},
				'image-production-fauna-family-target-v1': {
					...approvalProjection(fauna),
					approvedSkillRoot: '/explicitly/approved/fauna-root'
				}
			}
		};

		await resealFamilyProductionCompatibility({
			repositoryRoot: fixtureRoot,
			write: true,
			approvalMetadata
		});

		expect(approvalProjection(await readReceipt(fixtureRoot, legacyPath))).toEqual(
			approvalMetadata.profiles['image-production-family-target-v1']
		);
		expect(approvalProjection(await readReceipt(fixtureRoot, faunaPath))).toEqual(
			approvalMetadata.profiles['image-production-fauna-family-target-v1']
		);
	});
});

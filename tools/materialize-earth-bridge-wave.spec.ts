import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	buildEarthBridgeWave,
	buildEarthBridgeMaterialization,
	EarthBridgeWaveSchema,
	materializeEarthBridgeWave
} from './materialize-earth-bridge-wave.js';

const repositoryRoot = process.cwd();
const familyRoot = 'assets/enemies/experiments/family-affinity-v1';

async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(join(repositoryRoot, path), 'utf8'));
}

describe('Earth bridge wave controller', () => {
	it('validates the sealed v1 bridge after the canonical Elementals migration', async () => {
		await expect(
			materializeEarthBridgeWave({ repositoryRoot, check: true })
		).resolves.toMatchObject({ mode: 'check', targetCount: 40, artifactCount: 80 });
	});

	it('derives all retained current classes in source order without duplicating canonical coordinates', async () => {
		const wave = EarthBridgeWaveSchema.parse(
			await buildEarthBridgeWave({
				repositoryRoot,
				mapping: await readJson(`${familyRoot}/mappings/current-class-mapping-v2.json`),
				visualIndex: await readJson('docs/wiki/creatures/monsters/visual-index.json'),
				manifest: await readJson(`${familyRoot}/manifest.json`)
			})
		);

		expect(wave.targetCount).toBe(40);
		expect(wave.classificationCounts).toEqual({
			map: 1,
			'rename-map': 9,
			'secondary-archetype': 25,
			fauna: 5,
			retire: 0
		});
		expect(wave.mappedPrimaryCount).toBe(10);
		expect(wave.bridgeOnlyTargetCount).toBe(30);
		expect(wave.dispatchableTargetCount).toBe(39);
		expect(wave.blockedCount).toBe(1);
		expect(new Set(wave.entries.map(({ currentClassId }) => currentClassId)).size).toBe(40);
		const mapped = wave.entries.filter(({ targetKind }) => targetKind === 'mapped-primary-bridge');
		expect(new Set(mapped.map(({ canonicalCoordinateId }) => canonicalCoordinateId)).size).toBe(10);
		expect(mapped.every(({ targetPath }) => targetPath?.includes('/bridge/targets/'))).toBe(true);
		const bridgeOnly = wave.entries.filter(
			({ targetKind }) => targetKind !== 'mapped-primary-bridge'
		);
		expect(bridgeOnly).toHaveLength(30);
		expect(
			bridgeOnly.every(
				({ currentClassId, targetPath, assignmentPath }) =>
					targetPath === null ||
					(targetPath === `${familyRoot}/bridge/targets/${currentClassId}/earth/target-v1.json` &&
						assignmentPath ===
							`${familyRoot}/bridge/assignments/${currentClassId}/earth/assignment-v1.json`)
			)
		).toBe(true);
		expect(wave.entries.every(({ affinity }) => affinity === 'earth')).toBe(true);
		expect(
			wave.entries.every(({ status }) =>
				['earth-bridge-provisional', 'blocked-on-identity-decision'].includes(status)
			)
		).toBe(true);
		expect(JSON.stringify(wave)).not.toMatch(/wood|metal|runtime-active/iu);
	});

	it('materializes 39 bridge dispatch packets while retaining the blocked Tower Basilisk decision', async () => {
		const build = await buildEarthBridgeMaterialization({
			repositoryRoot,
			mapping: await readJson(`${familyRoot}/mappings/current-class-mapping-v2.json`),
			visualIndex: await readJson('docs/wiki/creatures/monsters/visual-index.json'),
			manifest: await readJson(`${familyRoot}/manifest.json`)
		});
		expect(build.bridgePackets).toHaveLength(30);
		expect(
			build.bridgePackets.filter(({ signalSupport }) => signalSupport === 'derived-approved')
		).toHaveLength(12);
		expect(
			build.bridgePackets.filter(({ signalSupport }) => signalSupport === 'source-exact')
		).toHaveLength(18);
		const approvedSignals = Object.fromEntries(
			build.bridgePackets
				.filter(({ signalSupport }) => signalSupport === 'derived-approved')
				.map(({ currentClassId, telegraph, counterplay }) => [
					currentClassId,
					{ telegraph, counterplay }
				])
		);
		expect(approvedSignals).toEqual({
			'cave-bear': {
				telegraph: 'shoulders rise/forelimbs load before overrun',
				counterplay: 'spacing, guard, injury control'
			},
			'cave-troll': {
				telegraph: 'shoulder/arm loads and visible wound regrows',
				counterplay: 'fire, kiting, finishing'
			},
			'crystal-guardian': {
				telegraph: 'facets align around core before beam/refraction',
				counterplay: 'spell control, damage typing, core targeting'
			},
			'dire-wolf': {
				telegraph: 'head lowers and hindquarters load for pursuit',
				counterplay: 'stamina, rescue movement, composure'
			},
			'frost-giant': {
				telegraph: 'iron/command arm rises as whiteout gathers',
				counterplay: 'cold survival, formation, sustained focus'
			},
			'goblin-archer': {
				telegraph: 'bow draws and target mark settles',
				counterplay: 'cover, shield, closing distance'
			},
			'goblin-hexweaver': {
				telegraph: 'marks converge and casting hand locks during concentration',
				counterplay: 'ward reading, interrupts, focus'
			},
			'goblin-skirmisher': {
				telegraph: 'knife/lead foot feint commits',
				counterplay: 'guard timing, weapon handling, target focus'
			},
			'grey-wolf': {
				telegraph: 'shoulder/gaze shifts to flank before trip',
				counterplay: 'footwork, perception, ally protection'
			},
			'iron-sentinel': {
				telegraph: 'guard closes and weapon sets before parry',
				counterplay: 'feint, penetration, action economy'
			},
			'ogoblin-brute': {
				telegraph: 'weapon or open grab hand winds up',
				counterplay: 'team rotation, restraint escape, damage windows'
			},
			'tunnel-boar': {
				telegraph: 'head/tusks lower and forefeet brace',
				counterplay: 'dodge, bracing, terrain use'
			}
		});
		const hexweaver = build.bridgePackets.find(
			({ currentClassId }) => currentClassId === 'goblin-hexweaver'
		)!;
		expect(hexweaver).toMatchObject({
			telegraph: 'marks converge and casting hand locks during concentration',
			counterplay: 'ward reading, interrupts, focus',
			signalSupport: 'derived-approved',
			controllerApprovalReference: 'root-approved-task10-derived-bridge-signals-2026-09-02'
		});
		expect(hexweaver.signalEvidence[0]).toMatchObject({
			path: 'packages/content/src/enemy-roster.ts',
			locator: 'lines 33-39'
		});
		expect(build.bridgeTargets).toHaveLength(39);
		expect(build.bridgeAssignments).toHaveLength(39);
		expect(build.manifest.canonicalMatrix.activeCoordinates).toHaveLength(750);
		expect(build.manifest.bridge.activeCoordinates).toHaveLength(39);
		expect(build.bridgeTargets.every(({ namespace }) => namespace === 'bridge')).toBe(true);
		expect(
			build.bridgeTargets.filter(({ canonicalCoordinateId }) => canonicalCoordinateId !== undefined)
		).toHaveLength(10);
		expect(
			build.bridgeTargets
				.filter(({ canonicalCoordinateId }) => canonicalCoordinateId === undefined)
				.every(({ tier }) => tier === 'bridge-only')
		).toBe(true);
		const basilisk = build.wave.entries.find(
			({ currentClassId }) => currentClassId === 'tower-basilisk'
		)!;
		expect(basilisk).toMatchObject({
			targetKind: 'blocked-bridge-only',
			status: 'blocked-on-identity-decision',
			targetPath: null,
			assignmentPath: null,
			normalReference: { legacyResultStatus: 'revise', approvalEvidence: false }
		});
		expect(basilisk.identityDecisionRequired).toMatch(/quadrupedal|six-legged/i);
		expect(
			build.bridgeTargets.some(({ currentClassId }) => currentClassId === 'tower-basilisk')
		).toBe(false);
		expect(
			build.manifest.bridge.activeCoordinates.some(
				({ currentClassId }) => currentClassId === 'tower-basilisk'
			)
		).toBe(false);
	});

	it('binds each retained entry to the exact existing Normal candidate bytes', async () => {
		const wave = await buildEarthBridgeWave({
			repositoryRoot,
			mapping: await readJson(`${familyRoot}/mappings/current-class-mapping-v2.json`),
			visualIndex: await readJson('docs/wiki/creatures/monsters/visual-index.json'),
			manifest: await readJson(`${familyRoot}/manifest.json`)
		});

		for (const entry of wave.entries) {
			const bytes = await readFile(join(repositoryRoot, entry.normalReference.candidatePath));
			expect(entry.normalReference.candidateSha256).toBe(
				createHash('sha256').update(bytes).digest('hex')
			);
			expect(entry.normalReference.referenceStatus).toBe('earth-bridge-provisional');
			expect(bytes.byteLength).toBeGreaterThan(0);
		}
	});

	it('fails closed on missing Normal references, duplicate canonical claims, and retired leakage', async () => {
		const mapping = (await readJson(`${familyRoot}/mappings/current-class-mapping-v2.json`)) as {
			entries: Array<Record<string, unknown>>;
		};
		const visualIndex = (await readJson('docs/wiki/creatures/monsters/visual-index.json')) as {
			reconciliation: { entries: Array<Record<string, unknown>> };
		};
		const manifest = await readJson(`${familyRoot}/manifest.json`);

		const missingReference = structuredClone(visualIndex);
		missingReference.reconciliation.entries[0]!.references = [];
		await expect(
			buildEarthBridgeWave({ repositoryRoot, mapping, visualIndex: missingReference, manifest })
		).rejects.toThrow(/Normal reference/i);

		const duplicate = structuredClone(mapping);
		duplicate.entries[2]!.canonicalFamilyId = duplicate.entries[1]!.canonicalFamilyId;
		duplicate.entries[2]!.canonicalFormId = duplicate.entries[1]!.canonicalFormId;
		await expect(
			buildEarthBridgeWave({ repositoryRoot, mapping: duplicate, visualIndex, manifest })
		).rejects.toThrow(/duplicate canonical/i);

		const retired = structuredClone(mapping);
		retired.entries[0]!.disposition = 'retire';
		await expect(
			buildEarthBridgeWave({ repositoryRoot, mapping: retired, visualIndex, manifest })
		).rejects.toThrow();
	});
});

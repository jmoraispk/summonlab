import { ExplorationEncounterRequestSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { combatRequestHash } from './combat-hash';
import { combatFixtureAssetBindings, RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';

describe('rat encounter fixture', () => {
	it('is a valid, self-hashed eight-actor fixture request', () => {
		const parsed = ExplorationEncounterRequestSchema.parse(RAT_ENCOUNTER_REQUEST);
		expect(parsed.party.map((hero) => hero.heroRef.heroId)).toEqual([
			'saffron-braid',
			'iron-guardian',
			'moss-archer'
		]);
		expect(parsed.enemies).toHaveLength(5);
		expect(parsed.bounds.maximumCombatants).toBe(8);
		expect(combatRequestHash(parsed)).toBe(parsed.requestHash);
	});

	it('binds every current raster and motion source by SHA-256', () => {
		const sources = combatFixtureAssetBindings(RAT_ENCOUNTER_REQUEST);
		expect(sources).toHaveLength(17);
		expect(new Set(sources.map((asset) => asset.contentHash)).size).toBe(17);
		expect(sources.every((asset) => asset.status === 'fixture')).toBe(true);
	});

	it('pins fixture assets, approvals, bounds, profiles, and frozen request data', () => {
		const participants = [...RAT_ENCOUNTER_REQUEST.party, ...RAT_ENCOUNTER_REQUEST.enemies];
		const bindings = [
			RAT_ENCOUNTER_REQUEST.battlefieldBinding.environmentAssetBinding,
			...RAT_ENCOUNTER_REQUEST.battlefieldBinding.occluderAssetBindings,
			...participants.flatMap((participant) => [
				participant.presentation.combatAssetBinding,
				participant.presentation.motionPackBinding,
				{
					source: participant.presentation.motionPackBinding.atlasImageSource,
					contentHash: participant.presentation.motionPackBinding.atlasImageHash,
					approvalStatus: participant.presentation.motionPackBinding.approvalStatus
				}
			])
		];
		const sourceMetadata = Object.fromEntries(
			[...new Map(bindings.map((binding) => [binding.source, binding])).values()].map((binding) => [
				binding.source,
				{ contentHash: binding.contentHash, approvalStatus: binding.approvalStatus }
			])
		);
		expect(sourceMetadata).toEqual({
			'/runtime/combat/realtime-study-v1/ruined-threshold-environment-v1.png': {
				contentHash: 'cb6db22b2c162f090cfdc3c4ca7be9eb44a7bcc635437ec42679a33e66640063',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/environment-occluders-v1/well-foreground-v1.png': {
				contentHash: '3daa98cddde1994dc3b76bbdc7fa18e6b495a2d80eeccbad62f230b4fad0e129',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/hero-saffron-braid-ready-v1.png': {
				contentHash: '9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/hero-iron-guardian-ready-v1.png': {
				contentHash: '66b7017812f2bd218a221d5f19b26b861951350293e6b7692bc055d0c46ec114',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/hero-moss-archer-ready-v1.png': {
				contentHash: '9c94401448f51dc6521c7aae3d00fa15e47bc4b27c452b666023f1d5fcd5bb36',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/rat-brute-ready-v1.png': {
				contentHash: 'd7850557ee7c04fd088ec4b48cf3dfe2db098887c7ab0205b0eea8e47b3876b2',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/lesser-rat-ready-v1.png': {
				contentHash: '2715adb8ecf78a93ccccaabd55272046206bb489ad1c897aef7b87fff3db4860',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/asha/asha-motion-v2.json': {
				contentHash: '6584b2642f98eb907ca2bae317016ed030f14d92aa4490af5aa09ef4be3e2308',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/asha/asha-motion-v2.png': {
				contentHash: '11d40da687b1795f8a8797ba09c348f332100a8d0b1d6420544d19830a82f996',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v5.json': {
				contentHash: '8d949316d0e09b4f87965bf772dace215b1a194e647befe47f857d56f34a717f',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-v5.png': {
				contentHash: '7570e5324e42b3d0c8403990f25ea525b4e7231c67d2b52ae01156853aa7858a',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/moss-archer/moss-archer-motion-v4.json': {
				contentHash: '0f304fbca4cabf8487db72a7b8dbef9c558d615219cce5281de385a1dbb1aeab',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/moss-archer/moss-archer-motion-v4.png': {
				contentHash: '33e8e9eb65e84e23d84cdb56fd8f14a633624fc5e3809ebc4853f38a92ae77f5',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/rat-brute/rat-brute-motion-v1.json': {
				contentHash: '735767a1122eca708c8c4602e8adac06cf0faf84626778fd0ab187ce5d5cb1fe',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/rat-brute/rat-brute-motion-v1.png': {
				contentHash: '4b6960602cd66044659b23f3bc4b6757ad0f19a18db7dcedc164d7e5baa5e7cc',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/lesser-rat/lesser-rat-motion-v2.json': {
				contentHash: '5c56e9d0d3d2e508dbb58f2f4fc3bfec86cbd6a4c29340af6b9c2bb5391c7148',
				approvalStatus: 'fixture-only'
			},
			'/runtime/combat/realtime-study-v1/animation-canary-v1/lesser-rat/lesser-rat-motion-v2.png': {
				contentHash: '56a3338099ac3d71238d3c0406a91d6519b5246771f0cdde63bf3fcf0019ce0b',
				approvalStatus: 'fixture-only'
			}
		});
		expect(RAT_ENCOUNTER_REQUEST.bounds).toEqual({
			maximumCombatants: 8,
			maximumSimulationTicks: 3_600,
			maximumTraceEvents: 2_000
		});
		expect(
			[...RAT_ENCOUNTER_REQUEST.party, ...RAT_ENCOUNTER_REQUEST.enemies].map(
				(participant) => participant.combatProfile
			)
		).toEqual([
			{ movementUnitsPerSecond: 0.082, attackRange: 0.075, attackPower: 19, armour: 0, attackIntervalTicks: 47 },
			{ movementUnitsPerSecond: 0.063, attackRange: 0.08, attackPower: 14, armour: 0, attackIntervalTicks: 57 },
			{ movementUnitsPerSecond: 0.071, attackRange: 0.25, attackPower: 17, armour: 0, attackIntervalTicks: 65 },
			{ movementUnitsPerSecond: 0.052, attackRange: 0.09, attackPower: 18, armour: 0, attackIntervalTicks: 72 },
			{ movementUnitsPerSecond: 0.092, attackRange: 0.062, attackPower: 9, armour: 0, attackIntervalTicks: 56 },
			{ movementUnitsPerSecond: 0.092, attackRange: 0.062, attackPower: 9, armour: 0, attackIntervalTicks: 58 },
			{ movementUnitsPerSecond: 0.092, attackRange: 0.062, attackPower: 9, armour: 0, attackIntervalTicks: 60 },
			{ movementUnitsPerSecond: 0.092, attackRange: 0.062, attackPower: 9, armour: 0, attackIntervalTicks: 63 }
		]);
		expect(Object.isFrozen(RAT_ENCOUNTER_REQUEST)).toBe(true);
		expect(Object.isFrozen(RAT_ENCOUNTER_REQUEST.party[0]!.resources)).toBe(true);
		expect(() => {
			RAT_ENCOUNTER_REQUEST.party[0]!.resources.health = 1;
		}).toThrow(TypeError);
	});
});

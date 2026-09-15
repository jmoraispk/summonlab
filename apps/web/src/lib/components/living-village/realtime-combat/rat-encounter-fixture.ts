import {
	ExplorationEncounterRequestSchema,
	type ExplorationCombatEnemy,
	type ExplorationCombatHero,
	type ExplorationEncounterRequest
} from '@summonlab/contracts/exploration-combat';

import { combatValueHash } from './combat-hash';

const ART_ROOT = '/runtime/combat/realtime-study-v1';

const FIXTURE_HASHES = {
	environment: 'cb6db22b2c162f090cfdc3c4ca7be9eb44a7bcc635437ec42679a33e66640063',
	well: '3daa98cddde1994dc3b76bbdc7fa18e6b495a2d80eeccbad62f230b4fad0e129',
	ashaReady: '9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b',
	tomaReady: '66b7017812f2bd218a221d5f19b26b861951350293e6b7692bc055d0c46ec114',
	nessaReady: '9c94401448f51dc6521c7aae3d00fa15e47bc4b27c452b666023f1d5fcd5bb36',
	ratBruteReady: 'd7850557ee7c04fd088ec4b48cf3dfe2db098887c7ab0205b0eea8e47b3876b2',
	lesserRatReady: '2715adb8ecf78a93ccccaabd55272046206bb489ad1c897aef7b87fff3db4860'
} as const;

const FIXTURE_MOTION_HASHES = {
	asha: {
		json: '6584b2642f98eb907ca2bae317016ed030f14d92aa4490af5aa09ef4be3e2308',
		atlas: '11d40da687b1795f8a8797ba09c348f332100a8d0b1d6420544d19830a82f996'
	},
	'iron-guardian': {
		json: '8d949316d0e09b4f87965bf772dace215b1a194e647befe47f857d56f34a717f',
		atlas: '7570e5324e42b3d0c8403990f25ea525b4e7231c67d2b52ae01156853aa7858a'
	},
	'moss-archer': {
		json: '0f304fbca4cabf8487db72a7b8dbef9c558d615219cce5281de385a1dbb1aeab',
		atlas: '33e8e9eb65e84e23d84cdb56fd8f14a633624fc5e3809ebc4853f38a92ae77f5'
	},
	'rat-brute': {
		json: '735767a1122eca708c8c4602e8adac06cf0faf84626778fd0ab187ce5d5cb1fe',
		atlas: '4b6960602cd66044659b23f3bc4b6757ad0f19a18db7dcedc164d7e5baa5e7cc'
	},
	'lesser-rat': {
		json: '5c56e9d0d3d2e508dbb58f2f4fc3bfec86cbd6a4c29340af6b9c2bb5391c7148',
		atlas: '56a3338099ac3d71238d3c0406a91d6519b5246771f0cdde63bf3fcf0019ce0b'
	}
} as const;

const RAT_CLAIM_VALUES = {
	xpPerDefeatedEnemy: 4,
	practicePerAction: 1,
	materialByEnemyDefinitionId: {
		'rat-brute': { materialDefinitionId: 'plague-rat-tail', quantity: 1 },
		'plague-rat': { materialDefinitionId: 'plague-rat-tail', quantity: 1 }
	}
} as const;

export const RAT_ENCOUNTER_CLAIM_POLICY = {
	contentId: 'rat-study-claims',
	version: 'rat-study-claims-v1',
	contentHash: combatValueHash(RAT_CLAIM_VALUES),
	...RAT_CLAIM_VALUES
} as const;

export const RAT_ENCOUNTER_CLAIM_POLICY_BINDING = Object.freeze({
	contentId: RAT_ENCOUNTER_CLAIM_POLICY.contentId,
	version: RAT_ENCOUNTER_CLAIM_POLICY.version,
	contentHash: RAT_ENCOUNTER_CLAIM_POLICY.contentHash
});

function fixtureRaster(assetKey: string, source: string, contentHash: string) {
	return {
		assetKey,
		source,
		contentHash,
		approvalStatus: 'fixture-only' as const,
		approvalId: `${assetKey}-fixture`
	};
}

function fixtureMotion(
	motionPackId: string,
	version: number,
	contentHash: string,
	atlasImageHash: string
) {
	const root = `${ART_ROOT}/animation-canary-v1/${motionPackId}`;
	return {
		motionPackId,
		source: `${root}/${motionPackId}-motion-v${version}.json`,
		atlasImageSource: `${root}/${motionPackId}-motion-v${version}.png`,
		version,
		contentHash,
		atlasImageHash,
		approvalStatus: 'fixture-only' as const,
		approvalId: `${motionPackId}-motion-fixture`
	};
}

function fixturePresentation(
	assetKey: string,
	rasterSource: string,
	rasterHash: string,
	motionPackId: keyof typeof FIXTURE_MOTION_HASHES,
	version: number,
	visualTuning: {
		bodyOffsetY: number;
		shadowRadiusX: number;
		shadowRadiusY: number;
		displaySize: number;
	}
) {
	const motion = FIXTURE_MOTION_HASHES[motionPackId];
	return {
		combatAssetBinding: fixtureRaster(assetKey, rasterSource, rasterHash),
		motionPackBinding: fixtureMotion(motionPackId, version, motion.json, motion.atlas),
		visualTuning
	};
}

const asha = {
	heroRef: {
		heroId: 'saffron-braid',
		characterManifestHash: combatValueHash({ heroId: 'saffron-braid', visual: 'ready-v1' }),
		lifeState: 'combat-capable' as const,
		availabilityRevision: 0,
		rulesetVersion: 'realtime-rat-combat-v1'
	},
	displayName: 'Asha',
	resources: { health: 168, maximumHealth: 168, mana: 0, maximumMana: 0 },
	capability: {
		capabilitySnapshotHash: combatValueHash({ heroId: 'saffron-braid', capabilities: 'v1' }),
		loadoutHash: combatValueHash({ heroId: 'saffron-braid', loadout: 'v1' }),
		actionDefinitionRefs: ['saffron-strike-v1', 'saffron-arc-v1'],
		combatRole: 'brawler' as const
	},
	combatProfile: {
		movementUnitsPerSecond: 0.082,
		attackRange: 0.075,
		attackPower: 19,
		armor: 0,
		attackIntervalTicks: 47
	},
	deployment: { x: 0.46, y: 0.8 },
	presentation: fixturePresentation(
		'saffron-braid-ready',
		`${ART_ROOT}/hero-saffron-braid-ready-v1.png`,
		FIXTURE_HASHES.ashaReady,
		'asha',
		2,
		{ bodyOffsetY: 0, shadowRadiusX: 45, shadowRadiusY: 14, displaySize: 178 }
	)
} satisfies ExplorationCombatHero;

const toma = {
	heroRef: {
		heroId: 'iron-guardian',
		characterManifestHash: combatValueHash({ heroId: 'iron-guardian', visual: 'ready-v1' }),
		lifeState: 'combat-capable' as const,
		availabilityRevision: 0,
		rulesetVersion: 'realtime-rat-combat-v1'
	},
	displayName: 'Toma',
	resources: { health: 238, maximumHealth: 238, mana: 0, maximumMana: 0 },
	capability: {
		capabilitySnapshotHash: combatValueHash({ heroId: 'iron-guardian', capabilities: 'v1' }),
		loadoutHash: combatValueHash({ heroId: 'iron-guardian', loadout: 'v1' }),
		actionDefinitionRefs: ['guardian-strike-v1'],
		combatRole: 'guardian' as const
	},
	combatProfile: {
		movementUnitsPerSecond: 0.063,
		attackRange: 0.08,
		attackPower: 14,
		armor: 0,
		attackIntervalTicks: 57
	},
	deployment: { x: 0.31, y: 0.86 },
	presentation: fixturePresentation(
		'iron-guardian-ready',
		`${ART_ROOT}/hero-iron-guardian-ready-v1.png`,
		FIXTURE_HASHES.tomaReady,
		'iron-guardian',
		5,
		{ bodyOffsetY: -3, shadowRadiusX: 39, shadowRadiusY: 13, displaySize: 184 }
	)
} satisfies ExplorationCombatHero;

const nessa = {
	heroRef: {
		heroId: 'moss-archer',
		characterManifestHash: combatValueHash({ heroId: 'moss-archer', visual: 'ready-v1' }),
		lifeState: 'combat-capable' as const,
		availabilityRevision: 0,
		rulesetVersion: 'realtime-rat-combat-v1'
	},
	displayName: 'Nessa',
	resources: { health: 126, maximumHealth: 126, mana: 40, maximumMana: 40 },
	capability: {
		capabilitySnapshotHash: combatValueHash({ heroId: 'moss-archer', capabilities: 'v1' }),
		loadoutHash: combatValueHash({ heroId: 'moss-archer', loadout: 'v1' }),
		actionDefinitionRefs: ['moss-arrow-v1'],
		combatRole: 'archer' as const
	},
	combatProfile: {
		movementUnitsPerSecond: 0.071,
		attackRange: 0.25,
		attackPower: 17,
		armor: 0,
		attackIntervalTicks: 65
	},
	deployment: { x: 0.66, y: 0.88 },
	presentation: fixturePresentation(
		'moss-archer-ready',
		`${ART_ROOT}/hero-moss-archer-ready-v1.png`,
		FIXTURE_HASHES.nessaReady,
		'moss-archer',
		4,
		{ bodyOffsetY: -4, shadowRadiusX: 45, shadowRadiusY: 14, displaySize: 168 }
	)
} satisfies ExplorationCombatHero;

const ratBrute = {
	enemyInstanceId: 'rat-brute',
	displayName: 'Rat Brute',
	definitionRef: {
		enemyDefinitionId: 'rat-brute',
		definitionVersion: 'rat-brute-v1',
		contentHash: combatValueHash({ enemy: 'rat-brute', version: 1 })
	},
	resources: { health: 242, maximumHealth: 242, mana: 0, maximumMana: 0 },
	combatRole: 'brute' as const,
	actionDefinitionRefs: ['rat-brute-strike-v1'],
	combatProfile: {
		movementUnitsPerSecond: 0.052,
		attackRange: 0.09,
		attackPower: 18,
		armor: 0,
		attackIntervalTicks: 72
	},
	deployment: { x: 0.52, y: 0.2 },
	requiredForVictory: true,
	presentation: fixturePresentation(
		'rat-brute-ready',
		`${ART_ROOT}/rat-brute-ready-v1.png`,
		FIXTURE_HASHES.ratBruteReady,
		'rat-brute',
		1,
		{ bodyOffsetY: 0, shadowRadiusX: 72, shadowRadiusY: 14, displaySize: 250 }
	)
} satisfies ExplorationCombatEnemy;

const lesserRatDeployments = [
	[0.22, 0.3],
	[0.38, 0.34],
	[0.61, 0.24],
	[0.79, 0.29]
] as const;
const lesserRatIntervals = [56, 58, 60, 63] as const;

const lesserRats = lesserRatDeployments.map(
	([x, y], index) =>
		({
			enemyInstanceId: `plague-rat-${index + 1}`,
			displayName: `Plague Rat ${index + 1}`,
			definitionRef: {
				enemyDefinitionId: 'plague-rat',
				definitionVersion: 'plague-rat-v1',
				contentHash: combatValueHash({ enemy: 'plague-rat', version: 1 })
			},
			resources: { health: 58, maximumHealth: 58, mana: 0, maximumMana: 0 },
			combatRole: 'swarm',
			actionDefinitionRefs: ['plague-rat-bite-v1'],
			combatProfile: {
				movementUnitsPerSecond: 0.092,
				attackRange: 0.062,
				attackPower: 9,
				armor: 0,
				attackIntervalTicks: lesserRatIntervals[index]!
			},
			deployment: { x, y },
			requiredForVictory: true,
			presentation: fixturePresentation(
				'lesser-rat-ready',
				`${ART_ROOT}/lesser-rat-ready-v1.png`,
				FIXTURE_HASHES.lesserRatReady,
				'lesser-rat',
				2,
				{ bodyOffsetY: 0, shadowRadiusX: 29, shadowRadiusY: 14, displaySize: 118 }
			)
		}) satisfies ExplorationCombatEnemy
);

const RAT_CONTENT_BINDINGS = [
	{
		kind: 'ruleset' as const,
		contentId: 'realtime-rat-combat',
		version: 'realtime-rat-combat-v1',
		contentHash: combatValueHash({ ruleset: 'realtime-rat-combat-v1' })
	},
	...[
		'saffron-strike-v1',
		'saffron-arc-v1',
		'guardian-strike-v1',
		'moss-arrow-v1',
		'rat-brute-strike-v1',
		'plague-rat-bite-v1'
	].map((contentId) => ({
		kind: 'action' as const,
		contentId,
		version: `${contentId}-content-v1`,
		contentHash: combatValueHash({ action: contentId })
	})),
	{
		kind: 'enemy' as const,
		contentId: 'rat-brute',
		version: ratBrute.definitionRef.definitionVersion,
		contentHash: ratBrute.definitionRef.contentHash
	},
	{
		kind: 'enemy' as const,
		contentId: 'plague-rat',
		version: lesserRats[0]!.definitionRef.definitionVersion,
		contentHash: lesserRats[0]!.definitionRef.contentHash
	},
	{
		kind: 'claim-policy' as const,
		...RAT_ENCOUNTER_CLAIM_POLICY_BINDING
	},
	{
		kind: 'battlefield' as const,
		contentId: 'ruined-threshold',
		version: 'ruined-threshold-v1',
		contentHash: combatValueHash({ battlefield: 'ruined-threshold-v1' })
	}
];

const ruinedThreshold = {
	battlefieldId: 'ruined-threshold',
	version: 'ruined-threshold-v1',
	contentHash: combatValueHash({ battlefield: 'ruined-threshold-v1' }),
	environmentAssetBinding: fixtureRaster(
		'ruined-threshold-environment',
		`${ART_ROOT}/ruined-threshold-environment-v1.png`,
		FIXTURE_HASHES.environment
	),
	occluderAssetBindings: [
		fixtureRaster(
			'well-foreground-occluder',
			`${ART_ROOT}/environment-occluders-v1/well-foreground-v1.png`,
			FIXTURE_HASHES.well
		)
	]
};

const RAT_REQUEST_BODY = {
	schemaVersion: 'exploration-encounter-request-v1',
	requestId: '79fd92ca-7f3f-4c32-91ef-4a5953832f51',
	idempotencyKey: 'rat-study-field-test-01',
	runId: 'a51a5e3b-f026-41e6-91b6-4ce4d13ba36a',
	correlationId: 'be3471d3-f0fd-4c50-98e6-fc1f82e4d9f7',
	encounterId: 'ruined-threshold-rat-pack-01',
	explorationAttemptId: '6b348baf-af20-4cf3-bba2-2c365ddcccf0',
	observedGameTime: '2026-09-07T12:00:00.000-07:00',
	expectedExplorationStateHash: 'd'.repeat(64),
	rulesetVersion: 'realtime-rat-combat-v1',
	seed: 'rat-study-seed-v1',
	entropyCursor: 0,
	visualStatus: 'fixture',
	party: [asha, toma, nessa],
	enemies: [ratBrute, ...lesserRats],
	battlefieldBinding: ruinedThreshold,
	contentBindings: RAT_CONTENT_BINDINGS,
	bounds: { maximumCombatants: 8, maximumSimulationTicks: 3_600, maximumTraceEvents: 2_000 }
} satisfies Omit<ExplorationEncounterRequest, 'requestHash'>;

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object') {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

export const RAT_ENCOUNTER_REQUEST = deepFreeze(
	ExplorationEncounterRequestSchema.parse({
		...RAT_REQUEST_BODY,
		requestHash: combatValueHash(RAT_REQUEST_BODY)
	})
);

export type CombatFixtureAssetBinding = Readonly<{
	source: string;
	contentHash: string;
	status: ExplorationEncounterRequest['visualStatus'];
}>;

export function combatFixtureAssetBindings(
	request: ExplorationEncounterRequest
): readonly CombatFixtureAssetBinding[] {
	const sources = [
		{
			source: request.battlefieldBinding.environmentAssetBinding.source,
			contentHash: request.battlefieldBinding.environmentAssetBinding.contentHash
		},
		...request.battlefieldBinding.occluderAssetBindings.map((binding) => ({
			source: binding.source,
			contentHash: binding.contentHash
		})),
		...[...request.party, ...request.enemies].flatMap((participant) => [
			{
				source: participant.presentation.combatAssetBinding.source,
				contentHash: participant.presentation.combatAssetBinding.contentHash
			},
			{
				source: participant.presentation.motionPackBinding.source,
				contentHash: participant.presentation.motionPackBinding.contentHash
			},
			{
				source: participant.presentation.motionPackBinding.atlasImageSource,
				contentHash: participant.presentation.motionPackBinding.atlasImageHash
			}
		])
	];
	return [...new Map(sources.map((binding) => [binding.source, binding])).values()].map(
		(binding) => ({
			...binding,
			status: request.visualStatus
		})
	);
}

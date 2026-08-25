import { MissionPackageSchema, type MissionPackage } from '@summonlab/contracts';

import { loadMonsterPolicyCatalog } from './monster-policies.js';
import {
	TOWER_FLOOR_01_PACKAGE,
	calculateMissionContentHash,
	loadTowerFloor01
} from './tower-floor-01.js';

export const TOWER_FLOOR_02_CONTENT_VERSION = 'tower-floor-02-v1';
export const TOWER_FLOOR_03_CONTENT_VERSION = 'tower-floor-03-v1';
export const TOWER_FLOOR_04_CONTENT_VERSION = 'tower-floor-04-v1';
export const TOWER_FLOOR_05_CONTENT_VERSION = 'tower-floor-05-v1';
export const TOWER_BAND_01_CONTENT_VERSION = 'tower-band-01-v1';

const standardDeployment = {
	entryNodeIds: ['tower-threshold'],
	extractionNodeIds: ['tower-threshold'],
	minimumPartyMembers: 1,
	maximumPartyMembers: 5,
	masterRequired: true,
	masterCountsTowardLimit: true,
	reserveAllowed: false
} as const;

const standardTools = [
	{
		toolId: 'traverse-known-edge',
		actionKind: 'move',
		label: 'Move along a known edge',
		availableAtRoles: [],
		requiredEquipmentTags: []
	},
	{
		toolId: 'hold-ground',
		actionKind: 'defend',
		label: 'Hold ground',
		availableAtRoles: [],
		requiredEquipmentTags: []
	},
	{
		toolId: 'basic-attack',
		actionKind: 'attack',
		label: 'Use an equipped basic attack',
		availableAtRoles: ['encounter'],
		requiredEquipmentTags: ['combat-ready']
	},
	{
		toolId: 'assist-ally',
		actionKind: 'assist',
		label: 'Assist a reachable ally',
		availableAtRoles: [],
		requiredEquipmentTags: []
	},
	{
		toolId: 'use-authored-affordance',
		actionKind: 'inspect',
		label: 'Attempt an authored discovery affordance',
		availableAtRoles: [],
		requiredEquipmentTags: []
	},
	{
		toolId: 'operate-authored-control',
		actionKind: 'interact',
		label: 'Operate an authored mission control',
		availableAtRoles: ['objective'],
		requiredEquipmentTags: []
	},
	{
		toolId: 'extract-at-threshold',
		actionKind: 'retreat',
		label: 'Extract or retreat at the threshold',
		availableAtRoles: ['extraction'],
		requiredEquipmentTags: []
	}
] as const;

const standardRetreat = {
	policy: 'authored-extraction-nodes',
	nodeIds: ['tower-threshold'],
	preservesPrimaryObjective: false
} as const;

const forbiddenChanges = [
	'world-laws',
	'primary-objective',
	'arena-truth',
	'reward-budget',
	'required-anchors'
] as const;

type StorySpec = {
	prefix: string;
	bandTheme: string;
	openingQuestion: string;
	opening: [title: string, summary: string, fact: string];
	pressure: [title: string, summary: string, fact: string];
	confrontation: [title: string, summary: string, fact: string];
	recovery: [title: string, summary: string, fact: string];
	extraction: [title: string, summary: string, fact: string];
	optional: [firstTitle: string, firstSummary: string, secondTitle: string, secondSummary: string];
};

function authoredStory(spec: StorySpec) {
	const openingId = `${spec.prefix}-opening`;
	const pressureId = `${spec.prefix}-pressure`;
	const confrontationId = `${spec.prefix}-confrontation`;
	const recoveryId = `${spec.prefix}-recovery`;
	const extractionId = `${spec.prefix}-extraction`;
	const firstOptionalId = `${spec.prefix}-optional-discovery`;
	const secondOptionalId = `${spec.prefix}-optional-choice`;
	return {
		storySpineId: 'band-one-unclaimed-authority',
		bandTheme: spec.bandTheme,
		openingQuestion: spec.openingQuestion,
		beats: [
			{
				beatId: openingId,
				kind: 'opening',
				required: true,
				title: spec.opening[0],
				summary: spec.opening[1],
				eligibleAfterBeatIds: []
			},
			{
				beatId: pressureId,
				kind: 'pressure',
				required: true,
				title: spec.pressure[0],
				summary: spec.pressure[1],
				eligibleAfterBeatIds: [openingId]
			},
			{
				beatId: firstOptionalId,
				kind: 'discovery',
				required: false,
				title: spec.optional[0],
				summary: spec.optional[1],
				eligibleAfterBeatIds: [pressureId]
			},
			{
				beatId: secondOptionalId,
				kind: 'choice',
				required: false,
				title: spec.optional[2],
				summary: spec.optional[3],
				eligibleAfterBeatIds: [pressureId]
			},
			{
				beatId: confrontationId,
				kind: 'confrontation',
				required: true,
				title: spec.confrontation[0],
				summary: spec.confrontation[1],
				eligibleAfterBeatIds: [pressureId]
			},
			{
				beatId: recoveryId,
				kind: 'recovery',
				required: true,
				title: spec.recovery[0],
				summary: spec.recovery[1],
				eligibleAfterBeatIds: [confrontationId]
			},
			{
				beatId: extractionId,
				kind: 'extraction',
				required: true,
				title: spec.extraction[0],
				summary: spec.extraction[1],
				eligibleAfterBeatIds: [recoveryId]
			}
		],
		defaultBeatOrder: [openingId, pressureId, confrontationId, recoveryId, extractionId],
		anchors: [
			{
				anchorId: `${spec.prefix}-arrival-anchor`,
				order: 1,
				beatId: openingId,
				immutableFact: spec.opening[2]
			},
			{
				anchorId: `${spec.prefix}-pressure-anchor`,
				order: 2,
				beatId: pressureId,
				immutableFact: spec.pressure[2]
			},
			{
				anchorId: `${spec.prefix}-opposition-anchor`,
				order: 3,
				beatId: confrontationId,
				immutableFact: spec.confrontation[2]
			},
			{
				anchorId: `${spec.prefix}-outcome-anchor`,
				order: 4,
				beatId: recoveryId,
				immutableFact: spec.recovery[2]
			},
			{
				anchorId: `${spec.prefix}-return-anchor`,
				order: 5,
				beatId: extractionId,
				immutableFact: spec.extraction[2]
			}
		],
		proposalCatalog: [
			{
				proposalId: `${spec.prefix}-surface-discovery`,
				kind: 'role-expression',
				beatId: firstOptionalId,
				summary: spec.optional[1]
			},
			{
				proposalId: `${spec.prefix}-force-choice`,
				kind: 'complication',
				beatId: secondOptionalId,
				summary: spec.optional[3]
			}
		],
		patchSlots: [
			{
				slotId: `${spec.prefix}-between-pressure-and-opposition`,
				afterAnchorId: `${spec.prefix}-pressure-anchor`,
				beforeAnchorId: `${spec.prefix}-opposition-anchor`,
				allowedProposalIds: [`${spec.prefix}-surface-discovery`, `${spec.prefix}-force-choice`],
				maximumSelections: 1
			}
		],
		forbiddenChanges
	};
}

const floor02Source = {
	schemaVersion: 'mission-package-v1',
	contentVersion: TOWER_FLOOR_02_CONTENT_VERSION,
	missionId: 'tower-floor-02',
	kind: 'tower-floor',
	displayName: 'The Broken Procession',
	tagline: 'The tower opens a road too narrow for five strangers to survive alone.',
	tower: { floor: 2, band: 1, floorInBand: 2 },
	design: { width: 1_440, height: 820, camera: 'tactical-three-quarter' },
	deployment: standardDeployment,
	objectives: [
		{
			objectiveId: 'hold-the-ward-plinth',
			primary: true,
			kind: 'control',
			title: 'Hold the Ward Plinth',
			summary:
				'Keep a company member at the plinth for three turns while the formation bell sounds.',
			targetNodeIds: ['ward-plinth'],
			completionRule: { kind: 'control-node', nodeId: 'ward-plinth', turns: 3 },
			failureRules: ['master-death', 'party-incapacitated']
		}
	],
	arena: {
		nodes: [
			{
				nodeId: 'tower-threshold',
				label: 'Tower Threshold',
				summary: 'The lift opens onto a causeway scored by old shield rims.',
				kind: 'threshold',
				roles: ['deployment', 'extraction'],
				position: { x: 100, y: 620 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['procession-threshold-mark'],
				affordanceIds: []
			},
			{
				nodeId: 'shield-gallery',
				label: 'Shield Gallery',
				summary: 'Bronze figures face inward as if leaving a protected center for someone missing.',
				kind: 'chamber',
				roles: [],
				position: { x: 350, y: 520 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['shield-rim-grooves'],
				affordanceIds: ['read-formation-grooves']
			},
			{
				nodeId: 'narrow-march',
				label: 'Narrow March',
				summary: 'A shoulder-wide route denies the party an easy side-by-side advance.',
				kind: 'passage',
				roles: [],
				position: { x: 630, y: 400 },
				elevation: 'high',
				capacity: 2,
				initialKnowledge: 'known',
				observationIds: ['overlook-draft'],
				affordanceIds: ['find-sentry-overlook']
			},
			{
				nodeId: 'watch-crossing',
				label: 'Watch Crossing',
				summary: 'Goblin chain-hooks divide the approach into exposed lanes.',
				kind: 'chamber',
				roles: ['encounter'],
				position: { x: 930, y: 470 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['chain-hook-pattern'],
				affordanceIds: []
			},
			{
				nodeId: 'ward-plinth',
				label: 'Ward Plinth',
				summary: 'A rotating ward asks one hero to remain exposed while the rest hold a perimeter.',
				kind: 'objective',
				roles: ['objective', 'encounter'],
				position: { x: 1250, y: 330 },
				elevation: 'high',
				capacity: 4,
				initialKnowledge: 'known',
				observationIds: ['ward-pulse-skip'],
				affordanceIds: ['test-ward-cadence']
			},
			{
				nodeId: 'sentry-overlook',
				label: 'Sentry Overlook',
				summary: 'A concealed ledge trades room for safety and a clean view of the plinth.',
				kind: 'vantage',
				roles: ['secret'],
				position: { x: 720, y: 150 },
				elevation: 'high',
				capacity: 2,
				initialKnowledge: 'concealed',
				observationIds: ['overlook-signal-marks'],
				affordanceIds: []
			}
		],
		edges: [
			{
				edgeId: 'threshold-to-shield-gallery',
				fromNodeId: 'tower-threshold',
				toNodeId: 'shield-gallery',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 100, y: 620 },
					{ x: 350, y: 520 }
				]
			},
			{
				edgeId: 'shield-gallery-to-narrow-march',
				fromNodeId: 'shield-gallery',
				toNodeId: 'narrow-march',
				bidirectional: true,
				traversalActions: 2,
				exposure: 'guarded',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 350, y: 520 },
					{ x: 630, y: 400 }
				]
			},
			{
				edgeId: 'narrow-march-to-watch-crossing',
				fromNodeId: 'narrow-march',
				toNodeId: 'watch-crossing',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'exposed',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 630, y: 400 },
					{ x: 930, y: 470 }
				]
			},
			{
				edgeId: 'watch-crossing-to-ward-plinth',
				fromNodeId: 'watch-crossing',
				toNodeId: 'ward-plinth',
				bidirectional: true,
				traversalActions: 2,
				exposure: 'exposed',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 930, y: 470 },
					{ x: 1250, y: 330 }
				]
			},
			{
				edgeId: 'narrow-march-to-sentry-overlook',
				fromNodeId: 'narrow-march',
				toNodeId: 'sentry-overlook',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'requires-discovery', discoveryId: 'sentry-overlook-route' },
				visualPath: [
					{ x: 630, y: 400 },
					{ x: 720, y: 150 }
				]
			},
			{
				edgeId: 'sentry-overlook-to-ward-plinth',
				fromNodeId: 'sentry-overlook',
				toNodeId: 'ward-plinth',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: { kind: 'requires-discovery', discoveryId: 'sentry-overlook-route' },
				visualPath: [
					{ x: 720, y: 150 },
					{ x: 1250, y: 330 }
				]
			}
		],
		observations: [
			{
				observationId: 'procession-threshold-mark',
				nodeId: 'tower-threshold',
				kind: 'lore',
				summary: 'Five shield marks enter the floor; only a tight cluster crosses the final line.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'shield-rim-grooves',
				nodeId: 'shield-gallery',
				kind: 'trace',
				summary:
					'Scrapes overlap in a moving ring: old parties advanced around someone vulnerable.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'overlook-draft',
				nodeId: 'narrow-march',
				kind: 'sound',
				summary: 'A cold draft carries the bell tone from above rather than ahead.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'chain-hook-pattern',
				nodeId: 'watch-crossing',
				kind: 'sight',
				summary: 'The chain watch strikes whichever traveler breaks furthest from the group.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'ward-pulse-skip',
				nodeId: 'ward-plinth',
				kind: 'heat',
				summary: 'Every third pulse leaves the outer ring cool for a breath.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'overlook-signal-marks',
				nodeId: 'sentry-overlook',
				kind: 'lore',
				summary: 'Hand marks show two defenders signaling one exposed operator below.',
				reveal: { kind: 'discovery', discoveryId: 'sentry-overlook-route' }
			}
		],
		discoveries: [
			{
				discoveryId: 'formation-grooves',
				kind: 'fact',
				title: 'A place in the center',
				summary: 'The floor rewards protection around a vulnerable operator, not individual speed.',
				revealNodeIds: [],
				revealEdgeIds: [],
				revealObservationIds: [],
				canonicalFact:
					'The Ward Plinth can be held safely only if the company protects its operator.'
			},
			{
				discoveryId: 'sentry-overlook-route',
				kind: 'route',
				title: 'A ledge above the march',
				summary:
					'A concealed two-person overlook bypasses the chain crossing but cannot carry the full party.',
				revealNodeIds: ['sentry-overlook'],
				revealEdgeIds: ['narrow-march-to-sentry-overlook', 'sentry-overlook-to-ward-plinth'],
				revealObservationIds: ['overlook-signal-marks'],
				canonicalFact: 'The Sentry Overlook is a real low-capacity route to the Ward Plinth.'
			},
			{
				discoveryId: 'ward-pulse-cadence',
				kind: 'weakness',
				title: 'The third pulse falters',
				summary: 'The ward briefly cools after every third pulse.',
				revealNodeIds: [],
				revealEdgeIds: [],
				revealObservationIds: [],
				canonicalFact:
					'The Ward Plinth has a recurring safe cadence that a prepared operator can exploit.'
			}
		],
		discoveryAffordances: [
			{
				affordanceId: 'read-formation-grooves',
				nodeId: 'shield-gallery',
				kind: 'inspect',
				label: 'Compare the shield-rim grooves',
				description: 'Read how older companies arranged themselves around the protected center.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['formation-grooves'],
				outcomeDiscoveryIds: ['formation-grooves']
			},
			{
				affordanceId: 'find-sentry-overlook',
				nodeId: 'narrow-march',
				kind: 'listen',
				label: 'Follow the bell draft upward',
				description: 'Pause in the exposed passage and trace the impossible direction of the bell.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['sentry-overlook-route'],
				outcomeDiscoveryIds: ['sentry-overlook-route']
			},
			{
				affordanceId: 'test-ward-cadence',
				nodeId: 'ward-plinth',
				kind: 'test',
				label: 'Count the Ward pulses',
				description: 'Hold close enough to measure when heat leaves the outer ring.',
				timeActions: 2,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['ward-pulse-cadence'],
				outcomeDiscoveryIds: ['ward-pulse-cadence']
			}
		]
	},
	encounterSeedRules: {
		schemaVersion: 'mission-entropy-v1',
		namespace: 'tower-floor-02',
		namedPurposes: ['chain-watch-count', 'plinth-hauler-count', 'formation-bell-phase']
	},
	monsterDuties: [
		{
			dutySlotId: 'crossing-chain-watch',
			policyId: 'guard-chain-court-v1',
			spawnNodeId: 'watch-crossing',
			count: { min: 2, max: 3 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'formation-pressure']
		},
		{
			dutySlotId: 'plinth-ember-haulers',
			policyId: 'protect-ember-cradle-v1',
			spawnNodeId: 'ward-plinth',
			count: { min: 1, max: 2 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'objective-guard']
		}
	],
	environmentalEvents: [
		{
			eventId: 'formation-bell',
			policyId: 'formation-bell-pulse-v1',
			trigger: { kind: 'turn-interval', firstTurn: 2, everyTurns: 3 },
			maximumOccurrences: 8
		}
	],
	legalTools: standardTools,
	retreat: standardRetreat,
	rewards: {
		budgetPoints: 160,
		grants: [
			{
				grantId: 'floor-two-party-experience',
				trigger: 'success',
				kind: 'experience',
				key: 'party-experience',
				amount: 55,
				budgetCost: 55
			},
			{
				grantId: 'ward-bronze',
				trigger: 'success',
				kind: 'resource',
				key: 'ward-bronze',
				amount: 3,
				budgetCost: 65
			},
			{
				grantId: 'formation-record',
				trigger: 'no-casualty',
				kind: 'story-token',
				key: 'company-held-formation',
				amount: 1,
				budgetCost: 40
			}
		]
	},
	story: authoredStory({
		prefix: 'floor-two',
		bandTheme: 'Authority begins when someone chooses to protect rather than merely command.',
		openingQuestion:
			'Will strangers form around a vulnerable person when obedience has not yet been earned?',
		opening: [
			'The empty center',
			'The gallery records a formation built around someone absent.',
			'The party enters a floor whose surviving marks all protect a central operator.'
		],
		pressure: [
			'A road for two',
			'The Narrow March makes a loose group easy to isolate.',
			'The only default route constrains the party before the guarded crossing.'
		],
		confrontation: [
			'Hold while another acts',
			'The plinth requires one exposed operator and a defending perimeter.',
			'The Ward Plinth must be controlled for three turns under active monster duties.'
		],
		recovery: [
			'A formation remembered',
			'The tower records who covered whom when the bell sounded.',
			'Completion records the operator and the heroes who defended them.'
		],
		extraction: [
			'Return in order',
			'The company carries its new formation back to Hearth 01.',
			'Only surviving returnees can bring Floor 02 rewards and social evidence home.'
		],
		optional: [
			'Signals above the march',
			'Bind the overlook discovery to the hero who followed the bell draft.',
			'Who takes the center',
			'Let the company decide who bears the exposed plinth role.'
		]
	}),
	contentHash: '867299e20073c181c6cdd3b1d1b93358a72c4486474a7ae3c5fbb425e49a3d66'
} as const;

const floor03Source = {
	schemaVersion: 'mission-package-v1',
	contentVersion: TOWER_FLOOR_03_CONTENT_VERSION,
	missionId: 'tower-floor-03',
	kind: 'tower-floor',
	displayName: 'The Red Tithe',
	tagline: 'A cure waits beyond a room designed to make retreat feel like betrayal.',
	tower: { floor: 3, band: 1, floorInBand: 3 },
	design: { width: 1_440, height: 820, camera: 'tactical-three-quarter' },
	deployment: standardDeployment,
	objectives: [
		{
			objectiveId: 'recover-white-salt',
			primary: true,
			kind: 'recover',
			title: 'Recover the White Salt',
			summary: 'Take the sealed medicine cache and carry it back through the Tower Threshold.',
			targetNodeIds: ['salt-cache'],
			completionRule: {
				kind: 'recover-ledger-item',
				itemKey: 'white-salt-cache',
				amount: 1,
				returnToNodeId: 'tower-threshold'
			},
			failureRules: ['master-death', 'party-incapacitated', 'objective-destroyed']
		}
	],
	arena: {
		nodes: [
			{
				nodeId: 'tower-threshold',
				label: 'Tower Threshold',
				summary: 'Rust-red droplets stop exactly at the lift seam.',
				kind: 'threshold',
				roles: ['deployment', 'extraction'],
				position: { x: 100, y: 600 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['red-tithe-threshold'],
				affordanceIds: []
			},
			{
				nodeId: 'cut-stair',
				label: 'Cut Stair',
				summary: 'Uneven steps reward a careful pace and punish anyone carrying another.',
				kind: 'passage',
				roles: [],
				position: { x: 360, y: 510 },
				elevation: 'high',
				capacity: 3,
				initialKnowledge: 'known',
				observationIds: ['drag-marks-upward'],
				affordanceIds: []
			},
			{
				nodeId: 'red-gallery',
				label: 'Red Gallery',
				summary: 'A long chamber offers no cover from the ceiling vents.',
				kind: 'hazard',
				roles: [],
				position: { x: 640, y: 380 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['dry-vent-rhythm'],
				affordanceIds: ['listen-for-slag-rhythm', 'follow-bloodless-prints']
			},
			{
				nodeId: 'tithe-pit',
				label: 'Tithe Pit',
				summary: 'Chain watchers hold the only broad approach to the medicine vault.',
				kind: 'chamber',
				roles: ['encounter'],
				position: { x: 930, y: 500 },
				elevation: 'low',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['pit-retreat-scratches'],
				affordanceIds: ['read-casualty-tablet']
			},
			{
				nodeId: 'salt-cache',
				label: 'White Salt Cache',
				summary: 'A fragile sealed coffer turns escape into an escort problem.',
				kind: 'objective',
				roles: ['objective', 'encounter'],
				position: { x: 1250, y: 310 },
				elevation: 'high',
				capacity: 4,
				initialKnowledge: 'known',
				observationIds: ['salt-cache-cradle'],
				affordanceIds: []
			},
			{
				nodeId: 'triage-alcove',
				label: 'Triage Alcove',
				summary: 'A narrow surgeon station avoids the pit but contains only one intact cot.',
				kind: 'chamber',
				roles: ['secret'],
				position: { x: 850, y: 150 },
				elevation: 'level',
				capacity: 2,
				initialKnowledge: 'concealed',
				observationIds: ['triage-cot-message'],
				affordanceIds: []
			}
		],
		edges: [
			{
				edgeId: 'threshold-to-cut-stair',
				fromNodeId: 'tower-threshold',
				toNodeId: 'cut-stair',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 100, y: 600 },
					{ x: 360, y: 510 }
				]
			},
			{
				edgeId: 'cut-stair-to-red-gallery',
				fromNodeId: 'cut-stair',
				toNodeId: 'red-gallery',
				bidirectional: true,
				traversalActions: 2,
				exposure: 'guarded',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 360, y: 510 },
					{ x: 640, y: 380 }
				]
			},
			{
				edgeId: 'red-gallery-to-tithe-pit',
				fromNodeId: 'red-gallery',
				toNodeId: 'tithe-pit',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'exposed',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 640, y: 380 },
					{ x: 930, y: 500 }
				]
			},
			{
				edgeId: 'tithe-pit-to-salt-cache',
				fromNodeId: 'tithe-pit',
				toNodeId: 'salt-cache',
				bidirectional: true,
				traversalActions: 2,
				exposure: 'exposed',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 930, y: 500 },
					{ x: 1250, y: 310 }
				]
			},
			{
				edgeId: 'red-gallery-to-triage-alcove',
				fromNodeId: 'red-gallery',
				toNodeId: 'triage-alcove',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'requires-discovery', discoveryId: 'triage-alcove-route' },
				visualPath: [
					{ x: 640, y: 380 },
					{ x: 850, y: 150 }
				]
			},
			{
				edgeId: 'triage-alcove-to-salt-cache',
				fromNodeId: 'triage-alcove',
				toNodeId: 'salt-cache',
				bidirectional: true,
				traversalActions: 2,
				exposure: 'guarded',
				access: { kind: 'requires-discovery', discoveryId: 'triage-alcove-route' },
				visualPath: [
					{ x: 850, y: 150 },
					{ x: 1250, y: 310 }
				]
			}
		],
		observations: [
			{
				observationId: 'red-tithe-threshold',
				nodeId: 'tower-threshold',
				kind: 'trace',
				summary: 'Old blood trails return to the lift; not every trail continues inward.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'drag-marks-upward',
				nodeId: 'cut-stair',
				kind: 'trace',
				summary: 'Paired heel marks show someone was carried back toward extraction.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'dry-vent-rhythm',
				nodeId: 'red-gallery',
				kind: 'sound',
				summary: 'Ceiling shutters click twice before each fall of hot slag.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'pit-retreat-scratches',
				nodeId: 'tithe-pit',
				kind: 'lore',
				summary: 'Names end beside retreat tallies, not accusations.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'salt-cache-cradle',
				nodeId: 'salt-cache',
				kind: 'sight',
				summary: 'The coffer shell will crack if its carrier is struck repeatedly.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'triage-cot-message',
				nodeId: 'triage-alcove',
				kind: 'lore',
				summary: 'A scratched line reads: returning with one is not returning with less.',
				reveal: { kind: 'discovery', discoveryId: 'triage-alcove-route' }
			}
		],
		discoveries: [
			{
				discoveryId: 'slag-fall-cadence',
				kind: 'weakness',
				title: 'Two clicks before fire',
				summary: 'The gallery vents announce each slag fall two beats early.',
				revealNodeIds: [],
				revealEdgeIds: [],
				revealObservationIds: [],
				canonicalFact: 'The Red Gallery hazard has a fixed telegraphed cadence.'
			},
			{
				discoveryId: 'triage-alcove-route',
				kind: 'route',
				title: 'Bloodless footprints',
				summary: 'Dusty prints reveal a narrow triage route around the Tithe Pit.',
				revealNodeIds: ['triage-alcove'],
				revealEdgeIds: ['red-gallery-to-triage-alcove', 'triage-alcove-to-salt-cache'],
				revealObservationIds: ['triage-cot-message'],
				canonicalFact: 'The Triage Alcove is a lower-exposure route with capacity for only two.'
			},
			{
				discoveryId: 'retreat-is-recorded',
				kind: 'fact',
				title: 'The tower records retreat',
				summary: 'The casualty tablet distinguishes retreat from abandonment.',
				revealNodeIds: [],
				revealEdgeIds: [],
				revealObservationIds: [],
				canonicalFact: 'A surviving retreat is a recorded mission outcome, not a narrative reset.'
			}
		],
		discoveryAffordances: [
			{
				affordanceId: 'listen-for-slag-rhythm',
				nodeId: 'red-gallery',
				kind: 'listen',
				label: 'Count the ceiling clicks',
				description: 'Remain under the vents long enough to confirm their warning cadence.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['slag-fall-cadence'],
				outcomeDiscoveryIds: ['slag-fall-cadence']
			},
			{
				affordanceId: 'follow-bloodless-prints',
				nodeId: 'red-gallery',
				kind: 'search',
				label: 'Follow the bloodless footprints',
				description: 'Separate dust tracks from the red stains and test the wall they enter.',
				timeActions: 2,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['triage-alcove-route'],
				outcomeDiscoveryIds: ['triage-alcove-route']
			},
			{
				affordanceId: 'read-casualty-tablet',
				nodeId: 'tithe-pit',
				kind: 'inspect',
				label: 'Read the retreat tallies',
				description: 'Compare names, wounds, and the marks used for survivors who turned back.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['retreat-is-recorded'],
				outcomeDiscoveryIds: ['retreat-is-recorded']
			}
		]
	},
	encounterSeedRules: {
		schemaVersion: 'mission-entropy-v1',
		namespace: 'tower-floor-03',
		namedPurposes: ['pit-watch-count', 'salt-hauler-count', 'slag-fall-phase']
	},
	monsterDuties: [
		{
			dutySlotId: 'tithe-pit-watch',
			policyId: 'guard-chain-court-v1',
			spawnNodeId: 'tithe-pit',
			count: { min: 3, max: 4 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'retreat-pressure']
		},
		{
			dutySlotId: 'salt-cache-hauler',
			policyId: 'protect-ember-cradle-v1',
			spawnNodeId: 'salt-cache',
			count: { min: 1, max: 2 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'fragile-objective']
		}
	],
	environmentalEvents: [
		{
			eventId: 'red-slag-fall',
			policyId: 'red-slag-fall-v1',
			trigger: { kind: 'turn-interval', firstTurn: 2, everyTurns: 2 },
			maximumOccurrences: 12
		}
	],
	legalTools: standardTools,
	retreat: standardRetreat,
	rewards: {
		budgetPoints: 190,
		grants: [
			{
				grantId: 'floor-three-party-experience',
				trigger: 'success',
				kind: 'experience',
				key: 'party-experience',
				amount: 65,
				budgetCost: 65
			},
			{
				grantId: 'white-salt-doses',
				trigger: 'success',
				kind: 'resource',
				key: 'white-salt',
				amount: 4,
				budgetCost: 85
			},
			{
				grantId: 'intact-salt-coffer',
				trigger: 'no-casualty',
				kind: 'resource',
				key: 'sealed-medicine-coffer',
				amount: 1,
				budgetCost: 40
			}
		]
	},
	story: authoredStory({
		prefix: 'floor-three',
		bandTheme: 'A leader is measured by whom they are willing to bring home unfinished.',
		openingQuestion: 'When injury makes success uncertain, who is allowed to call for retreat?',
		opening: [
			'Trails that turn back',
			'The threshold preserves evidence of companies that chose survival.',
			'The party sees that previous companies retreated from this floor.'
		],
		pressure: [
			'Fire with a warning',
			'The Red Gallery makes continued exposure an informed risk.',
			'The environmental hazard is periodic and telegraphed before it falls.'
		],
		confrontation: [
			'The cost of the coffer',
			'The medicine is fragile, guarded, and difficult to carry beside an injured ally.',
			'The White Salt must return intact through active duties and hazards.'
		],
		recovery: [
			'Choose what can return',
			'The party must weigh the cache against wounds and permanent death.',
			'Retreat and success preserve different but equally causal outcomes.'
		],
		extraction: [
			'No wound resets',
			'The threshold records wounds, carriers, and who argued to continue.',
			'All injuries, losses, and returned resources survive extraction.'
		],
		optional: [
			'A cot for one',
			'Bind discovery of the triage route to the hero who notices the bloodless prints.',
			'Who says enough',
			'Let a hero or the Master make a visible retreat argument under pressure.'
		]
	}),
	contentHash: '386f7e73f033829b404a2f9828a0350d62f17ab999140f9d878f88fd697986e0'
} as const;

const floor04Source = {
	schemaVersion: 'mission-package-v1',
	contentVersion: TOWER_FLOOR_04_CONTENT_VERSION,
	missionId: 'tower-floor-04',
	kind: 'tower-floor',
	displayName: 'The Severed Relay',
	tagline: 'One person must cross beyond the company and decide whose voice to trust.',
	tower: { floor: 4, band: 1, floorInBand: 4 },
	design: { width: 1_440, height: 820, camera: 'tactical-three-quarter' },
	deployment: standardDeployment,
	objectives: [
		{
			objectiveId: 'restore-the-signal-dais',
			primary: true,
			kind: 'control',
			title: 'Restore the Signal Dais',
			summary: 'Cross the single-file relay and hold the far control for two turns.',
			targetNodeIds: ['signal-dais'],
			completionRule: { kind: 'control-node', nodeId: 'signal-dais', turns: 2 },
			failureRules: ['master-death', 'party-incapacitated']
		}
	],
	arena: {
		nodes: [
			{
				nodeId: 'tower-threshold',
				label: 'Tower Threshold',
				summary: 'Two dead signal lines vanish into opposite walls.',
				kind: 'threshold',
				roles: ['deployment', 'extraction'],
				position: { x: 90, y: 610 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['relay-threshold-lines'],
				affordanceIds: []
			},
			{
				nodeId: 'balance-hall',
				label: 'Balance Hall',
				summary: 'Counterweights answer footsteps from rooms the party cannot see.',
				kind: 'chamber',
				roles: [],
				position: { x: 340, y: 460 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['counterweight-answer'],
				affordanceIds: ['trace-counterweight-bypass']
			},
			{
				nodeId: 'left-relay',
				label: 'Left Relay',
				summary: 'A defended switch must remain held while one traveler crosses alone.',
				kind: 'chamber',
				roles: ['encounter'],
				position: { x: 610, y: 560 },
				elevation: 'level',
				capacity: 4,
				initialKnowledge: 'known',
				observationIds: ['relay-speaking-tube'],
				affordanceIds: ['open-archive-niche']
			},
			{
				nodeId: 'needle-bridge',
				label: 'Needle Bridge',
				summary: 'The bridge accepts one body and blocks sight between both relays.',
				kind: 'passage',
				roles: [],
				position: { x: 820, y: 330 },
				elevation: 'high',
				capacity: 1,
				initialKnowledge: 'known',
				observationIds: ['bridge-voice-echo'],
				affordanceIds: []
			},
			{
				nodeId: 'right-relay',
				label: 'Right Relay',
				summary: 'The far switch answers only while its counterpart remains held.',
				kind: 'chamber',
				roles: ['encounter'],
				position: { x: 1050, y: 500 },
				elevation: 'level',
				capacity: 3,
				initialKnowledge: 'known',
				observationIds: ['right-relay-delay'],
				affordanceIds: []
			},
			{
				nodeId: 'signal-dais',
				label: 'Signal Dais',
				summary: 'A restored lens points upward toward the living foundry.',
				kind: 'objective',
				roles: ['objective'],
				position: { x: 1300, y: 260 },
				elevation: 'high',
				capacity: 3,
				initialKnowledge: 'known',
				observationIds: ['foundry-light-pattern'],
				affordanceIds: []
			},
			{
				nodeId: 'counterweight-duct',
				label: 'Counterweight Duct',
				summary: 'A low bypass carries sound but not sight between the relay rooms.',
				kind: 'passage',
				roles: ['secret'],
				position: { x: 780, y: 700 },
				elevation: 'low',
				capacity: 2,
				initialKnowledge: 'concealed',
				observationIds: ['duct-promise-echo'],
				affordanceIds: []
			},
			{
				nodeId: 'archive-niche',
				label: 'Archive Niche',
				summary: 'A sealed drawer contains a scorched maintenance schematic for the floor above.',
				kind: 'chamber',
				roles: ['secret'],
				position: { x: 520, y: 170 },
				elevation: 'high',
				capacity: 2,
				initialKnowledge: 'concealed',
				observationIds: ['foundry-schematic-lines'],
				affordanceIds: ['read-foundry-schematic']
			}
		],
		edges: [
			{
				edgeId: 'threshold-to-balance-hall',
				fromNodeId: 'tower-threshold',
				toNodeId: 'balance-hall',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 90, y: 610 },
					{ x: 340, y: 460 }
				]
			},
			{
				edgeId: 'balance-hall-to-left-relay',
				fromNodeId: 'balance-hall',
				toNodeId: 'left-relay',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 340, y: 460 },
					{ x: 610, y: 560 }
				]
			},
			{
				edgeId: 'left-relay-to-needle-bridge',
				fromNodeId: 'left-relay',
				toNodeId: 'needle-bridge',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'exposed',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 610, y: 560 },
					{ x: 820, y: 330 }
				]
			},
			{
				edgeId: 'needle-bridge-to-right-relay',
				fromNodeId: 'needle-bridge',
				toNodeId: 'right-relay',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'exposed',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 820, y: 330 },
					{ x: 1050, y: 500 }
				]
			},
			{
				edgeId: 'right-relay-to-signal-dais',
				fromNodeId: 'right-relay',
				toNodeId: 'signal-dais',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 1050, y: 500 },
					{ x: 1300, y: 260 }
				]
			},
			{
				edgeId: 'left-relay-to-counterweight-duct',
				fromNodeId: 'left-relay',
				toNodeId: 'counterweight-duct',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'requires-discovery', discoveryId: 'counterweight-bypass' },
				visualPath: [
					{ x: 610, y: 560 },
					{ x: 780, y: 700 }
				]
			},
			{
				edgeId: 'counterweight-duct-to-right-relay',
				fromNodeId: 'counterweight-duct',
				toNodeId: 'right-relay',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'requires-discovery', discoveryId: 'counterweight-bypass' },
				visualPath: [
					{ x: 780, y: 700 },
					{ x: 1050, y: 500 }
				]
			},
			{
				edgeId: 'left-relay-to-archive-niche',
				fromNodeId: 'left-relay',
				toNodeId: 'archive-niche',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: { kind: 'requires-discovery', discoveryId: 'archive-niche-route' },
				visualPath: [
					{ x: 610, y: 560 },
					{ x: 520, y: 170 }
				]
			}
		],
		observations: [
			{
				observationId: 'relay-threshold-lines',
				nodeId: 'tower-threshold',
				kind: 'sight',
				summary: 'The two relay lines never meet on this side of the wall.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'counterweight-answer',
				nodeId: 'balance-hall',
				kind: 'sound',
				summary: 'A second weight rises after each step, suggesting a lower parallel passage.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'relay-speaking-tube',
				nodeId: 'left-relay',
				kind: 'sound',
				summary: 'A speaking tube is the only reliable link to whoever crosses the bridge.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'bridge-voice-echo',
				nodeId: 'needle-bridge',
				kind: 'sound',
				summary:
					'Voices arrive stripped of direction; the isolated traveler must choose which instruction to trust.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'right-relay-delay',
				nodeId: 'right-relay',
				kind: 'sight',
				summary: 'The far relay waits two beats after the near switch is held.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'foundry-light-pattern',
				nodeId: 'signal-dais',
				kind: 'heat',
				summary:
					'The restored lens sketches a furnace and a separate cooling loop one floor above.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'duct-promise-echo',
				nodeId: 'counterweight-duct',
				kind: 'lore',
				summary: 'Old voices repeat promises to hold each relay until the other answers.',
				reveal: { kind: 'discovery', discoveryId: 'counterweight-bypass' }
			},
			{
				observationId: 'foundry-schematic-lines',
				nodeId: 'archive-niche',
				kind: 'lore',
				summary:
					'The schematic marks an intake-side maintenance seam and a manual cooling control.',
				reveal: { kind: 'discovery', discoveryId: 'foundry-maintenance-route' }
			}
		],
		discoveries: [
			{
				discoveryId: 'counterweight-bypass',
				kind: 'route',
				title: 'A passage under the bridge',
				summary: 'The counterweight duct offers a low, two-person path between the relays.',
				revealNodeIds: ['counterweight-duct'],
				revealEdgeIds: ['left-relay-to-counterweight-duct', 'counterweight-duct-to-right-relay'],
				revealObservationIds: ['duct-promise-echo'],
				canonicalFact: 'The Counterweight Duct bypasses the exposed Needle Bridge at low capacity.'
			},
			{
				discoveryId: 'archive-niche-route',
				kind: 'route',
				title: 'A drawer behind the relay',
				summary: 'The speaking-tube housing opens onto a concealed archive niche.',
				revealNodeIds: ['archive-niche'],
				revealEdgeIds: ['left-relay-to-archive-niche'],
				revealObservationIds: [],
				canonicalFact: 'A concealed archive niche is physically connected to the Left Relay.'
			},
			{
				discoveryId: 'foundry-maintenance-route',
				kind: 'fact',
				title: 'The Foundry has a second circulation',
				summary:
					'A scorched schematic proves that Floor 05 has a maintenance seam and manual cooling loop.',
				revealNodeIds: [],
				revealEdgeIds: [],
				revealObservationIds: ['foundry-schematic-lines'],
				canonicalFact: 'The Floor 05 intake wall conceals a maintenance route to a cooling control.'
			}
		],
		discoveryAffordances: [
			{
				affordanceId: 'trace-counterweight-bypass',
				nodeId: 'balance-hall',
				kind: 'listen',
				label: 'Trace the answering counterweight',
				description: 'Follow the second weight by sound instead of stepping onto the bridge.',
				timeActions: 2,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['counterweight-bypass'],
				outcomeDiscoveryIds: ['counterweight-bypass']
			},
			{
				affordanceId: 'open-archive-niche',
				nodeId: 'left-relay',
				kind: 'manipulate',
				label: 'Unseat the speaking-tube housing',
				description: 'Use the relay vibration to loosen the sealed housing behind it.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['archive-niche-route'],
				outcomeDiscoveryIds: ['archive-niche-route']
			},
			{
				affordanceId: 'read-foundry-schematic',
				nodeId: 'archive-niche',
				kind: 'inspect',
				label: 'Study the scorched schematic',
				description: 'Commit the intake seam and cooling loop to memory before leaving.',
				timeActions: 2,
				requiresDiscoveryIds: ['archive-niche-route'],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['foundry-maintenance-route'],
				outcomeDiscoveryIds: ['foundry-maintenance-route']
			}
		]
	},
	encounterSeedRules: {
		schemaVersion: 'mission-entropy-v1',
		namespace: 'tower-floor-04',
		namedPurposes: ['left-relay-watch-count', 'right-relay-hauler-count', 'relay-blackout-phase']
	},
	monsterDuties: [
		{
			dutySlotId: 'left-relay-watch',
			policyId: 'guard-chain-court-v1',
			spawnNodeId: 'left-relay',
			count: { min: 2, max: 3 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'separation-pressure']
		},
		{
			dutySlotId: 'right-relay-haulers',
			policyId: 'protect-ember-cradle-v1',
			spawnNodeId: 'right-relay',
			count: { min: 2, max: 3 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'relay-guard']
		}
	],
	environmentalEvents: [
		{
			eventId: 'relay-blackout',
			policyId: 'relay-blackout-v1',
			trigger: { kind: 'turn-interval', firstTurn: 3, everyTurns: 4 },
			maximumOccurrences: 8
		}
	],
	legalTools: standardTools,
	retreat: standardRetreat,
	rewards: {
		budgetPoints: 220,
		grants: [
			{
				grantId: 'floor-four-party-experience',
				trigger: 'success',
				kind: 'experience',
				key: 'party-experience',
				amount: 75,
				budgetCost: 75
			},
			{
				grantId: 'relay-lens',
				trigger: 'success',
				kind: 'resource',
				key: 'relay-lens',
				amount: 1,
				budgetCost: 85
			},
			{
				grantId: 'foundry-route-record',
				trigger: 'discovery',
				kind: 'story-token',
				key: 'foundry-maintenance-route',
				amount: 1,
				budgetCost: 60
			}
		]
	},
	story: authoredStory({
		prefix: 'floor-four',
		bandTheme: 'Trust becomes real when distance prevents verification.',
		openingQuestion:
			'Whose voice does an isolated hero follow when the company cannot see what they see?',
		opening: [
			'Two lines, one company',
			'The relay divides a shared objective across separated rooms.',
			'The signal system requires coordinated action from both sides of the floor.'
		],
		pressure: [
			'One body across',
			'The Needle Bridge makes temporary separation unavoidable on the default route.',
			'Only one character at a time can occupy the Needle Bridge.'
		],
		confrontation: [
			'Hold what you promised',
			'One side must remain under pressure while the other restores the far relay.',
			'Both relay positions remain causal while the Signal Dais is restored.'
		],
		recovery: [
			'A light toward the Foundry',
			'The restored signal reveals the furnace and its cooling circulation.',
			'The Signal Dais exposes a true clue about the Floor 05 Foundry.'
		],
		extraction: [
			'Trust has witnesses',
			'Who held, crossed, doubted, or answered returns as relationship evidence.',
			'The company returns with its coordination history intact.'
		],
		optional: [
			'A maintenance schematic',
			'Bind the Foundry route knowledge to the hero who studies the hidden archive.',
			'Which voice crosses the bridge',
			'Let conflicting directions test an isolated hero without changing the objective.'
		]
	}),
	contentHash: 'e986e8c454cc70c2388ca7cd032e4839287467fc0787518a298cd3b1805ff007'
} as const;

const floor05Source = {
	schemaVersion: 'mission-package-v1',
	contentVersion: TOWER_FLOOR_05_CONTENT_VERSION,
	missionId: 'tower-floor-05',
	kind: 'tower-floor',
	displayName: 'The Living Foundry',
	tagline: 'Break the Warden while the furnace decides whether armor is a wall or a warning.',
	tower: { floor: 5, band: 1, floorInBand: 5 },
	design: { width: 1_440, height: 820, camera: 'tactical-three-quarter' },
	deployment: standardDeployment,
	objectives: [
		{
			objectiveId: 'defeat-the-foundry-warden',
			primary: true,
			kind: 'defeat',
			title: 'Defeat the Foundry Warden',
			summary:
				'Destroy the furnace-linked construct and return surviving company members to the threshold.',
			targetNodeIds: ['furnace-heart'],
			completionRule: { kind: 'defeat-duty', dutySlotId: 'foundry-warden' },
			failureRules: ['master-death', 'party-incapacitated']
		},
		{
			objectiveId: 'quench-the-foundry',
			primary: false,
			kind: 'control',
			title: 'Quench the Foundry',
			summary: 'If the maintenance route is known, hold the cooling control for two turns.',
			targetNodeIds: ['cooling-control'],
			completionRule: { kind: 'control-node', nodeId: 'cooling-control', turns: 2 },
			failureRules: ['master-death', 'party-incapacitated']
		}
	],
	arena: {
		nodes: [
			{
				nodeId: 'tower-threshold',
				label: 'Tower Threshold',
				summary: 'The lift opens into furnace wind and a route wide enough for a direct assault.',
				kind: 'threshold',
				roles: ['deployment', 'extraction'],
				position: { x: 90, y: 620 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['foundry-threshold-heat'],
				affordanceIds: []
			},
			{
				nodeId: 'ash-intake',
				label: 'Ash Intake',
				summary: 'Soot pours through a wall seam shaped like the schematic from Floor 04.',
				kind: 'passage',
				roles: [],
				position: { x: 360, y: 500 },
				elevation: 'low',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['intake-soot-seam'],
				affordanceIds: ['recall-maintenance-seam']
			},
			{
				nodeId: 'forge-nave',
				label: 'Forge Nave',
				summary: 'Chain watchers screen the direct approach beneath moving crucibles.',
				kind: 'chamber',
				roles: ['encounter'],
				position: { x: 700, y: 420 },
				elevation: 'level',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['warden-duty-runes'],
				affordanceIds: ['read-warden-duty-runes']
			},
			{
				nodeId: 'furnace-heart',
				label: 'Furnace Heart',
				summary: 'The Warden stands between the company and the first band seal.',
				kind: 'objective',
				roles: ['objective', 'encounter'],
				position: { x: 1190, y: 350 },
				elevation: 'high',
				capacity: 5,
				initialKnowledge: 'known',
				observationIds: ['warden-furnace-link'],
				affordanceIds: []
			},
			{
				nodeId: 'maintenance-seam',
				label: 'Maintenance Seam',
				summary: 'A two-person crawlspace avoids the nave but divides the assault party.',
				kind: 'passage',
				roles: ['secret'],
				position: { x: 520, y: 150 },
				elevation: 'high',
				capacity: 2,
				initialKnowledge: 'concealed',
				observationIds: ['maintenance-airflow'],
				affordanceIds: []
			},
			{
				nodeId: 'cooling-control',
				label: 'Cooling Control',
				summary: 'A manual wheel can cool, then quench, the furnace-linked armor.',
				kind: 'objective',
				roles: ['objective', 'secret', 'encounter'],
				position: { x: 950, y: 130 },
				elevation: 'high',
				capacity: 2,
				initialKnowledge: 'concealed',
				observationIds: ['cooling-wheel-stages'],
				affordanceIds: ['test-cooling-wheel']
			}
		],
		edges: [
			{
				edgeId: 'threshold-to-ash-intake',
				fromNodeId: 'tower-threshold',
				toNodeId: 'ash-intake',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 90, y: 620 },
					{ x: 360, y: 500 }
				]
			},
			{
				edgeId: 'ash-intake-to-forge-nave',
				fromNodeId: 'ash-intake',
				toNodeId: 'forge-nave',
				bidirectional: true,
				traversalActions: 2,
				exposure: 'guarded',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 360, y: 500 },
					{ x: 700, y: 420 }
				]
			},
			{
				edgeId: 'forge-nave-to-furnace-heart',
				fromNodeId: 'forge-nave',
				toNodeId: 'furnace-heart',
				bidirectional: true,
				traversalActions: 2,
				exposure: 'exposed',
				access: { kind: 'open', discoveryId: null },
				visualPath: [
					{ x: 700, y: 420 },
					{ x: 1190, y: 350 }
				]
			},
			{
				edgeId: 'ash-intake-to-maintenance-seam',
				fromNodeId: 'ash-intake',
				toNodeId: 'maintenance-seam',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'requires-discovery', discoveryId: 'foundry-maintenance-route' },
				visualPath: [
					{ x: 360, y: 500 },
					{ x: 520, y: 150 }
				]
			},
			{
				edgeId: 'maintenance-seam-to-cooling-control',
				fromNodeId: 'maintenance-seam',
				toNodeId: 'cooling-control',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'requires-discovery', discoveryId: 'foundry-maintenance-route' },
				visualPath: [
					{ x: 520, y: 150 },
					{ x: 950, y: 130 }
				]
			},
			{
				edgeId: 'cooling-control-to-furnace-heart',
				fromNodeId: 'cooling-control',
				toNodeId: 'furnace-heart',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'exposed',
				access: { kind: 'requires-discovery', discoveryId: 'foundry-maintenance-route' },
				visualPath: [
					{ x: 950, y: 130 },
					{ x: 1190, y: 350 }
				]
			}
		],
		observations: [
			{
				observationId: 'foundry-threshold-heat',
				nodeId: 'tower-threshold',
				kind: 'heat',
				summary: 'Each furnace pulse makes the distant construct brighter and harder-edged.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'intake-soot-seam',
				nodeId: 'ash-intake',
				kind: 'trace',
				summary: 'The soot seam matches the intake-side mark on the Floor 04 schematic.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'warden-duty-runes',
				nodeId: 'forge-nave',
				kind: 'lore',
				summary:
					'The construct is ordered to pressure intruders and intercept cooling-control operators.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'warden-furnace-link',
				nodeId: 'furnace-heart',
				kind: 'heat',
				summary: 'Lit channels feed the Warden three layers of furnace-linked armor.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'maintenance-airflow',
				nodeId: 'maintenance-seam',
				kind: 'sound',
				summary: 'Cool air and a turning chain lead toward a control above the furnace.',
				reveal: { kind: 'discovery', discoveryId: 'foundry-maintenance-route' }
			},
			{
				observationId: 'cooling-wheel-stages',
				nodeId: 'cooling-control',
				kind: 'sight',
				summary:
					'The wheel is marked LIT, COOLING, and QUENCHED; each stage strips armor from the Warden.',
				reveal: { kind: 'discovery', discoveryId: 'cooling-control-weakness' }
			}
		],
		discoveries: [
			{
				discoveryId: 'foundry-maintenance-route',
				kind: 'route',
				title: 'The schematic was true',
				summary:
					'Remembered Floor 04 marks expose a two-person maintenance path to the cooling wheel.',
				revealNodeIds: ['maintenance-seam', 'cooling-control'],
				revealEdgeIds: [
					'ash-intake-to-maintenance-seam',
					'maintenance-seam-to-cooling-control',
					'cooling-control-to-furnace-heart'
				],
				revealObservationIds: ['maintenance-airflow'],
				canonicalFact: 'The Foundry maintenance route and cooling control physically exist.'
			},
			{
				discoveryId: 'cooling-control-weakness',
				kind: 'weakness',
				title: 'Three furnace states',
				summary:
					'Holding the wheel advances the furnace from lit to cooling to quenched and reduces Warden armor.',
				revealNodeIds: [],
				revealEdgeIds: [],
				revealObservationIds: ['cooling-wheel-stages'],
				canonicalFact:
					'The engine-owned cooling control reduces the Foundry Warden armor in two stages.'
			},
			{
				discoveryId: 'warden-intercept-duty',
				kind: 'fact',
				title: 'The Warden must intercept',
				summary:
					'Its runes compel it to contest the cooling control, creating space in the Furnace Heart.',
				revealNodeIds: [],
				revealEdgeIds: [],
				revealObservationIds: [],
				canonicalFact:
					'The Foundry Warden prioritizes a visible hero operating the cooling control.'
			}
		],
		discoveryAffordances: [
			{
				affordanceId: 'recall-maintenance-seam',
				nodeId: 'ash-intake',
				kind: 'inspect',
				label: 'Match the soot seam to the relay schematic',
				description:
					'Use a hero’s retained Floor 04 route knowledge to identify the real wall seam.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: ['relay-route-memory'],
				blockedByDiscoveryIds: ['foundry-maintenance-route'],
				outcomeDiscoveryIds: ['foundry-maintenance-route']
			},
			{
				affordanceId: 'test-cooling-wheel',
				nodeId: 'cooling-control',
				kind: 'test',
				label: 'Test the cooling wheel stages',
				description:
					'Commit one action to learn how the wheel changes the furnace and Warden armor.',
				timeActions: 1,
				requiresDiscoveryIds: ['foundry-maintenance-route'],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['cooling-control-weakness'],
				outcomeDiscoveryIds: ['cooling-control-weakness']
			},
			{
				affordanceId: 'read-warden-duty-runes',
				nodeId: 'forge-nave',
				kind: 'inspect',
				label: 'Read the Warden duty runes',
				description: 'Study what the construct is compelled to protect before entering its reach.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['warden-intercept-duty'],
				outcomeDiscoveryIds: ['warden-intercept-duty']
			}
		]
	},
	encounterSeedRules: {
		schemaVersion: 'mission-entropy-v1',
		namespace: 'tower-floor-05',
		namedPurposes: ['nave-watch-count', 'warden-initiative-tie', 'furnace-surge-phase']
	},
	monsterDuties: [
		{
			dutySlotId: 'forge-nave-watch',
			policyId: 'guard-chain-court-v1',
			spawnNodeId: 'forge-nave',
			count: { min: 2, max: 3 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'direct-route-screen']
		},
		{
			dutySlotId: 'foundry-warden',
			policyId: 'foundry-warden-v1',
			spawnNodeId: 'furnace-heart',
			count: { min: 1, max: 1 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['construct', 'boss', 'furnace-linked']
		}
	],
	environmentalEvents: [
		{
			eventId: 'furnace-surge',
			policyId: 'foundry-furnace-surge-v1',
			trigger: { kind: 'turn-interval', firstTurn: 3, everyTurns: 3 },
			maximumOccurrences: 12
		}
	],
	legalTools: standardTools,
	retreat: standardRetreat,
	rewards: {
		budgetPoints: 300,
		grants: [
			{
				grantId: 'floor-five-party-experience',
				trigger: 'success',
				kind: 'experience',
				key: 'party-experience',
				amount: 100,
				budgetCost: 100
			},
			{
				grantId: 'hearth-relight-core',
				trigger: 'success',
				kind: 'system-choice',
				key: 'hearth-relight',
				amount: 1,
				budgetCost: 120
			},
			{
				grantId: 'first-hearth-archive-fragment',
				trigger: 'success',
				kind: 'story-token',
				key: 'hearth-was-not-first',
				amount: 1,
				budgetCost: 60
			},
			{
				grantId: 'quenched-warden-plate',
				trigger: 'optional-objective',
				kind: 'resource',
				key: 'quenched-warden-plate',
				amount: 2,
				budgetCost: 20
			}
		]
	},
	story: authoredStory({
		prefix: 'floor-five',
		bandTheme: 'Authority is the consequence of preparation, trust, and who survives its exercise.',
		openingQuestion:
			'Did the company become strong enough to win, or connected enough to choose how?',
		opening: [
			'The furnace answers',
			'The Warden brightens with each pulse as the first band closes behind the party.',
			'The Foundry Warden begins in the Furnace Heart with its furnace lit.'
		],
		pressure: [
			'Armor fed by fire',
			'A direct assault is possible but every lit layer taxes preparation and vitality.',
			'The authored default route always reaches the Warden without a discovery.'
		],
		confrontation: [
			'Break or quench',
			'The company may damage-race the Warden or trust prior route knowledge to expose cooling.',
			'Victory requires defeating the Foundry Warden; no story patch can replace that conflict.'
		],
		recovery: [
			'Hearth was not first',
			'The broken construct releases power and an archive fragment from an older settlement.',
			'Defeat yields the relight core and the canonical archive message that Hearth 01 was not first.'
		],
		extraction: [
			'The first band remembers',
			'Survivors, deaths, preparation, and chosen strategy return as permanent evidence.',
			'Only extraction preserves the band rewards and its causal aftermath.'
		],
		optional: [
			'A trusted schematic',
			'Bind the maintenance route to the hero whose remembered evidence the party accepts.',
			'Who holds the wheel',
			'Let operating the cooling control divide protection between the control and direct fight.'
		]
	}),
	contentHash: '8d4b12beee900c17497f4a548f0916b42a0f7a14273f37342a82ebde1da829f2'
} as const;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export const TOWER_FLOOR_02_PACKAGE = deepFreeze(MissionPackageSchema.parse(floor02Source));
export const TOWER_FLOOR_03_PACKAGE = deepFreeze(MissionPackageSchema.parse(floor03Source));
export const TOWER_FLOOR_04_PACKAGE = deepFreeze(MissionPackageSchema.parse(floor04Source));
export const TOWER_FLOOR_05_PACKAGE = deepFreeze(MissionPackageSchema.parse(floor05Source));

export const TOWER_BAND_01_PACKAGES = deepFreeze([
	TOWER_FLOOR_01_PACKAGE,
	TOWER_FLOOR_02_PACKAGE,
	TOWER_FLOOR_03_PACKAGE,
	TOWER_FLOOR_04_PACKAGE,
	TOWER_FLOOR_05_PACKAGE
] as const);

const verifiedFloors = new Map<number, Promise<MissionPackage>>();

async function verifyFloor(mission: MissionPackage): Promise<MissionPackage> {
	const calculated = await calculateMissionContentHash(mission);
	if (calculated !== mission.contentHash) {
		throw new Error(
			`Tower Floor ${String(mission.tower?.floor).padStart(2, '0')} content hash drifted: expected ${mission.contentHash}, calculated ${calculated}`
		);
	}
	return mission;
}

export function loadTowerFloor(floor: number): Promise<MissionPackage> {
	if (floor === 1) return loadTowerFloor01();
	const mission = TOWER_BAND_01_PACKAGES.find((candidate) => candidate.tower?.floor === floor);
	if (!mission) return Promise.reject(new Error(`Tower Band 01 does not contain floor ${floor}`));
	let verified = verifiedFloors.get(floor);
	if (!verified) {
		verified = verifyFloor(mission);
		verifiedFloors.set(floor, verified);
	}
	return verified;
}

let verifiedBand: Promise<readonly MissionPackage[]> | undefined;

export function loadTowerBand01(): Promise<readonly MissionPackage[]> {
	verifiedBand ??= (async () => {
		const [missions, monsterPolicies] = await Promise.all([
			Promise.all(TOWER_BAND_01_PACKAGES.map((mission) => loadTowerFloor(mission.tower!.floor))),
			loadMonsterPolicyCatalog()
		]);
		const floors = missions.map((mission) => mission.tower?.floor);
		if (floors.join(',') !== '1,2,3,4,5')
			throw new Error('Tower Band 01 floors are not consecutive');
		if (new Set(missions.map((mission) => mission.contentHash)).size !== missions.length) {
			throw new Error('Tower Band 01 mission hashes must be unique');
		}
		const policyIds = new Set(monsterPolicies.policies.map((policy) => policy.policyId));
		for (const mission of missions) {
			for (const duty of mission.monsterDuties) {
				if (!policyIds.has(duty.policyId)) {
					throw new Error(
						`${mission.missionId} references unknown monster policy ${duty.policyId}`
					);
				}
			}
		}
		return TOWER_BAND_01_PACKAGES;
	})();
	return verifiedBand;
}

import {
	MissionPackageSchema,
	PortalMissionPackageSchema,
	type MissionPackage,
	type PortalMissionPackage
} from '@summonlab/contracts';

import { calculateMissionContentHash } from './tower-floor-01.js';

export const IRON_MOON_CONTENT_VERSION = 'iron-moon-v1';

const openAccess = { kind: 'open', discoveryId: null } as const;

const missionSource = {
	schemaVersion: 'mission-package-v1',
	contentVersion: IRON_MOON_CONTENT_VERSION,
	missionId: 'iron-moon',
	kind: 'portal-world',
	displayName: 'Iron Moon · The Closing Scar',
	tagline: 'Take what the settlement needs, then return before the wound in the sky seals.',
	tower: null,
	design: { width: 1440, height: 900, camera: 'tactical-three-quarter' },
	deployment: {
		entryNodeIds: ['moon-gate'],
		extractionNodeIds: ['moon-gate'],
		minimumPartyMembers: 1,
		maximumPartyMembers: 5,
		masterRequired: true,
		masterCountsTowardLimit: true,
		reserveAllowed: false
	},
	objectives: [
		{
			objectiveId: 'extract-iron-ore',
			primary: true,
			kind: 'recover',
			title: 'Extract four measures of moon iron',
			summary:
				'Mine at least four measures, reunite the entire company at the portal scar, and cross before it closes.',
			targetNodeIds: ['pale-vein', 'crater-heart'],
			completionRule: {
				kind: 'recover-ledger-item',
				itemKey: 'iron-ore',
				amount: 4,
				returnToNodeId: 'moon-gate'
			},
			failureRules: ['master-death', 'party-incapacitated', 'timer-expired']
		}
	],
	arena: {
		nodes: [
			{
				nodeId: 'moon-gate',
				label: 'Portal Scar',
				summary: 'A vertical wound of ember light cuts through the moonless iron sky.',
				kind: 'threshold',
				roles: ['deployment', 'extraction'],
				position: { x: 150, y: 470 },
				elevation: 'level',
				capacity: 8,
				initialKnowledge: 'known',
				observationIds: ['portal-wind-observation'],
				affordanceIds: []
			},
			{
				nodeId: 'windward-shelf',
				label: 'Windward Shelf',
				summary: 'A black-metal shelf where every loose grain runs sideways in the wind.',
				kind: 'passage',
				roles: [],
				position: { x: 430, y: 470 },
				elevation: 'high',
				capacity: 8,
				initialKnowledge: 'known',
				observationIds: ['shelf-shadow-observation'],
				affordanceIds: []
			},
			{
				nodeId: 'pale-vein',
				label: 'Pale Vein',
				summary:
					'Iron ribs break the surface here, soft enough to lever free before the next shear.',
				kind: 'objective',
				roles: ['objective'],
				position: { x: 720, y: 300 },
				elevation: 'level',
				capacity: 6,
				initialKnowledge: 'known',
				observationIds: ['pale-vein-observation'],
				affordanceIds: []
			},
			{
				nodeId: 'crater-heart',
				label: 'Crater Heart',
				summary:
					'A richer deposit lies inside a resonant basin that amplifies every portal fracture.',
				kind: 'objective',
				roles: ['objective', 'encounter'],
				position: { x: 980, y: 570 },
				elevation: 'low',
				capacity: 7,
				initialKnowledge: 'known',
				observationIds: ['crater-resonance-observation', 'dormant-husk-observation'],
				affordanceIds: ['listen-for-buried-seam']
			},
			{
				nodeId: 'buried-seam',
				label: 'Buried Resonance Seam',
				summary:
					'A narrow iron fault hidden beneath plates that answer the portal with a low chord.',
				kind: 'objective',
				roles: ['objective', 'secret'],
				position: { x: 1260, y: 420 },
				elevation: 'low',
				capacity: 4,
				initialKnowledge: 'concealed',
				observationIds: ['buried-seam-observation'],
				affordanceIds: []
			}
		],
		edges: [
			{
				edgeId: 'gate-to-shelf',
				fromNodeId: 'moon-gate',
				toNodeId: 'windward-shelf',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: openAccess,
				visualPath: [
					{ x: 150, y: 470 },
					{ x: 290, y: 440 },
					{ x: 430, y: 470 }
				]
			},
			{
				edgeId: 'shelf-to-pale-vein',
				fromNodeId: 'windward-shelf',
				toNodeId: 'pale-vein',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: openAccess,
				visualPath: [
					{ x: 430, y: 470 },
					{ x: 570, y: 360 },
					{ x: 720, y: 300 }
				]
			},
			{
				edgeId: 'shelf-to-crater-heart',
				fromNodeId: 'windward-shelf',
				toNodeId: 'crater-heart',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'exposed',
				access: openAccess,
				visualPath: [
					{ x: 430, y: 470 },
					{ x: 700, y: 620 },
					{ x: 980, y: 570 }
				]
			},
			{
				edgeId: 'pale-vein-to-crater-heart',
				fromNodeId: 'pale-vein',
				toNodeId: 'crater-heart',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: openAccess,
				visualPath: [
					{ x: 720, y: 300 },
					{ x: 860, y: 420 },
					{ x: 980, y: 570 }
				]
			},
			{
				edgeId: 'crater-to-buried-seam',
				fromNodeId: 'crater-heart',
				toNodeId: 'buried-seam',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: { kind: 'requires-discovery', discoveryId: 'buried-seam-route' },
				visualPath: [
					{ x: 980, y: 570 },
					{ x: 1120, y: 510 },
					{ x: 1260, y: 420 }
				]
			}
		],
		observations: [
			{
				observationId: 'portal-wind-observation',
				nodeId: 'moon-gate',
				kind: 'sound',
				summary: 'The portal tone drops a note whenever the remaining window shortens.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'shelf-shadow-observation',
				nodeId: 'windward-shelf',
				kind: 'sight',
				summary: 'Two reachable deposits split beyond the shelf: one safer, one richer.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'pale-vein-observation',
				nodeId: 'pale-vein',
				kind: 'trace',
				summary: 'The exposed vein will yield two measures before only dead stone remains.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'crater-resonance-observation',
				nodeId: 'crater-heart',
				kind: 'sound',
				summary: 'A second iron chord answers from beneath the eastern crater plates.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'dormant-husk-observation',
				nodeId: 'crater-heart',
				kind: 'sight',
				summary: 'A moonbound husk remains folded into the crater wall and has not awakened.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'buried-seam-observation',
				nodeId: 'buried-seam',
				kind: 'trace',
				summary: 'The hidden seam holds enough dense ore to rescue a late expedition.',
				reveal: { kind: 'discovery', discoveryId: 'buried-seam-route' }
			}
		],
		discoveries: [
			{
				discoveryId: 'buried-seam-route',
				kind: 'route',
				title: 'Hear the buried seam',
				summary: 'Matching the crater chord reveals a narrow eastern fault with dense iron.',
				revealNodeIds: ['buried-seam'],
				revealEdgeIds: ['crater-to-buried-seam'],
				revealObservationIds: ['buried-seam-observation'],
				canonicalFact: 'A dense moon-iron seam lies beneath the eastern crater plates.'
			}
		],
		discoveryAffordances: [
			{
				affordanceId: 'listen-for-buried-seam',
				nodeId: 'crater-heart',
				kind: 'listen',
				label: 'Match the buried chord',
				description: 'Spend one action isolating the iron resonance beneath the crater plates.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['buried-seam-route'],
				outcomeDiscoveryIds: ['buried-seam-route']
			}
		]
	},
	encounterSeedRules: {
		schemaVersion: 'mission-entropy-v1',
		namespace: 'iron-moon-expedition',
		namedPurposes: ['portal-pressure-phase']
	},
	monsterDuties: [
		{
			dutySlotId: 'dormant-moon-husk',
			policyId: 'guard-chain-court-v1',
			spawnNodeId: 'crater-heart',
			count: { min: 1, max: 1 },
			activation: { kind: 'on-discovery', discoveryId: 'buried-seam-route' },
			tags: ['dormant', 'moonbound', 'optional-threat']
		}
	],
	environmentalEvents: [
		{
			eventId: 'iron-wind-shear',
			policyId: 'portal-pressure-v1',
			trigger: { kind: 'turn-interval', firstTurn: 2, everyTurns: 2 },
			maximumOccurrences: 4
		}
	],
	legalTools: [
		{
			toolId: 'cross-iron-moon',
			actionKind: 'move',
			label: 'Cross the iron moon',
			availableAtRoles: ['deployment', 'extraction'],
			requiredEquipmentTags: []
		},
		{
			toolId: 'mine-moon-iron',
			actionKind: 'interact',
			label: 'Mine moon iron',
			availableAtRoles: ['objective'],
			requiredEquipmentTags: []
		},
		{
			toolId: 'brace-against-shear',
			actionKind: 'defend',
			label: 'Brace against the shear',
			availableAtRoles: [],
			requiredEquipmentTags: []
		},
		{
			toolId: 'retreat-through-scar',
			actionKind: 'retreat',
			label: 'Retreat through the scar',
			availableAtRoles: ['extraction'],
			requiredEquipmentTags: []
		}
	],
	retreat: {
		policy: 'authored-extraction-nodes',
		nodeIds: ['moon-gate'],
		preservesPrimaryObjective: false
	},
	rewards: {
		budgetPoints: 90,
		grants: [
			{
				grantId: 'iron-moon-clear-experience',
				trigger: 'success',
				kind: 'experience',
				key: 'mission-experience',
				amount: 10,
				budgetCost: 60
			},
			{
				grantId: 'buried-seam-story-token',
				trigger: 'discovery',
				kind: 'story-token',
				key: 'iron-moon-resonance',
				amount: 1,
				budgetCost: 20
			}
		]
	},
	story: {
		storySpineId: 'iron-moon-first-crossing',
		bandTheme: 'Scarcity makes every extra measure a wager against the road home.',
		openingQuestion: 'How much does a new company risk when every piece of iron matters?',
		beats: [
			{
				beatId: 'scar-opens',
				kind: 'opening',
				required: true,
				title: 'The scar opens',
				summary: 'The company sees the Iron Moon and the exact lifetime of the portal.',
				eligibleAfterBeatIds: []
			},
			{
				beatId: 'first-shear',
				kind: 'pressure',
				required: true,
				title: 'The first shear',
				summary: 'The world proves that the countdown is physical, not a UI abstraction.',
				eligibleAfterBeatIds: ['scar-opens']
			},
			{
				beatId: 'ore-or-resonance',
				kind: 'choice',
				required: true,
				title: 'Ore or resonance',
				summary: 'The company chooses reliable ore or time spent listening for a richer seam.',
				eligibleAfterBeatIds: ['first-shear']
			},
			{
				beatId: 'late-measure',
				kind: 'pressure',
				required: false,
				title: 'One measure more',
				summary: 'A hero argues for one last extraction action after the warning threshold.',
				eligibleAfterBeatIds: ['ore-or-resonance']
			},
			{
				beatId: 'crossing-closes',
				kind: 'extraction',
				required: true,
				title: 'The crossing closes',
				summary: 'Only ore carried through the scar becomes settlement stock.',
				eligibleAfterBeatIds: ['ore-or-resonance']
			}
		],
		defaultBeatOrder: ['scar-opens', 'first-shear', 'ore-or-resonance', 'crossing-closes'],
		anchors: [
			{
				anchorId: 'iron-moon-anchor-01',
				order: 1,
				beatId: 'scar-opens',
				immutableFact: 'The portal exposes its exact eight-round lifetime when deployment commits.'
			},
			{
				anchorId: 'iron-moon-anchor-02',
				order: 2,
				beatId: 'first-shear',
				immutableFact: 'Portal pressure escalates from stable to warning to critical.'
			},
			{
				anchorId: 'iron-moon-anchor-03',
				order: 3,
				beatId: 'ore-or-resonance',
				immutableFact: 'Mining transfers finite authored ore into one actor’s bounded cargo.'
			},
			{
				anchorId: 'iron-moon-anchor-04',
				order: 4,
				beatId: 'crossing-closes',
				immutableFact: 'Only successful extraction credits the settlement resource ledger.'
			}
		],
		proposalCatalog: [
			{
				proposalId: 'argue-for-late-measure',
				kind: 'role-expression',
				beatId: 'late-measure',
				summary:
					'Bind the late-extraction argument to the living hero with the strongest scarcity drive.'
			}
		],
		patchSlots: [
			{
				slotId: 'late-measure-slot',
				afterAnchorId: 'iron-moon-anchor-03',
				beforeAnchorId: 'iron-moon-anchor-04',
				allowedProposalIds: ['argue-for-late-measure'],
				maximumSelections: 1
			}
		],
		forbiddenChanges: [
			'world-laws',
			'primary-objective',
			'arena-truth',
			'reward-budget',
			'required-anchors'
		]
	},
	contentHash: 'e3aeee3711a42541373104ed47dfcf0c4a3ff38c7ddaba1d48327c24e95aeaca'
} as const;

const portalSource = {
	schemaVersion: 'portal-mission-package-v1',
	contentVersion: IRON_MOON_CONTENT_VERSION,
	missionId: 'iron-moon',
	mission: missionSource,
	portal: {
		portalId: 'iron-moon-scar',
		durationRounds: 8,
		warningAtRemainingRounds: 4,
		criticalAtRemainingRounds: 2,
		extractionQuota: 4,
		cargoCapacityPerActor: 4,
		deposits: [
			{
				depositId: 'pale-vein-deposit',
				nodeId: 'pale-vein',
				resource: 'iron-ore',
				initialAmount: 2,
				mineAmountPerAction: 1
			},
			{
				depositId: 'crater-heart-deposit',
				nodeId: 'crater-heart',
				resource: 'iron-ore',
				initialAmount: 4,
				mineAmountPerAction: 2
			},
			{
				depositId: 'buried-seam-deposit',
				nodeId: 'buried-seam',
				resource: 'iron-ore',
				initialAmount: 6,
				mineAmountPerAction: 2
			}
		],
		collapse: { failureRule: 'timer-expired', cargoDisposition: 'lost' }
	},
	contentHash: 'f364cdcd75324848e4ef91fcf3d8b75103a01b897da148b8c977dc24ac710b35'
} as const;

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

export async function calculatePortalMissionContentHash(
	portalPackage: PortalMissionPackage
): Promise<string> {
	const payload: Partial<PortalMissionPackage> = { ...portalPackage };
	delete payload.contentHash;
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(canonicalJson(payload))
	);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export const IRON_MOON_MISSION = deepFreeze(MissionPackageSchema.parse(missionSource));
export const IRON_MOON_PACKAGE = deepFreeze(PortalMissionPackageSchema.parse(portalSource));

let verifiedPackage: Promise<PortalMissionPackage> | undefined;

export function loadIronMoonMission(): Promise<PortalMissionPackage> {
	verifiedPackage ??= (async () => {
		const [missionHash, portalHash] = await Promise.all([
			calculateMissionContentHash(IRON_MOON_MISSION),
			calculatePortalMissionContentHash(IRON_MOON_PACKAGE)
		]);
		if (missionHash !== IRON_MOON_MISSION.contentHash) {
			throw new Error(
				`Iron Moon mission hash drifted: expected ${IRON_MOON_MISSION.contentHash}, calculated ${missionHash}`
			);
		}
		if (portalHash !== IRON_MOON_PACKAGE.contentHash) {
			throw new Error(
				`Iron Moon portal hash drifted: expected ${IRON_MOON_PACKAGE.contentHash}, calculated ${portalHash}`
			);
		}
		return IRON_MOON_PACKAGE;
	})();
	return verifiedPackage;
}

export function ironMoonMissionContent(): MissionPackage {
	return IRON_MOON_PACKAGE.mission;
}

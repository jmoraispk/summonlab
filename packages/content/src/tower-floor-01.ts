import {
	MissionArenaKnowledgeSchema,
	MissionArenaProjectionSchema,
	MissionPackageSchema,
	MissionRoutePlanSchema,
	type MissionArenaEdge,
	type MissionArenaKnowledge,
	type MissionArenaProjection,
	type MissionDiscoveryAffordance,
	type MissionPackage,
	type MissionRoutePlan
} from '@summonlab/contracts';

export const TOWER_FLOOR_01_CONTENT_VERSION = 'tower-floor-01-v1';

const openAccess = { kind: 'open', discoveryId: null } as const;

function discoveredAccess(discoveryId: string) {
	return { kind: 'requires-discovery', discoveryId } as const;
}

const source = {
	schemaVersion: 'mission-package-v1',
	contentVersion: TOWER_FLOOR_01_CONTENT_VERSION,
	missionId: 'tower-floor-01',
	kind: 'tower-floor',
	displayName: 'Floor 01 · The Unlit Muster',
	tagline: 'Bring one ember home before the tower learns what kind of company has entered it.',
	tower: { floor: 1, band: 1, floorInBand: 1 },
	design: { width: 1440, height: 900, camera: 'tactical-three-quarter' },
	deployment: {
		entryNodeIds: ['tower-threshold'],
		extractionNodeIds: ['tower-threshold'],
		minimumPartyMembers: 1,
		maximumPartyMembers: 5,
		masterRequired: true,
		masterCountsTowardLimit: true,
		reserveAllowed: false
	},
	objectives: [
		{
			objectiveId: 'recover-first-ember',
			primary: true,
			kind: 'recover',
			title: 'Recover the First Ember',
			summary:
				'Remove the ember from its dead cradle and carry it back across the tower threshold. A recovery without extraction is not a victory.',
			targetNodeIds: ['ember-vault'],
			completionRule: {
				kind: 'recover-ledger-item',
				itemKey: 'first-ember',
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
				summary: 'A black gate aperture framed by five empty company seals.',
				kind: 'threshold',
				roles: ['deployment', 'extraction'],
				position: { x: 180, y: 470 },
				elevation: 'level',
				capacity: 8,
				initialKnowledge: 'known',
				observationIds: ['threshold-seal-observation'],
				affordanceIds: []
			},
			{
				nodeId: 'oath-hall',
				label: 'Oath Hall',
				summary: 'A long assembly hall whose company names have been scraped from the stone.',
				kind: 'chamber',
				roles: [],
				position: { x: 430, y: 470 },
				elevation: 'level',
				capacity: 12,
				initialKnowledge: 'known',
				observationIds: ['oath-draft-observation', 'oath-tablet-observation'],
				affordanceIds: ['inspect-soot-seam', 'read-muster-tablet']
			},
			{
				nodeId: 'shattered-gallery',
				label: 'Shattered Gallery',
				summary: 'A broken balcony above the old muster floor, open to arrow fire from the east.',
				kind: 'passage',
				roles: ['encounter'],
				position: { x: 690, y: 300 },
				elevation: 'high',
				capacity: 6,
				initialKnowledge: 'known',
				observationIds: ['gallery-chain-observation'],
				affordanceIds: ['test-bell-chain']
			},
			{
				nodeId: 'chain-court',
				label: 'Chain Court',
				summary: 'A narrow killing floor crossed by ore chains and makeshift goblin cover.',
				kind: 'chamber',
				roles: ['encounter'],
				position: { x: 930, y: 470 },
				elevation: 'low',
				capacity: 10,
				initialKnowledge: 'known',
				observationIds: ['chain-court-duty-observation'],
				affordanceIds: []
			},
			{
				nodeId: 'ember-vault',
				label: 'Ember Vault',
				summary: 'A circular cradle holding the settlement’s first recoverable power core.',
				kind: 'objective',
				roles: ['objective', 'encounter'],
				position: { x: 1240, y: 470 },
				elevation: 'level',
				capacity: 8,
				initialKnowledge: 'known',
				observationIds: ['ember-cradle-observation'],
				affordanceIds: []
			},
			{
				nodeId: 'ash-duct',
				label: 'Ash Duct',
				summary: 'A cramped service throat that bypasses the exposed gallery and Chain Court.',
				kind: 'passage',
				roles: ['secret'],
				position: { x: 760, y: 700 },
				elevation: 'low',
				capacity: 3,
				initialKnowledge: 'concealed',
				observationIds: ['ash-duct-mark-observation'],
				affordanceIds: []
			},
			{
				nodeId: 'bell-overlook',
				label: 'Bell Overlook',
				summary: 'A collapsed signal loft with a clean view of the Chain Court duty routes.',
				kind: 'vantage',
				roles: ['secret'],
				position: { x: 930, y: 145 },
				elevation: 'high',
				capacity: 4,
				initialKnowledge: 'concealed',
				observationIds: ['bell-overlook-observation'],
				affordanceIds: []
			}
		],
		edges: [
			{
				edgeId: 'threshold-to-oath-hall',
				fromNodeId: 'tower-threshold',
				toNodeId: 'oath-hall',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: openAccess,
				visualPath: [
					{ x: 180, y: 470 },
					{ x: 300, y: 470 },
					{ x: 430, y: 470 }
				]
			},
			{
				edgeId: 'oath-hall-to-gallery',
				fromNodeId: 'oath-hall',
				toNodeId: 'shattered-gallery',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: openAccess,
				visualPath: [
					{ x: 430, y: 470 },
					{ x: 555, y: 360 },
					{ x: 690, y: 300 }
				]
			},
			{
				edgeId: 'gallery-to-chain-court',
				fromNodeId: 'shattered-gallery',
				toNodeId: 'chain-court',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'exposed',
				access: openAccess,
				visualPath: [
					{ x: 690, y: 300 },
					{ x: 820, y: 350 },
					{ x: 930, y: 470 }
				]
			},
			{
				edgeId: 'chain-court-to-vault',
				fromNodeId: 'chain-court',
				toNodeId: 'ember-vault',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: openAccess,
				visualPath: [
					{ x: 930, y: 470 },
					{ x: 1080, y: 470 },
					{ x: 1240, y: 470 }
				]
			},
			{
				edgeId: 'oath-hall-to-ash-duct',
				fromNodeId: 'oath-hall',
				toNodeId: 'ash-duct',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: discoveredAccess('soot-seam-route'),
				visualPath: [
					{ x: 430, y: 470 },
					{ x: 570, y: 620 },
					{ x: 760, y: 700 }
				]
			},
			{
				edgeId: 'ash-duct-to-vault',
				fromNodeId: 'ash-duct',
				toNodeId: 'ember-vault',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: discoveredAccess('soot-seam-route'),
				visualPath: [
					{ x: 760, y: 700 },
					{ x: 1010, y: 650 },
					{ x: 1240, y: 470 }
				]
			},
			{
				edgeId: 'gallery-to-bell-overlook',
				fromNodeId: 'shattered-gallery',
				toNodeId: 'bell-overlook',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'guarded',
				access: discoveredAccess('fractured-bell-stair'),
				visualPath: [
					{ x: 690, y: 300 },
					{ x: 810, y: 190 },
					{ x: 930, y: 145 }
				]
			},
			{
				edgeId: 'bell-overlook-to-chain-court',
				fromNodeId: 'bell-overlook',
				toNodeId: 'chain-court',
				bidirectional: true,
				traversalActions: 1,
				exposure: 'low',
				access: discoveredAccess('fractured-bell-stair'),
				visualPath: [
					{ x: 930, y: 145 },
					{ x: 960, y: 300 },
					{ x: 930, y: 470 }
				]
			}
		],
		observations: [
			{
				observationId: 'threshold-seal-observation',
				nodeId: 'tower-threshold',
				kind: 'sight',
				summary:
					'One of five company seals glows as the party crosses; the other four remain dark.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'oath-draft-observation',
				nodeId: 'oath-hall',
				kind: 'trace',
				summary: 'Warm soot moves sideways across a wall whose mortar looks newer than its stone.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'oath-tablet-observation',
				nodeId: 'oath-hall',
				kind: 'lore',
				summary:
					'The erased muster tablet records companies, not owners: the tower judged a group by what returned.',
				reveal: { kind: 'discovery', discoveryId: 'erased-muster-oath' }
			},
			{
				observationId: 'gallery-chain-observation',
				nodeId: 'shattered-gallery',
				kind: 'sound',
				summary:
					'A severed bell chain knocks against hollow stone whenever something crosses below.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'chain-court-duty-observation',
				nodeId: 'chain-court',
				kind: 'trace',
				summary: 'Small bootprints repeat the same patrol loop between cover and the vault door.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'ember-cradle-observation',
				nodeId: 'ember-vault',
				kind: 'heat',
				summary:
					'The First Ember pulses inside an unlocked cradle while its carrier frame remains chained to the floor.',
				reveal: { kind: 'on-entry', discoveryId: null }
			},
			{
				observationId: 'ash-duct-mark-observation',
				nodeId: 'ash-duct',
				kind: 'trace',
				summary:
					'Fresh scrape marks prove the duct is used, but the smallest prints travel toward the vault rather than away.',
				reveal: { kind: 'discovery', discoveryId: 'soot-seam-route' }
			},
			{
				observationId: 'bell-overlook-observation',
				nodeId: 'bell-overlook',
				kind: 'sight',
				summary:
					'From above, the patrol pauses whenever the ember pulses; its duty is synchronized, not alert.',
				reveal: { kind: 'discovery', discoveryId: 'fractured-bell-stair' }
			}
		],
		discoveries: [
			{
				discoveryId: 'soot-seam-route',
				kind: 'route',
				title: 'The soot seam opens',
				summary: 'A service duct creates a low-exposure route from Oath Hall to the Ember Vault.',
				revealNodeIds: ['ash-duct'],
				revealEdgeIds: ['oath-hall-to-ash-duct', 'ash-duct-to-vault'],
				revealObservationIds: ['ash-duct-mark-observation'],
				canonicalFact: 'The Ash Duct physically connects Oath Hall to the Ember Vault.'
			},
			{
				discoveryId: 'fractured-bell-stair',
				kind: 'weakness',
				title: 'A stair behind the bell',
				summary: 'The broken signal stair reaches a vantage point over the goblin patrol loop.',
				revealNodeIds: ['bell-overlook'],
				revealEdgeIds: ['gallery-to-bell-overlook', 'bell-overlook-to-chain-court'],
				revealObservationIds: ['bell-overlook-observation'],
				canonicalFact: 'The Chain Court patrol pauses in time with the ember pulse.'
			},
			{
				discoveryId: 'erased-muster-oath',
				kind: 'fact',
				title: 'The old meaning of company',
				summary:
					'The tablet frames success as what a company returns with—and who returns together.',
				revealNodeIds: [],
				revealEdgeIds: [],
				revealObservationIds: ['oath-tablet-observation'],
				canonicalFact:
					'The tower records the returning company rather than recognizing a permanent owner.'
			}
		],
		discoveryAffordances: [
			{
				affordanceId: 'inspect-soot-seam',
				nodeId: 'oath-hall',
				kind: 'inspect',
				label: 'Inspect the warm soot seam',
				description: 'Spend a turn testing the newer mortar without assuming a passage exists.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['soot-seam-route'],
				outcomeDiscoveryIds: ['soot-seam-route']
			},
			{
				affordanceId: 'read-muster-tablet',
				nodeId: 'oath-hall',
				kind: 'inspect',
				label: 'Reconstruct the erased muster oath',
				description: 'Compare the surviving strokes instead of inventing the missing inscription.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['erased-muster-oath'],
				outcomeDiscoveryIds: ['erased-muster-oath']
			},
			{
				affordanceId: 'test-bell-chain',
				nodeId: 'shattered-gallery',
				kind: 'test',
				label: 'Put weight on the severed bell chain',
				description:
					'Test whether the chain still moves masonry behind the collapsed signal frame.',
				timeActions: 1,
				requiresDiscoveryIds: [],
				requiredToolTags: [],
				blockedByDiscoveryIds: ['fractured-bell-stair'],
				outcomeDiscoveryIds: ['fractured-bell-stair']
			}
		]
	},
	encounterSeedRules: {
		schemaVersion: 'mission-entropy-v1',
		namespace: 'tower-floor-01',
		namedPurposes: [
			'goblin-chain-watch-count',
			'goblin-ember-hauler-count',
			'initiative-tie-break',
			'duty-target-tie-break',
			'reward-quality'
		]
	},
	monsterDuties: [
		{
			dutySlotId: 'goblin-chain-watch',
			policyId: 'guard-chain-court-v1',
			spawnNodeId: 'chain-court',
			count: { min: 2, max: 3 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'guard', 'melee']
		},
		{
			dutySlotId: 'goblin-ember-hauler',
			policyId: 'protect-ember-cradle-v1',
			spawnNodeId: 'ember-vault',
			count: { min: 1, max: 1 },
			activation: { kind: 'on-deployment', discoveryId: null },
			tags: ['goblin', 'worker', 'alarm']
		}
	],
	environmentalEvents: [
		{
			eventId: 'first-ember-pulse',
			policyId: 'ember-heat-pulse-v1',
			trigger: { kind: 'turn-interval', firstTurn: 3, everyTurns: 3 },
			maximumOccurrences: 8
		}
	],
	legalTools: [
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
			toolId: 'extract-at-threshold',
			actionKind: 'retreat',
			label: 'Extract or retreat at the threshold',
			availableAtRoles: ['extraction'],
			requiredEquipmentTags: []
		}
	],
	retreat: {
		policy: 'authored-extraction-nodes',
		nodeIds: ['tower-threshold'],
		preservesPrimaryObjective: false
	},
	rewards: {
		budgetPoints: 140,
		grants: [
			{
				grantId: 'first-ember-system-choice',
				trigger: 'success',
				kind: 'system-choice',
				key: 'first-ember',
				amount: 1,
				budgetCost: 80
			},
			{
				grantId: 'floor-one-party-experience',
				trigger: 'success',
				kind: 'experience',
				key: 'party-experience',
				amount: 40,
				budgetCost: 40
			},
			{
				grantId: 'muster-oath-story-token',
				trigger: 'discovery',
				kind: 'story-token',
				key: 'tower-remembers-companies',
				amount: 1,
				budgetCost: 20
			}
		]
	},
	story: {
		storySpineId: 'band-one-unclaimed-authority',
		bandTheme: 'Authority must be demonstrated through protection, provision, and what survives.',
		openingQuestion:
			'Why should a clean-slate hero risk a permanent life for a settlement they just met?',
		beats: [
			{
				beatId: 'cross-the-first-threshold',
				kind: 'opening',
				required: true,
				title: 'The first company seal',
				summary:
					'The threshold records the group that enters without declaring any of them its owner.',
				eligibleAfterBeatIds: []
			},
			{
				beatId: 'see-the-settlements-need',
				kind: 'pressure',
				required: true,
				title: 'Eighteen hours of light',
				summary: 'The party sees the First Ember and understands what failure will cost Hearth 01.',
				eligibleAfterBeatIds: ['cross-the-first-threshold']
			},
			{
				beatId: 'hear-an-older-company',
				kind: 'discovery',
				required: false,
				title: 'An oath under the erasure',
				summary:
					'A hero recognizes that the tower measured returning companies rather than permanent ownership.',
				eligibleAfterBeatIds: ['see-the-settlements-need']
			},
			{
				beatId: 'pay-for-the-short-route',
				kind: 'choice',
				required: false,
				title: 'Who takes the narrow way',
				summary:
					'The discovered duct is safer from patrols but separates a large party by capacity.',
				eligibleAfterBeatIds: ['see-the-settlements-need']
			},
			{
				beatId: 'meet-the-first-duty',
				kind: 'confrontation',
				required: true,
				title: 'The chain watch',
				summary:
					'The goblins defend a duty route rather than acting as omniscient tactical agents.',
				eligibleAfterBeatIds: ['see-the-settlements-need']
			},
			{
				beatId: 'lift-the-first-ember',
				kind: 'recovery',
				required: true,
				title: 'Power with a carrier',
				summary: 'Taking the ember creates a burden the party must physically carry back.',
				eligibleAfterBeatIds: ['meet-the-first-duty']
			},
			{
				beatId: 'return-as-a-company',
				kind: 'extraction',
				required: true,
				title: 'What crossed back',
				summary:
					'Success records the ember, survivors, injuries, and choices that return through the threshold.',
				eligibleAfterBeatIds: ['lift-the-first-ember']
			}
		],
		defaultBeatOrder: [
			'cross-the-first-threshold',
			'see-the-settlements-need',
			'meet-the-first-duty',
			'lift-the-first-ember',
			'return-as-a-company'
		],
		anchors: [
			{
				anchorId: 'arrival-anchor',
				order: 1,
				beatId: 'cross-the-first-threshold',
				immutableFact:
					'The party enters through the Tower Threshold and the Master is physically present.'
			},
			{
				anchorId: 'need-anchor',
				order: 2,
				beatId: 'see-the-settlements-need',
				immutableFact: 'Hearth 01 needs the First Ember to stabilize one settlement system.'
			},
			{
				anchorId: 'opposition-anchor',
				order: 3,
				beatId: 'meet-the-first-duty',
				immutableFact: 'Goblin duties obstruct the authored default route to the Ember Vault.'
			},
			{
				anchorId: 'recovery-anchor',
				order: 4,
				beatId: 'lift-the-first-ember',
				immutableFact: 'The First Ember must be physically recovered from the Ember Vault.'
			},
			{
				anchorId: 'return-anchor',
				order: 5,
				beatId: 'return-as-a-company',
				immutableFact: 'Only extraction across the Tower Threshold can complete the mission.'
			}
		],
		proposalCatalog: [
			{
				proposalId: 'surface-the-erased-oath',
				kind: 'role-expression',
				beatId: 'hear-an-older-company',
				summary: 'Bind the erased oath discovery to a living hero who actually examined the tablet.'
			},
			{
				proposalId: 'force-a-duct-capacity-choice',
				kind: 'complication',
				beatId: 'pay-for-the-short-route',
				summary: 'If the duct was discovered, make its capacity create a party-order decision.'
			}
		],
		patchSlots: [
			{
				slotId: 'between-need-and-opposition',
				afterAnchorId: 'need-anchor',
				beforeAnchorId: 'opposition-anchor',
				allowedProposalIds: ['surface-the-erased-oath', 'force-a-duct-capacity-choice'],
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
	contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
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

export async function calculateMissionContentHash(mission: MissionPackage): Promise<string> {
	const payload: Partial<MissionPackage> = { ...mission };
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

export const TOWER_FLOOR_01_PACKAGE = deepFreeze(MissionPackageSchema.parse(source));

let verifiedPackage: Promise<MissionPackage> | undefined;

export function loadTowerFloor01(): Promise<MissionPackage> {
	verifiedPackage ??= (async () => {
		const mission = TOWER_FLOOR_01_PACKAGE;
		const contentHash = await calculateMissionContentHash(mission);
		if (contentHash !== mission.contentHash) {
			throw new Error(
				`Tower Floor 01 content hash drifted: expected ${mission.contentHash}, calculated ${contentHash}`
			);
		}
		return mission;
	})();
	return verifiedPackage;
}

function validateKnowledge(mission: MissionPackage, sourceKnowledge: MissionArenaKnowledge) {
	const knowledge = MissionArenaKnowledgeSchema.parse(sourceKnowledge);
	const discoveryIds = new Set(mission.arena.discoveries.map((discovery) => discovery.discoveryId));
	const nodeIds = new Set(mission.arena.nodes.map((node) => node.nodeId));
	for (const discoveryId of knowledge.discoveryIds) {
		if (!discoveryIds.has(discoveryId))
			throw new Error(`Unknown mission discovery: ${discoveryId}`);
	}
	for (const nodeId of knowledge.visitedNodeIds) {
		if (!nodeIds.has(nodeId)) throw new Error(`Unknown visited mission node: ${nodeId}`);
	}
	return knowledge;
}

export function projectMissionArenaKnowledge(
	mission: MissionPackage,
	sourceKnowledge: MissionArenaKnowledge
): MissionArenaProjection {
	const knowledge = validateKnowledge(mission, sourceKnowledge);
	const discovered = new Set(knowledge.discoveryIds);
	const visited = new Set(knowledge.visitedNodeIds);
	const revealedNodeIds = new Set(
		mission.arena.discoveries
			.filter((discovery) => discovered.has(discovery.discoveryId))
			.flatMap((discovery) => discovery.revealNodeIds)
	);
	const visibleNodes = mission.arena.nodes.filter(
		(node) => node.initialKnowledge === 'known' || revealedNodeIds.has(node.nodeId)
	);
	const visibleNodeIds = new Set(visibleNodes.map((node) => node.nodeId));
	const visibleEdges = mission.arena.edges.filter(
		(edge) =>
			visibleNodeIds.has(edge.fromNodeId) &&
			visibleNodeIds.has(edge.toNodeId) &&
			(edge.access.kind === 'open' || discovered.has(edge.access.discoveryId))
	);
	const visibleObservations = mission.arena.observations.filter(
		(observation) =>
			visibleNodeIds.has(observation.nodeId) &&
			(observation.reveal.kind === 'discovery'
				? discovered.has(observation.reveal.discoveryId)
				: visited.has(observation.nodeId))
	);

	return MissionArenaProjectionSchema.parse({
		discoveryIds: [...discovered].sort(),
		visitedNodeIds: [...visited].sort(),
		nodeIds: visibleNodes.map((node) => node.nodeId),
		edgeIds: visibleEdges.map((edge) => edge.edgeId),
		observationIds: visibleObservations.map((observation) => observation.observationId)
	});
}

export function listLegalMissionDiscoveryAffordances(
	mission: MissionPackage,
	nodeId: string,
	sourceKnowledge: MissionArenaKnowledge,
	toolTags: ReadonlySet<string> = new Set()
): readonly MissionDiscoveryAffordance[] {
	const knowledge = validateKnowledge(mission, sourceKnowledge);
	const projection = projectMissionArenaKnowledge(mission, knowledge);
	if (!projection.nodeIds.includes(nodeId) || !knowledge.visitedNodeIds.includes(nodeId)) return [];
	const discovered = new Set(knowledge.discoveryIds);
	return mission.arena.discoveryAffordances.filter(
		(affordance) =>
			affordance.nodeId === nodeId &&
			affordance.requiresDiscoveryIds.every((id) => discovered.has(id)) &&
			affordance.requiredToolTags.every((tag) => toolTags.has(tag)) &&
			affordance.blockedByDiscoveryIds.every((id) => !discovered.has(id))
	);
}

export function applyMissionDiscoveryAffordance(
	mission: MissionPackage,
	affordanceId: string,
	sourceKnowledge: MissionArenaKnowledge,
	toolTags: ReadonlySet<string> = new Set()
): MissionArenaKnowledge {
	const knowledge = validateKnowledge(mission, sourceKnowledge);
	const affordance = mission.arena.discoveryAffordances.find(
		(candidate) => candidate.affordanceId === affordanceId
	);
	if (
		!affordance ||
		!listLegalMissionDiscoveryAffordances(mission, affordance.nodeId, knowledge, toolTags).some(
			(candidate) => candidate.affordanceId === affordanceId
		)
	) {
		throw new Error(`Mission discovery affordance is not legal: ${affordanceId}`);
	}
	return MissionArenaKnowledgeSchema.parse({
		discoveryIds: [
			...new Set([...knowledge.discoveryIds, ...affordance.outcomeDiscoveryIds])
		].sort(),
		visitedNodeIds: [...knowledge.visitedNodeIds]
	});
}

export function visitMissionNode(
	mission: MissionPackage,
	nodeId: string,
	sourceKnowledge: MissionArenaKnowledge
): MissionArenaKnowledge {
	const knowledge = validateKnowledge(mission, sourceKnowledge);
	const projection = projectMissionArenaKnowledge(mission, knowledge);
	if (!projection.nodeIds.includes(nodeId)) throw new Error(`Mission node is not known: ${nodeId}`);
	return MissionArenaKnowledgeSchema.parse({
		discoveryIds: [...knowledge.discoveryIds],
		visitedNodeIds: [...new Set([...knowledge.visitedNodeIds, nodeId])].sort()
	});
}

function exposureRank(exposure: MissionArenaEdge['exposure']): number {
	return { low: 0, guarded: 1, exposed: 2 }[exposure];
}

export function planMissionRoute(
	mission: MissionPackage,
	fromNodeId: string,
	toNodeId: string,
	sourceKnowledge: MissionArenaKnowledge
): MissionRoutePlan | null {
	const knowledge = validateKnowledge(mission, sourceKnowledge);
	const projection = projectMissionArenaKnowledge(mission, knowledge);
	if (!projection.nodeIds.includes(fromNodeId) || !projection.nodeIds.includes(toNodeId))
		return null;
	if (fromNodeId === toNodeId) {
		return MissionRoutePlanSchema.parse({
			fromNodeId,
			toNodeId,
			discoveryIds: projection.discoveryIds,
			nodeIds: [fromNodeId],
			steps: [],
			totalTraversalActions: 0,
			maximumExposure: 'low'
		});
	}

	const visibleEdgeIds = new Set(projection.edgeIds);
	type Candidate = {
		nodeId: string;
		total: number;
		signature: string;
		nodeIds: string[];
		steps: Array<{
			edgeId: string;
			fromNodeId: string;
			toNodeId: string;
			traversalActions: number;
			exposure: MissionArenaEdge['exposure'];
		}>;
	};
	const pending: Candidate[] = [
		{ nodeId: fromNodeId, total: 0, signature: '', nodeIds: [fromNodeId], steps: [] }
	];
	const best = new Map<string, { total: number; signature: string }>();
	while (pending.length > 0) {
		pending.sort(
			(left, right) => left.total - right.total || left.signature.localeCompare(right.signature)
		);
		const current = pending.shift()!;
		const prior = best.get(current.nodeId);
		if (
			prior &&
			(prior.total < current.total ||
				(prior.total === current.total && prior.signature <= current.signature))
		) {
			continue;
		}
		best.set(current.nodeId, { total: current.total, signature: current.signature });
		if (current.nodeId === toNodeId) {
			const maximumExposure = current.steps.reduce<MissionArenaEdge['exposure']>(
				(maximum, step) =>
					exposureRank(step.exposure) > exposureRank(maximum) ? step.exposure : maximum,
				'low'
			);
			return MissionRoutePlanSchema.parse({
				fromNodeId,
				toNodeId,
				discoveryIds: projection.discoveryIds,
				nodeIds: current.nodeIds,
				steps: current.steps,
				totalTraversalActions: current.total,
				maximumExposure
			});
		}
		const candidates = mission.arena.edges
			.filter(
				(edge) =>
					visibleEdgeIds.has(edge.edgeId) &&
					(edge.fromNodeId === current.nodeId ||
						(edge.bidirectional && edge.toNodeId === current.nodeId))
			)
			.map((edge) => ({
				edge,
				toNodeId: edge.fromNodeId === current.nodeId ? edge.toNodeId : edge.fromNodeId
			}))
			.sort((left, right) => left.edge.edgeId.localeCompare(right.edge.edgeId));
		for (const { edge, toNodeId: nextNodeId } of candidates) {
			if (current.nodeIds.includes(nextNodeId)) continue;
			pending.push({
				nodeId: nextNodeId,
				total: current.total + edge.traversalActions,
				signature: `${current.signature}/${edge.edgeId}`,
				nodeIds: [...current.nodeIds, nextNodeId],
				steps: [
					...current.steps,
					{
						edgeId: edge.edgeId,
						fromNodeId: current.nodeId,
						toNodeId: nextNodeId,
						traversalActions: edge.traversalActions,
						exposure: edge.exposure
					}
				]
			});
		}
	}
	return null;
}

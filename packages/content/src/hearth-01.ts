import {
	SettlementDefinitionSchema,
	SettlementRoutePlanSchema,
	type SettlementAccessRule,
	type SettlementDefinition,
	type SettlementRouteEdge,
	type SettlementRoutePlan
} from '@summonlab/contracts';

export const HEARTH_01_CONTENT_VERSION = 'hearth-01-v1';

const openAccess = { kind: 'open', systemId: null } as const;

function systemAccess(systemId: string): SettlementAccessRule {
	return { kind: 'requires-system', systemId };
}

const source = {
	schemaVersion: 'settlement-definition-v1',
	contentVersion: HEARTH_01_CONTENT_VERSION,
	settlementId: 'hearth-01',
	displayName: 'Hearth 01',
	tagline: 'A refuge with eighteen hours of reserve power and one impossible road upward.',
	design: {
		width: 1600,
		height: 900,
		camera: 'high-three-quarter',
		wallBoundary: [
			{ x: 180, y: 180 },
			{ x: 800, y: 60 },
			{ x: 1420, y: 180 },
			{ x: 1510, y: 680 },
			{ x: 800, y: 850 },
			{ x: 90, y: 680 }
		]
	},
	spawnNodeId: 'gate-dais',
	buildings: [
		{
			buildingId: 'summoning-gate',
			kind: 'summoning-gate',
			label: 'The Summoning Gate',
			shortLabel: 'Gate',
			summary:
				'A cold circular machine for summoning, first contact, and the questions nobody can answer yet.',
			entranceNodeId: 'gate-court',
			systemId: 'gate-system',
			interactions: ['summon', 'inspect', 'first-meeting'],
			simulationEffects: ['roster', 'clean-slate-onboarding'],
			interior: {
				focusNodeId: 'gate-dais',
				nodeIds: ['gate-court', 'gate-dais', 'gate-rail'],
				camera: { x: 500, y: 400, zoom: 1.06 },
				ambientColor: '#78cfe0',
				caption: 'Cold geometry, a waist-high witness rail, and no comforting explanation.',
				layers: [
					{
						layerId: 'gate-archive-shadow',
						depth: 'back',
						description: 'Sealed archive doors and the black tower beyond the upper aperture.'
					},
					{
						layerId: 'gate-ring',
						depth: 'mid',
						description: 'The scored summoning circle, restraint rail, and cooling conduit spine.'
					},
					{
						layerId: 'gate-ash',
						depth: 'front',
						description: 'Loose ash, broken floor plates, and the Master-facing inspection ledge.'
					}
				]
			}
		},
		{
			buildingId: 'kitchen',
			kind: 'kitchen',
			label: 'Common Kitchen',
			shortLabel: 'Kitchen',
			summary: 'The settlement’s warmest room: food ledger, work assignment, and shared context.',
			entranceNodeId: 'kitchen-entry',
			systemId: 'hearth-system',
			interactions: ['assign', 'cook', 'eat', 'shared-meal'],
			simulationEffects: ['hunger', 'social-contact', 'food-ledger'],
			interior: {
				focusNodeId: 'kitchen-table',
				nodeIds: ['kitchen-entry', 'kitchen-hearth', 'kitchen-table'],
				camera: { x: 480, y: 430, zoom: 1.12 },
				ambientColor: '#d9a45e',
				caption: 'A long table makes private uncertainty public before the meal is finished.',
				layers: [
					{
						layerId: 'kitchen-pantry',
						depth: 'back',
						description: 'Numbered pantry doors and an honest, nearly empty grain gauge.'
					},
					{
						layerId: 'kitchen-hearth-layer',
						depth: 'mid',
						description: 'A stone hearth, preparation counter, kettles, and the communal table.'
					},
					{
						layerId: 'kitchen-service',
						depth: 'front',
						description: 'Serving bowls, worn benches, and a passage kept clear for working hands.'
					}
				]
			}
		},
		{
			buildingId: 'dormitory',
			kind: 'dormitory',
			label: 'North Dormitory',
			shortLabel: 'Dormitory',
			summary: 'Beds, recovery, and the fragile boundary between communal safety and privacy.',
			entranceNodeId: 'dormitory-entry',
			systemId: 'dormitory-system',
			interactions: ['sleep', 'rest', 'privacy'],
			simulationEffects: ['fatigue', 'recovery', 'roommate-contact'],
			interior: {
				focusNodeId: 'dormitory-bunks',
				nodeIds: ['dormitory-entry', 'dormitory-bunks', 'dormitory-nook'],
				camera: { x: 520, y: 410, zoom: 1.08 },
				ambientColor: '#8ea2c7',
				caption: 'Curtains offer privacy by convention, not by force.',
				layers: [
					{
						layerId: 'dormitory-windows',
						depth: 'back',
						description:
							'Narrow wall windows, reserve-power pipes, and a shelf of blank name plates.'
					},
					{
						layerId: 'dormitory-beds',
						depth: 'mid',
						description: 'Six curtained bunks, footlockers, and one recovery cot near the stove.'
					},
					{
						layerId: 'dormitory-nook-layer',
						depth: 'front',
						description:
							'A quiet chair, wash basin, and threshold where conversations can be refused.'
					}
				]
			}
		},
		{
			buildingId: 'training-ground',
			kind: 'training-ground',
			label: 'Training Court',
			shortLabel: 'Training',
			summary:
				'A marked court where skill, teaching, habits, hierarchy, and injury become visible.',
			entranceNodeId: 'training-entry',
			systemId: 'training-system',
			interactions: ['practice', 'teach', 'spar'],
			simulationEffects: ['skill-progress', 'injury-risk', 'habit-reinforcement'],
			interior: {
				focusNodeId: 'training-ring',
				nodeIds: ['training-entry', 'training-ring', 'training-rack'],
				camera: { x: 500, y: 460, zoom: 0.96 },
				ambientColor: '#c88464',
				caption: 'The open ring makes effort legible and excuses difficult to hide.',
				layers: [
					{
						layerId: 'training-wall',
						depth: 'back',
						description:
							'A repaired wall, bell rope, distance marks, and the tower’s permanent silhouette.'
					},
					{
						layerId: 'training-ring-layer',
						depth: 'mid',
						description: 'Sand ring, practice posts, bow lane, and a chalk lesson board.'
					},
					{
						layerId: 'training-rack-layer',
						depth: 'front',
						description: 'Blunted weapons, wraps, water jars, and the injury ledger stand.'
					}
				]
			}
		},
		{
			buildingId: 'workshop',
			kind: 'workshop',
			label: 'Dormant Workshop',
			shortLabel: 'Workshop',
			summary:
				'Repair benches and a silent forge waiting for a system the settlement cannot yet spare.',
			entranceNodeId: 'workshop-entry',
			systemId: 'forge-system',
			interactions: ['repair', 'craft', 'inspect-equipment'],
			simulationEffects: ['durability', 'equipment-upgrades', 'resource-ledger'],
			interior: {
				focusNodeId: 'workshop-bench',
				nodeIds: ['workshop-entry', 'workshop-bench', 'workshop-forge'],
				camera: { x: 525, y: 440, zoom: 1.02 },
				ambientColor: '#b36f54',
				caption: 'Hand tools still work; the forge does not.',
				layers: [
					{
						layerId: 'workshop-flue',
						depth: 'back',
						description: 'A cold flue, ore bins, and a locked power relay with one empty socket.'
					},
					{
						layerId: 'workshop-benches',
						depth: 'mid',
						description: 'Repair bench, vise, hand drill, and the dormant forge mouth.'
					},
					{
						layerId: 'workshop-tools',
						depth: 'front',
						description: 'Sorted tools, salvage trays, and tagged equipment awaiting owners.'
					}
				]
			}
		}
	],
	nodes: [
		{
			nodeId: 'gate-court',
			label: 'Gate court',
			kind: 'entrance',
			buildingId: 'summoning-gate',
			capacity: 12,
			mapPosition: { x: 800, y: 205 },
			interiorPosition: { x: 500, y: 760 },
			interactionTags: ['first-meeting']
		},
		{
			nodeId: 'gate-dais',
			label: 'Summoning dais',
			kind: 'gate',
			buildingId: 'summoning-gate',
			capacity: 6,
			mapPosition: { x: 800, y: 115 },
			interiorPosition: { x: 500, y: 390 },
			interactionTags: ['summon', 'inspect']
		},
		{
			nodeId: 'gate-rail',
			label: 'Witness rail',
			kind: 'social',
			buildingId: 'summoning-gate',
			capacity: 8,
			mapPosition: { x: 745, y: 245 },
			interiorPosition: { x: 300, y: 600 },
			interactionTags: ['first-meeting']
		},
		{
			nodeId: 'courtyard-heart',
			label: 'Courtyard heart',
			kind: 'courtyard',
			buildingId: null,
			capacity: 24,
			mapPosition: { x: 800, y: 490 },
			interiorPosition: null,
			interactionTags: []
		},
		{
			nodeId: 'cistern-steps',
			label: 'Cistern steps',
			kind: 'social',
			buildingId: null,
			capacity: 8,
			mapPosition: { x: 680, y: 565 },
			interiorPosition: null,
			interactionTags: []
		},
		{
			nodeId: 'wall-overlook',
			label: 'Wall overlook',
			kind: 'social',
			buildingId: null,
			capacity: 4,
			mapPosition: { x: 925, y: 585 },
			interiorPosition: null,
			interactionTags: ['inspect']
		},
		{
			nodeId: 'kitchen-entry',
			label: 'Kitchen threshold',
			kind: 'entrance',
			buildingId: 'kitchen',
			capacity: 8,
			mapPosition: { x: 410, y: 360 },
			interiorPosition: { x: 850, y: 690 },
			interactionTags: ['assign']
		},
		{
			nodeId: 'kitchen-hearth',
			label: 'Cooking hearth',
			kind: 'station',
			buildingId: 'kitchen',
			capacity: 3,
			mapPosition: { x: 300, y: 405 },
			interiorPosition: { x: 285, y: 420 },
			interactionTags: ['cook']
		},
		{
			nodeId: 'kitchen-table',
			label: 'Common table',
			kind: 'social',
			buildingId: 'kitchen',
			capacity: 10,
			mapPosition: { x: 470, y: 445 },
			interiorPosition: { x: 570, y: 520 },
			interactionTags: ['eat', 'shared-meal']
		},
		{
			nodeId: 'dormitory-entry',
			label: 'Dormitory threshold',
			kind: 'entrance',
			buildingId: 'dormitory',
			capacity: 6,
			mapPosition: { x: 350, y: 665 },
			interiorPosition: { x: 840, y: 700 },
			interactionTags: []
		},
		{
			nodeId: 'dormitory-bunks',
			label: 'Curtained bunks',
			kind: 'bed',
			buildingId: 'dormitory',
			capacity: 6,
			mapPosition: { x: 235, y: 705 },
			interiorPosition: { x: 350, y: 390 },
			interactionTags: ['sleep', 'rest']
		},
		{
			nodeId: 'dormitory-nook',
			label: 'Quiet nook',
			kind: 'room',
			buildingId: 'dormitory',
			capacity: 2,
			mapPosition: { x: 450, y: 735 },
			interiorPosition: { x: 665, y: 500 },
			interactionTags: ['privacy']
		},
		{
			nodeId: 'training-entry',
			label: 'Training threshold',
			kind: 'entrance',
			buildingId: 'training-ground',
			capacity: 10,
			mapPosition: { x: 1085, y: 660 },
			interiorPosition: { x: 180, y: 700 },
			interactionTags: []
		},
		{
			nodeId: 'training-ring',
			label: 'Practice ring',
			kind: 'station',
			buildingId: 'training-ground',
			capacity: 8,
			mapPosition: { x: 1220, y: 700 },
			interiorPosition: { x: 525, y: 440 },
			interactionTags: ['practice', 'teach', 'spar']
		},
		{
			nodeId: 'training-rack',
			label: 'Practice rack',
			kind: 'station',
			buildingId: 'training-ground',
			capacity: 3,
			mapPosition: { x: 1025, y: 750 },
			interiorPosition: { x: 760, y: 560 },
			interactionTags: ['inspect-equipment']
		},
		{
			nodeId: 'workshop-entry',
			label: 'Workshop threshold',
			kind: 'entrance',
			buildingId: 'workshop',
			capacity: 6,
			mapPosition: { x: 1190, y: 355 },
			interiorPosition: { x: 165, y: 700 },
			interactionTags: ['inspect-equipment']
		},
		{
			nodeId: 'workshop-bench',
			label: 'Repair bench',
			kind: 'station',
			buildingId: 'workshop',
			capacity: 3,
			mapPosition: { x: 1315, y: 425 },
			interiorPosition: { x: 510, y: 505 },
			interactionTags: ['repair', 'inspect-equipment']
		},
		{
			nodeId: 'workshop-forge',
			label: 'Dormant forge',
			kind: 'station',
			buildingId: 'workshop',
			capacity: 2,
			mapPosition: { x: 1280, y: 285 },
			interiorPosition: { x: 750, y: 340 },
			interactionTags: ['craft']
		}
	],
	edges: [
		{
			edgeId: 'gate-dais-to-court',
			fromNodeId: 'gate-dais',
			toNodeId: 'gate-court',
			bidirectional: true,
			travelGameSeconds: 15,
			capacity: 6,
			access: systemAccess('gate-system'),
			visualPath: [
				{ x: 800, y: 115 },
				{ x: 800, y: 160 },
				{ x: 800, y: 205 }
			]
		},
		{
			edgeId: 'gate-court-to-rail',
			fromNodeId: 'gate-court',
			toNodeId: 'gate-rail',
			bidirectional: true,
			travelGameSeconds: 8,
			capacity: 6,
			access: openAccess,
			visualPath: [
				{ x: 800, y: 205 },
				{ x: 775, y: 225 },
				{ x: 745, y: 245 }
			]
		},
		{
			edgeId: 'gate-court-to-heart',
			fromNodeId: 'gate-court',
			toNodeId: 'courtyard-heart',
			bidirectional: true,
			travelGameSeconds: 45,
			capacity: 12,
			access: openAccess,
			visualPath: [
				{ x: 800, y: 205 },
				{ x: 800, y: 345 },
				{ x: 800, y: 490 }
			]
		},
		{
			edgeId: 'heart-to-kitchen',
			fromNodeId: 'courtyard-heart',
			toNodeId: 'kitchen-entry',
			bidirectional: true,
			travelGameSeconds: 55,
			capacity: 10,
			access: openAccess,
			visualPath: [
				{ x: 800, y: 490 },
				{ x: 620, y: 440 },
				{ x: 410, y: 360 }
			]
		},
		{
			edgeId: 'heart-to-dormitory',
			fromNodeId: 'courtyard-heart',
			toNodeId: 'dormitory-entry',
			bidirectional: true,
			travelGameSeconds: 65,
			capacity: 8,
			access: openAccess,
			visualPath: [
				{ x: 800, y: 490 },
				{ x: 600, y: 575 },
				{ x: 350, y: 665 }
			]
		},
		{
			edgeId: 'heart-to-training',
			fromNodeId: 'courtyard-heart',
			toNodeId: 'training-entry',
			bidirectional: true,
			travelGameSeconds: 52,
			capacity: 10,
			access: openAccess,
			visualPath: [
				{ x: 800, y: 490 },
				{ x: 940, y: 565 },
				{ x: 1085, y: 660 }
			]
		},
		{
			edgeId: 'heart-to-workshop',
			fromNodeId: 'courtyard-heart',
			toNodeId: 'workshop-entry',
			bidirectional: true,
			travelGameSeconds: 58,
			capacity: 8,
			access: openAccess,
			visualPath: [
				{ x: 800, y: 490 },
				{ x: 985, y: 435 },
				{ x: 1190, y: 355 }
			]
		},
		{
			edgeId: 'heart-to-cistern',
			fromNodeId: 'courtyard-heart',
			toNodeId: 'cistern-steps',
			bidirectional: true,
			travelGameSeconds: 18,
			capacity: 8,
			access: openAccess,
			visualPath: [
				{ x: 800, y: 490 },
				{ x: 740, y: 530 },
				{ x: 680, y: 565 }
			]
		},
		{
			edgeId: 'heart-to-overlook',
			fromNodeId: 'courtyard-heart',
			toNodeId: 'wall-overlook',
			bidirectional: true,
			travelGameSeconds: 22,
			capacity: 4,
			access: openAccess,
			visualPath: [
				{ x: 800, y: 490 },
				{ x: 865, y: 535 },
				{ x: 925, y: 585 }
			]
		},
		{
			edgeId: 'kitchen-entry-to-hearth',
			fromNodeId: 'kitchen-entry',
			toNodeId: 'kitchen-hearth',
			bidirectional: true,
			travelGameSeconds: 12,
			capacity: 3,
			access: systemAccess('hearth-system'),
			visualPath: [
				{ x: 410, y: 360 },
				{ x: 355, y: 382 },
				{ x: 300, y: 405 }
			]
		},
		{
			edgeId: 'kitchen-entry-to-table',
			fromNodeId: 'kitchen-entry',
			toNodeId: 'kitchen-table',
			bidirectional: true,
			travelGameSeconds: 9,
			capacity: 8,
			access: openAccess,
			visualPath: [
				{ x: 410, y: 360 },
				{ x: 440, y: 400 },
				{ x: 470, y: 445 }
			]
		},
		{
			edgeId: 'dormitory-entry-to-bunks',
			fromNodeId: 'dormitory-entry',
			toNodeId: 'dormitory-bunks',
			bidirectional: true,
			travelGameSeconds: 10,
			capacity: 6,
			access: openAccess,
			visualPath: [
				{ x: 350, y: 665 },
				{ x: 290, y: 685 },
				{ x: 235, y: 705 }
			]
		},
		{
			edgeId: 'dormitory-entry-to-nook',
			fromNodeId: 'dormitory-entry',
			toNodeId: 'dormitory-nook',
			bidirectional: true,
			travelGameSeconds: 11,
			capacity: 2,
			access: openAccess,
			visualPath: [
				{ x: 350, y: 665 },
				{ x: 400, y: 700 },
				{ x: 450, y: 735 }
			]
		},
		{
			edgeId: 'training-entry-to-ring',
			fromNodeId: 'training-entry',
			toNodeId: 'training-ring',
			bidirectional: true,
			travelGameSeconds: 14,
			capacity: 8,
			access: openAccess,
			visualPath: [
				{ x: 1085, y: 660 },
				{ x: 1150, y: 680 },
				{ x: 1220, y: 700 }
			]
		},
		{
			edgeId: 'training-entry-to-rack',
			fromNodeId: 'training-entry',
			toNodeId: 'training-rack',
			bidirectional: true,
			travelGameSeconds: 8,
			capacity: 3,
			access: openAccess,
			visualPath: [
				{ x: 1085, y: 660 },
				{ x: 1055, y: 705 },
				{ x: 1025, y: 750 }
			]
		},
		{
			edgeId: 'workshop-entry-to-bench',
			fromNodeId: 'workshop-entry',
			toNodeId: 'workshop-bench',
			bidirectional: true,
			travelGameSeconds: 12,
			capacity: 3,
			access: openAccess,
			visualPath: [
				{ x: 1190, y: 355 },
				{ x: 1250, y: 390 },
				{ x: 1315, y: 425 }
			]
		},
		{
			edgeId: 'workshop-bench-to-forge',
			fromNodeId: 'workshop-bench',
			toNodeId: 'workshop-forge',
			bidirectional: true,
			travelGameSeconds: 10,
			capacity: 2,
			access: systemAccess('forge-system'),
			visualPath: [
				{ x: 1315, y: 425 },
				{ x: 1300, y: 355 },
				{ x: 1280, y: 285 }
			]
		}
	],
	contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9'
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

export async function calculateSettlementContentHash(
	definition: SettlementDefinition
): Promise<string> {
	const payload: Partial<SettlementDefinition> = { ...definition };
	delete payload.contentHash;
	const bytes = new TextEncoder().encode(canonicalJson(payload));
	const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

let verifiedDefinition: Promise<SettlementDefinition> | undefined;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export function loadHearth01(): Promise<SettlementDefinition> {
	verifiedDefinition ??= (async () => {
		const definition = SettlementDefinitionSchema.parse(source);
		const contentHash = await calculateSettlementContentHash(definition);
		if (contentHash !== definition.contentHash) {
			throw new Error(
				`Hearth 01 content hash drifted: expected ${definition.contentHash}, calculated ${contentHash}`
			);
		}
		return deepFreeze(definition);
	})();
	return verifiedDefinition;
}

function canTraverse(edge: SettlementRouteEdge, activeSystemIds: ReadonlySet<string>): boolean {
	return edge.access.kind === 'open' || activeSystemIds.has(edge.access.systemId);
}

export function planSettlementRoute(
	definition: SettlementDefinition,
	fromNodeId: string,
	toNodeId: string,
	activeSystemIds: ReadonlySet<string> = new Set()
): SettlementRoutePlan | null {
	const nodeIds = new Set(definition.nodes.map((node) => node.nodeId));
	if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId)) return null;
	if (fromNodeId === toNodeId) {
		const node = definition.nodes.find((candidate) => candidate.nodeId === fromNodeId)!;
		return SettlementRoutePlanSchema.parse({
			fromNodeId,
			toNodeId,
			nodeIds: [fromNodeId],
			steps: [],
			totalTravelGameSeconds: 0,
			bottleneckCapacity: node.capacity
		});
	}

	type Candidate = {
		nodeId: string;
		total: number;
		steps: SettlementRoutePlan['steps'];
		nodes: string[];
		capacity: number;
	};
	const pending: Candidate[] = [
		{
			nodeId: fromNodeId,
			total: 0,
			steps: [],
			nodes: [fromNodeId],
			capacity: definition.nodes.find((node) => node.nodeId === fromNodeId)!.capacity
		}
	];
	const best = new Map<string, number>();

	while (pending.length > 0) {
		pending.sort(
			(left, right) => left.total - right.total || left.nodeId.localeCompare(right.nodeId)
		);
		const current = pending.shift()!;
		if ((best.get(current.nodeId) ?? Number.POSITIVE_INFINITY) <= current.total) continue;
		best.set(current.nodeId, current.total);
		if (current.nodeId === toNodeId) {
			return SettlementRoutePlanSchema.parse({
				fromNodeId,
				toNodeId,
				nodeIds: current.nodes,
				steps: current.steps,
				totalTravelGameSeconds: current.total,
				bottleneckCapacity: current.capacity
			});
		}

		for (const edge of definition.edges
			.filter(
				(candidate) =>
					canTraverse(candidate, activeSystemIds) &&
					(candidate.fromNodeId === current.nodeId ||
						(candidate.bidirectional && candidate.toNodeId === current.nodeId))
			)
			.sort((left, right) => left.edgeId.localeCompare(right.edgeId))) {
			const forward = edge.fromNodeId === current.nodeId;
			const nextNodeId = forward ? edge.toNodeId : edge.fromNodeId;
			const nextNode = definition.nodes.find((node) => node.nodeId === nextNodeId)!;
			const total = current.total + edge.travelGameSeconds;
			if ((best.get(nextNodeId) ?? Number.POSITIVE_INFINITY) <= total) continue;
			pending.push({
				nodeId: nextNodeId,
				total,
				steps: [
					...current.steps,
					{
						edgeId: edge.edgeId,
						fromNodeId: current.nodeId,
						toNodeId: nextNodeId,
						travelGameSeconds: edge.travelGameSeconds
					}
				],
				nodes: [...current.nodes, nextNodeId],
				capacity: Math.min(current.capacity, edge.capacity, nextNode.capacity)
			});
		}
	}

	return null;
}

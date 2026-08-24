import { loadHearth01, planSettlementRoute } from '../packages/content/src/index.js';

const definition = await loadHearth01();
const reserveSystems = new Set(['gate-system']);
const entranceRoutes = definition.buildings.map((building) => {
	const route = planSettlementRoute(
		definition,
		definition.spawnNodeId,
		building.entranceNodeId,
		reserveSystems
	);
	if (!route) throw new Error(`Hearth 01 entrance is unreachable: ${building.buildingId}`);
	return route;
});

process.stdout.write(
	`${JSON.stringify(
		{
			contentVersion: definition.contentVersion,
			contentHash: definition.contentHash,
			buildingCount: definition.buildings.length,
			interiorCount: definition.buildings.length,
			nodeCount: definition.nodes.length,
			edgeCount: definition.edges.length,
			entranceRouteCount: entranceRoutes.length,
			maximumEntranceTravelGameSeconds: Math.max(
				...entranceRoutes.map((route) => route.totalTravelGameSeconds)
			)
		},
		null,
		2
	)}\n`
);

import { SettlementDefinitionSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { calculateSettlementContentHash, loadHearth01, planSettlementRoute } from './hearth-01.js';

describe('Hearth 01 settlement content', () => {
	it('verifies a connected five-building definition against its exact content hash', async () => {
		const definition = await loadHearth01();

		expect(definition.buildings.map((building) => building.kind)).toEqual([
			'summoning-gate',
			'kitchen',
			'dormitory',
			'training-ground',
			'workshop'
		]);
		expect(definition.nodes).toHaveLength(18);
		expect(definition.edges).toHaveLength(17);
		expect(await calculateSettlementContentHash(definition)).toBe(definition.contentHash);
		expect(Object.isFrozen(definition)).toBe(true);
		expect(Object.isFrozen(definition.buildings[0])).toBe(true);
		for (const building of definition.buildings) {
			expect(building.interior.layers.map((layer) => layer.depth)).toEqual([
				'back',
				'mid',
				'front'
			]);
		}
	});

	it('plans deterministic authored travel and respects system access', async () => {
		const definition = await loadHearth01();
		const reserveSystems = new Set(['gate-system']);
		const allSystems = new Set(definition.buildings.map((building) => building.systemId));

		for (const building of definition.buildings) {
			const route = planSettlementRoute(
				definition,
				definition.spawnNodeId,
				building.entranceNodeId,
				reserveSystems
			);
			expect(route?.toNodeId).toBe(building.entranceNodeId);
		}
		const tableRoute = planSettlementRoute(
			definition,
			definition.spawnNodeId,
			'kitchen-table',
			reserveSystems
		);
		expect(tableRoute).toMatchObject({
			totalTravelGameSeconds: 124,
			bottleneckCapacity: 6,
			nodeIds: ['gate-dais', 'gate-court', 'courtyard-heart', 'kitchen-entry', 'kitchen-table']
		});
		expect(
			planSettlementRoute(definition, definition.spawnNodeId, 'workshop-forge', reserveSystems)
		).toBeNull();
		expect(
			planSettlementRoute(definition, definition.spawnNodeId, 'workshop-forge', allSystems)
		)?.toMatchObject({ totalTravelGameSeconds: 140, bottleneckCapacity: 2 });
	});

	it('rejects content drift and visual paths that no longer meet their nodes', async () => {
		const definition = await loadHearth01();
		const changed = SettlementDefinitionSchema.parse({
			...definition,
			tagline: `${definition.tagline} Changed.`
		});
		expect(await calculateSettlementContentHash(changed)).not.toBe(definition.contentHash);

		const invalid = structuredClone(definition);
		invalid.edges[0]!.visualPath[0] = { x: 0, y: 0 };
		expect(SettlementDefinitionSchema.safeParse(invalid).success).toBe(false);
	});
});

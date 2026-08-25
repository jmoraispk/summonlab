import { MissionPackageSchema, type MissionArenaKnowledge } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	applyMissionDiscoveryAffordance,
	calculateMissionContentHash,
	listLegalMissionDiscoveryAffordances,
	loadTowerFloor01,
	planMissionRoute,
	projectMissionArenaKnowledge,
	visitMissionNode
} from './tower-floor-01.js';

const initialKnowledge: MissionArenaKnowledge = {
	discoveryIds: [],
	visitedNodeIds: ['tower-threshold']
};

describe('Tower Floor 01 mission package', () => {
	it('verifies a complete immutable mission package against its content hash', async () => {
		const mission = await loadTowerFloor01();

		expect(mission).toMatchObject({
			schemaVersion: 'mission-package-v1',
			contentVersion: 'tower-floor-01-v1',
			missionId: 'tower-floor-01',
			kind: 'tower-floor',
			tower: { floor: 1, band: 1, floorInBand: 1 },
			deployment: { minimumPartyMembers: 1, maximumPartyMembers: 5, masterRequired: true }
		});
		expect(mission.objectives).toHaveLength(1);
		expect(mission.arena.nodes).toHaveLength(7);
		expect(mission.arena.edges).toHaveLength(8);
		expect(mission.arena.discoveries).toHaveLength(3);
		expect(mission.arena.discoveryAffordances).toHaveLength(3);
		expect(mission.story.anchors).toHaveLength(5);
		expect(await calculateMissionContentHash(mission)).toBe(mission.contentHash);
		expect(Object.isFrozen(mission)).toBe(true);
		expect(Object.isFrozen(mission.arena.nodes[0])).toBe(true);
	});

	it('projects only known topology and observations actually witnessed on entry', async () => {
		const mission = await loadTowerFloor01();
		const projection = projectMissionArenaKnowledge(mission, initialKnowledge);

		expect(projection.nodeIds).toEqual([
			'tower-threshold',
			'oath-hall',
			'shattered-gallery',
			'chain-court',
			'ember-vault'
		]);
		expect(projection.edgeIds).toEqual([
			'threshold-to-oath-hall',
			'oath-hall-to-gallery',
			'gallery-to-chain-court',
			'chain-court-to-vault'
		]);
		expect(projection.observationIds).toEqual(['threshold-seal-observation']);
		expect(listLegalMissionDiscoveryAffordances(mission, 'oath-hall', initialKnowledge)).toEqual(
			[]
		);

		expect(
			planMissionRoute(mission, 'tower-threshold', 'ember-vault', initialKnowledge)
		).toMatchObject({
			nodeIds: ['tower-threshold', 'oath-hall', 'shattered-gallery', 'chain-court', 'ember-vault'],
			totalTraversalActions: 4,
			maximumExposure: 'exposed'
		});
		expect(planMissionRoute(mission, 'tower-threshold', 'ash-duct', initialKnowledge)).toBeNull();
	});

	it('reveals a shorter route only through a legal local affordance', async () => {
		const mission = await loadTowerFloor01();
		const atOathHall = visitMissionNode(mission, 'oath-hall', initialKnowledge);
		const legal = listLegalMissionDiscoveryAffordances(mission, 'oath-hall', atOathHall);

		expect(legal.map((affordance) => affordance.affordanceId)).toEqual([
			'inspect-soot-seam',
			'read-muster-tablet'
		]);
		const discovered = applyMissionDiscoveryAffordance(mission, 'inspect-soot-seam', atOathHall);
		const projection = projectMissionArenaKnowledge(mission, discovered);
		expect(projection.nodeIds).toContain('ash-duct');
		expect(projection.edgeIds).toEqual(
			expect.arrayContaining(['oath-hall-to-ash-duct', 'ash-duct-to-vault'])
		);
		expect(projection.observationIds).toEqual(
			expect.arrayContaining(['oath-draft-observation', 'ash-duct-mark-observation'])
		);
		expect(
			listLegalMissionDiscoveryAffordances(mission, 'oath-hall', discovered).map(
				(affordance) => affordance.affordanceId
			)
		).toEqual(['read-muster-tablet']);
		expect(planMissionRoute(mission, 'tower-threshold', 'ember-vault', discovered)).toMatchObject({
			nodeIds: ['tower-threshold', 'oath-hall', 'ash-duct', 'ember-vault'],
			totalTraversalActions: 3,
			maximumExposure: 'low'
		});
	});

	it('rejects omniscient visits, repeated discoveries, and unknown knowledge', async () => {
		const mission = await loadTowerFloor01();

		expect(() => visitMissionNode(mission, 'ash-duct', initialKnowledge)).toThrow(
			'Mission node is not known'
		);
		expect(() =>
			applyMissionDiscoveryAffordance(mission, 'inspect-soot-seam', initialKnowledge)
		).toThrow('Mission discovery affordance is not legal');
		expect(() =>
			projectMissionArenaKnowledge(mission, {
				discoveryIds: ['invented-secret'],
				visitedNodeIds: ['tower-threshold']
			})
		).toThrow('Unknown mission discovery');

		const atOathHall = visitMissionNode(mission, 'oath-hall', initialKnowledge);
		const discovered = applyMissionDiscoveryAffordance(mission, 'inspect-soot-seam', atOathHall);
		expect(() => applyMissionDiscoveryAffordance(mission, 'inspect-soot-seam', discovered)).toThrow(
			'Mission discovery affordance is not legal'
		);
	});

	it('rejects topology leaks, missing default routes, and story proposals that rewrite anchors', async () => {
		const mission = await loadTowerFloor01();

		const leaking = structuredClone(mission);
		leaking.arena.edges.find((edge) => edge.edgeId === 'oath-hall-to-ash-duct')!.access = {
			kind: 'open',
			discoveryId: null
		};
		expect(MissionPackageSchema.safeParse(leaking).success).toBe(false);

		const blockedObjective = structuredClone(mission);
		blockedObjective.arena.edges.find((edge) => edge.edgeId === 'chain-court-to-vault')!.access = {
			kind: 'requires-discovery',
			discoveryId: 'soot-seam-route'
		};
		expect(MissionPackageSchema.safeParse(blockedObjective).success).toBe(false);

		const anchorRewrite = structuredClone(mission);
		anchorRewrite.story.proposalCatalog[0]!.beatId = 'lift-the-first-ember';
		expect(MissionPackageSchema.safeParse(anchorRewrite).success).toBe(false);
	});
});

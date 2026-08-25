import { PortalMissionPackageSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	IRON_MOON_PACKAGE,
	calculatePortalMissionContentHash,
	loadIronMoonMission
} from './iron-moon.js';
import {
	applyMissionDiscoveryAffordance,
	calculateMissionContentHash,
	listLegalMissionDiscoveryAffordances,
	planMissionRoute,
	visitMissionNode
} from './tower-floor-01.js';

describe('Iron Moon portal mission package', () => {
	it('binds an eight-round portal, finite deposits, quota, and collapse policy', async () => {
		const portalPackage = await loadIronMoonMission();
		expect(portalPackage).toMatchObject({
			schemaVersion: 'portal-mission-package-v1',
			contentVersion: 'iron-moon-v1',
			missionId: 'iron-moon',
			mission: { kind: 'portal-world', tower: null },
			portal: {
				durationRounds: 8,
				warningAtRemainingRounds: 4,
				criticalAtRemainingRounds: 2,
				extractionQuota: 4,
				cargoCapacityPerActor: 4,
				collapse: { failureRule: 'timer-expired', cargoDisposition: 'lost' }
			}
		});
		expect(portalPackage.portal.deposits.map((deposit) => deposit.initialAmount)).toEqual([
			2, 4, 6
		]);
		expect(await calculateMissionContentHash(portalPackage.mission)).toBe(
			portalPackage.mission.contentHash
		);
		expect(await calculatePortalMissionContentHash(portalPackage)).toBe(portalPackage.contentHash);
		expect(Object.isFrozen(portalPackage)).toBe(true);
		expect(Object.isFrozen(portalPackage.portal.deposits[0])).toBe(true);
	});

	it('keeps the rescue seam concealed until a visited local affordance reveals it', async () => {
		const { mission } = await loadIronMoonMission();
		const initial = { discoveryIds: [], visitedNodeIds: ['moon-gate'] };
		expect(planMissionRoute(mission, 'moon-gate', 'pale-vein', initial)).toMatchObject({
			nodeIds: ['moon-gate', 'windward-shelf', 'pale-vein'],
			totalTraversalActions: 2
		});
		expect(planMissionRoute(mission, 'moon-gate', 'buried-seam', initial)).toBeNull();

		const atShelf = visitMissionNode(mission, 'windward-shelf', initial);
		const atCrater = visitMissionNode(mission, 'crater-heart', atShelf);
		expect(
			listLegalMissionDiscoveryAffordances(mission, 'crater-heart', atCrater).map(
				(affordance) => affordance.affordanceId
			)
		).toEqual(['listen-for-buried-seam']);
		const revealed = applyMissionDiscoveryAffordance(mission, 'listen-for-buried-seam', atCrater);
		expect(planMissionRoute(mission, 'crater-heart', 'buried-seam', revealed)).toMatchObject({
			nodeIds: ['crater-heart', 'buried-seam'],
			totalTraversalActions: 1,
			maximumExposure: 'low'
		});
	});

	it('rejects impossible quotas and deposits outside objective nodes', () => {
		const impossible = structuredClone(IRON_MOON_PACKAGE);
		impossible.portal.extractionQuota = 99;
		expect(PortalMissionPackageSchema.safeParse(impossible).success).toBe(false);

		const misplaced = structuredClone(IRON_MOON_PACKAGE);
		misplaced.portal.deposits[0]!.nodeId = 'windward-shelf';
		expect(PortalMissionPackageSchema.safeParse(misplaced).success).toBe(false);
	});
});

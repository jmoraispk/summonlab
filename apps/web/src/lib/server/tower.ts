import { TOWER_FLOOR_01_EXPLORATION, loadTowerBand01 } from '@summonlab/content';
import type { MissionPackage } from '@summonlab/contracts';
import type { PersistedExplorationAttempt } from '@summonlab/database';
import { getLatestExplorationAttemptForRun } from '@summonlab/database';
import {
	legalExplorationSteps,
	projectExplorationWindow,
	safeExplorationDestinations
} from '@summonlab/engine/exploration';

import type { TowerFloorView, TowerView } from '$lib/city';

function titleCase(value: string): string {
	return value
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function projectFloor(
	mission: MissionPackage,
	attempt: PersistedExplorationAttempt | null
): TowerFloorView {
	const floorNumber = mission.tower?.floor ?? 0;
	const isCurrent = attempt?.state.floorId === mission.missionId;
	const cleared = isCurrent && attempt.state.status === 'extracted';
	const status =
		isCurrent && !cleared
			? 'active'
			: cleared
				? 'cleared'
				: floorNumber === 1
					? 'available'
					: 'locked';
	return {
		floorId: mission.missionId,
		floorNumber,
		name: mission.displayName,
		tagline: mission.tagline,
		objective:
			mission.objectives.find((objective) => objective.primary)?.title ??
			mission.objectives[0]!.title,
		knownMonsters: mission.monsterDuties.map((duty) => titleCase(duty.dutySlotId)),
		rewards: mission.rewards.grants.map((grant) => `${titleCase(grant.key)} ×${grant.amount}`),
		status,
		lockReason:
			status === 'locked' ? `Clear Floor ${String(floorNumber - 1).padStart(2, '0')} first.` : null
	};
}

function projectExploration(attempt: PersistedExplorationAttempt) {
	const window = projectExplorationWindow(TOWER_FLOOR_01_EXPLORATION, attempt.state);
	return {
		attemptId: attempt.state.attemptId,
		floorId: attempt.state.floorId,
		floorName: TOWER_FLOOR_01_EXPLORATION.displayName,
		version: attempt.state.version,
		positionTileId: window.positionTileId,
		partyHeroIds: attempt.state.partyHeroIds,
		columns: window.columns,
		rows: window.rows,
		revealedCount: window.revealedCount,
		objectiveComplete: attempt.state.objectiveComplete,
		pendingLoot: attempt.state.pendingLoot,
		tiles: window.tiles.map((tile) => ({
			tileId: tile.tileId,
			row: tile.row,
			column: tile.column,
			knowledge: tile.knowledge,
			...('walkable' in tile
				? {
						walkable: tile.walkable,
						zoneLabel: tile.zoneLabel,
						interactionKind: tile.interaction?.kind ?? null
					}
				: {})
		}))
	};
}

export function projectTowerViewFromState(
	missions: readonly MissionPackage[],
	attempt: PersistedExplorationAttempt | null
): TowerView {
	const floors = missions.map((mission) => projectFloor(mission, attempt));
	if (!attempt) return { state: 'floor-list', floors };
	if (attempt.state.status === 'encounter') {
		return {
			state: 'encounter',
			floors,
			exploration: projectExploration(attempt),
			encounterRequestId: attempt.activeEncounter?.requestId ?? null,
			encounterRequest: attempt.activeEncounter?.request ?? null
		};
	}
	if (attempt.state.status === 'exploring' || attempt.state.status === 'returning') {
		return {
			state: 'exploration',
			floors,
			exploration: {
				...projectExploration(attempt),
				status: attempt.state.status,
				destinations: safeExplorationDestinations(TOWER_FLOOR_01_EXPLORATION, attempt.state),
				legalSteps: legalExplorationSteps(TOWER_FLOOR_01_EXPLORATION, attempt.state).map(
					(step) => ({ tileId: step.tileId, label: step.label })
				)
			}
		};
	}
	return {
		state: 'report',
		floors,
		outcome: attempt.state.status === 'defeated' ? 'defeat' : 'extracted',
		floorId: attempt.state.floorId,
		loot: attempt.state.pendingLoot
	};
}

export async function projectTowerView(input: {
	readonly databaseUrl: string;
	readonly runId: string;
}): Promise<TowerView> {
	const [missions, attempt] = await Promise.all([
		loadTowerBand01(),
		getLatestExplorationAttemptForRun(input.databaseUrl, input.runId)
	]);
	return projectTowerViewFromState(missions, attempt);
}

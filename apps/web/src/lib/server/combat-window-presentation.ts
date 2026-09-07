import type { CombatDecisionWindow } from '@summonlab/database';

export interface PublicCombatWindowStatus {
	readonly windowId: string;
	readonly status: CombatDecisionWindow['status'];
	readonly tick: number;
	readonly readyActors: number;
	readonly totalActors: number;
	readonly updatedAt: string;
}

export function projectCombatWindowStatus(window: CombatDecisionWindow): PublicCombatWindowStatus {
	return {
		windowId: window.windowId,
		status: window.status,
		tick: window.tick,
		readyActors: window.jobs.filter((job) => job.status === 'completed').length,
		totalActors: window.jobs.length,
		updatedAt: window.updatedAt
	};
}

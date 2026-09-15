import type { CityActionRequest, EngineCommand, EngineSnapshot } from '@summonlab/contracts';

export function cityActionCommand(
	snapshot: EngineSnapshot,
	request: CityActionRequest,
	commandId: string
): EngineCommand {
	if (!('settlement' in snapshot.state) || !('buildings' in snapshot.state.settlement)) {
		throw new Error('This history predates City facility assignments.');
	}
	const hero = snapshot.state.heroes[request.heroId];
	if (!hero) throw new Error('The requested resident does not belong to this run.');
	if (hero.lifeState !== 'active') throw new Error('The requested resident is not active.');

	const assignment =
		request.action === 'court-training'
			? ({ buildingId: 'training-ground', role: 'trainee' } as const)
			: ({ buildingId: 'dormitory', role: 'resident' } as const);

	return {
		commandId,
		runId: snapshot.state.runId,
		actorId: snapshot.state.master.masterId,
		expectedVersion: request.expectedVersion,
		correlationId: commandId,
		source: {
			source: 'manual',
			timing: 'step',
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		},
		commandType: 'settlement.assign.hero',
		heroId: request.heroId,
		...assignment
	};
}

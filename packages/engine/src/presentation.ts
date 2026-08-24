import {
	SettlementPresentationSchema,
	type EngineGameStateV5,
	type EngineGameStateV6,
	type EngineGameStateV7,
	type EngineSnapshot,
	type RoutineKind,
	type SettlementDefinition,
	type SettlementDayPhase,
	type SettlementPose,
	type SettlementPresentation
} from '@summonlab/contracts';

const GAME_EPOCH = Date.parse('2000-01-01T00:00:00.000Z');
const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

function clampedProgress(startedAt: string, completesAt: string, gameTime: string): number {
	const start = Date.parse(startedAt);
	const end = Date.parse(completesAt);
	if (end <= start) return 0;
	return Math.max(0, Math.min(0.98, (Date.parse(gameTime) - start) / (end - start)));
}

export function settlementDayPhase(minuteOfDay: number): SettlementDayPhase {
	if (minuteOfDay >= 5 * 60 && minuteOfDay < 8 * 60) return 'dawn';
	if (minuteOfDay >= 8 * 60 && minuteOfDay < 18 * 60) return 'day';
	if (minuteOfDay >= 18 * 60 && minuteOfDay < 21 * 60) return 'dusk';
	return 'night';
}

export function routineSettlementPose(kind: RoutineKind): SettlementPose {
	if (kind === 'sleep') return 'sleep';
	if (kind === 'meal' || kind === 'shares-breakfast') return 'eat';
	if (kind === 'stretches-at-dawn' || kind === 'practises-knots') return 'train';
	if (
		kind === 'assigned-duty' ||
		kind === 'checks-exits' ||
		kind === 'catalogues-tools' ||
		kind === 'walks-the-walls'
	)
		return 'work';
	return 'idle';
}

function activityPose(kind: 'train' | 'eat' | 'rest' | 'repair'): SettlementPose {
	if (kind === 'rest') return 'sleep';
	if (kind === 'repair') return 'work';
	return kind;
}

function readable(value: string): string {
	return value.replaceAll('-', ' ');
}

function poseForHero(
	hero: (EngineGameStateV5 | EngineGameStateV6 | EngineGameStateV7)['heroes'][string]
): {
	pose: SettlementPose;
	label: string;
} {
	if (hero.lifeState === 'dead') return { pose: 'dead', label: 'Fallen' };
	if (hero.health <= Math.ceil(hero.maxHealth * 0.2)) return { pose: 'downed', label: 'Injured' };
	if (hero.currentTravel)
		return { pose: 'walk', label: `Walking to ${readable(hero.currentTravel.toNodeId)}` };
	if (hero.currentActivity)
		return {
			pose: activityPose(hero.currentActivity.kind),
			label: readable(hero.currentActivity.kind)
		};
	if (hero.currentRoutine)
		return {
			pose: routineSettlementPose(hero.currentRoutine.kind),
			label: readable(hero.currentRoutine.kind)
		};
	return { pose: 'idle', label: hero.assignment ? readable(hero.assignment.role) : 'Unassigned' };
}

export function projectSettlementPresentation(
	snapshot: EngineSnapshot,
	definition: SettlementDefinition,
	projectedGameTime: string
): SettlementPresentation {
	const { state } = snapshot;
	if (state.schemaVersion !== 5 && state.schemaVersion !== 6 && state.schemaVersion !== 7) {
		throw new Error(
			`Settlement presentation requires engine-v5, engine-v6, or engine-v7, received v${state.schemaVersion}`
		);
	}
	const gameDate = new Date(projectedGameTime);
	if (Number.isNaN(gameDate.valueOf()))
		throw new Error(`Invalid projected game time: ${projectedGameTime}`);
	const minuteOfDay = gameDate.getUTCHours() * 60 + gameDate.getUTCMinutes();
	const dayIndex = Math.max(0, Math.floor((gameDate.valueOf() - GAME_EPOCH) / DAY_MILLISECONDS));
	const nodeBuilding = new Map(definition.nodes.map((node) => [node.nodeId, node.buildingId]));
	const occupants = Object.values(state.heroes)
		.filter((hero) => hero.lifeState !== 'synthesized')
		.sort((left, right) => left.heroId.localeCompare(right.heroId))
		.map((hero) => {
			const presentation = poseForHero(hero);
			return {
				heroId: hero.heroId,
				lifeState: hero.lifeState,
				nodeId: hero.locationNodeId,
				buildingId: nodeBuilding.get(hero.locationNodeId) ?? null,
				pose: presentation.pose,
				activityLabel: presentation.label,
				travel: hero.currentTravel
					? {
							toNodeId: hero.currentTravel.toNodeId,
							routeNodeIds: hero.currentTravel.route.nodeIds,
							progress: clampedProgress(
								hero.currentTravel.startedAt,
								hero.currentTravel.arrivesAt,
								projectedGameTime
							),
							startedAt: hero.currentTravel.startedAt,
							arrivesAt: hero.currentTravel.arrivesAt
						}
					: null
			};
		});
	const buildings = Object.values(state.settlement.buildings)
		.sort((left, right) => left.buildingId.localeCompare(right.buildingId))
		.map((building) => ({
			buildingId: building.buildingId,
			powerState: building.powerState,
			assignmentCount: building.assignedHeroIds.length,
			assignmentCapacity: building.assignmentCapacity,
			occupantHeroIds: occupants
				.filter((occupant) => occupant.buildingId === building.buildingId)
				.map((occupant) => occupant.heroId)
		}));
	const social =
		state.schemaVersion === 7
			? Object.values(state.heroes)
					.filter((hero) => hero.lifeState !== 'synthesized')
					.sort((left, right) => left.heroId.localeCompare(right.heroId))
					.map((hero) => {
						const relationship = Object.values(state.society.relationships).find(
							(candidate) =>
								candidate.fromHeroId === hero.heroId &&
								candidate.toEntityId === state.master.masterId
						);
						const authority = Object.values(state.society.authority).find(
							(candidate) => candidate.observerHeroId === hero.heroId
						);
						const latestObservation = Object.values(state.society.observations)
							.filter((observation) => observation.observerHeroId === hero.heroId)
							.sort(
								(left, right) =>
									left.observedAt.localeCompare(right.observedAt) ||
									left.observationId.localeCompare(right.observationId)
							)
							.at(-1);
						const relationshipScore = relationship
							? relationship.dimensions.trust + relationship.dimensions.respect
							: 0;
						const relationshipTone =
							relationship &&
							(relationship.dimensions.resentment >= 8 || relationship.dimensions.trust <= -6)
								? ('guarded' as const)
								: relationshipScore >= 15
									? ('trusting' as const)
									: relationshipScore > 0
										? ('receptive' as const)
										: ('neutral' as const);
						const authorityScore = authority
							? authority.dimensions.competence +
								authority.dimensions.provision +
								authority.dimensions.trust +
								authority.dimensions.legitimacy
							: 0;
						const authorityStanding =
							authority && authority.dimensions.legitimacy <= -5
								? ('contested' as const)
								: authorityScore >= 20
									? ('recognized' as const)
									: authorityScore > 0
										? ('provisional' as const)
										: ('unrecognized' as const);
						return {
							heroId: hero.heroId,
							beliefCount: Object.values(state.society.beliefs).filter(
								(belief) => belief.holderHeroId === hero.heroId && belief.status === 'held'
							).length,
							latestObservation: latestObservation
								? {
										kind: latestObservation.kind,
										summary: latestObservation.summary,
										observedAt: latestObservation.observedAt
									}
								: null,
							relationshipToMaster: {
								tone: relationshipTone,
								latestEvidence: relationship?.evidence.at(-1)?.summary ?? null
							},
							authority: {
								standing: authorityStanding,
								latestEvidence: authority?.evidence.at(-1)?.summary ?? null
							},
							activePromiseTerms: Object.values(state.society.promises)
								.filter(
									(promise) =>
										promise.status === 'active' && promise.promiseeHeroIds.includes(hero.heroId)
								)
								.map((promise) => promise.terms)
						};
					})
			: [];

	return SettlementPresentationSchema.parse({
		runId: state.runId,
		version: state.version,
		eventCursor: state.eventCursor,
		stateHash: snapshot.stateHash,
		gameTime: projectedGameTime,
		dayIndex,
		dayNumber: dayIndex + 1,
		minuteOfDay,
		dayPhase: settlementDayPhase(minuteOfDay),
		firstEmber:
			state.schemaVersion === 6 || state.schemaVersion === 7 ? state.settlement.firstEmber : null,
		buildings,
		occupants,
		social
	});
}

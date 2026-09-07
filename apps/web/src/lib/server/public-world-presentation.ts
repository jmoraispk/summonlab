import type { HeroConversationPresentation, SettlementPresentation } from '@summonlab/contracts';

import { hashPublicProjection } from './public-projection-hash';

export function projectSettlementForPublic(presentation: SettlementPresentation) {
	const publicFields = {
		runId: presentation.runId,
		version: presentation.version,
		eventCursor: presentation.eventCursor,
		gameTime: presentation.gameTime,
		dayIndex: presentation.dayIndex,
		dayNumber: presentation.dayNumber,
		minuteOfDay: presentation.minuteOfDay,
		dayPhase: presentation.dayPhase,
		firstEmber: presentation.firstEmber
			? {
					coreId: presentation.firstEmber.coreId,
					status: presentation.firstEmber.status,
					recoveredFrom: presentation.firstEmber.recoveredFrom,
					recoveredAt: presentation.firstEmber.recoveredAt,
					committedAt: presentation.firstEmber.committedAt,
					buildingId: presentation.firstEmber.buildingId,
					rationale: presentation.firstEmber.rationale,
					modifiers: presentation.firstEmber.modifiers.map((modifier) => ({
						key: modifier.key,
						amount: modifier.amount
					})),
					reactions: presentation.firstEmber.reactions.map((reaction) => ({
						heroId: reaction.heroId,
						stance: reaction.stance,
						score: reaction.score,
						summary: reaction.summary,
						factors: [...reaction.factors]
					}))
				}
			: null,
		buildings: presentation.buildings.map((building) => ({
			buildingId: building.buildingId,
			powerState: building.powerState,
			assignmentCount: building.assignmentCount,
			assignmentCapacity: building.assignmentCapacity,
			occupantHeroIds: [...building.occupantHeroIds]
		})),
		occupants: presentation.occupants.map((occupant) => ({
			heroId: occupant.heroId,
			lifeState: occupant.lifeState,
			nodeId: occupant.nodeId,
			buildingId: occupant.buildingId,
			pose: occupant.pose,
			activityLabel: occupant.activityLabel,
			travel: occupant.travel
				? {
						toNodeId: occupant.travel.toNodeId,
						routeNodeIds: [...occupant.travel.routeNodeIds],
						progress: occupant.travel.progress,
						startedAt: occupant.travel.startedAt,
						arrivesAt: occupant.travel.arrivesAt
					}
				: null
		})),
		social: presentation.social.map((entry) => ({
			heroId: entry.heroId,
			beliefCount: entry.beliefCount,
			latestObservation: entry.latestObservation
				? {
						kind: entry.latestObservation.kind,
						summary: entry.latestObservation.summary,
						observedAt: entry.latestObservation.observedAt
					}
				: null,
			relationshipToMaster: {
				tone: entry.relationshipToMaster.tone,
				latestEvidence: entry.relationshipToMaster.latestEvidence
			},
			authority: {
				standing: entry.authority.standing,
				latestEvidence: entry.authority.latestEvidence
			},
			activePromiseTerms: [...entry.activePromiseTerms]
		}))
	};
	return {
		...publicFields,
		publicPresentationHash: hashPublicProjection('world-presentation', publicFields)
	};
}

export type PublicSettlementPresentation = ReturnType<typeof projectSettlementForPublic>;

export function projectHeroConversationForPublic(presentation: HeroConversationPresentation) {
	return {
		runId: presentation.runId,
		version: presentation.version,
		eventCursor: presentation.eventCursor,
		heroId: presentation.heroId,
		canCommunicate: presentation.canCommunicate,
		availability: presentation.availability,
		masterLocation: presentation.masterLocation,
		heroLocation: presentation.heroLocation,
		acts: presentation.acts.map((act) => ({
			actId: act.actId,
			sourceEventId: act.sourceEventId,
			kind: act.kind,
			topic: act.topic,
			exactText: act.exactText,
			tone: act.tone,
			delivery: act.delivery,
			location: act.location,
			occurredAt: act.occurredAt,
			witnesses: act.witnesses.map((witness) => ({
				heroId: witness.heroId,
				role: witness.role,
				perception: witness.perception,
				learnedBelief: witness.learnedBelief
			}))
		})),
		turns: presentation.turns.map((turn) => ({
			turnId: turn.turnId,
			sourceEventId: turn.sourceEventId,
			communicationActId: turn.communicationActId,
			kind: turn.kind,
			orderIntent: turn.orderIntent,
			masterText: turn.masterText,
			heroResponse: {
				exactText: turn.heroResponse.exactText,
				publicReason: turn.heroResponse.publicReason,
				orderOutcome: turn.heroResponse.orderOutcome
			},
			occurredAt: turn.occurredAt
		})),
		beliefsLearnedFromCommunication: presentation.beliefsLearnedFromCommunication.map((belief) => ({
			beliefId: belief.beliefId,
			predicate: belief.predicate,
			objectSummary: belief.objectSummary,
			confidence: belief.confidence,
			learnedFromId: belief.learnedFromId,
			sourceEventId: belief.sourceEventId,
			observationId: belief.observationId
		}))
	};
}

export type PublicHeroConversationPresentation = ReturnType<
	typeof projectHeroConversationForPublic
>;

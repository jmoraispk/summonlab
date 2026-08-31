import {
	DailyPlanSchema,
	EngineGameStateV22Schema,
	HeroProgressionSchema,
	SocietyStateV5Schema,
	SynthesisReceiptSchema,
	SynthesisRumorRecordSchema,
	SynthesisStateSchema,
	type EngineCommand,
	type EngineGameStateV22,
	type RewardDelta,
	type SocietyStateV5,
	type SynthesisReceipt,
	type SynthesisRumorRecord
} from '@summonlab/contracts';

import { IllegalActionError, ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';

export type SynthesizeHeroCommand = Extract<
	EngineCommand,
	{ commandType: 'settlement.synthesize.hero' }
>;
export type ShareSynthesisRumorCommand = Extract<
	EngineCommand,
	{ commandType: 'hero.share.synthesis.rumor' }
>;

function clamp(value: number, minimum = 0, maximum = 100): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function clampSocial(value: number): number {
	return clamp(value, -100, 100);
}

function heroCanHearCommunication(hero: EngineGameStateV22['heroes'][string]): boolean {
	return (
		hero.lifeState === 'active' &&
		hero.currentTravel === null &&
		hero.currentActivity === null &&
		hero.currentRoutine === null
	);
}

function levelFor(experience: number, stars: number): number {
	return Math.min(stars * 10, 1 + Math.floor(experience / 10));
}

function skipUnfinishedPlan(hero: EngineGameStateV22['heroes'][string], resolvedAt: string) {
	if (!hero.dailyPlan) return null;
	return DailyPlanSchema.parse({
		...hero.dailyPlan,
		entries: hero.dailyPlan.entries.map((entry) =>
			entry.status === 'pending' || entry.status === 'active'
				? { ...entry, status: 'skipped', completedAt: resolvedAt }
				: entry
		)
	});
}

function clearBuildingAssignment(
	settlement: EngineGameStateV22['settlement'],
	heroId: string,
	buildingId: string
): EngineGameStateV22['settlement'] {
	const building = settlement.buildings[buildingId];
	if (!building) return settlement;
	return {
		...settlement,
		buildings: {
			...settlement.buildings,
			[buildingId]: {
				...building,
				assignedHeroIds: building.assignedHeroIds.filter((candidate) => candidate !== heroId)
			}
		}
	};
}

export function synthesisHeroIsReady(hero: EngineGameStateV22['heroes'][string]): boolean {
	return (
		hero.lifeState === 'active' &&
		hero.location === 'summoning-gate' &&
		hero.currentActivity === null &&
		hero.currentTravel === null &&
		hero.currentRoutine === null &&
		hero.assignment === null
	);
}

export function synthesisCommitIsAvailable(state: EngineGameStateV22): boolean {
	return (
		Object.values(state.heroes).filter((hero) => synthesisHeroIsReady(hero)).length >= 2 &&
		state.mission.attempt === null
	);
}

export function synthesisRumorIsAvailable(
	state: EngineGameStateV22,
	command: ShareSynthesisRumorCommand
): boolean {
	if (command.actorId === state.master.masterId) return false;
	const speaker = state.heroes[command.actorId];
	if (!speaker || !heroCanHearCommunication(speaker)) return false;
	const requiredActionId = `synthesis.rumor.share.${command.receiptId.slice(-8)}.${command.targetHeroId.slice(-8)}`;
	return Object.values(state.synthesis.receipts).some((receipt) => {
		const directlyKnows = receipt.socialConsequences.some(
			(consequence) => consequence.heroId === command.actorId && consequence.knowledge !== 'absence'
		);
		const learnedRumor = Object.values(state.synthesis.rumors).some(
			(rumor) => rumor.receiptId === receipt.receiptId && rumor.listenerHeroId === command.actorId
		);
		if (!directlyKnows && !learnedRumor) return false;
		return Object.values(state.heroes)
			.filter((target) => {
				if (
					target.heroId === command.actorId ||
					target.lifeState !== 'active' ||
					target.location !== speaker.location ||
					target.locationNodeId !== speaker.locationNodeId ||
					!heroCanHearCommunication(target)
				) {
					return false;
				}
				return !Object.values(state.society.observations).some(
					(observation) =>
						'synthesisReceiptId' in observation &&
						observation.synthesisReceiptId === receipt.receiptId &&
						observation.observerHeroId === target.heroId &&
						observation.kind !== 'synthesis-absence'
				);
			})
			.sort((left, right) => left.heroId.localeCompare(right.heroId))
			.some(
				(target) =>
					`synthesis.rumor.share.${receipt.receiptId.slice(-8)}.${target.heroId.slice(-8)}` ===
					requiredActionId
			);
	});
}

function synthesisRelationshipDeltas(
	hero: EngineGameStateV22['heroes'][string],
	knowledge: 'participant' | 'witness' | 'absence'
) {
	const conscience = Math.round((hero.mind.personality.agreeableness - 50) / 20);
	if (knowledge === 'participant') {
		return {
			trust: -4 - Math.max(0, conscience),
			respect: 2,
			fear: 7,
			affection: 0,
			resentment: 7 + Math.max(0, conscience),
			debt: 12
		};
	}
	if (knowledge === 'witness') {
		return {
			trust: -10 - Math.max(0, conscience),
			respect: -4,
			fear: 14,
			affection: -2,
			resentment: 12 + Math.max(0, conscience),
			debt: 0
		};
	}
	return {
		trust: -3,
		respect: -1,
		fear: 3,
		affection: 0,
		resentment: 2,
		debt: 0
	};
}

function rumorRelationshipDeltas() {
	return { trust: -6, respect: -2, fear: 8, affection: 0, resentment: 7, debt: 0 };
}

function withSynthesisRelationshipEvidence(
	state: EngineGameStateV22,
	society: SocietyStateV5,
	heroId: string,
	eventId: string,
	observationId: string,
	summary: string,
	deltas: ReturnType<typeof synthesisRelationshipDeltas>
): SocietyStateV5['relationships'][string] {
	const relationshipId = deterministicUuid(`${heroId}:${state.master.masterId}:relationship`);
	const previous = society.relationships[relationshipId];
	if (!previous) throw new ReplayIntegrityError('Missing Master relationship', state.eventCursor);
	return {
		...previous,
		dimensions: Object.fromEntries(
			Object.entries(previous.dimensions).map(([key, value]) => [
				key,
				clampSocial(value + deltas[key as keyof typeof deltas])
			])
		) as typeof previous.dimensions,
		updatedAt: state.simulatedAt,
		lastSourceEventId: eventId,
		evidence: [
			...previous.evidence,
			{ sourceEventId: eventId, observationId, summary, deltas }
		].slice(-64)
	};
}

export function synthesisEssenceExperience(hero: EngineGameStateV22['heroes'][string]): number {
	return 20 + hero.progression.stars * 15 + hero.progression.level * 5;
}

export function resolveSynthesis(
	state: EngineGameStateV22,
	command: SynthesizeHeroCommand,
	eventId: string,
	eventSequence: number
): {
	readonly state: EngineGameStateV22;
	readonly receipt: SynthesisReceipt;
	readonly canceledScheduledEventIds: readonly string[];
	readonly rewardDeltas: readonly RewardDelta[];
} {
	const source = state.heroes[command.sourceHeroId];
	const recipient = state.heroes[command.recipientHeroId];
	if (!source || !recipient) throw new IllegalActionError(command.commandType);
	const receiptId = deterministicUuid(`${eventId}:synthesis-receipt`);
	const essenceExperience = synthesisEssenceExperience(source);
	const recipientExperience = recipient.progression.experience + essenceExperience;
	const recipientProgression = HeroProgressionSchema.parse({
		...recipient.progression,
		experience: recipientExperience,
		level: levelFor(recipientExperience, recipient.progression.stars)
	});
	const observations = { ...state.society.observations };
	const beliefs = { ...state.society.beliefs };
	const relationships = { ...state.society.relationships };
	const consequences = Object.values(state.heroes)
		.filter((hero) => hero.lifeState === 'active' && hero.heroId !== source.heroId)
		.sort((left, right) => left.heroId.localeCompare(right.heroId))
		.map((hero) => {
			const knowledge =
				hero.heroId === recipient.heroId
					? ('participant' as const)
					: command.visibility === 'open' &&
						  hero.location === source.location &&
						  hero.locationNodeId === source.locationNodeId &&
						  heroCanHearCommunication(hero)
						? ('witness' as const)
						: ('absence' as const);
			const observationId = deterministicUuid(`${receiptId}:${hero.heroId}:observation`);
			const beliefId = deterministicUuid(`${observationId}:belief`);
			const relationshipId = deterministicUuid(
				`${hero.heroId}:${state.master.masterId}:relationship`
			);
			const direct = knowledge !== 'absence';
			const summary = direct
				? knowledge === 'participant'
					? `I received ${source.heroId}'s bounded synthesis essence after the Master confirmed the irreversible act.`
					: `I witnessed the Master synthesize ${source.heroId} into ${recipient.heroId}.`
				: `${source.heroId} entered the summoning chamber and did not return; I do not know what happened inside.`;
			observations[observationId] = {
				observationId,
				sourceEventId: eventId,
				observerHeroId: hero.heroId,
				observedAt: state.simulatedAt,
				kind: direct ? 'synthesis-direct' : 'synthesis-absence',
				synthesisReceiptId: receiptId,
				summary,
				subjectIds: direct
					? [source.heroId, recipient.heroId, state.master.masterId]
					: [source.heroId, state.master.masterId]
			};
			beliefs[beliefId] = {
				beliefId,
				holderHeroId: hero.heroId,
				subjectId: source.heroId,
				predicate: direct ? 'was-synthesized-into' : 'is-missing-after-gate-call',
				object: direct
					? { kind: 'entity', entityId: recipient.heroId }
					: { kind: 'text', text: 'Did not return from a private summoning-gate audience.' },
				confidence: direct ? 100 : 35,
				status: 'held',
				learnedAt: state.simulatedAt,
				provenance: {
					kind: direct ? 'observed' : 'inferred',
					sourceEventId: eventId,
					observationId,
					learnedFromId: null,
					chainDepth: 0
				}
			};
			const relationshipDeltas = synthesisRelationshipDeltas(hero, knowledge);
			relationships[relationshipId] = withSynthesisRelationshipEvidence(
				state,
				{ ...state.society, observations, beliefs, relationships },
				hero.heroId,
				eventId,
				observationId,
				summary,
				relationshipDeltas
			);
			return {
				heroId: hero.heroId,
				knowledge,
				observationId,
				beliefId,
				relationshipId,
				confidence: direct ? 100 : 35,
				relationshipDeltas
			};
		});
	const receipt = SynthesisReceiptSchema.parse({
		receiptVersion: 'synthesis-receipt-v1',
		receiptId,
		sourceEventId: eventId,
		masterId: state.master.masterId,
		sourceHeroId: source.heroId,
		recipientHeroId: recipient.heroId,
		visibility: command.visibility,
		warningVersion: command.warningVersion,
		confirmedIrreversible: command.confirmedIrreversible,
		rationale: command.rationale,
		committedAt: state.simulatedAt,
		essenceExperience,
		sourceProgression: source.progression,
		recipientProgressionBefore: recipient.progression,
		recipientProgressionAfter: recipientProgression,
		socialConsequences: consequences
	});
	const canceledScheduledEventIds = [
		source.currentActivity?.scheduledEventId,
		source.currentTravel?.scheduledEventId,
		source.currentRoutine?.scheduledEventId
	].filter((id): id is string => Boolean(id));
	const sourceHero = {
		...source,
		lifeState: 'synthesized' as const,
		health: 0,
		destination: null,
		equipment: { mainHand: null },
		currentActivity: null,
		currentTravel: null,
		assignment: null,
		currentRoutine: null,
		dailyPlan: skipUnfinishedPlan(source, state.simulatedAt)
	};
	const settlement = source.assignment
		? clearBuildingAssignment(state.settlement, source.heroId, source.assignment.buildingId)
		: state.settlement;
	const items = Object.fromEntries(
		Object.entries(state.items).map(([itemId, item]) => [
			itemId,
			item.ownerId === source.heroId
				? { ...item, ownerId: state.master.masterId, equippedById: null }
				: item
		])
	);
	const nextSociety = SocietyStateV5Schema.parse({
		...state.society,
		observations,
		beliefs,
		relationships
	});
	const nextSynthesis = SynthesisStateSchema.parse({
		...state.synthesis,
		receipts: { ...state.synthesis.receipts, [receiptId]: receipt }
	});
	const nextState = EngineGameStateV22Schema.parse({
		...state,
		version: state.version + 1,
		eventCursor: eventSequence,
		heroes: {
			...state.heroes,
			[source.heroId]: sourceHero,
			[recipient.heroId]: { ...recipient, progression: recipientProgression }
		},
		items,
		settlement,
		society: nextSociety,
		synthesis: nextSynthesis
	});
	const rewardDeltas: RewardDelta[] = [
		{
			ownerId: recipient.heroId,
			kind: 'experience',
			key: 'hero',
			before: recipient.progression.experience,
			after: recipientProgression.experience,
			delta: recipientProgression.experience - recipient.progression.experience
		},
		...(recipientProgression.level === recipient.progression.level
			? []
			: [
					{
						ownerId: recipient.heroId,
						kind: 'level' as const,
						key: 'hero',
						before: recipient.progression.level,
						after: recipientProgression.level,
						delta: recipientProgression.level - recipient.progression.level
					}
				]),
		...consequences.flatMap((consequence) =>
			Object.entries(consequence.relationshipDeltas)
				.filter(([, delta]) => delta !== 0)
				.map(([key]) => {
					const before =
						state.society.relationships[consequence.relationshipId]!.dimensions[
							key as keyof typeof consequence.relationshipDeltas
						];
					const after =
						nextSociety.relationships[consequence.relationshipId]!.dimensions[
							key as keyof typeof consequence.relationshipDeltas
						];
					return {
						ownerId: consequence.heroId,
						kind: 'relationship' as const,
						key,
						before,
						after,
						delta: after - before
					};
				})
		)
	];
	return { state: nextState, receipt, canceledScheduledEventIds, rewardDeltas };
}

export function resolveSynthesisRumor(
	state: EngineGameStateV22,
	command: ShareSynthesisRumorCommand,
	eventId: string,
	eventSequence: number
): {
	readonly state: EngineGameStateV22;
	readonly rumor: SynthesisRumorRecord;
	readonly rewardDeltas: readonly RewardDelta[];
} {
	const receipt = state.synthesis.receipts[command.receiptId];
	const speaker = state.heroes[command.actorId];
	const listener = state.heroes[command.targetHeroId];
	if (!receipt || !speaker || !listener) throw new IllegalActionError(command.commandType);
	const sourceConsequence = receipt.socialConsequences.find(
		(consequence) => consequence.heroId === speaker.heroId && consequence.knowledge !== 'absence'
	);
	const priorRumor = Object.values(state.synthesis.rumors).find(
		(candidate) =>
			candidate.receiptId === receipt.receiptId && candidate.listenerHeroId === speaker.heroId
	);
	const originObservationId = sourceConsequence?.observationId ?? priorRumor?.originObservationId;
	const originBeliefId = sourceConsequence?.beliefId ?? priorRumor?.beliefId;
	const originBelief = originBeliefId ? state.society.beliefs[originBeliefId] : null;
	if (!originObservationId || !originBelief) throw new IllegalActionError(command.commandType);
	const chainDepth = originBelief.provenance.chainDepth + 1;
	const confidence = Math.max(45, originBelief.confidence - 15);
	const rumorId = deterministicUuid(`${eventId}:synthesis-rumor`);
	const observationId = deterministicUuid(`${rumorId}:${listener.heroId}:observation`);
	const beliefId = deterministicUuid(`${observationId}:belief`);
	const relationshipId = deterministicUuid(
		`${listener.heroId}:${state.master.masterId}:relationship`
	);
	const summary = `${speaker.heroId} told me the Master synthesized ${receipt.sourceHeroId} into ${receipt.recipientHeroId}.`;
	const observations = {
		...state.society.observations,
		[observationId]: {
			observationId,
			sourceEventId: eventId,
			observerHeroId: listener.heroId,
			observedAt: state.simulatedAt,
			kind: 'synthesis-rumor' as const,
			synthesisReceiptId: receipt.receiptId,
			summary,
			subjectIds: [...new Set([receipt.sourceHeroId, receipt.recipientHeroId, speaker.heroId])]
		}
	};
	const beliefs = {
		...state.society.beliefs,
		[beliefId]: {
			beliefId,
			holderHeroId: listener.heroId,
			subjectId: receipt.sourceHeroId,
			predicate: 'was-synthesized-into' as const,
			object: { kind: 'entity' as const, entityId: receipt.recipientHeroId },
			confidence,
			status: 'held' as const,
			learnedAt: state.simulatedAt,
			provenance: {
				kind: 'told' as const,
				sourceEventId: eventId,
				observationId,
				learnedFromId: speaker.heroId,
				chainDepth
			}
		}
	};
	const relationshipDeltas = rumorRelationshipDeltas();
	const relationship = withSynthesisRelationshipEvidence(
		state,
		{ ...state.society, observations, beliefs },
		listener.heroId,
		eventId,
		observationId,
		summary,
		relationshipDeltas
	);
	const society = SocietyStateV5Schema.parse({
		...state.society,
		observations,
		beliefs,
		relationships: { ...state.society.relationships, [relationshipId]: relationship }
	});
	const rumor = SynthesisRumorRecordSchema.parse({
		rumorVersion: 'synthesis-rumor-v1',
		rumorId,
		receiptId: receipt.receiptId,
		sourceEventId: eventId,
		originObservationId,
		speakerHeroId: speaker.heroId,
		listenerHeroId: listener.heroId,
		observationId,
		beliefId,
		relationshipId,
		confidence,
		chainDepth,
		relationshipDeltas,
		sharedAt: state.simulatedAt
	});
	const nextState = EngineGameStateV22Schema.parse({
		...state,
		version: state.version + 1,
		eventCursor: eventSequence,
		society,
		synthesis: {
			...state.synthesis,
			rumors: { ...state.synthesis.rumors, [rumorId]: rumor }
		}
	});
	const rewardDeltas = Object.entries(relationshipDeltas).map(([key]) => {
		const before =
			state.society.relationships[relationshipId]!.dimensions[
				key as keyof typeof relationshipDeltas
			];
		const after = relationship.dimensions[key as keyof typeof relationshipDeltas];
		return {
			ownerId: listener.heroId,
			kind: 'relationship' as const,
			key,
			before,
			after,
			delta: after - before
		};
	});
	return { state: nextState, rumor, rewardDeltas };
}

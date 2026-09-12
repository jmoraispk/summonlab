import {
	CommunicativeActSchema,
	DirectiveRecordSchema,
	HeroConversationTurnSchema,
	ScheduledEventSchema,
	SocietyStateSchema,
	SocietyStateV2Schema,
	SocietyStateV3Schema,
	SocietyStateV4Schema,
	SocietyStateV5Schema,
	type ConversationOrderIntent,
	type ConversationOrderOutcome,
	type DirectiveRecord,
	type EngineCommand,
	type EngineGameStateV6,
	type EngineGameStateV7,
	type EngineGameStateV8,
	type EngineGameStateV9,
	type EngineGameStateV10,
	type EngineGameStateV11,
	type EngineGameStateV12,
	type EngineGameStateV13,
	type EngineGameStateV14,
	type EngineGameStateV15,
	type EngineGameStateV16,
	type EngineGameStateV17,
	type EngineGameStateV18,
	type EngineGameStateV19,
	type EngineGameStateV20,
	type EngineGameStateV21,
	type EngineGameStateV22,
	type EngineGameStateV23,
	type FirstEmberFacility,
	type FirstEmberRationale,
	type ScheduledEvent,
	type SocietyState,
	type SocietyStateV2,
	type SocietyStateV3,
	type SocietyStateV4,
	type SocietyStateV5
} from '@summonlab/contracts';
import { z } from 'zod';

import { ENGINE_EPOCH } from '../../core/versions.js';
import { IllegalActionError, ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';
import { clamp, gameDayIndex } from './routines.js';

export function clampSocial(value: number): number {
	return clamp(value, -100, 100);
}

export function createBootstrapSociety(
	heroId: string,
	masterId: string,
	eventId: string,
	observedAt: string
): SocietyStateV4 {
	const observationId = deterministicUuid(`${eventId}:${heroId}:awakening-observation`);
	const selfBeliefId = deterministicUuid(`${observationId}:self-awakened`);
	const presenceBeliefId = deterministicUuid(`${observationId}:master-present`);
	const relationshipId = deterministicUuid(`${heroId}:${masterId}:relationship`);
	const authorityId = deterministicUuid(`${heroId}:${masterId}:authority`);
	return SocietyStateV4Schema.parse({
		contentVersion: 'society-v4',
		observations: {
			[observationId]: {
				observationId,
				sourceEventId: eventId,
				observerHeroId: heroId,
				observedAt,
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: [heroId, masterId]
			}
		},
		beliefs: {
			[selfBeliefId]: {
				beliefId: selfBeliefId,
				holderHeroId: heroId,
				subjectId: heroId,
				predicate: 'awakened-at',
				object: { kind: 'location', locationId: 'summoning-gate' },
				confidence: 100,
				status: 'held',
				learnedAt: observedAt,
				provenance: {
					kind: 'experienced',
					sourceEventId: eventId,
					observationId,
					learnedFromId: null,
					chainDepth: 0
				}
			},
			[presenceBeliefId]: {
				beliefId: presenceBeliefId,
				holderHeroId: heroId,
				subjectId: masterId,
				predicate: 'present-at-awakening',
				object: { kind: 'location', locationId: 'summoning-gate' },
				confidence: 100,
				status: 'held',
				learnedAt: observedAt,
				provenance: {
					kind: 'observed',
					sourceEventId: eventId,
					observationId,
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			[relationshipId]: {
				relationshipId,
				fromHeroId: heroId,
				toEntityId: masterId,
				dimensions: { trust: 0, respect: 0, fear: 0, affection: 0, resentment: 0, debt: 0 },
				updatedAt: observedAt,
				lastSourceEventId: eventId,
				evidence: []
			}
		},
		promises: {},
		authority: {
			[authorityId]: {
				authorityId,
				observerHeroId: heroId,
				subjectId: masterId,
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: observedAt,
				lastSourceEventId: eventId,
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	});
}

export function createBootstrapCompanySociety(
	heroIds: readonly string[],
	masterId: string,
	eventId: string,
	observedAt: string
): SocietyStateV4 {
	const states = heroIds.map((heroId) =>
		createBootstrapSociety(heroId, masterId, eventId, observedAt)
	);
	return SocietyStateV4Schema.parse({
		contentVersion: 'society-v4',
		observations: Object.assign({}, ...states.map((state) => state.observations)),
		beliefs: Object.assign({}, ...states.map((state) => state.beliefs)),
		relationships: Object.assign({}, ...states.map((state) => state.relationships)),
		promises: {},
		authority: Object.assign({}, ...states.map((state) => state.authority)),
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	});
}

export function createBootstrapCompanySocietyV5(
	heroIds: readonly string[],
	masterId: string,
	eventId: string,
	observedAt: string
): SocietyStateV5 {
	const society = createBootstrapCompanySociety(heroIds, masterId, eventId, observedAt);
	return SocietyStateV5Schema.parse({ ...society, contentVersion: 'society-v5' });
}
export const FIRST_EMBER_MODIFIERS = Object.freeze({
	kitchen: [{ key: 'hunger-recovery', amount: 15 }],
	dormitory: [
		{ key: 'fatigue-recovery', amount: 20 },
		{ key: 'health-recovery', amount: 5 }
	],
	'training-ground': [
		{ key: 'hero-experience', amount: 4 },
		{ key: 'sword-experience', amount: 3 },
		{ key: 'training-injury-threshold', amount: -7 }
	]
} as const);

const FACILITY_RATIONALE = Object.freeze({
	kitchen: 'feed-everyone',
	dormitory: 'protect-recovery',
	'training-ground': 'prepare-tower'
} as const satisfies Record<FirstEmberFacility, FirstEmberRationale>);

function reactionStance(score: number) {
	if (score >= 30) return 'support' as const;
	if (score >= 10) return 'accept' as const;
	if (score >= -10) return 'question' as const;
	return 'oppose' as const;
}

export function buildFirstEmberReaction(
	hero: EngineGameStateV6['heroes'][string],
	buildingId: FirstEmberFacility,
	rationale: FirstEmberRationale
) {
	let score = 0;
	const factors: string[] = [];
	if (buildingId === 'kitchen') {
		const need = Math.round(hero.needs.hunger / 2);
		score += need;
		factors.push(`hunger ${hero.needs.hunger} contributes ${need}`);
		if (['belonging', 'mercy'].includes(hero.mind.primaryValue)) {
			score += 18;
			factors.push(`value ${hero.mind.primaryValue} supports shared food`);
		}
		if (['connect', 'protect', 'survive'].includes(hero.mind.primaryDrive)) {
			score += 12;
			factors.push(`drive ${hero.mind.primaryDrive} supports the hearth`);
		}
	}
	if (buildingId === 'dormitory') {
		const need = Math.round(hero.needs.fatigue / 2 + (hero.maxHealth - hero.health) / 2);
		score += need;
		factors.push(`fatigue and injury pressure contribute ${need}`);
		if (['freedom', 'belonging', 'mercy'].includes(hero.mind.primaryValue)) {
			score += 18;
			factors.push(`value ${hero.mind.primaryValue} supports recovery and privacy`);
		}
		if (['protect', 'survive'].includes(hero.mind.primaryDrive)) {
			score += 12;
			factors.push(`drive ${hero.mind.primaryDrive} supports shelter`);
		}
	}
	if (buildingId === 'training-ground') {
		const readiness = Math.round((100 - hero.needs.fatigue) / 5);
		score += readiness;
		factors.push(`physical readiness contributes ${readiness}`);
		if (['duty', 'mastery'].includes(hero.mind.primaryValue)) {
			score += 18;
			factors.push(`value ${hero.mind.primaryValue} supports preparation`);
		}
		if (['prove', 'survive'].includes(hero.mind.primaryDrive)) {
			score += 12;
			factors.push(`drive ${hero.mind.primaryDrive} supports tower readiness`);
		}
		if (hero.needs.fatigue >= 70) {
			score -= 18;
			factors.push('high fatigue argues against more training');
		}
	}
	if (FACILITY_RATIONALE[buildingId] === rationale) {
		score += 12;
		factors.push('the explanation matches the chosen facility');
	} else {
		score -= 12;
		factors.push('the explanation conflicts with the chosen facility');
	}
	score += Math.round((hero.mind.personality.agreeableness - 50) / 10);
	factors.push(`agreeableness ${hero.mind.personality.agreeableness} shapes willingness to accept`);
	const clampedScore = Math.max(-100, Math.min(100, score));
	const stance = reactionStance(clampedScore);
	const summary = {
		support: 'The hero openly supports the commitment and its stated purpose.',
		accept: 'The hero accepts the commitment, reserving judgment for its results.',
		question: 'The hero asks whether the irreversible choice truly answers the settlement’s needs.',
		oppose: 'The hero objects to spending the only core on this priority.'
	}[stance];
	return { heroId: hero.heroId, stance, score: clampedScore, summary, factors };
}

const FIRST_EMBER_PROMISE_TERMS = Object.freeze({
	'feed-everyone': 'I will make feeding this company our founding priority.',
	'protect-recovery': 'I will protect this company’s recovery as our founding priority.',
	'prepare-tower': 'I will prepare this company for the tower as our founding priority.'
} as const satisfies Record<FirstEmberRationale, string>);

export function buildFirstEmberSociety(
	state:
		| EngineGameStateV7
		| EngineGameStateV8
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV22,
	eventId: string,
	buildingId: FirstEmberFacility,
	rationale: FirstEmberRationale,
	reactions: readonly ReturnType<typeof buildFirstEmberReaction>[]
): SocietyState | SocietyStateV2 | SocietyStateV3 | SocietyStateV4 {
	const observations = { ...state.society.observations };
	const beliefs = { ...state.society.beliefs };
	const relationships = { ...state.society.relationships };
	const authority = { ...state.society.authority };
	const promiseId = deterministicUuid(`${eventId}:founding-promise`);
	const witnessObservationIds: string[] = [];

	for (const reaction of reactions) {
		const observationId = deterministicUuid(
			`${eventId}:${reaction.heroId}:first-ember-observation`
		);
		witnessObservationIds.push(observationId);
		observations[observationId] = {
			observationId,
			sourceEventId: eventId,
			observerHeroId: reaction.heroId,
			observedAt: state.simulatedAt,
			kind: 'first-ember-commitment',
			summary: `I witnessed the Master bind the First Ember to ${buildingId} for ${rationale}.`,
			subjectIds: [state.master.masterId, reaction.heroId]
		};

		const commitmentBeliefId = deterministicUuid(`${observationId}:commitment-belief`);
		beliefs[commitmentBeliefId] = {
			beliefId: commitmentBeliefId,
			holderHeroId: reaction.heroId,
			subjectId: state.master.masterId,
			predicate: 'first-ember-bound-to',
			object: { kind: 'commitment', facilityId: buildingId, rationale },
			confidence: 100,
			status: 'held',
			learnedAt: state.simulatedAt,
			provenance: {
				kind: 'observed',
				sourceEventId: eventId,
				observationId,
				learnedFromId: null,
				chainDepth: 0
			}
		};
		const promiseBeliefId = deterministicUuid(`${observationId}:promise-belief`);
		beliefs[promiseBeliefId] = {
			beliefId: promiseBeliefId,
			holderHeroId: reaction.heroId,
			subjectId: state.master.masterId,
			predicate: 'made-founding-promise',
			object: { kind: 'promise', promiseId },
			confidence: 100,
			status: 'held',
			learnedAt: state.simulatedAt,
			provenance: {
				kind: 'observed',
				sourceEventId: eventId,
				observationId,
				learnedFromId: null,
				chainDepth: 0
			}
		};

		const relationshipId = deterministicUuid(
			`${reaction.heroId}:${state.master.masterId}:relationship`
		);
		const previousRelationship = relationships[relationshipId];
		if (!previousRelationship)
			throw new ReplayIntegrityError('Missing Master relationship', state.eventCursor);
		const relationshipDeltas = {
			trust: { support: 8, accept: 3, question: -2, oppose: -8 }[reaction.stance],
			respect: { support: 10, accept: 4, question: -1, oppose: -6 }[reaction.stance],
			fear: 0,
			affection: 0,
			resentment: reaction.stance === 'oppose' ? 8 : 0,
			debt: 0
		};
		relationships[relationshipId] = {
			...previousRelationship,
			dimensions: Object.fromEntries(
				Object.entries(previousRelationship.dimensions).map(([key, value]) => [
					key,
					clampSocial(value + relationshipDeltas[key as keyof typeof relationshipDeltas])
				])
			) as typeof previousRelationship.dimensions,
			updatedAt: state.simulatedAt,
			lastSourceEventId: eventId,
			evidence: [
				...previousRelationship.evidence,
				{
					sourceEventId: eventId,
					observationId,
					summary: reaction.summary,
					deltas: relationshipDeltas
				}
			]
		};

		const authorityId = deterministicUuid(`${reaction.heroId}:${state.master.masterId}:authority`);
		const previousAuthority = authority[authorityId];
		if (!previousAuthority)
			throw new ReplayIntegrityError('Missing Master authority view', state.eventCursor);
		const matched = FACILITY_RATIONALE[buildingId] === rationale;
		const authorityDeltas = {
			competence: buildingId === 'training-ground' ? 5 : buildingId === 'dormitory' ? 4 : 3,
			provision: buildingId === 'kitchen' ? 10 : buildingId === 'dormitory' ? 8 : 2,
			trust: relationshipDeltas.trust,
			legitimacy: { support: 8, accept: 4, question: -2, oppose: -8 }[reaction.stance],
			fear: 0,
			strength: buildingId === 'training-ground' ? 8 : 2,
			consistency: matched ? 6 : -8
		};
		authority[authorityId] = {
			...previousAuthority,
			dimensions: Object.fromEntries(
				Object.entries(previousAuthority.dimensions).map(([key, value]) => [
					key,
					clampSocial(value + authorityDeltas[key as keyof typeof authorityDeltas])
				])
			) as typeof previousAuthority.dimensions,
			updatedAt: state.simulatedAt,
			lastSourceEventId: eventId,
			evidence: [
				...previousAuthority.evidence,
				{
					sourceEventId: eventId,
					observationId,
					summary: matched
						? 'The stated priority matched the chosen facility.'
						: 'The stated priority conflicted with the chosen facility.',
					deltas: authorityDeltas
				}
			]
		};
	}

	const candidate = {
		...state.society,
		observations,
		beliefs,
		relationships,
		authority,
		promises: {
			...state.society.promises,
			[promiseId]: {
				promiseId,
				promisorId: state.master.masterId,
				promiseeHeroIds: reactions.map((reaction) => reaction.heroId),
				kind: 'founding-priority',
				terms: FIRST_EMBER_PROMISE_TERMS[rationale],
				status: 'active',
				sourceEventId: eventId,
				createdAt: state.simulatedAt,
				witnessObservationIds,
				resolvedAt: null,
				resolutionEventId: null
			}
		}
	};
	if (
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21
	)
		return SocietyStateV4Schema.parse(candidate);
	if (state.schemaVersion === 9) return SocietyStateV3Schema.parse(candidate);
	return state.schemaVersion === 8
		? SocietyStateV2Schema.parse(candidate)
		: SocietyStateSchema.parse(candidate);
}

export type MasterConverseCommand = Extract<EngineCommand, { commandType: 'master.converse' }>;
export type CommunicationInput = Pick<
	z.infer<typeof CommunicativeActSchema>,
	'kind' | 'topic' | 'exactText' | 'tone' | 'delivery'
> & { readonly targetHeroId: string };
export type EngineCommunicationState =
	| EngineGameStateV8
	| EngineGameStateV9
	| EngineGameStateV10
	| EngineGameStateV11
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV14
	| EngineGameStateV15
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19
	| EngineGameStateV20
	| EngineGameStateV21
	| EngineGameStateV22
	| EngineGameStateV23;

export function heroCanHearCommunication(
	hero: Pick<
		EngineCommunicationState['heroes'][string],
		'lifeState' | 'currentTravel' | 'currentActivity' | 'currentRoutine'
	>
): boolean {
	return (
		hero.lifeState === 'active' &&
		hero.currentTravel === null &&
		hero.currentActivity === null &&
		hero.currentRoutine === null
	);
}

export function communicationWitnessHeroes(
	state: EngineCommunicationState,
	command: CommunicationInput
): EngineCommunicationState['heroes'][string][] {
	const target = state.heroes[command.targetHeroId];
	if (!target || target.location !== state.master.location || !heroCanHearCommunication(target)) {
		return [];
	}
	const witnesses = [target];
	if (command.delivery === 'open') {
		witnesses.push(
			...Object.values(state.heroes)
				.filter(
					(hero) =>
						hero.heroId !== target.heroId &&
						hero.location === state.master.location &&
						heroCanHearCommunication(hero)
				)
				.sort((left, right) => left.heroId.localeCompare(right.heroId))
		);
	}
	return witnesses;
}

export function communicationClaim(state: EngineCommunicationState, command: CommunicationInput) {
	if (['hero-memory', 'open-conversation', 'daily-order'].includes(command.topic)) return null;
	if (command.topic === 'master-role') {
		return {
			subjectId: state.master.masterId,
			predicate: 'claims-master-role' as const,
			object: { kind: 'text' as const, text: 'Master of Hearth 01' }
		};
	}
	if (command.topic === 'summoning-situation') {
		return {
			subjectId: command.targetHeroId,
			predicate: 'was-summoned-into' as const,
			object: { kind: 'location' as const, locationId: 'summoning-gate' }
		};
	}
	return {
		subjectId: state.master.masterId,
		predicate: 'described-tower-mission' as const,
		object: {
			kind: 'text' as const,
			text: 'Hearth 01 shelters a summoned company preparing to climb the one-hundred-floor tower.'
		}
	};
}

export function buildCommunicativeSociety(
	state: EngineCommunicationState,
	eventId: string,
	command: CommunicationInput
): {
	society: SocietyStateV2 | SocietyStateV3 | SocietyStateV4;
	communicativeAct: z.infer<typeof CommunicativeActSchema>;
} {
	const claim = communicationClaim(state, command);
	const actId = deterministicUuid(`${eventId}:communicative-act`);
	const observations = { ...state.society.observations };
	const beliefs = { ...state.society.beliefs };
	const witnesses = communicationWitnessHeroes(state, command).map((hero) => {
		const intended = hero.heroId === command.targetHeroId;
		const observationId = deterministicUuid(`${actId}:${hero.heroId}:observation`);
		const beliefId = claim ? deterministicUuid(`${observationId}:belief`) : null;
		observations[observationId] = {
			observationId,
			sourceEventId: eventId,
			observerHeroId: hero.heroId,
			observedAt: state.simulatedAt,
			kind: 'communication',
			communicationActId: actId,
			summary: intended
				? command.kind === 'ask'
					? `The Master directly asked me about ${command.topic}.`
					: command.kind === 'order'
						? `The Master directly ordered me regarding ${command.topic}.`
						: `The Master directly ${command.kind === 'tell' ? 'told' : 'explained to'} me about ${command.topic}.`
				: `I overheard the Master ${command.kind} ${command.topic} to another hero.`,
			subjectIds: [state.master.masterId, command.targetHeroId]
		};
		if (claim && beliefId) {
			beliefs[beliefId] = {
				beliefId,
				holderHeroId: hero.heroId,
				subjectId: claim.subjectId,
				predicate: claim.predicate,
				object: claim.object,
				confidence: claim.predicate === 'was-summoned-into' ? (intended ? 85 : 70) : 100,
				status: 'held',
				learnedAt: state.simulatedAt,
				provenance: {
					kind: 'told',
					sourceEventId: eventId,
					observationId,
					learnedFromId: state.master.masterId,
					chainDepth: 1
				}
			};
		}
		return {
			heroId: hero.heroId,
			role: intended ? ('intended' as const) : ('bystander' as const),
			perception: intended ? ('addressed' as const) : ('overheard' as const),
			observationId,
			beliefId
		};
	});
	const communicativeAct = CommunicativeActSchema.parse({
		actId,
		sourceEventId: eventId,
		speakerId: state.master.masterId,
		intendedAudienceIds: [command.targetHeroId],
		kind: command.kind,
		topic: command.topic,
		exactText: command.exactText,
		tone: command.tone,
		delivery: command.delivery,
		location: state.master.location,
		occurredAt: state.simulatedAt,
		claim,
		witnesses
	});
	const candidate = {
		...state.society,
		observations,
		beliefs,
		communicativeActs: {
			...state.society.communicativeActs,
			[actId]: communicativeAct
		}
	};
	return {
		communicativeAct,
		society:
			state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20
				? SocietyStateV4Schema.parse(candidate)
				: state.schemaVersion === 9
					? SocietyStateV3Schema.parse(candidate)
					: SocietyStateV2Schema.parse(candidate)
	};
}

export type DirectiveIssueCommand = Extract<
	EngineCommand,
	{ commandType: 'master.issue.directive' | 'master.replace.directive' }
>;

export function nextGameDayStart(gameTime: string): string {
	const milliseconds = Date.parse(ENGINE_EPOCH) + (gameDayIndex(gameTime) + 1) * 86_400_000;
	return new Date(milliseconds).toISOString();
}

export function buildDirectiveChange(
	state:
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	eventId: string,
	command: DirectiveIssueCommand
): {
	directive: DirectiveRecord;
	previousDirective: DirectiveRecord | null;
	communicativeAct: z.infer<typeof CommunicativeActSchema>;
	society: SocietyStateV4;
	scheduledEvent: ScheduledEvent | null;
} {
	const previousDirective =
		command.commandType === 'master.replace.directive'
			? (state.society.directives[command.directiveId] ?? null)
			: null;
	const directiveId = deterministicUuid(`${command.commandId}:directive`);
	const actId = deterministicUuid(`${eventId}:directive-communicative-act`);
	const recipientSet = new Set(command.recipientIds);
	const witnessHeroes = Object.values(state.heroes)
		.filter(
			(hero) =>
				hero.location === state.master.location &&
				heroCanHearCommunication(hero) &&
				(recipientSet.has(hero.heroId) || command.delivery === 'open')
		)
		.sort((left, right) => left.heroId.localeCompare(right.heroId));
	const observations = { ...state.society.observations };
	const witnesses = witnessHeroes.map((hero) => {
		const intended = recipientSet.has(hero.heroId);
		const observationId = deterministicUuid(`${actId}:${hero.heroId}:observation`);
		observations[observationId] = {
			observationId,
			sourceEventId: eventId,
			observerHeroId: hero.heroId,
			observedAt: state.simulatedAt,
			kind: 'communication',
			communicationActId: actId,
			summary: intended
				? `The Master directed me: “${command.text}”`
				: `I overheard the Master direct others: “${command.text}”`,
			subjectIds: [state.master.masterId, ...command.recipientIds]
		};
		return {
			heroId: hero.heroId,
			role: intended ? ('intended' as const) : ('bystander' as const),
			perception: intended ? ('addressed' as const) : ('overheard' as const),
			observationId,
			beliefId: null
		};
	});
	const communicativeAct = CommunicativeActSchema.parse({
		actId,
		sourceEventId: eventId,
		speakerId: state.master.masterId,
		intendedAudienceIds: [...command.recipientIds],
		kind: 'order',
		topic: 'daily-order',
		exactText: command.text,
		tone: command.tone,
		delivery: command.delivery,
		location: state.master.location,
		occurredAt: state.simulatedAt,
		claim: null,
		witnesses
	});
	const expiresAt = command.scope === 'day' ? nextGameDayStart(state.simulatedAt) : null;
	const expiryScheduledEventId =
		command.scope === 'day' ? deterministicUuid(`${command.commandId}:directive-expiry`) : null;
	const directive = DirectiveRecordSchema.parse({
		directiveId,
		runId: state.runId,
		authorId: state.master.masterId,
		text: command.text,
		scope: command.scope,
		recipientIds: [...command.recipientIds],
		witnessEventId: eventId,
		priorities: [...command.priorities],
		createdAt: state.simulatedAt,
		expiresAt,
		revokedAt: null,
		delivery: command.delivery,
		status: 'active',
		witnessObservationIds: witnesses.map((witness) => witness.observationId),
		expiryScheduledEventId,
		replacesDirectiveId: previousDirective?.directiveId ?? null,
		replacedByDirectiveId: null,
		terminalAt: null,
		terminalEventId: null
	});
	const directives = { ...state.society.directives };
	if (previousDirective) {
		directives[previousDirective.directiveId] = DirectiveRecordSchema.parse({
			...previousDirective,
			status: 'replaced',
			revokedAt: state.simulatedAt,
			replacedByDirectiveId: directiveId,
			terminalAt: state.simulatedAt,
			terminalEventId: eventId
		});
	}
	directives[directiveId] = directive;
	const society = SocietyStateV4Schema.parse({
		...state.society,
		observations,
		communicativeActs: {
			...state.society.communicativeActs,
			[actId]: communicativeAct
		},
		directives
	});
	const scheduledEvent =
		expiresAt && expiryScheduledEventId
			? ScheduledEventSchema.parse({
					scheduledEventId: expiryScheduledEventId,
					runId: state.runId,
					actorId: state.master.masterId,
					dueGameTime: expiresAt,
					eventKind: 'directive.expire',
					payload: { directiveId }
				})
			: null;
	return { directive, previousDirective, communicativeAct, society, scheduledEvent };
}

export function revokeDirective(
	state:
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	eventId: string,
	directiveId: string
): { directive: DirectiveRecord; society: SocietyStateV4 } {
	const previous = state.society.directives[directiveId];
	if (!previous) throw new IllegalActionError('master.revoke.directive');
	const directive = DirectiveRecordSchema.parse({
		...previous,
		status: 'revoked',
		revokedAt: state.simulatedAt,
		terminalAt: state.simulatedAt,
		terminalEventId: eventId
	});
	return {
		directive,
		society: SocietyStateV4Schema.parse({
			...state.society,
			directives: { ...state.society.directives, [directiveId]: directive }
		})
	};
}

const ORDER_INTENT_LABELS = Object.freeze({
	train: 'train at the practice ring',
	rest: 'rest and recover',
	eat: 'eat a proper meal',
	work: 'take a settlement duty',
	'prepare-tower': 'prepare for the tower'
} as const satisfies Record<ConversationOrderIntent, string>);

export function conversationOrderScore(
	state:
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	hero: (
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
	)['heroes'][string],
	intent: ConversationOrderIntent,
	tone: MasterConverseCommand['tone']
) {
	const relationship = Object.values(state.society.relationships).find(
		(candidate) =>
			candidate.fromHeroId === hero.heroId && candidate.toEntityId === state.master.masterId
	);
	const authority = Object.values(state.society.authority).find(
		(candidate) =>
			candidate.observerHeroId === hero.heroId && candidate.subjectId === state.master.masterId
	);
	if (!relationship || !authority) {
		throw new ReplayIntegrityError('Conversation social view is missing', state.eventCursor);
	}
	const authorityScore = Math.round(
		(authority.dimensions.legitimacy +
			authority.dimensions.trust +
			authority.dimensions.competence +
			authority.dimensions.consistency) /
			20
	);
	const relationshipScore = Math.round(
		(relationship.dimensions.trust +
			relationship.dimensions.respect +
			relationship.dimensions.affection -
			relationship.dimensions.resentment) /
			20
	);
	const personality = Math.round(
		(hero.mind.personality.agreeableness +
			hero.mind.personality.conscientiousness -
			hero.mind.personality.emotionalVolatility -
			50) /
			10
	);
	const alignedValues: Record<ConversationOrderIntent, readonly string[]> = {
		train: ['mastery', 'duty'],
		rest: ['freedom', 'belonging'],
		eat: ['belonging', 'freedom'],
		work: ['duty', 'belonging'],
		'prepare-tower': ['duty', 'mastery']
	};
	const alignedDrives: Record<ConversationOrderIntent, readonly string[]> = {
		train: ['prove', 'survive'],
		rest: ['survive', 'belong'],
		eat: ['survive', 'belong'],
		work: ['protect', 'belong'],
		'prepare-tower': ['protect', 'prove', 'survive']
	};
	let alignment = alignedValues[intent].includes(hero.mind.primaryValue) ? 12 : 0;
	alignment += alignedDrives[intent].includes(hero.mind.primaryDrive) ? 8 : 0;
	if (hero.mind.primaryValue === 'freedom' && ['work', 'prepare-tower'].includes(intent)) {
		alignment -= 10;
	}
	const needs = {
		train: Math.round((50 - hero.needs.fatigue) / 5),
		rest: Math.round((hero.needs.fatigue - 30) / 3),
		eat: Math.round((hero.needs.hunger - 25) / 3),
		work: Math.round((45 - hero.needs.fatigue) / 5),
		'prepare-tower': Math.round((50 - hero.needs.fatigue) / 6)
	}[intent];
	const toneScore = { neutral: 0, reassuring: 6, firm: -3, urgent: -1, apologetic: 3 }[
		tone ?? 'neutral'
	];
	return {
		authority: authorityScore,
		relationship: relationshipScore,
		personality,
		alignment,
		needs,
		tone: toneScore,
		total: authorityScore + relationshipScore + personality + alignment + needs + toneScore
	};
}

export function conversationVoice(
	hero: (
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
	)['heroes'][string]
): {
	prefix: string;
	question: string;
} {
	return {
		reserved: { prefix: 'Understood.', question: 'I will answer plainly.' },
		warm: { prefix: 'I hear you.', question: 'You can ask me directly.' },
		direct: { prefix: 'Be clear.', question: 'Ask what you need.' },
		formal: { prefix: 'Your words are noted.', question: 'I will give you a precise answer.' },
		wry: {
			prefix: 'That makes things interesting.',
			question: 'Go on—what do you really want to know?'
		},
		inquisitive: {
			prefix: 'I am listening.',
			question: 'I will answer—and I may have questions too.'
		}
	}[hero.mind.socialStyle];
}

export function buildConversationResponse(
	state:
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	command: MasterConverseCommand
): z.infer<typeof HeroConversationTurnSchema>['response'] {
	const hero = state.heroes[command.targetHeroId];
	if (!hero) throw new IllegalActionError(command.commandType);
	const voice = conversationVoice(hero);
	if (command.kind === 'say') {
		return {
			exactText: `${voice.prefix} What matters to me here is ${hero.mind.primaryValue}, and I am trying to ${hero.mind.primaryDrive}.`,
			publicReason: `The reply reflects a ${hero.mind.socialStyle} style, ${hero.mind.primaryValue}, and the drive to ${hero.mind.primaryDrive}.`,
			orderOutcome: null,
			orderScore: null,
			preferenceWeight: 0
		};
	}
	if (command.kind === 'ask') {
		const instinct =
			hero.mind.primaryValue === 'mastery'
				? 'train'
				: hero.mind.primaryValue === 'duty'
					? 'work'
					: 'rest';
		return {
			exactText: `${voice.question} I remember waking at this gate; for now, my next instinct is to ${ORDER_INTENT_LABELS[instinct]}.`,
			publicReason: `The answer is limited to witnessed memory and the hero's current ${hero.mind.primaryValue} value.`,
			orderOutcome: null,
			orderScore: null,
			preferenceWeight: 0
		};
	}
	const intent = command.orderIntent!;
	const orderScore = conversationOrderScore(state, hero, intent, command.tone);
	const orderOutcome: ConversationOrderOutcome =
		orderScore.total >= 24
			? 'accepted'
			: orderScore.total >= 10
				? 'negotiated'
				: orderScore.total >= 0
					? 'deferred'
					: 'refused';
	const exactText = {
		accepted: `${voice.prefix} I will ${ORDER_INTENT_LABELS[intent]}.`,
		negotiated: `${voice.prefix} I will try to ${ORDER_INTENT_LABELS[intent]}, but I will reassess if conditions change.`,
		deferred: `${voice.prefix} Not yet. I need the situation to improve before I ${ORDER_INTENT_LABELS[intent]}.`,
		refused: `${voice.prefix} No. I will not ${ORDER_INTENT_LABELS[intent]} under these conditions.`
	}[orderOutcome];
	return {
		exactText,
		publicReason: `The ${orderOutcome} outcome totals ${orderScore.total} from authority, relationship, personality, alignment, needs, and tone.`,
		orderOutcome,
		orderScore,
		preferenceWeight: orderOutcome === 'accepted' ? 24 : orderOutcome === 'negotiated' ? 12 : 0
	};
}

export function buildConversationSociety(
	state:
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	eventId: string,
	command: MasterConverseCommand
): {
	society: SocietyStateV3 | SocietyStateV4;
	conversationTurn: z.infer<typeof HeroConversationTurnSchema>;
} {
	const communication = buildCommunicativeSociety(state, eventId, {
		targetHeroId: command.targetHeroId,
		kind: command.kind === 'say' ? 'tell' : command.kind,
		topic: command.kind === 'order' ? 'daily-order' : 'open-conversation',
		exactText: command.exactText,
		tone: command.tone,
		delivery: command.delivery
	});
	const baseSociety =
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21
			? SocietyStateV4Schema.parse(communication.society)
			: SocietyStateV3Schema.parse(communication.society);
	const response = buildConversationResponse(state, command);
	const turnId = deterministicUuid(`${eventId}:conversation-turn`);
	const conversationTurn = HeroConversationTurnSchema.parse({
		turnId,
		sourceEventId: eventId,
		communicationActId: communication.communicativeAct.actId,
		masterId: state.master.masterId,
		heroId: command.targetHeroId,
		kind: command.kind,
		orderIntent: command.orderIntent,
		response,
		occurredAt: state.simulatedAt
	});
	const targetWitness = communication.communicativeAct.witnesses.find(
		(witness) => witness.heroId === command.targetHeroId
	);
	if (!targetWitness) {
		throw new ReplayIntegrityError('Conversation target did not witness speech', state.eventCursor);
	}
	const relationshipId = deterministicUuid(
		`${command.targetHeroId}:${state.master.masterId}:relationship`
	);
	const authorityId = deterministicUuid(
		`${command.targetHeroId}:${state.master.masterId}:authority`
	);
	const previousRelationship = baseSociety.relationships[relationshipId];
	const previousAuthority = baseSociety.authority[authorityId];
	if (!previousRelationship || !previousAuthority) {
		throw new ReplayIntegrityError('Conversation social view is missing', state.eventCursor);
	}
	const relationshipDeltas = {
		trust: command.tone === 'reassuring' ? 1 : 0,
		respect: response.orderOutcome === 'accepted' || response.orderOutcome === 'negotiated' ? 1 : 0,
		fear: command.tone === 'urgent' ? 1 : 0,
		affection: command.tone === 'apologetic' ? 1 : 0,
		resentment: response.orderOutcome === 'refused' && command.tone === 'firm' ? 1 : 0,
		debt: 0
	};
	const authorityDeltas = {
		competence: 0,
		provision: 0,
		trust: relationshipDeltas.trust,
		legitimacy: response.orderOutcome === 'accepted' ? 1 : 0,
		fear: relationshipDeltas.fear,
		strength: 0,
		consistency: response.orderOutcome === 'negotiated' ? 1 : 0
	};
	const evidenceSummary = response.publicReason;
	const societyCandidate = {
		...baseSociety,
		relationships: {
			...baseSociety.relationships,
			[relationshipId]: {
				...previousRelationship,
				dimensions: Object.fromEntries(
					Object.entries(previousRelationship.dimensions).map(([key, value]) => [
						key,
						clampSocial(value + relationshipDeltas[key as keyof typeof relationshipDeltas])
					])
				),
				updatedAt: state.simulatedAt,
				lastSourceEventId: eventId,
				evidence: [
					...previousRelationship.evidence.slice(-63),
					{
						sourceEventId: eventId,
						observationId: targetWitness.observationId,
						summary: evidenceSummary,
						deltas: relationshipDeltas
					}
				]
			}
		},
		authority: {
			...baseSociety.authority,
			[authorityId]: {
				...previousAuthority,
				dimensions: Object.fromEntries(
					Object.entries(previousAuthority.dimensions).map(([key, value]) => [
						key,
						clampSocial(value + authorityDeltas[key as keyof typeof authorityDeltas])
					])
				),
				updatedAt: state.simulatedAt,
				lastSourceEventId: eventId,
				evidence: [
					...previousAuthority.evidence.slice(-63),
					{
						sourceEventId: eventId,
						observationId: targetWitness.observationId,
						summary: evidenceSummary,
						deltas: authorityDeltas
					}
				]
			}
		},
		conversationTurns: {
			...baseSociety.conversationTurns,
			[turnId]: conversationTurn
		}
	};
	const society =
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21
			? SocietyStateV4Schema.parse(societyCandidate)
			: SocietyStateV3Schema.parse(societyCandidate);
	return { society, conversationTurn };
}

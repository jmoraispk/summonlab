import {
	CharacterManifestSchema,
	EngineSnapshotSchema,
	HERO_CONTEXT_POLICY_VERSION,
	HERO_DECISION_PACKET_VERSION,
	HERO_DECISION_RESPONSE_VERSION,
	HERO_MEMORY_RETRIEVAL_VERSION,
	HeroDecisionKindSchema,
	HeroDecisionPacketSchema,
	PlayerDirectiveSchema,
	type CharacterManifest,
	type EngineGameStateV8,
	type EngineGameStateV9,
	type EngineGameStateV10,
	type EngineGameStateV11,
	type EngineGameStateV12,
	type EngineGameStateV13,
	type EngineGameStateV15,
	type EngineGameStateV16,
	type EngineGameStateV17,
	type EngineGameStateV18,
	type EngineGameStateV19,
	type EngineSnapshot,
	type HeroDecisionKind,
	type HeroDecisionPacket,
	type PlayerDirective,
	type RetrievedMemory
} from '@summonlab/contracts';

import { decisionLegalActions, hashGameState } from './engine.js';
import { deterministicUuid, hashCanonical } from './hash.js';

export const DEFAULT_MEMORY_ITEM_LIMIT = 8;
export const DEFAULT_MEMORY_CHARACTER_LIMIT = 1_800;
type EngineKnowledgeState =
	| EngineGameStateV8
	| EngineGameStateV9
	| EngineGameStateV10
	| EngineGameStateV11
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV15
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19;

export interface AssembleHeroDecisionPacketInput {
	readonly snapshot: EngineSnapshot;
	readonly manifest: CharacterManifest;
	readonly heroId: string;
	readonly decisionKind: HeroDecisionKind;
	readonly directives?: readonly PlayerDirective[];
	readonly memoryItemLimit?: number;
	readonly memoryCharacterLimit?: number;
}

function compareNewestFirst(left: string, right: string): number {
	return Date.parse(right) - Date.parse(left);
}

function witnessedMasterRole(state: EngineKnowledgeState, heroId: string): boolean {
	return Object.values(state.society.beliefs).some(
		(belief) =>
			belief.holderHeroId === heroId &&
			belief.subjectId === state.master.masterId &&
			belief.predicate === 'claims-master-role' &&
			belief.status === 'held'
	);
}

function visibleEntities(state: EngineKnowledgeState, heroId: string, manifest: CharacterManifest) {
	const hero = state.heroes[heroId]!;
	const missionAttempt =
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19
			? state.mission.attempt
			: null;
	const missionPosition =
		missionAttempt &&
		['deployed', 'resolving', 'extraction'].includes(missionAttempt.status) &&
		missionAttempt.party.heroIds.includes(heroId)
			? missionAttempt.positions[heroId]
			: null;
	const entities: HeroDecisionPacket['environment']['visibleEntities'] = [
		{
			entityId: heroId,
			kind: 'self' as const,
			knownAs: manifest.displayName,
			lifeState: hero.lifeState
		}
	];
	if (
		missionPosition
			? missionAttempt?.positions[state.master.masterId] === missionPosition
			: state.master.location === hero.location
	) {
		entities.push({
			entityId: state.master.masterId,
			kind: 'person',
			knownAs: witnessedMasterRole(state, heroId) ? 'Master' : null,
			lifeState: state.master.lifeState
		});
	}
	for (const other of Object.values(state.heroes).sort((left, right) =>
		left.heroId.localeCompare(right.heroId)
	)) {
		if (
			other.heroId === heroId ||
			other.lifeState === 'synthesized' ||
			(missionPosition
				? missionAttempt?.positions[other.heroId] !== missionPosition
				: other.location !== hero.location)
		) {
			continue;
		}
		entities.push({
			entityId: other.heroId,
			kind: 'person',
			knownAs: null,
			lifeState: other.lifeState
		});
	}
	return entities;
}

function memoryCandidates(
	state: EngineKnowledgeState,
	heroId: string,
	relevantSubjectIds: ReadonlySet<string>,
	focusTags: ReadonlySet<string>
): RetrievedMemory[] {
	const hero = state.heroes[heroId]!;
	return Object.values(state.society.observations)
		.filter((observation) => observation.observerHeroId === heroId)
		.map((observation) => {
			const ageMinutes = Math.max(
				0,
				Math.floor((Date.parse(state.simulatedAt) - Date.parse(observation.observedAt)) / 60_000)
			);
			const salience =
				observation.kind === 'mission-death'
					? 50
					: observation.kind === 'mission-injury'
						? 42
						: observation.kind === 'first-ember-commitment'
							? 36
							: observation.kind === 'communication'
								? 30
								: 26;
			const recency = Math.max(0, 40 - Math.floor(ageMinutes / 180));
			const subjectRelevance = Math.min(
				40,
				observation.subjectIds.filter((subjectId) => relevantSubjectIds.has(subjectId)).length * 20
			);
			let locationRelevance =
				observation.kind === 'awakening' && hero.location === 'summoning-gate' ? 15 : 0;
			let communicationRelevance = 0;
			let exactCommunication: RetrievedMemory['exactCommunication'] = null;
			const reasons = [
				`${observation.kind.replaceAll('-', ' ')} salience ${salience}`,
				`recency ${recency}`
			];
			if (subjectRelevance > 0) reasons.push(`present subjects ${subjectRelevance}`);
			if (locationRelevance > 0) reasons.push(`current location ${locationRelevance}`);
			if (observation.kind === 'communication') {
				const act = state.society.communicativeActs[observation.communicationActId];
				const witness = act?.witnesses.find(
					(candidate) =>
						candidate.heroId === heroId && candidate.observationId === observation.observationId
				);
				if (!act || !witness) {
					throw new Error(
						`Communication memory ${observation.observationId} lacks witness provenance`
					);
				}
				locationRelevance = act.location === hero.location ? 15 : 0;
				communicationRelevance = witness.perception === 'addressed' ? 25 : 15;
				if (focusTags.has(act.topic)) communicationRelevance += 10;
				reasons.push(`${witness.perception} words ${communicationRelevance}`);
				if (locationRelevance > 0) reasons.push(`same communication location ${locationRelevance}`);
				exactCommunication = {
					actId: act.actId,
					speakerId: act.speakerId,
					kind: act.kind,
					topic: act.topic,
					exactText: act.exactText,
					tone: act.tone,
					delivery: act.delivery,
					perception: witness.perception
				};
			}
			const characterCost =
				observation.summary.length + (exactCommunication?.exactText.length ?? 0);
			return {
				memoryId: observation.observationId,
				observationId: observation.observationId,
				sourceEventId: observation.sourceEventId,
				kind: observation.kind,
				occurredAt: observation.observedAt,
				summary: observation.summary,
				subjectIds: [...observation.subjectIds],
				exactCommunication,
				score: {
					total: salience + recency + subjectRelevance + locationRelevance + communicationRelevance,
					salience,
					recency,
					subjectRelevance,
					locationRelevance,
					communicationRelevance
				},
				reasons,
				characterCost
			};
		});
}

function retrieveMemories(
	state: EngineKnowledgeState,
	heroId: string,
	relevantSubjectIds: ReadonlySet<string>,
	focusTags: ReadonlySet<string>,
	maxItems: number,
	maxCharacters: number
) {
	const candidates = memoryCandidates(state, heroId, relevantSubjectIds, focusTags).sort(
		(left, right) =>
			right.score.total - left.score.total ||
			compareNewestFirst(left.occurredAt, right.occurredAt) ||
			left.memoryId.localeCompare(right.memoryId)
	);
	const memories: RetrievedMemory[] = [];
	let selectedCharacters = 0;
	for (const candidate of candidates) {
		if (memories.length >= maxItems) break;
		if (selectedCharacters + candidate.characterCost > maxCharacters) continue;
		memories.push(candidate);
		selectedCharacters += candidate.characterCost;
	}
	return {
		policyVersion: HERO_MEMORY_RETRIEVAL_VERSION,
		candidateCount: candidates.length,
		selectedCount: memories.length,
		maxItems,
		maxCharacters,
		selectedCharacters,
		memories
	};
}

function applicableDirectives(
	state: EngineKnowledgeState,
	heroId: string,
	directives: readonly PlayerDirective[]
) {
	return directives
		.filter((directive) => {
			if (
				directive.runId !== state.runId ||
				directive.revokedAt !== null ||
				(directive.recipientIds.length > 0 && !directive.recipientIds.includes(heroId)) ||
				directive.witnessEventId === null ||
				(directive.expiresAt !== null &&
					Date.parse(directive.expiresAt) <= Date.parse(state.simulatedAt))
			) {
				return false;
			}
			return Object.values(state.society.observations).some(
				(observation) =>
					observation.observerHeroId === heroId &&
					observation.sourceEventId === directive.witnessEventId
			);
		})
		.sort((left, right) =>
			left.createdAt === right.createdAt
				? left.directiveId.localeCompare(right.directiveId)
				: left.createdAt.localeCompare(right.createdAt)
		)
		.slice(-16);
}

const CONVERSATION_INTENT_TERMS = Object.freeze({
	train: ['train', 'training', 'practice'],
	rest: ['rest', 'sleep', 'recover'],
	eat: ['eat', 'meal', 'food'],
	work: ['work', 'duty', 'repair'],
	'prepare-tower': ['tower', 'train', 'prepare']
} as const);

function conversationDirectives(
	state:
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19,
	heroId: string
): PlayerDirective[] {
	return Object.values(state.society.conversationTurns)
		.filter(
			(turn) =>
				turn.heroId === heroId &&
				turn.orderIntent !== null &&
				(turn.response.orderOutcome === 'accepted' || turn.response.orderOutcome === 'negotiated')
		)
		.sort((left, right) =>
			left.occurredAt === right.occurredAt
				? left.turnId.localeCompare(right.turnId)
				: left.occurredAt.localeCompare(right.occurredAt)
		)
		.slice(-16)
		.map((turn) => {
			const act = state.society.communicativeActs[turn.communicationActId];
			if (!act || !turn.orderIntent) {
				throw new Error(`Conversation directive ${turn.turnId} lacks witnessed speech`);
			}
			return {
				directiveId: deterministicUuid(`${turn.turnId}:conversation-directive`),
				runId: state.runId,
				authorId: state.master.masterId,
				text: act.exactText,
				scope: 'day' as const,
				recipientIds: [heroId],
				witnessEventId: turn.sourceEventId,
				priorities: [
					`conversation-weight-${turn.response.preferenceWeight}`,
					...CONVERSATION_INTENT_TERMS[turn.orderIntent]
				],
				createdAt: turn.occurredAt,
				expiresAt: null,
				revokedAt: null
			};
		});
}

function storedDirectives(
	state:
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19,
	decisionKind: HeroDecisionKind
): PlayerDirective[] {
	return Object.values(state.society.directives)
		.filter(
			(directive) =>
				directive.status === 'active' &&
				(decisionKind === 'mission-action' || directive.scope !== 'mission')
		)
		.map((directive) =>
			PlayerDirectiveSchema.parse({
				directiveId: directive.directiveId,
				runId: directive.runId,
				authorId: directive.authorId,
				text: directive.text,
				scope: directive.scope,
				recipientIds: directive.recipientIds,
				witnessEventId: directive.witnessEventId,
				priorities: directive.priorities,
				createdAt: directive.createdAt,
				expiresAt: directive.expiresAt,
				revokedAt: directive.revokedAt
			})
		);
}

function unsignedPacket(packet: HeroDecisionPacket): Omit<HeroDecisionPacket, 'packetHash'> {
	const unsigned: Partial<HeroDecisionPacket> = { ...packet };
	delete unsigned.packetHash;
	return unsigned as Omit<HeroDecisionPacket, 'packetHash'>;
}

export function hashHeroDecisionPacket(packet: HeroDecisionPacket): string {
	return hashCanonical(unsignedPacket(packet));
}

export function verifyHeroDecisionPacket(packet: HeroDecisionPacket): boolean {
	return hashHeroDecisionPacket(packet) === packet.packetHash;
}

export function assembleHeroDecisionPacket(
	input: AssembleHeroDecisionPacketInput
): HeroDecisionPacket {
	const snapshot = EngineSnapshotSchema.parse(input.snapshot);
	if (
		snapshot.state.schemaVersion !== 8 &&
		snapshot.state.schemaVersion !== 9 &&
		snapshot.state.schemaVersion !== 10 &&
		snapshot.state.schemaVersion !== 11 &&
		snapshot.state.schemaVersion !== 12 &&
		snapshot.state.schemaVersion !== 13 &&
		snapshot.state.schemaVersion !== 15 &&
		snapshot.state.schemaVersion !== 16 &&
		snapshot.state.schemaVersion !== 17 &&
		snapshot.state.schemaVersion !== 18 &&
		snapshot.state.schemaVersion !== 19
	) {
		throw new Error('Hero decision packets require witnessed knowledge from engine-v8 or newer');
	}
	const state = snapshot.state;
	if (hashGameState(state) !== snapshot.stateHash) {
		throw new Error('Decision packet state hash does not match the supplied snapshot');
	}
	const manifest = CharacterManifestSchema.parse(input.manifest);
	const hero = state.heroes[input.heroId];
	if (!hero || hero.lifeState !== 'active') {
		throw new Error(`Active decision hero not found: ${input.heroId}`);
	}
	if (manifest.characterId !== input.heroId || hashCanonical(manifest) !== hero.manifestHash) {
		throw new Error('Decision identity does not match the engine manifest hash');
	}
	const decisionKind = HeroDecisionKindSchema.parse(input.decisionKind);
	const actions = [...decisionLegalActions(state, input.heroId)].sort((left, right) =>
		left.actionId.localeCompare(right.actionId)
	);
	if (actions.length === 0) {
		throw new Error(`No legal decision boundary exists for hero ${input.heroId}`);
	}
	const visible = visibleEntities(state, input.heroId, manifest);
	const relevantSubjectIds = new Set(visible.map((entity) => entity.entityId));
	const focusTags = new Set(actions.flatMap((action) => action.tags));
	const itemLimit = Math.max(1, Math.min(32, input.memoryItemLimit ?? DEFAULT_MEMORY_ITEM_LIMIT));
	const characterLimit = Math.max(
		1,
		Math.min(20_000, input.memoryCharacterLimit ?? DEFAULT_MEMORY_CHARACTER_LIMIT)
	);
	const beliefs = Object.values(state.society.beliefs)
		.filter((belief) => belief.holderHeroId === input.heroId)
		.sort(
			(left, right) =>
				Number(relevantSubjectIds.has(right.subjectId)) -
					Number(relevantSubjectIds.has(left.subjectId)) ||
				right.confidence - left.confidence ||
				compareNewestFirst(left.learnedAt, right.learnedAt) ||
				left.beliefId.localeCompare(right.beliefId)
		)
		.slice(0, 32)
		.map((belief) => ({
			beliefId: belief.beliefId,
			subjectId: belief.subjectId,
			predicate: belief.predicate,
			object: belief.object,
			confidence: belief.confidence,
			status: belief.status,
			learnedAt: belief.learnedAt,
			provenance: belief.provenance
		}));
	const relationships = Object.values(state.society.relationships)
		.filter(
			(relationship) =>
				relationship.fromHeroId === input.heroId && relevantSubjectIds.has(relationship.toEntityId)
		)
		.sort((left, right) => left.toEntityId.localeCompare(right.toEntityId))
		.slice(0, 32)
		.map((relationship) => ({
			relationshipId: relationship.relationshipId,
			toEntityId: relationship.toEntityId,
			dimensions: relationship.dimensions,
			updatedAt: relationship.updatedAt,
			latestEvidence: relationship.evidence.at(-1)?.summary ?? null
		}));
	const authority = Object.values(state.society.authority)
		.filter(
			(view) => view.observerHeroId === input.heroId && relevantSubjectIds.has(view.subjectId)
		)
		.sort((left, right) => left.subjectId.localeCompare(right.subjectId))
		.slice(0, 8)
		.map((view) => ({
			authorityId: view.authorityId,
			subjectId: view.subjectId,
			dimensions: view.dimensions,
			updatedAt: view.updatedAt,
			latestEvidence: view.evidence.at(-1)?.summary ?? null
		}));
	const promises = Object.values(state.society.promises)
		.filter((promise) => promise.promiseeHeroIds.includes(input.heroId))
		.sort((left, right) =>
			left.createdAt === right.createdAt
				? left.promiseId.localeCompare(right.promiseId)
				: left.createdAt.localeCompare(right.createdAt)
		)
		.slice(0, 32)
		.map((promise) => ({
			promiseId: promise.promiseId,
			promisorId: promise.promisorId,
			terms: promise.terms,
			status: promise.status,
			createdAt: promise.createdAt
		}));
	const currentBuilding = Object.values(state.settlement.buildings).find(
		(building) => building.buildingId === hero.location
	);
	const missionAttempt =
		(state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19) &&
		decisionKind === 'mission-action' &&
		state.mission.attempt?.party.heroIds.includes(input.heroId) &&
		['deployed', 'resolving'].includes(state.mission.attempt.status)
			? state.mission.attempt
			: null;
	const portalMissionAttempt =
		state.schemaVersion === 15 && missionAttempt ? state.mission.attempt : null;
	const missionPositionNodeId = missionAttempt?.positions[input.heroId] ?? null;
	const missionBinding =
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19
			? state.mission.binding
			: null;
	const packetId = deterministicUuid(
		`${HERO_DECISION_PACKET_VERSION}:${state.runId}:${input.heroId}:${decisionKind}:${snapshot.stateHash}`
	);
	const {
		characterId,
		displayName,
		rarityStars,
		adultAge,
		genderPresentation,
		pronouns,
		bodyFrame,
		bodyBuild,
		heightCm,
		physiology,
		phenotype,
		voice,
		posture,
		handedness,
		visualTraits
	} = manifest;
	const packetWithoutHash = {
		packetVersion: HERO_DECISION_PACKET_VERSION,
		contextPolicyVersion: HERO_CONTEXT_POLICY_VERSION,
		packetId,
		runId: state.runId,
		heroId: input.heroId,
		decisionKind,
		assembledAtGameTime: state.simulatedAt,
		world: {
			stateVersion: state.version,
			eventCursor: state.eventCursor,
			stateHash: snapshot.stateHash,
			contentVersion: state.contentVersion
		},
		identity: {
			profile: {
				characterId,
				displayName,
				rarityStars,
				adultAge,
				genderPresentation,
				pronouns,
				bodyFrame,
				bodyBuild,
				heightCm,
				...(physiology ? { physiology } : {}),
				phenotype,
				voice,
				posture,
				handedness,
				visualTraits
			},
			manifestHash: hero.manifestHash,
			mind: hero.mind
		},
		self: {
			lifeState: hero.lifeState,
			location: missionAttempt ? ('tower' as const) : hero.location,
			locationNodeId: missionPositionNodeId ?? hero.locationNodeId,
			destination: hero.destination,
			health: hero.health,
			maxHealth: hero.maxHealth,
			needs: hero.needs,
			injuries: hero.injuries,
			progression: hero.progression,
			items: Object.values(state.items)
				.filter((item) => item.ownerId === input.heroId)
				.sort((left, right) => left.itemId.localeCompare(right.itemId)),
			assignment: hero.assignment,
			habit: hero.habit,
			dailyPlan: hero.dailyPlan,
			currentActivity: hero.currentActivity,
			currentTravel: hero.currentTravel,
			currentRoutine: hero.currentRoutine
		},
		environment: {
			location: missionAttempt ? ('tower' as const) : hero.location,
			locationNodeId: missionPositionNodeId ?? hero.locationNodeId,
			visibleEntities: visible,
			currentBuilding:
				!missionAttempt && currentBuilding
					? { buildingId: currentBuilding.buildingId, powerState: currentBuilding.powerState }
					: null,
			...(missionAttempt
				? {
						mission: {
							missionId: missionBinding!.missionId,
							attemptId: missionAttempt.attemptId,
							roundNumber: missionAttempt.turnState.roundNumber,
							positionNodeId: missionPositionNodeId!,
							visitedNodeIds: missionAttempt.knowledge.visitedNodeIds,
							discoveryIds: missionAttempt.knowledge.discoveryIds,
							objectiveId: missionAttempt.turnState.objective.objectiveId,
							objectiveStatus:
								state.schemaVersion === 15
									? missionAttempt.turnState.objective.status === 'delivered'
										? 'delivered'
										: 'available'
									: missionAttempt.turnState.objective.status,
							objectiveCarrierId:
								'carrierId' in missionAttempt.turnState.objective
									? missionAttempt.turnState.objective.carrierId
									: null,
							...(portalMissionAttempt
								? {
										portal: {
											roundsRemaining: portalMissionAttempt.turnState.portal.roundsRemaining,
											pressureStage: portalMissionAttempt.turnState.portal.pressureStage,
											extractionQuota: portalMissionAttempt.turnState.portal.extractionQuota,
											minedAmount: portalMissionAttempt.turnState.objective.minedAmount,
											cargoAmount:
												portalMissionAttempt.turnState.portal.cargo[input.heroId]!.amount,
											cargoCapacity:
												portalMissionAttempt.turnState.portal.cargo[input.heroId]!.capacity,
											deposits: Object.values(portalMissionAttempt.turnState.portal.deposits)
												.sort((left, right) => left.depositId.localeCompare(right.depositId))
												.map((deposit) => ({
													depositId: deposit.depositId,
													nodeId: deposit.nodeId,
													remainingAmount: deposit.remainingAmount
												}))
										}
									}
								: {})
						}
					}
				: {}),
			affordanceActionIds: actions.map((action) => action.actionId)
		},
		knowledge: {
			beliefs,
			memoryRetrieval: retrieveMemories(
				state,
				input.heroId,
				relevantSubjectIds,
				focusTags,
				itemLimit,
				characterLimit
			)
		},
		social: { relationships, authority, promises },
		activeDirectives: applicableDirectives(state, input.heroId, [
			...(input.directives ?? []),
			...(state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19
				? storedDirectives(state, input.decisionKind)
				: []),
			...(state.schemaVersion === 9 ||
			state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19
				? conversationDirectives(state, input.heroId)
				: [])
		]),
		legalActions: actions,
		legalActionHash: hashCanonical(actions),
		responseContract: {
			schemaVersion: HERO_DECISION_RESPONSE_VERSION,
			instruction: 'Choose exactly one supplied legal action. The engine resolves it.' as const,
			maxTargetIds: 4 as const,
			maxMemoryCandidateIds: 6 as const
		}
	};
	const packet = HeroDecisionPacketSchema.parse({
		...packetWithoutHash,
		packetHash: hashCanonical(packetWithoutHash)
	});
	if (!verifyHeroDecisionPacket(packet))
		throw new Error('Decision packet hash failed verification');
	return packet;
}

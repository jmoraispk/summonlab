import { RewardDeltaSchema, type EngineCommit, type EngineReplayReport } from '@summonlab/contracts';

import type {
	PublicActionSource,
	PublicCombatModeBinding,
	PublicEngineCommitReceipt,
	PublicEngineEvent,
	PublicEngineReplayReport,
	PublicEngineState,
	PublicEventAction,
	PublicEventInput,
	PublicHeroControls,
	PublicMasterControl,
	PublicMissionAction,
	PublicMissionAttempt,
	PublicMissionRound,
	PublicMissionTurnState
} from '$lib/public-engine';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as UnknownRecord)
		: {};
}

function records(value: unknown): UnknownRecord[] {
	return Array.isArray(value) ? value.map(record) : [];
}

function string(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function number(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boolean(value: unknown): boolean {
	return value === true;
}

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function publicSource(source: PublicEventInput['source']): PublicActionSource {
	return { source: source.source, timing: source.timing };
}

function publicCombatModeBinding(value: unknown): PublicCombatModeBinding | null {
	const binding = record(value);
	if (!binding.modeId || !binding.rulesVersion || !binding.contentHash || !binding.boundAt) return null;
	return {
		modeId: string(binding.modeId),
		rulesVersion: string(binding.rulesVersion),
		contentHash: string(binding.contentHash),
		boundAt: string(binding.boundAt)
	};
}

function publicMissionAction(value: unknown): PublicMissionAction {
	const action = record(value);
	return {
		actorId: string(action.actorId),
		actorKind: action.actorKind === 'master' ? 'master' : 'hero',
		actionId: string(action.actionId),
		publicIntent: string(action.publicIntent),
		outcome: action.outcome === 'superseded' ? 'superseded' : 'applied',
		fromNodeId: string(action.fromNodeId),
		toNodeId: string(action.toNodeId),
		targetId: nullableString(action.targetId),
		discoveryIds: strings(action.discoveryIds),
		objectiveTransition: nullableString(action.objectiveTransition),
		effectIds: strings(action.effectIds),
		summary: string(action.summary)
	};
}

function publicMonsterAction(value: unknown) {
	const action = record(value);
	return {
		monsterId: string(action.monsterId),
		actionId: string(action.actionId),
		kind: string(action.kind),
		outcome: action.outcome === 'superseded' ? ('superseded' as const) : ('applied' as const),
		fromNodeId: string(action.fromNodeId),
		toNodeId: string(action.toNodeId),
		targetId: nullableString(action.targetId),
		effectIds: strings(action.effectIds),
		summary: string(action.summary)
	};
}

function publicRound(value: unknown): PublicMissionRound {
	const round = record(value);
	const portalWindow = record(round.portalWindow);
	return {
		roundVersion: string(round.roundVersion),
		roundNumber: number(round.roundNumber),
		environmentEventIds: strings(round.environmentEventIds),
		initiativeOrder: strings(round.initiativeOrder),
		actions: records(round.actions).map(publicMissionAction),
		monsterActions: records(round.monsterActions).map(publicMonsterAction),
		statusAfter: string(round.statusAfter),
		...(Object.keys(portalWindow).length > 0
			? {
					portalWindow: {
						roundsRemainingBefore: number(portalWindow.roundsRemainingBefore),
						roundsRemainingAfter: number(portalWindow.roundsRemainingAfter),
						pressureBefore: string(portalWindow.pressureBefore),
						pressureAfter: string(portalWindow.pressureAfter)
					}
				}
			: {}),
		...(Array.isArray(round.oreLedgerEntryIds)
			? { oreLedgerEntryIds: strings(round.oreLedgerEntryIds) }
			: {})
	};
}

function publicObjective(value: unknown): PublicMissionTurnState['objective'] {
	const source = record(value);
	return {
		objectiveId: string(source.objectiveId),
		status: string(source.status),
		...('carrierId' in source ? { carrierId: nullableString(source.carrierId) } : {}),
		...('recoveredOnRound' in source
			? { recoveredOnRound: source.recoveredOnRound === null ? null : number(source.recoveredOnRound) }
			: {}),
		...('deliveredOnRound' in source
			? { deliveredOnRound: source.deliveredOnRound === null ? null : number(source.deliveredOnRound) }
			: {}),
		...(typeof source.quota === 'number' ? { quota: source.quota } : {}),
		...(typeof source.minedAmount === 'number' ? { minedAmount: source.minedAmount } : {}),
		...('quotaReachedOnRound' in source
			? {
					quotaReachedOnRound:
						source.quotaReachedOnRound === null ? null : number(source.quotaReachedOnRound)
				}
			: {})
	};
}

function publicPortal(value: unknown): NonNullable<PublicMissionTurnState['portal']> {
	const portal = record(value);
	return {
		portalVersion: string(portal.portalVersion),
		portalId: string(portal.portalId),
		durationRounds: number(portal.durationRounds),
		roundsRemaining: number(portal.roundsRemaining),
		warningAtRemainingRounds: number(portal.warningAtRemainingRounds),
		criticalAtRemainingRounds: number(portal.criticalAtRemainingRounds),
		pressureStage: string(portal.pressureStage),
		extractionQuota: number(portal.extractionQuota),
		cargoCapacityPerActor: number(portal.cargoCapacityPerActor),
		deposits: Object.fromEntries(
			Object.entries(record(portal.deposits)).map(([id, raw]) => {
				const deposit = record(raw);
				return [
					id,
					{
						depositId: string(deposit.depositId),
						nodeId: string(deposit.nodeId),
						resource: string(deposit.resource),
						initialAmount: number(deposit.initialAmount),
						remainingAmount: number(deposit.remainingAmount),
						mineAmountPerAction: number(deposit.mineAmountPerAction)
					}
				];
			})
		),
		cargo: Object.fromEntries(
			Object.entries(record(portal.cargo)).map(([id, raw]) => {
				const cargo = record(raw);
				return [
					id,
					{
						actorId: string(cargo.actorId),
						resource: string(cargo.resource),
						amount: number(cargo.amount),
						capacity: number(cargo.capacity)
					}
				];
			})
		),
		oreLedger: records(portal.oreLedger).map((entry) => ({
			entryId: string(entry.entryId),
			sequence: number(entry.sequence),
			roundNumber: number(entry.roundNumber),
			kind: string(entry.kind),
			actorId: string(entry.actorId),
			depositId: nullableString(entry.depositId),
			nodeId: string(entry.nodeId),
			amount: number(entry.amount),
			cargoBefore: number(entry.cargoBefore),
			cargoAfter: number(entry.cargoAfter),
			depositBefore: entry.depositBefore === null ? null : number(entry.depositBefore),
			depositAfter: entry.depositAfter === null ? null : number(entry.depositAfter),
			settlementBefore: entry.settlementBefore === null ? null : number(entry.settlementBefore),
			settlementAfter: entry.settlementAfter === null ? null : number(entry.settlementAfter)
		})),
		extractedAmount: number(portal.extractedAmount),
		extractionCredited: boolean(portal.extractionCredited)
	};
}

function publicTurnState(value: unknown): PublicMissionTurnState {
	const turn = record(value);
	return {
		turnVersion: string(turn.turnVersion),
		maximumRounds: number(turn.maximumRounds),
		roundNumber: number(turn.roundNumber),
		objective: publicObjective(turn.objective),
		monsters: Object.fromEntries(
			Object.entries(record(turn.monsters)).map(([id, raw]) => {
				const monster = record(raw);
				return [
					id,
					{
						monsterId: string(monster.monsterId),
						dutySlotId: string(monster.dutySlotId),
						label: string(monster.label),
						ordinal: number(monster.ordinal),
						nodeId: string(monster.nodeId),
						status: string(monster.status),
						vitality: number(monster.vitality),
						maximumVitality: number(monster.maximumVitality),
						alertState: string(monster.alertState),
						defeatedOnRound: monster.defeatedOnRound === null ? null : number(monster.defeatedOnRound),
						lastActionId: nullableString(monster.lastActionId)
					}
				];
			})
		),
		partyGuard: Object.fromEntries(
			Object.entries(record(turn.partyGuard)).map(([id, raw]) => {
				const guard = record(raw);
				return [
					id,
					{
						actorId: string(guard.actorId),
						guard: number(guard.guard),
						maximumGuard: number(guard.maximumGuard),
						status: string(guard.status),
						lastChangedOnRound: number(guard.lastChangedOnRound)
					}
				];
			})
		),
		arena: (() => {
			const arena = record(turn.arena);
			return {
				furnaceState: string(arena.furnaceState),
				coolingControlNodeId: nullableString(arena.coolingControlNodeId),
				coolingControlExposed: boolean(arena.coolingControlExposed)
			};
		})(),
		currentThreatIntents: records(turn.currentThreatIntents).map((intent) => ({
			monsterId: string(intent.monsterId),
			actionId: string(intent.actionId),
			kind: string(intent.kind),
			fromNodeId: string(intent.fromNodeId),
			toNodeId: string(intent.toNodeId),
			targetId: nullableString(intent.targetId),
			telegraph: string(intent.telegraph),
			anticipatedEffect: string(intent.anticipatedEffect)
		})),
		rounds: records(turn.rounds).map(publicRound),
		...(turn.portal ? { portal: publicPortal(turn.portal) } : {})
	};
}

function publicMissionAttempt(value: unknown): PublicMissionAttempt | null {
	if (!value) return null;
	const attempt = record(value);
	const party = record(attempt.party);
	const knowledge = record(attempt.knowledge);
	const binding = publicCombatModeBinding(attempt.combatModeBinding);
	return {
		attemptId: string(attempt.attemptId),
		ordinal: number(attempt.ordinal),
		status: string(attempt.status),
		party: {
			masterId: string(party.masterId),
			heroIds: strings(party.heroIds),
			memberIds: strings(party.memberIds)
		},
		entryNodeId: string(attempt.entryNodeId),
		extractionNodeId: string(attempt.extractionNodeId),
		positions: Object.fromEntries(
			Object.entries(record(attempt.positions)).flatMap(([id, node]) =>
				typeof node === 'string' ? [[id, node]] : []
			)
		),
		knowledge: {
			discoveryIds: strings(knowledge.discoveryIds),
			visitedNodeIds: strings(knowledge.visitedNodeIds)
		},
		completedObjectiveIds: strings(attempt.completedObjectiveIds),
		preparedAt: string(attempt.preparedAt),
		deployedAt: nullableString(attempt.deployedAt),
		extractionOpenedAt: nullableString(attempt.extractionOpenedAt),
		endedAt: nullableString(attempt.endedAt),
		outcome: nullableString(attempt.outcome),
		turnState: publicTurnState(attempt.turnState),
		...(binding ? { combatModeBinding: binding } : {})
	};
}

function publicAftermath(value: unknown) {
	const aftermath = record(value);
	return {
		aftermathVersion: string(aftermath.aftermathVersion),
		activeAttemptId: nullableString(aftermath.activeAttemptId),
		consequences: records(aftermath.consequences).map((raw) => {
			const injury = record(raw.injury);
			const wear = record(raw.itemWear);
			return {
				consequenceId: string(raw.consequenceId),
				roundNumber: number(raw.roundNumber),
				nodeId: string(raw.nodeId),
				fatal: boolean(raw.fatal),
				summary: string(raw.summary),
				healthBefore: number(raw.healthBefore),
				healthAfter: number(raw.healthAfter),
				injury: raw.injury ? { kind: string(injury.kind) } : null,
				itemWear: raw.itemWear
					? {
							durabilityBefore: number(wear.durabilityBefore),
							durabilityAfter: number(wear.durabilityAfter)
						}
					: null,
				witnesses: records(raw.witnesses).map((witness) => ({
					heroId: string(witness.heroId)
				}))
			};
		}),
		archives: records(aftermath.archives).map((raw) => {
			const binding = record(raw.binding);
			return {
				attemptId: string(raw.attemptId),
				ordinal: number(raw.ordinal),
				outcome: string(raw.outcome),
				finalRoundNumber: number(raw.finalRoundNumber),
				binding: { missionId: string(binding.missionId) },
				consequences: records(raw.consequences).map((entry) => ({
					consequenceId: string(entry.consequenceId)
				}))
			};
		})
	};
}

function publicHero(value: unknown) {
	const hero = record(value);
	const progression = record(hero.progression);
	const equipment = record(hero.equipment);
	const profile = record(hero.capabilityProfile);
	const attributes = record(profile.attributes);
	return {
		heroId: string(hero.heroId),
		lifeState: string(hero.lifeState),
		location: string(hero.location),
		destination: nullableString(hero.destination),
		health: number(hero.health),
		maxHealth: number(hero.maxHealth),
		mana: typeof hero.mana === 'number' ? hero.mana : null,
		maxMana: typeof hero.maxMana === 'number' ? hero.maxMana : null,
		manifestHash: string(hero.manifestHash),
		progression: {
			stars: number(progression.stars),
			level: number(progression.level),
			experience: number(progression.experience)
		},
		equipment: {
			mainHand: nullableString(equipment.mainHand),
			offHand: nullableString(equipment.offHand),
			head: nullableString(equipment.head),
			torso: nullableString(equipment.torso),
			legs: nullableString(equipment.legs),
			boots: nullableString(equipment.boots)
		},
		...(profile.profileVersion
			? {
					capabilityProfile: {
						profileVersion: string(profile.profileVersion),
						attributes: {
							might: number(attributes.might),
							vitality: number(attributes.vitality),
							agility: number(attributes.agility),
							spirit: number(attributes.spirit)
						}
					}
				}
			: {})
	};
}

function publicItem(value: unknown) {
	const item = record(value);
	return {
		itemId: string(item.itemId),
		definitionId: string(item.definitionId),
		ownerId: nullableString(item.ownerId),
		equippedById: nullableString(item.equippedById),
		finalRank: string(item.finalRank),
		durability: number(item.durability),
		maxDurability: number(item.maxDurability)
	};
}

function publicMasterControl(value: unknown): PublicMasterControl | null {
	if (!value) return null;
	const control = record(value);
	const active = record(control.activeDecision);
	const fallback = record(control.fallback);
	const safety = record(fallback.safetyStops);
	const last = record(control.lastResolution);
	const lastSource = record(last.source);
	const selection = record(last.fallbackSelection);
	const priorityIds = new Set([
		'protect-self',
		'protect-party',
		'focus-objective',
		'seek-secrets',
		'conserve-resources'
	]);
	return {
		timing: string(control.timing),
		countdownSeconds: number(control.countdownSeconds),
		revision: number(control.revision),
		decisionOrdinal: number(control.decisionOrdinal),
		activeDecision: control.activeDecision
			? {
					decisionId: string(active.decisionId),
					ordinal: number(active.ordinal),
					timing: string(active.timing),
					openedAt: string(active.openedAt),
					expiresAt: nullableString(active.expiresAt)
				}
			: null,
		fallback: control.fallback
			? {
					configurationVersion: string(fallback.configurationVersion),
					policy: fallback.policy === 'random' ? 'random' : 'directed',
					directionId: string(fallback.directionId),
					directionText: string(fallback.directionText),
					priorities: strings(fallback.priorities).filter(
						(value): value is 'protect-self' | 'protect-party' | 'focus-objective' | 'seek-secrets' | 'conserve-resources' =>
							priorityIds.has(value)
					),
					protectedHeroId: nullableString(fallback.protectedHeroId),
					safetyStops: {
						beforeIrreversibleAction: boolean(safety.beforeIrreversibleAction),
						masterHealthThreshold:
							safety.masterHealthThreshold === null ? null : number(safety.masterHealthThreshold),
						whenUnclassified: boolean(safety.whenUnclassified),
						maximumConsecutiveFallbacks:
							safety.maximumConsecutiveFallbacks === null
								? null
								: number(safety.maximumConsecutiveFallbacks)
					}
				}
			: null,
		consecutiveFallbacks: number(control.consecutiveFallbacks),
		lastResolution: control.lastResolution
			? {
					outcome: string(last.outcome),
					expiryOutcome: string(last.expiryOutcome),
					source: {
						source:
							lastSource.source === 'manual' ||
							lastSource.source === 'directed' ||
							lastSource.source === 'model' ||
							lastSource.source === 'habit' ||
							lastSource.source === 'scripted' ||
							lastSource.source === 'random' ||
							lastSource.source === 'system' ||
							lastSource.source === 'countdown' ||
							lastSource.source === 'continuous' ||
							lastSource.source === 'step'
								? lastSource.source
								: 'system',
						timing:
							lastSource.timing === 'wait' ||
							lastSource.timing === 'countdown' ||
							lastSource.timing === 'continuous' ||
							lastSource.timing === 'step'
								? lastSource.timing
								: 'step'
					},
					fallbackSelection: last.fallbackSelection
						? {
								policy: string(selection.policy),
								classification: string(selection.classification),
								selectedActionId: nullableString(selection.selectedActionId),
								safetyStopReason: nullableString(selection.safetyStopReason),
								explanation: string(selection.explanation)
							}
						: null
				}
			: null
	};
}

export function projectEngineStateForPublic(value: unknown): PublicEngineState {
	const state = record(value);
	const master = record(state.master);
	const settlement = record(state.settlement);
	const mission = record(state.mission);
	const binding = record(mission.binding);
	return {
		schemaVersion: number(state.schemaVersion),
		runId: string(state.runId),
		contentVersion: string(state.contentVersion),
		status: string(state.status),
		version: number(state.version),
		eventCursor: number(state.eventCursor),
		simulatedAt: string(state.simulatedAt),
		master: {
			masterId: string(master.masterId),
			lifeState: string(master.lifeState, 'alive'),
			location: string(master.location),
			health: number(master.health, 100),
			maxHealth: number(master.maxHealth, 100),
			injuries: records(master.injuries).map((injury) => ({
				injuryId: string(injury.injuryId),
				kind: string(injury.kind),
				severity: number(injury.severity),
				inflictedAt: string(injury.inflictedAt)
			}))
		},
		heroes: Object.fromEntries(
			Object.entries(record(state.heroes)).map(([id, hero]) => [id, publicHero(hero)])
		),
		items: Object.fromEntries(
			Object.entries(record(state.items)).map(([id, item]) => [id, publicItem(item)])
		),
		settlement: {
			resources: Object.fromEntries(
				Object.entries(record(settlement.resources)).flatMap(([key, amount]) =>
					typeof amount === 'number' ? [[key, amount]] : []
				)
			)
		},
		mission: {
			binding: {
				missionId: string(binding.missionId, 'unavailable'),
				contentVersion: string(binding.contentVersion, 'unavailable'),
				contentHash: string(binding.contentHash, '0'.repeat(64))
			},
			availableMissionIds: strings(mission.availableMissionIds),
			attemptCount: number(mission.attemptCount),
			attempt: publicMissionAttempt(mission.attempt),
			...(mission.aftermath ? { aftermath: publicAftermath(mission.aftermath) } : {})
		},
		masterControl: publicMasterControl(state.masterControl)
	};
}

function heroControls(report: EngineReplayReport): PublicHeroControls {
	const heroId = Object.keys(report.snapshot.state.heroes)[0];
	const actions = heroId ? (report.legalActionsByActor[heroId] ?? []) : [];
	const has = (actionId: string) => actions.some((action) => action.actionId === actionId);
	const equipAction = actions.find((action) => action.actionId.startsWith('hero.equip.'));
	return {
		canTravel: has('hero.travel'),
		canPlanDay: has('hero.plan.day'),
		canFollowPlan: has('hero.follow.plan'),
		activity: {
			train: has('hero.activity.train'),
			eat: has('hero.activity.eat'),
			rest: has('hero.activity.rest'),
			repair: has('hero.activity.repair')
		},
		equipItemId: equipAction?.actionId.replace('hero.equip.', '') ?? null
	};
}

export function projectPlayerJournalForPublic(report: EngineReplayReport['playerJournal']) {
	return {
		reportVersion: report.reportVersion,
		runId: report.runId,
		fromCursor: report.fromCursor,
		toCursor: report.toCursor,
		entryCount: report.entryCount,
		eventStreamHash: report.eventStreamHash,
		reportHash: report.reportHash,
		entries: report.entries.map((entry) => ({
			journalEntryId: entry.journalEntryId,
			entryVersion: entry.entryVersion,
			runId: entry.runId,
			eventIds: [...entry.eventIds],
			sequenceStart: entry.sequenceStart,
			sequenceEnd: entry.sequenceEnd,
			gameTime: entry.gameTime,
			category: entry.category,
			title: entry.title,
			eventType: entry.eventType,
			stateHash: entry.stateHash,
			dayNumber: entry.dayNumber,
			summary: entry.summary,
			participantIds: [...entry.participantIds],
			deltas: entry.deltas.map((delta) => ({
				ownerId: delta.ownerId,
				kind: delta.kind,
				key: delta.key,
				before: delta.before,
				after: delta.after,
				delta: delta.delta
			})),
			source: publicSource(entry.source),
			directionOutcome: entry.directionOutcome,
			replayCursor: entry.replayCursor,
			facets: [...entry.facets],
			mission: entry.mission
				? {
						missionId: entry.mission.missionId,
						floor: entry.mission.floor,
						attemptId: entry.mission.attemptId,
						attemptOrdinal: entry.mission.attemptOrdinal,
						roundNumber: entry.mission.roundNumber,
						status: entry.mission.status,
						partyMemberIds: [...entry.mission.partyMemberIds],
						completedObjectiveIds: [...entry.mission.completedObjectiveIds],
						discoveryIds: [...entry.mission.discoveryIds]
					}
				: null,
			actions: entry.actions.map((action) => ({
				actorId: action.actorId,
				actorKind: action.actorKind,
				actionId: action.actionId,
				decisionSource: action.decisionSource,
				publicIntent: action.publicIntent,
				outcome: action.outcome
			})),
			partyProgressDeltas: entry.partyProgressDeltas.map((delta) => ({
				kind: delta.kind,
				key: delta.key,
				before: delta.before,
				after: delta.after,
				delta: delta.delta
			})),
			directions: entry.directions.map((direction) => ({
				directionId: direction.directionId,
				kind: direction.kind,
				text: direction.text,
				priorities: [...direction.priorities],
				outcome: direction.outcome,
				rationale: direction.rationale
			})),
			storyChanges: entry.storyChanges.map((change) => ({
				kind: change.kind,
				key: change.key,
				before: change.before,
				after: change.after,
				summary: change.summary
			}))
		})),
		deltaTotals: report.deltaTotals.map((delta) => ({
			ownerId: delta.ownerId,
			kind: delta.kind,
			key: delta.key,
			delta: delta.delta
		})),
		partyTotals: {
			attemptsStarted: report.partyTotals.attemptsStarted,
			deployments: report.partyTotals.deployments,
			roundsResolved: report.partyTotals.roundsResolved,
			objectivesCompleted: report.partyTotals.objectivesCompleted,
			discoveries: report.partyTotals.discoveries,
			threatsDefeated: report.partyTotals.threatsDefeated,
			successfulExtractions: report.partyTotals.successfulExtractions,
			retreats: report.partyTotals.retreats,
			casualties: report.partyTotals.casualties
		},
		filterOptions: {
			days: [...report.filterOptions.days],
			missionIds: [...report.filterOptions.missionIds],
			floors: [...report.filterOptions.floors],
			heroIds: [...report.filterOptions.heroIds],
			eventTypes: [...report.filterOptions.eventTypes],
			facets: [...report.filterOptions.facets],
			sources: [...report.filterOptions.sources]
		}
	};
}

export function projectEngineReplayForPublic(report: EngineReplayReport): PublicEngineReplayReport {
	const masterId = report.snapshot.state.master.masterId;
	return {
		runId: report.runId,
		verified: report.verified,
		eventCount: report.eventCount,
		checks: report.checks.map((check) => ({
			sequence: check.sequence,
			gameTime: check.gameTime,
			eventType: check.eventType,
			actorId: check.actorId,
			source: publicSource(check.source),
			summary: check.summary,
			beforeStateHash: check.beforeStateHash,
			afterStateHash: check.afterStateHash,
			computedStateHash: check.computedStateHash,
			verified: check.verified,
			deltas: check.deltas.map((delta) => RewardDeltaSchema.parse(delta))
		})),
		playerJournal: projectPlayerJournalForPublic(report.playerJournal),
		scheduledEvents: report.scheduledEvents.map((scheduled) => ({
			scheduledEventId: scheduled.scheduledEventId,
			runId: scheduled.runId,
			actorId: scheduled.actorId,
			dueGameTime: scheduled.dueGameTime,
			eventKind: scheduled.eventKind,
			status: scheduled.status,
			createdEventId: scheduled.createdEventId,
			terminalEventId: scheduled.terminalEventId
		})),
		clock: {
			runId: report.clock.runId,
			speed: report.clock.speed,
			anchorGameTime: report.clock.anchorGameTime,
			anchorRealTime: report.clock.anchorRealTime,
			currentGameTime: report.clock.currentGameTime,
			projectedGameTime: report.clock.projectedGameTime,
			lastCatchUpAt: report.clock.lastCatchUpAt,
			nextDueGameTime: report.clock.nextDueGameTime,
			nextDueRealTime: report.clock.nextDueRealTime,
			backlogGameMinutes: report.clock.backlogGameMinutes,
			leaseStatus: report.clock.leaseStatus
		},
		snapshot: {
			state: projectEngineStateForPublic(report.snapshot.state),
			stateHash: report.snapshot.stateHash
		},
		persistedStateHash: report.persistedStateHash,
		hashMatchesPersistedSnapshot: report.hashMatchesPersistedSnapshot,
		playerActions: report.legalActions
			.filter((action) => action.actorId === masterId)
			.map((action) => ({
				actionId: action.actionId,
				actorId: action.actorId,
				kind: action.kind,
				label: action.label,
				description: action.description,
				targetIds: [...action.targetIds],
				resourceCosts: { ...action.resourceCosts },
				tags: [...action.tags]
			})),
		heroControls: heroControls(report)
	};
}

function eventRound(payload: UnknownRecord): UnknownRecord {
	return record(payload.round);
}

function publicEventActions(payload: UnknownRecord): PublicEventAction[] {
	const round = eventRound(payload);
	const party = records(round.actions).map((action) => ({
		actorId: string(action.actorId),
		actorKind: action.actorKind === 'master' ? ('master' as const) : ('hero' as const),
		actionId: string(action.actionId),
		publicIntent: string(action.publicIntent),
		outcome:
			action.outcome === 'applied' || action.outcome === 'superseded'
				? (action.outcome as 'applied' | 'superseded')
				: null
	}));
	const monsters = records(round.monsterActions).map((action) => ({
		actorId: string(action.monsterId),
		actorKind: 'monster' as const,
		actionId: string(action.actionId),
		publicIntent: string(action.summary),
		outcome:
			action.outcome === 'applied' || action.outcome === 'superseded'
				? (action.outcome as 'applied' | 'superseded')
				: null
	}));
	return [...party, ...monsters];
}

function eventCombatModeBinding(payload: UnknownRecord): PublicCombatModeBinding | null {
	const mission = record(payload.mission);
	const attempt = record(mission.attempt);
	return publicCombatModeBinding(attempt.combatModeBinding);
}

function publicRewardDeltas(payload: UnknownRecord) {
	if (!Array.isArray(payload.rewardDeltas)) return [];
	return payload.rewardDeltas.flatMap((candidate) => {
		const parsed = RewardDeltaSchema.safeParse(candidate);
		return parsed.success ? [parsed.data] : [];
	});
}

export function projectEngineEventForPublic(event: PublicEventInput): PublicEngineEvent {
	const payload = record(event.payload);
	const round = eventRound(payload);
	return {
		eventId: event.eventId,
		runId: event.runId,
		sequence: event.sequence,
		schemaVersion: event.schemaVersion,
		gameTime: event.gameTime,
		eventType: event.eventType,
		actorId: event.actorId,
		source: publicSource(event.source),
		beforeStateHash: event.beforeStateHash,
		afterStateHash: event.afterStateHash,
		contentVersion: event.contentVersion,
		summary: typeof payload.summary === 'string' ? payload.summary : null,
		initiativeOrder: strings(round.initiativeOrder),
		actions: publicEventActions(payload),
		rewardDeltas: publicRewardDeltas(payload),
		combatModeBinding: eventCombatModeBinding(payload)
	};
}

export function projectEngineCommitReceipt(commit: EngineCommit): PublicEngineCommitReceipt {
	return {
		runId: commit.snapshot.state.runId,
		version: commit.snapshot.state.version,
		eventCursor: commit.snapshot.state.eventCursor,
		stateHash: commit.snapshot.stateHash,
		eventType: commit.events[0]?.eventType ?? null
	};
}

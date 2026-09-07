import type { ActionSource } from '@summonlab/contracts';

export interface PublicRewardDelta {
	readonly ownerId: string;
	readonly kind:
		| 'resource'
		| 'experience'
		| 'level'
		| 'skill'
		| 'item'
		| 'durability'
		| 'health'
		| 'need'
		| 'habit'
		| 'relationship';
	readonly key: string;
	readonly before: number;
	readonly after: number;
	readonly delta: number;
}

export interface PublicActionSource {
	readonly source: ActionSource['source'];
	readonly timing: ActionSource['timing'];
}

export interface PublicReplayCheck {
	readonly sequence: number;
	readonly gameTime: string;
	readonly eventType: string;
	readonly actorId: string | null;
	readonly source: PublicActionSource;
	readonly summary: string;
	readonly verified: boolean;
	readonly deltas: readonly PublicRewardDelta[];
	readonly publicCheckHash: string;
}

export interface PublicScheduledEvent {
	readonly scheduledEventId: string;
	readonly runId: string;
	readonly actorId: string;
	readonly dueGameTime: string;
	readonly eventKind: string;
	readonly status: 'pending' | 'resolved' | 'canceled';
	readonly createdEventId: string;
	readonly terminalEventId: string | null;
}

export interface PublicHeroControls {
	readonly canTravel: boolean;
	readonly canPlanDay: boolean;
	readonly canFollowPlan: boolean;
	readonly activity: Readonly<Record<'train' | 'eat' | 'rest' | 'repair', boolean>>;
	readonly equipItemId: string | null;
}

export interface PublicMissionAction {
	readonly actorId: string;
	readonly actorKind: 'master' | 'hero';
	readonly actionId: string;
	readonly publicIntent: string;
	readonly outcome: 'applied' | 'superseded';
	readonly fromNodeId: string;
	readonly toNodeId: string;
	readonly targetId: string | null;
	readonly discoveryIds: readonly string[];
	readonly objectiveTransition: string | null;
	readonly effectIds: readonly string[];
	readonly summary: string;
}

export interface PublicMonsterAction {
	readonly monsterId: string;
	readonly actionId: string;
	readonly kind: string;
	readonly outcome: 'applied' | 'superseded';
	readonly fromNodeId: string;
	readonly toNodeId: string;
	readonly targetId: string | null;
	readonly effectIds: readonly string[];
	readonly summary: string;
}

export interface PublicMissionRound {
	readonly roundVersion: string;
	readonly roundNumber: number;
	readonly environmentEventIds: readonly string[];
	readonly initiativeOrder: readonly string[];
	readonly actions: readonly PublicMissionAction[];
	readonly monsterActions: readonly PublicMonsterAction[];
	readonly statusAfter: string;
	readonly portalWindow?: {
		readonly roundsRemainingBefore: number;
		readonly roundsRemainingAfter: number;
		readonly pressureBefore: string;
		readonly pressureAfter: string;
	};
	readonly oreLedgerEntryIds?: readonly string[];
}

export interface PublicMissionTurnState {
	readonly turnVersion: string;
	readonly maximumRounds: number;
	readonly roundNumber: number;
	readonly objective: {
		readonly objectiveId: string;
		readonly status: string;
		readonly carrierId?: string | null;
		readonly recoveredOnRound?: number | null;
		readonly deliveredOnRound?: number | null;
		readonly quota?: number;
		readonly minedAmount?: number;
		readonly quotaReachedOnRound?: number | null;
	};
	readonly monsters: Readonly<
		Record<
			string,
			{
				readonly monsterId: string;
				readonly dutySlotId: string;
				readonly label: string;
				readonly ordinal: number;
				readonly nodeId: string;
				readonly status: string;
				readonly vitality: number;
				readonly maximumVitality: number;
				readonly alertState: string;
				readonly defeatedOnRound: number | null;
				readonly lastActionId: string | null;
			}
		>
	>;
	readonly partyGuard: Readonly<
		Record<
			string,
			{
				readonly actorId: string;
				readonly guard: number;
				readonly maximumGuard: number;
				readonly status: string;
				readonly lastChangedOnRound: number;
			}
		>
	>;
	readonly arena: {
		readonly furnaceState: string;
		readonly coolingControlNodeId: string | null;
		readonly coolingControlExposed: boolean;
	};
	readonly currentThreatIntents: readonly {
		readonly monsterId: string;
		readonly actionId: string;
		readonly kind: string;
		readonly fromNodeId: string;
		readonly toNodeId: string;
		readonly targetId: string | null;
		readonly telegraph: string;
		readonly anticipatedEffect: string;
	}[];
	readonly rounds: readonly PublicMissionRound[];
	readonly portal?: {
		readonly portalVersion: string;
		readonly portalId: string;
		readonly durationRounds: number;
		readonly roundsRemaining: number;
		readonly warningAtRemainingRounds: number;
		readonly criticalAtRemainingRounds: number;
		readonly pressureStage: string;
		readonly extractionQuota: number;
		readonly cargoCapacityPerActor: number;
		readonly deposits: Readonly<
			Record<
				string,
				{
					readonly depositId: string;
					readonly nodeId: string;
					readonly resource: string;
					readonly initialAmount: number;
					readonly remainingAmount: number;
					readonly mineAmountPerAction: number;
				}
			>
		>;
		readonly cargo: Readonly<
			Record<
				string,
				{
					readonly actorId: string;
					readonly resource: string;
					readonly amount: number;
					readonly capacity: number;
				}
			>
		>;
		readonly oreLedger: readonly {
			readonly entryId: string;
			readonly sequence: number;
			readonly roundNumber: number;
			readonly kind: string;
			readonly actorId: string;
			readonly depositId: string | null;
			readonly nodeId: string;
			readonly amount: number;
			readonly cargoBefore: number;
			readonly cargoAfter: number;
			readonly depositBefore: number | null;
			readonly depositAfter: number | null;
			readonly settlementBefore: number | null;
			readonly settlementAfter: number | null;
		}[];
		readonly extractedAmount: number;
		readonly extractionCredited: boolean;
	};
}

export interface PublicMissionAttempt {
	readonly attemptId: string;
	readonly ordinal: number;
	readonly status: string;
	readonly party: {
		readonly masterId: string;
		readonly heroIds: readonly string[];
		readonly memberIds: readonly string[];
	};
	readonly entryNodeId: string;
	readonly extractionNodeId: string;
	readonly positions: Readonly<Record<string, string>>;
	readonly knowledge: {
		readonly discoveryIds: readonly string[];
		readonly visitedNodeIds: readonly string[];
	};
	readonly completedObjectiveIds: readonly string[];
	readonly preparedAt: string;
	readonly deployedAt: string | null;
	readonly extractionOpenedAt: string | null;
	readonly endedAt: string | null;
	readonly outcome: string | null;
	readonly turnState: PublicMissionTurnState;
	readonly combatModeBinding?: PublicCombatModeBinding;
}

export interface PublicEngineState {
	readonly schemaVersion: number;
	readonly runId: string;
	readonly contentVersion: string;
	readonly status: string;
	readonly version: number;
	readonly eventCursor: number;
	readonly simulatedAt: string;
	readonly master: PublicMasterState;
	readonly heroes: Readonly<Record<string, PublicHeroState>>;
	readonly items: Readonly<Record<string, PublicItemState>>;
	readonly settlement: { readonly resources: Readonly<Record<string, number>> };
	readonly mission: {
		readonly binding: {
			readonly missionId: string;
			readonly contentVersion: string;
			readonly contentHash: string;
		};
		readonly availableMissionIds: readonly string[];
		readonly attemptCount: number;
		readonly attempt: PublicMissionAttempt | null;
		readonly aftermath?: PublicMissionAftermath;
	};
	readonly masterControl: PublicMasterControl | null;
}

export interface PublicMasterState {
	readonly masterId: string;
	readonly lifeState: string;
	readonly location: string;
	readonly health: number;
	readonly maxHealth: number;
	readonly injuries: readonly PublicInjury[];
}

export interface PublicInjury {
	readonly injuryId: string;
	readonly kind: string;
	readonly severity: number;
	readonly inflictedAt: string;
}

export interface PublicHeroState {
	readonly heroId: string;
	readonly lifeState: string;
	readonly location: string;
	readonly destination: string | null;
	readonly health: number;
	readonly maxHealth: number;
	readonly mana: number | null;
	readonly maxMana: number | null;
	readonly progression: {
		readonly stars: number;
		readonly level: number;
		readonly experience: number;
	};
	readonly equipment: Readonly<
		Record<'mainHand' | 'offHand' | 'head' | 'torso' | 'legs' | 'boots', string | null>
	>;
	readonly capabilityProfile?: {
		readonly profileVersion: string;
		readonly attributes: Readonly<Record<'might' | 'vitality' | 'agility' | 'spirit', number>>;
	};
}

export interface PublicItemState {
	readonly itemId: string;
	readonly definitionId: string;
	readonly ownerId: string | null;
	readonly equippedById: string | null;
	readonly finalRank: string;
	readonly durability: number;
	readonly maxDurability: number;
}

export interface PublicMissionAftermath {
	readonly aftermathVersion: string;
	readonly activeAttemptId: string | null;
	readonly consequences: readonly {
		readonly consequenceId: string;
		readonly roundNumber: number;
		readonly nodeId: string;
		readonly fatal: boolean;
		readonly summary: string;
		readonly healthBefore: number;
		readonly healthAfter: number;
		readonly injury: { readonly kind: string } | null;
		readonly itemWear: {
			readonly durabilityBefore: number;
			readonly durabilityAfter: number;
		} | null;
		readonly witnesses: readonly { readonly heroId: string }[];
	}[];
	readonly archives: readonly {
		readonly attemptId: string;
		readonly ordinal: number;
		readonly outcome: string;
		readonly finalRoundNumber: number;
		readonly binding: { readonly missionId: string };
		readonly consequences: readonly { readonly consequenceId: string }[];
	}[];
}

export interface PublicMasterControl {
	readonly timing: string;
	readonly countdownSeconds: number;
	readonly revision: number;
	readonly decisionOrdinal: number;
	readonly activeDecision: {
		readonly decisionId: string;
		readonly ordinal: number;
		readonly timing: string;
		readonly openedAt: string;
		readonly expiresAt: string | null;
	} | null;
	readonly fallback: {
		readonly configurationVersion: string;
		readonly policy: 'directed' | 'random';
		readonly directionId: string;
		readonly directionText: string;
		readonly priorities: readonly (
			'protect-self' | 'protect-party' | 'focus-objective' | 'seek-secrets' | 'conserve-resources'
		)[];
		readonly protectedHeroId: string | null;
		readonly safetyStops: {
			readonly beforeIrreversibleAction: boolean;
			readonly masterHealthThreshold: number | null;
			readonly whenUnclassified: boolean;
			readonly maximumConsecutiveFallbacks: number | null;
		};
	} | null;
	readonly consecutiveFallbacks: number;
	readonly lastResolution: {
		readonly outcome: string;
		readonly expiryOutcome: string;
		readonly source: PublicActionSource;
		readonly fallbackSelection: {
			readonly policy: string;
			readonly classification: string;
			readonly selectedActionId: string | null;
			readonly safetyStopReason: string | null;
			readonly explanation: string;
		} | null;
	} | null;
}

export interface PublicPlayerJournalEntry {
	readonly journalEntryId: string;
	readonly entryVersion: 'player-journal-entry-v1';
	readonly runId: string;
	readonly eventIds: readonly string[];
	readonly sequenceStart: number;
	readonly sequenceEnd: number;
	readonly gameTime: string;
	readonly category: string;
	readonly title: string;
	readonly eventType: string;
	readonly publicEntryHash: string;
	readonly dayNumber: number;
	readonly summary: string;
	readonly participantIds: readonly string[];
	readonly deltas: readonly PublicRewardDelta[];
	readonly source: PublicActionSource;
	readonly directionOutcome: 'advanced' | 'conflicted' | 'unavailable' | null;
	readonly replayCursor: number;
	readonly facets: readonly string[];
	readonly mission: {
		readonly missionId: string;
		readonly floor: number | null;
		readonly attemptId: string | null;
		readonly attemptOrdinal: number | null;
		readonly roundNumber: number | null;
		readonly status: string | null;
		readonly partyMemberIds: readonly string[];
		readonly completedObjectiveIds: readonly string[];
		readonly discoveryIds: readonly string[];
	} | null;
	readonly actions: readonly {
		readonly actorId: string;
		readonly actorKind: 'master' | 'hero' | 'monster' | 'system';
		readonly actionId: string;
		readonly decisionSource: ActionSource['source'];
		readonly publicIntent: string;
		readonly outcome: 'applied' | 'superseded' | 'recorded';
	}[];
	readonly partyProgressDeltas: readonly {
		readonly kind: string;
		readonly key: string;
		readonly before: number;
		readonly after: number;
		readonly delta: number;
	}[];
	readonly directions: readonly {
		readonly directionId: string;
		readonly kind: 'directive' | 'fallback';
		readonly text: string;
		readonly priorities: readonly string[];
		readonly outcome: string;
		readonly rationale: string;
	}[];
	readonly storyChanges: readonly {
		readonly kind: string;
		readonly key: string;
		readonly before: string | null;
		readonly after: string;
		readonly summary: string;
	}[];
}

export interface PublicPlayerJournalReport {
	readonly reportVersion: 'player-journal-v1';
	readonly runId: string;
	readonly fromCursor: number;
	readonly toCursor: number;
	readonly entryCount: number;
	readonly publicJournalHash: string;
	readonly entries: readonly PublicPlayerJournalEntry[];
	readonly deltaTotals: readonly {
		readonly ownerId: string;
		readonly kind: PublicRewardDelta['kind'];
		readonly key: string;
		readonly delta: number;
	}[];
	readonly partyTotals: {
		readonly attemptsStarted: number;
		readonly deployments: number;
		readonly roundsResolved: number;
		readonly objectivesCompleted: number;
		readonly discoveries: number;
		readonly threatsDefeated: number;
		readonly successfulExtractions: number;
		readonly retreats: number;
		readonly casualties: number;
	};
	readonly filterOptions: {
		readonly days: readonly number[];
		readonly missionIds: readonly string[];
		readonly floors: readonly number[];
		readonly heroIds: readonly string[];
		readonly eventTypes: readonly string[];
		readonly facets: readonly string[];
		readonly sources: readonly ActionSource['source'][];
	};
}

export interface PublicLegalAction {
	readonly actionId: string;
	readonly actorId: string;
	readonly kind:
		| 'move'
		| 'attack'
		| 'defend'
		| 'interact'
		| 'communicate'
		| 'work'
		| 'train'
		| 'rest'
		| 'retreat'
		| 'wait';
	readonly label: string;
	readonly description: string;
	readonly targetIds: readonly string[];
	readonly resourceCosts: Readonly<Record<string, number>>;
	readonly tags: readonly string[];
}

export interface PublicSimulationClock {
	readonly runId: string;
	readonly speed: 0 | 1 | 2 | 4 | 8;
	readonly anchorGameTime: string;
	readonly anchorRealTime: string;
	readonly currentGameTime: string;
	readonly projectedGameTime: string;
	readonly lastCatchUpAt: string | null;
	readonly nextDueGameTime: string | null;
	readonly nextDueRealTime: string | null;
	readonly backlogGameMinutes: number;
	readonly leaseStatus: 'idle' | 'leased';
}

export interface PublicEngineReplayReport {
	readonly runId: string;
	readonly verified: boolean;
	readonly eventCount: number;
	readonly checks: readonly PublicReplayCheck[];
	readonly playerJournal: PublicPlayerJournalReport;
	readonly scheduledEvents: readonly PublicScheduledEvent[];
	readonly clock: PublicSimulationClock;
	readonly snapshot: { readonly state: PublicEngineState; readonly publicStateHash: string };
	readonly playerActions: readonly PublicLegalAction[];
	readonly heroControls: PublicHeroControls;
}

export interface PublicEventAction {
	readonly actorId: string;
	readonly actorKind: 'master' | 'hero' | 'monster';
	readonly actionId: string;
	readonly publicIntent: string;
	readonly outcome: 'applied' | 'superseded' | 'recorded' | null;
}

export interface PublicCombatModeBinding {
	readonly modeId: string;
	readonly rulesVersion: string;
	readonly contentHash: string;
	readonly boundAt: string;
}

export interface PublicEngineEvent {
	readonly eventId: string;
	readonly runId: string;
	readonly sequence: number;
	readonly schemaVersion: number;
	readonly gameTime: string;
	readonly eventType: string;
	readonly actorId: string | null;
	readonly source: PublicActionSource;
	readonly contentVersion: string;
	readonly summary: string | null;
	readonly initiativeOrder: readonly string[];
	readonly actions: readonly PublicEventAction[];
	readonly rewardDeltas: readonly PublicRewardDelta[];
	readonly combatModeBinding: PublicCombatModeBinding | null;
	readonly publicEventHash: string;
}

export interface PublicEngineCommitReceipt {
	readonly runId: string;
	readonly version: number;
	readonly eventCursor: number;
	readonly publicStateHash: string;
	readonly eventType: string | null;
}

export interface PublicEventInput {
	readonly eventId: string;
	readonly runId: string;
	readonly sequence: number;
	readonly schemaVersion: number;
	readonly gameTime: string;
	readonly eventType: string;
	readonly actorId: string | null;
	readonly source: ActionSource;
	readonly contentVersion: string;
	readonly payload: Readonly<Record<string, unknown>>;
}

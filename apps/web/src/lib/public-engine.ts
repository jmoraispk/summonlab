import type {
	ActionSource,
	AuthoritativeEvent,
	EngineGameState,
	EngineReplayReport,
	LegalAction,
	PlayerJournalReport,
	RewardDelta,
	SimulationClock
} from '@summonlab/contracts';

export type PublicPrivateKey =
	| 'seed'
	| 'entropyCursor'
	| 'entropyDraws'
	| 'learning'
	| 'cognitiveLearningScore'
	| 'cognitiveFactorBasisPoints'
	| 'domainAptitudes'
	| 'domainAptitudeFactorBasisPoints'
	| 'legalActions'
	| 'legalActionsByActor'
	| 'legalActionHash'
	| 'packetHash'
	| 'policyId'
	| 'policyResultHash'
	| 'providerRequest'
	| 'providerResponse'
	| 'providerPacket'
	| 'privateReasoning'
	| 'reasoning'
	| 'reasoningTokens'
	| 'decisionJobId'
	| 'initiativeTieBreak'
	| 'observations'
	| 'beliefs'
	| 'relationships'
	| 'authority'
	| 'candidateScores'
	| 'decisionRecommended'
	| 'fallbackUsed'
	| 'orderScore'
	| 'preferenceWeight';

export type PublicProjected<T> = T extends (...args: never[]) => unknown
	? never
	: T extends readonly (infer Item)[]
		? PublicProjected<Item>[]
		: T extends object
			? { [Key in keyof T as Key extends PublicPrivateKey ? never : Key]: PublicProjected<T[Key]> }
			: T;

export type PublicEngineGameState = PublicProjected<EngineGameState>;
export type PublicPlayerJournalReport = PublicProjected<PlayerJournalReport>;

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
	readonly beforeStateHash: string;
	readonly afterStateHash: string;
	readonly computedStateHash: string;
	readonly verified: boolean;
	readonly deltas: readonly RewardDelta[];
}

export interface PublicScheduledEvent {
	readonly scheduledEventId: string;
	readonly runId: string;
	readonly actorId: string;
	readonly dueGameTime: string;
	readonly eventKind: string;
	readonly status: EngineReplayReport['scheduledEvents'][number]['status'];
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

export interface PublicEngineReplayReport {
	readonly runId: string;
	readonly verified: boolean;
	readonly eventCount: number;
	readonly checks: readonly PublicReplayCheck[];
	readonly journalEntries: PublicProjected<EngineReplayReport['journalEntries']>;
	readonly playerJournal: PublicPlayerJournalReport;
	readonly scheduledEvents: readonly PublicScheduledEvent[];
	readonly clock: SimulationClock;
	readonly snapshot: {
		readonly state: PublicEngineGameState;
		readonly stateHash: string;
	};
	readonly persistedStateHash: string;
	readonly hashMatchesPersistedSnapshot: boolean;
	/** Actions the player-controlled Master may currently select. Never contains hero/model actions. */
	readonly playerActions: readonly LegalAction[];
	/** Bounded UI affordances derived server-side without exposing a hero's legal-action set. */
	readonly heroControls: PublicHeroControls;
}

export interface PublicEventAction {
	readonly actorId: string;
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
	readonly beforeStateHash: string;
	readonly afterStateHash: string;
	readonly contentVersion: string;
	readonly summary: string | null;
	readonly actions: readonly PublicEventAction[];
	readonly rewardDeltas: readonly RewardDelta[];
	readonly combatModeBinding: PublicCombatModeBinding | null;
}

export type PublicEventInput = Pick<
	AuthoritativeEvent,
	| 'eventId'
	| 'runId'
	| 'sequence'
	| 'schemaVersion'
	| 'gameTime'
	| 'eventType'
	| 'actorId'
	| 'source'
	| 'beforeStateHash'
	| 'afterStateHash'
	| 'contentVersion'
	| 'payload'
>;

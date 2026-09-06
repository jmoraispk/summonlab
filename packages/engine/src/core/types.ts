import type {
	AuthoritativeEvent,
	CharacterDraft,
	CharacterDraftV2,
	CharacterMind,
	EquipmentMaterialId,
	EngineCommand,
	EngineGameState,
	EngineGameStateV2,
	EngineGameStateV3,
	EngineGameStateV4,
	EngineGameStateV5,
	EngineGameStateV6,
	EngineGameStateV7,
	EngineGameStateV8,
	EngineGameStateV9,
	EngineGameStateV10,
	EngineGameStateV11,
	EngineGameStateV12,
	EngineGameStateV13,
	EngineGameStateV14,
	EngineGameStateV15,
	EngineGameStateV16,
	EngineGameStateV17,
	EngineGameStateV18,
	EngineGameStateV19,
	EngineGameStateV20,
	EngineGameStateV21,
	EngineGameStateV22,
	EngineGameStateV23,
	EngineGameStateV24,
	EngineGameStateV25,
	EngineSnapshot,
	EntropyDraw,
	LegalAction,
	RewardDelta,
	ScheduledEvent
} from '@summonlab/contracts';

export type EngineGameStateModern =
	| EngineGameStateV2
	| EngineGameStateV3
	| EngineGameStateV4
	| EngineGameStateV5
	| EngineGameStateV6
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
	| EngineGameStateV22
	| EngineGameStateV23
	| EngineGameStateV24
	| EngineGameStateV25;
export type EngineRoutineState =
	| EngineGameStateV5
	| EngineGameStateV6
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
	| EngineGameStateV22
	| EngineGameStateV23
	| EngineGameStateV24
	| EngineGameStateV25;

interface BootstrapEngineInputBase {
	readonly runId: string;
	readonly seed: string;
	readonly simulatedAt?: string;
}

interface BootstrapLegacyHeroInput {
	readonly heroId: string;
	readonly manifestHash: string;
	readonly rarityStars?: number;
	readonly mind?: CharacterMind;
	readonly draft?: never;
}

interface BootstrapDraftHeroInput<Draft extends CharacterDraft | CharacterDraftV2> {
	readonly draft: Draft;
	readonly heroId?: never;
	readonly manifestHash?: never;
	readonly rarityStars?: never;
	readonly mind?: never;
}

export type BootstrapAdditionalHeroInput =
	BootstrapLegacyHeroInput | BootstrapDraftHeroInput<CharacterDraft>;

type BootstrapCapabilityAdditionalHeroInput =
	BootstrapAdditionalHeroInput | BootstrapDraftHeroInput<CharacterDraftV2>;

interface BootstrapDevelopmentMissionScenario {
	readonly initialMissionId: string;
	readonly availableMissionIds: readonly string[];
	readonly enableMissionAftermath?: boolean;
	readonly enableMasterPermadeath?: boolean;
	readonly enableAttemptAftermath?: boolean;
	readonly enableMasterTiming?: boolean;
	readonly enableMasterFallback?: boolean;
	readonly enableStoryPatch?: boolean;
	readonly enableSynthesis?: boolean;
	readonly enableFirstBandArchive?: boolean;
	readonly additionalHeroes?: readonly BootstrapAdditionalHeroInput[];
	readonly foundryRouteMemoryHeroId?: string;
}

interface BootstrapDevelopmentEquipmentScenario {
	readonly enabled: true;
	readonly materialLots?: Readonly<Partial<Record<EquipmentMaterialId, number>>>;
	readonly forgeReady?: true;
}

type BootstrapCapabilityEngineInput = BootstrapEngineInputBase &
	BootstrapDraftHeroInput<CharacterDraft | CharacterDraftV2> & {
		readonly additionalHeroes?: readonly BootstrapCapabilityAdditionalHeroInput[];
		readonly developmentMissionScenario?: never;
		readonly developmentEquipmentScenario?: never;
	};

type BootstrapLegacyEngineInput = BootstrapEngineInputBase &
	(BootstrapLegacyHeroInput | BootstrapDraftHeroInput<CharacterDraft>) & {
		readonly additionalHeroes?: readonly BootstrapAdditionalHeroInput[];
		readonly developmentMissionScenario?: BootstrapDevelopmentMissionScenario;
		readonly developmentEquipmentScenario?: BootstrapDevelopmentEquipmentScenario;
	};

export type BootstrapEngineInput = BootstrapCapabilityEngineInput | BootstrapLegacyEngineInput;

export interface BootstrapEngineResult {
	readonly snapshot: EngineSnapshot;
	readonly event: AuthoritativeEvent;
}

export interface EngineApplyResult {
	readonly state: EngineGameState;
	readonly stateHash: string;
	readonly events: readonly AuthoritativeEvent[];
	readonly scheduled: readonly ScheduledEvent[];
	readonly resolvedScheduledEventIds: readonly string[];
	readonly canceledScheduledEventIds: readonly string[];
	readonly decisionRequests: readonly never[];
	readonly legalActions: readonly LegalAction[];
}

export interface ReplayCheck {
	readonly sequence: number;
	readonly gameTime: string;
	readonly eventType: string;
	readonly actorId: string | null;
	readonly source: AuthoritativeEvent['source'];
	readonly summary: string;
	readonly beforeStateHash: string;
	readonly afterStateHash: string;
	readonly computedStateHash: string;
	readonly verified: boolean;
	readonly entropyDraws: readonly EntropyDraw[];
	readonly deltas: readonly RewardDelta[];
}

export interface ReplayResult {
	readonly snapshot: EngineSnapshot;
	readonly checks: readonly ReplayCheck[];
	readonly verified: boolean;
}

export interface EngineCommandHandler<C extends EngineCommand = EngineCommand> {
	readonly ownerId: string;
	readonly commandTypes: readonly C['commandType'][];
	assertLegal(state: EngineGameState, command: C): void;
	buildEvent(state: EngineGameState, command: C): AuthoritativeEvent;
}

export interface EngineEventReducer {
	readonly ownerId: string;
	readonly eventTypes: readonly string[];
	reduce(state: EngineGameState, event: AuthoritativeEvent): EngineGameState;
}

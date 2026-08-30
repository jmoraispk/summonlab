import type {
	AssembleHeroDecisionPacketInput,
	BootstrapAdditionalHeroInput,
	BootstrapEngineInput,
	BootstrapEngineResult,
	CampaignObjectiveInput,
	CatchUpPolicyResult,
	EngineApplyResult,
	EntropyCursor,
	EntropyResult,
	MonsterIntentScenario,
	ReplayCheck,
	ReplayResult,
	ReturnRecapAggregate,
	ReturnRecapInput,
	SimulationReport
} from '@summonlab/engine';

declare const assembleHeroDecisionPacketInput: AssembleHeroDecisionPacketInput;
declare const bootstrapAdditionalHeroInput: BootstrapAdditionalHeroInput;
declare const bootstrapEngineInput: BootstrapEngineInput;
declare const bootstrapEngineResult: BootstrapEngineResult;
declare const campaignObjectiveInput: CampaignObjectiveInput;
declare const catchUpPolicyResult: CatchUpPolicyResult;
declare const engineApplyResult: EngineApplyResult;
declare const entropyCursor: EntropyCursor;
declare const entropyResult: EntropyResult;
declare const monsterIntentScenario: MonsterIntentScenario;
declare const replayCheck: ReplayCheck;
declare const replayResult: ReplayResult;
declare const returnRecapAggregate: ReturnRecapAggregate;
declare const returnRecapInput: ReturnRecapInput;
declare const simulationReport: SimulationReport;

const publicEngineTypes = [
	assembleHeroDecisionPacketInput,
	bootstrapAdditionalHeroInput,
	bootstrapEngineInput,
	bootstrapEngineResult,
	campaignObjectiveInput,
	catchUpPolicyResult,
	engineApplyResult,
	entropyCursor,
	entropyResult,
	monsterIntentScenario,
	replayCheck,
	replayResult,
	returnRecapAggregate,
	returnRecapInput,
	simulationReport
] as const;

void publicEngineTypes;

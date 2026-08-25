import {
	CharacterMindSchema,
	EngineGameStateV17Schema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameStateV17,
	type MissionTurnChoice
} from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	hashGameState,
	legalActions,
	replayEventsStrict,
	sha256Hex
} from '@summonlab/engine';
import { z } from 'zod';

export const FOUNDRY_STRATEGY_REPORT_VERSION = 'foundry-strategy-report-v1' as const;
export const FOUNDRY_STRATEGY_GENERATOR_VERSION = 'foundry-strategy-generator-v1' as const;
export const FOUNDRY_STRATEGY_GENERATED_AT = '2026-08-25T00:00:00.000Z' as const;

export const FoundryStrategyIdSchema = z.enum(['hammer-line', 'split-cooling', 'full-quench']);

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

const FoundryStrategyDefinitionSchema = z
	.object({
		strategyId: FoundryStrategyIdSchema,
		displayName: z.string().min(1).max(80),
		thesis: z.string().min(1).max(300),
		preparation: z.string().min(1).max(300),
		tradeoff: z.string().min(1).max(300),
		requiresRouteMemory: z.boolean(),
		targetFurnaceState: z.enum(['lit', 'cooling', 'quenched'])
	})
	.strict();

const FoundryStrategyCheckpointSchema = z
	.object({
		label: z.string().min(1).max(100),
		roundNumber: z.number().int().nonnegative().max(48),
		furnaceState: z.enum(['lit', 'cooling', 'quenched']),
		wardenVitality: z.number().int().nonnegative().max(18),
		masterHealth: z.number().int().nonnegative().max(100),
		minimumHeroHealth: z.number().int().nonnegative().max(100)
	})
	.strict();

export const FoundryStrategyTrialSchema = z
	.object({
		strategyId: FoundryStrategyIdSchema,
		seed: z.string().min(1).max(120),
		runId: z.string().uuid(),
		status: z.literal('success'),
		replayVerified: z.literal(true),
		stateHash: HashSchema,
		eventLogHash: HashSchema,
		eventCount: z.number().int().positive(),
		trainingSessionsPerHero: z.literal(9),
		partyHeroCount: z.literal(4),
		swordRanksAtDeployment: z.array(z.number().int().min(10).max(20)).length(4),
		routeMemoryUsed: z.boolean(),
		furnaceStateAtDefeat: z.enum(['lit', 'cooling', 'quenched']),
		missionRounds: z.number().int().positive().max(48),
		wardenStrikes: z.number().int().positive(),
		controlActions: z.number().int().nonnegative().max(2),
		masterHealthAfter: z.number().int().positive().max(100),
		minimumHeroHealthAfter: z.number().int().positive().max(100),
		nonfatalConsequences: z.number().int().nonnegative(),
		fatalConsequences: z.literal(0),
		checkpoints: z.array(FoundryStrategyCheckpointSchema).min(4).max(12)
	})
	.strict();

const FoundryStrategySummarySchema = z
	.object({
		strategyId: FoundryStrategyIdSchema,
		status: z.literal('viable'),
		trialsPassed: z.number().int().positive(),
		trialsTotal: z.number().int().positive(),
		replayPassRate: z.literal(1),
		survivalRate: z.literal(1),
		minimumMasterHealth: z.number().int().positive(),
		minimumHeroHealth: z.number().int().positive(),
		missionRoundRange: z.tuple([
			z.number().int().positive().max(48),
			z.number().int().positive().max(48)
		]),
		wardenStrikeRange: z.tuple([z.number().int().positive(), z.number().int().positive()]),
		representativeRunId: z.string().uuid()
	})
	.strict();

export const FoundryStrategyReportSchema = z
	.object({
		schemaVersion: z.literal(FOUNDRY_STRATEGY_REPORT_VERSION),
		generatorVersion: z.literal(FOUNDRY_STRATEGY_GENERATOR_VERSION),
		generatedAt: z.literal(FOUNDRY_STRATEGY_GENERATED_AT),
		engineContentVersion: z.literal('engine-v17'),
		missionId: z.literal('tower-floor-05'),
		missionContentVersion: z.literal('tower-floor-05-v2'),
		criteria: z
			.object({
				requiredStrategies: z.literal(3),
				requiredTrialsPerStrategy: z.literal(8),
				requiredReplayPassRate: z.literal(1),
				requiredSurvivalRate: z.literal(1),
				maximumMissionRounds: z.literal(48),
				requireLegalEngineCommandsOnly: z.literal(true),
				sampleKind: z.literal('fixed-success-regression-matrix'),
				notWinRateEstimate: z.literal(true)
			})
			.strict(),
		definitions: z.array(FoundryStrategyDefinitionSchema).length(3),
		qualityGate: z
			.object({
				status: z.literal('pass'),
				viableStrategies: z.literal(3),
				trialsPassed: z.literal(24),
				trialsTotal: z.literal(24),
				replayMismatches: z.literal(0),
				deaths: z.literal(0)
			})
			.strict(),
		summaries: z.array(FoundryStrategySummarySchema).length(3),
		trials: z.array(FoundryStrategyTrialSchema).length(24),
		reportHash: HashSchema
	})
	.strict();

export type FoundryStrategyId = z.infer<typeof FoundryStrategyIdSchema>;
export type FoundryStrategyTrial = z.infer<typeof FoundryStrategyTrialSchema>;
export type FoundryStrategyReport = z.infer<typeof FoundryStrategyReportSchema>;

export const FOUNDRY_STRATEGY_DEFINITIONS = FoundryStrategyDefinitionSchema.array()
	.length(3)
	.parse([
		{
			strategyId: 'hammer-line',
			displayName: 'Hammer Line',
			thesis:
				'Preparation can make the obvious route genuinely viable, even while the furnace stays lit.',
			preparation:
				'Train a four-hero line to sword rank 10, cycle both gate weapons, and enter without Floor 04 route knowledge.',
			tradeoff:
				'The Warden keeps all three armor layers, so the company must clear the nave and rotate its exposed front line.',
			requiresRouteMemory: false,
			targetFurnaceState: 'lit'
		},
		{
			strategyId: 'split-cooling',
			displayName: 'Split Cooling',
			thesis:
				'One remembered secret can shorten the fight without paying the full cost of a quench.',
			preparation:
				'Let the schematic holder expose the seam, test the wheel, and advance the furnace once while the Master holds the heart.',
			tradeoff:
				'The operator draws the Warden into the control room and the company fights through one remaining armor layer.',
			requiresRouteMemory: true,
			targetFurnaceState: 'cooling'
		},
		{
			strategyId: 'full-quench',
			displayName: 'Full Quench',
			thesis:
				'Trust the isolated operator for one additional turn to remove every furnace-linked armor layer.',
			preparation:
				'Carry the Floor 04 schematic memory, reveal the maintenance path, test the wheel, then operate it twice.',
			tradeoff:
				'The exposed holder endures another intercept before the shortest and hardest-hitting finish.',
			requiresRouteMemory: true,
			targetFurnaceState: 'quenched'
		}
	]);

const TRIAL_SEEDS = [
	'foundry-matrix-03',
	'foundry-matrix-05',
	'foundry-matrix-09',
	'foundry-matrix-14',
	'foundry-matrix-15',
	'foundry-matrix-16',
	'foundry-matrix-22',
	'foundry-matrix-27'
] as const;

const TRIAL_MIND = CharacterMindSchema.parse({
	personality: {
		openness: 62,
		conscientiousness: 88,
		extraversion: 34,
		agreeableness: 57,
		emotionalVolatility: 29
	},
	primaryValue: 'mastery',
	primaryDrive: 'protect',
	socialStyle: 'reserved',
	stressResponse: 'prepare',
	dailyHabit: 'stretches-at-dawn',
	aptitudes: { might: 10, finesse: 10, insight: 7, resolve: 10 }
});

function manualSource() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function scriptedSource() {
	return {
		source: 'scripted' as const,
		timing: 'continuous' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function systemSource() {
	return {
		source: 'system' as const,
		timing: null,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function manualChoice(actorId: string, actionId: string): MissionTurnChoice {
	return {
		actorId,
		actionId,
		source: 'manual',
		policyId: null,
		packetHash: null,
		legalActionHash: null,
		policyResultHash: null,
		publicIntent: `The Master chose ${actionId}.`
	};
}

function scriptedChoice(actorId: string, actionId: string): MissionTurnChoice {
	return {
		actorId,
		actionId,
		source: 'scripted',
		policyId: 'foundry-strategy-script-v1',
		packetHash: sha256Hex(`${actorId}:${actionId}:packet`),
		legalActionHash: sha256Hex(`${actorId}:${actionId}:legal`),
		policyResultHash: sha256Hex(`${actorId}:${actionId}:result`),
		publicIntent: `The hero independently chose ${actionId}.`
	};
}

type CommandBody<T = EngineCommand> = T extends EngineCommand
	? Omit<T, 'commandId' | 'runId' | 'actorId' | 'expectedVersion' | 'correlationId' | 'source'>
	: never;

class FoundryTrialRunner {
	readonly runId: string;
	readonly heroId: string;
	readonly heroIds: readonly string[];
	readonly masterId: string;
	readonly events: AuthoritativeEvent[];
	readonly checkpoints: z.infer<typeof FoundryStrategyCheckpointSchema>[] = [];
	state: EngineGameStateV17;
	private commandOrdinal = 0;

	constructor(strategyId: FoundryStrategyId, seed: string) {
		this.runId = deterministicUuid(`mis-010:${strategyId}:${seed}:run`);
		this.heroId = deterministicUuid(`mis-010:${strategyId}:${seed}:hero`);
		this.heroIds = [
			this.heroId,
			...Array.from({ length: 3 }, (_, index) =>
				deterministicUuid(`mis-010:${strategyId}:${seed}:hero:${index + 2}`)
			)
		];
		const bootstrap = createBootstrapEngine({
			runId: this.runId,
			seed: `mis-010:${strategyId}:${seed}`,
			heroId: this.heroId,
			manifestHash: sha256Hex(`mis-010:${strategyId}:manifest`),
			rarityStars: 7,
			mind: TRIAL_MIND,
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-05',
				availableMissionIds: ['tower-floor-05'],
				enableMasterPermadeath: true,
				...(strategyId === 'hammer-line' ? {} : { foundryRouteMemoryHeroId: this.heroId }),
				additionalHeroes: this.heroIds.slice(1).map((heroId, index) => ({
					heroId,
					manifestHash: sha256Hex(`mis-010:${strategyId}:manifest:${index + 2}`),
					rarityStars: 7,
					mind: TRIAL_MIND
				}))
			}
		});
		this.state = EngineGameStateV17Schema.parse(bootstrap.snapshot.state);
		this.masterId = this.state.master.masterId;
		this.events = [bootstrap.event];
	}

	private commit(
		actorId: string,
		key: string,
		body: CommandBody,
		source:
			| ReturnType<typeof manualSource>
			| ReturnType<typeof scriptedSource>
			| ReturnType<typeof systemSource>
	) {
		this.commandOrdinal += 1;
		const commandId = deterministicUuid(
			`${this.runId}:${String(this.commandOrdinal).padStart(3, '0')}:${key}:${this.state.version}`
		);
		const result = applyCommand(this.state, {
			commandId,
			runId: this.runId,
			actorId,
			expectedVersion: this.state.version,
			correlationId: commandId,
			source,
			...body
		} as EngineCommand);
		this.state = EngineGameStateV17Schema.parse(result.state);
		this.events.push(...result.events);
		return result;
	}

	private assertLegal(actorId: string, actionId: string) {
		const available = legalActions(this.state, actorId).map((candidate) => candidate.actionId);
		if (!available.includes(actionId)) {
			throw new Error(
				`${actionId} is illegal for ${actorId} at version ${this.state.version}; legal: ${available.join(', ')}`
			);
		}
	}

	prepareHeroes() {
		for (const heroId of this.heroIds) this.prepareHero(heroId);
	}

	private prepareHero(heroId: string) {
		this.assertLegal(heroId, 'hero.choose.training-ground');
		this.commit(
			heroId,
			`choose-training-${heroId}`,
			{
				commandType: 'hero.choose.destination',
				destination: 'training-ground',
				firstLine: 'I will make the obvious road survivable before we enter it.',
				storyBranch: 'steel-before-trust'
			},
			scriptedSource()
		);
		this.assertLegal(heroId, 'hero.travel');
		const travel = this.commit(
			heroId,
			`travel-training-${heroId}`,
			{ commandType: 'hero.start.travel', targetNodeId: 'training-ring' },
			scriptedSource()
		);
		this.commit(
			this.masterId,
			'arrive-training',
			{ commandType: 'simulation.advance', targetGameTime: travel.scheduled[0]!.dueGameTime },
			systemSource()
		);

		for (let session = 1; session <= 9; session += 1) {
			if (session === 7) {
				const bow = Object.values(this.state.items).find(
					(item) => item.ownerId === heroId && item.templateId === 'short-bow'
				);
				if (!bow) throw new Error(`Foundry validation bow is missing for ${heroId}`);
				this.assertLegal(heroId, `hero.equip.${bow.itemId}`);
				this.commit(
					heroId,
					`equip-bow-${heroId}`,
					{ commandType: 'hero.equip.item', itemId: bow.itemId },
					scriptedSource()
				);
			}
			this.assertLegal(heroId, 'hero.activity.train');
			const training = this.commit(
				heroId,
				`train-${heroId}-${session}`,
				{ commandType: 'hero.start.activity', activity: 'train' },
				scriptedSource()
			);
			this.commit(
				this.masterId,
				`finish-training-${heroId}-${session}`,
				{
					commandType: 'simulation.advance',
					targetGameTime: training.scheduled[0]!.dueGameTime
				},
				systemSource()
			);
		}
		if (this.state.heroes[heroId]!.progression.skills.swordFighting.rank < 10) {
			throw new Error('Foundry validation hero did not reach sword rank 10');
		}
		this.assertLegal(heroId, 'hero.travel');
		const returnTravel = this.commit(
			heroId,
			`return-to-gate-${heroId}`,
			{ commandType: 'hero.start.travel', targetNodeId: 'gate-rail' },
			scriptedSource()
		);
		this.commit(
			this.masterId,
			`arrive-at-gate-${heroId}`,
			{
				commandType: 'simulation.advance',
				targetGameTime: returnTravel.scheduled[0]!.dueGameTime
			},
			systemSource()
		);
	}

	private missionCommand(key: string, body: CommandBody) {
		return this.commit(this.masterId, key, body, manualSource());
	}

	private roundParty(
		label: string,
		masterActionId: string,
		heroActionIds: Readonly<Record<string, string>>
	) {
		this.assertLegal(this.masterId, masterActionId);
		const partyHeroIds = this.state.mission.attempt!.party.heroIds;
		for (const heroId of partyHeroIds) this.assertLegal(heroId, heroActionIds[heroId]!);
		const result = this.missionCommand(label, {
			commandType: 'mission.resolve.turn',
			choices: [
				manualChoice(this.masterId, masterActionId),
				...partyHeroIds.map((heroId) => scriptedChoice(heroId, heroActionIds[heroId]!))
			]
		});
		this.capture(label);
		return result;
	}

	private capture(label: string) {
		const turn = this.state.mission.attempt?.turnState;
		if (!turn || this.state.mission.binding.missionId !== 'tower-floor-05') return;
		const warden = Object.values(turn.monsters).find(
			(monster) => monster.dutySlotId === 'foundry-warden'
		);
		if (!warden) return;
		this.checkpoints.push({
			label,
			roundNumber: turn.roundNumber,
			furnaceState: turn.arena.furnaceState as 'lit' | 'cooling' | 'quenched',
			wardenVitality: warden.vitality,
			masterHealth: this.state.master.health,
			minimumHeroHealth: Math.min(
				...this.state.mission.attempt!.party.heroIds.map(
					(heroId) => this.state.heroes[heroId]!.health
				)
			)
		});
	}

	private prepareMission(missionId: 'tower-floor-05', heroIds: readonly string[]) {
		this.missionCommand(`prepare-${missionId}`, {
			commandType: 'mission.prepare',
			heroIds: [...heroIds],
			missionId
		});
		this.missionCommand(`deploy-${missionId}`, { commandType: 'mission.deploy' });
		this.capture('Deployed beneath the living furnace');
	}

	enterFoundry() {
		this.prepareMission('tower-floor-05', this.heroIds);
		this.roundParty(
			'Cross the threshold',
			'mission.move.threshold-to-ash-intake',
			Object.fromEntries(
				this.heroIds.map((heroId) => [heroId, 'mission.move.threshold-to-ash-intake'])
			)
		);
	}

	directApproach() {
		this.roundParty(
			'Advance through the Forge Nave',
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId) => [heroId, 'mission.move.ash-intake-to-forge-nave'])
			)
		);
		const watchers = Object.values(this.state.mission.attempt!.turnState.monsters)
			.filter((monster) => monster.dutySlotId === 'forge-nave-watch' && monster.status === 'active')
			.sort((left, right) => left.monsterId.localeCompare(right.monsterId));
		this.roundParty(
			'Break the Forge Nave watch',
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId, index) => [
					heroId,
					watchers[index] ? `mission.attack.${watchers[index].monsterId}` : 'mission.hold'
				])
			)
		);
		this.roundParty(
			'Enter the Furnace Heart',
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId) => [heroId, 'mission.move.forge-nave-to-furnace-heart'])
			)
		);
	}

	exposeCoolingRoute() {
		this.roundParty(
			'Trust the remembered seam',
			'mission.move.ash-intake-to-forge-nave',
			Object.fromEntries(
				this.heroIds.map((heroId) => [
					heroId,
					heroId === this.heroId
						? 'mission.inspect.recall-maintenance-seam'
						: 'mission.move.ash-intake-to-forge-nave'
				])
			)
		);
		const watchers = Object.values(this.state.mission.attempt!.turnState.monsters)
			.filter((monster) => monster.dutySlotId === 'forge-nave-watch' && monster.status === 'active')
			.sort((left, right) => left.monsterId.localeCompare(right.monsterId));
		let watcherIndex = 0;
		this.roundParty(
			'Split at the furnace',
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId) => {
					if (heroId === this.heroId) {
						return [heroId, 'mission.move.ash-intake-to-maintenance-seam'];
					}
					const watcher = watchers[watcherIndex++];
					return [heroId, watcher ? `mission.attack.${watcher.monsterId}` : 'mission.hold'];
				})
			)
		);
		this.roundParty(
			'Reach the cooling control',
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId) => [
					heroId,
					heroId === this.heroId
						? 'mission.move.maintenance-seam-to-cooling-control'
						: 'mission.hold'
				])
			)
		);
		this.roundParty(
			'Read the wheel stages',
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId) => [
					heroId,
					heroId === this.heroId ? 'mission.inspect.test-cooling-wheel' : 'mission.hold'
				])
			)
		);
	}

	advanceCooling(label: string, operatorId = this.heroId) {
		this.roundParty(
			label,
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId) => [
					heroId,
					heroId === operatorId ? 'mission.control.cooling-wheel' : 'mission.hold'
				])
			)
		);
	}

	rotateCoolingOperator(operatorId: string): string {
		this.roundParty(
			'Release the exposed wheel operator',
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId) => [
					heroId,
					heroId === operatorId
						? 'mission.move.cooling-control-to-furnace-heart'
						: 'mission.move.forge-nave-to-furnace-heart'
				])
			)
		);
		const reliefId = this.heroIds.find((heroId) => heroId !== operatorId)!;
		this.roundParty(
			'Post a fresh operator',
			'mission.hold',
			Object.fromEntries(
				this.heroIds.map((heroId) => [
					heroId,
					heroId === reliefId
						? 'mission.move.cooling-control-to-furnace-heart'
						: heroId === operatorId
							? 'mission.move.forge-nave-to-furnace-heart'
							: 'mission.hold'
				])
			)
		);
		return reliefId;
	}

	defeatWarden(strategyId: FoundryStrategyId) {
		let safety = 0;
		while (true) {
			const turn = this.state.mission.attempt!.turnState;
			const warden = Object.values(turn.monsters).find(
				(monster) => monster.dutySlotId === 'foundry-warden'
			)!;
			if (warden.status === 'defeated') break;
			safety += 1;
			if (safety > 24) throw new Error('The strategy could not defeat the Warden');
			const targetId = turn.currentThreatIntents.find(
				(intent) => intent.monsterId === warden.monsterId
			)?.targetId;
			const positions = this.state.mission.attempt!.positions;
			if (strategyId === 'hammer-line') {
				const targetHeroId = targetId && this.heroIds.includes(targetId) ? targetId : null;
				const returningHeroId = this.heroIds.find(
					(heroId) => positions[heroId] === 'forge-nave' && heroId !== targetHeroId
				);
				this.roundParty(
					`Rotate and strike the lit Warden · ${safety}`,
					'mission.hold',
					Object.fromEntries(
						this.heroIds.map((heroId) => [
							heroId,
							heroId === targetHeroId
								? 'mission.move.forge-nave-to-furnace-heart'
								: heroId === returningHeroId
									? 'mission.move.forge-nave-to-furnace-heart'
									: positions[heroId] === 'furnace-heart'
										? `mission.attack.${warden.monsterId}`
										: 'mission.hold'
						])
					)
				);
				continue;
			}

			const controlHeroes = this.heroIds.filter(
				(heroId) => positions[heroId] === 'cooling-control'
			);
			const targetHeroId = targetId && controlHeroes.includes(targetId) ? targetId : null;
			const targetGuard = targetHeroId ? turn.partyGuard[targetHeroId]!.guard : null;
			const shouldRotateTarget =
				targetHeroId !== null &&
				(this.state.heroes[targetHeroId]!.health <= 50 || targetGuard === 0);
			const availableSlots = 2 - controlHeroes.length + (shouldRotateTarget ? 1 : 0);
			const entrants = this.heroIds
				.filter((heroId) => positions[heroId] === 'furnace-heart')
				.filter((heroId) => heroId !== targetHeroId)
				.slice(0, Math.max(0, availableSlots));
			this.roundParty(
				`Hold and strike at the cooling control · ${safety}`,
				'mission.hold',
				Object.fromEntries(
					this.heroIds.map((heroId) => {
						if (heroId === targetHeroId) {
							return [
								heroId,
								shouldRotateTarget
									? 'mission.move.cooling-control-to-furnace-heart'
									: 'mission.hold'
							];
						}
						if (controlHeroes.includes(heroId)) {
							return [heroId, `mission.attack.${warden.monsterId}`];
						}
						if (entrants.includes(heroId)) {
							return [heroId, 'mission.move.cooling-control-to-furnace-heart'];
						}
						return [heroId, 'mission.hold'];
					})
				)
			);
		}
	}

	returnAndExtract() {
		const returnAction = (nodeId: string): string =>
			({
				'cooling-control': 'mission.move.cooling-control-to-furnace-heart',
				'furnace-heart': 'mission.move.forge-nave-to-furnace-heart',
				'forge-nave': 'mission.move.ash-intake-to-forge-nave',
				'ash-intake': 'mission.move.threshold-to-ash-intake',
				'tower-threshold': 'mission.hold'
			})[nodeId] ?? 'mission.hold';
		let returnRound = 0;
		while (
			this.state.mission.attempt!.party.memberIds.some(
				(actorId) => this.state.mission.attempt!.positions[actorId] !== 'tower-threshold'
			)
		) {
			returnRound += 1;
			if (returnRound > 6) throw new Error('The company could not return to the threshold');
			const positions = this.state.mission.attempt!.positions;
			this.roundParty(
				`Return formation · ${returnRound}`,
				returnAction(positions[this.masterId]!),
				Object.fromEntries(this.heroIds.map((heroId) => [heroId, returnAction(positions[heroId]!)]))
			);
		}
		this.missionCommand('extract-living-foundry', { commandType: 'mission.extract' });
	}
}

export function createFoundryStrategyTrial(
	strategyId: FoundryStrategyId,
	seed: string
): FoundryStrategyTrial {
	const runner = new FoundryTrialRunner(strategyId, seed);
	runner.prepareHeroes();
	runner.enterFoundry();
	if (strategyId === 'hammer-line') {
		runner.directApproach();
	} else {
		runner.exposeCoolingRoute();
		runner.advanceCooling('Open the cooling circuit');
		const reliefId = runner.rotateCoolingOperator(runner.heroId);
		if (strategyId === 'full-quench') runner.advanceCooling('Quench the furnace', reliefId);
	}
	runner.defeatWarden(strategyId);
	const attemptAtDefeat = runner.state.mission.attempt!;
	const furnaceStateAtDefeat = attemptAtDefeat.turnState.arena.furnaceState as
		'lit' | 'cooling' | 'quenched';
	runner.returnAndExtract();

	const attempt = runner.state.mission.attempt!;
	const replay = replayEventsStrict(runner.events);
	const heroes = runner.heroIds.map((heroId) => runner.state.heroes[heroId]!);
	const consequences = runner.state.mission.aftermath.consequences;
	const rounds = attempt.turnState.rounds;
	const wardenStrikes = rounds.reduce(
		(total, round) =>
			total +
			round.actions.filter(
				(action) =>
					runner.heroIds.includes(action.actorId) && action.actionId.startsWith('mission.attack.')
			).length,
		0
	);
	const controlActions = rounds.reduce(
		(total, round) =>
			total +
			round.actions.filter((action) => action.actionId === 'mission.control.cooling-wheel').length,
		0
	);
	if (
		attempt.status !== 'success' ||
		runner.state.status !== 'active' ||
		runner.state.master.lifeState !== 'alive' ||
		heroes.some((hero) => hero.lifeState !== 'active') ||
		!replay.verified ||
		hashGameState(replay.snapshot.state) !== hashGameState(runner.state) ||
		furnaceStateAtDefeat !==
			FOUNDRY_STRATEGY_DEFINITIONS.find((definition) => definition.strategyId === strategyId)!
				.targetFurnaceState
	) {
		throw new Error(`${strategyId}/${seed} failed the Foundry viability boundary`);
	}

	return FoundryStrategyTrialSchema.parse({
		strategyId,
		seed,
		runId: runner.runId,
		status: 'success',
		replayVerified: true,
		stateHash: hashGameState(runner.state),
		eventLogHash: hashCanonical(runner.events),
		eventCount: runner.events.length,
		trainingSessionsPerHero: 9,
		partyHeroCount: runner.heroIds.length,
		swordRanksAtDeployment: heroes.map((hero) => hero.progression.skills.swordFighting.rank),
		routeMemoryUsed: strategyId !== 'hammer-line',
		furnaceStateAtDefeat,
		missionRounds: rounds.length,
		wardenStrikes,
		controlActions,
		masterHealthAfter: runner.state.master.health,
		minimumHeroHealthAfter: Math.min(...heroes.map((hero) => hero.health)),
		nonfatalConsequences: consequences.filter((consequence) => !consequence.fatal).length,
		fatalConsequences: 0,
		checkpoints: representativeCheckpoints(runner.checkpoints)
	});
}

function representativeCheckpoints(
	checkpoints: readonly z.infer<typeof FoundryStrategyCheckpointSchema>[]
): z.infer<typeof FoundryStrategyCheckpointSchema>[] {
	const first = checkpoints[0]!;
	const firstDamage = checkpoints.find((checkpoint) => checkpoint.wardenVitality < 18) ?? first;
	const furnaceChanges = checkpoints.filter(
		(checkpoint, index) =>
			index > 0 && checkpoint.furnaceState !== checkpoints[index - 1]!.furnaceState
	);
	const defeated = checkpoints.find((checkpoint) => checkpoint.wardenVitality === 0)!;
	const extracted = checkpoints.at(-1)!;
	return [
		...new Map(
			[first, ...furnaceChanges, firstDamage, defeated, extracted].map((checkpoint) => [
				`${checkpoint.roundNumber}:${checkpoint.label}`,
				checkpoint
			])
		).values()
	];
}

function range(values: readonly number[]): [number, number] {
	return [Math.min(...values), Math.max(...values)];
}

export function createFoundryStrategyReport(): FoundryStrategyReport {
	const trials = FOUNDRY_STRATEGY_DEFINITIONS.flatMap((definition) =>
		TRIAL_SEEDS.map((seed) => {
			try {
				return createFoundryStrategyTrial(definition.strategyId, seed);
			} catch (error) {
				throw new Error(
					`${definition.strategyId}/${seed}: ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error }
				);
			}
		})
	);
	const summaries = FOUNDRY_STRATEGY_DEFINITIONS.map((definition) => {
		const strategyTrials = trials.filter((trial) => trial.strategyId === definition.strategyId);
		return FoundryStrategySummarySchema.parse({
			strategyId: definition.strategyId,
			status: 'viable',
			trialsPassed: strategyTrials.length,
			trialsTotal: strategyTrials.length,
			replayPassRate: 1,
			survivalRate: 1,
			minimumMasterHealth: Math.min(...strategyTrials.map((trial) => trial.masterHealthAfter)),
			minimumHeroHealth: Math.min(...strategyTrials.map((trial) => trial.minimumHeroHealthAfter)),
			missionRoundRange: range(strategyTrials.map((trial) => trial.missionRounds)),
			wardenStrikeRange: range(strategyTrials.map((trial) => trial.wardenStrikes)),
			representativeRunId: strategyTrials[0]!.runId
		});
	});
	const unsigned = {
		schemaVersion: FOUNDRY_STRATEGY_REPORT_VERSION,
		generatorVersion: FOUNDRY_STRATEGY_GENERATOR_VERSION,
		generatedAt: FOUNDRY_STRATEGY_GENERATED_AT,
		engineContentVersion: 'engine-v17' as const,
		missionId: 'tower-floor-05' as const,
		missionContentVersion: 'tower-floor-05-v2' as const,
		criteria: {
			requiredStrategies: 3 as const,
			requiredTrialsPerStrategy: 8 as const,
			requiredReplayPassRate: 1 as const,
			requiredSurvivalRate: 1 as const,
			maximumMissionRounds: 48 as const,
			requireLegalEngineCommandsOnly: true as const,
			sampleKind: 'fixed-success-regression-matrix' as const,
			notWinRateEstimate: true as const
		},
		definitions: FOUNDRY_STRATEGY_DEFINITIONS,
		qualityGate: {
			status: 'pass' as const,
			viableStrategies: 3 as const,
			trialsPassed: 24 as const,
			trialsTotal: 24 as const,
			replayMismatches: 0 as const,
			deaths: 0 as const
		},
		summaries,
		trials
	};
	return FoundryStrategyReportSchema.parse({ ...unsigned, reportHash: hashCanonical(unsigned) });
}

import {
	EngineGameStateV18Schema,
	type AuthoritativeEvent,
	type EngineCommand,
	type MissionTurnChoice
} from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	hashGameState,
	replayEventsStrict,
	sha256Hex
} from '@summonlab/engine';
import { z } from 'zod';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

const AttemptSummarySchema = z
	.object({
		attemptId: z.string().uuid(),
		ordinal: z.number().int().positive(),
		missionId: z.string().min(1),
		status: z.string().min(1),
		outcome: z.string().nullable(),
		roundNumber: z.number().int().nonnegative(),
		consequenceCount: z.number().int().nonnegative()
	})
	.strict();

const ConsequenceSummarySchema = z
	.object({
		consequenceId: z.string().uuid(),
		sourceAttemptId: z.string().uuid(),
		targetKind: z.enum(['master', 'hero']),
		targetId: z.string().uuid(),
		roundNumber: z.number().int().positive(),
		nodeId: z.string().min(1),
		healthBefore: z.number().int().nonnegative(),
		healthAfter: z.number().int().nonnegative(),
		fatal: z.boolean(),
		summary: z.string().min(1)
	})
	.strict();

export const AttemptAftermathReportSchema = z
	.object({
		schemaVersion: z.literal('attempt-aftermath-report-v1'),
		engineContentVersion: z.literal('engine-v18'),
		replayVerified: z.literal(true),
		runId: z.string().uuid(),
		sourceAttempt: AttemptSummarySchema,
		activeAttempt: AttemptSummarySchema,
		archivedConsequences: z.array(ConsequenceSummarySchema).min(1),
		activeConsequenceCount: z.literal(0),
		archiveCount: z.literal(1),
		eventCount: z.number().int().positive(),
		eventLogHash: HashSchema,
		stateHash: HashSchema,
		timeline: z
			.array(
				z
					.object({
						sequence: z.number().int().positive(),
						eventType: z.string().min(1),
						summary: z.string().min(1)
					})
					.strict()
			)
			.min(1)
	})
	.strict();

export type AttemptAftermathReport = z.infer<typeof AttemptAftermathReportSchema>;

function manualSource() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function choice(
	actorId: string,
	actionId: string,
	source: 'manual' | 'scripted'
): MissionTurnChoice {
	return {
		actorId,
		actionId,
		source,
		policyId: source === 'scripted' ? 'attempt-aftermath-script-v1' : null,
		packetHash: source === 'scripted' ? sha256Hex(`${actorId}:${actionId}:packet`) : null,
		legalActionHash: source === 'scripted' ? sha256Hex(`${actorId}:${actionId}:legal`) : null,
		policyResultHash: source === 'scripted' ? sha256Hex(`${actorId}:${actionId}:result`) : null,
		publicIntent: `The player chose ${actionId}.`
	};
}

export function generateAttemptAftermathReport(): AttemptAftermathReport {
	const runId = deterministicUuid('attempt-aftermath-run');
	const heroId = deterministicUuid('attempt-aftermath-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'foundry-evidence-seed',
		heroId,
		manifestHash: sha256Hex('attempt-aftermath-report-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-04',
			availableMissionIds: ['tower-floor-04', 'tower-floor-05'],
			enableAttemptAftermath: true
		}
	});
	let state = EngineGameStateV18Schema.parse(bootstrap.snapshot.state);
	const masterId = state.master.masterId;
	const events: AuthoritativeEvent[] = [bootstrap.event];
	const commit = (key: string, body: object) => {
		const commandId = deterministicUuid(`${runId}:${key}:${state.version}`);
		const result = applyCommand(state, {
			commandId,
			runId,
			actorId: masterId,
			expectedVersion: state.version,
			correlationId: commandId,
			source: manualSource(),
			...body
		} as unknown as EngineCommand);
		state = EngineGameStateV18Schema.parse(result.state);
		events.push(...result.events);
	};
	const turn = (key: string, masterActionId: string, heroActionId: string) =>
		commit(key, {
			commandType: 'mission.resolve.turn',
			choices: [
				choice(masterId, masterActionId, 'manual'),
				choice(heroId, heroActionId, 'scripted')
			]
		});

	commit('prepare-floor-04', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-04'
	});
	commit('deploy-floor-04', { commandType: 'mission.deploy' });
	turn(
		'enter-balance',
		'mission.move.threshold-to-balance-hall',
		'mission.move.threshold-to-balance-hall'
	);
	turn(
		'enter-left-relay',
		'mission.move.balance-hall-to-left-relay',
		'mission.move.balance-hall-to-left-relay'
	);
	turn('open-archive', 'mission.hold', 'mission.inspect.open-archive-niche');
	turn(
		'enter-archive',
		'mission.move.left-relay-to-archive-niche',
		'mission.move.left-relay-to-archive-niche'
	);
	turn('read-schematic', 'mission.hold', 'mission.inspect.read-foundry-schematic');
	turn(
		'leave-archive',
		'mission.move.left-relay-to-archive-niche',
		'mission.move.left-relay-to-archive-niche'
	);
	turn(
		'return-balance',
		'mission.move.balance-hall-to-left-relay',
		'mission.move.balance-hall-to-left-relay'
	);
	turn(
		'return-threshold',
		'mission.move.threshold-to-balance-hall',
		'mission.move.threshold-to-balance-hall'
	);
	commit('retreat-floor-04', { commandType: 'mission.retreat' });
	commit('prepare-floor-05', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-05'
	});

	const replay = replayEventsStrict(events);
	if (!replay.verified || replay.snapshot.state.schemaVersion !== 18) {
		throw new Error('Attempt aftermath report failed strict replay');
	}
	const archive = state.mission.aftermath.archives[0]!;
	const active = state.mission.attempt!;
	const summaries = archive.consequences.map((consequence) => ({
		consequenceId: consequence.consequenceId,
		sourceAttemptId: consequence.sourceAttemptId,
		targetKind: 'consequenceKind' in consequence ? ('master' as const) : ('hero' as const),
		targetId:
			'consequenceKind' in consequence ? consequence.targetMasterId : consequence.targetHeroId,
		roundNumber: consequence.roundNumber,
		nodeId: consequence.nodeId,
		healthBefore: consequence.healthBefore,
		healthAfter: consequence.healthAfter,
		fatal: consequence.fatal,
		summary: consequence.summary
	}));
	return AttemptAftermathReportSchema.parse({
		schemaVersion: 'attempt-aftermath-report-v1',
		engineContentVersion: state.contentVersion,
		replayVerified: replay.verified,
		runId,
		sourceAttempt: {
			attemptId: archive.attemptId,
			ordinal: archive.ordinal,
			missionId: archive.binding.missionId,
			status: archive.outcome,
			outcome: archive.outcome,
			roundNumber: archive.finalRoundNumber,
			consequenceCount: archive.consequences.length
		},
		activeAttempt: {
			attemptId: active.attemptId,
			ordinal: active.ordinal,
			missionId: state.mission.binding.missionId,
			status: active.status,
			outcome: active.outcome,
			roundNumber: active.turnState.roundNumber,
			consequenceCount: state.mission.aftermath.consequences.length
		},
		archivedConsequences: summaries,
		activeConsequenceCount: state.mission.aftermath.consequences.length,
		archiveCount: state.mission.aftermath.archives.length,
		eventCount: events.length,
		eventLogHash: hashCanonical(events),
		stateHash: hashGameState(state),
		timeline: events
			.filter((event) => event.eventType.startsWith('mission.'))
			.map((event) => ({
				sequence: event.sequence,
				eventType: event.eventType,
				summary: String((event.payload as { summary?: unknown }).summary ?? event.eventType)
			}))
	});
}

import {
	EngineGameStateV20Schema,
	PlayerJournalReportSchema,
	type ActionSource,
	type AuthoritativeEvent,
	type EngineCommand
} from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	projectPlayerJournal,
	replayEventsStrict,
	sha256Hex
} from '@summonlab/engine';
import { z } from 'zod';

export const PlayerJournalEvidenceSchema = z
	.object({
		schemaVersion: z.literal('player-journal-evidence-v1'),
		engineContentVersion: z.literal('engine-v20'),
		replayVerified: z.literal(true),
		runId: z.string().uuid(),
		assertions: z
			.object({
				experienceGain: z.literal(16),
				levelGain: z.literal(1),
				attemptsStarted: z.literal(1),
				directionRecords: z.number().int().positive(),
				storyChanges: z.number().int().positive(),
				exactReplayCursor: z.literal(true)
			})
			.strict(),
		journal: PlayerJournalReportSchema
	})
	.strict();

export type PlayerJournalEvidence = z.infer<typeof PlayerJournalEvidenceSchema>;

const scriptedSource: ActionSource = {
	source: 'scripted',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};
const systemSource: ActionSource = { ...scriptedSource, source: 'system' };
const manualSource: ActionSource = { ...scriptedSource, source: 'manual', timing: 'step' };

export function generatePlayerJournalEvidence(): PlayerJournalEvidence {
	const runId = deterministicUuid('player-journal-evidence-run');
	const heroId = deterministicUuid('player-journal-evidence-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'player-journal-evidence-seed',
		heroId,
		manifestHash: sha256Hex('player-journal-evidence-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableMasterFallback: true
		}
	});
	let state = EngineGameStateV20Schema.parse(bootstrap.snapshot.state);
	const events: AuthoritativeEvent[] = [bootstrap.event];
	const masterId = state.master.masterId;
	let commandOrdinal = 0;

	const commit = (
		actorId: string,
		key: string,
		fields: Record<string, unknown>,
		source: ActionSource
	) => {
		commandOrdinal += 1;
		const commandId = deterministicUuid(
			`${runId}:journal:${String(commandOrdinal).padStart(2, '0')}:${key}:${state.version}`
		);
		const result = applyCommand(state, {
			commandId,
			runId,
			actorId,
			expectedVersion: state.version,
			correlationId: commandId,
			source,
			...fields
		} as EngineCommand);
		state = EngineGameStateV20Schema.parse(result.state);
		events.push(...result.events);
		return result;
	};

	commit(
		heroId,
		'choose-training',
		{
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Record what I do, not what anyone claims I did.',
			storyBranch: 'steel-before-trust'
		},
		scriptedSource
	);
	const outbound = commit(
		heroId,
		'travel-training',
		{ commandType: 'hero.start.travel', targetNodeId: 'training-ring' },
		scriptedSource
	);
	commit(
		masterId,
		'arrive-training',
		{ commandType: 'simulation.advance', targetGameTime: outbound.scheduled[0]!.dueGameTime },
		systemSource
	);
	for (let session = 1; session <= 2; session += 1) {
		const training = commit(
			heroId,
			`train-${session}`,
			{ commandType: 'hero.start.activity', activity: 'train' },
			scriptedSource
		);
		commit(
			masterId,
			`finish-training-${session}`,
			{
				commandType: 'simulation.advance',
				targetGameTime: training.scheduled[0]!.dueGameTime
			},
			systemSource
		);
	}
	const inbound = commit(
		heroId,
		'return-gate',
		{ commandType: 'hero.start.travel', targetNodeId: 'gate-rail' },
		scriptedSource
	);
	commit(
		masterId,
		'arrive-gate',
		{ commandType: 'simulation.advance', targetGameTime: inbound.scheduled[0]!.dueGameTime },
		systemSource
	);
	commit(
		masterId,
		'configure-doctrine',
		{
			commandType: 'master.configure.fallback',
			policy: 'directed',
			directionText: 'Advance the objective, but preserve the company when the way is unclear.',
			priorities: ['focus-objective', 'protect-party', 'seek-secrets'],
			protectedHeroId: heroId,
			safetyStops: {
				beforeIrreversibleAction: true,
				whenUnclassified: true,
				masterHealthThreshold: 35,
				maximumConsecutiveFallbacks: 8
			},
			observedAt: state.simulatedAt
		},
		manualSource
	);
	commit(
		masterId,
		'prepare-floor-01',
		{ commandType: 'mission.prepare', missionId: 'tower-floor-01', heroIds: [heroId] },
		manualSource
	);

	const replay = replayEventsStrict(events);
	if (!replay.verified || replay.snapshot.state.schemaVersion !== 20) {
		throw new Error('Player journal evidence failed strict replay');
	}
	const journal = projectPlayerJournal(events);
	const deltaTotal = (kind: 'experience' | 'level') =>
		journal.deltaTotals
			.filter((delta) => delta.kind === kind)
			.reduce((total, delta) => total + delta.delta, 0);
	const directionRecords = journal.entries.reduce(
		(total, entry) => total + entry.directions.length,
		0
	);
	const storyChanges = journal.entries.reduce(
		(total, entry) => total + entry.storyChanges.length,
		0
	);

	return PlayerJournalEvidenceSchema.parse({
		schemaVersion: 'player-journal-evidence-v1',
		engineContentVersion: state.contentVersion,
		replayVerified: replay.verified,
		runId,
		assertions: {
			experienceGain: deltaTotal('experience'),
			levelGain: deltaTotal('level'),
			attemptsStarted: journal.partyTotals.attemptsStarted,
			directionRecords,
			storyChanges,
			exactReplayCursor: journal.toCursor === replay.snapshot.state.eventCursor
		},
		journal
	});
}

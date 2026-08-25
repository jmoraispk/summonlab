import {
	EngineGameStateV20Schema,
	MasterDecisionResolutionV2Schema,
	type ActionSource,
	type AuthoritativeEvent,
	type EngineCommand,
	type MasterFallbackPriority,
	type MasterFallbackSafetyStops,
	type MissionTurnChoice
} from '@summonlab/contracts';
import {
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	hashGameState,
	isIrreversibleMasterAction,
	legalActions,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	replayEventsStrict,
	selectMasterFallback,
	sha256Hex
} from '@summonlab/engine';
import { z } from 'zod';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

const PolicyEvidenceSchema = z
	.object({
		policy: z.enum(['directed', 'random']),
		policyId: z.enum(['master-directed-v1', 'master-random-v1']),
		selectedActionId: z.string().min(1),
		classification: z.enum(['classified', 'unclassified']),
		packetHash: HashSchema,
		legalActionHash: HashSchema,
		policyResultHash: HashSchema,
		repeatPolicyResultHash: HashSchema,
		reproducible: z.literal(true)
	})
	.strict();

const SafetyEvidenceSchema = z
	.object({
		reason: z.enum([
			'irreversible-action',
			'master-health',
			'unclassified-state',
			'fallback-limit'
		]),
		decisionId: z.string().uuid().nullable(),
		blockedActionId: z.string().min(1),
		outcome: z.enum(['classifier-verified', 'safety-stopped']),
		resultHash: HashSchema
	})
	.strict();

export const MasterFallbackReportSchema = z
	.object({
		schemaVersion: z.literal('master-fallback-report-v1'),
		engineContentVersion: z.literal('engine-v20'),
		replayVerified: z.literal(true),
		runId: z.string().uuid(),
		defaultPolicy: z.literal('directed'),
		policyEvidence: z.array(PolicyEvidenceSchema).length(2),
		safetyEvidence: z.array(SafetyEvidenceSchema).length(4),
		eventCount: z.number().int().positive(),
		eventLogHash: HashSchema,
		stateHash: HashSchema,
		timeline: z
			.array(
				z
					.object({
						sequence: z.number().int().positive(),
						eventType: z.string().min(1),
						timing: z.enum(['wait', 'countdown', 'step', 'continuous']).nullable(),
						fallbackPolicy: z.enum(['directed', 'random']).nullable(),
						source: z.string().min(1),
						summary: z.string().min(1)
					})
					.strict()
			)
			.min(1)
	})
	.strict();

export type MasterFallbackReport = z.infer<typeof MasterFallbackReportSchema>;

const manualSource: ActionSource = {
	source: 'manual',
	timing: 'step',
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

function heroChoice(actorId: string): MissionTurnChoice {
	return {
		actorId,
		actionId: 'mission.hold',
		source: 'scripted',
		policyId: 'scripted-personality-v1',
		packetHash: sha256Hex(`${actorId}:fallback-report:packet`),
		legalActionHash: sha256Hex(`${actorId}:fallback-report:legal`),
		policyResultHash: sha256Hex(`${actorId}:fallback-report:result`),
		publicIntent: 'The hero independently chose to hold position.'
	};
}

export function generateMasterFallbackReport(): MasterFallbackReport {
	const runId = deterministicUuid('master-fallback-report-run');
	const heroId = deterministicUuid('master-fallback-report-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'master-fallback-report-seed',
		heroId,
		manifestHash: sha256Hex('master-fallback-report-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableMasterFallback: true
		}
	});
	let state = EngineGameStateV20Schema.parse(bootstrap.snapshot.state);
	const masterId = state.master.masterId;
	const events: AuthoritativeEvent[] = [bootstrap.event];
	const policyEvidence: z.infer<typeof PolicyEvidenceSchema>[] = [];
	const safetyEvidence: z.infer<typeof SafetyEvidenceSchema>[] = [];
	const noSafety: MasterFallbackSafetyStops = {
		beforeIrreversibleAction: false,
		masterHealthThreshold: null,
		whenUnclassified: false,
		maximumConsecutiveFallbacks: null
	};
	const commit = (key: string, body: object, source: ActionSource = manualSource) => {
		const commandId = deterministicUuid(`${runId}:${key}:${state.version}`);
		const result = applyCommand(state, {
			commandId,
			runId,
			actorId: masterId,
			expectedVersion: state.version,
			correlationId: commandId,
			source,
			...body
		} as unknown as EngineCommand);
		state = EngineGameStateV20Schema.parse(result.state);
		events.push(...result.events);
	};
	const configure = (
		key: string,
		observedAt: string,
		policy: 'directed' | 'random',
		directionText: string,
		priorities: MasterFallbackPriority[],
		safetyStops: MasterFallbackSafetyStops
	) =>
		commit(key, {
			commandType: 'master.configure.fallback',
			policy,
			directionText,
			priorities,
			protectedHeroId: null,
			safetyStops,
			observedAt
		});
	const timing = (key: string, observedAt: string, value: 'wait' | 'continuous') =>
		commit(key, {
			commandType: 'master.configure.timing',
			timing: value,
			countdownSeconds: 5,
			observedAt
		});
	const stop = (key: string, observedAt: string) => {
		const selection = selectMasterFallback(state);
		commit(
			key,
			{
				commandType: 'master.apply.safety-stop',
				decisionId: state.masterControl.activeDecision!.decisionId,
				observedAt
			},
			masterFallbackSafetySource(state)
		);
		const resolution = MasterDecisionResolutionV2Schema.parse(state.masterControl.lastResolution);
		safetyEvidence.push({
			reason: selection.safetyStopReason!,
			decisionId: resolution.decisionId,
			blockedActionId: selection.selectedActionId!,
			outcome: 'safety-stopped',
			resultHash: selection.policyResultHash
		});
	};
	const resolve = (key: string, resolvedAt: string) => {
		const choice = masterFallbackMissionChoice(state);
		commit(
			key,
			{
				commandType: 'mission.resolve.turn',
				decisionId: state.masterControl.activeDecision!.decisionId,
				resolvedAt,
				choices: [choice, heroChoice(heroId)]
			},
			masterFallbackActionSource(state)
		);
	};
	const recordPolicy = () => {
		const first = selectMasterFallback(state);
		const repeated = selectMasterFallback(state);
		if (first.policyResultHash !== repeated.policyResultHash) {
			throw new Error('Fallback selection was not reproducible');
		}
		policyEvidence.push({
			policy: first.policy,
			policyId: first.policyId,
			selectedActionId: first.selectedActionId!,
			classification: first.classification,
			packetHash: first.packetHash,
			legalActionHash: first.legalActionHash,
			policyResultHash: first.policyResultHash,
			repeatPolicyResultHash: repeated.policyResultHash,
			reproducible: true
		});
	};

	commit('prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-01'
	});
	const deployAction = legalActions(state, masterId).find(
		(candidate) => candidate.actionId === 'mission.deploy'
	)!;
	safetyEvidence.push({
		reason: 'irreversible-action',
		decisionId: null,
		blockedActionId: deployAction.actionId,
		outcome: 'classifier-verified',
		resultHash: hashCanonical({
			deployAction,
			classified: isIrreversibleMasterAction(deployAction)
		})
	});
	commit('deploy', { commandType: 'mission.deploy' });

	configure(
		'health-config',
		'2032-01-01T00:00:00.000Z',
		'directed',
		'Advance the objective while protecting the company.',
		['focus-objective', 'protect-self', 'protect-party'],
		{ ...noSafety, masterHealthThreshold: 100 }
	);
	timing('health-timing', '2032-01-01T00:00:01.000Z', 'continuous');
	commit('health-open', {
		commandType: 'master.open.decision',
		observedAt: '2032-01-01T00:00:02.000Z'
	});
	recordPolicy();
	stop('health-stop', '2032-01-01T00:00:03.000Z');

	configure(
		'limit-config',
		'2032-01-01T00:00:04.000Z',
		'directed',
		'Seek the objective and defend if threatened.',
		['focus-objective', 'protect-self'],
		{ ...noSafety, maximumConsecutiveFallbacks: 1 }
	);
	timing('limit-timing', '2032-01-01T00:00:05.000Z', 'continuous');
	resolve('limit-first-turn', '2032-01-01T00:00:06.000Z');
	stop('limit-stop', '2032-01-01T00:00:07.000Z');

	configure(
		'random-config',
		'2032-01-01T00:00:08.000Z',
		'random',
		'Let the seed choose among the current legal actions.',
		[],
		noSafety
	);
	timing('random-timing', '2032-01-01T00:00:09.000Z', 'continuous');
	recordPolicy();
	resolve('random-turn', '2032-01-01T00:00:10.000Z');

	configure(
		'unclassified-config',
		'2032-01-01T00:00:11.000Z',
		'directed',
		'Dance beautifully.',
		[],
		{ ...noSafety, whenUnclassified: true }
	);
	stop('unclassified-stop', '2032-01-01T00:00:12.000Z');

	const replay = replayEventsStrict(events);
	if (!replay.verified || replay.snapshot.state.schemaVersion !== 20) {
		throw new Error('Master fallback report failed strict replay');
	}
	return MasterFallbackReportSchema.parse({
		schemaVersion: 'master-fallback-report-v1',
		engineContentVersion: state.contentVersion,
		replayVerified: replay.verified,
		runId,
		defaultPolicy: 'directed',
		policyEvidence,
		safetyEvidence,
		eventCount: events.length,
		eventLogHash: hashCanonical(events),
		stateHash: hashGameState(state),
		timeline: events
			.filter(
				(event) => event.eventType.startsWith('mission.') || event.eventType.startsWith('master.')
			)
			.map((event) => ({
				sequence: event.sequence,
				eventType: event.eventType,
				timing: event.source.timing,
				fallbackPolicy: event.source.fallbackPolicy,
				source: event.source.source,
				summary: String((event.payload as { summary?: unknown }).summary ?? event.eventType)
			}))
	});
}

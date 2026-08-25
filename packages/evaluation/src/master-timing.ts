import {
	EngineGameStateV19Schema,
	MasterDecisionResolutionSchema,
	type ActionSource,
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

const ModeResultSchema = z
	.object({
		timing: z.enum(['wait', 'countdown', 'step', 'continuous']),
		resolutionCount: z.number().int().positive(),
		outcome: z.enum(['manual', 'fallback']),
		expiryOutcome: z.enum([
			'not-applicable',
			'manual-before-expiry',
			'expired-to-fallback',
			'immediate-fallback'
		]),
		source: z.enum(['manual', 'countdown', 'step', 'continuous']),
		nextTiming: z.enum(['wait', 'countdown', 'step', 'continuous']),
		nextDecisionOrdinal: z.number().int().positive()
	})
	.strict();

export const MasterTimingReportSchema = z
	.object({
		schemaVersion: z.literal('master-timing-report-v1'),
		engineContentVersion: z.literal('engine-v19'),
		replayVerified: z.literal(true),
		runId: z.string().uuid(),
		countdownSeconds: z.literal(5),
		baselinePolicyId: z.literal('master-timing-baseline-v1'),
		modes: z.array(ModeResultSchema).length(4),
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
						source: z.string().min(1),
						summary: z.string().min(1)
					})
					.strict()
			)
			.min(1)
	})
	.strict();

export type MasterTimingReport = z.infer<typeof MasterTimingReportSchema>;

function manualControlSource(): ActionSource {
	return {
		source: 'manual',
		timing: 'step',
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function policyChoice(actorId: string, actionId: string, policyId: string): MissionTurnChoice {
	return {
		actorId,
		actionId,
		source: 'scripted',
		policyId,
		packetHash: sha256Hex(`${actorId}:${actionId}:${policyId}:packet`),
		legalActionHash: sha256Hex(`${actorId}:${actionId}:${policyId}:legal`),
		policyResultHash: sha256Hex(`${actorId}:${actionId}:${policyId}:result`),
		publicIntent: `${policyId} chose to hold position.`
	};
}

export function generateMasterTimingReport(): MasterTimingReport {
	const runId = deterministicUuid('master-timing-report-run');
	const heroId = deterministicUuid('master-timing-report-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'master-timing-report-seed',
		heroId,
		manifestHash: sha256Hex('master-timing-report-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableMasterTiming: true
		}
	});
	let state = EngineGameStateV19Schema.parse(bootstrap.snapshot.state);
	const masterId = state.master.masterId;
	const events: AuthoritativeEvent[] = [bootstrap.event];
	const modeResults: z.infer<typeof ModeResultSchema>[] = [];
	const commit = (key: string, body: object, source: ActionSource = manualControlSource()) => {
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
		state = EngineGameStateV19Schema.parse(result.state);
		events.push(...result.events);
	};
	const resolve = (
		key: string,
		resolvedAt: string,
		timing: 'wait' | 'countdown' | 'step' | 'continuous',
		manual: boolean
	) => {
		const decision = state.masterControl.activeDecision!;
		const source: ActionSource = {
			source: manual || timing === 'wait' ? 'manual' : timing,
			timing,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		};
		commit(
			key,
			{
				commandType: 'mission.resolve.turn',
				decisionId: decision.decisionId,
				resolvedAt,
				choices: [
					manual
						? {
								actorId: masterId,
								actionId: 'mission.hold',
								source: 'manual',
								policyId: null,
								packetHash: null,
								legalActionHash: null,
								policyResultHash: null,
								publicIntent: 'The Master chose to hold position.'
							}
						: policyChoice(masterId, 'mission.hold', 'master-timing-baseline-v1'),
					policyChoice(heroId, 'mission.hold', 'scripted-personality-v1')
				]
			},
			source
		);
		return MasterDecisionResolutionSchema.parse(state.masterControl.lastResolution);
	};
	const record = (
		timing: 'wait' | 'countdown' | 'step' | 'continuous',
		resolutions: readonly z.infer<typeof MasterDecisionResolutionSchema>[]
	) => {
		const final = resolutions.at(-1)!;
		modeResults.push({
			timing,
			resolutionCount: resolutions.length,
			outcome: final.outcome as 'manual' | 'fallback',
			expiryOutcome: final.expiryOutcome as z.infer<typeof ModeResultSchema>['expiryOutcome'],
			source: final.source.source as z.infer<typeof ModeResultSchema>['source'],
			nextTiming: state.masterControl.timing,
			nextDecisionOrdinal: state.masterControl.activeDecision!.ordinal
		});
	};

	commit('prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-01'
	});
	commit('deploy', { commandType: 'mission.deploy' });
	commit('open-wait', {
		commandType: 'master.open.decision',
		observedAt: '2031-01-01T00:00:00.000Z'
	});
	record('wait', [resolve('wait-manual', '2031-01-01T00:00:01.000Z', 'wait', true)]);

	commit('configure-countdown', {
		commandType: 'master.configure.timing',
		timing: 'countdown',
		countdownSeconds: 5,
		observedAt: '2031-01-01T00:00:02.000Z'
	});
	record('countdown', [
		resolve('countdown-expiry', '2031-01-01T00:00:07.000Z', 'countdown', false)
	]);

	commit('configure-step', {
		commandType: 'master.configure.timing',
		timing: 'step',
		countdownSeconds: 5,
		observedAt: '2031-01-01T00:00:08.000Z'
	});
	record('step', [resolve('step-once', '2031-01-01T00:00:08.000Z', 'step', false)]);

	commit('configure-continuous', {
		commandType: 'master.configure.timing',
		timing: 'continuous',
		countdownSeconds: 5,
		observedAt: '2031-01-01T00:00:09.000Z'
	});
	const continuousResolutions = [
		resolve('continuous-one', '2031-01-01T00:00:09.000Z', 'continuous', false),
		resolve('continuous-two', '2031-01-01T00:00:10.000Z', 'continuous', false)
	];
	record('continuous', continuousResolutions);

	const replay = replayEventsStrict(events);
	if (!replay.verified || replay.snapshot.state.schemaVersion !== 19) {
		throw new Error('Master timing report failed strict replay');
	}
	return MasterTimingReportSchema.parse({
		schemaVersion: 'master-timing-report-v1',
		engineContentVersion: state.contentVersion,
		replayVerified: replay.verified,
		runId,
		countdownSeconds: 5,
		baselinePolicyId: 'master-timing-baseline-v1',
		modes: modeResults,
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
				source: event.source.source,
				summary: String((event.payload as { summary?: unknown }).summary ?? event.eventType)
			}))
	});
}

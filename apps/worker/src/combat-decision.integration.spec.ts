import { randomUUID } from 'node:crypto';

import { generateSummonableCharacterDraft } from '@summonlab/characters';
import { parseConfig } from '@summonlab/config';
import {
	EngineGameStateV25Schema,
	EngineGameStateV26Schema,
	type ActorDecisionView,
	type CombatActionIntent,
	type EngineGameStateV25
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING, COMBAT_RULES_V1 } from '@summonlab/content';
import {
	claimCombatDecisionJob,
	completeCombatDecisionJobAttempt,
	createCombatDecisionWindow,
	getCombatDecisionWindow,
	queueCombatDecisionJob
} from '@summonlab/database';
import {
	advanceUntilDecision,
	applyCommand,
	createBootstrapEngine,
	createCombatModeBinding,
	deterministicUuid,
	hashCanonical,
	hashGameState
} from '@summonlab/engine';
import {
	RandomCombatPolicy,
	ScriptedCombatPolicy,
	type CombatPolicy,
	type CombatPolicyResponse
} from '@summonlab/policies';
import { ModelPolicyError } from '@summonlab/policies/openai';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	materializeCombatActionIntent,
	processCombatDecisionSweep,
	type CombatDecisionPolicyFactory
} from './combat-decision.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;
let draftPromise: ReturnType<typeof generateSummonableCharacterDraft> | undefined;

function combatant(id: string, x: number, kind: 'master' | 'hero' | 'monster', readiness: number) {
	return {
		combatantId: id,
		combatantKind: kind,
		teamId: kind === 'monster' ? 'enemy' : 'party',
		position: { x, y: 1 },
		facing: 'east' as const,
		resources: {
			health: { current: 100, maximum: 100 },
			mana: { current: 20, maximum: 20 }
		},
		lastDamagedAtTick: null,
		attributes: { might: 10, vitality: 10, agility: 10, spirit: 10 },
		armour: 0,
		resistances: {},
		readiness: { value: readiness, exactNumerator: readiness, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	};
}

function actionTemplate() {
	return {
		actionId: 'guard-self',
		actionKind: 'guard' as const,
		skillId: null,
		publicLabel: 'Guard',
		targetContract: { kind: 'self' as const },
		reactionPriority: 0,
		recoveryTicks: 2,
		manaCost: 0,
		conflictPolicy: {
			invalidTarget: 'cancel' as const,
			occupiedDestination: 'cancel' as const,
			cancellationRefund: { mana: 'full' as const, readiness: 'full' as const }
		},
		fallbackOptions: [
			{ fallbackId: 'brace', publicLabel: 'Brace', target: { kind: 'self' as const } }
		],
		resolutionProfile: {
			profileKind: 'non-damaging' as const,
			rulesVersion: 'combat-rules-v1' as const,
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		}
	};
}

function entityActionTemplate(targetId: string) {
	return {
		...actionTemplate(),
		actionId: 'support-ally',
		publicLabel: 'Support ally',
		targetContract: { kind: 'entity' as const, allowedCombatantIds: [targetId] },
		fallbackOptions: [
			{
				fallbackId: 'guard-instead',
				publicLabel: 'Guard instead',
				target: { kind: 'self' as const }
			}
		]
	};
}

function commandBase(state: EngineGameStateV25, key: string) {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandId,
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: {
			source: 'manual' as const,
			timing: 'step' as const,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		}
	};
}

async function createRunFixture(runId: string) {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	draftPromise ??= generateSummonableCharacterDraft(
		{
			seed: 'worker-readiness-character',
			generationVersion: 'human-v6',
			cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
		},
		{ capabilityEntropy: '9'.repeat(64) }
	);
	const draft = await draftPromise;
	const initial = EngineGameStateV25Schema.parse(
		createBootstrapEngine({ runId, seed: `worker-readiness-${runId}`, draft }).snapshot.state
	);
	const heroId = Object.keys(initial.heroes)[0]!;
	const prepared = applyCommand(initial, {
		...commandBase(initial, 'prepare'),
		commandType: 'mission.prepare',
		heroIds: [heroId],
		combatModeBinding: createCombatModeBinding('legacy-auto-v1', initial.simulatedAt)
	}).state;
	if (prepared.schemaVersion !== 25) throw new Error('Expected V25 preparation');
	const deployed = applyCommand(prepared, {
		...commandBase(prepared, 'deploy'),
		commandType: 'mission.deploy'
	}).state;
	if (deployed.schemaVersion !== 25 || !deployed.mission.attempt) {
		throw new Error('Expected deployed V25 attempt');
	}
	const attempt = deployed.mission.attempt;
	const actorIds = [attempt.party.masterId, attempt.party.heroIds[0]!].sort();
	const monsterId = deterministicUuid(`${attempt.attemptId}:worker-monster`);
	const terrain = { width: 8, height: 8, blockedTiles: [], features: [] };
	const combatants = {
		...Object.fromEntries(
			actorIds.map((id, index) => [
				id,
				combatant(id, index + 1, id === attempt.party.masterId ? 'master' : 'hero', 10_000)
			])
		),
		[monsterId]: combatant(monsterId, 5, 'monster', 0)
	};
	const actorContexts = Object.fromEntries(
		Object.keys(combatants).map((actorId) => [
			actorId,
			{
				actorId,
				visibleCombatantIds: Object.keys(combatants).filter((id) => id !== actorId),
				visibleTelegraphIds: [],
				observableReadinessActorIds: [],
				targetablePositions: [{ ...combatants[actorId]!.position }],
				visibleTerrainFeatureIds: [],
				rememberedContext: [],
				doctrine: [],
				relationships: [],
				masterDirections: [],
				legalActionTemplates: [
					actionTemplate(),
					entityActionTemplate(Object.keys(combatants).find((id) => id !== actorId)!)
				]
			}
		])
	);
	const partyHeroes = Object.fromEntries(
		actorIds
			.filter((id) => id !== attempt.party.masterId)
			.map((id) => [
				id,
				{
					startingHealth: 100,
					startingMana: 20,
					currentHealth: 100,
					currentMana: 20,
					damageTaken: 0,
					downed: false
				}
			])
	);
	const readinessState = {
		stateVersion: 'readiness-combat-state-v1' as const,
		seed: hashCanonical({ runId, attemptId: attempt.attemptId }),
		attemptId: attempt.attemptId,
		tick: 7,
		combatants,
		actorContexts,
		terrain,
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 7, eventsEmitted: 0, noProgressCycles: 0 },
		outcomeEvidence: {
			evidenceVersion: 'readiness-outcome-evidence-v1' as const,
			attemptId: attempt.attemptId,
			partyHeroes,
			resolvedEvents: [],
			emittedEventIds: [],
			eventsEmitted: 0,
			engineRecoveredCombatantIds: [],
			securedLoot: [],
			objectiveStates: [],
			terminalDirective: null,
			authoredDeadline: null
		},
		status: 'active' as const,
		result: null
	};
	const state = EngineGameStateV26Schema.parse({
		...deployed,
		schemaVersion: 26,
		contentVersion: 'engine-v26',
		version: 3,
		eventCursor: 4,
		mission: {
			...deployed.mission,
			attempt: {
				...Object.fromEntries(
					Object.entries(attempt).filter(
						([key]) => key !== 'turnState' && key !== 'combatModeBinding'
					)
				),
				combatModeBinding: createCombatModeBinding('agent-readiness-v1', attempt.preparedAt),
				combatState: { modeId: 'agent-readiness-v1', readinessState }
			}
		}
	});
	const decision = advanceUntilDecision(readinessState, COMBAT_RULES_V1);
	if (decision.kind !== 'decision-window') throw new Error('Expected readiness decision window');
	const sql = postgres(databaseUrl, { max: 1 });
	const stateHash = hashGameState(state);
	try {
		await sql`
			insert into summonlab_proof_runs (
				run_id, control_mode, recipe, manifest, mind, manifest_hash, first_observation
			) values (${runId}, 'wait', ${sql.json({})}, ${sql.json({})}, ${sql.json({})},
				${stateHash}, 'worker fixture')
		`;
		await sql`
			insert into summonlab_engine_runs (
				run_id, seed, content_version, status, version, event_cursor, entropy_cursor,
				simulated_at, state_hash
			) values (${runId}, ${state.seed}, 'engine-v26', 'active', 3, 4,
				${state.entropyCursor}, ${state.simulatedAt}, ${stateHash})
		`;
		await sql`
			insert into summonlab_engine_snapshots (run_id, event_cursor, version, state, state_hash)
			values (${runId}, 4, 3, ${sql.json(state as never)}, ${stateHash})
		`;
	} finally {
		await sql.end({ timeout: 5 });
	}
	const fallback = (view: ActorDecisionView): CombatActionIntent => ({
		windowId: decision.snapshot.windowId,
		attemptId: attempt.attemptId,
		tick: decision.snapshot.tick,
		actorId: view.actorId,
		snapshotHash: view.snapshotHash,
		actorViewHash: view.actorViewHash,
		legalActionSetHash: view.legalActionSetHash,
		actionId: view.legalActions[0]!.actionId,
		actionInstanceId: view.legalActions[0]!.actionInstanceId,
		actionKind: view.legalActions[0]!.actionKind,
		skillId: view.legalActions[0]!.skillId,
		target: { kind: 'self' },
		fallbackId: 'brace'
	});
	return { state, snapshot: decision.snapshot, views: decision.views, fallback };
}

function config() {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	return parseConfig({ NODE_ENV: 'test', DATABASE_URL: databaseUrl, LOG_LEVEL: 'fatal' });
}

class DelayedPolicy implements CombatPolicy {
	constructor(
		private readonly delayMs: number,
		private readonly base: CombatPolicy,
		private readonly onComplete: () => void
	) {}
	async decide(view: ActorDecisionView): Promise<CombatPolicyResponse> {
		await new Promise((resolve) => setTimeout(resolve, this.delayMs));
		const response = await this.base.decide(view);
		this.onComplete();
		return response;
	}
}

describe.sequential('combat decision worker', () => {
	let runId: string;
	beforeEach(() => {
		runId = randomUUID();
	});
	afterEach(async () => {
		if (!databaseUrl) return;
		const sql = postgres(databaseUrl, { max: 1 });
		try {
			await sql`delete from summonlab_proof_runs where run_id = ${runId}`;
		} finally {
			await sql.end({ timeout: 5 });
		}
	});

	run('executes mixed providers concurrently and applies in canonical actor order', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const fixture = await createRunFixture(runId);
		const created = await createCombatDecisionWindow(databaseUrl, {
			runId,
			expectedRunVersion: 3,
			expectedEventCursor: 4,
			snapshot: fixture.snapshot,
			actors: fixture.views.map((view, index) => ({
				view,
				requestedPolicy: index === 0 ? ('model' as const) : ('random' as const),
				deterministicFallback: fixture.fallback(view)
			}))
		});
		const completionOrder: string[] = [];
		const factory: CombatDecisionPolicyFactory = {
			create(policy, job) {
				return new DelayedPolicy(
					policy === 'model' ? 40 : 1,
					policy === 'random'
						? new RandomCombatPolicy(job.decisionJobId)
						: new ScriptedCombatPolicy(),
					() => completionOrder.push(job.heroId)
				);
			}
		};

		const sweep = await processCombatDecisionSweep(config(), factory, { maxConcurrency: 2 });
		const window = await getCombatDecisionWindow(databaseUrl, fixture.snapshot.windowId);
		expect(sweep).toMatchObject({ dispatched: 2, completed: 2, applied: 1 });
		expect(completionOrder).toEqual([...created.jobs].reverse().map((job) => job.heroId));
		expect(window?.status).toBe('applied');
		expect(window?.batch?.choices.map((choice) => choice.actorId)).toEqual(
			created.jobs.map((job) => job.heroId).sort()
		);
	});

	run(
		'rejects fallback targets as primary selections before using exact persisted fallbacks',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const fixture = await createRunFixture(runId);
			await createCombatDecisionWindow(databaseUrl, {
				runId,
				expectedRunVersion: 3,
				expectedEventCursor: 4,
				snapshot: fixture.snapshot,
				actors: fixture.views.map((view) => ({
					view,
					requestedPolicy: 'model' as const,
					deterministicFallback: fixture.fallback(view),
					maxProviderAttempts: 2
				}))
			});
			let providerCalls = 0;
			const factory: CombatDecisionPolicyFactory = {
				create: () => ({
					async decide(view) {
						providerCalls += 1;
						const action = view.legalActions.find(
							(candidate) => candidate.actionId === 'support-ally'
						)!;
						return {
							windowId: view.windowId,
							snapshotHash: view.snapshotHash,
							actorViewHash: view.actorViewHash,
							legalActionSetHash: view.legalActionSetHash,
							actionId: action.actionId,
							target: { kind: 'self' as const },
							fallbackId: 'guard-instead'
						};
					}
				})
			};
			await processCombatDecisionSweep(config(), factory);
			await processCombatDecisionSweep(config(), factory);
			const final = await processCombatDecisionSweep(config(), factory);
			const window = await getCombatDecisionWindow(databaseUrl, fixture.snapshot.windowId);
			expect(providerCalls).toBe(4);
			expect(final.applied).toBe(1);
			expect(window?.status).toBe('applied');
			expect(window?.jobs.every((job) => job.resolution === 'fallback')).toBe(true);
			expect(
				window?.jobs.every(
					(job) => hashCanonical(job.result) === hashCanonical(job.deterministicFallback)
				)
			).toBe(true);
		}
	);

	run(
		'discovers a completed cohort after restart and concurrent sweepers never re-query providers',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const fixture = await createRunFixture(runId);
			const created = await createCombatDecisionWindow(databaseUrl, {
				runId,
				expectedRunVersion: 3,
				expectedEventCursor: 4,
				snapshot: fixture.snapshot,
				actors: fixture.views.map((view) => ({
					view,
					requestedPolicy: 'scripted' as const,
					deterministicFallback: fixture.fallback(view)
				}))
			});
			for (const job of created.jobs) {
				await queueCombatDecisionJob(databaseUrl, job.decisionJobId);
				const claim = await claimCombatDecisionJob(databaseUrl, job.decisionJobId);
				if (!claim) throw new Error('Expected combat claim');
				const response = await new ScriptedCombatPolicy().decide(job.view);
				await completeCombatDecisionJobAttempt(
					databaseUrl,
					job.decisionJobId,
					claim.attemptNumber,
					materializeCombatActionIntent(created, job, response),
					0
				);
			}
			let providerCalls = 0;
			const forbiddenFactory: CombatDecisionPolicyFactory = {
				create: () => ({
					async decide() {
						providerCalls += 1;
						throw new ModelPolicyError('provider-error', 'must not run', false);
					}
				})
			};
			const results = await Promise.all([
				processCombatDecisionSweep(config(), forbiddenFactory),
				processCombatDecisionSweep(config(), forbiddenFactory)
			]);
			expect(providerCalls).toBe(0);
			expect(results.reduce((sum, result) => sum + result.applied, 0)).toBe(1);
			expect((await getCombatDecisionWindow(databaseUrl, fixture.snapshot.windowId))?.status).toBe(
				'applied'
			);
			await processCombatDecisionSweep(config(), forbiddenFactory);
			expect(providerCalls).toBe(0);
		}
	);

	run('marks a stale cohort before any provider receives its actor view', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const fixture = await createRunFixture(runId);
		await createCombatDecisionWindow(databaseUrl, {
			runId,
			expectedRunVersion: 3,
			expectedEventCursor: 4,
			snapshot: fixture.snapshot,
			actors: fixture.views.map((view) => ({
				view,
				requestedPolicy: 'model' as const,
				deterministicFallback: fixture.fallback(view)
			}))
		});
		const sql = postgres(databaseUrl, { max: 1 });
		try {
			await sql`
				update summonlab_engine_runs set version = 4, event_cursor = 5
				where run_id = ${runId}
			`;
		} finally {
			await sql.end({ timeout: 5 });
		}
		let providerCalls = 0;
		await processCombatDecisionSweep(config(), {
			create: () => ({
				async decide() {
					providerCalls += 1;
					throw new Error('stale provider call');
				}
			})
		});
		expect(providerCalls).toBe(0);
		expect((await getCombatDecisionWindow(databaseUrl, fixture.snapshot.windowId))?.status).toBe(
			'stale'
		);
	});

	run(
		'recovers a lost lease through fallback while other actors continue independently',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const fixture = await createRunFixture(runId);
			const created = await createCombatDecisionWindow(databaseUrl, {
				runId,
				expectedRunVersion: 3,
				expectedEventCursor: 4,
				snapshot: fixture.snapshot,
				actors: fixture.views.map((view) => ({
					view,
					requestedPolicy: 'model' as const,
					deterministicFallback: fixture.fallback(view),
					maxProviderAttempts: 1
				}))
			});
			const abandoned = created.jobs[0]!;
			await queueCombatDecisionJob(databaseUrl, abandoned.decisionJobId);
			await claimCombatDecisionJob(databaseUrl, abandoned.decisionJobId, 10);
			const sql = postgres(databaseUrl, { max: 1 });
			try {
				await sql`
				update summonlab_decision_jobs set lease_expires_at = now() - interval '1 second'
				where decision_job_id = ${abandoned.decisionJobId}
			`;
			} finally {
				await sql.end({ timeout: 5 });
			}
			let providerCalls = 0;
			const result = await processCombatDecisionSweep(config(), {
				create: () => ({
					async decide(view) {
						providerCalls += 1;
						return await new ScriptedCombatPolicy().decide(view);
					}
				})
			});
			const window = await getCombatDecisionWindow(databaseUrl, fixture.snapshot.windowId);
			expect(result).toMatchObject({ recovered: 1, completed: 2, applied: 1 });
			expect(providerCalls).toBe(1);
			expect(window?.jobs.find((job) => job.heroId === abandoned.heroId)?.resolution).toBe(
				'fallback'
			);
			expect(window?.status).toBe('applied');
		}
	);
});

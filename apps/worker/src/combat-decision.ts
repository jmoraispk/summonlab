import type { AppConfig } from '@summonlab/config';
import {
	CombatActionIntentSchema,
	type CombatActionIntent,
	type PolicyMode
} from '@summonlab/contracts';
import {
	applyCombatDecisionWindowBatch,
	claimCombatDecisionJob,
	completeCombatDecisionJobAttempt,
	failCombatDecisionJobAttempt,
	getCombatDecisionWindow,
	listActionableCombatDecisionWindowIds,
	listDispatchableCombatDecisionJobIds,
	queueCombatDecisionJob,
	recoverExpiredCombatDecisionJobs,
	refreshCombatDecisionWindow,
	type CombatDecisionJob,
	type CombatDecisionWindow
} from '@summonlab/database';
import {
	RandomCombatPolicy,
	ScriptedCombatPolicy,
	validateCombatPolicyResponse,
	type CombatPolicy,
	type CombatPolicyResponse
} from '@summonlab/policies';
import { ModelPolicyError, OpenAICombatPolicy } from '@summonlab/policies/openai';

interface CombatDecisionLogger {
	info(bindings: Record<string, unknown>, message: string): void;
	error(bindings: Record<string, unknown>, message: string): void;
}

export interface CombatDecisionPolicyFactory {
	create(policy: PolicyMode, job: CombatDecisionJob): CombatPolicy;
}

export interface CombatDecisionSweepOptions {
	readonly maxConcurrency?: number;
	readonly limit?: number;
}

export interface CombatDecisionSweepResult {
	readonly recovered: number;
	readonly dispatched: number;
	readonly completed: number;
	readonly applied: number;
	readonly alreadyApplied: number;
}

export interface CombatDecisionWorkerLoop {
	dispatchOnce(): Promise<CombatDecisionSweepResult>;
	stop(): Promise<void>;
}

export async function mapCombatJobsConcurrently<Input, Output>(
	inputs: readonly Input[],
	concurrency: number,
	operation: (input: Input, index: number) => Promise<Output>
): Promise<Output[]> {
	if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32) {
		throw new Error('Combat decision concurrency must be an integer from 1 to 32');
	}
	const results = new Array<Output>(inputs.length);
	let cursor = 0;
	const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, async () => {
		while (cursor < inputs.length) {
			const index = cursor;
			cursor += 1;
			results[index] = await operation(inputs[index]!, index);
		}
	});
	await Promise.all(workers);
	return results;
}

export function createCombatDecisionPolicyFactory(config: AppConfig): CombatDecisionPolicyFactory {
	return {
		create(policy, job) {
			if (policy === 'random') {
				return new RandomCombatPolicy(
					`${job.decisionJobId}:${job.actorViewHash}:${job.legalActionHash}:combat-job-v1`
				);
			}
			if (policy === 'scripted') return new ScriptedCombatPolicy();
			if (!config.openAiApiKey) {
				throw new ModelPolicyError(
					'provider-error',
					'OPENAI_API_KEY is not configured for this combat decision job.',
					false
				);
			}
			return new OpenAICombatPolicy({
				apiKey: config.openAiApiKey,
				model: config.policyModel,
				timeoutMs: config.policyTimeoutMs,
				maxOutputTokens: config.policyMaxOutputTokens,
				reasoningEffort: config.policyReasoningEffort
			});
		}
	};
}

export function materializeCombatActionIntent(
	window: CombatDecisionWindow,
	job: CombatDecisionJob,
	responseInput: unknown
): CombatActionIntent {
	if (
		window.windowId !== job.windowId ||
		window.snapshotHash !== job.snapshotHash ||
		!window.snapshot.readyActorIds.includes(job.heroId)
	) {
		throw new Error('Combat decision job is bound to another durable window');
	}
	const response = validateCombatPolicyResponse(job.view, responseInput);
	const action = job.view.legalActions.find(
		(candidate) => candidate.actionId === response.actionId
	);
	if (!action) throw new Error('Combat response action disappeared from its frozen view');
	return CombatActionIntentSchema.parse({
		windowId: job.windowId,
		attemptId: window.attemptId,
		tick: window.tick,
		actorId: job.heroId,
		snapshotHash: job.snapshotHash,
		actorViewHash: job.actorViewHash,
		legalActionSetHash: job.legalActionHash,
		actionId: action.actionId,
		actionInstanceId: action.actionInstanceId,
		actionKind: action.actionKind,
		skillId: action.skillId,
		target: response.target,
		fallbackId: response.fallbackId,
		...(response.publicIntent === undefined ? {} : { publicIntent: response.publicIntent })
	});
}

function policyFailure(error: unknown) {
	if (error instanceof ModelPolicyError) {
		return {
			code: error.code,
			message: error.message,
			retryable: error.code === 'response-refused' ? false : true
		};
	}
	return {
		code: 'combat-policy-output-invalid',
		message: error instanceof Error ? error.message : 'The combat policy attempt failed.',
		retryable: true
	};
}

async function processCombatDecisionJob(
	config: AppConfig,
	jobId: string,
	policyFactory: CombatDecisionPolicyFactory
): Promise<'completed' | 'deferred'> {
	const claim = await claimCombatDecisionJob(
		config.databaseUrl,
		jobId,
		config.decisionJobLeaseSeconds
	);
	if (!claim) return 'deferred';
	const window = await getCombatDecisionWindow(config.databaseUrl, claim.job.windowId);
	if (!window || window.status === 'stale' || window.status === 'failed') return 'deferred';
	const startedAt = performance.now();
	let intent: CombatActionIntent;
	try {
		if (claim.attemptKind === 'fallback') {
			intent = claim.deterministicFallback;
		} else {
			const policy = policyFactory.create(claim.policy, claim.job);
			const response: CombatPolicyResponse = await policy.decide(claim.job.view);
			intent = materializeCombatActionIntent(window, claim.job, response);
		}
	} catch (error) {
		await failCombatDecisionJobAttempt(
			config.databaseUrl,
			jobId,
			policyFailure(error),
			Math.max(0, Math.round(performance.now() - startedAt))
		);
		return 'deferred';
	}
	await completeCombatDecisionJobAttempt(
		config.databaseUrl,
		jobId,
		intent,
		Math.max(0, Math.round(performance.now() - startedAt))
	);
	return 'completed';
}

async function settleActionableWindows(databaseUrl: string, limit: number) {
	const ids = await listActionableCombatDecisionWindowIds(databaseUrl, limit);
	let applied = 0;
	let alreadyApplied = 0;
	await mapCombatJobsConcurrently(ids, Math.min(8, Math.max(1, ids.length)), async (windowId) => {
		const window = await refreshCombatDecisionWindow(databaseUrl, windowId);
		if (window.status !== 'ready' || !window.batch) return;
		const result = await applyCombatDecisionWindowBatch(databaseUrl, windowId, window.batch);
		if (result.disposition === 'applied') applied += 1;
		else alreadyApplied += 1;
	});
	return { applied, alreadyApplied };
}

export async function processCombatDecisionSweep(
	config: AppConfig,
	policyFactory: CombatDecisionPolicyFactory = createCombatDecisionPolicyFactory(config),
	options: CombatDecisionSweepOptions = {}
): Promise<CombatDecisionSweepResult> {
	const maxConcurrency = options.maxConcurrency ?? 8;
	const limit = options.limit ?? 32;
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
		throw new Error('Combat decision sweep limit must be an integer from 1 to 256');
	}
	const recovered = await recoverExpiredCombatDecisionJobs(config.databaseUrl);
	const before = await settleActionableWindows(config.databaseUrl, limit);
	const ids = await listDispatchableCombatDecisionJobIds(config.databaseUrl, limit);
	const results = await mapCombatJobsConcurrently(ids, maxConcurrency, async (jobId) => {
		if (!(await queueCombatDecisionJob(config.databaseUrl, jobId))) return 'deferred' as const;
		return await processCombatDecisionJob(config, jobId, policyFactory);
	});
	const after = await settleActionableWindows(config.databaseUrl, limit);
	return {
		recovered,
		dispatched: ids.length,
		completed: results.filter((result) => result === 'completed').length,
		applied: before.applied + after.applied,
		alreadyApplied: before.alreadyApplied + after.alreadyApplied
	};
}

export async function startCombatDecisionWorker(
	config: AppConfig,
	logger: CombatDecisionLogger,
	policyFactory: CombatDecisionPolicyFactory = createCombatDecisionPolicyFactory(config)
): Promise<CombatDecisionWorkerLoop> {
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let inFlight: Promise<CombatDecisionSweepResult> | null = null;
	const dispatchOnce = () => {
		inFlight ??= processCombatDecisionSweep(config, policyFactory)
			.then((result) => {
				if (result.recovered || result.dispatched || result.applied || result.alreadyApplied) {
					logger.info({ ...result }, 'combat decision sweep completed');
				}
				return result;
			})
			.catch((error) => {
				logger.error({ error }, 'combat decision sweep failed');
				return { recovered: 0, dispatched: 0, completed: 0, applied: 0, alreadyApplied: 0 };
			})
			.finally(() => {
				inFlight = null;
			});
		return inFlight;
	};
	const schedule = () => {
		if (stopped) return;
		timer = setTimeout(async () => {
			await dispatchOnce();
			schedule();
		}, config.decisionJobPollMs);
		timer.unref?.();
	};
	await dispatchOnce();
	schedule();
	return {
		dispatchOnce,
		async stop() {
			if (stopped) return;
			stopped = true;
			if (timer) clearTimeout(timer);
			timer = null;
			await inFlight;
		}
	};
}

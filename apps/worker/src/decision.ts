import type { AppConfig } from '@summonlab/config';
import type { DecisionJobRecord, HeroPolicyResult, PolicyMode } from '@summonlab/contracts';
import {
	applyDecisionJobResult,
	claimDecisionJob,
	completeDecisionJobAttempt,
	createReplannedDecisionJob,
	failDecisionJobApplication,
	failDecisionJobAttempt,
	getDecisionJob,
	getEngineSnapshot,
	getProofRun,
	listCompletedDecisionJobIds,
	listDispatchableDecisionJobIds,
	markDecisionJobQueued,
	releaseDecisionJobQueueReservation,
	recoverExpiredDecisionJobs,
	rejectStaleDecisionJobBeforePolicy
} from '@summonlab/database';
import { assembleHeroDecisionPacket } from '@summonlab/engine';
import { RandomPolicy, ScriptedPolicy, type HeroPolicy } from '@summonlab/policies';
import { ModelPolicyError, OpenAIModelPolicy } from '@summonlab/policies/openai';
import {
	DECISION_QUEUE,
	DecisionQueueJobSchema,
	createJobQueue,
	ensureDecisionQueue
} from '@summonlab/queue';

interface DecisionLogger {
	info(bindings: Record<string, unknown>, message: string): void;
	warn(bindings: Record<string, unknown>, message: string): void;
	error(bindings: Record<string, unknown>, message: string): void;
}

export interface DecisionWorkerLoop {
	dispatchOnce(): Promise<number>;
	stop(): Promise<void>;
}

export interface DecisionPolicyFactory {
	create(policy: PolicyMode, job: DecisionJobRecord): HeroPolicy;
}

export function createDecisionPolicyFactory(config: AppConfig): DecisionPolicyFactory {
	return {
		create(policy, job) {
			if (policy === 'random') {
				return new RandomPolicy(
					`${job.rootJobId}:${job.replanCount}:${job.packetHash}:decision-job-v1`
				);
			}
			if (policy === 'scripted') return new ScriptedPolicy();
			if (!config.openAiApiKey) {
				throw new ModelPolicyError(
					'provider-error',
					'OPENAI_API_KEY is not configured for this model decision job.',
					false
				);
			}
			return new OpenAIModelPolicy({
				apiKey: config.openAiApiKey,
				model: config.policyModel,
				timeoutMs: config.policyTimeoutMs,
				maxOutputTokens: config.policyMaxOutputTokens,
				reasoningEffort: config.policyReasoningEffort
			});
		}
	};
}

async function replanStaleJob(
	config: AppConfig,
	stale: DecisionJobRecord
): Promise<DecisionJobRecord | null> {
	if (stale.status !== 'stale' || stale.replanCount >= stale.maxReplans) return null;
	const [proof, snapshot] = await Promise.all([
		getProofRun(config.databaseUrl, stale.runId),
		getEngineSnapshot(config.databaseUrl, stale.runId)
	]);
	if (!proof || !snapshot || proof.manifest.characterId !== stale.heroId) return null;
	try {
		const packet = assembleHeroDecisionPacket({
			snapshot,
			manifest: proof.manifest,
			heroId: stale.heroId,
			decisionKind: stale.decisionKind
		});
		return await createReplannedDecisionJob(config.databaseUrl, stale.decisionJobId, packet);
	} catch {
		return null;
	}
}

function policyFailure(error: unknown) {
	if (error instanceof ModelPolicyError) {
		return { code: error.code, message: error.message, retryable: error.retryable };
	}
	return {
		code: 'policy-execution-failed',
		message: error instanceof Error ? error.message : 'The policy attempt failed.',
		retryable: false
	};
}

async function applyCompletedDecisionJob(
	config: AppConfig,
	decisionJobId: string
): Promise<DecisionJobRecord> {
	let application: Awaited<ReturnType<typeof applyDecisionJobResult>>;
	try {
		application = await applyDecisionJobResult(config.databaseUrl, decisionJobId);
	} catch (error) {
		try {
			return await failDecisionJobApplication(
				config.databaseUrl,
				decisionJobId,
				error instanceof Error ? error.message : 'Unknown application failure.'
			);
		} catch {
			throw error;
		}
	}
	if (application.disposition === 'stale') {
		return (await replanStaleJob(config, application.job)) ?? application.job;
	}
	return application.job;
}

export async function processDecisionJob(
	config: AppConfig,
	decisionJobId: string,
	policyFactory: DecisionPolicyFactory = createDecisionPolicyFactory(config)
): Promise<DecisionJobRecord | null> {
	const existing = await getDecisionJob(config.databaseUrl, decisionJobId);
	if (existing?.status === 'completed') {
		return await applyCompletedDecisionJob(config, decisionJobId);
	}
	const claim = await claimDecisionJob(
		config.databaseUrl,
		decisionJobId,
		config.decisionJobLeaseSeconds
	);
	if (!claim) return await getDecisionJob(config.databaseUrl, decisionJobId);
	const preflightStale = await rejectStaleDecisionJobBeforePolicy(
		config.databaseUrl,
		decisionJobId
	);
	if (preflightStale) {
		return (await replanStaleJob(config, preflightStale)) ?? preflightStale;
	}
	const startedAt = performance.now();
	let result: HeroPolicyResult;
	try {
		const policy = policyFactory.create(claim.policy, claim.job);
		result = await policy.decide(claim.job.packet);
	} catch (error) {
		return await failDecisionJobAttempt(
			config.databaseUrl,
			decisionJobId,
			policyFailure(error),
			Math.max(0, Math.round(performance.now() - startedAt))
		);
	}
	await completeDecisionJobAttempt(
		config.databaseUrl,
		decisionJobId,
		result,
		Math.max(0, Math.round(performance.now() - startedAt))
	);
	return await applyCompletedDecisionJob(config, decisionJobId);
}

export async function startDecisionWorker(
	config: AppConfig,
	logger: DecisionLogger,
	policyFactory: DecisionPolicyFactory = createDecisionPolicyFactory(config)
): Promise<DecisionWorkerLoop> {
	const queue = createJobQueue(config.databaseUrl);
	await queue.start();
	await ensureDecisionQueue(queue);
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let inFlight: Promise<number> | null = null;

	await queue.work<{ decisionJobId: string }>(
		DECISION_QUEUE,
		{ batchSize: 1, pollingIntervalSeconds: 0.5, notifyPollingIntervalSeconds: 0.5 },
		async (jobs) => {
			const payload = DecisionQueueJobSchema.safeParse(jobs[0]?.data);
			if (!payload.success) {
				logger.error({ issues: payload.error.issues }, 'decision queue payload rejected');
				return { processed: false };
			}
			try {
				const job = await processDecisionJob(config, payload.data.decisionJobId, policyFactory);
				if (job) {
					logger.info(
						{
							decisionJobId: job.decisionJobId,
							status: job.status,
							attemptCount: job.attemptCount,
							replanCount: job.replanCount
						},
						'decision job processed'
					);
				}
				return { processed: Boolean(job), status: job?.status ?? null };
			} catch (error) {
				logger.error(
					{ error, decisionJobId: payload.data.decisionJobId },
					'decision job worker failed; lease recovery will resume it'
				);
				return { processed: false };
			}
		}
	);

	const dispatchOnce = () => {
		inFlight ??= (async () => {
			const recovered = await recoverExpiredDecisionJobs(config.databaseUrl);
			const completedIdentifiers = await listCompletedDecisionJobIds(config.databaseUrl);
			let applicationsResumed = 0;
			for (const decisionJobId of completedIdentifiers) {
				const job = await processDecisionJob(config, decisionJobId, policyFactory);
				if (job?.status !== 'completed') applicationsResumed += 1;
			}
			const identifiers = await listDispatchableDecisionJobIds(config.databaseUrl);
			let dispatched = 0;
			for (const decisionJobId of identifiers) {
				if (!(await markDecisionJobQueued(config.databaseUrl, decisionJobId))) continue;
				try {
					const queueId = await queue.send(DECISION_QUEUE, { decisionJobId });
					if (!queueId) {
						await releaseDecisionJobQueueReservation(config.databaseUrl, decisionJobId);
						continue;
					}
					dispatched += 1;
				} catch (error) {
					await releaseDecisionJobQueueReservation(config.databaseUrl, decisionJobId);
					throw error;
				}
			}
			if (recovered > 0 || applicationsResumed > 0 || dispatched > 0) {
				logger.info(
					{ recovered, applicationsResumed, dispatched },
					'decision dispatch batch completed'
				);
			}
			return dispatched;
		})()
			.catch((error) => {
				logger.error({ error }, 'decision dispatch batch failed');
				return 0;
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
			await queue.offWork(DECISION_QUEUE);
			await queue.stop({ graceful: true, timeout: 5_000 });
		}
	};
}

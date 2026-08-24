import { randomUUID } from 'node:crypto';

import {
	FIRST_OBSERVATION,
	chooseFirstDestination,
	generateCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';
import { parseConfig } from '@summonlab/config';
import {
	MODEL_POLICY_VERSION,
	type HeroDecisionPacket,
	type HeroPolicyResult
} from '@summonlab/contracts';
import {
	claimDecisionJob,
	completeDecisionJobAttempt,
	createDecisionJob,
	createProofRun,
	getDecisionJob,
	getEngineReplay,
	getEngineSnapshot,
	getProofRun,
	markDecisionJobQueued,
	recoverExpiredDecisionJobs,
	resolveProofDecision
} from '@summonlab/database';
import { assembleHeroDecisionPacket } from '@summonlab/engine';
import { ScriptedPolicy, type HeroPolicy } from '@summonlab/policies';
import {
	buildOpenAIHeroDecisionRequestProfile,
	ModelPolicyError
} from '@summonlab/policies/openai';
import { describe, expect, it, vi } from 'vitest';

import { processDecisionJob, type DecisionPolicyFactory } from './decision.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

async function pendingRun(label: string) {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	const draft = await generateCharacterDraft(recipeFromSeed(`${label}-${randomUUID()}`));
	const runId = randomUUID();
	await createProofRun(databaseUrl, {
		runId,
		draft,
		controlMode: 'wait',
		directive: '',
		firstObservation: FIRST_OBSERVATION,
		choice: null
	});
	const snapshot = await getEngineSnapshot(databaseUrl, runId);
	if (!snapshot) throw new Error('Expected an engine snapshot');
	const packet = assembleHeroDecisionPacket({
		snapshot,
		manifest: draft.manifest,
		heroId: draft.manifest.characterId,
		decisionKind: 'settlement-action'
	});
	return { draft, runId, packet };
}

function config() {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	return parseConfig({
		NODE_ENV: 'test',
		DATABASE_URL: databaseUrl,
		POLICY_MODE: 'scripted',
		LOG_LEVEL: 'fatal'
	});
}

async function queueJob(packet: HeroDecisionPacket, policy: 'scripted' | 'model') {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	const appConfig = config();
	const job = await createDecisionJob(databaseUrl, {
		packet,
		requestedPolicy: policy,
		providerRequest:
			policy === 'model'
				? buildOpenAIHeroDecisionRequestProfile(packet, {
						model: appConfig.policyModel,
						maxOutputTokens: appConfig.policyMaxOutputTokens,
						reasoningEffort: appConfig.policyReasoningEffort
					})
				: null,
		maxProviderAttempts: 2,
		maxReplans: 3
	});
	expect(job.schemaVersion).toBe('decision-job-v2');
	if (job.schemaVersion !== 'decision-job-v2') throw new Error('Expected decision-job-v2');
	if (policy === 'model') {
		expect(job.providerRequest).toMatchObject({
			packetHash: packet.packetHash,
			requestedModel: appConfig.policyModel,
			store: false,
			background: false,
			credentialDisposition: 'server-only-never-persisted',
			privateReasoningDisposition: 'private-reasoning-content-not-requested-or-stored'
		});
	} else {
		expect(job.providerRequest).toBeNull();
	}
	expect(await markDecisionJobQueued(databaseUrl, job.decisionJobId)).toBe(true);
	return job;
}

class TimeoutPolicy implements HeroPolicy {
	readonly policyId = MODEL_POLICY_VERSION;

	async decide(): Promise<HeroPolicyResult> {
		throw new ModelPolicyError('provider-timeout', 'Synthetic provider timeout.', true);
	}
}

describe('durable decision worker', () => {
	run('applies one scripted legal choice through a fully inspectable lifecycle', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const pending = await pendingRun('decision-apply');
		const created = await queueJob(pending.packet, 'scripted');
		const applied = await processDecisionJob(config(), created.decisionJobId);

		expect(applied).toMatchObject({
			status: 'applied',
			resolution: 'requested',
			attemptCount: 1,
			providerAttemptCount: 0
		});
		expect(applied?.attempts.map((attempt) => attempt.kind)).toEqual(['primary']);
		expect(applied?.transitions.map((transition) => transition.toStatus)).toEqual([
			'created',
			'queued',
			'in_progress',
			'completed',
			'validated',
			'applied'
		]);
		const proof = await getProofRun(databaseUrl, pending.runId);
		expect(proof?.destination).toBe(
			applied?.result?.decision.actionId === 'hero.choose.kitchen' ? 'kitchen' : 'training-ground'
		);
		const replay = await getEngineReplay(databaseUrl, pending.runId);
		expect(replay?.verified).toBe(true);
		expect(replay?.checks.at(-1)?.source.decisionJobId).toBe(created.decisionJobId);
		expect(replay?.checks.at(-1)?.source.source).toBe('scripted');
	});

	run('bounds provider retries, then applies the deterministic scripted fallback', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const pending = await pendingRun('decision-fallback');
		const created = await queueJob(pending.packet, 'model');
		const factory: DecisionPolicyFactory = {
			create(policy) {
				return policy === 'model' ? new TimeoutPolicy() : new ScriptedPolicy();
			}
		};

		const first = await processDecisionJob(config(), created.decisionJobId, factory);
		expect(first?.status).toBe('retry_wait');
		expect(await markDecisionJobQueued(databaseUrl, created.decisionJobId)).toBe(true);
		const second = await processDecisionJob(config(), created.decisionJobId, factory);
		expect(second?.status).toBe('fallback');
		expect(await markDecisionJobQueued(databaseUrl, created.decisionJobId)).toBe(true);
		const applied = await processDecisionJob(config(), created.decisionJobId, factory);

		expect(applied).toMatchObject({
			status: 'applied',
			resolution: 'fallback',
			attemptCount: 3,
			providerAttemptCount: 2,
			failure: { code: 'provider-timeout', retryable: true }
		});
		expect(applied?.attempts.map((attempt) => attempt.kind)).toEqual([
			'primary',
			'retry',
			'fallback'
		]);
		expect(applied?.result?.policyId).toBe('scripted-policy-v1');
	});

	run('recovers an expired worker lease into the bounded retry ladder', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const pending = await pendingRun('decision-lease-recovery');
		const created = await queueJob(pending.packet, 'model');
		const claimed = await claimDecisionJob(databaseUrl, created.decisionJobId, 10);
		expect(claimed).toMatchObject({ attemptKind: 'primary', policy: 'model' });

		const recovered = await recoverExpiredDecisionJobs(
			databaseUrl,
			new Date(Date.now() + 11_000).toISOString()
		);
		const job = await getDecisionJob(databaseUrl, created.decisionJobId);

		expect(recovered).toBeGreaterThanOrEqual(1);
		expect(job).toMatchObject({
			status: 'retry_wait',
			attemptCount: 1,
			providerAttemptCount: 1,
			failure: { code: 'worker-lease-expired', retryable: true }
		});
		expect(job?.attempts[0]).toMatchObject({ status: 'failed', kind: 'primary' });
	});

	run('resumes application after a worker dies with a completed result', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const pending = await pendingRun('decision-application-recovery');
		const created = await queueJob(pending.packet, 'scripted');
		const claim = await claimDecisionJob(databaseUrl, created.decisionJobId, 45);
		expect(claim).toMatchObject({ attemptKind: 'primary', policy: 'scripted' });
		const result = await new ScriptedPolicy().decide(pending.packet);
		const completed = await completeDecisionJobAttempt(
			databaseUrl,
			created.decisionJobId,
			result,
			1
		);
		expect(completed.status).toBe('completed');

		const resumed = await processDecisionJob(config(), created.decisionJobId);

		expect(resumed).toMatchObject({ status: 'applied', attemptCount: 1 });
		expect(resumed?.transitions.map((transition) => transition.toStatus)).toEqual([
			'created',
			'queued',
			'in_progress',
			'completed',
			'validated',
			'applied'
		]);
	});

	run('rejects stale context before the policy is called and creates a replacement', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const pending = await pendingRun('decision-preflight-stale');
		const created = await queueJob(pending.packet, 'scripted');
		const choice = chooseFirstDestination(pending.draft, 'wait', 'Train first.');
		await resolveProofDecision(databaseUrl, pending.runId, 'Train first.', choice);
		const decide = vi.fn(async () => new ScriptedPolicy().decide(pending.packet));
		const replacement = await processDecisionJob(config(), created.decisionJobId, {
			create: () => ({ policyId: 'scripted-policy-v1', decide })
		});

		expect(decide).not.toHaveBeenCalled();
		expect(replacement).toMatchObject({ status: 'created', parentJobId: created.decisionJobId });
		const parent = await getDecisionJob(databaseUrl, created.decisionJobId);
		expect(parent).toMatchObject({
			status: 'replanned',
			replacementJobId: replacement?.decisionJobId,
			failure: { code: 'stale-before-policy' }
		});
		expect(replacement?.expectedRunVersion).toBeGreaterThan(created.expectedRunVersion);
	});

	run('never applies a completion that becomes stale during policy execution', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const pending = await pendingRun('decision-completion-stale');
		const created = await queueJob(pending.packet, 'scripted');
		const factory: DecisionPolicyFactory = {
			create: () => ({
				policyId: 'scripted-policy-v1',
				async decide(packet) {
					const result = await new ScriptedPolicy().decide(packet);
					const choice = chooseFirstDestination(pending.draft, 'wait', 'Take the other path.');
					await resolveProofDecision(databaseUrl, pending.runId, 'Take the other path.', choice);
					return result;
				}
			})
		};
		const replacement = await processDecisionJob(config(), created.decisionJobId, factory);
		const parent = await getDecisionJob(databaseUrl, created.decisionJobId);

		expect(parent?.status).toBe('replanned');
		expect(parent?.application).toBeNull();
		expect(parent?.transitions.map((transition) => transition.toStatus)).toContain('stale');
		expect(replacement).toMatchObject({ status: 'created', parentJobId: created.decisionJobId });
		const replay = await getEngineReplay(databaseUrl, pending.runId);
		expect(replay?.verified).toBe(true);
		expect(
			replay?.checks.filter((check) => check.source.decisionJobId === created.decisionJobId)
		).toEqual([]);
	});
});

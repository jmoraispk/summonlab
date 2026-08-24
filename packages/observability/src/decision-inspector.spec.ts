import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import {
	DECISION_JOB_VERSION,
	DecisionInspectorReportSchema,
	type DecisionJobRecord,
	type PlayerDirective
} from '@summonlab/contracts';
import {
	assembleHeroDecisionPacket,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical
} from '@summonlab/engine';
import { ScriptedPolicy } from '@summonlab/policies';
import { buildOpenAIHeroDecisionRequestProfile } from '@summonlab/policies/openai';
import { describe, expect, it } from 'vitest';

import {
	buildDecisionInspectorReport,
	projectDecisionJobClientView,
	verifyDecisionInspectorReport
} from './index.js';

const PRIVATE_DIRECTION = 'SENTINEL_PRIVATE_DIRECTION_7c1a: train before the tower.';

async function jobFixture(requestedPolicy: 'scripted' | 'model'): Promise<DecisionJobRecord> {
	const draft = await generateCharacterDraft(recipeFromSeed('decision-inspector-fixture'));
	const runId = deterministicUuid('decision-inspector-run');
	const engine = createBootstrapEngine({
		runId,
		seed: 'decision-inspector-engine-seed',
		heroId: draft.manifest.characterId,
		manifestHash: hashCanonical(draft.manifest),
		mind: draft.mind
	});
	const initialPacket = assembleHeroDecisionPacket({
		snapshot: engine.snapshot,
		manifest: draft.manifest,
		heroId: draft.manifest.characterId,
		decisionKind: 'settlement-action'
	});
	const witnessedEventId = initialPacket.knowledge.memoryRetrieval.memories[0]?.sourceEventId;
	if (!witnessedEventId) throw new Error('Inspector fixture requires witnessed evidence');
	const directive: PlayerDirective = {
		directiveId: deterministicUuid('decision-inspector-directive'),
		runId,
		authorId: engine.snapshot.state.master.masterId,
		text: PRIVATE_DIRECTION,
		scope: 'decision',
		recipientIds: [draft.manifest.characterId],
		witnessEventId: witnessedEventId,
		priorities: ['train'],
		createdAt: engine.snapshot.state.simulatedAt,
		expiresAt: null,
		revokedAt: null
	};
	const packet = assembleHeroDecisionPacket({
		snapshot: engine.snapshot,
		manifest: draft.manifest,
		heroId: draft.manifest.characterId,
		decisionKind: 'settlement-action',
		directives: [directive]
	});
	const result = await new ScriptedPolicy().decide(packet);
	const now = '2026-08-24T12:00:00.000Z';
	const decisionJobId = deterministicUuid(`decision-inspector-job:${requestedPolicy}`);
	return {
		schemaVersion: DECISION_JOB_VERSION,
		decisionJobId,
		rootJobId: decisionJobId,
		parentJobId: null,
		replacementJobId: null,
		runId,
		heroId: draft.manifest.characterId,
		decisionKind: packet.decisionKind,
		status: 'applied',
		requestedPolicy,
		nextAttemptKind: 'primary',
		activePolicy: 'scripted',
		resolution: requestedPolicy === 'model' ? 'fallback' : 'requested',
		expectedRunVersion: packet.world.stateVersion,
		expectedEventCursor: packet.world.eventCursor,
		decisionGameTime: packet.assembledAtGameTime,
		packetId: packet.packetId,
		packetHash: packet.packetHash,
		stateHash: packet.world.stateHash,
		legalActionHash: packet.legalActionHash,
		promptVersion: 'hero-model-prompt-v1',
		contextPolicyVersion: packet.contextPolicyVersion,
		providerRequest:
			requestedPolicy === 'model'
				? buildOpenAIHeroDecisionRequestProfile(packet, { model: 'gpt-5-nano' })
				: null,
		packet,
		result,
		failure: null,
		attemptCount: 1,
		providerAttemptCount: requestedPolicy === 'model' ? 1 : 0,
		maxProviderAttempts: 2,
		replanCount: 0,
		maxReplans: 3,
		leaseExpiresAt: null,
		application: {
			commandId: deterministicUuid('decision-inspector-command'),
			eventCursor: packet.world.eventCursor + 1,
			runVersion: packet.world.stateVersion + 1,
			stateHash: hashCanonical({ applied: result.resultHash }),
			appliedAt: now
		},
		attempts: [
			{
				attemptNumber: 1,
				kind: requestedPolicy === 'model' ? 'fallback' : 'primary',
				policy: 'scripted',
				policyId: 'scripted-policy-v1',
				status: 'succeeded',
				startedAt: now,
				completedAt: now,
				latencyMs: 12,
				resultHash: result.resultHash,
				failure: null
			}
		],
		transitions: [
			{
				sequence: 1,
				fromStatus: null,
				toStatus: 'created',
				reason: 'job-created',
				detail: null,
				occurredAt: now
			},
			{
				sequence: 2,
				fromStatus: 'created',
				toStatus: 'queued',
				reason: 'job-queued',
				detail: null,
				occurredAt: now
			},
			{
				sequence: 3,
				fromStatus: 'queued',
				toStatus: 'applied',
				reason: 'job-applied',
				detail: null,
				occurredAt: now
			}
		],
		createdAt: now,
		updatedAt: now
	};
}

describe('redacted decision inspector', () => {
	it('shows supplied evidence and boundaries without exposing sensitive text', async () => {
		const job = await jobFixture('model');
		const report = buildDecisionInspectorReport(job);
		const serialized = JSON.stringify(report);

		expect(DecisionInspectorReportSchema.parse(report)).toEqual(report);
		expect(verifyDecisionInspectorReport(report)).toBe(true);
		expect(serialized).not.toContain(PRIVATE_DIRECTION);
		expect(serialized).not.toContain('decision-inspector-engine-seed');
		expect(serialized.toLowerCase()).not.toContain('authorization');
		expect(report.privacy).toMatchObject({
			credentialPresent: false,
			privateReasoningPresent: false,
			rawSensitiveTextPresent: false
		});
		expect(report.context.redactions).toContainEqual(
			expect.objectContaining({
				path: 'activeDirectives[0].text',
				value: expect.objectContaining({ classification: 'player-directive' })
			})
		);
		expect(report.provider.request).toMatchObject({
			store: false,
			background: false,
			conversationId: null,
			previousResponseId: null,
			toolCount: 0,
			credentialDisposition: 'server-only-never-persisted'
		});
		expect(report.provider.tokenMetadata.source).toBe('unavailable');
		expect(report.validation.every((boundary) => boundary.outcome === 'passed')).toBe(true);
	});

	it('hash-binds the report and distinguishes jobs that never request a provider', async () => {
		const job = await jobFixture('scripted');
		const report = buildDecisionInspectorReport(job);
		expect(report.provider).toMatchObject({
			disposition: 'not-requested',
			request: null,
			tokenMetadata: { source: 'not-applicable', usage: null }
		});
		expect(verifyDecisionInspectorReport({ ...report, reportHash: '0'.repeat(64) })).toBe(false);
		const clientView = projectDecisionJobClientView(job);
		expect(JSON.stringify(clientView)).not.toContain(PRIVATE_DIRECTION);
		expect(clientView).not.toHaveProperty('packet');
		expect(clientView).not.toHaveProperty('providerRequest');
		expect(clientView.result).toEqual({
			policyId: job.result?.policyId,
			actionId: job.result?.decision.actionId,
			resultHash: job.result?.resultHash
		});
	});
});

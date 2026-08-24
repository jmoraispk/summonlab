import {
	DECISION_INSPECTOR_VERSION,
	DECISION_JOB_CLIENT_VIEW_VERSION,
	DecisionJobClientViewSchema,
	DecisionInspectorReportSchema,
	DecisionJobRecordSchema,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	type DecisionInspectorReport,
	type DecisionJobClientView,
	type DecisionJobRecord,
	type HeroDecisionPacket,
	type SensitiveTextDigest
} from '@summonlab/contracts';
import { hashCanonical, sha256Hex, verifyHeroDecisionPacket } from '@summonlab/engine';
import { validatePolicyDecision, verifyHeroPolicyResult } from '@summonlab/policies';

type SensitiveClassification = SensitiveTextDigest['classification'];
type PathSegment = string | number;

function digest(text: string, classification: SensitiveClassification): SensitiveTextDigest {
	return {
		redacted: true,
		classification,
		characters: text.length,
		sha256: sha256Hex(text)
	};
}

function pathLabel(path: readonly PathSegment[]): string {
	return path
		.map((segment, index) =>
			typeof segment === 'number' ? `[${segment}]` : `${index === 0 ? '' : '.'}${segment}`
		)
		.join('');
}

function setAtPath(root: unknown, path: readonly PathSegment[], value: unknown): void {
	let cursor = root;
	for (const [index, segment] of path.entries()) {
		if ((typeof cursor !== 'object' || cursor === null) && index < path.length) {
			throw new Error(`Cannot redact missing packet path ${pathLabel(path)}`);
		}
		const terminal = index === path.length - 1;
		if (Array.isArray(cursor)) {
			if (typeof segment !== 'number') throw new Error('Array redaction requires a numeric path');
			if (terminal) cursor[segment] = value;
			else cursor = cursor[segment];
			continue;
		}
		if (typeof segment !== 'string') throw new Error('Object redaction requires a string path');
		const object = cursor as Record<string, unknown>;
		if (terminal) object[segment] = value;
		else cursor = object[segment];
	}
}

function redactPacket(packet: HeroDecisionPacket) {
	const redactedPacket = structuredClone(packet) as unknown as Record<string, unknown>;
	const redactions: DecisionInspectorReport['context']['redactions'] = [];
	const redact = (
		path: readonly PathSegment[],
		text: string,
		classification: SensitiveClassification
	) => {
		const value = digest(text, classification);
		setAtPath(redactedPacket, path, value);
		redactions.push({ path: pathLabel(path), value });
		return value;
	};

	for (const [index, belief] of packet.knowledge.beliefs.entries()) {
		if (belief.object.kind === 'text') {
			redact(['knowledge', 'beliefs', index, 'object', 'text'], belief.object.text, 'belief-text');
		}
	}
	for (const [index, memory] of packet.knowledge.memoryRetrieval.memories.entries()) {
		redact(
			['knowledge', 'memoryRetrieval', 'memories', index, 'summary'],
			memory.summary,
			'hero-memory-summary'
		);
		if (memory.exactCommunication) {
			redact(
				['knowledge', 'memoryRetrieval', 'memories', index, 'exactCommunication', 'exactText'],
				memory.exactCommunication.exactText,
				'player-communication'
			);
		}
	}
	for (const [index, relationship] of packet.social.relationships.entries()) {
		if (relationship.latestEvidence) {
			redact(
				['social', 'relationships', index, 'latestEvidence'],
				relationship.latestEvidence,
				'social-evidence'
			);
		}
	}
	for (const [index, authority] of packet.social.authority.entries()) {
		if (authority.latestEvidence) {
			redact(
				['social', 'authority', index, 'latestEvidence'],
				authority.latestEvidence,
				'social-evidence'
			);
		}
	}
	for (const [index, promise] of packet.social.promises.entries()) {
		redact(['social', 'promises', index, 'terms'], promise.terms, 'promise-terms');
	}
	for (const [index, directive] of packet.activeDirectives.entries()) {
		redact(['activeDirectives', index, 'text'], directive.text, 'player-directive');
	}

	return { redactedPacket, redactions, redact };
}

function selectedEvidence(packet: HeroDecisionPacket) {
	return packet.knowledge.memoryRetrieval.memories.map((memory) => ({
		memoryId: memory.memoryId,
		observationId: memory.observationId,
		sourceEventId: memory.sourceEventId,
		kind: memory.kind,
		occurredAt: memory.occurredAt,
		subjectIds: memory.subjectIds,
		summary: digest(memory.summary, 'hero-memory-summary'),
		exactCommunication: memory.exactCommunication
			? {
					actId: memory.exactCommunication.actId,
					speakerId: memory.exactCommunication.speakerId,
					kind: memory.exactCommunication.kind,
					topic: memory.exactCommunication.topic,
					delivery: memory.exactCommunication.delivery,
					perception: memory.exactCommunication.perception,
					exactText: digest(memory.exactCommunication.exactText, 'player-communication')
				}
			: null,
		score: memory.score,
		reasons: memory.reasons,
		characterCost: memory.characterCost
	}));
}

function redactedResult(
	job: DecisionJobRecord,
	redactions: DecisionInspectorReport['context']['redactions']
): DecisionInspectorReport['result'] {
	if (!job.result) return null;
	const decision = job.result.decision;
	const outputDigest = (path: string, text: string) => {
		const value = digest(text, 'hero-public-output');
		redactions.push({ path, value });
		return value;
	};
	return {
		...job.result,
		decision: {
			actionId: decision.actionId,
			targetIds: decision.targetIds,
			publicIntent: outputDigest('result.decision.publicIntent', decision.publicIntent),
			spokenText: decision.spokenText
				? outputDigest('result.decision.spokenText', decision.spokenText)
				: null,
			goalProposal: decision.goalProposal
				? {
						summary: outputDigest(
							'result.decision.goalProposal.summary',
							decision.goalProposal.summary
						),
						motive: outputDigest(
							'result.decision.goalProposal.motive',
							decision.goalProposal.motive
						),
						horizon: decision.goalProposal.horizon
					}
				: null,
			memoryCandidateIds: decision.memoryCandidateIds
		}
	};
}

function validationFor(job: DecisionJobRecord, packet: HeroDecisionPacket) {
	const result = job.result ? HeroPolicyResultSchema.parse(job.result) : null;
	const resultReached = result !== null;
	const action = result
		? packet.legalActions.find((candidate) => candidate.actionId === result.decision.actionId)
		: null;
	const targetsValid = Boolean(
		action && result?.decision.targetIds.every((targetId) => action.targetIds.includes(targetId))
	);
	const memoryIds = new Set(
		packet.knowledge.memoryRetrieval.memories.map((memory) => memory.memoryId)
	);
	const memoriesValid = Boolean(
		result?.decision.memoryCandidateIds.every((memoryId) => memoryIds.has(memoryId))
	);
	if (result) validatePolicyDecision(packet, result.decision);
	const providerProfile = job.schemaVersion === 'decision-job-v2' ? job.providerRequest : null;
	const providerBoundary =
		job.schemaVersion === 'decision-job-v1'
			? {
					boundary: 'provider-request-binding' as const,
					outcome: 'legacy-unavailable' as const,
					evidence: 'Legacy decision-job-v1 predates persisted request profiles.'
				}
			: {
					boundary: 'provider-request-binding' as const,
					outcome: 'passed' as const,
					evidence: providerProfile
						? `Profile ${providerProfile.requestHash.slice(0, 12)} is bound to the packet.`
						: 'No provider profile exists because this job did not request a model.'
				};
	const resultOutcome = resultReached ? ('passed' as const) : ('not-reached' as const);
	return [
		{
			boundary: 'packet-schema' as const,
			outcome: 'passed' as const,
			evidence: `${packet.packetVersion} parsed with strict unknown-key rejection.`
		},
		{
			boundary: 'packet-hash' as const,
			outcome: verifyHeroDecisionPacket(packet) ? ('passed' as const) : ('rejected' as const),
			evidence: `Recomputed packet hash ${packet.packetHash.slice(0, 12)}.`
		},
		{
			boundary: 'legal-action-hash' as const,
			outcome:
				hashCanonical(packet.legalActions) === packet.legalActionHash
					? ('passed' as const)
					: ('rejected' as const),
			evidence: `${packet.legalActions.length} canonical legal actions are hash-bound.`
		},
		{
			boundary: 'job-packet-binding' as const,
			outcome: 'passed' as const,
			evidence: `Job version, cursor, state, hero, packet, and legal hashes agree.`
		},
		providerBoundary,
		{
			boundary: 'result-schema' as const,
			outcome: resultOutcome,
			evidence: resultReached
				? 'The stored result satisfies hero-policy-result-v1.'
				: 'No policy result has reached this boundary.'
		},
		{
			boundary: 'result-hash' as const,
			outcome: result
				? verifyHeroPolicyResult(result)
					? ('passed' as const)
					: ('rejected' as const)
				: ('not-reached' as const),
			evidence: result ? `Recomputed result hash ${result.resultHash.slice(0, 12)}.` : 'No result.'
		},
		{
			boundary: 'result-packet-binding' as const,
			outcome: resultOutcome,
			evidence: result
				? 'Result packet, legal-action, state, version, and cursor bindings agree.'
				: 'No result.'
		},
		{
			boundary: 'legal-action-selection' as const,
			outcome: result ? (action ? 'passed' : 'rejected') : 'not-reached',
			evidence: result ? `Selected ${result.decision.actionId}.` : 'No result.'
		},
		{
			boundary: 'target-boundary' as const,
			outcome: result ? (targetsValid ? 'passed' : 'rejected') : 'not-reached',
			evidence: result
				? `${result.decision.targetIds.length} selected targets came from the legal action.`
				: 'No result.'
		},
		{
			boundary: 'memory-boundary' as const,
			outcome: result ? (memoriesValid ? 'passed' : 'rejected') : 'not-reached',
			evidence: result
				? `${result.decision.memoryCandidateIds.length} cited memories came from retrieval.`
				: 'No result.'
		},
		{
			boundary: 'engine-application' as const,
			outcome: job.application
				? ('passed' as const)
				: job.status === 'stale' || job.status === 'failed'
					? ('rejected' as const)
					: ('not-reached' as const),
			evidence: job.application
				? `Engine command committed at cursor ${job.application.eventCursor}.`
				: job.status === 'stale' || job.status === 'failed'
					? `Application stopped with terminal status ${job.status}.`
					: 'The engine application boundary has not been reached.'
		}
	];
}

function providerFor(job: DecisionJobRecord): DecisionInspectorReport['provider'] {
	const request = job.schemaVersion === 'decision-job-v2' ? job.providerRequest : null;
	const modelAttempts = job.attempts.filter((attempt) => attempt.policy === 'model');
	const modelTrace = job.result?.trace.kind === 'model' ? job.result.trace : null;
	const response = modelTrace
		? {
				responseId: modelTrace.responseId,
				requestedModel: modelTrace.requestedModel,
				resolvedModel: modelTrace.resolvedModel,
				serviceTier: modelTrace.serviceTier,
				requestHash: modelTrace.requestHash,
				outputHash: modelTrace.outputHash,
				usage: modelTrace.usage
			}
		: null;
	let disposition: DecisionInspectorReport['provider']['disposition'];
	if (job.requestedPolicy !== 'model') disposition = 'not-requested';
	else if (job.schemaVersion === 'decision-job-v1') disposition = 'legacy-metadata-unavailable';
	else if (response) disposition = 'completed';
	else if (modelAttempts.some((attempt) => attempt.status === 'failed')) disposition = 'failed';
	else if (modelAttempts.length > 0) disposition = 'attempted';
	else disposition = 'profiled-not-attempted';
	return {
		disposition,
		request,
		response,
		tokenMetadata: {
			source: response
				? 'provider'
				: job.requestedPolicy === 'model'
					? 'unavailable'
					: 'not-applicable',
			usage: response?.usage ?? null
		}
	};
}

function unsignedReport(
	report: DecisionInspectorReport
): Omit<DecisionInspectorReport, 'reportHash'> {
	const unsigned: Partial<DecisionInspectorReport> = { ...report };
	delete unsigned.reportHash;
	return unsigned as Omit<DecisionInspectorReport, 'reportHash'>;
}

export function buildDecisionInspectorReport(jobInput: DecisionJobRecord): DecisionInspectorReport {
	const job = DecisionJobRecordSchema.parse(jobInput);
	const packet = HeroDecisionPacketSchema.parse(job.packet);
	const redacted = redactPacket(packet);
	const result = redactedResult(job, redacted.redactions);
	const withoutHash = {
		schemaVersion: DECISION_INSPECTOR_VERSION,
		job: {
			schemaVersion: job.schemaVersion,
			decisionJobId: job.decisionJobId,
			rootJobId: job.rootJobId,
			parentJobId: job.parentJobId,
			replacementJobId: job.replacementJobId,
			runId: job.runId,
			heroId: job.heroId,
			decisionKind: job.decisionKind,
			status: job.status,
			requestedPolicy: job.requestedPolicy,
			activePolicy: job.activePolicy,
			resolution: job.resolution,
			attemptCount: job.attemptCount,
			providerAttemptCount: job.providerAttemptCount,
			replanCount: job.replanCount,
			createdAt: job.createdAt,
			updatedAt: job.updatedAt,
			application: job.application,
			attempts: job.attempts,
			transitions: job.transitions
		},
		binding: {
			packetId: job.packetId,
			packetHash: job.packetHash,
			stateVersion: job.expectedRunVersion,
			eventCursor: job.expectedEventCursor,
			stateHash: job.stateHash,
			legalActionHash: job.legalActionHash,
			resultHash: job.result?.resultHash ?? null
		},
		context: {
			packetVersion: packet.packetVersion,
			contextPolicyVersion: packet.contextPolicyVersion,
			memoryPolicyVersion: packet.knowledge.memoryRetrieval.policyVersion,
			assembledAtGameTime: packet.assembledAtGameTime,
			suppliedSections: [
				'identity',
				'self',
				'environment',
				'knowledge',
				'social',
				'activeDirectives',
				'legalActions',
				'responseContract'
			] as const,
			counts: {
				visibleEntities: packet.environment.visibleEntities.length,
				beliefs: packet.knowledge.beliefs.length,
				relationships: packet.social.relationships.length,
				authorityModels: packet.social.authority.length,
				promises: packet.social.promises.length,
				directives: packet.activeDirectives.length,
				legalActions: packet.legalActions.length,
				memoryCandidates: packet.knowledge.memoryRetrieval.candidateCount,
				selectedMemories: packet.knowledge.memoryRetrieval.selectedCount,
				selectedMemoryCharacters: packet.knowledge.memoryRetrieval.selectedCharacters
			},
			selectedEvidence: selectedEvidence(packet),
			legalActions: packet.legalActions,
			redactedPacket: redacted.redactedPacket,
			redactions: redacted.redactions
		},
		privacy: {
			access: 'development-only' as const,
			credentialPresent: false as const,
			privateReasoningPresent: false as const,
			rawSensitiveTextPresent: false as const,
			omitted: [
				{
					category: 'credential' as const,
					path: 'OPENAI_API_KEY',
					reason:
						'Credentials remain server process configuration and never enter jobs or reports.',
					enforcedBy: 'persistence-schema' as const
				},
				{
					category: 'run-secret' as const,
					path: 'run.seed',
					reason: 'The context assembler never projects the authoritative run seed.',
					enforcedBy: 'context-assembler' as const
				},
				{
					category: 'other-actor-private-state' as const,
					path: 'heroes[*].mind',
					reason: 'Only the deciding hero mind and holder-owned cognition are packet fields.',
					enforcedBy: 'packet-schema' as const
				},
				{
					category: 'undiscovered-world-state' as const,
					path: 'world.hidden',
					reason: 'The packet contains observable environment and known beliefs, not world truth.',
					enforcedBy: 'context-assembler' as const
				},
				{
					category: 'future-state' as const,
					path: 'world.future',
					reason: 'No scheduled outcome or future encounter truth is projected.',
					enforcedBy: 'packet-schema' as const
				},
				{
					category: 'full-event-log' as const,
					path: 'events[*]',
					reason: 'Deterministic retrieval supplies selected holder-owned evidence only.',
					enforcedBy: 'context-assembler' as const
				},
				{
					category: 'provider-private-reasoning' as const,
					path: 'response.reasoning',
					reason: 'Private reasoning content is neither requested, persisted, nor rendered.',
					enforcedBy: 'provider-request-builder' as const
				}
			]
		},
		provider: providerFor(job),
		result,
		validation: validationFor(job, packet)
	};
	return DecisionInspectorReportSchema.parse({
		...withoutHash,
		reportHash: hashCanonical(withoutHash)
	});
}

export function verifyDecisionInspectorReport(reportInput: DecisionInspectorReport): boolean {
	const report = DecisionInspectorReportSchema.parse(reportInput);
	return hashCanonical(unsignedReport(report)) === report.reportHash;
}

export function projectDecisionJobClientView(jobInput: DecisionJobRecord): DecisionJobClientView {
	const job = DecisionJobRecordSchema.parse(jobInput);
	return DecisionJobClientViewSchema.parse({
		schemaVersion: DECISION_JOB_CLIENT_VIEW_VERSION,
		decisionJobId: job.decisionJobId,
		replacementJobId: job.replacementJobId,
		status: job.status,
		resolution: job.resolution,
		packetHash: job.packetHash,
		attemptCount: job.attemptCount,
		replanCount: job.replanCount,
		failure: job.failure ? { code: job.failure.code, retryable: job.failure.retryable } : null,
		result: job.result
			? {
					policyId: job.result.policyId,
					actionId: job.result.decision.actionId,
					resultHash: job.result.resultHash
				}
			: null,
		application: job.application,
		transitions: job.transitions.map((transition) => ({
			sequence: transition.sequence,
			toStatus: transition.toStatus
		}))
	});
}

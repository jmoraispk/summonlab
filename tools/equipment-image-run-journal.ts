import {
	EquipmentRunEventSchema,
	type EquipmentRunEvent,
	type EquipmentRunEventRequest
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256 } from './equipment-image-packets.js';

export interface EquipmentRunJournalGateContext {
	readonly gateId: string;
	readonly sourceTargetId: string;
	readonly unlocksTargetIds: readonly string[];
}

export interface EquipmentRunJournalContext {
	readonly runId: string;
	readonly runPlanCanonicalSha256: string;
	readonly maximumConcurrency: 16;
	readonly productionPriorityTargetIds: readonly string[];
	readonly initiallyReadyTargetIds: readonly string[];
	readonly reviewGates: readonly EquipmentRunJournalGateContext[];
}

type ClaimedRequest = Extract<EquipmentRunEventRequest, { kind: 'job-claimed' }>;
type StartedRequest = Extract<EquipmentRunEventRequest, { kind: 'worker-started' }>;
type TerminalRequest = Extract<EquipmentRunEventRequest, { kind: 'job-terminal' }>;
type ReviewRequest = Extract<EquipmentRunEventRequest, { kind: 'armour-source-reviewed' }>;

export interface EquipmentRunJournalState {
	readonly orderedEvents: readonly EquipmentRunEvent[];
	readonly runStarted: boolean;
	readonly currentEpochId: string | null;
	readonly pausedEpochId: string | null;
	readonly readyTargetIds: ReadonlySet<string>;
	readonly readyUnclaimedTargetIds: readonly string[];
	readonly claims: ReadonlyMap<string, ClaimedRequest>;
	readonly claimedTargetIds: ReadonlySet<string>;
	readonly active: ReadonlyMap<string, StartedRequest>;
	readonly activeTargetIds: ReadonlySet<string>;
	readonly activeWorkerIds: ReadonlySet<string>;
	readonly terminal: ReadonlyMap<string, TerminalRequest>;
	readonly terminalTargetIds: ReadonlySet<string>;
	readonly reclaimableTargetIds: readonly string[];
	readonly acceptedGateIds: ReadonlySet<string>;
	readonly reviewedGates: ReadonlyMap<string, ReviewRequest>;
	readonly technicalFailureCount: number;
	readonly circuitBreakerPauseRequired: boolean;
	readonly peakActiveWorkerCount: number;
	readonly peakActiveWorkerIds: ReadonlySet<string>;
	readonly distinctStartedWorkerIds: ReadonlySet<string>;
}

function assertUnique(values: readonly string[], label: string): void {
	if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}

function validateContext(context: EquipmentRunJournalContext): void {
	if (!/^[a-z][a-z0-9-]{1,119}$/u.test(context.runId)) {
		throw new Error('Journal context run ID is invalid');
	}
	if (!/^[a-f0-9]{64}$/u.test(context.runPlanCanonicalSha256)) {
		throw new Error('Journal context run-plan hash is invalid');
	}
	if (context.maximumConcurrency !== 16) {
		throw new Error('Equipment journal maximum concurrency must be 16');
	}
	assertUnique(context.productionPriorityTargetIds, 'Production-priority target IDs');
	assertUnique(context.initiallyReadyTargetIds, 'Initially ready target IDs');
	assertUnique(
		context.reviewGates.map(({ gateId }) => gateId),
		'Review gate IDs'
	);
	const targetIds = new Set(context.productionPriorityTargetIds);
	if (context.initiallyReadyTargetIds.some((targetId) => !targetIds.has(targetId))) {
		throw new Error('Initially ready target is absent from production priority');
	}
	const unlockedTargetIds = context.reviewGates.flatMap(({ unlocksTargetIds }) => unlocksTargetIds);
	assertUnique(unlockedTargetIds, 'Review-gated target IDs');
	for (const gate of context.reviewGates) {
		if (!targetIds.has(gate.sourceTargetId)) {
			throw new Error(`Review gate source is not a run target: ${gate.sourceTargetId}`);
		}
		if (
			gate.unlocksTargetIds.length !== 4 ||
			gate.unlocksTargetIds.some((targetId) => !targetIds.has(targetId))
		) {
			throw new Error(`Review gate must unlock four run targets: ${gate.gateId}`);
		}
	}
}

function orderAndVerifyEvents(
	context: EquipmentRunJournalContext,
	eventInputs: readonly unknown[]
): EquipmentRunEvent[] {
	const events = eventInputs.map((event) => EquipmentRunEventSchema.parse(event));
	assertUnique(
		events.map(({ request }) => request.eventId),
		'Equipment event IDs'
	);
	const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
	for (const [index, event] of ordered.entries()) {
		if (event.sequence !== index + 1) {
			throw new Error('Equipment event sequences must be unique, contiguous, and start at one');
		}
		if (event.request.runId !== context.runId) {
			throw new Error(`Equipment event belongs to another run: ${event.request.runId}`);
		}
		const previous = ordered[index - 1];
		const expectedPreviousHash = previous === undefined ? null : canonicalJsonSha256(previous);
		if (event.previousEventCanonicalSha256 !== expectedPreviousHash) {
			throw new Error(`Equipment event does not hash-bind the previous event: ${event.sequence}`);
		}
		if (Date.parse(event.request.requestedAt) > Date.parse(event.recordedAt)) {
			throw new Error('Equipment event requestedAt must not be later than recordedAt');
		}
		if (previous !== undefined && Date.parse(event.recordedAt) < Date.parse(previous.recordedAt)) {
			throw new Error('Recorder event timestamps must be nondecreasing');
		}
	}
	return ordered;
}

function orderedMembers(priority: readonly string[], members: ReadonlySet<string>): string[] {
	return priority.filter((targetId) => members.has(targetId));
}

export function replayEquipmentRunJournal(
	context: EquipmentRunJournalContext,
	eventInputs: readonly unknown[]
): EquipmentRunJournalState {
	validateContext(context);
	const orderedEvents = orderAndVerifyEvents(context, eventInputs);
	const allTargetIds = new Set(context.productionPriorityTargetIds);
	const gateById = new Map(context.reviewGates.map((gate) => [gate.gateId, gate] as const));
	const readyTargetIds = new Set(context.initiallyReadyTargetIds);
	const claims = new Map<string, ClaimedRequest>();
	const active = new Map<string, StartedRequest>();
	const activeWorkerTargets = new Map<string, string>();
	const terminal = new Map<string, TerminalRequest>();
	const releasedTargetIds = new Set<string>();
	const acceptedGateIds = new Set<string>();
	const reviewedGates = new Map<string, ReviewRequest>();
	const claimIds = new Set<string>();
	const distinctStartedWorkerIds = new Set<string>();
	let runStarted = false;
	let currentEpochId: string | null = null;
	let pausedEpochId: string | null = null;
	let technicalFailureCount = 0;
	let circuitBreakerPauseRequired = false;
	let peakActiveWorkerCount = 0;
	let peakActiveWorkerIds = new Set<string>();

	for (const event of orderedEvents) {
		const request = event.request;
		if (circuitBreakerPauseRequired && request.kind !== 'epoch-paused') {
			throw new Error('The next event after the third technical failure must be epoch-paused');
		}
		if (request.kind !== 'run-started' && !runStarted) {
			throw new Error('Equipment lifecycle events require a preceding run-started event');
		}

		if (request.kind === 'run-started') {
			if (runStarted) throw new Error('Equipment run may start only once');
			runStarted = true;
			currentEpochId = request.epochId;
			continue;
		}

		if ('targetId' in request && !allTargetIds.has(request.targetId)) {
			throw new Error(`Equipment event target is not in the run: ${request.targetId}`);
		}

		if (request.kind === 'job-claimed') {
			if (pausedEpochId !== null)
				throw new Error('No job may be claimed while the epoch is paused');
			if (request.epochId !== currentEpochId) {
				throw new Error('Job claim does not belong to the current dispatch epoch');
			}
			if (terminal.has(request.targetId)) {
				throw new Error(`Target is already terminal: ${request.targetId}`);
			}
			if (!readyTargetIds.has(request.targetId)) {
				throw new Error(`Target is not ready and unclaimed: ${request.targetId}`);
			}
			if (claimIds.has(request.claimId))
				throw new Error(`Claim ID must be unique: ${request.claimId}`);
			claimIds.add(request.claimId);
			claims.set(request.targetId, request);
			readyTargetIds.delete(request.targetId);
			releasedTargetIds.delete(request.targetId);
			continue;
		}

		if (request.kind === 'claim-released') {
			if (active.has(request.targetId)) {
				throw new Error(`A started active worker claim cannot be released: ${request.targetId}`);
			}
			const claim = claims.get(request.targetId);
			if (claim === undefined)
				throw new Error(`Claim release requires a live claim: ${request.targetId}`);
			if (claim.claimId !== request.claimId || claim.workerId !== request.workerId) {
				throw new Error(`Claim release changed claim or worker identity: ${request.targetId}`);
			}
			claims.delete(request.targetId);
			readyTargetIds.add(request.targetId);
			releasedTargetIds.add(request.targetId);
			continue;
		}

		if (request.kind === 'worker-started') {
			if (pausedEpochId !== null) throw new Error('No worker may start while the epoch is paused');
			if (terminal.has(request.targetId)) {
				throw new Error(`Target is already terminal: ${request.targetId}`);
			}
			const claim = claims.get(request.targetId);
			if (claim === undefined)
				throw new Error(`Worker start requires a live claim: ${request.targetId}`);
			if (claim.claimId !== request.claimId || claim.workerId !== request.workerId) {
				throw new Error(`Worker start changed claim or worker identity: ${request.targetId}`);
			}
			if (activeWorkerTargets.has(request.workerId)) {
				throw new Error(`Worker is already active on another Equipment job: ${request.workerId}`);
			}
			if (active.size >= context.maximumConcurrency) {
				throw new Error('Active Equipment workers exceed maximum concurrency');
			}
			claims.delete(request.targetId);
			active.set(request.targetId, request);
			activeWorkerTargets.set(request.workerId, request.targetId);
			distinctStartedWorkerIds.add(request.workerId);
			if (activeWorkerTargets.size > peakActiveWorkerCount) {
				peakActiveWorkerCount = activeWorkerTargets.size;
				peakActiveWorkerIds = new Set(activeWorkerTargets.keys());
			}
			continue;
		}

		if (request.kind === 'job-terminal') {
			if (terminal.has(request.targetId)) {
				throw new Error(`Target already has a terminal event: ${request.targetId}`);
			}
			const start = active.get(request.targetId);
			if (start === undefined) {
				throw new Error(`Terminal event requires a started worker: ${request.targetId}`);
			}
			if (start.workerId !== request.workerId) {
				throw new Error(`Terminal event changed worker identity: ${request.targetId}`);
			}
			const operatorConfirmedNoOutput =
				request.status === 'failed' &&
				request.resultCanonicalSha256 === null &&
				request.failureKind === 'operator-confirmed';
			const verifiedPersistedFailure =
				request.status === 'failed' &&
				request.resultCanonicalSha256 !== null &&
				request.failureKind !== null &&
				request.failureKind !== 'operator-confirmed';
			const verifiedCandidateOrRevise =
				request.status !== 'failed' &&
				request.resultCanonicalSha256 !== null &&
				request.failureKind === null;
			if (!operatorConfirmedNoOutput && !verifiedPersistedFailure && !verifiedCandidateOrRevise) {
				throw new Error('Terminal result hash and failure kind do not match terminal status');
			}
			active.delete(request.targetId);
			activeWorkerTargets.delete(request.workerId);
			terminal.set(request.targetId, request);
			if (request.status === 'failed') {
				technicalFailureCount += 1;
				if (technicalFailureCount === 3 && pausedEpochId === null) {
					circuitBreakerPauseRequired = true;
				}
			}
			continue;
		}

		if (request.kind === 'armour-source-reviewed') {
			const gate = gateById.get(request.gateId);
			if (gate === undefined || gate.sourceTargetId !== request.sourceTargetId) {
				throw new Error(`Armour review does not match a run gate: ${request.gateId}`);
			}
			if (reviewedGates.has(request.gateId)) {
				throw new Error(`Armour review gate already has a decision: ${request.gateId}`);
			}
			const sourceTerminal = terminal.get(request.sourceTargetId);
			if (sourceTerminal?.status !== 'candidate') {
				throw new Error(
					`Armour review source is not a terminal candidate: ${request.sourceTargetId}`
				);
			}
			reviewedGates.set(request.gateId, request);
			if (request.decision === 'accepted') {
				acceptedGateIds.add(request.gateId);
				for (const targetId of gate.unlocksTargetIds) readyTargetIds.add(targetId);
			}
			continue;
		}

		if (request.kind === 'epoch-paused') {
			if (pausedEpochId !== null) throw new Error('Dispatch epoch is already paused');
			if (request.epochId !== currentEpochId || technicalFailureCount !== 3) {
				throw new Error('epoch-paused must bind the current epoch after exactly three failures');
			}
			pausedEpochId = request.epochId;
			circuitBreakerPauseRequired = false;
			continue;
		}

		if (request.kind === 'epoch-resumed') {
			if (pausedEpochId === null || request.previousEpochId !== pausedEpochId) {
				throw new Error('epoch-resumed must bind the paused dispatch epoch');
			}
			if (request.epochId === request.previousEpochId) {
				throw new Error('Resumed dispatch epoch must use a new epoch ID');
			}
			if (active.size !== 0)
				throw new Error('Paused epoch must drain active workers before resume');
			currentEpochId = request.epochId;
			pausedEpochId = null;
			technicalFailureCount = 0;
			circuitBreakerPauseRequired = false;
		}
	}

	const orderedReadyTargetIds = orderedMembers(context.productionPriorityTargetIds, readyTargetIds);
	const orderedReclaimableTargetIds = orderedMembers(
		context.productionPriorityTargetIds,
		releasedTargetIds
	);
	return {
		orderedEvents,
		runStarted,
		currentEpochId,
		pausedEpochId,
		readyTargetIds: new Set(orderedReadyTargetIds),
		readyUnclaimedTargetIds: orderedReadyTargetIds,
		claims,
		claimedTargetIds: new Set(claims.keys()),
		active,
		activeTargetIds: new Set(active.keys()),
		activeWorkerIds: new Set(activeWorkerTargets.keys()),
		terminal,
		terminalTargetIds: new Set(terminal.keys()),
		reclaimableTargetIds: orderedReclaimableTargetIds,
		acceptedGateIds,
		reviewedGates,
		technicalFailureCount,
		circuitBreakerPauseRequired,
		peakActiveWorkerCount,
		peakActiveWorkerIds,
		distinctStartedWorkerIds
	};
}

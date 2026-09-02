import { readdir } from 'node:fs/promises';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentImageResultSchema,
	EquipmentRunActivationSchema,
	EquipmentRunEventSchema,
	EquipmentRunPlanSchema,
	EquipmentRunReportSchema,
	type EquipmentRunEvent,
	type EquipmentRunPlan
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256 } from './equipment-image-packets.js';
import { verifyEquipmentImageResult } from './equipment-image-result.js';
import {
	equipmentRepositoryAbsolute,
	equipmentRepositoryPathState,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';
import { replayEquipmentRunJournal } from './equipment-image-run-journal.js';
import {
	buildEquipmentRunJournalContext,
	recordOperatorConfirmedEquipmentRunFailure,
	recordVerifiedEquipmentRunTerminal
} from './equipment-image-run-recorder.js';
import {
	buildEquipmentRunPlan,
	reportEquipmentRunReadiness
} from './equipment-image-run-readiness.js';
import {
	buildEquipmentMaterialAllocationPlan,
	buildEquipmentMaterialProductionManifest
} from './equipment-material-production-lib.js';

interface TerminalAuthorization {
	readonly acknowledged: boolean;
	readonly expectedTerminalStatus: 'candidate' | 'revise' | 'failed';
	readonly expectedResultCanonicalSha256: string;
	readonly eventId: string;
	readonly actor: string;
	readonly requestedAt: string;
	readonly recordedAt: string;
}

interface OperatorConfirmedFailure {
	readonly targetId?: string;
	readonly workerId?: string;
	readonly reason?: string;
	readonly acknowledged?: boolean;
	readonly eventId?: string;
	readonly operator?: string;
	readonly confirmedAt?: string;
	readonly recordedAt?: string;
}

export interface ReconcileEquipmentRunInput {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly targetId: string;
	readonly workerId: string;
	readonly observedAt: string;
	readonly terminalAuthorization?: TerminalAuthorization;
	readonly operatorConfirmedFailure?: OperatorConfirmedFailure;
}

export interface SimulateEquipmentRunInput {
	readonly availableWorkerSlots: number;
	readonly unrelatedActiveWorkMetadata?: unknown;
}

export interface ReportEquipmentRunInput {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly createdAt: string;
	readonly generatedAt: string;
}

function runPaths(runId: string) {
	const runDirectory = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${runId}`;
	return {
		runDirectory,
		planPath: `${runDirectory}/plan.json`,
		activationPath: `${runDirectory}/activation.json`,
		eventsDirectory: `${runDirectory}/events`
	};
}

async function readEvents(workspaceRoot: string, runId: string): Promise<EquipmentRunEvent[]> {
	const eventsDirectory = runPaths(runId).eventsDirectory;
	const state = await equipmentRepositoryPathState(workspaceRoot, eventsDirectory);
	if (state === 'absent') return [];
	if (state !== 'directory') throw new Error('Equipment event journal must be a directory');
	const events: EquipmentRunEvent[] = [];
	for (const name of (
		await readdir(equipmentRepositoryAbsolute(workspaceRoot, eventsDirectory))
	).sort()) {
		const match = /^(\d{6})-([a-z][a-z0-9-]{1,119})\.json$/u.exec(name);
		if (match === null) throw new Error(`Unexpected Equipment journal entry: ${name}`);
		const event = EquipmentRunEventSchema.parse(
			await readEquipmentRepositoryJson(workspaceRoot, `${eventsDirectory}/${name}`)
		);
		if (Number(match[1]) !== event.sequence || match[2] !== event.request.eventId) {
			throw new Error(`Equipment event filename does not bind its event: ${name}`);
		}
		events.push(event);
	}
	return events;
}

async function loadActivatedRun(input: { readonly workspaceRoot: string; readonly runId: string }) {
	const paths = runPaths(input.runId);
	const plan = EquipmentRunPlanSchema.parse(
		await readEquipmentRepositoryJson(input.workspaceRoot, paths.planPath)
	);
	if (plan.runId !== input.runId) throw new Error('Equipment run plan belongs to another run');
	const expectedPlan = await buildEquipmentRunPlan({
		workspaceRoot: input.workspaceRoot,
		runId: input.runId,
		createdAt: plan.createdAt
	});
	if (canonicalJsonSha256(plan) !== canonicalJsonSha256(expectedPlan)) {
		throw new Error('Persisted immutable Equipment run plan is stale or changed');
	}
	const activation = EquipmentRunActivationSchema.parse(
		await readEquipmentRepositoryJson(input.workspaceRoot, paths.activationPath)
	);
	const context = buildEquipmentRunJournalContext(plan, activation);
	const events = await readEvents(input.workspaceRoot, input.runId);
	const journal = replayEquipmentRunJournal(context, events);
	return { plan, activation, context, journal };
}

function packetPaths(plan: EquipmentRunPlan, targetId: string) {
	const targetIndex = plan.targetIds.indexOf(targetId);
	if (targetIndex < 0) throw new Error(`Target is absent from the Equipment run: ${targetId}`);
	const candidatePath = plan.reservedPaths.candidates[targetIndex];
	const resultPath = plan.reservedPaths.results[targetIndex];
	if (candidatePath === undefined || resultPath === undefined) {
		throw new Error(`Target has incomplete Equipment output reservations: ${targetId}`);
	}
	const rootPacket = plan.rootPackets.find((packet) => packet.targetId === targetId);
	if (rootPacket !== undefined) return { ...rootPacket, candidatePath, resultPath };
	const candidatePrefix = `${EQUIPMENT_PRODUCTION_ROOT}/candidates/`;
	if (!candidatePath.startsWith(candidatePrefix) || !candidatePath.endsWith('.png')) {
		throw new Error(`Invalid Equipment candidate reservation: ${candidatePath}`);
	}
	const suffix = candidatePath.slice(candidatePrefix.length, -4);
	return {
		targetPath: `${EQUIPMENT_PRODUCTION_ROOT}/targets/${suffix}.json`,
		assignmentPath: `${EQUIPMENT_PRODUCTION_ROOT}/assignments/${suffix}.json`,
		candidatePath,
		resultPath
	};
}

function assertExactActiveWorker(
	journal: Awaited<ReturnType<typeof loadActivatedRun>>['journal'],
	targetId: string,
	workerId: string
): void {
	const active = journal.active.get(targetId);
	if (active === undefined || active.workerId !== workerId) {
		throw new Error('Reconciliation requires the exact active target and worker identity');
	}
}

async function verifyTerminalEvidence(input: {
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly candidatePath: string;
	readonly resultPath: string;
}) {
	const [candidateState, resultState] = await Promise.all([
		equipmentRepositoryPathState(input.workspaceRoot, input.candidatePath),
		equipmentRepositoryPathState(input.workspaceRoot, input.resultPath)
	]);
	if (resultState !== 'file') {
		throw new Error('Authorized terminal reconciliation requires a persisted result');
	}
	const resultValue = EquipmentImageResultSchema.parse(
		await readEquipmentRepositoryJson(input.workspaceRoot, input.resultPath)
	);
	if (
		(resultValue.status === 'failed' && candidateState !== 'absent') ||
		(resultValue.status !== 'failed' && candidateState !== 'file')
	) {
		throw new Error('Terminal reconciliation output shape does not match the result status');
	}
	const verified = await verifyEquipmentImageResult({
		workspaceRoot: input.workspaceRoot,
		targetPath: input.targetPath,
		assignmentPath: input.assignmentPath,
		resultPath: input.resultPath,
		result: resultValue
	});
	return {
		terminalStatus: verified.status,
		resultCanonicalSha256: canonicalJsonSha256(resultValue)
	};
}

function assertTerminalAuthorizationMatches(
	authorization: TerminalAuthorization,
	evidence: Awaited<ReturnType<typeof verifyTerminalEvidence>>
): void {
	if (authorization.acknowledged !== true) {
		throw new Error('Verified terminal reconciliation requires explicit acknowledgement');
	}
	if (authorization.expectedTerminalStatus !== evidence.terminalStatus) {
		throw new Error(
			`Authorization expected terminal status ${authorization.expectedTerminalStatus}, received ${evidence.terminalStatus}`
		);
	}
	if (authorization.expectedResultCanonicalSha256 !== evidence.resultCanonicalSha256) {
		throw new Error(
			'Authorization expected result canonical SHA-256 does not match verified evidence'
		);
	}
}

export async function reconcileEquipmentRun(input: ReconcileEquipmentRunInput) {
	if (!Number.isFinite(Date.parse(input.observedAt))) {
		throw new Error('Reconciliation observedAt must be an ISO date-time');
	}
	const evidence = await loadActivatedRun(input);
	if (evidence.journal.terminal.has(input.targetId)) {
		return {
			action: 'terminal-already-recorded' as const,
			writesRequired: 0 as const,
			writesPerformed: 0 as const
		};
	}
	assertExactActiveWorker(evidence.journal, input.targetId, input.workerId);
	const paths = packetPaths(evidence.plan, input.targetId);
	const [candidateState, resultState] = await Promise.all([
		equipmentRepositoryPathState(input.workspaceRoot, paths.candidatePath),
		equipmentRepositoryPathState(input.workspaceRoot, paths.resultPath)
	]);
	const candidateExists = candidateState !== 'absent';
	const resultExists = resultState !== 'absent';
	if (candidateExists && !resultExists) {
		return {
			action: 'blocked-partial-output' as const,
			writesRequired: 0 as const,
			writesPerformed: 0 as const,
			candidateExists,
			resultExists
		};
	}
	if (!candidateExists && resultExists) {
		const parsedResult = EquipmentImageResultSchema.safeParse(
			await readEquipmentRepositoryJson(input.workspaceRoot, paths.resultPath)
		);
		if (!parsedResult.success || parsedResult.data.status !== 'failed') {
			return {
				action: 'blocked-partial-output' as const,
				writesRequired: 0 as const,
				writesPerformed: 0 as const,
				candidateExists,
				resultExists
			};
		}
	}

	if (!candidateExists && !resultExists) {
		const failure = input.operatorConfirmedFailure;
		if (failure === undefined) {
			return {
				action: 'preserve-active-worker' as const,
				writesRequired: 0 as const,
				writesPerformed: 0 as const
			};
		}
		if (failure.targetId !== input.targetId || failure.workerId !== input.workerId) {
			throw new Error('Operator-confirmed failure must bind the exact target and worker');
		}
		if (failure.reason?.trim() === '') {
			throw new Error('Operator-confirmed failure requires an exact non-empty reason');
		}
		if (failure.acknowledged !== true) {
			throw new Error('Operator-confirmed failure requires acknowledgement');
		}
		if (
			failure.reason === undefined ||
			failure.eventId === undefined ||
			failure.operator === undefined ||
			failure.confirmedAt === undefined ||
			failure.recordedAt === undefined
		) {
			throw new Error('Operator-confirmed failure requires exact append-only evidence fields');
		}
		const appended = await recordOperatorConfirmedEquipmentRunFailure({
			workspaceRoot: input.workspaceRoot,
			runId: input.runId,
			eventId: failure.eventId,
			operator: failure.operator,
			reason: failure.reason,
			requestedAt: failure.confirmedAt,
			recordedAt: failure.recordedAt,
			targetId: input.targetId,
			workerId: input.workerId,
			lockOwnerId: `${failure.operator}-reconcile-controller`
		});
		return {
			action: 'append-operator-confirmed-failure' as const,
			writesRequired: 1 as const,
			writesPerformed: 1 as const,
			terminalStatus: 'failed' as const,
			operatorFailureReason: failure.reason,
			event: appended.event,
			eventPath: appended.eventPath
		};
	}

	const terminalEvidence = await verifyTerminalEvidence({
		workspaceRoot: input.workspaceRoot,
		targetPath: paths.targetPath,
		assignmentPath: paths.assignmentPath,
		candidatePath: paths.candidatePath,
		resultPath: paths.resultPath
	});
	const authorization = input.terminalAuthorization;
	if (authorization === undefined) {
		return {
			action: 'append-terminal-event' as const,
			writesRequired: 1 as const,
			writesPerformed: 0 as const,
			...terminalEvidence
		};
	}
	assertTerminalAuthorizationMatches(authorization, terminalEvidence);
	const appended = await recordVerifiedEquipmentRunTerminal({
		workspaceRoot: input.workspaceRoot,
		runId: input.runId,
		eventId: authorization.eventId,
		actor: authorization.actor,
		requestedAt: authorization.requestedAt,
		recordedAt: authorization.recordedAt,
		targetId: input.targetId,
		workerId: input.workerId,
		expectedEvidence: {
			terminalStatus: authorization.expectedTerminalStatus,
			resultCanonicalSha256: authorization.expectedResultCanonicalSha256
		},
		lockOwnerId: `${authorization.actor}-reconcile-controller`
	});
	return {
		action: 'append-terminal-event' as const,
		writesRequired: 1 as const,
		writesPerformed: 1 as const,
		terminalStatus: appended.terminalStatus,
		resultCanonicalSha256: appended.resultCanonicalSha256,
		event: appended.event,
		eventPath: appended.eventPath
	};
}

function appendInMemoryEvent(
	events: EquipmentRunEvent[],
	request: EquipmentRunEvent['request'],
	recordedAt: string
): void {
	const previous = events.at(-1);
	events.push(
		EquipmentRunEventSchema.parse({
			schemaVersion: 'equipment-production-event-v1',
			sequence: events.length + 1,
			previousEventCanonicalSha256: previous === undefined ? null : canonicalJsonSha256(previous),
			recordedAt,
			request
		})
	);
}

function simulationContext() {
	const manifest = buildEquipmentMaterialProductionManifest();
	const allocation = buildEquipmentMaterialAllocationPlan();
	return {
		manifest,
		allocation,
		context: {
			runId: 'material-equipment-v1-simulation',
			runPlanCanonicalSha256: '0'.repeat(64),
			maximumConcurrency: 16 as const,
			productionPriorityTargetIds: manifest.targets.map(({ targetId }) => targetId),
			initiallyReadyTargetIds: manifest.targets
				.filter(({ dependsOnTargetId }) => dependsOnTargetId === null)
				.map(({ targetId }) => targetId),
			reviewGates: allocation.reviewGates.map(({ gateId, sourceTargetId, unlocksTargetIds }) => ({
				gateId,
				sourceTargetId,
				unlocksTargetIds
			}))
		}
	};
}

export function simulateEquipmentRun(input: SimulateEquipmentRunInput) {
	if (!Number.isSafeInteger(input.availableWorkerSlots) || input.availableWorkerSlots < 0) {
		throw new Error('availableWorkerSlots must be a nonnegative safe integer');
	}
	const { manifest, allocation, context } = simulationContext();
	const firstAdmissionCount = Math.min(
		16,
		input.availableWorkerSlots,
		context.initiallyReadyTargetIds.length
	);
	const firstAdmissionTargetIds = context.initiallyReadyTargetIds.slice(0, firstAdmissionCount);

	const gateEvents: EquipmentRunEvent[] = [];
	appendInMemoryEvent(
		gateEvents,
		{
			schemaVersion: 'equipment-production-event-request-v1',
			eventId: 'simulation-run-started',
			runId: context.runId,
			requestedAt: '2026-09-02T02:00:00.000Z',
			actor: 'simulation',
			kind: 'run-started',
			epochId: 'simulation-epoch-one'
		},
		'2026-09-02T02:00:00.000Z'
	);
	for (const [index, gate] of allocation.reviewGates.entries()) {
		const suffix = String(index + 1).padStart(2, '0');
		const common = {
			schemaVersion: 'equipment-production-event-request-v1' as const,
			runId: context.runId,
			requestedAt: '2026-09-02T02:00:00.000Z',
			actor: 'simulation'
		};
		appendInMemoryEvent(
			gateEvents,
			{
				...common,
				eventId: `simulation-claim-${suffix}`,
				kind: 'job-claimed',
				epochId: 'simulation-epoch-one',
				claimId: `simulation-claim-${suffix}`,
				targetId: gate.sourceTargetId,
				workerId: `simulation-worker-${suffix}`
			},
			'2026-09-02T02:00:00.000Z'
		);
		appendInMemoryEvent(
			gateEvents,
			{
				...common,
				eventId: `simulation-start-${suffix}`,
				kind: 'worker-started',
				claimId: `simulation-claim-${suffix}`,
				targetId: gate.sourceTargetId,
				workerId: `simulation-worker-${suffix}`
			},
			'2026-09-02T02:00:00.000Z'
		);
		appendInMemoryEvent(
			gateEvents,
			{
				...common,
				eventId: `simulation-terminal-${suffix}`,
				kind: 'job-terminal',
				targetId: gate.sourceTargetId,
				workerId: `simulation-worker-${suffix}`,
				status: 'candidate',
				resultCanonicalSha256: `${suffix.padStart(64, '0')}`,
				failureKind: null
			},
			'2026-09-02T02:00:00.000Z'
		);
		appendInMemoryEvent(
			gateEvents,
			{
				...common,
				eventId: `simulation-review-${suffix}`,
				kind: 'armour-source-reviewed',
				gateId: gate.gateId,
				sourceTargetId: gate.sourceTargetId,
				decision: 'accepted',
				receiptCanonicalSha256: `${String(index + 22).padStart(64, '0')}`
			},
			'2026-09-02T02:00:00.000Z'
		);
	}
	const allAcceptedState = replayEquipmentRunJournal(context, gateEvents);
	const gatedTargetIds = new Set(
		manifest.targets
			.filter(({ dependsOnTargetId }) => dependsOnTargetId !== null)
			.map(({ targetId }) => targetId)
	);
	const unlockedPieceJobs = [...allAcceptedState.readyTargetIds].filter((targetId) =>
		gatedTargetIds.has(targetId)
	).length;

	const breakerEvents: EquipmentRunEvent[] = [];
	appendInMemoryEvent(
		breakerEvents,
		{
			schemaVersion: 'equipment-production-event-request-v1',
			eventId: 'breaker-run-started',
			runId: context.runId,
			requestedAt: '2026-09-02T03:00:00.000Z',
			actor: 'simulation',
			kind: 'run-started',
			epochId: 'breaker-epoch-one'
		},
		'2026-09-02T03:00:00.000Z'
	);
	for (const [index, targetId] of context.initiallyReadyTargetIds.slice(0, 3).entries()) {
		const suffix = String(index + 1);
		const workerId = `breaker-worker-${suffix}`;
		const claimId = `breaker-claim-${suffix}`;
		const common = {
			schemaVersion: 'equipment-production-event-request-v1' as const,
			runId: context.runId,
			requestedAt: '2026-09-02T03:00:00.000Z',
			actor: 'simulation'
		};
		appendInMemoryEvent(
			breakerEvents,
			{
				...common,
				eventId: `breaker-claim-event-${suffix}`,
				kind: 'job-claimed',
				epochId: 'breaker-epoch-one',
				claimId,
				targetId,
				workerId
			},
			'2026-09-02T03:00:00.000Z'
		);
		appendInMemoryEvent(
			breakerEvents,
			{
				...common,
				eventId: `breaker-start-${suffix}`,
				kind: 'worker-started',
				claimId,
				targetId,
				workerId
			},
			'2026-09-02T03:00:00.000Z'
		);
		appendInMemoryEvent(
			breakerEvents,
			{
				...common,
				eventId: `breaker-terminal-${suffix}`,
				kind: 'job-terminal',
				targetId,
				workerId,
				status: 'failed',
				resultCanonicalSha256: 'f'.repeat(64),
				failureKind: 'provider-throttle'
			},
			'2026-09-02T03:00:00.000Z'
		);
	}
	appendInMemoryEvent(
		breakerEvents,
		{
			schemaVersion: 'equipment-production-event-request-v1',
			eventId: 'breaker-pause',
			runId: context.runId,
			requestedAt: '2026-09-02T03:00:00.000Z',
			actor: 'simulation',
			kind: 'epoch-paused',
			epochId: 'breaker-epoch-one',
			technicalFailureCount: 3,
			reason: 'Three simulated technical failures.'
		},
		'2026-09-02T03:00:00.000Z'
	);
	const pausedState = replayEquipmentRunJournal(context, breakerEvents);
	appendInMemoryEvent(
		breakerEvents,
		{
			schemaVersion: 'equipment-production-event-request-v1',
			eventId: 'breaker-resume',
			runId: context.runId,
			requestedAt: '2026-09-02T04:00:00.000Z',
			actor: 'simulation',
			kind: 'epoch-resumed',
			previousEpochId: 'breaker-epoch-one',
			epochId: 'breaker-epoch-two',
			reason: 'Simulated backoff and operator review completed.'
		},
		'2026-09-02T04:00:00.000Z'
	);
	const resumedState = replayEquipmentRunJournal(context, breakerEvents);
	const resumedClaims = Math.min(
		16 - resumedState.activeWorkerIds.size,
		input.availableWorkerSlots,
		resumedState.readyUnclaimedTargetIds.length
	);

	return {
		schemaVersion: 'equipment-production-simulation-v1' as const,
		summary: {
			totalJobs: manifest.targets.length,
			initiallyReadyJobs: context.initiallyReadyTargetIds.length,
			gatedPieceJobs: gatedTargetIds.size,
			armourReviewGates: allocation.reviewGates.length,
			maximumConcurrency: 16,
			generatedImages: 0
		},
		firstAdmission: { targetIds: firstAdmissionTargetIds },
		allAcceptedGateSimulation: {
			acceptedGates: allAcceptedState.acceptedGateIds.size,
			unlockedPieceJobs
		},
		circuitBreakerSimulation: {
			technicalFailuresBeforePause: pausedState.technicalFailureCount,
			claimsWhilePaused: pausedState.pausedEpochId === null ? firstAdmissionCount : 0,
			resumedInLaterEpoch: resumedState.currentEpochId === 'breaker-epoch-two',
			claimsAfterResume: resumedClaims
		},
		unrelatedWorkSimulation: {
			availableWorkerSlots: input.availableWorkerSlots,
			baselineAdmission: firstAdmissionCount,
			admissionWithUnrelatedMetadata: firstAdmissionCount
		},
		sharedFilesChanged: [] as string[],
		writesPerformed: 0 as const
	};
}

export async function reportEquipmentRun(input: ReportEquipmentRunInput) {
	const paths = runPaths(input.runId);
	const [planState, activationState] = await Promise.all([
		equipmentRepositoryPathState(input.workspaceRoot, paths.planPath),
		equipmentRepositoryPathState(input.workspaceRoot, paths.activationPath)
	]);
	if (planState === 'absent' && activationState === 'absent') {
		const readiness = await reportEquipmentRunReadiness({
			workspaceRoot: input.workspaceRoot,
			runId: input.runId,
			createdAt: input.createdAt,
			checkedAt: input.generatedAt
		});
		const report = EquipmentRunReportSchema.parse({
			schemaVersion: 'equipment-production-run-report-v1',
			reportId: `${input.runId}-report`,
			runId: input.runId,
			generatedAt: input.generatedAt,
			status: readiness.status === 'ready' ? 'not-started' : 'blocked',
			summary: {
				totalJobs: 161,
				readyJobs: readiness.status === 'ready' ? 77 : 0,
				claimedJobs: 0,
				activeJobs: 0,
				terminalJobs: 0,
				acceptedArmourGates: 0,
				technicalFailuresInEpoch: 0,
				peakActiveEquipmentWorkers: 0,
				maximumConcurrency: 16
			},
			readyTargetIds:
				readiness.status === 'ready'
					? buildEquipmentMaterialProductionManifest()
							.targets.filter(({ dependsOnTargetId }) => dependsOnTargetId === null)
							.map(({ targetId }) => targetId)
					: [],
			claimedTargetIds: [],
			activeTargetIds: [],
			terminalTargetIds: [],
			blockers: readiness.blockers
		});
		return {
			...report,
			writesPerformed: 0 as const,
			activationState: 'absent' as const,
			readinessStatus: readiness.status
		};
	}
	if (planState !== 'file' || activationState !== 'file') {
		throw new Error('Equipment report found partial immutable activation evidence');
	}
	const evidence = await loadActivatedRun(input);
	const journal = evidence.journal;
	const status =
		journal.circuitBreakerPauseRequired || journal.pausedEpochId !== null
			? 'paused'
			: journal.terminalTargetIds.size === 161
				? 'completed'
				: journal.runStarted
					? 'running'
					: 'not-started';
	const blockers = journal.circuitBreakerPauseRequired
		? [
				{
					code: 'epoch-pause-required',
					message: 'The third technical failure requires the next append-only epoch pause event.'
				}
			]
		: [];
	const report = EquipmentRunReportSchema.parse({
		schemaVersion: 'equipment-production-run-report-v1',
		reportId: `${input.runId}-report`,
		runId: input.runId,
		generatedAt: input.generatedAt,
		status,
		summary: {
			totalJobs: 161,
			readyJobs: journal.readyUnclaimedTargetIds.length,
			claimedJobs: journal.claimedTargetIds.size,
			activeJobs: journal.activeTargetIds.size,
			terminalJobs: journal.terminalTargetIds.size,
			acceptedArmourGates: journal.acceptedGateIds.size,
			technicalFailuresInEpoch: journal.technicalFailureCount,
			peakActiveEquipmentWorkers: journal.peakActiveWorkerCount,
			maximumConcurrency: 16
		},
		readyTargetIds: journal.readyUnclaimedTargetIds,
		claimedTargetIds: [...journal.claimedTargetIds],
		activeTargetIds: [...journal.activeTargetIds],
		terminalTargetIds: [...journal.terminalTargetIds],
		blockers
	});
	return {
		...report,
		writesPerformed: 0 as const,
		activationState: 'valid' as const,
		readinessStatus: 'activated' as const
	};
}

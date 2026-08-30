import { z } from 'zod';

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);
const WorkerIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const TimestampSchema = z.string().datetime({ offset: true });

export const AffinityWaveFailureKindV3Schema = z.enum([
	'capacity',
	'provider-throttle',
	'timeout',
	'malformed-output',
	'other'
]);

export type AffinityWaveFailureKindV3 = z.infer<typeof AffinityWaveFailureKindV3Schema>;

const RequestBaseFields = {
	schemaVersion: z.literal('affinity-wave-event-request-v3'),
	eventId: SlugSchema,
	runId: SlugSchema,
	observedAt: TimestampSchema.optional()
} as const;

const FailedRequestFields = {
	kind: z.literal('job-failed'),
	targetId: SlugSchema,
	workerId: WorkerIdSchema.nullable(),
	failureKind: AffinityWaveFailureKindV3Schema,
	detail: z.string().trim().min(1).max(1_000)
} as const;

export const AffinityWaveEventRequestV3Schema = z.discriminatedUnion('kind', [
	z.object({ ...RequestBaseFields, kind: z.literal('wave-started') }).strict(),
	z.object({ ...RequestBaseFields, kind: z.literal('job-claimed'), targetId: SlugSchema }).strict(),
	z
		.object({
			...RequestBaseFields,
			kind: z.literal('worker-started'),
			targetId: SlugSchema,
			workerId: WorkerIdSchema
		})
		.strict(),
	z
		.object({
			...RequestBaseFields,
			kind: z.literal('job-finished'),
			targetId: SlugSchema,
			workerId: WorkerIdSchema
		})
		.strict(),
	z.object({ ...RequestBaseFields, ...FailedRequestFields }).strict(),
	z.object({ ...RequestBaseFields, kind: z.literal('wave-finished') }).strict()
]);

export type AffinityWaveEventRequestV3 = z.infer<typeof AffinityWaveEventRequestV3Schema>;

const PersistedBaseFields = {
	schemaVersion: z.literal('affinity-wave-event-v3'),
	eventId: SlugSchema,
	runId: SlugSchema,
	observedAt: TimestampSchema.optional(),
	sequence: z.number().int().nonnegative(),
	recordedAt: TimestampSchema,
	preflightCanonicalSha256: HashSchema
} as const;

export const AffinityWaveEventV3Schema = z.discriminatedUnion('kind', [
	z.object({ ...PersistedBaseFields, kind: z.literal('wave-started') }).strict(),
	z
		.object({ ...PersistedBaseFields, kind: z.literal('job-claimed'), targetId: SlugSchema })
		.strict(),
	z
		.object({
			...PersistedBaseFields,
			kind: z.literal('worker-started'),
			targetId: SlugSchema,
			workerId: WorkerIdSchema
		})
		.strict(),
	z
		.object({
			...PersistedBaseFields,
			kind: z.literal('job-finished'),
			targetId: SlugSchema,
			workerId: WorkerIdSchema
		})
		.strict(),
	z
		.object({
			...PersistedBaseFields,
			kind: z.literal('job-failed'),
			targetId: SlugSchema,
			workerId: WorkerIdSchema.nullable(),
			failureKind: AffinityWaveFailureKindV3Schema,
			detail: z.string().trim().min(1).max(1_000)
		})
		.strict(),
	z.object({ ...PersistedBaseFields, kind: z.literal('wave-finished') }).strict()
]);

export type AffinityWaveEventV3 = z.infer<typeof AffinityWaveEventV3Schema>;

export const AffinityWaveJournalContextV3Schema = z
	.object({
		runId: SlugSchema,
		preflightCanonicalSha256: HashSchema,
		targetIds: z.array(SlugSchema).min(1).max(100),
		admittedWorkerCapacity: z.number().int().positive().max(16),
		technicalFailureLimit: z.literal(3)
	})
	.strict()
	.superRefine((context, refinement) => {
		if (new Set(context.targetIds).size !== context.targetIds.length)
			refinement.addIssue({
				code: 'custom',
				path: ['targetIds'],
				message: 'Journal target IDs must be unique'
			});
	});

export type AffinityWaveJournalContextV3 = z.infer<typeof AffinityWaveJournalContextV3Schema>;

type ClaimedEvent = Extract<AffinityWaveEventV3, { kind: 'job-claimed' }>;
type StartedEvent = Extract<AffinityWaveEventV3, { kind: 'worker-started' }>;
type TerminalEvent = Extract<AffinityWaveEventV3, { kind: 'job-finished' | 'job-failed' }>;

export interface AffinityWaveJournalStateV3 {
	readonly ordered: readonly AffinityWaveEventV3[];
	readonly waveStarted: boolean;
	readonly waveFinished: boolean;
	readonly claims: ReadonlyMap<string, ClaimedEvent>;
	readonly starts: ReadonlyMap<string, StartedEvent>;
	readonly terminal: ReadonlyMap<string, TerminalEvent>;
	readonly activeTargetIds: ReadonlySet<string>;
	readonly activeWorkerIds: ReadonlySet<string>;
	readonly technicalFailureCount: number;
	readonly technicalStopTriggered: boolean;
	readonly peakActiveWorkerCount: number;
	readonly distinctStartedWorkerIds: ReadonlySet<string>;
}

const TECHNICAL_FAILURES = new Set<AffinityWaveFailureKindV3>([
	'capacity',
	'provider-throttle',
	'timeout',
	'malformed-output'
]);

function orderedAndBoundEvents(
	context: AffinityWaveJournalContextV3,
	eventInputs: readonly unknown[]
): AffinityWaveEventV3[] {
	const events = eventInputs.map((event) => AffinityWaveEventV3Schema.parse(event));
	const eventIds = events.map((event) => event.eventId);
	if (new Set(eventIds).size !== eventIds.length) throw new Error('Wave event IDs must be unique');
	const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
	for (const [index, event] of ordered.entries()) {
		if (event.sequence !== index)
			throw new Error('Wave event sequences must be unique, contiguous, and start at zero');
		if (event.runId !== context.runId) throw new Error('Wave event belongs to another run');
		if (event.preflightCanonicalSha256 !== context.preflightCanonicalSha256)
			throw new Error('Wave event preflight hash does not match the journal context');
		const previous = ordered[index - 1];
		if (previous && Date.parse(event.recordedAt) < Date.parse(previous.recordedAt))
			throw new Error('Recorder-authoritative event times must be nondecreasing');
	}
	return ordered;
}

export function replayAffinityWaveJournalV3(
	contextInput: unknown,
	eventInputs: readonly unknown[]
): AffinityWaveJournalStateV3 {
	const context = AffinityWaveJournalContextV3Schema.parse(contextInput);
	const ordered = orderedAndBoundEvents(context, eventInputs);
	const targetIds = new Set(context.targetIds);
	const claims = new Map<string, ClaimedEvent>();
	const starts = new Map<string, StartedEvent>();
	const terminal = new Map<string, TerminalEvent>();
	const activeTargetIds = new Set<string>();
	const activeWorkerIds = new Set<string>();
	const activeWorkerTargets = new Map<string, string>();
	const distinctStartedWorkerIds = new Set<string>();
	let waveStarted = false;
	let waveFinished = false;
	let technicalFailureCount = 0;
	let technicalStopTriggered = false;
	let peakActiveWorkerCount = 0;

	for (const event of ordered) {
		if (waveFinished) throw new Error('No event may occur after wave-finished');
		if (event.kind !== 'wave-started' && !waveStarted)
			throw new Error('Wave events require a preceding wave-started event');
		if (event.kind === 'wave-started') {
			if (waveStarted) throw new Error('Wave may start only once');
			waveStarted = true;
			continue;
		}
		if ('targetId' in event && !targetIds.has(event.targetId))
			throw new Error(`Event target is not in the wave: ${event.targetId}`);

		if (event.kind === 'job-claimed') {
			if (technicalStopTriggered) throw new Error('No target may be claimed after technical stop');
			if (claims.has(event.targetId) || starts.has(event.targetId) || terminal.has(event.targetId))
				throw new Error(`Target may be claimed only once: ${event.targetId}`);
			claims.set(event.targetId, event);
			continue;
		}

		if (event.kind === 'worker-started') {
			if (technicalStopTriggered) throw new Error('No worker may start after technical stop');
			if (!claims.has(event.targetId))
				throw new Error(`Worker start requires a target claim: ${event.targetId}`);
			if (starts.has(event.targetId) || terminal.has(event.targetId))
				throw new Error(`Target worker may start only once: ${event.targetId}`);
			if (activeWorkerTargets.has(event.workerId))
				throw new Error(`Worker is already active: ${event.workerId}`);
			if (activeTargetIds.size >= context.admittedWorkerCapacity)
				throw new Error('Started workers exceed admitted worker capacity');
			starts.set(event.targetId, event);
			activeTargetIds.add(event.targetId);
			activeWorkerIds.add(event.workerId);
			activeWorkerTargets.set(event.workerId, event.targetId);
			distinctStartedWorkerIds.add(event.workerId);
			peakActiveWorkerCount = Math.max(peakActiveWorkerCount, activeTargetIds.size);
			continue;
		}

		if (event.kind === 'job-finished') {
			const start = starts.get(event.targetId);
			if (!start || !activeTargetIds.has(event.targetId))
				throw new Error(`Finished target has no active worker: ${event.targetId}`);
			if (start.workerId !== event.workerId)
				throw new Error(`Finished target changed worker identity: ${event.targetId}`);
			terminal.set(event.targetId, event);
			activeTargetIds.delete(event.targetId);
			activeWorkerIds.delete(event.workerId);
			activeWorkerTargets.delete(event.workerId);
			continue;
		}

		if (event.kind === 'job-failed') {
			if (terminal.has(event.targetId))
				throw new Error(`Target has multiple terminal outcomes: ${event.targetId}`);
			const claim = claims.get(event.targetId);
			if (!claim) throw new Error(`Failed target has no claim: ${event.targetId}`);
			const start = starts.get(event.targetId);
			if (!start) {
				if (event.failureKind !== 'capacity')
					throw new Error(`Non-capacity failure requires a started worker: ${event.targetId}`);
				if (event.workerId !== null)
					throw new Error(`Pre-admission capacity failure cannot bind a worker: ${event.targetId}`);
			} else {
				if (!activeTargetIds.has(event.targetId))
					throw new Error(`Failed target worker is not active: ${event.targetId}`);
				if (event.workerId !== start.workerId)
					throw new Error(`Failed target changed worker identity: ${event.targetId}`);
				activeTargetIds.delete(event.targetId);
				activeWorkerIds.delete(start.workerId);
				activeWorkerTargets.delete(start.workerId);
			}
			terminal.set(event.targetId, event);
			if (TECHNICAL_FAILURES.has(event.failureKind)) {
				technicalFailureCount += 1;
				if (technicalFailureCount >= context.technicalFailureLimit) technicalStopTriggered = true;
			}
			continue;
		}

		if (event.kind === 'wave-finished') {
			if (activeTargetIds.size > 0)
				throw new Error('Wave cannot finish while workers remain active');
			if (!technicalStopTriggered && terminal.size !== targetIds.size)
				throw new Error('Wave finish requires every target terminal or a technical stop');
			waveFinished = true;
		}
	}

	return {
		ordered,
		waveStarted,
		waveFinished,
		claims,
		starts,
		terminal,
		activeTargetIds,
		activeWorkerIds,
		technicalFailureCount,
		technicalStopTriggered,
		peakActiveWorkerCount,
		distinctStartedWorkerIds
	};
}

export interface AffinityWaveEventV3Clock {
	now(): Date | string;
}

function clockTimestamp(clock: AffinityWaveEventV3Clock): string {
	const value = clock.now();
	const timestamp = value instanceof Date ? value.toISOString() : value;
	return TimestampSchema.parse(timestamp);
}

export function buildAffinityWaveEventV3(
	contextInput: unknown,
	priorEventInputs: readonly unknown[],
	requestInput: unknown,
	clock: AffinityWaveEventV3Clock
): AffinityWaveEventV3 {
	const context = AffinityWaveJournalContextV3Schema.parse(contextInput);
	const prior = replayAffinityWaveJournalV3(context, priorEventInputs).ordered;
	const request = AffinityWaveEventRequestV3Schema.parse(requestInput);
	const { schemaVersion: _requestSchemaVersion, ...requestFields } = request;
	const event = AffinityWaveEventV3Schema.parse({
		...requestFields,
		schemaVersion: 'affinity-wave-event-v3',
		sequence: prior.length,
		recordedAt: clockTimestamp(clock),
		preflightCanonicalSha256: context.preflightCanonicalSha256
	});
	replayAffinityWaveJournalV3(context, [...prior, event]);
	return event;
}

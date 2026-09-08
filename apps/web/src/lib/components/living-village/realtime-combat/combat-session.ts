import {
	ExplorationCombatReceiptSchema,
	ExplorationEncounterRequestSchema,
	type ExplorationCombatClaim,
	type ExplorationCombatEvent,
	type ExplorationCombatReceipt,
	type ExplorationCombatRejection,
	type ExplorationEncounterRequest
} from '@summonlab/contracts';

import { combatDeterministicId, combatRequestHash, combatValueHash } from './combat-hash';
import {
	createRealtimeCombat,
	stepRealtimeCombat,
	type RealtimeCombatState,
	type RealtimeMechanicsEvent
} from './realtime-combat';
import { RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';

const SUPPORTED_RULESET_VERSION = 'realtime-rat-combat-v1';
const CANONICAL_ACTION_BINDINGS = new Map(
	RAT_ENCOUNTER_REQUEST.contentBindings.flatMap((binding) =>
		binding.kind === 'action'
			? [[binding.contentId, { version: binding.version, contentHash: binding.contentHash }]]
			: []
	)
);

export type CombatSessionStatus =
	| 'loading'
	| 'ready'
	| 'running'
	| 'victory'
	| 'defeat'
	| 'rejected'
	| 'unavailable';

export type CombatReplayVerification =
	| Readonly<{ kind: 'pending' }>
	| Readonly<{ kind: 'verified'; receiptId: string }>
	| Readonly<{
			kind: 'mismatch';
			field:
				| 'requestHash'
				| 'traceHash'
				| 'outputStateHash'
				| 'receiptId'
				| 'rulesetVersion'
				| 'presentationBindings';
		}>;

export type CombatUnavailableState = Readonly<{
	code: 'asset-load-failed' | 'renderer-initialization-failed';
	message: string;
}>;

export type CombatClaimPolicy = Readonly<{
	readonly contentId: string;
	readonly version: string;
	readonly contentHash: string;
	readonly xpPerDefeatedEnemy: number;
	readonly practicePerAction: number;
	readonly materialByEnemyDefinitionId: Readonly<
		Record<string, Readonly<{ materialDefinitionId: string; quantity: number }>>
	>;
}>;

export type CombatSessionDependencies = Readonly<{
	claimPolicy: CombatClaimPolicy;
	fixtureRequestHash?: string;
}>;

export type CombatSessionSnapshot = Readonly<{
	status: CombatSessionStatus;
	combat: RealtimeCombatState;
	simulationTick: number;
	events: readonly ExplorationCombatEvent[];
	receipt?: ExplorationCombatReceipt;
	rejection?: ExplorationCombatRejection;
	unavailable?: CombatUnavailableState;
}>;

export type CombatSessionListener = (receipt: ExplorationCombatReceipt) => void;
export type CombatUnavailableListener = (state: CombatUnavailableState) => void;

export type CombatSessionSubscription = Readonly<{
	onComplete?: CombatSessionListener;
	onReplayVerification?: (verification: CombatReplayVerification) => void;
}>;

export interface CombatSession {
	readonly request: ExplorationEncounterRequest;
	readonly status: CombatSessionStatus;
	readonly combat: RealtimeCombatState;
	readonly receipt?: ExplorationCombatReceipt;
	readonly rejection?: ExplorationCombatRejection;
	readonly unavailable?: CombatUnavailableState;
	readonly replayVerification?: CombatReplayVerification;
	markAssetsReady(): void;
	markUnavailable(state: CombatUnavailableState): void;
	advanceFixedStep(): CombatSessionSnapshot;
	subscribe(listener: CombatSessionListener | CombatSessionSubscription): () => void;
	subscribeUnavailable(listener: CombatUnavailableListener): () => void;
}

type ValidationResult =
	| Readonly<{ request: ExplorationEncounterRequest }>
	| Readonly<{ rejection: ExplorationCombatRejection }>;

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

function immutableCopy<T>(value: T): T {
	return deepFreeze(structuredClone(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function safelyHasFixtureOnlyArt(input: unknown): boolean {
	if (!isRecord(input)) return false;
	const participants = [
		...(Array.isArray(input.party) ? input.party : []),
		...(Array.isArray(input.enemies) ? input.enemies : [])
	];
	const participantBindings = participants.flatMap((participant) => {
		if (!isRecord(participant) || !isRecord(participant.presentation)) return [];
		return [
			participant.presentation.combatAssetBinding,
			participant.presentation.motionPackBinding
		];
	});
	const battlefield = isRecord(input.battlefieldBinding) ? input.battlefieldBinding : undefined;
	const battlefieldBindings = battlefield
		? [
				battlefield.environmentAssetBinding,
				...(Array.isArray(battlefield.occluderAssetBindings)
					? battlefield.occluderAssetBindings
					: [])
			]
		: [];
	return [...participantBindings, ...battlefieldBindings].some(
		(binding) => isRecord(binding) && binding.approvalStatus === 'fixture-only'
	);
}

const REJECTED_REQUEST = deepFreeze({}) as ExplorationEncounterRequest;

function emptyCombat(): RealtimeCombatState {
	return {
		elapsedSeconds: 0,
		phase: 'defeat',
		actors: [],
		defeatedEnemies: 0,
		lastEvent: 'Combat is unavailable.'
	};
}

function createRejection(
	requestId: string | undefined,
	code: ExplorationCombatRejection['code'],
	summary: string,
	fieldPaths: string[]
): ExplorationCombatRejection {
	return {
		schemaVersion: 'exploration-combat-rejection-v1',
		...(requestId ? { requestId } : {}),
		code,
		summary,
		fieldPaths
	};
}

function fixtureOnlyArt(request: ExplorationEncounterRequest): boolean {
	const participantBindings = [...request.party, ...request.enemies].flatMap((participant) => [
		participant.presentation.combatAssetBinding,
		participant.presentation.motionPackBinding
	]);
	const battlefieldBindings = [
		request.battlefieldBinding.environmentAssetBinding,
		...request.battlefieldBinding.occluderAssetBindings
	];
	return [...participantBindings, ...battlefieldBindings].some(
		(binding) => binding.approvalStatus === 'fixture-only'
	);
}

function validateBindings(
	request: ExplorationEncounterRequest,
	claimPolicy: CombatClaimPolicy
): ExplorationCombatRejection | undefined {
	if (request.rulesetVersion !== SUPPORTED_RULESET_VERSION) {
		return createRejection(
			request.requestId,
			'unsupported-ruleset',
			`Ruleset ${request.rulesetVersion} is not supported by realtime combat.`,
			['rulesetVersion']
		);
	}
	const rulesetBindings = request.contentBindings.filter((binding) => binding.kind === 'ruleset');
	const rulesetBinding = rulesetBindings[0];
	if (
		rulesetBindings.length !== 1 ||
		!rulesetBinding ||
		rulesetBinding.contentId !== 'realtime-rat-combat' ||
		rulesetBinding.version !== request.rulesetVersion ||
		rulesetBinding.contentHash !== combatValueHash({ ruleset: SUPPORTED_RULESET_VERSION })
	) {
		return createRejection(
			request.requestId,
			'stale-content-binding',
			'The encounter must declare exactly the supported ruleset binding.',
			['contentBindings']
		);
	}
	const claimPolicyBindings = request.contentBindings.filter(
		(binding) => binding.kind === 'claim-policy'
	);
	const claimPolicyBinding = claimPolicyBindings[0];
	if (
		claimPolicyBindings.length !== 1 ||
		!claimPolicyBinding ||
		claimPolicyBinding.contentId !== claimPolicy.contentId ||
		claimPolicyBinding.version !== claimPolicy.version ||
		claimPolicyBinding.contentHash !== claimPolicy.contentHash
	) {
		return createRejection(
			request.requestId,
			'stale-content-binding',
			'The claim-policy binding does not match the supplied claim policy.',
			['contentBindings']
		);
	}
	const expectedActions = new Set(
		[...request.party, ...request.enemies].flatMap((entry) =>
			'capability' in entry ? entry.capability.actionDefinitionRefs : entry.actionDefinitionRefs
		)
	);
	const actionBindings = request.contentBindings.filter((binding) => binding.kind === 'action');
	if (
		actionBindings.length !== expectedActions.size ||
		[...expectedActions].some(
			(actionId) => {
				const expected = CANONICAL_ACTION_BINDINGS.get(actionId);
				const bindings = actionBindings.filter((binding) => binding.contentId === actionId);
				const binding = bindings[0];
				return (
					!expected ||
					bindings.length !== 1 ||
					!binding ||
					binding.version !== expected.version ||
					binding.contentHash !== expected.contentHash
				);
			}
		)
	) {
		return createRejection(
			request.requestId,
			'stale-content-binding',
			'Every declared action binding must match exactly one requested action reference.',
			['contentBindings']
		);
	}
	const expectedEnemies = new Map(
		request.enemies.map((enemy) => [
			enemy.definitionRef.enemyDefinitionId,
			{
				version: enemy.definitionRef.definitionVersion,
				contentHash: enemy.definitionRef.contentHash
			}
		])
	);
	const battlefield = request.battlefieldBinding;
	if (
		[...expectedActions].some(
			(actionId) =>
				!request.contentBindings.some(
					(binding) => binding.kind === 'action' && binding.contentId === actionId
				)
		) ||
		[...expectedEnemies.keys()].some(
			(enemyDefinitionId) =>
				!request.contentBindings.some(
					(binding) => binding.kind === 'enemy' && binding.contentId === enemyDefinitionId
				)
		) ||
		!request.contentBindings.some(
			(binding) => binding.kind === 'battlefield' && binding.contentId === battlefield.battlefieldId
		)
	) {
		return createRejection(
			request.requestId,
			'stale-content-binding',
			'Every requested action, enemy, and battlefield requires a matching content binding.',
			['contentBindings']
		);
	}
	for (const binding of request.contentBindings) {
		if (
			binding.kind === 'ruleset' ||
			binding.kind === 'claim-policy' ||
			binding.kind === 'action'
		)
			continue;
		if (
			binding.kind === 'enemy' &&
			expectedEnemies.get(binding.contentId)?.version === binding.version &&
			expectedEnemies.get(binding.contentId)?.contentHash === binding.contentHash
		)
			continue;
		if (
			binding.kind === 'battlefield' &&
			binding.contentId === battlefield.battlefieldId &&
			binding.version === battlefield.version &&
			binding.contentHash === battlefield.contentHash
		)
			continue;
		return createRejection(
			request.requestId,
			'stale-content-binding',
			'A declared content binding does not match the encounter input.',
			['contentBindings']
		);
	}
	return undefined;
}

function validateRequest(
	input: unknown,
	dependencies: CombatSessionDependencies
): ValidationResult {
	if (
		isRecord(input) &&
		input.visualStatus === 'production' &&
		safelyHasFixtureOnlyArt(input)
	) {
		return {
			rejection: createRejection(
				undefined,
				'unapproved-character-art',
				'Production encounters require approved visual bindings.',
				['visualStatus']
			)
		};
	}
	const parsed = ExplorationEncounterRequestSchema.safeParse(input);
	if (!parsed.success) {
		return {
			rejection: createRejection(
				undefined,
				'invalid-request',
				'Encounter request failed contract validation.',
				parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)
			)
		};
	}
	const request = parsed.data;
	if (combatRequestHash(request) !== request.requestHash) {
		return {
			rejection: createRejection(
				request.requestId,
				'request-hash-mismatch',
				'Encounter request hash does not match its canonical body.',
				['requestHash']
			)
		};
	}
	const bindingRejection = validateBindings(request, dependencies.claimPolicy);
	if (bindingRejection) return { rejection: bindingRejection };
	if (fixtureOnlyArt(request) && dependencies.fixtureRequestHash !== request.requestHash) {
		return {
			rejection: createRejection(
				request.requestId,
				'unapproved-character-art',
				'Fixture-only visual bindings are permitted only for the canonical fixture request.',
				['requestHash']
			)
		};
	}
	return { request };
}

function eventId(
	requestHash: string,
	sequence: number,
	simulationTick: number,
	kind: ExplorationCombatEvent['kind'],
	actorId: string,
	targetIds: readonly string[]
): string {
	return combatDeterministicId('exploration-combat-event-v1', {
		requestHash,
		sequence,
		simulationTick,
		kind,
		actorId,
		targetIds
	});
}

function toContractEvent(
	requestHash: string,
	event: RealtimeMechanicsEvent,
	simulationTick: number,
	sequence: number
): ExplorationCombatEvent {
	return {
		eventId: eventId(requestHash, sequence, simulationTick, event.kind, event.actorId, event.targetIds),
		sequence,
		simulationTick,
		kind: event.kind,
		actorId: event.actorId,
		targetIds: [...event.targetIds],
		...(event.actionId ? { actionId: event.actionId } : {}),
		healthDeltas: event.healthDeltas.map((delta) => ({ ...delta })),
		manaDeltas: event.manaDeltas.map((delta) => ({ ...delta })),
		claimSourceRefs:
			event.kind === 'action-resolved' && event.actionId
				? [event.actionId]
				: event.kind === 'unit-defeated'
					? [...event.targetIds]
					: [],
		publicSummary: event.publicSummary
	};
}

function policyDefinitionRef(policy: CombatClaimPolicy) {
	return { definitionId: policy.contentId, version: policy.version, contentHash: policy.contentHash };
}

function buildClaims(
	request: ExplorationEncounterRequest,
	policy: CombatClaimPolicy,
	events: readonly ExplorationCombatEvent[],
	defeatedEnemyIds: readonly string[],
	terminalEventId: string
): ExplorationCombatClaim[] {
	const claims: ExplorationCombatClaim[] = [];
	if (defeatedEnemyIds.length > 0) {
		for (const hero of request.party) {
			claims.push({
				claimId: combatDeterministicId('exploration-combat-claim-v1', {
					requestHash: request.requestHash,
					kind: 'progression-xp',
					heroId: hero.heroRef.heroId,
					terminalEventId
				}),
				kind: 'progression-xp',
				definitionRef: policyDefinitionRef(policy),
				quantity: defeatedEnemyIds.length * policy.xpPerDefeatedEnemy,
				sourceEventIds: [terminalEventId],
				heroId: hero.heroRef.heroId
			});
		}
	}
	const practiceEvents = new Map<string, ExplorationCombatEvent[]>();
	for (const event of events) {
		if (event.kind !== 'action-resolved' || !event.actionId) continue;
		if (!request.party.some((hero) => hero.heroRef.heroId === event.actorId)) continue;
		const key = `${event.actorId}:${event.actionId}`;
		practiceEvents.set(key, [...(practiceEvents.get(key) ?? []), event]);
	}
	for (const [key, actionEvents] of practiceEvents) {
		const [heroId, actionDefinitionId] = key.split(':');
		const sourceEventIds = actionEvents.map((event) => event.eventId);
		claims.push({
			claimId: combatDeterministicId('exploration-combat-claim-v1', {
				requestHash: request.requestHash,
				kind: 'skill-practice',
				heroId,
				actionDefinitionId,
				sourceEventIds
			}),
			kind: 'skill-practice',
			definitionRef: policyDefinitionRef(policy),
			quantity: sourceEventIds.length * policy.practicePerAction,
			sourceEventIds,
			heroId: heroId!,
			actionDefinitionId: actionDefinitionId!
		});
	}
	for (const enemyId of defeatedEnemyIds) {
		const enemy = request.enemies.find((entry) => entry.enemyInstanceId === enemyId)!;
		const material = policy.materialByEnemyDefinitionId[enemy.definitionRef.enemyDefinitionId];
		const source = events.find(
			(event) => event.kind === 'unit-defeated' && event.targetIds.includes(enemyId)
		);
		if (!material || !source) continue;
		claims.push({
			claimId: combatDeterministicId('exploration-combat-claim-v1', {
				requestHash: request.requestHash,
				kind: 'material',
				enemyId,
				sourceEventId: source.eventId
			}),
			kind: 'material',
			definitionRef: policyDefinitionRef(policy),
			quantity: material.quantity,
			sourceEventIds: [source.eventId],
			sourceEnemyInstanceId: enemyId,
			materialDefinitionId: material.materialDefinitionId
		});
	}
	return claims.sort((left, right) => left.claimId.localeCompare(right.claimId));
}

class CombatSessionImpl implements CombatSession {
	readonly request: ExplorationEncounterRequest;
	private currentStatus: CombatSessionStatus;
	private currentCombat: RealtimeCombatState;
	private readonly trace: ExplorationCombatEvent[] = [];
	private simulationTick = 0;
	private finalReceipt: ExplorationCombatReceipt | undefined;
	private finalRejection: ExplorationCombatRejection | undefined;
	private unavailableState: CombatUnavailableState | undefined;
	private listeners: CombatSessionListener[] = [];
	private unavailableListeners: CombatUnavailableListener[] = [];

	constructor(
		input: unknown,
		private readonly dependencies: CombatSessionDependencies,
		validation: ValidationResult
	) {
		this.request = 'request' in validation ? deepFreeze(validation.request) : REJECTED_REQUEST;
		this.currentStatus = 'rejection' in validation ? 'rejected' : 'loading';
		this.currentCombat = 'request' in validation ? createRealtimeCombat(validation.request) : emptyCombat();
		this.finalRejection = 'rejection' in validation ? deepFreeze(validation.rejection) : undefined;
		if ('request' in validation) this.trace.push(this.startedEvent());
	}

	get status() {
		return this.currentStatus;
	}

	get combat() {
		return immutableCopy(this.currentCombat);
	}

	get receipt() {
		return this.finalReceipt;
	}

	get rejection() {
		return this.finalRejection;
	}

	get unavailable() {
		return this.unavailableState;
	}

	markAssetsReady(): void {
		if (this.currentStatus !== 'loading') return;
		this.currentStatus = 'ready';
		this.currentStatus = 'running';
	}

	markUnavailable(state: CombatUnavailableState): void {
		if (this.currentStatus !== 'loading' && this.currentStatus !== 'ready') return;
		this.unavailableState = deepFreeze({ ...state });
		this.currentStatus = 'unavailable';
		for (const listener of [...this.unavailableListeners]) listener(this.unavailableState);
	}

	advanceFixedStep(): CombatSessionSnapshot {
		if (this.currentStatus !== 'running') return this.snapshot();
		if (this.simulationTick >= this.request.bounds.maximumSimulationTicks) {
			this.finish('defeat', 'encounter-limit-reached');
			return this.snapshot();
		}
		const stepped = stepRealtimeCombat(this.currentCombat, 1 / 60);
		if (this.trace.length + stepped.events.length > this.request.bounds.maximumTraceEvents - 1) {
			this.finish('defeat', 'encounter-limit-reached');
			return this.snapshot();
		}
		this.currentCombat = stepped.state;
		this.simulationTick += 1;
		for (const event of stepped.events) {
			this.trace.push(
				toContractEvent(this.request.requestHash, event, this.simulationTick, this.trace.length)
			);
		}
		if (this.currentCombat.phase === 'victory') this.finish('victory', 'enemies-defeated');
		if (this.currentStatus === 'running' && this.currentCombat.phase === 'defeat') {
			this.finish('defeat', 'heroes-defeated');
		}
		return this.snapshot();
	}

	subscribe(listener: CombatSessionListener | CombatSessionSubscription): () => void {
		const onComplete = typeof listener === 'function' ? listener : listener.onComplete;
		if (!onComplete) return () => {};
		this.listeners.push(onComplete);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			const index = this.listeners.indexOf(onComplete);
			if (index >= 0) this.listeners.splice(index, 1);
		};
	}

	subscribeUnavailable(listener: CombatUnavailableListener): () => void {
		this.unavailableListeners.push(listener);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			const index = this.unavailableListeners.indexOf(listener);
			if (index >= 0) this.unavailableListeners.splice(index, 1);
		};
	}

	private startedEvent(): ExplorationCombatEvent {
		const actorId = this.request.party[0]!.heroRef.heroId;
		const targetIds = this.request.enemies.map((enemy) => enemy.enemyInstanceId);
		return {
			eventId: eventId(this.request.requestHash, 0, 0, 'encounter-started', actorId, targetIds),
			sequence: 0,
			simulationTick: 0,
			kind: 'encounter-started',
			actorId,
			targetIds,
			healthDeltas: [],
			manaDeltas: [],
			claimSourceRefs: [],
			publicSummary: 'The encounter began.'
		};
	}

	private finish(
		outcome: 'victory' | 'defeat',
		cause: 'enemies-defeated' | 'heroes-defeated' | 'encounter-limit-reached'
	): void {
		if (this.currentStatus !== 'running') return;
		const actorId = this.request.party[0]!.heroRef.heroId;
		const targetIds = this.request.enemies.map((enemy) => enemy.enemyInstanceId);
		const summary =
			cause === 'enemies-defeated'
				? 'Every required enemy was defeated.'
				: cause === 'heroes-defeated'
					? 'Every hero was defeated.'
					: 'The encounter reached its configured limit.';
		const terminalEvent: ExplorationCombatEvent = {
			eventId: eventId(
				this.request.requestHash,
				this.trace.length,
				this.simulationTick,
				'encounter-ended',
				actorId,
				targetIds
			),
			sequence: this.trace.length,
			simulationTick: this.simulationTick,
			kind: 'encounter-ended',
			actorId,
			targetIds,
			healthDeltas: [],
			manaDeltas: [],
			claimSourceRefs: [],
			publicSummary: summary
		};
		this.trace.push(terminalEvent);
		this.currentCombat = { ...this.currentCombat, phase: outcome, lastEvent: summary };
		const finalHeroes = this.request.party.map((hero) => {
			const actor = this.currentCombat.actors.find((entry) => entry.id === hero.heroRef.heroId)!;
			return {
				heroId: hero.heroRef.heroId,
				health: actor.health,
				maximumHealth: actor.maximumHealth,
				mana: actor.mana,
				maximumMana: actor.maximumMana,
				combatState: actor.health === 0 ? ('defeated' as const) : ('combat-capable' as const)
			};
		});
		const finalEnemies = this.request.enemies.map((enemy) => {
			const actor = this.currentCombat.actors.find((entry) => entry.id === enemy.enemyInstanceId)!;
			return {
				enemyInstanceId: enemy.enemyInstanceId,
				health: actor.health,
				maximumHealth: actor.maximumHealth,
				mana: actor.mana,
				maximumMana: actor.maximumMana,
				combatState: actor.health === 0 ? ('defeated' as const) : ('combat-capable' as const),
				requiredForVictory: enemy.requiredForVictory
			};
		});
		const defeatedEnemyIds = finalEnemies
			.filter((enemy) => enemy.combatState === 'defeated')
			.map((enemy) => enemy.enemyInstanceId);
		const claims = buildClaims(
			this.request,
			this.dependencies.claimPolicy,
			this.trace,
			defeatedEnemyIds,
			terminalEvent.eventId
		);
		const inputStateHash = encounterInputStateHash(this.request);
		const traceHash = combatValueHash(this.trace);
		const outputStateHash = combatValueHash({
			outcome,
			finalHeroes,
			finalEnemies,
			defeatedEnemyIds,
			claims
		});
		const receiptId = combatDeterministicId('exploration-combat-receipt-v1', {
			requestHash: this.request.requestHash,
			traceHash
		});
		this.finalReceipt = deepFreeze(
			ExplorationCombatReceiptSchema.parse({
				schemaVersion: 'exploration-combat-receipt-v1',
				receiptId,
				requestId: this.request.requestId,
				idempotencyKey: this.request.idempotencyKey,
				requestHash: this.request.requestHash,
				runId: this.request.runId,
				correlationId: this.request.correlationId,
				encounterId: this.request.encounterId,
				explorationAttemptId: this.request.explorationAttemptId,
				rulesetVersion: this.request.rulesetVersion,
				contentBindings: this.request.contentBindings,
				startedAtTick: 0,
				endedAtTick: this.simulationTick,
				outcome,
				decisiveCause: { code: cause, summary, supportingEventIds: [terminalEvent.eventId] },
				finalHeroes,
				finalEnemies,
				defeatedEnemyIds,
				events: this.trace,
				claims,
				inputStateHash,
				outputStateHash,
				traceHash,
				replayRef: {
					replayVersion: 'exploration-combat-replay-v1',
					requestId: this.request.requestId,
					requestHash: this.request.requestHash,
					receiptId,
					traceHash,
					rulesetVersion: this.request.rulesetVersion,
					seed: this.request.seed,
					entropyCursor: this.request.entropyCursor,
					battlefieldBindingHash: combatValueHash(this.request.battlefieldBinding),
					participantPresentationBindingsHash: combatValueHash(
						[...this.request.party, ...this.request.enemies].map((entry) => entry.presentation)
					)
				},
				ownership: {
					explorationMutated: false,
					progressionCommitted: false,
					inventoryCommitted: false,
					lootCacheMutated: false
				}
			})
		);
		this.currentStatus = outcome;
		for (const listener of [...this.listeners]) listener(this.finalReceipt);
	}

	private snapshot(): CombatSessionSnapshot {
		return deepFreeze({
			status: this.currentStatus,
			combat: immutableCopy(this.currentCombat),
			simulationTick: this.simulationTick,
			events: immutableCopy(this.trace),
			...(this.finalReceipt ? { receipt: this.finalReceipt } : {}),
			...(this.finalRejection ? { rejection: this.finalRejection } : {}),
			...(this.unavailableState ? { unavailable: this.unavailableState } : {})
		});
	}
}

export function createCombatSession(
	input: unknown,
	dependencies: CombatSessionDependencies
): CombatSession {
	return new CombatSessionImpl(input, dependencies, validateRequest(input, dependencies));
}

export type CombatSessionEntry =
	| Readonly<{ kind: 'session'; session: CombatSession }>
	| Readonly<{ kind: 'completed'; receipt: ExplorationCombatReceipt }>
	| Readonly<{ kind: 'rejected'; rejection: ExplorationCombatRejection }>;

type RegistryEntry =
	| Readonly<{ status: 'active'; requestHash: string; session: CombatSession }>
	| Readonly<{ status: 'completed'; requestHash: string; receipt: ExplorationCombatReceipt }>
	| Readonly<{ status: 'rejected'; requestHash: string; rejection: ExplorationCombatRejection }>;

function registryRequestHash(request: ExplorationEncounterRequest): string {
	return combatRequestHash(request);
}

function registryView(entry: RegistryEntry | undefined): RegistryEntry | undefined {
	return entry ? Object.freeze({ ...entry }) : undefined;
}

export class CombatSessionRegistry {
	readonly #entries = new Map<string, RegistryEntry>();
	readonly #entryKeysByRequestId = new Map<string, string>();

	get(idempotencyKey: string): RegistryEntry | undefined {
		return registryView(this.#entries.get(idempotencyKey));
	}

	getByRequestId(requestId: string): RegistryEntry | undefined {
		const idempotencyKey = this.#entryKeysByRequestId.get(requestId);
		return idempotencyKey ? this.get(idempotencyKey) : undefined;
	}

	setActive(request: ExplorationEncounterRequest, session: CombatSession): void {
		this.#entries.set(
			request.idempotencyKey,
			Object.freeze({ status: 'active', requestHash: registryRequestHash(request), session })
		);
		this.#entryKeysByRequestId.set(request.requestId, request.idempotencyKey);
	}

	setCompleted(request: ExplorationEncounterRequest, receipt: ExplorationCombatReceipt): void {
		this.#entries.set(
			request.idempotencyKey,
			Object.freeze({
				status: 'completed',
				requestHash: registryRequestHash(request),
				receipt: deepFreeze(receipt)
			})
		);
		this.#entryKeysByRequestId.set(request.requestId, request.idempotencyKey);
	}

	setRejected(request: ExplorationEncounterRequest, rejection: ExplorationCombatRejection): void {
		this.#entries.set(
			request.idempotencyKey,
			Object.freeze({
				status: 'rejected',
				requestHash: registryRequestHash(request),
				rejection: deepFreeze(rejection)
			})
		);
		this.#entryKeysByRequestId.set(request.requestId, request.idempotencyKey);
	}

	removeUnavailable(request: ExplorationEncounterRequest, session: CombatSession): void {
		const entry = this.#entries.get(request.idempotencyKey);
		if (entry?.status === 'active' && entry.session === session) {
			this.#entries.delete(request.idempotencyKey);
			if (this.#entryKeysByRequestId.get(request.requestId) === request.idempotencyKey) {
				this.#entryKeysByRequestId.delete(request.requestId);
			}
		}
	}
}

function idempotencyConflict(request: ExplorationEncounterRequest): ExplorationCombatRejection {
	return deepFreeze(
		createRejection(
			request.requestId,
			'idempotency-conflict',
			'An encounter with this idempotency key has a different canonical request hash.',
			['idempotencyKey', 'requestHash']
		)
	);
}

export function enterCombatSession(
	input: unknown,
	dependencies: CombatSessionDependencies,
	registry: CombatSessionRegistry
): CombatSessionEntry {
	const parsed = ExplorationEncounterRequestSchema.safeParse(input);
	if (!parsed.success) {
		const validation = validateRequest(input, dependencies);
		const rejection =
			'rejection' in validation
				? validation.rejection
				: createRejection(undefined, 'invalid-request', 'Encounter request failed contract validation.', []);
		return { kind: 'rejected', rejection: deepFreeze(rejection) };
	}
	const request = parsed.data;
	const requestHash = registryRequestHash(request);
	const existing = registry.get(request.idempotencyKey) ?? registry.getByRequestId(request.requestId);
	if (existing && existing.requestHash !== requestHash) {
		return { kind: 'rejected', rejection: idempotencyConflict(request) };
	}
	const validation = validateRequest(input, dependencies);
	if (requestHash !== request.requestHash) {
		if ('rejection' in validation) {
			if (existing?.status === 'rejected') return { kind: 'rejected', rejection: existing.rejection };
			if (!existing) registry.setRejected(request, validation.rejection);
			return { kind: 'rejected', rejection: deepFreeze(validation.rejection) };
		}
		throw new Error('Request hash validation did not reject a mismatched canonical hash.');
	}
	if (existing?.status === 'active') return { kind: 'session', session: existing.session };
	if (existing?.status === 'completed') return { kind: 'completed', receipt: existing.receipt };
	if (existing?.status === 'rejected') return { kind: 'rejected', rejection: existing.rejection };
	if ('rejection' in validation) {
		registry.setRejected(request, validation.rejection);
		const stored = registry.get(request.idempotencyKey);
		if (stored?.status !== 'rejected') throw new Error('Registry rejected entry was not stored.');
		return { kind: 'rejected', rejection: stored.rejection };
	}
	const session = createCombatSession(request, dependencies);
	registry.setActive(request, session);
	session.subscribe((receipt) => registry.setCompleted(request, receipt));
	session.subscribeUnavailable(() => registry.removeUnavailable(request, session));
	return { kind: 'session', session };
}

function replayOutputStateHash(receipt: ExplorationCombatReceipt): string {
	return combatValueHash({
		outcome: receipt.outcome,
		finalHeroes: receipt.finalHeroes,
		finalEnemies: receipt.finalEnemies,
		defeatedEnemyIds: receipt.defeatedEnemyIds,
		claims: receipt.claims
	});
}

function encounterInputStateHash(request: ExplorationEncounterRequest): string {
	const { expectedExplorationStateHash, requestHash, ...inputState } = request;
	void expectedExplorationStateHash;
	void requestHash;
	return combatValueHash(inputState);
}

function replayVerificationFor(
	request: ExplorationEncounterRequest,
	receipt: ExplorationCombatReceipt
): CombatReplayVerification {
	if (
		request.requestHash !== receipt.requestHash ||
		combatRequestHash(request) !== request.requestHash ||
		receipt.inputStateHash !== encounterInputStateHash(request) ||
		receipt.replayRef.requestHash !== receipt.requestHash ||
		receipt.replayRef.requestId !== request.requestId ||
		combatValueHash(receipt.contentBindings) !== combatValueHash(request.contentBindings)
	) {
		return deepFreeze({ kind: 'mismatch', field: 'requestHash' });
	}
	if (
		receipt.rulesetVersion !== request.rulesetVersion ||
		receipt.replayRef.rulesetVersion !== receipt.rulesetVersion
	) {
		return deepFreeze({ kind: 'mismatch', field: 'rulesetVersion' });
	}
	if (
		receipt.replayRef.battlefieldBindingHash !== combatValueHash(request.battlefieldBinding) ||
		receipt.replayRef.participantPresentationBindingsHash !==
			combatValueHash([...request.party, ...request.enemies].map((entry) => entry.presentation))
	) {
		return deepFreeze({ kind: 'mismatch', field: 'presentationBindings' });
	}
	const traceHash = combatValueHash(receipt.events);
	if (receipt.traceHash !== traceHash || receipt.replayRef.traceHash !== receipt.traceHash) {
		return deepFreeze({ kind: 'mismatch', field: 'traceHash' });
	}
	if (receipt.outputStateHash !== replayOutputStateHash(receipt)) {
		return deepFreeze({ kind: 'mismatch', field: 'outputStateHash' });
	}
	const receiptId = combatDeterministicId('exploration-combat-receipt-v1', {
		requestHash: request.requestHash,
		traceHash
	});
	if (receipt.receiptId !== receiptId || receipt.replayRef.receiptId !== receipt.receiptId) {
		return deepFreeze({ kind: 'mismatch', field: 'receiptId' });
	}
	return deepFreeze({ kind: 'verified', receiptId: receipt.receiptId });
}

function replayTerminalCombat(
	combat: RealtimeCombatState,
	receipt: ExplorationCombatReceipt
): RealtimeCombatState {
	type FinalResource = Readonly<{
		health: number;
		maximumHealth: number;
		mana: number;
		maximumMana: number;
		combatState: 'defeated' | 'combat-capable';
	}>;
	const finalResources = new Map<string, FinalResource>();
	for (const hero of receipt.finalHeroes) finalResources.set(hero.heroId, hero);
	for (const enemy of receipt.finalEnemies) finalResources.set(enemy.enemyInstanceId, enemy);
	return {
		...combat,
		phase: receipt.outcome,
		defeatedEnemies: receipt.defeatedEnemyIds.length,
		lastEvent: receipt.decisiveCause.summary,
		actors: combat.actors.map((actor) => {
			const final = finalResources.get(actor.id);
			return final
				? {
						...actor,
						health: final.health,
						maximumHealth: final.maximumHealth,
						mana: final.mana,
						maximumMana: final.maximumMana,
						intent: final.combatState === 'defeated' ? 'down' : actor.intent
					}
				: actor;
		})
	};
}

class ReplayCombatSession implements CombatSession {
	readonly request: ExplorationEncounterRequest;
	private currentStatus: CombatSessionStatus = 'loading';
	private currentCombat: RealtimeCombatState;
	private readonly capturedEvents: readonly ExplorationCombatEvent[];
	private readonly trace: ExplorationCombatEvent[];
	private simulationTick = 0;
	private unavailableState: CombatUnavailableState | undefined;
	private currentVerification: CombatReplayVerification = deepFreeze({ kind: 'pending' });
	private readonly unavailableListeners: CombatUnavailableListener[] = [];
	private readonly verificationListeners: ((verification: CombatReplayVerification) => void)[] = [];
	private readonly terminalTick: number;

	constructor(request: ExplorationEncounterRequest, private readonly expectedReceipt: ExplorationCombatReceipt) {
		this.request = deepFreeze(request);
		this.currentCombat = createRealtimeCombat(this.request);
		this.capturedEvents = immutableCopy(expectedReceipt.events);
		this.trace = this.capturedEvents.filter((event) => event.simulationTick === 0);
		this.terminalTick = Number.isSafeInteger(expectedReceipt.endedAtTick)
			? Math.max(0, expectedReceipt.endedAtTick)
			: 0;
	}

	get status() {
		return this.currentStatus;
	}

	get combat() {
		return immutableCopy(this.currentCombat);
	}

	get receipt() {
		return undefined;
	}

	get rejection() {
		return undefined;
	}

	get unavailable() {
		return this.unavailableState;
	}

	get replayVerification() {
		return this.currentVerification;
	}

	markAssetsReady(): void {
		if (this.currentStatus !== 'loading') return;
		this.currentStatus = 'ready';
		this.currentStatus = 'running';
	}

	markUnavailable(state: CombatUnavailableState): void {
		if (this.currentStatus !== 'loading' && this.currentStatus !== 'ready') return;
		this.unavailableState = deepFreeze({ ...state });
		this.currentStatus = 'unavailable';
		for (const listener of [...this.unavailableListeners]) listener(this.unavailableState);
	}

	advanceFixedStep(): CombatSessionSnapshot {
		if (this.currentStatus !== 'running') return this.snapshot();
		this.simulationTick += 1;
		const capturedAtTick = this.capturedEvents.filter(
			(event) => event.simulationTick === this.simulationTick
		);
		this.trace.push(...capturedAtTick);
		if (capturedAtTick.length > 0) {
			this.currentCombat = {
				...this.currentCombat,
				elapsedSeconds: this.simulationTick / 60,
				lastEvent: capturedAtTick.at(-1)!.publicSummary
			};
		}
		if (this.simulationTick >= this.terminalTick) this.finishReplay();
		return this.snapshot();
	}

	subscribe(listener: CombatSessionListener | CombatSessionSubscription): () => void {
		if (typeof listener === 'function' || !listener.onReplayVerification) return () => {};
		this.verificationListeners.push(listener.onReplayVerification);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			const index = this.verificationListeners.indexOf(listener.onReplayVerification!);
			if (index >= 0) this.verificationListeners.splice(index, 1);
		};
	}

	subscribeUnavailable(listener: CombatUnavailableListener): () => void {
		this.unavailableListeners.push(listener);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			const index = this.unavailableListeners.indexOf(listener);
			if (index >= 0) this.unavailableListeners.splice(index, 1);
		};
	}

	private finishReplay(): void {
		if (this.currentStatus !== 'running') return;
		this.currentCombat = replayTerminalCombat(this.currentCombat, this.expectedReceipt);
		this.currentStatus = this.expectedReceipt.outcome;
		this.currentVerification = replayVerificationFor(this.request, this.expectedReceipt);
		for (const listener of [...this.verificationListeners]) listener(this.currentVerification);
	}

	private snapshot(): CombatSessionSnapshot {
		return deepFreeze({
			status: this.currentStatus,
			combat: immutableCopy(this.currentCombat),
			simulationTick: this.simulationTick,
			events: immutableCopy(this.trace),
			...(this.unavailableState ? { unavailable: this.unavailableState } : {})
		});
	}
}

export function createReplayCombatSession(
	request: ExplorationEncounterRequest,
	expectedReceipt: ExplorationCombatReceipt,
	dependencies: CombatSessionDependencies
): CombatSession {
	const validation = validateRequest(request, dependencies);
	return 'request' in validation
		? new ReplayCombatSession(validation.request, immutableCopy(expectedReceipt))
		: new CombatSessionImpl(request, dependencies, validation);
}

import {
	ExplorationCombatReceiptSchema,
	ExplorationEncounterRequestSchema,
	type ExplorationEncounterRequest
} from '@summonlab/contracts';
import { describe, expect, it, vi } from 'vitest';

import { combatRequestHash } from './combat-hash';
import {
	CombatSessionRegistry,
	createCombatSession,
	createReplayCombatSession,
	enterCombatSession,
	type CombatSession
} from './combat-session';
import { RAT_ENCOUNTER_CLAIM_POLICY, RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';

const dependencies = {
	claimPolicy: RAT_ENCOUNTER_CLAIM_POLICY,
	fixtureRequestHash: RAT_ENCOUNTER_REQUEST.requestHash
};

function withRehashedRequest(
	overrides: Partial<ExplorationEncounterRequest>
): ExplorationEncounterRequest {
	const candidate = { ...structuredClone(RAT_ENCOUNTER_REQUEST), ...overrides };
	return ExplorationEncounterRequestSchema.parse({
		...candidate,
		requestHash: combatRequestHash(candidate as ExplorationEncounterRequest)
	});
}

function withUncheckedHash(overrides: Record<string, unknown>): ExplorationEncounterRequest {
	const candidate = { ...structuredClone(RAT_ENCOUNTER_REQUEST), ...overrides };
	return {
		...candidate,
		requestHash: combatRequestHash(candidate as ExplorationEncounterRequest)
	} as ExplorationEncounterRequest;
}

function withProductionApprovals(
	overrides: Partial<ExplorationEncounterRequest>
): ExplorationEncounterRequest {
	const request = structuredClone(RAT_ENCOUNTER_REQUEST);
	return withRehashedRequest({
		...request,
		visualStatus: 'production',
		party: request.party.map((hero) => ({
			...hero,
			presentation: {
				...hero.presentation,
				combatAssetBinding: { ...hero.presentation.combatAssetBinding, approvalStatus: 'approved' },
				motionPackBinding: { ...hero.presentation.motionPackBinding, approvalStatus: 'approved' }
			}
		})),
		enemies: request.enemies.map((enemy) => ({
			...enemy,
			presentation: {
				...enemy.presentation,
				combatAssetBinding: { ...enemy.presentation.combatAssetBinding, approvalStatus: 'approved' },
				motionPackBinding: { ...enemy.presentation.motionPackBinding, approvalStatus: 'approved' }
			}
		})),
		battlefieldBinding: {
			...request.battlefieldBinding,
			environmentAssetBinding: {
				...request.battlefieldBinding.environmentAssetBinding,
				approvalStatus: 'approved'
			},
			occluderAssetBindings: request.battlefieldBinding.occluderAssetBindings.map((binding) => ({
				...binding,
				approvalStatus: 'approved'
			}))
		},
		...overrides
	});
}

function runToTerminal(session: CombatSession) {
	session.markAssetsReady();
	while (session.status === 'running') session.advanceFixedStep();
	return session.receipt;
}

function runReplayToTerminal(session: CombatSession) {
	session.markAssetsReady();
	while (session.status === 'running') session.advanceFixedStep();
	return (session as CombatSession & { replayVerification?: unknown }).replayVerification;
}

function runWithFrames(frameSeconds: readonly number[]) {
	const session = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
	session.markAssetsReady();
	let accumulator = 0;
	for (let frame = 0; session.status === 'running'; frame += 1) {
		accumulator += frameSeconds[frame % frameSeconds.length]!;
		while (accumulator >= 1 / 60 && session.status === 'running') {
			session.advanceFixedStep();
			accumulator -= 1 / 60;
		}
	}
	return session.receipt;
}

describe('combat session', () => {
	it('exposes the idempotent entry contract', async () => {
		const module = (await import('./combat-session')) as typeof import('./combat-session') & {
			CombatSessionRegistry?: unknown;
			enterCombatSession?: unknown;
		};

		expect(module.CombatSessionRegistry).toEqual(expect.any(Function));
		expect(module.enterCombatSession).toEqual(expect.any(Function));
	});

	it('exposes the replay session contract', async () => {
		const module = (await import('./combat-session')) as typeof import('./combat-session') & {
			createReplayCombatSession?: unknown;
		};

		expect(module.createReplayCombatSession).toEqual(expect.any(Function));
	});

	it('shares an active session and stores one frozen completed receipt', () => {
		const registry = new CombatSessionRegistry();
		const first = enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		const duplicate = enterCombatSession(structuredClone(RAT_ENCOUNTER_REQUEST), dependencies, registry);

		expect(first.kind).toBe('session');
		expect(duplicate.kind).toBe('session');
		if (first.kind !== 'session' || duplicate.kind !== 'session') throw new Error('expected session');
		expect(duplicate.session).toBe(first.session);

		const receipt = runToTerminal(first.session);
		const completed = enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		expect(completed).toEqual({ kind: 'completed', receipt });
		if (completed.kind !== 'completed') throw new Error('expected completed receipt');
		expect(completed.receipt).toBe(receipt);
		expect(Object.isFrozen(completed.receipt)).toBe(true);
		const record = registry.get(RAT_ENCOUNTER_REQUEST.idempotencyKey);
		expect(record).toMatchObject({ status: 'completed', requestHash: RAT_ENCOUNTER_REQUEST.requestHash });
		expect(Object.isFrozen(record)).toBe(true);
	});

	it('rejects one idempotency key with a different request hash', () => {
		const registry = new CombatSessionRegistry();
		enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		const collision = withRehashedRequest({ seed: 'different-seed' });

		expect(enterCombatSession(collision, dependencies, registry)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'idempotency-conflict' }
		});
	});

	it('rejects one request ID reused with a different canonical hash', () => {
		const registry = new CombatSessionRegistry();
		enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		const collision = withRehashedRequest({
			idempotencyKey: 'rat-study-field-test-retry',
			seed: 'different-seed'
		});

		expect(enterCombatSession(collision, dependencies, registry)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'idempotency-conflict' }
		});
	});

	it('completes the registry entry before re-entrant completion listeners run', () => {
		const registry = new CombatSessionRegistry();
		const entry = enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		if (entry.kind !== 'session') throw new Error('expected session');
		let reentrant: ReturnType<typeof enterCombatSession> | undefined;
		entry.session.subscribe(() => {
			reentrant = enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		});

		const receipt = runToTerminal(entry.session);
		expect(reentrant).toEqual({ kind: 'completed', receipt });
	});

	it('removes unavailable active sessions so their request can retry', () => {
		const registry = new CombatSessionRegistry();
		const first = enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		if (first.kind !== 'session') throw new Error('expected session');
		first.session.markUnavailable({ code: 'asset-load-failed', message: 'atlas missing' });

		const retry = enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		expect(retry.kind).toBe('session');
		if (retry.kind !== 'session') throw new Error('expected retry session');
		expect(retry.session).not.toBe(first.session);
	});

	it('stores a deterministic post-parse request rejection', () => {
		const registry = new CombatSessionRegistry();
		const invalidHash = { ...RAT_ENCOUNTER_REQUEST, requestHash: '0'.repeat(64) };
		const first = enterCombatSession(invalidHash, dependencies, registry);

		expect(first).toMatchObject({ kind: 'rejected', rejection: { code: 'request-hash-mismatch' } });
		expect(registry.get(RAT_ENCOUNTER_REQUEST.idempotencyKey)).toMatchObject({ status: 'rejected' });
		expect(enterCombatSession(invalidHash, dependencies, registry)).toEqual(first);
	});

	it('replays captured authoritative events without completion publication', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');
		const replay = createReplayCombatSession(RAT_ENCOUNTER_REQUEST, receipt, dependencies);
		const onComplete = vi.fn();
		replay.subscribe({ onComplete });

		expect(runReplayToTerminal(replay)).toEqual({ kind: 'verified', receiptId: receipt.receiptId });
		expect(onComplete).not.toHaveBeenCalled();
	});

	it.each(['traceHash', 'outputStateHash'] as const)(
		'fails replay verification closed when %s is changed',
		(field) => {
			const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
			if (!receipt) throw new Error('expected receipt');
			const tampered = { ...receipt, [field]: 'f'.repeat(64) };

			expect(runReplayToTerminal(createReplayCombatSession(RAT_ENCOUNTER_REQUEST, tampered, dependencies))).toMatchObject({
				kind: 'mismatch',
				field
			});
		}
	);

	it('fails replay verification closed when the stored input-state hash is changed', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');
		const tampered = { ...receipt, inputStateHash: 'f'.repeat(64) };

		expect(runReplayToTerminal(createReplayCombatSession(RAT_ENCOUNTER_REQUEST, tampered, dependencies))).toMatchObject({
			kind: 'mismatch',
			field: 'requestHash'
		});
	});

	it('preserves a deeply frozen request while it runs', () => {
		const before = structuredClone(RAT_ENCOUNTER_REQUEST);

		runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));

		expect(RAT_ENCOUNTER_REQUEST).toEqual(before);
	});

	it('moves explicitly from loading to ready to running and then victory', () => {
		const session = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
		expect(session.status).toBe('loading');
		session.markAssetsReady();
		expect(session.status).toBe('running');

		const receipt = runToTerminal(session);
		expect(receipt).toMatchObject({ outcome: 'victory', finalHeroes: expect.any(Array) });
		expect(receipt?.finalHeroes).toHaveLength(3);
		expect(receipt?.finalEnemies.every((enemy) => enemy.health === 0)).toBe(true);
	});

	it('produces byte-identical victory receipts from identical requests', () => {
		const first = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		const second = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));

		expect(second).toEqual(first);
	});

	it('makes terminal advancement and asset readiness idempotent', () => {
		const session = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
		const receipt = runToTerminal(session);
		const terminal = session.advanceFixedStep();
		session.markAssetsReady();

		expect(session.receipt).toBe(receipt);
		expect(terminal.receipt).toBe(receipt);
		expect(session.status).toBe('victory');
	});

	it('ends in defeat when every hero begins defeated', () => {
		const productionRequest = withProductionApprovals({});
		const request = withRehashedRequest({
			...productionRequest,
			party: productionRequest.party.map((hero) => ({
				...hero,
				resources: { ...hero.resources, health: 0 }
			}))
		});

		expect(runToTerminal(createCombatSession(request, dependencies))).toMatchObject({
			outcome: 'defeat',
			decisiveCause: { code: 'heroes-defeated' }
		});
	});

	it('reserves one event for terminal defeat at the trace limit', () => {
		const request = withProductionApprovals({
			bounds: { maximumCombatants: 8, maximumSimulationTicks: 3_600, maximumTraceEvents: 2 }
		});
		const receipt = runToTerminal(createCombatSession(request, dependencies));

		expect(receipt).toMatchObject({
			outcome: 'defeat',
			decisiveCause: { code: 'encounter-limit-reached' }
		});
		expect(receipt?.events).toHaveLength(2);
		expect(receipt?.events.at(-1)?.kind).toBe('encounter-ended');
	});

	it('ends with a terminal defeat at the simulation tick limit', () => {
		const request = withProductionApprovals({
			bounds: { maximumCombatants: 8, maximumSimulationTicks: 1, maximumTraceEvents: 2_000 }
		});

		expect(runToTerminal(createCombatSession(request, dependencies))).toMatchObject({
			outcome: 'defeat',
			endedAtTick: 1,
			decisiveCause: { code: 'encounter-limit-reached' }
		});
	});

	it('rejects a request whose recomputed hash differs', () => {
		const request = { ...structuredClone(RAT_ENCOUNTER_REQUEST), requestHash: '0'.repeat(64) };
		const session = createCombatSession(request, dependencies);

		expect(session).toMatchObject({
			status: 'rejected',
			rejection: { code: 'request-hash-mismatch' }
		});
	});

	it('rejects malformed external input without accessing its incomplete bindings', () => {
		const malformed = { requestId: 'not-a-uuid', visualStatus: 'production' };

		expect(() => createCombatSession(malformed, dependencies)).not.toThrow();
		expect(createCombatSession(malformed, dependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'invalid-request' }
		});
	});

	it('rejects unsupported ruleset and stale policy bindings before asset readiness', () => {
		const unsupported = withRehashedRequest({
			rulesetVersion: 'unsupported-combat-v1',
			contentBindings: RAT_ENCOUNTER_REQUEST.contentBindings.map((binding) =>
				binding.kind === 'ruleset' ? { ...binding, version: 'unsupported-combat-v1' } : binding
			)
		});
		const stalePolicy = withRehashedRequest({
			contentBindings: RAT_ENCOUNTER_REQUEST.contentBindings.map((binding) =>
				binding.kind === 'claim-policy' ? { ...binding, contentHash: '1'.repeat(64) } : binding
			)
		});

		expect(createCombatSession(unsupported, dependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'unsupported-ruleset' }
		});
		expect(createCombatSession(stalePolicy, dependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'stale-content-binding' }
		});
	});

	it('rejects an encounter whose declared action has no matching content binding', () => {
		const productionRequest = withProductionApprovals({});
		const missingActionBinding = withRehashedRequest({
			...productionRequest,
			contentBindings: productionRequest.contentBindings.filter(
				(binding) => !(binding.kind === 'action' && binding.contentId === 'moss-arrow-v1')
			)
		});

		expect(createCombatSession(missingActionBinding, dependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'stale-content-binding' }
		});
	});

	it('requires approved visuals for production and noncanonical fixture requests', () => {
		const production = withUncheckedHash({ visualStatus: 'production' });
		const noncanonicalFixture = withRehashedRequest({ seed: 'another-fixture-seed' });

		expect(createCombatSession(production, dependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'unapproved-character-art' }
		});
		expect(createCombatSession(noncanonicalFixture, dependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'unapproved-character-art' }
		});
	});

	it('accepts a noncanonical fixture request when every binding is approved', () => {
		const productionRequest = withProductionApprovals({});
		const approvedFixture = withRehashedRequest({
			...productionRequest,
			visualStatus: 'fixture',
			seed: 'approved-fixture-variant'
		});

		expect(createCombatSession(approvedFixture, dependencies)).toMatchObject({ status: 'loading' });
	});

	it('rejects altered and surplus ruleset or claim-policy bindings', () => {
		const productionRequest = withProductionApprovals({});
		const changedRulesetId = withRehashedRequest({
			...productionRequest,
			contentBindings: productionRequest.contentBindings.map((binding) =>
				binding.kind === 'ruleset' ? { ...binding, contentId: 'alternate-combat-rules' } : binding
			)
		});
		const changedRulesetHash = withRehashedRequest({
			...productionRequest,
			contentBindings: productionRequest.contentBindings.map((binding) =>
				binding.kind === 'ruleset' ? { ...binding, contentHash: '2'.repeat(64) } : binding
			)
		});
		const surplusRuleset = withRehashedRequest({
			...productionRequest,
			contentBindings: [
				...productionRequest.contentBindings,
				{
					kind: 'ruleset',
					contentId: 'alternate-combat-rules',
					version: 'alternate-combat-rules-v1',
					contentHash: '3'.repeat(64)
				}
			]
		});
		const surplusPolicy = withRehashedRequest({
			...productionRequest,
			contentBindings: [
				...productionRequest.contentBindings,
				{
					kind: 'claim-policy',
					contentId: 'alternate-claim-policy',
					version: 'alternate-claim-policy-v1',
					contentHash: '4'.repeat(64)
				}
			]
		});
		const surplusAction = withRehashedRequest({
			...productionRequest,
			contentBindings: [
				...productionRequest.contentBindings,
				{
					kind: 'action',
					contentId: 'saffron-strike-v1',
					version: 'saffron-strike-v1-alternate-v1',
					contentHash: '5'.repeat(64)
				}
			]
		});
		const changedActionHash = withRehashedRequest({
			...productionRequest,
			contentBindings: productionRequest.contentBindings.map((binding) =>
				binding.kind === 'action' && binding.contentId === 'moss-arrow-v1'
					? { ...binding, contentHash: '6'.repeat(64) }
					: binding
			)
		});
		const changedActionVersion = withRehashedRequest({
			...productionRequest,
			contentBindings: productionRequest.contentBindings.map((binding) =>
				binding.kind === 'action' && binding.contentId === 'moss-arrow-v1'
					? { ...binding, version: 'moss-arrow-v1-alternate-v1' }
					: binding
			)
		});

		for (const request of [
			changedRulesetId,
			changedRulesetHash,
			surplusRuleset,
			surplusPolicy,
			surplusAction,
			changedActionHash,
			changedActionVersion
		]) {
			expect(createCombatSession(request, dependencies)).toMatchObject({
				status: 'rejected',
				rejection: { code: 'stale-content-binding' }
			});
		}
	});

	it('becomes unavailable without generating a receipt', () => {
		const session = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
		session.markUnavailable({ code: 'asset-load-failed', message: 'fixture atlas missing' });
		session.markAssetsReady();

		expect(session).toMatchObject({
			status: 'unavailable',
			unavailable: { code: 'asset-load-failed' },
			receipt: undefined
		});
	});

	it('builds sorted, uncommitted claims from terminal and authoritative events', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		const claims = receipt?.claims ?? [];

		expect(claims.map((claim) => claim.claimId)).toEqual(
			[...claims].map((claim) => claim.claimId).sort()
		);
		expect(claims.filter((claim) => claim.kind === 'progression-xp')).toHaveLength(3);
		expect(claims.filter((claim) => claim.kind === 'material')).toHaveLength(5);
		expect(claims.filter((claim) => claim.kind === 'skill-practice')).not.toEqual([]);
		expect(receipt?.ownership).toEqual({
			explorationMutated: false,
			progressionCommitted: false,
			inventoryCommitted: false,
			lootCacheMutated: false
		});
	});

	it('projects final integer resources and a self-consistent receipt and replay reference', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));

		expect(receipt?.finalHeroes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ heroId: 'saffron-braid', maximumHealth: 168, combatState: 'combat-capable' })
			])
		);
		expect(receipt?.finalEnemies.every((enemy) => enemy.combatState === 'defeated')).toBe(true);
		expect(ExplorationCombatReceiptSchema.safeParse(receipt).success).toBe(true);
		expect(receipt?.replayRef).toMatchObject({
			requestId: RAT_ENCOUNTER_REQUEST.requestId,
			requestHash: RAT_ENCOUNTER_REQUEST.requestHash,
			receiptId: receipt?.receiptId,
			traceHash: receipt?.traceHash,
			rulesetVersion: RAT_ENCOUNTER_REQUEST.rulesetVersion,
			seed: RAT_ENCOUNTER_REQUEST.seed,
			entropyCursor: RAT_ENCOUNTER_REQUEST.entropyCursor
		});
	});

	it('is independent of render accumulator scheduling', () => {
		expect(runWithFrames([1 / 60])).toEqual(runWithFrames([1 / 30, 1 / 120, 1 / 120]));
	});

	it('exposes detached frozen combat and trace views that cannot affect the receipt', () => {
		const expectedReceipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		const session = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
		session.markAssetsReady();
		const combat = session.combat;
		const snapshot = session.advanceFixedStep();

		expect(Object.isFrozen(combat)).toBe(true);
		expect(Object.isFrozen(combat.actors)).toBe(true);
		expect(Object.isFrozen(snapshot)).toBe(true);
		expect(Object.isFrozen(snapshot.combat)).toBe(true);
		expect(Object.isFrozen(snapshot.events)).toBe(true);
		expect(() => {
			combat.actors[0]!.health = 0;
		}).toThrow();
		expect(() => {
			(snapshot.events as unknown as ExplorationEncounterRequest[]).shift();
		}).toThrow();
		expect(() => {
			(snapshot as unknown as { simulationTick: number }).simulationTick = 99_999;
		}).toThrow();
		expect(session.combat.actors[0]?.health).toBe(RAT_ENCOUNTER_REQUEST.party[0]?.resources.health);
		expect(session.advanceFixedStep().events[0]?.kind).toBe('encounter-started');
		expect(runToTerminal(session)).toEqual(expectedReceipt);
		expect(Object.isFrozen(session.advanceFixedStep())).toBe(true);
	});

	it('notifies each active completion subscription exactly once with a frozen receipt', () => {
		const session = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
		const listener = vi.fn();
		const unsubscribeFirst = session.subscribe(listener);
		session.subscribe(listener);
		unsubscribeFirst();

		const receipt = runToTerminal(session);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(receipt);
		expect(Object.isFrozen(receipt)).toBe(true);
	});
});

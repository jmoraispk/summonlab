import {
	ExplorationCombatReceiptSchema,
	ExplorationEncounterRequestSchema,
	type CombatMotionPackBinding,
	type ExplorationEncounterRequest
} from '@summonlab/contracts';
import { describe, expect, it, vi } from 'vitest';

import { combatDeterministicId, combatRequestHash, combatValueHash } from './combat-hash';
import {
	CombatSessionRegistry,
	createCombatSession,
	createReplayCombatSession,
	enterCombatSession,
	type CombatSession
} from './combat-session';
import { createCombatContentCatalog, type CombatContentCatalog } from './combat-content-catalog';
import { RAT_ENCOUNTER_CLAIM_POLICY, RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';

const claimPolicyBinding = RAT_ENCOUNTER_REQUEST.contentBindings.find(
	(binding) => binding.kind === 'claim-policy'
)!;

const dependencies = {
	claimPolicy: RAT_ENCOUNTER_CLAIM_POLICY,
	claimPolicyBinding,
	fixtureRequestHash: RAT_ENCOUNTER_REQUEST.requestHash
};

function requiredFixtureMotion(
	presentation: ExplorationEncounterRequest['party'][number]['presentation']
): CombatMotionPackBinding {
	if (!presentation.motionPackBinding) throw new Error('Fixture motion pack is missing');
	return presentation.motionPackBinding;
}

function trustedFixtureMotion(
	presentation: ExplorationEncounterRequest['party'][number]['presentation']
) {
	const { approvalStatus, ...binding } = requiredFixtureMotion(presentation);
	void approvalStatus;
	return binding;
}

function testOnlyRatProductionCatalog() {
	return createCombatContentCatalog({
		heroes: RAT_ENCOUNTER_REQUEST.party.map((hero) => ({
			heroId: hero.heroRef.heroId,
			characterManifestHash: hero.heroRef.characterManifestHash,
			combatAssetBinding: {
				assetKey: hero.presentation.combatAssetBinding.assetKey,
				source: hero.presentation.combatAssetBinding.source,
				contentHash: hero.presentation.combatAssetBinding.contentHash,
				approvalId: hero.presentation.combatAssetBinding.approvalId
			},
			motionPackBinding: trustedFixtureMotion(hero.presentation)
		})),
		enemies: RAT_ENCOUNTER_REQUEST.enemies
			.filter(
				(enemy, index, enemies) =>
					enemies.findIndex(
						(candidate) =>
							candidate.definitionRef.enemyDefinitionId === enemy.definitionRef.enemyDefinitionId
					) === index
			)
			.map((enemy) => ({
				definitionRef: { ...enemy.definitionRef },
				combatAssetBinding: {
					assetKey: enemy.presentation.combatAssetBinding.assetKey,
					source: enemy.presentation.combatAssetBinding.source,
					contentHash: enemy.presentation.combatAssetBinding.contentHash,
					approvalId: enemy.presentation.combatAssetBinding.approvalId
				},
				motionPackBinding: trustedFixtureMotion(enemy.presentation)
			})),
		battlefields: [
			{
				battlefieldId: RAT_ENCOUNTER_REQUEST.battlefieldBinding.battlefieldId,
				version: RAT_ENCOUNTER_REQUEST.battlefieldBinding.version,
				contentHash: RAT_ENCOUNTER_REQUEST.battlefieldBinding.contentHash,
				environmentAssetBinding: {
					assetKey: RAT_ENCOUNTER_REQUEST.battlefieldBinding.environmentAssetBinding.assetKey,
					source: RAT_ENCOUNTER_REQUEST.battlefieldBinding.environmentAssetBinding.source,
					contentHash: RAT_ENCOUNTER_REQUEST.battlefieldBinding.environmentAssetBinding.contentHash,
					approvalId: RAT_ENCOUNTER_REQUEST.battlefieldBinding.environmentAssetBinding.approvalId
				},
				occluderAssetBindings: RAT_ENCOUNTER_REQUEST.battlefieldBinding.occluderAssetBindings.map(
					(binding) => ({
						assetKey: binding.assetKey,
						source: binding.source,
						contentHash: binding.contentHash,
						approvalId: binding.approvalId
					})
				)
			}
		]
	});
}

const trustedProductionDependencies = {
	...dependencies,
	contentCatalog: testOnlyRatProductionCatalog()
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

function claimPolicyContentHash(policy: {
	contentId: string;
	version: string;
	contentHash: string;
	[key: string]: unknown;
}): string {
	const { contentId, version, contentHash, ...valueBody } = policy;
	void contentId;
	void version;
	void contentHash;
	return combatValueHash(valueBody);
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
				motionPackBinding: {
					...requiredFixtureMotion(hero.presentation),
					approvalStatus: 'approved'
				}
			}
		})),
		enemies: request.enemies.map((enemy) => ({
			...enemy,
			presentation: {
				...enemy.presentation,
				combatAssetBinding: {
					...enemy.presentation.combatAssetBinding,
					approvalStatus: 'approved'
				},
				motionPackBinding: {
					...requiredFixtureMotion(enemy.presentation),
					approvalStatus: 'approved'
				}
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
		const duplicate = enterCombatSession(
			structuredClone(RAT_ENCOUNTER_REQUEST),
			dependencies,
			registry
		);

		expect(first.kind).toBe('session');
		expect(duplicate.kind).toBe('session');
		if (first.kind !== 'session' || duplicate.kind !== 'session')
			throw new Error('expected session');
		expect(duplicate.session).toBe(first.session);

		const receipt = runToTerminal(first.session);
		const completed = enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
		expect(completed).toEqual({ kind: 'completed', receipt });
		if (completed.kind !== 'completed') throw new Error('expected completed receipt');
		expect(completed.receipt).toBe(receipt);
		expect(Object.isFrozen(completed.receipt)).toBe(true);
		const record = registry.get(RAT_ENCOUNTER_REQUEST.idempotencyKey);
		expect(record).toMatchObject({
			status: 'completed',
			requestHash: RAT_ENCOUNTER_REQUEST.requestHash
		});
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
		expect(registry.get(RAT_ENCOUNTER_REQUEST.idempotencyKey)).toMatchObject({
			status: 'rejected'
		});
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

			expect(
				runReplayToTerminal(
					createReplayCombatSession(RAT_ENCOUNTER_REQUEST, tampered, dependencies)
				)
			).toMatchObject({
				kind: 'mismatch',
				field
			});
		}
	);

	it('binds the complete decisive cause into the output hash and rejects a coherent cause tamper', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');
		const outputStateHashFor = (decisiveCause: typeof receipt.decisiveCause) =>
			combatValueHash({
				outcome: receipt.outcome,
				decisiveCause,
				finalHeroes: receipt.finalHeroes,
				finalEnemies: receipt.finalEnemies,
				defeatedEnemyIds: receipt.defeatedEnemyIds,
				claims: receipt.claims
			});
		const alteredCause = {
			...receipt.decisiveCause,
			summary: 'A forged decisive-cause summary.',
			supportingEventIds: [receipt.events[0]!.eventId]
		};
		const alteredOutputStateHash = outputStateHashFor(alteredCause);
		const forged = {
			...receipt,
			decisiveCause: alteredCause,
			outputStateHash: alteredOutputStateHash
		};

		expect(receipt.outputStateHash).toBe(outputStateHashFor(receipt.decisiveCause));
		expect(alteredOutputStateHash).not.toBe(receipt.outputStateHash);
		expect(ExplorationCombatReceiptSchema.safeParse(forged).success).toBe(true);
		expect(
			runReplayToTerminal(createReplayCombatSession(RAT_ENCOUNTER_REQUEST, forged, dependencies))
		).toMatchObject({
			kind: 'mismatch',
			field: 'traceHash'
		});
	});

	it('fails replay verification closed when the stored input-state hash is changed', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');
		const tampered = { ...receipt, inputStateHash: 'f'.repeat(64) };

		expect(
			runReplayToTerminal(createReplayCombatSession(RAT_ENCOUNTER_REQUEST, tampered, dependencies))
		).toMatchObject({
			kind: 'mismatch',
			field: 'requestHash'
		});
	});

	it('replays the same intermediate mechanics state as a live session', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');
		const live = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
		const replay = createReplayCombatSession(RAT_ENCOUNTER_REQUEST, receipt, dependencies);
		live.markAssetsReady();
		replay.markAssetsReady();

		let changed = false;
		for (let tick = 0; tick < 1_000 && live.status === 'running'; tick += 1) {
			live.advanceFixedStep();
			replay.advanceFixedStep();
			changed ||= live.combat.actors.some(
				(actor, index) =>
					actor.health !==
					[...RAT_ENCOUNTER_REQUEST.party, ...RAT_ENCOUNTER_REQUEST.enemies][index]?.resources
						.health
			);
			if (changed) break;
		}

		expect(changed).toBe(true);
		expect(replay.combat).toEqual(live.combat);
		expect(replay.replayVerification).toEqual({ kind: 'pending' });
	});

	it('fails closed against a coherent receipt for a different rerun', () => {
		const alternateRequest = withProductionApprovals({ seed: 'independent-replay-seed' });
		const alternateReceipt = runToTerminal(
			createCombatSession(alternateRequest, trustedProductionDependencies)
		);
		if (!alternateReceipt) throw new Error('expected alternate receipt');

		expect(
			runReplayToTerminal(
				createReplayCombatSession(RAT_ENCOUNTER_REQUEST, alternateReceipt, dependencies)
			)
		).toMatchObject({
			kind: 'mismatch',
			field: 'requestHash'
		});
	});

	it('rejects coordinated receipt tampering against an independently rerun candidate', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');
		const events = receipt.events.map((event, index) =>
			index === 1 ? { ...event, publicSummary: 'A forged authoritative event.' } : event
		);
		const finalHeroes = receipt.finalHeroes.map((hero) =>
			hero.heroId === 'moss-archer' ? { ...hero, mana: hero.mana - 1 } : hero
		);
		const traceHash = combatValueHash(events);
		const outputStateHash = combatValueHash({
			outcome: receipt.outcome,
			decisiveCause: receipt.decisiveCause,
			finalHeroes,
			finalEnemies: receipt.finalEnemies,
			defeatedEnemyIds: receipt.defeatedEnemyIds,
			claims: receipt.claims
		});
		const receiptId = combatDeterministicId('exploration-combat-receipt-v1', {
			requestHash: receipt.requestHash,
			traceHash
		});
		const forged = {
			...receipt,
			events,
			finalHeroes,
			traceHash,
			outputStateHash,
			receiptId,
			replayRef: { ...receipt.replayRef, traceHash, receiptId }
		};

		expect(ExplorationCombatReceiptSchema.safeParse(forged).success).toBe(true);
		expect(
			runReplayToTerminal(createReplayCombatSession(RAT_ENCOUNTER_REQUEST, forged, dependencies))
		).toMatchObject({
			kind: 'mismatch'
		});
	});

	it.each([
		[
			'request identity',
			(receipt: NonNullable<ReturnType<typeof runToTerminal>>) => ({
				...receipt,
				requestId: '00000000-0000-4000-8000-000000000001',
				replayRef: { ...receipt.replayRef, requestId: '00000000-0000-4000-8000-000000000001' }
			})
		],
		[
			'run identity',
			(receipt: NonNullable<ReturnType<typeof runToTerminal>>) => ({
				...receipt,
				runId: '00000000-0000-4000-8000-000000000002'
			})
		],
		[
			'ruleset reference',
			(receipt: NonNullable<ReturnType<typeof runToTerminal>>) => ({
				...receipt,
				rulesetVersion: 'alternate-combat-v1',
				replayRef: { ...receipt.replayRef, rulesetVersion: 'alternate-combat-v1' }
			})
		],
		[
			'presentation reference',
			(receipt: NonNullable<ReturnType<typeof runToTerminal>>) => ({
				...receipt,
				replayRef: { ...receipt.replayRef, battlefieldBindingHash: 'f'.repeat(64) }
			})
		],
		[
			'terminal tick',
			(receipt: NonNullable<ReturnType<typeof runToTerminal>>) => ({
				...receipt,
				endedAtTick: receipt.endedAtTick + 1
			})
		]
	] as const)('fails replay verification for a changed %s', (_label, tamper) => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');

		expect(
			runReplayToTerminal(
				createReplayCombatSession(RAT_ENCOUNTER_REQUEST, tamper(receipt), dependencies)
			)
		).toMatchObject({
			kind: 'mismatch'
		});
	});

	it('returns terminal replay verification for schema-invalid receipt and request inputs', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');
		const malformedReceipt = { ...receipt, receiptId: 'not-a-uuid' };
		const malformedRequest = { requestId: 'not-a-uuid' } as ExplorationEncounterRequest;

		expect(
			runReplayToTerminal(
				createReplayCombatSession(RAT_ENCOUNTER_REQUEST, malformedReceipt, dependencies)
			)
		).toMatchObject({
			kind: 'mismatch'
		});
		expect(
			runReplayToTerminal(createReplayCombatSession(malformedRequest, receipt, dependencies))
		).toMatchObject({
			kind: 'mismatch'
		});
	});

	it('notifies replay unavailable subscribers only for the unavailable transition', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		if (!receipt) throw new Error('expected receipt');
		const replay = createReplayCombatSession(RAT_ENCOUNTER_REQUEST, receipt, dependencies);
		const unavailable = vi.fn();
		replay.subscribeUnavailable(unavailable);

		replay.markUnavailable({ code: 'asset-load-failed', message: 'fixture atlas missing' });
		replay.markUnavailable({ code: 'asset-load-failed', message: 'fixture atlas missing' });

		expect(replay.status).toBe('unavailable');
		expect(unavailable).toHaveBeenCalledTimes(1);
		expect(unavailable).toHaveBeenCalledWith({
			code: 'asset-load-failed',
			message: 'fixture atlas missing'
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

		expect(
			runToTerminal(createCombatSession(request, trustedProductionDependencies))
		).toMatchObject({
			outcome: 'defeat',
			decisiveCause: { code: 'heroes-defeated' }
		});
	});

	it('reserves one event for terminal defeat at the trace limit', () => {
		const request = withProductionApprovals({
			bounds: { maximumCombatants: 8, maximumSimulationTicks: 3_600, maximumTraceEvents: 2 }
		});
		const receipt = runToTerminal(createCombatSession(request, trustedProductionDependencies));

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

		expect(
			runToTerminal(createCombatSession(request, trustedProductionDependencies))
		).toMatchObject({
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

	it('admits production content only when every binding matches a trusted catalog', () => {
		const production = withProductionApprovals({});
		const trustedDependencies = {
			...dependencies,
			contentCatalog: testOnlyRatProductionCatalog()
		};

		expect(createCombatSession(production, dependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'unapproved-character-art' }
		});
		expect(createCombatSession(production, trustedDependencies)).toMatchObject({
			status: 'loading'
		});
		const ashaToBattlefieldPng = withRehashedRequest({
			...production,
			party: production.party.map((hero, index) =>
				index === 0
					? {
							...hero,
							presentation: {
								...hero.presentation,
								combatAssetBinding: {
									...hero.presentation.combatAssetBinding,
									source: production.battlefieldBinding.environmentAssetBinding.source
								}
							}
						}
					: hero
			)
		});
		expect(createCombatSession(ashaToBattlefieldPng, trustedDependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'unapproved-character-art' }
		});

		const forged = [
			withRehashedRequest({
				...production,
				party: production.party.map((hero, index) =>
					index === 0
						? {
								...hero,
								heroRef: {
									...hero.heroRef,
									characterManifestHash: '1'.repeat(64)
								},
								presentation: {
									...hero.presentation,
									combatAssetBinding: {
										...hero.presentation.combatAssetBinding,
										assetKey: 'forged-hero-raster',
										source: production.battlefieldBinding.environmentAssetBinding.source,
										contentHash: '4'.repeat(64),
										approvalId: 'forged-hero-approval'
									},
									motionPackBinding: {
										...requiredFixtureMotion(hero.presentation),
										motionPackId: 'forged-hero-motion',
										source: '/runtime/combat/forged-hero-motion.json',
										version: requiredFixtureMotion(hero.presentation).version + 1,
										contentHash: '2'.repeat(64),
										atlasImageSource: '/runtime/combat/forged-atlas.png',
										atlasImageHash: '3'.repeat(64),
										approvalId: 'forged-motion-approval'
									}
								}
							}
						: hero
				)
			}),
			withRehashedRequest({
				...production,
				enemies: production.enemies.map((enemy, index) =>
					index === 0
						? {
								...enemy,
								presentation: {
									...enemy.presentation,
									combatAssetBinding: {
										...enemy.presentation.combatAssetBinding,
										contentHash: '4'.repeat(64),
										approvalId: 'forged-enemy-approval'
									}
								}
							}
						: enemy
				)
			}),
			withRehashedRequest({
				...production,
				battlefieldBinding: {
					...production.battlefieldBinding,
					environmentAssetBinding: {
						...production.battlefieldBinding.environmentAssetBinding,
						approvalId: 'forged-battlefield-approval'
					}
				}
			})
		];

		for (const request of forged) {
			expect(createCombatSession(request, trustedDependencies)).toMatchObject({
				status: 'rejected',
				rejection: { code: 'unapproved-character-art' }
			});
		}
	});

	it('fails closed instead of throwing when a trusted catalog is malformed at runtime', () => {
		const production = withProductionApprovals({});
		const malformedCatalog = {
			heroes: [],
			enemies: [],
			battlefields: null
		} as unknown as CombatContentCatalog;
		const malformedDependencies = { ...dependencies, contentCatalog: malformedCatalog };

		expect(() => createCombatSession(production, malformedDependencies)).not.toThrow();
		expect(createCombatSession(production, malformedDependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'stale-content-binding', fieldPaths: ['contentCatalog'] }
		});
	});

	it('rejects a noncanonical fixture request even when its bindings claim approval', () => {
		const productionRequest = withProductionApprovals({});
		const approvedFixture = withRehashedRequest({
			...productionRequest,
			visualStatus: 'fixture',
			seed: 'approved-fixture-variant'
		});

		expect(createCombatSession(approvedFixture, dependencies)).toMatchObject({
			status: 'rejected',
			rejection: { code: 'unapproved-character-art' }
		});
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

	it('snapshots immutable claim policy values before the session begins', () => {
		const expected = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
		const mutablePolicy = structuredClone(RAT_ENCOUNTER_CLAIM_POLICY) as {
			contentId: string;
			version: string;
			contentHash: string;
			xpPerDefeatedEnemy: number;
			practicePerAction: number;
			materialByEnemyDefinitionId: Record<
				string,
				{ materialDefinitionId: string; quantity: number }
			>;
		};
		const session = createCombatSession(RAT_ENCOUNTER_REQUEST, {
			...dependencies,
			claimPolicy: mutablePolicy
		});
		session.markAssetsReady();
		for (let tick = 0; tick < 24; tick += 1) session.advanceFixedStep();
		mutablePolicy.xpPerDefeatedEnemy = 91;
		mutablePolicy.practicePerAction = 17;
		mutablePolicy.materialByEnemyDefinitionId['rat-brute'].quantity = 13;

		expect(runToTerminal(session)).toEqual(expected);
	});

	it('rejects stale and self-rehashed forged claim policy values against the trusted binding', () => {
		const stalePolicy = {
			...structuredClone(RAT_ENCOUNTER_CLAIM_POLICY),
			xpPerDefeatedEnemy: 91
		};
		const rehashedPolicy = {
			...stalePolicy,
			contentHash: claimPolicyContentHash(stalePolicy)
		};
		const rehashedRequest = withProductionApprovals({
			contentBindings: RAT_ENCOUNTER_REQUEST.contentBindings.map((binding) =>
				binding.kind === 'claim-policy'
					? { ...binding, contentHash: rehashedPolicy.contentHash }
					: binding
			)
		});
		const catalogDependencies = {
			...trustedProductionDependencies,
			claimPolicy: rehashedPolicy
		};

		for (const [request, claimPolicy] of [
			[RAT_ENCOUNTER_REQUEST, stalePolicy],
			[rehashedRequest, rehashedPolicy]
		] as const) {
			expect(createCombatSession(request, { ...catalogDependencies, claimPolicy })).toMatchObject({
				status: 'rejected',
				rejection: { code: 'stale-content-binding' }
			});
		}
	});

	it('projects final integer resources and a self-consistent receipt and replay reference', () => {
		const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));

		expect(receipt?.finalHeroes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					heroId: 'saffron-braid',
					maximumHealth: 168,
					combatState: 'combat-capable'
				})
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

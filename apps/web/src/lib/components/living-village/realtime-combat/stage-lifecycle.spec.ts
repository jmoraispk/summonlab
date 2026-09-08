import {
	ExplorationEncounterRequestSchema,
	type ExplorationEncounterRequest
} from '@summonlab/contracts';
import { describe, expect, it, vi } from 'vitest';

import { combatRequestHash } from './combat-hash';
import {
	CombatSessionRegistry,
	enterCombatSession,
	type CombatReplayVerification,
	type CombatSession,
	type CombatSessionListener,
	type CombatSessionSubscription,
	type CombatUnavailableListener
} from './combat-session';
import {
	RAT_ENCOUNTER_CLAIM_POLICY,
	RAT_ENCOUNTER_CLAIM_POLICY_BINDING,
	RAT_ENCOUNTER_REQUEST
} from './rat-encounter-fixture';
import { requestAssetBindings } from './stage-asset-integrity';
import {
	advanceStageSession,
	bindStageSessionNotifications,
	createStageAssetOwner,
	routeStageEntry,
	stageSessionDependencies,
	stageAssetOwner
} from './stage-lifecycle';

function deferred<T>() {
	let resolve: (value: T) => void;
	let reject: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve: resolve!, reject: reject! };
}

function productionRequestWithConflictingAssetHashes(): ExplorationEncounterRequest {
	const request = structuredClone(RAT_ENCOUNTER_REQUEST);
	const candidate = {
		...request,
		visualStatus: 'production' as const,
		party: request.party.map((hero, index) => ({
			...hero,
			presentation: {
				...hero.presentation,
				combatAssetBinding: {
					...hero.presentation.combatAssetBinding,
					approvalStatus: 'approved' as const,
					...(index === 0
						? { source: request.battlefieldBinding.environmentAssetBinding.source }
						: {})
				},
				motionPackBinding: {
					...hero.presentation.motionPackBinding,
					approvalStatus: 'approved' as const
				}
			}
		})),
		enemies: request.enemies.map((enemy) => ({
			...enemy,
			presentation: {
				...enemy.presentation,
				combatAssetBinding: {
					...enemy.presentation.combatAssetBinding,
					approvalStatus: 'approved' as const
				},
				motionPackBinding: {
					...enemy.presentation.motionPackBinding,
					approvalStatus: 'approved' as const
				}
			}
		})),
		battlefieldBinding: {
			...request.battlefieldBinding,
			environmentAssetBinding: {
				...request.battlefieldBinding.environmentAssetBinding,
				approvalStatus: 'approved' as const
			},
			occluderAssetBindings: request.battlefieldBinding.occluderAssetBindings.map((binding) => ({
				...binding,
				approvalStatus: 'approved' as const
			}))
		}
	};

	return ExplorationEncounterRequestSchema.parse({
		...candidate,
		requestHash: combatRequestHash(candidate as ExplorationEncounterRequest)
	});
}

describe('stage asset lifecycle', () => {
	it('routes a rejected conflicting request before any presentation asset projection', async () => {
		const request = productionRequestWithConflictingAssetHashes();
		expect(request.party[0]!.presentation.combatAssetBinding.contentHash).not.toBe(
			request.battlefieldBinding.environmentAssetBinding.contentHash
		);
		expect(() => requestAssetBindings(request)).toThrow('conflicting hashes');

		const entry = enterCombatSession(
			request,
			stageSessionDependencies(RAT_ENCOUNTER_CLAIM_POLICY, RAT_ENCOUNTER_CLAIM_POLICY_BINDING),
			new CombatSessionRegistry()
		);
		expect(entry.kind).toBe('rejected');

		const onRejected = vi.fn();
		const assetLoader = vi.fn();
		const assetClaim = vi.fn();
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => unhandled.push(reason);
		process.on('unhandledRejection', onUnhandled);
		try {
			expect(() =>
				routeStageEntry(entry, {
					onComplete: vi.fn(),
					onRejected,
					project: () => {
						assetLoader();
						assetClaim();
						return requestAssetBindings(request);
					}
				})
			).not.toThrow();
			await Promise.resolve();
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}

		expect(onRejected).toHaveBeenCalledTimes(1);
		expect(assetLoader).not.toHaveBeenCalled();
		expect(assetClaim).not.toHaveBeenCalled();
		expect(unhandled).toEqual([]);
	});

	it('shares one owner across stage imports', () => {
		const loader = {
			load: async (source: string) => ({ source }),
			unload: async () => {}
		};

		expect(stageAssetOwner(loader)).toBe(stageAssetOwner(loader));
	});

	it('keeps shared sources loaded until the final overlapping claimant releases them', async () => {
		const loaded: string[] = [];
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: async (source) => {
				loaded.push(source);
				return { source };
			},
			unload: async (source) => {
				unloaded.push(source);
			}
		});

		const first = owner.claim(['/runtime/hero.png', '/runtime/hero-motion.json']);
		const second = owner.claim(['/runtime/hero.png']);
		await Promise.all([first.ready, second.ready]);

		expect(loaded).toEqual(['/runtime/hero.png', '/runtime/hero-motion.json']);
		await first.release();
		expect(unloaded).toEqual(['/runtime/hero-motion.json']);
		await second.release();
		expect(unloaded).toEqual(['/runtime/hero-motion.json', '/runtime/hero.png']);
	});

	it('releases a pending source once its load settles after unmount', async () => {
		const pending = deferred<{ source: string }>();
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: () => pending.promise,
			unload: async (source) => {
				unloaded.push(source);
			}
		});

		const claim = owner.claim(['/runtime/pending.png']);
		const released = claim.release();
		expect(unloaded).toEqual([]);
		pending.resolve({ source: '/runtime/pending.png' });
		await released;

		expect(unloaded).toEqual(['/runtime/pending.png']);
	});

	it('does not unload a pending source reclaimed before its first release settles', async () => {
		const pending = deferred<{ source: string }>();
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: () => pending.promise,
			unload: async (source) => {
				unloaded.push(source);
			}
		});

		const first = owner.claim(['/runtime/racing.png']);
		const firstRelease = first.release();
		const replacement = owner.claim(['/runtime/racing.png']);
		pending.resolve({ source: '/runtime/racing.png' });
		await Promise.all([firstRelease, replacement.ready]);

		expect(unloaded).toEqual([]);
		await replacement.release();
		expect(unloaded).toEqual(['/runtime/racing.png']);
	});

	it('restarts a released pending load when an in-flight reclaim sees its first load reject', async () => {
		const firstLoad = deferred<{ source: string }>();
		const replacementLoad = deferred<{ source: string }>();
		const unloaded: string[] = [];
		let loadAttempts = 0;
		const owner = createStageAssetOwner({
			load: () => {
				loadAttempts += 1;
				return loadAttempts === 1 ? firstLoad.promise : replacementLoad.promise;
			},
			unload: async (source) => {
				unloaded.push(source);
			}
		});

		const first = owner.claim(['/runtime/rejected-racing.png']);
		const firstReady = first.ready;
		const firstRelease = first.release();
		const replacement = owner.claim(['/runtime/rejected-racing.png']);
		firstLoad.reject(new Error('network rejected first load'));

		await expect(firstReady).rejects.toThrow('network rejected first load');
		await Promise.resolve();
		expect(loadAttempts).toBe(2);
		replacementLoad.resolve({ source: '/runtime/rejected-racing.png' });
		await expect(replacement.ready).resolves.toEqual([{ source: '/runtime/rejected-racing.png' }]);
		await expect(firstRelease).resolves.toBeUndefined();
		expect(unloaded).toEqual([]);

		await replacement.release();
		expect(unloaded).toEqual(['/runtime/rejected-racing.png']);
	});

	it('reacquires a fresh asset after a released pending load has already rejected', async () => {
		const firstLoad = deferred<{ source: string }>();
		const replacementLoad = deferred<{ source: string }>();
		const unloaded: string[] = [];
		let loadAttempts = 0;
		const owner = createStageAssetOwner({
			load: () => {
				loadAttempts += 1;
				return loadAttempts === 1 ? firstLoad.promise : replacementLoad.promise;
			},
			unload: async (source) => {
				unloaded.push(source);
			}
		});

		const first = owner.claim(['/runtime/post-release-retry.png']);
		const firstReady = first.ready;
		const released = first.release();
		firstLoad.reject(new Error('network rejected released load'));
		await expect(firstReady).rejects.toThrow('network rejected released load');
		await expect(released).resolves.toBeUndefined();

		const replacement = owner.claim(['/runtime/post-release-retry.png']);
		await Promise.resolve();
		expect(loadAttempts).toBe(2);
		replacementLoad.resolve({ source: '/runtime/post-release-retry.png' });
		await expect(replacement.ready).resolves.toEqual([
			{ source: '/runtime/post-release-retry.png' }
		]);
		await replacement.release();
		expect(unloaded).toEqual([
			'/runtime/post-release-retry.png',
			'/runtime/post-release-retry.png'
		]);
	});

	it('reloads a source reclaimed while its final unload is in flight', async () => {
		const unloadStarted = deferred<void>();
		const finishUnload = deferred<void>();
		const loaded: string[] = [];
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: async (source) => {
				loaded.push(source);
				return { source };
			},
			unload: async (source) => {
				unloaded.push(source);
				unloadStarted.resolve();
				await finishUnload.promise;
			}
		});

		const first = owner.claim(['/runtime/unloading.png']);
		await first.ready;
		const firstRelease = first.release();
		await unloadStarted.promise;
		const replacement = owner.claim(['/runtime/unloading.png']);
		finishUnload.resolve();
		await Promise.all([firstRelease, replacement.ready]);

		expect(loaded).toEqual(['/runtime/unloading.png', '/runtime/unloading.png']);
		await replacement.release();
		expect(unloaded).toEqual(['/runtime/unloading.png', '/runtime/unloading.png']);
	});

	it('reacquires a source after its final unload rejects', async () => {
		const loaded: string[] = [];
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: async (source) => {
				loaded.push(source);
				return { source };
			},
			unload: async (source) => {
				unloaded.push(source);
				if (unloaded.length === 1) throw new Error('unload failed');
			}
		});

		const first = owner.claim(['/runtime/rejected-unload.png']);
		await first.ready;
		await expect(first.release()).rejects.toThrow('unload failed');

		const replacement = owner.claim(['/runtime/rejected-unload.png']);
		await expect(replacement.ready).resolves.toEqual([{ source: '/runtime/rejected-unload.png' }]);
		expect(loaded).toEqual(['/runtime/rejected-unload.png', '/runtime/rejected-unload.png']);

		await replacement.release();
		expect(unloaded).toEqual(['/runtime/rejected-unload.png', '/runtime/rejected-unload.png']);
	});

	it('reloads a replacement when an in-flight unload rejects', async () => {
		const unloadStarted = deferred<void>();
		const rejectUnload = deferred<void>();
		const loaded: string[] = [];
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: async (source) => {
				loaded.push(source);
				return { source };
			},
			unload: async (source) => {
				unloaded.push(source);
				if (unloaded.length === 1) {
					unloadStarted.resolve();
					await rejectUnload.promise;
					throw new Error('in-flight unload failed');
				}
			}
		});

		const first = owner.claim(['/runtime/in-flight-rejected-unload.png']);
		await first.ready;
		const firstRelease = first.release();
		await unloadStarted.promise;
		const replacement = owner.claim(['/runtime/in-flight-rejected-unload.png']);
		rejectUnload.resolve();
		await expect(firstRelease).resolves.toBeUndefined();
		await expect(replacement.ready).resolves.toEqual([
			{ source: '/runtime/in-flight-rejected-unload.png' }
		]);
		expect(loaded).toEqual([
			'/runtime/in-flight-rejected-unload.png',
			'/runtime/in-flight-rejected-unload.png'
		]);

		await replacement.release();
		expect(unloaded).toEqual([
			'/runtime/in-flight-rejected-unload.png',
			'/runtime/in-flight-rejected-unload.png'
		]);
	});

	it('releases every claimed source after a partial load failure', async () => {
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: async (source) => {
				if (source === '/runtime/missing.png') throw new Error('missing');
				return { source };
			},
			unload: async (source) => {
				unloaded.push(source);
			}
		});

		const claim = owner.claim(['/runtime/ready.png', '/runtime/missing.png']);
		await expect(claim.ready).rejects.toThrow('missing');

		expect(unloaded).toEqual(['/runtime/ready.png', '/runtime/missing.png']);
	});

	it('rejects promptly when a sibling source remains pending after a load failure', async () => {
		const missing = deferred<unknown>();
		const pending = deferred<{ source: string }>();
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: (source) => (source === '/runtime/missing.png' ? missing.promise : pending.promise),
			unload: async (source) => {
				unloaded.push(source);
			}
		});

		const failedClaim = owner.claim(['/runtime/missing.png', '/runtime/pending.png']);
		await Promise.resolve();
		missing.reject(new Error('missing'));
		await expect(failedClaim.ready).rejects.toThrow('missing');

		const replacement = owner.claim(['/runtime/pending.png']);
		pending.resolve({ source: '/runtime/pending.png' });
		await replacement.ready;
		expect(unloaded).toEqual(['/runtime/missing.png']);

		await replacement.release();
		expect(unloaded).toEqual(['/runtime/missing.png', '/runtime/pending.png']);
	});

	it('makes duplicate sources and repeated release idempotent', async () => {
		const loaded: string[] = [];
		const unloaded: string[] = [];
		const owner = createStageAssetOwner({
			load: async (source) => {
				loaded.push(source);
				return { source };
			},
			unload: async (source) => {
				unloaded.push(source);
			}
		});

		const claim = owner.claim(['/runtime/duplicate.png', '/runtime/duplicate.png']);
		await claim.ready;
		await Promise.all([claim.release(), claim.release()]);

		expect(loaded).toEqual(['/runtime/duplicate.png']);
		expect(unloaded).toEqual(['/runtime/duplicate.png']);
	});
});

describe('stage session dependencies', () => {
	it('admits only the canonical fixture hash into a loading fixture session', () => {
		const accepted = enterCombatSession(
			RAT_ENCOUNTER_REQUEST,
			stageSessionDependencies(
				RAT_ENCOUNTER_CLAIM_POLICY,
				RAT_ENCOUNTER_CLAIM_POLICY_BINDING,
				RAT_ENCOUNTER_REQUEST.requestHash
			),
			new CombatSessionRegistry()
		);
		expect(accepted.kind).toBe('session');
		if (accepted.kind === 'session') expect(accepted.session.status).toBe('loading');

		for (const fixtureRequestHash of [undefined, 'incorrect-fixture-hash']) {
			const rejected = enterCombatSession(
				RAT_ENCOUNTER_REQUEST,
				stageSessionDependencies(
					RAT_ENCOUNTER_CLAIM_POLICY,
					RAT_ENCOUNTER_CLAIM_POLICY_BINDING,
					fixtureRequestHash
				),
				new CombatSessionRegistry()
			);
			expect(rejected.kind).toBe('rejected');
		}
	});
});

describe('stage session lifecycle', () => {
	it('does not advance fixed simulation steps while paused', () => {
		let steps = 0;
		const session = {
			status: 'running' as const,
			combat: { elapsedSeconds: 0 },
			advanceFixedStep: () => {
				steps += 1;
			}
		};

		const result = advanceStageSession(session, true, 1 / 30, 0.1);

		expect(steps).toBe(0);
		expect(result.accumulator).toBe(1 / 30);
	});

	it('advances a running session in 60 Hz fixed steps', () => {
		let steps = 0;
		const session = {
			status: 'running' as const,
			combat: { elapsedSeconds: 0 },
			advanceFixedStep: () => {
				steps += 1;
			}
		};

		const result = advanceStageSession(session, false, 0, 1 / 30);

		expect(steps).toBe(2);
		expect(result.accumulator).toBe(0);
	});

	it('reports only live completion or replay verification, each once', () => {
		const live = createNotificationSession();
		const completed: string[] = [];
		const verified: string[] = [];
		const unavailable: string[] = [];
		const releaseLive = bindStageSessionNotifications(live.session, false, {
			onComplete: (receipt) => completed.push(receipt.receiptId),
			onReplayVerified: (verification) => verified.push(verification.kind),
			onUnavailable: (state) => unavailable.push(state.code)
		});
		live.complete({ receiptId: 'live-receipt' });
		live.complete({ receiptId: 'live-receipt' });
		live.unavailable();
		live.unavailable();
		releaseLive();

		const replay = createNotificationSession({ kind: 'pending' });
		const releaseReplay = bindStageSessionNotifications(replay.session, true, {
			onComplete: (receipt) => completed.push(receipt.receiptId),
			onReplayVerified: (verification) => verified.push(verification.kind),
			onUnavailable: () => {}
		});
		replay.verify({ kind: 'pending' });
		replay.verify({ kind: 'verified', receiptId: 'replay-receipt' });
		replay.verify({ kind: 'verified', receiptId: 'replay-receipt' });
		releaseReplay();

		expect(completed).toEqual(['live-receipt']);
		expect(verified).toEqual(['verified']);
		expect(unavailable).toEqual(['asset-load-failed']);
	});
});

function createNotificationSession(initialVerification?: CombatReplayVerification) {
	let completionListener: CombatSessionListener | undefined;
	let replayListener: CombatSessionSubscription['onReplayVerification'];
	let unavailableListener: CombatUnavailableListener | undefined;
	const session: Pick<CombatSession, 'subscribe' | 'subscribeUnavailable' | 'replayVerification'> =
		{
			replayVerification: initialVerification,
			subscribe: (listener) => {
				if (typeof listener === 'function') completionListener = listener;
				else replayListener = listener.onReplayVerification;
				return () => {
					completionListener = undefined;
					replayListener = undefined;
				};
			},
			subscribeUnavailable: (listener) => {
				unavailableListener = listener;
				return () => (unavailableListener = undefined);
			}
		};
	return {
		session,
		complete: (receipt: { receiptId: string }) =>
			completionListener?.(receipt as NonNullable<CombatSession['receipt']>),
		verify: (verification: CombatReplayVerification) => replayListener?.(verification),
		unavailable: () =>
			unavailableListener?.({
				code: 'asset-load-failed',
				message: 'test unavailable'
			})
	};
}

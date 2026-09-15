import type {
	CombatClaimPolicy,
	CombatReplayVerification,
	CombatSession,
	CombatSessionDependencies,
	CombatClaimPolicyBinding,
	CombatSessionEntry,
	CombatUnavailableState
} from './combat-session';
import type { CombatContentCatalog } from './combat-content-catalog';

export type StageAssetBinding = Readonly<{
	source: string;
	contentHash: string;
}>;

type StageAssetSource = string | StageAssetBinding;

export type StageAssetLoader = Readonly<{
	load: (source: string, binding?: StageAssetBinding) => Promise<unknown>;
	unload: (source: string, binding?: StageAssetBinding) => Promise<void> | void;
}>;

export type StageAssetClaim = Readonly<{
	ready: Promise<readonly unknown[]>;
	release: () => Promise<void>;
}>;

type AssetEntry = {
	source: string;
	binding?: StageAssetBinding;
	claimCount: number;
	ready: Promise<unknown>;
	releasePromise?: Promise<void>;
};

type ClaimedSource = Readonly<{
	key: string;
	source: string;
	binding?: StageAssetBinding;
}>;

function uniqueSources(sources: readonly StageAssetSource[]): readonly ClaimedSource[] {
	const claimed = new Map<string, ClaimedSource>();
	for (const source of sources) {
		if (typeof source === 'string') {
			claimed.set(source, { key: source, source });
			continue;
		}
		const binding = source;
		const key = `${binding.source}\u0000${binding.contentHash}`;
		claimed.set(key, { key, source: binding.source, binding });
	}
	return [...claimed.values()];
}

export function createStageAssetOwner(loader: StageAssetLoader) {
	const entries = new Map<string, AssetEntry>();

	const releaseEntry = (key: string, entry: AssetEntry): Promise<void> => {
		if (entry.claimCount === 0) return entry.releasePromise ?? Promise.resolve();
		entry.claimCount -= 1;
		if (entry.claimCount > 0) return Promise.resolve();
		if (entry.releasePromise) return entry.releasePromise;

		const reload = () => {
			const reloaded = Promise.resolve().then(() => loader.load(entry.source, entry.binding));
			entry.ready = reloaded;
			return reloaded;
		};
		const readyBeforeRelease = entry.ready;
		const settleAfterReady = async (loadedAsset: unknown) => {
			if (entry.claimCount !== 0) return loadedAsset;
			try {
				await loader.unload(entry.source, entry.binding);
			} catch (error) {
				if (entry.claimCount !== 0) return reload();
				if (entries.get(key) === entry) entries.delete(key);
				throw error;
			}
			if (entry.claimCount !== 0) return reload();
			if (entries.get(key) === entry) entries.delete(key);
		};
		const settledReady = readyBeforeRelease.then(
			(loadedAsset) => settleAfterReady(loadedAsset),
			async () => {
				if (entry.claimCount !== 0) return reload();
				return settleAfterReady(undefined);
			}
		);
		entry.ready = settledReady;
		void settledReady.catch(() => undefined);
		const releasePromise = settledReady.then(() => undefined);
		entry.releasePromise = releasePromise;
		void releasePromise.then(
			() => {
				if (entry.releasePromise === releasePromise) entry.releasePromise = undefined;
			},
			() => {
				if (entry.releasePromise === releasePromise) entry.releasePromise = undefined;
			}
		);
		return releasePromise;
	};

	return {
		claim(sources: readonly StageAssetSource[]): StageAssetClaim {
			const claimedSources = uniqueSources(sources);
			const claimedEntries = claimedSources.map(({ key, source, binding }) => {
				const existing = entries.get(key);
				if (existing) {
					existing.claimCount += 1;
					return [key, existing] as const;
				}
				const entry: AssetEntry = {
					source,
					binding,
					claimCount: 1,
					ready: Promise.resolve().then(() => loader.load(source, binding))
				};
				entries.set(key, entry);
				return [key, entry] as const;
			});

			let releasePromise: Promise<void> | undefined;
			const release = () => {
				if (!releasePromise) {
					releasePromise = Promise.all(
						claimedEntries.map(([key, entry]) => releaseEntry(key, entry))
					).then(() => undefined);
				}
				return releasePromise;
			};
			const ready = Promise.all(claimedEntries.map(([, entry]) => entry.ready)).catch((error) => {
				void release().catch(() => undefined);
				throw error;
			});

			return { ready, release };
		}
	};
}

let sharedStageAssetOwner: ReturnType<typeof createStageAssetOwner> | undefined;

export function stageAssetOwner(loader: StageAssetLoader) {
	sharedStageAssetOwner ??= createStageAssetOwner(loader);
	return sharedStageAssetOwner;
}

export function stageSessionDependencies(
	claimPolicy: CombatClaimPolicy,
	claimPolicyBinding: CombatClaimPolicyBinding,
	fixtureRequestHash?: string,
	contentCatalog?: CombatContentCatalog
): CombatSessionDependencies {
	return {
		claimPolicy,
		claimPolicyBinding,
		...(fixtureRequestHash === undefined ? {} : { fixtureRequestHash }),
		...(contentCatalog === undefined ? {} : { contentCatalog })
	};
}

export type StageEntryCallbacks = Readonly<{
	onComplete: (receipt: NonNullable<CombatSession['receipt']>) => void;
	onRejected: (rejection: Extract<CombatSessionEntry, { kind: 'rejected' }>['rejection']) => void;
}>;

export type RoutedStageEntry<TPresentation> = Readonly<{
	session: CombatSession;
	presentation: TPresentation;
}>;

/**
 * Delivers terminal entry notifications before allowing any presentation work to
 * inspect request-owned asset declarations. A rejected request is intentionally
 * never projected into stage assets.
 */
export function routeStageEntry<TPresentation>(
	entry: CombatSessionEntry,
	callbacks: StageEntryCallbacks & Readonly<{ project: (session: CombatSession) => TPresentation }>
): RoutedStageEntry<TPresentation> | undefined {
	if (entry.kind === 'completed') {
		callbacks.onComplete(entry.receipt);
		return undefined;
	}
	if (entry.kind === 'rejected') {
		callbacks.onRejected(entry.rejection);
		return undefined;
	}
	return { session: entry.session, presentation: callbacks.project(entry.session) };
}

export type StageStepSession<TCombat> = Readonly<{
	status: string;
	combat: TCombat;
	advanceFixedStep: () => unknown;
}>;

export function advanceStageSession<TCombat>(
	session: StageStepSession<TCombat>,
	paused: boolean,
	accumulator: number,
	frameSeconds: number
): Readonly<{ accumulator: number; combat: TCombat }> {
	let nextAccumulator = accumulator;
	if (!paused && session.status === 'running') {
		nextAccumulator += frameSeconds;
		while (nextAccumulator >= 1 / 60 && session.status === 'running') {
			session.advanceFixedStep();
			nextAccumulator -= 1 / 60;
		}
	}
	return { accumulator: nextAccumulator, combat: session.combat };
}

export type StageSessionCallbacks = Readonly<{
	onComplete: (receipt: NonNullable<CombatSession['receipt']>) => void;
	onUnavailable: (state: CombatUnavailableState) => void;
	onReplayVerified: (verification: CombatReplayVerification) => void;
}>;

export function bindStageSessionNotifications(
	session: Pick<CombatSession, 'subscribe' | 'subscribeUnavailable' | 'replayVerification'>,
	replay: boolean,
	callbacks: StageSessionCallbacks
): () => void {
	let completeReported = false;
	let unavailableReported = false;
	let verificationReported = false;
	const reportVerification = (verification: CombatReplayVerification) => {
		if (verificationReported || verification.kind === 'pending') return;
		verificationReported = true;
		callbacks.onReplayVerified(verification);
	};
	const unsubscribe = replay
		? session.subscribe({ onReplayVerification: reportVerification })
		: session.subscribe((receipt) => {
				if (completeReported) return;
				completeReported = true;
				callbacks.onComplete(receipt);
			});
	const unsubscribeUnavailable = session.subscribeUnavailable((state) => {
		if (unavailableReported) return;
		unavailableReported = true;
		callbacks.onUnavailable(state);
	});
	if (replay && session.replayVerification) reportVerification(session.replayVerification);

	let released = false;
	return () => {
		if (released) return;
		released = true;
		unsubscribe();
		unsubscribeUnavailable();
	};
}

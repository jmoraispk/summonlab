import type {
	CombatReplayVerification,
	CombatSession,
	CombatUnavailableState
} from './combat-session';

export type StageAssetLoader = Readonly<{
	load: (source: string) => Promise<unknown>;
	unload: (source: string) => Promise<void> | void;
}>;

export type StageAssetClaim = Readonly<{
	ready: Promise<readonly unknown[]>;
	release: () => Promise<void>;
}>;

type AssetEntry = {
	claimCount: number;
	ready: Promise<unknown>;
	releasePromise?: Promise<void>;
};

function uniqueSources(sources: readonly string[]): readonly string[] {
	return [...new Set(sources)];
}

export function createStageAssetOwner(loader: StageAssetLoader) {
	const entries = new Map<string, AssetEntry>();

	const releaseEntry = (source: string, entry: AssetEntry): Promise<void> => {
		if (entry.claimCount === 0) return entry.releasePromise ?? Promise.resolve();
		entry.claimCount -= 1;
		if (entry.claimCount > 0) return Promise.resolve();
		if (entry.releasePromise) return entry.releasePromise;

		const reload = () => {
			const reloaded = Promise.resolve().then(() => loader.load(source));
			entry.ready = reloaded;
			return reloaded;
		};
		const readyBeforeRelease = entry.ready;
		const settledReady = readyBeforeRelease
			.catch(() => undefined)
			.then(async (loadedAsset) => {
				if (entry.claimCount !== 0) return loadedAsset;
				try {
					await loader.unload(source);
				} catch (error) {
					if (entry.claimCount !== 0) return reload();
					if (entries.get(source) === entry) entries.delete(source);
					throw error;
				}
				if (entry.claimCount !== 0) return reload();
				if (entries.get(source) === entry) entries.delete(source);
			});
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
		claim(sources: readonly string[]): StageAssetClaim {
			const claimedSources = uniqueSources(sources);
			const claimedEntries = claimedSources.map((source) => {
				const existing = entries.get(source);
				if (existing) {
					existing.claimCount += 1;
					return [source, existing] as const;
				}
				const entry: AssetEntry = {
					claimCount: 1,
					ready: Promise.resolve().then(() => loader.load(source))
				};
				entries.set(source, entry);
				return [source, entry] as const;
			});

			let releasePromise: Promise<void> | undefined;
			const release = () => {
				if (!releasePromise) {
					releasePromise = Promise.all(
						claimedEntries.map(([source, entry]) => releaseEntry(source, entry))
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

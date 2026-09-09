export type DecodedStageAssetOwnerOptions<TSheet> = Readonly<{
	destroySheet: (sheet: TSheet) => void;
	unloadObjectUrl: (objectUrl: string) => Promise<void> | void;
	revokeObjectUrl: (objectUrl: string) => void;
}>;

export type DecodedStageAssetOwner<TSheet> = Readonly<{
	retainObjectUrl: (objectUrl: string) => boolean;
	settleObjectUrl: (objectUrl: string) => Promise<boolean>;
	retainSheet: (sheet: TSheet) => boolean;
	release: () => Promise<void>;
	readonly released: boolean;
	readonly retainedCounts: Readonly<{ objectUrls: number; sheets: number }>;
}>;

/**
 * Owns decoded Pixi-stage resources across parallel loads. Once release begins,
 * late completions are disposed rather than retained by the stage closure.
 */
export function createDecodedStageAssetOwner<TSheet>(
	options: DecodedStageAssetOwnerOptions<TSheet>
): DecodedStageAssetOwner<TSheet> {
	const objectUrls = new Set<string>();
	const sheets = new Set<TSheet>();
	const destroyedSheets = new Set<TSheet>();
	const unloadedObjectUrls = new Set<string>();
	const revokedObjectUrls = new Set<string>();
	let released = false;
	let releasePromise: Promise<void> | undefined;

	const destroySheet = (sheet: TSheet) => {
		if (destroyedSheets.has(sheet)) return;
		destroyedSheets.add(sheet);
		try {
			options.destroySheet(sheet);
		} catch {
			// A local cleanup failure must not make the stage's teardown reject.
		}
	};

	const disposeObjectUrl = async (objectUrl: string, forceUnload = false) => {
		if (forceUnload || !unloadedObjectUrls.has(objectUrl)) {
			unloadedObjectUrls.add(objectUrl);
			try {
				await options.unloadObjectUrl(objectUrl);
			} catch {
				// A failed Pixi unload still permits object URL reclamation and retry.
			}
		}
		if (revokedObjectUrls.has(objectUrl)) return;
		revokedObjectUrls.add(objectUrl);
		try {
			options.revokeObjectUrl(objectUrl);
		} catch {
			// URL revocation is best-effort and must never leak a teardown rejection.
		}
	};

	return {
		retainObjectUrl(objectUrl) {
			if (released) {
				void disposeObjectUrl(objectUrl, true).catch(() => undefined);
				return false;
			}
			objectUrls.add(objectUrl);
			return true;
		},
		async settleObjectUrl(objectUrl) {
			if (!released) return true;
			// Assets.load may finish after its first unload and repopulate Pixi's cache.
			await disposeObjectUrl(objectUrl, true);
			return false;
		},
		retainSheet(sheet) {
			if (released) {
				destroySheet(sheet);
				return false;
			}
			sheets.add(sheet);
			return true;
		},
		release() {
			if (releasePromise) return releasePromise;
			released = true;
			const ownedSheets = [...sheets];
			const ownedObjectUrls = [...objectUrls];
			sheets.clear();
			objectUrls.clear();
			releasePromise = Promise.allSettled([
				...ownedSheets.map((sheet) => Promise.resolve().then(() => destroySheet(sheet))),
				...ownedObjectUrls.map((objectUrl) => disposeObjectUrl(objectUrl))
			]).then(() => undefined);
			return releasePromise;
		},
		get released() {
			return released;
		},
		get retainedCounts() {
			return { objectUrls: objectUrls.size, sheets: sheets.size };
		}
	};
}

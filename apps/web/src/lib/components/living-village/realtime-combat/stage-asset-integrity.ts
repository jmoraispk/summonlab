import type { ExplorationEncounterRequest } from '@summonlab/contracts';
import { sha256Hex as browserSafeSha256Hex } from '@summonlab/engine';

import type { StageAssetBinding, StageAssetLoader } from './stage-lifecycle';

export type VerifiedStageAsset = Readonly<{
	source: string;
	contentHash: string;
	bytes: ArrayBuffer;
}>;

type AssetFetchResponse = Readonly<{
	ok: boolean;
	status: number;
	arrayBuffer: () => Promise<ArrayBuffer>;
}>;

export type StageAssetFetch = (source: string) => Promise<AssetFetchResponse>;

function browserAssetFetch(source: string): Promise<AssetFetchResponse> {
	return globalThis.fetch(source);
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	if (!globalThis.crypto?.subtle) {
		return browserSafeSha256Hex(new Uint8Array(bytes));
	}
	const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function requestAssetBindings(
	request: ExplorationEncounterRequest
): readonly StageAssetBinding[] {
	const bindings = new Map<string, StageAssetBinding>();
	const addBinding = (source: string, contentHash: string) => {
		const existing = bindings.get(source);
		if (existing && existing.contentHash !== contentHash) {
			throw new Error(`Combat request declares conflicting hashes for ${source}`);
		}
		bindings.set(source, Object.freeze({ source, contentHash }));
	};

	addBinding(
		request.battlefieldBinding.environmentAssetBinding.source,
		request.battlefieldBinding.environmentAssetBinding.contentHash
	);
	for (const binding of request.battlefieldBinding.occluderAssetBindings) {
		addBinding(binding.source, binding.contentHash);
	}
	for (const participant of [...request.party, ...request.enemies]) {
		addBinding(
			participant.presentation.combatAssetBinding.source,
			participant.presentation.combatAssetBinding.contentHash
		);
		addBinding(
			participant.presentation.motionPackBinding.source,
			participant.presentation.motionPackBinding.contentHash
		);
		addBinding(
			participant.presentation.motionPackBinding.atlasImageSource,
			participant.presentation.motionPackBinding.atlasImageHash
		);
	}

	return Object.freeze([...bindings.values()]);
}

export function createVerifiedStageAssetLoader(
	fetchAsset: StageAssetFetch = browserAssetFetch
): StageAssetLoader {
	return {
		async load(source, binding) {
			if (!binding || binding.source !== source) {
				throw new Error(`Combat asset ${source} has no matching request-bound SHA-256 binding`);
			}

			let response: AssetFetchResponse;
			try {
				response = await fetchAsset(source);
			} catch {
				throw new Error(`Combat asset ${source} could not be fetched`);
			}
			if (!response.ok) {
				throw new Error(`Combat asset ${source} could not be fetched (HTTP ${response.status})`);
			}

			let bytes: ArrayBuffer;
			try {
				bytes = await response.arrayBuffer();
			} catch {
				throw new Error(`Combat asset ${source} could not be read`);
			}
			const actualHash = await sha256Hex(bytes);
			if (actualHash !== binding.contentHash) {
				throw new Error(`Combat asset ${source} SHA-256 mismatch`);
			}
			return Object.freeze({ source, contentHash: binding.contentHash, bytes });
		},
		unload: () => {
			// The owner drops the verified byte reference when its final claimant releases it.
		}
	};
}

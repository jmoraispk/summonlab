import { afterEach, describe, expect, it, vi } from 'vitest';

import { RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';
import {
	createVerifiedStageAssetLoader,
	requestAssetBindings,
	sha256Hex
} from './stage-asset-integrity';

const encoder = new TextEncoder();
const trustedBytes = encoder.encode('trusted stage bytes');
const trustedHash = '1d017571187b4766eb27ce1f8b14ae94ba10c42c56c87c7bf17293b1eef524b8';

function copiedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer as ArrayBuffer;
}

function fetchResponse(bytes: Uint8Array, ok = true) {
	return {
		ok,
		status: ok ? 200 : 404,
		arrayBuffer: async () => copiedArrayBuffer(bytes)
	};
}

describe('request-bound stage asset integrity', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('collects every declared raster, motion JSON, and motion atlas byte binding', () => {
		const bindings = requestAssetBindings(RAT_ENCOUNTER_REQUEST);
		const motion = RAT_ENCOUNTER_REQUEST.party[0]!.presentation.motionPackBinding!;

		expect(bindings).toHaveLength(17);
		expect(bindings).toContainEqual({
			source: RAT_ENCOUNTER_REQUEST.party[0]!.presentation.combatAssetBinding.source,
			contentHash: RAT_ENCOUNTER_REQUEST.party[0]!.presentation.combatAssetBinding.contentHash
		});
		expect(bindings).toContainEqual({
			source: motion.source,
			contentHash: motion.contentHash
		});
		expect(bindings).toContainEqual({
			source: motion.atlasImageSource,
			contentHash: motion.atlasImageHash
		});
	});

	it('collects the approved raster without inventing motion assets for a static actor', () => {
		const request = structuredClone(RAT_ENCOUNTER_REQUEST);
		request.party[0]!.presentation.motionPackBinding = null;

		const bindings = requestAssetBindings(request);

		expect(bindings).toHaveLength(15);
		expect(bindings).toContainEqual({
			source: request.party[0]!.presentation.combatAssetBinding.source,
			contentHash: request.party[0]!.presentation.combatAssetBinding.contentHash
		});
	});

	it('returns only SHA-256-matching bytes to the shared owner', async () => {
		const loader = createVerifiedStageAssetLoader(async () => fetchResponse(trustedBytes));
		const binding = { source: '/runtime/verified.png', contentHash: trustedHash };

		await expect(loader.load(binding.source, binding)).resolves.toMatchObject({
			source: binding.source,
			contentHash: trustedHash
		});
	});

	it('fails closed before decode when fetched bytes or the network do not match the trusted binding', async () => {
		const binding = { source: '/runtime/verified.png', contentHash: trustedHash };
		const mismatchedLoader = createVerifiedStageAssetLoader(async () =>
			fetchResponse(encoder.encode('tampered stage bytes'))
		);
		const unavailableLoader = createVerifiedStageAssetLoader(async () => {
			throw new Error('network aborted');
		});

		await expect(mismatchedLoader.load(binding.source, binding)).rejects.toThrow(
			'SHA-256 mismatch'
		);
		await expect(unavailableLoader.load(binding.source, binding)).rejects.toThrow(
			'could not be fetched'
		);
	});

	it('uses the browser-safe hash implementation when Web Crypto is unavailable', async () => {
		vi.stubGlobal('crypto', undefined);

		await expect(sha256Hex(copiedArrayBuffer(trustedBytes))).resolves.toBe(trustedHash);
	});
});

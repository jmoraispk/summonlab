import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
	defaultTransportPreflightIO,
	loadTransportManifest,
	preflightTransport
} from './asha-spine-transport-lib.js';

const manifestPath =
	'assets/heroes/visuals/spine-exploration-canary-v1/transport/manifest.json';

describe('Asha Spine transport preflight', () => {
	it('pins the owned sources and 4.3 toolchain', async () => {
		const manifest = await loadTransportManifest(manifestPath);
		expect(manifest).toMatchObject({
			schemaVersion: 'asha-spine-transport-v1',
			editorVersion: '4.3.26',
			runtimeVersion: '4.3.13',
			pixiVersion: '8.20.0',
			direction: 'up-field',
			mirrored: false,
			animation: { name: 'idle_transport_probe', durationSeconds: 1 }
		});
	});

	it('rejects a changed authority hash before checking output collisions', async () => {
		const exists = vi.fn(defaultTransportPreflightIO.exists);
		await expect(
			preflightTransport(
				{
					...(await loadTransportManifest(manifestPath)),
					acceptedCutoutSha256: '0'.repeat(64)
				},
				process.cwd(),
				'write',
				{ ...defaultTransportPreflightIO, exists }
			)
		).rejects.toThrow('accepted transport cutout hash mismatch');
		expect(exists).not.toHaveBeenCalled();
	});

	it('rejects an existing owned output in write mode', async () => {
		const manifest = await loadTransportManifest(manifestPath);
		const occupied = resolve(process.cwd(), manifest.outputs.image);
		const exists = vi.fn(async (path: string) => path === occupied);
		await expect(
			preflightTransport(manifest, process.cwd(), 'write', {
				...defaultTransportPreflightIO,
				exists
			})
		).rejects.toThrow('owned output already exists');
	});
});

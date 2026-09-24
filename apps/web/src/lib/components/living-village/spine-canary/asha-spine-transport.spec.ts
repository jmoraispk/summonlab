import { describe, expect, it, vi } from 'vitest';

import {
	ASHA_SPINE_TRANSPORT_ASSETS,
	createAshaSpineTransportInstance,
	destroyAshaSpineTransportAssets,
	loadAshaSpineTransport
} from './asha-spine-transport.js';

class FakeSpine {
	readonly state = {
		current: undefined as string | undefined,
		setAnimation: (_track: number, name: string, _loop: boolean) => {
			void _loop;
			this.state.current = name;
		}
	};

	constructor(readonly options: Readonly<Record<string, unknown>>) {}
}

describe('Asha Spine transport runtime', () => {
	it('loads the data and atlas under stable aliases', async () => {
		const assets = {
			add: vi.fn(),
			load: vi.fn().mockResolvedValue([]),
			unload: vi.fn().mockResolvedValue(undefined)
		};
		await loadAshaSpineTransport(assets);
		expect(assets.add.mock.calls).toEqual([
			[
				{
					alias: 'asha-spine-transport-data-v1',
					src: ASHA_SPINE_TRANSPORT_ASSETS.data
				}
			],
			[
				{
					alias: 'asha-spine-transport-atlas-v1',
					src: ASHA_SPINE_TRANSPORT_ASSETS.atlas
				}
			]
		]);
		expect(assets.load).toHaveBeenCalledWith([
			'asha-spine-transport-data-v1',
			'asha-spine-transport-atlas-v1'
		]);
	});

	it('creates independent playback state for each instance', () => {
		const first = createAshaSpineTransportInstance(FakeSpine);
		const second = createAshaSpineTransportInstance(FakeSpine);
		first.state.setAnimation(0, 'idle_transport_probe', true);
		expect(first.options).toEqual({
			skeleton: 'asha-spine-transport-data-v1',
			atlas: 'asha-spine-transport-atlas-v1',
			autoUpdate: true,
			allowMissingRegions: false
		});
		expect(first.state).not.toBe(second.state);
		expect(second.state.current).toBeUndefined();
	});

	it('unloads only the two transport aliases and tolerates repeated cleanup', async () => {
		const assets = {
			add: vi.fn(),
			load: vi.fn().mockResolvedValue([]),
			unload: vi.fn().mockResolvedValue(undefined)
		};
		await loadAshaSpineTransport(assets);
		await destroyAshaSpineTransportAssets(assets);
		await destroyAshaSpineTransportAssets(assets);
		expect(assets.unload.mock.calls).toEqual([
			['asha-spine-transport-data-v1'],
			['asha-spine-transport-atlas-v1']
		]);
	});
});

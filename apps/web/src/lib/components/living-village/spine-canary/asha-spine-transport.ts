export const ASHA_SPINE_TRANSPORT_ASSETS = {
	data: '/runtime/exploration/spine-canary-v1/asha/asha-transport-v1.json',
	atlas: '/runtime/exploration/spine-canary-v1/asha/asha-transport-v1.atlas'
} as const;

export const ASHA_SPINE_TRANSPORT_ALIASES = {
	data: 'asha-spine-transport-data-v1',
	atlas: 'asha-spine-transport-atlas-v1'
} as const;

export type TransportAssetsApi = Readonly<{
	add: (asset: Readonly<{ alias: string; src: string }>) => unknown;
	load: (aliases: string[]) => Promise<unknown>;
	unload: (alias: string) => Promise<unknown>;
}>;

type AshaSpineConstructorOptions = Readonly<{
	skeleton: typeof ASHA_SPINE_TRANSPORT_ALIASES.data;
	atlas: typeof ASHA_SPINE_TRANSPORT_ALIASES.atlas;
	autoUpdate: true;
	allowMissingRegions: false;
}>;

type SpineConstructor<T> = new (options: AshaSpineConstructorOptions) => T;

const loadedAssetApis = new WeakSet<object>();

export async function loadAshaSpineTransport(assets: TransportAssetsApi): Promise<void> {
	assets.add({
		alias: ASHA_SPINE_TRANSPORT_ALIASES.data,
		src: ASHA_SPINE_TRANSPORT_ASSETS.data
	});
	assets.add({
		alias: ASHA_SPINE_TRANSPORT_ALIASES.atlas,
		src: ASHA_SPINE_TRANSPORT_ASSETS.atlas
	});
	await assets.load([ASHA_SPINE_TRANSPORT_ALIASES.data, ASHA_SPINE_TRANSPORT_ALIASES.atlas]);
	loadedAssetApis.add(assets);
}

export function createAshaSpineTransportInstance<T>(SpineClass: SpineConstructor<T>): T;
export function createAshaSpineTransportInstance<T>(SpineClass: SpineConstructor<T>): T {
	return new SpineClass({
		skeleton: ASHA_SPINE_TRANSPORT_ALIASES.data,
		atlas: ASHA_SPINE_TRANSPORT_ALIASES.atlas,
		autoUpdate: true,
		allowMissingRegions: false
	});
}

export async function destroyAshaSpineTransportAssets(assets: TransportAssetsApi): Promise<void> {
	if (!loadedAssetApis.has(assets)) return;
	loadedAssetApis.delete(assets);
	const failures: unknown[] = [];
	for (const alias of [ASHA_SPINE_TRANSPORT_ALIASES.data, ASHA_SPINE_TRANSPORT_ALIASES.atlas]) {
		try {
			await assets.unload(alias);
		} catch (error) {
			failures.push(error);
		}
	}
	if (failures.length > 0) {
		throw new AggregateError(failures, 'Failed to unload Asha Spine transport assets');
	}
}

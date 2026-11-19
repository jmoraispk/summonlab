import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(base?: string) {
	vi.resetModules();
	if (base !== undefined) vi.stubEnv('VITE_ASSET_BASE', base);
	return import('./asset-url');
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('asset URLs without a bucket', () => {
	it('keeps local paths and GitHub art links unchanged', async () => {
		const urls = await load('');
		expect(urls.assetBucketConfigured).toBe(false);
		expect(urls.assetUrl('/runtime/player/title.webp')).toBe('/runtime/player/title.webp');
		expect(urls.assetUrl('/wiki-media/a.webp', '/summonlab/wiki-media/a.webp')).toBe(
			'/summonlab/wiki-media/a.webp'
		);
		expect(urls.repositoryArtUrl('assets/enemies/x/normal.png')).toBe(
			'https://media.githubusercontent.com/media/jmoraispk/summonlab/main/assets/enemies/x/normal.png'
		);
		expect(urls.repositoryArtLink('assets/enemies/x/normal.png')).toBe(
			'https://github.com/jmoraispk/summonlab/blob/main/assets/enemies/x/normal.png'
		);
	});
});

describe('asset URLs with a bucket', () => {
	it('loads static files and repository art from the bucket', async () => {
		const urls = await load('https://assets.example.test/');
		expect(urls.assetBucketConfigured).toBe(true);
		expect(urls.assetUrl('/runtime/player/title.webp')).toBe(
			'https://assets.example.test/runtime/player/title.webp'
		);
		expect(urls.assetUrl('/wiki-media/a.webp', '/summonlab/wiki-media/a.webp')).toBe(
			'https://assets.example.test/wiki-media/a.webp'
		);
		expect(urls.repositoryArtUrl('/assets/enemies/x/normal.png')).toBe(
			'https://assets.example.test/assets/enemies/x/normal.png'
		);
		expect(urls.repositoryArtLink('assets/enemies/x/normal.png')).toBe(
			'https://assets.example.test/assets/enemies/x/normal.png'
		);
	});

	it('leaves absolute, protocol-relative and data URLs alone', async () => {
		const urls = await load('https://assets.example.test');
		for (const url of [
			'https://cdn.test/a.png',
			'//cdn.test/a.png',
			'data:image/png;base64,AA',
			'blob:x'
		]) {
			expect(urls.assetUrl(url)).toBe(url);
		}
	});
});

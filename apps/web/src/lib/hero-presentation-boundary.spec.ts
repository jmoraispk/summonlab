import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const retiredComponentName = ['Hero', 'Rig'].join('');

function productionSources(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return productionSources(path);
		if (!['.svelte', '.ts'].includes(extname(entry.name))) return [];
		if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.e2e.ts')) return [];
		return [path];
	});
}

describe('premium-only hero presentation boundary', () => {
	it('keeps the retired procedural hero renderer out of production sources', () => {
		const consumers = productionSources(sourceRoot).filter((path) =>
			readFileSync(path, 'utf8').includes(retiredComponentName)
		);

		expect(consumers).toEqual([]);
		expect(
			existsSync(resolve(sourceRoot, 'lib/components', `${retiredComponentName}.svelte`))
		).toBe(false);
	});

	it('removes development routes whose product was the procedural renderer', () => {
		for (const route of ['routes/forge/pack-2/runtime', 'routes/visual-lab/recognition']) {
			expect(existsSync(resolve(sourceRoot, route, '+page.svelte'))).toBe(false);
			expect(existsSync(resolve(sourceRoot, route, '+page.server.ts'))).toBe(false);
		}
	});

	it('keeps active production links and compact hero surfaces on the new boundary', () => {
		const retiredPaths = [
			['visual-lab', 'recognition'].join('/'),
			['forge', 'pack-2', 'runtime'].join('/')
		];
		const staleLinks = productionSources(sourceRoot).filter((path) => {
			const source = readFileSync(path, 'utf8');
			return retiredPaths.some((retiredPath) => source.includes(`/${retiredPath}`));
		});
		const onboarding = readFileSync(
			resolve(sourceRoot, 'lib/components/campaign/SingletonOnboarding.svelte'),
			'utf8'
		);

		expect(staleLinks).toEqual([]);
		expect(onboarding).toContain('tab-art-pending');
		expect(onboarding).toContain('portrait pending');
	});
});

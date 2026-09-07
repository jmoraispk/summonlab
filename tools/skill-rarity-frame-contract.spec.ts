import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('canonical skill rarity frames', () => {
	it('binds one approved reusable frame for every rarity', async () => {
		const manifest = JSON.parse(
			await readFile('assets/wiki/skills/icon-production-v2/asset-manifest.json', 'utf8')
		) as {
			approvalPolicy: string;
			sourcePolicy: string;
			composition: { interiorTransform: string };
			frames: { rarity: string; path: string }[];
		};

		expect(manifest.approvalPolicy).toBe('owner-approved-before-promotion');
		expect(manifest.sourcePolicy).toBe('exact-frameless-source');
		expect(manifest.composition.interiorTransform).toBe('identity');
		expect(manifest.frames.map((frame) => frame.rarity)).toEqual([
			'F',
			'E',
			'D',
			'C',
			'B',
			'A',
			'S'
		]);
		expect(manifest.frames.every((frame) => frame.path.includes('/frames/rarity-frame-'))).toBe(
			true
		);
	});

	it('keeps the material ladder separate from bearer mastery', async () => {
		const source = await readFile('docs/wiki/art/skill-rarity-frames.md', 'utf8');
		const prose = source.replaceAll(/\s+/g, ' ');

		for (const material of [
			'Weathered iron',
			'Aged bronze',
			'Tempered blue steel',
			'Moonlit silver',
			'Blackened metal and amethyst',
			'Champagne electrum',
			'Ceremonial antique gold'
		]) {
			expect(source).toContain(material);
		}
		expect(prose).toContain('Rarity belongs to the skill definition');
		expect(prose).toContain('Mastery and level belong to the hero-skill relationship');
	});

	it('renders the seven canonical frame files in the wiki', async () => {
		const wiki = await readFile('apps/web/src/lib/server/wiki.ts', 'utf8');
		for (const rarity of ['f', 'e', 'd', 'c', 'b', 'a', 's']) {
			expect(wiki).toContain(`icon-production-v2/frames/rarity-frame-${rarity}.png`);
		}
	});
});

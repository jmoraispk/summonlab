import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

type WikiAsset = {
	assetKey: string;
	file: string;
	status: string;
	generationMode?: string;
	provenanceFile?: string;
};

type WikiEntry = {
	wikiId: string;
	path: string;
	designStatus: string;
	implementationStatus: string;
	visualStatus: string;
	assets?: WikiAsset[];
};

describe('canonical skill rarity frame specification', () => {
	it('publishes owner-selected Option C as the approved visual authority', async () => {
		const catalog = JSON.parse(await readFile('docs/wiki/catalog.json', 'utf8')) as {
			entries: WikiEntry[];
		};
		const entry = catalog.entries.find(({ wikiId }) => wikiId === 'art.skill-rarity-frames');

		expect(entry).toMatchObject({
			path: 'docs/wiki/art/skill-rarity-frames.md',
			designStatus: 'accepted',
			implementationStatus: 'partial',
			visualStatus: 'approved'
		});
		expect(entry?.assets).toEqual([
			{
				assetKey: 'skill-rarity-option-c-v1',
				file: 'assets/wiki/skills/rarity-frame-v1/skill-rarity-option-c-v1.webp',
				status: 'approved',
				generationMode: 'built-in-imagegen',
				provenanceFile: 'assets/wiki/skills/rarity-frame-v1/catalog.json'
			}
		]);
	});

	it('freezes the material and ornament ladder without conflating mastery', async () => {
		const source = await readFile('docs/wiki/art/skill-rarity-frames.md', 'utf8');
		const prose = source.replace(/\s+/g, ' ');

		expect(source).toContain('F | Common | Weathered iron');
		expect(source).toContain('E | Uncommon | Aged bronze');
		expect(source).toContain('D | Rare | Tempered blue steel');
		expect(source).toContain('C | Epic | Moonlit silver');
		expect(source).toContain('B | Mythic | Blackened metal and amethyst');
		expect(source).toContain('A | Fabled | Champagne electrum');
		expect(source).toContain('S | Legendary | Ceremonial antique gold');
		expect(prose).toContain('Rarity belongs to the skill definition');
		expect(prose).toContain('Mastery and level belong to the hero-skill relationship');
	});

	it('bundles the approved comparison plate into the rendered wiki', async () => {
		const wikiServer = await readFile('apps/web/src/lib/server/wiki.ts', 'utf8');

		expect(wikiServer).toContain(
			"'../../../../../assets/wiki/skills/rarity-frame-v1/skill-rarity-option-c-v1.webp'"
		);
	});
});

import visualIndex from '../../../../../docs/wiki/creatures/monsters/visual-index.json';

export type MonsterProductionEntry = (typeof visualIndex.monsters)[number];

const productionByWikiId = new Map(
	visualIndex.monsters.map((monster) => [`monster.${monster.id}`, monster])
);

export function getMonsterProductionDatabase(): readonly MonsterProductionEntry[] {
	return visualIndex.monsters;
}

export function getMonsterProductionEntry(wikiId: string): MonsterProductionEntry | null {
	return productionByWikiId.get(wikiId) ?? null;
}

// The canonical v2 index contains ownership plans, not renderable pixels. Keep the former visual
// hooks disabled until reviewed candidate thumbnails exist so the route falls back to Markdown.
export function getMonsterVisualDatabase(): null {
	return null;
}

export function getMonsterVisualEntry(_wikiId: string): null {
	return null;
}

import visualIndex from '../../../../../docs/wiki/creatures/monsters/visual-index.json';

export type MonsterVisualEntry = (typeof visualIndex.monsters)[number];

const monstersByWikiId = new Map(
	visualIndex.monsters.map((monster) => [`monster.${monster.id}`, monster])
);

export function getMonsterVisualDatabase(): readonly MonsterVisualEntry[] {
	return visualIndex.monsters;
}

export function getMonsterVisualEntry(wikiId: string): MonsterVisualEntry | null {
	return monstersByWikiId.get(wikiId) ?? null;
}

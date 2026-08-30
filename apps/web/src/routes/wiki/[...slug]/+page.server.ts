import { error } from '@sveltejs/kit';

import { getMonsterVisualDatabase, getMonsterVisualEntry } from '$lib/server/monster-database';
import { getWikiAsset, getWikiPage } from '$lib/server/wiki';

import type { PageServerLoad } from './$types';

const visualPacketHeroes = [
	[
		'Dara Zev',
		'assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png',
		'Fixed LV roster · approved identity'
	],
	['Mara Vey', 'assets/heroes/ember-01-anchor-v1.png', 'Fixed LV roster · approved identity'],
	[
		'Jori Daro',
		'assets/heroes/visuals/owner-playtest-v1/jori-daro-anchor-v1.png',
		'Fixed LV roster · approved identity'
	],
	[
		'Kira Toren',
		'assets/heroes/visuals/forge-v2/pilot/kira-toren-anchor-v1.png',
		'Fixed LV roster · candidate identity'
	],
	[
		'Iven Orra',
		'assets/heroes/visuals/forge-v2/pilot/iven-orra-anchor-v1.png',
		'Fixed LV roster · candidate identity'
	],
	[
		'Remy Nahl',
		'assets/heroes/visuals/hearth-02-anchor-v1.png',
		'Fixed LV roster · approval candidate'
	]
] as const;

export const load: PageServerLoad = ({ params }) => {
	const wikiPage = getWikiPage(params.slug);
	if (!wikiPage || wikiPage.href === '/wiki') error(404, 'Wiki page not found');

	return {
		wikiPage,
		monsterDatabase:
			wikiPage.wikiId === 'creatures.monster-database' ? getMonsterVisualDatabase() : null,
		monsterVisual: getMonsterVisualEntry(wikiPage.wikiId),
		visualPacket:
			wikiPage.wikiId === 'art.living-village-heroes'
				? {
						heroes: visualPacketHeroes.map(([name, repositoryPath, status]) => ({
							name,
							image: getWikiAsset(repositoryPath),
							status
						})),
						environment: getWikiAsset('assets/settlements/hearth-01/hearth-01-environment-v1.png'),
						roster: getWikiAsset('assets/heroes/visuals/hearth-roster-pair-v1.png')
					}
				: null
	};
};

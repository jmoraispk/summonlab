import { error } from '@sveltejs/kit';

import { getWikiAsset, getWikiPage } from '$lib/server/wiki';

import type { PageServerLoad } from './$types';

const visualPacketHeroes = [
	[
		'Dara Zev',
		'assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png',
		'Approved identity · uncast for LV'
	],
	['Mara Vey', 'assets/heroes/ember-01-anchor-v1.png', 'Approved identity · uncast for LV'],
	[
		'Jori Daro',
		'assets/heroes/visuals/owner-playtest-v1/jori-daro-anchor-v1.png',
		'Approved identity · uncast for LV'
	],
	[
		'Kira Toren',
		'assets/heroes/visuals/forge-v2/pilot/kira-toren-anchor-v1.png',
		'Reference candidate · uncast'
	],
	[
		'Iven Orra',
		'assets/heroes/visuals/forge-v2/pilot/iven-orra-anchor-v1.png',
		'Reference candidate · uncast'
	],
	[
		'Remy Nahl',
		'assets/heroes/visuals/hearth-02-anchor-v1.png',
		'Approval candidate · uncast for LV'
	]
] as const;

export const load: PageServerLoad = ({ params }) => {
	const wikiPage = getWikiPage(params.slug);
	if (!wikiPage || wikiPage.href === '/wiki') error(404, 'Wiki page not found');

	return {
		wikiPage,
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

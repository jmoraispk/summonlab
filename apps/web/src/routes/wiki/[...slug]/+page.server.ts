import { error, redirect } from '@sveltejs/kit';

import {
	getLegacyMonsterWikiRedirect,
	getMonsterFamilyVisualEntry,
	getMonsterVisualDatabase,
	getMonsterVisualEntry
} from '$lib/server/monster-database';
import { getSkillVisualCatalog } from '$lib/server/skill-visual-catalog';
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

export const load = (({ params }) => {
	const legacyMonsterId = params.slug.match(/^creatures\/monsters\/([a-z][a-z0-9-]*)$/u)?.[1];
	const legacyDestination = legacyMonsterId ? getLegacyMonsterWikiRedirect(legacyMonsterId) : null;
	if (legacyDestination) redirect(308, legacyDestination);
	const wikiPage = getWikiPage(params.slug);
	if (!wikiPage || wikiPage.href === '/wiki') error(404, 'Wiki page not found');

	return {
		wikiPage,
		skillVisualCatalog:
			wikiPage.wikiId === 'skills.visual-catalog' ? getSkillVisualCatalog() : null,
		monsterDatabase:
			wikiPage.wikiId === 'creatures.monster-database' ? getMonsterVisualDatabase() : null,
		monsterFamily: getMonsterFamilyVisualEntry(wikiPage.wikiId),
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
}) satisfies PageServerLoad;

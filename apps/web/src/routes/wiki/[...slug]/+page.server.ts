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
	['Dara Zev', 'dara-zev.png'],
	['Mara Vey', 'mara-vey.png'],
	['Jori Daro', 'jori-daro.png'],
	['Kira Toren', 'kira-toren.png'],
	['Iven Orra', 'iven-orra.png'],
	['Remy Nahl', 'remy-nahl.png']
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
						heroes: visualPacketHeroes.map(([name, fileName]) => ({
							name,
							image: getWikiAsset(
								`apps/web/src/routes/living-village-lab/village/cutouts/${fileName}`
							),
							status: 'Retained lab cutout · source in Git history'
						})),
						environment: getWikiAsset('assets/settlements/hearth-01/hearth-01-environment-v1.png')
					}
				: null
	};
}) satisfies PageServerLoad;

import { getConfig } from '@summonlab/config';
import { CharacterVisualCatalogSchema } from '@summonlab/contracts';
import { error } from '@sveltejs/kit';

import { buildSummonCardSpec, listSummonCardSubjects } from '$lib/server/summon-card';
import visualCatalogSource from '../../../../../../assets/heroes/visuals/catalog.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const config = getConfig();
	if (!config.devRoutesEnabled) error(404, 'Not found.');
	const catalog = CharacterVisualCatalogSchema.parse(visualCatalogSource);
	const subjects = await listSummonCardSubjects();
	return {
		catalogVersion: catalog.catalogVersion,
		subjects: subjects.map((subject) => ({
			...subject,
			initialSpec: buildSummonCardSpec(subject, catalog.catalogVersion, '', config)
		})),
		generation: {
			enabled: config.imageGenerationEnabled,
			keyConfigured: Boolean(config.openAiApiKey),
			model: config.imageModel,
			quality: config.imageQuality,
			size: config.imageSize,
			timeoutMs: config.imageTimeoutMs
		}
	};
};

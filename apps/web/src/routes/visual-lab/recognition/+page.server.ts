import {
	VISUAL_CHARACTER_GENERATION_VERSION,
	generateCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import {
	CharacterVisualCatalogSchema,
	VisualRecognitionAuditSchema,
	WebBuildBudgetReportSchema
} from '@summonlab/contracts';
import { error } from '@sveltejs/kit';

import visualCatalogSource from '../../../../../../assets/heroes/visuals/catalog.json';
import recognitionAuditSource from '../../../../../../assets/heroes/visuals/recognition-audit.json';
import buildBudgetSource from '../../../../../../docs/evidence/phase-3-runtime-budget.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Not found.');
	const catalog = CharacterVisualCatalogSchema.parse(visualCatalogSource);
	const audit = VisualRecognitionAuditSchema.parse(recognitionAuditSource);
	const buildBudget = WebBuildBudgetReportSchema.parse(buildBudgetSource);
	const character = await generateCharacterDraft(
		recipeFromSeed('ember-01', VISUAL_CHARACTER_GENERATION_VERSION)
	);
	const profile = catalog.profiles.find((candidate) => candidate.characterId === audit.characterId);
	const source = catalog.assets.find(
		(candidate) => candidate.assetKey === audit.approvedSourceAssetKey
	);
	if (
		!profile ||
		!source ||
		character.manifest.characterId !== audit.characterId ||
		character.manifestHash !== audit.manifestHash ||
		profile.manifestHash !== audit.manifestHash ||
		source.status !== 'approved' ||
		source.contentHash !== audit.approvedSourceContentHash
	) {
		throw new Error('Recognition audit no longer matches its approved deterministic identity.');
	}
	return { audit, buildBudget, character, profile };
};

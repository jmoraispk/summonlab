import { getConfig } from '@summonlab/config';
import {
	CharacterVisualCatalogSchema,
	RuntimeVisualManifestSchema,
	WebBuildBudgetReportSchema
} from '@summonlab/contracts';
import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import runtimeManifestSource from '../../../../static/runtime/visual-catalog-v1/manifest.json';
import visualCatalogSource from '../../../../../../assets/heroes/visuals/catalog.json';

import type { PageServerLoad } from './$types';

async function readBuildBudgetEvidence(): Promise<unknown> {
	const candidates = [
		resolve(process.cwd(), 'docs/evidence/phase-3-runtime-budget.json'),
		resolve(process.cwd(), '../../docs/evidence/phase-3-runtime-budget.json')
	];
	for (const path of candidates) {
		try {
			return JSON.parse(await readFile(path, 'utf8'));
		} catch (cause) {
			if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
		}
	}
	throw new Error('Runtime bundle budget evidence is unavailable.');
}

export const load: PageServerLoad = async () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Not found.');
	const manifest = RuntimeVisualManifestSchema.parse(runtimeManifestSource);
	const catalog = CharacterVisualCatalogSchema.parse(visualCatalogSource);
	// Keep the measured evidence out of the client build graph: embedding it would make the
	// measurement alter the content hashes and compressed size it is intended to record.
	const buildBudgetSource = await readBuildBudgetEvidence();
	const buildBudget = WebBuildBudgetReportSchema.parse(buildBudgetSource);
	return {
		manifest,
		buildBudget,
		sources: catalog.assets.map((asset) => ({
			assetKey: asset.assetKey,
			role: asset.role,
			status: asset.status,
			bytes: asset.bytes,
			contentHash: asset.contentHash
		}))
	};
};

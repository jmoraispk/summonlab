import { getConfig } from '@summonlab/config';
import { getEngineSnapshot, getProofRun } from '@summonlab/database';
import { supportsEquipmentApi } from '@summonlab/engine';
import { error } from '@sveltejs/kit';

import { projectEquipmentWorkshop } from '$lib/server/equipment-runtime';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) error(404, 'Not found.');

	const [proof, snapshot] = await Promise.all([
		getProofRun(config.databaseUrl, params.runId),
		getEngineSnapshot(config.databaseUrl, params.runId)
	]);
	if (!proof || !snapshot) error(404, 'Equipment run not found.');
	if (!supportsEquipmentApi(snapshot.state)) {
		error(409, 'This history does not support the Equipment workshop.');
	}

	setHeaders({ 'cache-control': 'no-store' });
	return {
		runId: params.runId,
		projection: projectEquipmentWorkshop(snapshot, proof.manifest.characterId)
	};
};

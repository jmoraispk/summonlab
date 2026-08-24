import { getConfig } from '@summonlab/config';
import { loadHearth01, planSettlementRoute } from '@summonlab/content';
import { WebBuildBudgetReportSchema } from '@summonlab/contracts';
import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
	throw new Error('Web build budget evidence is unavailable.');
}

export const load: PageServerLoad = async () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Not found.');
	const [definition, buildBudgetSource] = await Promise.all([
		loadHearth01(),
		readBuildBudgetEvidence()
	]);
	const buildBudget = WebBuildBudgetReportSchema.parse(buildBudgetSource);
	const reserveSystemIds = new Set(['gate-system']);
	const allSystemIds = new Set(definition.buildings.map((building) => building.systemId));
	const routesFor = (systemIds: ReadonlySet<string>) =>
		Object.fromEntries(
			definition.nodes.map((node) => [
				node.nodeId,
				planSettlementRoute(definition, definition.spawnNodeId, node.nodeId, systemIds)
			])
		);

	return {
		definition,
		buildBudget,
		routeProfiles: {
			reserve: routesFor(reserveSystemIds),
			allSystems: routesFor(allSystemIds)
		}
	};
};

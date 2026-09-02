import { cp, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EQUIPMENT_PRODUCTION_ROOT } from './equipment-image-production-contract.js';

const PROFILE_REFERENCE_PATH =
	'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png';
const LIVE_PRODUCTION_DIRECTORIES = new Set([
	'candidates',
	'results',
	'review-packets',
	'reviews',
	'runs'
]);

function absolute(workspaceRoot: string, repositoryPath: string): string {
	return path.join(workspaceRoot, ...repositoryPath.split('/'));
}

export async function makeCleanEquipmentTestWorkspace(
	sourceWorkspaceRoot: string,
	prefix: string
): Promise<string> {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), prefix));
	const sourceProductionRoot = absolute(sourceWorkspaceRoot, EQUIPMENT_PRODUCTION_ROOT);
	await cp(sourceProductionRoot, absolute(workspaceRoot, EQUIPMENT_PRODUCTION_ROOT), {
		recursive: true,
		filter: (source) => {
			const relative = path.relative(sourceProductionRoot, source);
			if (relative.length === 0) return true;
			return !LIVE_PRODUCTION_DIRECTORIES.has(relative.split(path.sep)[0]!);
		}
	});
	await mkdir(path.dirname(absolute(workspaceRoot, PROFILE_REFERENCE_PATH)), { recursive: true });
	await cp(
		absolute(sourceWorkspaceRoot, PROFILE_REFERENCE_PATH),
		absolute(workspaceRoot, PROFILE_REFERENCE_PATH)
	);
	return workspaceRoot;
}

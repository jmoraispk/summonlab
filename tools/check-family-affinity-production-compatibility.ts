import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
	FAMILY_AFFINITY_PRODUCTION_PROFILE,
	FAMILY_AFFINITY_PRODUCTION_SKILL_VERSION,
	FAMILY_AFFINITY_ROOT,
	FAMILY_AFFINITY_SKILL_CONTRACT_PATH,
	familyAffinityRawSha256,
	validateFamilyAffinityProductionCompatibility
} from './family-affinity-production-lib.js';
import { validateFamilyAffinityProductionSurface } from './check-family-affinity-production-dispatch.js';

export async function checkFamilyAffinityProductionCompatibility(repositoryRoot: string) {
	const receiptPath = `${FAMILY_AFFINITY_ROOT}/production-compatibility.json`;
	const installedSkillPath = join(homedir(), '.codex/skills/summonlab-image-production');
	const installedContractPath = join(installedSkillPath, 'references/contract-v3.json');
	const [receiptBytes, repositoryContractBytes, installedContractBytes] = await Promise.all([
		readFile(join(repositoryRoot, receiptPath)),
		readFile(join(repositoryRoot, FAMILY_AFFINITY_SKILL_CONTRACT_PATH)),
		readFile(installedContractPath)
	]);
	const receipt = JSON.parse(receiptBytes.toString('utf8'));
	const validated = validateFamilyAffinityProductionCompatibility(receipt, installedContractBytes);
	if (
		familyAffinityRawSha256(repositoryContractBytes) !==
		familyAffinityRawSha256(installedContractBytes)
	) {
		throw new Error(
			'Installed image-production contract differs from the tracked repository source'
		);
	}
	const surface = await validateFamilyAffinityProductionSurface({
		compatibility: receipt,
		trackedSkillRoot: join(repositoryRoot, 'skills/summonlab-image-production'),
		installedSkillRoot: installedSkillPath,
		repositoryRoot
	});
	return {
		status: 'compatible' as const,
		skillVersion: FAMILY_AFFINITY_PRODUCTION_SKILL_VERSION,
		profile: FAMILY_AFFINITY_PRODUCTION_PROFILE,
		receiptPath,
		installedSkillPath: surface.root,
		contractSha256: validated.skillContractSha256,
		bundleSha256: surface.bundleSha256,
		affinities: validated.affinities,
		namespaces: validated.namespaces
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	checkFamilyAffinityProductionCompatibility(process.cwd())
		.then((report) => console.log(JSON.stringify(report, null, 2)))
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		});
}

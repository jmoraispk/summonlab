import { readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { computeFamilyAffinityProductionSurface } from './check-family-affinity-production-dispatch.js';
import {
	FAUNA_FAMILY_ROOT,
	FAMILY_AFFINITY_ROOT,
	familyAffinityRawSha256,
	stableFamilyAffinityJson,
	validateFamilyAffinityProductionCompatibility
} from './family-affinity-production-lib.js';

const ownership = {
	producerRoleAllowlist: ['image-producer'],
	retryCeiling: [0, 1],
	exclusiveCandidateCreate: true,
	immutableSingleCreateResult: true,
	overwriteForbidden: true,
	targetAssignmentCrossHashRequired: true,
	familyPacketHashRequired: true,
	candidateRawHashRequired: true,
	promptMaterialHashRequired: true,
	runtimeMutationForbidden: true
} as const;

export async function resealFamilyProductionCompatibility(input: {
	repositoryRoot: string;
	write: boolean;
}) {
	const skillRoot = join(input.repositoryRoot, 'skills/summonlab-image-production');
	const surface = await computeFamilyAffinityProductionSurface(skillRoot);
	const contract = surface.contract as {
		skillVersion: string;
		repositoryDispatch: unknown;
		sealedLauncher: unknown;
		profiles: Record<string, Record<string, unknown>>;
	};
	const approvedSkillRoot = await realpath(skillRoot);
	const common = {
		schemaVersion: 'family-affinity-production-compatibility-v1',
		skillVersion: contract.skillVersion,
		targetSchema: 'family-affinity-target-v1',
		assignmentSchema: 'family-affinity-assignment-v1',
		resultSchema: 'family-affinity-result-v1',
		promptMaterialSchema: 'family-affinity-prompt-material-v1',
		ownership,
		forbiddenWriteClasses: ['review', 'catalog', 'contact-sheet', 'wiki', 'runtime', 'manifest'],
		skillContractPath: 'skills/summonlab-image-production/references/contract-v3.json',
		skillContractSha256: familyAffinityRawSha256(surface.contractBytes),
		approvedSkillRoot,
		executionSurface: {
			framing: surface.framing,
			files: surface.files,
			bundleSha256: surface.bundleSha256
		},
		repositoryDispatch: contract.repositoryDispatch,
		sealedLauncher: contract.sealedLauncher
	};
	const profileReceipt = (profileName: string) => {
		const profile = contract.profiles[profileName]!;
		return {
			...common,
			profile: profileName,
			sourcePacketSchemas: profile.sourcePacketSchemas,
			experimentId: profile.experimentId,
			affinities: profile.affinities,
			namespaces: profile.namespaces,
			dispatchStatuses: profile.dispatchStatuses,
			anchorKinds: profile.anchorKinds,
			requiredBindings: profile.requiredBindings,
			pathTemplates: profile.pathTemplates
		};
	};
	const legacy = {
		...profileReceipt('image-production-family-target-v1'),
		bridgeExtension: {
			schemaVersion: 'earth-bridge-production-extension-v1',
			wavePath: `${FAMILY_AFFINITY_ROOT}/waves/earth-bridge-v1.json`,
			reviewedAt: '2026-09-02T18:30:00.000Z',
			approvalReference: 'root-approved-task10-bridge-production-extension-2026-09-02'
		},
		provisionalAnchorExtension: {
			schemaVersion: 'normal-verified-candidate-extension-v1',
			planPath: 'docs/superpowers/plans/2026-09-03-monster-image-single-checkpoint-goal-harness.md',
			reviewedAt: '2026-09-03T21:00:00.000Z',
			approvalReference: 'user-confirmed-single-checkpoint-monster-generation-2026-09-03',
			candidateOnly: true,
			humanReviewPending: true,
			runtimeCatalogMutationForbidden: true
		},
		reviewedAt: '2026-09-02T15:01:44.000Z',
		approvalReference: 'user-confirmed-summonlab-image-production-v3-2026-09-02'
	};
	const fauna = {
		...profileReceipt('image-production-fauna-family-target-v1'),
		reviewedAt: '2026-09-04T12:00:00.000Z',
		approvalReference: 'owner-approved-fauna-family-production-2026-09-04'
	};
	for (const receipt of [legacy, fauna]) {
		validateFamilyAffinityProductionCompatibility(receipt, surface.contractBytes);
	}
	const outputs = [
		{ path: `${FAMILY_AFFINITY_ROOT}/production-compatibility.json`, value: legacy },
		{ path: `${FAUNA_FAMILY_ROOT}/production-compatibility.json`, value: fauna }
	];
	for (const output of outputs) {
		const absolute = join(input.repositoryRoot, output.path);
		const expected = stableFamilyAffinityJson(output.value);
		if (input.write) await writeFile(absolute, expected);
		else if ((await readFile(absolute, 'utf8')) !== expected) {
			throw new Error(`Production compatibility seal drifted: ${output.path}`);
		}
	}
	return {
		status: input.write ? ('resealed' as const) : ('verified' as const),
		approvedSkillRoot,
		contractSha256: common.skillContractSha256,
		bundleSha256: surface.bundleSha256,
		outputs: outputs.map(({ path }) => path)
	};
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	resealFamilyProductionCompatibility({
		repositoryRoot: process.cwd(),
		write: process.argv.includes('--write')
	})
		.then((report) => console.log(JSON.stringify(report, null, 2)))
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		});
}

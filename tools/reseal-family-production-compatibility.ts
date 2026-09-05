import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
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

const LEGACY_PROFILE = 'image-production-family-target-v1' as const;
const FAUNA_PROFILE = 'image-production-fauna-family-target-v1' as const;
const LEGACY_RECEIPT_PATH = `${FAMILY_AFFINITY_ROOT}/production-compatibility.json` as const;
const FAUNA_RECEIPT_PATH = `${FAUNA_FAMILY_ROOT}/production-compatibility.json` as const;

type BridgeApproval = {
	schemaVersion: string;
	wavePath: string;
	reviewedAt: string;
	approvalReference: string;
};

type ProvisionalAnchorApproval = {
	schemaVersion: string;
	planPath: string;
	reviewedAt: string;
	approvalReference: string;
	candidateOnly: boolean;
	humanReviewPending: boolean;
	runtimeCatalogMutationForbidden: boolean;
};

type LegacyApproval = {
	approvedSkillRoot: string;
	reviewedAt: string;
	approvalReference: string;
	bridgeExtension: BridgeApproval;
	provisionalAnchorExtension: ProvisionalAnchorApproval;
};

type FaunaApproval = {
	approvedSkillRoot: string;
	reviewedAt: string;
	approvalReference: string;
};

export type FamilyProductionResealApprovalMetadata = {
	schemaVersion: 'family-production-reseal-approval-v1';
	profiles: {
		[LEGACY_PROFILE]: LegacyApproval;
		[FAUNA_PROFILE]: FaunaApproval;
	};
};

function record(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`Complete approval metadata requires an object for ${label}`);
	}
	return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
		throw new Error(`Complete approval metadata requires exact ${label} fields`);
	}
}

function requiredString(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`Complete approval metadata requires ${label}`);
	}
	return value;
}

function approvedRoot(value: unknown, label: string): string {
	const root = requiredString(value, label);
	if (!isAbsolute(root) || resolve(root) !== root) {
		throw new Error(`Complete approval metadata requires an absolute normalized ${label}`);
	}
	return root;
}

function bridgeApproval(value: unknown): BridgeApproval {
	const input = record(value, 'legacy bridge approval');
	exactKeys(
		input,
		['schemaVersion', 'wavePath', 'reviewedAt', 'approvalReference'],
		'legacy bridge approval'
	);
	return {
		schemaVersion: requiredString(input.schemaVersion, 'legacy bridge schemaVersion'),
		wavePath: requiredString(input.wavePath, 'legacy bridge wavePath'),
		reviewedAt: requiredString(input.reviewedAt, 'legacy bridge reviewedAt'),
		approvalReference: requiredString(input.approvalReference, 'legacy bridge approvalReference')
	};
}

function provisionalAnchorApproval(value: unknown): ProvisionalAnchorApproval {
	const input = record(value, 'legacy provisional-anchor approval');
	exactKeys(
		input,
		[
			'schemaVersion',
			'planPath',
			'reviewedAt',
			'approvalReference',
			'candidateOnly',
			'humanReviewPending',
			'runtimeCatalogMutationForbidden'
		],
		'legacy provisional-anchor approval'
	);
	for (const key of [
		'candidateOnly',
		'humanReviewPending',
		'runtimeCatalogMutationForbidden'
	] as const) {
		if (typeof input[key] !== 'boolean') {
			throw new Error(`Complete approval metadata requires boolean ${key}`);
		}
	}
	return {
		schemaVersion: requiredString(input.schemaVersion, 'provisional schemaVersion'),
		planPath: requiredString(input.planPath, 'provisional planPath'),
		reviewedAt: requiredString(input.reviewedAt, 'provisional reviewedAt'),
		approvalReference: requiredString(input.approvalReference, 'provisional approvalReference'),
		candidateOnly: input.candidateOnly as boolean,
		humanReviewPending: input.humanReviewPending as boolean,
		runtimeCatalogMutationForbidden: input.runtimeCatalogMutationForbidden as boolean
	};
}

export function parseFamilyProductionResealApprovalMetadata(
	value: unknown
): FamilyProductionResealApprovalMetadata {
	const input = record(value, 'reseal approval');
	exactKeys(input, ['schemaVersion', 'profiles'], 'reseal approval');
	if (input.schemaVersion !== 'family-production-reseal-approval-v1') {
		throw new Error(
			'Complete approval metadata requires schemaVersion family-production-reseal-approval-v1'
		);
	}
	const profiles = record(input.profiles, 'profiles');
	exactKeys(profiles, [LEGACY_PROFILE, FAUNA_PROFILE], 'profiles');
	const legacy = record(profiles[LEGACY_PROFILE], LEGACY_PROFILE);
	exactKeys(
		legacy,
		[
			'approvedSkillRoot',
			'reviewedAt',
			'approvalReference',
			'bridgeExtension',
			'provisionalAnchorExtension'
		],
		LEGACY_PROFILE
	);
	const fauna = record(profiles[FAUNA_PROFILE], FAUNA_PROFILE);
	exactKeys(fauna, ['approvedSkillRoot', 'reviewedAt', 'approvalReference'], FAUNA_PROFILE);
	return {
		schemaVersion: 'family-production-reseal-approval-v1',
		profiles: {
			[LEGACY_PROFILE]: {
				approvedSkillRoot: approvedRoot(
					legacy.approvedSkillRoot,
					`${LEGACY_PROFILE}.approvedSkillRoot`
				),
				reviewedAt: requiredString(legacy.reviewedAt, `${LEGACY_PROFILE}.reviewedAt`),
				approvalReference: requiredString(
					legacy.approvalReference,
					`${LEGACY_PROFILE}.approvalReference`
				),
				bridgeExtension: bridgeApproval(legacy.bridgeExtension),
				provisionalAnchorExtension: provisionalAnchorApproval(legacy.provisionalAnchorExtension)
			},
			[FAUNA_PROFILE]: {
				approvedSkillRoot: approvedRoot(
					fauna.approvedSkillRoot,
					`${FAUNA_PROFILE}.approvedSkillRoot`
				),
				reviewedAt: requiredString(fauna.reviewedAt, `${FAUNA_PROFILE}.reviewedAt`),
				approvalReference: requiredString(
					fauna.approvalReference,
					`${FAUNA_PROFILE}.approvalReference`
				)
			}
		}
	};
}

async function readExistingApprovalMetadata(
	repositoryRoot: string
): Promise<FamilyProductionResealApprovalMetadata> {
	const readApproval = async (path: string) =>
		record(JSON.parse(await readFile(join(repositoryRoot, path), 'utf8')), path);
	const [legacy, fauna] = await Promise.all([
		readApproval(LEGACY_RECEIPT_PATH),
		readApproval(FAUNA_RECEIPT_PATH)
	]);
	return parseFamilyProductionResealApprovalMetadata({
		schemaVersion: 'family-production-reseal-approval-v1',
		profiles: {
			[LEGACY_PROFILE]: {
				approvedSkillRoot: legacy.approvedSkillRoot,
				reviewedAt: legacy.reviewedAt,
				approvalReference: legacy.approvalReference,
				bridgeExtension: legacy.bridgeExtension,
				provisionalAnchorExtension: legacy.provisionalAnchorExtension
			},
			[FAUNA_PROFILE]: {
				approvedSkillRoot: fauna.approvedSkillRoot,
				reviewedAt: fauna.reviewedAt,
				approvalReference: fauna.approvalReference
			}
		}
	});
}

export async function resealFamilyProductionCompatibility(input: {
	repositoryRoot: string;
	write: boolean;
	approvalMetadata?: FamilyProductionResealApprovalMetadata;
}) {
	const skillRoot = join(input.repositoryRoot, 'skills/summonlab-image-production');
	const surface = await computeFamilyAffinityProductionSurface(skillRoot);
	if (input.approvalMetadata !== undefined && !input.write) {
		throw new Error('Explicit approval metadata is valid only with --write');
	}
	const approvalMetadata =
		input.approvalMetadata === undefined
			? await readExistingApprovalMetadata(input.repositoryRoot)
			: parseFamilyProductionResealApprovalMetadata(input.approvalMetadata);
	const legacyApproval = approvalMetadata.profiles[LEGACY_PROFILE];
	const faunaApproval = approvalMetadata.profiles[FAUNA_PROFILE];
	const contract = surface.contract as {
		skillVersion: string;
		repositoryDispatch: unknown;
		sealedLauncher: unknown;
		profiles: Record<string, Record<string, unknown>>;
	};
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
		executionSurface: {
			framing: surface.framing,
			files: surface.files,
			bundleSha256: surface.bundleSha256
		},
		repositoryDispatch: contract.repositoryDispatch,
		sealedLauncher: contract.sealedLauncher
	};
	const profileReceipt = (profileName: string, approvedSkillRoot: string) => {
		const profile = contract.profiles[profileName]!;
		return {
			...common,
			approvedSkillRoot,
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
		...profileReceipt(LEGACY_PROFILE, legacyApproval.approvedSkillRoot),
		bridgeExtension: legacyApproval.bridgeExtension,
		provisionalAnchorExtension: legacyApproval.provisionalAnchorExtension,
		reviewedAt: legacyApproval.reviewedAt,
		approvalReference: legacyApproval.approvalReference
	};
	const fauna = {
		...profileReceipt(FAUNA_PROFILE, faunaApproval.approvedSkillRoot),
		reviewedAt: faunaApproval.reviewedAt,
		approvalReference: faunaApproval.approvalReference
	};
	for (const receipt of [legacy, fauna]) {
		validateFamilyAffinityProductionCompatibility(receipt, surface.contractBytes);
	}
	const outputs = [
		{ path: LEGACY_RECEIPT_PATH, value: legacy },
		{ path: FAUNA_RECEIPT_PATH, value: fauna }
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
		approvedSkillRoots: {
			[LEGACY_PROFILE]: legacyApproval.approvedSkillRoot,
			[FAUNA_PROFILE]: faunaApproval.approvedSkillRoot
		},
		contractSha256: common.skillContractSha256,
		bundleSha256: surface.bundleSha256,
		outputs: outputs.map(({ path }) => path)
	};
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	const args = process.argv.slice(2);
	const write = args.includes('--write');
	const approvalFlag = args.indexOf('--approval-metadata');
	const supported = new Set(['--write', '--approval-metadata']);
	const positionalApprovalPath = approvalFlag === -1 ? undefined : args[approvalFlag + 1];
	const unknown = args.filter(
		(argument, index) =>
			!supported.has(argument) && !(approvalFlag !== -1 && index === approvalFlag + 1)
	);
	Promise.resolve()
		.then(async () => {
			if (unknown.length > 0 || (approvalFlag !== -1 && positionalApprovalPath === undefined)) {
				throw new Error(
					'Usage: reseal-family-production-compatibility.ts [--write] [--approval-metadata FILE]'
				);
			}
			const approvalMetadata =
				positionalApprovalPath === undefined
					? undefined
					: parseFamilyProductionResealApprovalMetadata(
							JSON.parse(await readFile(resolve(process.cwd(), positionalApprovalPath), 'utf8'))
						);
			return resealFamilyProductionCompatibility({
				repositoryRoot: process.cwd(),
				write,
				...(approvalMetadata === undefined ? {} : { approvalMetadata })
			});
		})
		.then((report) => console.log(JSON.stringify(report, null, 2)))
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		});
}

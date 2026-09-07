import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { format } from 'prettier';
import { z } from 'zod';

import { EQUIPMENT_DEFINITION_CATALOG } from '../packages/content/src/equipment.js';
import { EquipmentRuntimeVisualManifestSchema } from '../packages/contracts/src/index.js';

import {
	EQUIPMENT_APPROVED_MANIFEST_PATH,
	EQUIPMENT_APPROVED_RECEIPT_PATH,
	EquipmentApprovedPromotionReceiptV1Schema,
	EquipmentApprovedSourceManifestV1Schema
} from './equipment-approved-source-contract.js';
import {
	EQUIPMENT_RUNTIME_MANIFEST_PATH,
	validateEquipmentContentBindings,
	type EquipmentContentBindingValidation
} from './validate-equipment-content-bindings.js';

const execFile = promisify(execFileCallback);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const CommitHashSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const RepositoryPathSchema = z
	.string()
	.regex(/^(?!\/)(?!.*\\)(?!.*(?:^|\/)\.\.?(?:\/|$))[a-zA-Z0-9._/-]+$/u);

export const EQUIPMENT_INTEGRATION_REPORT_PATH =
	'assets/equipment/approved/material-equipment-v1/integration-report.json' as const;

export const EQUIPMENT_INTEGRATION_COMMITS = Object.freeze([
	{
		task: 'task-1',
		hash: '43f0fd7475f687b15fc7104176736fb78760d451',
		subject: 'feat(equipment): define approved source promotion'
	},
	{
		task: 'task-2',
		hash: '48cfd6a6b0e04fddde5917af7d919d24d243eed2',
		subject: 'feat(equipment): promote approved visual sources'
	},
	{
		task: 'task-3',
		hash: '17ff8678ebc28d03fce38af236c402f62b35cac5',
		subject: 'feat(equipment): export runtime visual catalog'
	},
	{
		task: 'task-4',
		hash: '25dc9e22215032bb05b439284332de22f2394a46',
		subject: 'feat(equipment): define material item catalog'
	},
	{
		task: 'task-5',
		hash: '33263c4de0294c328d09b6ecf61f07833e171c29',
		subject: 'feat(engine): add versioned equipment state'
	},
	{
		task: 'task-6',
		hash: 'd96f9c2bf5eacbf9ad97bf0b556a1d2ac1f3d493',
		subject: 'feat(forging): create standard equipment'
	},
	{
		task: 'task-6-correction',
		hash: 'c2ae7273d598e8664faebce7e8b6a6a135da3eb2',
		subject: 'fix(forging): support v24 catch-up'
	},
	{
		task: 'task-6-correction',
		hash: '5be6cabefaed24290bb03534a9bdcb3b7df6c5ee',
		subject: 'fix(engine): stop catch-up at target'
	},
	{
		task: 'task-7',
		hash: '17897a3ab78b8a2428dd3d5633105b6de1094ad8',
		subject: 'feat(web): add workshop equipment flow'
	},
	{
		task: 'task-8',
		hash: '057bf9235d1e92f432fcb246df4a1b293912cb0d',
		subject: 'feat(equipment): support authored item drops'
	}
] as const);

const CommitSchema = z
	.object({
		task: z.enum([
			'task-1',
			'task-2',
			'task-3',
			'task-4',
			'task-5',
			'task-6',
			'task-6-correction',
			'task-7',
			'task-8'
		]),
		hash: CommitHashSchema,
		subject: z.string().trim().min(1)
	})
	.strict();

const EvidenceArtifactSchema = z
	.object({ path: RepositoryPathSchema, sha256: HashSchema, purpose: z.string().trim().min(1) })
	.strict();

export const EquipmentIntegrationReportV1Schema = z
	.object({
		schemaVersion: z.literal('equipment-runtime-integration-report-v1'),
		reportId: z.literal('material-equipment-v1-runtime-integration'),
		status: z.literal('complete'),
		counts: z
			.object({
				approvedSources: z.literal(161),
				equippableSources: z.literal(140),
				armorSetReferences: z.literal(21),
				runtimeBundles: z.literal(140),
				runtimeAssets: z.literal(280),
				contentDefinitions: z.literal(140)
			})
			.strict(),
		manifests: z
			.object({
				approvedSources: z
					.object({
						path: z.literal(EQUIPMENT_APPROVED_MANIFEST_PATH),
						byteSha256: HashSchema,
						canonicalSha256: HashSchema
					})
					.strict(),
				runtimeVisuals: z
					.object({
						path: z.literal(EQUIPMENT_RUNTIME_MANIFEST_PATH),
						byteSha256: HashSchema,
						manifestHash: HashSchema,
						catalogVersion: z.literal('equipment-v1')
					})
					.strict(),
				content: z
					.object({
						contentVersion: z.literal('equipment-content-v1'),
						contentHash: HashSchema
					})
					.strict()
			})
			.strict(),
		runtime: z
			.object({
				engineVersion: z.literal('engine-v24'),
				stateCompatibility: z.literal('v1-v23-preserved'),
				itemFactory: z.literal('shared-definition-backed'),
				forging: z
					.object({
						status: z.literal('enabled'),
						enabledCraftsmanship: z.tuple([z.literal('standard')]),
						materialCost: z.literal('one-normalized-rank-bearing-lot'),
						activity: z.literal('settlement-workshop')
					})
					.strict(),
				drops: z
					.object({
						status: z.literal('authored-fixture-enabled'),
						frequencyModel: z.literal('not-global'),
						definitionCatalog: z.literal('shared-with-forging')
					})
					.strict(),
				loading: z.literal('lazy-per-definition')
			})
			.strict(),
		evidence: z
			.object({
				milestoneA: z
					.object({
						status: z.literal('passed'),
						claim: z.literal('approved-sources-exact-and-inert'),
						promotionReceiptPath: z.literal(EQUIPMENT_APPROVED_RECEIPT_PATH)
					})
					.strict(),
				milestoneB: z
					.object({
						status: z.literal('passed'),
						claim: z.literal('runtime-card-detail-budget-and-lazy-loading'),
						gallery: EvidenceArtifactSchema
					})
					.strict(),
				milestoneC: z
					.object({
						status: z.literal('passed'),
						claim: z.literal('phone-forge-persist-equip-and-reload'),
						phoneScreenshots: z.tuple([EvidenceArtifactSchema, EvidenceArtifactSchema]),
						e2ePath: z.literal('apps/web/src/routes/equipment-forging.e2e.ts')
					})
					.strict()
			})
			.strict(),
		validation: z
			.object({
				focusedStatus: z.literal('passed'),
				commands: z.tuple([
					z.literal('pnpm validate:equipment-approved-sources'),
					z.literal('pnpm validate:equipment-runtime-visuals'),
					z.literal('pnpm validate:equipment-content-bindings'),
					z.literal('pnpm validate:equipment-integration-report'),
					z.literal('pnpm vitest run tools/export-equipment-integration-report.spec.ts'),
					z.literal('pnpm tsc -p tools/tsconfig.equipment-promotion.json --noEmit'),
					z.literal('pnpm validate:wiki')
				]),
				rootCheckIncludesEquipmentValidators: z.literal(true)
			})
			.strict(),
		deferred: z.tuple([
			z.literal('fine-and-masterwork-thresholds-benefits-and-quality-visuals'),
			z.literal('full-gathering-economy-and-balance'),
			z.literal('monster-derived-equipment-and-visuals'),
			z.literal('broad-random-loot-frequency-and-balancing')
		]),
		noImageGeneration: z
			.object({
				performedDuringIntegration: z.literal(false),
				approvedBytesEqualSelectedCandidateBytes: z.literal(true),
				runtimeImagesAreDeterministicDerivatives: z.literal(true),
				evidence: z.literal('promotion-check-and-source-hash-equality')
			})
			.strict(),
		commits: z
			.object({
				reportedThroughCommit: z.literal('057bf9235d1e92f432fcb246df4a1b293912cb0d'),
				entries: z.array(CommitSchema).length(EQUIPMENT_INTEGRATION_COMMITS.length)
			})
			.strict(),
		closeout: z
			.object({
				task: z.literal('task-9'),
				status: z.literal('complete'),
				commitSubject: z.literal('docs(equipment): close runtime integration'),
				commitHash: z.null(),
				hashPolicy: z.literal('omitted-to-avoid-report-commit-self-reference')
			})
			.strict()
	})
	.strict()
	.superRefine((report, context) => {
		if (JSON.stringify(report.commits.entries) !== JSON.stringify(EQUIPMENT_INTEGRATION_COMMITS)) {
			context.addIssue({
				code: 'custom',
				path: ['commits', 'entries'],
				message: 'Commit evidence must exactly match the Task 1–8 integration ledger'
			});
		}
	});

export type EquipmentIntegrationReportV1 = z.infer<typeof EquipmentIntegrationReportV1Schema>;

type ReportInput = Readonly<{
	approvedManifest: {
		schemaVersion: 'equipment-approved-source-manifest-v1';
		catalogId: 'material-equipment-v1';
		summary: { total: number; items: number; armorSetReferences: number; totalBytes: number };
	};
	approvedManifestByteSha256: string;
	approvedManifestCanonicalSha256: string;
	runtimeManifest: {
		schemaVersion: 'equipment-runtime-visual-manifest-v1';
		catalogVersion: 'equipment-v1';
		manifestHash: string;
		summary: {
			bundleCount: number;
			assetCount: number;
			armorSetReferenceCount: number;
			cardBytes: number;
			detailBytes: number;
			totalBytes: number;
		};
	};
	runtimeManifestByteSha256: string;
	content: EquipmentContentBindingValidation;
	evidenceHashes: { runtimeGallery: string; phoneAssay: string; phoneLoadout: string };
	commits: readonly (typeof EQUIPMENT_INTEGRATION_COMMITS)[number][];
}>;

export function buildEquipmentIntegrationReport(input: ReportInput): EquipmentIntegrationReportV1 {
	if (
		input.approvedManifest.summary.total !== 161 ||
		input.approvedManifest.summary.items !== 140 ||
		input.approvedManifest.summary.armorSetReferences !== 21
	) {
		throw new Error('Integration report requires exact approved Equipment counts');
	}
	if (
		input.runtimeManifest.summary.bundleCount !== 140 ||
		input.runtimeManifest.summary.assetCount !== 280 ||
		input.runtimeManifest.summary.armorSetReferenceCount !== 0 ||
		input.content.definitionCount !== 140 ||
		input.content.status !== 'valid'
	) {
		throw new Error('Integration report requires exact runtime and content Equipment counts');
	}

	return EquipmentIntegrationReportV1Schema.parse({
		schemaVersion: 'equipment-runtime-integration-report-v1',
		reportId: 'material-equipment-v1-runtime-integration',
		status: 'complete',
		counts: {
			approvedSources: 161,
			equippableSources: 140,
			armorSetReferences: 21,
			runtimeBundles: 140,
			runtimeAssets: 280,
			contentDefinitions: 140
		},
		manifests: {
			approvedSources: {
				path: EQUIPMENT_APPROVED_MANIFEST_PATH,
				byteSha256: input.approvedManifestByteSha256,
				canonicalSha256: input.approvedManifestCanonicalSha256
			},
			runtimeVisuals: {
				path: EQUIPMENT_RUNTIME_MANIFEST_PATH,
				byteSha256: input.runtimeManifestByteSha256,
				manifestHash: input.runtimeManifest.manifestHash,
				catalogVersion: input.runtimeManifest.catalogVersion
			},
			content: {
				contentVersion: input.content.contentVersion,
				contentHash: input.content.contentHash
			}
		},
		runtime: {
			engineVersion: 'engine-v24',
			stateCompatibility: 'v1-v23-preserved',
			itemFactory: 'shared-definition-backed',
			forging: {
				status: 'enabled',
				enabledCraftsmanship: ['standard'],
				materialCost: 'one-normalized-rank-bearing-lot',
				activity: 'settlement-workshop'
			},
			drops: {
				status: 'authored-fixture-enabled',
				frequencyModel: 'not-global',
				definitionCatalog: 'shared-with-forging'
			},
			loading: 'lazy-per-definition'
		},
		evidence: {
			milestoneA: {
				status: 'passed',
				claim: 'approved-sources-exact-and-inert',
				promotionReceiptPath: EQUIPMENT_APPROVED_RECEIPT_PATH
			},
			milestoneB: {
				status: 'passed',
				claim: 'runtime-card-detail-budget-and-lazy-loading',
				gallery: {
					path: 'assets/equipment/approved/material-equipment-v1/reviews/runtime-v1/index.html',
					sha256: input.evidenceHashes.runtimeGallery,
					purpose: 'All 140 card/detail runtime pairs in one review surface.'
				}
			},
			milestoneC: {
				status: 'passed',
				claim: 'phone-forge-persist-equip-and-reload',
				phoneScreenshots: [
					{
						path: 'docs/evidence/equipment-workshop-phone-assay-v1.png',
						sha256: input.evidenceHashes.phoneAssay,
						purpose: '390x844@2x Standard forge assay and detail-image evidence.'
					},
					{
						path: 'docs/evidence/equipment-workshop-phone-loadout-v1.png',
						sha256: input.evidenceHashes.phoneLoadout,
						purpose: '390x844@2x persisted inventory and legal loadout evidence.'
					}
				],
				e2ePath: 'apps/web/src/routes/equipment-forging.e2e.ts'
			}
		},
		validation: {
			focusedStatus: 'passed',
			commands: [
				'pnpm validate:equipment-approved-sources',
				'pnpm validate:equipment-runtime-visuals',
				'pnpm validate:equipment-content-bindings',
				'pnpm validate:equipment-integration-report',
				'pnpm vitest run tools/export-equipment-integration-report.spec.ts',
				'pnpm tsc -p tools/tsconfig.equipment-promotion.json --noEmit',
				'pnpm validate:wiki'
			],
			rootCheckIncludesEquipmentValidators: true
		},
		deferred: [
			'fine-and-masterwork-thresholds-benefits-and-quality-visuals',
			'full-gathering-economy-and-balance',
			'monster-derived-equipment-and-visuals',
			'broad-random-loot-frequency-and-balancing'
		],
		noImageGeneration: {
			performedDuringIntegration: false,
			approvedBytesEqualSelectedCandidateBytes: true,
			runtimeImagesAreDeterministicDerivatives: true,
			evidence: 'promotion-check-and-source-hash-equality'
		},
		commits: {
			reportedThroughCommit: '057bf9235d1e92f432fcb246df4a1b293912cb0d',
			entries: input.commits
		},
		closeout: {
			task: 'task-9',
			status: 'complete',
			commitSubject: 'docs(equipment): close runtime integration',
			commitHash: null,
			hashPolicy: 'omitted-to-avoid-report-commit-self-reference'
		}
	});
}

function sha256(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

async function readJson(repositoryRoot: string, repositoryPath: string): Promise<unknown> {
	return JSON.parse(
		await readFile(path.resolve(repositoryRoot, repositoryPath), 'utf8')
	) as unknown;
}

async function verifyCommitEvidence(repositoryRoot: string): Promise<void> {
	for (const commit of EQUIPMENT_INTEGRATION_COMMITS) {
		const { stdout } = await execFile('git', ['show', '-s', '--format=%H%x09%s', commit.hash], {
			cwd: repositoryRoot
		});
		if (stdout.trim() !== `${commit.hash}\t${commit.subject}`) {
			throw new Error(`Equipment integration commit evidence drift: ${commit.task}`);
		}
	}
}

export async function buildRepositoryEquipmentIntegrationReport(
	repositoryRoot = process.cwd()
): Promise<EquipmentIntegrationReportV1> {
	const approvedBytes = await readFile(
		path.resolve(repositoryRoot, EQUIPMENT_APPROVED_MANIFEST_PATH)
	);
	const runtimeBytes = await readFile(
		path.resolve(repositoryRoot, EQUIPMENT_RUNTIME_MANIFEST_PATH)
	);
	const approvedManifest = EquipmentApprovedSourceManifestV1Schema.parse(
		JSON.parse(approvedBytes.toString('utf8'))
	);
	const runtimeManifest = EquipmentRuntimeVisualManifestSchema.parse(
		JSON.parse(runtimeBytes.toString('utf8'))
	);
	const promotionReceipt = EquipmentApprovedPromotionReceiptV1Schema.parse(
		await readJson(repositoryRoot, EQUIPMENT_APPROVED_RECEIPT_PATH)
	);
	const content = validateEquipmentContentBindings({
		catalog: EQUIPMENT_DEFINITION_CATALOG,
		approvedManifest,
		runtimeManifest
	});
	await verifyCommitEvidence(repositoryRoot);

	const evidencePath = (repositoryPath: string) =>
		readFile(path.resolve(repositoryRoot, repositoryPath)).then(sha256);
	return buildEquipmentIntegrationReport({
		approvedManifest,
		approvedManifestByteSha256: sha256(approvedBytes),
		approvedManifestCanonicalSha256: promotionReceipt.approvedManifest.canonicalSha256,
		runtimeManifest,
		runtimeManifestByteSha256: sha256(runtimeBytes),
		content,
		evidenceHashes: {
			runtimeGallery: await evidencePath(
				'assets/equipment/approved/material-equipment-v1/reviews/runtime-v1/index.html'
			),
			phoneAssay: await evidencePath('docs/evidence/equipment-workshop-phone-assay-v1.png'),
			phoneLoadout: await evidencePath('docs/evidence/equipment-workshop-phone-loadout-v1.png')
		},
		commits: EQUIPMENT_INTEGRATION_COMMITS
	});
}

export async function exportEquipmentIntegrationReport(input: {
	repositoryRoot?: string;
	mode: 'write' | 'check';
}): Promise<EquipmentIntegrationReportV1> {
	const repositoryRoot = path.resolve(input.repositoryRoot ?? process.cwd());
	const report = await buildRepositoryEquipmentIntegrationReport(repositoryRoot);
	const outputPath = path.resolve(repositoryRoot, EQUIPMENT_INTEGRATION_REPORT_PATH);
	const expected = await format(JSON.stringify(report), {
		filepath: outputPath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
	if (input.mode === 'check') {
		const current = await readFile(outputPath, 'utf8').catch(() => '');
		if (current !== expected) {
			throw new Error(
				`Equipment integration report is stale: ${EQUIPMENT_INTEGRATION_REPORT_PATH}`
			);
		}
	} else {
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, expected, 'utf8');
	}
	return report;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === path.resolve(import.meta.filename)) {
	const report = await exportEquipmentIntegrationReport({
		mode: process.argv.includes('--check') ? 'check' : 'write'
	});
	process.stdout.write(
		`Equipment integration ${report.status}: ${report.counts.contentDefinitions} definitions, ${report.counts.runtimeAssets} runtime assets.\n`
	);
}

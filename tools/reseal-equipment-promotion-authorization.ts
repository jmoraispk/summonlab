import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CONTRACT_PATH = 'tools/equipment-approved-source-contract.ts';
const CONTRACT_SPEC_PATH = 'tools/equipment-approved-source-contract.spec.ts';
const DESIGN_PATH =
	'docs/superpowers/specs/2026-09-03-equipment-promotion-runtime-integration-design.md';
const PLAN_PATH = 'docs/superpowers/plans/2026-09-03-equipment-promotion-runtime-integration.md';
const RECEIPT_PATH = 'assets/equipment/approved/material-equipment-v1/receipts/promotion-v1.json';
const APPROVED_MANIFEST_PATH = 'assets/equipment/approved/material-equipment-v1/manifest.json';
const V3_MANIFEST_PATH = 'assets/equipment/experiments/material-equipment-v3/manifest.json';
const PROPOSAL_PATH =
	'assets/equipment/experiments/material-equipment-v3/reviews/proposed-promotions/candidate-promotion-v1.json';
const CHECKPOINT_PATHS = [
	'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-1-directions.json',
	'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-2-roots.json',
	'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-3-armor-pieces.json'
] as const;

interface AuthorizationDigests {
	readonly designSha256: string;
	readonly planSha256: string;
}

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function canonicalSha256(value: unknown): string {
	function canonicalize(child: unknown): unknown {
		if (Array.isArray(child)) return child.map(canonicalize);
		if (child !== null && typeof child === 'object') {
			return Object.fromEntries(
				Object.entries(child as Record<string, unknown>)
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([key, item]) => [key, canonicalize(item)])
			);
		}
		return child;
	}
	return sha256(JSON.stringify(canonicalize(value)));
}

function readConstant(contract: string, name: string): string {
	const match = contract.match(new RegExp(`${name}\\s*=\\s*'([a-f0-9]{64})'`, 'u'));
	if (match?.[1] === undefined) throw new Error(`Missing equipment authorization constant ${name}`);
	return match[1];
}

function replaceConstant(
	contract: string,
	name: string,
	previous: string,
	current: string
): string {
	const pattern = new RegExp(`(${name}\\s*=\\s*')${previous}(')`, 'u');
	if (!pattern.test(contract)) {
		throw new Error(`Equipment authorization constant has an unexpected layout: ${name}`);
	}
	return contract.replace(pattern, `$1${current}$2`);
}

export function resealEquipmentPromotionAuthorizationConstants(input: {
	readonly contract: string;
	readonly designContents: string | Uint8Array;
	readonly planContents: string | Uint8Array;
}): {
	readonly contract: string;
	readonly previous: AuthorizationDigests;
	readonly current: AuthorizationDigests;
	readonly changed: boolean;
} {
	const previous = {
		designSha256: readConstant(input.contract, 'EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256'),
		planSha256: readConstant(input.contract, 'EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256')
	};
	const current = {
		designSha256: sha256(input.designContents),
		planSha256: sha256(input.planContents)
	};
	let contract = input.contract;
	if (previous.designSha256 !== current.designSha256) {
		contract = replaceConstant(
			contract,
			'EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256',
			previous.designSha256,
			current.designSha256
		);
	}
	if (previous.planSha256 !== current.planSha256) {
		contract = replaceConstant(
			contract,
			'EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256',
			previous.planSha256,
			current.planSha256
		);
	}
	return { contract, previous, current, changed: contract !== input.contract };
}

function replaceFixtureAuthorizationDigest(
	fixture: string,
	path: string,
	constant: string,
	acceptedDigests: readonly string[]
): string {
	const literal = acceptedDigests.map((digest) => `'${digest}'`).join('|');
	const pattern = new RegExp(
		`(path: '${path.replaceAll('/', '\\/')}',\\n\\s+sha256: )(?:${literal}|${constant})`,
		'u'
	);
	if (!pattern.test(fixture)) {
		throw new Error(`Equipment authorization fixture has an unexpected layout: ${path}`);
	}
	return fixture.replace(pattern, `$1${constant}`);
}

export function resealEquipmentPromotionAuthorizationFixture(
	fixture: string,
	previous: AuthorizationDigests,
	current: AuthorizationDigests = previous
): string {
	let resealed = fixture;
	if (!resealed.includes('EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256,')) {
		resealed = resealed.replace(
			'import {\n',
			'import {\n\tEQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256,\n\tEQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256,\n'
		);
	}
	resealed = replaceFixtureAuthorizationDigest(
		resealed,
		DESIGN_PATH,
		'EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256',
		[previous.designSha256, current.designSha256]
	);
	return replaceFixtureAuthorizationDigest(
		resealed,
		PLAN_PATH,
		'EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256',
		[previous.planSha256, current.planSha256]
	);
}

interface DigestRecord {
	readonly sha256?: string;
	readonly [key: string]: unknown;
}

interface AuthorizationRecord {
	readonly design?: DigestRecord;
	readonly implementationPlan?: DigestRecord;
	readonly [key: string]: unknown;
}

interface PromotionReceipt {
	readonly authorization?: AuthorizationRecord;
	readonly approvedManifest?: Record<string, unknown>;
	readonly [key: string]: unknown;
}

interface PromotionPlan {
	readonly authorization?: AuthorizationRecord;
	readonly sourceProposal?: unknown;
	readonly checkpoints?: unknown;
	readonly summary?: unknown;
	readonly [key: string]: unknown;
}

type JsonRecord = Record<string, unknown>;

export function resealEquipmentPromotionAuthorizationReceipt(input: {
	readonly receipt: PromotionReceipt;
	readonly previous: AuthorizationDigests;
	readonly promotionPlan: PromotionPlan;
	readonly promotionPlanSha256: string;
	readonly manifestCanonicalSha256: string;
}): PromotionReceipt {
	if (
		input.receipt.authorization?.design?.sha256 !== input.previous.designSha256 ||
		input.receipt.authorization?.implementationPlan?.sha256 !== input.previous.planSha256
	) {
		throw new Error('Equipment promotion receipt does not match the authorization preimage');
	}
	const authorization = input.promotionPlan.authorization;
	if (authorization === undefined) {
		throw new Error('Rebuilt equipment promotion plan lacks authorization');
	}
	return {
		...input.receipt,
		authorization,
		planCanonicalSha256: input.promotionPlanSha256,
		approvedManifest: {
			...input.receipt.approvedManifest,
			canonicalSha256: input.manifestCanonicalSha256
		},
		sourceProposal: input.promotionPlan.sourceProposal,
		checkpoints: input.promotionPlan.checkpoints,
		summary: input.promotionPlan.summary
	};
}

export function projectEquipmentPromotionBuildInputs(input: {
	readonly manifest: JsonRecord;
	readonly proposal: JsonRecord;
	readonly checkpoints: readonly [JsonRecord, JsonRecord, JsonRecord];
}): {
	readonly proposal: JsonRecord;
	readonly checkpoints: readonly [JsonRecord, JsonRecord, JsonRecord];
} {
	const manifestCanonicalSha256 = canonicalSha256(input.manifest);
	const checkpoints = input.checkpoints.map((checkpoint) => ({
		...checkpoint,
		manifestCanonicalSha256
	})) as unknown as readonly [JsonRecord, JsonRecord, JsonRecord];
	const checkpoint3 = input.proposal.checkpoint3;
	if (checkpoint3 === null || typeof checkpoint3 !== 'object' || Array.isArray(checkpoint3)) {
		throw new Error('Equipment promotion proposal lacks checkpoint 3');
	}
	return {
		checkpoints,
		proposal: {
			...input.proposal,
			checkpoint3: {
				...(checkpoint3 as JsonRecord),
				canonicalSha256: canonicalSha256(checkpoints[2])
			}
		}
	};
}

function resealCanonicalReference(
	value: unknown,
	digestsByPath: ReadonlyMap<string, string>
): unknown {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
	const record = value as JsonRecord;
	const repositoryPath = record.path;
	const digest = typeof repositoryPath === 'string' ? digestsByPath.get(repositoryPath) : undefined;
	return digest === undefined ? record : { ...record, canonicalSha256: digest };
}

export function projectEquipmentPromotionAuthorizationLineage(input: {
	readonly receipt: PromotionReceipt;
	readonly approvedManifest: JsonRecord;
	readonly v3Manifest: JsonRecord;
	readonly proposal: JsonRecord;
	readonly checkpoints: readonly [JsonRecord, JsonRecord, JsonRecord];
	readonly previous: AuthorizationDigests;
	readonly current: AuthorizationDigests;
}): {
	readonly receipt: PromotionReceipt;
	readonly approvedManifest: JsonRecord;
	readonly proposal: JsonRecord;
	readonly checkpoints: readonly [JsonRecord, JsonRecord, JsonRecord];
} {
	const projected = projectEquipmentPromotionBuildInputs({
		manifest: input.v3Manifest,
		proposal: input.proposal,
		checkpoints: input.checkpoints
	});
	const checkpointDigests = new Map(
		CHECKPOINT_PATHS.map((repositoryPath, index) => [
			repositoryPath,
			canonicalSha256(projected.checkpoints[index])
		])
	);
	const sourceProposal = {
		...(input.receipt.sourceProposal as JsonRecord),
		canonicalSha256: canonicalSha256(projected.proposal)
	};
	const sourceManifest = {
		...(input.approvedManifest.sourceManifest as JsonRecord),
		canonicalSha256: canonicalSha256(input.v3Manifest)
	};
	const records = (input.approvedManifest.records as unknown[]).map((value) => {
		const record = value as JsonRecord;
		return {
			...record,
			checkpoint: resealCanonicalReference(record.checkpoint, checkpointDigests)
		};
	});
	const approvedManifest = {
		...input.approvedManifest,
		sourceProposal,
		sourceManifest,
		records
	};
	const authorization = {
		...(input.receipt.authorization as JsonRecord),
		design: {
			...((input.receipt.authorization?.design ?? {}) as JsonRecord),
			sha256: input.current.designSha256
		},
		implementationPlan: {
			...((input.receipt.authorization?.implementationPlan ?? {}) as JsonRecord),
			sha256: input.current.planSha256
		}
	};
	const receiptCheckpoints = Object.fromEntries(
		Object.entries(input.receipt.checkpoints as JsonRecord).map(([key, value]) => [
			key,
			resealCanonicalReference(value, checkpointDigests)
		])
	);
	const promotionPlan = {
		schemaVersion: 'equipment-approved-promotion-plan-v1',
		planId: 'material-equipment-v1-approved-promotion-v1',
		authorization,
		sourceProposal,
		sourceManifest,
		checkpoints: receiptCheckpoints,
		summary: input.receipt.summary,
		entries: records
	};
	return {
		checkpoints: projected.checkpoints,
		proposal: projected.proposal,
		approvedManifest,
		receipt: resealEquipmentPromotionAuthorizationReceipt({
			receipt: input.receipt,
			previous: input.previous,
			promotionPlan,
			promotionPlanSha256: canonicalSha256(promotionPlan),
			manifestCanonicalSha256: canonicalSha256(approvedManifest)
		})
	};
}

async function main(): Promise<void> {
	const repositoryRoot = process.cwd();
	const absolute = (repositoryPath: string): string =>
		path.join(repositoryRoot, ...repositoryPath.split('/'));
	const [
		contract,
		contractSpec,
		designContents,
		planContents,
		receiptContents,
		approvedManifestContents,
		v3ManifestContents,
		proposalContents,
		...checkpointContents
	] = await Promise.all([
		readFile(absolute(CONTRACT_PATH), 'utf8'),
		readFile(absolute(CONTRACT_SPEC_PATH), 'utf8'),
		readFile(absolute(DESIGN_PATH)),
		readFile(absolute(PLAN_PATH)),
		readFile(absolute(RECEIPT_PATH), 'utf8'),
		readFile(absolute(APPROVED_MANIFEST_PATH), 'utf8'),
		readFile(absolute(V3_MANIFEST_PATH), 'utf8'),
		readFile(absolute(PROPOSAL_PATH), 'utf8'),
		...CHECKPOINT_PATHS.map((repositoryPath) => readFile(absolute(repositoryPath), 'utf8'))
	]);
	const constants = resealEquipmentPromotionAuthorizationConstants({
		contract,
		designContents,
		planContents
	});
	const contractSpecResealed = resealEquipmentPromotionAuthorizationFixture(
		contractSpec,
		constants.previous,
		constants.current
	);
	if (!constants.changed) {
		process.stdout.write(`${JSON.stringify({ resealed: false })}\n`);
		return;
	}
	const receipt = JSON.parse(receiptContents) as PromotionReceipt;
	if (
		receipt.authorization?.design?.sha256 !== constants.previous.designSha256 ||
		receipt.authorization?.implementationPlan?.sha256 !== constants.previous.planSha256
	) {
		throw new Error('Equipment promotion receipt does not match the authorization preimage');
	}
	await writeFile(absolute(CONTRACT_PATH), constants.contract, 'utf8');
	try {
		const projected = projectEquipmentPromotionAuthorizationLineage({
			receipt,
			approvedManifest: JSON.parse(approvedManifestContents) as JsonRecord,
			v3Manifest: JSON.parse(v3ManifestContents) as JsonRecord,
			proposal: JSON.parse(proposalContents) as JsonRecord,
			checkpoints: checkpointContents.map((contents) => JSON.parse(contents) as JsonRecord) as [
				JsonRecord,
				JsonRecord,
				JsonRecord
			],
			previous: constants.previous,
			current: constants.current
		});
		await Promise.all([
			writeFile(absolute(CONTRACT_PATH), constants.contract, 'utf8'),
			writeFile(absolute(CONTRACT_SPEC_PATH), contractSpecResealed, 'utf8'),
			writeFile(absolute(RECEIPT_PATH), `${JSON.stringify(projected.receipt, null, '\t')}\n`),
			writeFile(
				absolute(APPROVED_MANIFEST_PATH),
				`${JSON.stringify(projected.approvedManifest, null, '\t')}\n`
			),
			writeFile(absolute(PROPOSAL_PATH), `${JSON.stringify(projected.proposal, null, '\t')}\n`),
			...CHECKPOINT_PATHS.map((repositoryPath, index) =>
				writeFile(
					absolute(repositoryPath),
					`${JSON.stringify(projected.checkpoints[index], null, '\t')}\n`
				)
			)
		]);
	} catch (error) {
		await Promise.all([
			writeFile(absolute(CONTRACT_PATH), contract, 'utf8'),
			writeFile(absolute(CONTRACT_SPEC_PATH), contractSpec, 'utf8')
		]);
		throw error;
	}
	process.stdout.write(`${JSON.stringify({ resealed: true, current: constants.current })}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}

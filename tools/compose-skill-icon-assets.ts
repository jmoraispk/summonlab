import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	SkillIconCatalogSchema,
	SkillIconAssignmentSchema,
	SkillIconExecutionSchema,
	SkillIconGeometrySchema,
	SkillIconMasterPathSchema,
	SkillIconMasterySchema,
	SkillIconRaritySchema,
	SkillIconResultSchema,
	SkillIconReviewSchema,
	SkillIconTargetSchema,
	type SkillIconAsset,
	type SkillIconMastery,
	type SkillIconRarity
} from '../packages/contracts/src/index.js';
import { SKILL_ICON_CATALOG_PATH } from './export-skill-icon-production.js';
import {
	SKILL_ICON_PROMOTION_RECEIPT_ROOT,
	SkillIconPromotionReceiptSchema
} from './skill-icon-promotion-contract.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

export const SKILL_ICON_BACKING_MASTER_PATH =
	'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png' as const;
export const SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH =
	'assets/wiki/skills/icon-production-v1/review/reference-assets-v1.png' as const;
export const SKILL_ICON_PILOT_CONTACT_SHEET_PATH =
	'assets/wiki/skills/icon-production-v1/review/pilot-icons-v1.png' as const;

export const SKILL_ICON_PILOT_TARGET_IDS = [
	'martial:blade:horizontal-slash',
	'martial:blade:crescent-sweep',
	'martial:blade:wind-slash',
	'martial:blade:rising-moon',
	'martial:blade:ten-thousand-leaves',
	'magical:elemental:fireball',
	'magical:elemental:great-fireball',
	'magical:elemental:charged-fireball',
	'magical:elemental:meteor',
	'magical:elemental:sunfall',
	'craft:forging:ore-sense',
	'craft:forging:simple-smithing',
	'craft:forging:weaponsmithing',
	'craft:forging:armoursmithing',
	'craft:forging:godsmithing'
] as const;

const WORKING_SIZE = 1024;
const RUNTIME_SIZES = [512, 256, 128] as const;
const RECOGNITION_SIZE = 96;
const REVIEW_CARD_WIDTH = 640;
const REVIEW_HEX_SIZE = 512;
const REVIEW_LABEL_HEIGHT = 160;
const REVIEW_CARD_HEIGHT = REVIEW_HEX_SIZE + REVIEW_LABEL_HEIGHT;
const CONTACT_SHEET_GAP = 24;
const SKILL_TARGET_PATTERN =
	/^(?:martial|magical|craft):[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export interface ComposeSkillHexInput {
	readonly backingPath: string;
	readonly artPath: string;
	readonly framePath: string;
}

export interface SkillIconRuntimeSourceRecord {
	readonly targetId: string;
	readonly rarity: SkillIconRarity;
	readonly assets: {
		readonly approvedMaster: { readonly path: string };
	};
}

export interface SkillIconDerivedAssets {
	readonly runtime512: SkillIconAsset;
	readonly runtime256: SkillIconAsset;
	readonly runtime128: SkillIconAsset;
	readonly recognition96: SkillIconAsset;
}

export interface SkillIconDerivativeBuffers {
	readonly runtime512: Buffer;
	readonly runtime256: Buffer;
	readonly runtime128: Buffer;
	readonly recognition96: Buffer;
}

export interface SkillIconReviewCardInput {
	readonly composite: Buffer;
	readonly name: string;
	readonly mastery: SkillIconMastery;
	readonly level: number;
	readonly rarity: SkillIconRarity;
}

export type SkillIconRuntimeExportMode = 'check' | 'write';
export type SkillIconRuntimeExportScope = 'all' | 'pilot' | 'references';

export interface SkillIconRuntimeExportReport {
	readonly mode: SkillIconRuntimeExportMode;
	readonly scope: SkillIconRuntimeExportScope;
	readonly records: readonly {
		readonly targetId: string;
		readonly current: boolean;
		readonly assets: SkillIconDerivedAssets;
	}[];
	readonly contactSheet: {
		readonly path:
			typeof SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH | typeof SKILL_ICON_PILOT_CONTACT_SHEET_PATH;
		readonly current: boolean;
		readonly itemCount: number;
		readonly bytes: number;
		readonly contentHash: string;
	} | null;
	readonly orphanPaths: readonly string[];
	readonly drift: readonly string[];
	readonly inSync: boolean;
	readonly written: boolean;
}

interface PromotionDerivativeInput {
	readonly root: string;
	readonly target: {
		readonly role: 'skill-art';
		readonly skillTargetId: string;
	};
	readonly candidate: { readonly bytes: Buffer; readonly contentHash: string };
}

interface PlannedDerivative {
	readonly name: keyof SkillIconDerivedAssets;
	readonly asset: SkillIconAsset;
	readonly bytes: Buffer;
}

interface PlannedContactSheet {
	readonly path:
		typeof SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH | typeof SKILL_ICON_PILOT_CONTACT_SHEET_PATH;
	readonly bytes: Buffer;
	readonly itemCount: number;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function inside(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function metadataOrNull(location: string) {
	return lstat(location).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
}

async function readDirectRegularFile(location: string, label: string): Promise<Buffer> {
	const absolute = path.resolve(location);
	const before = await lstat(absolute);
	if (before.isSymbolicLink() || !before.isFile()) {
		throw new Error(`${label} must be a regular file, not a symbolic link`);
	}
	if ((await realpath(absolute)) !== absolute) {
		throw new Error(`${label} path may not traverse symbolic links`);
	}
	const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const opened = await handle.stat();
		if (opened.dev !== before.dev || opened.ino !== before.ino) {
			throw new Error(`${label} changed while opening`);
		}
		const bytes = await handle.readFile();
		const after = await lstat(absolute);
		if (
			after.isSymbolicLink() ||
			!after.isFile() ||
			after.dev !== opened.dev ||
			after.ino !== opened.ino ||
			(await realpath(absolute)) !== absolute
		) {
			throw new Error(`${label} changed while reading`);
		}
		return bytes;
	} finally {
		await handle.close();
	}
}

async function readLayer(location: string, label: string): Promise<Buffer> {
	const bytes = await readDirectRegularFile(location, label);
	const metadata = await sharp(bytes).metadata();
	if (
		metadata.format !== 'png' ||
		metadata.width !== WORKING_SIZE ||
		metadata.height !== WORKING_SIZE ||
		!metadata.hasAlpha
	) {
		throw new Error(`${label} must be a ${WORKING_SIZE}x${WORKING_SIZE} RGBA PNG`);
	}
	return bytes;
}

async function composeSkillHexBuffers(input: {
	readonly backing: Buffer;
	readonly art: Buffer;
	readonly frame: Buffer;
}): Promise<Buffer> {
	const layers = [
		{ input: input.backing, blend: 'over' as const },
		{ input: input.art, blend: 'over' as const },
		{ input: input.frame, blend: 'over' as const }
	];
	return sharp({
		create: {
			width: WORKING_SIZE,
			height: WORKING_SIZE,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite(layers)
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

export async function composeSkillHex(input: ComposeSkillHexInput): Promise<Buffer> {
	const [backing, art, frame] = await Promise.all([
		readLayer(input.backingPath, 'Skill icon backing'),
		readLayer(input.artPath, 'Skill icon artwork'),
		readLayer(input.framePath, 'Skill icon rarity frame')
	]);
	return composeSkillHexBuffers({ backing, art, frame });
}

async function renderDerivativeBuffers(composite: Buffer): Promise<SkillIconDerivativeBuffers> {
	const runtime = async (size: (typeof RUNTIME_SIZES)[number]): Promise<Buffer> =>
		sharp(composite)
			.resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
			.ensureAlpha()
			.webp({ lossless: true, quality: 100, alphaQuality: 100, effort: 6, smartSubsample: false })
			.toBuffer();
	const recognition96 = sharp(composite)
		.resize(RECOGNITION_SIZE, RECOGNITION_SIZE, {
			fit: 'fill',
			kernel: sharp.kernel.lanczos3
		})
		.ensureAlpha()
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	const [runtime512, runtime256, runtime128, recognition] = await Promise.all([
		runtime(512),
		runtime(256),
		runtime(128),
		recognition96
	]);
	return { runtime512, runtime256, runtime128, recognition96: recognition };
}

function targetSlug(targetId: string): string {
	if (!SKILL_TARGET_PATTERN.test(targetId)) throw new Error(`Invalid skill target ID: ${targetId}`);
	return targetId.replaceAll(':', '-');
}

function framePathFor(rarity: SkillIconRarity): string {
	return `assets/wiki/skills/icon-production-v1/masters/frames/${rarity.toLowerCase()}.png`;
}

function derivativePlan(
	targetId: string,
	buffers: SkillIconDerivativeBuffers
): PlannedDerivative[] {
	const slug = targetSlug(targetId);
	return [
		{
			name: 'runtime512',
			bytes: buffers.runtime512,
			asset: assetFor(
				buffers.runtime512,
				`apps/web/static/skill-icons/v1/512/${slug}.webp`,
				'image/webp',
				512
			)
		},
		{
			name: 'runtime256',
			bytes: buffers.runtime256,
			asset: assetFor(
				buffers.runtime256,
				`apps/web/static/skill-icons/v1/256/${slug}.webp`,
				'image/webp',
				256
			)
		},
		{
			name: 'runtime128',
			bytes: buffers.runtime128,
			asset: assetFor(
				buffers.runtime128,
				`apps/web/static/skill-icons/v1/128/${slug}.webp`,
				'image/webp',
				128
			)
		},
		{
			name: 'recognition96',
			bytes: buffers.recognition96,
			asset: assetFor(
				buffers.recognition96,
				`assets/wiki/skills/icon-production-v1/review/recognition/${slug}.png`,
				'image/png',
				96
			)
		}
	];
}

function assetFor(
	bytes: Buffer,
	assetPath: string,
	mediaType: 'image/png' | 'image/webp',
	size: number
): SkillIconAsset {
	return {
		path: assetPath,
		mediaType,
		width: size,
		height: size,
		bytes: bytes.byteLength,
		alphaMode: 'rgba',
		contentHash: sha256(bytes)
	};
}

function assetsFromPlan(plan: readonly PlannedDerivative[]): SkillIconDerivedAssets {
	return Object.fromEntries(
		plan.map((item) => [item.name, item.asset])
	) as unknown as SkillIconDerivedAssets;
}

async function assertRepositoryPath(
	root: string,
	relativePath: string,
	label: string,
	allowMissingFile: boolean
): Promise<string> {
	if (path.isAbsolute(relativePath) || relativePath.includes('\\')) {
		throw new Error(`${label} must be a repository-relative POSIX path`);
	}
	const segments = relativePath.split('/');
	if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
		throw new Error(`${label} contains an unsafe path segment`);
	}
	const absoluteRoot = path.resolve(root);
	const resolvedRoot = await realpath(absoluteRoot);
	if (resolvedRoot !== absoluteRoot)
		throw new Error('Workspace root may not traverse symbolic links');
	let current = absoluteRoot;
	for (const [index, segment] of segments.entries()) {
		current = path.join(current, segment);
		const metadata = await metadataOrNull(current);
		const last = index === segments.length - 1;
		if (!metadata) {
			if (last && allowMissingFile) return current;
			if (allowMissingFile) continue;
			throw new Error(`${label} does not exist: ${relativePath}`);
		}
		if (metadata.isSymbolicLink()) throw new Error(`${label} may not traverse symbolic links`);
		if (last ? !metadata.isFile() : !metadata.isDirectory()) {
			throw new Error(`${label} has an invalid filesystem type`);
		}
	}
	if (!inside(absoluteRoot, current)) throw new Error(`${label} escaped the workspace root`);
	return current;
}

async function readRepositoryLayer(
	root: string,
	relativePath: string,
	label: string
): Promise<Buffer> {
	const absolute = await assertRepositoryPath(root, relativePath, label, false);
	return readLayer(absolute, label);
}

async function listRepositoryJsonFiles(root: string, relativeDirectory: string): Promise<string[]> {
	const segments = relativeDirectory.split('/');
	let current = path.resolve(root);
	for (const segment of segments) {
		current = path.join(current, segment);
		const metadata = await metadataOrNull(current);
		if (!metadata || metadata.isSymbolicLink() || !metadata.isDirectory()) {
			throw new Error(`Required directory is missing or unsafe: ${relativeDirectory}`);
		}
	}
	const entries = await readdir(current, { withFileTypes: true });
	return entries
		.filter((entry) => entry.name.endsWith('.json'))
		.map((entry) => {
			if (!entry.isFile() || entry.isSymbolicLink()) {
				throw new Error(`JSON authority contains an unsafe entry: ${entry.name}`);
			}
			return `${relativeDirectory}/${entry.name}`;
		})
		.sort((left, right) => left.localeCompare(right));
}

async function readRepositoryJson(
	root: string,
	relativePath: string,
	label: string
): Promise<unknown> {
	const location = await assertRepositoryPath(root, relativePath, label, false);
	return JSON.parse((await readDirectRegularFile(location, label)).toString('utf8')) as unknown;
}

function referenceMasterPathFor(target: ReturnType<typeof SkillIconTargetSchema.parse>): string {
	if (target.role === 'rarity-frame') {
		return `assets/wiki/skills/icon-production-v1/masters/frames/${target.rarity.toLowerCase()}.png`;
	}
	if (target.role === 'backing') {
		return `assets/wiki/skills/icon-production-v1/masters/backing/${target.jobId.replace(/-v\d+$/u, '')}.png`;
	}
	throw new Error(`Expected a backing or rarity-frame target, received ${target.role}`);
}

async function loadGeometrySecure(root: string) {
	return SkillIconGeometrySchema.parse(
		await readRepositoryJson(
			root,
			'assets/wiki/skills/icon-production-v1/geometry.json',
			'Skill icon geometry'
		)
	);
}

async function loadApprovedReference(
	root: string,
	masterPath: string,
	expectedRole: 'backing' | 'rarity-frame',
	expectedRarity: SkillIconRarity | null
): Promise<Buffer> {
	const receiptPaths = await listRepositoryJsonFiles(root, SKILL_ICON_PROMOTION_RECEIPT_ROOT);
	const matches = [];
	for (const receiptPath of receiptPaths) {
		const receipt = SkillIconPromotionReceiptSchema.parse(
			await readRepositoryJson(root, receiptPath, `Promotion receipt ${receiptPath}`)
		);
		if (receipt.master.path === masterPath) matches.push({ receiptPath, receipt });
	}
	if (matches.length !== 1) {
		throw new Error(
			`Approved reference ${masterPath} requires exactly one accepted promotion receipt; found ${matches.length}`
		);
	}
	const { receiptPath, receipt } = matches[0]!;
	if (receipt.role !== expectedRole) {
		throw new Error(`Promotion receipt role mismatch for ${masterPath}`);
	}
	if (!receiptPath.endsWith(`/${receipt.jobId}.json`)) {
		throw new Error(`Promotion receipt filename does not match job ${receipt.jobId}`);
	}
	const expected = {
		candidate: `assets/wiki/skills/icon-production-v1/candidates/references/${receipt.jobId}.png`,
		result: `assets/wiki/skills/icon-production-v1/results/references/${receipt.jobId}.json`,
		review: `assets/wiki/skills/icon-production-v1/review/decisions/references/${receipt.jobId}.json`,
		target: `assets/wiki/skills/icon-production-v1/targets/references/${receipt.jobId}.json`,
		assignment: `assets/wiki/skills/icon-production-v1/assignments/references/${receipt.jobId}.json`
	};
	if (
		receipt.candidate.path !== expected.candidate ||
		receipt.result.path !== expected.result ||
		receipt.review.path !== expected.review
	) {
		throw new Error(`Promotion receipt evidence paths do not match job ${receipt.jobId}`);
	}
	const [
		master,
		candidate,
		targetValue,
		assignmentValue,
		resultValue,
		reviewValue,
		resultBytes,
		reviewBytes
	] = await Promise.all([
		readRepositoryLayer(root, masterPath, 'Approved reference master'),
		readRepositoryLayer(root, expected.candidate, 'Approved reference candidate'),
		readRepositoryJson(root, expected.target, 'Approved reference target'),
		readRepositoryJson(root, expected.assignment, 'Approved reference assignment'),
		readRepositoryJson(root, expected.result, 'Approved reference result'),
		readRepositoryJson(root, expected.review, 'Approved reference review'),
		readDirectRegularFile(
			await assertRepositoryPath(root, expected.result, 'Approved reference result', false),
			'Approved reference result'
		),
		readDirectRegularFile(
			await assertRepositoryPath(root, expected.review, 'Approved reference review', false),
			'Approved reference review'
		)
	]);
	const target = SkillIconTargetSchema.parse(targetValue);
	const assignment = SkillIconAssignmentSchema.parse(assignmentValue);
	const result = SkillIconResultSchema.parse(resultValue);
	const review = SkillIconReviewSchema.parse(reviewValue);
	SkillIconExecutionSchema.parse({
		schemaVersion: 'skill-icon-execution-v1',
		target,
		assignment,
		result
	});
	if (
		target.jobId !== receipt.jobId ||
		target.role !== expectedRole ||
		referenceMasterPathFor(target) !== masterPath ||
		(expectedRole === 'rarity-frame' && target.rarity !== expectedRarity)
	) {
		throw new Error(`Promotion target does not authorize ${masterPath}`);
	}
	if (
		review.jobId !== receipt.jobId ||
		review.role !== expectedRole ||
		review.decision !== 'accepted' ||
		review.reviewer !== receipt.ownerReviewer ||
		review.candidatePath !== expected.candidate ||
		review.candidateHash !== receipt.candidate.contentHash
	) {
		throw new Error(`Promotion review does not bind accepted reference ${masterPath}`);
	}
	if (
		result.jobId !== receipt.jobId ||
		result.status !== 'candidate' ||
		!result.output ||
		result.output.path !== expected.candidate ||
		result.output.contentHash !== receipt.candidate.contentHash
	) {
		throw new Error(`Promotion result does not bind reference ${masterPath}`);
	}
	const masterHash = sha256(master);
	if (
		masterHash !== receipt.master.contentHash ||
		masterHash !== receipt.candidate.contentHash ||
		sha256(candidate) !== receipt.candidate.contentHash ||
		sha256(resultBytes) !== receipt.result.contentHash ||
		sha256(reviewBytes) !== receipt.review.contentHash
	) {
		throw new Error(`Promotion evidence hash mismatch for ${masterPath}`);
	}
	const inspection = await inspectSkillIconAsset(
		master,
		expectedRole,
		await loadGeometrySecure(root)
	);
	if (inspection.violations.length > 0) {
		throw new Error(
			`Approved reference geometry is invalid for ${masterPath}: ${inspection.violations.join('; ')}`
		);
	}
	return master;
}

async function ensureSafeParent(root: string, relativePath: string): Promise<string> {
	const segments = relativePath.split('/');
	const filename = segments.pop();
	if (!filename) throw new Error('Derivative path has no filename');
	let current = path.resolve(root);
	for (const segment of segments) {
		current = path.join(current, segment);
		const metadata = await metadataOrNull(current);
		if (!metadata) await mkdir(current);
		const confirmed = await lstat(current);
		if (confirmed.isSymbolicLink() || !confirmed.isDirectory()) {
			throw new Error(`Derivative parent is unsafe: ${relativePath}`);
		}
	}
	return path.join(current, filename);
}

async function currentDerivative(
	root: string,
	item: PlannedDerivative
): Promise<'missing' | 'current' | 'drift'> {
	const absolute = await assertRepositoryPath(
		root,
		item.asset.path,
		'Derivative destination',
		true
	);
	const metadata = await metadataOrNull(absolute);
	if (!metadata) return 'missing';
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error(`Derivative destination is unsafe: ${item.asset.path}`);
	}
	return (await readDirectRegularFile(absolute, 'Derivative destination')).equals(item.bytes)
		? 'current'
		: 'drift';
}

async function planRuntimeSet(
	record: SkillIconRuntimeSourceRecord,
	root: string
): Promise<PlannedDerivative[]> {
	const rarity = SkillIconRaritySchema.parse(record.rarity);
	const slug = targetSlug(record.targetId);
	const expectedMasterPath = `assets/wiki/skills/icon-production-v1/masters/icons/${slug}.png`;
	const masterPath = SkillIconMasterPathSchema.parse(record.assets.approvedMaster.path);
	if (masterPath !== expectedMasterPath) {
		throw new Error(`Approved master path does not match ${record.targetId}`);
	}
	const [backing, art, frame] = await Promise.all([
		loadApprovedReference(root, SKILL_ICON_BACKING_MASTER_PATH, 'backing', null),
		readRepositoryLayer(root, masterPath, 'Approved skill icon master'),
		loadApprovedReference(root, framePathFor(rarity), 'rarity-frame', rarity)
	]);
	const composite = await composeSkillHexBuffers({ backing, art, frame });
	return derivativePlan(record.targetId, await renderDerivativeBuffers(composite));
}

export async function exportSkillRuntimeSet(
	record: SkillIconRuntimeSourceRecord,
	root: string
): Promise<SkillIconDerivedAssets> {
	const resolvedRoot = path.resolve(root);
	const plan = await planRuntimeSet(record, resolvedRoot);
	const states = await Promise.all(plan.map((item) => currentDerivative(resolvedRoot, item)));
	if (states.some((state) => state === 'drift')) {
		throw new Error(
			'Derivative collision/drift; standalone export never overwrites managed outputs'
		);
	}
	if (states.some((state) => state === 'missing')) {
		throw new Error(
			'Standalone derivative writes are disabled; promote the reviewed skill through the coordinator transaction'
		);
	}
	return assetsFromPlan(plan);
}

export async function resolveDeterministicSkillIconDerivatives(
	input: PromotionDerivativeInput
): Promise<SkillIconDerivativeBuffers> {
	if (input.target.role !== 'skill-art')
		throw new Error('Derivative resolution requires skill-art');
	if (sha256(input.candidate.bytes) !== input.candidate.contentHash) {
		throw new Error('Reviewed candidate bytes do not match their bound SHA-256');
	}
	const catalogPath = await assertRepositoryPath(
		input.root,
		SKILL_ICON_CATALOG_PATH,
		'Skill icon catalog',
		false
	);
	const catalog = SkillIconCatalogSchema.parse(
		JSON.parse((await readDirectRegularFile(catalogPath, 'Skill icon catalog')).toString('utf8'))
	);
	const record = catalog.records.find((item) => item.targetId === input.target.skillTargetId);
	if (!record) throw new Error(`Catalog has no skill record ${input.target.skillTargetId}`);
	if (record.status !== 'candidate') {
		throw new Error(`Skill ${input.target.skillTargetId} must be a candidate during composition`);
	}
	const [backing, frame] = await Promise.all([
		loadApprovedReference(input.root, SKILL_ICON_BACKING_MASTER_PATH, 'backing', null),
		loadApprovedReference(input.root, framePathFor(record.rarity), 'rarity-frame', record.rarity)
	]);
	const composite = await composeSkillHexBuffers({
		backing,
		art: input.candidate.bytes,
		frame
	});
	return renderDerivativeBuffers(composite);
}

function escapeSvgText(value: string): string {
	if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
		throw new Error('Review-card text contains unsupported control characters');
	}
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function wrapReviewName(value: string): string[] {
	const normalized = value.replace(/\s+/gu, ' ').trim();
	const characters = [...normalized];
	const lineCount = Math.min(3, Math.max(1, Math.ceil(characters.length / 52)));
	const targetLength = Math.ceil(characters.length / lineCount);
	const lines: string[] = [];
	let remaining = normalized;
	for (let index = 0; index < lineCount - 1; index += 1) {
		let split = targetLength;
		const nextSpace = remaining.indexOf(' ', Math.max(1, targetLength - 12));
		if (nextSpace >= 0 && nextSpace <= targetLength + 12) split = nextSpace;
		lines.push(remaining.slice(0, split).trim());
		remaining = remaining.slice(split).trim();
	}
	lines.push(remaining);
	return lines;
}

export function formatSkillReviewLabel(mastery: SkillIconMastery, level: number): string {
	const parsedMastery = SkillIconMasterySchema.parse(mastery);
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw new Error('Skill review level must be an integer from 1 through 10');
	}
	return `${parsedMastery.toUpperCase()} · LV ${level}`;
}

export async function renderSkillReviewCard(input: SkillIconReviewCardInput): Promise<Buffer> {
	SkillIconRaritySchema.parse(input.rarity);
	if (input.name.trim().length === 0 || input.name.length > 160) {
		throw new Error('Skill review name must contain 1 through 160 characters');
	}
	const sourceMetadata = await sharp(input.composite).metadata();
	if (
		!sourceMetadata.width ||
		!sourceMetadata.height ||
		sourceMetadata.width !== sourceMetadata.height
	) {
		throw new Error('Skill review composite must be a square raster image');
	}
	const composite = await sharp(input.composite)
		.resize(REVIEW_HEX_SIZE, REVIEW_HEX_SIZE, {
			fit: 'fill',
			kernel: sharp.kernel.lanczos3
		})
		.ensureAlpha()
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	const nameLines = wrapReviewName(input.name).map(escapeSvgText);
	const label = escapeSvgText(formatSkillReviewLabel(input.mastery, input.level));
	const nameFontSize = nameLines.length === 1 ? 30 : nameLines.length === 2 ? 23 : 19;
	const nameLineHeight = nameLines.length === 1 ? 0 : nameLines.length === 2 ? 30 : 24;
	const nameStartY = nameLines.length === 1 ? 48 : nameLines.length === 2 ? 27 : 20;
	const nameSvg = nameLines
		.map((line, index) => {
			const constrained =
				[...line].length > 34 ? ' textLength="536" lengthAdjust="spacingAndGlyphs"' : '';
			return `<text x="320" y="${nameStartY + index * nameLineHeight}" font-size="${nameFontSize}" font-weight="700"${constrained}>${line}</text>`;
		})
		.join('');
	const svg = Buffer.from(
		[
			`<svg xmlns="http://www.w3.org/2000/svg" width="${REVIEW_CARD_WIDTH}" height="${REVIEW_LABEL_HEIGHT}" viewBox="0 0 ${REVIEW_CARD_WIDTH} ${REVIEW_LABEL_HEIGHT}">`,
			'<defs><clipPath id="name-margin"><rect x="48" y="0" width="544" height="104"/></clipPath></defs>',
			'<rect width="640" height="160" rx="12" fill="#0f172a" fill-opacity="0.96"/>',
			'<g fill="#f8fafc" text-anchor="middle" font-family="DejaVu Sans" font-kerning="none" text-rendering="geometricPrecision">',
			`<g clip-path="url(#name-margin)">${nameSvg}</g>`,
			`<text x="320" y="137" font-size="23" letter-spacing="1.5">${label}</text>`,
			'</g>',
			'</svg>'
		].join('')
	);
	return sharp({
		create: {
			width: REVIEW_CARD_WIDTH,
			height: REVIEW_CARD_HEIGHT,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite([
			{ input: composite, left: (REVIEW_CARD_WIDTH - REVIEW_HEX_SIZE) / 2, top: 0 },
			{ input: svg, left: 0, top: REVIEW_HEX_SIZE }
		])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

export async function renderSkillContactSheet(cards: readonly Buffer[]): Promise<Buffer> {
	if (cards.length === 0)
		throw new Error('A skill contact sheet requires at least one review card');
	const columns = Math.min(4, cards.length);
	const rows = Math.ceil(cards.length / columns);
	await Promise.all(
		cards.map(async (card) => {
			const metadata = await sharp(card).metadata();
			if (
				metadata.format !== 'png' ||
				metadata.width !== REVIEW_CARD_WIDTH ||
				metadata.height !== REVIEW_CARD_HEIGHT
			) {
				throw new Error('Contact sheets accept only rendered skill review cards');
			}
		})
	);
	const width = columns * REVIEW_CARD_WIDTH + (columns + 1) * CONTACT_SHEET_GAP;
	const height = rows * REVIEW_CARD_HEIGHT + (rows + 1) * CONTACT_SHEET_GAP;
	return sharp({
		create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
	})
		.composite(
			cards.map((input, index) => ({
				input,
				left: CONTACT_SHEET_GAP + (index % columns) * (REVIEW_CARD_WIDTH + CONTACT_SHEET_GAP),
				top:
					CONTACT_SHEET_GAP + Math.floor(index / columns) * (REVIEW_CARD_HEIGHT + CONTACT_SHEET_GAP)
			}))
		)
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function renderReferenceCell(image: Buffer, label: string): Promise<Buffer> {
	const imageSize = 320;
	const cellWidth = 360;
	const cellHeight = 400;
	const raster = await sharp(image)
		.resize(imageSize, imageSize, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
		.ensureAlpha()
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	const escaped = escapeSvgText(label);
	const caption = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="80"><rect width="360" height="80" fill="#0f172a"/><text x="180" y="50" fill="#f8fafc" text-anchor="middle" font-family="DejaVu Sans" font-size="24" font-weight="700" font-kerning="none">${escaped}</text></svg>`
	);
	return sharp({
		create: {
			width: cellWidth,
			height: cellHeight,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite([
			{ input: raster, left: 20, top: 0 },
			{ input: caption, left: 0, top: imageSize }
		])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function renderReferenceGrid(cells: readonly Buffer[]): Promise<Buffer> {
	const columns = 4;
	const rows = 2;
	const cellWidth = 360;
	const cellHeight = 400;
	const width = columns * cellWidth + (columns + 1) * CONTACT_SHEET_GAP;
	const height = rows * cellHeight + (rows + 1) * CONTACT_SHEET_GAP;
	return sharp({
		create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
	})
		.composite(
			cells.map((input, index) => ({
				input,
				left: CONTACT_SHEET_GAP + (index % columns) * (cellWidth + CONTACT_SHEET_GAP),
				top: CONTACT_SHEET_GAP + Math.floor(index / columns) * (cellHeight + CONTACT_SHEET_GAP)
			}))
		)
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function loadBoundCandidate(
	root: string,
	target: ReturnType<typeof SkillIconTargetSchema.parse>
): Promise<Buffer> {
	const candidatePath = target.output.candidatePath;
	const resultPath = target.output.resultPath;
	const candidate = await readRepositoryLayer(root, candidatePath, `Candidate ${target.jobId}`);
	const resultLocation = await assertRepositoryPath(
		root,
		resultPath,
		`Result ${target.jobId}`,
		false
	);
	const resultBytes = await readDirectRegularFile(resultLocation, `Result ${target.jobId}`);
	const result = SkillIconResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
	if (
		result.jobId !== target.jobId ||
		result.status !== 'candidate' ||
		!result.output ||
		result.resultPath !== resultPath ||
		result.output.path !== candidatePath ||
		result.output.contentHash !== sha256(candidate) ||
		result.output.bytes !== candidate.byteLength ||
		result.output.width !== target.canvas.width ||
		result.output.height !== target.canvas.height
	) {
		throw new Error(`Candidate/result binding mismatch for ${target.jobId}`);
	}
	const geometry = await loadGeometrySecure(root);
	const inspection = await inspectSkillIconAsset(candidate, target.role, geometry);
	if (
		inspection.width !== target.canvas.width ||
		inspection.height !== target.canvas.height ||
		inspection.violations.length > 0
	) {
		throw new Error(
			`Candidate ${target.jobId} failed ${target.role} inspection: ${inspection.violations.join('; ')}`
		);
	}
	return candidate;
}

async function planReferenceContactSheet(root: string): Promise<PlannedContactSheet> {
	const targetDirectory = 'assets/wiki/skills/icon-production-v1/targets/references';
	const targetPaths = await listRepositoryJsonFiles(root, targetDirectory).catch(() => []);
	const targets = await Promise.all(
		targetPaths.map(async (targetPath) => {
			const target = SkillIconTargetSchema.parse(
				await readRepositoryJson(root, targetPath, `Target ${targetPath}`)
			);
			if (targetPath !== `${targetDirectory}/${target.jobId}.json`) {
				throw new Error(`Reference target path does not match ${target.jobId}: ${targetPath}`);
			}
			if (target.role !== 'rarity-frame' && target.role !== 'backing') {
				throw new Error(`Unexpected reference target role ${target.role}: ${target.jobId}`);
			}
			return target;
		})
	);
	const wanted = [
		...(['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const).map((rarity) => ({
			key: `rarity-frame:${rarity}`,
			label: `${rarity} RARITY FRAME`,
			find: (target: (typeof targets)[number]) =>
				target.role === 'rarity-frame' && target.rarity === rarity
		})),
		{
			key: 'backing',
			label: 'CHARCOAL BACKING',
			find: (target: (typeof targets)[number]) => target.role === 'backing'
		}
	];
	const missing: string[] = [];
	const duplicate: string[] = [];
	const selected = wanted.flatMap((item) => {
		const matches = targets.filter(item.find);
		if (matches.length === 0) missing.push(item.key);
		if (matches.length > 1) duplicate.push(item.key);
		return matches.length === 1 ? [{ ...item, target: matches[0]! }] : [];
	});
	if (missing.length > 0 || duplicate.length > 0) {
		throw new Error(
			[
				missing.length > 0 ? `missing ${missing.join(', ')}` : '',
				duplicate.length > 0 ? `duplicate ${duplicate.join(', ')}` : ''
			]
				.filter(Boolean)
				.join('; ')
		);
	}
	const cells = await Promise.all(
		selected.map(async ({ target, label }) =>
			renderReferenceCell(await loadBoundCandidate(root, target), label)
		)
	);
	return {
		path: SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH,
		bytes: await renderReferenceGrid(cells),
		itemCount: cells.length
	};
}

async function loadPilotCatalog(root: string) {
	const catalogLocation = await assertRepositoryPath(
		root,
		SKILL_ICON_CATALOG_PATH,
		'Skill icon catalog',
		false
	);
	return SkillIconCatalogSchema.parse(
		JSON.parse(
			(await readDirectRegularFile(catalogLocation, 'Skill icon catalog')).toString('utf8')
		)
	);
}

async function planPilotContactSheet(root: string): Promise<PlannedContactSheet> {
	const catalog = await loadPilotCatalog(root);
	const byTargetId = new Map(catalog.records.map((record) => [record.targetId, record]));
	const missing = SKILL_ICON_PILOT_TARGET_IDS.filter((targetId) => {
		const record = byTargetId.get(targetId);
		return !record || (record.status !== 'candidate' && record.status !== 'approved');
	});
	if (missing.length > 0) {
		throw new Error(`Pilot contact sheet missing candidate visual records: ${missing.join(', ')}`);
	}
	const backingPromise = loadApprovedReference(
		root,
		SKILL_ICON_BACKING_MASTER_PATH,
		'backing',
		null
	);
	const framePromises = new Map(
		(['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const).map((rarity) => [
			rarity,
			loadApprovedReference(root, framePathFor(rarity), 'rarity-frame', rarity)
		])
	);
	const cards = await Promise.all(
		SKILL_ICON_PILOT_TARGET_IDS.map(async (targetId) => {
			const record = byTargetId.get(targetId)!;
			if (record.status !== 'candidate' && record.status !== 'approved') {
				throw new Error(`Pilot record ${targetId} is not candidate-backed`);
			}
			const jobId = record.producerResult.jobId;
			const targetPath = `assets/wiki/skills/icon-production-v1/targets/icons/${jobId}.json`;
			const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/icons/${jobId}.json`;
			const [targetValue, assignmentValue, resultValue] = await Promise.all([
				readRepositoryJson(root, targetPath, `Pilot target ${jobId}`),
				readRepositoryJson(root, assignmentPath, `Pilot assignment ${jobId}`),
				readRepositoryJson(root, record.producerResult.path, `Pilot result ${jobId}`)
			]);
			const target = SkillIconTargetSchema.parse(targetValue);
			const assignment = SkillIconAssignmentSchema.parse(assignmentValue);
			const result = SkillIconResultSchema.parse(resultValue);
			SkillIconExecutionSchema.parse({
				schemaVersion: 'skill-icon-execution-v1',
				target,
				assignment,
				result
			});
			if (target.role !== 'skill-art' || target.skillTargetId !== targetId) {
				throw new Error(`Pilot target identity mismatch for ${targetId}`);
			}
			const resultBytes = await readDirectRegularFile(
				await assertRepositoryPath(root, record.producerResult.path, 'Pilot result', false),
				'Pilot result'
			);
			if (sha256(resultBytes) !== record.producerResult.contentHash) {
				throw new Error(`Pilot result hash mismatch for ${targetId}`);
			}
			const art = await loadBoundCandidate(root, target);
			if (
				record.assets.candidate.path !== target.output.candidatePath ||
				record.assets.candidate.contentHash !== sha256(art) ||
				record.assets.candidate.bytes !== art.byteLength
			) {
				throw new Error(`Pilot catalog candidate binding mismatch for ${targetId}`);
			}
			const [backing, frame] = await Promise.all([
				backingPromise,
				framePromises.get(record.rarity)!
			]);
			const composite = await composeSkillHexBuffers({ backing, art, frame });
			return renderSkillReviewCard({
				composite,
				name: record.name,
				mastery: 'Intermediate',
				level: 7,
				rarity: record.rarity
			});
		})
	);
	return {
		path: SKILL_ICON_PILOT_CONTACT_SHEET_PATH,
		bytes: await renderSkillContactSheet(cards),
		itemCount: cards.length
	};
}

function scopeRecords<RecordType extends SkillIconRuntimeSourceRecord>(
	records: readonly RecordType[],
	scope: SkillIconRuntimeExportScope
): readonly RecordType[] {
	if (scope === 'references') return [];
	if (scope === 'all') return records;
	const pilotFamilies = new Set([
		'blade.sweeping-cut',
		'elemental.fire-projectile',
		'forging.smithing'
	]);
	return records.filter(
		(record) =>
			'motifFamily' in record &&
			typeof record.motifFamily === 'string' &&
			pilotFamilies.has(record.motifFamily)
	);
}

function sameAssetDescriptor(actual: SkillIconAsset, expected: SkillIconAsset): boolean {
	return (
		actual.path === expected.path &&
		actual.mediaType === expected.mediaType &&
		actual.width === expected.width &&
		actual.height === expected.height &&
		actual.bytes === expected.bytes &&
		actual.alphaMode === expected.alphaMode &&
		actual.contentHash === expected.contentHash
	);
}

async function listManagedAssetFiles(root: string): Promise<string[]> {
	const directories = [
		...RUNTIME_SIZES.map((size) => `apps/web/static/skill-icons/v1/${size}`),
		'assets/wiki/skills/icon-production-v1/review/recognition'
	];
	const files: string[] = [];
	for (const relativeDirectory of directories) {
		let current = path.resolve(root);
		let missing = false;
		for (const segment of relativeDirectory.split('/')) {
			current = path.join(current, segment);
			const metadata = await metadataOrNull(current);
			if (!metadata) {
				missing = true;
				break;
			}
			if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
				throw new Error(`Managed runtime directory is unsafe: ${relativeDirectory}`);
			}
		}
		if (missing) continue;
		for (const entry of await readdir(current, { withFileTypes: true })) {
			if (entry.isSymbolicLink() || !entry.isFile()) {
				throw new Error(`Managed runtime inventory contains unsafe entry: ${entry.name}`);
			}
			files.push(`${relativeDirectory}/${entry.name}`);
		}
	}
	return files.sort((left, right) => left.localeCompare(right));
}

async function contactSheetState(
	root: string,
	sheet: PlannedContactSheet
): Promise<'missing' | 'current' | 'drift'> {
	const location = await assertRepositoryPath(root, sheet.path, 'Contact sheet destination', true);
	const metadata = await metadataOrNull(location);
	if (!metadata) return 'missing';
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error(`Contact sheet destination is unsafe: ${sheet.path}`);
	}
	return (await readDirectRegularFile(location, 'Contact sheet destination')).equals(sheet.bytes)
		? 'current'
		: 'drift';
}

async function writeContactSheet(root: string, sheet: PlannedContactSheet): Promise<void> {
	const destination = await ensureSafeParent(root, sheet.path);
	const handle = await open(destination, 'wx');
	const opened = await handle.stat();
	try {
		await handle.writeFile(sheet.bytes);
		await handle.sync();
	} catch (error) {
		const current = await lstat(destination).catch(() => null);
		if (
			current &&
			!current.isSymbolicLink() &&
			current.isFile() &&
			current.dev === opened.dev &&
			current.ino === opened.ino
		) {
			await unlink(destination);
		}
		throw error;
	} finally {
		await handle.close();
	}
}

export async function exportSkillIconRuntime(options: {
	readonly root?: string;
	readonly mode: SkillIconRuntimeExportMode;
	readonly scope?: SkillIconRuntimeExportScope;
}): Promise<SkillIconRuntimeExportReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const scope = options.scope ?? 'all';
	const catalogLocation = await assertRepositoryPath(
		root,
		SKILL_ICON_CATALOG_PATH,
		'Skill icon catalog',
		false
	);
	const catalog = SkillIconCatalogSchema.parse(
		JSON.parse(
			(await readDirectRegularFile(catalogLocation, 'Skill icon catalog')).toString('utf8')
		)
	);
	const approved = catalog.records.filter(
		(record): record is Extract<(typeof catalog.records)[number], { status: 'approved' }> =>
			record.status === 'approved'
	);
	const contactSheet =
		scope === 'references'
			? await planReferenceContactSheet(root)
			: scope === 'pilot'
				? await planPilotContactSheet(root)
				: null;
	const plans = await Promise.all(
		scopeRecords(approved, scope).map(async (record) => ({
			record,
			plan: await planRuntimeSet(record, root)
		}))
	);
	const resolved = await Promise.all(
		plans.map(async ({ record, plan }) => ({
			record,
			plan,
			states: await Promise.all(plan.map((item) => currentDerivative(root, item)))
		}))
	);
	const drift: string[] = [];
	const statuses = resolved.map(({ record, plan, states }) => {
		const assets = assetsFromPlan(plan);
		for (const item of plan) {
			if (!sameAssetDescriptor(record.assets[item.name], item.asset)) {
				drift.push(`descriptor ${record.targetId}:${item.name}`);
			}
			const state = states[plan.indexOf(item)];
			if (state !== 'current') drift.push(`${state} ${item.asset.path}`);
		}
		return {
			targetId: record.targetId,
			current:
				states.every((state) => state === 'current') &&
				plan.every((item) => sameAssetDescriptor(record.assets[item.name], item.asset)),
			assets
		};
	});
	const expectedManagedPaths = new Set(
		approved.flatMap((record) => [
			record.assets.runtime512.path,
			record.assets.runtime256.path,
			record.assets.runtime128.path,
			record.assets.recognition96.path
		])
	);
	const orphanPaths = (await listManagedAssetFiles(root)).filter(
		(assetPath) => !expectedManagedPaths.has(assetPath)
	);
	for (const orphanPath of orphanPaths) drift.push(`orphan ${orphanPath}`);
	let sheetState: 'missing' | 'current' | 'drift' | null = null;
	if (contactSheet) {
		sheetState = await contactSheetState(root, contactSheet);
		if (sheetState !== 'current') drift.push(`${sheetState} ${contactSheet.path}`);
	}
	let written = false;
	if (options.mode === 'write') {
		const runtimeProblems = drift.filter(
			(item) => !contactSheet || !item.endsWith(contactSheet.path)
		);
		if (runtimeProblems.length > 0) {
			throw new Error(`Runtime export drift requires promotion: ${runtimeProblems.join(', ')}`);
		}
		if (contactSheet && sheetState === 'drift') {
			throw new Error(`Contact sheet collision/drift: ${contactSheet.path}`);
		}
		if (contactSheet && sheetState === 'missing') {
			await writeContactSheet(root, contactSheet);
			sheetState = 'current';
			written = true;
			const sheetDriftIndex = drift.findIndex((item) => item.endsWith(contactSheet.path));
			if (sheetDriftIndex >= 0) drift.splice(sheetDriftIndex, 1);
		}
	}
	return {
		mode: options.mode,
		scope,
		records: statuses,
		contactSheet: contactSheet
			? {
					path: contactSheet.path,
					current: sheetState === 'current',
					itemCount: contactSheet.itemCount,
					bytes: contactSheet.bytes.byteLength,
					contentHash: sha256(contactSheet.bytes)
				}
			: null,
		orphanPaths,
		drift,
		inSync:
			statuses.every((status) => status.current) &&
			orphanPaths.length === 0 &&
			(!contactSheet || sheetState === 'current'),
		written
	};
}

export function parseSkillIconRuntimeCli(args: readonly string[]): {
	readonly mode: SkillIconRuntimeExportMode;
	readonly scope: SkillIconRuntimeExportScope;
} {
	const separatorCount = args.filter((argument) => argument === '--').length;
	if (separatorCount > 1)
		throw new Error('Skill icon runtime CLI accepts at most one -- separator');
	const normalized = args.filter((argument) => argument !== '--');
	const modeArgs = normalized.filter(
		(argument) => argument === '--check' || argument === '--write'
	);
	if (modeArgs.length !== 1) {
		throw new Error(
			'Usage: tsx tools/compose-skill-icon-assets.ts --check|--write [--scope all|pilot|references]'
		);
	}
	const scopeIndexes = normalized.flatMap((argument, index) =>
		argument === '--scope' ? [index] : []
	);
	if (scopeIndexes.length > 1) throw new Error('Duplicate skill icon runtime --scope option');
	const scopeIndex = scopeIndexes[0] ?? -1;
	const scope = scopeIndex === -1 ? 'all' : normalized[scopeIndex + 1];
	if (!scope || !['all', 'pilot', 'references'].includes(scope)) {
		throw new Error('Skill icon runtime scope must be all, pilot, or references');
	}
	const expectedLength = scopeIndex === -1 ? 1 : 3;
	if (
		normalized.length !== expectedLength ||
		(scopeIndex !== -1 && scopeIndex + 1 >= normalized.length)
	) {
		throw new Error('Unknown or incomplete skill icon runtime arguments');
	}
	return {
		mode: modeArgs[0] === '--write' ? 'write' : 'check',
		scope: scope as SkillIconRuntimeExportScope
	};
}

export async function runSkillIconRuntimeCli(
	args: readonly string[],
	options: { readonly root?: string } = {}
): Promise<SkillIconRuntimeExportReport> {
	return exportSkillIconRuntime({
		...parseSkillIconRuntimeCli(args),
		...(options.root ? { root: options.root } : {})
	});
}

async function runCli(args: readonly string[]): Promise<void> {
	const report = await runSkillIconRuntimeCli(args);
	for (const record of report.records) {
		process.stdout.write(`${record.current ? 'current' : 'stale'} ${record.targetId}\n`);
	}
	if (!report.inSync) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}

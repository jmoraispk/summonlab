import { createHash, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { constants, type Dirent } from 'node:fs';
import {
	link,
	lstat,
	mkdir,
	open,
	readFile,
	readdir,
	realpath,
	rmdir,
	type FileHandle,
	unlink
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import {
	AnySkillIconAssignmentSchema,
	AnySkillIconExecutionSchema,
	AnySkillIconResultSchema,
	AnySkillIconTargetSchema,
	SKILL_ICON_NORMALIZATION_GUIDE_V1_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SkillIconCatalogSchema,
	SkillIconGeometrySchema,
	SkillIconGeometryV2Schema,
	SkillIconMasterPathSchema,
	SkillIconMasterySchema,
	SkillIconRaritySchema,
	SkillIconReviewSchema,
	type SkillIconAsset,
	type SkillIconMastery,
	type SkillIconRarity
} from '../packages/contracts/src/index.js';
import {
	SKILL_ICON_CATALOG_PATH,
	SKILL_ICON_MOTIF_MAP_PATH,
	SKILL_ICON_MOTIF_SOURCE_PATH,
	SKILL_ICON_VISUAL_SPECS_PATH,
	exportSkillIconProduction
} from './export-skill-icon-production.js';
import { CANONICAL_SKILL_SOURCE_PATHS } from './skill-icon-production-lib.js';
import { resolveLatestSkillIconTargets, skillIconLogicalKey } from './skill-icon-revision-lib.js';
import {
	assertSkillIconReprocessExecutionBytes,
	canonicalSkillIconReferencePaths,
	isSkillIconReprocessTarget,
	SkillIconReferenceTargetSchema,
	type SkillIconReferenceTarget,
	type SkillIconReprocessTarget
} from './skill-icon-reprocess-consumer-lib.js';
import {
	SKILL_ICON_PROMOTION_LOCK_PATH,
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

const APPROVED_STANDALONE_RUNTIME_ACTIVATION_PATHS = [
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/activation.json'
] as const;

const ApprovedStandaloneRuntimeAssetSchema = z
	.object({
		path: z.string().min(1),
		contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
		mediaType: z.enum(['image/png', 'image/webp']),
		width: z.number().int().positive(),
		height: z.number().int().positive(),
		alphaMode: z.literal('rgba'),
		bytes: z.number().int().positive()
	})
	.strict();

const ApprovedStandaloneRuntimeActivationSchema = z.object({
	schemaVersion: z.literal('skill-icon-approved-frame-activation-v1'),
	targetId: z.literal('martial:blade:reversal-cut'),
	status: z.literal('approved-runtime'),
	runtime: z.array(ApprovedStandaloneRuntimeAssetSchema).length(3),
	recognition: ApprovedStandaloneRuntimeAssetSchema,
	runtimeUpdated: z.literal(true),
	selfPromoted: z.literal(false)
});

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

export interface ApprovedSkillIconReferenceAuthority {
	readonly bytes: Buffer;
	readonly id: string;
	readonly role: 'rarity-frame' | 'backing';
	readonly rarity: SkillIconRarity | null;
	readonly path: string;
	readonly contentHash: string;
	readonly review: {
		readonly decision: 'accepted';
		readonly artifactId: string;
		readonly role: 'rarity-frame' | 'backing';
		readonly path: string;
		readonly contentHash: string;
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
		readonly path: string;
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

interface DesiredContactSheet {
	readonly kind: 'reference-assets' | 'pilot-icons';
	readonly bytes: Buffer;
	readonly itemCount: number;
}

interface SnapshottedContactSheet extends DesiredContactSheet {
	readonly sourceSnapshot: string;
	readonly readSession: ContactSheetReadSession;
}

interface PlannedContactSheet extends DesiredContactSheet {
	readonly path: string;
}

export interface SkillIconRuntimeTestHooks {
	readonly afterContactSheetReadObservation?: (input: {
		readonly kind: 'file' | 'directory';
		readonly path: string;
	}) => void | Promise<void>;
	readonly afterContactSheetLockObservation?: (input: {
		readonly lockPath: string;
	}) => void | Promise<void>;
	readonly beforeContactSheetPlanner?: (input: {
		readonly attempt: number;
	}) => void | Promise<void>;
	readonly afterContactSheetPlanner?: (input: { readonly attempt: number }) => void | Promise<void>;
	readonly beforeContactSheetPublish?: (input: {
		readonly path: string;
		readonly stagePath: string;
	}) => void | Promise<void>;
	readonly beforeContactSheetFinalLink?: () => void | Promise<void>;
	readonly afterContactSheetFinalLink?: () => void | Promise<void>;
	readonly afterContactSheetLockStage?: (input: {
		readonly stagePath: string;
		readonly lockBytes: Buffer;
	}) => void | Promise<void>;
	readonly afterContactSheetLockLink?: (input: {
		readonly lockPath: string;
		readonly lockBytes: Buffer;
	}) => void | Promise<void>;
}

interface ParentFingerprint {
	readonly realPath: string;
	readonly device: number;
	readonly inode: number;
}

interface ReadSetFile {
	readonly path: string;
	readonly parent: ParentFingerprint;
	readonly device: number;
	readonly inode: number;
	readonly bytes: number;
	readonly hash: string;
}

interface ReadSetDirectory {
	readonly path: string;
	readonly device: number;
	readonly inode: number;
	readonly entries: readonly string[];
}

const contactSheetReadContext = new AsyncLocalStorage<ContactSheetReadSession>();

class ContactSheetReadSetChanged extends Error {
	constructor() {
		super('contact-sheet authoritative read set changed');
	}
}

class ContactSheetReadSession {
	readonly #root: string;
	readonly #testHooks: SkillIconRuntimeTestHooks | undefined;
	readonly #files = new Map<string, ReadSetFile>();
	readonly #directories = new Map<string, ReadSetDirectory>();
	readonly #readQueues = new Map<string, Promise<void>>();

	constructor(root: string, testHooks?: SkillIconRuntimeTestHooks) {
		this.#root = path.resolve(root);
		this.#testHooks = testHooks;
	}

	#relative(absolute: string): string {
		const relative = path.relative(this.#root, absolute).split(path.sep).join('/');
		if (!relative || relative === '..' || relative.startsWith('../')) {
			throw new Error(`Contact-sheet read escaped authority: ${absolute}`);
		}
		return relative;
	}

	async #serialize<T>(key: string, operation: () => Promise<T>): Promise<T> {
		const predecessor = this.#readQueues.get(key) ?? Promise.resolve();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const queued = predecessor.then(() => gate);
		this.#readQueues.set(key, queued);
		await predecessor;
		try {
			return await operation();
		} finally {
			release();
			if (this.#readQueues.get(key) === queued) this.#readQueues.delete(key);
		}
	}

	async readFile(location: string, label: string): Promise<Buffer> {
		const absolute = path.resolve(location);
		const relative = this.#relative(absolute);
		return this.#serialize(`file:${relative}`, async () => {
			const parent = await directoryFingerprint(path.dirname(absolute));
			const { bytes, device, inode } = await readDirectRegularFileIdentity(absolute, label);
			const observation = {
				path: relative,
				parent,
				device,
				inode,
				bytes: bytes.byteLength,
				hash: sha256(bytes)
			};
			const recorded = this.#files.get(relative);
			if (recorded) {
				if (
					!sameDirectory(recorded.parent, observation.parent) ||
					recorded.device !== observation.device ||
					recorded.inode !== observation.inode ||
					recorded.bytes !== observation.bytes ||
					recorded.hash !== observation.hash
				) {
					throw new ContactSheetReadSetChanged();
				}
			} else {
				this.#files.set(relative, observation);
				await this.#testHooks?.afterContactSheetReadObservation?.({
					kind: 'file',
					path: relative
				});
			}
			return bytes;
		});
	}

	async readDirectory(location: string): Promise<Dirent[]> {
		const absolute = path.resolve(location);
		const relative = this.#relative(absolute);
		return this.#serialize(`directory:${relative}`, async () => {
			const bound = await openBoundDirectory(absolute);
			try {
				const entries = await readdir(bound.procPath, { withFileTypes: true });
				const identities = await Promise.all(
					entries.map(async (entry) => {
						const metadata = await lstat(path.join(bound.procPath, entry.name));
						return `${entry.name}\0${metadata.dev}\0${metadata.ino}\0${metadata.mode}`;
					})
				);
				const observation = {
					path: relative,
					device: bound.identity.device,
					inode: bound.identity.inode,
					entries: identities.sort((left, right) => left.localeCompare(right))
				};
				const recorded = this.#directories.get(relative);
				if (recorded) {
					if (
						recorded.device !== observation.device ||
						recorded.inode !== observation.inode ||
						JSON.stringify(recorded.entries) !== JSON.stringify(observation.entries)
					) {
						throw new ContactSheetReadSetChanged();
					}
				} else {
					this.#directories.set(relative, observation);
					await this.#testHooks?.afterContactSheetReadObservation?.({
						kind: 'directory',
						path: relative
					});
				}
				return entries;
			} finally {
				await bound.handle.close();
			}
		});
	}

	async verify(): Promise<boolean> {
		for (const expected of this.#directories.values()) {
			const absolute = path.resolve(this.#root, expected.path);
			const bound = await openBoundDirectory(absolute).catch(() => null);
			if (!bound) return false;
			try {
				if (bound.identity.device !== expected.device || bound.identity.inode !== expected.inode) {
					return false;
				}
				const entries = await readdir(bound.procPath, { withFileTypes: true });
				const identities = await Promise.all(
					entries.map(async (entry) => {
						const metadata = await lstat(path.join(bound.procPath, entry.name));
						return `${entry.name}\0${metadata.dev}\0${metadata.ino}\0${metadata.mode}`;
					})
				);
				identities.sort((left, right) => left.localeCompare(right));
				if (JSON.stringify(identities) !== JSON.stringify(expected.entries)) return false;
			} finally {
				await bound.handle.close();
			}
		}
		for (const expected of this.#files.values()) {
			const absolute = path.resolve(this.#root, expected.path);
			const parent = await directoryFingerprint(path.dirname(absolute)).catch(() => null);
			if (!parent || !sameDirectory(parent, expected.parent)) return false;
			const current = await readDirectRegularFileIdentity(
				absolute,
				`Read-set ${expected.path}`
			).catch(() => null);
			if (
				!current ||
				current.device !== expected.device ||
				current.inode !== expected.inode ||
				current.bytes.byteLength !== expected.bytes ||
				sha256(current.bytes) !== expected.hash
			) {
				return false;
			}
		}
		return true;
	}

	digest(): string {
		return sha256(
			Buffer.from(
				JSON.stringify({
					files: [...this.#files.values()].sort((a, b) => a.path.localeCompare(b.path)),
					directories: [...this.#directories.values()].sort((a, b) => a.path.localeCompare(b.path))
				})
			)
		);
	}
}

async function assertContactSheetReadSetCurrent(): Promise<void> {
	const session = contactSheetReadContext.getStore();
	if (session && !(await session.verify())) throw new ContactSheetReadSetChanged();
}

async function settleContactSheetReads<T>(operations: readonly Promise<T>[]): Promise<T[]> {
	const results = await Promise.allSettled(operations);
	const rejected = results.find(
		(result): result is PromiseRejectedResult => result.status === 'rejected'
	);
	if (rejected) throw rejected.reason;
	return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jobRevision(jobId: string): number {
	const match = /-v([1-9]\d*)$/u.exec(jobId);
	if (!match) throw new Error(`Skill icon job lacks a positive revision suffix: ${jobId}`);
	return Number(match[1]);
}

function reviewSheetPath(kind: 'reference-assets' | 'pilot-icons', revision: number): string {
	return `assets/wiki/skills/icon-production-v1/review/${kind}-v${revision}.png`;
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

async function readDirectRegularFileIdentity(
	location: string,
	label: string
): Promise<{ bytes: Buffer; device: number; inode: number }> {
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
		return { bytes, device: opened.dev, inode: opened.ino };
	} finally {
		await handle.close();
	}
}

async function readDirectRegularFile(location: string, label: string): Promise<Buffer> {
	const session = contactSheetReadContext.getStore();
	if (session) return session.readFile(location, label);
	return (await readDirectRegularFileIdentity(location, label)).bytes;
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

async function readRepositoryBytes(
	root: string,
	relativePath: string,
	label: string
): Promise<Buffer> {
	const absolute = await assertRepositoryPath(root, relativePath, label, false);
	return readDirectRegularFile(absolute, label);
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
	const entries = contactSheetReadContext.getStore()
		? await contactSheetReadContext.getStore()!.readDirectory(current)
		: await readdir(current, { withFileTypes: true });
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

async function loadBoundReprocessExecution(
	root: string,
	expectedTarget: SkillIconReprocessTarget,
	currentBytes?: {
		readonly targetBytes: Buffer;
		readonly assignmentBytes: Buffer;
		readonly resultBytes: Buffer;
	}
) {
	const current = canonicalSkillIconReferencePaths(expectedTarget);
	const { targetBytes, assignmentBytes, resultBytes } = currentBytes
		? currentBytes
		: await Promise.all([
				readRepositoryBytes(root, current.targetPath, 'Reprocess target'),
				readRepositoryBytes(root, current.assignmentPath, 'Reprocess assignment'),
				readRepositoryBytes(root, current.resultPath, 'Reprocess result')
			]).then(([targetBytes, assignmentBytes, resultBytes]) => ({
				targetBytes,
				assignmentBytes,
				resultBytes
			}));
	const liveTarget = SkillIconReferenceTargetSchema.parse(
		JSON.parse(targetBytes.toString('utf8')) as unknown
	);
	if (
		!isSkillIconReprocessTarget(liveTarget) ||
		JSON.stringify(liveTarget) !== JSON.stringify(expectedTarget)
	) {
		throw new Error(`Reprocess target changed while consuming ${expectedTarget.jobId}`);
	}
	const [originTargetBytes, originAssignmentBytes, originResultBytes] = await Promise.all([
		readRepositoryBytes(root, liveTarget.originAuthority.target.path, 'Reprocess origin target'),
		readRepositoryBytes(
			root,
			liveTarget.originAuthority.assignment.path,
			'Reprocess origin assignment'
		),
		readRepositoryBytes(root, liveTarget.originAuthority.result.path, 'Reprocess origin result')
	]);
	const originTarget = AnySkillIconTargetSchema.parse(
		JSON.parse(originTargetBytes.toString('utf8')) as unknown
	);
	const originCandidate = path.resolve(root, originTarget.output.candidatePath);
	if (contactSheetReadContext.getStore()) {
		await contactSheetReadContext.getStore()!.readDirectory(path.dirname(originCandidate));
	}
	const originCandidatePresent = (await metadataOrNull(originCandidate)) !== null;
	const execution = assertSkillIconReprocessExecutionBytes({
		targetPath: current.targetPath,
		targetBytes,
		assignmentPath: current.assignmentPath,
		assignmentBytes,
		resultPath: current.resultPath,
		resultBytes,
		originTargetBytes,
		originAssignmentBytes,
		originResultBytes,
		originCandidatePresent
	});
	return {
		...execution,
		targetBytes,
		assignmentBytes,
		resultBytes,
		originTargetBytes,
		originAssignmentBytes,
		originResultBytes
	};
}

function referenceMasterPathFor(target: SkillIconReferenceTarget): string {
	if (target.role === 'rarity-frame') {
		return `assets/wiki/skills/icon-production-v1/masters/frames/${target.rarity.toLowerCase()}.png`;
	}
	if (target.role === 'backing') {
		return `assets/wiki/skills/icon-production-v1/masters/backing/${target.jobId.replace(/-v\d+$/u, '')}.png`;
	}
	throw new Error(`Expected a backing or rarity-frame target, received ${target.role}`);
}

async function loadGeometrySecure(root: string, target?: SkillIconReferenceTarget) {
	const geometryPath =
		target && isSkillIconReprocessTarget(target)
			? target.processingAuthority.geometry.path
			: target?.schemaVersion === 'skill-icon-target-v2'
				? target.normalization.geometry.path
				: 'assets/wiki/skills/icon-production-v1/geometry.json';
	const location = await assertRepositoryPath(root, geometryPath, 'Skill icon geometry', false);
	const bytes = await readDirectRegularFile(location, 'Skill icon geometry');
	if (
		target &&
		((isSkillIconReprocessTarget(target) &&
			sha256(bytes) !== target.processingAuthority.geometry.contentHash) ||
			(target.schemaVersion === 'skill-icon-target-v2' &&
				sha256(bytes) !== target.normalization.geometry.contentHash))
	) {
		throw new Error(`Skill icon geometry hash does not match latest target ${target.jobId}`);
	}
	if (
		target &&
		(target.schemaVersion === 'skill-icon-target-v2' || isSkillIconReprocessTarget(target))
	) {
		if (isSkillIconReprocessTarget(target)) {
			const guideLocation = await assertRepositoryPath(
				root,
				target.processingAuthority.guide.path,
				'Skill icon geometry guide',
				false
			);
			const guideBytes = await readDirectRegularFile(guideLocation, 'Skill icon geometry guide');
			if (sha256(guideBytes) !== target.processingAuthority.guide.contentHash)
				throw new Error(
					`Skill icon geometry guide hash does not match latest target ${target.jobId}`
				);
			return SkillIconGeometryV2Schema.parse(JSON.parse(bytes.toString('utf8')) as unknown);
		}
		const expectedGuidePath =
			target.normalization.profile === 'skill-icon-green-key-role-mask-v3'
				? SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH
				: SKILL_ICON_NORMALIZATION_GUIDE_V1_PATH;
		const guide = target.references.find((reference) => reference.path === expectedGuidePath);
		if (!guide) throw new Error(`Target ${target.jobId} lacks its profile geometry guide`);
		const guideLocation = await assertRepositoryPath(
			root,
			guide.path,
			'Skill icon geometry guide',
			false
		);
		const guideBytes = await readDirectRegularFile(guideLocation, 'Skill icon geometry guide');
		if (sha256(guideBytes) !== guide.contentHash)
			throw new Error(
				`Skill icon geometry guide hash does not match latest target ${target.jobId}`
			);
		if (target.normalization.profile === 'skill-icon-green-key-role-mask-v3')
			return SkillIconGeometryV2Schema.parse(JSON.parse(bytes.toString('utf8')) as unknown);
	}
	return SkillIconGeometrySchema.parse(JSON.parse(bytes.toString('utf8')) as unknown);
}

export async function loadApprovedSkillIconReferenceAuthority(
	root: string,
	masterPath: string,
	expectedRole: 'backing' | 'rarity-frame',
	expectedRarity: SkillIconRarity | null
): Promise<ApprovedSkillIconReferenceAuthority> {
	const targetDirectory = 'assets/wiki/skills/icon-production-v1/targets/references';
	const targetPaths = await listRepositoryJsonFiles(root, targetDirectory);
	const targets = await Promise.all(
		targetPaths.map(async (targetPath) => {
			const target = SkillIconReferenceTargetSchema.parse(
				await readRepositoryJson(root, targetPath, `Approved reference target ${targetPath}`)
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
	// Enforce the shared duplicate-revision and one-shot reprocess inventory rules before
	// selecting any contact-sheet input.
	resolveLatestSkillIconTargets(targets);
	const expectedLogicalKey =
		expectedRole === 'rarity-frame' ? `rarity-frame:${expectedRarity}` : 'backing';
	const latestTarget = resolveLatestSkillIconTargets(targets).find(
		(item) => item.logicalKey === expectedLogicalKey
	)?.target;
	if (!latestTarget) {
		throw new Error(`Approved reference ${masterPath} has no target for ${expectedLogicalKey}`);
	}
	if (
		latestTarget.role !== expectedRole ||
		(expectedRole === 'rarity-frame' && latestTarget.rarity !== expectedRarity) ||
		skillIconLogicalKey(latestTarget) !== expectedLogicalKey ||
		referenceMasterPathFor(latestTarget) !== masterPath
	) {
		throw new Error(
			`Latest reference target ${latestTarget.jobId} does not authorize ${masterPath}`
		);
	}
	const receiptPaths = await listRepositoryJsonFiles(root, SKILL_ICON_PROMOTION_RECEIPT_ROOT);
	const matches = [];
	for (const receiptPath of receiptPaths) {
		const receipt = SkillIconPromotionReceiptSchema.parse(
			await readRepositoryJson(root, receiptPath, `Promotion receipt ${receiptPath}`)
		);
		if (receipt.master.path === masterPath && receipt.jobId === latestTarget.jobId) {
			matches.push({ receiptPath, receipt });
		}
	}
	if (matches.length !== 1) {
		throw new Error(
			`Approved reference ${masterPath} requires exactly one accepted promotion receipt for latest target ${latestTarget.jobId}; found ${matches.length}`
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
	const [master, candidate, targetBytes, assignmentBytes, resultBytes, reviewBytes] =
		await Promise.all([
			readRepositoryLayer(root, masterPath, 'Approved reference master'),
			readRepositoryLayer(root, expected.candidate, 'Approved reference candidate'),
			readRepositoryBytes(root, expected.target, 'Approved reference target'),
			readRepositoryBytes(root, expected.assignment, 'Approved reference assignment'),
			readRepositoryBytes(root, expected.result, 'Approved reference result'),
			readRepositoryBytes(root, expected.review, 'Approved reference review')
		]);
	const target = SkillIconReferenceTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
	const review = SkillIconReviewSchema.parse(JSON.parse(reviewBytes.toString('utf8')));
	const boundReprocess = isSkillIconReprocessTarget(target)
		? await loadBoundReprocessExecution(root, target, {
				targetBytes,
				assignmentBytes,
				resultBytes
			})
		: null;
	const result = boundReprocess
		? boundReprocess.result
		: (() => {
				const assignment = AnySkillIconAssignmentSchema.parse(
					JSON.parse(assignmentBytes.toString('utf8'))
				);
				const ordinaryResult = AnySkillIconResultSchema.parse(
					JSON.parse(resultBytes.toString('utf8'))
				);
				AnySkillIconExecutionSchema.parse({
					schemaVersion:
						target.schemaVersion === 'skill-icon-target-v2'
							? 'skill-icon-execution-v2'
							: 'skill-icon-execution-v1',
					target,
					assignment,
					result: ordinaryResult
				});
				return ordinaryResult;
			})();
	if (
		target.jobId !== latestTarget.jobId ||
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
		await loadGeometrySecure(root, target)
	);
	if (inspection.violations.length > 0) {
		throw new Error(
			`Approved reference geometry is invalid for ${masterPath}: ${inspection.violations.join('; ')}`
		);
	}
	return {
		bytes: master,
		id: target.jobId,
		role: expectedRole,
		rarity: expectedRole === 'rarity-frame' ? target.rarity : null,
		path: masterPath,
		contentHash: masterHash,
		review: {
			decision: 'accepted',
			artifactId: target.jobId,
			role: expectedRole,
			path: masterPath,
			contentHash: masterHash
		}
	};
}

async function loadApprovedReference(
	root: string,
	masterPath: string,
	expectedRole: 'backing' | 'rarity-frame',
	expectedRarity: SkillIconRarity | null
): Promise<Buffer> {
	return (
		await loadApprovedSkillIconReferenceAuthority(root, masterPath, expectedRole, expectedRarity)
	).bytes;
}

async function ensureSafeParent(root: string, relativePath: string): Promise<string> {
	const segments = relativePath.split('/');
	const filename = segments.pop();
	if (!filename) throw new Error('Derivative path has no filename');
	let current = path.resolve(root);
	for (const segment of segments) {
		current = path.join(current, segment);
		const metadata = await metadataOrNull(current);
		if (!metadata) {
			await mkdir(current).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== 'EEXIST') throw error;
			});
		}
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
	if (
		[...value].some((character) => {
			const codePoint = character.codePointAt(0) ?? 0;
			return (
				(codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13) ||
				codePoint === 127
			);
		})
	) {
		throw new Error('Review-card text contains unsupported control characters');
	}
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

async function renderedTextWidth(value: string, fontSize: number): Promise<number> {
	const svg = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="96"><text x="8" y="${fontSize + 12}" fill="#fff" font-family="DejaVu Sans" font-size="${fontSize}" font-weight="700" font-kerning="none">${escapeSvgText(value)}</text></svg>`
	);
	const rendered = await sharp(svg).trim().png().toBuffer({ resolveWithObject: true });
	return rendered.info.width;
}

function balancedNameLines(value: string, lineCount: number): string[] {
	const lines: string[] = [];
	let remaining = [...value];
	for (let index = 0; index < lineCount - 1; index += 1) {
		const remainingLines = lineCount - index;
		const target = Math.ceil(remaining.length / remainingLines);
		const minimum = Math.max(1, target - 12);
		const maximum = Math.min(remaining.length - 1, target + 12);
		const spaces = remaining.flatMap((character, position) =>
			character === ' ' && position >= minimum && position <= maximum ? [position] : []
		);
		const split =
			spaces.length > 0
				? spaces.reduce((best, position) =>
						Math.abs(position - target) < Math.abs(best - target) ? position : best
					)
				: target;
		lines.push(remaining.slice(0, split).join('').trim());
		remaining = [...remaining.slice(split).join('').trim()];
	}
	lines.push(remaining.join(''));
	return lines;
}

async function fitReviewName(value: string): Promise<{ lines: string[]; fontSize: number }> {
	const normalized = value.replace(/\s+/gu, ' ').trim();
	for (const [lineCount, initialSize] of [
		[1, 30],
		[2, 23],
		[3, 19]
	] as const) {
		const lines = balancedNameLines(normalized, lineCount);
		let fontSize: number = initialSize;
		while (fontSize >= 7) {
			const widths = await Promise.all(lines.map((line) => renderedTextWidth(line, fontSize)));
			if (Math.max(...widths) <= 480) return { lines, fontSize };
			const next = Math.floor((fontSize * 480) / Math.max(...widths));
			fontSize = Math.min(fontSize - 1, next);
		}
	}
	throw new Error('Skill review name cannot fit within the review-card name region');
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
	const fittedName = await fitReviewName(input.name);
	const nameLines = fittedName.lines.map(escapeSvgText);
	const label = escapeSvgText(formatSkillReviewLabel(input.mastery, input.level));
	const nameFontSize = fittedName.fontSize;
	const nameLineHeight = nameLines.length === 1 ? 0 : nameFontSize + 5;
	const nameStartY =
		nameLines.length === 1
			? 48
			: Math.max(nameFontSize + 2, Math.floor((100 - nameLineHeight * (nameLines.length - 1)) / 2));
	const nameSvg = nameLines
		.map(
			(line, index) =>
				`<text x="320" y="${nameStartY + index * nameLineHeight}" font-size="${nameFontSize}" font-weight="700">${line}</text>`
		)
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

async function loadBoundCandidate(root: string, target: SkillIconReferenceTarget): Promise<Buffer> {
	const candidatePath = target.output.candidatePath;
	const resultPath = target.output.resultPath;
	const scope = target.role === 'skill-art' ? 'icons' : 'references';
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/${scope}/${target.jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${scope}/${target.jobId}.json`;
	const bound = isSkillIconReprocessTarget(target)
		? { result: (await loadBoundReprocessExecution(root, target)).result, assignment: null }
		: await (async () => {
				const [assignmentValue, resultBytes] = await Promise.all([
					readRepositoryJson(root, assignmentPath, `Assignment ${target.jobId}`),
					assertRepositoryPath(root, resultPath, `Result ${target.jobId}`, false).then((location) =>
						readDirectRegularFile(location, `Result ${target.jobId}`)
					)
				]);
				const assignment = AnySkillIconAssignmentSchema.parse(assignmentValue);
				const ordinaryResult = AnySkillIconResultSchema.parse(
					JSON.parse(resultBytes.toString('utf8'))
				);
				AnySkillIconExecutionSchema.parse({
					schemaVersion:
						target.schemaVersion === 'skill-icon-target-v2'
							? 'skill-icon-execution-v2'
							: 'skill-icon-execution-v1',
					target,
					assignment,
					result: ordinaryResult
				});
				return { result: ordinaryResult, assignment };
			})();
	const { result, assignment } = bound;
	if (result.status !== 'candidate' || !result.output)
		throw new Error(
			`Latest result ${target.jobId} is ${result.status}; no candidate fallback allowed`
		);
	const candidate = await readRepositoryLayer(root, candidatePath, `Candidate ${target.jobId}`);
	if (
		(assignment !== null &&
			(assignment.targetPath !== targetPath || assignment.assignmentPath !== assignmentPath)) ||
		result.jobId !== target.jobId ||
		result.resultPath !== resultPath ||
		result.output.path !== candidatePath ||
		result.output.contentHash !== sha256(candidate) ||
		result.output.bytes !== candidate.byteLength ||
		result.output.width !== 1024 ||
		result.output.height !== 1024
	) {
		throw new Error(`Candidate/result binding mismatch for ${target.jobId}`);
	}
	const geometry = await loadGeometrySecure(root, target);
	const inspection = await inspectSkillIconAsset(candidate, target.role, geometry);
	if (inspection.width !== 1024 || inspection.height !== 1024 || inspection.violations.length > 0) {
		throw new Error(
			`Candidate ${target.jobId} failed ${target.role} inspection: ${inspection.violations.join('; ')}`
		);
	}
	return candidate;
}

async function planReferenceContactSheet(root: string): Promise<DesiredContactSheet> {
	const targetDirectory = 'assets/wiki/skills/icon-production-v1/targets/references';
	const targetPaths = await listRepositoryJsonFiles(root, targetDirectory).catch(() => []);
	const targets = await Promise.all(
		targetPaths.map(async (targetPath) => {
			const target = SkillIconReferenceTargetSchema.parse(
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
		const highestRevision = Math.max(...matches.map((target) => jobRevision(target.jobId)));
		const active = matches.filter((target) => jobRevision(target.jobId) === highestRevision);
		if (active.length > 1) duplicate.push(`${item.key} v${highestRevision}`);
		return active.length === 1 ? [{ ...item, target: active[0]!, revision: highestRevision }] : [];
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
	const cellInputs = await settleContactSheetReads(
		selected.map(async ({ target, label }) => ({
			candidate: await loadBoundCandidate(root, target),
			label
		}))
	);
	await assertContactSheetReadSetCurrent();
	const cells = await Promise.all(
		cellInputs.map(({ candidate, label }) => renderReferenceCell(candidate, label))
	);
	return {
		kind: 'reference-assets',
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

async function planPilotContactSheet(root: string): Promise<DesiredContactSheet> {
	await Promise.all(
		[
			...CANONICAL_SKILL_SOURCE_PATHS,
			SKILL_ICON_MOTIF_SOURCE_PATH,
			SKILL_ICON_MOTIF_MAP_PATH,
			SKILL_ICON_VISUAL_SPECS_PATH,
			SKILL_ICON_CATALOG_PATH
		].map(async (relativePath) =>
			readDirectRegularFile(path.resolve(root, relativePath), `Canonical authority ${relativePath}`)
		)
	);
	const currency = await exportSkillIconProduction({ root, mode: 'check' });
	if (!currency.inSync) {
		throw new Error(
			`Canonical skill-icon catalog is stale: ${currency.files
				.filter((file) => !file.current)
				.map((file) => file.path)
				.join(', ')}`
		);
	}
	const catalog = await loadPilotCatalog(root);
	const byTargetId = new Map(catalog.records.map((record) => [record.targetId, record]));
	const missing = SKILL_ICON_PILOT_TARGET_IDS.filter((targetId) => {
		const record = byTargetId.get(targetId);
		return !record || (record.status !== 'candidate' && record.status !== 'approved');
	});
	if (missing.length > 0) {
		throw new Error(`Pilot contact sheet missing candidate visual records: ${missing.join(', ')}`);
	}
	const targetDirectory = 'assets/wiki/skills/icon-production-v1/targets/icons';
	const targetPaths = await listRepositoryJsonFiles(root, targetDirectory).catch(() => []);
	const targets = await Promise.all(
		targetPaths.map(async (targetPath) => {
			const target = AnySkillIconTargetSchema.parse(
				await readRepositoryJson(root, targetPath, `Pilot target ${targetPath}`)
			);
			if (targetPath !== `${targetDirectory}/${target.jobId}.json`) {
				throw new Error(`Pilot target path does not match ${target.jobId}: ${targetPath}`);
			}
			if (target.role !== 'skill-art') {
				throw new Error(`Unexpected pilot target role ${target.role}: ${target.jobId}`);
			}
			return target;
		})
	);
	const selectedTargets = new Map<string, (typeof targets)[number]>();
	for (const targetId of SKILL_ICON_PILOT_TARGET_IDS) {
		const matches = targets.filter((target) => target.skillTargetId === targetId);
		if (matches.length === 0) throw new Error(`Pilot contact sheet missing target: ${targetId}`);
		const highestRevision = Math.max(...matches.map((target) => jobRevision(target.jobId)));
		const active = matches.filter((target) => jobRevision(target.jobId) === highestRevision);
		if (active.length !== 1) {
			throw new Error(`Pilot contact sheet duplicate ${targetId} v${highestRevision}`);
		}
		selectedTargets.set(targetId, active[0]!);
	}
	const rarities = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
	const [backing, ...frames] = await settleContactSheetReads([
		loadApprovedReference(root, SKILL_ICON_BACKING_MASTER_PATH, 'backing', null),
		...rarities.map((rarity) =>
			loadApprovedReference(root, framePathFor(rarity), 'rarity-frame', rarity)
		)
	]);
	const frameBuffers = new Map(rarities.map((rarity, index) => [rarity, frames[index]!]));
	const cardInputs = await settleContactSheetReads(
		SKILL_ICON_PILOT_TARGET_IDS.map(async (targetId) => {
			const record = byTargetId.get(targetId)!;
			if (record.status !== 'candidate' && record.status !== 'approved') {
				throw new Error(`Pilot record ${targetId} is not candidate-backed`);
			}
			const target = selectedTargets.get(targetId)!;
			const jobId = target.jobId;
			if (target.role !== 'skill-art' || target.skillTargetId !== targetId) {
				throw new Error(`Pilot target identity mismatch for ${targetId}`);
			}
			const art = await loadBoundCandidate(root, target);
			if (record.producerResult.jobId !== jobId) {
				throw new Error(
					`Pilot catalog does not select highest complete revision ${jobId} for ${targetId}`
				);
			}
			const resultBytes = await readDirectRegularFile(
				await assertRepositoryPath(root, record.producerResult.path, 'Pilot result', false),
				'Pilot result'
			);
			if (sha256(resultBytes) !== record.producerResult.contentHash) {
				throw new Error(`Pilot result hash mismatch for ${targetId}`);
			}
			if (
				record.assets.candidate.path !== target.output.candidatePath ||
				record.assets.candidate.contentHash !== sha256(art) ||
				record.assets.candidate.bytes !== art.byteLength
			) {
				throw new Error(`Pilot catalog candidate binding mismatch for ${targetId}`);
			}
			const frame = frameBuffers.get(record.rarity)!;
			const composite = await composeSkillHexBuffers({ backing, art, frame });
			return {
				composite,
				name: record.name,
				mastery: 'Intermediate',
				level: 7,
				rarity: record.rarity
			} as const;
		})
	);
	await assertContactSheetReadSetCurrent();
	const cards = await Promise.all(cardInputs.map((input) => renderSkillReviewCard(input)));
	return {
		kind: 'pilot-icons',
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

async function directoryFingerprint(directory: string): Promise<ParentFingerprint> {
	const metadata = await lstat(directory);
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error(`Contact-sheet parent is unsafe: ${directory}`);
	}
	return { realPath: await realpath(directory), device: metadata.dev, inode: metadata.ino };
}

function sameDirectory(left: ParentFingerprint, right: ParentFingerprint): boolean {
	return (
		left.realPath === right.realPath && left.device === right.device && left.inode === right.inode
	);
}

async function syncDirectory(directory: string): Promise<void> {
	const handle = await open(
		directory,
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
	);
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function assertNoConcurrentPromotion(root: string): Promise<void> {
	const lock = path.resolve(root, SKILL_ICON_PROMOTION_LOCK_PATH);
	if (await metadataOrNull(lock)) {
		throw new Error('Contact-sheet publication refused while promotion coordinator lock exists');
	}
}

interface BoundDirectory {
	readonly path: string;
	readonly procPath: string;
	readonly identity: ParentFingerprint;
	readonly handle: FileHandle;
}

const ContactSheetLockSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-contact-sheet-lock-v1'),
		transactionId: z.string().uuid(),
		pid: z.number().int().positive(),
		processIdentity: z
			.object({ bootId: z.string().min(1), startTicks: z.string().regex(/^\d+$/u) })
			.strict(),
		createdAt: z.string().datetime(),
		stageNamespace: z.string().regex(/^\.contact-sheet-staging-[a-f0-9-]{36}$/u)
	})
	.strict();

type ContactSheetLockRecord = z.infer<typeof ContactSheetLockSchema>;

async function linuxProcessIdentity(
	pid: number
): Promise<ContactSheetLockRecord['processIdentity']> {
	const [bootId, stat] = await Promise.all([
		readFile('/proc/sys/kernel/random/boot_id', 'utf8'),
		readFile(`/proc/${pid}/stat`, 'utf8')
	]);
	const closing = stat.lastIndexOf(')');
	const startTicks = stat
		.slice(closing + 2)
		.trim()
		.split(/\s+/u)[19];
	if (!startTicks || !/^\d+$/u.test(startTicks)) {
		throw new Error('Linux process epoch is unavailable for contact-sheet coordination');
	}
	return { bootId: bootId.trim(), startTicks };
}

async function contactLockOwnerLive(record: ContactSheetLockRecord): Promise<boolean> {
	try {
		process.kill(record.pid, 0);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
		return true;
	}
	try {
		const current = await linuxProcessIdentity(record.pid);
		return (
			current.bootId === record.processIdentity.bootId &&
			current.startTicks === record.processIdentity.startTicks
		);
	} catch {
		return true;
	}
}

async function openBoundDirectory(directory: string): Promise<BoundDirectory> {
	const identity = await directoryFingerprint(directory);
	const handle = await open(
		directory,
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
	);
	try {
		const opened = await handle.stat();
		if (opened.dev !== identity.device || opened.ino !== identity.inode) {
			throw new Error(`Contact-sheet directory changed while opening: ${directory}`);
		}
		const procPath = `/proc/self/fd/${handle.fd}`;
		if ((await realpath(procPath)) !== identity.realPath) {
			throw new Error('Descriptor-bound contact-sheet paths are unavailable');
		}
		return { path: directory, procPath, identity, handle };
	} catch (error) {
		await handle.close();
		throw error;
	}
}

async function readBoundFile(directory: BoundDirectory, name: string): Promise<Buffer> {
	const handle = await open(
		path.join(directory.procPath, name),
		constants.O_RDONLY | constants.O_NOFOLLOW
	);
	try {
		const metadata = await handle.stat();
		if (!metadata.isFile()) throw new Error(`Review evidence is not a regular file: ${name}`);
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

async function inventoryContactSheets(
	directory: BoundDirectory | null,
	desired: DesiredContactSheet
): Promise<PlannedContactSheet> {
	if (!directory) return { ...desired, path: reviewSheetPath(desired.kind, 1) };
	const prefix = `${desired.kind}-`;
	const entries = await readdir(directory.procPath, { withFileTypes: true });
	const versions: { revision: number; bytes: Buffer }[] = [];
	for (const entry of entries) {
		if (!entry.name.startsWith(prefix)) continue;
		const match = new RegExp(`^${desired.kind}-v([1-9]\\d*)\\.png$`, 'u').exec(entry.name);
		if (!match || entry.isSymbolicLink() || !entry.isFile()) {
			throw new Error(`Malformed or colliding ${desired.kind} review evidence: ${entry.name}`);
		}
		const bytes = await readBoundFile(directory, entry.name);
		if ((await sharp(bytes).metadata()).format !== 'png') {
			throw new Error(`Malformed ${desired.kind} PNG evidence: ${entry.name}`);
		}
		versions.push({ revision: Number(match[1]), bytes });
	}
	versions.sort((left, right) => left.revision - right.revision);
	const latest = versions.at(-1);
	if (latest?.bytes.equals(desired.bytes)) {
		return { ...desired, path: reviewSheetPath(desired.kind, latest.revision) };
	}
	return { ...desired, path: reviewSheetPath(desired.kind, (latest?.revision ?? 0) + 1) };
}

interface ContactSheetLock {
	readonly path: string;
	readonly bytes: Buffer;
	readonly device: number;
	readonly inode: number;
	readonly record: ContactSheetLockRecord;
	readonly stage: BoundDirectory;
}

async function cleanupDerivedStage(root: string, record: ContactSheetLockRecord): Promise<void> {
	if (record.stageNamespace !== `.contact-sheet-staging-${record.transactionId}`) {
		throw new Error('Contact-sheet lock stage namespace is not derived from its transaction');
	}
	const authority = path.resolve(root, 'assets/wiki/skills/icon-production-v1');
	const stagePath = path.join(authority, record.stageNamespace);
	const metadata = await lstat(stagePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (!metadata) return;
	if (metadata.isSymbolicLink() || !metadata.isDirectory() || (metadata.mode & 0o777) !== 0o700) {
		throw new Error('Dead contact-sheet stage is unsafe; cleanup required');
	}
	const stage = await openBoundDirectory(stagePath);
	try {
		for (const entry of await readdir(stage.procPath, { withFileTypes: true })) {
			if (
				!['lock.stage', 'contact-sheet.stage'].includes(entry.name) ||
				entry.isSymbolicLink() ||
				!entry.isFile()
			) {
				throw new Error(`Unexpected dead contact-sheet stage entry: ${entry.name}`);
			}
			await unlink(path.join(stage.procPath, entry.name));
		}
		await stage.handle.sync();
	} finally {
		await stage.handle.close();
	}
	const finalStage = await lstat(stagePath);
	if (
		finalStage.isSymbolicLink() ||
		!finalStage.isDirectory() ||
		finalStage.dev !== stage.identity.device ||
		finalStage.ino !== stage.identity.inode
	) {
		throw new Error('Dead contact-sheet stage identity changed before cleanup');
	}
	await rmdir(stagePath);
	await syncDirectory(authority);
}

async function acquireContactSheetLock(
	root: string,
	directory: BoundDirectory,
	testHooks?: SkillIconRuntimeTestHooks
): Promise<ContactSheetLock> {
	const lockPath = path.join(directory.procPath, '.contact-sheet.lock');
	for (let attempt = 0; attempt < 500; attempt += 1) {
		const existing = await lstat(lockPath).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (existing) {
			await testHooks?.afterContactSheetLockObservation?.({ lockPath });
			const observed = await lstat(lockPath).catch((error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return null;
				throw error;
			});
			if (!observed || observed.dev !== existing.dev || observed.ino !== existing.ino) continue;
			if (existing.isSymbolicLink() || !existing.isFile() || (existing.mode & 0o777) !== 0o600) {
				throw new Error('Malformed contact-sheet lock is preserved; recovery required');
			}
			let record: ContactSheetLockRecord;
			let existingBytes: Buffer;
			try {
				existingBytes = await readBoundFile(directory, '.contact-sheet.lock');
			} catch (error) {
				const current = await lstat(lockPath).catch(() => null);
				if (!current || current.dev !== existing.dev || current.ino !== existing.ino) continue;
				throw new Error('Malformed contact-sheet lock is preserved; recovery required', {
					cause: error
				});
			}
			const afterRead = await lstat(lockPath).catch(() => null);
			if (!afterRead || afterRead.dev !== existing.dev || afterRead.ino !== existing.ino) continue;
			try {
				record = ContactSheetLockSchema.parse(JSON.parse(existingBytes.toString('utf8')));
			} catch (error) {
				const current = await lstat(lockPath).catch(() => null);
				if (!current || current.dev !== existing.dev || current.ino !== existing.ino) continue;
				throw new Error('Malformed contact-sheet lock is preserved; recovery required', {
					cause: error
				});
			}
			if (record.stageNamespace !== `.contact-sheet-staging-${record.transactionId}`) {
				throw new Error('Mismatched contact-sheet lock is preserved; recovery required');
			}
			if (await contactLockOwnerLive(record)) {
				await new Promise((resolve) => setTimeout(resolve, 10));
				continue;
			}
			const before = await lstat(lockPath).catch(() => null);
			if (!before || before.dev !== existing.dev || before.ino !== existing.ino) continue;
			try {
				await cleanupDerivedStage(root, record);
			} catch (error) {
				const current = await lstat(lockPath).catch(() => null);
				if (
					!current ||
					current.dev !== existing.dev ||
					current.ino !== existing.ino ||
					(error as NodeJS.ErrnoException).code === 'ENOENT'
				) {
					await new Promise((resolve) => setTimeout(resolve, 10));
					continue;
				}
				throw error;
			}
			const immediatelyBefore = await lstat(lockPath).catch(() => null);
			if (!immediatelyBefore) continue;
			const immediatelyBeforeBytes = await readBoundFile(directory, '.contact-sheet.lock').catch(
				() => null
			);
			const afterImmediateRead = await lstat(lockPath).catch(() => null);
			if (
				before.dev !== immediatelyBefore.dev ||
				before.ino !== immediatelyBefore.ino ||
				!immediatelyBeforeBytes?.equals(existingBytes) ||
				!afterImmediateRead ||
				afterImmediateRead.dev !== immediatelyBefore.dev ||
				afterImmediateRead.ino !== immediatelyBefore.ino
			) {
				continue;
			}
			try {
				await unlink(lockPath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
				throw error;
			}
			await directory.handle.sync();
			continue;
		}
		const transactionId = randomUUID();
		const stageNamespace = `.contact-sheet-staging-${transactionId}`;
		const authority = path.resolve(root, 'assets/wiki/skills/icon-production-v1');
		const stagePath = path.join(authority, stageNamespace);
		await mkdir(stagePath, { mode: 0o700 });
		await syncDirectory(authority);
		const stage = await openBoundDirectory(stagePath);
		let ownedLockIdentity: { device: number; inode: number } | null = null;
		try {
			const record = ContactSheetLockSchema.parse({
				schemaVersion: 'skill-icon-contact-sheet-lock-v1',
				transactionId,
				pid: process.pid,
				processIdentity: await linuxProcessIdentity(process.pid),
				createdAt: new Date().toISOString(),
				stageNamespace
			});
			const bytes = Buffer.from(`${JSON.stringify(record)}\n`);
			const privatePath = path.join(stage.procPath, 'lock.stage');
			const handle = await open(
				privatePath,
				constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
				0o600
			);
			try {
				const metadata = await handle.stat();
				ownedLockIdentity = { device: metadata.dev, inode: metadata.ino };
				await handle.writeFile(bytes);
				await handle.sync();
				await stage.handle.sync();
				await testHooks?.afterContactSheetLockStage?.({
					stagePath: privatePath,
					lockBytes: bytes
				});
				const [heldBefore, stagedBefore] = await Promise.all([handle.stat(), lstat(privatePath)]);
				if (
					heldBefore.dev !== metadata.dev ||
					heldBefore.ino !== metadata.ino ||
					stagedBefore.isSymbolicLink() ||
					!stagedBefore.isFile() ||
					stagedBefore.dev !== metadata.dev ||
					stagedBefore.ino !== metadata.ino ||
					!(await readBoundFile(stage, 'lock.stage')).equals(bytes)
				) {
					throw new Error('Staged contact-sheet lock identity changed before link');
				}
				await link(privatePath, lockPath);
				await directory.handle.sync();
				await testHooks?.afterContactSheetLockLink?.({ lockPath, lockBytes: bytes });
				const [heldAfter, stagedAfter, linkedAfter] = await Promise.all([
					handle.stat(),
					lstat(privatePath),
					lstat(lockPath)
				]);
				const linkedBytes = await readBoundFile(directory, '.contact-sheet.lock');
				if (
					heldAfter.dev !== metadata.dev ||
					heldAfter.ino !== metadata.ino ||
					heldAfter.nlink < 2 ||
					stagedAfter.dev !== metadata.dev ||
					stagedAfter.ino !== metadata.ino ||
					linkedAfter.dev !== metadata.dev ||
					linkedAfter.ino !== metadata.ino ||
					!linkedBytes.equals(bytes) ||
					ContactSheetLockSchema.parse(JSON.parse(linkedBytes.toString('utf8'))).transactionId !==
						record.transactionId
				) {
					throw new Error('Contact-sheet lock identity changed during link');
				}
				return {
					path: lockPath,
					bytes,
					device: metadata.dev,
					inode: metadata.ino,
					record,
					stage
				};
			} finally {
				await handle.close();
			}
		} catch (error) {
			const currentLock = await lstat(lockPath).catch(() => null);
			if (
				currentLock &&
				ownedLockIdentity &&
				currentLock.dev === ownedLockIdentity.device &&
				currentLock.ino === ownedLockIdentity.inode
			) {
				await unlink(lockPath);
				await directory.handle.sync();
			}
			await stage.handle.close();
			await cleanupDerivedStage(root, {
				schemaVersion: 'skill-icon-contact-sheet-lock-v1',
				transactionId,
				pid: process.pid,
				processIdentity: await linuxProcessIdentity(process.pid),
				createdAt: new Date().toISOString(),
				stageNamespace
			});
			if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
			throw error;
		}
	}
	throw new Error('Timed out waiting for the contact-sheet coordinator lock');
}

async function releaseContactSheetLock(
	root: string,
	directory: BoundDirectory,
	lock: ContactSheetLock
): Promise<void> {
	const metadata = await lstat(lock.path);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== lock.device ||
		metadata.ino !== lock.inode ||
		!(await readBoundFile(directory, '.contact-sheet.lock')).equals(lock.bytes)
	) {
		throw new Error('Contact-sheet coordinator lock ownership changed; cleanup required');
	}
	const privateLock = path.join(lock.stage.procPath, 'lock.stage');
	const privateMetadata = await lstat(privateLock);
	if (privateMetadata.dev !== lock.device || privateMetadata.ino !== lock.inode) {
		throw new Error('Private contact-sheet lock identity changed; cleanup required');
	}
	await unlink(lock.path);
	await directory.handle.sync();
	await unlink(privateLock);
	await lock.stage.handle.sync();
	await lock.stage.handle.close();
	const stagePath = path.resolve(
		root,
		'assets/wiki/skills/icon-production-v1',
		lock.record.stageNamespace
	);
	const stageMetadata = await lstat(stagePath);
	if (
		stageMetadata.isSymbolicLink() ||
		!stageMetadata.isDirectory() ||
		stageMetadata.dev !== lock.stage.identity.device ||
		stageMetadata.ino !== lock.stage.identity.inode
	) {
		throw new Error('Owned contact-sheet stage identity changed before cleanup');
	}
	await rmdir(stagePath);
	await syncDirectory(path.resolve(root, 'assets/wiki/skills/icon-production-v1'));
}

async function publishContactSheet(
	root: string,
	review: BoundDirectory,
	stage: BoundDirectory,
	sheet: PlannedContactSheet & SnapshottedContactSheet,
	testHooks?: SkillIconRuntimeTestHooks
): Promise<boolean> {
	const filename = path.basename(sheet.path);
	const destination = path.join(review.procPath, filename);
	const stagePath = path.join(stage.procPath, 'contact-sheet.stage');
	let stageFile: { device: number; inode: number } | null = null;
	let linked = false;
	try {
		const handle = await open(
			stagePath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o644
		);
		try {
			const metadata = await handle.stat();
			stageFile = { device: metadata.dev, inode: metadata.ino };
			await handle.writeFile(sheet.bytes);
			await handle.sync();
		} finally {
			await handle.close();
		}
		await stage.handle.sync();
		await testHooks?.beforeContactSheetPublish?.({ path: sheet.path, stagePath });
		await assertNoConcurrentPromotion(root);
		if (!(await sheet.readSession.verify())) return false;
		const staged = await lstat(stagePath);
		if (
			!stageFile ||
			staged.dev !== stageFile.device ||
			staged.ino !== stageFile.inode ||
			!(await readBoundFile(stage, 'contact-sheet.stage')).equals(sheet.bytes)
		) {
			throw new Error('Staged contact-sheet bytes or identity changed before publication');
		}
		await testHooks?.beforeContactSheetFinalLink?.();
		await link(stagePath, destination);
		linked = true;
		await review.handle.sync();
		await testHooks?.afterContactSheetFinalLink?.();
		if (!sameDirectory(await directoryFingerprint(review.path), review.identity)) {
			throw new Error(`Contact-sheet parent changed during publication: ${sheet.path}`);
		}
		const published = await lstat(destination);
		if (
			published.dev !== stageFile.device ||
			published.ino !== stageFile.inode ||
			!(await readBoundFile(review, filename)).equals(sheet.bytes)
		) {
			throw new Error(`Contact-sheet identity changed during publication: ${sheet.path}`);
		}
		return sheet.readSession.verify();
	} catch (error) {
		if (linked && stageFile) {
			const current = await lstat(destination).catch(() => null);
			if (current?.dev === stageFile.device && current.ino === stageFile.inode) {
				await unlink(destination);
				await review.handle.sync();
			}
		}
		throw error;
	} finally {
		const current = await lstat(stagePath).catch(() => null);
		if (
			current &&
			stageFile &&
			current.dev === stageFile.device &&
			current.ino === stageFile.inode
		) {
			await unlink(stagePath);
			await stage.handle.sync();
		}
	}
}

async function writeContactSheet(
	root: string,
	planner: () => Promise<DesiredContactSheet>,
	testHooks?: SkillIconRuntimeTestHooks
): Promise<{ sheet: PlannedContactSheet; written: boolean }> {
	await assertNoConcurrentPromotion(root);
	await ensureSafeParent(root, SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH);
	const review = await openBoundDirectory(
		path.resolve(root, 'assets/wiki/skills/icon-production-v1/review')
	);
	let lock: ContactSheetLock | null = null;
	try {
		lock = await acquireContactSheetLock(root, review, testHooks);
		await assertNoConcurrentPromotion(root);
		let wrote = false;
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const readSession = new ContactSheetReadSession(root, testHooks);
			await testHooks?.beforeContactSheetPlanner?.({ attempt });
			let desired: DesiredContactSheet;
			try {
				desired = await contactSheetReadContext.run(readSession, planner);
			} catch (error) {
				if (error instanceof ContactSheetReadSetChanged) continue;
				throw error;
			} finally {
				await testHooks?.afterContactSheetPlanner?.({ attempt });
			}
			if (!(await readSession.verify())) continue;
			const sourceSnapshot = readSession.digest();
			const sheet = await inventoryContactSheets(review, desired);
			const latestBytes = await readBoundFile(review, path.basename(sheet.path)).catch(
				(error: NodeJS.ErrnoException) => {
					if (error.code === 'ENOENT') return null;
					throw error;
				}
			);
			if (latestBytes?.equals(desired.bytes)) return { sheet, written: wrote };
			const current = await publishContactSheet(
				root,
				review,
				lock.stage,
				{ ...sheet, sourceSnapshot, readSession },
				testHooks
			);
			if (current) return { sheet, written: true };
			wrote =
				wrote ||
				(await readBoundFile(review, path.basename(sheet.path)).catch(() => null)) !== null;
		}
		throw new Error('source snapshot changed during export');
	} finally {
		try {
			if (lock) await releaseContactSheetLock(root, review, lock);
		} finally {
			await review.handle.close();
		}
	}
}

async function checkContactSheet(
	root: string,
	desired: DesiredContactSheet
): Promise<{ sheet: PlannedContactSheet; current: boolean }> {
	const reviewPath = path.resolve(root, 'assets/wiki/skills/icon-production-v1/review');
	const metadata = await metadataOrNull(reviewPath);
	if (!metadata) {
		return { sheet: await inventoryContactSheets(null, desired), current: false };
	}
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error('Contact-sheet review authority is unsafe');
	}
	const review = await openBoundDirectory(reviewPath);
	try {
		const sheet = await inventoryContactSheets(review, desired);
		const bytes = await readBoundFile(review, path.basename(sheet.path)).catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return null;
				throw error;
			}
		);
		return { sheet, current: bytes?.equals(desired.bytes) ?? false };
	} finally {
		await review.handle.close();
	}
}

async function approvedStandaloneRuntimePaths(root: string): Promise<string[]> {
	const managedPaths: string[] = [];
	for (const receiptPath of APPROVED_STANDALONE_RUNTIME_ACTIVATION_PATHS) {
		if (!(await metadataOrNull(path.resolve(root, receiptPath)))) continue;
		const receiptLocation = await assertRepositoryPath(
			root,
			receiptPath,
			'Approved standalone runtime activation',
			false
		);
		const receipt = ApprovedStandaloneRuntimeActivationSchema.parse(
			JSON.parse(
				(
					await readDirectRegularFile(receiptLocation, 'Approved standalone runtime activation')
				).toString('utf8')
			)
		);
		const slug = targetSlug(receipt.targetId);
		const expectedRuntime = [512, 256, 128] as const;
		for (const size of expectedRuntime) {
			const matches = receipt.runtime.filter((asset) => asset.width === size);
			const asset = matches[0];
			if (
				matches.length !== 1 ||
				!asset ||
				asset.height !== size ||
				asset.mediaType !== 'image/webp' ||
				asset.path !== `apps/web/static/skill-icons/v1/${size}/${slug}.webp`
			) {
				throw new Error(`Approved standalone runtime activation lacks its ${size}px asset`);
			}
			const bytes = await readRepositoryBytes(
				root,
				asset.path,
				'Approved standalone runtime asset'
			);
			if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.contentHash) {
				throw new Error(`Approved standalone runtime asset hash drift: ${asset.path}`);
			}
			managedPaths.push(asset.path);
		}
		const recognition = receipt.recognition;
		if (
			recognition.width !== RECOGNITION_SIZE ||
			recognition.height !== RECOGNITION_SIZE ||
			recognition.mediaType !== 'image/png' ||
			recognition.path !== `assets/wiki/skills/icon-production-v1/review/recognition/${slug}.png`
		) {
			throw new Error('Approved standalone runtime activation lacks its recognition asset');
		}
		const recognitionBytes = await readRepositoryBytes(
			root,
			recognition.path,
			'Approved standalone runtime recognition asset'
		);
		if (
			recognitionBytes.byteLength !== recognition.bytes ||
			sha256(recognitionBytes) !== recognition.contentHash
		) {
			throw new Error(`Approved standalone runtime asset hash drift: ${recognition.path}`);
		}
		managedPaths.push(recognition.path);
	}
	return managedPaths;
}

export async function exportSkillIconRuntime(options: {
	readonly root?: string;
	readonly mode: SkillIconRuntimeExportMode;
	readonly scope?: SkillIconRuntimeExportScope;
	readonly testHooks?: SkillIconRuntimeTestHooks;
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
	const contactSheetPlanner =
		scope === 'references'
			? () => planReferenceContactSheet(root)
			: scope === 'pilot'
				? () => planPilotContactSheet(root)
				: null;
	const desiredContactSheet =
		contactSheetPlanner && options.mode === 'check' ? await contactSheetPlanner() : null;
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
	const expectedManagedPaths = new Set([
		...approved.flatMap((record) => [
			record.assets.runtime512.path,
			record.assets.runtime256.path,
			record.assets.runtime128.path,
			record.assets.recognition96.path
		]),
		...(await approvedStandaloneRuntimePaths(root))
	]);
	const orphanPaths = (await listManagedAssetFiles(root)).filter(
		(assetPath) => !expectedManagedPaths.has(assetPath)
	);
	for (const orphanPath of orphanPaths) drift.push(`orphan ${orphanPath}`);
	let contactSheet: PlannedContactSheet | null = null;
	let sheetState: 'missing' | 'current' | null = null;
	if (desiredContactSheet && options.mode === 'check') {
		const checked = await checkContactSheet(root, desiredContactSheet);
		contactSheet = checked.sheet;
		sheetState = checked.current ? 'current' : 'missing';
		if (!checked.current) drift.push(`missing ${contactSheet.path}`);
	}
	let written = false;
	if (options.mode === 'write') {
		if (drift.length > 0) {
			throw new Error(`Runtime export drift requires promotion: ${drift.join(', ')}`);
		}
		if (contactSheetPlanner) {
			const published = await writeContactSheet(root, contactSheetPlanner, options.testHooks);
			contactSheet = published.sheet;
			sheetState = 'current';
			written = published.written;
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
			(!contactSheetPlanner || sheetState === 'current'),
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

import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	SkillIconCatalogSchema,
	SkillIconMasterPathSchema,
	SkillIconMasterySchema,
	SkillIconRaritySchema,
	type SkillIconAsset,
	type SkillIconMastery,
	type SkillIconRarity
} from '../packages/contracts/src/index.js';
import { SKILL_ICON_CATALOG_PATH } from './export-skill-icon-production.js';

export const SKILL_ICON_BACKING_MASTER_PATH =
	'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png' as const;

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
	return (await readFile(absolute)).equals(item.bytes) ? 'current' : 'drift';
}

async function writeDerivativePlan(
	root: string,
	plan: readonly PlannedDerivative[]
): Promise<boolean> {
	const states = await Promise.all(plan.map((item) => currentDerivative(root, item)));
	const drift = plan.filter((_, index) => states[index] === 'drift');
	if (drift.length > 0) {
		throw new Error(
			`Derivative collision/drift: ${drift.map((item) => item.asset.path).join(', ')}`
		);
	}
	const missing = plan.filter((_, index) => states[index] === 'missing');
	const created: { path: string; hash: string }[] = [];
	try {
		for (const item of missing) {
			const destination = await ensureSafeParent(root, item.asset.path);
			const handle = await open(destination, 'wx');
			const opened = await handle.stat();
			try {
				await handle.writeFile(item.bytes);
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
			created.push({ path: destination, hash: item.asset.contentHash });
		}
		return missing.length > 0;
	} catch (error) {
		for (const item of created.reverse()) {
			const current = await readFile(item.path).catch(() => null);
			if (current && sha256(current) === item.hash) await unlink(item.path);
		}
		throw error;
	}
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
		readRepositoryLayer(root, SKILL_ICON_BACKING_MASTER_PATH, 'Canonical skill icon backing'),
		readRepositoryLayer(root, masterPath, 'Approved skill icon master'),
		readRepositoryLayer(root, framePathFor(rarity), `Canonical ${rarity} rarity frame`)
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
	await writeDerivativePlan(resolvedRoot, plan);
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
		readRepositoryLayer(
			input.root,
			SKILL_ICON_BACKING_MASTER_PATH,
			'Approved canonical skill icon backing'
		),
		readRepositoryLayer(
			input.root,
			framePathFor(record.rarity),
			`Approved canonical ${record.rarity} rarity frame`
		)
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
	const name = escapeSvgText(input.name.trim());
	const label = escapeSvgText(formatSkillReviewLabel(input.mastery, input.level));
	const svg = Buffer.from(
		[
			`<svg xmlns="http://www.w3.org/2000/svg" width="${REVIEW_CARD_WIDTH}" height="${REVIEW_LABEL_HEIGHT}" viewBox="0 0 ${REVIEW_CARD_WIDTH} ${REVIEW_LABEL_HEIGHT}">`,
			'<rect width="640" height="160" rx="12" fill="#0f172a" fill-opacity="0.96"/>',
			'<g fill="#f8fafc" text-anchor="middle" font-family="DejaVu Sans" font-kerning="none" text-rendering="geometricPrecision">',
			`<text x="320" y="55" font-size="30" font-weight="700">${name}</text>`,
			`<text x="320" y="112" font-size="23" letter-spacing="1.5">${label}</text>`,
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

function scopeRecords(
	records: readonly SkillIconRuntimeSourceRecord[],
	scope: SkillIconRuntimeExportScope
): readonly SkillIconRuntimeSourceRecord[] {
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
	const statuses = resolved.map(({ record, plan, states }) => ({
		targetId: record.targetId,
		current: states.every((state) => state === 'current'),
		assets: assetsFromPlan(plan)
	}));
	let written = false;
	if (options.mode === 'write') {
		const drift = resolved.flatMap(({ plan, states }) =>
			plan.filter((_, index) => states[index] === 'drift')
		);
		if (drift.length > 0) {
			throw new Error(
				`Derivative collision/drift: ${drift.map((item) => item.asset.path).join(', ')}`
			);
		}
		written = await writeDerivativePlan(
			root,
			resolved.flatMap(({ plan }) => plan)
		);
		for (const status of statuses) status.current = true;
	}
	return {
		mode: options.mode,
		scope,
		records: statuses,
		inSync: statuses.every((status) => status.current),
		written
	};
}

function parseCli(args: readonly string[]): {
	readonly mode: SkillIconRuntimeExportMode;
	readonly scope: SkillIconRuntimeExportScope;
} {
	const modeArgs = args.filter((argument) => argument === '--check' || argument === '--write');
	if (modeArgs.length !== 1) {
		throw new Error(
			'Usage: tsx tools/compose-skill-icon-assets.ts --check|--write [--scope all|pilot|references]'
		);
	}
	const scopeIndex = args.indexOf('--scope');
	const scope = scopeIndex === -1 ? 'all' : args[scopeIndex + 1];
	if (!scope || !['all', 'pilot', 'references'].includes(scope)) {
		throw new Error('Skill icon runtime scope must be all, pilot, or references');
	}
	const expectedLength = scopeIndex === -1 ? 1 : 3;
	if (args.length !== expectedLength || (scopeIndex !== -1 && scopeIndex + 1 >= args.length)) {
		throw new Error('Unknown or incomplete skill icon runtime arguments');
	}
	return {
		mode: modeArgs[0] === '--write' ? 'write' : 'check',
		scope: scope as SkillIconRuntimeExportScope
	};
}

async function runCli(args: readonly string[]): Promise<void> {
	const report = await exportSkillIconRuntime(parseCli(args));
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

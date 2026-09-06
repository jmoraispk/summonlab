import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp, { type OverlayOptions } from 'sharp';

import {
	SkillIconCatalogSchema,
	SkillIconCleanupManifestSchema,
	SkillIconCleanupResultSchema
} from '../packages/contracts/src/index.js';
import {
	QUALITY_CLEANUP_ROOT,
	loadCleanupRevisionPackets
} from './skill-icon-quality-cleanup-lib.js';
import { CleanupRevisionResultSchema } from './persist-skill-icon-cleanup-output.js';

type Mode = 'check' | 'write';

const REVIEW_ROOT = `${QUALITY_CLEANUP_ROOT}/review` as const;
const REVIEW_CATALOG_ROOT = `${REVIEW_ROOT}/catalog` as const;
const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
const CATALOG_PAGE_SIZE = 24;
const DARK = { r: 6, g: 7, b: 9, alpha: 1 } as const;
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false } as const;

export interface SkillIconCleanupReviewRecord {
	readonly targetId: string;
	readonly name: string;
	readonly domain: string;
	readonly family: string;
	readonly rank: string;
	readonly motifFamily: string;
	readonly disposition: string;
	readonly finding: string | null;
	readonly beforePath: string;
	readonly cleanupPath: string;
}

export interface SkillIconCleanupRevisionReceipt {
	readonly targetId: string;
	readonly status: 'candidate' | 'revise';
	readonly compositePath: string;
}

export interface SkillIconCleanupReviewPlanRecord extends SkillIconCleanupReviewRecord {
	readonly afterPath: string;
	readonly revisionStatus: 'candidate' | 'revise' | null;
}

export interface SkillIconCleanupReviewPlan {
	readonly records: readonly SkillIconCleanupReviewPlanRecord[];
	readonly summary: {
		readonly catalogRecords: number;
		readonly reviewedRevisions: number;
		readonly candidateRevisions: number;
		readonly reviseRevisions: number;
		readonly symbolicDecisions: number;
		readonly ownerPromotion: false;
	};
}

export interface SkillIconCleanupReviewReport {
	readonly mode: Mode;
	readonly catalogPages: number;
	readonly reviewFiles: readonly string[];
	readonly reviewedRevisions: number;
	readonly candidateRevisions: number;
	readonly reviseRevisions: number;
	readonly frameExamples: number;
	readonly symbolicDecisions: number;
	readonly ownerPromotion: false;
}

export function buildSkillIconQualityCleanupReviewPlan(input: {
	readonly records: readonly SkillIconCleanupReviewRecord[];
	readonly revisionReceipts: readonly SkillIconCleanupRevisionReceipt[];
}): SkillIconCleanupReviewPlan {
	const recordsByTarget = new Map(input.records.map((record) => [record.targetId, record]));
	if (recordsByTarget.size !== input.records.length) {
		throw new Error('Cleanup review records contain duplicate target IDs');
	}
	const receiptsByTarget = new Map(
		input.revisionReceipts.map((receipt) => [receipt.targetId, receipt])
	);
	if (receiptsByTarget.size !== input.revisionReceipts.length) {
		throw new Error('Cleanup review receipts contain duplicate target IDs');
	}
	for (const receipt of input.revisionReceipts) {
		if (!recordsByTarget.has(receipt.targetId)) {
			throw new Error(`Cleanup review receipt references an unknown target: ${receipt.targetId}`);
		}
	}
	const records = input.records.map((record) => {
		const receipt = receiptsByTarget.get(record.targetId) ?? null;
		return {
			...record,
			afterPath: receipt?.compositePath ?? record.cleanupPath,
			revisionStatus: receipt?.status ?? null
		};
	});
	const candidateRevisions = input.revisionReceipts.filter(
		(receipt) => receipt.status === 'candidate'
	).length;
	const reviseRevisions = input.revisionReceipts.length - candidateRevisions;
	return {
		records,
		summary: {
			catalogRecords: records.length,
			reviewedRevisions: input.revisionReceipts.length,
			candidateRevisions,
			reviseRevisions,
			symbolicDecisions: records.filter((record) => record.disposition === 'owner-review').length,
			ownerPromotion: false
		}
	};
}

function parseMode(args: readonly string[]): Mode {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? '')) {
		throw new Error('Usage: tsx tools/render-skill-icon-quality-cleanup-review.ts --write|--check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function concise(value: string, limit = 46): string {
	return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function textLayer(
	width: number,
	height: number,
	lines: readonly {
		readonly text: string;
		readonly x: number;
		readonly y: number;
		readonly size: number;
		readonly fill?: string;
		readonly anchor?: 'start' | 'middle';
		readonly weight?: number;
	}[]
): Buffer {
	const content = lines
		.map(
			(line) =>
				`<text x="${line.x}" y="${line.y}" text-anchor="${line.anchor ?? 'middle'}" font-family="sans-serif" font-size="${line.size}" font-weight="${line.weight ?? 400}" fill="${line.fill ?? '#f3ead8'}">${escapeXml(line.text)}</text>`
		)
		.join('');
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`
	);
}

function rectanglesLayer(
	width: number,
	height: number,
	rectangles: readonly {
		readonly x: number;
		readonly y: number;
		readonly width: number;
		readonly height: number;
		readonly fill?: string;
		readonly stroke?: string;
		readonly radius?: number;
	}[]
): Buffer {
	const content = rectangles
		.map(
			(rectangle) =>
				`<rect x="${rectangle.x}" y="${rectangle.y}" width="${rectangle.width}" height="${rectangle.height}" rx="${rectangle.radius ?? 0}" fill="${rectangle.fill ?? 'none'}" stroke="${rectangle.stroke ?? 'none'}"/>`
		)
		.join('');
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`
	);
}

function isInside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function regularBytes(root: string, repositoryPath: string): Promise<Buffer> {
	const absolutePath = path.resolve(root, repositoryPath);
	if (!isInside(root, absolutePath)) {
		throw new Error(`Review input path escapes the repository: ${repositoryPath}`);
	}
	const metadata = await lstat(absolutePath);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Review input is not a regular file: ${repositoryPath}`);
	}
	return readFile(absolutePath);
}

async function writeAtomic(destination: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(destination), { recursive: true });
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await rename(stage, destination);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

async function syncBytes(
	root: string,
	repositoryPath: string,
	bytes: Buffer,
	mode: Mode
): Promise<void> {
	const destination = path.resolve(root, repositoryPath);
	if (!isInside(root, destination)) {
		throw new Error(`Review output path escapes the repository: ${repositoryPath}`);
	}
	const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(bytes)) return;
	if (mode === 'check')
		throw new Error(`Stale or missing cleanup review artifact: ${repositoryPath}`);
	await writeAtomic(destination, bytes);
}

async function assertExactPngInventory(
	root: string,
	repositoryDirectory: string,
	expectedNames: readonly string[]
): Promise<void> {
	const directory = path.resolve(root, repositoryDirectory);
	const actual = (
		await readdir(directory).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [] as string[];
			throw error;
		})
	).filter((name) => name.endsWith('.png'));
	const expected = new Set(expectedNames);
	if (
		actual.length !== expected.size ||
		actual.some((name) => !expected.has(name) || !name.endsWith('.png'))
	) {
		throw new Error(`Unexpected cleanup review inventory: ${repositoryDirectory}`);
	}
}

async function readRevisionReceipt(
	root: string,
	packet: Awaited<ReturnType<typeof loadCleanupRevisionPackets>>[number]
): Promise<SkillIconCleanupRevisionReceipt> {
	const [packetBytes, resultBytes] = await Promise.all([
		regularBytes(root, packet.path),
		regularBytes(root, packet.packet.output.resultPath)
	]);
	const result = CleanupRevisionResultSchema.parse(
		JSON.parse(resultBytes.toString('utf8')) as unknown
	);
	if (
		result.targetId !== packet.packet.targetId ||
		result.revisionPacket.path !== packet.path ||
		result.revisionPacket.contentHash !== sha256(packetBytes) ||
		result.composite.path !== packet.packet.output.compositePath ||
		result.completionContract.selfPromotionForbidden !== true
	) {
		throw new Error(`Revision receipt binding drift: ${packet.packet.targetId}`);
	}
	const compositeBytes = await regularBytes(root, result.composite.path);
	if (sha256(compositeBytes) !== result.composite.contentHash) {
		throw new Error(`Revision composite hash drift: ${packet.packet.targetId}`);
	}
	const metadata = await sharp(compositeBytes).metadata();
	if (metadata.width !== 1024 || metadata.height !== 1024 || !metadata.hasAlpha) {
		throw new Error(`Revision composite envelope drift: ${packet.packet.targetId}`);
	}
	return {
		targetId: result.targetId,
		status: result.status,
		compositePath: result.composite.path
	};
}

async function resizedImage(
	root: string,
	repositoryPath: string,
	size: number,
	cache: Map<string, Promise<Buffer>>
): Promise<Buffer> {
	const key = `${repositoryPath}:${size}`;
	const existing = cache.get(key);
	if (existing) return existing;
	const created = regularBytes(root, repositoryPath).then((bytes) =>
		sharp(bytes).resize(size, size, { fit: 'contain' }).png(PNG_OPTIONS).toBuffer()
	);
	cache.set(key, created);
	return created;
}

async function catalogPage(
	root: string,
	page: number,
	records: readonly SkillIconCleanupReviewPlanRecord[],
	cache: Map<string, Promise<Buffer>>
): Promise<Buffer> {
	const columns = 6;
	const cellWidth = 540;
	const cellHeight = 390;
	const header = 92;
	const width = columns * cellWidth;
	const height = header + 4 * cellHeight;
	const iconSize = 240;
	const overlays: OverlayOptions[] = [];
	const rectangles = [] as {
		x: number;
		y: number;
		width: number;
		height: number;
		fill?: string;
		stroke?: string;
		radius?: number;
	}[];
	const labels: {
		text: string;
		x: number;
		y: number;
		size: number;
		fill?: string;
		anchor?: 'start' | 'middle';
		weight?: number;
	}[] = [
		{
			text: `Summonlab Skill Cleanup Review · Catalog Page ${String(page).padStart(2, '0')}`,
			x: width / 2,
			y: 54,
			size: 34,
			weight: 700
		}
	];
	for (const [index, record] of records.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = column * cellWidth;
		const top = header + row * cellHeight;
		rectangles.push({
			x: left + 6,
			y: top + 4,
			width: cellWidth - 12,
			height: cellHeight - 10,
			fill: '#0e1218',
			stroke: '#343b47',
			radius: 8
		});
		const [before, after] = await Promise.all([
			resizedImage(root, record.beforePath, iconSize, cache),
			resizedImage(root, record.afterPath, iconSize, cache)
		]);
		overlays.push(
			{ input: before, left: left + 10, top: top + 28 },
			{ input: after, left: left + 290, top: top + 28 }
		);
		labels.push(
			{ text: 'BEFORE', x: left + 130, y: top + 22, size: 12, fill: '#9aa3b1' },
			{
				text: record.revisionStatus
					? `REVISED · ${record.revisionStatus.toUpperCase()}`
					: 'CLEANUP',
				x: left + 410,
				y: top + 22,
				size: 12,
				fill: record.revisionStatus === 'revise' ? '#e9b16f' : '#8ec6ad'
			},
			{
				text: `${concise(record.name, 30)} · ${record.rank}`,
				x: left + 14,
				y: top + 290,
				size: 18,
				anchor: 'start',
				weight: 700
			},
			{
				text: concise(`${record.domain} / ${record.family}`, 42),
				x: left + 14,
				y: top + 314,
				size: 15,
				anchor: 'start',
				fill: '#c7ced8'
			},
			{
				text: `motif: ${concise(record.motifFamily, 40)}`,
				x: left + 14,
				y: top + 336,
				size: 14,
				anchor: 'start',
				fill: '#aeb8c7'
			},
			{
				text: `[${record.disposition}]`,
				x: left + 14,
				y: top + 358,
				size: 14,
				anchor: 'start',
				fill: record.disposition === 'owner-review' ? '#e7bf83' : '#91c4ae'
			},
			{
				text: `[${concise(record.finding ?? 'no finding', 47)}]`,
				x: left + 14,
				y: top + 378,
				size: 12,
				anchor: 'start',
				fill: '#bec5d0'
			}
		);
	}
	overlays.unshift({ input: rectanglesLayer(width, height, rectangles), left: 0, top: 0 });
	overlays.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({ create: { width, height, channels: 4, background: DARK } })
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

async function pairedEvidenceSheet(input: {
	readonly root: string;
	readonly title: string;
	readonly records: readonly SkillIconCleanupReviewPlanRecord[];
	readonly cache: Map<string, Promise<Buffer>>;
	readonly statusLabel: (record: SkillIconCleanupReviewPlanRecord) => string;
}): Promise<Buffer> {
	const columns = 4;
	const iconSize = 384;
	const cardWidth = 820;
	const cardHeight = 510;
	const header = 98;
	const rows = Math.ceil(input.records.length / columns);
	const width = columns * cardWidth;
	const height = header + rows * cardHeight;
	const overlays: OverlayOptions[] = [];
	const rectangles = [] as {
		x: number;
		y: number;
		width: number;
		height: number;
		fill?: string;
		stroke?: string;
		radius?: number;
	}[];
	const labels: {
		text: string;
		x: number;
		y: number;
		size: number;
		fill?: string;
		anchor?: 'start' | 'middle';
		weight?: number;
	}[] = [{ text: input.title, x: width / 2, y: 57, size: 36, weight: 700 }];
	for (const [index, record] of input.records.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = column * cardWidth;
		const top = header + row * cardHeight;
		rectangles.push({
			x: left + 8,
			y: top + 6,
			width: cardWidth - 16,
			height: cardHeight - 12,
			fill: '#0e1218',
			stroke: '#3c4655',
			radius: 10
		});
		const [before, after] = await Promise.all([
			resizedImage(input.root, record.beforePath, iconSize, input.cache),
			resizedImage(input.root, record.afterPath, iconSize, input.cache)
		]);
		overlays.push(
			{ input: before, left: left + 18, top: top + 36 },
			{ input: after, left: left + 418, top: top + 36 }
		);
		labels.push(
			{ text: 'BEFORE', x: left + 210, y: top + 26, size: 14, fill: '#a6afbd' },
			{
				text: input.statusLabel(record),
				x: left + 610,
				y: top + 26,
				size: 14,
				fill: record.revisionStatus === 'revise' ? '#e9b16f' : '#94c9b0'
			},
			{
				text: `${concise(record.name, 33)} · ${record.rank} · ${record.motifFamily}`,
				x: left + 18,
				y: top + 444,
				size: 18,
				anchor: 'start',
				weight: 700
			},
			{
				text: `[${record.disposition}] [${concise(record.finding ?? 'no finding', 84)}]`,
				x: left + 18,
				y: top + 472,
				size: 14,
				anchor: 'start',
				fill: '#c7ced8'
			}
		);
	}
	overlays.unshift({ input: rectanglesLayer(width, height, rectangles), left: 0, top: 0 });
	overlays.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({ create: { width, height, channels: 4, background: DARK } })
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

async function symbolicDecisionSheet(input: {
	readonly root: string;
	readonly records: readonly SkillIconCleanupReviewPlanRecord[];
	readonly cache: Map<string, Promise<Buffer>>;
}): Promise<Buffer> {
	const columns = 2;
	const iconSize = 384;
	const cardWidth = 720;
	const cardHeight = 510;
	const header = 112;
	const rows = Math.ceil(input.records.length / columns);
	const width = columns * cardWidth;
	const height = header + rows * cardHeight;
	const overlays: OverlayOptions[] = [];
	const rectangles = [] as {
		x: number;
		y: number;
		width: number;
		height: number;
		fill?: string;
		stroke?: string;
		radius?: number;
	}[];
	const labels: {
		text: string;
		x: number;
		y: number;
		size: number;
		fill?: string;
		anchor?: 'start' | 'middle';
		weight?: number;
	}[] = [
		{
			text: 'Summonlab Skill Cleanup Review · Symbolic-language Owner Decisions',
			x: width / 2,
			y: 54,
			size: 34,
			weight: 700
		},
		{
			text: 'Undecided: owner must explicitly record keep or remove; this sheet makes no selection.',
			x: width / 2,
			y: 84,
			size: 17,
			fill: '#e7bf83'
		}
	];
	for (const [index, record] of input.records.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = column * cardWidth;
		const top = header + row * cardHeight;
		rectangles.push({
			x: left + 8,
			y: top + 6,
			width: cardWidth - 16,
			height: cardHeight - 12,
			fill: '#0e1218',
			stroke: '#514735',
			radius: 10
		});
		const icon = await resizedImage(input.root, record.afterPath, iconSize, input.cache);
		overlays.push({ input: icon, left: left + 20, top: top + 40 });
		labels.push(
			{ text: 'CURRENT CLEANUP CANDIDATE', x: left + 212, y: top + 28, size: 14, fill: '#a6afbd' },
			{
				text: `${concise(record.name, 19)} · ${record.rank}`,
				x: left + 424,
				y: top + 82,
				size: 22,
				anchor: 'start',
				weight: 700
			},
			{
				text: concise(`${record.domain} / ${record.family} / ${record.motifFamily}`, 25),
				x: left + 424,
				y: top + 116,
				size: 14,
				anchor: 'start',
				fill: '#c7ced8'
			},
			{
				text: 'KEEP / REMOVE: UNDECIDED',
				x: left + 424,
				y: top + 160,
				size: 14,
				anchor: 'start',
				fill: '#e7bf83',
				weight: 700
			},
			{
				text: concise(record.finding ?? 'No owner-review finding recorded.', 27),
				x: left + 424,
				y: top + 198,
				size: 13,
				anchor: 'start',
				fill: '#bec5d0'
			}
		);
	}
	overlays.unshift({ input: rectanglesLayer(width, height, rectangles), left: 0, top: 0 });
	overlays.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({ create: { width, height, channels: 4, background: DARK } })
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

async function referenceAssetsSheet(input: {
	readonly root: string;
	readonly assets: readonly {
		readonly label: string;
		readonly path: string;
		readonly contentHash: string;
	}[];
	readonly cache: Map<string, Promise<Buffer>>;
}): Promise<Buffer> {
	const columns = 4;
	const iconSize = 384;
	const cardWidth = 420;
	const cardHeight = 470;
	const header = 94;
	const rows = Math.ceil(input.assets.length / columns);
	const width = columns * cardWidth;
	const height = header + rows * cardHeight;
	const overlays: OverlayOptions[] = [];
	const rectangles = [] as {
		x: number;
		y: number;
		width: number;
		height: number;
		fill?: string;
		stroke?: string;
		radius?: number;
	}[];
	const labels: {
		text: string;
		x: number;
		y: number;
		size: number;
		fill?: string;
		anchor?: 'start' | 'middle';
		weight?: number;
	}[] = [
		{
			text: 'Summonlab Skill Cleanup Review · Canonical Backing and Rarity Frames',
			x: width / 2,
			y: 55,
			size: 34,
			weight: 700
		}
	];
	for (const [index, asset] of input.assets.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = column * cardWidth;
		const top = header + row * cardHeight;
		rectangles.push({
			x: left + 8,
			y: top + 6,
			width: cardWidth - 16,
			height: cardHeight - 12,
			fill: '#0e1218',
			stroke: '#3c4655',
			radius: 10
		});
		const bytes = await regularBytes(input.root, asset.path);
		if (sha256(bytes) !== asset.contentHash) {
			throw new Error(`Reference asset hash drift: ${asset.label}`);
		}
		const icon = await resizedImage(input.root, asset.path, iconSize, input.cache);
		overlays.push({ input: icon, left: left + 18, top: top + 34 });
		labels.push({
			text: asset.label,
			x: left + cardWidth / 2,
			y: top + 438,
			size: 20,
			weight: 700
		});
	}
	overlays.unshift({ input: rectanglesLayer(width, height, rectangles), left: 0, top: 0 });
	overlays.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({ create: { width, height, channels: 4, background: DARK } })
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

export async function renderSkillIconQualityCleanupReview(options: {
	readonly root?: string;
	readonly mode: Mode;
}): Promise<SkillIconCleanupReviewReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const [manifestBytes, catalogBytes, revisionPackets] = await Promise.all([
		regularBytes(root, `${QUALITY_CLEANUP_ROOT}/manifest.json`),
		regularBytes(root, 'assets/wiki/skills/icon-production-v1/catalog.json'),
		loadCleanupRevisionPackets(root)
	]);
	const manifest = SkillIconCleanupManifestSchema.parse(
		JSON.parse(manifestBytes.toString('utf8')) as unknown
	);
	const catalog = SkillIconCatalogSchema.parse(
		JSON.parse(catalogBytes.toString('utf8')) as unknown
	);
	if (manifest.records.length !== 456 || catalog.records.length !== 456) {
		throw new Error('Cleanup review requires the complete 456-skill catalog');
	}
	const catalogByTarget = new Map(catalog.records.map((record) => [record.targetId, record]));
	const packets = [...revisionPackets].sort((left, right) => left.path.localeCompare(right.path));
	if (packets.length !== 28) throw new Error('Cleanup review requires exactly 28 revision packets');
	const receipts = await Promise.all(packets.map((packet) => readRevisionReceipt(root, packet)));
	if (new Set(receipts.map((receipt) => receipt.targetId)).size !== 28) {
		throw new Error('Cleanup review receipts do not cover 28 unique targets');
	}
	const records: SkillIconCleanupReviewRecord[] = manifest.records.map((record) => {
		const catalogRecord = catalogByTarget.get(record.targetId);
		if (!catalogRecord || catalogRecord.rarity !== record.rank) {
			throw new Error(`Cleanup review catalog binding drift: ${record.targetId}`);
		}
		return {
			targetId: record.targetId,
			name: catalogRecord.name,
			domain: catalogRecord.domain,
			family: catalogRecord.family,
			rank: record.rank,
			motifFamily: catalogRecord.motifFamily ?? 'standalone/unmapped',
			disposition: record.disposition,
			finding:
				record.findings.length === 0
					? null
					: record.findings.map((finding) => `${finding.kind}: ${finding.detail}`).join(' | '),
			beforePath: record.sourceCandidate.path,
			cleanupPath: record.cleanupCompositePath
		};
	});
	const plan = buildSkillIconQualityCleanupReviewPlan({ records, revisionReceipts: receipts });
	if (
		plan.summary.reviewedRevisions !== 28 ||
		plan.summary.symbolicDecisions !== 10 ||
		plan.summary.ownerPromotion !== false
	) {
		throw new Error('Cleanup review plan does not preserve the Task 7 decision boundary');
	}
	const revisionTargets = new Set(receipts.map((receipt) => receipt.targetId));
	const semanticRecords = plan.records.filter((record) => revisionTargets.has(record.targetId));
	const frameRecords = plan.records.filter((record) =>
		record.finding?.includes('frame-composition')
	);
	const symbolicRecords = plan.records.filter((record) => record.disposition === 'owner-review');
	if (
		semanticRecords.length !== 28 ||
		frameRecords.length !== 10 ||
		symbolicRecords.length !== 10
	) {
		throw new Error('Cleanup review focused evidence inventory is incomplete');
	}

	const referenceAssets: { label: string; path: string; contentHash: string }[] = [];
	let backing: { path: string; contentHash: string } | null = null;
	for (const rank of RANKS) {
		const record = manifest.records.find((candidate) => candidate.rank === rank);
		if (!record) throw new Error(`Cleanup review is missing rank ${rank}`);
		const result = SkillIconCleanupResultSchema.parse(
			JSON.parse((await regularBytes(root, record.resultPath)).toString('utf8')) as unknown
		);
		if (!backing) backing = result.compositionAuthority.backing;
		referenceAssets.push({
			label: `${rank}-rank canonical frame`,
			path: result.compositionAuthority.frame.path,
			contentHash: result.compositionAuthority.frame.contentHash
		});
	}
	if (!backing) throw new Error('Cleanup review is missing the canonical backing');
	referenceAssets.unshift({
		label: 'Canonical charcoal-forged-stone backing',
		path: backing.path,
		contentHash: backing.contentHash
	});
	if (new Set(referenceAssets.map((asset) => asset.path)).size !== 8) {
		throw new Error('Cleanup review reference assets are not distinct');
	}

	const cache = new Map<string, Promise<Buffer>>();
	const outputs: { path: string; bytes: Buffer }[] = [];
	outputs.push({
		path: `${REVIEW_ROOT}/reference-assets-v1.png`,
		bytes: await referenceAssetsSheet({ root, assets: referenceAssets, cache })
	});
	outputs.push({
		path: `${REVIEW_ROOT}/frame-examples-v1.png`,
		bytes: await pairedEvidenceSheet({
			root,
			title: 'Summonlab Skill Cleanup Review · Frame and Composition Examples',
			records: frameRecords,
			cache,
			statusLabel: () => 'CLEANUP COMPOSITE'
		})
	});
	outputs.push({
		path: `${REVIEW_ROOT}/semantic-revisions-v1.png`,
		bytes: await pairedEvidenceSheet({
			root,
			title: 'Summonlab Skill Cleanup Review · 28 Semantic Revisions',
			records: semanticRecords,
			cache,
			statusLabel: (record) => `REVISED · ${record.revisionStatus?.toUpperCase() ?? 'MISSING'}`
		})
	});
	outputs.push({
		path: `${REVIEW_ROOT}/symbolic-decisions-v1.png`,
		bytes: await symbolicDecisionSheet({ root, records: symbolicRecords, cache })
	});
	for (
		let offset = 0, page = 1;
		offset < plan.records.length;
		offset += CATALOG_PAGE_SIZE, page += 1
	) {
		outputs.push({
			path: `${REVIEW_CATALOG_ROOT}/page-${String(page).padStart(2, '0')}.png`,
			bytes: await catalogPage(
				root,
				page,
				plan.records.slice(offset, offset + CATALOG_PAGE_SIZE),
				cache
			)
		});
	}
	const catalogPaths = outputs
		.filter((output) => output.path.startsWith(`${REVIEW_CATALOG_ROOT}/`))
		.map((output) => output.path);
	if (catalogPaths.length !== 19) throw new Error('Cleanup review catalog pagination drifted');
	for (const output of outputs) await syncBytes(root, output.path, output.bytes, options.mode);
	await assertExactPngInventory(
		root,
		REVIEW_CATALOG_ROOT,
		catalogPaths.map((repositoryPath) => path.basename(repositoryPath))
	);
	await assertExactPngInventory(root, REVIEW_ROOT, [
		'reference-assets-v1.png',
		'frame-examples-v1.png',
		'semantic-revisions-v1.png',
		'symbolic-decisions-v1.png'
	]);
	return {
		mode: options.mode,
		catalogPages: catalogPaths.length,
		reviewFiles: outputs.map((output) => output.path),
		reviewedRevisions: plan.summary.reviewedRevisions,
		candidateRevisions: plan.summary.candidateRevisions,
		reviseRevisions: plan.summary.reviseRevisions,
		frameExamples: frameRecords.length,
		symbolicDecisions: symbolicRecords.length,
		ownerPromotion: false
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	renderSkillIconQualityCleanupReview({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}

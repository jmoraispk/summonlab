import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { format } from 'prettier';
import sharp from 'sharp';
import { z } from 'zod';

import {
	loadVerifiedAffinityReviewRound,
	verifiedRegularBytes
} from './affinity-round-postgeneration-lib.js';
import {
	AffinityReviewRoundIdSchema,
	affinityRoundRoot,
	sha256Bytes,
	type AffinityReviewRoundId
} from './affinity-review-round-lib.js';

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const WIDTH = 1920;
const HEIGHT = 1080;
const COLUMNS = 6;
const ROWS = 4;
const HEADER = 96;

const ContactSourceSchema = z
	.object({
		index: z.number().int().min(1).max(24),
		opaqueLabel: z.string().regex(/^S\d{2}$/u),
		targetId: z.string().min(1),
		resultId: z.string().min(1),
		resultCanonicalSha256: Hash,
		candidatePath: z.string().min(1),
		candidateByteSha256: Hash
	})
	.strict();

export const AffinityRoundContactSheetManifestSchema = z
	.object({
		schemaVersion: z.literal('affinity-review-round-contact-sheet-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		roundId: AffinityReviewRoundIdSchema,
		generatedAt: z.iso.datetime(),
		integrationReceiptCanonicalSha256: Hash,
		orderingSeed: z.string().min(1),
		width: z.literal(WIDTH),
		height: z.literal(HEIGHT),
		sourceCount: z.literal(24),
		imagePath: z.string().min(1),
		imageByteSha256: Hash,
		orderedSources: z.array(ContactSourceSchema).length(24)
	})
	.strict()
	.superRefine((manifest, context) => {
		for (const field of ['targetId', 'resultId', 'candidatePath'] as const)
			if (new Set(manifest.orderedSources.map((source) => source[field])).size !== 24)
				context.addIssue({
					code: 'custom',
					path: ['orderedSources'],
					message: `${field} must be unique`
				});
	});

function deterministicKey(seed: string, targetId: string, candidateHash: string): string {
	return createHash('sha256').update(`${seed}\0${targetId}\0${candidateHash}`).digest('hex');
}

function overlay(roundId: AffinityReviewRoundId): Buffer {
	const cellWidth = WIDTH / COLUMNS;
	const cellHeight = (HEIGHT - HEADER) / ROWS;
	const cells = Array.from({ length: 24 }, (_, index) => {
		const x = (index % COLUMNS) * cellWidth;
		const y = HEADER + Math.floor(index / COLUMNS) * cellHeight;
		return `<g><rect x="${x + 5}" y="${y + 5}" width="${cellWidth - 10}" height="${cellHeight - 10}" rx="4" fill="none" stroke="#ffffff33" stroke-width="2"/><rect x="${x + 6}" y="${y + cellHeight - 36}" width="${cellWidth - 12}" height="30" fill="#080b11e8"/><text x="${x + 18}" y="${y + cellHeight - 15}" fill="#f4efe5" font-size="15" font-weight="700" font-family="sans-serif" letter-spacing="2">S${String(index + 1).padStart(2, '0')}</text></g>`;
	}).join('');
	return Buffer.from(
		`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="none"/><text x="28" y="37" fill="#70b7c4" font-size="14" font-weight="700" font-family="sans-serif" letter-spacing="3">SUMMONLAB · BLIND ROUND CONTACT SHEET</text><text x="28" y="68" fill="#f4efe599" font-size="14" font-family="sans-serif">24 opaque specimens · ${roundId} · unapproved</text>${cells}</svg>`
	);
}

async function renderContactSheet(sources: readonly Buffer[], roundId: AffinityReviewRoundId) {
	const cellWidth = WIDTH / COLUMNS;
	const cellHeight = (HEIGHT - HEADER) / ROWS;
	const images = await Promise.all(
		sources.map(async (bytes, index) => ({
			input: await sharp(bytes)
				.rotate()
				.resize({
					width: cellWidth - 12,
					height: cellHeight - 42,
					fit: 'contain',
					background: '#05070b'
				})
				.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
				.toBuffer(),
			left: (index % COLUMNS) * cellWidth + 6,
			top: HEADER + Math.floor(index / COLUMNS) * cellHeight + 6
		}))
	);
	return sharp({
		create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#07090d' }
	})
		.composite([...images, { input: overlay(roundId), left: 0, top: 0 }])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function durableTemp(destination: string, bytes: Uint8Array | string): Promise<string> {
	const temporary = `${destination}.sheet-${process.pid}-${randomUUID()}.tmp`;
	const handle = await open(temporary, 'wx');
	await handle.writeFile(bytes);
	await handle.sync();
	await handle.close();
	return temporary;
}

async function publishExclusiveOrExact(
	temporary: string,
	destination: string,
	expected: Buffer
): Promise<boolean> {
	try {
		await link(temporary, destination);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		if (!(await readFile(destination)).equals(expected))
			throw new Error(`Existing contact-sheet artifact differs: ${destination}`, { cause: error });
		return false;
	}
}

export interface AffinityRoundContactSheetReport {
	readonly mode: 'check' | 'write';
	readonly roundId: AffinityReviewRoundId;
	readonly imagePath: string;
	readonly manifestPath: string;
	readonly imageByteSha256: string;
	readonly inSync: boolean;
	readonly written: boolean;
}

export async function exportAffinityRoundContactSheet(options: {
	readonly workspaceRoot?: string;
	readonly roundId: AffinityReviewRoundId;
	readonly mode: 'check' | 'write';
}): Promise<AffinityRoundContactSheetReport> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const roundId = AffinityReviewRoundIdSchema.parse(options.roundId);
	const round = await loadVerifiedAffinityReviewRound(workspaceRoot, roundId);
	const orderingSeed = `affinity-workflow-v1:${roundId}:blind-contact-sheet-v1`;
	const evidence = round.receipt.evidence
		.map((entry) => {
			if (!entry.candidatePath || !entry.candidateByteSha256)
				throw new Error(`Contact sheet requires a retained image for ${entry.targetId}.`);
			return entry as typeof entry & {
				candidatePath: string;
				candidateByteSha256: string;
			};
		})
		.toSorted((left, right) =>
			deterministicKey(orderingSeed, left.targetId, left.candidateByteSha256).localeCompare(
				deterministicKey(orderingSeed, right.targetId, right.candidateByteSha256)
			)
		);
	const sourceBytes = await Promise.all(
		evidence.map(async (entry) => {
			const bytes = await verifiedRegularBytes(workspaceRoot, entry.candidatePath);
			if (sha256Bytes(bytes) !== entry.candidateByteSha256)
				throw new Error(`Contact-sheet candidate drift: ${entry.candidatePath}`);
			return bytes;
		})
	);
	const rendered = await renderContactSheet(sourceBytes, roundId);
	const root = affinityRoundRoot(roundId);
	const imagePath = `${root}/contact-sheet.png`;
	const manifestPath = `${root}/contact-sheet.json`;
	const manifest = AffinityRoundContactSheetManifestSchema.parse({
		schemaVersion: 'affinity-review-round-contact-sheet-v1',
		experimentId: 'affinity-workflow-v1',
		roundId,
		generatedAt: round.receipt.completedAt,
		integrationReceiptCanonicalSha256: round.integrationReceiptCanonicalSha256,
		orderingSeed,
		width: WIDTH,
		height: HEIGHT,
		sourceCount: 24,
		imagePath,
		imageByteSha256: sha256Bytes(rendered),
		orderedSources: evidence.map((entry, index) => ({
			index: index + 1,
			opaqueLabel: `S${String(index + 1).padStart(2, '0')}`,
			targetId: entry.targetId,
			resultId: entry.resultId,
			resultCanonicalSha256: entry.resultCanonicalSha256,
			candidatePath: entry.candidatePath,
			candidateByteSha256: entry.candidateByteSha256
		}))
	});
	const manifestText = await format(JSON.stringify(manifest), {
		filepath: manifestPath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
	const imageDestination = path.resolve(workspaceRoot, imagePath);
	const manifestDestination = path.resolve(workspaceRoot, manifestPath);
	const currentImage = await readFile(imageDestination).catch(() => null);
	const currentManifest = await readFile(manifestDestination).catch(() => null);
	const inSync =
		currentImage?.equals(rendered) === true && currentManifest?.toString() === manifestText;
	let written = false;
	if (options.mode === 'write' && !inSync) {
		await mkdir(path.dirname(imageDestination), { recursive: true });
		const imageTemporary = await durableTemp(imageDestination, rendered);
		const manifestTemporary = await durableTemp(manifestDestination, manifestText);
		let imageOwned = false;
		try {
			imageOwned = await publishExclusiveOrExact(imageTemporary, imageDestination, rendered);
			await publishExclusiveOrExact(
				manifestTemporary,
				manifestDestination,
				Buffer.from(manifestText)
			);
			written = true;
		} catch (error) {
			const committedManifest = await readFile(manifestDestination).catch(() => null);
			if (imageOwned && !committedManifest?.equals(Buffer.from(manifestText)))
				await unlink(imageDestination);
			throw error;
		} finally {
			await Promise.all([
				unlink(imageTemporary).catch(() => undefined),
				unlink(manifestTemporary).catch(() => undefined)
			]);
		}
	}
	return {
		mode: options.mode,
		roundId,
		imagePath,
		manifestPath,
		imageByteSha256: manifest.imageByteSha256,
		inSync: inSync || written,
		written
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const args = process.argv.slice(2);
	const roundAt = args.indexOf('--round');
	exportAffinityRoundContactSheet({
		roundId: AffinityReviewRoundIdSchema.parse(args[roundAt + 1]),
		mode: args.includes('--write') ? 'write' : 'check'
	})
		.then((report) => {
			process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
			if (!report.inSync) process.exitCode = 1;
		})
		.catch((error) => {
			console.error(error);
			process.exitCode = 1;
		});
}

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp, { type OverlayOptions } from 'sharp';

import {
	assertAllHeldParentsNamed,
	assertOwnedPath,
	cleanupTransaction,
	heldChild,
	publishStaged,
	readSafeRepositoryFile,
	removeOwnedPath,
	stageOutput
} from './persist-skill-icon-cleanup-output.js';
import { finalizeCleanupRevisionV2 } from './skill-icon-quality-cleanup-v2-lib.js';

const REVIEW_ROOT =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v3-recovery' as const;
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false } as const;

interface InspectionRecord {
	readonly targetId: string;
	readonly sourceMode: 'deterministic-inset' | 'identity-adoption';
	readonly compositePath: string;
	readonly compositeHash: string;
	readonly display384Hash: string;
	readonly fullSizeObservation: string;
	readonly display384Observation: string;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function textLayer(width: number, height: number, text: string): Buffer {
	const escaped = text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#090d12"/><text x="${width / 2}" y="30" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#f2eadc">${escaped}</text></svg>`
	);
}

function compactCaptionLayer(record: InspectionRecord): Buffer {
	const [domain, family, skill] = record.targetId.split(':');
	const escaped = [
		`${domain} / ${family}`,
		`${skill} · ${record.sourceMode === 'identity-adoption' ? 'identity' : 'inset'}`
	]
		.map((line) =>
			line
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')
		)
		.join(
			'</text><text x="192" y="38" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#f2eadc">'
		);
	return Buffer.from(
		`<svg width="384" height="48" xmlns="http://www.w3.org/2000/svg"><text x="192" y="16" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#f2eadc">${escaped}</text></svg>`
	);
}

function isMissing(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function writeCreateOnly(root: string, repositoryPath: string, bytes: Buffer): Promise<void> {
	try {
		const existing = await readSafeRepositoryFile(
			root,
			repositoryPath,
			'V3 recovery inspection output'
		);
		if (!existing.bytes.equals(bytes)) {
			throw new Error(`V3 recovery inspection output drift: ${repositoryPath}`);
		}
		return;
	} catch (error) {
		if (!isMissing(error)) throw error;
	}
	const staged = await stageOutput(root, repositoryPath, bytes);
	try {
		await publishStaged(staged);
		await assertAllHeldParentsNamed([staged]);
		const finalPath = heldChild(staged.parent, path.basename(staged.destination));
		await assertOwnedPath(finalPath, staged, 'V3 recovery inspection output');
		if (!(await readFile(finalPath)).equals(bytes)) {
			throw new Error(`V3 recovery inspection bytes changed: ${repositoryPath}`);
		}
		await removeOwnedPath(staged.temporaryPath, staged);
	} catch (error) {
		try {
			await cleanupTransaction([staged]);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				'V3 recovery inspection publication failed and safe rollback was incomplete',
				{ cause: cleanupError }
			);
		}
		throw error;
	} finally {
		await staged.parent.handle.close().catch(() => undefined);
	}
}

/** Four literal 1024px composites per 2048px page; no resize or caption touches a cell. */
async function originalCellsPage(input: {
	readonly root: string;
	readonly records: readonly InspectionRecord[];
}): Promise<Buffer> {
	if (input.records.length < 1 || input.records.length > 4) {
		throw new Error('A true-original v3 page contains one through four 1024px cells');
	}
	const overlays: OverlayOptions[] = [];
	for (const [index, record] of input.records.entries()) {
		const composite = await readFile(path.join(input.root, record.compositePath));
		const metadata = await sharp(composite).metadata();
		if (metadata.width !== 1024 || metadata.height !== 1024) {
			throw new Error(`V3 inspection requires a true 1024px composite: ${record.compositePath}`);
		}
		overlays.push({
			input: composite,
			left: (index % 2) * 1024,
			top: Math.floor(index / 2) * 1024
		});
	}
	return sharp({
		create: { width: 2048, height: 2048, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
	})
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

async function display384Sheet(input: {
	readonly root: string;
	readonly records: readonly InspectionRecord[];
}): Promise<Buffer> {
	const cell = 384;
	const caption = 48;
	const header = 52;
	const columns = 4;
	const rows = Math.ceil(input.records.length / columns);
	const width = cell * columns;
	const height = header + rows * (cell + caption);
	const overlays: OverlayOptions[] = [
		{
			input: textLayer(width, header, 'Task 7A round 2 · v3 recovery · 384px display renders'),
			left: 0,
			top: 0
		}
	];
	for (const [index, record] of input.records.entries()) {
		const left = (index % columns) * cell;
		const top = header + Math.floor(index / columns) * (cell + caption);
		const icon = await sharp(await readFile(path.join(input.root, record.compositePath)))
			.resize(cell, cell, { fit: 'fill' })
			.png(PNG_OPTIONS)
			.toBuffer();
		overlays.push(
			{ input: icon, left, top },
			{ input: compactCaptionLayer(record), left, top: top + cell }
		);
	}
	return sharp({
		create: { width, height, channels: 4, background: { r: 9, g: 13, b: 18, alpha: 1 } }
	})
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

export async function renderCleanupRevisionV3RecoveryInspection(input: {
	readonly root?: string;
}): Promise<{ readonly reviewFiles: readonly string[]; readonly inspected: number }> {
	const root = path.resolve(input.root ?? process.cwd());
	const finalization = await finalizeCleanupRevisionV2({ root });
	const receiptsByTargetRevision = new Map(
		finalization.receipts.map((receipt) => [`${receipt.targetId}@${receipt.revision}`, receipt])
	);
	const records: InspectionRecord[] = finalization.selection.selected
		.filter((selection) => selection.revision === 3 && selection.status === 'candidate')
		.map((selection) => {
			const receipt = receiptsByTargetRevision.get(`${selection.targetId}@${selection.revision}`);
			if (!receipt) {
				throw new Error(
					`Highest selected v3 candidate lacks an authenticated receipt: ${selection.targetId}`
				);
			}
			if (receipt.result.sourceMode === 'generation-v2') {
				throw new Error(
					`Generation-v2 receipt entered deterministic v3 inspection: ${receipt.targetId}`
				);
			}
			return {
				targetId: receipt.targetId,
				sourceMode: receipt.result.sourceMode,
				compositePath: receipt.result.composite.path,
				compositeHash: receipt.result.composite.contentHash,
				display384Hash: receipt.result.display384.contentHash,
				fullSizeObservation: receipt.result.inspection.fullSize.observation,
				display384Observation: receipt.result.inspection.display384.observation
			};
		})
		.sort((left, right) => left.targetId.localeCompare(right.targetId));
	if (records.length !== 24)
		throw new Error('V3 deterministic inspection requires exactly 24 candidates');
	const originalPages = await Promise.all(
		Array.from({ length: 6 }, async (_, index) => ({
			path: `${REVIEW_ROOT}/original-1024-v3-page-${String(index + 1).padStart(2, '0')}.png`,
			bytes: await originalCellsPage({ root, records: records.slice(index * 4, index * 4 + 4) })
		}))
	);
	const display384 = {
		path: `${REVIEW_ROOT}/display-384-v3-r2.png`,
		bytes: await display384Sheet({ root, records })
	};
	const report = {
		path: `${REVIEW_ROOT}/deterministic-v3-r2-report.json`,
		bytes: jsonBytes({
			schemaVersion: 'skill-icon-quality-cleanup-v3-recovery-inspection-v2',
			supersedes: {
				reportPath: `${REVIEW_ROOT}/deterministic-v3-report.json`,
				display384Path: `${REVIEW_ROOT}/display-384-v3.png`,
				reason:
					'The initial 384px sheet kept long labels on one line; r2 uses compact two-line captions without changing any candidate evidence.'
			},
			inspected: records.length,
			cellEvidence: {
				kind: 'true-original-1024px-cells',
				cellSize: 1024,
				pageSize: 2048,
				cellsPerPage: 4,
				pages: originalPages.map(({ path: pagePath, bytes }) => ({
					path: pagePath,
					contentHash: sha256(bytes)
				}))
			},
			display384: { path: display384.path, contentHash: sha256(display384.bytes) },
			legacyV2Evidence: {
				path: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v2-recovery/deterministic-v2-1024.png',
				actualCellSize: 512,
				status: 'legacy-scaled-evidence-not-used-for-v3-original-size-review'
			},
			generationPendingTargetIds: finalization.pendingGenerationTargetIds,
			records
		})
	};
	const outputs = [...originalPages, display384, report];
	for (const output of outputs) await writeCreateOnly(root, output.path, output.bytes);
	return { reviewFiles: outputs.map((output) => output.path), inspected: records.length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	renderCleanupRevisionV3RecoveryInspection({})
		.then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}

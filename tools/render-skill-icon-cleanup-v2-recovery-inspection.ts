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
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v2-recovery' as const;
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

function textLayer(width: number, height: number, text: string): Buffer {
	const escaped = text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#090d12"/><text x="${width / 2}" y="32" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="#f2eadc">${escaped}</text></svg>`
	);
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function isMissing(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function writeCreateOnly(root: string, repositoryPath: string, bytes: Buffer): Promise<void> {
	try {
		const existing = await readSafeRepositoryFile(
			root,
			repositoryPath,
			'V2 recovery inspection output'
		);
		if (!existing.bytes.equals(bytes)) {
			throw new Error(`V2 recovery inspection output drift: ${repositoryPath}`);
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
		await assertOwnedPath(finalPath, staged, 'V2 recovery inspection output');
		if (!(await readFile(finalPath)).equals(bytes)) {
			throw new Error(`V2 recovery inspection bytes changed: ${repositoryPath}`);
		}
		await removeOwnedPath(staged.temporaryPath, staged);
	} catch (error) {
		try {
			await cleanupTransaction([staged]);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				'V2 recovery inspection publication failed and safe rollback was incomplete',
				{ cause: cleanupError }
			);
		}
		throw error;
	} finally {
		await staged.parent.handle.close().catch(() => undefined);
	}
}

async function contactSheet(input: {
	readonly root: string;
	readonly records: readonly InspectionRecord[];
	readonly size: 384 | 1024;
}): Promise<Buffer> {
	const columns = 4;
	const iconSize = input.size === 1024 ? 512 : 384;
	const captionHeight = 44;
	const header = 58;
	const rows = Math.ceil(input.records.length / columns);
	const width = columns * iconSize;
	const height = header + rows * (iconSize + captionHeight);
	const overlays: OverlayOptions[] = [
		{
			input: textLayer(
				width,
				header,
				`Task 7A deterministic v2 inspection · ${input.size}px ${
					input.size === 1024 ? 'source composites' : 'display renders'
				}`
			),
			left: 0,
			top: 0
		}
	];
	for (const [index, record] of input.records.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = column * iconSize;
		const top = header + row * (iconSize + captionHeight);
		const composite = await readFile(path.join(input.root, record.compositePath));
		const icon = await sharp(composite)
			.resize(iconSize, iconSize, { fit: 'fill' })
			.png(PNG_OPTIONS)
			.toBuffer();
		overlays.push(
			{ input: icon, left, top },
			{
				input: textLayer(iconSize, captionHeight, `${record.targetId} · ${record.sourceMode}`),
				left,
				top: top + iconSize
			}
		);
	}
	return sharp({
		create: { width, height, channels: 4, background: { r: 9, g: 13, b: 18, alpha: 1 } }
	})
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

export async function renderCleanupRevisionV2RecoveryInspection(input: {
	readonly root?: string;
}): Promise<{ readonly reviewFiles: readonly string[]; readonly inspected: number }> {
	const root = path.resolve(input.root ?? process.cwd());
	const finalization = await finalizeCleanupRevisionV2({ root });
	const records: InspectionRecord[] = finalization.packets
		.filter(({ packet }) => packet.sourceMode !== 'generation-v2')
		.map(({ packet }) => {
			if (packet.sourceMode === 'generation-v2') {
				throw new Error(
					`Generation-v2 packet entered deterministic inspection: ${packet.targetId}`
				);
			}
			const receipt = finalization.receipts.find(
				(candidate) => candidate.targetId === packet.targetId
			);
			if (!receipt || receipt.status !== 'candidate') {
				throw new Error(`V2 deterministic inspection lacks a candidate: ${packet.targetId}`);
			}
			return {
				targetId: packet.targetId,
				sourceMode: packet.sourceMode,
				compositePath: receipt.result.composite.path,
				compositeHash: receipt.result.composite.contentHash,
				display384Hash: receipt.result.display384.contentHash,
				fullSizeObservation: receipt.result.inspection.fullSize.observation,
				display384Observation: receipt.result.inspection.display384.observation
			};
		})
		.sort((left, right) => left.targetId.localeCompare(right.targetId));
	if (records.length !== 24)
		throw new Error('V2 deterministic inspection requires exactly 24 candidates');
	const outputs = [
		{
			path: `${REVIEW_ROOT}/deterministic-v2-1024.png`,
			bytes: await contactSheet({ root, records, size: 1024 })
		},
		{
			path: `${REVIEW_ROOT}/deterministic-v2-384.png`,
			bytes: await contactSheet({ root, records, size: 384 })
		},
		{
			path: `${REVIEW_ROOT}/deterministic-v2-report.json`,
			bytes: jsonBytes({
				schemaVersion: 'skill-icon-quality-cleanup-v2-recovery-inspection-v1',
				inspected: records.length,
				generationPendingTargetIds: finalization.pendingGenerationTargetIds,
				records
			})
		}
	] as const;
	for (const output of outputs) await writeCreateOnly(root, output.path, output.bytes);
	return { reviewFiles: outputs.map((output) => output.path), inspected: records.length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	renderCleanupRevisionV2RecoveryInspection({})
		.then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { ImageProductionOutput } from '../packages/contracts/src/index.js';
import { AFFINITY_EXPERIMENT_ROOT } from './image-production-lib.js';
import {
	scanAffinityReviewWorkspace,
	type ValidatedImageProductionExecution
} from './sync-affinity-review.js';
import sharp from 'sharp';

export const AFFINITY_CONTACT_SHEET_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/contact-sheet.png` as const;
export const AFFINITY_CONTACT_SHEET_WIDTH = 1920 as const;
export const AFFINITY_CONTACT_SHEET_HEIGHT = 1080 as const;
const CONTACT_SHEET_SEED = 'affinity-workflow-v1-controlled-blind-sheet-v1' as const;
const COLUMN_COUNT = 6 as const;
const ROW_COUNT = 4 as const;
const HEADER_HEIGHT = 96 as const;
const CELL_WIDTH = AFFINITY_CONTACT_SHEET_WIDTH / COLUMN_COUNT;
const CELL_HEIGHT = (AFFINITY_CONTACT_SHEET_HEIGHT - HEADER_HEIGHT) / ROW_COUNT;

export interface AffinityContactSheetSource {
	readonly targetId: string;
	readonly status: 'candidate' | 'revise';
	readonly bytes: Uint8Array;
}

export interface AffinityContactSheetReport {
	readonly mode: 'check' | 'write';
	readonly outputPath: typeof AFFINITY_CONTACT_SHEET_PATH;
	readonly sourceCount: 24;
	readonly candidateCount: number;
	readonly reviseCount: number;
	readonly width: typeof AFFINITY_CONTACT_SHEET_WIDTH;
	readonly height: typeof AFFINITY_CONTACT_SHEET_HEIGHT;
	readonly contentHash: string;
	readonly written: boolean;
	readonly inSync: boolean;
}

function sha256(bytes: Uint8Array | string): string {
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

export function orderAffinityContactSheetSources(
	sources: readonly AffinityContactSheetSource[]
): readonly AffinityContactSheetSource[] {
	return [...sources].sort((left, right) => {
		const leftKey = sha256(`${CONTACT_SHEET_SEED}\0${left.targetId}`);
		const rightKey = sha256(`${CONTACT_SHEET_SEED}\0${right.targetId}`);
		return leftKey.localeCompare(rightKey) || left.targetId.localeCompare(right.targetId);
	});
}

function overlaySvg(sources: readonly AffinityContactSheetSource[]): Buffer {
	const cells = sources
		.map((source, index) => {
			const column = index % COLUMN_COUNT;
			const row = Math.floor(index / COLUMN_COUNT);
			const x = column * CELL_WIDTH;
			const y = HEADER_HEIGHT + row * CELL_HEIGHT;
			const label = `S${String(index + 1).padStart(2, '0')}`;
			return `<g>
  <rect x="${x + 5}" y="${y + 5}" width="${CELL_WIDTH - 10}" height="${CELL_HEIGHT - 10}" rx="4" fill="none" stroke="#ffffff33" stroke-width="2"/>
  <rect x="${x + 6}" y="${y + CELL_HEIGHT - 36}" width="${CELL_WIDTH - 12}" height="30" fill="#080b11e8"/>
  <text x="${x + 18}" y="${y + CELL_HEIGHT - 15}" fill="#f4efe5" font-size="15" font-weight="700" font-family="sans-serif" letter-spacing="2">${escapeXml(label)}</text>
</g>`;
		})
		.join('\n');
	return Buffer.from(`<svg width="${AFFINITY_CONTACT_SHEET_WIDTH}" height="${AFFINITY_CONTACT_SHEET_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="none"/>
<text x="28" y="37" fill="#70b7c4" font-size="14" font-weight="700" font-family="sans-serif" letter-spacing="3">SUMMONLAB · BLIND CONTROLLED CONTACT SHEET</text>
<text x="28" y="68" fill="#f4efe599" font-size="14" font-family="sans-serif">24 opaque specimens · candidate and revision evidence · unapproved</text>
${cells}
</svg>`);
}

export async function renderAffinityContactSheet(
	inputSources: readonly AffinityContactSheetSource[]
): Promise<Buffer> {
	if (inputSources.length !== COLUMN_COUNT * ROW_COUNT) {
		throw new Error(
			`Affinity contact sheet requires exactly 24 sources, found ${inputSources.length}.`
		);
	}
	const targetIds = new Set(inputSources.map((source) => source.targetId));
	if (targetIds.size !== inputSources.length)
		throw new Error('Contact-sheet target IDs must be unique.');
	const sources = orderAffinityContactSheetSources(inputSources);
	const composites = await Promise.all(
		sources.map(async (source, index) => {
			const column = index % COLUMN_COUNT;
			const row = Math.floor(index / COLUMN_COUNT);
			const image = await sharp(source.bytes)
				.rotate()
				.resize({
					width: CELL_WIDTH - 12,
					height: CELL_HEIGHT - 42,
					fit: 'contain',
					background: '#05070b',
					withoutEnlargement: false
				})
				.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
				.toBuffer();
			return {
				input: image,
				left: column * CELL_WIDTH + 6,
				top: HEADER_HEIGHT + row * CELL_HEIGHT + 6
			};
		})
	);
	return sharp({
		create: {
			width: AFFINITY_CONTACT_SHEET_WIDTH,
			height: AFFINITY_CONTACT_SHEET_HEIGHT,
			channels: 3,
			background: '#07090d'
		}
	})
		.composite([...composites, { input: overlaySvg(sources), left: 0, top: 0 }])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

function retainedOutput(
	execution: ValidatedImageProductionExecution
): ImageProductionOutput | null {
	if (execution.result.status === 'candidate') {
		const selected = execution.result.attempts.find(
			(attempt) => attempt.attemptId === execution.result.selectedAttemptId
		);
		return selected?.output ?? null;
	}
	return [...execution.result.attempts].reverse().find((attempt) => attempt.output)?.output ?? null;
}

export async function exportAffinityContactSheet(
	workspaceRoot = process.cwd(),
	mode: 'check' | 'write' = 'check'
): Promise<AffinityContactSheetReport> {
	const scan = await scanAffinityReviewWorkspace(workspaceRoot);
	if (scan.issues.length > 0) {
		throw new Error(
			`Cannot build contact sheet with ${scan.issues.length} affinity review issue(s).`
		);
	}
	const controlled = scan.executions.filter(({ target }) => target.cohort === 'controlled');
	if (controlled.length !== 24) {
		throw new Error(`Expected 24 completed controlled targets, found ${controlled.length}.`);
	}
	const sources = await Promise.all(
		controlled.map(async (execution): Promise<AffinityContactSheetSource> => {
			const output = retainedOutput(execution);
			if (!output)
				throw new Error(`Controlled target has no retained image: ${execution.target.targetId}`);
			return {
				targetId: execution.target.targetId,
				status: execution.result.status === 'candidate' ? 'candidate' : 'revise',
				bytes: await readFile(path.resolve(workspaceRoot, output.path))
			};
		})
	);
	const rendered = await renderAffinityContactSheet(sources);
	const outputPath = path.resolve(workspaceRoot, AFFINITY_CONTACT_SHEET_PATH);
	const current = await readFile(outputPath).catch(() => null);
	const inSync = current?.equals(rendered) ?? false;
	let written = false;
	if (mode === 'write' && !inSync) {
		await mkdir(path.dirname(outputPath), { recursive: true });
		const temporary = `${outputPath}.export-${process.pid}.tmp`;
		await writeFile(temporary, rendered, { flag: 'wx' });
		await rename(temporary, outputPath);
		written = true;
	}
	return {
		mode,
		outputPath: AFFINITY_CONTACT_SHEET_PATH,
		sourceCount: 24,
		candidateCount: sources.filter((source) => source.status === 'candidate').length,
		reviseCount: sources.filter((source) => source.status === 'revise').length,
		width: AFFINITY_CONTACT_SHEET_WIDTH,
		height: AFFINITY_CONTACT_SHEET_HEIGHT,
		contentHash: sha256(rendered),
		written,
		inSync: written || inSync
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const mode = process.argv.includes('--write') ? 'write' : 'check';
	const report = await exportAffinityContactSheet(process.cwd(), mode);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (mode === 'check' && !report.inSync) process.exitCode = 1;
}

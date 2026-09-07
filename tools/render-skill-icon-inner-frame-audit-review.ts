import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import { extractLegacyInterior } from './skill-icon-quality-cleanup-lib.js';

type Mode = 'write' | 'check';
type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
type Classification = 'clear' | 'borderline';

const ROOT = 'assets/wiki/skills/icon-production-v1' as const;
const CLEANUP_ROOT = `${ROOT}/quality-cleanup-v1` as const;
const PRIOR_REVIEW_ROOT = `${CLEANUP_ROOT}/review/v9-complete-frame-rollout` as const;
const REVIEW_ROOT = `${CLEANUP_ROOT}/review/v10-inner-frame-audit` as const;
const REPORT_PATH = `${PRIOR_REVIEW_ROOT}/report.json` as const;
const GEOMETRY_PATH = `${ROOT}/geometry-v2.json` as const;
const PAGE_SIZE = 6;
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false } as const;

const AUDIT = [
	['martial:blade:piercing-thrust', 'clear', 'Parallel gold rails remain on both sides.'],
	['martial:polearm:keep-away', 'clear', 'Orange source-frame rails remain at the opening sides.'],
	[
		'martial:polearm:piercing-line',
		'clear',
		'A complete thin orange inner hexagon remains visible.'
	],
	[
		'martial:polearm:wall-of-points',
		'clear',
		'Blue vertical source rails remain inside the D frame.'
	],
	['martial:polearm:serpent-s-tongue', 'clear', 'Blue side and lower source rails remain visible.'],
	[
		'martial:polearm:heaven-piercer',
		'clear',
		'Thin silver source-frame edges remain inside the aperture.'
	],
	[
		'martial:polearm:thousand-li-thrust',
		'clear',
		'Purple side and lower rails remain inside the B frame.'
	],
	['martial:polearm:rend-armour', 'clear', 'Orange source-frame edges form an inner hexagon.'],
	['martial:ranged:fletching', 'clear', 'A strong brown-gold inner frame surrounds the artwork.'],
	['martial:ranged:power-draw', 'clear', 'Thin orange source rails remain near the aperture edge.'],
	['martial:ranged:piercing-shot', 'clear', 'Blue source-frame lines remain on the opening sides.'],
	['martial:ranged:sky-piercer', 'clear', 'Purple source-frame edges remain inside the B frame.'],
	['martial:body:sidestep', 'clear', 'Orange lower and side source rails remain visible.'],
	['martial:body:called-shot', 'clear', 'Orange source-frame edges remain around the artwork.'],
	[
		'martial:body:the-road-has-no-end',
		'clear',
		'Gold side and lower rails remain inside the S frame.'
	],
	['magical:elemental:torrent', 'clear', 'Blue inner rails remain parallel to the D frame.'],
	['magical:elemental:the-deep', 'clear', 'Silver vertical source rails remain on both sides.'],
	[
		'magical:elemental:where-all-rivers-end',
		'clear',
		'Ornate gold lower and side rails remain exposed.'
	],
	['magical:elemental:spike-field', 'clear', 'Thin gold-brown source-frame edges remain visible.'],
	[
		'magical:enchantment:component-craft',
		'clear',
		'Gold vertical source rails remain at both sides.'
	],
	['magical:mind:memory-edit', 'clear', 'A silver source rail remains along the left opening.'],
	['craft:knowledge:languages', 'clear', 'A complete orange-gold inner hexagon remains visible.'],
	[
		'craft:knowledge:research',
		'clear',
		'Orange crest and edge fragments remain inside the E frame.'
	],
	[
		'martial:blade:one-blade-one-world',
		'borderline',
		'Small S-frame traces are present but visually subtle.'
	],
	[
		'martial:blade:blade-throw',
		'borderline',
		'Possible displaced lower-left source-frame fragment.'
	],
	[
		'martial:ranged:archery',
		'borderline',
		'Faint dark source boundary may read as a second frame.'
	],
	[
		'martial:ranged:quick-loose',
		'borderline',
		'Faint source-edge traces are visible at close inspection.'
	],
	[
		'martial:ranged:world-s-edge-shot',
		'borderline',
		'Small gold source-frame fragments remain near the aperture.'
	]
] as const satisfies readonly (readonly [string, Classification, string])[];

interface PriorRecord {
	readonly targetId: string;
	readonly name: string;
	readonly rank: Rank;
	readonly currentPath: string;
	readonly currentHash: string;
	readonly interiorPath: string;
	readonly sourceInteriorHash: string;
	readonly interiorHash: string;
}

interface AuditRecord extends PriorRecord {
	readonly classification: Classification;
	readonly observation: string;
	readonly current: Buffer;
	readonly exposedInterior: Buffer;
	readonly exposedInteriorHash: string;
}

interface TextLine {
	readonly text: string;
	readonly x: number;
	readonly y: number;
	readonly size: number;
	readonly fill?: string;
	readonly anchor?: 'start' | 'middle';
	readonly weight?: number;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

async function regularBytes(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolute = path.resolve(repositoryRoot, repositoryPath);
	const relative = path.relative(repositoryRoot, absolute);
	if (relative === '..' || relative.startsWith(`..${path.sep}`))
		throw new Error(`Inner-frame audit input escapes repository: ${repositoryPath}`);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Inner-frame audit input is not a regular file: ${repositoryPath}`);
	return readFile(absolute);
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

async function syncCreateOnly(
	repositoryRoot: string,
	repositoryPath: string,
	bytes: Buffer,
	mode: Mode
): Promise<boolean> {
	const destination = path.resolve(repositoryRoot, repositoryPath);
	const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(bytes)) return false;
	if (current !== null) throw new Error(`Refusing inner-frame audit drift: ${repositoryPath}`);
	if (mode === 'check') throw new Error(`Missing inner-frame audit artifact: ${repositoryPath}`);
	await writeAtomic(destination, bytes);
	return true;
}

function textLayer(width: number, height: number, lines: readonly TextLine[]): Buffer {
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines
			.map(
				(line) =>
					`<text x="${line.x}" y="${line.y}" text-anchor="${line.anchor ?? 'middle'}" font-family="sans-serif" font-size="${line.size}" font-weight="${line.weight ?? 400}" fill="${line.fill ?? '#f3ead8'}">${escapeXml(line.text)}</text>`
			)
			.join('')}</svg>`
	);
}

async function reviewPage(
	classification: Classification,
	page: number,
	records: readonly AuditRecord[]
): Promise<Buffer> {
	const columns = 2;
	const cellWidth = 720;
	const cellHeight = 450;
	const header = 72;
	const iconSize = 320;
	const width = columns * cellWidth;
	const height = header + Math.ceil(records.length / columns) * cellHeight;
	const overlays: OverlayOptions[] = [];
	const labels: TextLine[] = [
		{
			text: `${classification === 'clear' ? 'CLEAR FAILURES' : 'BORDERLINE'} · PAGE ${page}`,
			x: width / 2,
			y: 44,
			size: 28,
			weight: 700
		}
	];
	for (const [index, record] of records.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = column * cellWidth;
		const top = header + row * cellHeight;
		const [current, exposed] = await Promise.all([
			sharp(record.current)
				.flatten({ background: '#090d12' })
				.resize(iconSize, iconSize)
				.png(PNG_OPTIONS)
				.toBuffer(),
			sharp(record.exposedInterior)
				.flatten({ background: '#090d12' })
				.resize(iconSize, iconSize)
				.png(PNG_OPTIONS)
				.toBuffer()
		]);
		overlays.push(
			{ input: current, left: left + 24, top: top + 30 },
			{ input: exposed, left: left + 376, top: top + 30 }
		);
		labels.push(
			{ text: 'CURRENT COMPOSITE', x: left + 184, y: top + 22, size: 13, fill: '#9aa3b1' },
			{ text: 'EXPOSED INTERIOR', x: left + 536, y: top + 22, size: 13, fill: '#efb366' },
			{
				text: `${record.name} · ${record.rank}`,
				x: left + 24,
				y: top + 379,
				size: 20,
				anchor: 'start' as const,
				weight: 700
			},
			{
				text: record.observation,
				x: left + 24,
				y: top + 407,
				size: 15,
				anchor: 'start' as const,
				fill: '#c6ced9'
			},
			{
				text: record.targetId,
				x: left + 24,
				y: top + 432,
				size: 12,
				anchor: 'start' as const,
				fill: '#778394'
			}
		);
	}
	overlays.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({
		create: { width, height, channels: 4, background: { r: 9, g: 13, b: 18, alpha: 1 } }
	})
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

function reviewIndex(clearPages: number, borderlinePages: number): Buffer {
	const section = (classification: Classification, count: number) =>
		Array.from({ length: count }, (_, index) => {
			const name = `page-${String(index + 1).padStart(2, '0')}.png`;
			return `<a href="${classification}/${name}"><img loading="lazy" src="${classification}/${name}" alt="${classification} inner-frame audit ${index + 1}"></a>`;
		}).join('\n');
	return Buffer.from(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inner legacy-frame audit</title><style>body{margin:0;background:#090d12;color:#f3ead8;font-family:sans-serif}main{max-width:1500px;margin:auto;padding:24px}h1,h2,p{text-align:center}h2{margin-top:56px}.clear{color:#ef8b72}.borderline{color:#efc76a}img{display:block;width:100%;height:auto;margin:24px 0;border:1px solid #343b47}</style></head>
<body><main><h1>Inner legacy-frame audit · 28 candidates</h1><p>Diagnostic only: 23 clear failures and 5 borderline cases. No icon has been repaired on this page.</p><p>Each card shows the current composite beside only the interior pixels exposed through the canonical frame aperture.</p><h2 class="clear">Clear failures · 23</h2>${section('clear', clearPages)}<h2 class="borderline">Borderline · 5</h2>${section('borderline', borderlinePages)}</main></body></html>\n`);
}

async function assertExactInventory(
	repositoryRoot: string,
	repositoryDirectory: string,
	expectedNames: readonly string[]
): Promise<void> {
	const directory = path.resolve(repositoryRoot, repositoryDirectory);
	const actual = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return [] as string[];
		throw error;
	});
	const expected = new Set(expectedNames);
	if (actual.length !== expected.size || actual.some((name) => !expected.has(name)))
		throw new Error(`Unexpected inner-frame audit inventory: ${repositoryDirectory}`);
}

export async function renderSkillIconInnerFrameAuditReview(options: {
	readonly root?: string;
	readonly mode: Mode;
}): Promise<{ readonly written: readonly string[]; readonly reviewFiles: readonly string[] }> {
	const repositoryRoot = path.resolve(options.root ?? process.cwd());
	const [priorReportBytes, geometryBytes] = await Promise.all([
		regularBytes(repositoryRoot, REPORT_PATH),
		regularBytes(repositoryRoot, GEOMETRY_PATH)
	]);
	const prior = JSON.parse(priorReportBytes.toString('utf8')) as {
		readonly records: PriorRecord[];
	};
	if (prior.records.length !== 456)
		throw new Error('Inner-frame audit requires the 456-skill V9 report');
	const byTarget = new Map(prior.records.map((record) => [record.targetId, record]));
	const geometry = JSON.parse(geometryBytes.toString('utf8'));
	const frames = new Map<Rank, Buffer>();
	for (const rank of ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const)
		frames.set(
			rank,
			await regularBytes(
				repositoryRoot,
				`${PRIOR_REVIEW_ROOT}/frames/rarity-frame-${rank.toLowerCase()}-v11-review.png`
			)
		);

	const records: AuditRecord[] = [];
	for (const [targetId, classification, observation] of AUDIT) {
		const priorRecord = byTarget.get(targetId);
		if (!priorRecord) throw new Error(`Missing inner-frame audit target: ${targetId}`);
		const [current, interior] = await Promise.all([
			regularBytes(repositoryRoot, priorRecord.currentPath),
			regularBytes(repositoryRoot, priorRecord.interiorPath)
		]);
		if (sha256(current) !== priorRecord.currentHash)
			throw new Error(`Current composite hash drift: ${targetId}`);
		if (sha256(interior) !== priorRecord.sourceInteriorHash)
			throw new Error(`Stored source interior hash drift: ${targetId}`);
		const frame = frames.get(priorRecord.rank);
		if (!frame) throw new Error(`Missing ${priorRecord.rank} audit frame`);
		const exposedInterior = (
			await extractLegacyInterior(interior, geometry, { frame, artworkScale: 1 })
		).bytes;
		records.push({
			...priorRecord,
			classification,
			observation,
			current,
			exposedInterior,
			exposedInteriorHash: sha256(exposedInterior)
		});
	}
	if (new Set(records.map((record) => record.targetId)).size !== AUDIT.length)
		throw new Error('Inner-frame audit target inventory contains duplicates');

	const outputs: { readonly path: string; readonly bytes: Buffer }[] = [];
	const pageCounts = { clear: 0, borderline: 0 };
	for (const classification of ['clear', 'borderline'] as const) {
		const classified = records.filter((record) => record.classification === classification);
		for (let offset = 0, page = 1; offset < classified.length; offset += PAGE_SIZE, page += 1) {
			outputs.push({
				path: `${REVIEW_ROOT}/${classification}/page-${String(page).padStart(2, '0')}.png`,
				bytes: await reviewPage(classification, page, classified.slice(offset, offset + PAGE_SIZE))
			});
			pageCounts[classification] = page;
		}
	}
	outputs.push({
		path: `${REVIEW_ROOT}/index.html`,
		bytes: reviewIndex(pageCounts.clear, pageCounts.borderline)
	});
	outputs.push({
		path: `${REVIEW_ROOT}/report.json`,
		bytes: jsonBytes({
			schemaVersion: 'skill-icon-inner-frame-audit-review-v1',
			status: 'diagnostic-review-only-no-icons-modified',
			rootCause:
				'Original complete-frame pixels were retained as artwork wherever they fall inside the canonical frame aperture.',
			scope: { catalogSkills: 456, clear: 23, borderline: 5, totalCandidates: 28 },
			inputs: {
				priorReport: { path: REPORT_PATH, contentHash: sha256(priorReportBytes) },
				geometry: { path: GEOMETRY_PATH, contentHash: sha256(geometryBytes) }
			},
			records: records.map(({ current: _current, exposedInterior: _bytes, ...record }) => record)
		})
	});

	const written: string[] = [];
	for (const output of outputs)
		if (await syncCreateOnly(repositoryRoot, output.path, output.bytes, options.mode))
			written.push(output.path);
	for (const classification of ['clear', 'borderline'] as const)
		await assertExactInventory(
			repositoryRoot,
			`${REVIEW_ROOT}/${classification}`,
			Array.from(
				{ length: pageCounts[classification] },
				(_, index) => `page-${String(index + 1).padStart(2, '0')}.png`
			)
		);
	return { written, reviewFiles: outputs.map((output) => output.path) };
}

function parseMode(args: readonly string[]): Mode {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? ''))
		throw new Error(
			'Usage: tsx tools/render-skill-icon-inner-frame-audit-review.ts --write|--check'
		);
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
	const mode = parseMode(process.argv.slice(2));
	const result = await renderSkillIconInnerFrameAuditReview({ mode });
	// eslint-disable-next-line no-console
	console.log(
		`${mode}: ${result.reviewFiles.length} review files; ${result.written.length} written`
	);
}

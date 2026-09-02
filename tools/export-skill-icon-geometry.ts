import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	SkillIconGeometrySchema,
	type SkillIconGeometry
} from '../packages/contracts/src/index.js';
import sharp from 'sharp';

export const SKILL_ICON_GEOMETRY_PATH =
	'assets/wiki/skills/icon-production-v1/geometry.json' as const;
export const SKILL_ICON_GEOMETRY_SVG_PATH =
	'assets/wiki/skills/icon-production-v1/references/geometry-guide.svg' as const;
export const SKILL_ICON_GEOMETRY_PNG_PATH =
	'assets/wiki/skills/icon-production-v1/references/geometry-guide.png' as const;

export type SkillIconGeometryExportMode = 'check' | 'write';

export interface SkillIconGeometryExportReport {
	readonly mode: SkillIconGeometryExportMode;
	readonly guides: readonly [
		{ readonly path: typeof SKILL_ICON_GEOMETRY_SVG_PATH; readonly current: boolean },
		{ readonly path: typeof SKILL_ICON_GEOMETRY_PNG_PATH; readonly current: boolean }
	];
	readonly inSync: boolean;
	readonly written: boolean;
}

export async function loadSkillIconGeometry(root = process.cwd()): Promise<SkillIconGeometry> {
	const source = await readFile(path.resolve(root, SKILL_ICON_GEOMETRY_PATH), 'utf8');
	return SkillIconGeometrySchema.parse(JSON.parse(source) as unknown);
}

function coordinate(value: number): string {
	return Number(value.toFixed(6)).toString();
}

function scaledPoints(
	points: SkillIconGeometry['aperturePoints'],
	canvas: SkillIconGeometry['canvas']
): string {
	return points
		.map(([x, y]) => `${coordinate(x * canvas.width)},${coordinate(y * canvas.height)}`)
		.join(' ');
}

export function renderSkillIconGeometryGuideSvg(input: SkillIconGeometry): Buffer {
	const geometry = SkillIconGeometrySchema.parse(input);
	const { canvas, center } = geometry;
	const minimumDimension = Math.min(canvas.width, canvas.height);
	const subjectDiameter = (minimumDimension * geometry.subjectSafePercent) / 100;
	const effectDiameter = (minimumDimension * geometry.effectSafePercent) / 100;
	const strokeWidth = Math.max(1, minimumDimension / 256);
	const crosshairRadius = minimumDimension / 32;
	const aperture = scaledPoints(geometry.aperturePoints, canvas);
	const exclusion = scaledPoints(geometry.rarityMedallionExclusion, canvas);

	return Buffer.from(
		[
			'<svg xmlns="http://www.w3.org/2000/svg"',
			` width="${canvas.width}" height="${canvas.height}"`,
			` viewBox="0 0 ${canvas.width} ${canvas.height}"`,
			' fill="none">',
			`<rect data-guide="canvas" width="${canvas.width}" height="${canvas.height}" fill="#111827" fill-opacity="0.08"/>`,
			`<polygon data-guide="aperture" points="${aperture}" fill="#0f172a" fill-opacity="0.06" stroke="#f8fafc" stroke-width="${coordinate(strokeWidth)}"/>`,
			`<circle data-guide="effect-safe" cx="${center.x}" cy="${center.y}" r="${coordinate(effectDiameter / 2)}" stroke="#38bdf8" stroke-width="${coordinate(strokeWidth)}" stroke-dasharray="${coordinate(strokeWidth * 3)} ${coordinate(strokeWidth * 2)}"/>`,
			`<circle data-guide="subject-safe" cx="${center.x}" cy="${center.y}" r="${coordinate(subjectDiameter / 2)}" stroke="#4ade80" stroke-width="${coordinate(strokeWidth)}"/>`,
			`<polygon data-guide="rarity-medallion-exclusion" points="${exclusion}" fill="#ef4444" fill-opacity="0.24" stroke="#f87171" stroke-width="${coordinate(strokeWidth)}"/>`,
			`<g data-guide="center-crosshair" stroke="#facc15" stroke-width="${coordinate(strokeWidth)}">`,
			`<line x1="${coordinate(center.x - crosshairRadius)}" y1="${center.y}" x2="${coordinate(center.x + crosshairRadius)}" y2="${center.y}"/>`,
			`<line x1="${center.x}" y1="${coordinate(center.y - crosshairRadius)}" x2="${center.x}" y2="${coordinate(center.y + crosshairRadius)}"/>`,
			'</g>',
			'</svg>',
			''
		].join('')
	);
}

export async function renderSkillIconGeometryGuide(geometry: SkillIconGeometry): Promise<Buffer> {
	return sharp(renderSkillIconGeometryGuideSvg(geometry))
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function currentBytes(destination: string, expected: Buffer): Promise<boolean> {
	const metadata = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (!metadata?.isFile()) return false;
	const current = await readFile(destination).catch(() => null);
	return current?.equals(expected) ?? false;
}

function isInside(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function assertSafeDestination(root: string, destination: string): Promise<void> {
	const [resolvedRoot, resolvedDirectory] = await Promise.all([
		realpath(root),
		realpath(path.dirname(destination))
	]);
	if (!isInside(resolvedRoot, resolvedDirectory)) {
		throw new Error(`Guide destination resolves outside the workspace root: ${destination}`);
	}
	const metadata = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (metadata?.isSymbolicLink()) {
		throw new Error(`Refusing to replace a symbolic link guide destination: ${destination}`);
	}
	if (metadata && !metadata.isFile()) {
		throw new Error(`Guide destination is not a regular file: ${destination}`);
	}
}

async function stageGuide(destination: string, bytes: Buffer): Promise<string> {
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}.tmp`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(temporary, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		return temporary;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
}

export async function exportSkillIconGeometry(options: {
	readonly root?: string;
	readonly mode: SkillIconGeometryExportMode;
}): Promise<SkillIconGeometryExportReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const geometry = await loadSkillIconGeometry(root);
	const svg = renderSkillIconGeometryGuideSvg(geometry);
	const png = await renderSkillIconGeometryGuide(geometry);
	const svgDestination = path.resolve(root, SKILL_ICON_GEOMETRY_SVG_PATH);
	const pngDestination = path.resolve(root, SKILL_ICON_GEOMETRY_PNG_PATH);
	let svgCurrent = await currentBytes(svgDestination, svg);
	let pngCurrent = await currentBytes(pngDestination, png);
	let written = false;

	if (options.mode === 'write' && (!svgCurrent || !pngCurrent)) {
		await mkdir(path.dirname(svgDestination), { recursive: true });
		await Promise.all([
			assertSafeDestination(root, svgDestination),
			assertSafeDestination(root, pngDestination)
		]);
		const staged: string[] = [];
		try {
			staged.push(await stageGuide(svgDestination, svg));
			staged.push(await stageGuide(pngDestination, png));
			await rename(staged[0]!, svgDestination);
			staged.shift();
			await rename(staged[0]!, pngDestination);
			staged.shift();
		} finally {
			await Promise.all(staged.map((temporary) => unlink(temporary).catch(() => undefined)));
		}
		written = true;
		svgCurrent = true;
		pngCurrent = true;
	}

	return {
		mode: options.mode,
		guides: [
			{ path: SKILL_ICON_GEOMETRY_SVG_PATH, current: svgCurrent },
			{ path: SKILL_ICON_GEOMETRY_PNG_PATH, current: pngCurrent }
		],
		inSync: svgCurrent && pngCurrent,
		written
	};
}

function parseMode(args: readonly string[]): SkillIconGeometryExportMode {
	if (args.length !== 1 || !['--check', '--write'].includes(args[0] ?? '')) {
		throw new Error('Usage: tsx tools/export-skill-icon-geometry.ts --check|--write');
	}
	return args[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const report = await exportSkillIconGeometry({ mode: parseMode(process.argv.slice(2)) });
		for (const guide of report.guides) {
			process.stdout.write(`${guide.current ? 'current' : 'stale'} ${guide.path}\n`);
		}
		if (!report.inSync) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}

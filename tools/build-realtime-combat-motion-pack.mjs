import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const FRAME_SIZE = 256;
const FEET_Y = 246;
const COLUMNS = 5;
const ROWS = 4;
const CELL_OVERLAP = 28;

const isolateSubject = (rgba, width, height, expectedCenter) => {
	const labels = new Int32Array(width * height);
	labels.fill(-1);
	const components = [];
	const queue = new Int32Array(width * height);

	for (let start = 0; start < labels.length; start += 1) {
		if (labels[start] !== -1 || rgba[start * 4 + 3] <= 18) continue;
		const label = components.length;
		let head = 0;
		let tail = 0;
		queue[tail++] = start;
		labels[start] = label;
		const component = {
			area: 0,
			left: width,
			top: height,
			right: -1,
			bottom: -1,
			sumX: 0,
			sumY: 0
		};
		while (head < tail) {
			const index = queue[head++];
			const x = index % width;
			const y = Math.floor(index / width);
			component.area += 1;
			component.left = Math.min(component.left, x);
			component.top = Math.min(component.top, y);
			component.right = Math.max(component.right, x);
			component.bottom = Math.max(component.bottom, y);
			component.sumX += x;
			component.sumY += y;
			const neighbors = [index - 1, index + 1, index - width, index + width];
			for (const neighbor of neighbors) {
				if (neighbor < 0 || neighbor >= labels.length || labels[neighbor] !== -1) continue;
				const neighborX = neighbor % width;
				if (Math.abs(neighborX - x) > 1 || rgba[neighbor * 4 + 3] <= 18) continue;
				labels[neighbor] = label;
				queue[tail++] = neighbor;
			}
		}
		components.push(component);
	}

	const candidates = components.filter((component) => component.area >= 80);
	if (candidates.length === 0) throw new Error('No substantial subject component found.');
	const primary = candidates.reduce((best, component) => {
		const centerX = component.sumX / component.area;
		const centerY = component.sumY / component.area;
		const distance = Math.hypot(centerX - expectedCenter.x, centerY - expectedCenter.y);
		const score = component.area / Math.pow(1 + distance / 90, 2);
		return !best || score > best.score ? { component, score } : best;
	}, undefined).component;
	const primaryLabel = components.indexOf(primary);

	let left = width;
	let top = height;
	let right = -1;
	let bottom = -1;
	for (let index = 0; index < labels.length; index += 1) {
		const label = labels[index];
		if (label !== primaryLabel) {
			rgba[index * 4 + 3] = 0;
			continue;
		}
		const x = index % width;
		const y = Math.floor(index / width);
		left = Math.min(left, x);
		top = Math.min(top, y);
		right = Math.max(right, x);
		bottom = Math.max(bottom, y);
	}
	return { left, top, width: right - left + 1, height: bottom - top + 1 };
};

const valuesFor = (flag) => {
	const values = [];
	for (let index = 2; index < process.argv.length; index += 1) {
		if (process.argv[index] === flag) values.push(process.argv[index + 1]);
	}
	return values;
};
const valueFor = (flag) => valuesFor(flag)[0];

const actorId = valueFor('--actor');
const inputPath = valueFor('--input');
const outputDirectory = valueFor('--out-dir');
const version = Number.parseInt(valueFor('--version') ?? '1', 10);
const preserveFromManifestPath = valueFor('--preserve-from-manifest');
const replacementClips = new Set(valuesFor('--replace-clip'));
const fitClips = new Set(valuesFor('--fit-clip'));
const frameYOffsets = valuesFor('--frame-y-offset');
if (!actorId || !inputPath || !outputDirectory) {
	throw new Error(
		'Usage: --actor <id> --input <sheet.png> --out-dir <directory> [--version <number>] [--preserve-from-manifest <manifest.json> --replace-clip <clip>] [--fit-clip <clip>] [--frame-y-offset <clip:one-based-frame:pixels>]'
	);
}
if (!Number.isInteger(version) || version < 1)
	throw new Error('Version must be a positive integer.');
if (preserveFromManifestPath && replacementClips.size === 0) {
	throw new Error('At least one --replace-clip is required with --preserve-from-manifest.');
}
if (!preserveFromManifestPath && replacementClips.size > 0) {
	throw new Error('--replace-clip requires --preserve-from-manifest.');
}

const actorConfig = {
	asha: { sourceActorId: 'saffron-braid', baseDisplaySize: 178, direction: 'up-field' },
	'iron-guardian': {
		sourceActorId: 'iron-guardian',
		baseDisplaySize: 184,
		direction: 'up-field'
	},
	'moss-archer': { sourceActorId: 'moss-archer', baseDisplaySize: 168, direction: 'up-field' },
	'rat-brute': { sourceActorId: 'rat-brute', baseDisplaySize: 250, direction: 'down-field' },
	'lesser-rat': {
		sourceActorId: 'plague-rat-1',
		baseDisplaySize: 118,
		direction: 'down-field'
	}
}[actorId];
if (!actorConfig) throw new Error(`Unsupported motion actor: ${actorId}`);

const clipRows = {
	idle: { row: 0, fps: 6, loop: true },
	advance: { row: 1, fps: 10, loop: true },
	attack: { row: 2, fps: 12, loop: false },
	hit: { row: 3, start: 0, count: 2, fps: 9, loop: false },
	down: { row: 3, start: 2, count: 3, fps: 6, loop: false }
};
for (const clip of replacementClips) {
	if (!(clip in clipRows)) throw new Error(`Unknown replacement clip: ${clip}`);
}
for (const clip of fitClips) {
	if (!(clip in clipRows)) throw new Error(`Unknown fit clip: ${clip}`);
}

const parsedFrameYOffsets = frameYOffsets.map((value) => {
	const match = value?.match(/^([a-z]+):(\d+):(-?\d+)$/);
	if (!match || !(match[1] in clipRows)) {
		throw new Error('Frame Y offset must use clip:one-based-frame:pixels syntax.');
	}
	const frame = Number.parseInt(match[2], 10);
	const count = clipRows[match[1]].count ?? COLUMNS;
	if (frame < 1 || frame > count) {
		throw new Error(`Frame Y offset is outside the ${match[1]} clip.`);
	}
	return { clip: match[1], frame, pixels: Number.parseInt(match[3], 10) };
});

const source = sharp(inputPath).removeAlpha();
const metadata = await source.metadata();
if (!metadata.width || !metadata.height) throw new Error('Motion sheet has no dimensions.');

const keyedCells = [];
for (let row = 0; row < ROWS; row += 1) {
	for (let column = 0; column < COLUMNS; column += 1) {
		const cellLeft = Math.floor((column * metadata.width) / COLUMNS);
		const cellTop = Math.floor((row * metadata.height) / ROWS);
		const cellRight = Math.floor(((column + 1) * metadata.width) / COLUMNS);
		const cellBottom = Math.floor(((row + 1) * metadata.height) / ROWS);
		const left = Math.max(0, cellLeft - CELL_OVERLAP);
		const top = Math.max(0, cellTop - CELL_OVERLAP);
		const right = Math.min(metadata.width, cellRight + CELL_OVERLAP);
		const bottom = Math.min(metadata.height, cellBottom + CELL_OVERLAP);
		const { data, info } = await source
			.clone()
			.extract({ left, top, width: right - left, height: bottom - top })
			.raw()
			.toBuffer({ resolveWithObject: true });
		const rgba = Buffer.alloc(info.width * info.height * 4);
		for (let pixelIndex = 0; pixelIndex < info.width * info.height; pixelIndex += 1) {
			const sourceOffset = pixelIndex * info.channels;
			const targetOffset = pixelIndex * 4;
			const red = data[sourceOffset];
			const green = data[sourceOffset + 1];
			const blue = data[sourceOffset + 2];
			const minimum = Math.min(red, green, blue);
			const maximum = Math.max(red, green, blue);
			const chroma = maximum - minimum;
			const distanceFromWhite = 255 - minimum;
			const alpha =
				chroma > 30
					? 255
					: Math.round(Math.min(1, Math.max(0, (distanceFromWhite - 7) / 23)) * 255);
			rgba[targetOffset] = red;
			rgba[targetOffset + 1] = green;
			rgba[targetOffset + 2] = blue;
			rgba[targetOffset + 3] = alpha;
		}
		const bounds = isolateSubject(rgba, info.width, info.height, {
			x: (cellLeft + cellRight) / 2 - left,
			y: (cellTop + cellBottom) / 2 - top
		});
		keyedCells.push({
			row,
			column,
			rgba,
			width: info.width,
			height: info.height,
			bounds
		});
	}
}

const scaleCells =
	fitClips.size === 0
		? keyedCells
		: keyedCells.filter((cell) =>
				[...fitClips].some((clip) => {
					const config = clipRows[clip];
					const start = config.start ?? 0;
					const count = config.count ?? COLUMNS;
					return cell.row === config.row && cell.column >= start && cell.column < start + count;
				})
			);
const maximumWidth = Math.max(...scaleCells.map((cell) => cell.bounds.width));
const maximumHeight = Math.max(...scaleCells.map((cell) => cell.bounds.height));
const commonScale = Math.min(244 / maximumWidth, 238 / maximumHeight);
const scaleCellSet = new Set(scaleCells);
const frameBuffers = [];
for (const cell of keyedCells) {
	const cellScale = scaleCellSet.has(cell)
		? commonScale
		: Math.min(commonScale, 244 / cell.bounds.width, 238 / cell.bounds.height);
	const width = Math.max(1, Math.round(cell.bounds.width * cellScale));
	const height = Math.max(1, Math.round(cell.bounds.height * cellScale));
	const subject = await sharp(cell.rgba, {
		raw: { width: cell.width, height: cell.height, channels: 4 }
	})
		.extract(cell.bounds)
		.resize({ width, height, fit: 'fill' })
		.png()
		.toBuffer();
	const left = Math.round((FRAME_SIZE - width) / 2);
	const top = FEET_Y - height;
	frameBuffers.push(
		await sharp({
			create: {
				width: FRAME_SIZE,
				height: FRAME_SIZE,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 }
			}
		})
			.composite([{ input: subject, left, top }])
			.png({ compressionLevel: 9, adaptiveFiltering: true })
			.toBuffer()
	);
}

await mkdir(outputDirectory, { recursive: true });
const atlasName = `${actorId}-motion-v${version}.png`;
const atlasPath = path.join(outputDirectory, atlasName);
const atlasWidth = FRAME_SIZE * COLUMNS;
const atlasHeight = FRAME_SIZE * ROWS;
const generatedAtlas = await sharp({
	create: {
		width: atlasWidth,
		height: atlasHeight,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 }
	}
})
	.composite(
		frameBuffers.map((input, index) => ({
			input,
			left: (index % COLUMNS) * FRAME_SIZE,
			top: Math.floor(index / COLUMNS) * FRAME_SIZE
		}))
	)
	.png({ compressionLevel: 9, adaptiveFiltering: true })
	.toBuffer();
const { data: atlasPixels } = await sharp(generatedAtlas).ensureAlpha().raw().toBuffer({
	resolveWithObject: true
});

const readFrame = (pixels, sheetWidth, frame) => {
	const result = Buffer.alloc(frame.w * frame.h * 4);
	for (let row = 0; row < frame.h; row += 1) {
		const sourceStart = ((frame.y + row) * sheetWidth + frame.x) * 4;
		pixels.copy(result, row * frame.w * 4, sourceStart, sourceStart + frame.w * 4);
	}
	return result;
};

const writeFrame = (pixels, sheetWidth, frame, framePixels, yOffset = 0) => {
	for (let row = 0; row < frame.h; row += 1) {
		const targetStart = ((frame.y + row) * sheetWidth + frame.x) * 4;
		pixels.fill(0, targetStart, targetStart + frame.w * 4);
	}
	for (let sourceRow = 0; sourceRow < frame.h; sourceRow += 1) {
		const targetRow = sourceRow + yOffset;
		if (targetRow < 0 || targetRow >= frame.h) continue;
		const sourceStart = sourceRow * frame.w * 4;
		const targetStart = ((frame.y + targetRow) * sheetWidth + frame.x) * 4;
		framePixels.copy(pixels, targetStart, sourceStart, sourceStart + frame.w * 4);
	}
};

for (const { clip, frame, pixels } of parsedFrameYOffsets) {
	if (preserveFromManifestPath && !replacementClips.has(clip)) {
		throw new Error(`Frame Y offset clip must also be replaced: ${clip}`);
	}
	const config = clipRows[clip];
	const column = (config.start ?? 0) + frame - 1;
	const target = {
		x: column * FRAME_SIZE,
		y: config.row * FRAME_SIZE,
		w: FRAME_SIZE,
		h: FRAME_SIZE
	};
	writeFrame(atlasPixels, atlasWidth, target, readFrame(atlasPixels, atlasWidth, target), pixels);
}

if (preserveFromManifestPath) {
	const baseManifest = JSON.parse(await readFile(preserveFromManifestPath, 'utf8'));
	if (baseManifest.actorId !== actorConfig.sourceActorId) {
		throw new Error('Preserved motion manifest actor does not match the output actor.');
	}
	const baseAtlasJsonPath = path.resolve(
		path.dirname(preserveFromManifestPath),
		baseManifest.atlas
	);
	const baseAtlas = JSON.parse(await readFile(baseAtlasJsonPath, 'utf8'));
	const baseAtlasPath = path.resolve(path.dirname(baseAtlasJsonPath), baseAtlas.meta.image);
	const { data: basePixels, info: baseInfo } = await sharp(baseAtlasPath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	for (const [clip, config] of Object.entries(clipRows)) {
		if (replacementClips.has(clip)) continue;
		const baseFrames = baseManifest.clips?.[clip]?.frames;
		const count = config.count ?? COLUMNS;
		if (!Array.isArray(baseFrames) || baseFrames.length !== count) {
			throw new Error(`Preserved motion manifest has an incompatible ${clip} clip.`);
		}
		for (let index = 0; index < count; index += 1) {
			const source = baseAtlas.frames?.[baseFrames[index]]?.frame;
			if (!source || source.w !== FRAME_SIZE || source.h !== FRAME_SIZE) {
				throw new Error(`Preserved atlas has an incompatible ${clip} frame.`);
			}
			const target = {
				x: ((config.start ?? 0) + index) * FRAME_SIZE,
				y: config.row * FRAME_SIZE,
				w: FRAME_SIZE,
				h: FRAME_SIZE
			};
			writeFrame(atlasPixels, atlasWidth, target, readFrame(basePixels, baseInfo.width, source));
		}
	}
}

await sharp(atlasPixels, {
	raw: { width: atlasWidth, height: atlasHeight, channels: 4 }
})
	.png({ compressionLevel: 9, adaptiveFiltering: true })
	.toFile(atlasPath);

const frames = {};
const animations = {};
for (const [clip, config] of Object.entries(clipRows)) {
	const start = config.start ?? 0;
	const count = config.count ?? COLUMNS;
	animations[clip] = [];
	for (let clipIndex = 0; clipIndex < count; clipIndex += 1) {
		const column = start + clipIndex;
		const name = `${actorId}-${clip}-${String(clipIndex + 1).padStart(2, '0')}.png`;
		animations[clip].push(name);
		frames[name] = {
			frame: { x: column * FRAME_SIZE, y: config.row * FRAME_SIZE, w: FRAME_SIZE, h: FRAME_SIZE },
			rotated: false,
			trimmed: false,
			spriteSourceSize: { x: 0, y: 0, w: FRAME_SIZE, h: FRAME_SIZE },
			sourceSize: { w: FRAME_SIZE, h: FRAME_SIZE },
			anchor: { x: 0.5, y: FEET_Y / FRAME_SIZE }
		};
	}
}

const atlas = {
	frames,
	animations,
	meta: {
		app: 'Summonlab realtime motion pack builder',
		version: String(version),
		image: atlasName,
		format: 'RGBA8888',
		size: { w: FRAME_SIZE * COLUMNS, h: FRAME_SIZE * ROWS },
		scale: '1'
	}
};
const manifest = {
	version,
	actorId: actorConfig.sourceActorId,
	atlas: `${actorId}-motion-v${version}.json`,
	canvas: { width: FRAME_SIZE, height: FRAME_SIZE },
	feetAnchor: { x: 0.5, y: FEET_Y / FRAME_SIZE },
	healthClearance: 12,
	baseDisplaySize: actorConfig.baseDisplaySize,
	direction: actorConfig.direction,
	clips: Object.fromEntries(
		Object.entries(clipRows).map(([clip, config]) => [
			clip,
			{ frames: animations[clip], fps: config.fps, loop: config.loop }
		])
	)
};

await writeFile(
	path.join(outputDirectory, `${actorId}-motion-v${version}.json`),
	`${JSON.stringify(atlas, null, 2)}\n`
);
await writeFile(
	path.join(outputDirectory, `${actorId}-motion-manifest-v${version}.json`),
	`${JSON.stringify(manifest, null, 2)}\n`
);
process.stdout.write(
	`${JSON.stringify({ actorId, inputPath, atlasPath, commonScale }, null, 2)}\n`
);

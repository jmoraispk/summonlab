import { mkdir, writeFile } from 'node:fs/promises';
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
			const neighbours = [index - 1, index + 1, index - width, index + width];
			for (const neighbour of neighbours) {
				if (neighbour < 0 || neighbour >= labels.length || labels[neighbour] !== -1) continue;
				const neighbourX = neighbour % width;
				if (Math.abs(neighbourX - x) > 1 || rgba[neighbour * 4 + 3] <= 18) continue;
				labels[neighbour] = label;
				queue[tail++] = neighbour;
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

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
	args.set(process.argv[index], process.argv[index + 1]);
}

const actorId = args.get('--actor');
const inputPath = args.get('--input');
const outputDirectory = args.get('--out-dir');
if (!actorId || !inputPath || !outputDirectory) {
	throw new Error('Usage: --actor <id> --input <sheet.png> --out-dir <directory>');
}

const actorConfig = {
	asha: { sourceActorId: 'saffron-braid', baseDisplaySize: 178 },
	'lesser-rat': { sourceActorId: 'plague-rat-1', baseDisplaySize: 118 }
}[actorId];
if (!actorConfig) throw new Error(`Unsupported motion actor: ${actorId}`);

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
			rgba,
			width: info.width,
			height: info.height,
			bounds
		});
	}
}

const maximumWidth = Math.max(...keyedCells.map((cell) => cell.bounds.width));
const maximumHeight = Math.max(...keyedCells.map((cell) => cell.bounds.height));
const commonScale = Math.min(244 / maximumWidth, 238 / maximumHeight);
const frameBuffers = [];
for (const cell of keyedCells) {
	const width = Math.max(1, Math.round(cell.bounds.width * commonScale));
	const height = Math.max(1, Math.round(cell.bounds.height * commonScale));
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
const atlasName = `${actorId}-motion-v1.png`;
const atlasPath = path.join(outputDirectory, atlasName);
await sharp({
	create: {
		width: FRAME_SIZE * COLUMNS,
		height: FRAME_SIZE * ROWS,
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
	.toFile(atlasPath);

const clipRows = {
	idle: { row: 0, fps: 6, loop: true },
	advance: { row: 1, fps: 10, loop: true },
	attack: { row: 2, fps: 12, loop: false },
	hit: { row: 3, start: 0, count: 2, fps: 9, loop: false },
	down: { row: 3, start: 2, count: 3, fps: 6, loop: false }
};
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
		version: '1',
		image: atlasName,
		format: 'RGBA8888',
		size: { w: FRAME_SIZE * COLUMNS, h: FRAME_SIZE * ROWS },
		scale: '1'
	}
};
const manifest = {
	version: 1,
	actorId: actorConfig.sourceActorId,
	atlas: `${actorId}-motion-v1.json`,
	canvas: { width: FRAME_SIZE, height: FRAME_SIZE },
	feetAnchor: { x: 0.5, y: FEET_Y / FRAME_SIZE },
	healthClearance: 12,
	baseDisplaySize: actorConfig.baseDisplaySize,
	direction: actorId === 'asha' ? 'up-field' : 'down-field',
	clips: Object.fromEntries(
		Object.entries(clipRows).map(([clip, config]) => [
			clip,
			{ frames: animations[clip], fps: config.fps, loop: config.loop }
		])
	)
};

await writeFile(
	path.join(outputDirectory, `${actorId}-motion-v1.json`),
	`${JSON.stringify(atlas, null, 2)}\n`
);
await writeFile(
	path.join(outputDirectory, `${actorId}-motion-manifest-v1.json`),
	`${JSON.stringify(manifest, null, 2)}\n`
);
console.log(JSON.stringify({ actorId, inputPath, atlasPath, commonScale }, null, 2));

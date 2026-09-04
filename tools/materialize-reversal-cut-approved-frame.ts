import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	AnySkillIconGeometrySchema,
	type AnySkillIconGeometry
} from '../packages/contracts/src/index.js';
import {
	SKILL_ICON_NORMALIZATION_PROFILE_V3,
	skillIconGreenKeyAlphaForProfile
} from './normalize-skill-icon-provider-source.js';
import { renderReversalCutRuntimeIconFromLayers } from './activate-reversal-cut-runtime-icon.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

const WORKING_SIZE = 1024;
const REGISTRATION_SCALE = 1.14;
const REGISTERED_SIZE = Math.round(WORKING_SIZE * REGISTRATION_SCALE);
const RUN_ROOT = 'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6';
const SOURCE_PATH = `${RUN_ROOT}/owner-selected/rarity-frame-a-source.png`;
const APPROVAL_PATH = `${RUN_ROOT}/owner-selected/visual-approval.json`;
const FRAME_PATH = `${RUN_ROOT}/presentation/rarity-frame-a.png`;
const COMPOSITE_PATH = `${RUN_ROOT}/candidates/martial-blade-reversal-cut-framed-v2.png`;
const RECOGNITION_PATH = `${RUN_ROOT}/review/martial-blade-reversal-cut-framed-96.png`;
const COMPLETION_PATH = `${RUN_ROOT}/completion.json`;
const GEOMETRY_PATH = 'assets/wiki/skills/icon-production-v1/geometry-v2.json';
const ART_PATH =
	'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-reversal-cut.png';
const BACKING_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/presentation/charcoal-backing.png';

const EXPECTED_HASHES = {
	source: '6defbc6b1e5a0997066cb5acc7938103ddc63e707b09561188adf7c479798c62',
	geometry: '6ffaaa99a2e19c7589bcb2f7975268117db199abd45752fd164567cb5042fcab',
	art: 'f9a9d4845a5f586a665664f201aa2cf728a77342b5aac0c34f030fcd3e5da049',
	backing: '01c482582007efcd6f08da066d412c285ecedf5bd1c393c1827372c34756fcfa'
} as const;

type Point = readonly [number, number];

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const [xi, yi] = polygon[index]!;
		const [xj, yj] = polygon[previous]!;
		if (yi !== yj && yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

function scaledPolygon(points: readonly Point[], width: number, height: number): Point[] {
	return points.map(([x, y]) => [x * width, y * height]);
}

function insetPolygon(points: readonly Point[], center: Point, scale: number): Point[] {
	return points.map(([x, y]) => [
		center[0] + (x - center[0]) * scale,
		center[1] + (y - center[1]) * scale
	]);
}

function buildCanonicalFrameMask(geometry: AnySkillIconGeometry): Uint8Array {
	if (geometry.schemaVersion !== 'skill-icon-geometry-v2') {
		throw new Error('Approved frame registration requires skill-icon geometry v2');
	}
	const width = geometry.canvas.width;
	const height = geometry.canvas.height;
	const aperture = scaledPolygon(geometry.aperturePoints, width, height);
	const outer = scaledPolygon(geometry.outerEnvelopePoints, width, height);
	const medallion = scaledPolygon(geometry.rarityMedallionExclusion, width, height);
	const inner = insetPolygon(
		aperture,
		[geometry.center.x, geometry.center.y],
		geometry.innerApertureScale
	);
	const mask = new Uint8Array(width * height);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			if (
				(pointInPolygon(pixelX, pixelY, outer) && !pointInPolygon(pixelX, pixelY, inner)) ||
				pointInPolygon(pixelX, pixelY, medallion)
			) {
				mask[y * width + x] = 1;
			}
		}
	}
	return mask;
}

/**
 * Converts the exact owner-selected green-matte image into a reusable frame layer.
 * The centered 110% registration moves the depicted rails onto the canonical edge bands;
 * the geometry mask then clips only pixels that a rarity-frame layer may never own.
 */
export async function materializeApprovedReversalCutFrame(
	source: Buffer,
	geometry: AnySkillIconGeometry
): Promise<Buffer> {
	geometry = AnySkillIconGeometrySchema.parse(geometry);
	if (geometry.canvas.width !== WORKING_SIZE || geometry.canvas.height !== WORKING_SIZE) {
		throw new Error('Approved frame registration requires a 1024-square geometry authority');
	}
	const metadata = await sharp(source, { failOn: 'error' }).metadata();
	if (
		metadata.format !== 'png' ||
		metadata.width !== 1254 ||
		metadata.height !== 1254 ||
		metadata.hasAlpha ||
		metadata.channels !== 3
	) {
		throw new Error('Owner-selected frame source must remain a 1254-square RGB PNG');
	}
	const { data, info } = await sharp(source, { failOn: 'error' })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
		const offset = pixel * 4;
		const red = data[offset] ?? 0;
		const green = data[offset + 1] ?? 0;
		const blue = data[offset + 2] ?? 0;
		const chromaMatte = green > 40 && green - Math.max(red, blue) > 18;
		const alpha = chromaMatte
			? 0
			: skillIconGreenKeyAlphaForProfile(red, green, blue, SKILL_ICON_NORMALIZATION_PROFILE_V3);
		data[offset + 3] = alpha;
		if (alpha === 0) {
			data[offset] = 0;
			data[offset + 1] = 0;
			data[offset + 2] = 0;
		} else if (alpha < 255) {
			data[offset + 1] = Math.min(green, Math.max(red, blue) + 24);
		}
	}
	const registered = await sharp(data, { raw: info })
		.resize(REGISTERED_SIZE, REGISTERED_SIZE, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.extract({
			left: Math.floor((REGISTERED_SIZE - WORKING_SIZE) / 2),
			top: Math.floor((REGISTERED_SIZE - WORKING_SIZE) / 2),
			width: WORKING_SIZE,
			height: WORKING_SIZE
		})
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const mask = buildCanonicalFrameMask(geometry);
	for (let pixel = 0; pixel < WORKING_SIZE * WORKING_SIZE; pixel += 1) {
		const offset = pixel * 4;
		const alpha = registered.data[offset + 3] ?? 0;
		const straightScale = registered.info.premultiplied && alpha > 0 ? 255 / alpha : 1;
		const red = Math.min(255, (registered.data[offset] ?? 0) * straightScale);
		const green = Math.min(255, (registered.data[offset + 1] ?? 0) * straightScale);
		const blue = Math.min(255, (registered.data[offset + 2] ?? 0) * straightScale);
		if (mask[pixel] !== 1 || (green > 40 && green - Math.max(red, blue) > 18)) {
			registered.data[offset + 3] = 0;
		}
		if (registered.data[offset + 3] === 0) {
			registered.data[offset] = 0;
			registered.data[offset + 1] = 0;
			registered.data[offset + 2] = 0;
		}
	}
	return sharp(registered.data, { raw: registered.info })
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

function binding(pathname: string, bytes: Buffer) {
	return { path: pathname, contentHash: sha256(bytes) };
}

function imageBinding(pathname: string, bytes: Buffer, size: 1024 | 96) {
	return {
		...binding(pathname, bytes),
		mediaType: 'image/png',
		width: size,
		height: size,
		alphaMode: 'rgba',
		bytes: bytes.byteLength
	};
}

async function readExpected(root: string, pathname: string, expectedHash: string): Promise<Buffer> {
	const bytes = await readFile(path.join(root, pathname));
	if (sha256(bytes) !== expectedHash) throw new Error(`Bound input changed: ${pathname}`);
	return bytes;
}

async function writeExact(destination: string, bytes: Buffer): Promise<boolean> {
	const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(bytes)) return false;
	if (current)
		throw new Error(`Refusing to replace differing approved-frame output ${destination}`);
	await mkdir(path.dirname(destination), { recursive: true });
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporary, bytes, { flag: 'wx' });
		await rename(temporary, destination);
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
	return true;
}

export async function materializeApprovedReversalCutReview(options: {
	readonly root?: string;
	readonly mode: 'check' | 'write';
}): Promise<{
	readonly current: boolean;
	readonly written: readonly string[];
	readonly completionHash: string;
}> {
	const root = path.resolve(options.root ?? process.cwd());
	const [source, geometryBytes, art, backing] = await Promise.all([
		readExpected(root, SOURCE_PATH, EXPECTED_HASHES.source),
		readExpected(root, GEOMETRY_PATH, EXPECTED_HASHES.geometry),
		readExpected(root, ART_PATH, EXPECTED_HASHES.art),
		readExpected(root, BACKING_PATH, EXPECTED_HASHES.backing)
	]);
	const geometry = AnySkillIconGeometrySchema.parse(JSON.parse(geometryBytes.toString('utf8')));
	const frame = await materializeApprovedReversalCutFrame(source, geometry);
	const inspection = await inspectSkillIconAsset(frame, 'rarity-frame', geometry);
	if (inspection.violations.length > 0) {
		throw new Error(
			`Registered owner-selected frame is invalid: ${inspection.violations.join('; ')}`
		);
	}
	const [composite, recognition] = await Promise.all([
		renderReversalCutRuntimeIconFromLayers(backing, art, frame, 1024),
		renderReversalCutRuntimeIconFromLayers(backing, art, frame, 96)
	]);
	const approval = {
		schemaVersion: 'skill-icon-frame-visual-approval-v1',
		approvalId: 'reversal-cut-a-frame-visual-approval-v1',
		targetId: 'martial:blade:reversal-cut',
		reviewerRole: 'owner',
		decision: 'accepted',
		reviewedAt: '2026-09-04T22:20:19.000Z',
		observation: 'this one looks good!',
		acceptedSource: {
			...imageBinding(SOURCE_PATH, source, 1024),
			width: 1254,
			height: 1254,
			alphaMode: 'rgb'
		}
	};
	const approvalBytes = jsonBytes(approval);
	const completion = {
		schemaVersion: 'skill-icon-approved-frame-review-v1',
		runId: 'reversal-cut-v6',
		targetId: 'martial:blade:reversal-cut',
		status: 'candidate',
		visualApproval: binding(APPROVAL_PATH, approvalBytes),
		authorities: {
			source: binding(SOURCE_PATH, source),
			geometry: binding(GEOMETRY_PATH, geometryBytes),
			approvedArtMaster: binding(ART_PATH, art),
			backing: binding(BACKING_PATH, backing)
		},
		registration: {
			profile: 'owner-selected-a-frame-centered-scale-mask-v1',
			scale: REGISTRATION_SCALE,
			canvas: [WORKING_SIZE, WORKING_SIZE],
			matte: '#00FF00',
			normalizationProfile: SKILL_ICON_NORMALIZATION_PROFILE_V3,
			geometryDisposition: 'canonical-role-mask-applied-after-centered-registration'
		},
		inspection,
		outputs: {
			frame: imageBinding(FRAME_PATH, frame, 1024),
			composite: imageBinding(COMPOSITE_PATH, composite, 1024),
			recognition: imageBinding(RECOGNITION_PATH, recognition, 96)
		},
		promotionStatus: 'pending-owner-review',
		runtimeUpdated: false,
		selfPromoted: false,
		supersedes: 'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/correction.json'
	};
	const completionBytes = jsonBytes(completion);
	const outputs = [
		{ path: APPROVAL_PATH, bytes: approvalBytes },
		{ path: FRAME_PATH, bytes: frame },
		{ path: COMPOSITE_PATH, bytes: composite },
		{ path: RECOGNITION_PATH, bytes: recognition },
		{ path: COMPLETION_PATH, bytes: completionBytes }
	];
	const written: string[] = [];
	for (const output of outputs) {
		const destination = path.join(root, output.path);
		const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (options.mode === 'check') {
			if (!current?.equals(output.bytes)) {
				return { current: false, written, completionHash: sha256(completionBytes) };
			}
		} else if (await writeExact(destination, output.bytes)) {
			written.push(output.path);
		}
	}
	return { current: true, written, completionHash: sha256(completionBytes) };
}

const mode = process.argv[2];
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	if (mode !== '--write' && mode !== '--check') {
		throw new Error('Usage: tsx tools/materialize-reversal-cut-approved-frame.ts --write|--check');
	}
	materializeApprovedReversalCutReview({ mode: mode === '--write' ? 'write' : 'check' })
		.then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}

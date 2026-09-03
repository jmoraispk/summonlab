import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

import sharp from 'sharp';

import {
	SkillIconGeometrySchema,
	SkillIconRoleSchema,
	type SkillIconGeometry,
	type SkillIconRole
} from '../packages/contracts/src/index.js';
import { SKILL_ICON_FRAME_INNER_APERTURE_SCALE } from './validate-skill-icon-assets.js';

export const SKILL_ICON_NORMALIZATION_PROFILE = 'skill-icon-green-key-role-mask-v1' as const;
export const SKILL_ICON_PROVIDER_SIZE = 1254;
export const SKILL_ICON_PROVIDER_MATTE = '#00FF00' as const;
export const SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE = 12;
export const SKILL_ICON_PROVIDER_OPAQUE_DISTANCE = 96;
export const SKILL_ICON_NORMALIZER_SHARP_VERSION = '0.35.3';
export const SKILL_ICON_NORMALIZER_VIPS_VERSION = '8.18.3';
export const SKILL_ICON_PROVIDER_MAX_BYTES = 64 * 1024 * 1024;

export interface SkillIconProviderSourceEvidence {
	readonly mediaType: 'image/png';
	readonly width: 1254;
	readonly height: 1254;
	readonly bytes: number;
	readonly alphaMode: 'rgb';
	readonly contentHash: string;
}

export interface SkillIconNormalizationEvidence {
	readonly profile: typeof SKILL_ICON_NORMALIZATION_PROFILE;
	readonly geometryHash: string;
	readonly sourceContentHash: string;
	readonly outputContentHash: string;
}

export interface NormalizedSkillIconProviderSource {
	readonly source: SkillIconProviderSourceEvidence;
	readonly normalization: SkillIconNormalizationEvidence;
	readonly bytes: Buffer;
}

type Point = readonly [number, number];

function sha256(bytes: Buffer | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const [xi, yi] = polygon[index]!;
		const [xj, yj] = polygon[previous]!;
		if (yi !== yj && yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
			inside = !inside;
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

function keyDistance(red: number, green: number, blue: number): number {
	return Math.max(red, 255 - green, blue);
}

function assertNoBakedCheckerboard(data: Buffer): void {
	const colors = new Map<number, number>();
	let nonKeyPixels = 0;
	for (let offset = 0; offset < data.length; offset += 3) {
		const red = data[offset] ?? 0;
		const green = data[offset + 1] ?? 0;
		const blue = data[offset + 2] ?? 0;
		if (keyDistance(red, green, blue) <= SKILL_ICON_PROVIDER_OPAQUE_DISTANCE) continue;
		nonKeyPixels += 1;
		if (Math.max(red, green, blue) - Math.min(red, green, blue) > 8) continue;
		const key = (red << 16) | (green << 8) | blue;
		colors.set(key, (colors.get(key) ?? 0) + 1);
	}
	const dominant = [...colors.entries()].sort((left, right) => right[1] - left[1]).slice(0, 2);
	if (dominant.length !== 2 || nonKeyPixels === 0) return;
	const [[firstColor, firstCount], [secondColor, secondCount]] = dominant;
	const firstLuminance =
		(((firstColor >>> 16) & 0xff) + ((firstColor >>> 8) & 0xff) + (firstColor & 0xff)) / 3;
	const secondLuminance =
		(((secondColor >>> 16) & 0xff) + ((secondColor >>> 8) & 0xff) + (secondColor & 0xff)) / 3;
	if (
		firstCount / nonKeyPixels >= 0.05 &&
		secondCount / nonKeyPixels >= 0.05 &&
		(firstCount + secondCount) / nonKeyPixels >= 0.3 &&
		Math.abs(firstLuminance - secondLuminance) >= 20
	)
		throw new Error('Provider source appears to contain a baked checkerboard matte');
}

function assertProviderMatte(
	data: Buffer,
	width: number,
	height: number,
	geometry: SkillIconGeometry,
	allowsPixel: (x: number, y: number) => boolean
): void {
	const border = Math.max(8, Math.round(Math.min(width, height) * 0.025));
	let sampled = 0;
	let strongMatte = 0;
	let keyableMatte = 0;
	let requiredTransparent = 0;
	let strongRequiredTransparent = 0;
	let keyableRequiredTransparent = 0;
	const nonGreenLuminance = new Map<number, number>();
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const offset = (y * width + x) * 3;
			const red = data[offset] ?? 0;
			const green = data[offset + 1] ?? 0;
			const blue = data[offset + 2] ?? 0;
			const onPerimeter = x < border || x >= width - border || y < border || y >= height - border;
			if (onPerimeter) {
				sampled += 1;
				const distance = keyDistance(red, green, blue);
				if (distance <= SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE) strongMatte += 1;
				if (distance <= SKILL_ICON_PROVIDER_OPAQUE_DISTANCE) keyableMatte += 1;
				else {
					const bucket = Math.round((red + green + blue) / 48);
					nonGreenLuminance.set(bucket, (nonGreenLuminance.get(bucket) ?? 0) + 1);
				}
			}
			const outputX = Math.min(
				geometry.canvas.width - 1,
				Math.floor((x * geometry.canvas.width) / width)
			);
			const outputY = Math.min(
				geometry.canvas.height - 1,
				Math.floor((y * geometry.canvas.height) / height)
			);
			if (!allowsPixel(outputX, outputY)) {
				requiredTransparent += 1;
				const distance = keyDistance(red, green, blue);
				if (distance <= SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE) strongRequiredTransparent += 1;
				if (distance <= SKILL_ICON_PROVIDER_OPAQUE_DISTANCE) keyableRequiredTransparent += 1;
			}
		}
	}
	const strongFraction = strongMatte / Math.max(1, sampled);
	const keyableFraction = keyableMatte / Math.max(1, sampled);
	const repeatedNonGreenBuckets = [...nonGreenLuminance.values()].filter(
		(count) => count / Math.max(1, sampled) >= 0.05
	).length;
	if (repeatedNonGreenBuckets >= 2 && keyableFraction < 0.8)
		throw new Error('Provider source appears to contain a baked checkerboard matte');
	if (strongFraction < 0.82 || keyableFraction < 0.95)
		throw new Error('Provider source does not have a sufficiently clean #00FF00 edge matte');
	if (
		strongRequiredTransparent / Math.max(1, requiredTransparent) < 0.98 ||
		keyableRequiredTransparent / Math.max(1, requiredTransparent) < 0.995
	)
		throw new Error(
			'Provider source has meaningful foreground in a role-required transparent region'
		);
}

/** Profile-owned alpha curve, exported so threshold behavior remains directly testable. */
export function skillIconGreenKeyAlpha(red: number, green: number, blue: number): number {
	const distance = keyDistance(red, green, blue);
	if (distance <= SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE) return 0;
	if (distance >= SKILL_ICON_PROVIDER_OPAQUE_DISTANCE) return 255;
	return Math.round(
		(255 * (distance - SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE)) /
			(SKILL_ICON_PROVIDER_OPAQUE_DISTANCE - SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE)
	);
}

function buildRoleMask(role: SkillIconRole, geometry: SkillIconGeometry): Uint8Array {
	const width = geometry.canvas.width;
	const height = geometry.canvas.height;
	const aperture = scaledPolygon(geometry.aperturePoints, width, height);
	const medallion = scaledPolygon(geometry.rarityMedallionExclusion, width, height);
	const center: Point = [geometry.center.x, geometry.center.y];
	const inner = insetPolygon(aperture, center, SKILL_ICON_FRAME_INNER_APERTURE_SCALE);
	const mask = new Uint8Array(width * height);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			const allowed =
				role === 'rarity-frame'
					? (pointInPolygon(pixelX, pixelY, aperture) && !pointInPolygon(pixelX, pixelY, inner)) ||
						pointInPolygon(pixelX, pixelY, medallion)
					: pointInPolygon(pixelX, pixelY, aperture);
			if (allowed) mask[y * width + x] = 1;
		}
	}
	return mask;
}

/** Pure, deterministic provider-byte normalization. It never reads or writes the filesystem. */
export async function normalizeSkillIconProviderSource(
	sourceBytes: Buffer,
	roleInput: SkillIconRole,
	geometrySourceBytes: Buffer
): Promise<NormalizedSkillIconProviderSource> {
	if (sourceBytes.byteLength === 0 || sourceBytes.byteLength > SKILL_ICON_PROVIDER_MAX_BYTES)
		throw new Error('Provider source byte size is outside the bounded envelope');
	const role = SkillIconRoleSchema.parse(roleInput);
	if (role !== 'rarity-frame' && role !== 'backing')
		throw new Error('Green-key normalization is authorized only for rarity-frame and backing jobs');
	let rawGeometry: unknown;
	try {
		rawGeometry = JSON.parse(geometrySourceBytes.toString('utf8'));
	} catch {
		throw new Error('Geometry authority is not valid JSON');
	}
	const geometry = SkillIconGeometrySchema.parse(rawGeometry);
	const roleMask = buildRoleMask(role, geometry);
	const allowsPixel = (x: number, y: number): boolean =>
		roleMask[y * geometry.canvas.width + x] === 1;
	if (
		sharp.versions.sharp !== SKILL_ICON_NORMALIZER_SHARP_VERSION ||
		sharp.versions.vips !== SKILL_ICON_NORMALIZER_VIPS_VERSION
	)
		throw new Error('Green-key normalization requires the profile-pinned Sharp/libvips toolchain');
	const image = sharp(sourceBytes, {
		failOn: 'error',
		limitInputPixels: SKILL_ICON_PROVIDER_SIZE * SKILL_ICON_PROVIDER_SIZE,
		sequentialRead: true
	});
	const metadata = await image.metadata();
	if (metadata.format !== 'png') throw new Error('Provider source must be a PNG');
	if (metadata.width !== SKILL_ICON_PROVIDER_SIZE || metadata.height !== SKILL_ICON_PROVIDER_SIZE)
		throw new Error(
			`Provider source dimensions must be ${SKILL_ICON_PROVIDER_SIZE}×${SKILL_ICON_PROVIDER_SIZE}`
		);
	if (metadata.width !== metadata.height)
		throw new Error('Provider source must have square aspect');
	if (metadata.hasAlpha || metadata.channels !== 3)
		throw new Error('Provider source must be RGB without an alpha channel');
	if ((metadata.pages ?? 1) !== 1 || metadata.pageHeight !== undefined)
		throw new Error('Provider source must be a single-page PNG');
	if (metadata.isPalette) throw new Error('Provider source must not use a palette');
	if (metadata.isProgressive) throw new Error('Provider source must not be interlaced');
	if (metadata.depth !== 'uchar') throw new Error('Provider source must use 8-bit channels');
	if (metadata.space !== 'srgb')
		throw new Error('Provider source must declare the sRGB color space');
	if (metadata.orientation !== undefined)
		throw new Error('Provider source must not rely on orientation metadata');
	if (metadata.icc) throw new Error('Provider source must not contain an embedded ICC profile');
	const decoded = await image
		.toColourspace('srgb')
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	assertNoBakedCheckerboard(decoded.data);
	assertProviderMatte(decoded.data, decoded.info.width, decoded.info.height, geometry, allowsPixel);

	const rgba = Buffer.alloc(decoded.info.width * decoded.info.height * 4);
	for (let index = 0; index < decoded.info.width * decoded.info.height; index += 1) {
		const sourceOffset = index * 3;
		const outputOffset = index * 4;
		const red = decoded.data[sourceOffset] ?? 0;
		const green = decoded.data[sourceOffset + 1] ?? 0;
		const blue = decoded.data[sourceOffset + 2] ?? 0;
		const alpha = skillIconGreenKeyAlpha(red, green, blue);
		const amount = alpha / 255;
		const unmatte = (channel: number, matte: number): number =>
			Math.max(0, Math.min(255, Math.round((channel - (1 - amount) * matte) / amount)));
		const foregroundRed = alpha === 0 ? 0 : unmatte(red, 0);
		const foregroundGreen = alpha === 0 ? 0 : unmatte(green, 255);
		const foregroundBlue = alpha === 0 ? 0 : unmatte(blue, 0);
		const spillCeiling = Math.max(foregroundRed, foregroundBlue) + 40;
		rgba[outputOffset] = foregroundRed;
		rgba[outputOffset + 1] = alpha === 0 ? 0 : Math.min(foregroundGreen, spillCeiling);
		rgba[outputOffset + 2] = foregroundBlue;
		rgba[outputOffset + 3] = alpha;
	}

	const resized = await sharp(rgba, {
		raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 }
	})
		.resize(geometry.canvas.width, geometry.canvas.height, {
			fit: 'fill',
			kernel: sharp.kernel.lanczos3,
			fastShrinkOnLoad: false
		})
		.raw()
		.toBuffer();
	let visiblePixels = 0;
	for (let y = 0; y < geometry.canvas.height; y += 1) {
		for (let x = 0; x < geometry.canvas.width; x += 1) {
			const offset = (y * geometry.canvas.width + x) * 4;
			if (!allowsPixel(x, y)) resized[offset + 3] = 0;
			if ((resized[offset + 3] ?? 0) === 0) {
				resized[offset] = 0;
				resized[offset + 1] = 0;
				resized[offset + 2] = 0;
			} else visiblePixels += 1;
		}
	}
	if (visiblePixels === 0) throw new Error('Provider source contains no visible role content');
	const outputBytes = await sharp(resized, {
		raw: { width: geometry.canvas.width, height: geometry.canvas.height, channels: 4 }
	})
		.png({
			compressionLevel: 9,
			adaptiveFiltering: false,
			palette: false,
			effort: 10,
			progressive: false
		})
		.toBuffer();
	const sourceHash = sha256(sourceBytes);
	const outputHash = sha256(outputBytes);
	return {
		source: {
			mediaType: 'image/png',
			width: SKILL_ICON_PROVIDER_SIZE,
			height: SKILL_ICON_PROVIDER_SIZE,
			bytes: sourceBytes.byteLength,
			alphaMode: 'rgb',
			contentHash: sourceHash
		},
		normalization: {
			profile: SKILL_ICON_NORMALIZATION_PROFILE,
			geometryHash: sha256(geometrySourceBytes),
			sourceContentHash: sourceHash,
			outputContentHash: outputHash
		},
		bytes: outputBytes
	};
}

export async function readSkillIconProviderSourceOnce(
	sourcePath: string,
	testHook?: () => void | Promise<void>
): Promise<Buffer> {
	const handle = await open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ELOOP') throw new Error('Provider source cannot be a symbolic link');
			throw error;
		}
	);
	try {
		const before = await handle.stat({ bigint: true });
		if (!before.isFile()) throw new Error('Provider source must be a regular file');
		if (before.size <= 0n || before.size > BigInt(SKILL_ICON_PROVIDER_MAX_BYTES))
			throw new Error('Provider source byte size is outside the bounded envelope');
		const bytes = Buffer.alloc(Number(before.size));
		let offset = 0;
		while (offset < bytes.length) {
			const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
			if (bytesRead === 0) break;
			offset += bytesRead;
		}
		await testHook?.();
		const after = await handle.stat({ bigint: true });
		const pathMetadata = await lstat(sourcePath, { bigint: true }).catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT')
					throw new Error('Provider source path disappeared while reading');
				throw error;
			}
		);
		if (
			before.dev !== after.dev ||
			before.ino !== after.ino ||
			before.size !== after.size ||
			before.nlink !== after.nlink ||
			before.mtimeNs !== after.mtimeNs ||
			before.ctimeNs !== after.ctimeNs ||
			pathMetadata.isSymbolicLink() ||
			pathMetadata.dev !== before.dev ||
			pathMetadata.ino !== before.ino
		)
			throw new Error('Provider source changed while it was being read');
		if (offset !== bytes.byteLength || BigInt(bytes.byteLength) !== before.size)
			throw new Error('Provider source byte count changed while it was being read');
		return bytes;
	} finally {
		await handle.close();
	}
}

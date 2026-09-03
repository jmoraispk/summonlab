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

export const SKILL_ICON_NORMALIZATION_PROFILE_V1 = 'skill-icon-green-key-role-mask-v1' as const;
export const SKILL_ICON_NORMALIZATION_PROFILE_V2 = 'skill-icon-green-key-role-mask-v2' as const;
/** Compatibility alias for the original, default profile. */
export const SKILL_ICON_NORMALIZATION_PROFILE = SKILL_ICON_NORMALIZATION_PROFILE_V1;
export type SkillIconNormalizationProfile =
	typeof SKILL_ICON_NORMALIZATION_PROFILE_V1 | typeof SKILL_ICON_NORMALIZATION_PROFILE_V2;
export const SKILL_ICON_PROVIDER_SIZE = 1254;
export const SKILL_ICON_PROVIDER_MATTE = '#00FF00' as const;
export const SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE = 12;
export const SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE_V2 = 24;
export const SKILL_ICON_PROVIDER_OPAQUE_DISTANCE = 96;
export const SKILL_ICON_NORMALIZER_SHARP_VERSION = '0.35.3';
export const SKILL_ICON_NORMALIZER_VIPS_VERSION = '8.18.3';
export const SKILL_ICON_PROVIDER_MAX_BYTES = 64 * 1024 * 1024;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_V1_ALLOWED_CHUNKS = new Set(['IHDR', 'sRGB', 'pHYs', 'IDAT', 'IEND']);
const PNG_V2_ALLOWED_CHUNKS = new Set(['IHDR', 'caBX', 'IDAT', 'IEND']);
const PNG_SRGB_RENDERING_INTENT = 0;
const PNG_V2_MAX_CHUNKS = 1024;
const PNG_CABX_MIN_DATA_BYTES = 8;
const PNG_CABX_MAX_DATA_BYTES = 32_768;
const FORBIDDEN_ALPHA_MASS_LIMIT = 0.001;
const FORBIDDEN_OPAQUE_PIXEL_LIMIT = 0.00025;
const FORBIDDEN_COMPONENT_ALPHA_MASS_LIMIT = 64 * 255;
const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
	return value >>> 0;
});

export interface SkillIconProviderSourceEvidence {
	readonly mediaType: 'image/png';
	readonly width: 1254;
	readonly height: 1254;
	readonly bytes: number;
	readonly alphaMode: 'rgb';
	readonly contentHash: string;
}

interface SkillIconNormalizationEvidenceBase {
	readonly geometryHash: string;
	readonly sourceContentHash: string;
	readonly outputContentHash: string;
}

export interface SkillIconNormalizationEvidenceV1 extends SkillIconNormalizationEvidenceBase {
	readonly profile: typeof SKILL_ICON_NORMALIZATION_PROFILE_V1;
}

export interface SkillIconNormalizationEvidenceV2 extends SkillIconNormalizationEvidenceBase {
	readonly profile: typeof SKILL_ICON_NORMALIZATION_PROFILE_V2;
	readonly decoderInputContentHash: string;
	readonly containerBox: {
		readonly chunkType: 'caBX';
		readonly bytes: number;
		readonly contentHash: string;
	};
	readonly colorSpaceDisposition: 'assigned-srgb';
}

export type SkillIconNormalizationEvidence =
	SkillIconNormalizationEvidenceV1 | SkillIconNormalizationEvidenceV2;

export interface NormalizedSkillIconProviderSource<
	Normalization extends SkillIconNormalizationEvidence = SkillIconNormalizationEvidence
> {
	readonly source: SkillIconProviderSourceEvidence;
	readonly normalization: Normalization;
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

function crc32(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = (crc >>> 8) ^ (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0);
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
	const typeBytes = Buffer.from(type, 'ascii');
	const chunk = Buffer.alloc(data.length + 12);
	chunk.writeUInt32BE(data.length, 0);
	typeBytes.copy(chunk, 4);
	data.copy(chunk, 8);
	chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
	return chunk;
}

interface ProviderPngEnvelope {
	readonly decoderInput: Buffer;
	readonly containerBox?: SkillIconNormalizationEvidenceV2['containerBox'];
}

/**
 * Accept only the profile's explicit, color-metadata-free sRGB PNG envelope. Parsing
 * this before libvips prevents ancillary chunks or bytes after IEND from being
 * silently ignored or interpreted differently by another decoder.
 */
function assertCanonicalProviderPngEnvelope(
	bytes: Buffer,
	profile: SkillIconNormalizationProfile
): ProviderPngEnvelope {
	if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE))
		throw new Error('Provider source must be a PNG');
	let offset = PNG_SIGNATURE.length;
	let chunkIndex = 0;
	let sawSrgb = false;
	let sawPhys = false;
	let sawCabx = false;
	let sawIdat = false;
	let finishedIdat = false;
	let sawIend = false;
	let ihdrChunk: Buffer | undefined;
	let cabxData: Buffer | undefined;
	const idatChunks: Buffer[] = [];
	while (offset < bytes.length) {
		if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V2 && chunkIndex >= PNG_V2_MAX_CHUNKS)
			throw new Error(`Provider PNG exceeds the ${PNG_V2_MAX_CHUNKS}-chunk limit`);
		if (offset + 12 > bytes.length) throw new Error('Provider PNG has a truncated chunk');
		const length = bytes.readUInt32BE(offset);
		const chunkEnd = offset + 12 + length;
		if (chunkEnd > bytes.length) throw new Error('Provider PNG has a truncated chunk');
		const typeBytes = bytes.subarray(offset + 4, offset + 8);
		if (
			![...typeBytes].every(
				(byte) => (byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a)
			)
		)
			throw new Error('Provider PNG has a non-ASCII or invalid chunk type');
		const type = typeBytes.toString('ascii');
		const data = bytes.subarray(offset + 8, offset + 8 + length);
		const storedCrc = bytes.readUInt32BE(offset + 8 + length);
		if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== storedCrc)
			throw new Error(`Provider PNG ${type} chunk has an invalid CRC`);
		if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V1 && !PNG_V1_ALLOWED_CHUNKS.has(type))
			throw new Error(`Provider PNG contains forbidden ${type} metadata`);
		if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V2 && !PNG_V2_ALLOWED_CHUNKS.has(type))
			throw new Error(`Provider PNG v2 contains forbidden ${type} chunk`);
		if (chunkIndex === 0 && type !== 'IHDR') throw new Error('Provider PNG must begin with IHDR');
		if (chunkIndex > 0 && type === 'IHDR') throw new Error('Provider PNG contains duplicate IHDR');
		if (type === 'IHDR') {
			if (length !== 13) throw new Error('Provider PNG has an invalid IHDR');
			if (
				data.readUInt32BE(0) !== SKILL_ICON_PROVIDER_SIZE ||
				data.readUInt32BE(4) !== SKILL_ICON_PROVIDER_SIZE
			)
				throw new Error(
					`Provider source dimensions must be ${SKILL_ICON_PROVIDER_SIZE}×${SKILL_ICON_PROVIDER_SIZE}`
				);
			if (data[8] !== 8 || data[9] !== 2 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0)
				throw new Error('Provider PNG must be non-interlaced 8-bit RGB');
			ihdrChunk = bytes.subarray(offset, chunkEnd);
		} else if (type === 'caBX') {
			if (profile !== SKILL_ICON_NORMALIZATION_PROFILE_V2)
				throw new Error('Provider PNG contains forbidden caBX metadata');
			if (sawCabx) throw new Error('Provider PNG v2 contains duplicate caBX chunks');
			if (chunkIndex !== 1)
				throw new Error('Provider PNG v2 caBX chunk must immediately follow IHDR');
			if (length < PNG_CABX_MIN_DATA_BYTES || length > PNG_CABX_MAX_DATA_BYTES)
				throw new Error('Provider PNG v2 caBX data length is outside the bounded envelope');
			if (data.readUInt32BE(0) !== length)
				throw new Error(
					'Provider PNG v2 caBX embedded length does not match its chunk data length'
				);
			if (!data.subarray(4, 8).equals(Buffer.from('jumb', 'ascii')))
				throw new Error('Provider PNG v2 caBX box type must be ASCII jumb');
			sawCabx = true;
			cabxData = Buffer.from(data);
		} else if (type === 'sRGB') {
			if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V2)
				throw new Error('Provider PNG v2 contains forbidden sRGB chunk');
			if (sawSrgb || sawIdat || length !== 1 || data[0] !== PNG_SRGB_RENDERING_INTENT)
				throw new Error('Provider PNG must contain one canonical perceptual sRGB declaration');
			sawSrgb = true;
		} else if (type === 'pHYs') {
			if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V2)
				throw new Error('Provider PNG v2 contains forbidden pHYs chunk');
			if (sawPhys || sawIdat || length !== 9 || (data[8] !== 0 && data[8] !== 1))
				throw new Error('Provider PNG has an invalid pHYs chunk');
			sawPhys = true;
		} else if (type === 'IDAT') {
			if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V1 && !sawSrgb)
				throw new Error('Provider PNG colorimetry is undeclared; an sRGB chunk is required');
			if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V2 && !sawCabx)
				throw new Error('Provider PNG v2 must contain caBX immediately after IHDR');
			if (finishedIdat) throw new Error('Provider PNG IDAT chunks must be consecutive');
			sawIdat = true;
			idatChunks.push(bytes.subarray(offset, chunkEnd));
		} else if (type === 'IEND') {
			if (!sawIdat || length !== 0) throw new Error('Provider PNG has an invalid IEND');
			sawIend = true;
			if (chunkEnd !== bytes.length)
				throw new Error('Provider PNG contains trailing data after IEND');
		} else if (sawIdat) finishedIdat = true;
		if (sawIdat && type !== 'IDAT' && type !== 'IEND') finishedIdat = true;
		offset = chunkEnd;
		chunkIndex += 1;
		if (sawIend) break;
	}
	if (!sawIend) throw new Error('Provider PNG is missing IEND');
	if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V2 && !sawCabx)
		throw new Error('Provider PNG v2 must contain exactly one caBX chunk');
	if (profile === SKILL_ICON_NORMALIZATION_PROFILE_V1) return { decoderInput: bytes };
	if (!ihdrChunk || !cabxData) throw new Error('Provider PNG v2 envelope is incomplete');
	const decoderInput = Buffer.concat([
		PNG_SIGNATURE,
		ihdrChunk,
		pngChunk('sRGB', Buffer.from([PNG_SRGB_RENDERING_INTENT])),
		...idatChunks,
		pngChunk('IEND', Buffer.alloc(0))
	]);
	return {
		decoderInput,
		containerBox: {
			chunkType: 'caBX',
			bytes: cabxData.byteLength,
			contentHash: sha256(cabxData)
		}
	};
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
		const key = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
		colors.set(key, (colors.get(key) ?? 0) + 1);
	}
	const dominant = [...colors.entries()].sort((left, right) => right[1] - left[1]).slice(0, 2);
	if (dominant.length !== 2 || nonKeyPixels === 0) return;
	const [[firstColor, firstCount], [secondColor, secondCount]] = dominant;
	const firstRed = ((firstColor >>> 10) & 0x1f) * 8 + 4;
	const firstGreen = ((firstColor >>> 5) & 0x1f) * 8 + 4;
	const firstBlue = (firstColor & 0x1f) * 8 + 4;
	const secondRed = ((secondColor >>> 10) & 0x1f) * 8 + 4;
	const secondGreen = ((secondColor >>> 5) & 0x1f) * 8 + 4;
	const secondBlue = (secondColor & 0x1f) * 8 + 4;
	const colorSeparation = Math.max(
		Math.abs(firstRed - secondRed),
		Math.abs(firstGreen - secondGreen),
		Math.abs(firstBlue - secondBlue)
	);
	if (
		firstCount / nonKeyPixels < 0.05 ||
		secondCount / nonKeyPixels < 0.05 ||
		(firstCount + secondCount) / nonKeyPixels < 0.3 ||
		colorSeparation < 16
	)
		return;

	const width = SKILL_ICON_PROVIDER_SIZE;
	const height = data.length / 3 / width;
	const classify = (pixelOffset: number): 0 | 1 | -1 => {
		const key =
			(((data[pixelOffset] ?? 0) >> 3) << 10) |
			(((data[pixelOffset + 1] ?? 0) >> 3) << 5) |
			((data[pixelOffset + 2] ?? 0) >> 3);
		return key === firstColor ? 0 : key === secondColor ? 1 : -1;
	};
	let horizontalPairs = 0;
	let horizontalTransitions = 0;
	let verticalPairs = 0;
	let verticalTransitions = 0;
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const offset = (y * width + x) * 3;
			const current = classify(offset);
			if (current < 0) continue;
			if (x + 1 < width) {
				const right = classify(offset + 3);
				if (right >= 0) {
					horizontalPairs += 1;
					if (right !== current) horizontalTransitions += 1;
				}
			}
			if (y + 1 < height) {
				const below = classify(offset + width * 3);
				if (below >= 0) {
					verticalPairs += 1;
					if (below !== current) verticalTransitions += 1;
				}
			}
		}
	}
	if (
		horizontalTransitions / Math.max(1, horizontalPairs) >= 0.01 &&
		verticalTransitions / Math.max(1, verticalPairs) >= 0.01
	)
		throw new Error(
			'Provider source appears to contain a spatially alternating checkerboard matte'
		);
}

function assertNoPeriodicContrastCheckerboard(
	data: Buffer,
	width: number,
	height: number,
	roleMask: Uint8Array
): void {
	const hasOpposingContrast = (first: number, second: number, third: number): boolean => {
		const firstOffset = first * 3;
		const secondOffset = second * 3;
		const thirdOffset = third * 3;
		const firstDeltaRed = (data[secondOffset] ?? 0) - (data[firstOffset] ?? 0);
		const firstDeltaGreen = (data[secondOffset + 1] ?? 0) - (data[firstOffset + 1] ?? 0);
		const firstDeltaBlue = (data[secondOffset + 2] ?? 0) - (data[firstOffset + 2] ?? 0);
		const secondDeltaRed = (data[thirdOffset] ?? 0) - (data[secondOffset] ?? 0);
		const secondDeltaGreen = (data[thirdOffset + 1] ?? 0) - (data[secondOffset + 1] ?? 0);
		const secondDeltaBlue = (data[thirdOffset + 2] ?? 0) - (data[secondOffset + 2] ?? 0);
		const firstEnergy = firstDeltaRed ** 2 + firstDeltaGreen ** 2 + firstDeltaBlue ** 2;
		const secondEnergy = secondDeltaRed ** 2 + secondDeltaGreen ** 2 + secondDeltaBlue ** 2;
		if (firstEnergy < 28 ** 2 || secondEnergy < 28 ** 2) return false;
		const dot =
			firstDeltaRed * secondDeltaRed +
			firstDeltaGreen * secondDeltaGreen +
			firstDeltaBlue * secondDeltaBlue;
		return dot < 0 && dot ** 2 >= firstEnergy * secondEnergy * 0.25;
	};
	const minimumDimension = Math.min(width, height);
	const minimumMacroLag = Math.max(8, Math.ceil(minimumDimension / 160));
	// Requiring six cells across the source is the deterministic boundary
	// between a repeated matte pattern and a few intentional large regions.
	const maximumMacroLag = Math.floor(minimumDimension / 6);
	const sampleStride = Math.max(2, Math.floor(minimumDimension / 180));
	for (let lag = minimumMacroLag; lag <= maximumMacroLag; lag += 1) {
		let horizontalTriplets = 0;
		let horizontalAlternations = 0;
		let verticalTriplets = 0;
		let verticalAlternations = 0;
		// The image-derived stride caps the scan near 180 samples per axis while
		// every integer lag is still evaluated, so arbitrary cell sizes cannot
		// fall between a fixed list of favored scales.
		for (let y = 0; y < height; y += sampleStride) {
			for (let x = 0; x < width; x += sampleStride) {
				const first = y * width + x;
				if (roleMask[first] !== 1) continue;
				if (x + lag * 2 < width) {
					const second = first + lag;
					const third = second + lag;
					if (roleMask[second] === 1 && roleMask[third] === 1) {
						horizontalTriplets += 1;
						if (hasOpposingContrast(first, second, third)) horizontalAlternations += 1;
					}
				}
				if (y + lag * 2 < height) {
					const second = first + lag * width;
					const third = second + lag * width;
					if (roleMask[second] === 1 && roleMask[third] === 1) {
						verticalTriplets += 1;
						if (hasOpposingContrast(first, second, third)) verticalAlternations += 1;
					}
				}
			}
		}
		if (
			horizontalAlternations / Math.max(1, horizontalTriplets) >= 0.35 &&
			verticalAlternations / Math.max(1, verticalTriplets) >= 0.35
		)
			throw new Error('Provider source contains a spatially periodic contrast checkerboard matte');
	}
}

function assertProviderMatte(
	data: Buffer,
	width: number,
	height: number,
	geometry: SkillIconGeometry,
	allowsPixel: (x: number, y: number) => boolean,
	transparentDistance: number
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
				if (distance <= transparentDistance) strongMatte += 1;
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
				if (distance <= transparentDistance) strongRequiredTransparent += 1;
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

function assertForbiddenRegionAlpha(
	rgba: Buffer,
	width: number,
	height: number,
	roleMask: Uint8Array
): void {
	let forbiddenPixels = 0;
	let forbiddenAlphaMass = 0;
	let forbiddenOpaquePixels = 0;
	const significantForbiddenAlpha = new Uint8Array(width * height);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (roleMask[y * width + x] === 1) continue;
			let boundaryHalo = false;
			for (let deltaY = -3; deltaY <= 3 && !boundaryHalo; deltaY += 1) {
				for (let deltaX = -3; deltaX <= 3; deltaX += 1) {
					const neighborX = x + deltaX;
					const neighborY = y + deltaY;
					if (
						neighborX >= 0 &&
						neighborX < width &&
						neighborY >= 0 &&
						neighborY < height &&
						roleMask[neighborY * width + neighborX] === 1
					) {
						boundaryHalo = true;
						break;
					}
				}
			}
			// Lanczos3 and provider rasterization can legitimately occupy this
			// three-pixel profile-owned transition band. Only alpha beyond it is
			// evidence of misplaced content.
			if (boundaryHalo) continue;
			forbiddenPixels += 1;
			const alpha = rgba[(y * width + x) * 4 + 3] ?? 0;
			forbiddenAlphaMass += alpha;
			if (alpha >= 128) forbiddenOpaquePixels += 1;
			if (alpha >= 64) significantForbiddenAlpha[y * width + x] = 1;
		}
	}
	const stack: number[] = [];
	for (let start = 0; start < significantForbiddenAlpha.length; start += 1) {
		if (significantForbiddenAlpha[start] !== 1) continue;
		let componentAlphaMass = 0;
		stack.push(start);
		significantForbiddenAlpha[start] = 2;
		while (stack.length > 0) {
			const pixelIndex = stack.pop()!;
			componentAlphaMass += rgba[pixelIndex * 4 + 3] ?? 0;
			const x = pixelIndex % width;
			for (const neighbor of [
				x > 0 ? pixelIndex - 1 : -1,
				x + 1 < width ? pixelIndex + 1 : -1,
				pixelIndex >= width ? pixelIndex - width : -1,
				pixelIndex + width < significantForbiddenAlpha.length ? pixelIndex + width : -1
			]) {
				if (neighbor >= 0 && significantForbiddenAlpha[neighbor] === 1) {
					significantForbiddenAlpha[neighbor] = 2;
					stack.push(neighbor);
				}
			}
		}
		if (componentAlphaMass >= FORBIDDEN_COMPONENT_ALPHA_MASS_LIMIT)
			throw new Error(
				'Provider source has a meaningful alpha component in a role-required transparent region'
			);
	}
	const alphaMassFraction = forbiddenAlphaMass / Math.max(1, forbiddenPixels * 255);
	const opaquePixelFraction = forbiddenOpaquePixels / Math.max(1, forbiddenPixels);
	if (
		alphaMassFraction > FORBIDDEN_ALPHA_MASS_LIMIT ||
		opaquePixelFraction > FORBIDDEN_OPAQUE_PIXEL_LIMIT
	)
		throw new Error(
			`Provider source has resulting alpha mass in a role-required transparent region (${alphaMassFraction.toFixed(6)} mass, ${opaquePixelFraction.toFixed(6)} opaque)`
		);
}

function assertNoSpatialAlphaCheckerboard(
	rgba: Buffer,
	width: number,
	height: number,
	roleMask: Uint8Array
): void {
	const alphaBins = new Uint32Array(16);
	let allowedPixels = 0;
	for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
		if (roleMask[pixelIndex] !== 1) continue;
		allowedPixels += 1;
		const alpha = rgba[pixelIndex * 4 + 3] ?? 0;
		alphaBins[Math.min(15, alpha >> 4)]! += 1;
	}
	const [firstBin, secondBin] = [...alphaBins.keys()].sort(
		(left, right) => (alphaBins[right] ?? 0) - (alphaBins[left] ?? 0)
	);
	if (firstBin === undefined || secondBin === undefined) return;
	const firstCount = alphaBins[firstBin] ?? 0;
	const secondCount = alphaBins[secondBin] ?? 0;
	if (
		firstCount / Math.max(1, allowedPixels) < 0.05 ||
		secondCount / Math.max(1, allowedPixels) < 0.05 ||
		(firstCount + secondCount) / Math.max(1, allowedPixels) < 0.3 ||
		Math.abs(firstBin - secondBin) < 3
	)
		return;
	const classify = (pixelIndex: number): 0 | 1 | -1 => {
		const alphaBin = Math.min(15, (rgba[pixelIndex * 4 + 3] ?? 0) >> 4);
		return alphaBin === firstBin ? 0 : alphaBin === secondBin ? 1 : -1;
	};
	for (const lag of [1, 2, 4, 8, 16]) {
		let horizontalPairs = 0;
		let horizontalTransitions = 0;
		let verticalPairs = 0;
		let verticalTransitions = 0;
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				const pixelIndex = y * width + x;
				if (roleMask[pixelIndex] !== 1) continue;
				const current = classify(pixelIndex);
				if (current < 0) continue;
				if (x + lag < width && roleMask[pixelIndex + lag] === 1) {
					const right = classify(pixelIndex + lag);
					if (right >= 0) {
						horizontalPairs += 1;
						if (right !== current) horizontalTransitions += 1;
					}
				}
				if (y + lag < height && roleMask[pixelIndex + lag * width] === 1) {
					const below = classify(pixelIndex + lag * width);
					if (below >= 0) {
						verticalPairs += 1;
						if (below !== current) verticalTransitions += 1;
					}
				}
			}
		}
		if (
			horizontalTransitions / Math.max(1, horizontalPairs) >= 0.05 &&
			verticalTransitions / Math.max(1, verticalPairs) >= 0.05
		)
			throw new Error(
				'Provider source contains a spatially alternating opacity checkerboard matte'
			);
	}
}

/** Profile-owned alpha curve, exported so threshold behavior remains directly testable. */
export function skillIconGreenKeyAlpha(red: number, green: number, blue: number): number {
	return skillIconGreenKeyAlphaForProfile(red, green, blue, SKILL_ICON_NORMALIZATION_PROFILE_V1);
}

/** Profile-dispatched alpha curve. V2 widens only the fully transparent key distance. */
export function skillIconGreenKeyAlphaForProfile(
	red: number,
	green: number,
	blue: number,
	profile: SkillIconNormalizationProfile
): number {
	const distance = keyDistance(red, green, blue);
	const transparentDistance =
		profile === SKILL_ICON_NORMALIZATION_PROFILE_V2
			? SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE_V2
			: SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE;
	if (distance <= transparentDistance) return 0;
	if (distance >= SKILL_ICON_PROVIDER_OPAQUE_DISTANCE) return 255;
	return Math.round(
		(255 * (distance - transparentDistance)) /
			(SKILL_ICON_PROVIDER_OPAQUE_DISTANCE - transparentDistance)
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

function scaleRoleMask(
	roleMask: Uint8Array,
	roleWidth: number,
	roleHeight: number,
	width: number,
	height: number
): Uint8Array {
	const scaled = new Uint8Array(width * height);
	for (let y = 0; y < height; y += 1) {
		const roleY = Math.min(roleHeight - 1, Math.floor((y * roleHeight) / height));
		for (let x = 0; x < width; x += 1) {
			const roleX = Math.min(roleWidth - 1, Math.floor((x * roleWidth) / width));
			scaled[y * width + x] = roleMask[roleY * roleWidth + roleX] ?? 0;
		}
	}
	return scaled;
}

/** Pure, deterministic provider-byte normalization. It never reads or writes the filesystem. */
export function normalizeSkillIconProviderSource(
	sourceBytes: Buffer,
	roleInput: SkillIconRole,
	geometrySourceBytes: Buffer
): Promise<NormalizedSkillIconProviderSource<SkillIconNormalizationEvidenceV1>>;
export function normalizeSkillIconProviderSource(
	sourceBytes: Buffer,
	roleInput: SkillIconRole,
	geometrySourceBytes: Buffer,
	profile: typeof SKILL_ICON_NORMALIZATION_PROFILE_V1
): Promise<NormalizedSkillIconProviderSource<SkillIconNormalizationEvidenceV1>>;
export function normalizeSkillIconProviderSource(
	sourceBytes: Buffer,
	roleInput: SkillIconRole,
	geometrySourceBytes: Buffer,
	profile: typeof SKILL_ICON_NORMALIZATION_PROFILE_V2
): Promise<NormalizedSkillIconProviderSource<SkillIconNormalizationEvidenceV2>>;
export function normalizeSkillIconProviderSource(
	sourceBytes: Buffer,
	roleInput: SkillIconRole,
	geometrySourceBytes: Buffer,
	profile: SkillIconNormalizationProfile
): Promise<NormalizedSkillIconProviderSource>;
export async function normalizeSkillIconProviderSource(
	sourceBytes: Buffer,
	roleInput: SkillIconRole,
	geometrySourceBytes: Buffer,
	profile: SkillIconNormalizationProfile = SKILL_ICON_NORMALIZATION_PROFILE_V1
): Promise<NormalizedSkillIconProviderSource> {
	// Own both inputs before the first await. Callers cannot alter decoded pixels or
	// provenance hashes by mutating a Buffer in a queued microtask.
	if (sourceBytes.byteLength === 0 || sourceBytes.byteLength > SKILL_ICON_PROVIDER_MAX_BYTES)
		throw new Error('Provider source byte size is outside the bounded envelope');
	const sourceSnapshot = Buffer.from(sourceBytes);
	const geometrySnapshot = Buffer.from(geometrySourceBytes);
	if (
		profile !== SKILL_ICON_NORMALIZATION_PROFILE_V1 &&
		profile !== SKILL_ICON_NORMALIZATION_PROFILE_V2
	)
		throw new Error('Unsupported skill-icon normalization profile');
	const envelope = assertCanonicalProviderPngEnvelope(sourceSnapshot, profile);
	const role = SkillIconRoleSchema.parse(roleInput);
	if (role !== 'rarity-frame' && role !== 'backing')
		throw new Error('Green-key normalization is authorized only for rarity-frame and backing jobs');
	let rawGeometry: unknown;
	try {
		rawGeometry = JSON.parse(geometrySnapshot.toString('utf8'));
	} catch {
		throw new Error('Geometry authority is not valid JSON');
	}
	const geometry = SkillIconGeometrySchema.parse(rawGeometry);
	const roleMask = buildRoleMask(role, geometry);
	const allowsPixel = (x: number, y: number): boolean =>
		roleMask[y * geometry.canvas.width + x] === 1;
	const transparentDistance =
		profile === SKILL_ICON_NORMALIZATION_PROFILE_V2
			? SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE_V2
			: SKILL_ICON_PROVIDER_TRANSPARENT_DISTANCE;
	if (
		sharp.versions.sharp !== SKILL_ICON_NORMALIZER_SHARP_VERSION ||
		sharp.versions.vips !== SKILL_ICON_NORMALIZER_VIPS_VERSION
	)
		throw new Error('Green-key normalization requires the profile-pinned Sharp/libvips toolchain');
	const image = sharp(envelope.decoderInput, {
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
	assertProviderMatte(
		decoded.data,
		decoded.info.width,
		decoded.info.height,
		geometry,
		allowsPixel,
		transparentDistance
	);
	const providerRoleMask = scaleRoleMask(
		roleMask,
		geometry.canvas.width,
		geometry.canvas.height,
		decoded.info.width,
		decoded.info.height
	);
	assertNoPeriodicContrastCheckerboard(
		decoded.data,
		decoded.info.width,
		decoded.info.height,
		providerRoleMask
	);

	const rgba = Buffer.alloc(decoded.info.width * decoded.info.height * 4);
	for (let index = 0; index < decoded.info.width * decoded.info.height; index += 1) {
		const sourceOffset = index * 3;
		const outputOffset = index * 4;
		const red = decoded.data[sourceOffset] ?? 0;
		const green = decoded.data[sourceOffset + 1] ?? 0;
		const blue = decoded.data[sourceOffset + 2] ?? 0;
		const alpha = skillIconGreenKeyAlphaForProfile(red, green, blue, profile);
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
	assertNoSpatialAlphaCheckerboard(rgba, decoded.info.width, decoded.info.height, providerRoleMask);
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
	assertNoSpatialAlphaCheckerboard(
		resized,
		geometry.canvas.width,
		geometry.canvas.height,
		roleMask
	);
	assertForbiddenRegionAlpha(resized, geometry.canvas.width, geometry.canvas.height, roleMask);
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
	const sourceHash = sha256(sourceSnapshot);
	const outputHash = sha256(outputBytes);
	const normalizationBase = {
		geometryHash: sha256(geometrySnapshot),
		sourceContentHash: sourceHash,
		outputContentHash: outputHash
	};
	const normalization: SkillIconNormalizationEvidence =
		profile === SKILL_ICON_NORMALIZATION_PROFILE_V2
			? {
					...normalizationBase,
					profile,
					decoderInputContentHash: sha256(envelope.decoderInput),
					containerBox: envelope.containerBox!,
					colorSpaceDisposition: 'assigned-srgb'
				}
			: {
					...normalizationBase,
					profile
				};
	return {
		source: {
			mediaType: 'image/png',
			width: SKILL_ICON_PROVIDER_SIZE,
			height: SKILL_ICON_PROVIDER_SIZE,
			bytes: sourceSnapshot.byteLength,
			alphaMode: 'rgb',
			contentHash: sourceHash
		},
		normalization,
		bytes: outputBytes
	};
}

export async function readSkillIconProviderSourceOnce(
	sourcePath: string,
	testHook?: () => void | Promise<void>
): Promise<Buffer> {
	const handle = await open(
		sourcePath,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
	).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ELOOP') throw new Error('Provider source cannot be a symbolic link');
		throw error;
	});
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

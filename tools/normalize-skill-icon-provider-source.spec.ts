import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rename, rm, symlink, writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	SkillIconGeometrySchema,
	SkillIconGeometryV2Schema
} from '../packages/contracts/src/index.js';
import {
	normalizeSkillIconProviderSource,
	readSkillIconProviderSourceOnce,
	SKILL_ICON_NORMALIZATION_PROFILE_V1,
	SKILL_ICON_NORMALIZATION_PROFILE_V2,
	SKILL_ICON_NORMALIZATION_PROFILE_V3,
	SKILL_ICON_PROVIDER_MAX_BYTES,
	skillIconGreenKeyAlpha,
	skillIconGreenKeyAlphaForProfile
} from './normalize-skill-icon-provider-source.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

const temporaryRoots: string[] = [];
afterEach(async () =>
	Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
);

const geometryBytes = await readFile('assets/wiki/skills/icon-production-v1/geometry.json');
const geometry = SkillIconGeometrySchema.parse(JSON.parse(geometryBytes.toString('utf8')));
const geometryV2Bytes = await readFile('assets/wiki/skills/icon-production-v1/geometry-v2.json');
const geometryV2 = SkillIconGeometryV2Schema.parse(JSON.parse(geometryV2Bytes.toString('utf8')));
const execFileAsync = promisify(execFile);
const geometryRoleMaskProfile = 'skill-icon-geometry-role-mask-v1' as const;

function crc32(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
	return pngChunkWithTypeBytes(Buffer.from(type, 'ascii'), data);
}

function pngChunkWithTypeBytes(typeBytes: Buffer, data: Buffer): Buffer {
	const chunk = Buffer.alloc(data.length + 12);
	chunk.writeUInt32BE(data.length, 0);
	typeBytes.copy(chunk, 4);
	data.copy(chunk, 8);
	chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
	return chunk;
}

function insertPngChunkAfterIhdr(png: Buffer, type: string, data: Buffer): Buffer {
	const ihdrEnd = 8 + 12 + png.readUInt32BE(8);
	return Buffer.concat([png.subarray(0, ihdrEnd), pngChunk(type, data), png.subarray(ihdrEnd)]);
}

function removePngChunk(png: Buffer, target: string): Buffer {
	let offset = 8;
	const parts = [png.subarray(0, 8)];
	while (offset < png.length) {
		const length = png.readUInt32BE(offset);
		const end = offset + 12 + length;
		if (png.toString('ascii', offset + 4, offset + 8) !== target)
			parts.push(png.subarray(offset, end));
		offset = end;
	}
	return Buffer.concat(parts);
}

function declareSrgb(png: Buffer): Buffer {
	return insertPngChunkAfterIhdr(png, 'sRGB', Buffer.from([0]));
}

interface ParsedPngChunk {
	readonly type: string;
	readonly data: Buffer;
	readonly bytes: Buffer;
}

function pngChunks(png: Buffer): ParsedPngChunk[] {
	const chunks: ParsedPngChunk[] = [];
	let offset = 8;
	while (offset < png.length) {
		const length = png.readUInt32BE(offset);
		const end = offset + 12 + length;
		chunks.push({
			type: png.toString('ascii', offset + 4, offset + 8),
			data: Buffer.from(png.subarray(offset + 8, offset + 8 + length)),
			bytes: Buffer.from(png.subarray(offset, end))
		});
		offset = end;
	}
	return chunks;
}

function encodePngChunks(chunks: readonly Buffer[]): Buffer {
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}

function cabxData(payload: Buffer = Buffer.from('canonical-jumbf-evidence', 'ascii')): Buffer {
	const data = Buffer.alloc(8 + payload.length);
	data.writeUInt32BE(data.length, 0);
	data.write('jumb', 4, 'ascii');
	payload.copy(data, 8);
	return data;
}

function declareCabx(png: Buffer, data = cabxData()): Buffer {
	const chunks = pngChunks(png).filter(({ type }) => type !== 'sRGB' && type !== 'pHYs');
	return encodePngChunks([
		chunks[0]!.bytes,
		pngChunk('caBX', data),
		...chunks.slice(1).map(({ bytes }) => bytes)
	]);
}

async function providerSource(role: 'rarity-frame' | 'backing'): Promise<Buffer> {
	const content =
		role === 'rarity-frame'
			? `<path d="M627 98 L1107 372 L1107 882 L627 1156 L147 882 L147 372 Z M627 214 L1001 428 L1001 826 L627 1040 L253 826 L253 428 Z" fill="#3a3a42" fill-rule="evenodd"/><rect x="520" y="0" width="214" height="250" rx="35" fill="#3a3a42"/>`
			: `<polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="#292c33"/>`;
	const svg = Buffer.from(
		`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg">${content}</svg>`
	);
	const png = await sharp({
		create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
	})
		.composite([{ input: svg }])
		.removeAlpha()
		.png({ progressive: false, palette: false })
		.toBuffer();
	return declareSrgb(png);
}

async function legacyFrameSource(extraSvg = ''): Promise<Buffer> {
	const svg = Buffer.from(
		`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><path d="M627 98 L1107 372 L1107 882 L627 1156 L147 882 L147 372 Z M627 214 L1001 428 L1001 826 L627 1040 L253 826 L253 428 Z" fill="#3a3a42" fill-rule="evenodd"/><rect x="520" y="0" width="214" height="250" rx="35" fill="#3a3a42"/>${extraSvg}</svg>`
	);
	return declareSrgb(
		await sharp({
			create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
		})
			.composite([{ input: svg }])
			.removeAlpha()
			.png({ progressive: false, palette: false })
			.toBuffer()
	);
}

function scaledPoints(
	points: readonly (readonly [number, number])[],
	size = 1254
): readonly (readonly [number, number])[] {
	return points.map(([x, y]) => [x * size, y * size]);
}

function pointsAttribute(points: readonly (readonly [number, number])[]): string {
	return points.map(([x, y]) => `${x},${y}`).join(' ');
}

async function profileV3FrameSource(extraSvg = ''): Promise<Buffer> {
	const center = [627, 627] as const;
	const outer = scaledPoints(geometryV2.outerEnvelopePoints);
	const aperture = scaledPoints(geometryV2.aperturePoints);
	const inner = aperture.map(
		([x, y]) =>
			[
				center[0] + (x - center[0]) * geometryV2.innerApertureScale,
				center[1] + (y - center[1]) * geometryV2.innerApertureScale
			] as const
	);
	const framePath = `${outer.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')} Z ${inner.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')} Z`;
	const svg = Buffer.from(
		`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><path d="${framePath}" fill="#3a3a42" fill-rule="evenodd"/><rect x="520" y="0" width="214" height="250" rx="35" fill="#3a3a42"/>${extraSvg}</svg>`
	);
	const png = await sharp({
		create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
	})
		.composite([{ input: svg }])
		.removeAlpha()
		.png({ progressive: false, palette: false })
		.toBuffer();
	return declareCabx(png);
}

function pointInLiteralPolygon(
	x: number,
	y: number,
	points: readonly (readonly [number, number])[]
): boolean {
	let inside = false;
	for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
		const [xi, yi] = points[index]!;
		const [xj, yj] = points[previous]!;
		if (yi !== yj && yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
}

async function dirtyEdgeBackingSource(contentSvg?: string): Promise<Buffer> {
	const aperture = pointsAttribute(scaledPoints(geometryV2.aperturePoints));
	const content = contentSvg ?? `<polygon points="${aperture}" fill="#292c33"/>`;
	const dirtyForbiddenEdge =
		'<path d="M0 0H1254V64H0ZM0 1190H1254V1254H0ZM0 64H64V1190H0ZM1190 64H1254V1190H1190Z" fill="#777b82"/>';
	const png = await sharp({
		create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
	})
		.composite([
			{
				input: Buffer.from(
					`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg">${content}${dirtyForbiddenEdge}</svg>`
				)
			}
		])
		.removeAlpha()
		.png({ progressive: false, palette: false })
		.toBuffer();
	return declareCabx(png);
}

describe('skill-icon provider normalization', () => {
	it('keeps the fixed green-key thresholds bright enough to preserve dark green material', () => {
		expect(skillIconGreenKeyAlpha(0, 255, 0)).toBe(0);
		expect(skillIconGreenKeyAlpha(0, 244, 0)).toBe(0);
		expect(skillIconGreenKeyAlpha(0, 243, 0)).toBe(0);
		expect(skillIconGreenKeyAlpha(0, 242, 0)).toBeGreaterThan(0);
		expect(skillIconGreenKeyAlpha(0, 200, 0)).toBeGreaterThan(0);
		expect(skillIconGreenKeyAlpha(0, 199, 0)).toBeGreaterThan(0);
		expect(skillIconGreenKeyAlpha(0, 161, 0)).toBeGreaterThan(240);
		expect(skillIconGreenKeyAlpha(0, 160, 0)).toBeGreaterThan(240);
		expect(skillIconGreenKeyAlpha(0, 159, 0)).toBe(255);
		expect(skillIconGreenKeyAlpha(80, 240, 80)).toBeGreaterThan(0);
		expect(skillIconGreenKeyAlpha(80, 241, 80)).toBeGreaterThan(0);
		expect(skillIconGreenKeyAlpha(159, 255, 0)).toBe(255);
		expect(skillIconGreenKeyAlpha(160, 255, 0)).toBe(255);
	});

	it('dispatches the v2 transparent-distance curve without changing v1', () => {
		expect(skillIconGreenKeyAlpha(0, 235, 0)).toBeGreaterThan(0);
		expect(skillIconGreenKeyAlphaForProfile(0, 235, 0, SKILL_ICON_NORMALIZATION_PROFILE_V2)).toBe(
			0
		);
		expect(
			skillIconGreenKeyAlphaForProfile(0, 230, 0, SKILL_ICON_NORMALIZATION_PROFILE_V2)
		).toBeGreaterThan(0);
		expect(skillIconGreenKeyAlphaForProfile(0, 159, 0, SKILL_ICON_NORMALIZATION_PROFILE_V2)).toBe(
			255
		);
		expect(skillIconGreenKeyAlphaForProfile(0, 235, 0, SKILL_ICON_NORMALIZATION_PROFILE_V3)).toBe(
			0
		);
		expect(skillIconGreenKeyAlphaForProfile(0, 230, 0, SKILL_ICON_NORMALIZATION_PROFILE_V3)).toBe(
			skillIconGreenKeyAlphaForProfile(0, 230, 0, SKILL_ICON_NORMALIZATION_PROFILE_V2)
		);
	});

	it('accepts a clean near-green matte only under the v2 distance', async () => {
		const content = Buffer.from(
			'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="#292c33"/></svg>'
		);
		const nearGreen = await sharp({
			create: { width: 1254, height: 1254, channels: 3, background: '#00eb00' }
		})
			.composite([{ input: content }])
			.removeAlpha()
			.png({ progressive: false, palette: false })
			.toBuffer();
		await expect(
			normalizeSkillIconProviderSource(declareSrgb(nearGreen), 'backing', geometryBytes)
		).rejects.toThrow(/clean #00FF00 edge matte/u);
		await expect(
			normalizeSkillIconProviderSource(
				declareCabx(nearGreen),
				'backing',
				geometryBytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V2
			)
		).resolves.toMatchObject({
			normalization: {
				profile: SKILL_ICON_NORMALIZATION_PROFILE_V2,
				colorSpaceDisposition: 'assigned-srgb'
			}
		});
	});

	it.each(['rarity-frame', 'backing'] as const)(
		'normalizes a 1254 RGB green-key %s deterministically into valid canonical RGBA',
		async (role) => {
			const source = await providerSource(role);
			const first = await normalizeSkillIconProviderSource(source, role, geometryBytes);
			const second = await normalizeSkillIconProviderSource(source, role, geometryBytes);
			expect(first.bytes).toEqual(second.bytes);
			expect(first.normalization.sourceContentHash).toBe(first.source.contentHash);
			expect(first.normalization.outputContentHash).toMatch(/^[a-f0-9]{64}$/u);
			const inspection = await inspectSkillIconAsset(first.bytes, role, geometry);
			expect(inspection).toMatchObject({
				width: 1024,
				height: 1024,
				alphaMode: 'rgba',
				violations: []
			});
			const raw = await sharp(first.bytes).ensureAlpha().raw().toBuffer();
			for (let index = 0; index < raw.length; index += 4) {
				if (raw[index + 3] !== 0) continue;
				expect([...raw.subarray(index, index + 3)]).toEqual([0, 0, 0]);
			}
		},
		20_000
	);

	it.each([
		['rarity-frame', 'dca0c066738b9b015e0df47a33b0809a9d99fe98f8bdaee55c16d3c516aa9b59'],
		['backing', '7d19cf8131dce50af8ed63940c2bf5d32b3be2df31ec7d911884b351306e5c59']
	] as const)('keeps the fixed %s output golden', async (role, goldenHash) => {
		const normalized = await normalizeSkillIconProviderSource(
			await providerSource(role),
			role,
			geometryBytes
		);
		expect(normalized.normalization.outputContentHash).toBe(goldenHash);
	});

	it('normalizes the exact v2 caBX envelope and binds container and decoder evidence', async () => {
		const v1 = await providerSource('backing');
		const firstCabxData = cabxData(Buffer.from('same-length-jumbf-claim-a', 'ascii'));
		const secondCabxData = cabxData(Buffer.from('same-length-jumbf-claim-b', 'ascii'));
		const firstSource = declareCabx(v1, firstCabxData);
		const secondSource = declareCabx(v1, secondCabxData);
		const first = await normalizeSkillIconProviderSource(
			firstSource,
			'backing',
			geometryBytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V2
		);
		const second = await normalizeSkillIconProviderSource(
			secondSource,
			'backing',
			geometryBytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V2
		);
		expect(first.normalization.profile).toBe(SKILL_ICON_NORMALIZATION_PROFILE_V2);
		if (first.normalization.profile !== SKILL_ICON_NORMALIZATION_PROFILE_V2)
			throw new Error('Expected v2 normalization evidence');
		if (second.normalization.profile !== SKILL_ICON_NORMALIZATION_PROFILE_V2)
			throw new Error('Expected v2 normalization evidence');
		expect(first.normalization).toMatchObject({
			colorSpaceDisposition: 'assigned-srgb',
			containerBox: {
				chunkType: 'caBX',
				bytes: firstCabxData.length,
				contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
			}
		});
		expect(first.source.contentHash).toBe(createHash('sha256').update(firstSource).digest('hex'));
		expect(first.normalization.containerBox.contentHash).toBe(
			createHash('sha256').update(firstCabxData).digest('hex')
		);
		expect(second.normalization.containerBox.contentHash).toBe(
			createHash('sha256').update(secondCabxData).digest('hex')
		);
		expect(first.source.contentHash).not.toBe(second.source.contentHash);
		expect(first.normalization.containerBox.contentHash).not.toBe(
			second.normalization.containerBox.contentHash
		);
		expect(first.normalization.decoderInputContentHash).toBe(
			second.normalization.decoderInputContentHash
		);
		expect(first.normalization.outputContentHash).toBe(second.normalization.outputContentHash);
		expect(first.bytes).toEqual(second.bytes);
		expect(pngChunks(first.bytes).map(({ type }) => type)).not.toContain('caBX');
	});

	it('preserves the v2 output goldens byte-for-byte', async () => {
		for (const [role, goldenHash] of [
			['rarity-frame', '974fe110fbbdd8d9a2e53702cfb9f18734ad253bcec48ac836e8b1611307b9a0'],
			['backing', '76d57aa23eed7455d427b77e83479b427513b5902f50184d976bf24bea639916']
		] as const) {
			const normalized = await normalizeSkillIconProviderSource(
				declareCabx(await providerSource(role)),
				role,
				geometryBytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V2
			);
			expect(normalized.normalization.outputContentHash).toBe(goldenHash);
		}
	}, 20_000);

	it('accepts corrected frame overscan only with the profile-v3 outer envelope', async () => {
		const source = await profileV3FrameSource();
		await expect(
			normalizeSkillIconProviderSource(
				source,
				'rarity-frame',
				geometryBytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V2
			)
		).rejects.toThrow(/required transparent/u);

		const normalized = await normalizeSkillIconProviderSource(
			source,
			'rarity-frame',
			geometryV2Bytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V3
		);
		expect(normalized.normalization).toMatchObject({
			profile: SKILL_ICON_NORMALIZATION_PROFILE_V3,
			decoderInputContentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
			containerBox: {
				chunkType: 'caBX',
				bytes: expect.any(Number),
				contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
			},
			colorSpaceDisposition: 'assigned-srgb'
		});
		expect(
			(await inspectSkillIconAsset(normalized.bytes, 'rarity-frame', geometryV2)).violations
		).toEqual([]);
		const pixels = await sharp(normalized.bytes).ensureAlpha().raw().toBuffer();
		expect(pixels[(60 * 1024 + 512) * 4 + 3]).toBeGreaterThan(8);
		expect(pngChunks(normalized.bytes).map(({ type }) => type)).not.toContain('caBX');
	}, 20_000);

	it('keeps profile-v3 backing pixels identical to v2 while binding geometry-v2', async () => {
		const source = declareCabx(await providerSource('backing'));
		const v2 = await normalizeSkillIconProviderSource(
			source,
			'backing',
			geometryBytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V2
		);
		const v3 = await normalizeSkillIconProviderSource(
			source,
			'backing',
			geometryV2Bytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V3
		);
		expect(v3.bytes).toEqual(v2.bytes);
		expect(v3.normalization.outputContentHash).toBe(v2.normalization.outputContentHash);
		expect(v3.normalization.geometryHash).not.toBe(v2.normalization.geometryHash);
	});

	it('keeps profile-v3 rejection of dirty edge and forbidden-region provider pixels', async () => {
		await expect(
			normalizeSkillIconProviderSource(
				await dirtyEdgeBackingSource(),
				'backing',
				geometryV2Bytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V3
			)
		).rejects.toThrow(/clean #00FF00 edge matte|required transparent/u);
	}, 20_000);

	it('geometry-first normalization clears dirty forbidden pixels into a deterministic role-valid backing', async () => {
		const source = await dirtyEdgeBackingSource();
		const first = await normalizeSkillIconProviderSource(
			source,
			'backing',
			geometryV2Bytes,
			geometryRoleMaskProfile
		);
		const second = await normalizeSkillIconProviderSource(
			source,
			'backing',
			geometryV2Bytes,
			geometryRoleMaskProfile
		);
		expect(first.bytes).toEqual(second.bytes);
		expect(first.normalization).toMatchObject({
			profile: geometryRoleMaskProfile,
			geometryHash: createHash('sha256').update(geometryV2Bytes).digest('hex'),
			decoderInputContentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
			containerBox: {
				chunkType: 'caBX',
				bytes: expect.any(Number),
				contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
			},
			colorSpaceDisposition: 'assigned-srgb'
		});
		expect(await inspectSkillIconAsset(first.bytes, 'backing', geometryV2)).toMatchObject({
			width: 1024,
			height: 1024,
			alphaMode: 'rgba',
			violations: []
		});
		const pixels = await sharp(first.bytes).ensureAlpha().raw().toBuffer();
		const aperture = geometryV2.aperturePoints.map(([x, y]) => [x * 1024, y * 1024] as const);
		let nonzeroForbiddenChannels = 0;
		for (let y = 0; y < 1024; y += 1) {
			for (let x = 0; x < 1024; x += 1) {
				if (pointInLiteralPolygon(x + 0.5, y + 0.5, aperture)) continue;
				const offset = (y * 1024 + x) * 4;
				for (let channel = 0; channel < 4; channel += 1) {
					if (pixels[offset + channel] !== 0) nonzeroForbiddenChannels += 1;
				}
			}
		}
		expect(nonzeroForbiddenChannels).toBe(0);
	}, 30_000);

	it('geometry-first normalization retains the exact bounded caBX envelope gate', async () => {
		const parsed = pngChunks(await dirtyEdgeBackingSource());
		const ihdr = parsed[0]!.bytes;
		const cabx = parsed[1]!.bytes;
		const idats = parsed.filter(({ type }) => type === 'IDAT').map(({ bytes }) => bytes);
		const iend = parsed.at(-1)!.bytes;
		const normalize = (source: Buffer) =>
			normalizeSkillIconProviderSource(source, 'backing', geometryV2Bytes, geometryRoleMaskProfile);
		const malformed = cabxData();
		malformed.writeUInt32BE(malformed.length - 1, 0);

		await expect(normalize(encodePngChunks([ihdr, ...idats, iend]))).rejects.toThrow(/caBX/u);
		await expect(normalize(encodePngChunks([ihdr, ...idats, cabx, iend]))).rejects.toThrow(
			/caBX immediately after IHDR/u
		);
		await expect(
			normalize(encodePngChunks([ihdr, pngChunk('caBX', malformed), ...idats, iend]))
		).rejects.toThrow(/embedded length/u);
	}, 20_000);

	it('geometry-first normalization rejects legacy geometry and provider alpha', async () => {
		const source = await dirtyEdgeBackingSource();
		await expect(
			normalizeSkillIconProviderSource(
				source,
				'skill-art',
				geometryV2Bytes,
				geometryRoleMaskProfile
			)
		).rejects.toThrow(/authorized only/iu);
		await expect(
			normalizeSkillIconProviderSource(source, 'backing', geometryBytes, geometryRoleMaskProfile)
		).rejects.toThrow(/geometry|schema/iu);

		const alpha = await sharp({
			create: { width: 1254, height: 1254, channels: 4, background: '#00ff00' }
		})
			.png({ progressive: false, palette: false })
			.toBuffer();
		await expect(
			normalizeSkillIconProviderSource(
				declareCabx(alpha),
				'backing',
				geometryV2Bytes,
				geometryRoleMaskProfile
			)
		).rejects.toThrow(/RGB|alpha/u);
	}, 20_000);

	it('geometry-first normalization rejects a retained backing with insufficient role coverage', async () => {
		await expect(
			normalizeSkillIconProviderSource(
				await dirtyEdgeBackingSource('<circle cx="627" cy="627" r="48" fill="#292c33"/>'),
				'backing',
				geometryV2Bytes,
				geometryRoleMaskProfile
			)
		).rejects.toThrow(/backing|coverage|role/iu);
	}, 20_000);

	it('geometry-first normalization rejects a retained frame without six-edge registration', async () => {
		await expect(
			normalizeSkillIconProviderSource(
				await dirtyEdgeBackingSource('<circle cx="627" cy="160" r="48" fill="#292c33"/>'),
				'rarity-frame',
				geometryV2Bytes,
				geometryRoleMaskProfile
			)
		).rejects.toThrow(/frame|registration|coverage|role/iu);
	}, 20_000);

	it('applies the complete bounded profile-v2 PNG envelope to profile v3', async () => {
		const base = await providerSource('backing');
		const parsed = pngChunks(declareCabx(base));
		const ihdr = parsed[0]!.bytes;
		const idats = parsed.filter(({ type }) => type === 'IDAT').map(({ bytes }) => bytes);
		const iend = parsed.at(-1)!.bytes;
		const normalizeV3 = (source: Buffer) =>
			normalizeSkillIconProviderSource(
				source,
				'backing',
				geometryV2Bytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V3
			);
		const minimumCabx = Buffer.alloc(8);
		minimumCabx.writeUInt32BE(8, 0);
		minimumCabx.write('jumb', 4, 'ascii');
		await expect(
			normalizeV3(encodePngChunks([ihdr, pngChunk('caBX', minimumCabx), ...idats, iend]))
		).resolves.toMatchObject({
			normalization: {
				profile: SKILL_ICON_NORMALIZATION_PROFILE_V3,
				containerBox: { bytes: 8 },
				colorSpaceDisposition: 'assigned-srgb'
			}
		});
		const maximumCabx = Buffer.alloc(32_768);
		maximumCabx.writeUInt32BE(maximumCabx.length, 0);
		maximumCabx.write('jumb', 4, 'ascii');
		await expect(
			normalizeV3(encodePngChunks([ihdr, pngChunk('caBX', maximumCabx), ...idats, iend]))
		).resolves.toMatchObject({ normalization: { containerBox: { bytes: 32_768 } } });

		const cabx = pngChunk('caBX', cabxData());
		await expect(normalizeV3(encodePngChunks([ihdr, cabx, cabx, ...idats, iend]))).rejects.toThrow(
			/duplicate caBX/u
		);
		await expect(normalizeV3(encodePngChunks([ihdr, ...idats, iend]))).rejects.toThrow(/caBX/u);
		await expect(
			normalizeV3(encodePngChunks([ihdr, cabx, pngChunk('sRGB', Buffer.from([0])), ...idats, iend]))
		).rejects.toThrow(/forbidden sRGB/u);
		const compressedIdat = Buffer.concat(
			parsed.filter(({ type }) => type === 'IDAT').map(({ data }) => data)
		);
		const excessiveIdats = Array.from({ length: 1022 }, (_, index) => {
			const start = Math.floor((compressedIdat.length * index) / 1022);
			const end = Math.floor((compressedIdat.length * (index + 1)) / 1022);
			return pngChunk('IDAT', compressedIdat.subarray(start, end));
		});
		await expect(
			normalizeV3(encodePngChunks([ihdr, cabx, ...excessiveIdats, iend]))
		).rejects.toThrow(/1024-chunk limit/u);
		await expect(
			normalizeV3(Buffer.concat([encodePngChunks([ihdr, cabx, ...idats, iend]), Buffer.from([0])]))
		).rejects.toThrow(/trailing data/u);
	}, 20_000);

	it('rejects cross-profile geometry authorities', async () => {
		const source = declareCabx(await providerSource('backing'));
		await expect(
			normalizeSkillIconProviderSource(
				source,
				'backing',
				geometryV2Bytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V2
			)
		).rejects.toThrow();
		await expect(
			normalizeSkillIconProviderSource(
				source,
				'backing',
				geometryBytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V3
			)
		).rejects.toThrow();
	});

	it('rejects profile-v3 medallion spill and disconnected objects outside the outer envelope', async () => {
		const medallionSpill = await profileV3FrameSource(
			'<rect x="600" y="270" width="54" height="80" fill="#3a3a42"/>'
		);
		await expect(
			normalizeSkillIconProviderSource(
				medallionSpill,
				'rarity-frame',
				geometryV2Bytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V3
			)
		).rejects.toThrow(/required transparent|alpha component/u);

		const disconnectedObject = await profileV3FrameSource(
			'<rect x="30" y="500" width="20" height="20" fill="#3a3a42"/>'
		);
		await expect(
			normalizeSkillIconProviderSource(
				disconnectedObject,
				'rarity-frame',
				geometryV2Bytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V3
			)
		).rejects.toThrow(/required transparent|alpha component/u);
	}, 20_000);

	it('preserves the same three-output-pixel pre-clip halo across v1, v2, and v3', async () => {
		for (const testCase of [
			{
				profile: SKILL_ICON_NORMALIZATION_PROFILE_V1,
				geometry: geometryBytes,
				threePixelSvg: '<rect x="490" y="172" width="20" height="5" fill="#3a3a42"/>',
				beyondSvg: '<rect x="490" y="150" width="20" height="27" fill="#3a3a42"/>',
				source: legacyFrameSource
			},
			{
				profile: SKILL_ICON_NORMALIZATION_PROFILE_V2,
				geometry: geometryBytes,
				threePixelSvg: '<rect x="490" y="172" width="20" height="5" fill="#3a3a42"/>',
				beyondSvg: '<rect x="490" y="150" width="20" height="27" fill="#3a3a42"/>',
				source: async (extraSvg: string): Promise<Buffer> =>
					declareCabx(await legacyFrameSource(extraSvg))
			},
			{
				profile: SKILL_ICON_NORMALIZATION_PROFILE_V3,
				geometry: geometryV2Bytes,
				threePixelSvg: '<rect x="490" y="137" width="20" height="5" fill="#3a3a42"/>',
				beyondSvg: '<rect x="490" y="116" width="20" height="21" fill="#3a3a42"/>',
				source: profileV3FrameSource
			}
		] as const) {
			await expect(
				normalizeSkillIconProviderSource(
					await testCase.source(testCase.threePixelSvg),
					'rarity-frame',
					testCase.geometry,
					testCase.profile
				)
			).resolves.toMatchObject({ normalization: { profile: testCase.profile } });
			await expect(
				normalizeSkillIconProviderSource(
					await testCase.source(testCase.beyondSvg),
					'rarity-frame',
					testCase.geometry,
					testCase.profile
				)
			).rejects.toThrow(/alpha component|alpha mass|required transparent/u);
		}
	}, 20_000);

	it('retains checkerboard rejection under profile v3', async () => {
		const aperture = pointsAttribute(scaledPoints(geometryV2.aperturePoints));
		const checkerSource = async (dark: string, light: string, cellSize = 32): Promise<Buffer> =>
			sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="c" width="${cellSize * 2}" height="${cellSize * 2}" patternUnits="userSpaceOnUse"><rect width="${cellSize * 2}" height="${cellSize * 2}" fill="${light}"/><rect width="${cellSize}" height="${cellSize}" fill="${dark}"/><rect x="${cellSize}" y="${cellSize}" width="${cellSize}" height="${cellSize}" fill="${dark}"/></pattern></defs><polygon points="${aperture}" fill="url(#c)"/></svg>`
						)
					}
				])
				.removeAlpha()
				.png({ progressive: false, palette: false })
				.toBuffer();
		await expect(
			normalizeSkillIconProviderSource(
				declareCabx(await checkerSource('#202020', '#00ff00')),
				'backing',
				geometryV2Bytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V3
			)
		).rejects.toThrow(/checkerboard/u);

		// These two near-green colors differ too little for the RGB contrast gate and
		// therefore exercise the v3 opacity A-B-A detector across arbitrary macro scales.
		for (const cellSize of [24, 48, 76, 92, 100, 112, 144, 160])
			await expect(
				normalizeSkillIconProviderSource(
					declareCabx(await checkerSource('#27ff00', '#19ff00', cellSize)),
					'backing',
					geometryV2Bytes,
					SKILL_ICON_NORMALIZATION_PROFILE_V3
				)
			).rejects.toThrow(/opacity checkerboard/u);
	}, 60_000);

	it('makes v2 decoder and output hashes pixel-sensitive independently of caBX', async () => {
		const original = await providerSource('backing');
		const decoded = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
		const changedPixels = Buffer.from(decoded.data);
		const centerOffset = (627 * decoded.info.width + 627) * 3;
		changedPixels[centerOffset] = (changedPixels[centerOffset] ?? 0) ^ 1;
		const changed = await sharp(changedPixels, {
			raw: { width: decoded.info.width, height: decoded.info.height, channels: 3 }
		})
			.png({ progressive: false, palette: false })
			.toBuffer();
		const first = await normalizeSkillIconProviderSource(
			declareCabx(original),
			'backing',
			geometryBytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V2
		);
		const second = await normalizeSkillIconProviderSource(
			declareCabx(changed),
			'backing',
			geometryBytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V2
		);
		if (
			first.normalization.profile !== SKILL_ICON_NORMALIZATION_PROFILE_V2 ||
			second.normalization.profile !== SKILL_ICON_NORMALIZATION_PROFILE_V2
		)
			throw new Error('Expected v2 normalization evidence');
		expect(first.normalization.decoderInputContentHash).not.toBe(
			second.normalization.decoderInputContentHash
		);
		expect(first.normalization.outputContentHash).not.toBe(second.normalization.outputContentHash);
		expect(first.source.contentHash).not.toBe(second.source.contentHash);
		expect(first.normalization.containerBox.contentHash).toBe(
			second.normalization.containerBox.contentHash
		);
	});

	it('rejects malformed or noncanonical v2 PNG envelopes before decoding', async () => {
		const v1 = await providerSource('backing');
		const valid = declareCabx(v1);
		const parsed = pngChunks(valid);
		const ihdr = parsed[0]!.bytes;
		const cabx = parsed[1]!.bytes;
		const idats = parsed.filter(({ type }) => type === 'IDAT').map(({ bytes }) => bytes);
		const iend = parsed.at(-1)!.bytes;
		const normalizeV2 = (source: Buffer) =>
			normalizeSkillIconProviderSource(
				source,
				'backing',
				geometryBytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V2
			);
		const minimumCabx = Buffer.alloc(8);
		minimumCabx.writeUInt32BE(minimumCabx.length, 0);
		minimumCabx.write('jumb', 4, 'ascii');
		const compressedIdat = Buffer.concat(
			parsed.filter(({ type }) => type === 'IDAT').map(({ data }) => data)
		);
		const exactChunkLimitIdats = Array.from({ length: 1021 }, (_, index) => {
			const start = Math.floor((compressedIdat.length * index) / 1021);
			const end = Math.floor((compressedIdat.length * (index + 1)) / 1021);
			return pngChunk('IDAT', compressedIdat.subarray(start, end));
		});
		await expect(
			normalizeV2(
				encodePngChunks([ihdr, pngChunk('caBX', minimumCabx), ...exactChunkLimitIdats, iend])
			)
		).resolves.toMatchObject({ normalization: { profile: SKILL_ICON_NORMALIZATION_PROFILE_V2 } });
		const maximumCabx = Buffer.alloc(32_768);
		maximumCabx.writeUInt32BE(maximumCabx.length, 0);
		maximumCabx.write('jumb', 4, 'ascii');
		await expect(
			normalizeV2(encodePngChunks([ihdr, pngChunk('caBX', maximumCabx), ...idats, iend]))
		).resolves.toMatchObject({
			normalization: {
				profile: SKILL_ICON_NORMALIZATION_PROFILE_V2,
				containerBox: { bytes: 32_768 }
			}
		});

		await expect(normalizeV2(encodePngChunks([ihdr, cabx, cabx, ...idats, iend]))).rejects.toThrow(
			/duplicate caBX/u
		);
		const sevenByteCabx = Buffer.alloc(7);
		await expect(
			normalizeV2(encodePngChunks([ihdr, pngChunk('caBX', sevenByteCabx), ...idats, iend]))
		).rejects.toThrow(/caBX data length/u);
		await expect(
			normalizeV2(encodePngChunks([ihdr, pngChunk('caBX', Buffer.alloc(0)), ...idats, iend]))
		).rejects.toThrow(/caBX data length/u);
		const oversized = Buffer.alloc(32_769);
		oversized.writeUInt32BE(oversized.length, 0);
		oversized.write('jumb', 4, 'ascii');
		await expect(
			normalizeV2(encodePngChunks([ihdr, pngChunk('caBX', oversized), ...idats, iend]))
		).rejects.toThrow(/caBX data length/u);
		await expect(normalizeV2(encodePngChunks([ihdr, ...idats, cabx, iend]))).rejects.toThrow(
			/caBX immediately after IHDR/u
		);
		await expect(normalizeV2(encodePngChunks([ihdr, ...idats, iend]))).rejects.toThrow(
			/caBX immediately after IHDR|exactly one caBX/u
		);
		const badCrc = Buffer.from(valid);
		const cabxCrcOffset = 8 + ihdr.length + cabx.length - 1;
		badCrc[cabxCrcOffset] = (badCrc[cabxCrcOffset] ?? 0) ^ 1;
		await expect(normalizeV2(badCrc)).rejects.toThrow(/caBX chunk has an invalid CRC/u);
		const wrongLength = cabxData();
		wrongLength.writeUInt32BE(wrongLength.length - 1, 0);
		await expect(
			normalizeV2(encodePngChunks([ihdr, pngChunk('caBX', wrongLength), ...idats, iend]))
		).rejects.toThrow(/embedded length/u);
		const wrongType = cabxData();
		wrongType.write('json', 4, 'ascii');
		await expect(
			normalizeV2(encodePngChunks([ihdr, pngChunk('caBX', wrongType), ...idats, iend]))
		).rejects.toThrow(/ASCII jumb/u);
		const highBitCabx = pngChunkWithTypeBytes(Buffer.from([0xe3, 0x61, 0x42, 0x58]), cabxData());
		await expect(normalizeV2(encodePngChunks([ihdr, highBitCabx, ...idats, iend]))).rejects.toThrow(
			/non-ASCII|invalid chunk type/u
		);
		const highBitIhdr = pngChunkWithTypeBytes(
			Buffer.from([0xc9, 0x48, 0x44, 0x52]),
			parsed[0]!.data
		);
		await expect(normalizeV2(encodePngChunks([highBitIhdr, cabx, ...idats, iend]))).rejects.toThrow(
			/non-ASCII|invalid chunk type/u
		);
		const highBitIdat = pngChunkWithTypeBytes(
			Buffer.from([0xc9, 0x44, 0x41, 0x54]),
			parsed.find(({ type }) => type === 'IDAT')!.data
		);
		await expect(normalizeV2(encodePngChunks([ihdr, cabx, highBitIdat, iend]))).rejects.toThrow(
			/non-ASCII|invalid chunk type/u
		);
		const excessiveIdats = Array.from({ length: 1022 }, (_, index) =>
			index === 1021 ? idats[0]! : pngChunk('IDAT', Buffer.alloc(0))
		);
		await expect(
			normalizeV2(encodePngChunks([ihdr, cabx, ...excessiveIdats, iend]))
		).rejects.toThrow(/1024-chunk limit/u);
		await expect(
			normalizeV2(encodePngChunks([ihdr, cabx, pngChunk('sRGB', Buffer.from([0])), ...idats, iend]))
		).rejects.toThrow(/forbidden sRGB/u);
		await expect(normalizeV2(Buffer.concat([valid, Buffer.from([0])]))).rejects.toThrow(
			/trailing data/u
		);
		const alpha = await sharp(v1).ensureAlpha().png().toBuffer();
		await expect(normalizeV2(declareCabx(alpha))).rejects.toThrow(/RGB|alpha/u);
	}, 15_000);

	it('rejects wrong size, wrong alpha, non-green matte, checkerboards, and gross misregistration', async () => {
		const valid = await providerSource('rarity-frame');
		const jpeg = await sharp(valid).jpeg().toBuffer();
		await expect(
			normalizeSkillIconProviderSource(jpeg, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/PNG/u);
		const wrongSize = declareSrgb(
			await sharp(valid).resize(1200, 1254, { fit: 'fill' }).png().toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(wrongSize, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/1254|square/u);
		const alpha = declareSrgb(await sharp(valid).ensureAlpha().png().toBuffer());
		await expect(
			normalizeSkillIconProviderSource(alpha, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/RGB|alpha/u);
		const gray = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#777777' }
			})
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(gray, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/matte|checkerboard/u);
		const checker = Buffer.alloc(1254 * 1254 * 3);
		for (let y = 0; y < 1254; y += 1) {
			for (let x = 0; x < 1254; x += 1) {
				const value = (Math.floor(x / 32) + Math.floor(y / 32)) % 2 === 0 ? 80 : 190;
				const offset = (y * 1254 + x) * 3;
				checker.fill(value, offset, offset + 3);
			}
		}
		const checkerPng = declareSrgb(
			await sharp(checker, {
				raw: { width: 1254, height: 1254, channels: 3 }
			})
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(checkerPng, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/checkerboard|matte/u);
		const greenBorderChecker = Buffer.alloc(1254 * 1254 * 3);
		for (let offset = 0; offset < greenBorderChecker.length; offset += 3) {
			greenBorderChecker[offset + 1] = 255;
		}
		for (let y = 350; y < 900; y += 1) {
			for (let x = 300; x < 950; x += 1) {
				const color =
					(Math.floor(x / 32) + Math.floor(y / 32)) % 2 === 0
						? ([80, 80, 90] as const)
						: ([190, 190, 200] as const);
				const offset = (y * 1254 + x) * 3;
				greenBorderChecker.set(color, offset);
			}
		}
		const greenBorderCheckerPng = declareSrgb(
			await sharp(greenBorderChecker, {
				raw: { width: 1254, height: 1254, channels: 3 }
			})
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(greenBorderCheckerPng, 'backing', geometryBytes)
		).rejects.toThrow(/checkerboard/u);
		const darkTints = [
			'#302840',
			'#3a3048',
			'#283848',
			'#403038',
			'#2c3440',
			'#44303c',
			'#30384c',
			'#3c2c44',
			'#263c42',
			'#42342c',
			'#343044',
			'#2a3642'
		];
		const lightTints = [
			'#c8bfd8',
			'#d0c8b8',
			'#b8ccd8',
			'#d8c0c8',
			'#c4d0bc',
			'#d4c8dc',
			'#bcc8d4',
			'#d8ccb8',
			'#c0d4cc',
			'#d0c0d8',
			'#c8d4c0',
			'#d4c4c8'
		];
		for (const [cellSize, shadeOffset, swapFamilies] of [
			[24, 3, false],
			[32, 0, false],
			[48, 7, true],
			[64, 1, false],
			[76, 9, true],
			[92, 4, false],
			[96, 11, true],
			[100, 2, false],
			[112, 8, true],
			[128, 5, false],
			[144, 10, true],
			[160, 6, false]
		] as const) {
			let darkIndex = shadeOffset;
			let lightIndex = shadeOffset;
			const multishadeCells: string[] = [];
			for (let cellY = 0; cellY < 12; cellY += 1) {
				for (let cellX = 0; cellX < 12; cellX += 1) {
					const dark = ((cellX + cellY) % 2 === 0) !== swapFamilies;
					const color = dark
						? darkTints[darkIndex++ % darkTints.length]
						: lightTints[lightIndex++ % lightTints.length];
					multishadeCells.push(
						`<rect x="${cellX * cellSize}" y="${cellY * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`
					);
				}
			}
			const patternSize = cellSize * 12;
			const multishadeChecker = declareSrgb(
				await sharp({
					create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
				})
					.composite([
						{
							input: Buffer.from(
								`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="checker" width="${patternSize}" height="${patternSize}" patternUnits="userSpaceOnUse">${multishadeCells.join('')}</pattern></defs><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="url(#checker)"/></svg>`
							)
						}
					])
					.removeAlpha()
					.png()
					.toBuffer()
			);
			await expect(
				normalizeSkillIconProviderSource(multishadeChecker, 'backing', geometryBytes)
			).rejects.toThrow(/periodic contrast checkerboard/u);
			await expect(
				normalizeSkillIconProviderSource(
					declareCabx(multishadeChecker),
					'backing',
					geometryV2Bytes,
					SKILL_ICON_NORMALIZATION_PROFILE_V3
				)
			).rejects.toThrow(/periodic contrast checkerboard/u);
		}
		const blackGreenChecker = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="checker" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#000000"/><rect x="32" y="32" width="32" height="32" fill="#000000"/></pattern></defs><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="url(#checker)"/></svg>'
						)
					}
				])
				.removeAlpha()
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(blackGreenChecker, 'backing', geometryBytes)
		).rejects.toThrow(/checkerboard/u);
		const onePixelBlackGreenChecker = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="checker" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#000000"/><rect x="1" y="1" width="1" height="1" fill="#000000"/></pattern></defs><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="url(#checker)"/></svg>'
						)
					}
				])
				.removeAlpha()
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(onePixelBlackGreenChecker, 'backing', geometryBytes)
		).rejects.toThrow(/checkerboard/u);
		const intermediateAlphaChecker = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="checker" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" fill="#21ff00"/><rect width="32" height="32" fill="#4bff00"/><rect x="32" y="32" width="32" height="32" fill="#4bff00"/></pattern></defs><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="url(#checker)"/></svg>'
						)
					}
				])
				.removeAlpha()
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(intermediateAlphaChecker, 'backing', geometryBytes)
		).rejects.toThrow(/checkerboard/u);
		await expect(
			normalizeSkillIconProviderSource(
				declareCabx(intermediateAlphaChecker),
				'backing',
				geometryV2Bytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V3
			)
		).rejects.toThrow(/checkerboard/u);
		const shifted = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><rect x="350" y="350" width="550" height="550" fill="black"/></svg>'
						)
					}
				])
				.removeAlpha()
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(shifted, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/required transparent/u);
	}, 60_000);

	it('accepts nonalternating materials, a continuous gradient, and role-edge antialiasing', async () => {
		const svg = Buffer.from(
			'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="h"><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372"/></clipPath></defs><g clip-path="url(#h)"><rect width="627" height="1254" fill="#505050"/><rect x="627" width="627" height="1254" fill="#686868"/></g></svg>'
		);
		const source = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([{ input: svg }])
				.removeAlpha()
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(source, 'backing', geometryBytes)
		).resolves.toMatchObject({ source: { mediaType: 'image/png' } });
		const gradientSource = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fade"><stop offset="0" stop-color="#0dff00"/><stop offset="1" stop-color="#5fff00"/></linearGradient></defs><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="url(#fade)"/></svg>'
						)
					}
				])
				.removeAlpha()
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(gradientSource, 'backing', geometryBytes)
		).resolves.toMatchObject({ source: { mediaType: 'image/png' } });
		const antialiasedEdge = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><polygon points="627.4,97.6 1107.3,372.2 1107.2,881.8 627.4,1156.3 146.8,881.8 146.7,372.2" fill="#292c33"/></svg>'
						)
					}
				])
				.removeAlpha()
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(antialiasedEdge, 'backing', geometryBytes)
		).resolves.toMatchObject({ source: { mediaType: 'image/png' } });
	});

	it('rejects alpha mass in forbidden regions even when pixels sit at distance 96', async () => {
		const source = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="#292c33"/><rect x="80" y="100" width="14" height="14" fill="#60ff00"/></svg>'
						)
					}
				])
				.removeAlpha()
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(source, 'backing', geometryBytes)
		).rejects.toThrow(/alpha mass|required transparent/u);
	});

	it('requires one explicit sRGB declaration and rejects metadata and trailing data', async () => {
		const source = await providerSource('backing');
		await expect(
			normalizeSkillIconProviderSource(
				insertPngChunkAfterIhdr(source, 'caBX', cabxData()),
				'backing',
				geometryBytes
			)
		).rejects.toThrow(/forbidden caBX/u);
		await expect(
			normalizeSkillIconProviderSource(removePngChunk(source, 'sRGB'), 'backing', geometryBytes)
		).rejects.toThrow(/undeclared|sRGB/u);
		for (const [type, data] of [
			['gAMA', Buffer.from([0, 0, 177, 143])],
			['cHRM', Buffer.alloc(32)],
			['iCCP', Buffer.from('profile\0\0invalid')],
			['eXIf', Buffer.from('II*\0')]
		] as const) {
			await expect(
				normalizeSkillIconProviderSource(
					insertPngChunkAfterIhdr(source, type, data),
					'backing',
					geometryBytes
				)
			).rejects.toThrow(new RegExp(`forbidden ${type}`, 'u'));
		}
		await expect(
			normalizeSkillIconProviderSource(
				Buffer.concat([source, Buffer.from([0])]),
				'backing',
				geometryBytes
			)
		).rejects.toThrow(/trailing data/u);
		const badCrc = Buffer.from(source);
		badCrc[badCrc.length - 1] = (badCrc[badCrc.length - 1] ?? 0) ^ 1;
		await expect(
			normalizeSkillIconProviderSource(badCrc, 'backing', geometryBytes)
		).rejects.toThrow(/CRC/u);
	});

	it('snapshots source and geometry bytes before queued mutations', async () => {
		const stableSource = await providerSource('backing');
		const baseline = await normalizeSkillIconProviderSource(stableSource, 'backing', geometryBytes);
		const mutableSource = Buffer.from(stableSource);
		const mutableGeometry = Buffer.from(geometryBytes);
		const pending = normalizeSkillIconProviderSource(mutableSource, 'backing', mutableGeometry);
		queueMicrotask(() => {
			mutableSource.fill(0);
			mutableGeometry.fill(0);
		});
		await expect(pending).resolves.toEqual(baseline);

		const stableV2Source = declareCabx(stableSource);
		const v2Baseline = await normalizeSkillIconProviderSource(
			stableV2Source,
			'backing',
			geometryBytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V2
		);
		const mutableV2Source = Buffer.from(stableV2Source);
		const mutableV2Geometry = Buffer.from(geometryBytes);
		const v2Pending = normalizeSkillIconProviderSource(
			mutableV2Source,
			'backing',
			mutableV2Geometry,
			SKILL_ICON_NORMALIZATION_PROFILE_V2
		);
		queueMicrotask(() => {
			mutableV2Source.fill(0);
			mutableV2Geometry.fill(0);
		});
		await expect(v2Pending).resolves.toEqual(v2Baseline);
	});

	it('still rejects a v2 exact-envelope canary with forbidden shadow spill', async () => {
		const canary = await sharp({
			create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
		})
			.composite([
				{
					input: Buffer.from(
						'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="#292c33"/><rect x="80" y="100" width="14" height="14" fill="#60ff00"/></svg>'
					)
				}
			])
			.removeAlpha()
			.png({ progressive: false, palette: false })
			.toBuffer();
		await expect(
			normalizeSkillIconProviderSource(
				declareCabx(canary),
				'backing',
				geometryBytes,
				SKILL_ICON_NORMALIZATION_PROFILE_V2
			)
		).rejects.toThrow(/alpha mass|required transparent/u);
	});

	it('rejects unsupported roles and an all-key degenerate source', async () => {
		const source = await providerSource('backing');
		await expect(
			normalizeSkillIconProviderSource(source, 'skill-art', geometryBytes)
		).rejects.toThrow(/authorized only/u);
		const allGreen = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.png()
				.toBuffer()
		);
		await expect(
			normalizeSkillIconProviderSource(allGreen, 'backing', geometryBytes)
		).rejects.toThrow(/no visible/u);
		await expect(
			normalizeSkillIconProviderSource(
				Buffer.alloc(SKILL_ICON_PROVIDER_MAX_BYTES + 1),
				'backing',
				geometryBytes
			)
		).rejects.toThrow(/byte size/u);
	});

	it('reads one stable O_NOFOLLOW source snapshot and rejects symlinks and mutation races', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-provider-'));
		temporaryRoots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		const source = await providerSource('backing');
		await writeFile(sourcePath, source);
		await expect(readSkillIconProviderSourceOnce(sourcePath)).resolves.toEqual(source);
		const linkPath = path.join(root, 'provider-link.png');
		await symlink(sourcePath, linkPath);
		await expect(readSkillIconProviderSourceOnce(linkPath)).rejects.toThrow(/symbolic link/u);
		await expect(
			readSkillIconProviderSourceOnce(sourcePath, async () => {
				await writeFile(sourcePath, Buffer.concat([source, Buffer.from([0])]));
			})
		).rejects.toThrow(/changed/u);
		await writeFile(sourcePath, source);
		const replacedPath = path.join(root, 'provider-replaced.png');
		await expect(
			readSkillIconProviderSourceOnce(sourcePath, async () => {
				await rename(sourcePath, replacedPath);
				await writeFile(sourcePath, source);
			})
		).rejects.toThrow(/changed/u);
		const fifoPath = path.join(root, 'provider.fifo');
		await execFileAsync('mkfifo', [fifoPath]);
		await expect(readSkillIconProviderSourceOnce(fifoPath)).rejects.toThrow(/regular file/u);
	});
});

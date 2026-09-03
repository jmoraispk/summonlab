import { execFile } from 'node:child_process';
import { readFile, rename, rm, symlink, writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { SkillIconGeometrySchema } from '../packages/contracts/src/index.js';
import {
	normalizeSkillIconProviderSource,
	readSkillIconProviderSourceOnce,
	SKILL_ICON_PROVIDER_MAX_BYTES,
	skillIconGreenKeyAlpha
} from './normalize-skill-icon-provider-source.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

const temporaryRoots: string[] = [];
afterEach(async () =>
	Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
);

const geometryBytes = await readFile('assets/wiki/skills/icon-production-v1/geometry.json');
const geometry = SkillIconGeometrySchema.parse(JSON.parse(geometryBytes.toString('utf8')));
const execFileAsync = promisify(execFile);

function crc32(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
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
		let darkIndex = 0;
		let lightIndex = 0;
		const multishadeCells: string[] = [];
		for (let cellY = 0; cellY < 12; cellY += 1) {
			for (let cellX = 0; cellX < 12; cellX += 1) {
				const dark = (cellX + cellY) % 2 === 0;
				const color = dark
					? darkTints[darkIndex++ % darkTints.length]
					: lightTints[lightIndex++ % lightTints.length];
				multishadeCells.push(
					`<rect x="${cellX * 32}" y="${cellY * 32}" width="32" height="32" fill="${color}"/>`
				);
			}
		}
		const multishadeChecker = declareSrgb(
			await sharp({
				create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
			})
				.composite([
					{
						input: Buffer.from(
							`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="checker" width="384" height="384" patternUnits="userSpaceOnUse">${multishadeCells.join('')}</pattern></defs><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="url(#checker)"/></svg>`
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
		).rejects.toThrow(/opacity checkerboard/u);
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
		).rejects.toThrow(/opacity checkerboard/u);
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
	});

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

import { readFile, rename, rm, symlink, writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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

async function providerSource(role: 'rarity-frame' | 'backing'): Promise<Buffer> {
	const content =
		role === 'rarity-frame'
			? `<path d="M627 98 L1107 372 L1107 882 L627 1156 L147 882 L147 372 Z M627 214 L1001 428 L1001 826 L627 1040 L253 826 L253 428 Z" fill="#3a3a42" fill-rule="evenodd"/><rect x="520" y="0" width="214" height="250" rx="35" fill="#3a3a42"/>`
			: `<polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="#292c33"/>`;
	const svg = Buffer.from(
		`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg">${content}</svg>`
	);
	return sharp({
		create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
	})
		.composite([{ input: svg }])
		.removeAlpha()
		.png({ progressive: false, palette: false })
		.toBuffer();
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

	it('rejects wrong size, wrong alpha, non-green matte, checkerboards, and gross misregistration', async () => {
		const valid = await providerSource('rarity-frame');
		const jpeg = await sharp(valid).jpeg().toBuffer();
		await expect(
			normalizeSkillIconProviderSource(jpeg, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/PNG/u);
		const wrongSize = await sharp(valid).resize(1200, 1254, { fit: 'fill' }).png().toBuffer();
		await expect(
			normalizeSkillIconProviderSource(wrongSize, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/1254|square/u);
		const alpha = await sharp(valid).ensureAlpha().png().toBuffer();
		await expect(
			normalizeSkillIconProviderSource(alpha, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/RGB|alpha/u);
		const gray = await sharp({
			create: { width: 1254, height: 1254, channels: 3, background: '#777777' }
		})
			.png()
			.toBuffer();
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
		const checkerPng = await sharp(checker, {
			raw: { width: 1254, height: 1254, channels: 3 }
		})
			.png()
			.toBuffer();
		await expect(
			normalizeSkillIconProviderSource(checkerPng, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/checkerboard|matte/u);
		const greenBorderChecker = Buffer.alloc(1254 * 1254 * 3);
		for (let offset = 0; offset < greenBorderChecker.length; offset += 3) {
			greenBorderChecker[offset + 1] = 255;
		}
		for (let y = 350; y < 900; y += 1) {
			for (let x = 300; x < 950; x += 1) {
				const value = (Math.floor(x / 32) + Math.floor(y / 32)) % 2 === 0 ? 80 : 190;
				const offset = (y * 1254 + x) * 3;
				greenBorderChecker.fill(value, offset, offset + 3);
			}
		}
		const greenBorderCheckerPng = await sharp(greenBorderChecker, {
			raw: { width: 1254, height: 1254, channels: 3 }
		})
			.png()
			.toBuffer();
		await expect(
			normalizeSkillIconProviderSource(greenBorderCheckerPng, 'backing', geometryBytes)
		).rejects.toThrow(/checkerboard/u);
		const shifted = await sharp({
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
			.toBuffer();
		await expect(
			normalizeSkillIconProviderSource(shifted, 'rarity-frame', geometryBytes)
		).rejects.toThrow(/required transparent/u);
	});

	it('rejects unsupported roles and an all-key degenerate source', async () => {
		const source = await providerSource('backing');
		await expect(
			normalizeSkillIconProviderSource(source, 'skill-art', geometryBytes)
		).rejects.toThrow(/authorized only/u);
		const allGreen = await sharp({
			create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
		})
			.png()
			.toBuffer();
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
	});
});

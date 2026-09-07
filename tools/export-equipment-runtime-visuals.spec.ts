import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';

import type { EquipmentApprovedSourceRecordV1 } from './equipment-approved-source-contract.js';
import {
	EQUIPMENT_EXPORT_PROFILES,
	EQUIPMENT_RUNTIME_MANIFEST_PATH,
	EQUIPMENT_RUNTIME_REVIEW_PATH,
	buildEquipmentRuntimeCatalog,
	checkEquipmentRuntimeCatalog,
	generateEquipmentRuntimeAsset,
	type BuiltEquipmentRuntimeCatalog,
	writeEquipmentRuntimeCatalog
} from './export-equipment-runtime-visuals.js';

const workspaceRoot = resolve(import.meta.dirname, '..');
let built: BuiltEquipmentRuntimeCatalog;
let temporaryRoot: string;

function sha256(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

beforeAll(async () => {
	built = await buildEquipmentRuntimeCatalog(workspaceRoot);
	temporaryRoot = await mkdtemp(resolve(tmpdir(), 'summonlab-equipment-runtime-'));
}, 120_000);

afterAll(async () => {
	if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
});

describe('Equipment runtime visual exporter', () => {
	it('builds exactly 140 lazy bundles and 280 derivatives from approved items only', () => {
		expect(built.manifest.summary).toMatchObject({
			bundleCount: 140,
			assetCount: 280,
			armorSetReferenceCount: 0
		});
		expect(built.generated).toHaveLength(280);
		expect(built.manifest.bundles).toHaveLength(140);
		expect(built.manifest.loading).toEqual({
			catalogLoadPolicy: 'lazy-per-definition',
			includedInInitialPhonePayload: false,
			initialPayloadBytes: 0
		});
		expect(
			built.generated.every(({ record }) =>
				record.sourceApprovedPath.startsWith(
					'assets/equipment/approved/material-equipment-v1/items/'
				)
			)
		).toBe(true);
		expect(
			built.generated.some(({ record }) =>
				record.sourceApprovedPath.includes('armor-set-references')
			)
		).toBe(false);
	});

	it('produces deterministic content-hashed card/detail assets within pixel and byte budgets', () => {
		for (const { record, buffer } of built.generated) {
			const profile = EQUIPMENT_EXPORT_PROFILES.find(({ usage }) => usage === record.usage)!;
			expect(record.width).toBeLessThanOrEqual(profile.boundPixels);
			expect(record.height).toBeLessThanOrEqual(profile.boundPixels);
			expect(record.bytes).toBeLessThanOrEqual(profile.budgetBytes);
			expect(record.contentHash).toBe(sha256(buffer));
			expect(record.file).toContain(`${record.usage}.${record.contentHash.slice(0, 12)}.webp`);
		}
	});

	it('preserves synthetic alpha while stripping metadata from an empty-corner source', async () => {
		const source = built.sourceRecords.find(
			(record): record is Extract<EquipmentApprovedSourceRecordV1, { role: 'item' }> =>
				record.role === 'item'
		)!;
		const transparentSource = await sharp({
			create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
		})
			.composite([
				{
					input: Buffer.from(
						'<svg width="420" height="760"><path d="M210 8 L390 600 L210 752 L30 600 Z" fill="#d8a849"/></svg>'
					),
					left: 302,
					top: 132
				}
			])
			.withMetadata({ exif: { IFD0: { Copyright: 'must be stripped' } } })
			.png()
			.toBuffer();
		const synthetic = {
			...source,
			approved: {
				...source.approved,
				bytes: transparentSource.byteLength,
				sha256: sha256(transparentSource)
			}
		};
		const first = await generateEquipmentRuntimeAsset(
			synthetic,
			transparentSource,
			'a'.repeat(64),
			EQUIPMENT_EXPORT_PROFILES[0]
		);
		const second = await generateEquipmentRuntimeAsset(
			synthetic,
			transparentSource,
			'a'.repeat(64),
			EQUIPMENT_EXPORT_PROFILES[0]
		);
		const metadata = await sharp(first.buffer).metadata();
		expect(first.buffer.equals(second.buffer)).toBe(true);
		expect(metadata.hasAlpha).toBe(true);
		expect(metadata.exif).toBeUndefined();
		expect(first.record.width).toBe(256);
		expect(first.record.bytes).toBeLessThanOrEqual(16_000);
	});

	it('keeps a dense S-rank detail source inside the 512px/64KB profile', async () => {
		const source = built.sourceRecords.find(
			(record): record is Extract<EquipmentApprovedSourceRecordV1, { role: 'item' }> =>
				record.role === 'item' && record.rank === 'S'
		)!;
		const result = await generateEquipmentRuntimeAsset(
			source,
			await readFile(resolve(workspaceRoot, source.approved.path)),
			built.manifest.approvedSource.manifestContentHash,
			EQUIPMENT_EXPORT_PROFILES[1]
		);
		expect(result.record).toMatchObject({ usage: 'detail', width: 512, height: 512 });
		expect(result.record.bytes).toBeLessThanOrEqual(64_000);
	});

	it('rejects any source whose approved hash no longer matches', async () => {
		const source = built.sourceRecords.find(
			(record): record is Extract<EquipmentApprovedSourceRecordV1, { role: 'item' }> =>
				record.role === 'item'
		)!;
		const bytes = await readFile(resolve(workspaceRoot, source.approved.path));
		const changed = Buffer.from(bytes);
		changed[changed.length - 1] ^= 1;
		await expect(
			generateEquipmentRuntimeAsset(
				source,
				changed,
				built.manifest.approvedSource.manifestContentHash,
				EQUIPMENT_EXPORT_PROFILES[0]
			)
		).rejects.toThrow(/source changed/i);
	});

	it('stages a complete catalog, removes stale files, and detects extras or changed bytes', async () => {
		await writeEquipmentRuntimeCatalog(built, temporaryRoot);
		await checkEquipmentRuntimeCatalog(built, temporaryRoot);
		expect(
			JSON.parse(await readFile(resolve(temporaryRoot, EQUIPMENT_RUNTIME_MANIFEST_PATH), 'utf8'))
				.summary.assetCount
		).toBe(280);
		expect(await readFile(resolve(temporaryRoot, EQUIPMENT_RUNTIME_REVIEW_PATH), 'utf8')).toContain(
			'Phone-sized card/detail derivatives'
		);

		const extra = resolve(temporaryRoot, 'apps/web/static/runtime/equipment-v1/stale.webp');
		await writeFile(extra, 'stale');
		await expect(checkEquipmentRuntimeCatalog(built, temporaryRoot)).rejects.toThrow(/unexpected/i);
		await writeEquipmentRuntimeCatalog(built, temporaryRoot);
		await expect(access(extra)).rejects.toThrow();

		const firstAsset = built.generated[0]!;
		await mkdir(resolve(temporaryRoot, 'apps/web/static/runtime/equipment-v1'), {
			recursive: true
		});
		await writeFile(resolve(temporaryRoot, firstAsset.record.file), 'changed');
		await expect(checkEquipmentRuntimeCatalog(built, temporaryRoot)).rejects.toThrow(/stale/i);
		await writeEquipmentRuntimeCatalog(built, temporaryRoot);
		await checkEquipmentRuntimeCatalog(built, temporaryRoot);
		await expect(
			access(resolve(temporaryRoot, 'apps/web/static/runtime/equipment-v1.staging'))
		).rejects.toThrow();
		await expect(
			access(resolve(temporaryRoot, 'apps/web/static/runtime/equipment-v1.backup'))
		).rejects.toThrow();
	}, 120_000);
});

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	WIKI_SKILL_VISUAL_ROOT,
	buildWikiSkillVisualCatalogFromAuthorities,
	checkWikiSkillVisualCatalog,
	writeWikiSkillVisualCatalog
} from './wiki-skill-visual-catalog-lib.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const catalogPath = 'assets/wiki/skills/icon-production-v1/catalog.json';
const massPath = 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
const iconRoot = 'assets/wiki/skills/icon-production-v1/mass-production-v1/icons';

interface Fixture {
	readonly root: string;
	readonly records: {
		targetId: string;
		name: string;
		domain: string;
		family: string;
		rarity: string;
		motifFamily: string;
	}[];
	build(): ReturnType<typeof buildWikiSkillVisualCatalogFromAuthorities>;
	writeAuthorities(): Promise<void>;
}

async function png(
	width = 1024,
	channels: 3 | 4 = 4,
	color: [number, number, number] = [47, 93, 147]
) {
	return sharp({
		create: {
			width,
			height: width,
			channels,
			background: { r: color[0], g: color[1], b: color[2], alpha: 0.5 }
		}
	})
		.png()
		.toBuffer();
}

async function opaqueRgbaPng(): Promise<Buffer> {
	return sharp({
		create: {
			width: 1024,
			height: 1024,
			channels: 4,
			background: { r: 47, g: 93, b: 147, alpha: 1 }
		}
	})
		.png()
		.toBuffer();
}

async function fixture(): Promise<Fixture> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'wiki-skill-visual-catalog-'));
	roots.push(root);
	const records = [
		{
			targetId: 'martial-blade-swordsmanship',
			name: 'Swordsmanship',
			domain: 'Martial',
			family: 'Blade',
			rarity: 'F',
			motifFamily: 'blade-precision'
		},
		{
			targetId: 'magical-elemental-fireball',
			name: 'Fireball',
			domain: 'Magical',
			family: 'Elemental',
			rarity: 'E',
			motifFamily: 'elemental-fire'
		}
	];
	const writeAuthorities = async () => {
		const icons = await Promise.all(
			records.map((record, index) => png(1024, 4, index === 0 ? [47, 93, 147] : [147, 67, 47]))
		);
		await mkdir(path.join(root, iconRoot), { recursive: true });
		await Promise.all(
			icons.map((bytes, index) =>
				writeFile(path.join(root, iconRoot, `${records[index]!.targetId}.png`), bytes)
			)
		);
		const mass = {
			schemaVersion: 'skill-icon-mass-production-manifest-v1',
			completionState: 'complete',
			skills: records.map((record) => ({
				...record,
				slug: record.targetId,
				finalImagePath: `${iconRoot}/${record.targetId}.png`,
				finalImageHash: ''
			}))
		};
		for (const item of mass.skills) {
			item.finalImageHash = hash(await readFile(path.join(root, item.finalImagePath)));
		}
		await mkdir(path.dirname(path.join(root, catalogPath)), { recursive: true });
		await mkdir(path.dirname(path.join(root, massPath)), { recursive: true });
		await writeFile(
			path.join(root, catalogPath),
			JSON.stringify({ schemaVersion: 'skill-icon-catalog-v1', records })
		);
		await writeFile(path.join(root, massPath), JSON.stringify(mass));
	};
	await writeAuthorities();
	return {
		root,
		records,
		writeAuthorities,
		build: () =>
			buildWikiSkillVisualCatalogFromAuthorities({
				workspaceRoot: root,
				catalogPath,
				massManifestPath: massPath,
				expectedSkillCount: 2
			})
	};
}

async function mutateJson(
	root: string,
	relativePath: string,
	mutate: (value: any) => void | Promise<void>
): Promise<void> {
	const value = JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
	await mutate(value);
	await writeFile(path.join(root, relativePath), JSON.stringify(value));
}

describe('wiki skill visual catalog exporter', () => {
	it('creates deterministic, bounded 512px WebP assets from strict paired authorities', async () => {
		const item = await fixture();
		await mutateJson(item.root, catalogPath, (catalog) => {
			catalog.records[0].mapEntryId = catalog.records[0].motifFamily;
			catalog.records[0].motifFamily = null;
		});
		const first = await item.build();
		const second = await item.build();

		expect(first.manifest.schemaVersion).toBe('wiki-skill-visual-catalog-v1');
		expect(first.manifest.summary).toEqual({
			skillCount: 2,
			assetCount: 2,
			totalBytes: expect.any(Number),
			maximumAssetBytes: 133_120
		});
		expect(first.generated).toHaveLength(2);
		expect(first.generated.every(({ record }) => record.width === 512)).toBe(true);
		expect(first.generated.every(({ record }) => record.height === 512)).toBe(true);
		expect(first.generated.every(({ record }) => record.publicPath.endsWith('.webp'))).toBe(true);
		expect(first.generated.map(({ buffer }) => buffer)).toEqual(
			second.generated.map(({ buffer }) => buffer)
		);
		expect(first.manifest).toEqual(second.manifest);
	});

	it('rejects source-hash drift, duplicate or missing IDs, and invalid input image formats', async () => {
		const invalidCatalog = await fixture();
		await mutateJson(invalidCatalog.root, catalogPath, (catalog) => {
			catalog.schemaVersion = 'untrusted-catalog-v1';
		});
		await expect(invalidCatalog.build()).rejects.toThrow(/canonical skill catalog schema/i);

		const sourceDrift = await fixture();
		await writeFile(
			path.join(sourceDrift.root, iconRoot, `${sourceDrift.records[0]!.targetId}.png`),
			await png(1024, 4, [1, 2, 3])
		);
		await expect(sourceDrift.build()).rejects.toThrow(/source hash/i);

		const duplicate = await fixture();
		await mutateJson(duplicate.root, catalogPath, (catalog) =>
			catalog.records.splice(1, 1, catalog.records[0])
		);
		await expect(duplicate.build()).rejects.toThrow(/duplicate/i);

		const missing = await fixture();
		await mutateJson(missing.root, massPath, (mass) => {
			mass.skills[1].targetId = 'craft-forging-missing';
		});
		await expect(missing.build()).rejects.toThrow(/missing/i);

		const wrongDimensions = await fixture();
		await writeFile(
			path.join(wrongDimensions.root, iconRoot, `${wrongDimensions.records[0]!.targetId}.png`),
			await png(1023)
		);
		await mutateJson(wrongDimensions.root, massPath, async (mass) => {
			mass.skills[0].finalImageHash = hash(
				await readFile(path.join(wrongDimensions.root, mass.skills[0].finalImagePath))
			);
		});
		await expect(wrongDimensions.build()).rejects.toThrow(/1024/i);

		const rgb = await fixture();
		await writeFile(
			path.join(rgb.root, iconRoot, `${rgb.records[0]!.targetId}.png`),
			await png(1024, 3)
		);
		await mutateJson(rgb.root, massPath, async (mass) => {
			mass.skills[0].finalImageHash = hash(
				await readFile(path.join(rgb.root, mass.skills[0].finalImagePath))
			);
		});
		await expect(rgb.build()).rejects.toThrow(/rgba|alpha/i);
	});

	it('rejects an opaque RGBA source when its encoded WebP omits alpha', async () => {
		const item = await fixture();
		const sourcePath = path.join(item.root, iconRoot, `${item.records[0]!.targetId}.png`);
		await writeFile(sourcePath, await opaqueRgbaPng());
		await mutateJson(item.root, massPath, async (mass) => {
			mass.skills[0].finalImageHash = hash(await readFile(sourcePath));
		});
		await expect(item.build()).rejects.toThrow(/alpha/i);
	});

	it('rejects a source authority reached through an escaping ancestor symlink', async () => {
		const item = await fixture();
		const externalRoot = await mkdtemp(path.join(os.tmpdir(), 'wiki-skill-visual-catalog-escape-'));
		roots.push(externalRoot);
		await rename(path.join(item.root, 'assets'), path.join(externalRoot, 'assets'));
		await symlink(path.join(externalRoot, 'assets'), path.join(item.root, 'assets'));
		await expect(item.build()).rejects.toThrow(/symbolic link|escapes/i);
	});

	it('rejects a managed runtime parent reached through an escaping ancestor symlink', async () => {
		const item = await fixture();
		const built = await item.build();
		const externalRoot = await mkdtemp(path.join(os.tmpdir(), 'wiki-skill-visual-catalog-escape-'));
		roots.push(externalRoot);
		await mkdir(path.join(externalRoot, 'apps'));
		await symlink(path.join(externalRoot, 'apps'), path.join(item.root, 'apps'));
		await expect(writeWikiSkillVisualCatalog(built, item.root)).rejects.toThrow(
			/symbolic link|escapes/i
		);
	});

	it('writes atomically and detects unexpected, changed, or stale generated output without repair', async () => {
		const item = await fixture();
		const built = await item.build();
		await writeWikiSkillVisualCatalog(built, item.root);
		await checkWikiSkillVisualCatalog(built, item.root);

		const output = path.join(item.root, WIKI_SKILL_VISUAL_ROOT);
		await writeFile(path.join(output, 'unexpected.webp'), 'foreign');
		await expect(checkWikiSkillVisualCatalog(built, item.root)).rejects.toThrow(/unexpected/i);
		await rm(path.join(output, 'unexpected.webp'));
		await writeFile(path.join(output, built.generated[0]!.record.file), 'changed');
		await expect(checkWikiSkillVisualCatalog(built, item.root)).rejects.toThrow(/stale|changed/i);
		await writeWikiSkillVisualCatalog(built, item.root);
		await mutateJson(item.root, `${WIKI_SKILL_VISUAL_ROOT}/manifest.json`, (manifest) => {
			manifest.summary.totalBytes += 1;
		});
		await expect(checkWikiSkillVisualCatalog(built, item.root)).rejects.toThrow(/stale manifest/i);
	});
});

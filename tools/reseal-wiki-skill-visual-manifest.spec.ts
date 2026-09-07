import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	resealWikiSkillVisualAuthorityContents,
	resealWikiSkillVisualManifestContents
} from './reseal-wiki-skill-visual-manifest.js';

describe('wiki skill visual manifest resealing', () => {
	it('recomputes the self-inclusive managed-directory byte total and is idempotent', async () => {
		const manifest = {
			schemaVersion: 'wiki-skill-visual-catalog-v1' as const,
			exporterVersion: 'wiki-skill-visual-catalog-exporter-v1' as const,
			encoder: {
				format: 'webp' as const,
				quality: 86 as const,
				alphaQuality: 100 as const,
				effort: 4 as const,
				smartSubsample: true as const,
				metadata: 'stripped' as const
			},
			sourceAuthorities: {
				catalog: { path: 'catalog.json', contentHash: 'a'.repeat(64) },
				massProductionManifest: { path: 'manifest.json', contentHash: 'b'.repeat(64) }
			},
			records: [],
			summary: {
				skillCount: 0,
				assetCount: 0,
				totalBytes: 123,
				managedDirectoryBytes: 9_999,
				maximumAssetBytes: 133_120 as const,
				maximumManagedDirectoryBytes: 44_040_192 as const
			}
		};
		const source = `${JSON.stringify(manifest, null, '\t')}\n`;

		const resealed = await resealWikiSkillVisualManifestContents(source);
		const value = JSON.parse(resealed) as typeof manifest;

		expect(value.summary.managedDirectoryBytes).toBe(123 + Buffer.byteLength(resealed));
		expect(value.records).toEqual(manifest.records);
		expect(await resealWikiSkillVisualManifestContents(resealed)).toBe(resealed);
	});

	it('binds exact catalog and mass-production bytes through the runtime manifest', async () => {
		const catalogContents = '{"schemaVersion":"skill-icon-catalog-v1","records":[]}\n';
		const massProductionManifestContents = `${JSON.stringify(
			{
				schemaVersion: 'skill-icon-mass-production-manifest-v1',
				authorities: {
					catalog: {
						path: 'assets/wiki/skills/icon-production-v1/catalog.json',
						contentHash: '0'.repeat(64)
					}
				}
			},
			null,
			'\t'
		)}\n`;
		const runtimeManifestContents = `${JSON.stringify(
			{
				schemaVersion: 'wiki-skill-visual-catalog-v1',
				exporterVersion: 'wiki-skill-visual-catalog-exporter-v1',
				encoder: {
					format: 'webp',
					quality: 86,
					alphaQuality: 100,
					effort: 4,
					smartSubsample: true,
					metadata: 'stripped'
				},
				sourceAuthorities: {
					catalog: {
						path: 'assets/wiki/skills/icon-production-v1/catalog.json',
						contentHash: '1'.repeat(64)
					},
					massProductionManifest: {
						path: 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json',
						contentHash: '2'.repeat(64)
					}
				},
				records: [],
				summary: {
					skillCount: 0,
					assetCount: 0,
					totalBytes: 123,
					managedDirectoryBytes: 0,
					maximumAssetBytes: 133_120,
					maximumManagedDirectoryBytes: 44_040_192
				}
			},
			null,
			'\t'
		)}\n`;
		const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

		const resealed = await resealWikiSkillVisualAuthorityContents({
			catalogContents,
			massProductionManifestContents,
			runtimeManifestContents
		});
		const mass = JSON.parse(resealed.massProductionManifestContents);
		const runtime = JSON.parse(resealed.runtimeManifestContents);

		expect(mass.authorities.catalog.contentHash).toBe(sha256(catalogContents));
		expect(runtime.sourceAuthorities.catalog.contentHash).toBe(sha256(catalogContents));
		expect(runtime.sourceAuthorities.massProductionManifest.contentHash).toBe(
			sha256(resealed.massProductionManifestContents)
		);
		expect(runtime.summary.managedDirectoryBytes).toBe(
			runtime.summary.totalBytes + Buffer.byteLength(resealed.runtimeManifestContents)
		);
	});
});

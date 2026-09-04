import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import canonicalCatalogSource from '../../../../../assets/wiki/skills/icon-production-v1/catalog.json';
import canonicalCatalogRaw from '../../../../../assets/wiki/skills/icon-production-v1/catalog.json?raw';
import massProductionManifestSource from '../../../../../assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
import massProductionManifestRaw from '../../../../../assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json?raw';
import runtimeManifestSource from '../../../static/wiki-media/skills/visual-catalog-v1/manifest.json';
import runtimeManifestRaw from '../../../static/wiki-media/skills/visual-catalog-v1/manifest.json?raw';
import {
	buildSkillVisualCatalog,
	getSkillVisualCatalog,
	type SkillVisualCatalogAuthorities
} from './skill-visual-catalog.js';

type TestAuthorities = SkillVisualCatalogAuthorities & {
	canonicalCatalog: typeof canonicalCatalogSource;
	massProductionManifest: typeof massProductionManifestSource;
	runtimeManifest: typeof runtimeManifestSource;
	canonicalCatalogBytes: Uint8Array;
	massProductionManifestBytes: Uint8Array;
	runtimeManifestBytes: Uint8Array;
};

const encoder = new TextEncoder();

function rawBytes(value: unknown): Uint8Array {
	return encoder.encode(`${JSON.stringify(value, null, '\t')}\n`);
}

function hash(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function authorities(): TestAuthorities {
	return {
		canonicalCatalog: structuredClone(canonicalCatalogSource),
		massProductionManifest: structuredClone(massProductionManifestSource),
		runtimeManifest: structuredClone(runtimeManifestSource),
		canonicalCatalogBytes: encoder.encode(canonicalCatalogRaw),
		massProductionManifestBytes: encoder.encode(massProductionManifestRaw),
		runtimeManifestBytes: encoder.encode(runtimeManifestRaw)
	};
}

function encodeRuntimeManifestBytes(input: TestAuthorities): void {
	input.runtimeManifestBytes = rawBytes(input.runtimeManifest);
}

function synchronizeRuntimeManifestBytes(input: TestAuthorities): void {
	const summary = input.runtimeManifest.summary as unknown as {
		totalBytes: number;
		managedDirectoryBytes: number;
	};
	for (let attempt = 0; attempt < 5; attempt += 1) {
		encodeRuntimeManifestBytes(input);
		const expected = summary.totalBytes + input.runtimeManifestBytes.byteLength;
		if (summary.managedDirectoryBytes === expected) return;
		summary.managedDirectoryBytes = expected;
	}
	throw new Error('Test runtime manifest byte total did not converge');
}

function synchronizeSourceAuthorityHashes(input: TestAuthorities): void {
	(input.massProductionManifest.authorities.catalog as { contentHash: string }).contentHash = hash(
		input.canonicalCatalogBytes
	);
	input.massProductionManifestBytes = rawBytes(input.massProductionManifest);
	(input.runtimeManifest.sourceAuthorities.catalog as { contentHash: string }).contentHash = hash(
		input.canonicalCatalogBytes
	);
	(
		input.runtimeManifest.sourceAuthorities.massProductionManifest as { contentHash: string }
	).contentHash = hash(input.massProductionManifestBytes);
	synchronizeRuntimeManifestBytes(input);
}

describe('skill visual catalog', () => {
	it('exposes every canonical skill in canonical order without rarity or rank', () => {
		const records = getSkillVisualCatalog();

		expect(records).toHaveLength(456);
		expect(
			Object.fromEntries(
				(['Martial', 'Magical', 'Craft'] as const).map((domain) => [
					domain,
					records.filter((record) => record.domain === domain).length
				])
			)
		).toEqual({ Martial: 258, Magical: 124, Craft: 74 });
		expect(records[0]).toMatchObject({
			targetId: 'martial:blade:swordsmanship',
			name: 'Swordsmanship',
			domain: 'Martial',
			family: 'Blade',
			labels: [{ namespace: 'Equipment', value: 'Sword' }],
			type: 'Passive',
			acquisition: 'Hold a sword',
			effect: 'Small damage and accuracy bonus with swords. **Foundation — root of the ladder.**',
			motifFamily: 'blade.precision-cut',
			primaryVisualParent: null,
			image: { width: 512, height: 512 },
			provenance: { status: 'candidate' }
		});
		expect(records[0]).not.toHaveProperty('rarity');
		expect(records[0]).not.toHaveProperty('rank');
		expect(Object.isFrozen(records)).toBe(true);
		expect(records[1]?.primaryVisualParent).toEqual({
			targetId: 'martial:blade:swordsmanship',
			name: 'Swordsmanship'
		});
	});

	it('rejects a missing runtime record', () => {
		const input = authorities();
		(input.runtimeManifest.records as unknown[]).pop();
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime.*456|456.*runtime/iu);
	});

	it('rejects a duplicate runtime target ID', () => {
		const input = authorities();
		(input.runtimeManifest.records as unknown[]).push(
			structuredClone(input.runtimeManifest.records[0])
		);
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/duplicate.*runtime target id/iu);
	});

	it('rejects a runtime source hash mismatch', () => {
		const input = authorities();
		(input.runtimeManifest.records[0] as { sourceContentHash: string }).sourceContentHash =
			'0'.repeat(64);
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/source hash/i);
	});

	it('rejects invalid runtime derivative bytes', () => {
		const input = authorities();
		(input.runtimeManifest.records[0] as { bytes: number }).bytes = 0;
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime.*bytes/i);
	});

	it('rejects an invalid runtime derivative content hash', () => {
		const input = authorities();
		(input.runtimeManifest.records[0] as { contentHash: string }).contentHash = '0'.repeat(63);
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime.*content hash/i);
	});

	it('rejects runtime exporter-version drift', () => {
		const input = authorities();
		(input.runtimeManifest as { exporterVersion: string }).exporterVersion =
			'wiki-skill-visual-catalog-exporter-v2';
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime exporter version/i);
	});

	it('rejects a parsed runtime manifest that differs from its raw bytes', () => {
		const input = authorities();
		(input.runtimeManifest as { exporterVersion: string }).exporterVersion =
			'wiki-skill-visual-catalog-exporter-v2';

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime manifest.*raw bytes/i);
	});

	it('rejects runtime encoder-setting drift', () => {
		const input = authorities();
		(input.runtimeManifest.encoder as { quality: number }).quality = 85;
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime encoder quality/i);
	});

	it('rejects runtime summary-count drift', () => {
		const input = authorities();
		(input.runtimeManifest.summary as { skillCount: number }).skillCount = 455;
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime summary skill count/i);
	});

	it('rejects a runtime record-total mismatch', () => {
		const input = authorities();
		(input.runtimeManifest.summary as { totalBytes: number }).totalBytes += 1;
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime total bytes/i);
	});

	it.each(['maximumAssetBytes', 'maximumManagedDirectoryBytes'] as const)(
		'rejects runtime %s limit drift',
		(limit) => {
			const input = authorities();
			(input.runtimeManifest.summary as unknown as Record<typeof limit, number>)[limit] += 1;
			synchronizeRuntimeManifestBytes(input);

			expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime maximum/i);
		}
	);

	it('rejects a runtime managed-directory total mismatch', () => {
		const input = authorities();
		(
			input.runtimeManifest.summary as unknown as { managedDirectoryBytes: number }
		).managedDirectoryBytes += 1;
		encodeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/managed directory bytes/i);
	});

	it('rejects runtime records outside deterministic target order', () => {
		const input = authorities();
		const records = input.runtimeManifest.records as unknown as [unknown, unknown, ...unknown[]];
		[records[0], records[1]] = [records[1], records[0]];
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime record order/i);
	});

	it('rejects a stale runtime source authority hash', () => {
		const input = authorities();
		(
			input.runtimeManifest.sourceAuthorities.massProductionManifest as { contentHash: string }
		).contentHash = '0'.repeat(64);
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime.*source.*hash/i);
	});

	it('rejects parsed authorities that differ from their raw source bytes', () => {
		const input = authorities();
		(input.canonicalCatalog.records[0] as { name: string }).name = 'Changed Swordsmanship';
		(
			input.massProductionManifest.skills.find(
				(record) => record.targetId === input.canonicalCatalog.records[0]?.targetId
			) as { name: string }
		).name = 'Changed Swordsmanship';

		expect(() => buildSkillVisualCatalog(input)).toThrow(/canonical catalog.*raw bytes/i);
	});

	it('rejects rebalanced domain records even when every join and source authority matches', () => {
		const input = authorities();
		(input.canonicalCatalog.records[0] as { domain: string }).domain = 'Magical';
		(
			input.massProductionManifest.skills.find(
				(record) => record.targetId === input.canonicalCatalog.records[0]?.targetId
			) as { domain: string }
		).domain = 'Magical';
		input.canonicalCatalogBytes = rawBytes(input.canonicalCatalog);
		synchronizeSourceAuthorityHashes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/domain.*count/i);
	});

	it('rejects a whitespace-only raw catalog-byte drift', () => {
		const input = authorities();
		input.canonicalCatalogBytes = Uint8Array.from([...input.canonicalCatalogBytes, 0x20]);
		(input.massProductionManifest.authorities.catalog as { contentHash: string }).contentHash =
			hash(input.canonicalCatalogBytes);
		input.massProductionManifestBytes = rawBytes(input.massProductionManifest);
		(
			input.runtimeManifest.sourceAuthorities.massProductionManifest as { contentHash: string }
		).contentHash = hash(input.massProductionManifestBytes);
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/runtime.*catalog.*source hash/i);
	});

	it('rejects an unknown canonical Domain', () => {
		const input = authorities();
		(input.canonicalCatalog.records[0] as { domain: string }).domain = 'Unknown';
		input.canonicalCatalogBytes = rawBytes(input.canonicalCatalog);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/domain/i);
	});

	it('rejects an unknown canonical type', () => {
		const input = authorities();
		(input.canonicalCatalog.records[0] as { type: string }).type = 'Unknown';
		input.canonicalCatalogBytes = rawBytes(input.canonicalCatalog);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/type/i);
	});

	it('rejects an unknown canonical label namespace', () => {
		const input = authorities();
		(input.canonicalCatalog.records[0]!.labels[0] as { namespace: string }).namespace = 'Unknown';
		input.canonicalCatalogBytes = rawBytes(input.canonicalCatalog);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/label namespace/i);
	});

	it('rejects an unresolved primary visual parent', () => {
		const input = authorities();
		(input.canonicalCatalog.records[0] as { primaryVisualParent: string }).primaryVisualParent =
			'martial:blade:missing-parent';
		(
			input.massProductionManifest.skills[0] as { primaryVisualParent: string }
		).primaryVisualParent = 'martial:blade:missing-parent';
		input.canonicalCatalogBytes = rawBytes(input.canonicalCatalog);
		synchronizeSourceAuthorityHashes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/primary visual parent/i);
	});

	it('rejects a runtime public path outside the managed icon root', () => {
		const input = authorities();
		(input.runtimeManifest.records[0] as { publicPath: string }).publicPath =
			'/wiki-media/other.webp';
		synchronizeRuntimeManifestBytes(input);

		expect(() => buildSkillVisualCatalog(input)).toThrow(/public path/i);
	});
});

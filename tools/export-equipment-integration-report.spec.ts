import { describe, expect, it } from 'vitest';

import {
	EQUIPMENT_INTEGRATION_COMMITS,
	EquipmentIntegrationReportV1Schema,
	buildEquipmentIntegrationReport
} from './export-equipment-integration-report.js';

const HASH = 'a'.repeat(64);

function fixtureInput() {
	return {
		approvedManifest: {
			schemaVersion: 'equipment-approved-source-manifest-v1' as const,
			catalogId: 'material-equipment-v1' as const,
			summary: { total: 161, items: 140, armorSetReferences: 21, totalBytes: 1 }
		},
		approvedManifestByteSha256: HASH,
		approvedManifestCanonicalSha256: 'b'.repeat(64),
		runtimeManifest: {
			schemaVersion: 'equipment-runtime-visual-manifest-v1' as const,
			catalogVersion: 'equipment-v1' as const,
			manifestHash: 'c'.repeat(64),
			summary: {
				bundleCount: 140,
				assetCount: 280,
				armorSetReferenceCount: 0,
				cardBytes: 2,
				detailBytes: 3,
				totalBytes: 5
			}
		},
		runtimeManifestByteSha256: 'd'.repeat(64),
		content: {
			contentVersion: 'equipment-content-v1',
			contentHash: 'e'.repeat(64),
			definitionCount: 140,
			approvedItemCount: 140,
			approvedReferenceCount: 21,
			runtimeBundleCount: 140,
			runtimeAssetCount: 280,
			status: 'valid' as const
		},
		evidenceHashes: {
			runtimeGallery: 'f'.repeat(64),
			phoneAssay: '1'.repeat(64),
			phoneLoadout: '2'.repeat(64)
		},
		commits: EQUIPMENT_INTEGRATION_COMMITS
	};
}

describe('equipment integration report', () => {
	it('summarizes the complete approved, runtime, content, and engine integration', () => {
		const report = buildEquipmentIntegrationReport(fixtureInput());

		expect(EquipmentIntegrationReportV1Schema.parse(report)).toStrictEqual(report);
		expect(report.counts).toStrictEqual({
			approvedSources: 161,
			equippableSources: 140,
			armorSetReferences: 21,
			runtimeBundles: 140,
			runtimeAssets: 280,
			contentDefinitions: 140
		});
		expect(report.runtime.engineVersion).toBe('engine-v24');
		expect(report.runtime.forging.enabledCraftsmanship).toStrictEqual(['standard']);
		expect(report.commits.reportedThroughCommit).toBe('057bf9235d1e92f432fcb246df4a1b293912cb0d');
		expect(report.closeout.commitHash).toBeNull();
		expect(report.noImageGeneration.approvedBytesEqualSelectedCandidateBytes).toBe(true);
	});

	it('is strict and rejects a report with an undocumented field', () => {
		const report = buildEquipmentIntegrationReport(fixtureInput());
		expect(
			EquipmentIntegrationReportV1Schema.safeParse({ ...report, task9CommitHash: HASH }).success
		).toBe(false);
	});

	it('rejects drift in the exact Task 1–8 commit ledger', () => {
		const report = buildEquipmentIntegrationReport(fixtureInput());
		const entries = structuredClone(report.commits.entries);
		entries[0]!.subject = 'feat(equipment): drifted evidence';

		expect(
			EquipmentIntegrationReportV1Schema.safeParse({
				...report,
				commits: { ...report.commits, entries }
			}).success
		).toBe(false);
	});

	it('rejects count drift before producing a closeout artifact', () => {
		const input = fixtureInput();
		expect(() =>
			buildEquipmentIntegrationReport({
				...input,
				approvedManifest: {
					...input.approvedManifest,
					summary: { ...input.approvedManifest.summary, items: 139 }
				}
			})
		).toThrow(/approved Equipment counts/u);
	});
});

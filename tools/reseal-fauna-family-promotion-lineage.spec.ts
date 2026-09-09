import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	FAUNA_PROMOTION_LINEAGE_PATHS,
	resealFaunaApprovedProvenanceRecords,
	resealFaunaFamilyPromotionLineageDocuments
} from './reseal-fauna-family-promotion-lineage.js';
import { familyAffinitySha256 } from './family-affinity-production-lib.js';

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

describe('fauna promotion lineage resealing', () => {
	it('reseals every approved target, assignment, and provenance record', () => {
		const targetPath = 'assets/enemies/experiments/fauna-family-v1/targets/example.json';
		const assignmentPath = 'assets/enemies/experiments/fauna-family-v1/assignments/example.json';
		const provenancePath = 'assets/enemies/experiments/fauna-family-v1/results/example.json';
		const target = '{"coordinateId":"wolves/example/normal","value":1}\n';
		const assignment = '{"coordinateId":"wolves/example/normal","value":2}\n';
		const provenance = '{"coordinateId":"wolves/example/normal","value":3}\n';
		const approved = `${JSON.stringify({
			records: [
				{
					assignment: { path: assignmentPath, sha256: '1'.repeat(64) },
					provenance: { path: provenancePath, sha256: '2'.repeat(64) },
					target: { path: targetPath, sha256: '3'.repeat(64) }
				}
			],
			schemaVersion: 'fauna-family-approved-manifest-v1'
		})}\n`;

		const result = JSON.parse(
			resealFaunaApprovedProvenanceRecords(
				approved,
				new Map([
					[targetPath, target],
					[assignmentPath, assignment],
					[provenancePath, provenance]
				])
			)
		) as {
			records: {
				assignment: { sha256: string };
				provenance: { sha256: string };
				target: { sha256: string };
			}[];
		};
		expect(result.records[0]).toMatchObject({
			assignment: { sha256: familyAffinitySha256(JSON.parse(assignment)) },
			provenance: { sha256: sha256(provenance) },
			target: { sha256: familyAffinitySha256(JSON.parse(target)) }
		});
	});

	it('reseals the approved and runtime chain after a migrated source inventory changes', () => {
		const inventory = '{"palette":"gray"}\n';
		const sourceManifest = '{"schemaVersion":"fauna-family-production-manifest-v1"}\n';
		const approvedManifest = `${JSON.stringify({
			catalogId: 'fauna-family-v1',
			records: [],
			schemaVersion: 'fauna-family-approved-manifest-v1',
			source: {
				inventoryPath: FAUNA_PROMOTION_LINEAGE_PATHS.inventory,
				inventorySha256: '0'.repeat(64),
				manifestPath: FAUNA_PROMOTION_LINEAGE_PATHS.sourceManifest,
				manifestSha256: '1'.repeat(64)
			}
		})}\n`;
		const ownerApproval = `${JSON.stringify({
			approvedManifest: {
				path: FAUNA_PROMOTION_LINEAGE_PATHS.approvedManifest,
				sha256: '2'.repeat(64)
			},
			schemaVersion: 'fauna-family-owner-approval-receipt-v1'
		})}\n`;
		const runtimeCatalog = `${JSON.stringify({
			approvedManifest: {
				path: FAUNA_PROMOTION_LINEAGE_PATHS.approvedManifest,
				sha256: '3'.repeat(64)
			},
			ownerApproval: {
				path: FAUNA_PROMOTION_LINEAGE_PATHS.ownerApproval,
				sha256: '4'.repeat(64)
			},
			schemaVersion: 'fauna-family-runtime-catalog-v1'
		})}\n`;
		const runtimeReceipt = `${JSON.stringify({
			approvedManifest: {
				path: FAUNA_PROMOTION_LINEAGE_PATHS.approvedManifest,
				sha256: '5'.repeat(64)
			},
			ownerApproval: {
				path: FAUNA_PROMOTION_LINEAGE_PATHS.ownerApproval,
				sha256: '6'.repeat(64)
			},
			runtimeCatalog: {
				path: FAUNA_PROMOTION_LINEAGE_PATHS.runtimeCatalog,
				sha256: '7'.repeat(64)
			},
			schemaVersion: 'fauna-family-runtime-promotion-receipt-v1'
		})}\n`;

		const result = resealFaunaFamilyPromotionLineageDocuments({
			inventory,
			sourceManifest,
			approvedManifest,
			ownerApproval,
			runtimeCatalog,
			runtimeReceipt
		});
		const approved = JSON.parse(result.approvedManifest) as {
			source: { inventorySha256: string; manifestSha256: string };
		};
		const approval = JSON.parse(result.ownerApproval) as {
			approvedManifest: { sha256: string };
		};
		const catalog = JSON.parse(result.runtimeCatalog) as {
			approvedManifest: { sha256: string };
			ownerApproval: { sha256: string };
		};
		const receipt = JSON.parse(result.runtimeReceipt) as {
			approvedManifest: { sha256: string };
			ownerApproval: { sha256: string };
			runtimeCatalog: { sha256: string };
		};

		expect(approved.source).toEqual({
			inventoryPath: FAUNA_PROMOTION_LINEAGE_PATHS.inventory,
			inventorySha256: sha256(inventory),
			manifestPath: FAUNA_PROMOTION_LINEAGE_PATHS.sourceManifest,
			manifestSha256: sha256(sourceManifest)
		});
		expect(approval.approvedManifest.sha256).toBe(sha256(result.approvedManifest));
		expect(catalog.approvedManifest.sha256).toBe(sha256(result.approvedManifest));
		expect(catalog.ownerApproval.sha256).toBe(sha256(result.ownerApproval));
		expect(receipt.approvedManifest.sha256).toBe(sha256(result.approvedManifest));
		expect(receipt.ownerApproval.sha256).toBe(sha256(result.ownerApproval));
		expect(receipt.runtimeCatalog.sha256).toBe(sha256(result.runtimeCatalog));
	});
});

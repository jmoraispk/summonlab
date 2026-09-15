import { describe, expect, it } from 'vitest';

import {
	EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256,
	EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256,
	EquipmentApprovedPromotionPlanV1Schema,
	EquipmentApprovedPromotionReceiptV1Schema,
	EquipmentApprovedSourceManifestV1Schema,
	EquipmentApprovedSourceRecordV1Schema
} from './equipment-approved-source-contract.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function itemRecord(index = 0) {
	return {
		schemaVersion: 'equipment-approved-source-record-v1',
		assetKey: `equipment-v1-f-bronze-sword-${index}`,
		role: 'item',
		targetId: `material-equipment-v3-bronze-sword-${index}-v3`,
		rank: 'F',
		materialId: 'bronze',
		equipmentClass: 'sword',
		artifactId: `sword-${index}`,
		slot: null,
		candidate: {
			path: `assets/equipment/experiments/material-equipment-v3/candidates/f/bronze/sword-${index}.png`,
			sha256: HASH_A
		},
		checkpoint: {
			path: 'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-2-roots.json',
			canonicalSha256: HASH_B
		},
		approvedPath: `assets/equipment/approved/material-equipment-v1/items/f/bronze/sword-${index}.png`,
		approved: {
			path: `assets/equipment/approved/material-equipment-v1/items/f/bronze/sword-${index}.png`,
			width: 1024,
			height: 1024,
			bytes: 123,
			sha256: HASH_A
		}
	} as const;
}

function referenceRecord(index = 0) {
	return {
		...itemRecord(index),
		assetKey: `equipment-v1-f-bronze-heavy-armor-set-reference-${index}`,
		role: 'armor-set-reference',
		targetId: `material-equipment-v3-bronze-heavy-armor-full-set-${index}-v3`,
		materialId: `bronze-${index}`,
		equipmentClass: 'heavy-armor',
		artifactId: `heavy-armor-full-set-${index}`,
		candidate: {
			path: `assets/equipment/experiments/material-equipment-v3/candidates/f/bronze/heavy-armor-full-set-${index}.png`,
			sha256: HASH_A
		},
		approvedPath: `assets/equipment/approved/material-equipment-v1/armor-set-references/f/bronze-${index}/heavy-armor.png`,
		approved: {
			path: `assets/equipment/approved/material-equipment-v1/armor-set-references/f/bronze-${index}/heavy-armor.png`,
			width: 1024,
			height: 1536,
			bytes: 456,
			sha256: HASH_A
		}
	} as const;
}

function entries() {
	return [
		...Array.from({ length: 140 }, (_, index) => itemRecord(index)),
		...Array.from({ length: 21 }, (_, index) => referenceRecord(index))
	];
}

function plan() {
	const records = entries();
	return {
		schemaVersion: 'equipment-approved-promotion-plan-v1',
		planId: 'material-equipment-v1-approved-promotion-v1',
		authorization: {
			design: {
				path: 'docs/superpowers/specs/2026-09-03-equipment-promotion-runtime-integration-design.md',
				sha256: EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256
			},
			implementationPlan: {
				path: 'docs/superpowers/plans/2026-09-03-equipment-promotion-runtime-integration.md',
				sha256: EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256
			},
			approvalCommit: '46cd7e715e327e26ecd89829ad6826d8aaf7adf9'
		},
		sourceProposal: {
			path: 'assets/equipment/experiments/material-equipment-v3/reviews/proposed-promotions/candidate-promotion-v1.json',
			canonicalSha256: HASH_A
		},
		sourceManifest: {
			path: 'assets/equipment/experiments/material-equipment-v3/manifest.json',
			canonicalSha256: HASH_B
		},
		checkpoints: {
			directions: {
				path: 'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-1-directions.json',
				canonicalSha256: HASH_B
			},
			roots: {
				path: 'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-2-roots.json',
				canonicalSha256: HASH_A
			},
			armorPieces: {
				path: 'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-3-armor-pieces.json',
				canonicalSha256: HASH_B
			}
		},
		summary: {
			total: 161,
			items: 140,
			armorSetReferences: 21,
			totalBytes: records.reduce((total, record) => total + record.approved.bytes, 0)
		},
		entries: records
	};
}

describe('Equipment approved-source contracts', () => {
	it('uses strict, versioned records and rejects unknown fields', () => {
		expect(EquipmentApprovedSourceRecordV1Schema.parse(itemRecord()).schemaVersion).toBe(
			'equipment-approved-source-record-v1'
		);
		expect(() =>
			EquipmentApprovedSourceRecordV1Schema.parse({ ...itemRecord(), surprise: true })
		).toThrow();
	});

	it('rejects unsafe source and approved paths', () => {
		expect(() =>
			EquipmentApprovedSourceRecordV1Schema.parse({
				...itemRecord(),
				candidate: { ...itemRecord().candidate, path: '../candidate.png' }
			})
		).toThrow();
		expect(() =>
			EquipmentApprovedSourceRecordV1Schema.parse({
				...itemRecord(),
				approved: { ...itemRecord().approved, path: 'assets/equipment/runtime/sword.png' }
			})
		).toThrow();
	});

	it('rejects malformed hashes and candidate/approved hash mismatch', () => {
		expect(() =>
			EquipmentApprovedSourceRecordV1Schema.parse({
				...itemRecord(),
				candidate: { ...itemRecord().candidate, sha256: 'not-a-hash' }
			})
		).toThrow();
		expect(() =>
			EquipmentApprovedSourceRecordV1Schema.parse({
				...itemRecord(),
				approved: { ...itemRecord().approved, sha256: HASH_B }
			})
		).toThrow(/hash/i);
	});

	it('rejects dimensions that do not match the approved role', () => {
		expect(() =>
			EquipmentApprovedSourceRecordV1Schema.parse({
				...itemRecord(),
				approved: { ...itemRecord().approved, height: 1536 }
			})
		).toThrow();
		expect(() =>
			EquipmentApprovedSourceRecordV1Schema.parse({
				...referenceRecord(),
				approved: { ...referenceRecord().approved, height: 1024 }
			})
		).toThrow();
	});

	it('rejects duplicate asset keys and role-count drift', () => {
		const duplicate = plan();
		const duplicateEntries = duplicate.entries as unknown as Array<{ assetKey: string }>;
		duplicateEntries[1]!.assetKey = duplicateEntries[0]!.assetKey;
		expect(() => EquipmentApprovedPromotionPlanV1Schema.parse(duplicate)).toThrow(/asset key/i);

		const drifted = plan();
		drifted.entries = drifted.entries.slice(0, -1);
		expect(() => EquipmentApprovedPromotionPlanV1Schema.parse(drifted)).toThrow();
	});

	it('requires manifest summaries to match all 161 records', () => {
		const promotionPlan = plan();
		const manifest = {
			schemaVersion: 'equipment-approved-source-manifest-v1',
			catalogId: 'material-equipment-v1',
			createdAt: '2026-09-03T21:00:00.000Z',
			createdBy: 'summonlab-owner',
			sourceProposal: promotionPlan.sourceProposal,
			sourceManifest: promotionPlan.sourceManifest,
			summary: promotionPlan.summary,
			records: promotionPlan.entries
		};
		expect(EquipmentApprovedSourceManifestV1Schema.parse(manifest).records).toHaveLength(161);
		expect(() =>
			EquipmentApprovedSourceManifestV1Schema.parse({
				...manifest,
				summary: { ...manifest.summary, items: 139 }
			})
		).toThrow(/summary/i);
	});

	it('requires the versioned receipt to bind authorization, all checkpoints, and the manifest', () => {
		const promotionPlan = plan();
		const receipt = {
			schemaVersion: 'equipment-approved-promotion-receipt-v1',
			receiptId: 'material-equipment-v1-approved-promotion-v1',
			createdAt: '2026-09-03T21:00:00.000Z',
			createdBy: 'summonlab-owner',
			toolVersion: 'equipment-approved-promotion-v1',
			authorization: promotionPlan.authorization,
			repository: {
				branch: 'codex/equipment-promotion-integration',
				basisCommit: '1'.repeat(40)
			},
			planCanonicalSha256: HASH_A,
			approvedManifest: {
				path: 'assets/equipment/approved/material-equipment-v1/manifest.json',
				canonicalSha256: HASH_B
			},
			sourceProposal: promotionPlan.sourceProposal,
			checkpoints: promotionPlan.checkpoints,
			summary: promotionPlan.summary
		};
		expect(EquipmentApprovedPromotionReceiptV1Schema.parse(receipt).schemaVersion).toBe(
			'equipment-approved-promotion-receipt-v1'
		);
		expect(() =>
			EquipmentApprovedPromotionReceiptV1Schema.parse({ ...receipt, unknown: true })
		).toThrow();
	});
});

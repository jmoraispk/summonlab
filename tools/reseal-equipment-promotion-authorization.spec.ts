import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	projectEquipmentPromotionBuildInputs,
	resealEquipmentPromotionAuthorizationFixture,
	resealEquipmentPromotionAuthorizationConstants,
	resealEquipmentPromotionAuthorizationReceipt
} from './reseal-equipment-promotion-authorization.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('equipment promotion authorization resealing', () => {
	it('derives promotion test fixture authorization from the canonical contract constants', () => {
		const previous = {
			designSha256: 'a'.repeat(64),
			planSha256: 'b'.repeat(64)
		};
		const fixture = [
			'import {',
			'\tEquipmentApprovedPromotionPlanV1Schema',
			"} from './equipment-approved-source-contract.js';",
			"path: 'docs/superpowers/specs/2026-09-03-equipment-promotion-runtime-integration-design.md',",
			`\tsha256: '${previous.designSha256}'`,
			"path: 'docs/superpowers/plans/2026-09-03-equipment-promotion-runtime-integration.md',",
			`\tsha256: '${previous.planSha256}'`,
			''
		].join('\n');

		const resealed = resealEquipmentPromotionAuthorizationFixture(fixture, previous);
		expect(resealed).toContain('EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256,');
		expect(resealed).toContain('EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256,');
		expect(resealed).toContain('sha256: EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256');
		expect(resealed).toContain('sha256: EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256');
		expect(resealed).not.toContain(previous.designSha256);
		expect(resealed).not.toContain(previous.planSha256);
	});

	it('projects the manifest and checkpoint chain before rebuilding the promotion plan', () => {
		const projected = projectEquipmentPromotionBuildInputs({
			manifest: { schemaVersion: 'manifest', targets: [{ id: 'current' }] },
			proposal: {
				checkpoint3: { path: 'checkpoint-3.json', canonicalSha256: '0'.repeat(64) }
			},
			checkpoints: [
				{ checkpointId: 'one', manifestCanonicalSha256: '1'.repeat(64) },
				{ checkpointId: 'two', manifestCanonicalSha256: '1'.repeat(64) },
				{ checkpointId: 'three', manifestCanonicalSha256: '1'.repeat(64) }
			]
		});
		expect(
			new Set(projected.checkpoints.map(({ manifestCanonicalSha256 }) => manifestCanonicalSha256))
		).toHaveLength(1);
		expect(
			(projected.proposal.checkpoint3 as { canonicalSha256: string }).canonicalSha256
		).not.toBe('0'.repeat(64));
	});

	it('reseals migrated authorization documents through the contract and receipt lineage', () => {
		const previousDesign = sha256('previous design');
		const currentDesignContents = 'current design';
		const currentDesign = sha256(currentDesignContents);
		const planContents = 'stable plan';
		const plan = sha256(planContents);
		const contract = [
			`export const EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256 = '${previousDesign}' as const;`,
			`export const EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256 = '${plan}' as const;`,
			''
		].join('\n');

		const resealed = resealEquipmentPromotionAuthorizationConstants({
			contract,
			designContents: currentDesignContents,
			planContents
		});
		expect(resealed.changed).toBe(true);
		expect(resealed.contract).toContain(currentDesign);
		expect(resealed.contract).not.toContain(previousDesign);
		expect(resealed.previous).toEqual({ designSha256: previousDesign, planSha256: plan });
		expect(resealed.current).toEqual({ designSha256: currentDesign, planSha256: plan });

		const receipt = resealEquipmentPromotionAuthorizationReceipt({
			receipt: {
				authorization: {
					design: { path: 'design.md', sha256: previousDesign },
					implementationPlan: { path: 'plan.md', sha256: plan },
					approvalCommit: 'approved'
				},
				planCanonicalSha256: previousDesign,
				approvedManifest: { path: 'manifest.json', canonicalSha256: previousDesign }
			},
			previous: resealed.previous,
			promotionPlan: {
				authorization: {
					design: { path: 'design.md', sha256: currentDesign },
					implementationPlan: { path: 'plan.md', sha256: plan },
					approvalCommit: 'approved'
				},
				sourceProposal: { path: 'proposal.json', canonicalSha256: currentDesign },
				checkpoints: { directions: currentDesign },
				summary: { total: 1 }
			},
			promotionPlanSha256: plan,
			manifestCanonicalSha256: currentDesign
		});
		expect(receipt.authorization).toEqual({
			design: { path: 'design.md', sha256: currentDesign },
			implementationPlan: { path: 'plan.md', sha256: plan },
			approvalCommit: 'approved'
		});
		expect(receipt.planCanonicalSha256).toBe(plan);
		expect(receipt.approvedManifest).toEqual({
			path: 'manifest.json',
			canonicalSha256: currentDesign
		});
	});

	it('rejects a receipt that is not bound to the constant preimage', () => {
		expect(() =>
			resealEquipmentPromotionAuthorizationReceipt({
				receipt: {
					authorization: {
						design: { sha256: '0'.repeat(64) },
						implementationPlan: { sha256: '1'.repeat(64) }
					}
				},
				previous: { designSha256: '2'.repeat(64), planSha256: '1'.repeat(64) },
				promotionPlan: {},
				promotionPlanSha256: '3'.repeat(64),
				manifestCanonicalSha256: '4'.repeat(64)
			})
		).toThrow(/preimage/iu);
	});
});

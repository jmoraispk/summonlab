import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { EquipmentV2ArmourSourceReviewReceipt } from './equipment-image-production-contract-v2.js';
import {
	EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
	buildEquipmentV2ProfileAcceptance,
	canonicalJsonSha256V2
} from './equipment-image-profile-acceptance-v2.js';
import { buildEquipmentVisualProfileV2 } from './equipment-image-profile-v2.js';
import {
	assessEquipmentV2ContractReadiness,
	buildDependentArmourPacketsV2,
	buildRootEquipmentPacketsV2,
	renderEquipmentPromptV2,
	validateEquipmentPacketV2,
	validateEquipmentResultV2
} from './equipment-image-packets-v2.js';
import {
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';

function fixture() {
	const manifest = buildEquipmentMaterialProductionManifestV2();
	const allocation = buildEquipmentMaterialAllocationPlanV2();
	const profile = buildEquipmentVisualProfileV2();
	const acceptance = buildEquipmentV2ProfileAcceptance({
		profile,
		acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
	});
	return { manifest, allocation, profile, acceptance };
}

describe('Equipment v2 deterministic packets', () => {
	it('builds 77 collision-safe root pairs with exact class-scoped references', () => {
		const sources = fixture();
		const packets = buildRootEquipmentPacketsV2(sources);
		expect(packets).toHaveLength(77);
		expect(
			new Set(
				packets.flatMap(({ targetPath, assignmentPath, target }) => [
					targetPath,
					assignmentPath,
					target.output.candidatePath,
					target.output.provenanceResultPath
				])
			).size
		).toBe(308);
		const bronzeSword = packets[0]!;
		expect(bronzeSword).toMatchObject({
			targetPath:
				'assets/equipment/experiments/material-equipment-v2/targets/f/bronze/sword-v2.json',
			assignmentPath:
				'assets/equipment/experiments/material-equipment-v2/assignments/f/bronze/sword-v2.json',
			target: {
				targetId: 'material-equipment-v2-bronze-sword-v2',
				material: { id: 'bronze', name: 'Bronze', rank: 'F' },
				classDirection: { anchorReferenceId: 'sword-pose' },
				presentation: {
					mode: 'isolated-item',
					framing: {
						compositionTargetPercent: 8,
						hardMinimumPercent: 5,
						priority: 'pose-consistency-over-margin-above-hard-minimum'
					}
				},
				references: [
					{ referenceId: 'remy-finish-style', usage: 'style-only' },
					{ referenceId: 'sword-pose', usage: 'pose-only' }
				]
			},
			assignment: { runActivationRequired: true }
		});

		const expectedAnchorByClass = {
			sword: 'sword-pose',
			dagger: 'dagger-pose',
			spear: 'spear-pose',
			bow: 'bow-pose',
			axe: 'axe-pose',
			mace: 'mace-pose',
			shield: 'shield-pose',
			staff: 'staff-pose'
		} as const;
		const weaponTargets = packets
			.map(({ target }) => target)
			.filter(({ equipment }) => equipment.class in expectedAnchorByClass);
		expect(weaponTargets).toHaveLength(56);
		for (const target of weaponTargets) {
			const equipmentClass = target.equipment.class as keyof typeof expectedAnchorByClass;
			expect(target.classDirection.anchorReferenceId).toBe(expectedAnchorByClass[equipmentClass]);
			expect(target.references).toHaveLength(2);
			expect(target.references.map(({ referenceId }) => referenceId)).toEqual([
				'remy-finish-style',
				expectedAnchorByClass[equipmentClass]
			]);
			expect(target.references.map(({ usage }) => usage)).toEqual(['style-only', 'pose-only']);
		}
	});

	it('routes only style and camera references to every empty full-set root', () => {
		const packets = buildRootEquipmentPacketsV2(fixture());
		const armourTargets = packets
			.map(({ target }) => target)
			.filter(({ equipment }) =>
				['heavy-armour', 'light-armour', 'robes'].includes(equipment.class)
			);
		expect(armourTargets).toHaveLength(21);
		for (const target of armourTargets) {
			expect(target.references.map(({ referenceId }) => referenceId)).toEqual([
				'remy-finish-style',
				'coarse-hide-armour-camera'
			]);
			expect(target.references.map(({ usage }) => usage)).toEqual([
				'style-only',
				'camera-and-display-only'
			]);
			expect(target.presentation).toMatchObject({
				mode: 'complete-armour-set',
				subject: 'empty-self-supporting-armour-set',
				interior: 'natural-interior-cavity-shadow-only',
				requiredComponents: ['Head', 'Torso', 'Legs', 'Boots']
			});
		}
	});

	it('preserves the owner-locked material and Axe vocabulary in packets and prompts', () => {
		const packets = buildRootEquipmentPacketsV2(fixture());
		const ashBow = packets.find(({ target }) => target.targetId.endsWith('ash-bow-v2'))!.target;
		const hardLeather = packets.find(({ target }) =>
			target.targetId.endsWith('hard-leather-light-armour-full-set-v2')
		)!.target;
		const bronzeAxe = packets.find(({ target }) =>
			target.targetId.endsWith('bronze-axe-v2')
		)!.target;
		expect(renderEquipmentPromptV2(ashBow)).toContain('Material: Ash');
		expect(renderEquipmentPromptV2(hardLeather)).toContain('Material: Hard Leather');
		expect(renderEquipmentPromptV2(bronzeAxe)).toContain('single-bit');
		expect(renderEquipmentPromptV2(bronzeAxe)).toContain('double-bit war axe deferred');
	});

	it('renders exact v2 framing, pose, and empty-display instructions', () => {
		const packets = buildRootEquipmentPacketsV2(fixture());
		const swordPrompt = renderEquipmentPromptV2(packets[0]!.target);
		const armourPrompt = renderEquipmentPromptV2(
			packets.find(({ target }) => target.presentation.mode === 'complete-armour-set')!.target
		);
		expect(swordPrompt).toContain('Framing: aim for 8% clearance and never go below 5%.');
		expect(swordPrompt).toContain('Once 5% is met, preserve the class pose over adding margin.');
		expect(swordPrompt).toContain('Pose: tip planted near lower-left-of-centre');
		expect(swordPrompt).not.toContain('inside an 8% safe margin');
		expect(swordPrompt.endsWith('\n')).toBe(false);
		expect(armourPrompt).toContain('empty, self-supporting complete Armour set');
		expect(armourPrompt).toContain(
			'Never show a body, mannequin, support figure, or black void figure'
		);
	});

	it('builds exactly four gated pieces with accepted source first and style second', () => {
		const sources = fixture();
		const roots = buildRootEquipmentPacketsV2(sources);
		const source = roots.find(({ target }) =>
			target.targetId.endsWith('bronze-heavy-armour-full-set-v2')
		)!.target;
		const gate = sources.allocation.reviewGates.find(
			({ sourceTargetId }) => sourceTargetId === source.targetId
		)!;
		const receipt: EquipmentV2ArmourSourceReviewReceipt = {
			schemaVersion: 'equipment-armour-source-review-receipt-v2',
			receiptId: `${gate.gateId}-receipt`,
			runId: 'material-equipment-v2-run-001',
			runPlanCanonicalSha256: '1'.repeat(64),
			manifestCanonicalSha256: canonicalJsonSha256V2(sources.manifest),
			allocationCanonicalSha256: canonicalJsonSha256V2(sources.allocation),
			profileCanonicalSha256: canonicalJsonSha256V2(sources.profile),
			profileAcceptanceCanonicalSha256: canonicalJsonSha256V2(sources.acceptance),
			gateId: gate.gateId,
			sourceTargetId: source.targetId,
			sourceResultCanonicalSha256: '2'.repeat(64),
			candidateSha256: '3'.repeat(64),
			decision: 'accepted',
			reviewer: 'equipment-art-director',
			reviewedAt: '2026-09-02T21:00:00.000Z'
		};
		const pieces = buildDependentArmourPacketsV2({
			...sources,
			sourceTarget: source,
			receipt
		});
		expect(pieces.map(({ target }) => target.equipment.slot)).toEqual([
			'head',
			'torso',
			'legs',
			'boots'
		]);
		for (const { target } of pieces) {
			expect(target.references.map(({ referenceId }) => referenceId)).toEqual([
				'accepted-full-set-source',
				'remy-finish-style'
			]);
			expect(target.references.map(({ usage }) => usage)).toEqual([
				'continuity-source',
				'style-only'
			]);
			expect(target.references.some(({ referenceId }) => referenceId.includes('camera'))).toBe(
				false
			);
			const prompt = renderEquipmentPromptV2(target);
			expect(prompt).toContain('Do not redesign the accepted full set.');
			expect(prompt).toContain('Framing: aim for 8% clearance and never go below 5%.');
			expect(prompt).not.toContain('match the full-set camera and empty display anchor');
			expect(prompt).not.toContain('exactly four readable components');
		}
		expect(() =>
			buildDependentArmourPacketsV2({
				...sources,
				sourceTarget: source,
				receipt: { ...receipt, decision: 'rejected' }
			})
		).toThrow('not accepted');
	});

	it('validates an exact root envelope and rejects packet mutation', async () => {
		const sources = fixture();
		const packet = buildRootEquipmentPacketsV2(sources)[0]!;
		await expect(
			validateEquipmentPacketV2({
				workspaceRoot: process.cwd(),
				...sources,
				target: packet.target,
				assignment: packet.assignment
			})
		).resolves.toEqual({
			ownedPaths: [packet.target.output.candidatePath, packet.target.output.provenanceResultPath],
			promptSha256: createHash('sha256')
				.update(renderEquipmentPromptV2(packet.target))
				.digest('hex')
		});
		await expect(
			validateEquipmentPacketV2({
				workspaceRoot: process.cwd(),
				...sources,
				target: {
					...packet.target,
					classDirection: { ...packet.target.classDirection, pose: 'lying flat' }
				},
				assignment: packet.assignment
			})
		).rejects.toThrow('deterministic renderer');
	});

	it('rejects result evidence that does not exactly bind its prompt, references, criteria, and canvas', () => {
		const packet = buildRootEquipmentPacketsV2(fixture())[0]!;
		const target = packet.target;
		const result = {
			schemaVersion: 'equipment-image-result-v2',
			resultId: `result-${target.targetId}`,
			targetId: target.targetId,
			assignmentId: packet.assignment.assignmentId,
			status: 'candidate',
			humanReviewLabel: 'Pass',
			promptSha256: createHash('sha256').update(renderEquipmentPromptV2(target)).digest('hex'),
			referenceInputs: target.references.map(({ referenceId, path, contentHash }) => ({
				referenceId,
				path,
				contentHash
			})),
			attempts: [
				{
					attemptId: `attempt-${target.targetId}`,
					attemptNumber: 1,
					sourceOutputId: 'provider-output-1',
					requestStartedAt: '2026-09-02T21:00:00.000Z',
					generationCompletedAt: '2026-09-02T21:00:10.000Z',
					inspectionCompletedAt: '2026-09-02T21:00:20.000Z'
				}
			],
			findings: target.acceptanceCriteria.map(({ criterionId }) => ({
				criterionId,
				outcome: 'pass',
				observation: 'Passed.'
			})),
			candidate: {
				path: target.output.candidatePath,
				mediaType: target.presentation.canvas.mediaType,
				width: target.presentation.canvas.width,
				height: target.presentation.canvas.height,
				bytes: 10,
				sha256: 'd'.repeat(64)
			},
			candidateSha256: 'd'.repeat(64),
			startedAt: '2026-09-02T21:00:00.000Z',
			completedAt: '2026-09-02T21:00:20.000Z',
			writtenOutputPaths: [target.output.candidatePath, target.output.provenanceResultPath],
			noSharedFilesEdited: true,
			selfPromoted: false
		};
		expect(validateEquipmentResultV2({ target, assignment: packet.assignment, result })).toEqual(
			result
		);
		expect(() =>
			validateEquipmentResultV2({
				target,
				assignment: packet.assignment,
				result: {
					...result,
					candidate: { ...result.candidate, height: 1536 }
				}
			})
		).toThrow('canvas');
		expect(() =>
			validateEquipmentResultV2({
				target,
				assignment: packet.assignment,
				result: { ...result, referenceInputs: [] }
			})
		).toThrow();
		expect(() =>
			validateEquipmentResultV2({
				target,
				assignment: packet.assignment,
				result: {
					...result,
					findings: result.findings.map((finding, index) =>
						index === 0 ? { ...finding, outcome: 'fail' } : finding
					)
				}
			})
		).toThrow('Pass candidates');
	});

	it('reports contract readiness without authorizing generation or writing files', async () => {
		await expect(
			assessEquipmentV2ContractReadiness({
				workspaceRoot: process.cwd(),
				checkedAt: '2026-09-02T20:40:00.000Z'
			})
		).resolves.toMatchObject({
			status: 'ready-for-run-contract',
			writesPerformed: 0,
			activation: {
				included: false,
				imageGenerationAuthorized: false,
				nextRequiredGate: 'v2-run-specific-activation'
			},
			summary: { rootTargets: 77, rootAssignments: 77, gatedArmourPieces: 84 }
		});
	});
});

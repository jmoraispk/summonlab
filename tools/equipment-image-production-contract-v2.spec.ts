import { describe, expect, it } from 'vitest';

import {
	EquipmentV2ImageAssignmentSchema,
	EquipmentV2ImageResultSchema,
	EquipmentV2ProfileAcceptanceSchema
} from './equipment-image-production-contract-v2.js';

describe('Equipment v2 production contracts', () => {
	it('keeps profile acceptance scoped away from run authorization', () => {
		const result = EquipmentV2ProfileAcceptanceSchema.safeParse({
			schemaVersion: 'equipment-visual-profile-acceptance-v2',
			acceptanceId: 'equipment-material-visual-profile-v2-acceptance',
			productionId: 'material-equipment-v2',
			profileId: 'equipment-material-visual-profile-v2',
			profileSchemaVersion: 'equipment-visual-profile-v2',
			profilePath: 'assets/equipment/experiments/material-equipment-v2/visual-profile/profile.json',
			profileCanonicalSha256: 'a'.repeat(64),
			decision: 'accepted',
			reviewer: 'owner',
			acceptedAt: '2026-09-02T20:28:24.000Z',
			authorizationScope: 'visual-profile-only',
			runAuthorization: 'granted'
		});
		expect(result.success).toBe(false);
	});

	it('requires separate run activation for every v2 assignment', () => {
		const assignment = {
			schemaVersion: 'equipment-image-assignment-v2',
			assignmentId: 'assignment-material-equipment-v2-bronze-sword-v2',
			targetId: 'material-equipment-v2-bronze-sword-v2',
			contractVersion: 'equipment-image-production-contract-v2',
			rendererVersion: 'equipment-image-prompt-v2',
			assignedAt: '2026-09-02T20:30:00.000Z',
			runActivationRequired: true,
			dryRun: false,
			retryCeiling: 0,
			permittedOutputs: {
				candidatePath:
					'assets/equipment/experiments/material-equipment-v2/candidates/f/bronze/sword-v2.png',
				provenanceResultPath:
					'assets/equipment/experiments/material-equipment-v2/results/f/bronze/sword-v2.json'
			},
			forbiddenSharedPaths: ['assets/equipment/experiments/material-equipment-v1'],
			completionContract: {
				oneTargetOneImage: true,
				structuredResultRequired: true,
				sharedFilesMustRemainUntouched: true,
				selfPromotionForbidden: true
			}
		};
		expect(EquipmentV2ImageAssignmentSchema.parse(assignment).runActivationRequired).toBe(true);
		expect(() =>
			EquipmentV2ImageAssignmentSchema.parse({ ...assignment, runActivationRequired: false })
		).toThrow();
	});

	it.each([
		['candidate', 'Pass', true],
		['revise', 'Check', true],
		['failed', 'No image', false]
	] as const)(
		'maps machine status %s to display label %s',
		(status, humanReviewLabel, hasImage) => {
			const candidate = hasImage
				? {
						path: 'assets/equipment/experiments/material-equipment-v2/candidates/f/bronze/sword-v2.png',
						mediaType: 'image/png',
						width: 1024,
						height: 1024,
						bytes: 10,
						sha256: 'b'.repeat(64)
					}
				: null;
			const value = {
				schemaVersion: 'equipment-image-result-v2',
				resultId: 'result-material-equipment-v2-bronze-sword-v2',
				targetId: 'material-equipment-v2-bronze-sword-v2',
				assignmentId: 'assignment-material-equipment-v2-bronze-sword-v2',
				status,
				humanReviewLabel,
				promptSha256: 'a'.repeat(64),
				referenceInputs: [
					{
						referenceId: 'remy-finish-style',
						path: 'assets/heroes/reference.png',
						contentHash: 'c'.repeat(64)
					}
				],
				attempts: [
					{
						attemptId: 'attempt-material-equipment-v2-bronze-sword-v2',
						attemptNumber: 1,
						sourceOutputId: 'provider-output-1',
						requestStartedAt: '2026-09-02T21:00:00.000Z',
						generationCompletedAt: '2026-09-02T21:00:10.000Z',
						inspectionCompletedAt: '2026-09-02T21:00:20.000Z'
					}
				],
				findings: [
					{
						criterionId: 'v2-framing',
						outcome: status === 'candidate' ? 'pass' : status === 'revise' ? 'concern' : 'fail',
						observation: 'Framing inspected.'
					}
				],
				candidate,
				candidateSha256: candidate?.sha256 ?? null,
				startedAt: '2026-09-02T21:00:00.000Z',
				completedAt: '2026-09-02T21:00:20.000Z',
				writtenOutputPaths: hasImage
					? [
							candidate!.path,
							'assets/equipment/experiments/material-equipment-v2/results/f/bronze/sword-v2.json'
						]
					: ['assets/equipment/experiments/material-equipment-v2/results/f/bronze/sword-v2.json'],
				noSharedFilesEdited: true,
				selfPromoted: false
			};
			expect(EquipmentV2ImageResultSchema.parse(value).humanReviewLabel).toBe(humanReviewLabel);
			const wrongLabel = status === 'candidate' ? 'Check' : 'Pass';
			expect(() =>
				EquipmentV2ImageResultSchema.parse({ ...value, humanReviewLabel: wrongLabel })
			).toThrow(/label/iu);
		}
	);
});

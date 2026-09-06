import { describe, expect, it } from 'vitest';

import {
	SkillIconCleanupManifestSchema,
	SkillIconCleanupOwnerReviewSchema,
	SkillIconCleanupResultSchema,
	SkillIconCleanupSelectionSchema
} from './index.js';

const hash = 'a'.repeat(64);
const cleanupRoot = 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1';

function validRecord(index: number) {
	const targetId = `martial:blade:cleanup-${index}`;
	const slug = targetId.replaceAll(':', '-');
	return {
		targetId,
		sourceCandidate: {
			path: `assets/wiki/skills/icon-production-v1/mass-production-v1/icons/${slug}.png`,
			contentHash: hash
		},
		rank: 'F' as const,
		disposition: 'recompose' as const,
		findings: [],
		cleanupCompositePath: `${cleanupRoot}/composites/${slug}.png`,
		resultPath: `${cleanupRoot}/results/${slug}.json`
	};
}

function validManifest() {
	return {
		schemaVersion: 'skill-icon-quality-cleanup-manifest-v1' as const,
		authority: {
			massProductionManifest: {
				path: 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json',
				contentHash: '7103c8d6c7ac006dcc4c332875ac4b44213d239079219363f9056b78bd3506bf'
			},
			catalog: {
				path: 'assets/wiki/skills/icon-production-v1/catalog.json',
				contentHash: '71add63ae46e6e0b68d807bb5bca6060b101213682fc8e1c9037ad1fe3744aaf'
			},
			motifMap: {
				path: 'assets/wiki/skills/icon-production-v1/motif-map.json',
				contentHash: 'd9b82036326ebd35dc8689875c0bab3ae638ed31de64d4b4c8ded5a96428f1c7'
			},
			visualSpecifications: {
				path: 'assets/wiki/skills/icon-production-v1/visual-specs.json',
				contentHash: '08d2b4018644f9d3b5166c41cf71768207fb9ffe821b2d83fde05707037b0514'
			},
			selectedFrameSheet: {
				path: 'assets/wiki/skills/icon-production-v1/mass-production-v1/references/approved-seven-frame-sheet.png',
				contentHash: '4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266'
			},
			optionCMaterial: {
				path: 'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png',
				contentHash: '66af9144bc4cb5d8bb1420c5a07cfe9652c7ccbccf17519da938b21298b929ce'
			},
			geometry: {
				path: 'assets/wiki/skills/icon-production-v1/geometry-v2.json',
				contentHash: '6ffaaa99a2e19c7589bcb2f7975268117db199abd45752fd164567cb5042fcab'
			},
			providerSpaceGuide: {
				path: 'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png',
				contentHash: '8f1c01435f3e32de07560b154d9e3becba3ca2a38773ca74c3115d66ba28094e'
			}
		},
		records: Array.from({ length: 456 }, (_, index) => validRecord(index))
	};
}

function validResult() {
	return {
		schemaVersion: 'skill-icon-quality-cleanup-result-v1' as const,
		...validRecord(0),
		cleanupInterior: {
			path: `${cleanupRoot}/interiors/martial-blade-cleanup-0.png`,
			contentHash: hash,
			removedPixels: 3,
			removedPixelBounds: { left: 0, top: 2, width: 6, height: 4 }
		},
		compositionAuthority: {
			geometry: {
				path: 'assets/wiki/skills/icon-production-v1/geometry-v2.json',
				contentHash: hash
			},
			backing: {
				path: 'assets/wiki/skills/icon-production-v1/candidates/references/charcoal-forged-stone-v6.png',
				contentHash: hash
			},
			frame: {
				path: 'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-f-v9.png',
				contentHash: hash
			}
		},
		cleanupCompositeContentHash: hash,
		resultContentHash: hash
	};
}

function acceptedOwnerReview() {
	return {
		schemaVersion: 'skill-icon-quality-cleanup-owner-review-v1' as const,
		reviewId: 'skill-icon-quality-cleanup-v1-owner-review',
		reviewer: 'Skills visual owner',
		reviewerRole: 'owner' as const,
		cleanupManifestPath: `${cleanupRoot}/manifest.json`,
		cleanupManifestContentHash: hash,
		decision: 'accepted' as const,
		reviewedAt: '2026-09-04T12:00:00.000Z'
	};
}

function validSelection() {
	const review = acceptedOwnerReview();
	return {
		schemaVersion: 'skill-icon-quality-cleanup-selection-v1' as const,
		cleanupManifestPath: review.cleanupManifestPath,
		cleanupManifestContentHash: review.cleanupManifestContentHash,
		ownerReviewPath: `${cleanupRoot}/review/owner-review-v1.json`,
		ownerReviewContentHash: hash,
		ownerReview: review,
		records: Array.from({ length: 456 }, (_, index) => {
			const record = validRecord(index);
			return {
				targetId: record.targetId,
				disposition: 'selected' as const,
				cleanupCompositePath: record.cleanupCompositePath,
				cleanupCompositeContentHash: hash
			};
		})
	};
}

describe('skill-icon quality-cleanup contracts', () => {
	it('accepts exactly 456 unique cleanup records', () => {
		expect(() => SkillIconCleanupManifestSchema.parse(validManifest())).not.toThrow();
		expect(() =>
			SkillIconCleanupManifestSchema.parse({
				...validManifest(),
				records: [...validManifest().records, validManifest().records[0]]
			})
		).toThrow(/duplicate target/i);
	});

	it('rejects unrecognized finding kinds and duplicate target IDs', () => {
		const manifest = validManifest();
		const [firstRecord] = manifest.records;
		if (!firstRecord) throw new Error('Expected the valid manifest fixture to contain records.');
		expect(
			SkillIconCleanupManifestSchema.safeParse({
				...manifest,
				records: [
					{
						...firstRecord,
						findings: [
							{
								targetId: firstRecord.targetId,
								kind: 'unknown-defect',
								detail: 'Unknown defects must fail closed.',
								requiredAction: 'recompose'
							}
						]
					},
					...manifest.records.slice(1)
				]
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupManifestSchema.safeParse({
				...manifest,
				records: [...manifest.records.slice(0, -1), firstRecord]
			}).success
		).toBe(false);
	});

	it('rejects authority drift and cleanup path collisions', () => {
		const manifest = validManifest();
		const [firstRecord] = manifest.records;
		if (!firstRecord) throw new Error('Expected the valid manifest fixture to contain records.');
		expect(
			SkillIconCleanupManifestSchema.safeParse({
				...manifest,
				authority: {
					...manifest.authority,
					catalog: { ...manifest.authority.catalog, contentHash: hash }
				}
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupManifestSchema.safeParse({
				...manifest,
				records: [
					{
						...firstRecord,
						cleanupCompositePath: firstRecord.sourceCandidate.path
					},
					...manifest.records.slice(1)
				]
			}).success
		).toBe(false);
	});

	it('rejects cleanup-owned sources and cross-record source/composite collisions', () => {
		const manifest = validManifest();
		const [firstRecord, secondRecord] = manifest.records;
		if (!firstRecord || !secondRecord) {
			throw new Error('Expected the valid manifest fixture to contain multiple records.');
		}
		expect(
			SkillIconCleanupManifestSchema.safeParse({
				...manifest,
				records: [
					firstRecord,
					{
						...secondRecord,
						sourceCandidate: {
							...secondRecord.sourceCandidate,
							path: firstRecord.cleanupCompositePath
						}
					},
					...manifest.records.slice(2)
				]
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupManifestSchema.safeParse({
				...manifest,
				records: [
					{
						...firstRecord,
						sourceCandidate: {
							...firstRecord.sourceCandidate,
							path: `${cleanupRoot}/revisions/martial-blade-cleanup-source.png`
						}
					},
					...manifest.records.slice(1)
				]
			}).success
		).toBe(false);
	});

	it('rejects unversioned cleanup paths and non-cleanup result paths', () => {
		const result = validResult();
		expect(SkillIconCleanupResultSchema.safeParse(result).success).toBe(true);
		const { cleanupInterior: _cleanupInterior, ...withoutInteriorEvidence } = result;
		expect(SkillIconCleanupResultSchema.safeParse(withoutInteriorEvidence).success).toBe(false);
		const { compositionAuthority: _compositionAuthority, ...withoutLayerEvidence } = result;
		expect(SkillIconCleanupResultSchema.safeParse(withoutLayerEvidence).success).toBe(false);
		expect(
			SkillIconCleanupResultSchema.safeParse({
				...result,
				cleanupInterior: {
					...result.cleanupInterior,
					removedPixels: 0,
					removedPixelBounds: result.cleanupInterior.removedPixelBounds
				}
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupResultSchema.safeParse({
				...result,
				cleanupCompositePath: 'assets/wiki/skills/icon-production-v1/composites/not-versioned.png'
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupResultSchema.safeParse({
				...result,
				resultPath: 'assets/wiki/skills/icon-production-v1/results/icons/not-cleanup.json'
			}).success
		).toBe(false);
	});

	it('binds every cleanup frame, including F, to revision nine', () => {
		const fResult = validResult();
		expect(SkillIconCleanupResultSchema.safeParse(fResult).success).toBe(true);
		expect(
			SkillIconCleanupResultSchema.safeParse({
				...fResult,
				compositionAuthority: {
					...fResult.compositionAuthority,
					frame: {
						...fResult.compositionAuthority.frame,
						path: 'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-f-v5.png'
					}
				}
			}).success
		).toBe(false);

		const eResult = {
			...fResult,
			rank: 'E' as const,
			compositionAuthority: {
				...fResult.compositionAuthority,
				frame: {
					...fResult.compositionAuthority.frame,
					path: 'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-e-v9.png'
				}
			}
		};
		expect(SkillIconCleanupResultSchema.safeParse(eResult).success).toBe(true);
		expect(
			SkillIconCleanupResultSchema.safeParse({
				...eResult,
				compositionAuthority: {
					...eResult.compositionAuthority,
					frame: {
						...eResult.compositionAuthority.frame,
						path: 'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-e-v8.png'
					}
				}
			}).success
		).toBe(false);
	});

	it('requires an accepted hash-bound owner review before selection', () => {
		expect(SkillIconCleanupOwnerReviewSchema.safeParse(acceptedOwnerReview()).success).toBe(true);
		expect(SkillIconCleanupSelectionSchema.safeParse(validSelection()).success).toBe(true);
		expect(
			SkillIconCleanupSelectionSchema.safeParse({
				...validSelection(),
				ownerReview: { ...acceptedOwnerReview(), decision: 'rejected' }
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupSelectionSchema.safeParse({
				...validSelection(),
				ownerReview: {
					...acceptedOwnerReview(),
					cleanupManifestContentHash: 'b'.repeat(64)
				}
			}).success
		).toBe(false);
	});
});

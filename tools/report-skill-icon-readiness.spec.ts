import type { SkillIconCatalog, SkillIconRecord } from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import {
	buildSkillIconReadinessReport,
	hashSkillIconCatalog,
	SKILL_ICON_PILOT_TARGET_IDS,
	type SkillIconCatalogCurrency,
	type SkillIconReadinessEvidence
} from './report-skill-icon-readiness.js';

const HASH = 'a'.repeat(64);

function catalog(approved: number): SkillIconCatalog {
	return {
		schemaVersion: 'skill-icon-catalog-v1',
		records: Array.from({ length: 456 }, (_, index) => ({
			targetId: SKILL_ICON_PILOT_TARGET_IDS[index] ?? `martial:blade:skill-${index}`,
			status: index < approved ? 'approved' : 'mapped',
			assets:
				index < approved ? { approvedMaster: { contentHash: `${index}`.padStart(64, 'a') } } : null
		})) as SkillIconRecord[]
	};
}

function reviewedArtifact(
	id: string,
	role: 'rarity-frame' | 'backing' | 'calibration-plate',
	path: string
) {
	return {
		id,
		role,
		path,
		contentHash: HASH,
		review: { decision: 'accepted' as const, artifactId: id, role, path, contentHash: HASH }
	};
}

function acceptedEvidence(pilotCatalog: SkillIconCatalog): SkillIconReadinessEvidence {
	const pilotRecords = pilotCatalog.records.slice(0, 15);
	return {
		referenceAssets: [
			...['F', 'E', 'D', 'C', 'B', 'A', 'S'].map((rarity) =>
				reviewedArtifact(
					`rarity-frame-${rarity.toLowerCase()}-v1`,
					'rarity-frame',
					`assets/wiki/skills/icon-production-v1/masters/frames/${rarity.toLowerCase()}.png`
				)
			),
			reviewedArtifact(
				'charcoal-forged-stone-v1',
				'backing',
				'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
			)
		],
		calibrationPlates: [
			reviewedArtifact(
				'blade.sweeping-cut',
				'calibration-plate',
				'assets/wiki/skills/icon-production-v1/masters/calibration/blade-sweeping-cut.png'
			),
			reviewedArtifact(
				'elemental.fire-projectile',
				'calibration-plate',
				'assets/wiki/skills/icon-production-v1/masters/calibration/elemental-fire-projectile.png'
			),
			reviewedArtifact(
				'forging.smithing',
				'calibration-plate',
				'assets/wiki/skills/icon-production-v1/masters/calibration/forging-smithing.png'
			)
		],
		pilot: {
			targetIds: pilotRecords.map((record) => record.targetId),
			decision: 'accepted',
			contentHashes: Object.fromEntries(
				pilotRecords.map((record) => [
					record.targetId,
					(record.assets as { approvedMaster: { contentHash: string } }).approvedMaster.contentHash
				])
			)
		}
	};
}

const CURRENT: SkillIconCatalogCurrency = { catalogCurrent: true };

describe('skill icon readiness', () => {
	it('keeps a mapped-only catalog at foundation-incomplete', () => {
		expect(buildSkillIconReadinessReport(catalog(0), {}, CURRENT).state).toBe(
			'foundation-incomplete'
		);
	});

	it('reports an explicitly hash-bound accepted pilot as activation-eligible', () => {
		const pilotCatalog = catalog(15);
		expect(
			buildSkillIconReadinessReport(pilotCatalog, acceptedEvidence(pilotCatalog), CURRENT)
		).toMatchObject({
			state: 'eligible-for-owner-activation',
			approved: 15,
			remaining: 441
		});
	});

	it('does not count present artifacts or stale pilot hashes as accepted', () => {
		const pilotCatalog = catalog(15);
		const validEvidence = acceptedEvidence(pilotCatalog);
		const evidence: SkillIconReadinessEvidence = {
			...validEvidence,
			referenceAssets: validEvidence.referenceAssets!.map((artifact, index) =>
				index === 0
					? { ...artifact, review: { ...artifact.review, contentHash: 'b'.repeat(64) } }
					: artifact
			)
		};
		expect(buildSkillIconReadinessReport(pilotCatalog, evidence, CURRENT).state).toBe(
			'foundation-incomplete'
		);

		const staleBase = acceptedEvidence(pilotCatalog);
		const stalePilot: SkillIconReadinessEvidence = {
			...staleBase,
			pilot: {
				...staleBase.pilot!,
				contentHashes: {
					...staleBase.pilot!.contentHashes,
					[pilotCatalog.records[0]!.targetId]: 'c'.repeat(64)
				}
			}
		};
		expect(buildSkillIconReadinessReport(pilotCatalog, stalePilot, CURRENT).state).toBe(
			'pilot-incomplete'
		);
	});

	it('requires exact accepted reference and calibration identities, roles, and paths', () => {
		const pilotCatalog = catalog(15);
		const evidence = acceptedEvidence(pilotCatalog);
		const wrongFrameIdentity: SkillIconReadinessEvidence = {
			...evidence,
			referenceAssets: evidence.referenceAssets!.map((artifact, index) =>
				index === 0
					? {
							...artifact,
							id: 'rarity-frame-f-copy-v1',
							review: { ...artifact.review, artifactId: 'rarity-frame-f-copy-v1' }
						}
					: artifact
			)
		};
		expect(buildSkillIconReadinessReport(pilotCatalog, wrongFrameIdentity, CURRENT).state).toBe(
			'foundation-incomplete'
		);

		const wrongFramePath: SkillIconReadinessEvidence = {
			...evidence,
			referenceAssets: evidence.referenceAssets!.map((artifact, index) =>
				index === 0
					? {
							...artifact,
							path: 'assets/wiki/skills/icon-production-v1/masters/frames/not-f.png',
							review: {
								...artifact.review,
								path: 'assets/wiki/skills/icon-production-v1/masters/frames/not-f.png'
							}
						}
					: artifact
			)
		};
		expect(buildSkillIconReadinessReport(pilotCatalog, wrongFramePath, CURRENT).state).toBe(
			'foundation-incomplete'
		);

		const wrongCalibration: SkillIconReadinessEvidence = {
			...evidence,
			calibrationPlates: evidence.calibrationPlates!.map((artifact, index) =>
				index === 0
					? {
							...artifact,
							role: 'backing',
							review: { ...artifact.review, role: 'backing' }
						}
					: artifact
			)
		};
		expect(buildSkillIconReadinessReport(pilotCatalog, wrongCalibration, CURRENT).state).toBe(
			'pilot-incomplete'
		);

		const wrongCalibrationPath: SkillIconReadinessEvidence = {
			...evidence,
			calibrationPlates: evidence.calibrationPlates!.map((artifact, index) =>
				index === 0
					? {
							...artifact,
							path: 'assets/wiki/skills/icon-production-v1/masters/calibration/wrong.png',
							review: {
								...artifact.review,
								path: 'assets/wiki/skills/icon-production-v1/masters/calibration/wrong.png'
							}
						}
					: artifact
			)
		};
		expect(buildSkillIconReadinessReport(pilotCatalog, wrongCalibrationPath, CURRENT).state).toBe(
			'pilot-incomplete'
		);
	});

	it('uses computed catalog currency rather than a durable evidence claim', () => {
		const pilotCatalog = catalog(15);
		const dishonestEvidence = {
			...acceptedEvidence(pilotCatalog),
			catalogCurrent: true
		} as SkillIconReadinessEvidence & { catalogCurrent: boolean };
		expect(
			buildSkillIconReadinessReport(pilotCatalog, dishonestEvidence, { catalogCurrent: false })
				.state
		).toBe('foundation-incomplete');

		const completeCatalog = catalog(456);
		const completeEvidence: SkillIconReadinessEvidence & { catalogCurrent: boolean } = {
			...acceptedEvidence(completeCatalog),
			catalogCurrent: true,
			bulkActivation: {
				decision: 'accepted',
				catalogHash: hashSkillIconCatalog(completeCatalog),
				reviewedCatalogHash: hashSkillIconCatalog(completeCatalog)
			}
		};
		expect(
			buildSkillIconReadinessReport(completeCatalog, completeEvidence, {
				catalogCurrent: false
			}).state
		).not.toBe('complete');
	});

	it('binds foundation evidence to the coordinator-selected latest reference revisions', () => {
		const pilotCatalog = catalog(15);
		const stale = acceptedEvidence(pilotCatalog);
		const v2Requirements = [
			...['f', 'e', 'd', 'c', 'b', 'a', 's'].map((rarity) => ({
				id: `rarity-frame-${rarity}-v2`,
				role: 'rarity-frame' as const,
				path: `assets/wiki/skills/icon-production-v1/masters/frames/${rarity}.png`
			})),
			{
				id: 'charcoal-forged-stone-v2',
				role: 'backing' as const,
				path: 'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
			}
		];
		expect(
			buildSkillIconReadinessReport(pilotCatalog, stale, CURRENT, v2Requirements)
		).toMatchObject({ state: 'foundation-incomplete', referencesAccepted: 0 });
		const current = {
			...stale,
			referenceAssets: stale.referenceAssets!.map((artifact) => ({
				...artifact,
				id: artifact.id.replace(/-v1$/u, '-v2'),
				review: {
					...artifact.review,
					artifactId: artifact.review.artifactId.replace(/-v1$/u, '-v2')
				}
			}))
		};
		expect(
			buildSkillIconReadinessReport(pilotCatalog, current, CURRENT, v2Requirements)
		).toMatchObject({ referencesAccepted: 8 });
	});

	it('requires explicit owner activation before bulk-active or complete', () => {
		const partialCatalog = catalog(455);
		const evidence: SkillIconReadinessEvidence = {
			...acceptedEvidence(partialCatalog),
			bulkActivation: {
				decision: 'accepted',
				catalogHash: hashSkillIconCatalog(partialCatalog),
				reviewedCatalogHash: hashSkillIconCatalog(partialCatalog)
			}
		};
		expect(buildSkillIconReadinessReport(partialCatalog, evidence, CURRENT).state).toBe(
			'bulk-active'
		);

		const completeCatalog = catalog(456);
		const completeEvidence: SkillIconReadinessEvidence = {
			...acceptedEvidence(completeCatalog),
			bulkActivation: {
				decision: 'accepted',
				catalogHash: hashSkillIconCatalog(completeCatalog),
				reviewedCatalogHash: hashSkillIconCatalog(completeCatalog)
			}
		};
		expect(buildSkillIconReadinessReport(completeCatalog, completeEvidence, CURRENT).state).toBe(
			'complete'
		);
	});
});

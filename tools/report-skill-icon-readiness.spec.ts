import type { SkillIconCatalog, SkillIconRecord } from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import {
	buildSkillIconReadinessReport,
	hashSkillIconCatalog,
	SKILL_ICON_PILOT_TARGET_IDS,
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

function reviewedArtifact(id: string, role: 'rarity-frame' | 'backing' | 'calibration-plate') {
	return {
		id,
		role,
		contentHash: HASH,
		review: { decision: 'accepted' as const, contentHash: HASH }
	};
}

function acceptedEvidence(pilotCatalog: SkillIconCatalog): SkillIconReadinessEvidence {
	const pilotRecords = pilotCatalog.records.slice(0, 15);
	return {
		catalogCurrent: true,
		referenceAssets: [
			...['F', 'E', 'D', 'C', 'B', 'A', 'S'].map((rarity) =>
				reviewedArtifact(`frame-${rarity.toLowerCase()}`, 'rarity-frame')
			),
			reviewedArtifact('backing', 'backing')
		],
		calibrationPlates: [
			reviewedArtifact('blade.sweeping-cut', 'calibration-plate'),
			reviewedArtifact('elemental.fire-projectile', 'calibration-plate'),
			reviewedArtifact('forging.smithing', 'calibration-plate')
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

describe('skill icon readiness', () => {
	it('keeps a mapped-only catalog at foundation-incomplete', () => {
		expect(buildSkillIconReadinessReport(catalog(0), {}).state).toBe('foundation-incomplete');
	});

	it('reports an explicitly hash-bound accepted pilot as activation-eligible', () => {
		const pilotCatalog = catalog(15);
		expect(
			buildSkillIconReadinessReport(pilotCatalog, acceptedEvidence(pilotCatalog))
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
		expect(buildSkillIconReadinessReport(pilotCatalog, evidence).state).toBe(
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
		expect(buildSkillIconReadinessReport(pilotCatalog, stalePilot).state).toBe('pilot-incomplete');
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
		expect(buildSkillIconReadinessReport(partialCatalog, evidence).state).toBe('bulk-active');

		const completeCatalog = catalog(456);
		const completeEvidence: SkillIconReadinessEvidence = {
			...acceptedEvidence(completeCatalog),
			bulkActivation: {
				decision: 'accepted',
				catalogHash: hashSkillIconCatalog(completeCatalog),
				reviewedCatalogHash: hashSkillIconCatalog(completeCatalog)
			}
		};
		expect(buildSkillIconReadinessReport(completeCatalog, completeEvidence).state).toBe('complete');
	});
});

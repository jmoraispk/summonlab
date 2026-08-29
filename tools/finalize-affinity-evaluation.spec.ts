import { describe, expect, it } from 'vitest';

import { finalizationBlockers } from './finalize-affinity-evaluation.js';
import type { AffinityGateReadinessReport } from './report-affinity-gate-readiness.js';

function report(overrides: Partial<AffinityGateReadinessReport> = {}): AffinityGateReadinessReport {
	return {
		schemaVersion: 'affinity-controlled-gate-readiness-v1',
		experimentId: 'affinity-workflow-v1',
		workspace: { valid: true, issueCount: 0, issues: [] },
		controlledCohort: {
			targetCount: 24,
			completedCount: 24,
			unresolvedCount: 0,
			candidateCount: 24,
			reviseOrFailedCount: 0
		},
		reviewEvidence: {
			recordCount: 24,
			blindRecordCount: 24,
			eligibleBlindRecordCount: 24,
			ignoredRecordCount: 0,
			modePolicy: 'explicit-blind-only'
		},
		criteria: Object.fromEntries(
			[
				'firstAttemptCandidates',
				'speciesCorrectBlindReviews',
				'affinityCorrectBlindReviews',
				'normalUnaffiliatedBlindReviews',
				'acceptedMeaningfulNonNormal',
				'acceptedCriticalVisualFailures'
			].map((criterionId) => [
				criterionId,
				{
					current: criterionId === 'acceptedCriticalVisualFailures' ? 0 : 24,
					maximum: criterionId === 'acceptedCriticalVisualFailures' ? 0 : 24,
					bestAttainable: criterionId === 'acceptedCriticalVisualFailures' ? 0 : 24,
					threshold: criterionId === 'acceptedCriticalVisualFailures' ? 0 : 20,
					thresholdOperator:
						criterionId === 'acceptedCriticalVisualFailures' ? 'at-most' : 'at-least',
					satisfied: true,
					attainable: true,
					explanation: 'fixture'
				}
			])
		) as AffinityGateReadinessReport['criteria'],
		gate: {
			currentlySatisfied: true,
			attainableWithExistingControlledCohort: true,
			unattainableCriteria: []
		},
		...overrides
	};
}

describe('affinity evaluation finalization', () => {
	it('has no blockers for a fully satisfied report', () => {
		expect(finalizationBlockers(report())).toEqual([]);
	});

	it('separates impossible criteria from still-pending attainable criteria', () => {
		const value = report();
		const blocked = report({
			criteria: {
				...value.criteria,
				firstAttemptCandidates: {
					...value.criteria.firstAttemptCandidates,
					satisfied: false,
					attainable: false
				},
				affinityCorrectBlindReviews: {
					...value.criteria.affinityCorrectBlindReviews,
					satisfied: false
				}
			},
			gate: {
				currentlySatisfied: false,
				attainableWithExistingControlledCohort: false,
				unattainableCriteria: ['firstAttemptCandidates']
			}
		});
		expect(finalizationBlockers(blocked)).toEqual([
			'unattainable:firstAttemptCandidates',
			'pending:affinityCorrectBlindReviews'
		]);
	});
});

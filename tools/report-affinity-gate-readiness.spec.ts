import type {
	ImageProductionBlindReview,
	ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import {
	buildAffinityGateReadiness,
	type AffinityGateReadinessInput
} from './report-affinity-gate-readiness.js';
import type { ValidatedImageProductionExecution } from './sync-affinity-review.js';

const HASH = 'a'.repeat(64);

function target(index: number, affinity: 'normal' | 'fire'): ImageProductionTarget {
	return {
		targetId: `controlled-target-${index}`,
		cohort: 'controlled',
		speciesId: 'death-knight',
		affinity,
		affinityDesign: {
			alteredDimensions: affinity === 'normal' ? [] : ['material', 'silhouette']
		}
	} as unknown as ImageProductionTarget;
}

function execution(
	targetManifest: ImageProductionTarget,
	input: {
		readonly status: 'candidate' | 'revise';
		readonly firstAttempt: boolean;
		readonly critical?: boolean;
	}
): ValidatedImageProductionExecution {
	const acceptedAttemptId = `${targetManifest.targetId}-attempt-${input.firstAttempt ? 1 : 2}`;
	const firstAttempt = {
		attemptId: `${targetManifest.targetId}-attempt-1`,
		output: input.firstAttempt ? { contentHash: HASH } : null,
		findings: []
	};
	const attempts = input.firstAttempt
		? [firstAttempt]
		: [
				firstAttempt,
				{
					attemptId: acceptedAttemptId,
					output: { contentHash: HASH },
					findings: input.critical ? [{ category: 'anatomy', outcome: 'fail' }] : []
				}
			];
	if (input.firstAttempt && input.critical) {
		attempts[0]!.findings = [{ category: 'framing', outcome: 'fail' }];
	}
	return {
		target: targetManifest,
		assignment: {},
		result: {
			status: input.status,
			selectedAttemptId: input.status === 'candidate' ? acceptedAttemptId : null,
			attempts
		}
	} as unknown as ValidatedImageProductionExecution;
}

function review(
	targetManifest: ImageProductionTarget,
	input: {
		readonly correct?: boolean;
		readonly verdict?: 'candidate' | 'revise';
		readonly reviewMode?: 'blind' | 'labeled';
	} = {}
): ImageProductionBlindReview {
	const value = {
		targetId: targetManifest.targetId,
		candidateContentHash: HASH,
		identifiedSpeciesId: input.correct === false ? 'gray-wolf' : targetManifest.speciesId,
		identifiedAffinity:
			input.correct === false
				? targetManifest.affinity === 'normal'
					? 'fire'
					: 'normal'
				: targetManifest.affinity,
		verdict: input.verdict ?? 'candidate',
		...(input.reviewMode ? { reviewMode: input.reviewMode } : {})
	};
	return value as unknown as ImageProductionBlindReview;
}

function input(
	targets: readonly ImageProductionTarget[],
	executions: readonly ValidatedImageProductionExecution[],
	blindReviews: readonly ImageProductionBlindReview[] = []
): AffinityGateReadinessInput {
	return {
		experimentId: 'affinity-workflow-v1',
		controlledTargets: targets,
		executions,
		blindReviews
	};
}

describe('affinity controlled-gate readiness', () => {
	it('exposes hard ceilings from immutable controlled results', () => {
		const targets = Array.from({ length: 24 }, (_, index) =>
			target(index, index < 4 ? 'normal' : 'fire')
		);
		const executions = targets.map((targetManifest, index) =>
			execution(targetManifest, {
				status: index < 21 ? 'candidate' : 'revise',
				firstAttempt: index < 10
			})
		);

		const report = buildAffinityGateReadiness(input(targets, executions));

		expect(report.criteria.firstAttemptCandidates).toMatchObject({
			current: 10,
			maximum: 10,
			threshold: 20,
			satisfied: false,
			attainable: false
		});
		expect(report.criteria.speciesCorrectBlindReviews.maximum).toBe(21);
		expect(report.criteria.affinityCorrectBlindReviews.maximum).toBe(21);
		expect(report.criteria.normalUnaffiliatedBlindReviews.maximum).toBe(4);
		expect(report.criteria.acceptedMeaningfulNonNormal.maximum).toBe(17);
		expect(report.criteria.acceptedCriticalVisualFailures).toMatchObject({
			current: 0,
			maximum: 0,
			threshold: 0,
			satisfied: true,
			attainable: true
		});
		expect(report.gate).toMatchObject({
			currentlySatisfied: false,
			attainableWithExistingControlledCohort: false,
			unattainableCriteria: [
				'firstAttemptCandidates',
				'speciesCorrectBlindReviews',
				'acceptedMeaningfulNonNormal'
			]
		});
	});

	it('reports a fully evidenced controlled cohort as ready', () => {
		const targets = Array.from({ length: 24 }, (_, index) =>
			target(index, index < 4 ? 'normal' : 'fire')
		);
		const executions = targets.map((targetManifest) =>
			execution(targetManifest, { status: 'candidate', firstAttempt: true })
		);
		const reviews = targets.map((targetManifest) => review(targetManifest));

		const report = buildAffinityGateReadiness(input(targets, executions, reviews));

		expect(report.reviewEvidence).toMatchObject({
			recordCount: 24,
			blindRecordCount: 24,
			eligibleBlindRecordCount: 24,
			ignoredRecordCount: 0,
			modePolicy: 'legacy-blind-aggregate'
		});
		expect(report.criteria.speciesCorrectBlindReviews.current).toBe(24);
		expect(report.criteria.affinityCorrectBlindReviews.current).toBe(24);
		expect(report.criteria.normalUnaffiliatedBlindReviews.current).toBe(4);
		expect(report.criteria.acceptedMeaningfulNonNormal.current).toBe(20);
		expect(report.gate.currentlySatisfied).toBe(true);
		expect(report.gate.attainableWithExistingControlledCohort).toBe(true);
	});

	it('counts only explicit blind records once review modes are present', () => {
		const targets = [target(0, 'normal'), target(1, 'fire')];
		const executions = targets.map((targetManifest) =>
			execution(targetManifest, { status: 'candidate', firstAttempt: true })
		);
		const reviews = [
			review(targets[0]!, { reviewMode: 'blind' }),
			review(targets[1]!, { reviewMode: 'labeled' })
		];

		const report = buildAffinityGateReadiness(input(targets, executions, reviews));

		expect(report.reviewEvidence).toMatchObject({
			recordCount: 2,
			blindRecordCount: 1,
			eligibleBlindRecordCount: 1,
			ignoredRecordCount: 1,
			modePolicy: 'explicit-blind-only'
		});
		expect(report.criteria.speciesCorrectBlindReviews.current).toBe(1);
		expect(report.criteria.affinityCorrectBlindReviews.current).toBe(1);
	});

	it('makes an already accepted critical visual failure irrecoverable in the cohort gate', () => {
		const targetManifest = target(0, 'fire');
		const report = buildAffinityGateReadiness(
			input(
				[targetManifest],
				[execution(targetManifest, { status: 'candidate', firstAttempt: true, critical: true })],
				[review(targetManifest)]
			)
		);

		expect(report.criteria.acceptedCriticalVisualFailures).toMatchObject({
			current: 1,
			maximum: 1,
			bestAttainable: 1,
			threshold: 0,
			satisfied: false,
			attainable: false
		});
		expect(report.gate.unattainableCriteria).toContain('acceptedCriticalVisualFailures');
	});
});

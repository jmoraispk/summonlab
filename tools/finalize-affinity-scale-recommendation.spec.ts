import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
	EligibleSchedulerRun,
	SchedulerEvidenceScan
} from './check-affinity-plan-completion.js';
import {
	AFFINITY_SCALE_RECOMMENDATION_PATH,
	AffinityScaleRecommendationV3Schema,
	buildAffinityScaleRecommendation,
	buildAffinityScaleRecommendationReadiness,
	finalizeAffinityScaleRecommendation
} from './finalize-affinity-scale-recommendation.js';

const temporaryRoots: string[] = [];
const STAGE_BY_LEVEL = {
	2: 'canary',
	4: 'pilot',
	6: 'controlled',
	8: 'breadth',
	12: 'load',
	16: 'scale'
} as const;
const HASH_CHARACTER_BY_LEVEL = {
	2: '2',
	4: '4',
	6: '6',
	8: '8',
	12: 'a',
	16: 'b'
} as const;

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function temporaryWorkspace(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'affinity-scale-recommendation-'));
	temporaryRoots.push(root);
	return root;
}

function run(level: keyof typeof STAGE_BY_LEVEL): EligibleSchedulerRun {
	const stage = STAGE_BY_LEVEL[level];
	const hash = HASH_CHARACTER_BY_LEVEL[level].repeat(64);
	return {
		runId: `${stage}-exact-${level}`,
		stage,
		effectiveConcurrency: level,
		preflightPath: `wave-runs/${stage}-exact-${level}/preflight.json`,
		preflightCanonicalSha256: hash,
		reportPath: `wave-runs/${stage}-exact-${level}/report.json`,
		reportCanonicalSha256: hash
	};
}

function evidence(endpoint: 'blocked' | 'completed' = 'blocked'): SchedulerEvidenceScan {
	const requiredRuns = ([2, 4, 6, 8, 12] as const).map(run);
	if (endpoint === 'completed') {
		return { eligibleRuns: [...requiredRuns, run(16)], blockedScalePreflights: [] };
	}
	return {
		eligibleRuns: requiredRuns,
		blockedScalePreflights: [
			{
				runId: 'scale-blocked-sixteen',
				preflightPath: 'wave-runs/scale-blocked-sixteen/preflight.json',
				preflightCanonicalSha256: 'c'.repeat(64),
				prerequisiteRunIds: [run(12).runId]
			}
		]
	};
}

function decision(recommendedSafeConcurrency = 12) {
	return {
		recommendedSafeConcurrency,
		humanDecisionAcknowledged: true,
		productionStrategy: 'Use the selected measured ceiling for bounded production waves.',
		fallbackBehavior: 'Step down to the next measured level after a capacity or quality regression.'
	};
}

describe('affinity scale recommendation finalization', () => {
	it('reports missing measured levels and endpoint without creating evidence', async () => {
		const workspaceRoot = await temporaryWorkspace();
		const emptyEvidence: SchedulerEvidenceScan = {
			eligibleRuns: [],
			blockedScalePreflights: []
		};
		const report = await finalizeAffinityScaleRecommendation({
			workspaceRoot,
			mode: 'check',
			schedulerEvidence: emptyEvidence
		});

		expect(report).toMatchObject({
			mode: 'check',
			readyForHumanDecision: false,
			artifactPresent: false,
			written: false,
			idempotent: false,
			inSync: false
		});
		expect(report.blockers).toEqual([
			'missing-effective-level:2',
			'missing-effective-level:4',
			'missing-effective-level:6',
			'missing-effective-level:8',
			'missing-effective-level:12',
			'missing-scale-endpoint'
		]);
		await expect(
			readFile(path.resolve(workspaceRoot, AFFINITY_SCALE_RECOMMENDATION_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('does not mistake a blocked Pilot preflight for a Scale endpoint', () => {
		const scan: SchedulerEvidenceScan = {
			eligibleRuns: ([2, 4, 6, 8, 12] as const).map(run),
			blockedScalePreflights: []
		};
		const readiness = buildAffinityScaleRecommendationReadiness(scan);
		expect(readiness.ready).toBe(false);
		expect(readiness.blockers).toContain('missing-scale-endpoint');
	});

	it('rejects a blocked Scale endpoint that is not chained to an eligible Load run', () => {
		const scan = evidence('blocked');
		const readiness = buildAffinityScaleRecommendationReadiness({
			...scan,
			blockedScalePreflights: scan.blockedScalePreflights.map((preflight) => ({
				...preflight,
				prerequisiteRunIds: ['unaccepted-load-run']
			}))
		});
		expect(readiness.ready).toBe(false);
		expect(readiness.scaleEndpointSource).toBeNull();
		expect(readiness.blockers).toEqual(
			expect.arrayContaining([
				'blocked-scale-endpoint-missing-eligible-load-prerequisite',
				'missing-scale-endpoint'
			])
		);
	});

	it('binds exactly one eligible run per required level for a blocked-16 endpoint', () => {
		const readiness = buildAffinityScaleRecommendationReadiness(evidence('blocked'));
		const recommendation = buildAffinityScaleRecommendation(readiness, decision(12));

		expect(readiness.ready).toBe(true);
		expect(recommendation.sourceEffectiveConcurrencyLevels).toEqual([2, 4, 6, 8, 12]);
		expect(recommendation.sourceRuns).toHaveLength(5);
		expect(recommendation.scaleEndpointSource.kind).toBe('blocked-capacity');
		expect(AffinityScaleRecommendationV3Schema.safeParse(recommendation).success).toBe(true);
	});

	it('rejects unmeasured recommendations and never permits 16 from blocked capacity', () => {
		const readiness = buildAffinityScaleRecommendationReadiness(evidence('blocked'));
		expect(() => buildAffinityScaleRecommendation(readiness, decision(16))).toThrow(
			'Concurrency 16 requires an eligible completed Scale run'
		);
		expect(() => buildAffinityScaleRecommendation(readiness, decision(3))).toThrow();
	});

	it('permits 16 only when an eligible completed Scale run is hash-bound as a source', () => {
		const readiness = buildAffinityScaleRecommendationReadiness(evidence('completed'));
		const recommendation = buildAffinityScaleRecommendation(readiness, decision(16));

		expect(recommendation.sourceEffectiveConcurrencyLevels).toEqual([2, 4, 6, 8, 12, 16]);
		expect(recommendation.sourceRuns).toHaveLength(6);
		expect(recommendation.scaleEndpointSource).toMatchObject({
			kind: 'completed-scale',
			runId: run(16).runId,
			reportCanonicalSha256: run(16).reportCanonicalSha256
		});
	});

	it('requires explicit human acknowledgment and nonblank strategy text before write', async () => {
		const workspaceRoot = await temporaryWorkspace();
		const noAcknowledgment = await finalizeAffinityScaleRecommendation({
			workspaceRoot,
			mode: 'write',
			schedulerEvidence: evidence('blocked'),
			decision: { ...decision(), humanDecisionAcknowledged: false }
		});
		expect(noAcknowledgment.written).toBe(false);
		expect(noAcknowledgment.blockers).toContain('human-decision-not-acknowledged');

		const blankStrategy = await finalizeAffinityScaleRecommendation({
			workspaceRoot,
			mode: 'write',
			schedulerEvidence: evidence('blocked'),
			decision: { ...decision(), productionStrategy: '   ' }
		});
		expect(blankStrategy.written).toBe(false);
		expect(blankStrategy.blockers).toContain('invalid-decision:productionStrategy');
	});

	it('writes atomically once, is idempotent, and refuses different existing content', async () => {
		const workspaceRoot = await temporaryWorkspace();
		const first = await finalizeAffinityScaleRecommendation({
			workspaceRoot,
			mode: 'write',
			schedulerEvidence: evidence('blocked'),
			decision: decision()
		});
		expect(first).toMatchObject({ written: true, idempotent: false, inSync: true });
		const outputFile = path.resolve(workspaceRoot, AFFINITY_SCALE_RECOMMENDATION_PATH);
		const original = await readFile(outputFile, 'utf8');

		const second = await finalizeAffinityScaleRecommendation({
			workspaceRoot,
			mode: 'write',
			schedulerEvidence: evidence('blocked'),
			decision: decision()
		});
		expect(second).toMatchObject({ written: false, idempotent: true, inSync: true });

		const different = await finalizeAffinityScaleRecommendation({
			workspaceRoot,
			mode: 'write',
			schedulerEvidence: evidence('blocked'),
			decision: { ...decision(), productionStrategy: 'A different human decision.' }
		});
		expect(different.written).toBe(false);
		expect(different.blockers).toContain(
			'Scale recommendation already exists with different content; refusing to overwrite.'
		);
		expect(await readFile(outputFile, 'utf8')).toBe(original);
	});

	it('detects stale source hashes in an existing otherwise valid artifact', async () => {
		const workspaceRoot = await temporaryWorkspace();
		const initialEvidence = evidence('blocked');
		const artifact = buildAffinityScaleRecommendation(
			buildAffinityScaleRecommendationReadiness(initialEvidence),
			decision()
		);
		const outputFile = path.resolve(workspaceRoot, AFFINITY_SCALE_RECOMMENDATION_PATH);
		await mkdir(path.dirname(outputFile), { recursive: true });
		await writeFile(outputFile, `${JSON.stringify(artifact, null, '\t')}\n`);
		const staleEvidence: SchedulerEvidenceScan = {
			...initialEvidence,
			eligibleRuns: initialEvidence.eligibleRuns.map((item) =>
				item.effectiveConcurrency === 8 ? { ...item, reportCanonicalSha256: 'd'.repeat(64) } : item
			)
		};

		const report = await finalizeAffinityScaleRecommendation({
			workspaceRoot,
			mode: 'check',
			schedulerEvidence: staleEvidence
		});
		expect(report.artifactPresent).toBe(true);
		expect(report.artifactValid).toBe(false);
		expect(report.blockers).toContain('source-run-not-eligible-or-stale:breadth-exact-8');
	});

	it('rejects duplicate source levels even when all hashes are well formed', () => {
		const readiness = buildAffinityScaleRecommendationReadiness(evidence('blocked'));
		const valid = buildAffinityScaleRecommendation(readiness, decision());
		const duplicate = {
			...valid,
			sourceRuns: [...valid.sourceRuns.slice(0, 4), valid.sourceRuns[3]]
		};
		expect(AffinityScaleRecommendationV3Schema.safeParse(duplicate).success).toBe(false);
	});
});

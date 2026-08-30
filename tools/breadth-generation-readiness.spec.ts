import { lstat } from 'node:fs/promises';
import path from 'node:path';

import { ImageProductionTargetSchema } from '../packages/contracts/src/index.js';
import { beforeAll, describe, expect, it } from 'vitest';

import { AffinityWaveAllocationV2Schema } from './affinity-wave-allocation-v2.js';
import {
	BREADTH_GENERATION_ALLOCATION_V2_PATH,
	BreadthGenerationReadinessReportSchema,
	buildBreadthGenerationReadiness,
	inspectBreadthGenerationReadinessInput,
	parseBreadthGenerationReadinessArgs,
	reportBreadthGenerationReadiness,
	type BreadthGenerationReadinessInput
} from './breadth-generation-readiness.js';
import { sha256Json } from './image-production-lib.js';

let current: BreadthGenerationReadinessInput;

beforeAll(async () => {
	current = await inspectBreadthGenerationReadinessInput();
});

function validAllocation(input: BreadthGenerationReadinessInput) {
	return structuredClone(AffinityWaveAllocationV2Schema.parse(input.allocation));
}

function withAllocation(
	input: BreadthGenerationReadinessInput,
	allocation = validAllocation(input)
): BreadthGenerationReadinessInput {
	return {
		...input,
		allocation,
		allocationCanonicalSha256: sha256Json(allocation)
	};
}

function asUnstarted(input: BreadthGenerationReadinessInput): BreadthGenerationReadinessInput {
	const absentOutputPaths = new Set<string>();
	for (const artifact of input.targets) {
		const target = ImageProductionTargetSchema.parse(artifact.value);
		absentOutputPaths.add(target.output.candidatePath);
		absentOutputPaths.add(target.output.resultPath);
	}
	return { ...input, absentOutputPaths };
}

describe('Breadth generation readiness', () => {
	it('is strictly ready for all 24 current pairs with an exact injected v2 allocation', () => {
		const report = buildBreadthGenerationReadiness(withAllocation(asUnstarted(current)));
		expect(BreadthGenerationReadinessReportSchema.parse(report)).toEqual(report);
		expect(report.status).toBe('ready');
		expect(report.blockers).toEqual([]);
		expect(report.writesPerformed).toBe(0);
		expect(report.evidence).toMatchObject({
			targetCount: 24,
			assignmentCount: 24,
			validPairCount: 24,
			coordinateCount: 24,
			ownedOutputCount: 48,
			uniqueOwnedOutputCount: 48,
			absentOwnedOutputCount: 48,
			completedPairCount: 0,
			remainingPairCount: 24,
			skillTreesMatch: true,
			allocationStatus: 'verified',
			allocationCoveredPairCount: 24,
			allocationCanariesExact: true
		});
		expect(report.evidence.canaryCoordinates).toEqual([
			{ speciesId: 'goblin', affinity: 'normal' },
			{ speciesId: 'tunnel-boar', affinity: 'fire' }
		]);
		expect(
			report.evidence.references.every((reference) => reference.width && reference.height)
		).toBe(true);
	});

	it('fails closed when the installed skill is stale', () => {
		const report = buildBreadthGenerationReadiness(
			withAllocation({
				...current,
				installedSkillTreeSha256: 'a'.repeat(64),
				skillTreesMatch: false
			})
		);
		expect(report.status).toBe('blocked');
		expect(report.blockers).toContain('installed-skill-stale');
	});

	it('fails closed on colliding manifest-owned output paths', () => {
		const first = ImageProductionTargetSchema.parse(current.targets[0]!.value);
		const second = ImageProductionTargetSchema.parse(current.targets[1]!.value);
		const targets = current.targets.map((artifact, index) =>
			index === 0
				? {
						...artifact,
						value: {
							...first,
							output: second.output
						}
					}
				: artifact
		);
		const report = buildBreadthGenerationReadiness(withAllocation({ ...current, targets }));
		expect(report.status).toBe('blocked');
		expect(report.blockers).toContain('owned-output-collision');
		expect(report.blockers).toContain('breadth-target-manifest-invalid-or-drifted');
		expect(report.evidence.uniqueOwnedOutputCount).toBe(46);
	});

	it('fails closed on a partially occupied owned output pair', () => {
		const unstarted = asUnstarted(current);
		const absentOutputPaths = new Set(unstarted.absentOutputPaths);
		const target = ImageProductionTargetSchema.parse(current.targets[0]!.value);
		absentOutputPaths.delete(target.output.candidatePath);
		const report = buildBreadthGenerationReadiness(
			withAllocation({ ...unstarted, absentOutputPaths })
		);
		expect(report.status).toBe('blocked');
		expect(report.blockers).toContain('owned-output-partial');
		expect(report.evidence.absentOwnedOutputCount).toBe(47);
	});

	it('remains ready when a completed job owns both of its output paths', () => {
		const unstarted = asUnstarted(current);
		const absentOutputPaths = new Set(unstarted.absentOutputPaths);
		const target = ImageProductionTargetSchema.parse(current.targets[0]!.value);
		absentOutputPaths.delete(target.output.candidatePath);
		absentOutputPaths.delete(target.output.resultPath);
		const report = buildBreadthGenerationReadiness(
			withAllocation({ ...unstarted, absentOutputPaths })
		);
		expect(report.status).toBe('ready');
		expect(report.blockers).toEqual([]);
		expect(report.evidence).toMatchObject({
			absentOwnedOutputCount: 46,
			completedPairCount: 1,
			remainingPairCount: 23
		});
	});

	it('fails closed when a manifest coordinate is missing', () => {
		const missing = current.targets.slice(1);
		const report = buildBreadthGenerationReadiness(
			withAllocation({ ...current, targets: missing })
		);
		expect(report.status).toBe('blocked');
		expect(report.blockers).toContain('breadth-target-count');
		expect(report.blockers).toContain('breadth-target-manifest-invalid-or-drifted');
		expect(report.blockers).toContain('breadth-coordinate-set-mismatch');
	});

	it('rejects an allocation with the wrong exact canary pair', () => {
		const allocation = validAllocation(current);
		const canary = allocation.workloads.find(
			(workload) => workload.workloadId === 'breadth-canary'
		)!;
		const breadth = allocation.workloads.find((workload) => workload.workloadId === 'breadth')!;
		canary.jobs = [breadth.jobs[0]!, breadth.jobs[1]!];
		const wrong = allocation;
		const report = buildBreadthGenerationReadiness(withAllocation(current, wrong));
		expect(report.status).toBe('blocked');
		expect(report.blockers).toContain('allocation-v2-invalid');
		expect(report.blockers).toContain('allocation-v2-canary-mismatch');
		expect(report.evidence.allocationCanariesExact).toBe(false);
	});

	it('returns zero-write blocked evidence when the requested v2 allocation is absent', async () => {
		const missingPath = `${path.posix.dirname(BREADTH_GENERATION_ALLOCATION_V2_PATH)}/__breadth-readiness-missing__.json`;
		const absoluteAllocation = path.resolve(missingPath);
		await expect(lstat(absoluteAllocation)).rejects.toMatchObject({ code: 'ENOENT' });
		const report = await reportBreadthGenerationReadiness({ allocationPath: missingPath });
		expect(report.status).toBe('blocked');
		expect(report.blockers).toContain('allocation-v2-missing');
		expect(report.writesPerformed).toBe(0);
		await expect(lstat(absoluteAllocation)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('strictly parses only the optional allocation path', () => {
		expect(parseBreadthGenerationReadinessArgs([])).toEqual({
			allocationPath: BREADTH_GENERATION_ALLOCATION_V2_PATH
		});
		expect(
			parseBreadthGenerationReadinessArgs(['--', '--allocation', 'reviewed/allocation.json'])
		).toEqual({ allocationPath: 'reviewed/allocation.json' });
		expect(() => parseBreadthGenerationReadinessArgs(['--write'])).toThrow('Unknown argument');
		expect(() =>
			parseBreadthGenerationReadinessArgs(['--allocation', 'a.json', '--allocation', 'b.json'])
		).toThrow('exactly once');
	});
});

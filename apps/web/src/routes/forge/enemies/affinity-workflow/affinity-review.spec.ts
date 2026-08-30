import { describe, expect, it } from 'vitest';

import type { AffinityWorkflowReviewRecord } from '@summonlab/contracts';

import {
	AFFINITIES,
	SPECIES,
	buildBlindOrder,
	buildControlledRoundDefinition,
	buildFinalControlledRoundDefinition,
	findVerifiedMediaByOpaqueId,
	isPathWithin,
	loadAffinityReviewData,
	makeOpaqueId,
	parseControlledRoundId,
	parseAffinityReviewer,
	readPngDimensions,
	resolveAffinityReviewActor,
	summarizeAffinityReviews,
	targetBelongsToReviewSelection
} from './affinity-review';

const CONTROLLED_SPECIES = ['death-knight', 'elemental', 'grey-wolf', 'cave-bear'] as const;

function controlledTargets(suffix = '') {
	return CONTROLLED_SPECIES.flatMap((speciesId) =>
		AFFINITIES.map((affinity) => ({
			targetId: `affinity-workflow-v1-${speciesId}-${affinity}${suffix}`,
			cohort: 'controlled' as const,
			speciesId,
			affinity
		}))
	);
}

describe('affinity review helpers', () => {
	it('uses stable opaque media identifiers without semantic path fragments', () => {
		const hash = 'ae8c4b067ebadbed3621253e169e940213e6c6eb15663e4899b4ca6bde823d56';
		const targetId = 'affinity-workflow-v1-death-knight-fire';
		const id = makeOpaqueId(targetId, hash);
		expect(id).toMatch(/^[a-f0-9]{24}$/);
		expect(id).not.toContain('death');
		expect(makeOpaqueId(targetId, hash)).toBe(id);
		expect(makeOpaqueId('affinity-workflow-v1-elemental-fire', hash)).not.toBe(id);
	});

	it('rejects unknown controlled rounds', () => {
		expect(parseControlledRoundId(null)).toBe('baseline-v1');
		expect(parseControlledRoundId('final-controlled-v1')).toBe('final-controlled-v1');
		expect(() => parseControlledRoundId('latest')).toThrow('Unknown controlled round');
	});

	it('normalizes and validates the reviewer identity once per blind session', () => {
		expect(parseAffinityReviewer('  visual-director  ')).toBe('visual-director');
		expect(parseAffinityReviewer('')).toBeNull();
		expect(() => parseAffinityReviewer('bad\nreviewer')).toThrow('Invalid affinity reviewer');
	});

	it('uses a configured server-owned actor instead of accepting a client-selected reviewer', () => {
		expect(resolveAffinityReviewActor('visual-director', null)).toBe('visual-director');
		expect(resolveAffinityReviewActor('visual-director', ' visual-director ')).toBe(
			'visual-director'
		);
		expect(() => resolveAffinityReviewActor('visual-director', 'another-actor')).toThrow(
			'server-owned affinity review actor'
		);
		expect(resolveAffinityReviewActor(null, 'guest-reviewer')).toBe('guest-reviewer');
	});

	it('rejects duplicate controlled coordinates', () => {
		const targets = controlledTargets();
		targets[23] = {
			...targets[23]!,
			targetId: 'affinity-workflow-v1-duplicate-coordinate',
			speciesId: 'death-knight',
			affinity: 'normal'
		};
		expect(() => buildControlledRoundDefinition('baseline-v1', 'Baseline', targets)).toThrow(
			'Duplicate controlled coordinate'
		);
	});

	it('isolates controlled targets by exact round membership', () => {
		const baseline = buildControlledRoundDefinition('baseline-v1', 'Baseline', controlledTargets());
		const finalRound = buildControlledRoundDefinition(
			'final-controlled-v1',
			'Final',
			controlledTargets('-v4')
		);
		const baselineTarget = controlledTargets()[0]!;
		const finalTarget = controlledTargets('-v4')[0]!;
		expect(targetBelongsToReviewSelection(baselineTarget, baseline, 'controlled')).toBe(true);
		expect(targetBelongsToReviewSelection(finalTarget, baseline, 'controlled')).toBe(false);
		expect(targetBelongsToReviewSelection(finalTarget, finalRound, 'controlled')).toBe(true);
		expect(targetBelongsToReviewSelection(baselineTarget, finalRound, 'all')).toBe(false);
		expect(
			targetBelongsToReviewSelection({ ...finalTarget, cohort: 'breadth' }, baseline, 'all')
		).toBe(true);
	});

	it('derives a final round only from all 24 matching plan-owned manifests', () => {
		const targets = controlledTargets('-v4');
		const plannedTargets = targets.map((target) => ({
			key: `${target.speciesId}-${target.affinity}-v4`,
			speciesId: target.speciesId,
			affinity: target.affinity,
			version: 'v4'
		}));
		const templates = {
			target:
				'assets/enemies/experiments/affinity-workflow-v1/targets/final-controlled/{speciesId}/{affinity}-{version}.json',
			candidate:
				'assets/enemies/experiments/affinity-workflow-v1/candidates/final-controlled/{speciesId}/{affinity}-{version}.png',
			result:
				'assets/enemies/experiments/affinity-workflow-v1/results/final-controlled/{speciesId}-{affinity}-{version}.json'
		};
		const render = (template: string, target: (typeof plannedTargets)[number]) =>
			template
				.replace('{speciesId}', target.speciesId)
				.replace('{affinity}', target.affinity)
				.replace('{version}', target.version);
		const plan = {
			experimentId: 'affinity-workflow-v1',
			targetCount: 24,
			targets: plannedTargets,
			plannedPathTemplates: templates
		};
		const manifests = plannedTargets.map((planned) => {
			const targetId = `affinity-workflow-v1-${planned.key}`;
			return {
				path: render(templates.target, planned),
				value: {
					schemaVersion: 'image-production-target-v1',
					experimentId: 'affinity-workflow-v1',
					targetId,
					assetId: targetId,
					cohort: 'controlled',
					speciesId: planned.speciesId,
					affinity: planned.affinity,
					references: [],
					output: {
						candidatePath: render(templates.candidate, planned),
						resultPath: render(templates.result, planned)
					}
				}
			};
		});
		const round = buildFinalControlledRoundDefinition(plan, manifests);
		expect(round.targetIds['death-knight'].normal).toBe(
			'affinity-workflow-v1-death-knight-normal-v4'
		);
		expect(() => buildFinalControlledRoundDefinition(plan, manifests.slice(1))).toThrow(
			'requires all 24 live target manifests'
		);
		expect(() =>
			buildFinalControlledRoundDefinition(plan, [
				{ ...manifests[0]!, value: { ...manifests[0]!.value, affinity: 'fire' } },
				...manifests.slice(1)
			])
		).toThrow('does not match its plan');
	});

	it('shuffles blind coordinates deterministically', () => {
		const items = [{ id: 'normal' }, { id: 'wood' }, { id: 'fire' }, { id: 'metal' }];
		const first = buildBlindOrder(items, 'row-one');
		const second = buildBlindOrder(items, 'row-one');
		expect(first).toEqual(second);
		expect(first.map((item) => item.id).sort()).toEqual(items.map((item) => item.id).sort());
		expect(first).not.toEqual(items);
	});

	it('rejects paths outside the experiment directory', () => {
		expect(
			isPathWithin('/repo/assets/experiment', '/repo/assets/experiment/candidates/a.png')
		).toBe(true);
		expect(isPathWithin('/repo/assets/experiment', '/repo/assets/review/a.png')).toBe(false);
		expect(isPathWithin('/repo/assets/experiment', '/repo/assets/experiment')).toBe(false);
	});

	it('reads dimensions only from PNG headers', () => {
		const png = new Uint8Array(24);
		png.set([0x89, 0x50, 0x4e, 0x47], 0);
		const view = new DataView(png.buffer);
		view.setUint32(16, 1536);
		view.setUint32(20, 1024);
		expect(readPngDimensions(png)).toEqual({ width: 1536, height: 1024 });
		expect(readPngDimensions(new Uint8Array(24))).toBeNull();
	});

	it('loads partial workspace artifacts and strips blind semantic metadata', async () => {
		const data = await loadAffinityReviewData(true, [], 'controlled');
		expect(data.targetCount).toBe(24);
		expect(data.scope).toBe('controlled');
		expect(data.rows).toHaveLength(4);
		expect(data.rows.flatMap((row) => row.cells)).toHaveLength(24);
		expect(data.verifiedCandidateCount).toBeGreaterThan(0);
		const candidate = data.rows.flatMap((row) => row.cells).find((cell) => cell.mediaUrl);
		expect(candidate?.labels).toBeNull();
		expect(candidate?.metadata).toBeNull();
		expect(candidate?.alt).toBe('Unlabeled experiment candidate');
		expect(JSON.stringify(data.rows)).not.toContain('death-knight');
		expect(JSON.stringify(data.rows)).not.toContain('normal-v1.png');
		const reviseEvidence = data.rows
			.flatMap((row) => row.cells)
			.find((cell) => cell.status === 'revise');
		expect(reviseEvidence?.mediaUrl).toMatch(
			/^\/forge\/enemies\/affinity-workflow\/media\/[a-f0-9]{24}\?round=baseline-v1&scope=controlled$/u
		);

		const opaqueId = candidate?.mediaUrl?.split('/').at(-1)?.split('?')[0];
		expect(opaqueId).toMatch(/^[a-f0-9]{24}$/);
		const binding = await findVerifiedMediaByOpaqueId(opaqueId!);
		expect(binding).toEqual(
			expect.objectContaining({
				path: expect.any(String),
				targetId: expect.any(String),
				contentHash: expect.stringMatching(/^[a-f0-9]{64}$/)
			})
		);
	});

	it('keeps baseline as the runtime default even when later rounds become available', async () => {
		const baseline = await loadAffinityReviewData(true, [], 'controlled', 'baseline-v1');
		expect(baseline.controlledRound).toEqual({ id: 'baseline-v1', label: 'Baseline v1' });
		expect(baseline.availableControlledRounds).toContainEqual({
			id: 'baseline-v1',
			label: 'Baseline v1'
		});
		expect(JSON.stringify(baseline.rows)).not.toContain('final-controlled');
	});

	it('counts only server-derived blind records in blind mode', async () => {
		const base: AffinityWorkflowReviewRecord = {
			reviewId: '5a0e7f4e-c8f5-4fca-82a7-116217626597',
			experimentId: 'affinity-workflow-v1',
			targetId: 'affinity-workflow-v1-death-knight-fire',
			candidateContentHash: 'ae8c4b067ebadbed3621253e169e940213e6c6eb15663e4899b4ca6bde823d56',
			reviewer: 'visual-director',
			reviewMode: 'api-unverified',
			identifiedSpeciesId: 'death-knight',
			identifiedAffinity: 'fire',
			scores: {
				speciesIdentity: 5,
				affinityReadability: 5,
				silhouetteAndDuty: 5,
				materialCredibility: 5,
				anatomyAndGroundContact: 5,
				affinityIntegration: 5,
				styleCohesion: 5
			},
			verdict: 'candidate',
			note: 'Unverified API evidence.',
			reviewedAt: '2026-08-29T18:00:00.000Z'
		};
		const blind = await loadAffinityReviewData(true, [base], 'controlled');
		const blindCell = blind.rows.flatMap((row) => row.cells).find((cell) => cell.mediaUrl);
		expect(blindCell?.reviewState.count).toBe(0);
		const labeled = await loadAffinityReviewData(false, [base]);
		const labeledCell = labeled.rows
			.flatMap((row) => row.cells)
			.find((cell) => cell.labels?.targetId === base.targetId);
		expect(labeledCell?.reviewState.count).toBe(1);
	});

	it('scopes progress and resume to the active reviewer and current candidate hash', async () => {
		const empty = await loadAffinityReviewData(true, [], 'controlled', 'baseline-v1', 'alice');
		const cell = empty.rows
			.flatMap((row) => row.cells)
			.find((entry) => entry.status === 'candidate')!;
		const opaqueId = cell.mediaUrl!.split('/').at(-1)!.split('?')[0]!;
		const binding = await findVerifiedMediaByOpaqueId(opaqueId);
		const review: AffinityWorkflowReviewRecord = {
			reviewId: '77777777-7777-4777-8777-777777777777',
			experimentId: 'affinity-workflow-v1',
			targetId: binding!.targetId,
			candidateContentHash: binding!.contentHash,
			reviewer: 'alice',
			reviewMode: 'blind',
			identifiedSpeciesId: 'death-knight',
			identifiedAffinity: 'fire',
			scores: {
				speciesIdentity: 3,
				affinityReadability: 3,
				silhouetteAndDuty: 3,
				materialCredibility: 3,
				anatomyAndGroundContact: 3,
				affinityIntegration: 3,
				styleCohesion: 3
			},
			verdict: 'candidate',
			note: 'Blind reviewer evidence.',
			reviewedAt: '2026-08-29T20:00:00.000Z'
		};
		const alice = await loadAffinityReviewData(
			true,
			[review],
			'controlled',
			'baseline-v1',
			'alice'
		);
		const bob = await loadAffinityReviewData(true, [review], 'controlled', 'baseline-v1', 'bob');
		expect(alice.reviewedCandidateCount).toBe(1);
		expect(alice.remainingCandidateCount).toBe(20);
		expect(bob.reviewedCandidateCount).toBe(0);
		expect(bob.remainingCandidateCount).toBe(21);
		expect(alice.nextUnreviewedCellId).not.toBe(cell.id);
	});

	it('keeps versioned correction targets in distinct sparse regression rows', async () => {
		const data = await loadAffinityReviewData(false);
		const regressionRows = data.rows.filter((row) => row.cohort === 'regression');
		expect(regressionRows).toHaveLength(6);
		expect(regressionRows.map((row) => row.rowLabel)).toEqual([
			'Bound Vanguard Elemental · semantic v2',
			'Death Knight · metal correction v2',
			'Death Knight · metal framing v3',
			'Grey Wolf · fire correction v2',
			'Cave Bear · framing corrections v2',
			'Bound Vanguard Elemental · fire framing v3'
		]);

		const semanticV2 = regressionRows[0]!;
		expect(semanticV2.cells.map((cell) => cell.labels?.targetId)).toEqual(
			AFFINITIES.map((affinity) => `affinity-workflow-v1-elemental-${affinity}-v2`)
		);
		const sparseTargetIds = regressionRows
			.slice(1)
			.flatMap((row) =>
				Object.values(SPECIES.find((entry) => entry.name === row.rowLabel)?.targetIds ?? {})
			);
		expect(sparseTargetIds).toEqual(
			expect.arrayContaining([
				'affinity-workflow-v1-death-knight-metal-v2',
				'affinity-workflow-v1-death-knight-metal-v3',
				'affinity-workflow-v1-grey-wolf-fire-v2',
				'affinity-workflow-v1-cave-bear-wood-v2',
				'affinity-workflow-v1-cave-bear-wind-v2',
				'affinity-workflow-v1-elemental-fire-v3'
			])
		);

		for (const row of regressionRows.slice(1)) {
			const declaredTargetIds = new Set(
				Object.values(SPECIES.find((entry) => entry.name === row.rowLabel)?.targetIds ?? {})
			);
			const resolvedCells = row.cells.filter((cell) => cell.labels);
			expect(resolvedCells.map((cell) => cell.labels?.targetId)).toEqual(
				expect.arrayContaining([...declaredTargetIds])
			);
			expect(resolvedCells).toHaveLength(declaredTargetIds.size);
			for (const cell of row.cells.filter((candidate) => !candidate.labels)) {
				expect(cell).toEqual(
					expect.objectContaining({ mediaUrl: null, metadata: null, status: 'pending' })
				);
			}
		}
	});

	it('reduces blind review history to neutral state without guesses or hash bindings', () => {
		const review: AffinityWorkflowReviewRecord = {
			reviewId: '5a0e7f4e-c8f5-4fca-82a7-116217626597',
			experimentId: 'affinity-workflow-v1',
			targetId: 'affinity-workflow-v1-death-knight-fire',
			candidateContentHash: 'a'.repeat(64),
			reviewer: 'Blind reviewer whose name must stay private',
			reviewMode: 'blind',
			identifiedSpeciesId: 'death-knight',
			identifiedAffinity: 'fire',
			scores: {
				speciesIdentity: 4,
				affinityReadability: 5,
				silhouetteAndDuty: 4,
				materialCredibility: 3,
				anatomyAndGroundContact: 4,
				affinityIntegration: 5,
				styleCohesion: 4
			},
			verdict: 'candidate',
			note: 'This note could reveal the answer.',
			reviewedAt: '2026-08-29T18:00:00.000Z'
		};
		const summary = summarizeAffinityReviews([review], true);
		expect(summary).toEqual({ count: 1, latestAt: review.reviewedAt });
		const serialized = JSON.stringify(summary);
		expect(serialized).not.toContain(review.targetId);
		expect(serialized).not.toContain(review.candidateContentHash);
		expect(serialized).not.toContain(review.identifiedSpeciesId);
		expect(serialized).not.toContain(review.identifiedAffinity);
		expect(serialized).not.toContain(review.reviewer);
		expect(serialized).not.toContain(review.note);
	});
});

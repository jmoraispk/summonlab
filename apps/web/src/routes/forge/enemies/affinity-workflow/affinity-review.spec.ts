import { describe, expect, it } from 'vitest';

import type { AffinityWorkflowReviewRecord } from '@summonlab/contracts';

import {
	AFFINITIES,
	SPECIES,
	buildBlindOrder,
	findVerifiedMediaByOpaqueId,
	isPathWithin,
	loadAffinityReviewData,
	makeOpaqueId,
	readPngDimensions,
	summarizeAffinityReviews
} from './affinity-review';

describe('affinity review helpers', () => {
	it('uses stable opaque media identifiers without semantic path fragments', () => {
		const id = makeOpaqueId('ae8c4b067ebadbed3621253e169e940213e6c6eb15663e4899b4ca6bde823d56');
		expect(id).toMatch(/^[a-f0-9]{24}$/);
		expect(id).not.toContain('death');
		expect(makeOpaqueId('ae8c4b067ebadbed3621253e169e940213e6c6eb15663e4899b4ca6bde823d56')).toBe(
			id
		);
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
		const data = await loadAffinityReviewData(true);
		expect(data.targetCount).toBe(60);
		expect(data.rows).toHaveLength(14);
		expect(data.rows.flatMap((row) => row.cells)).toHaveLength(84);
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
			/^\/forge\/enemies\/affinity-workflow\/media\/[a-f0-9]{24}$/u
		);

		const opaqueId = candidate?.mediaUrl?.split('/').at(-1);
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

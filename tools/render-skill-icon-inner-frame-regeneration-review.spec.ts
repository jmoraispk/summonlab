import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderSkillIconInnerFrameRegenerationReview } from './render-skill-icon-inner-frame-regeneration-review.js';

const REVIEW_ROOT =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v12-inner-frame-regeneration-scale';

describe('inner-frame regeneration review', () => {
	it('binds the same 23 accepted sources to V11 100% and V12 90% composites', async () => {
		const rendered = await renderSkillIconInnerFrameRegenerationReview({ mode: 'check' });
		const report = JSON.parse(
			await readFile(path.join(process.cwd(), REVIEW_ROOT, 'report.json'), 'utf8')
		) as {
			status: string;
			scope: { regenerated: number; borderlineUntouched: number };
			assembly: {
				frameIsFinalLayer: boolean;
				compositionProfile: string;
				artworkScale: number;
				preparedSource: { width: number; height: number; left: number; top: number };
			};
			sequence: {
				mode: string;
				executionOrder: { step: number; targetId: string; attempts: number }[];
			};
			records: {
				targetId: string;
				comparisonBaselinePath: string;
				comparisonBaselineHash: string;
				sourceBinding: {
					v11Path: string;
					v11ContentHash: string;
					matches: boolean;
				};
				source: { width: number; height: number; alphaMode: string; contentHash: string };
				candidateHash: string;
				apertureCoverage: {
					expectedPixels: number;
					coveredPixels: number;
					complete: boolean;
				};
				generationAttempts: { status: string; path: string; contentHash: string }[];
				inspection: {
					layerHashesMatch: boolean;
					exactComposite: boolean;
					protectedBandMatches: boolean;
					exteriorTransparent: boolean;
					backingOnlyComponents: unknown[];
				};
			}[];
		};

		expect(rendered.reviewFiles).toHaveLength(29);
		expect(report.status).toBe('owner-approved-less-zoom-review-not-promoted');
		expect(report.scope).toEqual({ regenerated: 23, borderlineUntouched: 5 });
		expect(report.assembly).toMatchObject({
			frameIsFinalLayer: true,
			compositionProfile: 'frame-opening-v3',
			artworkScale: 0.9,
			preparedSource: { width: 922, height: 922, left: 51, top: 51 }
		});
		expect(report.sequence.mode).toBe('sequential');
		expect(report.sequence.executionOrder).toHaveLength(23);
		expect(report.sequence.executionOrder.map((entry) => entry.step)).toEqual(
			Array.from({ length: 23 }, (_, index) => index + 1)
		);
		expect(report.sequence.executionOrder.reduce((sum, entry) => sum + entry.attempts, 0)).toBe(27);
		expect(report.records).toHaveLength(23);
		expect(new Set(report.records.map((record) => record.targetId)).size).toBe(23);
		for (const record of report.records) {
			expect(record.comparisonBaselinePath).toContain(
				'/review/v11-inner-frame-regeneration/candidates/'
			);
			expect(record.comparisonBaselineHash).toMatch(/^[a-f0-9]{64}$/u);
			expect(record.sourceBinding).toEqual({
				v11Path: record.sourceBinding.v11Path,
				v11ContentHash: record.sourceBinding.v11ContentHash,
				matches: true
			});
			expect(record.sourceBinding.v11Path).toContain('/provider-sources/');
			expect(record.sourceBinding.v11ContentHash).toMatch(/^[a-f0-9]{64}$/u);
			expect(record.source).toMatchObject({ width: 1254, height: 1254, alphaMode: 'rgb' });
			expect(record.source.contentHash).toMatch(/^[a-f0-9]{64}$/u);
			expect(record.candidateHash).toMatch(/^[a-f0-9]{64}$/u);
			expect(record.apertureCoverage.expectedPixels).toBeGreaterThan(0);
			expect(record.apertureCoverage).toMatchObject({
				coveredPixels: record.apertureCoverage.expectedPixels,
				complete: true
			});
			expect(record.generationAttempts.filter((attempt) => attempt.status === 'accepted')).toEqual([
				expect.objectContaining({
					path: expect.any(String),
					contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
				})
			]);
			expect(record.inspection).toEqual({
				layerHashesMatch: true,
				exactComposite: true,
				protectedBandMatches: true,
				exteriorTransparent: true,
				backingOnlyComponents: []
			});
		}
	}, 120_000);
});

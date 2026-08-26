import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { StoryWorkshopSourceSchema } from './story-workshop.js';
import { createStoryWorkshopReport } from './story-workshop.js';

const fixture = StoryWorkshopSourceSchema.parse(
	JSON.parse(
		readFileSync(new URL('../fixtures/story-workshop-band-02-v1.json', import.meta.url), 'utf8')
	)
);

const criteria = [
	'causality',
	'mechanical-fit',
	'emotional-arc',
	'character-agency',
	'production-scope',
	'envelope-compile'
] as const;

function acceptedReview(proposalIndex: number) {
	const proposal = fixture.proposals[proposalIndex]!;
	return {
		proposalId: proposal.proposalId,
		proposalVersion: proposal.proposalVersion,
		status: 'accepted' as const,
		summary:
			'The proposal passes the complete editorial rubric and may enter envelope compilation.',
		criteria: criteria.map((criterion) => ({
			criterion,
			verdict: 'pass' as const,
			note: `${criterion} has explicit evidence in the versioned proposal.`
		}))
	};
}

describe('development story workshop', () => {
	it('produces versioned review packets without claiming canonical content', () => {
		const first = createStoryWorkshopReport(fixture);
		const second = createStoryWorkshopReport(fixture);

		expect(first.status).toBe('generated');
		expect(first.summary).toEqual({
			proposalCount: 2,
			validForReviewCount: 2,
			pendingReviewCount: 2,
			acceptedCount: 0,
			readyForCompilationCount: 0
		});
		expect(first.authorityBoundary).toEqual({
			developmentOnly: true,
			proposalsAreCanonical: false,
			modelMayMutateRuntime: false,
			acceptedContentRequiresDeveloperReview: true,
			acceptedContentRequiresEnvelopeCompilation: true
		});
		expect(first.proposals.every((proposal) => proposal.validationChecks.length === 10)).toBe(true);
		expect(first.reportHash).toBe(second.reportHash);
	});

	it('rejects catalog drift before editorial review', () => {
		const source = structuredClone(fixture);
		source.proposals[0]!.floors[0]!.mechanicIds = ['invented-omniscience'];
		const report = createStoryWorkshopReport(source);
		const proposal = report.proposals[0]!;

		expect(report.status).toBe('blocked');
		expect(proposal.validForReview).toBe(false);
		expect(
			proposal.validationChecks.find((check) => check.checkId === 'mechanic-catalog')?.passed
		).toBe(false);
	});

	it('allows a fully reviewed production-ready proposal to enter compilation', () => {
		const source = structuredClone(fixture);
		source.reviews = [acceptedReview(0)];
		const report = createStoryWorkshopReport(source);

		expect(report.status).toBe('accepted-for-compilation');
		expect(report.summary.acceptedCount).toBe(1);
		expect(report.summary.readyForCompilationCount).toBe(1);
		expect(report.proposals[0]!.readyForCompilation).toBe(true);
	});

	it('keeps an accepted proposal with prototype dependencies out of compilation', () => {
		const source = structuredClone(fixture);
		source.reviews = [acceptedReview(1)];
		const report = createStoryWorkshopReport(source);

		expect(report.status).toBe('under-review');
		expect(report.proposals[1]!.productionWarnings).toEqual([
			'Prototype mechanic requires production proof: protect-objective',
			'Prototype mechanic requires production proof: split-party-relay'
		]);
		expect(report.proposals[1]!.readyForCompilation).toBe(false);
	});

	it('does not let scripted evidence impersonate a provider run', () => {
		const source = structuredClone(fixture) as unknown as Record<string, unknown>;
		const generation = source.generation as Record<string, unknown>;
		generation.requestedModel = 'pretend-model';

		expect(() => StoryWorkshopSourceSchema.parse(source)).toThrow(
			'A scripted fixture cannot claim provider or model provenance'
		);
	});
});

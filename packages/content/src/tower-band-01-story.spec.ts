import {
	TowerBandStoryEnvelopeSchema,
	type CharacterMind,
	type StoryExpressionCastMember
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	TOWER_BAND_01_STORY_ENVELOPE,
	calculateTowerBandStoryContentHash,
	evaluateStoryBeatEligibility,
	loadTowerBand01StoryEnvelope,
	resolveStoryExpression
} from './tower-band-01-story.js';

function mind(
	overrides: Partial<CharacterMind> &
		Pick<CharacterMind, 'primaryValue' | 'primaryDrive' | 'socialStyle'>
): CharacterMind {
	return {
		personality: {
			openness: 60,
			conscientiousness: 60,
			extraversion: 50,
			agreeableness: 55,
			emotionalVolatility: 35
		},
		stressResponse: 'prepare',
		dailyHabit: 'checks-exits',
		aptitudes: { might: 5, finesse: 5, insight: 5, resolve: 5 },
		...overrides
	};
}

function castMember(
	characterId: string,
	displayName: string,
	characterMind: CharacterMind,
	knownAnchorIds: string[]
): StoryExpressionCastMember {
	return {
		characterId,
		displayName,
		lifeState: 'active',
		mind: characterMind,
		knownAnchorIds
	};
}

describe('Tower Band 01 story envelope', () => {
	it('binds the five-floor spine, fixed rewards, patch points, and expression hooks by hash', async () => {
		const envelope = await loadTowerBand01StoryEnvelope();

		expect(envelope).toBe(TOWER_BAND_01_STORY_ENVELOPE);
		expect(await calculateTowerBandStoryContentHash(envelope)).toBe(envelope.contentHash);
		expect(envelope.contentCatalog.missionBindings.map((binding) => binding.floor)).toEqual([
			1, 2, 3, 4, 5
		]);
		expect(envelope.beats).toHaveLength(35);
		expect(envelope.defaultBeatOrder).toHaveLength(25);
		expect(envelope.anchors).toHaveLength(25);
		expect(envelope.proposals).toHaveLength(10);
		expect(envelope.patchSlots).toHaveLength(5);
		expect(envelope.expressionHooks).toHaveLength(5);
		expect(envelope.rewardBudget).toEqual({ budgetPoints: 1_010, declaredCost: 1_010 });
		expect(Object.isFrozen(envelope)).toBe(true);
	});

	it('compiles a causal cross-floor route and exposes only eligible beats', () => {
		const envelope = TOWER_BAND_01_STORY_ENVELOPE;
		const floor01Default = envelope.defaultBeatOrder.filter(
			(beatId) => envelope.beats.find((beat) => beat.beatId === beatId)?.floor === 1
		);
		const floor02Opening = envelope.beats.find(
			(beat) => beat.floor === 2 && beat.kind === 'opening'
		)!;
		expect(floor02Opening.eligibleAfterBeatIds).toEqual([floor01Default.at(-1)]);

		const opening = evaluateStoryBeatEligibility(envelope, {
			historyVersion: 'story-beat-history-v1',
			unlockedFloor: 1,
			completedBeatIds: [],
			activatedProposalIds: []
		});
		expect(opening.nextDefaultBeatId).toBe(floor01Default[0]);
		expect(opening.records.find((record) => record.beatId === floor02Opening.beatId)?.status).toBe(
			'locked-floor'
		);

		const afterFloor01 = evaluateStoryBeatEligibility(envelope, {
			historyVersion: 'story-beat-history-v1',
			unlockedFloor: 2,
			completedBeatIds: floor01Default,
			activatedProposalIds: []
		});
		expect(afterFloor01.nextDefaultBeatId).toBe(floor02Opening.beatId);
		expect(
			afterFloor01.records.find((record) => record.beatId === floor02Opening.beatId)
		).toMatchObject({ status: 'eligible', missingDependencyIds: [] });
	});

	it('keeps optional beats dormant until one authored proposal is activated', () => {
		const envelope = TOWER_BAND_01_STORY_ENVELOPE;
		const floor04 = envelope.beats.filter((beat) => beat.floor === 4);
		const floor04Pressure = floor04.find((beat) => beat.kind === 'pressure')!;
		const prerequisiteBeatIds = envelope.defaultBeatOrder.slice(
			0,
			envelope.defaultBeatOrder.indexOf(floor04Pressure.beatId) + 1
		);
		const slot = envelope.patchSlots.find((candidate) => candidate.floor === 4)!;
		const selectedProposalId = slot.allowedProposalIds[0]!;
		const selectedBeatId = envelope.proposals.find(
			(proposal) => proposal.proposalId === selectedProposalId
		)!.beatId;

		const report = evaluateStoryBeatEligibility(envelope, {
			historyVersion: 'story-beat-history-v1',
			unlockedFloor: 4,
			completedBeatIds: prerequisiteBeatIds,
			activatedProposalIds: [selectedProposalId]
		});
		expect(report.records.find((record) => record.beatId === selectedBeatId)).toMatchObject({
			status: 'eligible',
			activatedByProposalId: selectedProposalId
		});
		const dormantBeatId = envelope.proposals.find(
			(proposal) => proposal.proposalId === slot.allowedProposalIds[1]
		)!.beatId;
		expect(report.records.find((record) => record.beatId === dormantBeatId)?.status).toBe(
			'optional-dormant'
		);

		expect(() =>
			evaluateStoryBeatEligibility(envelope, {
				historyVersion: 'story-beat-history-v1',
				unlockedFloor: 4,
				completedBeatIds: prerequisiteBeatIds,
				activatedProposalIds: slot.allowedProposalIds
			})
		).toThrow('selection bound exceeded');
		expect(() =>
			evaluateStoryBeatEligibility(envelope, {
				historyVersion: 'story-beat-history-v1',
				unlockedFloor: 4,
				completedBeatIds: [],
				activatedProposalIds: [selectedProposalId]
			})
		).toThrow('has not reached its opening anchor');
		const throughConfrontation = envelope.defaultBeatOrder.slice(
			0,
			envelope.defaultBeatOrder.indexOf(
				floor04.find((beat) => beat.kind === 'confrontation')!.beatId
			) + 1
		);
		expect(() =>
			evaluateStoryBeatEligibility(envelope, {
				historyVersion: 'story-beat-history-v1',
				unlockedFloor: 4,
				completedBeatIds: throughConfrontation,
				activatedProposalIds: [selectedProposalId]
			})
		).toThrow('expired before its selected beat');
	});

	it('rejects impossible histories and invalid envelope dependencies', () => {
		const envelope = TOWER_BAND_01_STORY_ENVELOPE;
		expect(() =>
			evaluateStoryBeatEligibility(envelope, {
				historyVersion: 'story-beat-history-v1',
				unlockedFloor: 1,
				completedBeatIds: [envelope.defaultBeatOrder[1]!],
				activatedProposalIds: []
			})
		).toThrow('lacks its causal dependency');

		const invalid = structuredClone(envelope);
		const optional = invalid.beats.filter((beat) => beat.floor === 1 && !beat.required);
		optional[0]!.eligibleAfterBeatIds = [optional[1]!.beatId];
		optional[1]!.eligibleAfterBeatIds = [optional[0]!.beatId];
		const result = TowerBandStoryEnvelopeSchema.safeParse(invalid);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.map((issue) => issue.message)).toContain(
				'Band story dependency graph contains a cycle'
			);
		}
	});

	it('changes voice and framing without changing or leaking the established fact', () => {
		const envelope = TOWER_BAND_01_STORY_ENVELOPE;
		const hook = envelope.expressionHooks[3]!;
		const anchor = envelope.anchors.find((candidate) => candidate.anchorId === hook.anchorId)!;
		const dutyHero = castMember(
			'11111111-1111-4111-a111-111111111111',
			'Rian Vale',
			mind({
				primaryValue: 'duty',
				primaryDrive: 'protect',
				socialStyle: 'direct',
				personality: {
					openness: 35,
					conscientiousness: 92,
					extraversion: 64,
					agreeableness: 62,
					emotionalVolatility: 28
				},
				aptitudes: { might: 7, finesse: 5, insight: 5, resolve: 9 }
			}),
			[anchor.anchorId]
		);
		const inquiryHero = castMember(
			'22222222-2222-4222-a222-222222222222',
			'Neri Quill',
			mind({
				primaryValue: 'knowledge',
				primaryDrive: 'understand',
				socialStyle: 'inquisitive',
				personality: {
					openness: 95,
					conscientiousness: 68,
					extraversion: 46,
					agreeableness: 58,
					emotionalVolatility: 22
				},
				aptitudes: { might: 3, finesse: 6, insight: 10, resolve: 6 }
			}),
			[anchor.anchorId]
		);

		const dutyExpression = resolveStoryExpression(envelope, hook.hookId, [dutyHero])!;
		const inquiryExpression = resolveStoryExpression(envelope, hook.hookId, [inquiryHero])!;
		expect(dutyExpression.frame).toBe('operational');
		expect(inquiryExpression.frame).toBe('analytical');
		expect(dutyExpression.spokenLine).not.toBe(inquiryExpression.spokenLine);
		for (const expression of [dutyExpression, inquiryExpression]) {
			expect(expression.immutableFact).toBe(anchor.immutableFact);
			expect(expression.spokenLine.endsWith(anchor.immutableFact)).toBe(true);
		}

		expect(
			resolveStoryExpression(envelope, hook.hookId, [
				{ ...dutyHero, knownAnchorIds: [] },
				{ ...inquiryHero, lifeState: 'dead' }
			])
		).toBeNull();
	});
});

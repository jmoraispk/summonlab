import { generateSummonableCompany } from '@summonlab/characters';
import { CampaignRunSchema, type CampaignObjectiveProjection } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	projectCampaignHeroForPublic,
	projectCampaignObjectivesForPublic,
	projectCampaignRunForPublic
} from './campaign.js';

describe('public campaign projections', () => {
	it('publishes identity and demeanor without draft recipes, mind records, or private hashes', async () => {
		const heroes = await generateSummonableCompany('public-campaign-boundary', 3);
		const campaign = CampaignRunSchema.parse({
			runId: '00000000-0000-4000-8000-000000000001',
			campaignSeed: 'public-campaign-boundary',
			controlMode: 'wait',
			lifecycle: 'active',
			engineStatus: 'active',
			onboardingStep: 2,
			restartedFromRunId: null,
			heroes: heroes.map((draft, index) => ({ ordinal: index + 1, draft })),
			createdAt: '2026-09-06T00:00:00.000Z',
			updatedAt: '2026-09-06T00:00:00.000Z'
		});
		(campaign.heroes[0]!.draft.mind as unknown as Record<string, unknown>).futureSecret =
			'private-campaign-mind-sentinel';
		(campaign.heroes[0]!.draft.manifest as unknown as Record<string, unknown>).futureSecret =
			'private-campaign-manifest-sentinel';

		const run = projectCampaignRunForPublic(campaign);
		const hero = projectCampaignHeroForPublic(campaign.heroes[0]!, null);
		const serialized = JSON.stringify({ run, hero });
		expect(serialized).not.toContain('private-campaign');
		expect(serialized).not.toContain('manifestHash');
		expect(serialized).not.toContain('campaignSeed');
		expect(serialized).not.toContain('recipe');
		expect(serialized).not.toContain('mind');
		expect(serialized).not.toContain('personality');
		expect(Object.keys(hero).sort()).toEqual(
			['ordinal', 'manifest', 'publicManifestHash', 'demeanor', 'firstReply'].sort()
		);
		expect(Object.keys(hero.demeanor).sort()).toEqual(
			['summary', 'dailyRhythm', 'underPressure', 'drive'].sort()
		);
	});

	it('hashes only the explicit public objective projection', () => {
		const internal = {
			projectionVersion: 'campaign-objectives-v1',
			runId: '00000000-0000-4000-8000-000000000001',
			stateHash: 'a'.repeat(64),
			activeObjectiveId: 'objective-one',
			completedCount: 0,
			objectives: Array.from({ length: 7 }, (_, index) => ({
				objectiveId: `objective-${index + 1}`,
				chapter: 'A chapter',
				title: `Objective ${index + 1}`,
				detail: 'A public objective.',
				status: index === 0 ? ('current' as const) : ('locked' as const),
				evidence: []
			})),
			projectionHash: 'b'.repeat(64)
		} satisfies CampaignObjectiveProjection;
		const baseline = projectCampaignObjectivesForPublic(internal);
		const hiddenChange = projectCampaignObjectivesForPublic({
			...internal,
			stateHash: 'c'.repeat(64),
			projectionHash: 'd'.repeat(64)
		});
		expect(hiddenChange).toEqual(baseline);
		expect(JSON.stringify(baseline)).not.toContain('stateHash');
		expect(JSON.stringify(baseline)).not.toContain('projectionHash');

		const publicChange = projectCampaignObjectivesForPublic({
			...internal,
			objectives: internal.objectives.map((objective, index) =>
				index === 0 ? { ...objective, title: 'Changed public title' } : objective
			)
		});
		expect(publicChange.publicProjectionHash).not.toBe(baseline.publicProjectionHash);
	});
});

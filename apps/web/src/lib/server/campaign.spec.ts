import { describe, expect, it } from 'vitest';

import { listSummonableHeroDrafts } from '@summonlab/characters';

import type { CampaignRun } from '@summonlab/contracts';

import { campaignHeroIsSummoned, generateCampaignCompany } from './campaign.js';

describe('player campaign hero selection', () => {
	it('creates a duplicate-free company using only approved summonable identities', async () => {
		const approvedIds = new Set(
			listSummonableHeroDrafts().map((draft) => draft.manifest.characterId)
		);
		const company = await generateCampaignCompany('campaign-approved-roster');

		expect(company).toHaveLength(3);
		expect(new Set(company.map((draft) => draft.manifest.characterId)).size).toBe(3);
		expect(company.every((draft) => approvedIds.has(draft.manifest.characterId))).toBe(true);
	});
});

describe('campaign summon visibility', () => {
	const campaign = {
		summonedHeroCount: 1,
		heroes: [
			{ draft: { manifest: { characterId: 'first' } } },
			{ draft: { manifest: { characterId: 'second' } } },
			{ draft: { manifest: { characterId: 'third' } } }
		]
	} as CampaignRun;

	it('allows only committed ordinal candidates', () => {
		expect(campaignHeroIsSummoned(campaign, 'first')).toBe(true);
		expect(campaignHeroIsSummoned(campaign, 'second')).toBe(false);
		expect(campaignHeroIsSummoned(campaign, 'third')).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';

import { listSummonableHeroDrafts } from '@summonlab/characters';

import { generateCampaignCompany } from './campaign.js';

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

import {
	generateCharacterDraft,
	generatePackTwoCohort,
	recipeFromSeed
} from '@summonlab/characters';

import { drawApprovedIdentity, type SummonPoolEntry } from '$lib/approved-summon-pool';
import { runtimePortraitFor } from '$lib/server/runtime-portraits';

import packTwoCatalog from '../../../../../../../assets/heroes/visuals/forge-v2/catalog.json';

import type { PageServerLoad } from './$types';

const approvedProofSeeds = ['hearth-01:ember', 'hearth-01:vow', 'hearth-01:lark'] as const;

export const load = (async () => {
	const [approvedDrafts, packTwoDrafts] = await Promise.all([
		Promise.all(approvedProofSeeds.map((seed) => generateCharacterDraft(recipeFromSeed(seed)))),
		generatePackTwoCohort()
	]);
	const approvedPool: SummonPoolEntry<(typeof approvedDrafts)[number]['manifest']>[] =
		approvedDrafts.map((draft) => {
			const portrait = runtimePortraitFor(draft.manifestHash, draft.manifest.artKey, 'summon');
			if (!portrait)
				throw new Error(`Approved runtime portrait missing for ${draft.manifest.displayName}`);
			return {
				id: draft.manifest.characterId,
				manifest: draft.manifest,
				manifestHash: draft.manifestHash,
				sourceApproval: 'approved',
				summonEligibility: 'eligible',
				portrait
			};
		});
	const initial = drawApprovedIdentity(approvedPool, 'pack-two-runtime-initial');
	if (!initial) throw new Error('Runtime proof has no approved identity');

	return {
		approvedPool,
		initial,
		packTwoStaged: packTwoDrafts.map((draft) => {
			const human = packTwoCatalog.humans.find(
				(entry) => entry.manifestHash === draft.manifestHash
			);
			if (!human)
				throw new Error(`Pack 2 approval entry missing for ${draft.manifest.displayName}`);
			return {
				id: draft.manifest.characterId,
				manifest: draft.manifest,
				manifestHash: draft.manifestHash,
				sourceApproval: 'candidate' as const,
				summonEligibility: 'blocked' as const,
				portrait: null,
				approvalReason: human.summonEligibility
			};
		})
	};
}) satisfies PageServerLoad;

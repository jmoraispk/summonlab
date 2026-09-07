import { getConfig } from '@summonlab/config';
import { getEngineSnapshot, getProofRun } from '@summonlab/database';
import { assembleHeroDecisionPacket, projectHeroConversationPresentation } from '@summonlab/engine';
import { createHeroDecisionPreview } from '@summonlab/policies';
import { error } from '@sveltejs/kit';

import { runtimePortraitFor } from '$lib/server/runtime-portraits';
import { projectProofRunForPublic } from '$lib/server/proof-presentation';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	const databaseUrl = config.databaseUrl;
	const [snapshot, engineSnapshot] = await Promise.all([
		getProofRun(databaseUrl, params.runId).catch(() => null),
		getEngineSnapshot(databaseUrl, params.runId).catch(() => null)
	]);
	if (!snapshot) error(404, 'This summon could not be found. Is the local database running?');
	const conversation = engineSnapshot
		? projectHeroConversationPresentation(engineSnapshot, snapshot.manifest.characterId)
		: null;
	const decisionPreview = config.devRoutesEnabled && engineSnapshot
		? await (async () => {
				try {
					const packet = assembleHeroDecisionPacket({
						snapshot: engineSnapshot,
						manifest: snapshot.manifest,
						heroId: snapshot.manifest.characterId,
						decisionKind: 'settlement-action'
					});
					return await createHeroDecisionPreview(packet, `${params.runId}:policy-preview-v1`);
				} catch {
					return null;
				}
			})()
		: null;
	const modelPolicy = {
		enabled:
			config.devRoutesEnabled && config.policyMode === 'model' && Boolean(config.openAiApiKey),
		model: config.policyModel,
		reasoningEffort: config.policyReasoningEffort,
		maxOutputTokens: config.policyMaxOutputTokens,
		message: !config.devRoutesEnabled
			? 'Development model previews are disabled.'
			: config.policyMode !== 'model'
				? 'Set POLICY_MODE=model to enable manual model previews.'
				: !config.openAiApiKey
					? 'Set OPENAI_API_KEY locally to enable the one-call preview.'
					: 'Ready for one manual, non-applying model call.'
	};
	return {
		snapshot: projectProofRunForPublic(snapshot),
		conversation,
		decisionPreview,
		modelPolicy,
		heroPortrait: runtimePortraitFor(snapshot.manifestHash, snapshot.manifest.artKey, 'summon')
	};
};

import { getConfig } from '@summonlab/config';
import { DecisionJobCreateRequestSchema } from '@summonlab/contracts';
import { createDecisionJob, getEngineSnapshot, getProofRun } from '@summonlab/database';
import { assembleHeroDecisionPacket } from '@summonlab/engine';
import { projectDecisionJobClientView } from '@summonlab/observability';
import { buildOpenAIHeroDecisionRequestProfile } from '@summonlab/policies/openai';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const parsed = DecisionJobCreateRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ code: 'invalid-decision-job-request', message: 'Invalid decision job request.' },
			{ status: 400 }
		);
	}
	if (parsed.data.policy === 'model') {
		if (config.policyMode !== 'model') {
			return json(
				{
					code: 'model-policy-disabled',
					message: 'Set POLICY_MODE=model before queuing a model job.'
				},
				{ status: 409 }
			);
		}
		if (!config.openAiApiKey) {
			return json(
				{ code: 'model-policy-key-missing', message: 'Set OPENAI_API_KEY locally first.' },
				{ status: 409 }
			);
		}
		if (!parsed.data.costAcknowledged) {
			return json(
				{
					code: 'model-cost-not-acknowledged',
					message: 'A model job requires explicit cost acknowledgement.'
				},
				{ status: 400 }
			);
		}
	}

	const [proof, snapshot] = await Promise.all([
		getProofRun(config.databaseUrl, params.runId).catch(() => null),
		getEngineSnapshot(config.databaseUrl, params.runId).catch(() => null)
	]);
	if (!proof || !snapshot) return json({ message: 'Run not found.' }, { status: 404 });
	if (parsed.data.heroId !== proof.manifest.characterId) {
		return json({ message: 'That hero identity is not available.' }, { status: 404 });
	}
	try {
		const packet = assembleHeroDecisionPacket({
			snapshot,
			manifest: proof.manifest,
			heroId: parsed.data.heroId,
			decisionKind: 'settlement-action'
		});
		if (packet.packetHash !== parsed.data.packetHash) {
			return json(
				{
					code: 'decision-job-stale-packet',
					message: 'The hero context changed. Refresh before queuing this decision.'
				},
				{ status: 409 }
			);
		}
		const job = await createDecisionJob(config.databaseUrl, {
			packet,
			requestedPolicy: parsed.data.policy,
			providerRequest:
				parsed.data.policy === 'model'
					? buildOpenAIHeroDecisionRequestProfile(packet, {
							model: config.policyModel,
							maxOutputTokens: config.policyMaxOutputTokens,
							reasoningEffort: config.policyReasoningEffort
						})
					: null,
			maxProviderAttempts: config.decisionJobMaxProviderAttempts,
			maxReplans: config.decisionJobMaxReplans
		});
		return json(projectDecisionJobClientView(job), {
			status: job.status === 'created' ? 202 : 200
		});
	} catch (error) {
		return json(
			{
				code: 'decision-job-create-failed',
				message: error instanceof Error ? error.message : 'The decision job could not be created.'
			},
			{ status: 409 }
		);
	}
};

import { getConfig } from '@summonlab/config';
import { getEngineSnapshot, getProofRun } from '@summonlab/database';
import { assembleHeroDecisionPacket } from '@summonlab/engine';
import { ModelPolicyError, OpenAIModelPolicy } from '@summonlab/policies/openai';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

interface ModelPreviewRequest {
	readonly heroId: string;
	readonly packetHash: string;
	readonly costAcknowledged: true;
}

function modelPreviewRequest(input: unknown): ModelPreviewRequest | null {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const value = input as Record<string, unknown>;
	if (
		Object.keys(value).sort().join('|') !== 'costAcknowledged|heroId|packetHash' ||
		typeof value.heroId !== 'string' ||
		!/^[a-f0-9-]{36}$/u.test(value.heroId) ||
		typeof value.packetHash !== 'string' ||
		!/^[a-f0-9]{64}$/u.test(value.packetHash) ||
		value.costAcknowledged !== true
	) {
		return null;
	}
	return {
		heroId: value.heroId,
		packetHash: value.packetHash,
		costAcknowledged: true
	};
}

export const POST: RequestHandler = async ({ params, request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) {
		return json({ message: 'Not found.' }, { status: 404 });
	}
	if (config.policyMode !== 'model') {
		return json(
			{
				code: 'model-policy-disabled',
				message: 'Set POLICY_MODE=model to enable manual model previews.'
			},
			{ status: 409 }
		);
	}
	if (!config.openAiApiKey) {
		return json(
			{
				code: 'model-policy-key-missing',
				message: 'Set OPENAI_API_KEY locally before requesting a model preview.'
			},
			{ status: 409 }
		);
	}

	const body = modelPreviewRequest(await request.json().catch(() => null));
	if (!body) {
		return json(
			{ code: 'invalid-model-preview-request', message: 'Invalid model preview request.' },
			{ status: 400 }
		);
	}

	const [proof, snapshot] = await Promise.all([
		getProofRun(config.databaseUrl, params.runId).catch(() => null),
		getEngineSnapshot(config.databaseUrl, params.runId).catch(() => null)
	]);
	if (!proof || !snapshot) return json({ message: 'Run not found.' }, { status: 404 });
	if (body.heroId !== proof.manifest.characterId) {
		return json(
			{ message: 'That hero identity is not available to this run view.' },
			{ status: 404 }
		);
	}

	try {
		const packet = assembleHeroDecisionPacket({
			snapshot,
			manifest: proof.manifest,
			heroId: body.heroId,
			decisionKind: 'settlement-action'
		});
		if (packet.packetHash !== body.packetHash) {
			return json(
				{
					code: 'model-preview-stale-packet',
					message: 'The hero context changed. Refresh the preview before spending a model call.'
				},
				{ status: 409 }
			);
		}
		const result = await new OpenAIModelPolicy({
			apiKey: config.openAiApiKey,
			model: config.policyModel,
			timeoutMs: config.policyTimeoutMs,
			maxOutputTokens: config.policyMaxOutputTokens,
			reasoningEffort: config.policyReasoningEffort
		}).decide(packet);
		return json(result);
	} catch (error) {
		if (error instanceof ModelPolicyError) {
			return json(
				{ code: error.code, retryable: error.retryable, message: error.message },
				{ status: error.code === 'response-refused' ? 422 : 502 }
			);
		}
		return json(
			{
				code: 'model-preview-failed',
				message: error instanceof Error ? error.message : 'The model preview failed.'
			},
			{ status: 409 }
		);
	}
};

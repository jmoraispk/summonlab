import { getConfig } from '@summonlab/config';
import { SummonCardGenerateRequestSchema } from '@summonlab/contracts';
import { json } from '@sveltejs/kit';

import {
	SummonCardProviderError,
	buildSummonCardSpec,
	generateSummonCard,
	readVerifiedReferenceImage,
	resolveSummonCardSubject
} from '$lib/server/summon-card';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const body = await request.json().catch(() => null);
	const parsed = SummonCardGenerateRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				code: 'COST_ACKNOWLEDGEMENT_REQUIRED',
				message: 'A valid request and explicit cost acknowledgement are required.'
			},
			{ status: 400 }
		);
	}
	if (!config.imageGenerationEnabled) {
		return json(
			{ code: 'IMAGE_GENERATION_DISABLED', message: 'Image generation is disabled by default.' },
			{ status: 503 }
		);
	}
	if (!config.openAiApiKey) {
		return json(
			{
				code: 'IMAGE_PROVIDER_KEY_MISSING',
				message: 'The local image provider key is not configured.'
			},
			{ status: 503 }
		);
	}

	try {
		const subject = await resolveSummonCardSubject(parsed.data);
		const spec = buildSummonCardSpec(
			subject,
			parsed.data.catalogVersion,
			parsed.data.direction,
			config
		);
		if (spec.estimatedOutputCostUsd <= 0) {
			return json(
				{
					code: 'IMAGE_COST_UNVERIFIED',
					message: 'This provider configuration has no verified output-cost estimate.'
				},
				{ status: 409 }
			);
		}
		const referenceImage = await readVerifiedReferenceImage(subject.asset);
		const result = await generateSummonCard({
			requestId: parsed.data.requestId,
			spec,
			referenceImage,
			apiKey: config.openAiApiKey,
			timeoutMs: config.imageTimeoutMs
		});
		return json(result, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		if (error instanceof SummonCardProviderError) {
			return json({ code: error.code, message: error.message }, { status: error.status });
		}
		return json(
			{
				code: 'IMAGE_REQUEST_INVALID',
				message: error instanceof Error ? error.message : 'The image request failed.'
			},
			{ status: 409 }
		);
	}
};

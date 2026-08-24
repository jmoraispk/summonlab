import { describe, expect, it, vi } from 'vitest';

import {
	buildSummonCardSpec,
	generateSummonCard,
	listSummonCardSubjects,
	readVerifiedReferenceImage
} from './summon-card.js';

const config = {
	imageModel: 'gpt-image-2-2026-04-21',
	imageQuality: 'low' as const,
	imageSize: '1024x1536' as const,
	imageTimeoutMs: 120_000
};

describe('summon-card request spike', () => {
	it('builds a stable request from an exact catalog identity', async () => {
		const subject = (await listSummonCardSubjects())[0]!;
		const left = buildSummonCardSpec(subject, 'visual-catalog-v1', '', config);
		const right = buildSummonCardSpec(subject, 'visual-catalog-v1', '', config);
		const directed = buildSummonCardSpec(
			subject,
			'visual-catalog-v1',
			'  Colder   gate light.  ',
			config
		);

		expect(left).toEqual(right);
		expect(left.prompt).toContain(subject.draft.manifest.displayName);
		expect(left.prompt).toContain(`Adult age: ${subject.draft.manifest.adultAge}`);
		expect(left.assetContentHash).toBe(subject.asset.contentHash);
		expect(left.manifestHash).toBe(subject.draft.manifestHash);
		expect(left.estimatedOutputCostUsd).toBe(0.005);
		expect(directed.prompt).toContain('Colder gate light.');
		expect(directed.promptHash).not.toBe(left.promptHash);
		expect(directed.manifestHash).toBe(left.manifestHash);
	});

	it('verifies the exact reference bytes before any provider request', async () => {
		const subject = (await listSummonCardSubjects())[0]!;
		const bytes = await readVerifiedReferenceImage(subject.asset);

		expect(bytes.byteLength).toBe(subject.asset.bytes);
	});

	it('sends one multipart edit and validates the returned PNG without persistence', async () => {
		const subject = (await listSummonCardSubjects())[0]!;
		const spec = buildSummonCardSpec(subject, 'visual-catalog-v1', '', config);
		const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
		const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
			const body = init?.body as FormData;
			expect(init?.headers).toEqual({ authorization: 'Bearer test-key' });
			expect(body.get('model')).toBe('gpt-image-2-2026-04-21');
			expect(body.get('quality')).toBe('low');
			expect(body.get('size')).toBe('1024x1536');
			expect(body.get('n')).toBe('1');
			expect(body.get('prompt')).toBe(spec.prompt);
			expect(body.get('image[]')).toBeInstanceOf(Blob);
			return new Response(
				JSON.stringify({ data: [{ b64_json: Buffer.from(png).toString('base64') }] }),
				{
					status: 200,
					headers: { 'content-type': 'application/json', 'x-request-id': 'provider-request-1' }
				}
			);
		});

		const result = await generateSummonCard({
			requestId: '372babd1-b6b0-4877-88dc-2efeab37b3ae',
			spec,
			referenceImage: png,
			apiKey: 'test-key',
			timeoutMs: 1_000,
			fetcher,
			now: () => new Date('2026-08-24T05:00:00.000Z')
		});

		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(result.providerRequestId).toBe('provider-request-1');
		expect(result.spec.persistence).toBe('ephemeral-response-only');
		expect(result.image.b64Json).toBe(Buffer.from(png).toString('base64'));
	});

	it('normalizes provider failures and never retries', async () => {
		const subject = (await listSummonCardSubjects())[0]!;
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify({ error: { code: 'do-not-expose-this' } }), { status: 429 })
		);

		await expect(
			generateSummonCard({
				requestId: '372babd1-b6b0-4877-88dc-2efeab37b3ae',
				spec: buildSummonCardSpec(subject, 'visual-catalog-v1', '', config),
				referenceImage: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
				apiKey: 'test-key',
				timeoutMs: 1_000,
				fetcher
			})
		).rejects.toMatchObject({
			code: 'IMAGE_RATE_LIMITED',
			status: 429
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});

import { getConfig } from '@summonlab/config';
import { PlaytestConsentGrantRequestSchema } from '@summonlab/contracts';
import {
	getPlaytestConsentSummary,
	grantPlaytestConsent,
	withdrawPlaytestConsent
} from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

function capability(request: Request): string | null {
	return request.headers.get('x-playtest-consent');
}

export const POST: RequestHandler = async ({ request }) => {
	const parsed = PlaytestConsentGrantRequestSchema.safeParse(
		await request.json().catch(() => null)
	);
	if (!parsed.success) {
		return json(
			{ message: 'Playtest consent requires the current notice and both confirmations.' },
			{ status: 400 }
		);
	}
	try {
		const result = await grantPlaytestConsent(getConfig().databaseUrl, parsed.data);
		return json(result, { status: 201, headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		return json(
			{
				message: 'Consent could not be saved. Nothing will be collected.',
				detail: error instanceof Error ? error.message : 'unknown consent persistence failure'
			},
			{ status: 503 }
		);
	}
};

export const GET: RequestHandler = async ({ request }) => {
	const token = capability(request);
	if (!token) return json({ message: 'Consent capability is required.' }, { status: 401 });
	try {
		const summary = await getPlaytestConsentSummary(getConfig().databaseUrl, token);
		return summary
			? json(summary, { headers: { 'cache-control': 'no-store' } })
			: json({ message: 'Consent capability was not found.' }, { status: 404 });
	} catch {
		return json({ message: 'Consent capability is invalid.' }, { status: 401 });
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	const token = capability(request);
	if (!token) return json({ message: 'Consent capability is required.' }, { status: 401 });
	try {
		const result = await withdrawPlaytestConsent(getConfig().databaseUrl, token);
		return result
			? json(result, { headers: { 'cache-control': 'no-store' } })
			: json({ message: 'Consent is already unavailable.' }, { status: 404 });
	} catch {
		return json({ message: 'Consent capability is invalid.' }, { status: 401 });
	}
};

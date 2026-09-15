import { getConfig } from '@summonlab/config';
import { ExplorationCombatReceiptSchema } from '@summonlab/contracts';
import { getExplorationAttempt, settleExplorationEncounter } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { combatValueHash } from '$lib/components/tower/combat/automated/combat-hash';
import { validateTowerEncounterReceipt } from '$lib/server/tower-encounter';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => null)) as {
		attemptId?: string;
		expectedVersion?: number;
		receipt?: unknown;
	} | null;
	if (!body?.attemptId || !Number.isInteger(body.expectedVersion) || !body.receipt) {
		return json({ message: 'A completed combat receipt is required.' }, { status: 400 });
	}
	try {
		const config = getConfig();
		const attempt = await getExplorationAttempt(config.databaseUrl, body.attemptId);
		if (!attempt || attempt.state.runId !== params.runId) {
			return json({ message: 'Active Tower encounter not found.' }, { status: 404 });
		}
		const parsedReceipt = ExplorationCombatReceiptSchema.parse(body.receipt);
		if (!attempt.activeEncounter) {
			const receiptHash = combatValueHash(parsedReceipt);
			const prior = attempt.receipts.find(
				(receipt) => receipt.requestId === parsedReceipt.requestId
			);
			if (
				prior?.receiptId === parsedReceipt.receiptId &&
				prior.receiptHash === receiptHash &&
				prior.outcome === parsedReceipt.outcome
			) {
				return json(
					{
						...attempt,
						summary:
							parsedReceipt.outcome === 'victory'
								? 'The company policy resolved the encounter and holds the field.'
								: 'The company was defeated and must recover before returning.'
					},
					{ headers: { 'cache-control': 'no-store' } }
				);
			}
			return json({ message: 'Active Tower encounter not found.' }, { status: 404 });
		}
		const receipt = validateTowerEncounterReceipt(attempt.activeEncounter.request, parsedReceipt);
		const settled = await settleExplorationEncounter(config.databaseUrl, {
			attemptId: body.attemptId,
			expectedVersion: body.expectedVersion!,
			receipt
		});
		return json(
			{ ...settled, summary: receipt.summary },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The encounter could not settle.' },
			{ status: 409 }
		);
	}
};

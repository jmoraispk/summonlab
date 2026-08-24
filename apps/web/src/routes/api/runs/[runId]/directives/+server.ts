import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { DirectiveRequestSchema, type EngineCommand } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const snapshot = await getEngineSnapshot(getConfig().databaseUrl, params.runId).catch(() => null);
	if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
	if (snapshot.state.schemaVersion !== 10) {
		return json({ message: 'This history predates scoped directions.' }, { status: 409 });
	}
	return json({
		runId: snapshot.state.runId,
		version: snapshot.state.version,
		eventCursor: snapshot.state.eventCursor,
		directives: Object.values(snapshot.state.society.directives).sort(
			(left, right) =>
				left.createdAt.localeCompare(right.createdAt) ||
				left.directiveId.localeCompare(right.directiveId)
		),
		influences: Object.values(snapshot.state.society.directiveInfluences).sort(
			(left, right) =>
				left.evaluatedAt.localeCompare(right.evaluatedAt) ||
				left.influenceId.localeCompare(right.influenceId)
		)
	});
};

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = DirectiveRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'Choose valid direction text, recipients, scope, and delivery.' },
			{ status: 400 }
		);
	}
	try {
		const config = getConfig();
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (snapshot.state.schemaVersion !== 10) {
			return json({ message: 'This history predates scoped directions.' }, { status: 409 });
		}
		const commandId = randomUUID();
		const base = {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId,
			source: {
				source: 'manual' as const,
				timing: 'step' as const,
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			}
		};
		const command: EngineCommand =
			parsed.data.action === 'issue'
				? {
						...base,
						commandType: 'master.issue.directive',
						text: parsed.data.text,
						scope: parsed.data.scope,
						recipientIds: parsed.data.recipientIds,
						priorities: parsed.data.priorities,
						tone: parsed.data.tone,
						delivery: parsed.data.delivery
					}
				: parsed.data.action === 'replace'
					? {
							...base,
							commandType: 'master.replace.directive',
							directiveId: parsed.data.directiveId,
							text: parsed.data.text,
							scope: parsed.data.scope,
							recipientIds: parsed.data.recipientIds,
							priorities: parsed.data.priorities,
							tone: parsed.data.tone,
							delivery: parsed.data.delivery
						}
					: {
							...base,
							commandType: 'master.revoke.directive',
							directiveId: parsed.data.directiveId
						};
		const committed = await commitEngineCommand(config.databaseUrl, command);
		if (committed.snapshot.state.schemaVersion !== 10) {
			throw new Error('Directive commit changed the engine schema.');
		}
		return json({
			runId: committed.snapshot.state.runId,
			version: committed.snapshot.state.version,
			eventCursor: committed.snapshot.state.eventCursor,
			directives: Object.values(committed.snapshot.state.society.directives),
			influences: Object.values(committed.snapshot.state.society.directiveInfluences)
		});
	} catch (error) {
		if (error instanceof StaleRunVersionError || error instanceof IdempotencyConflictError) {
			return json({ code: error.code, message: error.message }, { status: 409 });
		}
		if (error instanceof IllegalActionError) {
			return json(
				{ code: error.code, message: error.message, legalActionIds: error.legalActionIds },
				{ status: 409 }
			);
		}
		return json(
			{ message: error instanceof Error ? error.message : 'The direction could not be recorded.' },
			{ status: 500 }
		);
	}
};

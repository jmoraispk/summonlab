import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import {
	MissionLifecycleRequestSchema,
	type ActionSource,
	type EngineCommand
} from '@summonlab/contracts';
import { TOWER_FLOOR_01_PACKAGE } from '@summonlab/content';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

const manualSource: ActionSource = {
	source: 'manual',
	timing: 'step',
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

const systemSource: ActionSource = {
	source: 'system',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = MissionLifecycleRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ message: 'Choose a valid mission lifecycle action.' }, { status: 400 });
	}
	const config = getConfig();
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (snapshot.state.schemaVersion !== 11) {
			return json({ message: 'This history predates authoritative missions.' }, { status: 409 });
		}
		if (parsed.data.action === 'prove-objective' && !config.devRoutesEnabled) {
			return json({ message: 'The objective proof control is development-only.' }, { status: 404 });
		}
		const commandId = randomUUID();
		const base = {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId
		};
		const command: EngineCommand =
			parsed.data.action === 'prepare'
				? {
						...base,
						source: manualSource,
						commandType: 'mission.prepare',
						heroIds: parsed.data.heroIds
					}
				: parsed.data.action === 'revise-party'
					? {
							...base,
							source: manualSource,
							commandType: 'mission.revise.party',
							heroIds: parsed.data.heroIds
						}
					: parsed.data.action === 'cancel'
						? { ...base, source: manualSource, commandType: 'mission.cancel' }
						: parsed.data.action === 'deploy'
							? { ...base, source: manualSource, commandType: 'mission.deploy' }
							: parsed.data.action === 'prove-objective'
								? {
										...base,
										source: systemSource,
										commandType: 'mission.open.extraction',
										completedObjectiveIds: TOWER_FLOOR_01_PACKAGE.objectives
											.filter((objective) => objective.primary)
											.map((objective) => objective.objectiveId)
									}
								: parsed.data.action === 'extract'
									? { ...base, source: manualSource, commandType: 'mission.extract' }
									: { ...base, source: manualSource, commandType: 'mission.retreat' };
		const committed = await commitEngineCommand(config.databaseUrl, command);
		if (committed.snapshot.state.schemaVersion !== 11) {
			throw new Error('Mission commit changed the engine schema.');
		}
		return json({
			runId: committed.snapshot.state.runId,
			version: committed.snapshot.state.version,
			eventCursor: committed.snapshot.state.eventCursor,
			stateHash: committed.snapshot.stateHash,
			mission: committed.snapshot.state.mission,
			eventType: committed.events[0]?.eventType ?? null,
			legalActions: committed.legalActions
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
			{ message: error instanceof Error ? error.message : 'The mission transition failed.' },
			{ status: 500 }
		);
	}
};

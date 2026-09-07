import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import type { ActionSource, EngineCommand } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommands,
	getEngineSnapshot,
	getProofRun
} from '@summonlab/database';
import { IllegalActionError, applyCommand } from '@summonlab/engine';
import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { projectEngineCommitReceipt } from '$lib/server/public-engine-presentation';
import { projectMissionReadinessForPublic } from '$lib/server/mission-readiness';

import type { RequestHandler } from './$types';

const MissionReadinessReturnRequestSchema = z.object({}).strict();

const systemSource: ActionSource = {
	source: 'system',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = MissionReadinessReturnRequestSchema.safeParse(
		await request.json().catch(() => null)
	);
	if (!parsed.success) {
		return json({ message: 'The readiness return request must be empty.' }, { status: 400 });
	}
	const config = getConfig();
	try {
		const [snapshot, proof] = await Promise.all([
			getEngineSnapshot(config.databaseUrl, params.runId),
			getProofRun(config.databaseUrl, params.runId)
		]);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (!proof) return json({ message: 'Summoned company not found.' }, { status: 404 });
		if (snapshot.state.schemaVersion !== 25) {
			return json(
				{ message: 'Mission assembly return requests begin with v25 histories.' },
				{ status: 409 }
			);
		}

		const heroId = proof.manifest.characterId;
		const readiness = projectMissionReadinessForPublic(snapshot.state, heroId);
		if (!readiness.hero.canRequestReturn) {
			return json({ message: readiness.hero.reason }, { status: 409 });
		}

		const correlationId = randomUUID();
		const travelCommand: EngineCommand = {
			commandId: randomUUID(),
			runId: params.runId,
			actorId: heroId,
			expectedVersion: snapshot.state.version,
			correlationId,
			source: systemSource,
			commandType: 'hero.start.travel',
			targetNodeId: 'gate-dais',
			requestContext: 'mission-readiness'
		};
		const returning = applyCommand(snapshot.state, travelCommand);
		const arrival = returning.scheduled[0];
		if (!arrival || arrival.eventKind !== 'hero.travel.arrive') {
			throw new Error('Mission-readiness travel did not schedule an arrival.');
		}
		const advanceCommand: EngineCommand = {
			commandId: randomUUID(),
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: returning.state.version,
			correlationId,
			source: systemSource,
			commandType: 'simulation.advance',
			targetGameTime: arrival.dueGameTime
		};

		const committed = await commitEngineCommands(config.databaseUrl, [
			travelCommand,
			advanceCommand
		]);
		return json(projectEngineCommitReceipt(committed));
	} catch (error) {
		if (error instanceof StaleRunVersionError || error instanceof IdempotencyConflictError) {
			return json(
				{ code: error.code, message: 'The run changed before the hero could return.' },
				{ status: 409 }
			);
		}
		if (error instanceof IllegalActionError) {
			return json(
				{ code: error.code, message: 'The hero cannot return for mission assembly right now.' },
				{ status: 409 }
			);
		}
		console.error('Mission-readiness return failed', error);
		return json({ message: 'The hero could not return for mission assembly.' }, { status: 500 });
	}
};

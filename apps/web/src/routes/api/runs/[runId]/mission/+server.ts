import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import {
	MissionLifecycleRequestSchema,
	type ActionSource,
	type EngineCommand,
	type EngineSnapshot,
	type MissionTurnChoice
} from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot,
	getProofRun
} from '@summonlab/database';
import {
	IllegalActionError,
	assembleHeroDecisionPacket,
	missionTurnLegalActions
} from '@summonlab/engine';
import { ScriptedPolicy } from '@summonlab/policies';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

const manualSource: ActionSource = {
	source: 'manual',
	timing: 'step',
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

async function assembleMissionChoices(
	snapshot: EngineSnapshot,
	manifest: Parameters<typeof assembleHeroDecisionPacket>[0]['manifest'],
	masterActionId: string
): Promise<MissionTurnChoice[]> {
	if (
		snapshot.state.schemaVersion !== 13 &&
		snapshot.state.schemaVersion !== 15 &&
		snapshot.state.schemaVersion !== 16
	) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const attempt = snapshot.state.mission.attempt;
	if (!attempt) throw new IllegalActionError('mission.resolve.turn');
	const masterAction = missionTurnLegalActions(snapshot.state, snapshot.state.master.masterId).find(
		(action) => action.actionId === masterActionId
	);
	if (!masterAction) throw new IllegalActionError(masterActionId);
	const choices: MissionTurnChoice[] = [
		{
			actorId: snapshot.state.master.masterId,
			actionId: masterAction.actionId,
			source: 'manual',
			policyId: null,
			packetHash: null,
			legalActionHash: null,
			policyResultHash: null,
			publicIntent: `The Master chose to ${masterAction.label.toLowerCase()}.`
		}
	];
	const policy = new ScriptedPolicy();
	for (const heroId of attempt.party.heroIds) {
		if (manifest.characterId !== heroId) {
			throw new Error(`No stable character manifest is available for mission hero ${heroId}.`);
		}
		const packet = assembleHeroDecisionPacket({
			snapshot,
			manifest,
			heroId,
			decisionKind: 'mission-action'
		});
		const result = await policy.decide(packet);
		choices.push({
			actorId: heroId,
			actionId: result.decision.actionId,
			source: 'scripted',
			policyId: result.policyId,
			packetHash: result.packetHash,
			legalActionHash: result.legalActionHash,
			policyResultHash: result.resultHash,
			publicIntent: result.decision.publicIntent
		});
	}
	return choices;
}

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = MissionLifecycleRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ message: 'Choose a valid mission lifecycle action.' }, { status: 400 });
	}
	const config = getConfig();
	try {
		const [snapshot, proof] = await Promise.all([
			getEngineSnapshot(config.databaseUrl, params.runId),
			getProofRun(config.databaseUrl, params.runId)
		]);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (!proof) return json({ message: 'Summoned company not found.' }, { status: 404 });
		if (
			snapshot.state.schemaVersion !== 13 &&
			snapshot.state.schemaVersion !== 15 &&
			snapshot.state.schemaVersion !== 16
		) {
			return json(
				{ message: 'This history predates authoritative mission turns.' },
				{ status: 409 }
			);
		}
		const commandId = randomUUID();
		const base = {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId
		};
		let command: EngineCommand;
		if (parsed.data.action === 'prepare') {
			command = {
				...base,
				source: manualSource,
				commandType: 'mission.prepare',
				heroIds: parsed.data.heroIds,
				...(parsed.data.missionId ? { missionId: parsed.data.missionId } : {})
			};
		} else if (parsed.data.action === 'revise-party') {
			command = {
				...base,
				source: manualSource,
				commandType: 'mission.revise.party',
				heroIds: parsed.data.heroIds
			};
		} else if (parsed.data.action === 'cancel') {
			command = { ...base, source: manualSource, commandType: 'mission.cancel' };
		} else if (parsed.data.action === 'deploy') {
			command = { ...base, source: manualSource, commandType: 'mission.deploy' };
		} else if (parsed.data.action === 'resolve-turn') {
			command = {
				...base,
				source: manualSource,
				commandType: 'mission.resolve.turn',
				choices: await assembleMissionChoices(snapshot, proof.manifest, parsed.data.masterActionId)
			};
		} else if (parsed.data.action === 'extract') {
			command = { ...base, source: manualSource, commandType: 'mission.extract' };
		} else {
			command = { ...base, source: manualSource, commandType: 'mission.retreat' };
		}
		const committed = await commitEngineCommand(config.databaseUrl, command);
		if (
			committed.snapshot.state.schemaVersion !== 13 &&
			committed.snapshot.state.schemaVersion !== 15 &&
			committed.snapshot.state.schemaVersion !== 16
		) {
			throw new Error('Mission commit changed the engine schema.');
		}
		return json({
			runId: committed.snapshot.state.runId,
			version: committed.snapshot.state.version,
			eventCursor: committed.snapshot.state.eventCursor,
			stateHash: committed.snapshot.stateHash,
			mission: committed.snapshot.state.mission,
			round: committed.snapshot.state.mission.attempt?.turnState.rounds.at(-1) ?? null,
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

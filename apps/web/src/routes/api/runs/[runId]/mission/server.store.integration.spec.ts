import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateSummonableCharacterDraft } from '@summonlab/characters';
import { EngineGameStateV26Schema } from '@summonlab/contracts';
import { createProofRun, getEngineSnapshot, openDatabase } from '@summonlab/database';
import { finalizeReadinessCombatOutcome, hashGameState } from '@summonlab/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';

const environment = vi.hoisted(() => ({ databaseUrl: process.env.TEST_DATABASE_URL ?? '' }));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		databaseUrl: environment.databaseUrl,
		combatMode: 'agent-readiness-v1',
		policyMode: 'scripted',
		decisionJobMaxProviderAttempts: 2
	})
}));

import { POST as updateMission } from './+server.js';

const integration = environment.databaseUrl ? it : it.skip;
const createdRunIds: string[] = [];

function missionRequest(runId: string, body: unknown): Promise<Response> {
	return updateMission({
		params: { runId },
		request: new Request(`http://summonlab.test/api/runs/${runId}/mission`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never) as Promise<Response>;
}

afterEach(async () => {
	if (!environment.databaseUrl || createdRunIds.length === 0) return;
	const sql = await openDatabase(environment.databaseUrl);
	try {
		for (const runId of createdRunIds.splice(0)) {
			await sql`delete from summonlab_proof_runs where run_id = ${runId}`;
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
});

describe('mission readiness route with the real event store', () => {
	integration(
		'returns a persisted completed result without committing a second engine command',
		async () => {
			const runId = randomUUID();
			createdRunIds.push(runId);
			const capabilityEntropy = '3'.repeat(64);
			const draft = await generateSummonableCharacterDraft(
				{
					seed: 'mission-readiness-store',
					generationVersion: 'human-v6',
					cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
				},
				{ capabilityEntropy }
			);
			await createProofRun(environment.databaseUrl, {
				runId,
				draft,
				capabilityEntropy,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null,
				combatMode: 'agent-readiness-v1'
			});

			for (const body of [
				{ action: 'prepare', heroIds: [draft.manifest.characterId] },
				{ action: 'deploy' }
			]) {
				const response = await missionRequest(runId, body);
				expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
			}

			const active = await getEngineSnapshot(environment.databaseUrl, runId);
			if (active?.state.schemaVersion !== 26) throw new Error('Expected V26 store state');
			const activeAttempt = active.state.mission.attempt;
			if (!activeAttempt || activeAttempt.combatState.modeId !== 'agent-readiness-v1') {
				throw new Error('Expected active readiness combat');
			}
			const terminalCombat = finalizeReadinessCombatOutcome({
				state: activeAttempt.combatState.readinessState,
				safetyStop: {
					safetyStopVersion: 'combat-safety-stop-v1',
					reason: 'no-progress-cycles',
					disposition: 'diagnostic',
					...activeAttempt.combatState.readinessState.safety
				}
			}).state;
			const terminalState = EngineGameStateV26Schema.parse({
				...active.state,
				mission: {
					...active.state.mission,
					attempt: {
						...activeAttempt,
						status: 'failure',
						outcome: 'failure',
						endedAt: active.state.simulatedAt,
						combatState: {
							modeId: 'agent-readiness-v1',
							readinessState: terminalCombat
						}
					}
				}
			});
			const terminalHash = hashGameState(terminalState);
			const sql = await openDatabase(environment.databaseUrl);
			try {
				await sql.begin(async (transaction) => {
					await transaction`
						update summonlab_engine_snapshots
						set state = ${transaction.json(terminalState)}, state_hash = ${terminalHash}
						where run_id = ${runId} and event_cursor = ${terminalState.eventCursor}
					`;
					await transaction`
						update summonlab_engine_runs set state_hash = ${terminalHash}
						where run_id = ${runId}
					`;
				});
			} finally {
				await sql.end({ timeout: 5 });
			}

			const beforeRetry = await getEngineSnapshot(environment.databaseUrl, runId);
			expect(beforeRetry).toStrictEqual({ state: terminalState, stateHash: terminalHash });
			const countSql = await openDatabase(environment.databaseUrl);
			let commandsBefore: number;
			try {
				commandsBefore = Number(
					(
						await countSql<{ count: string }[]>`
							select count(*) as count from summonlab_engine_commands where run_id = ${runId}
						`
					)[0]!.count
				);
			} finally {
				await countSql.end({ timeout: 5 });
			}

			const retry = await missionRequest(runId, { action: 'advance-automatic-combat' });
			expect(retry.status, JSON.stringify(await retry.clone().json())).toBe(200);
			expect(await retry.json()).toStrictEqual({
				status: 'terminal',
				outcome: 'safety-stop',
				tick: terminalCombat.result!.endedAtTick,
				missionStatus: 'failure'
			});
			expect(await getEngineSnapshot(environment.databaseUrl, runId)).toStrictEqual(beforeRetry);
			const afterSql = await openDatabase(environment.databaseUrl);
			try {
				const commandsAfter = Number(
					(
						await afterSql<{ count: string }[]>`
							select count(*) as count from summonlab_engine_commands where run_id = ${runId}
						`
					)[0]!.count
				);
				expect(commandsAfter).toBe(commandsBefore);
			} finally {
				await afterSql.end({ timeout: 5 });
			}
		},
		30_000
	);
});

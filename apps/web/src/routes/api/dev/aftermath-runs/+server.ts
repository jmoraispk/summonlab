import { randomUUID } from 'node:crypto';

import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import type { EngineCommand } from '@summonlab/contracts';
import { commitEngineCommand, createProofRun, getEngineSnapshot } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

const ACTION_TERMS = [
	'attack',
	'strike',
	'threat',
	'hold',
	'defend',
	'guard',
	'explore',
	'inspect',
	'secret',
	'objective',
	'recover',
	'return',
	'retreat'
] as const;

export const POST: RequestHandler = async ({ request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const body = (await request.json().catch(() => ({}))) as {
			direction?: unknown;
			seed?: unknown;
		};
		const direction =
			typeof body.direction === 'string' ? body.direction.trim().slice(0, 1_000) : '';
		const runId = randomUUID();
		const seed =
			typeof body.seed === 'string' && body.seed.trim()
				? body.seed.trim().slice(0, 256)
				: `red-tithe-${runId}`;
		const draft = await generateCharacterDraft(recipeFromSeed(seed));
		await createProofRun(config.databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation:
				'The third-floor lift opens on old blood, white salt, and a corridor that remembers who came home.',
			choice: null,
			clockSpeed: config.simulationSpeed,
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-03',
				availableMissionIds: ['tower-floor-03'],
				enableMissionAftermath: true
			}
		});
		if (direction) {
			const snapshot = await getEngineSnapshot(config.databaseUrl, runId);
			if (!snapshot || snapshot.state.schemaVersion !== 16) {
				throw new Error('The Red Tithe engine snapshot was unavailable after creation.');
			}
			const heroId = draft.manifest.characterId;
			const normalizedDirection = direction.toLowerCase();
			const priorities = ACTION_TERMS.filter((term) => normalizedDirection.includes(term)).slice(
				0,
				12
			);
			const commandId = randomUUID();
			await commitEngineCommand(config.databaseUrl, {
				commandId,
				runId,
				actorId: snapshot.state.master.masterId,
				expectedVersion: snapshot.state.version,
				correlationId: commandId,
				source: {
					source: 'manual',
					timing: 'step',
					fallbackPolicy: null,
					directiveIds: [],
					decisionJobId: null
				},
				commandType: 'master.issue.directive',
				text: direction,
				scope: 'mission',
				recipientIds: [heroId],
				priorities,
				tone: 'urgent',
				delivery: 'private'
			} satisfies EngineCommand);
		}
		return json({ runId }, { status: 201 });
	} catch (error) {
		return json(
			{
				message: 'The local Red Tithe run could not be created. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};

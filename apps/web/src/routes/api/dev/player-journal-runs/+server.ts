import { randomUUID } from 'node:crypto';

import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import {
	EngineCommandSchema,
	type ActionSource,
	type EngineGameStateV20
} from '@summonlab/contracts';
import { commitEngineCommand, createProofRun, getEngineSnapshot } from '@summonlab/database';
import { deterministicUuid } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

const scriptedSource: ActionSource = {
	source: 'scripted',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

const systemSource: ActionSource = { ...scriptedSource, source: 'system' };
const manualSource: ActionSource = { ...scriptedSource, source: 'manual', timing: 'step' };

export const POST: RequestHandler = async ({ request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const body = (await request.json().catch(() => ({}))) as { seed?: unknown };
		const runId = randomUUID();
		const seed =
			typeof body.seed === 'string' && body.seed.trim()
				? body.seed.trim().slice(0, 256)
				: `journal-company-${runId}`;
		const draft = await generateCharacterDraft(recipeFromSeed(seed));
		await createProofRun(config.databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation:
				'The blank company ledger opens beside the Tower Threshold, waiting for deeds rather than prophecy.',
			choice: null,
			clockSpeed: config.simulationSpeed,
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-01',
				availableMissionIds: ['tower-floor-01'],
				enableMasterFallback: true
			}
		});

		const snapshot = await getEngineSnapshot(config.databaseUrl, runId);
		if (!snapshot || snapshot.state.schemaVersion !== 20) {
			throw new Error('The player-journal engine snapshot was unavailable after creation.');
		}
		let state: EngineGameStateV20 = snapshot.state;
		let commandOrdinal = 0;
		const heroId = draft.manifest.characterId;
		const masterId = state.master.masterId;

		async function commit(
			actorId: string,
			key: string,
			fields: Record<string, unknown>,
			source: ActionSource
		) {
			commandOrdinal += 1;
			const commandId = deterministicUuid(
				`${runId}:journal-demo:${String(commandOrdinal).padStart(2, '0')}:${key}:${state.version}`
			);
			const command = EngineCommandSchema.parse({
				commandId,
				runId,
				actorId,
				expectedVersion: state.version,
				correlationId: commandId,
				source,
				...fields
			});
			const committed = await commitEngineCommand(config.databaseUrl, command);
			if (committed.snapshot.state.schemaVersion !== 20) {
				throw new Error('The player-journal run changed engine schema unexpectedly.');
			}
			state = committed.snapshot.state;
			return committed;
		}

		await commit(
			heroId,
			'choose-training',
			{
				commandType: 'hero.choose.destination',
				destination: 'training-ground',
				firstLine: 'If the Tower records every failure, I want it to record my preparation too.',
				storyBranch: 'steel-before-trust'
			},
			scriptedSource
		);
		const outbound = await commit(
			heroId,
			'travel-training',
			{ commandType: 'hero.start.travel', targetNodeId: 'training-ring' },
			scriptedSource
		);
		await commit(
			masterId,
			'arrive-training',
			{ commandType: 'simulation.advance', targetGameTime: outbound.scheduled[0]!.dueGameTime },
			systemSource
		);

		for (let session = 1; session <= 2; session += 1) {
			const training = await commit(
				heroId,
				`train-${session}`,
				{ commandType: 'hero.start.activity', activity: 'train' },
				scriptedSource
			);
			await commit(
				masterId,
				`finish-training-${session}`,
				{
					commandType: 'simulation.advance',
					targetGameTime: training.scheduled[0]!.dueGameTime
				},
				systemSource
			);
		}

		const inbound = await commit(
			heroId,
			'return-gate',
			{ commandType: 'hero.start.travel', targetNodeId: 'gate-rail' },
			scriptedSource
		);
		await commit(
			masterId,
			'arrive-gate',
			{ commandType: 'simulation.advance', targetGameTime: inbound.scheduled[0]!.dueGameTime },
			systemSource
		);
		await commit(
			masterId,
			'configure-doctrine',
			{
				commandType: 'master.configure.fallback',
				policy: 'directed',
				directionText: 'Advance the objective, but preserve the company when the way is unclear.',
				priorities: ['focus-objective', 'protect-party', 'seek-secrets'],
				protectedHeroId: heroId,
				safetyStops: {
					beforeIrreversibleAction: true,
					whenUnclassified: true,
					masterHealthThreshold: 35,
					maximumConsecutiveFallbacks: 8
				},
				observedAt: state.simulatedAt
			},
			manualSource
		);
		await commit(
			masterId,
			'prepare-floor-01',
			{ commandType: 'mission.prepare', missionId: 'tower-floor-01', heroIds: [heroId] },
			manualSource
		);

		return json({ runId }, { status: 201 });
	} catch (error) {
		return json(
			{
				message: 'The local journal run could not be created. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};

import { randomUUID } from 'node:crypto';

import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import { CharacterMindSchema } from '@summonlab/contracts';
import { commitEngineCommands, createProofRun } from '@summonlab/database';
import {
	createFirstBandArchiveRecoveryTrial,
	type FirstBandArchiveCast
} from '@summonlab/evaluation';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

const ARCHIVE_ENGINE_SEED = 'mis-010:full-quench:archive-smoke';

export const POST: RequestHandler = async ({ request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const body = (await request.json().catch(() => ({}))) as { seed?: unknown };
		const runId = randomUUID();
		const seed =
			typeof body.seed === 'string' && body.seed.trim()
				? body.seed.trim().slice(0, 128)
				: `first-band-archive-${runId}`;
		const drafts = await Promise.all(
			['ash', 'vow', 'lark', 'sable'].map((role) =>
				generateCharacterDraft(recipeFromSeed(`${seed}:${role}`))
			)
		);
		const preparedDrafts = drafts.map((draft) => ({
			...draft,
			mind: CharacterMindSchema.parse({
				...draft.mind,
				aptitudes: { might: 10, finesse: 10, insight: 10, resolve: 10 }
			})
		}));
		const [primary, second, third, fourth] = preparedDrafts;
		if (!primary || !second || !third || !fourth) throw new Error('Archive cast is incomplete');
		const castMember = (draft: typeof primary) => ({
			heroId: draft.manifest.characterId,
			manifestHash: draft.manifestHash,
			rarityStars: draft.manifest.rarityStars,
			mind: draft.mind
		});
		const cast: FirstBandArchiveCast = {
			runId,
			engineSeed: ARCHIVE_ENGINE_SEED,
			members: [castMember(primary), castMember(second), castMember(third), castMember(fourth)]
		};
		const recovery = createFirstBandArchiveRecoveryTrial(seed, cast);
		await createProofRun(config.databaseUrl, {
			runId,
			draft: primary,
			engineSeed: ARCHIVE_ENGINE_SEED,
			controlMode: 'wait',
			directive: 'Bring everyone home. The archive truth must be earned through extraction.',
			firstObservation:
				'The company returns from the Living Foundry carrying a warm core and one sealed archive fragment.',
			choice: null,
			clockSpeed: config.simulationSpeed,
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-05',
				availableMissionIds: ['tower-floor-05'],
				enableFirstBandArchive: true,
				foundryRouteMemoryHeroId: primary.manifest.characterId,
				additionalHeroes: [second, third, fourth].map((draft) => ({
					heroId: draft.manifest.characterId,
					manifestHash: draft.manifestHash,
					rarityStars: draft.manifest.rarityStars,
					mind: draft.mind
				}))
			}
		});
		const committed = await commitEngineCommands(config.databaseUrl, recovery.commands);
		if (
			committed.snapshot.state.schemaVersion !== 23 ||
			committed.snapshot.state.firstBandArchive.status !== 'recovered'
		) {
			throw new Error('Archive checkpoint did not persist its extraction boundary');
		}
		return json(
			{
				runId,
				heroes: preparedDrafts.map((draft) => ({
					heroId: draft.manifest.characterId,
					displayName: draft.manifest.displayName
				}))
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				message:
					'The first-band archive checkpoint could not be created. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};

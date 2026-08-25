import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { EngineCommandSchema, StoryPatchCandidateSchema } from '@summonlab/contracts';
import { deterministicUuid, hashCanonical, validateStoryPatchForState } from '@summonlab/engine';
import { describe, expect, it } from 'vitest';

import { commitEngineCommand, getEngineReplay } from './engine.js';
import { createProofRun } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('runtime story-patch persistence', () => {
	run('persists one validated patch and reconstructs the exact journaled state', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const runId = randomUUID();
		const [routeHolder, countervoice] = await Promise.all([
			generateCharacterDraft(recipeFromSeed(`${runId}:route-holder`)),
			generateCharacterDraft(recipeFromSeed(`${runId}:countervoice`))
		]);
		await createProofRun(databaseUrl, {
			runId,
			draft: routeHolder,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null,
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-04',
				availableMissionIds: ['tower-floor-04'],
				enableStoryPatch: true,
				foundryRouteMemoryHeroId: routeHolder.manifest.characterId,
				additionalHeroes: [
					{
						heroId: countervoice.manifest.characterId,
						manifestHash: countervoice.manifestHash,
						mind: countervoice.mind
					}
				]
			}
		});
		const before = await getEngineReplay(databaseUrl, runId);
		if (!before || before.snapshot.state.schemaVersion !== 21) {
			throw new Error('Expected persisted engine-v21 checkpoint');
		}
		const state = before.snapshot.state;
		const proposalId = 'floor-four-surface-discovery';
		const candidate = StoryPatchCandidateSchema.parse({
			patchVersion: 'story-patch-v1',
			patchId: deterministicUuid(`${runId}:runtime-story-patch`),
			envelopeId: state.bandStory.envelopeId,
			envelopeContentHash: state.bandStory.envelopeContentHash,
			baseHistoryHash: hashCanonical(state.bandStory.history),
			slotId: 'floor-four-between-pressure-and-opposition',
			selectedProposalIds: [proposalId],
			roleBindings: [{ proposalId, heroId: routeHolder.manifest.characterId }],
			publicIntent: 'Let the living route holder carry the schematic into the confrontation.'
		});
		expect(validateStoryPatchForState(state, candidate).accepted).toBe(true);
		const commandId = randomUUID();
		const committed = await commitEngineCommand(
			databaseUrl,
			EngineCommandSchema.parse({
				commandId,
				runId,
				actorId: state.master.masterId,
				expectedVersion: state.version,
				correlationId: commandId,
				source: {
					source: 'scripted',
					timing: null,
					fallbackPolicy: null,
					directiveIds: [],
					decisionJobId: null
				},
				commandType: 'story.apply.patch',
				candidate
			})
		);
		const after = await getEngineReplay(databaseUrl, runId);
		if (!after || after.snapshot.state.schemaVersion !== 21) {
			throw new Error('Expected replayed engine-v21 state');
		}
		expect(after.verified).toBe(true);
		expect(after.hashMatchesPersistedSnapshot).toBe(true);
		expect(after.snapshot.stateHash).toBe(committed.snapshot.stateHash);
		expect(after.snapshot.state.bandStory.history.activatedProposalIds).toEqual([proposalId]);
		expect(after.snapshot.state.bandStory.appliedPatches[0]).toMatchObject({
			candidate: { patchId: candidate.patchId },
			validation: { accepted: true, rejectionCodes: [] }
		});
		expect(after.playerJournal.entries.at(-1)?.storyChanges).toEqual([
			expect.objectContaining({ kind: 'patch', key: candidate.patchId, after: 'accepted' })
		]);
	});
});

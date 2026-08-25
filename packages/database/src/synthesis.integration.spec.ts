import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { EngineCommandSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { commitEngineCommand, getEngineReplay } from './engine.js';
import { createProofRun } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('synthesis persistence', () => {
	run(
		'atomically persists terminal state, social fallout, rumor provenance, and journal deltas',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const runId = randomUUID();
			const drafts = await Promise.all(
				['source', 'recipient', 'witness', 'listener'].map((role) =>
					generateCharacterDraft(recipeFromSeed(`${runId}:${role}`))
				)
			);
			const [source, recipient, witness, listener] = drafts;
			if (!source || !recipient || !witness || !listener) throw new Error('Missing synthesis cast');
			await createProofRun(databaseUrl, {
				runId,
				draft: source,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null,
				developmentMissionScenario: {
					initialMissionId: 'tower-floor-01',
					availableMissionIds: ['tower-floor-01'],
					enableSynthesis: true,
					additionalHeroes: [recipient, witness, listener].map((draft) => ({
						heroId: draft.manifest.characterId,
						manifestHash: draft.manifestHash,
						rarityStars: draft.manifest.rarityStars,
						mind: draft.mind
					}))
				}
			});
			let replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 22) {
				throw new Error('Expected persisted engine-v22 checkpoint');
			}
			const masterId = replay.snapshot.state.master.masterId;
			const synthesisId = randomUUID();
			await commitEngineCommand(
				databaseUrl,
				EngineCommandSchema.parse({
					commandId: synthesisId,
					runId,
					actorId: masterId,
					expectedVersion: replay.snapshot.state.version,
					correlationId: synthesisId,
					source: {
						source: 'manual',
						timing: null,
						fallbackPolicy: null,
						directiveIds: [],
						decisionJobId: null
					},
					commandType: 'settlement.synthesize.hero',
					sourceHeroId: source.manifest.characterId,
					recipientHeroId: recipient.manifest.characterId,
					visibility: 'private',
					warningVersion: 'synthesis-warning-v1',
					confirmedIrreversible: true,
					rationale: 'Prepare for the next tower threshold.'
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 22) throw new Error('Expected replay');
			const receipt = Object.values(replay.snapshot.state.synthesis.receipts)[0]!;
			const rumorId = randomUUID();
			await commitEngineCommand(
				databaseUrl,
				EngineCommandSchema.parse({
					commandId: rumorId,
					runId,
					actorId: recipient.manifest.characterId,
					expectedVersion: replay.snapshot.state.version,
					correlationId: rumorId,
					source: {
						source: 'scripted',
						timing: null,
						fallbackPolicy: null,
						directiveIds: [],
						decisionJobId: null
					},
					commandType: 'hero.share.synthesis.rumor',
					receiptId: receipt.receiptId,
					targetHeroId: listener.manifest.characterId
				})
			);
			const after = await getEngineReplay(databaseUrl, runId);
			if (!after || after.snapshot.state.schemaVersion !== 22) throw new Error('Expected replay');
			expect(after.verified).toBe(true);
			expect(after.hashMatchesPersistedSnapshot).toBe(true);
			expect(after.snapshot.state.heroes[source.manifest.characterId]).toMatchObject({
				lifeState: 'synthesized',
				health: 0,
				equipment: { mainHand: null }
			});
			expect(
				after.snapshot.state.heroes[recipient.manifest.characterId]?.progression.experience
			).toBe(receipt.essenceExperience);
			expect(Object.values(after.snapshot.state.synthesis.rumors)[0]).toMatchObject({
				speakerHeroId: recipient.manifest.characterId,
				listenerHeroId: listener.manifest.characterId,
				chainDepth: 1,
				confidence: 85
			});
			expect(after.playerJournal.entries.map((entry) => entry.eventType)).toEqual([
				'run.initialized',
				'hero.synthesized',
				'social.synthesis.rumor.shared'
			]);
			expect(after.playerJournal.entries[1]).toMatchObject({
				facets: expect.arrayContaining(['progression']),
				participantIds: expect.arrayContaining([
					source.manifest.characterId,
					recipient.manifest.characterId,
					witness.manifest.characterId
				])
			});
		}
	);
});

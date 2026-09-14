import { generateSummonableCharacterDraft, listSummonableHeroDrafts } from '@summonlab/characters';
import { ProofRunSnapshotV2Schema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { projectProofResilience, projectProofRunForPublic } from './proof-presentation.js';

describe('proof presentation for capability characters', () => {
	it('publishes combat attributes without exposing IQ or learning aptitudes', async () => {
		const recipe = listSummonableHeroDrafts()[0]!.recipe;
		const draft = await generateSummonableCharacterDraft(recipe, {
			capabilityEntropy: 'a'.repeat(64)
		});
		const snapshot = ProofRunSnapshotV2Schema.parse({
			runId: '00000000-0000-4000-8000-000000000456',
			characterSchemaVersion: 'character-v2',
			storyEnvelopeId: 'first-ember-v1',
			controlMode: 'wait',
			directive: 'Keep this private.',
			...draft,
			firstObservation: 'The gate closes.',
			firstLine: null,
			destination: null,
			storyBranch: null,
			arrived: false,
			events: [],
			createdAt: '2026-09-09T00:00:00.000Z'
		});

		const projected = projectProofRunForPublic(snapshot);
		const serialized = JSON.stringify(projected);

		expect(projected).toMatchObject({
			runId: snapshot.runId,
			characterSchemaVersion: 'character-v2',
			capabilityProfile: { attributes: snapshot.capabilityProfile.attributes }
		});
		expect(serialized).not.toContain('cognitiveLearningScore');
		expect(serialized).not.toContain('domainAptitudes');
		expect(serialized).not.toContain('Keep this private.');
		expect(projectProofResilience(snapshot)).toEqual({
			label: 'Vitality',
			displayValue: snapshot.capabilityProfile.attributes.vitality,
			percentage: snapshot.capabilityProfile.attributes.vitality
		});
	});
});

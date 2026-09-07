import {
	ProofRunSnapshotSchema,
	ProofRunSnapshotV2Schema,
	type ProofRunSnapshot,
	type ProofRunSnapshotV2
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import * as proofPresentation from './proof-presentation.js';

const manifest = {
	characterId: '00000000-0000-4000-8000-000000000123',
	displayName: 'Boundary Hero',
	appearanceSeed: 'boundary-hero',
	generationVersion: 'human-v6',
	rarityStars: 1,
	adultAge: 26,
	genderPresentation: 'androgynous' as const,
	pronouns: 'they/them',
	bodyFrame: 'balanced' as const,
	bodyBuild: 'athletic' as const,
	heightCm: 174,
	phenotype: {
		skinTone: 'deep umber',
		faceShape: 'oval',
		noseProfile: 'broad straight',
		hairTexture: 'coiled',
		hairColor: 'black',
		hairStyle: 'high knot',
		eyeColor: 'brown'
	},
	voice: { register: 'mid' as const, texture: 'clear', cadence: 'measured' as const },
	posture: 'grounded' as const,
	handedness: 'right' as const,
	visualTraits: ['left brow scar'],
	palette: { skin: '#633b2d', hair: '#17151b', cloth: '#272932', accent: '#d49b47' },
	rig: {
		headScale: 1,
		shoulderWidth: 1,
		hipWidth: 1,
		legRatio: 1,
		anchors: { head: [50, 17], leftHand: [27, 56], rightHand: [73, 56], back: [50, 36] }
	},
	artKey: null,
	assetProvenance: 'procedural' as const
};

const mind = {
	personality: {
		openness: 50,
		conscientiousness: 60,
		extraversion: 40,
		agreeableness: 70,
		emotionalVolatility: 30
	},
	primaryValue: 'duty' as const,
	primaryDrive: 'protect' as const,
	socialStyle: 'direct' as const,
	stressResponse: 'prepare' as const,
	dailyHabit: 'stretches-at-dawn' as const
};

const common = {
	runId: '00000000-0000-4000-8000-000000000456',
	storyEnvelopeId: 'first-ember-v1' as const,
	controlMode: 'wait' as const,
	directive: '',
	recipe: {
		seed: 'proof-boundary',
		generationVersion: 'human-v6',
		cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
	},
	manifest,
	manifestHash: 'a'.repeat(64),
	firstObservation: 'A gate cools behind the hero.',
	firstLine: null,
	destination: null,
	storyBranch: null,
	arrived: false,
	events: [],
	createdAt: '2026-09-06T00:00:00.000Z'
};

function v2Snapshot(): ProofRunSnapshotV2 {
	return ProofRunSnapshotV2Schema.parse({
		...common,
		characterSchemaVersion: 'character-v2',
		mind,
		capabilityProfile: {
			profileVersion: 'character-capability-v1',
			attributes: { might: 41, vitality: 52, agility: 63, spirit: 74 },
			learning: {
				cognitiveLearningScore: 85,
				domainAptitudes: {
					martial: 16,
					magical: 27,
					crafting: 38,
					survival: 49,
					social: 50
				}
			}
		}
	});
}

function legacySnapshot(): ProofRunSnapshot {
	return ProofRunSnapshotSchema.parse({
		...common,
		mind: { ...mind, aptitudes: { might: 4, finesse: 6, insight: 7, resolve: 5 } }
	});
}

describe('public proof presentation', () => {
	it('retains visible v2 attributes while removing the entire learning profile', () => {
		const internal = v2Snapshot() as ProofRunSnapshotV2 & { futureSecret?: string };
		internal.futureSecret = 'future-proof-secret';
		const projected = proofPresentation.projectProofRunForPublic(internal);
		const serialized = JSON.stringify(projected);
		if (!('characterSchemaVersion' in projected)) throw new Error('Expected a v2 projection');

		expect(projected.capabilityProfile.attributes).toEqual({
			might: 41,
			vitality: 52,
			agility: 63,
			spirit: 74
		});
		expect(projected.capabilityProfile).not.toHaveProperty('learning');
		expect(serialized).not.toContain('cognitiveLearningScore');
		expect(serialized).not.toContain('domainAptitudes');
		expect(serialized).not.toContain('future-proof-secret');
		expect(Object.keys(projected).sort()).toEqual(
			[
				'runId', 'characterSchemaVersion', 'storyEnvelopeId', 'controlMode', 'manifest',
				'manifestHash', 'firstObservation', 'firstLine', 'destination', 'storyBranch',
				'arrived', 'events', 'createdAt', 'capabilityProfile'
			].sort()
		);
	});

	it('keeps legacy proof identity while removing legacy recipe and cognition', () => {
		const legacy = legacySnapshot();
		const projected = proofPresentation.projectProofRunForPublic(legacy);
		expect(projected.manifest).toEqual(legacy.manifest);
		expect(projected).not.toHaveProperty('recipe');
		expect(projected).not.toHaveProperty('mind');
		expect(projected).not.toHaveProperty('directive');
		expect(projected).not.toHaveProperty('capabilityProfile');
	});

	it('projects separate display and percentage values for legacy resolve and v2 vitality', () => {
		const projectProofResilience = (
			proofPresentation as typeof proofPresentation & {
				projectProofResilience?: (snapshot: ProofRunSnapshot | ProofRunSnapshotV2) => {
					label: string;
					displayValue: number;
					percentage: number;
				};
			}
		).projectProofResilience;
		expect(projectProofResilience).toBeTypeOf('function');
		if (!projectProofResilience) throw new Error('Expected the resilience projector export');

		expect(projectProofResilience(legacySnapshot())).toEqual({
			label: 'Resolve',
			displayValue: 5,
			percentage: 50
		});
		expect(projectProofResilience(v2Snapshot())).toEqual({
			label: 'Vitality',
			displayValue: 52,
			percentage: 52
		});
	});
});

import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	CharacterCapabilityProfileV1Schema,
	CharacterLearningProfileSchema,
	CombatAttributesSchema
} from './capability.js';
import {
	CharacterDraftSchema,
	CharacterDraftV2Schema,
	CharacterMindSchema,
	CharacterMindV2Schema
} from './character.js';
import {
	ProofRunCreateRequestSchema,
	ProofRunSnapshotSchema,
	ProofRunSnapshotV2Schema,
	PublicProofRunSnapshotV2Schema
} from './proof.js';

function withoutKey<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
	const copy: Partial<T> = { ...value };
	delete copy[key];
	return copy as Omit<T, K>;
}

function capabilityProfile() {
	return {
		profileVersion: 'character-capability-v1' as const,
		attributes: { might: 51, vitality: 52, agility: 53, spirit: 54 },
		learning: {
			cognitiveLearningScore: 55,
			domainAptitudes: {
				martial: 56,
				magical: 57,
				crafting: 58,
				survival: 59,
				social: 60
			}
		}
	};
}

function manifest() {
	return {
		characterId: randomUUID(),
		displayName: 'Capability Hero',
		appearanceSeed: 'capability-seed',
		generationVersion: 'human-v1',
		rarityStars: 1,
		adultAge: 25,
		genderPresentation: 'androgynous',
		pronouns: 'they/them',
		bodyFrame: 'balanced',
		bodyBuild: 'athletic',
		heightCm: 172,
		phenotype: {
			skinTone: 'deep umber',
			faceShape: 'oval',
			noseProfile: 'broad straight',
			hairTexture: 'coiled',
			hairColor: 'black',
			hairStyle: 'high knot',
			eyeColor: 'brown'
		},
		voice: { register: 'mid', texture: 'clear', cadence: 'measured' },
		posture: 'grounded',
		handedness: 'right',
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
		assetProvenance: 'procedural'
	};
}

function legacyMind() {
	return {
		personality: {
			openness: 50,
			conscientiousness: 50,
			extraversion: 50,
			agreeableness: 50,
			emotionalVolatility: 50
		},
		primaryValue: 'duty' as const,
		primaryDrive: 'protect' as const,
		socialStyle: 'direct' as const,
		stressResponse: 'prepare' as const,
		dailyHabit: 'stretches-at-dawn' as const,
		aptitudes: { might: 5, finesse: 5, insight: 5, resolve: 5 }
	};
}

function legacyProofRunSnapshot() {
	return {
		runId: randomUUID(),
		storyEnvelopeId: 'first-ember-v1' as const,
		controlMode: 'autonomous' as const,
		directive: '',
		recipe: {
			seed: 'capability-seed',
			generationVersion: 'human-v1',
			cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
		},
		manifest: manifest(),
		mind: legacyMind(),
		manifestHash: 'a'.repeat(64),
		firstObservation: 'A fire flickers in the distance.',
		firstLine: null,
		destination: null,
		storyBranch: null,
		arrived: false,
		events: [],
		createdAt: '2026-09-06T00:00:00.000Z'
	};
}

function v2Mind() {
	return withoutKey(legacyMind(), 'aptitudes');
}

function v2ProofRunSnapshot() {
	return {
		...legacyProofRunSnapshot(),
		characterSchemaVersion: 'character-v2' as const,
		mind: v2Mind(),
		capabilityProfile: capabilityProfile()
	};
}

describe('character capability contracts', () => {
	it('requires exactly four bounded integer combat attributes', () => {
		expect(CombatAttributesSchema.safeParse(capabilityProfile().attributes).success).toBe(true);
		expect(
			CombatAttributesSchema.safeParse({ ...capabilityProfile().attributes, might: 0 }).success
		).toBe(false);
		expect(
			CombatAttributesSchema.safeParse({ ...capabilityProfile().attributes, spirit: 101 }).success
		).toBe(false);
		expect(
			CombatAttributesSchema.safeParse({ ...capabilityProfile().attributes, agility: 1.5 }).success
		).toBe(false);
		const missingVitality = withoutKey(capabilityProfile().attributes, 'vitality');
		expect(CombatAttributesSchema.safeParse(missingVitality).success).toBe(false);
		expect(
			CombatAttributesSchema.safeParse({ ...capabilityProfile().attributes, morale: 1 }).success
		).toBe(false);
	});

	it('requires bounded learning scores for all named domains', () => {
		expect(CharacterLearningProfileSchema.safeParse(capabilityProfile().learning).success).toBe(
			true
		);
		expect(
			CharacterLearningProfileSchema.safeParse({
				...capabilityProfile().learning,
				cognitiveLearningScore: -1
			}).success
		).toBe(false);
		expect(
			CharacterLearningProfileSchema.safeParse({
				...capabilityProfile().learning,
				cognitiveLearningScore: 101
			}).success
		).toBe(false);
		expect(
			CharacterLearningProfileSchema.safeParse({
				...capabilityProfile().learning,
				domainAptitudes: { ...capabilityProfile().learning.domainAptitudes, martial: 1.5 }
			}).success
		).toBe(false);
		const missingSocialDomain = withoutKey(capabilityProfile().learning.domainAptitudes, 'social');
		expect(
			CharacterLearningProfileSchema.safeParse({
				...capabilityProfile().learning,
				domainAptitudes: missingSocialDomain
			}).success
		).toBe(false);
		expect(
			CharacterLearningProfileSchema.safeParse({
				...capabilityProfile().learning,
				domainAptitudes: { ...capabilityProfile().learning.domainAptitudes, morale: 1 }
			}).success
		).toBe(false);
	});

	it('keeps legacy drafts and proof rows parseable while v2 minds exclude legacy aptitudes', () => {
		const legacySnapshot = legacyProofRunSnapshot();
		const v2Snapshot = v2ProofRunSnapshot();

		expect(CharacterMindSchema.safeParse(legacySnapshot.mind).success).toBe(true);
		expect(CharacterMindV2Schema.safeParse(legacySnapshot.mind).success).toBe(false);
		expect(
			CharacterDraftSchema.safeParse({
				recipe: legacySnapshot.recipe,
				manifest: legacySnapshot.manifest,
				mind: legacySnapshot.mind,
				manifestHash: legacySnapshot.manifestHash
			}).success
		).toBe(true);
		expect(
			CharacterDraftV2Schema.safeParse({
				recipe: v2Snapshot.recipe,
				manifest: v2Snapshot.manifest,
				mind: v2Snapshot.mind,
				capabilityProfile: v2Snapshot.capabilityProfile,
				manifestHash: v2Snapshot.manifestHash
			}).success
		).toBe(true);
		expect(ProofRunSnapshotSchema.safeParse(legacySnapshot).success).toBe(true);
		expect(
			ProofRunCreateRequestSchema.safeParse({
				recipe: legacySnapshot.recipe,
				controlMode: legacySnapshot.controlMode,
				attributes: capabilityProfile().attributes
			}).success
		).toBe(false);
		expect(
			ProofRunCreateRequestSchema.safeParse({
				recipe: legacySnapshot.recipe,
				controlMode: legacySnapshot.controlMode,
				learning: capabilityProfile().learning
			}).success
		).toBe(false);
		expect(
			ProofRunCreateRequestSchema.safeParse({
				recipe: legacySnapshot.recipe,
				controlMode: legacySnapshot.controlMode,
				combatMode: 'legacy-auto-v1'
			}).success
		).toBe(false);
	});

	it('serializes only visible attributes in public v2 proof records', () => {
		const internal = ProofRunSnapshotV2Schema.parse(v2ProofRunSnapshot());

		expect(PublicProofRunSnapshotV2Schema.safeParse(internal).success).toBe(false);
		const publicSnapshot = PublicProofRunSnapshotV2Schema.parse({
			...internal,
			capabilityProfile: {
				profileVersion: internal.capabilityProfile.profileVersion,
				attributes: internal.capabilityProfile.attributes
			}
		});

		expect(CharacterCapabilityProfileV1Schema.safeParse(internal.capabilityProfile).success).toBe(
			true
		);
		expect(publicSnapshot.capabilityProfile.attributes).toEqual(
			internal.capabilityProfile.attributes
		);
		expect(publicSnapshot.capabilityProfile).not.toHaveProperty('learning');
	});
});

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
	CurrentClassMappingFileSchema,
	FamilyPacketSchema
} from './family-affinity-production-lib.js';
import type { CurrentClassMappingEntry } from './family-affinity-production-lib.js';

const validFamily = {
	schemaVersion: 'family-packet-v1',
	familyId: 'test-goblins',
	displayName: 'Test Goblins',
	sourceRaceNumber: 1,
	sourcePage: 'docs/wiki/creatures/monster-races/generator-bestiary-01.md',
	classificationNotes: 'A fixture family for the production ledger.',
	visualConstants: ['short stature', 'angular ears'],
	escalationAxis: 'Tool quality and command authority.',
	floorSlot: null,
	affinityThemes: {
		normal: {
			constructionDimensions: ['native materials', 'restrained neutral effects'],
			counterplaySignal: 'The established weak point remains unchanged.',
			forbidden: ['elemental anatomy', 'elemental glow', 'environmental wake']
		},
		fire: {
			constructionDimensions: ['ember seams', 'heat-blackened surfaces'],
			counterplaySignal: 'A heat sink opens between combustion cycles.',
			forbidden: ['uniform orange wash']
		},
		earth: {
			constructionDimensions: ['sediment layers', 'load-bearing stone growth'],
			counterplaySignal: 'A fracture seam opens after committed movement.',
			forbidden: ['brown recolor']
		},
		wind: {
			constructionDimensions: ['directional cloth', 'pressure distortion'],
			counterplaySignal: 'The still center remains visible between attacks.',
			forbidden: ['pale recolor']
		},
		water: {
			constructionDimensions: ['wet reflection', 'coherent fluid transitions'],
			counterplaySignal: 'Pressure loss exposes the binding core.',
			forbidden: ['shapeless blue body']
		}
	},
	forms: [
		{
			tier: 'T1',
			formId: 'test-goblin-runt',
			displayName: 'Test Goblin Runt',
			primaryArchetype: 'Initiate',
			battlefieldDuty: 'Probe the family mechanic.',
			teachingGoal: 'Read the weak point.',
			signatureMechanic: null,
			telegraph: null,
			counterplay: null,
			visualDelta: 'Incomplete equipment.',
			lowerFormInteraction: null,
			sourceReferences: ['Runt']
		},
		{
			tier: 'T2',
			formId: 'test-goblin-cutter',
			displayName: 'Test Goblin Cutter',
			primaryArchetype: 'Soldier',
			battlefieldDuty: 'Repeat the family grammar.',
			teachingGoal: 'Recognize reliable pressure.',
			signatureMechanic: null,
			telegraph: null,
			counterplay: null,
			visualDelta: 'Mature equipment.',
			lowerFormInteraction: null,
			sourceReferences: ['Cutter']
		},
		{
			tier: 'T3',
			formId: 'test-goblin-raider',
			displayName: 'Test Goblin Raider',
			primaryArchetype: 'Specialist',
			battlefieldDuty: 'Create the family pivot.',
			teachingGoal: 'Counter the specialist role.',
			signatureMechanic: 'Marks an exposed target.',
			telegraph: 'Raises a marked spear.',
			counterplay: 'Break line of sight before the throw.',
			visualDelta: 'Visible spear and target marks.',
			lowerFormInteraction: null,
			sourceReferences: ['Raider']
		},
		{
			tier: 'T4',
			formId: 'test-goblin-warboss',
			displayName: 'Test Goblin Warboss',
			primaryArchetype: 'Champion',
			battlefieldDuty: 'Combine established mechanics.',
			teachingGoal: 'Prioritize a commander.',
			signatureMechanic: null,
			telegraph: null,
			counterplay: null,
			visualDelta: 'Prestigious armor.',
			lowerFormInteraction: null,
			sourceReferences: ['Warboss']
		},
		{
			tier: 'T5',
			formId: 'test-goblin-king',
			displayName: 'Test Goblin King',
			primaryArchetype: 'Sovereign',
			battlefieldDuty: 'Command the family grammar as a boss.',
			teachingGoal: 'Read a boss phase and command behavior.',
			signatureMechanic: 'Calls a command phase that arms lower forms.',
			telegraph: 'Raises the command banner.',
			counterplay: 'Destroy the banner before the command resolves.',
			visualDelta: 'Unique crown and command banner.',
			lowerFormInteraction: 'Commands Cutters to guard the banner.',
			sourceReferences: ['Goblin King']
		}
	]
};

const validMappingEntries: CurrentClassMappingEntry[] = Array.from({ length: 40 }, (_, index) => ({
	currentClassId: `current-class-${index + 1}`,
	sourceRoster: 'visual-index-v1',
	sourceFamilyLabel: 'Fixture family',
	disposition: 'map',
	canonicalFamilyId: 'test-goblins',
	canonicalFormId: `test-form-${index + 1}`,
	rationale: 'Retained as a fixture mapping.',
	candidateReuseByAffinity: {
		normal: false,
		fire: false,
		earth: false,
		wind: false,
		water: false
	}
}));

describe('family affinity production schemas', () => {
	it('loads the Goblins packet with source tiers and normalized progression contracts', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/01-goblins.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);

		expect(
			packet.forms.map(({ tier, sourceReferences, primaryArchetype }) => ({
				tier,
				sourceName: sourceReferences[0],
				primaryArchetype
			}))
		).toEqual([
			{ tier: 'T1', sourceName: 'Runt', primaryArchetype: 'Mob Harrier (Initiate)' },
			{ tier: 'T2', sourceName: 'Cutter', primaryArchetype: 'Scrap-Line Bully (Soldier)' },
			{
				tier: 'T3',
				sourceName: 'Raider',
				primaryArchetype: 'Door-Shield Breacher (Specialist)'
			},
			{
				tier: 'T4',
				sourceName: 'Warboss',
				primaryArchetype: 'Banner-Rally Enforcer (Champion)'
			},
			{
				tier: 'T5',
				sourceName: 'Goblin King',
				primaryArchetype: 'Warren Lootworks Monarch (Sovereign)'
			}
		]);
	});

	it('parses a complete five-form family packet', () => {
		expect(() => FamilyPacketSchema.parse(validFamily)).not.toThrow();
	});

	it('rejects a family with fewer or more than five forms', () => {
		expect(() =>
			FamilyPacketSchema.parse({ ...validFamily, forms: validFamily.forms.slice(0, 4) })
		).toThrow(/five forms/i);
		expect(() =>
			FamilyPacketSchema.parse({
				...validFamily,
				forms: [...validFamily.forms, validFamily.forms[0]]
			})
		).toThrow(/five forms/i);
	});

	it('rejects duplicate form tiers and IDs', () => {
		const formsWithDuplicateTier = structuredClone(validFamily.forms);
		formsWithDuplicateTier[1]!.tier = 'T1';
		expect(() =>
			FamilyPacketSchema.parse({ ...validFamily, forms: formsWithDuplicateTier })
		).toThrow(/tiers must be unique/i);

		const formsWithDuplicateId = structuredClone(validFamily.forms);
		formsWithDuplicateId[1]!.formId = formsWithDuplicateId[0]!.formId;
		expect(() => FamilyPacketSchema.parse({ ...validFamily, forms: formsWithDuplicateId })).toThrow(
			/form IDs must be unique/i
		);
	});

	it('rejects a T3 without a signature mechanic', () => {
		const forms = structuredClone(validFamily.forms);
		forms[2]!.signatureMechanic = null;
		expect(() => FamilyPacketSchema.parse({ ...validFamily, forms })).toThrow(
			/T3.*signature mechanic/i
		);
	});

	it('rejects a T3 without a telegraph', () => {
		const forms = structuredClone(validFamily.forms);
		forms[2]!.telegraph = null;
		expect(() => FamilyPacketSchema.parse({ ...validFamily, forms })).toThrow(/T3.*telegraph/i);
	});

	it('rejects a T3 without counterplay', () => {
		const forms = structuredClone(validFamily.forms);
		forms[2]!.counterplay = null;
		expect(() => FamilyPacketSchema.parse({ ...validFamily, forms })).toThrow(/T3.*counterplay/i);
	});

	it('rejects a T5 without a boss mechanic', () => {
		const forms = structuredClone(validFamily.forms);
		forms[4]!.signatureMechanic = null;
		expect(() => FamilyPacketSchema.parse({ ...validFamily, forms })).toThrow(/T5.*boss mechanic/i);
	});

	it('rejects a T5 without lower-form interaction', () => {
		const forms = structuredClone(validFamily.forms);
		forms[4]!.lowerFormInteraction = null;
		expect(() => FamilyPacketSchema.parse({ ...validFamily, forms })).toThrow(
			/T5.*lower-form interaction/i
		);
	});

	it('rejects affinities outside the approved production IDs', () => {
		const affinityThemes = {
			...validFamily.affinityThemes,
			wood: validFamily.affinityThemes.earth
		};
		expect(() => FamilyPacketSchema.parse({ ...validFamily, affinityThemes })).toThrow(
			/unrecognized key|invalid key/i
		);
	});

	it('requires all five approved affinity themes', () => {
		const affinityThemes = structuredClone(validFamily.affinityThemes) as Record<string, unknown>;
		delete affinityThemes.water;
		expect(() => FamilyPacketSchema.parse({ ...validFamily, affinityThemes })).toThrow(
			/expected object|invalid input/i
		);
	});

	it('requires forty unique current-class mappings', () => {
		expect(() =>
			CurrentClassMappingFileSchema.parse({
				schemaVersion: 'current-class-mapping-v1',
				entries: []
			})
		).toThrow(/40 current classes/i);
		expect(() =>
			CurrentClassMappingFileSchema.parse({
				schemaVersion: 'current-class-mapping-v1',
				entries: [...validMappingEntries.slice(0, 39), validMappingEntries[0]]
			})
		).toThrow(/current class IDs must be unique/i);
	});

	it('requires candidate-reuse eligibility for all five approved affinities', () => {
		const entries = structuredClone(validMappingEntries);
		const candidateReuseByAffinity = entries[0]!.candidateReuseByAffinity as Record<
			string,
			boolean
		>;
		delete candidateReuseByAffinity.water;
		expect(() =>
			CurrentClassMappingFileSchema.parse({
				schemaVersion: 'current-class-mapping-v1',
				entries
			})
		).toThrow(/expected boolean|invalid input/i);
	});

	it('requires canonical IDs only for map dispositions', () => {
		const missingMapCanonicalIds = structuredClone(validMappingEntries);
		missingMapCanonicalIds[0]!.canonicalFamilyId = null;
		missingMapCanonicalIds[0]!.canonicalFormId = null;
		expect(() =>
			CurrentClassMappingFileSchema.parse({
				schemaVersion: 'current-class-mapping-v1',
				entries: missingMapCanonicalIds
			})
		).toThrow(/map.*canonical family and form IDs/i);

		const retiredWithCanonicalIds = structuredClone(validMappingEntries);
		retiredWithCanonicalIds[0]!.disposition = 'retire';
		expect(() =>
			CurrentClassMappingFileSchema.parse({
				schemaVersion: 'current-class-mapping-v1',
				entries: retiredWithCanonicalIds
			})
		).toThrow(/retire.*canonical IDs to be null/i);
	});
});

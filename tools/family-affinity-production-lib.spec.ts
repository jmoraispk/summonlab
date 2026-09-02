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

const waveAFamilyFixtures = [
	{
		fileName: '02-orcs.json',
		sourceRaceNumber: 2,
		forms: [
			{ tier: 'T1', displayName: 'Grunt', sourceReferences: ['Grunt'] },
			{ tier: 'T2', displayName: 'Warrior', sourceReferences: ['Warrior'] },
			{ tier: 'T3', displayName: 'Berserker', sourceReferences: ['Berserker'] },
			{ tier: 'T4', displayName: 'Warchief', sourceReferences: ['Warchief'] },
			{ tier: 'T5', displayName: 'Overlord', sourceReferences: ['Overlord'] }
		]
	},
	{
		fileName: '03-giants.json',
		sourceRaceNumber: 3,
		forms: [
			{ tier: 'T1', displayName: 'Brute', sourceReferences: ['Brute'] },
			{ tier: 'T2', displayName: 'Hill Giant', sourceReferences: ['Hill Giant'] },
			{ tier: 'T3', displayName: 'Stone Giant', sourceReferences: ['Stone Giant'] },
			{ tier: 'T4', displayName: 'Mountain Lord', sourceReferences: ['Mountain Lord'] },
			{ tier: 'T5', displayName: 'Primordial Titan', sourceReferences: ['Primordial Titan'] }
		]
	},
	{
		fileName: '04-trolls.json',
		sourceRaceNumber: 4,
		forms: [
			{ tier: 'T1', displayName: 'Scrag', sourceReferences: ['Scrag'] },
			{ tier: 'T2', displayName: 'Bog Troll', sourceReferences: ['Bog Troll'] },
			{ tier: 'T3', displayName: 'Mutant Troll', sourceReferences: ['Mutant Troll'] },
			{ tier: 'T4', displayName: 'Scarlord', sourceReferences: ['Scarlord'] },
			{ tier: 'T5', displayName: 'Elder Troll', sourceReferences: ['Elder Troll'] }
		]
	},
	{
		fileName: '05-dragons.json',
		sourceRaceNumber: 5,
		forms: [
			{ tier: 'T1', displayName: 'Whelp', sourceReferences: ['Whelp'] },
			{ tier: 'T2', displayName: 'Fledgling', sourceReferences: ['Fledgling'] },
			{ tier: 'T3', displayName: 'Drake', sourceReferences: ['Drake'] },
			{ tier: 'T4', displayName: 'Elder Wyrm', sourceReferences: ['Elder Wyrm'] },
			{ tier: 'T5', displayName: 'Dragon Emperor', sourceReferences: ['Dragon Emperor'] }
		]
	},
	{
		fileName: '06-skeletons.json',
		sourceRaceNumber: 6,
		forms: [
			{ tier: 'T1', displayName: 'Rattler', sourceReferences: ['Rattler'] },
			{ tier: 'T2', displayName: 'Bonesoldier', sourceReferences: ['Bonesoldier'] },
			{ tier: 'T3', displayName: 'Bone Knight', sourceReferences: ['Bone Knight'] },
			{ tier: 'T4', displayName: 'Bone Champion', sourceReferences: ['Bone Champion'] },
			{ tier: 'T5', displayName: 'Lich King', sourceReferences: ['Lich King'] }
		]
	}
] as const;

const waveBFamilyFixtures = [
	{
		fileName: '07-rotwalkers.json',
		sourceRaceNumber: 7,
		forms: [
			{ tier: 'T1', displayName: 'Shambler', sourceReferences: ['Shambler'] },
			{ tier: 'T2', displayName: 'Ghoul', sourceReferences: ['Ghoul'] },
			{ tier: 'T3', displayName: 'Rot Brute', sourceReferences: ['Rot Brute'] },
			{ tier: 'T4', displayName: 'Amalgam', sourceReferences: ['Amalgam'] },
			{ tier: 'T5', displayName: 'Plague Lord', sourceReferences: ['Plague Lord'] }
		]
	},
	{
		fileName: '08-wraiths.json',
		sourceRaceNumber: 8,
		forms: [
			{ tier: 'T1', displayName: 'Shade', sourceReferences: ['Shade'] },
			{ tier: 'T2', displayName: 'Haunt', sourceReferences: ['Haunt'] },
			{ tier: 'T3', displayName: 'Wraith', sourceReferences: ['Wraith'] },
			{ tier: 'T4', displayName: 'Crowned Specter', sourceReferences: ['Crowned Specter'] },
			{ tier: 'T5', displayName: 'Death Sovereign', sourceReferences: ['Death Sovereign'] }
		]
	},
	{
		fileName: '09-vampires.json',
		sourceRaceNumber: 9,
		forms: [
			{ tier: 'T1', displayName: 'Thrall', sourceReferences: ['Thrall'] },
			{ tier: 'T2', displayName: 'Bloodkin', sourceReferences: ['Bloodkin'] },
			{ tier: 'T3', displayName: 'Noble', sourceReferences: ['Noble'] },
			{ tier: 'T4', displayName: 'Ancient', sourceReferences: ['Ancient'] },
			{ tier: 'T5', displayName: 'Progenitor', sourceReferences: ['Progenitor'] }
		]
	},
	{
		fileName: '10-mummies.json',
		sourceRaceNumber: 10,
		forms: [
			{ tier: 'T1', displayName: 'Husk', sourceReferences: ['Husk'] },
			{ tier: 'T2', displayName: 'Tomb Guard', sourceReferences: ['Tomb Guard'] },
			{ tier: 'T3', displayName: 'Sacred Servant', sourceReferences: ['Sacred Servant'] },
			{
				tier: 'T4',
				displayName: "Pharaoh's Champion",
				sourceReferences: ["Pharaoh's Champion"]
			},
			{ tier: 'T5', displayName: 'God-King', sourceReferences: ['God-King'] }
		]
	},
	{
		fileName: '11-demons.json',
		sourceRaceNumber: 11,
		forms: [
			{ tier: 'T1', displayName: 'Imp', sourceReferences: ['Imp'] },
			{ tier: 'T2', displayName: 'Fiend', sourceReferences: ['Fiend'] },
			{ tier: 'T3', displayName: 'Hellknight', sourceReferences: ['Hellknight'] },
			{ tier: 'T4', displayName: 'Archfiend', sourceReferences: ['Archfiend'] },
			{ tier: 'T5', displayName: 'Demon Prince', sourceReferences: ['Demon Prince'] }
		]
	},
	{
		fileName: '12-celestials.json',
		sourceRaceNumber: 12,
		forms: [
			{ tier: 'T1', displayName: 'Messenger', sourceReferences: ['Messenger'] },
			{ tier: 'T2', displayName: 'Guardian', sourceReferences: ['Guardian'] },
			{ tier: 'T3', displayName: 'Warden', sourceReferences: ['Warden'] },
			{ tier: 'T4', displayName: 'Archon', sourceReferences: ['Archon'] },
			{ tier: 'T5', displayName: 'Seraph', sourceReferences: ['Seraph'] }
		]
	}
] as const;

const waveCFamilyFixtures = [
	{
		fileName: '13-harpies.json',
		familyId: 'harpies',
		displayName: 'Harpies',
		sourceRaceNumber: 13,
		forms: [
			{ tier: 'T1', displayName: 'Screecher', sourceReferences: ['Screecher'] },
			{ tier: 'T2', displayName: 'Talon', sourceReferences: ['Talon'] },
			{ tier: 'T3', displayName: 'Skyrender', sourceReferences: ['Skyrender'] },
			{ tier: 'T4', displayName: 'Matriarch', sourceReferences: ['Matriarch'] },
			{ tier: 'T5', displayName: 'Sky Queen', sourceReferences: ['Sky Queen'] }
		]
	},
	{
		fileName: '14-minotaurs.json',
		familyId: 'minotaurs',
		displayName: 'Minotaurs',
		sourceRaceNumber: 14,
		forms: [
			{ tier: 'T1', displayName: 'Bull-kin', sourceReferences: ['Bull-kin'] },
			{ tier: 'T2', displayName: 'Charger', sourceReferences: ['Charger'] },
			{
				tier: 'T3',
				displayName: 'Labyrinth Warrior',
				sourceReferences: ['Labyrinth Warrior']
			},
			{
				tier: 'T4',
				displayName: 'Arena Champion',
				sourceReferences: ['Arena Champion']
			},
			{ tier: 'T5', displayName: 'Bull Emperor', sourceReferences: ['Bull Emperor'] }
		]
	},
	{
		fileName: '15-nagas.json',
		familyId: 'nagas',
		displayName: 'Nagas',
		sourceRaceNumber: 15,
		forms: [
			{ tier: 'T1', displayName: 'Serpentling', sourceReferences: ['Serpentling'] },
			{ tier: 'T2', displayName: 'Coilguard', sourceReferences: ['Coilguard'] },
			{ tier: 'T3', displayName: 'Hooded Adept', sourceReferences: ['Hooded Adept'] },
			{
				tier: 'T4',
				displayName: 'Temple Guardian',
				sourceReferences: ['Temple Guardian']
			},
			{
				tier: 'T5',
				displayName: 'Serpent Empress',
				sourceReferences: ['Serpent Empress']
			}
		]
	},
	{
		fileName: '16-lizardfolk.json',
		familyId: 'lizardfolk',
		displayName: 'Lizardfolk',
		sourceRaceNumber: 16,
		forms: [
			{ tier: 'T1', displayName: 'Scout', sourceReferences: ['Scout'] },
			{ tier: 'T2', displayName: 'Warrior', sourceReferences: ['Warrior'] },
			{ tier: 'T3', displayName: 'Spineback', sourceReferences: ['Spineback'] },
			{
				tier: 'T4',
				displayName: 'Swamp Chieftain',
				sourceReferences: ['Swamp Chieftain']
			},
			{ tier: 'T5', displayName: 'Saurian Tyrant', sourceReferences: ['Saurian Tyrant'] }
		]
	},
	{
		fileName: '17-insectoids.json',
		familyId: 'insectoids',
		displayName: 'Insectoids',
		sourceRaceNumber: 17,
		forms: [
			{ tier: 'T1', displayName: 'Worker', sourceReferences: ['Worker'] },
			{ tier: 'T2', displayName: 'Soldier', sourceReferences: ['Soldier'] },
			{ tier: 'T3', displayName: 'Elite Drone', sourceReferences: ['Elite Drone'] },
			{ tier: 'T4', displayName: 'Royal Guard', sourceReferences: ['Royal Guard'] },
			{ tier: 'T5', displayName: 'Hive Queen', sourceReferences: ['Hive Queen'] }
		]
	},
	{
		fileName: '18-arachnids.json',
		familyId: 'arachnids',
		displayName: 'Arachnids',
		sourceRaceNumber: 18,
		forms: [
			{ tier: 'T1', displayName: 'Crawler', sourceReferences: ['Crawler'] },
			{ tier: 'T2', displayName: 'Stalker', sourceReferences: ['Stalker'] },
			{ tier: 'T3', displayName: 'Weaver', sourceReferences: ['Weaver'] },
			{ tier: 'T4', displayName: 'Broodmother', sourceReferences: ['Broodmother'] },
			{ tier: 'T5', displayName: 'Weaver Queen', sourceReferences: ['Weaver Queen'] }
		]
	}
] as const;

const waveDFamilyFixtures = [
	{
		fileName: '19-slimes.json',
		familyId: 'slimes',
		displayName: 'Slimes',
		sourceRaceNumber: 19,
		forms: [
			{ tier: 'T1', displayName: 'Droplet', sourceReferences: ['Droplet'] },
			{ tier: 'T2', displayName: 'Blob', sourceReferences: ['Blob'] },
			{ tier: 'T3', displayName: 'Ooze Knight', sourceReferences: ['Ooze Knight'] },
			{ tier: 'T4', displayName: 'Devourer', sourceReferences: ['Devourer'] },
			{ tier: 'T5', displayName: 'Primordial Ooze', sourceReferences: ['Primordial Ooze'] }
		]
	},
	{
		fileName: '20-golems.json',
		familyId: 'golems',
		displayName: 'Golems',
		sourceRaceNumber: 20,
		forms: [
			{ tier: 'T1', displayName: 'Clay Figure', sourceReferences: ['Clay Figure'] },
			{ tier: 'T2', displayName: 'Stone Servant', sourceReferences: ['Stone Servant'] },
			{ tier: 'T3', displayName: 'Rune Warrior', sourceReferences: ['Rune Warrior'] },
			{ tier: 'T4', displayName: 'Basalt Colossus', sourceReferences: ['Basalt Colossus'] },
			{ tier: 'T5', displayName: 'Master Golem', sourceReferences: ['Master Golem'] }
		]
	},
	{
		fileName: '21-flame-elementals.json',
		familyId: 'flame-elementals',
		displayName: 'Flame Elementals',
		sourceRaceNumber: 21,
		forms: [
			{ tier: 'T1', displayName: 'Wisp', sourceReferences: ['Wisp'] },
			{ tier: 'T2', displayName: 'Flame Spirit', sourceReferences: ['Flame Spirit'] },
			{ tier: 'T3', displayName: 'Blaze Warden', sourceReferences: ['Blaze Warden'] },
			{ tier: 'T4', displayName: 'Magma Lord', sourceReferences: ['Magma Lord'] },
			{
				tier: 'T5',
				displayName: 'Conflagration Sovereign',
				sourceReferences: ['Conflagration Sovereign']
			}
		]
	},
	{
		fileName: '22-treants.json',
		familyId: 'treants',
		displayName: 'Treants',
		sourceRaceNumber: 22,
		forms: [
			{ tier: 'T1', displayName: 'Sapling-walker', sourceReferences: ['Sapling-walker'] },
			{ tier: 'T2', displayName: 'Young Treant', sourceReferences: ['Young Treant'] },
			{ tier: 'T3', displayName: 'Oakheart', sourceReferences: ['Oakheart'] },
			{ tier: 'T4', displayName: 'Elder Warden', sourceReferences: ['Elder Warden'] },
			{
				tier: 'T5',
				displayName: 'World-Tree Warden',
				sourceReferences: ['World-Tree Warden']
			}
		]
	},
	{
		fileName: '23-fungalfolk.json',
		familyId: 'fungalfolk',
		displayName: 'Fungalfolk',
		sourceRaceNumber: 23,
		forms: [
			{ tier: 'T1', displayName: 'Sporeling', sourceReferences: ['Sporeling'] },
			{ tier: 'T2', displayName: 'Mycon', sourceReferences: ['Mycon'] },
			{ tier: 'T3', displayName: 'Sporeguard', sourceReferences: ['Sporeguard'] },
			{ tier: 'T4', displayName: 'Fungal Shaman', sourceReferences: ['Fungal Shaman'] },
			{
				tier: 'T5',
				displayName: 'Mycelial Sovereign',
				sourceReferences: ['Mycelial Sovereign']
			}
		]
	},
	{
		fileName: '24-deep-ones.json',
		familyId: 'deep-ones',
		displayName: 'Deep Ones',
		sourceRaceNumber: 24,
		forms: [
			{ tier: 'T1', displayName: 'Fishman', sourceReferences: ['Fishman'] },
			{ tier: 'T2', displayName: 'Tidewarrior', sourceReferences: ['Tidewarrior'] },
			{ tier: 'T3', displayName: 'Abyssal Hunter', sourceReferences: ['Abyssal Hunter'] },
			{ tier: 'T4', displayName: 'Deep Priest', sourceReferences: ['Deep Priest'] },
			{ tier: 'T5', displayName: 'Leviathan Lord', sourceReferences: ['Leviathan Lord'] }
		]
	}
] as const;

describe('Wave A family packets', () => {
	it.each(waveAFamilyFixtures)(
		'loads $fileName with exact source identity and tier coverage',
		async ({ fileName, sourceRaceNumber, forms }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);

			expect(packet.sourceRaceNumber).toBe(sourceRaceNumber);
			expect(
				packet.forms.map(({ tier, displayName, sourceReferences }) => ({
					tier,
					displayName,
					sourceReferences
				}))
			).toEqual(forms);
		}
	);

	it('gives the wingless Dragon Whelp ground-based Fire and Wind construction branches', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/05-dragons.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);

		expect(packet.forms[0]!.visualDelta).toMatch(/wingless/iu);

		const fireTheme = packet.affinityThemes.fire;
		expect(fireTheme.constructionDimensions.join(' ')).toMatch(
			/wingless T1 Whelp.*(?:ground|pounce)/iu
		);
		expect(fireTheme.counterplaySignal).toMatch(/wingless T1 Whelp.*ground pounce/iu);
		expect(fireTheme.constructionDimensions.join(' ')).toMatch(/T2[–-]T5.*(?:wing|membrane)/iu);

		const windTheme = packet.affinityThemes.wind;
		expect(windTheme.constructionDimensions.join(' ')).toMatch(
			/wingless T1 Whelp.*(?:ground|pounce)/iu
		);
		expect(windTheme.counterplaySignal).toMatch(/wingless T1 Whelp.*ground pounce/iu);
		expect(windTheme.constructionDimensions.join(' ')).toMatch(/T2[–-]T5.*(?:wing|membrane)/iu);
	});

	it('keeps all three Mutant Troll motifs incomplete and inert until Wrong-Part Fork selects one', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/04-trolls.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);
		const mutantTroll = packet.forms[2]!;

		expect(mutantTroll.visualDelta).toMatch(/three visibly incomplete, inert motifs/iu);
		expect(mutantTroll.visualDelta).toMatch(/budded extra arm/iu);
		expect(mutantTroll.visualDelta).toMatch(/sealed second-jaw seam/iu);
		expect(mutantTroll.visualDelta).toMatch(/outward rib sprouts/iu);
		expect(mutantTroll.visualDelta).toMatch(/only the selected bud.*completes its motif/iu);
	});
});

describe('Wave B family packets', () => {
	it.each(waveBFamilyFixtures)(
		'loads $fileName with exact source identity and tier coverage',
		async ({ fileName, sourceRaceNumber, forms }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);

			expect(packet.sourceRaceNumber).toBe(sourceRaceNumber);
			expect(packet.sourcePage).toBe('docs/wiki/creatures/monster-races/generator-bestiary-02.md');
			expect(packet.floorSlot).toBeNull();
			expect(
				packet.forms.map(({ tier, displayName, sourceReferences }) => ({
					tier,
					displayName,
					sourceReferences
				}))
			).toEqual(forms);
		}
	);

	it.each([
		{
			fileName: '08-wraiths.json',
			nativeMotifBinding:
				/(?:family-native|non-affinity)[^.]*\b(?:cold|frost)\b|\b(?:cold|frost)\b[^.]*(?:family-native|non-affinity)/iu
		},
		{
			fileName: '10-mummies.json',
			nativeMotifBinding:
				/(?:family-native|non-affinity)[^.]*\b(?:sand|dust)\b|\b(?:sand|dust)\b[^.]*(?:family-native|non-affinity)/iu
		},
		{
			fileName: '11-demons.json',
			nativeMotifBinding:
				/(?:family-native|non-affinity)[^.]*\b(?:ember|magma|fire)\b|\b(?:ember|magma|fire)\b[^.]*(?:family-native|non-affinity)/iu
		},
		{
			fileName: '12-celestials.json',
			nativeMotifBinding:
				/(?:family-native|non-affinity)[^.]*\b(?:light|radiance)\b|\b(?:light|radiance)\b[^.]*(?:family-native|non-affinity)/iu
		}
	])(
		'distinguishes $fileName source-native motifs from elemental affinity construction',
		async ({ fileName, nativeMotifBinding }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);

			const normalEntries = [
				...packet.affinityThemes.normal.constructionDimensions,
				packet.affinityThemes.normal.counterplaySignal,
				...packet.affinityThemes.normal.forbidden
			];
			expect(normalEntries).toEqual(
				expect.arrayContaining([expect.stringMatching(nativeMotifBinding)])
			);

			const normalTheme = normalEntries.join(' ');
			expect(normalTheme).toMatch(/unexplained elemental anatomy/iu);
			expect(normalTheme).toMatch(/unexplained elemental glow/iu);
			expect(normalTheme).toMatch(/unexplained environmental wake/iu);

			for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
				expect(packet.affinityThemes[affinity].constructionDimensions).toHaveLength(2);
				expect(packet.affinityThemes[affinity].forbidden.join(' ')).toMatch(/palette-only/iu);
				expect(packet.affinityThemes[affinity].forbidden.join(' ')).toMatch(/glow-only/iu);
			}
		}
	);

	it('gives the two-point T1 Shade explicit construction and counterplay in every elemental theme', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/08-wraiths.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);

		for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
			const theme = packet.affinityThemes[affinity];
			const shadeConstruction = theme.constructionDimensions.map((dimension) => {
				const [shadeBranch, matureBranch] = dimension.split(/T2[–-]T5/u);
				expect(matureBranch, `${affinity} mature branch`).toBeTruthy();
				expect(shadeBranch, `${affinity} T1 construction branch`).toMatch(/T1 Shade/iu);
				return shadeBranch!;
			});
			const shadeConstructionText = shadeConstruction.join(' ');
			expect(shadeConstructionText, `${affinity} two-point identity`).toMatch(
				/two cold eye points/iu
			);
			expect(shadeConstructionText, `${affinity} transient outline`).toMatch(
				/transient vapor outline/iu
			);
			expect(shadeConstructionText, `${affinity} later-form anatomy`).not.toMatch(
				/chain|crown|armor|hood|blade|shroud/iu
			);

			const [shadeCounterplay, matureCounterplay] = theme.counterplaySignal.split(/T2[–-]T5/u);
			expect(matureCounterplay, `${affinity} mature counterplay`).toBeTruthy();
			expect(shadeCounterplay, `${affinity} T1 counterplay branch`).toMatch(/T1 Shade/iu);
			expect(shadeCounterplay, `${affinity} eye readability`).toMatch(
				/eye alignment|eye gap|still center/iu
			);
			expect(shadeCounterplay, `${affinity} later-form counterplay anatomy`).not.toMatch(
				/chain|crown|armor|hood|blade|shroud/iu
			);
		}
	});
});

describe('Wave C family packets', () => {
	it.each(waveCFamilyFixtures)(
		'loads $fileName with exact source identity and tier coverage',
		async ({ fileName, familyId, displayName, sourceRaceNumber, forms }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);

			expect(packet.familyId).toBe(familyId);
			expect(packet.displayName).toBe(displayName);
			expect(packet.sourceRaceNumber).toBe(sourceRaceNumber);
			expect(packet.sourcePage).toBe('docs/wiki/creatures/monster-races/generator-bestiary-03.md');
			expect(packet.floorSlot).toBeNull();
			expect(
				packet.forms.map(({ tier, displayName: formDisplayName, sourceReferences }) => ({
					tier,
					displayName: formDisplayName,
					sourceReferences
				}))
			).toEqual(forms);
			expect(new Set(packet.forms.map((form) => form.formId)).size).toBe(5);
			expect(new Set(packet.forms.map((form) => form.battlefieldDuty)).size).toBe(5);
			expect(packet.forms[2]!.primaryArchetype).toMatch(/Specialist/iu);
			expect(packet.forms[4]!.primaryArchetype).toMatch(/Sovereign/iu);
		}
	);

	it.each([
		{ fileName: '13-harpies.json', motifs: [/ordinary wing/iu, /loose-feather wind halo/iu] },
		{ fileName: '14-minotaurs.json', motifs: [/brazier-like eye glow/iu] },
		{ fileName: '15-nagas.json', motifs: [/sacred water/iu] },
		{ fileName: '16-lizardfolk.json', motifs: [/swamp/iu, /ordinary mud/iu] },
		{ fileName: '17-insectoids.json', motifs: [/amber/iu, /wing membrane/iu] },
		{ fileName: '18-arachnids.json', motifs: [/silk/iu, /venom/iu, /eye glow/iu] }
	])(
		'binds every $fileName source-native motif to a non-affinity Normal declaration',
		async ({ fileName, motifs }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);
			const normalEntries = [
				...packet.affinityThemes.normal.constructionDimensions,
				packet.affinityThemes.normal.counterplaySignal,
				...packet.affinityThemes.normal.forbidden
			];
			for (const motif of motifs) {
				const boundEntry = normalEntries.find(
					(entry) => /family-native|non-affinity/iu.test(entry) && motif.test(entry)
				);
				expect(boundEntry, `direct Normal binding for ${motif.source}`).toBeDefined();
			}
			expect(normalEntries.join(' ')).toMatch(/unexplained elemental anatomy/iu);
			expect(normalEntries.join(' ')).toMatch(/unexplained elemental glow/iu);
			expect(normalEntries.join(' ')).toMatch(/unexplained environmental wake/iu);
			for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
				expect(packet.affinityThemes[affinity].constructionDimensions).toHaveLength(2);
				expect(packet.affinityThemes[affinity].forbidden.join(' ')).toMatch(/palette-only/iu);
				expect(packet.affinityThemes[affinity].forbidden.join(' ')).toMatch(/glow-only/iu);
			}
		}
	);

	it.each([
		{
			fileName: '15-nagas.json',
			early: /T1[–-]T2[^.]*no hood[^.]*two arms/iu,
			later: /T3[–-]T5[^.]*hood[^.]*multiple arms/iu
		},
		{
			fileName: '17-insectoids.json',
			early: /T1[–-]T2[^.]*no wings/iu,
			later: /T3[^.]*wing cases[^.]*T4[^.]*functional wings[^.]*T5[^.]*wingless/iu
		},
		{
			fileName: '18-arachnids.json',
			early: /T1[–-]T2[^.]*spider[^.]*no humanoid torso/iu,
			later: /T3[–-]T5[^.]*humanoid torso/iu
		}
	])(
		'gives $fileName tier-safe construction branches in every elemental theme',
		async ({ fileName, early, later }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);

			for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
				const construction = packet.affinityThemes[affinity].constructionDimensions.join(' ');
				expect(construction, `${affinity} early anatomy branch`).toMatch(early);
				expect(construction, `${affinity} later anatomy branch`).toMatch(later);
				const counterplay = packet.affinityThemes[affinity].counterplaySignal;
				if (fileName === '15-nagas.json') {
					expect(counterplay, `${affinity} hood-independent counterplay`).not.toMatch(
						/hood|multiple arms/iu
					);
				}
				if (fileName === '17-insectoids.json') {
					expect(counterplay, `${affinity} wing-independent counterplay`).not.toMatch(
						/wing root|wing case|functional wing/iu
					);
				}
				if (fileName === '18-arachnids.json') {
					expect(counterplay, `${affinity} torso-independent counterplay`).not.toMatch(
						/humanoid|torso|hand/iu
					);
				}
			}
		}
	);

	it('keeps Harpy elemental attachments tier-appropriate before gold ankle status markers', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/13-harpies.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);

		for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
			const construction = packet.affinityThemes[affinity].constructionDimensions.join(' ');
			const [earlyConstruction, matureConstruction] = construction.split(/T4[–-]T5/u);
			expect(earlyConstruction, `${affinity} T1–T3 construction`).toMatch(/T1[–-]T3/iu);
			expect(earlyConstruction, `${affinity} source-supported attachment`).toMatch(
				/bead|strap|talon|wing root/iu
			);
			expect(earlyConstruction, `${affinity} premature status marker`).not.toMatch(
				/gold ankle ring|gold cuff/iu
			);
			expect(matureConstruction, `${affinity} T4–T5 status attachment`).toMatch(
				/gold[^.]*ankle ring|gold[^.]*cuff/iu
			);

			const [earlyCounterplay, matureCounterplay] =
				packet.affinityThemes[affinity].counterplaySignal.split(/T4[–-]T5/u);
			expect(earlyCounterplay, `${affinity} T1–T3 counterplay`).toMatch(/T1[–-]T3/iu);
			expect(earlyCounterplay, `${affinity} premature counterplay marker`).not.toMatch(
				/gold ankle ring|gold cuff/iu
			);
			expect(matureCounterplay, `${affinity} T4–T5 counterplay`).toBeTruthy();
		}
	});

	it('keeps every Minotaur elemental T1 branch on uncapped initiate equipment', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/14-minotaurs.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);

		for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
			const construction = packet.affinityThemes[affinity].constructionDimensions.join(' ');
			const [t1Construction, matureConstruction] = construction.split(/T2[–-]T5/u);
			expect(t1Construction, `${affinity} T1 anatomy`).toMatch(/T1 Bull-kin/iu);
			expect(t1Construction, `${affinity} T1 source identity`).toMatch(
				/short uncapped horns[^.]*rope harness[^.]*wooden maul[^.]*unarmored/iu
			);
			expect(t1Construction, `${affinity} premature mature equipment`).not.toMatch(
				/\bbronze\b|\bcap(?:ped)?\b|\bchain\b|\bplate\b|\bcistern\b|\barmor\b/iu
			);
			expect(matureConstruction, `${affinity} T2–T5 construction`).toBeTruthy();

			const [t1Counterplay, matureCounterplay] =
				packet.affinityThemes[affinity].counterplaySignal.split(/T2[–-]T5/u);
			expect(t1Counterplay, `${affinity} T1 counterplay`).toMatch(/T1 Bull-kin/iu);
			expect(t1Counterplay, `${affinity} T1 readable anchor`).toMatch(
				/rope|wood|hoof|short horn|tail|planted/iu
			);
			expect(t1Counterplay, `${affinity} premature mature counterplay`).not.toMatch(
				/\bbronze\b|\bcap(?:ped)?\b|\bchain\b|\bplate\b|\bcistern\b|\barmor\b/iu
			);
			expect(matureCounterplay, `${affinity} T2–T5 counterplay`).toBeTruthy();
		}
	});

	it('keeps crestless Lizardfolk T1 Fire, Earth, and Wind construction on source anatomy', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/16-lizardfolk.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);

		for (const affinity of ['fire', 'earth', 'wind'] as const) {
			const construction = packet.affinityThemes[affinity].constructionDimensions.join(' ');
			const [t1Construction, laterConstruction] = construction.split(/T2 Warrior/u);
			expect(t1Construction, `${affinity} T1 anatomy`).toMatch(/T1 Scout/iu);
			expect(t1Construction, `${affinity} T1 source-supported structure`).toMatch(
				/bone spear|hide wrap|tail|scale row|planted foot/iu
			);
			expect(t1Construction, `${affinity} premature crest`).not.toMatch(/crest|dorsal/iu);
			expect(laterConstruction, `${affinity} T2 low crest`).toMatch(/low crest/iu);
			expect(laterConstruction, `${affinity} T3–T5 dorsal structure`).toMatch(
				/T3[–-]T5[^.]*dorsal/iu
			);

			const [t1Counterplay, laterCounterplay] =
				packet.affinityThemes[affinity].counterplaySignal.split(/T2 Warrior/u);
			expect(t1Counterplay, `${affinity} T1 counterplay`).toMatch(/T1 Scout/iu);
			expect(t1Counterplay, `${affinity} premature counterplay anatomy`).not.toMatch(
				/crest|dorsal/iu
			);
			expect(laterCounterplay, `${affinity} later counterplay`).toBeTruthy();
		}
	});

	it('gives the Insectoid Water Queen abdomen-and-comb counterplay instead of active limbs', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/17-insectoids.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);
		const [mobileCounterplay, queenCounterplay] =
			packet.affinityThemes.water.counterplaySignal.split(/T5 Queen/u);

		expect(mobileCounterplay).toMatch(/T1[–-]T4[^.]*active limb/iu);
		expect(queenCounterplay).toMatch(/abdomen valve|comb cistern/iu);
		expect(queenCounterplay).not.toMatch(/active limb/iu);
	});
});

describe('Wave D family packets', () => {
	it.each(waveDFamilyFixtures)(
		'loads $fileName with exact source identity and authored tier contracts',
		async ({ fileName, familyId, displayName, sourceRaceNumber, forms }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);

			expect(packet.familyId).toBe(familyId);
			expect(packet.displayName).toBe(displayName);
			expect(packet.sourceRaceNumber).toBe(sourceRaceNumber);
			expect(packet.sourcePage).toBe('docs/wiki/creatures/monster-races/generator-bestiary-04.md');
			expect(packet.floorSlot).toBeNull();
			expect(
				packet.forms.map(({ tier, displayName: formDisplayName, sourceReferences }) => ({
					tier,
					displayName: formDisplayName,
					sourceReferences
				}))
			).toEqual(forms);
			expect(new Set(packet.forms.map((form) => form.formId)).size).toBe(5);
			expect(new Set(packet.forms.map((form) => form.battlefieldDuty)).size).toBe(5);
			expect(packet.forms[2]!.primaryArchetype).toMatch(/Specialist/iu);
			expect(packet.forms[2]!.signatureMechanic).toBeTruthy();
			expect(packet.forms[2]!.telegraph).toBeTruthy();
			expect(packet.forms[2]!.counterplay).toBeTruthy();
			expect(packet.forms[4]!.primaryArchetype).toMatch(/Sovereign/iu);
			expect(packet.forms[4]!.signatureMechanic).toMatch(/arena|phase|command|produc|transform/iu);
			expect(packet.forms[4]!.lowerFormInteraction).toBeTruthy();
		}
	);

	it('keeps Wave D family and form IDs unique across the batch', async () => {
		const packets = await Promise.all(
			waveDFamilyFixtures.map(async ({ fileName }) =>
				FamilyPacketSchema.parse(
					JSON.parse(
						await readFile(
							new URL(
								`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
								import.meta.url
							),
							'utf8'
						)
					)
				)
			)
		);
		const familyIds = packets.map((packet) => packet.familyId);
		const formIds = packets.flatMap((packet) => packet.forms.map((form) => form.formId));
		expect(new Set(familyIds).size).toBe(6);
		expect(new Set(formIds).size).toBe(30);
	});

	it.each([
		{
			fileName: '19-slimes.json',
			motifs: [/translucent colors/iu, /core glow/iu]
		},
		{
			fileName: '20-golems.json',
			motifs: [
				/rune glow/iu,
				/seam glow/iu,
				/stone/iu,
				/clay/iu,
				/material quality/iu,
				/molten core/iu
			]
		},
		{
			fileName: '21-flame-elementals.json',
			motifs: [
				/living fire/iu,
				/heat/iu,
				/smoke/iu,
				/obsidian/iu,
				/molten rock/iu,
				/base scorching/iu
			]
		},
		{
			fileName: '22-treants.json',
			motifs: [
				/tree/iu,
				/wood/iu,
				/roots/iu,
				/moss/iu,
				/amber heartwood/iu,
				/waterfall/iu,
				/stone in (?:the )?roots/iu
			]
		},
		{
			fileName: '23-fungalfolk.json',
			motifs: [/bioluminescent glow/iu, /spores/iu, /mycelium/iu, /damp habitat/iu]
		},
		{
			fileName: '24-deep-ones.json',
			motifs: [/ocean/iu, /wetness/iu, /coral/iu, /lures/iu, /bioluminescence/iu]
		}
	])(
		'binds every $fileName source-native risk motif independently in Normal',
		async ({ fileName, motifs }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);
			const normalEntries = [
				...packet.affinityThemes.normal.constructionDimensions,
				packet.affinityThemes.normal.counterplaySignal,
				...packet.affinityThemes.normal.forbidden
			];
			for (const motif of motifs) {
				const boundEntry = normalEntries.find(
					(entry) => /family-native|non-affinity/iu.test(entry) && motif.test(entry)
				);
				expect(boundEntry, `direct Normal binding for ${motif.source}`).toBeDefined();
			}
			expect(normalEntries.join(' ')).toMatch(/unexplained elemental anatomy/iu);
			expect(normalEntries.join(' ')).toMatch(/unexplained elemental glow/iu);
			expect(normalEntries.join(' ')).toMatch(/unexplained environmental wake/iu);
			for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
				expect(packet.affinityThemes[affinity].constructionDimensions).toHaveLength(2);
				expect(packet.affinityThemes[affinity].forbidden.join(' ')).toMatch(/palette-only/iu);
				expect(packet.affinityThemes[affinity].forbidden.join(' ')).toMatch(/glow-only/iu);
			}
		}
	);

	it.each([
		{
			fileName: '19-slimes.json',
			checks: [
				/T1[–-]T2[^.]*no humanoid structure/iu,
				/T3[–-]T4[^.]*humanoid/iu,
				/T5[^.]*dozen cores/iu
			]
		},
		{
			fileName: '20-golems.json',
			checks: [
				/T1[–-]T3[^.]*no floating plates[^.]*no molten core[^.]*no gemstone[^.]*no halo/iu,
				/T4[^.]*floating plates[^.]*molten core/iu,
				/T5[^.]*gemstone heart[^.]*rune-halo/iu
			]
		},
		{
			fileName: '21-flame-elementals.json',
			checks: [
				/T1[–-]T3[^.]*no obsidian shell[^.]*no molten rock[^.]*no star[^.]*no corona[^.]*no crown/iu,
				/T4[^.]*obsidian shell[^.]*molten rock/iu,
				/T5[^.]*star[^.]*corona[^.]*crown/iu
			]
		},
		{
			fileName: '22-treants.json',
			checks: [
				/T1[–-]T3[^.]*no heartwood cavity[^.]*no waterfall[^.]*no boulders[^.]*no groves/iu,
				/T4[^.]*heartwood cavity/iu,
				/T5[^.]*waterfall[^.]*boulders[^.]*groves/iu
			]
		},
		{
			fileName: '23-fungalfolk.json',
			checks: [
				/T1[^.]*no glow[^.]*no constant spore cloud[^.]*no smaller mushrooms[^.]*no throne[^.]*no ground network/iu,
				/T2[^.]*faint gill glow/iu,
				/T3[^.]*constant spore cloud/iu,
				/T4[^.]*smaller mushrooms/iu,
				/T5[^.]*throne[^.]*ground network/iu
			]
		},
		{
			fileName: '24-deep-ones.json',
			checks: [
				/T1[–-]T2[^.]*no lure[^.]*no tentacles[^.]*no translucent organs[^.]*no kraken limbs[^.]*no crown/iu,
				/T3[^.]*lure/iu,
				/T4[^.]*tentacles[^.]*translucent organs/iu,
				/T5[^.]*kraken limbs[^.]*crown/iu
			]
		}
	])(
		'keeps $fileName elemental construction and counterplay tier-safe',
		async ({ fileName, checks }) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							`../assets/enemies/experiments/family-affinity-v1/families/${fileName}`,
							import.meta.url
						),
						'utf8'
					)
				)
			);
			for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
				const construction = packet.affinityThemes[affinity].constructionDimensions.join(' ');
				const counterplay = packet.affinityThemes[affinity].counterplaySignal;
				for (const check of checks) {
					expect(construction, `${affinity} construction ${check.source}`).toMatch(check);
					expect(counterplay, `${affinity} counterplay ${check.source}`).toMatch(check);
				}
			}
		}
	);
});

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

		for (const affinity of ['fire', 'earth', 'wind', 'water'] as const) {
			expect(packet.affinityThemes[affinity].forbidden, `${affinity} glow shortcut`).toEqual(
				expect.arrayContaining([expect.stringMatching(/glow-only/iu)])
			);
		}
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

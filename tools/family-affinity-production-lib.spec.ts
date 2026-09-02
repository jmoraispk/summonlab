import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	auditCurrentClassMapping,
	allocateFamilyAffinityRevision,
	buildFamilyAffinityProductionBundle,
	bridgeAttemptPaths,
	FamilyAffinityAssignmentSchema,
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	familyAffinitySha256,
	stableFamilyAffinityJson,
	validateFamilyAffinityProductionBundle,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityReviewPromotion,
	CurrentClassMappingFileSchema,
	FamilyPacketSchema
} from './family-affinity-production-lib.js';
import type {
	CurrentClassMappingEntry,
	FamilyAffinityTarget
} from './family-affinity-production-lib.js';
import { exportFamilyAffinityProduction } from './export-family-affinity-production.js';

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
		familyId: 'orcs',
		displayName: 'Orcs',
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
		familyId: 'giants',
		displayName: 'Giants',
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
		familyId: 'trolls',
		displayName: 'Trolls',
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
		familyId: 'dragons',
		displayName: 'Dragons',
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
		familyId: 'skeletons',
		displayName: 'Skeletons',
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
		familyId: 'rotwalkers',
		displayName: 'Rotwalkers',
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
		familyId: 'wraiths',
		displayName: 'Wraiths',
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
		familyId: 'vampires',
		displayName: 'Vampires',
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
		familyId: 'mummies',
		displayName: 'Mummies',
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
		familyId: 'demons',
		displayName: 'Demons',
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
		familyId: 'celestials',
		displayName: 'Celestials',
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

const waveEFamilyFixtures = [
	{
		fileName: '25-werebeasts.json',
		familyId: 'werebeasts',
		displayName: 'Werebeasts',
		sourceRaceNumber: 25,
		forms: [
			{ tier: 'T1', displayName: 'Afflicted', sourceReferences: ['Afflicted'] },
			{ tier: 'T2', displayName: 'Half-turned', sourceReferences: ['Half-turned'] },
			{ tier: 'T3', displayName: 'Werebeast', sourceReferences: ['Werebeast'] },
			{ tier: 'T4', displayName: 'Alpha', sourceReferences: ['Alpha'] },
			{
				tier: 'T5',
				displayName: 'Primal Beast-King',
				sourceReferences: ['Primal Beast-King']
			}
		]
	},
	{
		fileName: '26-gargoyles.json',
		familyId: 'gargoyles',
		displayName: 'Gargoyles',
		sourceRaceNumber: 26,
		forms: [
			{ tier: 'T1', displayName: 'Grotesque', sourceReferences: ['Grotesque'] },
			{ tier: 'T2', displayName: 'Sentinel', sourceReferences: ['Sentinel'] },
			{ tier: 'T3', displayName: 'Guardian', sourceReferences: ['Guardian'] },
			{
				tier: 'T4',
				displayName: 'Cathedral Warden',
				sourceReferences: ['Cathedral Warden']
			},
			{
				tier: 'T5',
				displayName: 'Stone Sovereign',
				sourceReferences: ['Stone Sovereign']
			}
		]
	},
	{
		fileName: '27-djinn.json',
		familyId: 'djinn',
		displayName: 'Djinn',
		sourceRaceNumber: 27,
		forms: [
			{ tier: 'T1', displayName: 'Wisp-spirit', sourceReferences: ['Wisp-spirit'] },
			{ tier: 'T2', displayName: 'Lesser Djinn', sourceReferences: ['Lesser Djinn'] },
			{ tier: 'T3', displayName: 'Djinn', sourceReferences: ['Djinn'] },
			{ tier: 'T4', displayName: 'Great Djinn', sourceReferences: ['Great Djinn'] },
			{ tier: 'T5', displayName: 'Wish-Sultan', sourceReferences: ['Wish-Sultan'] }
		]
	},
	{
		fileName: '28-fae.json',
		familyId: 'fae',
		displayName: 'Fae',
		sourceRaceNumber: 28,
		forms: [
			{ tier: 'T1', displayName: 'Pixie', sourceReferences: ['Pixie'] },
			{ tier: 'T2', displayName: 'Sprite', sourceReferences: ['Sprite'] },
			{ tier: 'T3', displayName: 'Fae Knight', sourceReferences: ['Fae Knight'] },
			{ tier: 'T4', displayName: 'Fae Noble', sourceReferences: ['Fae Noble'] },
			{ tier: 'T5', displayName: 'Fae Monarch', sourceReferences: ['Fae Monarch'] }
		]
	},
	{
		fileName: '29-void-horrors.json',
		familyId: 'void-horrors',
		displayName: 'Void Horrors',
		sourceRaceNumber: 29,
		forms: [
			{ tier: 'T1', displayName: 'Crawler', sourceReferences: ['Crawler'] },
			{ tier: 'T2', displayName: 'Hollow', sourceReferences: ['Hollow'] },
			{ tier: 'T3', displayName: 'Fracture', sourceReferences: ['Fracture'] },
			{ tier: 'T4', displayName: 'Encroacher', sourceReferences: ['Encroacher'] },
			{
				tier: 'T5',
				displayName: 'Outer Sovereign',
				sourceReferences: ['Outer Sovereign']
			}
		]
	},
	{
		fileName: '30-doppelgangers.json',
		familyId: 'doppelgangers',
		displayName: 'Doppelgangers',
		sourceRaceNumber: 30,
		forms: [
			{ tier: 'T1', displayName: 'Blank', sourceReferences: ['Blank'] },
			{
				tier: 'T2',
				displayName: 'Halfling Copy',
				sourceReferences: ['Halfling Copy']
			},
			{ tier: 'T3', displayName: 'Mimic', sourceReferences: ['Mimic'] },
			{ tier: 'T4', displayName: 'Facewearer', sourceReferences: ['Facewearer'] },
			{
				tier: 'T5',
				displayName: 'Faceless Sovereign',
				sourceReferences: ['Faceless Sovereign']
			}
		]
	}
] as const;

type FireTheme = ReturnType<typeof FamilyPacketSchema.parse>['affinityThemes']['fire'];
type FamilyPacket = ReturnType<typeof FamilyPacketSchema.parse>;
type ElementalAffinity = keyof Omit<FamilyPacket['affinityThemes'], 'normal'>;

const elementalAffinities = ['fire', 'earth', 'wind', 'water'] as const;
const exactTiers = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;

function extractTierClauses(text: string): Map<string, string> {
	const clauses = new Map<string, string>();
	for (const match of text.matchAll(/\b(T[1-5])\b([^;]*)(?:;|$)/gu)) {
		clauses.set(match[1]!, match[2]!.trim());
	}
	return clauses;
}

const affinityMechanism: Record<ElementalAffinity, RegExp> = {
	fire: /vent|heat sink|cooling|combustion|fuel|ignition|ember|exhaust/iu,
	earth: /fault|fracture|load|joint|key|clamp|anchor|brace/iu,
	wind: /still|vane|pressure|channel|anchor|gauge|vector/iu,
	water: /pressure|valve|drain|conduit|fill|binding core/iu
};

type WaveETierContract = {
	requiredByTier: Record<(typeof exactTiers)[number], RegExp>;
	forbiddenAtT1: RegExp;
};

function assertTierCompleteElementalTheme(
	theme: FamilyPacket['affinityThemes'][ElementalAffinity],
	affinity: ElementalAffinity,
	contract: WaveETierContract
): void {
	if (theme.constructionDimensions.length < 2) {
		throw new Error('Affinity construction requires at least two altered dimensions');
	}
	if (new Set(theme.constructionDimensions.map((entry) => entry.trim())).size < 2) {
		throw new Error('Affinity construction dimensions must be semantically distinct');
	}
	if (!theme.constructionDimensions.some((entry) => /material|structure|surface/iu.test(entry))) {
		throw new Error('Affinity construction requires a material, structure, or surface dimension');
	}
	if (!theme.constructionDimensions.some((entry) => /motion|process|flow|cycle/iu.test(entry))) {
		throw new Error('Affinity construction requires a motion, process, flow, or cycle dimension');
	}

	const constructionByDimension = theme.constructionDimensions.map(extractTierClauses);
	const counterplayByTier = extractTierClauses(theme.counterplaySignal);
	for (const tier of exactTiers) {
		for (const [dimensionIndex, clauses] of constructionByDimension.entries()) {
			const clause = clauses.get(tier);
			if (!clause) {
				throw new Error(`${affinity} construction dimension ${dimensionIndex + 1} lacks ${tier}`);
			}
			if (!contract.requiredByTier[tier].test(clause)) {
				throw new Error(
					`${affinity} construction dimension ${dimensionIndex + 1} loses ${tier} identity`
				);
			}
			if (tier === 'T1' && contract.forbiddenAtT1.test(clause)) {
				throw new Error(`${affinity} construction leaks later anatomy into T1`);
			}
		}

		const counterplayClause = counterplayByTier.get(tier);
		if (!counterplayClause) {
			throw new Error(`${affinity} counterplay lacks ${tier}`);
		}
		if (!contract.requiredByTier[tier].test(counterplayClause)) {
			throw new Error(`${affinity} counterplay loses ${tier} identity`);
		}
		if (!affinityMechanism[affinity].test(counterplayClause)) {
			throw new Error(`${affinity} counterplay launders the ${tier} affinity apparatus`);
		}
		if (tier === 'T1' && contract.forbiddenAtT1.test(counterplayClause)) {
			throw new Error(`${affinity} counterplay leaks later anatomy into T1`);
		}
	}
}

function assertEngineeredFlameElementalFireTheme(theme: FireTheme): void {
	const engineeredProcess = theme.constructionDimensions.find((dimension) =>
		/(?:engineered|external|additional)[^.]*combustion[^.]*intake[^.]*ignition[^.]*(?:exhaust|cooling)/iu.test(
			dimension
		)
	);
	if (!engineeredProcess) {
		throw new Error(
			'Engineered Fire route must tie an added combustion process to intake, ignition, and exhaust or cooling'
		);
	}

	const addedApparatus =
		/(?:intake collar|ignition ring|exhaust marker|cooling shutter|fuel collar|intake vane)/iu;
	const readableDisruption = /(?:open|expos|dim|break|sever|disrupt|attack|strike)/iu;
	if (
		!addedApparatus.test(theme.counterplaySignal) ||
		!readableDisruption.test(theme.counterplaySignal)
	) {
		throw new Error('Engineered Fire route requires counterplay against its added apparatus');
	}

	if (
		!theme.forbidden.some((rejection) =>
			/(?:temperature alone[^.]*Fire affinity|Fire affinity[^.]*temperature alone)/iu.test(
				rejection
			)
		)
	) {
		throw new Error('Engineered Fire route must reject temperature alone as affinity evidence');
	}
}

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
				expect(
					packet.affinityThemes[affinity].constructionDimensions.length
				).toBeGreaterThanOrEqual(2);
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

	it('requires Flame Elemental Fire affinity to add a disruptible combustion process beyond native flame', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/21-flame-elementals.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);

		expect(() => assertEngineeredFlameElementalFireTheme(packet.affinityThemes.fire)).not.toThrow();

		const deficientNativeHeatTheme: FireTheme = {
			constructionDimensions: [
				'Native living fire becomes hotter and brighter.',
				'Temperature rises from orange to blue-white while the same flame emits more smoke.'
			],
			counterplaySignal: 'Wait for the native flame temperature to fall, then approach.',
			forbidden: ['Palette-only recolor', 'Glow-only treatment']
		};
		expect(() => assertEngineeredFlameElementalFireTheme(deficientNativeHeatTheme)).toThrow(
			/engineered Fire route/iu
		);
	});
});

describe('Wave E family packets', () => {
	it.each(waveEFamilyFixtures)(
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
			expect(packet.sourcePage).toBe('docs/wiki/creatures/monster-races/generator-bestiary-05.md');
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

	it.each([
		{
			fileName: '25-werebeasts.json',
			motifs: [
				/\bfur\b/iu,
				/eye glow/iu,
				/moon glow/iu,
				/torn cloth/iu,
				/broken chain/iu,
				/iron collar/iu,
				/transformation curse/iu
			]
		},
		{
			fileName: '26-gargoyles.json',
			motifs: [
				/carved stone/iu,
				/moss/iu,
				/water staining/iu,
				/amber rune glow/iu,
				/amber seam glow/iu,
				/bronze/iu,
				/water-spout architecture/iu
			]
		},
		{
			fileName: '27-djinn.json',
			motifs: [
				/air identity/iu,
				/fire identity/iu,
				/spirit identity/iu,
				/smoke/iu,
				/vapor/iu,
				/warm inner glow/iu,
				/gold/iu,
				/brass/iu,
				/hovering/iu,
				/vortex/iu
			]
		},
		{
			fileName: '28-fae.json',
			motifs: [
				/wild-wood/iu,
				/\bleaf\b/iu,
				/\bbark\b/iu,
				/\bbranches\b/iu,
				/glowing pollen/iu,
				/glowing motes/iu,
				/\bdew\b/iu,
				/stained glass/iu,
				/reality bending/iu
			]
		},
		{
			fileName: '29-void-horrors.json',
			motifs: [
				/negative space/iu,
				/void black/iu,
				/star flecks/iu,
				/cold eye accent/iu,
				/fractured geometry/iu,
				/non-reflection/iu
			]
		},
		{
			fileName: '30-doppelgangers.json',
			motifs: [
				/clay-grey skin/iu,
				/copied colors/iu,
				/borrowed colors/iu,
				/shapeshifting/iu,
				/(?:masks|faces)/iu,
				/smooth flesh/iu
			]
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
				expect(
					packet.affinityThemes[affinity].constructionDimensions.length
				).toBeGreaterThanOrEqual(2);
				expect(packet.affinityThemes[affinity].forbidden.join(' ')).toMatch(/palette-only/iu);
				expect(packet.affinityThemes[affinity].forbidden.join(' ')).toMatch(/glow-only/iu);
			}
		}
	);

	it.each([
		{
			fileName: '25-werebeasts.json',
			contract: {
				requiredByTier: {
					T1: /patchy fur|long fingers|torn seam/iu,
					T2: /muzzle|hybrid/iu,
					T3: /digitigrade|claw/iu,
					T4: /chain|collar/iu,
					T5: /crown|rune/iu
				},
				forbiddenAtT1: /\bclaws?\b|muzzle|digitigrade|chain|collar|crown|runes?|antlers?|horns?/iu
			}
		},
		{
			fileName: '26-gargoyles.json',
			contract: {
				requiredByTier: {
					T1: /chipped sandstone|tiny wings|perch|water-spout/iu,
					T2: /granite|moss|small wings/iu,
					T3: /broad wings|amber seam|relief/iu,
					T4: /marble|bronze|tracery/iu,
					T5: /buttress|throne|attendant/iu
				},
				forbiddenAtT1:
					/relief|vanes?|granite|moss|broad|functional|amber|marble|bronze|tracery|buttress|throne|attendant/iu
			}
		},
		{
			fileName: '27-djinn.json',
			contract: {
				requiredByTier: {
					T1: /vapor|half-face|plume/iu,
					T2: /torso|cuff/iu,
					T3: /wind arms|ring/iu,
					T4: /crown|script/iu,
					T5: /vortex|throne|lamp/iu
				},
				forbiddenAtT1:
					/\b(?:jewelry|cuffs?|rings?|bracelets?|crown|lamps?|throne|vortex)\b|defined torso|wind arms/iu
			}
		},
		{
			fileName: '28-fae.json',
			contract: {
				requiredByTier: {
					T1: /palm|insect wings|thorn/iu,
					T2: /petal/iu,
					T3: /stained glass|antler/iu,
					T4: /gown|mask|court/iu,
					T5: /geometry|season crown|reality/iu
				},
				forbiddenAtT1: /layered petal|stained glass|antler|gown|mask|crown|court|geometry|reality/iu
			}
		},
		{
			fileName: '29-void-horrors.json',
			contract: {
				requiredByTier: {
					T1: /thin limb|missing edge|no reflection|faceless/iu,
					T2: /face-hole/iu,
					T3: /eye|star/iu,
					T4: /partial|negative limb/iu,
					T5: /eye-ring|unresolved/iu
				},
				forbiddenAtT1: /face-hole|\beyes?\b|star|vast|negative limb|eye-ring|sovereign/iu
			}
		},
		{
			fileName: '30-doppelgangers.json',
			contract: {
				requiredByTier: {
					T1: /blank|smooth flesh|featureless|limb/iu,
					T2: /partial copy|unfinished arm/iu,
					T3: /jaw seam|wrong hand/iu,
					T4: /layered face|mask/iu,
					T5: /body-wide face|mask crown/iu
				},
				forbiddenAtT1: /copied|borrowed|cloth|hems?|garment|masks?|\bfaces?\b/iu
			}
		}
	] as const)(
		'keeps every $fileName elemental dimension and counterplay branch tier-complete',
		async ({ fileName, contract }) => {
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
			for (const affinity of elementalAffinities) {
				expect(() =>
					assertTierCompleteElementalTheme(packet.affinityThemes[affinity], affinity, contract)
				).not.toThrow();
			}
		}
	);

	it('rejects laundered T1 affinity counterplay, later-feature leakage, and duplicate dimensions', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/25-werebeasts.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);
		const contract: WaveETierContract = {
			requiredByTier: {
				T1: /patchy fur|long fingers|torn seam/iu,
				T2: /muzzle|hybrid/iu,
				T3: /digitigrade|claw/iu,
				T4: /chain|collar/iu,
				T5: /crown|rune/iu
			},
			forbiddenAtT1: /\bclaws?\b|muzzle|digitigrade|chain|collar|crown|runes?|antlers?|horns?/iu
		};

		const laundered = structuredClone(packet.affinityThemes.fire);
		laundered.counterplaySignal = laundered.counterplaySignal.replace(
			/\bT1\b[^;]*/u,
			'T1 patchy fur leaves the native wrist exposed'
		);
		expect(() => assertTierCompleteElementalTheme(laundered, 'fire', contract)).toThrow(
			/launders the T1 affinity apparatus/iu
		);

		const leaking = structuredClone(packet.affinityThemes.fire);
		leaking.constructionDimensions[0] = leaking.constructionDimensions[0]!.replace(
			/\bT1\b/,
			'T1 mature claws and '
		);
		expect(() => assertTierCompleteElementalTheme(leaking, 'fire', contract)).toThrow(
			/leaks later anatomy into T1/iu
		);

		const duplicated = structuredClone(packet.affinityThemes.fire);
		duplicated.constructionDimensions[1] = duplicated.constructionDimensions[0]!;
		expect(() => assertTierCompleteElementalTheme(duplicated, 'fire', contract)).toThrow(
			/semantically distinct/iu
		);
	});

	it.each(['fire', 'wind'] as const)(
		'gives Djinn $affinity an engineered process distinct from native air, fire, and smoke',
		async (affinity) => {
			const packet = FamilyPacketSchema.parse(
				JSON.parse(
					await readFile(
						new URL(
							'../assets/enemies/experiments/family-affinity-v1/families/27-djinn.json',
							import.meta.url
						),
						'utf8'
					)
				)
			);
			const theme = packet.affinityThemes[affinity];
			expect(theme.constructionDimensions.join(' ')).toMatch(
				/(?:engineered|additional)[^.]*process[^.]*(?:apparatus|channel|valve|vane|collar|ring)/iu
			);
			expect(theme.counterplaySignal).toMatch(
				/(?:break|sever|disrupt|open|expose)[^.]*\b(?:apparatus|channel|valve|vane|collar|ring)\b/iu
			);
		}
	);
});

describe('complete family packet roster audit', () => {
	it('discovers and reconciles exactly thirty numbered packets and 150 source forms', async () => {
		const directoryUrl = new URL(
			'../assets/enemies/experiments/family-affinity-v1/families/',
			import.meta.url
		);
		const numberedFiles = (await readdir(directoryUrl))
			.filter((fileName) => /^\d{2}-[a-z0-9-]+\.json$/u.test(fileName))
			.sort();
		const goblinFixture = {
			fileName: '01-goblins.json',
			familyId: 'goblins',
			displayName: 'Goblins',
			sourceRaceNumber: 1,
			forms: [
				{ tier: 'T1', displayName: 'Runt', sourceReferences: ['Runt'] },
				{ tier: 'T2', displayName: 'Cutter', sourceReferences: ['Cutter'] },
				{ tier: 'T3', displayName: 'Raider', sourceReferences: ['Raider'] },
				{ tier: 'T4', displayName: 'Warboss', sourceReferences: ['Warboss'] },
				{ tier: 'T5', displayName: 'Goblin King', sourceReferences: ['Goblin King'] }
			]
		} as const;
		const sourceFixtures = [
			goblinFixture,
			...waveAFamilyFixtures,
			...waveBFamilyFixtures,
			...waveCFamilyFixtures,
			...waveDFamilyFixtures,
			...waveEFamilyFixtures
		];

		expect(numberedFiles).toEqual(sourceFixtures.map(({ fileName }) => fileName));
		const packets = await Promise.all(
			numberedFiles.map(async (fileName) =>
				FamilyPacketSchema.parse(
					JSON.parse(await readFile(new URL(fileName, directoryUrl), 'utf8'))
				)
			)
		);
		const familyIds = packets.map(({ familyId }) => familyId);
		const formIds = packets.flatMap(({ forms }) => forms.map(({ formId }) => formId));
		const sourceRaceNumbers = packets.map(({ sourceRaceNumber }) => sourceRaceNumber);

		expect(sourceRaceNumbers).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
		expect(new Set(familyIds).size).toBe(30);
		expect(new Set(formIds).size).toBe(150);
		for (const [index, packet] of packets.entries()) {
			const fixture = sourceFixtures[index]!;
			const expectedVolume = Math.ceil(packet.sourceRaceNumber / 6)
				.toString()
				.padStart(2, '0');
			expect(packet.familyId).toBe(fixture.familyId);
			expect(packet.displayName).toBe(fixture.displayName);
			expect(packet.sourcePage).toBe(
				`docs/wiki/creatures/monster-races/generator-bestiary-${expectedVolume}.md`
			);
			expect(packet.floorSlot).toBeNull();
			expect(Object.keys(packet.affinityThemes).sort()).toEqual([
				'earth',
				'fire',
				'normal',
				'water',
				'wind'
			]);
			expect(
				packet.forms.map(({ tier, displayName, sourceReferences }) => ({
					tier,
					displayName,
					sourceReferences
				}))
			).toEqual(fixture.forms);
		}

		const audit = `families=${packets.length} forms=${formIds.length} tiersPerFamily=5 sourceFormsReconciled=${packets.flatMap(({ forms }) => forms).length}`;
		expect(audit).toBe('families=30 forms=150 tiersPerFamily=5 sourceFormsReconciled=150');
	});
});

describe('final Task 3 roster cleanup', () => {
	it('defines the Lich King grave seals as independent source-supported paths', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/06-skeletons.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);
		const sovereign = packet.forms[4]!;
		expect(`${sovereign.signatureMechanic} ${sovereign.lowerFormInteraction}`).toMatch(
			/independent[^.]*Rattle[^.]*Mail[^.]*Helm[^.]*Crown/iu
		);
		expect(`${sovereign.signatureMechanic} ${sovereign.lowerFormInteraction}`).toMatch(
			/without requiring[^.]*previous[^.]*promotion/iu
		);
	});

	it('preserves the God-King permanent sandstorm halo as non-affinity burial sand', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/10-mummies.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);
		expect(packet.forms[4]!.visualDelta).toMatch(/permanent sandstorm halo/iu);
		expect(packet.forms[4]!.visualDelta).toMatch(
			/(?:family-native|non-affinity)[^.]*burial sand[^.]*(?:not|rather than)[^.]*Earth[^.]*Wind/iu
		);
	});

	it('keeps Elder Warden mushrooms non-luminous under reflected heartwood light', async () => {
		const packet = FamilyPacketSchema.parse(
			JSON.parse(
				await readFile(
					new URL(
						'../assets/enemies/experiments/family-affinity-v1/families/22-treants.json',
						import.meta.url
					),
					'utf8'
				)
			)
		);
		const champion = packet.forms[3]!;
		expect(`${champion.signatureMechanic} ${champion.telegraph}`).toMatch(
			/mushrooms[^.]*(?:catch|reflect)[^.]*amber heartwood light/iu
		);
		expect(`${champion.signatureMechanic} ${champion.telegraph}`).toMatch(
			/(?:non-luminous|do not emit light)/iu
		);
	});
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

type VisualIndexFixture = {
	monsters: Array<{
		id: string;
		familyName: string;
		variants: Array<{
			affinity: string;
			candidatePath?: string | null;
			contentHash?: string | null;
		}>;
	}>;
};

async function loadCurrentClassAuditFixtures() {
	const mapping = CurrentClassMappingFileSchema.parse(
		JSON.parse(
			await readFile(
				new URL(
					'../assets/enemies/experiments/family-affinity-v1/current-class-mapping.json',
					import.meta.url
				),
				'utf8'
			)
		)
	);
	const visualIndex = JSON.parse(
		await readFile(
			new URL('../docs/wiki/creatures/monsters/visual-index.json', import.meta.url),
			'utf8'
		)
	) as VisualIndexFixture;
	const familyDirectory = new URL(
		'../assets/enemies/experiments/family-affinity-v1/families/',
		import.meta.url
	);
	const familyFileNames = (await readdir(familyDirectory))
		.filter((fileName) => /^\d{2}-[a-z0-9-]+\.json$/u.test(fileName))
		.sort();
	const familyPackets = await Promise.all(
		familyFileNames.map(async (fileName) =>
			FamilyPacketSchema.parse(
				JSON.parse(await readFile(new URL(fileName, familyDirectory), 'utf8'))
			)
		)
	);

	return { mapping, visualIndex, familyPackets };
}

describe('current class reconciliation', () => {
	it('reconciles the exact forty visual-index classes in source order', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const audit = auditCurrentClassMapping(mapping, visualIndex.monsters, familyPackets);

		expect(mapping.entries.map(({ currentClassId }) => currentClassId)).toEqual(
			visualIndex.monsters.map(({ id }) => id)
		);
		expect(audit).toEqual({
			dispositionCounts: {
				map: 1,
				'rename-map': 9,
				'secondary-archetype': 25,
				fauna: 5,
				retire: 0
			},
			retainedBridgeCount: 40,
			bridgeOnlyCount: 30,
			canonicalPrimaryCount: 10,
			uniqueCanonicalClaims: 10,
			candidateReuseCounts: { normal: 0, fire: 0, earth: 0, wind: 0, water: 0 },
			retainedBridgeCurrentClassIds: visualIndex.monsters.map(({ id }) => id),
			bridgeOnlyCurrentClassIds: [
				'armored-brood-guard',
				'web-caster',
				'hex-adept',
				'tower-archmage',
				'tower-summoner',
				'ward-mage',
				'cave-bear',
				'dire-wolf',
				'grey-wolf',
				'tunnel-boar',
				'bone-mage',
				'death-knight',
				'tower-wraith',
				'crystal-guardian',
				'iron-sentinel',
				'cave-drake',
				'venom-wyvern',
				'burrowing-worm',
				'hungry-mimic',
				'slime-colony',
				'tower-basilisk',
				'frost-colossus',
				'stone-breaker',
				'storm-stalker',
				'goblin-archer',
				'goblin-hexweaver',
				'goblin-skirmisher',
				'cave-troll',
				'frost-giant',
				'ogoblin-brute'
			],
			canonicalPrimaryCurrentClassIds: [
				'giant-broodmother',
				'tunnel-spider',
				'grave-sentinel',
				'clay-golem',
				'stone-golem',
				'armored-elder-drake',
				'giant-tower-dragon',
				'ember-wisp',
				'goblin-chieftain',
				'hill-giant'
			]
		});
	});

	it('rejects an exact-set substitution even when forty unique records remain', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		changed.entries[39]!.currentClassId = 'fabricated-enemy';

		expect(() => auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets)).toThrow(
			/exactly match.*visual index/i
		);
	});

	it('rejects a canonical form claimed under the wrong family', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const mapped = changed.entries.find(({ disposition }) => disposition === 'map')!;
		mapped.canonicalFamilyId = 'goblins';

		expect(() => auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets)).toThrow(
			/canonical family\/form pair does not exist/i
		);
	});

	it('rejects duplicate canonical primary claims', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const firstClaim = changed.entries.find(
			({ disposition }) => disposition === 'map' || disposition === 'rename-map'
		)!;
		const bridgeOnly = changed.entries.find(
			({ disposition }) => disposition === 'secondary-archetype'
		)!;
		bridgeOnly.disposition = 'rename-map';
		bridgeOnly.canonicalFamilyId = firstClaim.canonicalFamilyId;
		bridgeOnly.canonicalFormId = firstClaim.canonicalFormId;

		expect(() => auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets)).toThrow(
			/canonical primary form.*claimed more than once/i
		);
	});

	it('rejects secondary archetypes that attempt to count as canonical forms', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const bridgeOnly = changed.entries.find(
			({ disposition }) => disposition === 'secondary-archetype'
		)!;
		bridgeOnly.canonicalFamilyId = 'goblins';
		bridgeOnly.canonicalFormId = 'goblin-runt';

		expect(() => auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets)).toThrow(
			/secondary-archetype.*canonical IDs to be null/i
		);
	});

	it('derives retained and bridge-only counts without adding bridge records to the 150', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const retired = changed.entries.find(
			({ disposition }) => disposition === 'secondary-archetype'
		)!;
		retired.disposition = 'retire';

		const audit = auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets);
		expect(audit.retainedBridgeCount).toBe(39);
		expect(audit.bridgeOnlyCount).toBe(29);
		expect(audit.canonicalPrimaryCount).toBe(10);
		expect(audit.retainedBridgeCurrentClassIds).not.toContain(retired.currentClassId);
		expect(audit.bridgeOnlyCurrentClassIds).not.toContain(retired.currentClassId);
		expect(audit.canonicalPrimaryCurrentClassIds).not.toContain(retired.currentClassId);
	});

	it('rejects Earth candidate reuse because the current roster has no Earth candidates', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		changed.entries[0]!.candidateReuseByAffinity.earth = true;

		expect(() => auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets)).toThrow(
			/Earth candidate reuse must be false/i
		);
	});

	it('rejects bridge-only reuse even with source provenance and the former magic phrase', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const entry = changed.entries.find(({ disposition }) => disposition === 'secondary-archetype')!;
		entry.candidateReuseByAffinity.normal = true;
		entry.rationale +=
			' Reuse: family, form, duty, anatomy, and framing are compatible for the Normal candidate.';

		expect(() => auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets)).toThrow(
			/reuse is unavailable until source\/canonical-bound structured review evidence exists/i
		);
	});

	it('rejects canonical reuse with valid provenance and plausible prose but no structured evidence', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const canonical = changed.entries.find(
			({ disposition }) => disposition === 'map' || disposition === 'rename-map'
		)!;
		canonical.candidateReuseByAffinity.normal = true;
		canonical.rationale +=
			' The family and form identity, battlefield duty, visible anatomy, and full-body framing appear compatible.';

		expect(() => auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets)).toThrow(
			/reuse is unavailable until source\/canonical-bound structured review evidence exists/i
		);
	});

	it('accepts the current mapping with every candidate reuse flag false', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const audit = auditCurrentClassMapping(mapping, visualIndex.monsters, familyPackets);

		expect(audit.candidateReuseCounts).toEqual({
			normal: 0,
			fire: 0,
			earth: 0,
			wind: 0,
			water: 0
		});
	});

	it('rejects candidate reuse on retired records', async () => {
		const { mapping, visualIndex, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const retired = changed.entries.find(
			({ disposition }) => disposition === 'secondary-archetype'
		)!;
		retired.disposition = 'retire';
		retired.candidateReuseByAffinity.normal = true;

		expect(() => auditCurrentClassMapping(changed, visualIndex.monsters, familyPackets)).toThrow(
			/retire.*candidate reuse must be false/i
		);
	});
});

describe('family affinity production manifest', () => {
	it('materializes the exact canonical 750 matrix with collision-safe ownership', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
		const reversed = buildFamilyAffinityProductionBundle([...familyPackets].reverse(), mapping);
		const audit = validateFamilyAffinityProductionBundle(bundle);

		expect(audit).toMatchObject({
			canonicalTargetCount: 750,
			canonicalAssignmentCount: 750,
			ownedOutputPathCount: 1500,
			normalTargetCount: 150,
			elementalTargetCount: 600,
			bridgeTargetCount: 0
		});
		expect(new Set(bundle.targets.map((target) => target.coordinateId)).size).toBe(750);
		expect(bundle.targets.every((target) => target.version === 1)).toBe(true);
		expect(stableFamilyAffinityJson(reversed.manifest)).toBe(
			stableFamilyAffinityJson(bundle.manifest)
		);
	});

	it('enforces exact family, form, affinity, count, path, and retry contracts', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
		const normal = bundle.targets.filter(({ affinity }) => affinity === 'normal');
		const elemental = bundle.targets.filter(({ affinity }) => affinity !== 'normal');
		expect(normal).toHaveLength(150);
		expect(elemental).toHaveLength(600);
		expect(elemental.every(({ status }) => status === 'blocked-on-anchor')).toBe(true);
		expect(
			bundle.assignments.every(({ retryCeiling }) => retryCeiling === 0 || retryCeiling === 1)
		).toBe(true);
		expect(() =>
			FamilyAffinityAssignmentSchema.parse({ ...bundle.assignments[0], retryCeiling: 2 })
		).toThrow();
		expect(() =>
			FamilyAffinityTargetSchema.parse({ ...bundle.targets[0], runtimeStatus: 'active' })
		).toThrow();
		const incompleteFamilies = structuredClone(familyPackets);
		incompleteFamilies[0]!.forms.pop();
		expect(() => buildFamilyAffinityProductionBundle(incompleteFamilies, mapping)).toThrow(
			/exactly five forms/i
		);
		expect(() =>
			validateFamilyAffinityProductionBundle({ ...bundle, targets: bundle.targets.slice(0, 749) })
		).toThrow(/750/);
		expect(() =>
			validateFamilyAffinityProductionBundle({
				...bundle,
				targets: [...bundle.targets, bundle.targets[0]!]
			})
		).toThrow(/750/);
		const duplicatePath = structuredClone(bundle);
		duplicatePath.targets[1]!.ownedPaths.candidate = duplicatePath.targets[0]!.ownedPaths.candidate;
		expect(() => validateFamilyAffinityProductionBundle(duplicatePath)).toThrow(
			/hash|outputs do not match|unique/i
		);
		const missingAffinity = structuredClone(bundle);
		missingAffinity.targets = missingAffinity.targets.filter(
			({ familyId, formId, affinity }) =>
				!(familyId === 'goblins' && formId === 'goblin-runt' && affinity === 'water')
		);
		missingAffinity.targets.push(missingAffinity.targets[0]!);
		expect(() => validateFamilyAffinityProductionBundle(missingAffinity)).toThrow(
			/unique|exactly Normal/i
		);
	});

	it('requires a hash-bound approved Normal receipt before elemental dispatch', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
		const changed = structuredClone(bundle);
		const fire = changed.targets.find(
			({ familyId, formId, affinity }) =>
				familyId === 'goblins' && formId === 'goblin-runt' && affinity === 'fire'
		)!;
		const assignment = changed.assignments.find(({ targetId }) => targetId === fire.targetId)!;
		fire.status = 'planned';
		assignment.dispatchStatus = 'planned';
		assignment.targetSha256 = familyAffinitySha256(fire);
		expect(() => validateFamilyAffinityProductionBundle(changed)).toThrow(
			/approval evidence|approved-review receipt/i
		);
	});

	it('binds every elemental target to the exact active Normal attempt', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
		const fire = bundle.targets.find(
			({ familyId, formId, affinity }) =>
				familyId === 'goblins' && formId === 'goblin-runt' && affinity === 'fire'
		)!;
		const normal = bundle.targets.find(
			({ familyId, formId, affinity }) =>
				familyId === 'goblins' && formId === 'goblin-runt' && affinity === 'normal'
		)!;
		expect(fire.anchor).toMatchObject({
			kind: 'normal-approved-review',
			normalCoordinateId: normal.coordinateId,
			normalVersion: normal.version,
			normalTargetSha256: familyAffinitySha256(normal)
		});
	});

	it('rejects tampered manifest and assignment cross-bindings', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
		for (const mutate of [
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.familyId = 'orcs';
			},
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.formId = 'orc-grunt';
			},
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.affinity = 'fire';
			},
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.activeVersion = 2;
			},
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.status = 'blocked-on-anchor';
			},
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.targetPath = coordinate.targetPath.replace('target-v1', 'target-v2');
			},
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.targetSha256 = '0'.repeat(64);
			},
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.assignmentPath = coordinate.assignmentPath.replace(
					'assignment-v1',
					'assignment-v2'
				);
			},
			(coordinate: (typeof bundle.manifest.canonicalMatrix.activeCoordinates)[number]) => {
				coordinate.assignmentSha256 = '0'.repeat(64);
			}
		]) {
			const changed = structuredClone(bundle);
			mutate(changed.manifest.canonicalMatrix.activeCoordinates[0]!);
			expect(() => validateFamilyAffinityProductionBundle(changed)).toThrow();
		}
		for (const mutate of [
			(assignment: (typeof bundle.assignments)[number]) => {
				assignment.namespace = 'bridge';
			},
			(assignment: (typeof bundle.assignments)[number]) => {
				assignment.coordinateId = 'orcs/orc-grunt/normal';
			},
			(assignment: (typeof bundle.assignments)[number]) => {
				assignment.version = 2;
			},
			(assignment: (typeof bundle.assignments)[number]) => {
				assignment.dispatchStatus = 'blocked-on-anchor';
			},
			(assignment: (typeof bundle.assignments)[number]) => {
				assignment.targetSha256 = '0'.repeat(64);
			},
			(assignment: (typeof bundle.assignments)[number]) => {
				assignment.allowedOutputs.candidate = assignment.allowedOutputs.result;
			},
			(assignment: (typeof bundle.assignments)[number]) => {
				(assignment as unknown as { producerRole: string }).producerRole = 'reviewer';
			},
			(assignment: (typeof bundle.assignments)[number]) => {
				(assignment as unknown as { selfPromotionForbidden: boolean }).selfPromotionForbidden =
					false;
			},
			(assignment: (typeof bundle.assignments)[number]) => {
				(
					assignment as unknown as { runtimeCatalogMutationForbidden: boolean }
				).runtimeCatalogMutationForbidden = false;
			}
		]) {
			const changed = structuredClone(bundle);
			mutate(changed.assignments[0]!);
			expect(() => validateFamilyAffinityProductionBundle(changed)).toThrow();
		}
	});

	it('rejects a duplicate manifest coordinate that replaces a missing reverse link', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(buildFamilyAffinityProductionBundle(familyPackets, mapping));
		changed.manifest.canonicalMatrix.activeCoordinates[1] = structuredClone(
			changed.manifest.canonicalMatrix.activeCoordinates[0]!
		);
		expect(() => validateFamilyAffinityProductionBundle(changed)).toThrow(
			/duplicate active.*coordinate|exact set|reverse/i
		);
	});

	it('rejects duplicate manifest attempt paths before ordinary path binding', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		for (const field of ['targetPath', 'assignmentPath'] as const) {
			const changed = structuredClone(buildFamilyAffinityProductionBundle(familyPackets, mapping));
			changed.manifest.canonicalMatrix.activeCoordinates[1]![field] =
				changed.manifest.canonicalMatrix.activeCoordinates[0]![field];
			expect(() => validateFamilyAffinityProductionBundle(changed)).toThrow(
				/duplicate active.*path/i
			);
		}
	});

	it.each(['coordinateId', 'targetPath', 'assignmentPath'] as const)(
		'rejects cross-namespace reuse of active %s during manifest parse and bundle validation',
		async (field) => {
			const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
			const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
			const canonical = bundle.manifest.canonicalMatrix.activeCoordinates[0]!;
			const paths = bridgeAttemptPaths('bridge-class', 'earth', 1);
			const bridge = {
				...canonical,
				namespace: 'bridge' as const,
				coordinateId: 'bridge-class/goblins/goblin-runt/earth',
				currentClassId: 'bridge-class',
				affinity: 'earth' as const,
				targetPath: paths.target,
				targetSha256: '1'.repeat(64),
				assignmentPath: paths.assignment,
				assignmentSha256: '2'.repeat(64),
				status: 'earth-bridge-provisional' as const
			};
			bridge[field] = canonical[field] as never;
			const forged = structuredClone(bundle.manifest);
			forged.bridge = { targetCount: 1, assignmentCount: 1, activeCoordinates: [bridge] };
			expect(() => FamilyAffinityManifestSchema.parse(forged)).toThrow(
				/global duplicate|cross-namespace/i
			);
			expect(() => validateFamilyAffinityProductionBundle({ ...bundle, manifest: forged })).toThrow(
				/global duplicate|cross-namespace/i
			);
		}
	);

	it('rejects wrong-family, wrong-form, stale, foreign, and manifest-unbound Normal approvals', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		const approved = structuredClone(buildFamilyAffinityProductionBundle(familyPackets, mapping));
		const normal = approved.targets.find(
			({ coordinateId }) => coordinateId === 'goblins/goblin-runt/normal'
		)!;
		const fire = approved.targets.find(
			({ coordinateId }) => coordinateId === 'goblins/goblin-runt/fire'
		)!;
		const receipt = {
			schemaVersion: 'family-affinity-review-receipt-v1' as const,
			targetId: normal.targetId,
			targetSha256: familyAffinitySha256(normal),
			resultPath: normal.ownedPaths.result,
			resultSha256: 'b'.repeat(64),
			candidatePath: normal.ownedPaths.candidate,
			candidateSha256: 'c'.repeat(64),
			decision: 'approved-review' as const,
			reviewerRole: 'independent-reviewer' as const
		};
		if (fire.anchor.kind !== 'normal-approved-review') throw new Error('Expected Normal anchor');
		fire.anchor.reviewReceiptSha256 = familyAffinitySha256(receipt);
		fire.anchor.normalCandidatePath = receipt.candidatePath;
		fire.anchor.normalCandidateSha256 = receipt.candidateSha256;
		fire.anchor.normalResultPath = receipt.resultPath;
		fire.anchor.normalResultSha256 = receipt.resultSha256;
		fire.status = 'planned';
		function rebindFire(bundle: typeof approved) {
			const changedFire = bundle.targets.find(
				({ coordinateId }) => coordinateId === 'goblins/goblin-runt/fire'
			)!;
			const assignment = bundle.assignments.find(
				({ targetId }) => targetId === changedFire.targetId
			)!;
			assignment.targetSha256 = familyAffinitySha256(changedFire);
			assignment.dispatchStatus = changedFire.status;
			const coordinate = bundle.manifest.canonicalMatrix.activeCoordinates.find(
				({ coordinateId }) => coordinateId === changedFire.coordinateId
			)!;
			coordinate.targetSha256 = familyAffinitySha256(changedFire);
			coordinate.assignmentSha256 = familyAffinitySha256(assignment);
			coordinate.status = changedFire.status;
		}
		rebindFire(approved);
		expect(() =>
			validateFamilyAffinityProductionBundle(approved, {
				[normal.ownedPaths.decision]: receipt
			})
		).not.toThrow();

		for (const mutate of [
			(anchor: Extract<typeof fire.anchor, { kind: 'normal-approved-review' }>) => {
				anchor.normalCoordinateId = 'orcs/orc-grunt/normal';
			},
			(anchor: Extract<typeof fire.anchor, { kind: 'normal-approved-review' }>) => {
				anchor.normalCoordinateId = 'goblins/goblin-cutter/normal';
			},
			(anchor: Extract<typeof fire.anchor, { kind: 'normal-approved-review' }>) => {
				anchor.normalVersion = 2;
			},
			(anchor: Extract<typeof fire.anchor, { kind: 'normal-approved-review' }>) => {
				anchor.reviewReceiptPath = approved.targets.find(
					({ coordinateId }) => coordinateId === 'orcs/orc-grunt/normal'
				)!.ownedPaths.decision;
			},
			(anchor: Extract<typeof fire.anchor, { kind: 'normal-approved-review' }>) => {
				anchor.normalTargetSha256 = '0'.repeat(64);
			}
		]) {
			const changed = structuredClone(approved);
			const changedFire = changed.targets.find(
				({ coordinateId }) => coordinateId === 'goblins/goblin-runt/fire'
			)!;
			if (changedFire.anchor.kind !== 'normal-approved-review') throw new Error('Expected anchor');
			mutate(changedFire.anchor);
			const reviewPath = changedFire.anchor.reviewReceiptPath;
			rebindFire(changed);
			expect(() =>
				validateFamilyAffinityProductionBundle(changed, {
					[reviewPath]: receipt
				})
			).toThrow(/anchor|receipt|family|form/i);
		}
	});

	it('forbids approved-review promotion for provisional Earth bridge work', async () => {
		const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
		const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
		const source = bundle.targets.find(({ affinity }) => affinity === 'earth')!;
		const provisionalPaths = bridgeAttemptPaths('bridge-class', 'earth', 1);
		const provisional = FamilyAffinityTargetSchema.parse({
			...source,
			namespace: 'bridge',
			coordinateId: `bridge-class/${source.familyId}/${source.formId}/earth`,
			targetId: `bridge/bridge-class/${source.familyId}/${source.formId}/earth/v1`,
			currentClassId: 'bridge-class',
			ownedPaths: {
				candidate: provisionalPaths.candidate,
				result: provisionalPaths.result,
				decision: provisionalPaths.decision,
				blindReview: provisionalPaths.blindReview
			},
			status: 'earth-bridge-provisional',
			anchor: {
				kind: 'earth-bridge-provisional',
				normalCandidatePath: source.ownedPaths.candidate,
				normalCandidateSha256: 'a'.repeat(64)
			}
		});
		const receipt = {
			schemaVersion: 'family-affinity-review-receipt-v1',
			targetId: provisional.targetId,
			targetSha256: familyAffinitySha256(provisional),
			resultPath: provisional.ownedPaths.result,
			resultSha256: 'b'.repeat(64),
			candidatePath: provisional.ownedPaths.candidate,
			candidateSha256: 'c'.repeat(64),
			decision: 'approved-review',
			reviewerRole: 'independent-reviewer'
		};
		expect(() => validateFamilyAffinityReviewPromotion(provisional, receipt)).toThrow(
			/provisional Earth.*cannot reach approved-review/i
		);
	});
});

async function snapshotGenerated(root: string): Promise<string[]> {
	const paths: string[] = [];
	async function walk(directory: string) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) await walk(path);
			else paths.push(path);
		}
	}
	await walk(join(root, FAMILY_AFFINITY_ROOT, 'targets'));
	await walk(join(root, FAMILY_AFFINITY_ROOT, 'assignments'));
	paths.push(join(root, FAMILY_AFFINITY_ROOT, 'manifest.json'));
	paths.sort();
	return Promise.all(
		paths.map(
			async (path) =>
				`${path.slice(root.length + 1)} ${createHash('sha256')
					.update(await readFile(path))
					.digest('hex')}`
		)
	);
}

async function stageFamilyProductionSource(root: string) {
	const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
	for (const family of familyPackets) {
		await writeOwnedFixture(
			root,
			`${FAMILY_AFFINITY_ROOT}/families/${String(family.sourceRaceNumber).padStart(2, '0')}-${family.familyId}.json`,
			family
		);
	}
	await writeOwnedFixture(root, `${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`, mapping);
	return { mapping, familyPackets };
}

async function writeRejectedAttemptEvidence(root: string, target: FamilyAffinityTarget) {
	const candidateBytes = `candidate:${target.targetId}`;
	await writeOwnedFixture(root, target.ownedPaths.candidate, candidateBytes);
	const result = {
		schemaVersion: 'family-affinity-result-v1',
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: createHash('sha256').update(candidateBytes).digest('hex'),
		state: 'rejected'
	};
	const resultBytes = stableFamilyAffinityJson(result);
	await writeOwnedFixture(root, target.ownedPaths.result, resultBytes);
	await writeOwnedFixture(root, target.ownedPaths.decision, {
		schemaVersion: 'family-affinity-review-receipt-v1',
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		resultPath: target.ownedPaths.result,
		resultSha256: createHash('sha256').update(resultBytes).digest('hex'),
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: result.candidateSha256,
		decision: 'rejected',
		reviewerRole: 'independent-reviewer'
	});
}

describe('deterministic family affinity exporter', () => {
	it('is byte-stable and check mode detects drift, missing files, and extras', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-affinity-export-'));
		try {
			const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
			for (const family of familyPackets) {
				await writeOwnedFixture(
					root,
					`${FAMILY_AFFINITY_ROOT}/families/${String(family.sourceRaceNumber).padStart(2, '0')}-${family.familyId}.json`,
					family
				);
			}
			await writeOwnedFixture(root, `${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`, mapping);
			const first = await exportFamilyAffinityProduction({ repositoryRoot: root, check: false });
			expect(first.artifactCount).toBe(1501);
			const snapshot = await snapshotGenerated(root);
			await exportFamilyAffinityProduction({ repositoryRoot: root, check: false });
			expect(await snapshotGenerated(root)).toEqual(snapshot);
			await expect(
				exportFamilyAffinityProduction({ repositoryRoot: root, check: true })
			).resolves.toMatchObject({ artifactCount: 1501 });

			const targetPath = snapshot.find((entry) => entry.includes('/targets/'))!.split(' ')[0]!;
			const originalTarget = await readFile(join(root, targetPath), 'utf8');
			await writeFile(join(root, targetPath), '{"drift":true}\n');
			await expect(
				exportFamilyAffinityProduction({ repositoryRoot: root, check: true })
			).rejects.toThrow(/drift/i);
			await expect(
				exportFamilyAffinityProduction({ repositoryRoot: root, check: false })
			).rejects.toThrow(/drift/i);
			await writeFile(join(root, targetPath), originalTarget);
			await rm(join(root, targetPath));
			await expect(
				exportFamilyAffinityProduction({ repositoryRoot: root, check: true })
			).rejects.toThrow(/missing/i);
			await expect(
				exportFamilyAffinityProduction({ repositoryRoot: root, check: false })
			).rejects.toThrow(/missing/i);
			await writeFile(join(root, targetPath), originalTarget);
			await writeFile(
				join(root, targetPath.replace('target-v1.json', 'target-v2.json')),
				originalTarget
			);
			await expect(
				exportFamilyAffinityProduction({ repositoryRoot: root, check: true })
			).rejects.toThrow(/orphan|unreferenced|extra/i);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 20_000);

	it('refuses to overwrite a drifted immutable v1 attempt', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-affinity-export-immutable-'));
		try {
			const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
			for (const family of familyPackets) {
				await writeOwnedFixture(
					root,
					`${FAMILY_AFFINITY_ROOT}/families/${String(family.sourceRaceNumber).padStart(2, '0')}-${family.familyId}.json`,
					family
				);
			}
			await writeOwnedFixture(root, `${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`, mapping);
			await exportFamilyAffinityProduction({ repositoryRoot: root, check: false });
			const immutablePath = `${FAMILY_AFFINITY_ROOT}/targets/goblins/goblin-runt/normal/target-v1.json`;
			await writeOwnedFixture(root, immutablePath, '{"tampered":true}\n');
			await expect(
				exportFamilyAffinityProduction({ repositoryRoot: root, check: false })
			).rejects.toThrow(/immutable|drift/i);
			expect(await readFile(join(root, immutablePath), 'utf8')).toBe('{"tampered":true}\n');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('preserves canonical revisions, bridge history, and active pointers across exports', async () => {
		const root = await mkdtemp(join(tmpdir(), 'family-affinity-export-lifecycle-'));
		try {
			await stageFamilyProductionSource(root);
			await exportFamilyAffinityProduction({ repositoryRoot: root, check: false });
			const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
			let manifest = FamilyAffinityManifestSchema.parse(
				JSON.parse(await readFile(join(root, manifestPath), 'utf8'))
			);
			const canonicalCoordinate = manifest.canonicalMatrix.activeCoordinates.find(
				({ coordinateId }) => coordinateId === 'goblins/goblin-runt/normal'
			)!;
			const canonicalTarget = FamilyAffinityTargetSchema.parse(
				JSON.parse(await readFile(join(root, canonicalCoordinate.targetPath), 'utf8'))
			);
			await writeRejectedAttemptEvidence(root, canonicalTarget);
			await allocateFamilyAffinityRevision({
				repositoryRoot: root,
				manifestPath,
				namespace: 'canonical',
				coordinateId: canonicalTarget.coordinateId,
				callerRole: 'integration-controller',
				reviewPath: canonicalTarget.ownedPaths.decision
			});

			manifest = FamilyAffinityManifestSchema.parse(
				JSON.parse(await readFile(join(root, manifestPath), 'utf8'))
			);
			const sourceEarthCoordinate = manifest.canonicalMatrix.activeCoordinates.find(
				({ coordinateId }) => coordinateId === 'goblins/goblin-runt/earth'
			)!;
			const sourceEarth = FamilyAffinityTargetSchema.parse(
				JSON.parse(await readFile(join(root, sourceEarthCoordinate.targetPath), 'utf8'))
			);
			const bridgeCoordinateId = 'bridge-class/goblins/goblin-runt/earth';
			const bridgePaths = bridgeAttemptPaths('bridge-class', 'earth', 1);
			const bridgeTarget = FamilyAffinityTargetSchema.parse({
				...sourceEarth,
				namespace: 'bridge',
				coordinateId: bridgeCoordinateId,
				targetId: `bridge/${bridgeCoordinateId}/v1`,
				currentClassId: 'bridge-class',
				ownedPaths: {
					candidate: bridgePaths.candidate,
					result: bridgePaths.result,
					decision: bridgePaths.decision,
					blindReview: bridgePaths.blindReview
				},
				anchor: {
					kind: 'earth-bridge-provisional',
					normalCandidatePath: canonicalTarget.ownedPaths.candidate,
					normalCandidateSha256: 'a'.repeat(64)
				},
				status: 'earth-bridge-provisional'
			});
			const sourceAssignment = FamilyAffinityAssignmentSchema.parse(
				JSON.parse(await readFile(join(root, sourceEarthCoordinate.assignmentPath), 'utf8'))
			);
			const bridgeAssignment = FamilyAffinityAssignmentSchema.parse({
				...sourceAssignment,
				assignmentId: `${bridgeTarget.targetId}/assignment`,
				targetId: bridgeTarget.targetId,
				targetSha256: familyAffinitySha256(bridgeTarget),
				coordinateId: bridgeCoordinateId,
				namespace: 'bridge',
				allowedOutputs: {
					candidate: bridgeTarget.ownedPaths.candidate,
					result: bridgeTarget.ownedPaths.result
				},
				dispatchStatus: 'earth-bridge-provisional'
			});
			const bridgeTargetPath = bridgePaths.target;
			const bridgeAssignmentPath = bridgePaths.assignment;
			await writeOwnedFixture(root, bridgeTargetPath, bridgeTarget);
			await writeOwnedFixture(root, bridgeAssignmentPath, bridgeAssignment);
			manifest.bridge = {
				targetCount: 1,
				assignmentCount: 1,
				activeCoordinates: [
					{
						namespace: 'bridge',
						coordinateId: bridgeCoordinateId,
						familyId: bridgeTarget.familyId,
						formId: bridgeTarget.formId,
						currentClassId: 'bridge-class',
						affinity: 'earth',
						activeVersion: 1,
						targetPath: bridgeTargetPath,
						targetSha256: familyAffinitySha256(bridgeTarget),
						assignmentPath: bridgeAssignmentPath,
						assignmentSha256: familyAffinitySha256(bridgeAssignment),
						status: 'earth-bridge-provisional'
					}
				]
			};
			await writeOwnedFixture(root, manifestPath, manifest);
			await writeRejectedAttemptEvidence(root, bridgeTarget);
			await allocateFamilyAffinityRevision({
				repositoryRoot: root,
				manifestPath,
				namespace: 'bridge',
				coordinateId: bridgeCoordinateId,
				callerRole: 'integration-controller',
				reviewPath: bridgeTarget.ownedPaths.decision
			});

			await exportFamilyAffinityProduction({ repositoryRoot: root, check: false });
			await exportFamilyAffinityProduction({ repositoryRoot: root, check: true });
			const stableBefore = await readFile(join(root, manifestPath), 'utf8');
			await exportFamilyAffinityProduction({ repositoryRoot: root, check: false });
			expect(await readFile(join(root, manifestPath), 'utf8')).toBe(stableBefore);
			const preserved = FamilyAffinityManifestSchema.parse(JSON.parse(stableBefore));
			expect(
				preserved.canonicalMatrix.activeCoordinates.find(
					({ coordinateId }) => coordinateId === canonicalTarget.coordinateId
				)?.activeVersion
			).toBe(2);
			expect(preserved.bridge).toMatchObject({ targetCount: 1, assignmentCount: 1 });
			expect(preserved.bridge.activeCoordinates[0]?.activeVersion).toBe(2);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 30_000);
});

async function writeOwnedFixture(root: string, path: string, value: string | object) {
	const absolute = join(root, path);
	await mkdir(join(absolute, '..'), { recursive: true });
	await writeFile(absolute, typeof value === 'string' ? value : stableFamilyAffinityJson(value));
}

async function makeRevisionFixture(options?: {
	namespace?: 'canonical' | 'bridge';
	decision?: 'rejected' | 'revise' | 'approved-review';
}) {
	const root = await mkdtemp(join(tmpdir(), 'family-affinity-revision-'));
	const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
	const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
	for (const artifact of bundle.artifacts) {
		await writeOwnedFixture(root, artifact.path, artifact.value as object);
	}
	const source = bundle.targets.find(
		({ familyId, formId, affinity }) =>
			familyId === 'goblins' && formId === 'goblin-runt' && affinity === 'normal'
	)!;
	let target = source;
	let manifest = structuredClone(bundle.manifest);
	let coordinate = manifest.canonicalMatrix.activeCoordinates.find(
		({ coordinateId }) => coordinateId === source.coordinateId
	)!;
	let targetPath = coordinate.targetPath;
	let assignmentPath = coordinate.assignmentPath;
	if (options?.namespace === 'bridge') {
		const coordinateId = `bridge-class/${source.familyId}/${source.formId}/earth`;
		const bridgePaths = bridgeAttemptPaths('bridge-class', 'earth', 1);
		target = FamilyAffinityTargetSchema.parse({
			...source,
			namespace: 'bridge',
			coordinateId,
			targetId: `bridge/${coordinateId}/v1`,
			currentClassId: 'bridge-class',
			affinity: 'earth',
			constructionDimensions: ['mineral load frame', 'fracture seam locomotion'],
			ownedPaths: {
				candidate: bridgePaths.candidate,
				result: bridgePaths.result,
				decision: bridgePaths.decision,
				blindReview: bridgePaths.blindReview
			},
			anchor: {
				kind: 'earth-bridge-provisional',
				normalCandidatePath: source.ownedPaths.candidate,
				normalCandidateSha256: 'a'.repeat(64)
			},
			status: 'earth-bridge-provisional'
		});
		targetPath = bridgePaths.target;
		assignmentPath = bridgePaths.assignment;
		const assignment = FamilyAffinityAssignmentSchema.parse({
			...bundle.assignments.find(({ targetId }) => targetId === source.targetId)!,
			assignmentId: `${target.targetId}/assignment`,
			targetId: target.targetId,
			targetSha256: familyAffinitySha256(target),
			coordinateId,
			namespace: 'bridge',
			allowedOutputs: {
				candidate: target.ownedPaths.candidate,
				result: target.ownedPaths.result
			},
			dispatchStatus: 'earth-bridge-provisional'
		});
		coordinate = {
			namespace: 'bridge',
			coordinateId,
			familyId: target.familyId,
			formId: target.formId,
			currentClassId: 'bridge-class',
			affinity: 'earth',
			activeVersion: 1,
			targetPath,
			targetSha256: familyAffinitySha256(target),
			assignmentPath,
			assignmentSha256: familyAffinitySha256(assignment),
			status: 'earth-bridge-provisional'
		};
		manifest.bridge = { targetCount: 1, assignmentCount: 1, activeCoordinates: [coordinate] };
		await writeOwnedFixture(root, assignmentPath, assignment);
	} else {
		await writeOwnedFixture(
			root,
			assignmentPath,
			bundle.assignments.find(({ targetId }) => targetId === target.targetId)!
		);
	}
	await writeOwnedFixture(root, targetPath, target);
	const candidateBytes = 'candidate-pixels-v1';
	await writeOwnedFixture(root, target.ownedPaths.candidate, candidateBytes);
	const result = {
		schemaVersion: 'family-affinity-result-v1',
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: createHash('sha256').update(candidateBytes).digest('hex'),
		state: options?.decision === 'revise' ? 'revise' : 'rejected'
	};
	const resultBytes = stableFamilyAffinityJson(result);
	await writeOwnedFixture(root, target.ownedPaths.result, resultBytes);
	const receipt = {
		schemaVersion: 'family-affinity-review-receipt-v1',
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		resultPath: target.ownedPaths.result,
		resultSha256: createHash('sha256').update(resultBytes).digest('hex'),
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: result.candidateSha256,
		decision: options?.decision ?? 'rejected',
		reviewerRole: 'independent-reviewer'
	};
	await writeOwnedFixture(root, target.ownedPaths.decision, receipt);
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	await writeOwnedFixture(root, manifestPath, manifest);
	return { root, target, manifestPath, coordinate, receipt };
}

describe('controller-only family affinity revision allocation', () => {
	it('rejects a foreign bridge path even when every generic suffix is valid', async () => {
		const fixture = await makeRevisionFixture({ namespace: 'bridge' });
		try {
			const assignment = FamilyAffinityAssignmentSchema.parse(
				JSON.parse(await readFile(join(fixture.root, fixture.coordinate.assignmentPath), 'utf8'))
			);
			const coordinate = structuredClone(fixture.coordinate);
			const target = structuredClone(fixture.target);
			coordinate.targetPath = coordinate.targetPath.replace('/bridge-class/', '/foreign-orc/');
			coordinate.assignmentPath = coordinate.assignmentPath.replace(
				'/bridge-class/',
				'/foreign-orc/'
			);
			target.ownedPaths.candidate = target.ownedPaths.candidate.replace(
				'/bridge-class/',
				'/foreign-orc/'
			);
			target.ownedPaths.result = target.ownedPaths.result.replace(
				'/bridge-class/',
				'/foreign-orc/'
			);
			target.ownedPaths.decision = target.ownedPaths.decision.replace(
				'/bridge-class/',
				'/foreign-orc/'
			);
			target.ownedPaths.blindReview = target.ownedPaths.blindReview.replace(
				'/bridge-class/',
				'/foreign-orc/'
			);
			assignment.targetSha256 = familyAffinitySha256(target);
			assignment.allowedOutputs = {
				candidate: target.ownedPaths.candidate,
				result: target.ownedPaths.result
			};
			coordinate.targetSha256 = familyAffinitySha256(target);
			coordinate.assignmentSha256 = familyAffinitySha256(assignment);
			expect(() =>
				validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment)
			).toThrow(/exact bridge|bridge.*paths.*exact|bridge attempt path/i);
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('rejects swapped bridge target, assignment, candidate, and result paths', async () => {
		const fixture = await makeRevisionFixture({ namespace: 'bridge' });
		try {
			const assignment = FamilyAffinityAssignmentSchema.parse(
				JSON.parse(await readFile(join(fixture.root, fixture.coordinate.assignmentPath), 'utf8'))
			);
			const swappedManifest = structuredClone(fixture.coordinate);
			[swappedManifest.targetPath, swappedManifest.assignmentPath] = [
				swappedManifest.assignmentPath,
				swappedManifest.targetPath
			];
			expect(() =>
				validateFamilyAffinityAttemptCrossBinding(swappedManifest, fixture.target, assignment)
			).toThrow(/bridge|path/i);
			const swappedTarget = structuredClone(fixture.target);
			[swappedTarget.ownedPaths.candidate, swappedTarget.ownedPaths.result] = [
				swappedTarget.ownedPaths.result,
				swappedTarget.ownedPaths.candidate
			];
			expect(() =>
				validateFamilyAffinityAttemptCrossBinding(fixture.coordinate, swappedTarget, assignment)
			).toThrow(/bridge|path/i);
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('allocates canonical vN+1 without overwriting the rejected attempt', async () => {
		const fixture = await makeRevisionFixture();
		try {
			const allocated = await allocateFamilyAffinityRevision({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				namespace: 'canonical',
				coordinateId: fixture.target.coordinateId,
				callerRole: 'integration-controller',
				reviewPath: fixture.target.ownedPaths.decision
			});
			expect(allocated.target.version).toBe(2);
			expect(allocated.target.precedingAttempt?.targetId).toBe(fixture.target.targetId);
			expect(allocated.target.ownedPaths.candidate).toMatch(/-v2\.png$/);
			expect(await readFile(join(fixture.root, fixture.coordinate.targetPath), 'utf8')).toContain(
				fixture.target.targetId
			);
			const manifest = FamilyAffinityManifestSchema.parse(
				JSON.parse(await readFile(join(fixture.root, fixture.manifestPath), 'utf8'))
			);
			expect(
				manifest.canonicalMatrix.activeCoordinates.find(
					({ coordinateId }) => coordinateId === fixture.target.coordinateId
				)?.activeVersion
			).toBe(2);
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('allocates a temporary bridge coordinate outside the canonical 750', async () => {
		const fixture = await makeRevisionFixture({ namespace: 'bridge', decision: 'revise' });
		try {
			const allocated = await allocateFamilyAffinityRevision({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				namespace: 'bridge',
				coordinateId: fixture.target.coordinateId,
				callerRole: 'integration-controller',
				reviewPath: fixture.target.ownedPaths.decision
			});
			expect(allocated.target.namespace).toBe('bridge');
			expect(allocated.target.version).toBe(2);
			const manifest = FamilyAffinityManifestSchema.parse(
				JSON.parse(await readFile(join(fixture.root, fixture.manifestPath), 'utf8'))
			);
			expect(manifest.canonicalMatrix.targetCount).toBe(750);
			expect(manifest.bridge.targetCount).toBe(1);
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('rejects producer/reviewer callers, approved attempts, wrong coordinates, and stale hashes', async () => {
		const wrongRole = await makeRevisionFixture();
		try {
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: wrongRole.root,
					manifestPath: wrongRole.manifestPath,
					namespace: 'canonical',
					coordinateId: wrongRole.target.coordinateId,
					callerRole: 'image-producer',
					reviewPath: wrongRole.target.ownedPaths.decision
				})
			).rejects.toThrow(/only.*integration-controller/i);
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: wrongRole.root,
					manifestPath: wrongRole.manifestPath,
					namespace: 'canonical',
					coordinateId: 'wrong/coordinate/normal',
					callerRole: 'integration-controller',
					reviewPath: wrongRole.target.ownedPaths.decision
				})
			).rejects.toThrow(/wrong or unknown/i);
		} finally {
			await rm(wrongRole.root, { recursive: true, force: true });
		}
		const approved = await makeRevisionFixture({ decision: 'approved-review' });
		try {
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: approved.root,
					manifestPath: approved.manifestPath,
					namespace: 'canonical',
					coordinateId: approved.target.coordinateId,
					callerRole: 'integration-controller',
					reviewPath: approved.target.ownedPaths.decision
				})
			).rejects.toThrow(/rejected or revise/i);
		} finally {
			await rm(approved.root, { recursive: true, force: true });
		}
		const stale = await makeRevisionFixture();
		try {
			await writeOwnedFixture(stale.root, stale.target.ownedPaths.decision, {
				...stale.receipt,
				targetSha256: '0'.repeat(64)
			});
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: stale.root,
					manifestPath: stale.manifestPath,
					namespace: 'canonical',
					coordinateId: stale.target.coordinateId,
					callerRole: 'integration-controller',
					reviewPath: stale.target.ownedPaths.decision
				})
			).rejects.toThrow(/stale|mismatch/i);
		} finally {
			await rm(stale.root, { recursive: true, force: true });
		}
	});

	it.each(['target', 'assignment', 'candidate', 'result', 'decision', 'blindReview'] as const)(
		'refuses allocation when the proposed v2 %s path already exists',
		async (kind) => {
			const fixture = await makeRevisionFixture();
			try {
				const current =
					kind === 'target'
						? fixture.coordinate.targetPath
						: kind === 'assignment'
							? fixture.coordinate.assignmentPath
							: fixture.target.ownedPaths[kind];
				const proposed = current.replace(/v1(?=\.(?:png|json)$)/u, 'v2');
				await writeOwnedFixture(fixture.root, proposed, 'occupied');
				await expect(
					allocateFamilyAffinityRevision({
						repositoryRoot: fixture.root,
						manifestPath: fixture.manifestPath,
						namespace: 'canonical',
						coordinateId: fixture.target.coordinateId,
						callerRole: 'integration-controller',
						reviewPath: fixture.target.ownedPaths.decision
					})
				).rejects.toThrow(/collision/i);
			} finally {
				await rm(fixture.root, { recursive: true, force: true });
			}
		}
	);

	it('refuses a manifest version skip instead of allocating over missing history', async () => {
		const fixture = await makeRevisionFixture();
		try {
			const manifest = JSON.parse(
				await readFile(join(fixture.root, fixture.manifestPath), 'utf8')
			) as {
				canonicalMatrix: {
					activeCoordinates: Array<{ coordinateId: string; activeVersion: number }>;
				};
			};
			const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
				({ coordinateId }) => coordinateId === fixture.target.coordinateId
			)!;
			coordinate.activeVersion = 2;
			await writeOwnedFixture(fixture.root, fixture.manifestPath, manifest);
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					namespace: 'canonical',
					coordinateId: fixture.target.coordinateId,
					callerRole: 'integration-controller',
					reviewPath: fixture.target.ownedPaths.decision
				})
			).rejects.toThrow(/stale|mismatch/i);
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('refuses allocation when an unrelated active manifest coordinate is tampered', async () => {
		const fixture = await makeRevisionFixture();
		try {
			const manifest = JSON.parse(
				await readFile(join(fixture.root, fixture.manifestPath), 'utf8')
			) as {
				canonicalMatrix: { activeCoordinates: Array<{ coordinateId: string; familyId: string }> };
			};
			const originalManifest = structuredClone(manifest);
			const unrelated = manifest.canonicalMatrix.activeCoordinates.find(
				({ coordinateId }) => coordinateId !== fixture.target.coordinateId
			)!;
			unrelated.familyId = 'tampered-family';
			await writeOwnedFixture(fixture.root, fixture.manifestPath, manifest);
			const tamperedManifestBytes = stableFamilyAffinityJson(manifest);
			const proposedV2Target = fixture.coordinate.targetPath.replace(
				'target-v1.json',
				'target-v2.json'
			);
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					namespace: 'canonical',
					coordinateId: fixture.target.coordinateId,
					callerRole: 'integration-controller',
					reviewPath: fixture.target.ownedPaths.decision
				})
			).rejects.toThrow(/active corpus|manifest|cross-bind/i);
			expect(await readFile(join(fixture.root, fixture.manifestPath), 'utf8')).toBe(
				tamperedManifestBytes
			);
			await expect(readFile(join(fixture.root, proposedV2Target))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			originalManifest.canonicalMatrix.activeCoordinates[1] = structuredClone(
				originalManifest.canonicalMatrix.activeCoordinates[0]!
			);
			await writeOwnedFixture(fixture.root, fixture.manifestPath, originalManifest);
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					namespace: 'canonical',
					coordinateId: fixture.target.coordinateId,
					callerRole: 'integration-controller',
					reviewPath: fixture.target.ownedPaths.decision
				})
			).rejects.toThrow(/duplicate active.*coordinate/i);
			await expect(readFile(join(fixture.root, proposedV2Target))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('refuses a forged cross-namespace manifest before allocation mutation', async () => {
		const fixture = await makeRevisionFixture();
		try {
			const manifest = JSON.parse(
				await readFile(join(fixture.root, fixture.manifestPath), 'utf8')
			) as {
				canonicalMatrix: { activeCoordinates: Array<Record<string, unknown>> };
				bridge: {
					targetCount: number;
					assignmentCount: number;
					activeCoordinates: Array<Record<string, unknown>>;
				};
			};
			const canonical = manifest.canonicalMatrix.activeCoordinates[0]!;
			manifest.bridge = {
				targetCount: 1,
				assignmentCount: 1,
				activeCoordinates: [
					{
						...canonical,
						namespace: 'bridge',
						currentClassId: 'bridge-class'
					}
				]
			};
			const forgedBytes = stableFamilyAffinityJson(manifest);
			await writeOwnedFixture(fixture.root, fixture.manifestPath, manifest);
			const proposedV2Target = fixture.coordinate.targetPath.replace(
				'target-v1.json',
				'target-v2.json'
			);
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					namespace: 'canonical',
					coordinateId: fixture.target.coordinateId,
					callerRole: 'integration-controller',
					reviewPath: fixture.target.ownedPaths.decision
				})
			).rejects.toThrow(/global duplicate|cross-namespace/i);
			expect(await readFile(join(fixture.root, fixture.manifestPath), 'utf8')).toBe(forgedBytes);
			await expect(readFile(join(fixture.root, proposedV2Target))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});
});

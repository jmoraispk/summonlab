import { lstat, mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	auditCurrentClassMapping,
	allocateFamilyAffinityRevision,
	allocateFamilyAffinityRevisionBatch,
	buildFamilyAffinityProductionBundle,
	bridgeAttemptPaths,
	canonicalAttemptPaths,
	FamilyAffinityAssignmentSchema,
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	familyAffinityProducerIdentitySha256,
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinityReviewAssignmentPath,
	familyAffinityReviewIssuerAttestationSha256,
	familyAffinitySha256,
	stableFamilyAffinityJson,
	validateFamilyAffinityProductionBundle,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityNormalAnchorEvidence,
	validateFamilyAffinityReviewPromotion,
	CurrentClassMappingFileSchema,
	FamilyPacketSchema
} from './family-affinity-production-lib.js';
import type {
	CurrentClassMappingEntry,
	FamilyAffinityTarget
} from './family-affinity-production-lib.js';
import { exportFamilyAffinityProduction } from './export-family-affinity-production.js';
import { parseFamilyAffinityRevisionCli } from './allocate-family-affinity-revision.js';

const passingReviewRubric = Object.fromEntries(
	['identity', 'tier', 'archetype', 'anatomy', 'affinity', 'counterplay', 'framing', 'finish'].map(
		(key) => [key, { verdict: 'pass', notes: `${key} independently reviewed` }]
	)
);

function makeOrdinaryReviewReceipt(
	target: FamilyAffinityTarget,
	input: {
		decision?: 'approved-review' | 'rejected' | 'revise';
		candidateSha256?: string;
		resultSha256?: string;
		producerId?: string;
	} = {}
) {
	const producerId = input.producerId ?? 'producer-alpha';
	return {
		schemaVersion: 'family-affinity-review-decision-v1' as const,
		receiptType: 'ordinary' as const,
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		decisionVersion: target.version,
		producerId,
		reviewerId: 'reviewer-beta',
		producerIdentitySha256: familyAffinityProducerIdentitySha256(producerId),
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: input.candidateSha256 ?? 'c'.repeat(64),
		resultPath: target.ownedPaths.result,
		resultSha256: input.resultSha256 ?? 'b'.repeat(64),
		sourcePath: target.sources.familyPacketPath,
		sourceSha256: target.sources.familyPacketSha256,
		promptSha256: 'd'.repeat(64),
		decision: input.decision ?? 'approved-review',
		rubric: passingReviewRubric,
		runtimeCatalogMutationForbidden: true as const
	};
}

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
	reconciliation: {
		entries: Array<{
			currentClassId: string;
			sourceFamilyLabel: string;
			references: Array<{
				affinity: string;
				candidatePath: string;
				contentHash: string;
			}>;
		}>;
	};
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
	const currentClassSources = visualIndex.reconciliation.entries.map((entry) => ({
		id: entry.currentClassId,
		familyName: entry.sourceFamilyLabel,
		variants: entry.references
	}));

	return { mapping, currentClassSources, familyPackets };
}

describe('current class reconciliation', () => {
	it('reconciles the exact forty visual-index classes in source order', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const audit = auditCurrentClassMapping(mapping, currentClassSources, familyPackets);

		expect(mapping.entries.map(({ currentClassId }) => currentClassId)).toEqual(
			currentClassSources.map(({ id }) => id)
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
			retainedBridgeCurrentClassIds: currentClassSources.map(({ id }) => id),
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
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		changed.entries[39]!.currentClassId = 'fabricated-enemy';

		expect(() => auditCurrentClassMapping(changed, currentClassSources, familyPackets)).toThrow(
			/exactly match.*visual index/i
		);
	});

	it('rejects a canonical form claimed under the wrong family', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const mapped = changed.entries.find(({ disposition }) => disposition === 'map')!;
		mapped.canonicalFamilyId = 'goblins';

		expect(() => auditCurrentClassMapping(changed, currentClassSources, familyPackets)).toThrow(
			/canonical family\/form pair does not exist/i
		);
	});

	it('rejects duplicate canonical primary claims', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
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

		expect(() => auditCurrentClassMapping(changed, currentClassSources, familyPackets)).toThrow(
			/canonical primary form.*claimed more than once/i
		);
	});

	it('rejects secondary archetypes that attempt to count as canonical forms', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const bridgeOnly = changed.entries.find(
			({ disposition }) => disposition === 'secondary-archetype'
		)!;
		bridgeOnly.canonicalFamilyId = 'goblins';
		bridgeOnly.canonicalFormId = 'goblin-runt';

		expect(() => auditCurrentClassMapping(changed, currentClassSources, familyPackets)).toThrow(
			/secondary-archetype.*canonical IDs to be null/i
		);
	});

	it('derives retained and bridge-only counts without adding bridge records to the 150', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const retired = changed.entries.find(
			({ disposition }) => disposition === 'secondary-archetype'
		)!;
		retired.disposition = 'retire';

		const audit = auditCurrentClassMapping(changed, currentClassSources, familyPackets);
		expect(audit.retainedBridgeCount).toBe(39);
		expect(audit.bridgeOnlyCount).toBe(29);
		expect(audit.canonicalPrimaryCount).toBe(10);
		expect(audit.retainedBridgeCurrentClassIds).not.toContain(retired.currentClassId);
		expect(audit.bridgeOnlyCurrentClassIds).not.toContain(retired.currentClassId);
		expect(audit.canonicalPrimaryCurrentClassIds).not.toContain(retired.currentClassId);
	});

	it('rejects Earth candidate reuse because the current roster has no Earth candidates', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		changed.entries[0]!.candidateReuseByAffinity.earth = true;

		expect(() => auditCurrentClassMapping(changed, currentClassSources, familyPackets)).toThrow(
			/Earth candidate reuse must be false/i
		);
	});

	it('rejects bridge-only reuse even with source provenance and the former magic phrase', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const entry = changed.entries.find(({ disposition }) => disposition === 'secondary-archetype')!;
		entry.candidateReuseByAffinity.normal = true;
		entry.rationale +=
			' Reuse: family, form, duty, anatomy, and framing are compatible for the Normal candidate.';

		expect(() => auditCurrentClassMapping(changed, currentClassSources, familyPackets)).toThrow(
			/reuse is unavailable until source\/canonical-bound structured review evidence exists/i
		);
	});

	it('rejects canonical reuse with valid provenance and plausible prose but no structured evidence', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const canonical = changed.entries.find(
			({ disposition }) => disposition === 'map' || disposition === 'rename-map'
		)!;
		canonical.candidateReuseByAffinity.normal = true;
		canonical.rationale +=
			' The family and form identity, battlefield duty, visible anatomy, and full-body framing appear compatible.';

		expect(() => auditCurrentClassMapping(changed, currentClassSources, familyPackets)).toThrow(
			/reuse is unavailable until source\/canonical-bound structured review evidence exists/i
		);
	});

	it('accepts the current mapping with every candidate reuse flag false', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const audit = auditCurrentClassMapping(mapping, currentClassSources, familyPackets);

		expect(audit.candidateReuseCounts).toEqual({
			normal: 0,
			fire: 0,
			earth: 0,
			wind: 0,
			water: 0
		});
	});

	it('rejects candidate reuse on retired records', async () => {
		const { mapping, currentClassSources, familyPackets } = await loadCurrentClassAuditFixtures();
		const changed = structuredClone(mapping);
		const retired = changed.entries.find(
			({ disposition }) => disposition === 'secondary-archetype'
		)!;
		retired.disposition = 'retire';
		retired.candidateReuseByAffinity.normal = true;

		expect(() => auditCurrentClassMapping(changed, currentClassSources, familyPackets)).toThrow(
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
		const receipt = makeOrdinaryReviewReceipt(normal);
		const receiptBytes = Buffer.from(stableFamilyAffinityJson(receipt));
		if (fire.anchor.kind !== 'normal-approved-review') throw new Error('Expected Normal anchor');
		fire.anchor.reviewReceiptSha256 = familyAffinityRawSha256(receiptBytes);
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
				[normal.ownedPaths.decision]: { receipt, bytes: receiptBytes }
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
					[reviewPath]: { receipt, bytes: receiptBytes }
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
			canonicalCoordinateId: source.coordinateId,
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
		const receipt = makeOrdinaryReviewReceipt(provisional);
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
	const attemptPaths =
		target.namespace === 'canonical'
			? canonicalAttemptPaths(target.familyId, target.formId, target.affinity, target.version)
			: bridgeAttemptPaths(target.currentClassId!, target.affinity, target.version);
	const assignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(await readFile(join(root, attemptPaths.assignment), 'utf8'))
	);
	const candidateBytes = `candidate:${target.targetId}`;
	await writeOwnedFixture(root, target.ownedPaths.candidate, candidateBytes);
	const result = {
		schemaVersion: 'family-affinity-result-v1' as const,
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		producerId: 'producer-alpha',
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: familyAffinityRawSha256(candidateBytes),
		resultPath: target.ownedPaths.result,
		sourcePath: target.sources.familyPacketPath,
		sourceSha256: target.sources.familyPacketSha256,
		promptSha256: familyAffinityPromptSha256(target, assignment),
		state: 'candidate-only' as const,
		runtimeCatalogMutationForbidden: true as const
	};
	const resultBytes = stableFamilyAffinityJson(result);
	await writeOwnedFixture(root, target.ownedPaths.result, resultBytes);
	const receipt = {
		...makeOrdinaryReviewReceipt(target, {
			decision: 'rejected',
			candidateSha256: result.candidateSha256,
			resultSha256: familyAffinityRawSha256(resultBytes)
		}),
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256
	};
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	const manifestBytes = await readFile(join(root, manifestPath));
	const manifestSha256 = familyAffinityRawSha256(manifestBytes);
	const reviewAssignmentPath = familyAffinityReviewAssignmentPath(
		'ordinary',
		target,
		target.version
	);
	const reviewAssignment = {
		schemaVersion: 'family-affinity-review-assignment-v1' as const,
		issuerRole: 'controller' as const,
		issuerId: 'review-controller-alpha',
		issuerAttestationSha256: familyAffinityReviewIssuerAttestationSha256({
			issuerId: 'review-controller-alpha',
			reviewerId: receipt.reviewerId,
			kind: 'ordinary',
			manifestPath,
			manifestSha256,
			target,
			targetPath: attemptPaths.target,
			productionAssignment: assignment,
			productionAssignmentPath: attemptPaths.assignment,
			result,
			resultSha256: receipt.resultSha256,
			decisionVersion: target.version,
			permittedReceiptPath: target.ownedPaths.decision
		}),
		reviewKind: 'ordinary' as const,
		assignmentId: `${target.targetId}/ordinary-review-v${target.version}/assignment`,
		reviewerId: receipt.reviewerId,
		producerId: result.producerId,
		producerIdentitySha256: result.producerId
			? familyAffinityProducerIdentitySha256(result.producerId)
			: receipt.producerIdentitySha256,
		manifestPath,
		manifestSha256,
		targetId: target.targetId,
		targetPath: attemptPaths.target,
		targetSha256: familyAffinitySha256(target),
		productionAssignmentPath: attemptPaths.assignment,
		productionAssignmentSha256: familyAffinitySha256(assignment),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		decisionVersion: target.version,
		candidatePath: result.candidatePath,
		candidateSha256: result.candidateSha256,
		resultPath: result.resultPath,
		resultSha256: receipt.resultSha256,
		sourcePath: result.sourcePath,
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256,
		permittedReceiptPath: target.ownedPaths.decision,
		exclusiveCreateRequired: true as const,
		runtimeCatalogMutationForbidden: true as const
	};
	await writeOwnedFixture(root, reviewAssignmentPath, reviewAssignment);
	await writeOwnedFixture(root, target.ownedPaths.decision, receipt);
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
				canonicalCoordinateId: sourceEarth.coordinateId,
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
	formId?: 'goblin-runt' | 'goblin-cutter' | 'goblin-raider' | 'goblin-king';
}) {
	const root = await mkdtemp(join(tmpdir(), 'family-affinity-revision-'));
	const { mapping, familyPackets } = await loadCurrentClassAuditFixtures();
	const bundle = buildFamilyAffinityProductionBundle(familyPackets, mapping);
	for (const family of familyPackets) {
		await writeOwnedFixture(
			root,
			`${FAMILY_AFFINITY_ROOT}/families/${String(family.sourceRaceNumber).padStart(2, '0')}-${family.familyId}.json`,
			family
		);
	}
	for (const artifact of bundle.artifacts) {
		await writeOwnedFixture(root, artifact.path, artifact.value as object);
	}
	const source = bundle.targets.find(
		({ familyId, formId, affinity }) =>
			familyId === 'goblins' &&
			formId === (options?.formId ?? 'goblin-runt') &&
			affinity === 'normal'
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
			canonicalCoordinateId: `${source.familyId}/${source.formId}/earth`,
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
	const productionAssignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(await readFile(join(root, assignmentPath), 'utf8'))
	);
	const result = {
		schemaVersion: 'family-affinity-result-v1' as const,
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		producerId: 'producer-alpha',
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: familyAffinityRawSha256(candidateBytes),
		resultPath: target.ownedPaths.result,
		sourcePath: target.sources.familyPacketPath,
		sourceSha256: target.sources.familyPacketSha256,
		promptSha256: familyAffinityPromptSha256(target, productionAssignment),
		state: 'candidate-only' as const,
		runtimeCatalogMutationForbidden: true as const
	};
	const resultBytes = stableFamilyAffinityJson(result);
	await writeOwnedFixture(root, target.ownedPaths.result, resultBytes);
	const receipt = {
		...makeOrdinaryReviewReceipt(target, {
			decision: options?.decision ?? 'rejected',
			candidateSha256: result.candidateSha256,
			resultSha256: familyAffinityRawSha256(resultBytes),
			producerId: result.producerId
		}),
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256
	};
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	await writeOwnedFixture(root, manifestPath, manifest);
	const manifestBytes = await readFile(join(root, manifestPath));
	const manifestSha256 = familyAffinityRawSha256(manifestBytes);
	const ordinaryReviewAssignment = {
		schemaVersion: 'family-affinity-review-assignment-v1',
		issuerRole: 'controller',
		issuerId: 'review-controller-alpha',
		issuerAttestationSha256: familyAffinityReviewIssuerAttestationSha256({
			issuerId: 'review-controller-alpha',
			reviewerId: receipt.reviewerId,
			kind: 'ordinary',
			manifestPath,
			manifestSha256,
			target,
			targetPath,
			productionAssignment,
			productionAssignmentPath: assignmentPath,
			result,
			resultSha256: receipt.resultSha256,
			decisionVersion: target.version,
			permittedReceiptPath: target.ownedPaths.decision
		}),
		reviewKind: 'ordinary',
		assignmentId: `${target.targetId}/ordinary-review-v${target.version}/assignment`,
		reviewerId: receipt.reviewerId,
		producerId: result.producerId,
		producerIdentitySha256: receipt.producerIdentitySha256,
		manifestPath,
		manifestSha256,
		targetId: target.targetId,
		targetPath,
		targetSha256: familyAffinitySha256(target),
		productionAssignmentPath: assignmentPath,
		productionAssignmentSha256: familyAffinitySha256(productionAssignment),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		decisionVersion: target.version,
		candidatePath: result.candidatePath,
		candidateSha256: result.candidateSha256,
		resultPath: result.resultPath,
		resultSha256: receipt.resultSha256,
		sourcePath: result.sourcePath,
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256,
		permittedReceiptPath: target.ownedPaths.decision,
		exclusiveCreateRequired: true,
		runtimeCatalogMutationForbidden: true
	};
	await writeOwnedFixture(
		root,
		familyAffinityReviewAssignmentPath('ordinary', target, target.version),
		ordinaryReviewAssignment
	);
	await writeOwnedFixture(root, target.ownedPaths.decision, receipt);
	if (target.tier === 'T3' || target.tier === 'T5') {
		const { producerId: _concealedProducerId, ...ordinaryWithoutProducer } = receipt;
		const blindReceipt = {
			...ordinaryWithoutProducer,
			schemaVersion: 'family-affinity-blind-review-v1',
			receiptType: 'blind',
			reviewerId: 'reviewer-gamma',
			blindToProducerIdentity: true,
			blindToOrdinaryDecision: true
		};
		const blindReviewAssignment = {
			...ordinaryReviewAssignment,
			issuerId: 'review-controller-gamma',
			reviewKind: 'blind',
			assignmentId: `${target.targetId}/blind-review-v${target.version}/assignment`,
			reviewerId: blindReceipt.reviewerId,
			producerId: null,
			permittedReceiptPath: target.ownedPaths.blindReview,
			issuerAttestationSha256: familyAffinityReviewIssuerAttestationSha256({
				issuerId: 'review-controller-gamma',
				reviewerId: blindReceipt.reviewerId,
				kind: 'blind',
				manifestPath,
				manifestSha256,
				target,
				targetPath,
				productionAssignment,
				productionAssignmentPath: assignmentPath,
				result,
				resultSha256: receipt.resultSha256,
				decisionVersion: target.version,
				permittedReceiptPath: target.ownedPaths.blindReview
			})
		};
		await writeOwnedFixture(
			root,
			familyAffinityReviewAssignmentPath('blind', target, target.version),
			blindReviewAssignment
		);
		await writeOwnedFixture(root, target.ownedPaths.blindReview, blindReceipt);
	}
	return { root, target, manifestPath, coordinate, receipt, result };
}

async function addRevisionEvidence(
	fixture: Awaited<ReturnType<typeof makeRevisionFixture>>,
	formId: 'goblin-cutter' | 'goblin-raider' = 'goblin-cutter',
	decision: 'rejected' | 'revise' = 'revise'
) {
	const manifestBytes = await readFile(join(fixture.root, fixture.manifestPath));
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
		({ coordinateId }) => coordinateId === `goblins/${formId}/normal`
	)!;
	const target = FamilyAffinityTargetSchema.parse(
		JSON.parse(await readFile(join(fixture.root, coordinate.targetPath), 'utf8'))
	);
	const productionAssignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(await readFile(join(fixture.root, coordinate.assignmentPath), 'utf8'))
	);
	const candidateBytes = `candidate-pixels-${formId}-v1`;
	await writeOwnedFixture(fixture.root, target.ownedPaths.candidate, candidateBytes);
	const result = {
		schemaVersion: 'family-affinity-result-v1' as const,
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		producerId: `producer-${formId}`,
		candidatePath: target.ownedPaths.candidate,
		candidateSha256: familyAffinityRawSha256(candidateBytes),
		resultPath: target.ownedPaths.result,
		sourcePath: target.sources.familyPacketPath,
		sourceSha256: target.sources.familyPacketSha256,
		promptSha256: familyAffinityPromptSha256(target, productionAssignment),
		state: 'candidate-only' as const,
		runtimeCatalogMutationForbidden: true as const
	};
	const resultBytes = stableFamilyAffinityJson(result);
	await writeOwnedFixture(fixture.root, target.ownedPaths.result, resultBytes);
	const receipt = {
		...makeOrdinaryReviewReceipt(target, {
			decision,
			candidateSha256: result.candidateSha256,
			resultSha256: familyAffinityRawSha256(resultBytes),
			producerId: result.producerId
		}),
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256
	};
	const manifestSha256 = familyAffinityRawSha256(manifestBytes);
	const reviewAssignment = {
		schemaVersion: 'family-affinity-review-assignment-v1',
		issuerRole: 'controller',
		issuerId: `review-controller-${formId}`,
		issuerAttestationSha256: familyAffinityReviewIssuerAttestationSha256({
			issuerId: `review-controller-${formId}`,
			reviewerId: receipt.reviewerId,
			kind: 'ordinary',
			manifestPath: fixture.manifestPath,
			manifestSha256,
			target,
			targetPath: coordinate.targetPath,
			productionAssignment,
			productionAssignmentPath: coordinate.assignmentPath,
			result,
			resultSha256: receipt.resultSha256,
			decisionVersion: target.version,
			permittedReceiptPath: target.ownedPaths.decision
		}),
		reviewKind: 'ordinary',
		assignmentId: `${target.targetId}/ordinary-review-v${target.version}/assignment`,
		reviewerId: receipt.reviewerId,
		producerId: result.producerId,
		producerIdentitySha256: receipt.producerIdentitySha256,
		manifestPath: fixture.manifestPath,
		manifestSha256,
		targetId: target.targetId,
		targetPath: coordinate.targetPath,
		targetSha256: familyAffinitySha256(target),
		productionAssignmentPath: coordinate.assignmentPath,
		productionAssignmentSha256: familyAffinitySha256(productionAssignment),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		decisionVersion: target.version,
		candidatePath: result.candidatePath,
		candidateSha256: result.candidateSha256,
		resultPath: result.resultPath,
		resultSha256: receipt.resultSha256,
		sourcePath: result.sourcePath,
		sourceSha256: result.sourceSha256,
		promptSha256: result.promptSha256,
		permittedReceiptPath: target.ownedPaths.decision,
		exclusiveCreateRequired: true,
		runtimeCatalogMutationForbidden: true
	};
	await writeOwnedFixture(
		fixture.root,
		familyAffinityReviewAssignmentPath('ordinary', target, target.version),
		reviewAssignment
	);
	await writeOwnedFixture(fixture.root, target.ownedPaths.decision, receipt);
	return {
		target,
		coordinate,
		entry: {
			namespace: 'canonical' as const,
			coordinateId: target.coordinateId,
			reviewPath: target.ownedPaths.decision
		}
	};
}

async function stagePlannedElemental(
	fixture: Awaited<ReturnType<typeof makeRevisionFixture>>,
	affinity: 'fire' | 'earth' | 'wind' | 'water' = 'fire'
) {
	const manifest = FamilyAffinityManifestSchema.parse(
		JSON.parse(await readFile(join(fixture.root, fixture.manifestPath), 'utf8'))
	);
	const coordinate = manifest.canonicalMatrix.activeCoordinates.find(
		({ coordinateId }) =>
			coordinateId === `${fixture.target.familyId}/${fixture.target.formId}/${affinity}`
	)!;
	const elementalTarget = FamilyAffinityTargetSchema.parse(
		JSON.parse(await readFile(join(fixture.root, coordinate.targetPath), 'utf8'))
	);
	const elementalAssignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(await readFile(join(fixture.root, coordinate.assignmentPath), 'utf8'))
	);
	const receiptBytes = await readFile(join(fixture.root, fixture.target.ownedPaths.decision));
	const target = FamilyAffinityTargetSchema.parse({
		...elementalTarget,
		status: 'planned',
		anchor: {
			kind: 'normal-approved-review',
			normalCoordinateId: fixture.target.coordinateId,
			normalVersion: fixture.target.version,
			normalTargetPath: fixture.coordinate.targetPath,
			normalTargetSha256: fixture.coordinate.targetSha256,
			reviewReceiptPath: fixture.target.ownedPaths.decision,
			reviewReceiptSha256: familyAffinityRawSha256(receiptBytes),
			normalCandidatePath: fixture.receipt.candidatePath,
			normalCandidateSha256: fixture.receipt.candidateSha256,
			normalResultPath: fixture.receipt.resultPath,
			normalResultSha256: fixture.receipt.resultSha256
		}
	});
	const assignment = FamilyAffinityAssignmentSchema.parse({
		...elementalAssignment,
		targetSha256: familyAffinitySha256(target),
		dispatchStatus: 'planned'
	});
	coordinate.status = 'planned';
	coordinate.targetSha256 = familyAffinitySha256(target);
	coordinate.assignmentSha256 = familyAffinitySha256(assignment);
	await writeOwnedFixture(fixture.root, coordinate.targetPath, target);
	await writeOwnedFixture(fixture.root, coordinate.assignmentPath, assignment);
	await writeOwnedFixture(fixture.root, fixture.manifestPath, manifest);
	const manifestBytes = await readFile(join(fixture.root, fixture.manifestPath));
	const manifestSha256 = familyAffinityRawSha256(manifestBytes);
	const productionAssignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(await readFile(join(fixture.root, fixture.coordinate.assignmentPath), 'utf8'))
	);
	for (const kind of [
		'ordinary',
		...(fixture.target.tier === 'T3' || fixture.target.tier === 'T5' ? (['blind'] as const) : [])
	] as const) {
		const reviewAssignmentPath = familyAffinityReviewAssignmentPath(
			kind,
			fixture.target,
			fixture.target.version
		);
		const reviewAssignment = JSON.parse(
			await readFile(join(fixture.root, reviewAssignmentPath), 'utf8')
		);
		reviewAssignment.manifestSha256 = manifestSha256;
		reviewAssignment.issuerAttestationSha256 = familyAffinityReviewIssuerAttestationSha256({
			issuerId: reviewAssignment.issuerId,
			reviewerId: reviewAssignment.reviewerId,
			kind,
			manifestPath: fixture.manifestPath,
			manifestSha256,
			target: fixture.target,
			targetPath: fixture.coordinate.targetPath,
			productionAssignment,
			productionAssignmentPath: fixture.coordinate.assignmentPath,
			result: fixture.result,
			resultSha256: fixture.receipt.resultSha256,
			decisionVersion: fixture.target.version,
			permittedReceiptPath:
				kind === 'ordinary'
					? fixture.target.ownedPaths.decision
					: fixture.target.ownedPaths.blindReview
		});
		await writeOwnedFixture(fixture.root, reviewAssignmentPath, reviewAssignment);
	}
	return { coordinate, target, assignment };
}

describe('family affinity revision CLI parsing', () => {
	it('parses compatible single and repeated-entry invocations', () => {
		expect(
			parseFamilyAffinityRevisionCli([
				'--caller-role',
				'integration-controller',
				'--namespace',
				'canonical',
				'--coordinate',
				'goblins/goblin-runt/normal',
				'--review-path',
				'review/one.json'
			])
		).toEqual({
			callerRole: 'integration-controller',
			entries: [
				{
					namespace: 'canonical',
					coordinateId: 'goblins/goblin-runt/normal',
					reviewPath: 'review/one.json'
				}
			]
		});
		const first = JSON.stringify({
			namespace: 'bridge',
			coordinateId: 'class/family/form/earth',
			reviewPath: 'review/one.json'
		});
		const second = JSON.stringify({
			namespace: 'bridge',
			coordinateId: 'other/family/form/earth',
			reviewPath: 'review/two.json'
		});
		expect(
			parseFamilyAffinityRevisionCli([
				'--caller-role',
				'integration-controller',
				'--entry',
				first,
				'--entry',
				second
			]).entries
		).toHaveLength(2);
	});

	it.each(['--caller-role', '--namespace', '--coordinate', '--review-path'])(
		'rejects repeated singleton flag %s',
		(flag) => {
			const argv = [
				'--caller-role',
				'integration-controller',
				'--namespace',
				'canonical',
				'--coordinate',
				'goblins/goblin-runt/normal',
				'--review-path',
				'review/one.json',
				flag,
				'extra-value'
			];
			expect(() => parseFamilyAffinityRevisionCli(argv)).toThrow(/repeated singleton/i);
		}
	);

	it('rejects unknown flags and positional arguments', () => {
		expect(() =>
			parseFamilyAffinityRevisionCli(['--caller-role', 'integration-controller', '--unknown', 'x'])
		).toThrow(/unknown or positional argument.*--unknown/i);
		expect(() => parseFamilyAffinityRevisionCli(['positional', 'value'])).toThrow(
			/unknown or positional argument.*positional/i
		);
	});

	it.each(['--caller-role', '--namespace', '--coordinate', '--review-path', '--entry'])(
		'rejects a missing value after %s',
		(flag) => {
			const prefix = flag === '--caller-role' ? [] : ['--caller-role', 'integration-controller'];
			expect(() => parseFamilyAffinityRevisionCli([...prefix, flag])).toThrow(
				new RegExp(`Missing value after ${flag}`)
			);
		}
	);

	it('rejects ambiguous single and batch flags in either order', () => {
		const entry = JSON.stringify({
			namespace: 'canonical',
			coordinateId: 'goblins/goblin-runt/normal',
			reviewPath: 'review/one.json'
		});
		for (const argv of [
			[
				'--caller-role',
				'integration-controller',
				'--entry',
				entry,
				'--coordinate',
				'goblins/goblin-runt/normal'
			],
			[
				'--caller-role',
				'integration-controller',
				'--review-path',
				'review/one.json',
				'--entry',
				entry
			]
		]) {
			expect(() => parseFamilyAffinityRevisionCli(argv)).toThrow(/cannot be mixed/i);
		}
	});

	it.each([
		'null',
		'[]',
		JSON.stringify({ namespace: 'canonical', coordinateId: 'coordinate' }),
		JSON.stringify({
			namespace: 'canonical',
			coordinateId: 'coordinate',
			reviewPath: 'review.json',
			unknown: true
		}),
		JSON.stringify({ namespace: 1, coordinateId: 'coordinate', reviewPath: 'review.json' }),
		JSON.stringify({ namespace: 'canonical', coordinateId: 1, reviewPath: 'review.json' }),
		JSON.stringify({ namespace: 'canonical', coordinateId: 'coordinate', reviewPath: false })
	])('rejects non-strict batch entry %s', (entry) => {
		expect(() =>
			parseFamilyAffinityRevisionCli(['--caller-role', 'integration-controller', '--entry', entry])
		).toThrow(/entry/i);
	});
});

describe('controller-only family affinity revision allocation', () => {
	it('rejects a mixed canonical and bridge batch before writing either namespace', async () => {
		const fixture = await makeRevisionFixture({ namespace: 'bridge', decision: 'revise' });
		try {
			const canonical = await addRevisionEvidence(fixture);
			const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath), 'utf8');
			const bridgePaths = bridgeAttemptPaths(
				fixture.target.currentClassId!,
				fixture.target.affinity,
				2
			);
			const canonicalPaths = canonicalAttemptPaths(
				canonical.target.familyId,
				canonical.target.formId,
				canonical.target.affinity,
				2
			);
			await expect(
				allocateFamilyAffinityRevisionBatch({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					callerRole: 'integration-controller',
					entries: [
						{
							namespace: 'bridge',
							coordinateId: fixture.target.coordinateId,
							reviewPath: fixture.target.ownedPaths.decision
						},
						canonical.entry
					]
				})
			).rejects.toThrow(/cannot mix canonical and bridge/i);
			expect(await readFile(join(fixture.root, fixture.manifestPath), 'utf8')).toBe(manifestBefore);
			for (const path of [
				bridgePaths.target,
				bridgePaths.assignment,
				canonicalPaths.target,
				canonicalPaths.assignment
			]) {
				await expect(readFile(join(fixture.root, path))).rejects.toMatchObject({ code: 'ENOENT' });
			}
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it.each(['target', 'assignment', 'candidate', 'result', 'decision', 'blindReview'] as const)(
		'rejects a dangling symlink at the future %s path with zero mutation',
		async (kind) => {
			const fixture = await makeRevisionFixture({ decision: 'revise' });
			try {
				const paths = canonicalAttemptPaths(
					fixture.target.familyId,
					fixture.target.formId,
					fixture.target.affinity,
					2
				);
				const danglingAbsolute = join(fixture.root, paths[kind]);
				await mkdir(join(danglingAbsolute, '..'), { recursive: true });
				await symlink('missing-owned-path', danglingAbsolute);
				const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath), 'utf8');
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
				expect(await readFile(join(fixture.root, fixture.manifestPath), 'utf8')).toBe(
					manifestBefore
				);
				expect((await lstat(danglingAbsolute)).isSymbolicLink()).toBe(true);
				for (const pairPath of [paths.target, paths.assignment]) {
					if (pairPath === paths[kind]) continue;
					await expect(readFile(join(fixture.root, pairPath))).rejects.toMatchObject({
						code: 'ENOENT'
					});
				}
			} finally {
				await rm(fixture.root, { recursive: true, force: true });
			}
		}
	);

	it('atomically allocates sibling review receipts bound to one manifest snapshot', async () => {
		const fixture = await makeRevisionFixture({ decision: 'revise' });
		try {
			const sibling = await addRevisionEvidence(fixture);
			const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath), 'utf8');
			const allocations = await allocateFamilyAffinityRevisionBatch({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				callerRole: 'integration-controller',
				entries: [
					{
						namespace: 'canonical',
						coordinateId: fixture.target.coordinateId,
						reviewPath: fixture.target.ownedPaths.decision
					},
					sibling.entry
				]
			});
			expect(allocations.map(({ target }) => target.version)).toEqual([2, 2]);
			expect(allocations.map(({ target }) => target.precedingAttempt?.targetId)).toEqual([
				fixture.target.targetId,
				sibling.target.targetId
			]);
			const manifestAfterText = await readFile(join(fixture.root, fixture.manifestPath), 'utf8');
			expect(manifestAfterText).not.toBe(manifestBefore);
			const manifestAfter = FamilyAffinityManifestSchema.parse(JSON.parse(manifestAfterText));
			for (const coordinateId of [fixture.target.coordinateId, sibling.target.coordinateId]) {
				const active = manifestAfter.canonicalMatrix.activeCoordinates.find(
					(coordinate) => coordinate.coordinateId === coordinateId
				)!;
				expect(active.activeVersion).toBe(2);
				expect(active.targetPath).toMatch(/target-v2\.json$/u);
				expect(active.assignmentPath).toMatch(/assignment-v2\.json$/u);
			}
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('shows why sequential allocation stales an outstanding sibling receipt', async () => {
		const fixture = await makeRevisionFixture({ decision: 'revise' });
		try {
			const sibling = await addRevisionEvidence(fixture);
			await allocateFamilyAffinityRevision({
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				namespace: 'canonical',
				coordinateId: fixture.target.coordinateId,
				callerRole: 'integration-controller',
				reviewPath: fixture.target.ownedPaths.decision
			});
			await expect(
				allocateFamilyAffinityRevision({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					namespace: 'canonical',
					coordinateId: sibling.target.coordinateId,
					callerRole: 'integration-controller',
					reviewPath: sibling.target.ownedPaths.decision
				})
			).rejects.toThrow(/stale|forged|unauthorized|cross-bound/i);
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('rejects duplicate and mixed-invalid batches without changing the manifest or writing pairs', async () => {
		for (const failure of ['duplicate', 'mixed-invalid'] as const) {
			const fixture = await makeRevisionFixture({ decision: 'revise' });
			try {
				const sibling = await addRevisionEvidence(fixture);
				const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath), 'utf8');
				const firstEntry = {
					namespace: 'canonical' as const,
					coordinateId: fixture.target.coordinateId,
					reviewPath: fixture.target.ownedPaths.decision
				};
				const entries =
					failure === 'duplicate'
						? [firstEntry, firstEntry]
						: [firstEntry, { ...sibling.entry, reviewPath: 'foreign/review.json' }];
				await expect(
					allocateFamilyAffinityRevisionBatch({
						repositoryRoot: fixture.root,
						manifestPath: fixture.manifestPath,
						callerRole: 'integration-controller',
						entries
					})
				).rejects.toThrow();
				expect(await readFile(join(fixture.root, fixture.manifestPath), 'utf8')).toBe(
					manifestBefore
				);
				for (const target of [fixture.target, sibling.target]) {
					const paths = canonicalAttemptPaths(target.familyId, target.formId, target.affinity, 2);
					await expect(readFile(join(fixture.root, paths.target))).rejects.toMatchObject({
						code: 'ENOENT'
					});
					await expect(readFile(join(fixture.root, paths.assignment))).rejects.toMatchObject({
						code: 'ENOENT'
					});
				}
			} finally {
				await rm(fixture.root, { recursive: true, force: true });
			}
		}
	});

	it('rejects a collision anywhere in the batch before creating any other pair', async () => {
		const fixture = await makeRevisionFixture({ decision: 'revise' });
		try {
			const sibling = await addRevisionEvidence(fixture);
			const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath), 'utf8');
			const firstPaths = canonicalAttemptPaths(
				fixture.target.familyId,
				fixture.target.formId,
				fixture.target.affinity,
				2
			);
			const siblingPaths = canonicalAttemptPaths(
				sibling.target.familyId,
				sibling.target.formId,
				sibling.target.affinity,
				2
			);
			await writeOwnedFixture(fixture.root, siblingPaths.target, 'foreign-owner');
			await expect(
				allocateFamilyAffinityRevisionBatch({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					callerRole: 'integration-controller',
					entries: [
						{
							namespace: 'canonical',
							coordinateId: fixture.target.coordinateId,
							reviewPath: fixture.target.ownedPaths.decision
						},
						sibling.entry
					]
				})
			).rejects.toThrow(/collision/i);
			expect(await readFile(join(fixture.root, fixture.manifestPath), 'utf8')).toBe(manifestBefore);
			await expect(readFile(join(fixture.root, firstPaths.target))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(readFile(join(fixture.root, firstPaths.assignment))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			expect(await readFile(join(fixture.root, siblingPaths.target), 'utf8')).toBe('foreign-owner');
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('rolls back every created pair when a late manifest staging failure occurs', async () => {
		const fixture = await makeRevisionFixture({ decision: 'revise' });
		try {
			const sibling = await addRevisionEvidence(fixture);
			const manifestBefore = await readFile(join(fixture.root, fixture.manifestPath), 'utf8');
			const staleTemporary = `${fixture.manifestPath}.revision-allocation.tmp`;
			await writeOwnedFixture(fixture.root, staleTemporary, 'foreign-staging-owner');
			await expect(
				allocateFamilyAffinityRevisionBatch({
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					callerRole: 'integration-controller',
					entries: [
						{
							namespace: 'canonical',
							coordinateId: fixture.target.coordinateId,
							reviewPath: fixture.target.ownedPaths.decision
						},
						sibling.entry
					]
				})
			).rejects.toMatchObject({ code: 'EEXIST' });
			expect(await readFile(join(fixture.root, fixture.manifestPath), 'utf8')).toBe(manifestBefore);
			expect(await readFile(join(fixture.root, staleTemporary), 'utf8')).toBe(
				'foreign-staging-owner'
			);
			for (const target of [fixture.target, sibling.target]) {
				const paths = canonicalAttemptPaths(target.familyId, target.formId, target.affinity, 2);
				await expect(readFile(join(fixture.root, paths.target))).rejects.toMatchObject({
					code: 'ENOENT'
				});
				await expect(readFile(join(fixture.root, paths.assignment))).rejects.toMatchObject({
					code: 'ENOENT'
				});
			}
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('validates an approved Normal receipt as the exact filesystem anchor for an elemental target', async () => {
		const fixture = await makeRevisionFixture({
			formId: 'goblin-cutter',
			decision: 'approved-review'
		});
		try {
			const { coordinate: fireCoordinate } = await stagePlannedElemental(fixture);
			const anchorInput = {
				repositoryRoot: fixture.root,
				manifestPath: fixture.manifestPath,
				targetPath: fireCoordinate.targetPath
			};
			await expect(
				validateFamilyAffinityNormalAnchorEvidence(anchorInput)
			).resolves.toBeUndefined();
			const manifestAbsolute = join(fixture.root, fixture.manifestPath);
			const manifestBytes = await readFile(manifestAbsolute);
			for (const [label, mutate] of [
				['status', (coordinate: any) => (coordinate.status = 'blocked-on-anchor')],
				['activeVersion', (coordinate: any) => (coordinate.activeVersion = 2)],
				['assignmentPath', (coordinate: any) => (coordinate.assignmentPath += '.foreign')],
				['assignmentSha256', (coordinate: any) => (coordinate.assignmentSha256 = 'a'.repeat(64))]
			] as const) {
				const tamperedManifest = JSON.parse(manifestBytes.toString('utf8'));
				const normalCoordinate = tamperedManifest.canonicalMatrix.activeCoordinates.find(
					({ coordinateId }: { coordinateId: string }) =>
						coordinateId === fixture.target.coordinateId
				)!;
				mutate(normalCoordinate);
				await writeOwnedFixture(fixture.root, fixture.manifestPath, tamperedManifest);
				await expect(
					validateFamilyAffinityNormalAnchorEvidence(anchorInput),
					label
				).rejects.toThrow();
				await writeFile(manifestAbsolute, manifestBytes);
			}
			await writeFile(manifestAbsolute, Buffer.concat([manifestBytes, Buffer.from(' ')]));
			await expect(validateFamilyAffinityNormalAnchorEvidence(anchorInput)).rejects.toThrow(
				/manifest|attestation|assignment|stale|forged|cross-bound/i
			);
			await writeFile(manifestAbsolute, manifestBytes);

			const resultPath = join(fixture.root, fixture.receipt.resultPath);
			const receiptPath = join(fixture.root, fixture.target.ownedPaths.decision);
			const ordinaryAssignmentPath = join(
				fixture.root,
				familyAffinityReviewAssignmentPath('ordinary', fixture.target, fixture.target.version)
			);
			const [resultBytes, receiptBytes, ordinaryAssignmentBytes] = await Promise.all([
				readFile(resultPath),
				readFile(receiptPath),
				readFile(ordinaryAssignmentPath)
			]);
			await writeFile(resultPath, '{"normal":"result"}\n');
			await writeFile(
				receiptPath,
				stableFamilyAffinityJson({
					targetId: fixture.target.targetId,
					candidatePath: fixture.receipt.candidatePath,
					candidateSha256: fixture.receipt.candidateSha256,
					resultPath: fixture.receipt.resultPath,
					resultSha256: fixture.receipt.resultSha256,
					decision: 'approved-review',
					reviewerId: 'reviewer-beta'
				})
			);
			await expect(validateFamilyAffinityNormalAnchorEvidence(anchorInput)).rejects.toThrow();
			await writeFile(resultPath, resultBytes);
			await writeFile(receiptPath, receiptBytes);

			await rm(ordinaryAssignmentPath);
			await expect(validateFamilyAffinityNormalAnchorEvidence(anchorInput)).rejects.toThrow();
			await writeFile(ordinaryAssignmentPath, ordinaryAssignmentBytes);

			await writeFile(resultPath, `${resultBytes.toString('utf8')}\n`);
			await expect(validateFamilyAffinityNormalAnchorEvidence(anchorInput)).rejects.toThrow(
				/stale|forged|cross-bound|mismatch/i
			);
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	});

	it('requires a complete independent blind-review chain for T3 and T5 Normal anchors', async () => {
		for (const formId of ['goblin-raider', 'goblin-king'] as const) {
			const fixture = await makeRevisionFixture({ formId, decision: 'approved-review' });
			try {
				const { coordinate } = await stagePlannedElemental(fixture);
				const input = {
					repositoryRoot: fixture.root,
					manifestPath: fixture.manifestPath,
					targetPath: coordinate.targetPath
				};
				await expect(validateFamilyAffinityNormalAnchorEvidence(input)).resolves.toBeUndefined();
				const blindReceiptPath = join(fixture.root, fixture.target.ownedPaths.blindReview);
				const blindAssignmentPath = join(
					fixture.root,
					familyAffinityReviewAssignmentPath('blind', fixture.target, fixture.target.version)
				);
				const [blindReceiptBytes, blindAssignmentBytes] = await Promise.all([
					readFile(blindReceiptPath),
					readFile(blindAssignmentPath)
				]);
				await rm(blindReceiptPath);
				await expect(validateFamilyAffinityNormalAnchorEvidence(input)).rejects.toThrow();
				await writeFile(blindReceiptPath, blindReceiptBytes);
				await rm(blindAssignmentPath);
				await expect(validateFamilyAffinityNormalAnchorEvidence(input)).rejects.toThrow();
				await writeFile(blindAssignmentPath, blindAssignmentBytes);
				const blindReceipt = JSON.parse(blindReceiptBytes.toString('utf8'));
				blindReceipt.reviewerId = fixture.receipt.reviewerId;
				await writeOwnedFixture(fixture.root, fixture.target.ownedPaths.blindReview, blindReceipt);
				await expect(validateFamilyAffinityNormalAnchorEvidence(input)).rejects.toThrow(
					/independent|forged|cross-bound|mismatch/i
				);
			} finally {
				await rm(fixture.root, { recursive: true, force: true });
			}
		}
	});

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
				const proposed = canonicalAttemptPaths(
					fixture.target.familyId,
					fixture.target.formId,
					fixture.target.affinity,
					2
				)[kind];
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

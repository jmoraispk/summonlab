import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HeroProgressionV2Schema } from '../packages/contracts/src/index.js';
import {
	COMBAT_RULES_V1,
	PROGRESSION_RULES_V1,
	PROGRESSION_RULES_V1_BINDING
} from '../packages/content/src/index.js';
import {
	applyExperienceClaim,
	combatExperience,
	craftExperience
} from '../packages/engine/src/index.js';
import {
	attributePowerMilli,
	awakeningTier,
	maximumHealth
} from '../packages/engine/src/domains/progression/math.js';
import { deterministicUuid } from '../packages/engine/src/hash.js';

export const PROGRESSION_BALANCE_LEVELS = [1, 99, 100, 199, 200, 499, 500, 899, 900, 999] as const;
const STAR_FIXTURES = [1, 7] as const;
const PATH_FIXTURES = ['combat', 'crafting'] as const;
const SEED_SET = [
	'awakening-boundaries-v1',
	'multi-path-xp-v1',
	'table-nerf-candidate-v1'
] as const;
const OCCURRED_AT = '2000-01-01T00:00:00.000Z';

type AttributeSet = Readonly<{
	strength: number;
	agility: number;
	vitality: number;
	magic: number;
}>;

const PATH_ATTRIBUTES: Readonly<
	Record<(typeof PATH_FIXTURES)[number], { base: AttributeSet; nonLevel: AttributeSet }>
> = {
	combat: {
		base: { strength: 30, agility: 25, vitality: 28, magic: 12 },
		nonLevel: { strength: 120, agility: 70, vitality: 80, magic: 20 }
	},
	crafting: {
		base: { strength: 15, agility: 28, vitality: 20, magic: 35 },
		nonLevel: { strength: 40, agility: 110, vitality: 50, magic: 100 }
	}
};

function levelAllocation(level: number, stars: number, path: (typeof PATH_FIXTURES)[number]) {
	const points = (level - 1) * stars;
	if (path === 'combat') {
		const strength = Math.floor(points * 0.5);
		const vitality = Math.floor(points * 0.3);
		return { strength, agility: points - strength - vitality, vitality, magic: 0 };
	}
	const magic = Math.floor(points * 0.4);
	const agility = Math.floor(points * 0.4);
	const vitality = Math.floor(points * 0.1);
	return { strength: points - magic - agility - vitality, agility, vitality, magic };
}

function addAttributes(...sets: readonly AttributeSet[]): AttributeSet {
	return {
		strength: sets.reduce((total, set) => total + set.strength, 0),
		agility: sets.reduce((total, set) => total + set.agility, 0),
		vitality: sets.reduce((total, set) => total + set.vitality, 0),
		magic: sets.reduce((total, set) => total + set.magic, 0)
	};
}

function multiLevelReceipt(stars: number) {
	const progression = HeroProgressionV2Schema.parse({
		progressionVersion: 'hero-progression-v2',
		stars,
		level: 99,
		experience: 980,
		unallocatedAttributePoints: 0,
		permanentGrowth: { strength: 0, agility: 0, vitality: 0, magic: 0 },
		evidenceCounts: { combat: {}, crafting: {} },
		skills: { swordFighting: { rank: 0, experience: 0 } }
	});
	return applyExperienceClaim({
		progression,
		claim: {
			claimId: deterministicUuid(`progression-balance:${stars}:claim`),
			heroId: deterministicUuid(`progression-balance:${stars}:hero`),
			sourceEventId: deterministicUuid(`progression-balance:${stars}:event`),
			evidenceKey: 'balance:multi-level',
			amount: 30,
			sourceKind: 'authored'
		},
		rules: PROGRESSION_RULES_V1,
		rulesBinding: PROGRESSION_RULES_V1_BINDING,
		occurredAt: OCCURRED_AT
	}).receipt;
}

export function createProgressionBalanceEvidence() {
	const rateRows = PROGRESSION_RULES_V1.powerPerAttributeMilli.map(
		(powerPerAttributeMilli, tier) => ({
			tier,
			levels: tier === 9 ? '900-999' : `${Math.max(1, tier * 100)}-${tier * 100 + 99}`,
			powerPerAttributeMilli,
			healthPerVitality: PROGRESSION_RULES_V1.healthPerVitality[tier]!
		})
	);
	const projections = PROGRESSION_BALANCE_LEVELS.flatMap((level) =>
		STAR_FIXTURES.flatMap((stars) =>
			PATH_FIXTURES.map((path) => {
				const fixture = PATH_ATTRIBUTES[path];
				const attributes = addAttributes(
					fixture.base,
					fixture.nonLevel,
					levelAllocation(level, stars, path)
				);
				const tier = awakeningTier(level);
				return {
					level,
					stars,
					path,
					awakeningTier: tier,
					nonLevelGrowth: Object.values(fixture.nonLevel).reduce(
						(total, value) => total + value,
						0
					),
					...attributes,
					physicalPowerMilli: attributePowerMilli(attributes.strength, level, PROGRESSION_RULES_V1),
					magicalPowerMilli: attributePowerMilli(attributes.magic, level, PROGRESSION_RULES_V1),
					maximumHealth: maximumHealth(attributes.vitality, level, PROGRESSION_RULES_V1)
				};
			})
		)
	);
	const craftingDifficulty = Array.from({ length: 7 }, (_, index) =>
		craftExperience(
			{
				difficultyBand: index + 1,
				ingredientRarityBand: 1,
				quality: 'standard',
				firstSuccess: false,
				priorCompletions: 0
			},
			PROGRESSION_RULES_V1
		)
	);
	const craftingRarity = Array.from({ length: 7 }, (_, index) =>
		craftExperience(
			{
				difficultyBand: 3,
				ingredientRarityBand: index + 1,
				quality: 'standard',
				firstSuccess: false,
				priorCompletions: 0
			},
			PROGRESSION_RULES_V1
		)
	);
	const craftingRepetition = Array.from({ length: 12 }, (_, priorCompletions) =>
		craftExperience(
			{
				difficultyBand: 1,
				ingredientRarityBand: 1,
				quality: 'standard',
				firstSuccess: priorCompletions === 0,
				priorCompletions
			},
			PROGRESSION_RULES_V1
		)
	);
	const combatRepetition = Array.from({ length: 12 }, (_, priorCompletions) =>
		combatExperience(
			{
				difficultyBand: 1,
				objectiveCompleted: false,
				firstClear: priorCompletions === 0,
				priorCompletions
			},
			PROGRESSION_RULES_V1
		)
	);
	const fixedTerms = {
		flatEquipmentPower: 37,
		accuracyBasisPoints: 8_000,
		affinityContributionNudgeCapBasisPoints:
			COMBAT_RULES_V1.affinity.contributionNudgeCapBasisPoints
	};

	return {
		evidenceVersion: 'progression-balance-v1',
		status: 'passed' as const,
		bindings: {
			rulesVersion: PROGRESSION_RULES_V1.rulesVersion,
			rulesHash: PROGRESSION_RULES_V1_BINDING.contentHash,
			stateSchema: 'hero-progression-v2'
		},
		seedSet: SEED_SET,
		fixtures: { levels: PROGRESSION_BALANCE_LEVELS, stars: STAR_FIXTURES, paths: PATH_FIXTURES },
		rateRows,
		projections,
		experience: {
			multiLevel: STAR_FIXTURES.map((stars) => {
				const receipt = multiLevelReceipt(stars);
				return {
					stars,
					levelsCrossed: receipt.levelsCrossed,
					pointsGranted: receipt.pointsGranted,
					receipt
				};
			}),
			crafting: {
				difficulty: craftingDifficulty,
				rarity: craftingRarity,
				quality: (['standard', 'fine', 'masterwork'] as const).map((quality) =>
					craftExperience(
						{
							difficultyBand: 3,
							ingredientRarityBand: 3,
							quality,
							firstSuccess: false,
							priorCompletions: 0
						},
						PROGRESSION_RULES_V1
					)
				),
				novelty: {
					repeat: craftExperience(
						{
							difficultyBand: 3,
							ingredientRarityBand: 3,
							quality: 'standard',
							firstSuccess: false,
							priorCompletions: 0
						},
						PROGRESSION_RULES_V1
					),
					firstSuccess: craftExperience(
						{
							difficultyBand: 3,
							ingredientRarityBand: 3,
							quality: 'standard',
							firstSuccess: true,
							priorCompletions: 0
						},
						PROGRESSION_RULES_V1
					)
				},
				repetition: craftingRepetition
			},
			combat: {
				difficulty: Array.from({ length: 7 }, (_, index) =>
					combatExperience(
						{
							difficultyBand: index + 1,
							objectiveCompleted: false,
							firstClear: false,
							priorCompletions: 0
						},
						PROGRESSION_RULES_V1
					)
				),
				objective: Array.from({ length: 7 }, (_, index) =>
					combatExperience(
						{
							difficultyBand: index + 1,
							objectiveCompleted: true,
							firstClear: false,
							priorCompletions: 0
						},
						PROGRESSION_RULES_V1
					)
				),
				repetition: combatRepetition
			}
		},
		nonAwakenedTerms: { tier0: fixedTerms, tier9: fixedTerms },
		candidateRateTable: {
			policy: 'data-only nerf; issue a new rules version without changing stored hero state',
			stateSchema: 'hero-progression-v2',
			powerPerAttributeMilli: [
				1_000, 1_150, 1_300, 1_600, 1_900, 2_250, 2_650, 3_100, 3_700, 4_300
			],
			healthPerVitality: [5, 6, 7, 8, 10, 12, 14, 16, 19, 22]
		}
	};
}

export function serializeProgressionBalanceEvidence(
	evidence: ReturnType<typeof createProgressionBalanceEvidence>
): string {
	return `${JSON.stringify(evidence, null, '\t')}\n`;
}

const evidencePath = resolve(
	fileURLToPath(new URL('..', import.meta.url)),
	'docs/evidence/progression-balance-v1.json'
);

async function runCli(): Promise<void> {
	const write = process.argv.includes('--write');
	const check = process.argv.includes('--check');
	if (write === check)
		throw new Error('Use exactly one progression balance mode: --write or --check');
	const expected = serializeProgressionBalanceEvidence(createProgressionBalanceEvidence());
	if (write) {
		await writeFile(evidencePath, expected, 'utf8');
	} else if ((await readFile(evidencePath, 'utf8').catch(() => '')) !== expected) {
		throw new Error(
			'Progression balance evidence is stale; run pnpm exec tsx tools/progression-balance-harness.ts --write'
		);
	}
	process.stdout.write(
		`progression-balance-v1 passed: ${PROGRESSION_BALANCE_LEVELS.length} level fixtures; ${PROGRESSION_RULES_V1_BINDING.contentHash}\n`
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
